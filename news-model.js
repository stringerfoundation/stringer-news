export const SOURCES = Object.freeze([
  { id: 'bbc', name: 'BBC World', url: 'https://feeds.bbci.co.uk/news/world/rss.xml' },
  { id: 'nyt', name: 'NYT World', url: 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml' },
  { id: 'aljazeera', name: 'Al Jazeera', url: 'https://www.aljazeera.com/xml/rss/all.xml' },
  { id: 'dw', name: 'DW', url: 'https://rss.dw.com/rdf/rss-en-all' },
  { id: 'stringer', name: 'Stringer', url: 'https://stringerjournalism.org/courageous-stories' },
]);
export const STALE_MS = 2 * 60 * 60 * 1000;
export function safeUrl(value) {
  if (typeof value !== 'string') return null;
  try { const url = new URL(value); return /^https?:$/.test(url.protocol) && !url.username && !url.password ? url.href : null; } catch { return null; }
}
export function urlIdentity(value) {
  const url = new URL(value); url.hash = ''; return url.href;
}
export function newestFirst(a, b) {
  return (b.publishedAt ? Date.parse(b.publishedAt) : -Infinity) - (a.publishedAt ? Date.parse(a.publishedAt) : -Infinity) || 0;
}
export function uniqueStories(stories) {
  const seen = new Set();
  return stories.filter(story => { const key = urlIdentity(story.url); if (seen.has(key)) return false; seen.add(key); return true; });
}
export function worldStories(snapshot) {
  return uniqueStories(SOURCES.filter(s => s.id !== 'stringer').flatMap(source => snapshot.sources[source.id].stories.map(story => ({ ...story, source: source.name }))).sort(newestFirst));
}
const nonempty = value => typeof value === 'string' && !!value.trim();
const timestamp = value => typeof value === 'string' && /^\d{4}-\d\d-\d\dT/.test(value) && Number.isFinite(Date.parse(value));
export function validateSnapshot(value) {
  if (!value || value.schemaVersion !== 1 || !timestamp(value.generatedAt) || !value.sources || Object.keys(value.sources).length !== SOURCES.length) throw new Error('Invalid news snapshot');
  for (const source of SOURCES) {
    const entry = value.sources[source.id];
    if (!entry || !Array.isArray(entry.stories) || !timestamp(entry.attemptedAt) || !['success', 'failure'].includes(entry.status) || !(entry.lastSuccessAt === null || timestamp(entry.lastSuccessAt))) throw new Error(`Invalid ${source.id} metadata`);
    if (Date.parse(entry.attemptedAt) > Date.parse(value.generatedAt) || (entry.lastSuccessAt && Date.parse(entry.lastSuccessAt) > Date.parse(entry.attemptedAt))) throw new Error('Invalid collection chronology');
    if (entry.status === 'success' && (entry.lastSuccessAt !== entry.attemptedAt || entry.error !== null)) throw new Error('Invalid successful collection');
    if (entry.status === 'failure' && !nonempty(entry.error)) throw new Error('Missing failure details');
    if (entry.stories.length && !entry.lastSuccessAt) throw new Error('Missing collection time');
    if (source.id === 'stringer' && entry.lastSuccessAt && !entry.stories.length) throw new Error('Empty Stringer baseline');
    if (source.id !== 'stringer' && entry.stories.length > 5) throw new Error('Too many publisher stories');
    for (const story of entry.stories) {
      if (!story || !nonempty(story.title) || !safeUrl(story.url) || typeof story.summary !== 'string' || !(story.publishedAt === null || timestamp(story.publishedAt))) throw new Error('Invalid story');
      if (source.id === 'stringer' && (!nonempty(story.credits) || !nonempty(story.summary) || story.publishedAt !== null)) throw new Error('Invalid Stringer story');
    }
  }
  return value;
}
export function sourceMessage(source, entry, now = Date.now()) {
  const last = entry.lastSuccessAt ? new Date(entry.lastSuccessAt).toLocaleString(undefined, {month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'}) : null;
  const stale = entry.lastSuccessAt && now - Date.parse(entry.lastSuccessAt) >= STALE_MS;
  if (entry.status === 'failure') return `${source.name}: refresh unavailable. ${last ? `Showing retained collection from ${last}.` : 'No stories available.'}${stale ? ' Collection is over two hours old.' : ''}`;
  return `${source.name}: ${stale ? 'collection is over two hours old; last collected' : 'collected'} ${last}.${entry.stories.length ? '' : ' No stories returned.'}`;
}
