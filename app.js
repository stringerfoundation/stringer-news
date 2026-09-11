import { SOURCES, applyContentPermissions, STALE_MS, safeUrl, safeImageUrl, validateSnapshot, worldStories, sourceMessage } from './news-model.js';
const feedback = document.querySelector('#refresh-status');
const interval = 5 * 60 * 1000;
let snapshot = null;
let loading = false;
let lastAttempt = 0;
function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  if (className) node.className = className;
  return node;
}
function renderStories(target, stories, emptyMessage) {
  target.replaceChildren();
  for (const [index, story] of stories.entries()) {
    const url = safeUrl(story.url); if (!url) continue;
    const article = element('article', '', 'story');
    const body = element('div', '', 'story-body');
    const imageUrl = safeImageUrl(story.image?.url);
    if (imageUrl) {
      const figure = element('figure', '', 'story-media');
      const image = element('img');
      image.alt = story.image.alt;
      image.width = 240; image.height = 240;
      image.loading = index === 0 ? 'eager' : 'lazy';
      image.decoding = 'async'; image.referrerPolicy = 'no-referrer';
      image.addEventListener('error', () => {
        figure.remove(); article.classList.remove('with-image'); balanceNewswire();
      }, { once: true });
      image.src = imageUrl;
      figure.append(image);
      if (story.image.credit) figure.append(element('figcaption', story.image.credit));
      article.classList.add('with-image'); article.append(figure);
    }
    const link = element('a'); link.href = url; link.target = '_blank'; link.rel = 'noopener noreferrer';
    link.append(element('h3', story.title)); body.append(link);
    if (story.credits) body.append(element('p', story.credits, 'credits'));
    if (story.summary) body.append(element('p', story.summary, 'summary'));
    const meta = element('div', '', 'meta');
    meta.append(element('span', story.source || new URL(url).hostname.replace(/^www\./, ''), 'source'));
    if (story.publishedAt) {
      const time = element('time', new Date(story.publishedAt).toLocaleString(undefined, {year:'numeric', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit', timeZoneName:'short'}));
      time.title = `Local time (${Intl.DateTimeFormat().resolvedOptions().timeZone})`;
      time.dateTime = story.publishedAt; meta.append(time);
    } else if (story.publicationDate) {
      const time = element('time', new Date(story.publicationDate + 'T12:00:00Z').toLocaleDateString(undefined, {year:'numeric',month:'short',day:'numeric',timeZone:'UTC'}));
      time.dateTime = story.publicationDate; time.title = 'Publication date; source does not provide a confirmed time zone and time'; meta.append(time);
    } else if (story.credits) {
      meta.append(element('span', 'Publication date unavailable'));
    }
    body.append(meta); article.append(body); target.append(article);
  }
  if (!target.children.length) target.append(element('p', emptyMessage, 'empty'));
}
let balancing = false;
function balanceNewswire() {
  if (balancing || !snapshot) return;
  balancing = true;
  try {
    const world = document.querySelector('#world-news');
    const stringer = document.querySelector('#stringer-news');
    const cards = [...world.querySelectorAll('article')];
    // Show real headlines until their content reaches the end of the Stringer collection.
    // Images reserve their space, so loading them does not keep shifting the balance.
    cards.forEach(card => { card.hidden = false; });
    if (matchMedia('(min-width: 768px)').matches && stringer.querySelector('article')) {
      const bottom = stringer.getBoundingClientRect().bottom;
      const last = cards.findIndex(card => card.getBoundingClientRect().bottom >= bottom);
      if (last !== -1) cards.slice(last + 1).forEach(card => { card.hidden = true; });
    } else {
      cards.slice(Math.max(24, snapshot.sources.stringer.stories.length)).forEach(card => { card.hidden = true; });
    }
  } finally { balancing = false; }
}
function renderStatuses() {
  if (!snapshot) return;
  for (const group of ['world', 'stringer']) {
    const target = document.querySelector(`#${group}-status`); target.replaceChildren();
    const sources = SOURCES.filter(s => group === 'stringer' ? s.id === 'stringer' : s.id !== 'stringer');
    for (const source of sources) {
      const entry = snapshot.sources[source.id];
      if (entry.status === 'paused') continue;
      const warning = entry.status === 'failure' || Date.now() - Date.parse(entry.lastSuccessAt) >= STALE_MS;
      if (warning) target.append(element('p', sourceMessage(source, entry), 'warning'));
      else if (!entry.stories.length) target.append(element('p', `${source.name}: No stories returned.`));
    }
  }
}
function render() {
  const worldPaused = SOURCES.filter(source => source.id !== 'stringer').every(source => snapshot.sources[source.id].status === 'paused');
  renderStories(document.querySelector('#world-news'), worldStories(snapshot), worldPaused ? 'Global headlines are paused while reuse permissions are confirmed.' : 'No headlines available in this collection.');
  renderStories(document.querySelector('#stringer-news'), snapshot.sources.stringer.stories, 'Courageous stories are currently unavailable. Visit the Stringer collection below.');
  if (worldPaused) {
    const links = element('p', '', 'publisher-links');
    for (const [name, url] of [['BBC News', 'https://www.bbc.com/news'], ['The New York Times', 'https://www.nytimes.com/section/world'], ['Al Jazeera', 'https://www.aljazeera.com/'], ['DW', 'https://www.dw.com/']]) {
      const link = element('a', name); link.href = url; link.target = '_blank'; link.rel = 'noopener noreferrer';
      if (links.childNodes.length) links.append(document.createTextNode(' · '));
      links.append(link);
    }
    document.querySelector('#world-news').append(links);
  }
  renderStatuses();
  balanceNewswire();
}
async function load() {
  if (loading) return;
  loading = true; lastAttempt = Date.now();
  document.querySelectorAll('.story-list').forEach(list => list.setAttribute('aria-busy', 'true'));
  if (!snapshot) feedback.textContent = 'Loading news…';
  try {
    const response = await fetch('./data/news.json', { cache: 'no-cache', credentials: 'omit', signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const next = applyContentPermissions(validateSnapshot(await response.json()));
    if (snapshot && Date.parse(next.generatedAt) < Date.parse(snapshot.generatedAt)) throw new Error('Older snapshot returned');
    snapshot = next; render();
    feedback.textContent = '';
  } catch {
    feedback.textContent = snapshot ? 'Could not check for updates. Keeping the previously loaded collection.' : 'The news collection is unavailable. We’ll retry automatically.';
    if (!snapshot) {
      document.querySelector('#world-status').textContent = 'Headlines unavailable.';
      document.querySelector('#stringer-status').textContent = 'Courageous stories unavailable. You can still visit the Stringer collection below.';
    }
  } finally {
    loading = false;
    document.querySelectorAll('.story-list').forEach(list => list.setAttribute('aria-busy', 'false'));
    renderStatuses();
  }
}
const layoutObserver = new ResizeObserver(balanceNewswire);
layoutObserver.observe(document.querySelector('#stringer-news'));
window.addEventListener('resize', balanceNewswire);
document.fonts?.ready.then(balanceNewswire);
setInterval(() => { renderStatuses(); balanceNewswire(); if (!document.hidden && Date.now() - lastAttempt >= interval) load(); }, 30_000);
document.addEventListener('visibilitychange', () => { if (!document.hidden && Date.now() - lastAttempt >= interval) load(); });
load();
