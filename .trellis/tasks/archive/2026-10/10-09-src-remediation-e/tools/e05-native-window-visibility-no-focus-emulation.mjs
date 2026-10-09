import {chromium} from '/Users/xiaomengdao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {writeFile} from 'node:fs/promises';
const executablePath='/Users/xiaomengdao/Library/Caches/ms-playwright/chromium-1234/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const browser=await chromium.launch({executablePath,headless:false});const observations=[];
try {
 const context=await browser.newContext();const page=await context.newPage();
 await page.setContent('<title>E05 isolated window visibility capability</title>');
 await page.evaluate(()=>{window.events=[];document.addEventListener('visibilitychange',()=>window.events.push({hidden:document.hidden,state:document.visibilityState}));});
 const sample=async step=>observations.push({step,state:await page.evaluate(()=>({hidden:document.hidden,state:document.visibilityState,events:window.events}))});
 await sample('initial');const second=await context.newPage();await second.bringToFront();await sample('second tab foreground');
 const cdp=await context.newCDPSession(page);await cdp.send('Emulation.setFocusEmulationEnabled',{enabled:false});await sample('Playwright focus emulation disabled');const windowInfo=await cdp.send('Browser.getWindowForTarget');observations.push({step:'window initial',windowInfo});
 await cdp.send('Browser.setWindowBounds',{windowId:windowInfo.windowId,bounds:{windowState:'minimized'}});
 try{await page.waitForFunction(()=>document.hidden,null,{timeout:2000,polling:100});}catch(error){observations.push({step:'minimized hidden wait',error:error.message});}
 await sample('window minimized');
 await cdp.send('Browser.setWindowBounds',{windowId:windowInfo.windowId,bounds:{windowState:'normal'}});await page.bringToFront();await sample('window restored');
}catch(error){observations.push({step:'probe failed',error:error.message});}
finally {
 const output={purpose:'Read-only real window visibility with automation focus emulation disabled; not click-spark acceptance',browser:browser.version(),executablePath,headless:false,observations,earlierProbeFailure:'e05-native-headful-visibility-capability.mjs timed out waiting for document.hidden after second page foreground; waitForFunction option passed in wrong argument slot, so actual timeout was default30000ms. Original script preserved. This producer uses correct third-argument timeout and records failure rather than inferring hidden.'};
 await writeFile(new URL('../research/E05-native-window-visibility-no-focus-emulation.json',import.meta.url),JSON.stringify(output,null,2)+'\n');console.log(JSON.stringify(output,null,2));await browser.close();
}
