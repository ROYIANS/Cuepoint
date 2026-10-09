import {chromium} from '/Users/xiaomengdao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {writeFile} from 'node:fs/promises';
const executablePath='/Users/xiaomengdao/Library/Caches/ms-playwright/chromium-1234/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const browser=await chromium.launch({executablePath,headless:false});const observations=[];
try {
 const context=await browser.newContext();const page=await context.newPage();await page.setContent('<title>E05 isolated native tab visibility probe A</title>');
 await page.evaluate(()=>{window.events=[];document.addEventListener('visibilitychange',()=>window.events.push({hidden:document.hidden,state:document.visibilityState}));});
 const second=await context.newPage();await second.setContent('<title>E05 isolated native tab visibility probe B</title>');
 const firstCDP=await context.newCDPSession(page),secondCDP=await context.newCDPSession(second);await firstCDP.send('Emulation.setFocusEmulationEnabled',{enabled:false});await secondCDP.send('Emulation.setFocusEmulationEnabled',{enabled:false});
 const sample=async step=>observations.push({step,first:await page.evaluate(()=>({hidden:document.hidden,state:document.visibilityState,events:window.events})),second:await second.evaluate(()=>({hidden:document.hidden,state:document.visibilityState}))});
 await page.bringToFront();await sample('A foreground both focus emulation off');await second.bringToFront();
 try{await page.waitForFunction(()=>document.hidden,null,{timeout:2000,polling:100});}catch(error){observations.push({step:'A hidden wait',error:error.message});}
 await sample('B foreground both focus emulation off');await page.bringToFront();await sample('A foreground again');
}catch(error){observations.push({step:'probe failure',error:error.message});}
finally{const report={purpose:'Read-only native tab visibility capability with both pages automation focus override disabled before switching; not E05 implementation/acceptance',browser:browser.version(),executablePath,headless:false,observations};await writeFile(new URL('../research/E05-native-tabs-focus-disabled.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));await browser.close();}
