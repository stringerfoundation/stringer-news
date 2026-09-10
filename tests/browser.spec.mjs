import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import { SOURCES } from '../news-model.js';
import { collect, snapshotUrl } from '../scripts/collect.mjs';
let server, browser, base, snapshot;
const errors = [];
before(async()=>{
  const fixtures=Object.fromEntries(await Promise.all(SOURCES.map(async s=>[s.id,await readFile(new URL(`./fixtures/${s.id==='stringer'?'stringer.html':s.id+'.xml'}`,import.meta.url),'utf8')])));
  snapshot=await collect({pagesUrl:'https://example.org/',log:()=>{},request:async url=>{if(url===snapshotUrl('https://example.org/'))throw new Error('First run');return fixtures[SOURCES.find(s=>s.url===url).id]}});
  server=createServer(async(req,res)=>{
    const pathname=new URL(req.url,'http://localhost').pathname.replace(/^\/ingestr(?=\/)/,'');
    const file=pathname==='/'?'index.html':pathname.slice(1);
    if(!['index.html','app.js','news-model.js','style.css','assets/stringer-logo.png','assets/favicon-16.png','assets/favicon-32.png','assets/favicon-192.png','assets/favicon-180.png','data/news.json'].includes(file)){res.writeHead(404);res.end();return;}
    try{const body=file==='data/news.json'?JSON.stringify(snapshot):await readFile(new URL('../'+file,import.meta.url));res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.json')?'application/json':file.endsWith('.png')?'image/png':'text/html');res.end(body)}catch{res.writeHead(404);res.end()}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));base=`http://127.0.0.1:${server.address().port}`;
  browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
  await mkdir('.test-output',{recursive:true});
});
after(async()=>{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));});
async function pageAt(path='/',width=1280){const page=await browser.newPage({viewport:{width,height:1000}});page.on('pageerror',error=>errors.push(error.message));await page.clock.install();await page.goto(base+path);await page.waitForSelector('#stringer-news article');return page;}
async function poll(page) {
  const response = page.waitForResponse('**/data/news.json');
  await page.clock.fastForward(300_000);
  await response;
  await page.waitForFunction(()=>document.querySelector('#world-news').getAttribute('aria-busy')==='false');
}
test('desktop, 768px, and mobile layouts render two populated columns without overflow',async()=>{
  for(const width of [1280,768,375]){
    const page=await pageAt('/',width);assert.equal(await page.locator('#stringer-news article').count(),24);assert.equal(await page.locator('#world-news article').count(),20);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    const left=await page.locator('#global-newswire').boundingBox();const right=await page.locator('#courageous-stories').boundingBox();
    if(width>=768){assert.equal(left.y,right.y);assert.ok(right.x>left.x)}else{assert.ok(right.y>left.y+left.height-1);assert.equal(await page.locator('.jump-links').isVisible(),true)}
    assert.equal(await page.locator('.social-links a').count(),4);
    await page.screenshot({path:`.test-output/news-${width}.png`,fullPage:false});await page.locator('footer').screenshot({path:`.test-output/footer-${width}.png`});await page.close();
  }
  assert.deepEqual(errors,[]);
});
test('relative assets and JSON work at /ingestr/ and a domain root',async()=>{
  for(const path of ['/','/ingestr/']){const page=await pageAt(path);assert.equal(await page.locator('#world-news article').count(),20);assert.equal(await page.locator('.main-nav [aria-current]').getAttribute('href'),'./');await page.close();}
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
  const page=await browser.newPage();await page.clock.install({time:new Date(Date.parse(snapshot.generatedAt)+3*60*60*1000)});let changed=structuredClone(snapshot);
  for(const s of SOURCES){changed.sources[s.id].status='failure';changed.sources[s.id].error='Unavailable';}
  await page.route('**/data/news.json',route=>route.fulfill({json:changed}));await page.goto(base);await page.waitForSelector('#stringer-news article');assert.match(await page.locator('#world-status').innerText(),/Showing retained collection/);
  changed=structuredClone(snapshot);for(const s of SOURCES.filter(s=>s.id!=='stringer'))changed.sources[s.id].stories=[];
  await poll(page);await page.waitForSelector('#world-news .empty');assert.match(await page.locator('#world-status').innerText(),/No stories returned/);
  await page.clock.fastForward(30_000);assert.match(await page.locator('#stringer-status').innerText(),/over two hours old/);await page.close();
});
test('malicious snapshot is rejected and remote markup is rendered as text',async()=>{
  const page=await pageAt();const bad=structuredClone(snapshot);bad.sources.stringer.stories[0].url='javascript:alert(1)';await page.route('**/data/news.json',route=>route.fulfill({json:bad}));await poll(page);await page.waitForFunction(()=>document.querySelector('#refresh-status').textContent.includes('Could not check'));assert.equal(await page.locator('#stringer-news article').count(),24);
  bad.sources.stringer.stories[0].url='https://example.org/story';bad.sources.stringer.stories[0].title='<img src=x onerror=alert(1)>';await poll(page);await page.waitForFunction(()=>document.querySelector('#stringer-news h3').textContent.startsWith('<img'));
  assert.equal(await page.locator('#stringer-news img').count(),0);await page.close();
});
test('visible polling, hidden-page pause, visibility catch-up, and overlap prevention',async()=>{
  const page=await browser.newPage();await page.clock.install();let requests=0;let release;
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
