import {preview} from 'vite';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.E06_PLAYWRIGHT_PATH ?? 'playwright');
const [builtArg,outArg]=process.argv.slice(2);
if(!builtArg||!outArg)throw new Error('Usage: node scripts/e06-root-browser.mjs BUILT_DIRECTORY NEW_OUTPUT_DIRECTORY');
const built=path.resolve(builtArg),output=path.resolve(outArg);
await mkdir(output);await mkdir(path.join(output,'bodies'));
const sha=b=>createHash('sha256').update(b).digest('hex');
const seedBody=await readFile('tests/fixtures/e06/seeds.json');const seeds=JSON.parse(seedBody);
await writeFile(path.join(output,'seeds.json'),seedBody);
await writeFile(path.join(output,'producer.json'),JSON.stringify({script:sha(await readFile('scripts/e06-root-browser.mjs')),seed:sha(seedBody),buildAssets:sha(await readFile(path.join(built,'assets.json'))),node:process.version,conditions:{viewport:{width:1440,height:1000},cache:'disabled via CDP; fresh contexts; bootstrap excluded',fonts:'external blocked identically',paidCalls:0}},null,2));
const server=await preview({build:{outDir:path.join(built,'dist')},preview:{host:'127.0.0.1',port:0,strictPort:false}});
const addr=server.httpServer.address();const origin=`http://127.0.0.1:${addr.port}`;
const browser=await chromium.launch({headless:true,...(process.env.E06_BROWSER_PATH ? {executablePath:process.env.E06_BROWSER_PATH} : {})});
async function offline(context,externals){await context.route('**/*',async route=>{const u=new URL(route.request().url());if(u.origin===origin)return route.continue();externals.push({url:u.href,method:route.request().method()});if(u.hostname==='e06.invalid'&&u.pathname==='/v1/models')return route.fulfill({json:seeds.models,headers:{'access-control-allow-origin':'*'}});if(u.hostname==='e06.invalid')throw new Error('Unexpected provider transport: '+u.href);return route.abort('blockedbyclient');});}
const scenarios=[];
try{
 const setup=await browser.newContext();await offline(setup,[]);const boot=await setup.newPage();await boot.goto(origin+'/agent');await boot.waitForSelector('.agent-chat-root');
 const schema=await boot.evaluate(async()=>{const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('aifenjing');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});const stores=[...db.objectStoreNames].map(name=>{const s=db.transaction(name).objectStore(name);return {name,keyPath:s.keyPath,autoIncrement:s.autoIncrement,indexes:[...s.indexNames].map(n=>{const i=s.index(n);return {name:n,keyPath:i.keyPath,unique:i.unique,multiEntry:i.multiEntry};})};});const version=db.version;db.close();return {version,stores};});
 await writeFile(path.join(output,'schema.json'),JSON.stringify(schema,null,2));await setup.close();
 for(const scenario of ['empty','selected','plain','code']){
  const context=await browser.newContext({viewport:{width:1440,height:1000},permissions:['clipboard-read','clipboard-write']});const external=[];await offline(context,external);
  await context.addInitScript(({schema,seeds,scenario})=>{
   const req=indexedDB.open('aifenjing',schema.version);
   req.onupgradeneeded=()=>{for(const s of schema.stores){const store=req.result.createObjectStore(s.name,{keyPath:s.keyPath,autoIncrement:s.autoIncrement});for(const i of s.indexes)store.createIndex(i.name,i.keyPath,{unique:i.unique,multiEntry:i.multiEntry});}};
   req.onsuccess=()=>{const db=req.result,tx=db.transaction(['connectors','chatThreads','chatMessages'],'readwrite');tx.objectStore('connectors').put(seeds.connector);
    if(['plain','code'].includes(scenario)){tx.objectStore('chatThreads').put({id:'e06-history',title:'E06 '+scenario,model:'gpt-4o',connectorId:seeds.connector.id,createdAt:seeds.time,updatedAt:seeds.time});
     tx.objectStore('chatMessages').put({id:'e06-user',threadId:'e06-history',role:'user',content:'E06 question',status:'complete',createdAt:seeds.time});
     tx.objectStore('chatMessages').put({id:'e06-assistant',threadId:'e06-history',role:'assistant',content:seeds[scenario],status:'complete',createdAt:'2026-10-09T00:00:01.000Z'});}
    tx.oncomplete=()=>{db.close();window.e06SeedComplete=true;};};
  },{schema,seeds,scenario});
  const page=await context.newPage();const cdp=await context.newCDPSession(page);await cdp.send('Network.enable');await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});
  const requests=[],responses=[],errors=[],pending=[];let phase='initial';
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push({url:r.url(),method:r.method(),type:r.resourceType(),phase}));
  page.on('response',r=>{const observedPhase=phase;pending.push((async()=>{let body;try{body=await r.body();}catch(e){responses.push({url:r.url(),status:r.status(),error:String(e),phase:observedPhase});return;}const digest=sha(body);await writeFile(path.join(output,'bodies',digest),body);responses.push({url:r.url(),path:new URL(r.url()).pathname,status:r.status(),type:r.request().resourceType(),bytes:body.length,sha256:digest,phase:observedPhase,headers:r.headers()});})());});
  await page.goto(origin+(['plain','code'].includes(scenario)?'/agent/e06-history':'/agent'));
  await page.waitForFunction(()=>window.e06SeedComplete===true);
  await page.waitForSelector('.agent-composer');
  if(scenario==='empty'||scenario==='selected')await page.getByRole('button',{name:'选择模型',exact:true}).waitFor();
  if(scenario==='selected'){phase='picker';await page.getByRole('button',{name:'选择模型',exact:true}).click();await page.locator('.agent-model-row').filter({hasText:'GPT-4o'}).click();await page.locator('.agent-chip').filter({hasText:'GPT-4o'}).waitFor();phase='selected-settle';}
  if(scenario==='plain')await page.getByText('E06 plain history paragraph.',{exact:false}).waitFor();
  if(scenario==='code')await page.getByText('const answer = 42;',{exact:false}).first().waitFor();
  await page.waitForLoadState('networkidle');await page.waitForTimeout(1500);await Promise.all(pending);
  const timing=await page.evaluate(()=>({navigation:performance.getEntriesByType('navigation').map(e=>e.toJSON()),resources:performance.getEntriesByType('resource').map(e=>e.toJSON()),paint:performance.getEntriesByType('paint').map(e=>e.toJSON())}));
  await page.screenshot({path:path.join(output,scenario+'.png'),fullPage:true});
  const body=await page.locator('body').innerText();assert(!body.includes('请先在连接器页面'));assert.equal(errors.length,0,errors.join('\n'));
  const appAssets=[...new Map(responses.filter(r=>r.url.startsWith(origin)&&/\.(js|css)$/.test(r.path)&&r.status===200).map(r=>[r.path,r])).values()];
  const record={scenario,requests,responses,external,errors,timing,body,appAssets,uniqueJS:appAssets.filter(r=>r.path.endsWith('.js')).reduce((n,r)=>n+r.bytes,0),uniqueCSS:appAssets.filter(r=>r.path.endsWith('.css')).reduce((n,r)=>n+r.bytes,0)};
  await writeFile(path.join(output,scenario+'.json'),JSON.stringify(record,null,2));scenarios.push(record);await context.close();
 }
 const assetUse=new Map();for(const s of scenarios)for(const a of s.appAssets){const v=assetUse.get(a.path)??{...a,scenarios:[]};v.scenarios.push(s.scenario);assetUse.set(a.path,v);}
 await writeFile(path.join(output,'result.json'),JSON.stringify({status:'PASS',scenarios:scenarios.map(s=>({scenario:s.scenario,uniqueJS:s.uniqueJS,uniqueCSS:s.uniqueCSS,assets:s.appAssets.map(a=>a.path)})),shared:[...assetUse.values()].filter(a=>a.scenarios.length>1),exclusive:[...assetUse.values()].filter(a=>a.scenarios.length===1),unionBytes:[...assetUse.values()].reduce((n,a)=>n+a.bytes,0),limits:'One sample per scenario. Timing observations only, no latency conclusion. Selected includes actual picker interaction and retained picker requests. Unique decoded response body bytes; no compression inferred.'},null,2));
 console.log({status:'PASS',output,scenarios:scenarios.map(s=>({scenario:s.scenario,js:s.uniqueJS,css:s.uniqueCSS}))});
}catch(e){await writeFile(path.join(output,'failure.txt'),e.stack);throw e;}finally{await browser.close();await new Promise(r=>server.httpServer.close(r));}
