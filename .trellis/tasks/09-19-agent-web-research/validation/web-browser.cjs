// Native browser verification: disposable IndexedDB, real tools, intercepted billed services.
const {chromium}=require('/Users/xiaomengdao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:'/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',headless:true});
 const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();
 const errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://api.tavily.com/**',async route=>{
  const request=route.request(),path=new URL(request.url()).pathname;
  const headers={'access-control-allow-origin':'*','access-control-allow-methods':'POST,GET,OPTIONS','access-control-allow-headers':'authorization,content-type'};
  if(request.method()==='OPTIONS'){await route.fulfill({status:204,headers});return;}
  requests.push({path,method:request.method(),body:request.postDataJSON(),auth:request.headers().authorization});
  const body=path==='/usage'?{key:{usage:0,limit:100},account:{current_plan:'fixture',plan_usage:0,plan_limit:100}}:path==='/search'?{results:[{title:'雨夜布光参考',url:'https://example.com/rain',content:'侧逆光能够凸显雨丝；需要结合人物面部曝光。',published_date:'2026-09-01'}],request_id:'search-fixture'}:{results:[{url:'https://example.com/rain',raw_content:'# 雨夜布光\n侧逆光突出雨丝，适当补光保留人物表情。\nNATIVE_WEB_SOURCE_2026'}],failed_results:[],request_id:'extract-fixture'};
  await route.fulfill({status:200,headers,contentType:'application/json',body:JSON.stringify(body)});
 });
 try{
  await page.goto('http://127.0.0.1:5185/connectors');
  await page.getByRole('button',{name:'配置 Tavily',exact:true}).click();
  await page.getByLabel('Tavily API Key',{exact:true}).fill('tvly-native-fixture-only');
  await page.getByRole('checkbox',{name:'启用联网搜索',exact:true}).check();
  await page.getByRole('button',{name:'测试搜索连接',exact:true}).click();
  await page.waitForFunction(()=>document.body.innerText.includes('成功'));
  assert.equal(requests.filter(r=>r.path==='/usage').length,1);assert.equal(requests.filter(r=>r.method==='POST').length,0);
  await page.getByRole('button',{name:'保存搜索连接',exact:true}).click();
  await page.getByRole('dialog').waitFor({state:'hidden'});
  assert.equal(requests.filter(r=>r.method==='POST').length,0);
  await page.reload();
  const result=await page.evaluate(async()=>{
   const {db}=await import('/src/db/database.ts'),repo=await import('/src/db/repo.ts'),runs=await import('/src/db/agentRuns.ts');
   const {executeChatRun}=await import('/src/lib/agent/runChat.ts'),{withThreadRunLock}=await import('/src/lib/agent/runOwnership.ts');
   const settings=await import('/src/db/agentSettings.ts'),search=await import('/src/db/searchConnections.ts');
   const check=(condition,message)=>{if(!condition)throw new Error(message);};
   check((await search.getSearchConnectionState()).enabled,'saved search not enabled');
   await settings.updateGeneralAgentConfig({permissionMode:'full'});
   const connector={id:'native-chat',definitionId:'openai-compatible',baseUrl:'https://chat.example.test/v1',apiKey:'fixture-chat',updatedAt:new Date().toISOString()};await db.connectors.put(connector);
   const outputs=[];
   for(const model of ['fixture-model','gpt-5.6-luna']){
    const thread=await repo.createChatThread();let turn=0;const payloads=[];
    const run=await withThreadRunLock(thread.id,async()=>{
     const run=await runs.beginAgentRun({threadId:thread.id,connector,model,content:'联网查找雨夜布光的参考资料，阅读来源后给出带链接的建议。'});
     check(run.enabledToolNames.includes('web_search')&&run.enabledToolNames.includes('web_read'),'tools not enabled after setup');
     await executeChatRun(run,connector.apiKey,new AbortController(),async(_url,init)=>{
      const body=JSON.parse(init.body);payloads.push(body);turn++;
      const name=turn===1?'web_search':turn===2?'web_read':undefined;
      const args=turn===1?{query:'雨夜布光参考',maxResults:5}:{url:'https://example.com/rain'};
      if(turn===2)check(JSON.stringify(body).includes('雨夜布光参考'),'search sources absent from next model request');
      if(turn===3)check(JSON.stringify(body).includes('NATIVE_WEB_SOURCE_2026'),'extracted text absent from next model request');
      if(run.protocol==='responses')return Response.json({id:`response-${turn}`,status:'completed',output:name?[{type:'function_call',id:`fc-${turn}`,call_id:`call-${turn}`,name,arguments:JSON.stringify(args),status:'completed'}]:[{type:'message',role:'assistant',content:[{type:'output_text',text:'建议用侧逆光表现雨丝。[布光参考](https://example.com/rain)',annotations:[]}]}]});
      return Response.json({choices:[{message:name?{content:'',tool_calls:[{id:`call-${turn}`,type:'function',function:{name,arguments:JSON.stringify(args)}}]}:{content:'建议用侧逆光表现雨丝。[布光参考](https://example.com/rain)'},finish_reason:name?'tool_calls':'stop'}]});
     });return run;
    });
    const calls=await db.agentToolCalls.where('runId').equals(run.id).toArray();
    check(calls.length===2&&calls.every(c=>c.status==='completed'),`web calls failed ${JSON.stringify(calls)}`);
    check((await db.agentRuns.get(run.id)).status==='completed','run incomplete');
    check(!JSON.stringify([await db.agentRuns.toArray(),await db.agentToolCalls.toArray(),await db.chatMessages.toArray(),payloads]).includes('tvly-native-fixture-only'),'search key leaked');
    outputs.push({threadId:thread.id,runId:run.id,protocol:run.protocol,turns:turn});
   }
   // Real task research observation is supported; web reading is not a creative result.
   const taskRepo=await import('/src/db/agentTasks.ts'),records=await import('/src/db/agentTaskRecords.ts');
   const project=await repo.createProject('联网调研验收');
   const task=await taskRepo.createAgentTask({projectId:project.id,title:'布光资料',goal:'读取来源并整理观察',plan:[]});
   let taskTurn=0;
   const taskRun=await withThreadRunLock(task.threadId,async()=>{
    const run=await runs.beginAgentRun({threadId:task.threadId,connector,model:'fixture-model',content:'读取这个网页并记录布光观察 https://example.com/rain'});
    await executeChatRun(run,connector.apiKey,new AbortController(),async()=>Response.json({choices:[{message:++taskTurn===1?{content:'',tool_calls:[{id:'task-read',type:'function',function:{name:'web_read',arguments:JSON.stringify({url:'https://example.com/rain'})}}]}:{content:'已读取布光资料。'},finish_reason:taskTurn===1?'tool_calls':'stop'}]}));return run;
   });
   const taskCall=(await db.agentToolCalls.where('runId').equals(taskRun.id).toArray())[0];
   check(taskCall.status==='completed'&&JSON.parse(taskCall.result).ok,'task source failed');
   await records.saveTaskRecord(task.id,{kind:'research',claim:'observation',title:'布光观察',body:'来源提到侧逆光可以突出雨丝。',sources:[{type:'tool',id:taskCall.id}]});
   check(!records.provesCompletedEffect(taskCall),'web read claimed creative completion');
   // Ask mode parks durably, rejects without service request; conversation mode exposes no tools.
   await settings.updateGeneralAgentConfig({permissionMode:'ask'});
   const askThread=await repo.createChatThread();
   await withThreadRunLock(askThread.id,async()=>{
    const run=await runs.beginAgentRun({threadId:askThread.id,connector,model:'fixture-model',content:'搜索服装参考'});
    await executeChatRun(run,connector.apiKey,new AbortController(),async()=>Response.json({choices:[{message:{content:'',tool_calls:[{id:'ask-search',type:'function',function:{name:'web_search',arguments:JSON.stringify({query:'服装参考'})}}]},finish_reason:'tool_calls'}]}));
    check((await db.agentRuns.get(run.id)).status==='waiting_approval','ask mode did not pause');
    const call=(await db.agentToolCalls.where('runId').equals(run.id).toArray())[0];
    check(call.status==='awaiting_approval','no pending approval');
    const toolsRepo=await import('/src/db/agentTools.ts');await toolsRepo.resolveAgentToolApproval(run.id,call.id,'reject');
   });
   const plainThread=await repo.createChatThread();
   const plain=await runs.beginAgentRun({threadId:plainThread.id,connector,model:'fixture-model',content:'普通聊天',interactionMode:'conversation'});
   check(plain.enabledToolNames.length===0,'conversation mode exposed tools');
   await runs.finishAgentRun(plain.id,'cancelled');
   return outputs;
  });
  assert.equal(requests.filter(r=>r.path==='/search').length,2);assert.equal(requests.filter(r=>r.path==='/extract').length,3);
  await page.goto(`http://127.0.0.1:5185/agent/${result[0].threadId}`);
  await page.getByRole('button',{name:/已完成 2\/2 步/}).click();
  await page.getByText('搜索网络资料',{exact:true}).first().click();
  await page.screenshot({path:'.trellis/tasks/09-19-agent-web-research/validation/desktop.png',animations:'disabled'});
  await page.setViewportSize({width:390,height:844});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'mobile overflow');
  await page.screenshot({path:'.trellis/tasks/09-19-agent-web-research/validation/mobile.png',animations:'disabled'});
  const before=requests.length;await page.reload();await page.waitForLoadState('networkidle');assert.equal(requests.length,before,'reload reissued service request');
  await page.goto('http://127.0.0.1:5185/connectors');
  await page.getByRole('button',{name:'配置 Tavily',exact:true}).click();
  assert.equal(await page.getByLabel('Tavily API Key',{exact:true}).inputValue(),'','saved key exposed in field');
  await page.getByLabel('Tavily API Key',{exact:true}).focus();
  await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'hidden'});
  await page.getByRole('button',{name:'配置 Tavily',exact:true}).click();
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'config mobile overflow');
  await page.screenshot({path:'.trellis/tasks/09-19-agent-web-research/validation/connection-mobile.png',animations:'disabled'});
  await page.getByRole('button',{name:'移除搜索连接',exact:true}).click();
  await page.getByRole('dialog').waitFor({state:'hidden'});
  assert.equal(await page.evaluate(async()=>{const {getSearchConnectionState}=await import('/src/db/searchConnections.ts');return (await getSearchConnectionState()).configured;}),false,'remove did not clear key');
  assert.equal(requests.length,before,'remove issued network');
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({result,usageTests:1,searches:2,extracts:3,taskObservation:true,askRejectionNoNetwork:true,conversationNoTools:true,noKeyLeak:true,reloadNoRequests:true,pageErrors:errors},null,2));
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
