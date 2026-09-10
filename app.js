import { SOURCES, STALE_MS, safeUrl, validateSnapshot, worldStories, sourceMessage } from './news-model.js';
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
  for (const story of stories) {
    const url = safeUrl(story.url); if (!url) continue;
    const article = element('article', '', 'story');
    const link = element('a'); link.href = url; link.target = '_blank'; link.rel = 'noopener noreferrer';
    link.append(element('h3', story.title)); article.append(link);
    if (story.credits) article.append(element('p', story.credits, 'credits'));
    if (story.summary) article.append(element('p', story.summary, 'summary'));
    const meta = element('div', '', 'meta');
    meta.append(element('span', story.source || new URL(url).hostname.replace(/^www\./, ''), 'source'));
    if (story.publishedAt) {
      const time = element('time', new Date(story.publishedAt).toLocaleString(undefined, {month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'}));
      time.dateTime = story.publishedAt; meta.append(time);
    }
    article.append(meta); target.append(article);
  }
  if (!target.children.length) target.append(element('p', emptyMessage, 'empty'));
}
function renderStatuses() {
  if (!snapshot) return;
  for (const group of ['world', 'stringer']) {
    const target = document.querySelector(`#${group}-status`); target.replaceChildren();
    const sources = SOURCES.filter(s => group === 'stringer' ? s.id === 'stringer' : s.id !== 'stringer');
    for (const source of sources) {
      const entry = snapshot.sources[source.id];
      const warning = entry.status === 'failure' || Date.now() - Date.parse(entry.lastSuccessAt) >= STALE_MS;
      if (warning) target.append(element('p', sourceMessage(source, entry), 'warning'));
      else if (!entry.stories.length) target.append(element('p', `${source.name}: No stories returned.`));
    }
  }
}
function render() {
  renderStories(document.querySelector('#world-news'), worldStories(snapshot), 'No headlines available in this collection.');
  renderStories(document.querySelector('#stringer-news'), snapshot.sources.stringer.stories, 'Courageous stories are currently unavailable. Visit the Stringer collection below.');
  renderStatuses();
}
async function load() {
  if (loading) return;
  loading = true; lastAttempt = Date.now();
  document.querySelectorAll('.story-list').forEach(list => list.setAttribute('aria-busy', 'true'));
  if (!snapshot) feedback.textContent = 'Loading news…';
  try {
    const response = await fetch('./data/news.json', { cache: 'no-cache', credentials: 'omit', signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const next = validateSnapshot(await response.json());
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
setInterval(() => { renderStatuses(); if (!document.hidden && Date.now() - lastAttempt >= interval) load(); }, 30_000);
document.addEventListener('visibilitychange', () => { if (!document.hidden && Date.now() - lastAttempt >= interval) load(); });
load();
