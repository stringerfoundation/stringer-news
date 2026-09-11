import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { load } from 'cheerio';
import { parseFeed, parseStringer, checkBaseline, fetchText, snapshotUrl, collect } from '../scripts/collect.mjs';
import { SOURCES, CONTENT_PERMISSIONS, applyContentPermissions, NEWSWIRE_LIMIT, validateSnapshot, worldStories, sourceMessage, safeUrl, safeImageUrl, STALE_MS } from '../news-model.js';
const fixtures = Object.fromEntries(SOURCES.map(s => [s.id, readFileSync(new URL(`./fixtures/${s.id === 'stringer' ? 'stringer.html' : `${s.id}.xml`}`, import.meta.url), 'utf8')]));
// Synthetic grants exercise parser/recovery behavior, not real publisher permission.
const testPermissions = Object.fromEntries(SOURCES.map(s => [s.id, { text: true, images: true }]));
const now = '2026-09-10T11:00:00.000Z';
const later = '2026-09-10T11:30:00.000Z';
const pagesUrl = 'https://example.org/stringer-news/';
const makeSnapshot = async (previous, failures = [], overrides = {}) => collect({permissions:testPermissions, pagesUrl, now:()=>previous ? later : now, log:()=>{}, request:async url => {
  if(url === snapshotUrl(pagesUrl)) { if(!previous) throw new Error('404');return typeof previous === 'string' ? previous : JSON.stringify(previous); }
  const s=SOURCES.find(s=>s.url===url);if(failures.includes(s.id)) throw new Error('Feed unavailable');return fixtures[s.id];
}, ...overrides});
const baseline = await makeSnapshot();
for(const source of SOURCES.filter(s=>s.id!=='stringer')) test(`${source.name}: real RSS fixture returns a bounded expanded headline pool`,()=>{
  const stories=parseFeed(fixtures[source.id]); assert.equal(stories.length,source.id === 'aljazeera' ? 25 : NEWSWIRE_LIMIT);for(const story of stories){assert.ok(story.title);assert.ok(safeUrl(story.url));assert.ok(story.summary.length<=240);}
});
test('Stringer preserves 24 editorial entries, order, teams, Unicode, and selected media links',()=>{
  const stories=parseStringer(fixtures.stringer);assert.equal(stories.length,24);assert.equal(stories[0].credits,'Kang-Chun Cheng');
  assert.equal(stories[8].credits,'Сніжана Мазур');assert.equal(stories[9].credits,'Cecilia Anesi and Zeynep Şentek');
  assert.match(stories[15].credits,/Carlos Martínez, Óscar Martínez/);assert.match(stories[12].url,/planetadelibros/);
  assert.match(stories[2].url,/facebook/);assert.ok(stories.every(s=>s.publishedAt===null));
});
test('Stringer ignores navigation and footer links',()=>{
  assert.equal(parseStringer(`<nav><a href="https://example.org">Other story</a></nav>${fixtures.stringer}<footer><p>Footer</p><a href="https://example.org">Media story</a></footer>`).length,24);
});
test('Stringer rejects changed and partially changed markup or missing story fields',()=>{
  for(const mutate of [
    $=>$('h1').remove(),
    $=>$('.text-box').eq(1).removeClass('text-box'),
    $=>$('.text-box').eq(1).find('a').remove(),
    $=>$('.text-box').eq(1).find('p').first().remove(),
    $=>$('.text-box').eq(1).find('p').last().html('<a href="javascript:alert(1)">Bad</a>Summary'),
    $=>$('.text-box').eq(1).find('p').last().html('<a href="https://example.org">No summary</a>'),
    $=>$('.text-box').slice(1).remove(),
  ]) { const $=load(fixtures.stringer); mutate($); assert.throws(()=>parseStringer($.html())); }
});
const item = (url,title,pubDate='')=>`<item><title>${title}</title><link>${url}</link><description><![CDATA[<b>Summary</b><script>unsafe()</script>]]></description>${pubDate?`<pubDate>${pubDate}</pubDate>`:''}</item>`;
test('RSS deduplicates before limiting, preserves queries, removes fragments, and puts undated items last',()=>{
  const xml=`<rss><channel>${item('https://example.org/a#one','Newest','2026-09-10')}${item('https://example.org/a#two','Duplicate','2026-09-09')}${item('https://example.org/a?q=1','Query one','2026-09-08')}${item('https://example.org/a?q=2','Query two','2026-09-07')}${item('https://example.org/b','Undated first')}${item('https://example.org/c','Undated second')}${item('https://example.org/d','Undated third')}</channel></rss>`;
  const stories=parseFeed(xml);assert.deepEqual(stories.map(s=>s.title),['Newest','Query one','Query two','Undated first','Undated second','Undated third']);
  assert.equal(stories[3].publishedAt,null);assert.equal(stories[0].summary,'Summary');
});
test('RSS rejects malformed XML, HTML error pages and incomplete items; accepts valid empty feeds',()=>{
  for(const xml of ['<rss>','<html><body>Error</body></html>',`<rss><channel>${item('javascript:alert(1)','Unsafe')}</channel></rss>`]) assert.throws(()=>parseFeed(xml));
  assert.deepEqual(parseFeed('<rss><channel><title>Empty feed</title></channel></rss>'),[]);
});
test('world merge deduplicates deterministically across sources and preserves meaningful queries',()=>{
  const snap=structuredClone(baseline);for(const s of SOURCES.filter(s=>s.id!=='stringer'))snap.sources[s.id].stories=[];
  const story={title:'Shared',url:'https://example.org/a',summary:'',publishedAt:now};
  snap.sources.bbc.stories=[story];snap.sources.nyt.stories=[{...story,url:story.url+'#fragment'},{...story,url:story.url+'?different=1'}];
  const result=worldStories(snap);assert.equal(result.length,2);assert.equal(result[0].source,'BBC World');
});
test('first deployment succeeds only when all sources succeed',async()=>{
  assert.equal(validateSnapshot(baseline),baseline);await assert.rejects(makeSnapshot(null,['bbc']),/Publication blocked/);
});
test('individual failure retains stories and last success while advancing attempt metadata',async()=>{
  const next=await makeSnapshot(baseline,['bbc']);assert.deepEqual(next.sources.bbc.stories,baseline.sources.bbc.stories);
  assert.equal(next.sources.bbc.lastSuccessAt,now);assert.equal(next.sources.bbc.attemptedAt,later);assert.equal(next.sources.bbc.status,'failure');assert.equal(next.sources.nyt.lastSuccessAt,later);
});
test('total failure with recovery publishes retained content and failures',async()=>{
  const next=await makeSnapshot(baseline,SOURCES.map(s=>s.id));for(const s of SOURCES){assert.equal(next.sources[s.id].status,'failure');assert.deepEqual(next.sources[s.id].stories,baseline.sources[s.id].stories);}
});
test('invalid previous snapshots are treated as failed recovery',async()=>{
  for(const mutate of [s=>s.schemaVersion=99,s=>s.sources.bbc.stories[0].url='javascript:bad',s=>s.sources.stringer.stories=[],s=>s.sources.nyt.lastSuccessAt=null,s=>s.sources.bbc.attemptedAt='2030-01-01T00:00:00Z']) {
    const invalid=structuredClone(baseline);mutate(invalid);assert.throws(()=>validateSnapshot(invalid));
    await assert.rejects(makeSnapshot(invalid,['dw']),/Publication blocked/);assert.ok(await makeSnapshot(invalid));
  }
  await assert.rejects(makeSnapshot('{bad json',['dw']),/Publication blocked/);
});
test('Stringer count reductions over 25% require explicit reviewed reset',async()=>{
  const stories=baseline.sources.stringer.stories;
  assert.throws(()=>checkBaseline(stories.slice(0,17),stories),/baseline reset/);assert.equal(checkBaseline(stories.slice(0,18),stories).length,18);
  assert.equal(checkBaseline(stories.slice(0,17),stories,true).length,17);
  const $=load(fixtures.stringer);$('.text-box').slice(18).remove();
  const request=async url=>url===snapshotUrl(pagesUrl)?JSON.stringify(baseline):url===SOURCES.at(-1).url?$.html():fixtures[SOURCES.find(s=>s.url===url).id];
  const retained=await makeSnapshot(baseline,[],{request});assert.equal(retained.sources.stringer.status,'failure');assert.equal(retained.sources.stringer.stories.length,24);
  const reset=await makeSnapshot(baseline,[],{request,resetStringerBaseline:true});assert.equal(reset.sources.stringer.status,'success');assert.equal(reset.sources.stringer.stories.length,17);
});
test('recovery paths follow project paths, domain roots, and missing trailing slashes',()=>{
  assert.equal(snapshotUrl('https://example.org/stringer-news'),'https://example.org/stringer-news/data/news.json');
  assert.equal(snapshotUrl('https://news.stringerjournalism.org'),'https://news.stringerjournalism.org/data/news.json');
  assert.throws(()=>snapshotUrl('file:///tmp/site'));
});
test('bounded requests retry failures and stop after the configured attempts',async()=>{
  let calls=0;const options={fetchImpl:async()=>{calls++;throw new Error('Timeout')},sleep:async()=>{}};
  await assert.rejects(fetchText('https://example.org',options),/Timeout/);assert.equal(calls,3);
  calls=0;assert.equal(await fetchText('https://example.org',{...options,fetchImpl:async()=>{calls++;return new Response('ok')}}),'ok');assert.equal(calls,1);
});
test('staleness follows last successful collection even if snapshots stop updating',()=>{
  assert.match(sourceMessage(SOURCES[0],baseline.sources.bbc,Date.parse(now)+STALE_MS),/over two hours old/);
  assert.doesNotMatch(sourceMessage(SOURCES[0],baseline.sources.bbc,Date.parse(now)+1000),/over two hours old/);
});

