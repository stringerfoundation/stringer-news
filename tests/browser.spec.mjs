import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import { SOURCES, worldStories } from '../news-model.js';
import { collect, snapshotUrl } from '../scripts/collect.mjs';
let server, browser, base, snapshot;
const thumbnail = await readFile(new URL('../assets/favicon-192.png', import.meta.url));
async function mockStoryImages(page) {
  await page.route('**/*', route => route.request().resourceType() === 'image' && !route.request().url().startsWith(base)
    ? route.fulfill({body:thumbnail,contentType:'image/png'}) : route.continue());
}
const testPermissions = Object.fromEntries(SOURCES.map(s=>[s.id,{text:true,summaries:true,images:true}]));
const errors = [];
before(async()=>{
  const fixtures=Object.fromEntries(await Promise.all(SOURCES.map(async s=>[s.id,await readFile(new URL(`./fixtures/${s.id==='stringer'?'stringer.html':s.id+'.xml'}`,import.meta.url),'utf8')])));
  snapshot=await collect({permissions:testPermissions,pagesUrl:'https://example.org/',log:()=>{},request:async url=>{if(url===snapshotUrl('https://example.org/'))throw new Error('First run');return fixtures[SOURCES.find(s=>s.url===url).id]}});
  server=createServer(async(req,res)=>{
    const pathname=new URL(req.url,'http://localhost').pathname.replace(/^\/stringer-news(?=\/)/,'');
    const file=pathname==='/'?'index.html':pathname.slice(1);
    if(!['index.html','app.js','news-model.js','style.css','assets/stringer-logo.png','assets/favicon-16.png','assets/favicon-32.png','assets/favicon-192.png','assets/favicon-180.png','data/news.json'].includes(file)){res.writeHead(404);res.end();return;}
    try{let body=file==='data/news.json'?JSON.stringify(snapshot):await readFile(new URL('../'+file,import.meta.url));
    // Explicit fictional grants keep enabled-feed regression coverage independent of production policy.
    if(file==='news-model.js') body=body.toString().replace("text: true, summaries: source.id === 'stringer', images: source.id === 'stringer'", 'text: true, summaries: true, images: true');res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.json')?'application/json':file.endsWith('.png')?'image/png':'text/html');res.end(body)}catch{res.writeHead(404);res.end()}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));base=`http://127.0.0.1:${server.address().port}`;
  browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
  await mkdir('.test-output',{recursive:true});
});
after(async()=>{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));});
async function pageAt(path='/',width=1280){const page=await browser.newPage({viewport:{width,height:1000}});page.on('pageerror',error=>errors.push(error.message));await mockStoryImages(page);await page.clock.install();await page.goto(base+path);await page.waitForSelector('#stringer-news article');return page;}
async function poll(page) {
  const response = page.waitForResponse('**/data/news.json');
  await page.clock.fastForward(300_000);
  await response;
  await page.waitForFunction(()=>document.querySelector('#world-news').getAttribute('aria-busy')==='false');
}
test('desktop, 768px, and mobile layouts render two populated columns without overflow',async()=>{
  for(const width of [1280,768,375]){
    const page=await pageAt('/',width);assert.equal(await page.locator('#stringer-news article').count(),24);assert.equal(await page.locator('#world-news article').count(),worldStories(snapshot).length);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    const left=await page.locator('#global-newswire').boundingBox();const right=await page.locator('#courageous-stories').boundingBox();
    if(width>=768){assert.equal(left.y,right.y);assert.ok(right.x>left.x)}else{assert.ok(right.y>left.y+left.height-1);assert.equal(await page.locator('.jump-links').isVisible(),true)}
    assert.equal(await page.locator('.social-links a').count(),4);
    await page.screenshot({path:`.test-output/news-${width}.png`,fullPage:false});await page.locator('footer').screenshot({path:`.test-output/footer-${width}.png`});await page.close();
  }
  assert.deepEqual(errors,[]);
});
test('relative assets and JSON work at /stringer-news/ and a domain root',async()=>{
  for(const path of ['/','/stringer-news/']){const page=await pageAt(path);assert.equal(await page.locator('#world-news article').count(),worldStories(snapshot).length);assert.equal(await page.locator('.main-nav [aria-current]').getAttribute('href'),'./');await page.close();}
});
test('automatic refresh of the same snapshot stays quiet and preserves publication timestamps',async()=>{
  const page=await pageAt();const status=await page.locator('#world-news time').allTextContents();await poll(page);assert.equal(await page.locator('#refresh-status').textContent(),'');
  assert.deepEqual(await page.locator('#world-news time').allTextContents(),status);assert.equal(await page.locator('#world-status').textContent(),'');await page.close();
});
test('failed browser refresh retains displayed stories; first-load failure is visible',async()=>{
  const page=await pageAt();await page.route('**/data/news.json',route=>route.fulfill({status:503,body:'Unavailable'}));await poll(page);await page.waitForFunction(()=>document.querySelector('#refresh-status').textContent.includes('Could not check'));
  assert.equal(await page.locator('#stringer-news article').count(),24);assert.equal(await page.locator('#world-news').getAttribute('aria-busy'),'false');
  await page.reload();await page.waitForFunction(()=>document.querySelector('#world-status').textContent==='Headlines unavailable.');assert.equal(await page.locator('#world-news article').count(),0);await page.close();
});
test('retained-source failures, valid empty newswire, and stopped-schedule staleness are displayed',async()=>{
  const page=await browser.newPage();await mockStoryImages(page);await page.clock.install({time:new Date(Date.parse(snapshot.generatedAt)+3*60*60*1000)});let changed=structuredClone(snapshot);
  for(const s of SOURCES){changed.sources[s.id].status='failure';changed.sources[s.id].error='Unavailable';}
  await page.route('**/data/news.json',route=>route.fulfill({json:changed}));await page.goto(base);await page.waitForSelector('#stringer-news article');assert.match(await page.locator('#world-status').innerText(),/Showing retained collection/);
  changed=structuredClone(snapshot);for(const s of SOURCES.filter(s=>s.id!=='stringer'))changed.sources[s.id].stories=[];
  await poll(page);await page.waitForSelector('#world-news .empty');assert.match(await page.locator('#world-status').innerText(),/No stories returned/);
  await page.clock.fastForward(30_000);assert.match(await page.locator('#stringer-status').innerText(),/over two hours old/);await page.close();
});
test('malicious snapshot is rejected and remote markup is rendered as text',async()=>{
  const page=await pageAt();const bad=structuredClone(snapshot);bad.sources.stringer.stories[0].url='javascript:alert(1)';await page.route('**/data/news.json',route=>route.fulfill({json:bad}));await poll(page);await page.waitForFunction(()=>document.querySelector('#refresh-status').textContent.includes('Could not check'));assert.equal(await page.locator('#stringer-news article').count(),24);
  bad.sources.stringer.stories[0].url='https://example.org/story';bad.sources.stringer.stories[0].title='<img src=x onerror=alert(1)>';await poll(page);await page.waitForFunction(()=>document.querySelector('#stringer-news h3').textContent.startsWith('<img'));
  assert.equal(await page.locator('#stringer-news img[src="x"]').count(),0);await page.close();
});
test('visible polling, hidden-page pause, visibility catch-up, and overlap prevention',async()=>{
  const page=await browser.newPage();await mockStoryImages(page);await page.clock.install();let requests=0;let release;
  await page.route('**/data/news.json',async route=>{requests++;if(release!==undefined)await new Promise(resolve=>release=resolve);await route.fulfill({json:snapshot});});
  await page.goto(base);await page.waitForSelector('#world-news article');assert.equal(requests,1);
  await page.clock.fastForward(300_000);await page.waitForFunction(()=>document.querySelector('#world-news').getAttribute('aria-busy')==='false');assert.equal(requests,2);
  await page.evaluate(()=>Object.defineProperty(document,'hidden',{configurable:true,get:()=>true}));await page.clock.fastForward(600_000);assert.equal(requests,2);
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});document.dispatchEvent(new Event('visibilitychange'))});await page.waitForFunction(()=>document.querySelector('#world-news').getAttribute('aria-busy')==='false');assert.equal(requests,3);
  release=null;await page.clock.fastForward(300_000);await page.waitForTimeout(25);assert.equal(requests,4);await page.evaluate(()=>{document.dispatchEvent(new Event('visibilitychange'));document.dispatchEvent(new Event('visibilitychange'))});await page.clock.fastForward(1000);assert.equal(requests,4);assert.equal(await page.locator('#world-news').getAttribute('aria-busy'),'true');release();await page.waitForFunction(()=>document.querySelector('#world-news').getAttribute('aria-busy')==='false');await page.close();
});
test('keyboard navigation and requested removals',async()=>{
  const page=await pageAt();await page.keyboard.press('Tab');assert.equal(await page.locator('.skip-link').evaluate(el=>el===document.activeElement),true);await page.keyboard.press('Enter');assert.match(page.url(),/#main$/);
  assert.equal(await page.locator('#reporter-filter,.topics,#reporter-directory,#refresh,.refresh-control').count(),0);assert.doesNotMatch(await page.locator('body').innerText(),/Nostr|Mastodon|About Nostr|All sources/);
  assert.equal(await page.locator('#world-news article a').first().getAttribute('rel'),'noopener noreferrer');await page.close();
});

const branding = JSON.parse(await readFile(new URL('./fixtures/branding.json', import.meta.url), 'utf8'));
const cssValue = (locator, property) => locator.evaluate((el, prop) => getComputedStyle(el)[prop], property);
test('Stringer logo is visible, loaded, correctly sized, and linked on desktop and mobile', async () => {
  for (const [width, expected] of [[1440, branding.desktop], [375, branding.mobile]]) {
    const page = await pageAt('/', width);
    const logo = page.locator('header .brand img');
    assert.equal(await logo.isVisible(), true);
    assert.equal(await logo.evaluate(el => el.complete && el.naturalWidth > 0), true);
    const box = await logo.boundingBox();
    assert.equal(box.width, expected.logoWidth); assert.equal(box.height, expected.logoHeight);
    assert.equal(await page.locator('header .brand').getAttribute('href'), branding.source);
    assert.equal(await page.locator('footer img').evaluate(el => el.complete && el.naturalWidth > 0), true);
    await page.close();
  }
});
test('favicons load as correctly sized images at the domain root and project path', async () => {
  for (const path of ['/', '/stringer-news/']) {
    const page = await pageAt(path);
    for (const size of [16, 32, 192, 180]) {
      const selector = size === 180 ? 'link[rel="apple-touch-icon"]' : `link[rel="icon"][sizes="${size}x${size}"]`;
      const url = await page.locator(selector).evaluate(el => el.href);
      assert.equal(new URL(url).pathname, `${path}assets/favicon-${size}.png`);
      const response = await page.request.get(url);
      assert.equal(response.status(), 200);
      const image = await response.body();
      assert.equal(image.readUInt32BE(16), size); assert.equal(image.readUInt32BE(20), size);
    }
    await page.close();
  }
});
test('header and footer use main-site type sizes, colours, and hover treatments', async () => {
  const page = await pageAt('/', 1440);
  const nav = page.locator('.main-nav a').filter({ hasText: /^Mission$/ });
  assert.match(await cssValue(nav, 'fontFamily'), /Barlow/);
  assert.equal(await cssValue(nav, 'fontSize'), branding.desktop.navFontSize);
  assert.equal(await cssValue(nav, 'fontWeight'), branding.desktop.navFontWeight);
  assert.equal(await cssValue(nav, 'color'), branding.colors.ink);
  await nav.hover(); assert.equal(await cssValue(nav, 'color'), branding.colors.navHover);
  const icon = page.locator('.social-links a').first();
  assert.equal(await cssValue(icon, 'color'), branding.colors.ink);
  assert.equal((await icon.locator('svg').boundingBox()).width, branding.desktop.iconSize);
  await icon.hover(); assert.equal(await cssValue(icon, 'color'), branding.colors.accent);
  for (const location of ['header', 'footer']) {
    const button = page.locator(`${location} .donate`);
    assert.equal(await cssValue(button, 'backgroundColor'), branding.colors.ink);
    assert.equal(await cssValue(button, 'color'), branding.colors.white);
    assert.match(await cssValue(button, 'fontFamily'), /Montserrat/);
    assert.equal(await cssValue(button, 'fontSize'), branding.desktop.buttonFontSize);
    assert.equal(await cssValue(button, 'borderRadius'), branding.desktop.buttonRadius);
    assert.equal(await cssValue(button, 'padding'), branding.desktop.buttonPadding);
    await button.hover(); assert.equal(await cssValue(button, 'backgroundColor'), branding.colors.accent);
    assert.equal(await cssValue(button, 'color'), branding.colors.white);
  }
  assert.equal(await cssValue(page.locator('.footer-appeal'), 'fontSize'), '16px');
  assert.equal(await cssValue(page.locator('.nonprofit'), 'fontSize'), '15px');
  await page.close();
});

test('desktop newswire reaches the Stringer stories with distinct real headlines, including after resize', async () => {
  const page = await pageAt('/', 1280);
  for (const width of [1280, 768, 375, 1440]) {
    await page.setViewportSize({ width, height:1000 });
    await page.waitForTimeout(50);
    const cards = page.locator('#world-news article:not([hidden])');
    const count = await cards.count();
    if (width >= 768) {
      const last = await cards.last().boundingBox();
      const right = await page.locator('#stringer-news article').last().boundingBox();
      assert.ok(last.y+last.height >= right.y+right.height-2);
      assert.ok(last.y < right.y+right.height+2, 'Use only enough headlines to reach the right column');
      assert.ok(count > 24, 'Longer collection should draw additional headlines');
    } else assert.equal(count, 24);
    const links = await cards.locator('.story-body > a').evaluateAll(els=>els.map(el=>el.href));
    assert.equal(new Set(links).size, links.length);
  }
  await page.close();
});
test('story images load lazily, preserve attribution, and disappear cleanly on failure', async () => {
  const page = await pageAt();
  assert.equal(await page.locator('#stringer-news .story-media img').count(), 23);
  assert.equal(await page.locator('#stringer-news .story-media img').nth(1).getAttribute('loading'), 'lazy');
  const first = page.locator('#stringer-news article').first();
  await first.locator('img').evaluate(el=>el.dispatchEvent(new Event('error')));
  assert.equal(await first.locator('.story-media').count(), 0);
  assert.equal(await first.locator('h3').textContent(), snapshot.sources.stringer.stories[0].title);
  assert.equal(await first.locator('.credits').textContent(), snapshot.sources.stringer.stories[0].credits);
  assert.equal(await first.evaluate(el=>el.classList.contains('with-image')), false);
  const credited = snapshot.sources.nyt.stories.find(story=>story.image?.credit);
  assert.ok((await page.locator('#world-news figcaption').allTextContents()).includes(credited.image.credit));
  await page.close();
});

test('production policy renders only publisher headlines and links while preserving Stringer photos', async () => {
  const page = await browser.newPage();
  await mockStoryImages(page);
  const imageRequests = [];
  page.on('request', request=> { if(request.resourceType()==='image') imageRequests.push(request.url()); });
  await page.route('**/news-model.js', async route=>route.fulfill({contentType:'text/javascript',body:await readFile(new URL('../news-model.js',import.meta.url),'utf8')}));
  await page.goto(base);
  await page.waitForSelector('#stringer-news article');
  assert.ok(await page.locator('#world-news article').count() > 0);
  assert.equal(await page.locator('#world-news .summary, #world-news time').count(),0);
  assert.ok(await page.locator('#world-news .source').count() > 0);
  assert.equal(await page.locator('#world-news article a').first().getAttribute('rel'),'noopener noreferrer');
  assert.equal(await page.locator('#world-news img').count(),0);
  assert.equal(await page.locator('#stringer-news img').count(),23);
  assert.equal(await page.locator('#stringer-news article').count(),24);
  const approvedImages = new Set(snapshot.sources.stringer.stories.flatMap(story=>story.image ? [story.image.url] : []));
  assert.ok(imageRequests.every(url=>url.startsWith(base) || approvedImages.has(url)), 'Only approved Stringer photos are requested');
  for (const width of [1280,375]) {
    await page.setViewportSize({width,height:1000});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  }
  await page.close();
});
