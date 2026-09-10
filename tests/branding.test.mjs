import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { load } from 'cheerio';
const root = new URL('../', import.meta.url);
const baseline = JSON.parse(readFileSync(new URL('./fixtures/branding.json', import.meta.url)));
const $ = load(readFileSync(new URL('index.html', root), 'utf8'));
const workflow = readFileSync(new URL('.github/workflows/pages.yml', root), 'utf8');

test('Stringer logo remains in the header, links home, and matches the approved asset', () => {
  const logo = $('header .brand img');
  assert.equal(logo.length, 1);
  assert.equal(logo.attr('alt'), 'The Stringer Foundation');
  assert.equal(logo.attr('src'), './assets/stringer-logo.png');
  assert.equal(logo.closest('a').attr('href'), baseline.source);
  assert.equal(logo.attr('width'), String(baseline.desktop.logoWidth));
  assert.equal(logo.attr('height'), String(baseline.desktop.logoHeight));
});

test('main-site favicon declarations include all sizes and Apple touch icon', () => {
  assert.equal($('link[rel="icon"]').length, 3);
  for (const size of [16, 32, 192]) {
    const icon = $(`link[rel="icon"][sizes="${size}x${size}"]`);
    assert.equal(icon.attr('href'), `./assets/favicon-${size}.png`);
    assert.equal(icon.attr('type'), 'image/png');
  }
  assert.equal($('link[rel="apple-touch-icon"]').attr('href'), './assets/favicon-180.png');
});

test('logo and favicons retain approved image bytes and remain in the deployment allowlist', () => {
  for (const [file, hash] of Object.entries(baseline.assets)) {
    const data = readFileSync(new URL(`assets/${file}`, root));
    assert.equal(createHash('sha256').update(data).digest('hex'), hash, file);
    assert.equal(data.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', file);
    if (file.startsWith('favicon-')) {
      const size = Number(file.match(/\d+/)[0]);
      assert.equal(data.readUInt32BE(16), size); assert.equal(data.readUInt32BE(20), size);
    }
    assert.ok(workflow.includes(`assets/${file}`), `${file} must be published`);
  }
});
