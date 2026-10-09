// Read-only browser capability preparation, not E05 behavior acceptance.
import {chromium} from '/Users/xiaomengdao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {writeFile} from 'node:fs/promises';
const browser = await chromium.launch({executablePath:'/Users/xiaomengdao/Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell',headless:true});
const context = await browser.newContext();
try {
 const page = await context.newPage();
 await page.setContent('<title>E05 read-only visibility capability</title>');
 await page.evaluate(()=>{window.events=[]; document.addEventListener('visibilitychange',()=>window.events.push({hidden:document.hidden,state:document.visibilityState}));});
 const observations = [{step:'initial',state:await page.evaluate(()=>({hidden:document.hidden,state:document.visibilityState}))}];
 const second = await context.newPage(); await second.bringToFront();
 observations.push({step:'second page foreground',state:await page.evaluate(()=>({hidden:document.hidden,state:document.visibilityState}))});
 const cdp=await context.newCDPSession(page);
 await cdp.send('Page.setWebLifecycleState',{state:'frozen'});
 await cdp.send('Page.setWebLifecycleState',{state:'active'});
 observations.push({step:'frozen then active',state:await page.evaluate(()=>({hidden:document.hidden,state:document.visibilityState,events:window.events}))});
 let command;
 try {await cdp.send('Emulation.setPageVisibilityOverride',{visibilityState:'hidden'});command='supported';}catch(error){command=String(error.message);}
 const output={purpose:'Read-only capability probe; not click-spark implementation/test acceptance',browser:browser.version(),observations,pageVisibilityOverride:command,limitations:'Frozen page lifecycle and tab foreground are not inferred equivalent to document.hidden; see actual observations.'};
 await writeFile(new URL('../research/E05-native-visibility-capability.json',import.meta.url),JSON.stringify(output,null,2)+'\n');console.log(JSON.stringify(output,null,2));
}finally{await browser.close();}
