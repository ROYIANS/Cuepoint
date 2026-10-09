// Isolated test browser; no user profile, no E05 product implementation.
import {chromium} from '/Users/xiaomengdao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {writeFile} from 'node:fs/promises';
const executablePath='/Users/xiaomengdao/Library/Caches/ms-playwright/chromium-1234/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const browser=await chromium.launch({executablePath,headless:false});
try {
 const context=await browser.newContext();const page=await context.newPage();
 await page.setContent('<title>E05 isolated browser capability</title>');
 await page.evaluate(()=>{window.events=[];document.addEventListener('visibilitychange',()=>window.events.push({hidden:document.hidden,state:document.visibilityState}));});
 const observations=[{step:'initial',state:await page.evaluate(()=>({hidden:document.hidden,state:document.visibilityState}))}];
 const second=await context.newPage();await second.bringToFront();
 await page.waitForFunction(()=>document.hidden,{timeout:5000});
 observations.push({step:'second tab foreground',state:await page.evaluate(()=>({hidden:document.hidden,state:document.visibilityState,events:window.events}))});
 await page.bringToFront();await page.waitForFunction(()=>!document.hidden,{timeout:5000});
 observations.push({step:'original tab foreground',state:await page.evaluate(()=>({hidden:document.hidden,state:document.visibilityState,events:window.events}))});
 const output={purpose:'Read-only real tab visibility capability, not click-spark behavior acceptance',browser:browser.version(),executablePath,headless:false,observations};
 await writeFile(new URL('../research/E05-native-headful-visibility-capability.json',import.meta.url),JSON.stringify(output,null,2)+'\n');console.log(JSON.stringify(output,null,2));
}finally{await browser.close();}
