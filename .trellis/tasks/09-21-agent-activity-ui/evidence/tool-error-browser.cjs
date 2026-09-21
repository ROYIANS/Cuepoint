const {chromium}=require('/Users/xiaomengdao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs'),assert=require('node:assert/strict');
const out='.trellis/tasks/09-21-agent-activity-ui/evidence';
(async()=>{const browser=await chromium.launch({executablePath:'/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',headless:true});const ctx=await browser.newContext({viewport:{width:1440,height:1000}}),page=await ctx.newPage();const errors=[],checks=[];page.on('pageerror',e=>errors.push(e.message));try{
 await page.route('https://error.fixture.test/**',r=>r.fulfill({status:200,contentType:'application/json',body:'{"data":[]}'}));
 await page.goto('http://127.0.0.1:4173/projects');
 const f=await page.evaluate(async()=>{
  const db=(await import('/src/db/database.ts')).db,r=await import('/src/db/repo.ts'),runs=await import('/src/db/agentRuns.ts'),runtime=await import('/src/lib/agent/runChat.ts');
  const config={id:'error-fixture',definitionId:'openai-compatible',baseUrl:'https://error.fixture.test/v1',apiKey:'fixture-only',updatedAt:new Date().toISOString()};await db.connectors.put(config);
  const project=await r.createProject('工具错误说明验证'),episode=await r.firstEpisode(project.id),thread=await r.createChatThread({projectId:project.id});
  const run=await runs.beginAgentRun({threadId:thread.id,connector:config,model:'test-model',content:'请读取分集剧本'});let count=0,feedback;
  const args=JSON.stringify({kind:'episode',ownerId:project.id,episodeId:episode.id,id:episode.id,field:'script',limit:24000,offset:0});
  await runtime.executeChatRun(run,config.apiKey,new AbortController(),async(_url,init)=>{count++;if(count===1)return Response.json({choices:[{message:{content:'我先读取分集剧本。',tool_calls:[{id:'invalid-read',type:'function',function:{name:'business_read_text',arguments:args}}]},finish_reason:'tool_calls'}]});const body=JSON.parse(init.body);feedback=body.messages.filter(m=>m.role==='tool').at(-1).content;return Response.json({choices:[{message:{content:'这次剧本读取未成功，暂时无法核实全文。'},finish_reason:'stop'}]})});
  const call=await db.agentToolCalls.where('runId').equals(run.id).first();return {threadId:thread.id,runId:run.id,callId:call.id,feedback,call};
 });
 assert.equal(f.call.status,'failed');assert.equal(f.call.highRisk,false);assert(f.feedback.includes('12000'));assert(f.feedback.includes('story.script'));
 checks.push('actual runtime sends both limit and field repair guidance to model, invalid read not high risk');
 await page.goto('http://127.0.0.1:4173/agent/'+f.threadId);
 const summary=page.locator('.agent-run-summary');await summary.waitFor();assert((await summary.innerText()).includes('失败'));assert.equal(await summary.getAttribute('aria-expanded'),'false');
 await summary.click();await page.locator('.agent-tool-group-toggle').click();await page.locator('.agent-tool-call-toggle').click();
 const row=page.locator('[data-activity-call="'+f.callId+'"]');assert((await row.innerText()).includes('12000'));assert((await row.innerText()).includes('story.script'));assert(!(await row.innerText()).includes('高风险操作'));
 await page.screenshot({path:out+'/tool-error-desktop.png'});checks.push('completed collapsed header flags failure; expanded call explains both parameters without technical JSON');
 await page.evaluate(async f=>{const db=(await import('/src/db/database.ts')).db;await db.agentToolCalls.update(f.callId,{highRisk:true,error:'工具 分段读取创作文本 的参数无效',result:JSON.stringify({error:'工具 分段读取创作文本 的参数无效'}),updatedAt:new Date().toISOString()})},f);
 await page.waitForTimeout(250);assert((await row.innerText()).includes('12000'));assert((await row.innerText()).includes('story.script'));assert(!(await row.innerText()).includes('高风险操作'));
 checks.push('legacy generic invalid-argument record receives labelled local revalidation details');
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(150);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:out+'/tool-error-mobile.png'});
 assert.deepEqual(errors,[]);console.log(JSON.stringify({checks,errors,feedback:JSON.parse(f.feedback)},null,2));
 }finally{fs.writeFileSync(out+'/tool-error-browser.json',JSON.stringify({checks,errors},null,2));await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
