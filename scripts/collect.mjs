import { load } from 'cheerio';
import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { SOURCES, NEWSWIRE_LIMIT, safeUrl, safeImageUrl, urlIdentity, uniqueStories, newestFirst, validateSnapshot } from '../news-model.js';

function text(html) {
  const $ = load(String(html ?? '')); $('script,style').remove(); $('br').replaceWith(' ');
  return $.text().replace(/\s+/g, ' ').trim();
}
const array = value => value == null ? [] : Array.isArray(value) ? value : [value];
const date = value => value && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : null;
function feedImage(item) {
  const groups = [item, ...array(item['media:group'])];
  for (const group of groups) {
    const candidates = [
      ...array(group['media:content']).filter(media => media['@_medium'] === 'image' || /^image\//.test(media['@_type'] || '')),
      ...array(group['media:thumbnail']),
      ...array(group.enclosure).filter(media => /^image\//.test(media['@_type'] || '')),
    ];
    for (const media of candidates) {
      const url = safeImageUrl(media['@_url']);
      if (url) return { url, alt: text(media['media:description'] || group['media:description'] || ''), credit: text(media['media:credit'] || group['media:credit'] || '') };
    }
  }
  return null;
}
function imageStoryKey(value) {
  const url = safeUrl(value);
  if (!url) return null;
  const parsed = new URL(urlIdentity(url));
  parsed.pathname = parsed.pathname.replace(/\/$/, '') || '/';
  return parsed.href;
}
export function parseFeed(xml) {
  if (XMLValidator.validate(xml) !== true) throw new Error('Malformed XML feed');
  const parsed = new XMLParser({ ignoreAttributes: false, processEntities: true, trimValues: false, parseTagValue: false }).parse(xml);
  const channel = parsed.rss?.channel;
  const rdf = parsed['rdf:RDF'];
  if (!channel && !rdf) throw new Error('Expected RSS feed');
  const items = array(channel ? channel.item : rdf.item);
  const stories = items.map(item => {
    const title = text(item.title); const url = safeUrl(typeof item.link === 'string' ? item.link.trim() : '');
    if (!title || !url) throw new Error('Incomplete RSS item');
    const summary = text(item.description).slice(0, 240);
    return { title, url, summary, publishedAt: date(item.pubDate || item['dc:date']), image: feedImage(item) };
  });
  return uniqueStories(stories.sort(newestFirst)).slice(0, NEWSWIRE_LIMIT);
}
export function parseStringer(html) {
  const $ = load(html);
  const heading = $('h1').filter((i, el) => /COURAGEOUS STORIES/i.test($(el).text()));
  if (heading.length !== 1) throw new Error('Stringer editorial heading changed');
  const section = heading.closest('section');
  if (section.length !== 1) throw new Error('Stringer editorial section missing');
  // Fail closed if even one text group no longer uses the inspected source structure.
  if (section.find('p').toArray().some(el => !$(el).closest('.text-box').length)) throw new Error('Stringer text group structure changed');
  const images = new Map();
  section.find('a img').each((index, el) => {
    const key = imageStoryKey($(el).closest('a').attr('href'));
    const url = safeImageUrl($(el).attr('src'));
    if (key && url && !images.has(key)) images.set(key, { url, alt: $(el).attr('alt') || '', credit: '' });
  });
  const boxes = section.find('.text-box').filter((i, el) => !$(el).find('h1').length && !!$(el).text().trim());
  const stories = boxes.toArray().map(el => {
    const box = $(el); const paragraphs = box.children('p');
    const credits = paragraphs.first().text().trim();
    const links = box.find('a').filter((i, a) => !!$(a).text().trim());
    if (paragraphs.length < 2 || paragraphs.first().find('a').length || links.length !== 1) throw new Error('Incomplete Stringer story group');
    const title = links.text().trim(); const url = safeUrl(links.attr('href'));
    const description = paragraphs.slice(1).clone(); description.find('a').remove(); description.find('br').replaceWith(' ');
    const summary = description.toArray().map(p => $(p).text().trim()).filter(Boolean).join(' ').trim();
    if (!credits || !title || !url || !summary) throw new Error('Incomplete Stringer story fields');
    return { title, credits, summary, url, publishedAt: null, image: images.get(imageStoryKey(url)) || null };
  });
  if (!stories.length) throw new Error('Stringer extraction returned no stories');
  return stories;
}
export function checkBaseline(stories, previous, reset = false) {
  if (!reset && previous?.length && stories.length < previous.length * 0.75) throw new Error('Stringer count fell by over 25%; a reviewed baseline reset is required');
  return stories;
}
export async function fetchText(url, { fetchImpl = fetch, sleep = ms => new Promise(resolve => setTimeout(resolve, ms)), attempts = 3 } = {}) {
  let error;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const response = await fetchImpl(url, { signal: AbortSignal.timeout(15000), headers: { 'User-Agent': 'StringerNewsPortal/1.0', 'Accept': 'application/rss+xml, application/xml, text/html, application/json' }, cache: 'no-cache' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const body = await response.text();
      if (body.length > 5_000_000) throw new Error('Source response too large');
      return body;
    } catch (failure) { error = failure; if (attempt < attempts - 1) await sleep(500 * 2 ** attempt); }
  }
  throw error;
}
export function snapshotUrl(pagesUrl) {
  const safe = safeUrl(pagesUrl);
  if (!safe) throw new Error('PAGES_URL must be the configured GitHub Pages URL');
  const base = new URL(safe); base.hash = ''; base.search = ''; if (!base.pathname.endsWith('/')) base.pathname += '/';
  return new URL('data/news.json', base).href;
}
export async function collect({ pagesUrl, request = fetchText, now = () => new Date().toISOString(), resetStringerBaseline = false, log = console.warn } = {}) {
  let previous = null;
  try { previous = validateSnapshot(JSON.parse(await request(snapshotUrl(pagesUrl)))); }
  catch (error) { log(`Previous snapshot unavailable: ${error.message}. Every source must succeed to publish.`); }
  const entries = await Promise.all(SOURCES.map(async source => {
    const attemptedAt = now(); const old = previous?.sources[source.id];
    try {
      const body = await request(source.url);
      const stories = source.id === 'stringer' ? checkBaseline(parseStringer(body), old?.stories, resetStringerBaseline) : parseFeed(body);
      return [source.id, { stories, attemptedAt, lastSuccessAt: attemptedAt, status: 'success', error: null }];
    } catch (error) {
      log(`${source.name}: ${error.message}`);
      return [source.id, { stories: old?.stories || [], attemptedAt, lastSuccessAt: old?.lastSuccessAt || null, status: 'failure', error: String(error.message).slice(0, 250) }];
    }
  }));
  if (!previous && entries.some(([, entry]) => entry.status === 'failure')) throw new Error('Publication blocked: recovery unavailable and at least one source failed');
  return validateSnapshot({ schemaVersion: 2, generatedAt: now(), sources: Object.fromEntries(entries) });
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const snapshot = await collect({ pagesUrl: process.env.PAGES_URL, resetStringerBaseline: process.env.RESET_STRINGER_BASELINE === 'true' });
    await mkdir('data', { recursive: true });
    await writeFile('data/news.json', JSON.stringify(snapshot, null, 2) + '\n');
    for (const source of SOURCES) console.log(`${source.name}: ${snapshot.sources[source.id].stories.length} stories, ${snapshot.sources[source.id].status}`);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
