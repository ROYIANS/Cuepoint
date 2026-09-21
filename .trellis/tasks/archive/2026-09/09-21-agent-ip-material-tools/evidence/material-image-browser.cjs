const { chromium } = require('/Users/xiaomengdao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert = require('node:assert/strict');
(async () => {
 const browser = await chromium.launch({ executablePath:'/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',headless:true });
 try {
  const page = await browser.newPage(); await page.goto('http://127.0.0.1:4173/agent');
  const result = await page.evaluate(async () => {
   const {createChatThread}=await import('/src/db/repo.ts'),{beginAgentRun}=await import('/src/db/agentRuns.ts'),{createFileMaterial}=await import('/src/db/materials.ts'),{queueMaterialImage}=await import('/src/lib/agent/materialImageInput.ts');
   const thread=await createChatThread({});const run=await beginAgentRun({threadId:thread.id,model:'fixture-model',connector:{id:'fixture',definitionId:'openai-compatible',baseUrl:'https://example.test/v1',apiKey:'fixture',updatedAt:'2026-09-21'},content:'看图',modelMetadata:{source:'provider',vision:true}});
   const context={runId:run.id,threadId:thread.id,callId:'image',signal:new AbortController().signal};
   const bytes=Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg=='),c=>c.charCodeAt(0));
   const image=await createFileMaterial(new File([bytes],'real.png',{type:'image/png'}),{kind:'global'});
   const queued=await queueMaterialImage(image.id,1,context);
   const fake=await createFileMaterial(new File(['not png'],'fake.png',{type:'image/png'}),{kind:'global'});
   let error='';try{await queueMaterialImage(fake.id,1,context)}catch(e){error=e.message}
   return {status:queued.status,decoded:typeof createImageBitmap==='function',fakeError:error};
  }); assert.equal(result.status,'queued');assert(result.decoded);assert(result.fakeError.includes('文件内容'));console.log(JSON.stringify(result));
 } finally {await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
