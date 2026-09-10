const server = 'https://mastodon.social';
const publishers = [{ name: 'BBC News', handle: 'BBCNews@flipboard.com' }, { name: 'CNN', handle: 'CNN@flipboard.com' }];
let stories = [];
let selected = 'All sources';
const list = document.querySelector('#world-news');
const status = document.querySelector('#feed-status');
const refresh = document.querySelector('#refresh');
function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  if (className) node.className = className;
  return node;
}
function safeUrl(value) {
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) ? url.href : null; } catch { return null; }
}
function normalize(post, publisher) {
  // Remote HTML stays in an inert document; only text is rendered.
  const doc = new DOMParser().parseFromString(post.content || '', 'text/html');
  const text = (doc.querySelector('p')?.textContent || doc.body.textContent || '').trim();
  const url = safeUrl(post.card?.url) || safeUrl(doc.querySelector('a')?.href) || safeUrl(post.url);
  const title = post.card?.title?.trim() || text.replace(/https?:\/\/\S+/g, '').trim();
  if (!url || !title || !Number.isFinite(Date.parse(post.created_at))) return null;
  return { source: publisher.name, title, url, summary: post.card?.description || '', date: post.created_at };
}
async function json(path, host = server) {
  const response = await fetch(host + path, { credentials: 'omit', signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`Server returned ${response.status}`);
  return response.json();
}
async function fetchPublisher(publisher) {
  const account = await json(`/api/v1/accounts/lookup?acct=${encodeURIComponent(publisher.handle)}`, publisher.server);
  const posts = await json(`/api/v1/accounts/${encodeURIComponent(account.id)}/statuses?limit=20&exclude_replies=true&exclude_reblogs=true`, publisher.server);
  return posts.filter(post => post.visibility === 'public').map(post => normalize(post, publisher)).filter(Boolean);
}
function renderStories(target, visible) {
  target.replaceChildren();
  for (const story of visible) {
    const article = element('article', '', 'story');
    const meta = element('div');
    const time = element('time', new Date(story.date).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }));
    time.dateTime = story.date;
    meta.append(time, element('span', story.source, 'source'));
    const body = element('div');
    const link = element('a');
    link.href = story.url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.append(element('h3', story.title));
    body.append(link);
    if (story.summary) body.append(element('p', story.summary));
    article.append(meta, body);
    target.append(article);
  }
  if (!visible.length) target.append(element('p', 'No posts available for this source. Try refreshing.', 'feed-message'));
}
function render() {
  renderStories(list, stories.filter(story => selected === 'All sources' || story.source === selected).slice(0, 16));
}
async function load() {
  refresh.disabled = true;
  refresh.textContent = 'Loading…';
  status.textContent = 'Fetching publisher headlines…';
  list.setAttribute('aria-busy', 'true');
  const results = await Promise.allSettled(publishers.map(fetchPublisher));
  const failures = [];
  results.forEach((result, index) => {
    const publisher = publishers[index];
    if (result.status === 'fulfilled') stories = stories.filter(story => story.source !== publisher.name).concat(result.value);
    else failures.push(publisher.name);
  });
  const seen = new Set();
  stories = stories.sort((a, b) => Date.parse(b.date) - Date.parse(a.date)).filter(story => {
    const key = new URL(story.url);
    key.search = ''; key.hash = '';
    const identity = story.source + key.href;
    if (seen.has(identity)) return false;
    seen.add(identity); return true;
  });
  render();
  status.textContent = failures.length
    ? `Could not refresh ${failures.join(' and ')}.${stories.length ? ' Showing available headlines; some may be from the previous refresh.' : ' Please try again.'}`
    : `${stories.length} headlines · Updated ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · via mastodon.social`;
  list.setAttribute('aria-busy', 'false');
  refresh.disabled = false;
  refresh.textContent = '↻ Refresh';
}
document.querySelectorAll('.topics button').forEach(button => button.addEventListener('click', () => {
  selected = button.textContent;
  document.querySelectorAll('.topics button').forEach(item => {
    item.classList.toggle('active', item === button);
    item.setAttribute('aria-pressed', String(item === button));
  });
  render();
}));
refresh.addEventListener('click', () => { load(); loadReporters(); });
load();
