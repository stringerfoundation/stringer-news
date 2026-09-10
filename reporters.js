const reporters = [
  { name: 'Nithin Coca', handle: 'ncoca', server: 'https://social.coop', profile: 'https://social.coop/@ncoca', beat: 'Asia · Environment, labour and human rights', network: 'Mastodon' },
  { name: 'Joe Nakamoto', key: 'npub1lr2zzf989mvf393y0tv39ara6a4vddkd6y87z784up9vl6ks6j3qtudl6a', profile: 'https://primal.net/p/npub1lr2zzf989mvf393y0tv39ara6a4vddkd6y87z784up9vl6ks6j3qtudl6a', beat: 'Community reporting · Bitcoin-focused', network: 'Nostr' },
  { name: 'Timothy Allen', key: 'nprofile1qqsyvyjl47u724y643483g7ktwc86ku30ngew7xsgwwrlyxdmararwc3fyehr', profile: 'https://primal.net/p/nprofile1qqsyvyjl47u724y643483g7ktwc86ku30ngew7xsgwwrlyxdmararwc3fyehr', beat: 'Documentary photography · Communities and governance', network: 'Nostr' },
  { name: 'Asteris Masouras', handle: 'asteris', server: 'https://mastodon.social', profile: 'https://mastodon.social/@asteris', beat: 'Human rights · Global Voices editor and curator', network: 'Mastodon' },
  { name: 'Anjan Sundaram', key: 'c226c35c4e8cb8567c20f4233a31396b7d4fda8086626f1a45a6e24b5943950f', profile: 'https://primal.net/anjansun', beat: 'Stringer founder · Independent war reporting', network: 'Nostr' },
];
const reporterPosts = new Map();
const reporterStates = new Map();
const reporterFilter = document.querySelector('#reporter-filter');
for (const reporter of reporters) {
  const entry = element('div');
  const link = element('a', reporter.name);
  link.href = reporter.profile; link.target = '_blank'; link.rel = 'noopener noreferrer';
  const state = element('small', 'Waiting…');
  entry.append(link, element('small', `${reporter.network} · ${reporter.beat}`), state);
  reporterStates.set(reporter.name, state);
  document.querySelector('#reporter-directory').append(entry);
  const option = element('option', reporter.name); option.value = reporter.name;
  reporterFilter.append(option);
}
let nostrLibrary;
function getNostr() {
  if (!nostrLibrary) nostrLibrary = Promise.race([
    import('https://esm.sh/nostr-tools@2.25.2'),
    new Promise((_, reject) => setTimeout(() => reject(new Error('Nostr library timed out')), 15000)),
  ]).catch(error => { nostrLibrary = null; throw error; });
  return nostrLibrary;
}
function readRelay(url, pubkey, verifyEvent) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    const events = new Map();
    let done = false;
    const finish = (ok) => {
      if (done) return;
      done = true; clearTimeout(timer);
      socket.close();
      if (ok || events.size) resolve([...events.values()]);
      else reject(new Error('Relay unavailable'));
    };
    const timer = setTimeout(() => finish(false), 12000);
    socket.onopen = () => socket.send(JSON.stringify(['REQ', 'reporter', { authors: [pubkey], kinds: [1, 30023], limit: 30 }]));
    socket.onerror = () => finish(false);
    socket.onclose = () => finish(false);
    socket.onmessage = message => {
      try {
        const [type, subscription, event] = JSON.parse(message.data);
        if (subscription !== 'reporter') return;
        if (type === 'EOSE') return finish(true);
        if (type === 'CLOSED') return finish(false);
        if (type === 'EVENT' && event.pubkey === pubkey && [1, 30023].includes(event.kind) && event.created_at <= Date.now() / 1000 + 60 && verifyEvent(event)) events.set(event.id, event);
      } catch { /* Ignore malformed or invalid events. */ }
    };
  });
}
async function fetchNostr(reporter) {
  const { nip19, verifyEvent } = await getNostr();
  const decoded = /^[a-f0-9]{64}$/.test(reporter.key) ? null : nip19.decode(reporter.key);
  const pubkey = decoded ? (decoded.type === 'npub' ? decoded.data : decoded.data.pubkey) : reporter.key;
  const results = await Promise.allSettled(['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.primal.net'].map(url => readRelay(url, pubkey, verifyEvent)));
  if (results.every(result => result.status === 'rejected')) throw new Error('All relays unavailable');
  const unique = new Map();
  for (const result of results) if (result.status === 'fulfilled') for (const event of result.value) unique.set(event.id, event);
  return [...unique.values()].filter(event => event.content.trim() && !event.tags.some(tag => tag[0] === 'e' && event.kind === 1)).map(event => {
    const text = event.content.trim();
    const title = event.tags.find(tag => tag[0] === 'title')?.[1] || text.split('\n').find(line => line.trim()) || 'Public post';
    return { source: reporter.name, title: title.slice(0, 180) + (title.length > 180 ? '…' : ''), summary: (text === title ? '' : text).slice(0, 450), date: new Date(event.created_at * 1000).toISOString(), url: `https://njump.me/${nip19.neventEncode({ id: event.id, author: pubkey })}` };
  });
}
function renderReporters() {
  // Take a few posts per person so quieter voices remain visible.
  const posts = reporters.filter(person => !reporterFilter.value || person.name === reporterFilter.value).flatMap(person => (reporterPosts.get(person.name) || []).slice(0, reporterFilter.value ? 12 : 3));
  posts.sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
  renderStories(document.querySelector('#stringer-news'), posts);
}
let loadingReporters = false;
async function loadReporters() {
  if (loadingReporters) return;
  loadingReporters = true;
  const target = document.querySelector('#reporter-status');
  target.textContent = 'Reading five public feeds…';
  let failed = 0;
  await Promise.allSettled(reporters.map(async reporter => {
    const state = reporterStates.get(reporter.name);
    state.textContent = 'Loading…';
    try {
      const posts = await (reporter.network === 'Nostr' ? fetchNostr(reporter) : fetchPublisher(reporter));
      posts.sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
      reporterPosts.set(reporter.name, posts);
      state.textContent = posts.length ? `${posts.length} posts · Latest ${new Date(posts[0].date).toLocaleDateString()}` : 'No original posts returned · Open profile above';
    } catch {
      failed++;
      state.textContent = reporterPosts.has(reporter.name) ? 'Refresh unavailable · Showing earlier results' : 'Feed unavailable · Open profile above';
    }
    renderReporters();
  }));
  target.textContent = failed ? `${5 - failed}/5 feeds responded. Unavailable feeds are marked above.` : 'All five feeds responded · Latest public posts, not an editorial selection';
  loadingReporters = false;
}
reporterFilter.addEventListener('change', renderReporters);
loadReporters();
