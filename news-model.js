export const SOURCES = Object.freeze([
  { id: 'bbc', name: 'BBC World', url: 'https://feeds.bbci.co.uk/news/world/rss.xml' },
  { id: 'nyt', name: 'NYT World', url: 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml' },
  { id: 'aljazeera', name: 'Al Jazeera', url: 'https://www.aljazeera.com/xml/rss/all.xml' },
  { id: 'dw', name: 'DW', url: 'https://rss.dw.com/rdf/rss-en-all' },
  { id: 'stringer', name: 'Stringer', url: 'https://stringerjournalism.org/courageous-stories' },
]);
// Permission records are maintained by the foundation; see LEGAL.md.
// Stringer text and photos follow the owner's explicit confirmation; see LEGAL.md.
export const CONTENT_PERMISSIONS = Object.freeze(Object.fromEntries(SOURCES.map(source => [source.id,
  Object.freeze({ text: true, summaries: source.id === 'stringer', images: source.id === 'stringer' })
])));
export function permittedStories(sourceId, stories, permissions = CONTENT_PERMISSIONS) {
  const permission = permissions[sourceId];
  if (permission?.text !== true) return [];
  return stories.map(story => ({
    title: story.title, url: story.url, publishedAt: story.publishedAt,
    summary: permission.summaries === true ? story.summary : '',
    ...(sourceId === 'stringer' ? { credits: story.credits } : {}),
    headlineOnly: sourceId !== 'stringer' && permission.summaries !== true,
    image: permission.images === true ? story.image ?? null : null,
  }));
}
export function applyContentPermissions(snapshot, permissions = CONTENT_PERMISSIONS) {
  return { ...snapshot, sources: Object.fromEntries(SOURCES.map(source => {
    const entry = snapshot.sources[source.id];
    return [source.id, permissions[source.id]?.text === true
      ? { ...entry, stories: permittedStories(source.id, entry.stories, permissions) }
      : { ...entry, stories: [], status: 'paused', lastSuccessAt: null, error: null }];
  })) };
}
export const NEWSWIRE_LIMIT = 30;
export const STALE_MS = 2 * 60 * 60 * 1000;
export function safeUrl(value) {
  if (typeof value !== 'string') return null;
  try { const url = new URL(value); return /^https?:$/.test(url.protocol) && !url.username && !url.password ? url.href : null; } catch { return null; }
}
export function safeImageUrl(value) {
  const url = safeUrl(value);
  return url && new URL(url).protocol === 'https:' ? url : null;
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
  if (!value || ![1, 2].includes(value.schemaVersion) || !timestamp(value.generatedAt) || !value.sources || Object.keys(value.sources).length !== SOURCES.length) throw new Error('Invalid news snapshot');
  for (const source of SOURCES) {
    const entry = value.sources[source.id];
    if (!entry || !Array.isArray(entry.stories) || !timestamp(entry.attemptedAt) || !['success', 'failure', 'paused'].includes(entry.status) || !(entry.lastSuccessAt === null || timestamp(entry.lastSuccessAt))) throw new Error(`Invalid ${source.id} metadata`);
    if (Date.parse(entry.attemptedAt) > Date.parse(value.generatedAt) || (entry.lastSuccessAt && Date.parse(entry.lastSuccessAt) > Date.parse(entry.attemptedAt))) throw new Error('Invalid collection chronology');
    if (entry.status === 'paused' && (entry.stories.length || entry.lastSuccessAt !== null || entry.error !== null)) throw new Error('Invalid paused source');
    if (entry.status === 'success' && (entry.lastSuccessAt !== entry.attemptedAt || entry.error !== null)) throw new Error('Invalid successful collection');
    if (entry.status === 'failure' && !nonempty(entry.error)) throw new Error('Missing failure details');
    if (entry.stories.length && !entry.lastSuccessAt) throw new Error('Missing collection time');
    if (source.id === 'stringer' && entry.lastSuccessAt && !entry.stories.length) throw new Error('Empty Stringer baseline');
    if (source.id !== 'stringer' && entry.stories.length > (value.schemaVersion === 1 ? 5 : NEWSWIRE_LIMIT)) throw new Error('Too many publisher stories');
    for (const story of entry.stories) {
      if (!story || !nonempty(story.title) || !safeUrl(story.url) || typeof story.summary !== 'string' || !(story.publishedAt === null || timestamp(story.publishedAt))) throw new Error('Invalid story');
      if (story.image != null && (!safeImageUrl(story.image.url) || typeof story.image.alt !== 'string' || typeof story.image.credit !== 'string')) throw new Error('Invalid story image');
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
