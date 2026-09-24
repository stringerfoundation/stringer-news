const IDENTIFIER = '_@news.stringerjournalism.org';
const BANNER = 'https://news.stringerjournalism.org/assets/nostr-banner.png';
const PUBKEY = 'b8225dbedf6ae7949e880e7979e975d8e6f238f32d318bc4a562ecb198fcd707';
const RELAYS = ['wss://relay.nos.social', 'wss://nos.lol', 'wss://relay.damus.io'];
const { SimplePool, verifyEvent } = window.NostrTools;
const connectButton = document.querySelector('#connect');
const claimButton = document.querySelector('#claim');
const status = document.querySelector('#status');
const preview = document.querySelector('#preview');
let currentProfile = null;
let currentMetadata = null;
let signedClaim = null;

function report(message, tone = '') {
  status.textContent = message;
  status.dataset.tone = tone;
}

function busy(value) {
  connectButton.disabled = value;
  claimButton.disabled = value || !currentProfile || (currentMetadata?.nip05 === IDENTIFIER && currentMetadata?.banner === BANNER);
}

async function checkMapping() {
  const response = await fetch('./.well-known/nostr.json?name=_', { cache: 'no-store', redirect: 'error' });
  if (!response.ok) throw new Error('The NIP-05 record is not available on this site yet.');
  const record = await response.json();
  if (record?.names?._ !== PUBKEY) throw new Error('The NIP-05 record does not match the Stringer News account.');
}

function latestProfile(events) {
  const valid = events.filter(event => event.kind === 0 && event.pubkey === PUBKEY && verifyEvent(event))
    .sort((a, b) => b.created_at - a.created_at || a.id.localeCompare(b.id));
  if (!valid.length) throw new Error('No signed Stringer News profile was found on the configured relays.');
  const event = valid[0];
  let metadata;
  try { metadata = JSON.parse(event.content); } catch { throw new Error('The current profile has invalid metadata.'); }
  if (!metadata || Array.isArray(metadata) || typeof metadata !== 'object') throw new Error('The current profile has invalid metadata.');
  return { event, metadata };
}

connectButton.addEventListener('click', async () => {
  busy(true);
  preview.hidden = true;
  currentProfile = null;
  currentMetadata = null;
  signedClaim = null;
  try {
    if (!window.nostr?.getPublicKey || !window.nostr?.signEvent) throw new Error('Install or enable a NIP-07 browser signer, then try again.');
    report('Checking your signer and the current profile…');
    await checkMapping();
    const pubkey = await window.nostr.getPublicKey();
    if (pubkey !== PUBKEY) throw new Error('This signer does not control the Stringer News account. Switch accounts in your extension.');
    const pool = new SimplePool();
    let events;
    try { events = await pool.querySync(RELAYS, { kinds: [0], authors: [PUBKEY], limit: 3 }, { maxWait: 8000 }); }
    finally { pool.destroy(); }
    const { event, metadata } = latestProfile(events);
    currentProfile = event;
    currentMetadata = metadata;
    document.querySelector('#account').textContent = metadata.display_name || metadata.name || 'Stringer News';
    document.querySelector('#current-identifier').textContent = metadata.nip05 || 'None';
    document.querySelector('#current-banner').textContent = metadata.banner || 'None';
    preview.hidden = false;
    const complete = metadata.nip05 === IDENTIFIER && metadata.banner === BANNER;
    report(complete ? 'This profile already has the address and banner.' : 'Ready. Review the change, then approve it in your signer.', complete ? 'success' : '');
  } catch (error) { report(error.message || 'Could not check the Nostr account.', 'error'); }
  finally { busy(false); }
});

claimButton.addEventListener('click', async () => {
  if (!currentProfile || !currentMetadata || (currentMetadata.nip05 === IDENTIFIER && currentMetadata.banner === BANNER)) return;
  busy(true);
  try {
    await checkMapping();
    if (await window.nostr.getPublicKey() !== PUBKEY) throw new Error('The signer changed accounts. Connect again before claiming.');
    if (!signedClaim) {
      const createdAt = Math.max(Math.floor(Date.now() / 1000), currentProfile.created_at + 1);
      if (createdAt > Math.floor(Date.now() / 1000) + 60) throw new Error('The current profile date is ahead of this device. Check your clock.');
      const content = JSON.stringify({ ...currentMetadata, nip05: IDENTIFIER, banner: BANNER });
      const tags = currentProfile.tags;
      report('Approve the updated public profile in your signer…');
      const event = await window.nostr.signEvent({ kind: 0, created_at: createdAt, tags, content });
      if (event.pubkey !== PUBKEY || event.kind !== 0 || event.created_at !== createdAt ||
          event.content !== content || JSON.stringify(event.tags) !== JSON.stringify(tags) || !verifyEvent(event))
        throw new Error('The signer returned a profile that does not match the preview. Nothing was published.');
      signedClaim = event;
    }
    report('Publishing the signed profile to Nostr relays…');
    const pool = new SimplePool();
    let results;
    try { results = await Promise.allSettled(pool.publish(RELAYS, signedClaim, { maxWait: 10000, abort: AbortSignal.timeout(12000) })); }
    finally { pool.destroy(); }
    const accepted = results.filter(result => result.status === 'fulfilled').length;
    if (!accepted) {
      claimButton.textContent = 'Retry publication';
      throw new Error('No relay confirmed receipt. Retry will publish the same signed profile.');
    }
    currentMetadata.nip05 = IDENTIFIER;
    currentMetadata.banner = BANNER;
    document.querySelector('#current-identifier').textContent = IDENTIFIER;
    document.querySelector('#current-banner').textContent = BANNER;
    report(`Address and banner published to ${accepted} of ${RELAYS.length} relays. Nostr clients may take a little time to show them.`, 'success');
  } catch (error) { report(error.message || 'The claim was not published.', 'error'); }
  finally { busy(false); }
});
