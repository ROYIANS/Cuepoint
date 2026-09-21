const {chromium}=require('/Users/xiaomengdao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({executablePath:'/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',headless:true});const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();const errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));try{
 await page.route('https://api.tavily.com/**',async route=>{
  const request=route.request(),path=new URL(request.url()).pathname;
  const headers={'access-control-allow-origin':'*','access-control-allow-methods':'POST,GET,OPTIONS','access-control-allow-headers':'authorization,content-type'};
  if(request.method()==='OPTIONS'){await route.fulfill({status:204,headers});return;}
  requests.push({path,method:request.method()});
  const body=path==='/search'?{results:[{title:'雨夜布光资料',url:'https://example.com/rain',content:'侧逆光突出雨丝。'}]}:{results:[{url:'https://example.com/rain',raw_content:'NATIVE_COMBINED_WEB_EVIDENCE: 侧逆光突出雨丝，补光保留人物表情。'}],failed_results:[]};
  await route.fulfill({status:200,headers,contentType:'application/json',body:JSON.stringify(body)});
 });
 await page.goto('http://127.0.0.1:4173/agent');
 const result=await page.evaluate(async()=>{
  const {db}=await import('/src/db/database.ts'),repo=await import('/src/db/repo.ts'),runs=await import('/src/db/agentRuns.ts');
  const {executeChatRun}=await import('/src/lib/agent/runChat.ts'),{withThreadRunLock}=await import('/src/lib/agent/runOwnership.ts');
  const settings=await import('/src/db/agentSettings.ts');await settings.updateGeneralAgentConfig({permissionMode:'full',enabledSkillIds:['project-references']});
  const check=(condition,message)=>{if(!condition)throw new Error(message);};
  const project=await repo.createProject('雨夜'),episode=await repo.firstEpisode(project.id),shot=await repo.addShot(project.id,episode.id);
  await repo.patchShot(shot.id,{shotNumber:'3',content:'雨夜车站，人物等待列车'});
  const canvas=document.createElement('canvas');canvas.width=320;canvas.height=180;const ctx=canvas.getContext('2d');ctx.fillStyle='#203c50';ctx.fillRect(0,0,320,180);ctx.fillStyle='#e7ba6c';ctx.fillRect(145,65,40,100);
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png')),dataUrl=canvas.toDataURL('image/png');
  await repo.putMedia({id:'native-shot-image',projectId:project.id,filename:'rain-shot-3.png',mimeType:'image/png',blob});
  await repo.setShotSlot(shot.id,'firstFrame',{prompt:'不是图片内容的替代品',referenceImageIds:[],referenceVideoIds:[],result:{kind:'image',mediaId:'native-shot-image'}});
  const connector={id:'native-image-chat',definitionId:'openai-compatible',baseUrl:'https://chat.example.test/v1',apiKey:'fixture-chat',updatedAt:new Date().toISOString()};await db.connectors.put(connector);
  const results=[];
  for(const [model,combined] of [['fixture-vision',false],['gpt-5.6-luna',false],['fixture-vision',true],['gpt-5.6-luna',true]]){
   if(combined){const search=await import('/src/db/searchConnections.ts');await search.saveSearchConnection({apiKey:'tvly-combined-fixture-only',enabled:true});}
   const thread=await repo.createChatThread();let turn=0;const payloads=[];
   const run=await withThreadRunLock(thread.id,async()=>{
    const run=await runs.beginAgentRun({threadId:thread.id,connector,model,content:combined?'联网调研雨夜布光，结合《雨夜》项目第 3 个镜头的首帧给出建议。':'看看《雨夜》项目第 3 个镜头当前生成的首帧，描述实际画面。',modelMetadata:{source:'provider',vision:true}});
    check(run.enabledToolNames.includes('discover_project_images')&&run.enabledToolNames.includes('read_project_image'),'unbound reference skill lacks discovery/read tools');
    await executeChatRun(run,connector.apiKey,new AbortController(),async(_url,init)=>{
     const body=JSON.parse(init.body);payloads.push(body);turn++;
     let name,args;
     if(turn===1){name='discover_project_images';args={projectQuery:'雨夜',entityKind:'shot',query:'3',slot:'firstFrame'};}
     if(turn===2){const call=(await db.agentToolCalls.where('runId').equals(run.id).toArray()).find(row=>row.name==='discover_project_images');check(call?.status==='completed',`discovery failed ${JSON.stringify(call)}`);const found=JSON.parse(call.result);const candidates=found.candidates??found.items??[];check(candidates.length===1,`wrong discovery ${JSON.stringify(found)}`);name='read_project_image';args={discoveryCallId:call.id,candidateId:candidates[0].id};}
     if(turn===3||combined&&turn>3){check(JSON.stringify(body).includes(dataUrl),'actual target pixels not transmitted');check(JSON.stringify(body).includes(run.protocol==='responses'?'input_image':'image_url'),'wrong image wire type');}
     if(combined&&turn===3){name='web_search';args={query:'雨夜布光参考'};}
     if(combined&&turn===4){name='web_read';args={url:'https://example.com/rain'};}
     if(combined&&turn===5)check(JSON.stringify(body).includes('NATIVE_COMBINED_WEB_EVIDENCE'),'web and image evidence not both present');
     if(turn>(combined?5:3))throw new Error('unexpected extra model request');
     if(run.protocol==='responses')return Response.json({id:`response-${turn}`,status:'completed',output:name?[{type:'function_call',id:`fc-${turn}`,call_id:`call-${turn}`,name,arguments:JSON.stringify(args),status:'completed'}]:[{type:'message',role:'assistant',content:[{type:'output_text',text:'画面是深蓝色背景，中间偏右有暖黄色主体。',annotations:[]}]}]});
     return Response.json({choices:[{message:name?{content:'',tool_calls:[{id:`call-${turn}`,type:'function',function:{name,arguments:JSON.stringify(args)}}]}:{content:'画面是深蓝色背景，中间偏右有暖黄色主体。'},finish_reason:name?'tool_calls':'stop'}]});
    });return run;
   });
   check((await db.agentRuns.get(run.id)).status==='completed','vision run not completed');
   check(!(await db.chatThreads.get(thread.id)).projectId,'discovery silently bound conversation');
   check(!(await db.chatMessages.get(run.userMessageId)).attachments?.length,'fixture accidentally attached image');
   check(!JSON.stringify([await db.agentRuns.toArray(),await db.agentToolCalls.toArray()]).includes('data:image'),'persisted encoded pixels');
   check(!JSON.stringify([payloads,await db.agentToolCalls.toArray()]).includes('tvly-combined-fixture-only'),'search key leaked into combined run');
   results.push({combined,threadId:thread.id,protocol:run.protocol,turns:turn,exactPixels:true,noAttachment:true,unbound:true});
  }
  const other=await repo.createProject('其他项目');
  async function discoverOnce(boundProjectId,args){
   const thread=await repo.createChatThread(boundProjectId?{projectId:boundProjectId}:undefined);let turn=0;
   const run=await withThreadRunLock(thread.id,async()=>{
    const run=await runs.beginAgentRun({threadId:thread.id,connector,model:'fixture-vision',content:'检查指定项目图片',modelMetadata:{source:'provider',vision:true}});
    await executeChatRun(run,connector.apiKey,new AbortController(),async(_url,init)=>{
     check(!JSON.stringify(JSON.parse(init.body)).includes('data:image'),'discovery-only request transmitted pixels');
     const message=++turn===1?{content:'',tool_calls:[{id:'boundary-discovery',type:'function',function:{name:'discover_project_images',arguments:JSON.stringify(args)}}]}:{content:'需要进一步确认图片位置。'};
     return Response.json({choices:[{message,finish_reason:turn===1?'tool_calls':'stop'}]});
    });return run;
   });
   return (await db.agentToolCalls.where('runId').equals(run.id).toArray())[0];
  }
  const foreign=await discoverOnce(project.id,{projectId:other.id,entityKind:'shot'});
  check(foreign.status==='failed','bound conversation allowed foreign project discovery');
  await repo.createProject('雨夜');
  const ambiguous=await discoverOnce(undefined,{projectQuery:'雨夜',entityKind:'shot',query:'3'});
  check(ambiguous.status==='completed','ambiguous discovery failed');
  const ambiguity=JSON.parse(ambiguous.result);check(ambiguity.status==='ambiguous_project'&&ambiguity.candidates.length===0,'duplicate project silently selected');
  return {runs:results,boundForeignRejected:true,ambiguityExplicit:true};
 });
 await page.goto(`http://127.0.0.1:4173/agent/${result.runs[0].threadId}`);await page.getByRole('button',{name:/已完成 2\/2 步/}).click();
 await page.getByText('查看项目图片',{exact:true}).click();
 const source=page.getByRole('region',{name:'项目图片来源'}).filter({hasText:'已准备图片'});
 await source.getByRole('link',{name:/雨夜.*镜头 3.*首帧/}).waitFor();
 await page.screenshot({path:'.trellis/tasks/archive/2026-09/09-21-full-project-audit/evidence/integration-desktop.png',animations:'disabled'});
 await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:'.trellis/tasks/archive/2026-09/09-21-full-project-audit/evidence/integration-mobile.png',animations:'disabled'});
 const link=source.getByRole('link');await link.focus();await page.keyboard.press('Enter');await page.waitForURL(url=>url.pathname.includes('/shots'));
 assert(new URL(page.url()).searchParams.get('shot'),'source link lost target shot');
 await page.getByRole('heading',{name:'制作分镜',exact:true}).waitFor();
 await page.goto(`http://127.0.0.1:4173/agent/${result.runs[2].threadId}`);await page.getByRole('button',{name:/已完成 4\/4 步/}).click();
 await page.getByText('查看项目图片',{exact:true}).click();await page.getByText('读取网页正文',{exact:true}).click();
 await page.getByRole('region',{name:'项目图片来源'}).filter({hasText:'已准备图片'}).waitFor();
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'combined mobile overflow');
 await page.screenshot({path:'.trellis/tasks/archive/2026-09/09-21-full-project-audit/evidence/integration-combined-mobile.png',animations:'disabled'});
 await page.getByText('查看项目图片',{exact:true}).click();
 await page.getByRole('region',{name:'联网调研来源'}).last().scrollIntoViewIfNeeded();
 await page.screenshot({path:'.trellis/tasks/archive/2026-09/09-21-full-project-audit/evidence/integration-combined-web-mobile.png',animations:'disabled'});
 assert.equal(requests.filter(r=>r.path==='/search').length,2);assert.equal(requests.filter(r=>r.path==='/extract').length,2);
 assert.deepEqual(errors,[]);console.log(JSON.stringify({result,pageErrors:errors},null,2));
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
