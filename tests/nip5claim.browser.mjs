import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import { finalizeEvent, generateSecretKey, getPublicKey, verifyEvent } from 'nostr-tools';

const secret = generateSecretKey();
const pubkey = getPublicKey(secret);
const original = { name: 'stringernews', display_name: 'Stringer News', about: 'Existing reporting profile', picture: 'https://example.org/logo.png' };
const profile = finalizeEvent({ kind: 0, created_at: Math.floor(Date.now() / 1000) - 100, tags: [], content: JSON.stringify(original) }, secret);
const expectedPubkey = 'b8225dbedf6ae7949e880e7979e975d8e6f238f32d318bc4a562ecb198fcd707';

test('NIP-07 claim requires the mapped account, preserves its profile, and reports relay acceptance', async () => {
  const server = createServer(async (request, response) => {
    const path = new URL(request.url, 'http://localhost').pathname;
    if (path === '/.well-known/nostr.json') {
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify({ names: { _: pubkey } }));
      return;
    }
    const file = path === '/' ? 'nip5claim.html' : path.slice(1);
    if (!['nip5claim.html', 'nip5claim.css', 'nip5claim.js', 'assets/nostr-tools-2.25.2.js', 'assets/stringer-logo.png', 'assets/favicon-32.png'].includes(file)) {
      response.writeHead(404).end();
      return;
    }
    response.setHeader('content-type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.png') ? 'image/png' : 'text/html');
    const body = await readFile(new URL(`../${file}`, import.meta.url));
    response.end(file === 'nip5claim.js' ? body.toString().replace(expectedPubkey, pubkey) : body);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 375, height: 800 } });
    const errors = [];
    const published = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.exposeFunction('signTestProfile', template => finalizeEvent(template, secret));
    await page.addInitScript(key => {
      window.testKey = key;
      window.nostr = { getPublicKey: async () => window.testKey, signEvent: template => window.signTestProfile(template) };
    }, '0'.repeat(64));
    await page.routeWebSocket(/^wss:\/\/(relay\.nos\.social|nos\.lol|relay\.damus\.io)\/?$/, socket => {
      socket.onMessage(raw => {
        const message = JSON.parse(String(raw));
        if (message[0] === 'REQ') {
          socket.send(JSON.stringify(['EVENT', message[1], profile]));
          socket.send(JSON.stringify(['EOSE', message[1]]));
        } else if (message[0] === 'EVENT') {
          published.push(message[1]);
          socket.send(JSON.stringify(['OK', message[1].id, true, '']));
        }
      });
    });
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    await page.locator('#connect').click();
    await page.getByText('This signer does not control the Stringer News account.').waitFor();
    assert.equal(await page.locator('#claim').isDisabled(), true);
    assert.equal(published.length, 0);
    await page.evaluate(key => { window.testKey = key; }, pubkey);
    await page.locator('#connect').click();
    await page.getByText(/Ready. Review the change/).waitFor();
    assert.equal(await page.locator('#preview').isVisible(), true);
    assert.equal(await page.locator('#current-identifier').textContent(), 'None');
    assert.equal(await page.locator('#claim').isEnabled(), true);
    await page.locator('#claim').click();
    await page.getByText(/Claim published to 3 of 3 relays/).waitFor();
    assert.ok(published.length >= 1);
    assert.ok(published.every(event => verifyEvent(event) && event.pubkey === pubkey && event.kind === 0));
    assert.deepEqual(JSON.parse(published[0].content), { ...original, nip05: '_@news.stringerjournalism.org' });
    assert.equal(await page.locator('#claim').isDisabled(), true);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    assert.deepEqual(errors, []);
    await page.close();
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
});