test('RSS thumbnail and media-content metadata stay tied to their item, including credits', () => {
  const bbc = parseFeed(fixtures.bbc); const nyt = parseFeed(fixtures.nyt);
  assert.ok(bbc.every(story => story.image === null || safeImageUrl(story.image.url)));
  assert.match(bbc.find(story=>story.image).image.url, /ichef\.bbci\.co\.uk/);
  const photo = nyt.find(story => story.image?.credit);
  assert.ok(photo.image.alt); assert.ok(photo.image.credit);
  assert.equal(parseFeed(fixtures.dw)[0].image, null);
});
test('Stringer images match destinations, not their position; missing images remain absent', () => {
  const stories = parseStringer(fixtures.stringer);
  assert.equal(stories.filter(story => story.image).length, 23);
  assert.match(stories[0].image.url, /readinglist1-/);
  assert.match(stories[1].image.url, /readinglist2-/);
  assert.equal(stories[14].image, null);
  const $ = load(fixtures.stringer);
  const pictures = $('section > a').remove().get().reverse();
  $('section').prepend(pictures);
  assert.deepEqual(parseStringer($.html()).map(s=>s.image), stories.map(s=>s.image));
});
test('image matching preserves meaningful query parameters and ignores unsafe image URLs', () => {
  const html = '<section><div class="text-box"><h1>COURAGEOUS STORIES</h1></div><div class="text-box"><p>Reporter</p><p><a href="https://example.org/watch?v=one">Headline</a> Description</p></div><a href="https://example.org/watch?v=two"><img src="https://images.example.org/wrong.jpg"></a><a href="https://example.org/watch?v=one"><img src="javascript:bad"></a></section>';
  assert.equal(parseStringer(html)[0].image, null);
  const safe = html.replace('javascript:bad', 'https://images.example.org/correct.jpg');
  assert.equal(parseStringer(safe)[0].image.url, 'https://images.example.org/correct.jpg');
  for (const url of ['javascript:bad', 'data:image/png;base64,a', 'http://example.org/photo.jpg', 'https://user:password@example.org/photo.jpg']) assert.equal(safeImageUrl(url), null);
});
test('expanded RSS limit applies after deduplication', () => {
  const repeated = Array.from({length:50},()=>item('https://example.org/repeated','Repeated')).join('');
  const unique = Array.from({length:40},(_,i)=>item(`https://example.org/${i}`,`Item ${i}`)).join('');
  const stories = parseFeed(`<rss><channel>${repeated}${unique}</channel></rss>`);
  assert.equal(stories.length, NEWSWIRE_LIMIT); assert.equal(new Set(stories.map(s=>s.url)).size, NEWSWIRE_LIMIT);
});
test('version 2 validates images and recovers version 1 snapshots without images', async () => {
  assert.equal(baseline.schemaVersion, 2);
  const legacy = structuredClone(baseline); legacy.schemaVersion = 1;
  for (const [id, source] of Object.entries(legacy.sources)) {
    if (id !== 'stringer') source.stories = source.stories.slice(0, 5);
    for (const story of source.stories) delete story.image;
  }
  validateSnapshot(legacy);
  const recovered = await makeSnapshot(legacy, ['bbc']);
  assert.equal(recovered.schemaVersion, 2); assert.equal(recovered.sources.bbc.stories.length, 5);
  const bad = structuredClone(baseline); bad.sources.stringer.stories[0].image.url = 'javascript:alert(1)';
  assert.throws(()=>validateSnapshot(bad), /Invalid story image/);
});

 test('default permissions skip unapproved feeds and preserve owner-approved Stringer photos during recovery', async () => {
  const requested = [];
  const current = await collect({ pagesUrl, log:()=>{}, now:()=>later, request:async url=> {
    requested.push(url);
    if (url === snapshotUrl(pagesUrl)) return JSON.stringify(baseline);
    assert.equal(url, SOURCES.at(-1).url);
    return fixtures.stringer;
  }});
  assert.equal(requested.length, 2);
  for (const source of SOURCES.slice(0,-1)) {
    assert.equal(current.sources[source.id].status, 'paused');
    assert.deepEqual(current.sources[source.id].stories, []);
    assert.equal(current.sources[source.id].lastSuccessAt, null);
  }
  assert.equal(current.sources.stringer.stories.length, 24);
  assert.equal(current.sources.stringer.stories.filter(story=>story.image).length, 23);
  const retained = await makeSnapshot(baseline, ['stringer'], {permissions: CONTENT_PERMISSIONS});
  assert.equal(retained.sources.stringer.status, 'failure');
  assert.deepEqual(retained.sources.stringer.stories, baseline.sources.stringer.stories);
  const textOnly = applyContentPermissions(baseline, {stringer:{text:true,images:false}});
  assert.ok(textOnly.sources.stringer.stories.every(story=>story.image === null));
  assert.deepEqual(applyContentPermissions(baseline).sources.bbc.stories, []);
  assert.ok(baseline.sources.bbc.stories.length, 'Policy does not mutate the recovery input');
  const closed = applyContentPermissions(baseline, {});
  assert.ok(Object.values(closed.sources).every(source=>source.status === 'paused' && !source.stories.length));
 });
