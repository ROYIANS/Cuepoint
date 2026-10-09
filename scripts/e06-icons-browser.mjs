import assert from 'node:assert/strict';
import {createServer} from 'vite';
import react from '@vitejs/plugin-react';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {catalogData} from './e06-icon-data.mjs';
const {chromium}=await import(process.env.E06_PLAYWRIGHT_PATH ?? 'playwright');
const output=path.resolve(process.argv[2]??'');if(!process.argv[2])throw new Error('Usage: node scripts/e06-icons-browser.mjs NEW_OUTPUT_DIRECTORY');await mkdir(output);
const fingerprints={};for(const p of ['scripts/e06-icons-browser.mjs','tests/fixtures/e06/index.html','tests/fixtures/e06/icons.tsx','tests/fixtures/e06/tsconfig.json','src/components/agent/ModelIcons.tsx','src/components/agent/ModelIconCatalog.ts','src/components/agent/DemandModelIcons.tsx','src/components/agent/ModelIconMapping.generated.ts','scripts/e06-icon-data.mjs','src/components/agent/LobeChatTheme.tsx','package.json','pnpm-lock.yaml'])fingerprints[p]=createHash('sha256').update(await readFile(p)).digest('hex');
const catalog=await catalogData();
const dependencies=['react','react-dom/client','@lobehub/icons','@lobehub/icons/es/features/modelConfig','@lobehub/icons/es/features/providerConfig',...[...new Set([...catalog.model,...catalog.provider].map(m=>m.icon))].map(n=>'@lobehub/icons/es/'+n)];
const loaded={};const server=await createServer({configFile:false,root:process.cwd(),cacheDir:path.join(output,'cache'),plugins:[react(),{name:'e06-source-observer',enforce:'pre',transform(code,id){if(id.startsWith(process.cwd())&&!id.includes('node_modules'))loaded[path.relative(process.cwd(),id)]=createHash('sha256').update(code).digest('hex');}}],resolve:{alias:{'@':path.resolve('src')}},optimizeDeps:{entries:[path.resolve('tests/fixtures/e06/index.html')],include:dependencies},server:{host:'127.0.0.1',port:0,hmr:false}});await server.listen();
const addr=server.httpServer.address(),origin=`http://127.0.0.1:${addr.port}`;
const browser=await chromium.launch({headless:true,...(process.env.E06_BROWSER_PATH ? {executablePath:process.env.E06_BROWSER_PATH} : {})});
const cases=[],errors=[],documents=[];let info;
try{
 const context=await browser.newContext({viewport:{width:1000,height:600}});await context.route('**/*',r=>r.request().url().startsWith(origin)?r.continue():r.abort());const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.resourceType()==='document'&&r.frame()===page.mainFrame())documents.push(r.url());});await page.goto(origin+'/tests/fixtures/e06/index.html');await page.waitForFunction(()=>Boolean(window.e06Icons));
 info=await page.evaluate(async()=>({count:window.e06Icons.count,catalog:await window.e06Icons.verifyCatalog()}));assert(info.catalog.every(c=>c.sameIcon&&c.sameKeywords&&c.sameProps),'Complete publisher catalog fidelity');
 for(let index=0;index<info.count;index++){
  await page.evaluate(i=>window.e06Icons.set(i),index);
  await page.waitForFunction(i=>window.e06Icons.index===i,index);
  await page.waitForFunction(()=>!document.querySelector('#current > span[aria-hidden]')&&!document.querySelector('#current [style*="display: none"]'));
  const comparison=await page.evaluate(()=>{
   function normalized(selector){const original=document.querySelector(selector),clone=original.cloneNode(true);let serial=0;const ids=new Map();for(const e of clone.querySelectorAll('[id]')){ids.set(e.id,'e06-id-'+serial++);}for(const e of clone.querySelectorAll('*'))for(const a of [...e.attributes]){let value=a.value;for(const [old,next]of ids)value=value.split(old).join(next);e.setAttribute(a.name,value);}return {html:clone.innerHTML,rect:[original.firstElementChild?.getBoundingClientRect().width,original.firstElementChild?.getBoundingClientRect().height]};}
   return {input:window.e06Icons.current,before:normalized('#original'),after:normalized('#current')};
  });assert.deepEqual(comparison.after,comparison.before,JSON.stringify(comparison.input));cases.push(comparison);
 }
 assert.deepEqual(errors,[]);assert.equal(documents.length,1,'Fixture must not reload after optimizer discovery');await page.screenshot({path:path.join(output,'icons.png')});await writeFile(path.join(output,'result.json'),JSON.stringify({status:'PASS',fingerprints,loaded,dependencies,catalog:info.catalog,cases,errors,documents,limits:'Isolated real publisher/current wrapper parity; four scenario network proof uses production root separately.'},null,2));console.log({status:'PASS',cases:cases.length});
}catch(e){await writeFile(path.join(output,'failure.json'),JSON.stringify({error:e.stack,fingerprints,loaded,cases,errors,documents,info,dependencies},null,2));throw e;}finally{await browser.close();await server.close();}
