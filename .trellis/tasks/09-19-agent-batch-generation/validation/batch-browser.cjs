// Independent native browser regression: real runtime/repositories, disposable data, mocked providers.
const {chromium}=require('/Users/xiaomengdao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict');
(async()=>{
  const browser=await chromium.launch({executablePath:'/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',headless:true});
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  try {
    await page.goto('http://127.0.0.1:5185/agent');
    const result=await page.evaluate(async()=>{
      const {db}=await import('/src/db/database.ts');
      const repo=await import('/src/db/repo.ts');
      const runs=await import('/src/db/agentRuns.ts');
      const {executeChatRun}=await import('/src/lib/agent/runChat.ts');
      const {withThreadRunLock}=await import('/src/lib/agent/runOwnership.ts');
      const {updateGeneralAgentConfig}=await import('/src/db/agentSettings.ts');
      const batches=await import('/src/db/agentGenerationBatches.ts');
      const runtime=await import('/src/lib/agent/generationBatchRuntime.ts');
      const check=(condition,message)=>{if(!condition)throw new Error(message);};
      await updateGeneralAgentConfig({permissionMode:'full'});
      const chat={id:'batch-chat',name:'验证对话',definitionId:'openai-compatible',baseUrl:'https://chat.example.test/v1',apiKey:'fixture-chat',updatedAt:new Date().toISOString()};
      const generator={id:'batch-gen',name:'验证生成',definitionId:'apimart',baseUrl:'https://apimart.test/v1',apiKey:'fixture-generation',updatedAt:new Date().toISOString()};
      await db.connectors.bulkPut([chat,generator]);
      const project=await repo.createProject('批量生成 · 原生验证');
      const episode=await repo.firstEpisode(project.id);const shot=await repo.addShot(project.id,episode.id);
      const args={connectorId:generator.id,model:'gpt-image-2',target:{kind:'shot',projectId:project.id,episodeId:episode.id,entityId:shot.id,slot:'firstFrame'},prompt:'雨夜车站，暖光中的人物轮廓',parameters:{size:'16:9',resolution:'1k'},inputs:[]};
      const canvas=document.createElement('canvas');canvas.width=640;canvas.height=360;
      const ctx=canvas.getContext('2d');const gradient=ctx.createLinearGradient(0,0,640,360);gradient.addColorStop(0,'#142837');gradient.addColorStop(1,'#805b42');ctx.fillStyle=gradient;ctx.fillRect(0,0,640,360);ctx.fillStyle='#ead3a4';ctx.fillRect(285,115,58,175);
      const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
      let paidPosts=0,maxActive=0,active=0;const payloads=[];
      const mock=async(url,init)=>{
        if(init?.method==='POST'){
          const taskNumber=++paidPosts;payloads.push(JSON.parse(init.body));active++;maxActive=Math.max(maxActive,active);
          await new Promise(resolve=>setTimeout(resolve,25));
          return Response.json({code:200,data:[{task_id:`native-${taskNumber}`,status:'submitted'}]});
        }
        if(String(url).includes('/tasks/'))return Response.json({code:200,data:{id:new URL(String(url)).pathname.split('/').pop(),status:'completed',progress:100,result:{images:[{url:'https://cdn.test/candidate.png'}]}}});
        active--;return new Response(blob,{headers:{'content-type':'image/png'}});
      };
      async function prepare(candidates,model='fixture-model'){
        const thread=await repo.createChatThread({projectId:project.id});
        const run=await withThreadRunLock(thread.id,async()=>{
          const run=await runs.beginAgentRun({threadId:thread.id,connector:chat,model,content:'准备可编辑的批量候选'});let n=0;
          await executeChatRun(run,chat.apiKey,new AbortController(),async()=>{
            const first=++n===1;
            if(run.protocol==='responses')return Response.json({id:`native-response-${n}`,status:'completed',output:first?[{type:'function_call',id:'batch-function',call_id:'batch-call',name:'prepare_generation_batch',arguments:JSON.stringify({title:'雨夜 · 候选比较',candidates}),status:'completed'}]:[{type:'message',id:'answer',role:'assistant',status:'completed',content:[{type:'output_text',text:'批次已准备，请确认后生成。'}]}]});
            return Response.json({choices:[{message:first?{content:'',tool_calls:[{id:'batch-call',type:'function',function:{name:'prepare_generation_batch',arguments:JSON.stringify({title:'雨夜 · 候选比较',candidates})}}]}:{content:'批次已准备，请确认后生成。'},finish_reason:first?'tool_calls':'stop'}]});
          });return run;
        });
        const call=(await db.agentToolCalls.where('runId').equals(run.id).toArray()).find(row=>row.name==='prepare_generation_batch');
        check(call?.status==='completed',`batch tool failed: ${JSON.stringify(call)}`);
        return {thread,run,batchId:JSON.parse(call.result).batchId,call};
      }
      const f=await prepare([args,args,args,args,{...args,target:{...args.target,slot:'lastFrame'},prompt:'车站远景尾帧'}]);
      let view=await batches.readGenerationBatch(f.batchId,f.thread.id);
      check(view.items.length===5&&view.jobs.length===0&&paidPosts===0,'draft issued paid work');
      const originalArgs=f.call.arguments;
      await runtime.batchUserAction(f.thread.id,()=>batches.saveGenerationBatchDraft(f.batchId,f.thread.id,view.batch.revision,view.items.map(i=>({id:i.id,draft:{...i.draft,prompt:i.draft.prompt+'，保持电影构图'},included:i.included}))));
      db.close();await db.open();view=await batches.readGenerationBatch(f.batchId,f.thread.id);
      check(view.items.every(i=>i.draft.prompt.includes('电影构图')),'draft not durable');
      await runtime.batchUserAction(f.thread.id,()=>batches.confirmGenerationBatch(f.batchId,f.thread.id,view.batch.revision,new AbortController().signal));
      check(paidPosts===0,'repository confirmation must not submit');
      await runtime.startGenerationBatch(f.batchId,f.thread.id,{fetchImpl:mock,pollIntervalMs:0,maxPolls:2});
      view=await batches.readGenerationBatch(f.batchId,f.thread.id);
      check(view.jobs.length===5&&view.jobs.every(j=>j.status==='downloaded'),`not all downloaded: ${JSON.stringify(view.jobs.map(j=>({status:j.status,error:j.error})))}`);
      check(paidPosts===5&&maxActive===2,'wrong paid count or concurrency');
      check(payloads.every(p=>p.n===1&&p.prompt.includes('电影构图')),'actual reviewed payload mismatch');
      db.close();await db.open();await runtime.startGenerationBatch(f.batchId,f.thread.id,{fetchImpl:mock,pollIntervalMs:0,maxPolls:2});
      check(paidPosts===5,'reopen resubmitted jobs');
      check((await db.agentToolCalls.get(f.call.id)).arguments===originalArgs,'original tool args changed');
      const front=view.items.filter(i=>i.draft.target.slot==='firstFrame'),tail=view.items.find(i=>i.draft.target.slot==='lastFrame');
      await runtime.batchUserAction(f.thread.id,async()=>{await batches.selectBatchCandidate(f.batchId,f.thread.id,front[0].id);await batches.selectBatchCandidate(f.batchId,f.thread.id,tail.id);const outcomes=await batches.applyBatchSelections(f.batchId,f.thread.id);check(outcomes.length===2&&outcomes.every(o=>o.applied),'sibling slot apply conflict');});
      for(const candidate of [front[1],front[0]])await runtime.batchUserAction(f.thread.id,async()=>{await batches.selectBatchCandidate(f.batchId,f.thread.id,candidate.id);check((await batches.applyBatchSelections(f.batchId,f.thread.id)).every(o=>o.applied),'candidate switch failed');});
      await repo.patchShot(shot.id,{content:'人工新描述不得被覆盖'});
      await runtime.batchUserAction(f.thread.id,async()=>{await batches.selectBatchCandidate(f.batchId,f.thread.id,front[2].id);check((await batches.applyBatchSelections(f.batchId,f.thread.id)).some(o=>!o.applied),'manual change overwritten');});
      check((await db.shots.get(shot.id)).content==='人工新描述不得被覆盖','manual content lost');
      for(const job of view.jobs){await repo.deleteMediaIfOrphan(job.result.mediaId);check(await db.media.get(job.result.mediaId),'unselected media collected');}
      const responses=await prepare([{...args,prompt:'Responses 独立提案'}],'gpt-5.6-luna');
      check((await db.agentRuns.get(responses.run.id)).protocol==='responses','responses fixture protocol mismatch');
      check((await db.agentRuns.get(responses.run.id)).responseItems.some(row=>row.type==='function_call'&&row.arguments===responses.call.arguments),'Responses envelope altered');
      check(paidPosts===5,'Responses draft submitted generation');
      async function confirmFixture(fixture){const v=await batches.readGenerationBatch(fixture.batchId,fixture.thread.id);await runtime.batchUserAction(fixture.thread.id,()=>batches.confirmGenerationBatch(fixture.batchId,fixture.thread.id,v.batch.revision,new AbortController().signal));}
      const partial=await prepare([args,{...args,prompt:'部分失败场景 B'},{...args,prompt:'部分失败场景 C'}]);await confirmFixture(partial);
      let partialPosts=0;
      const partialMock=async(url,init)=>{
        if(init?.method==='POST'){const n=++partialPosts;return n===1?Response.json({message:'Invalid fixture prompt'},{status:400}):Response.json({code:200,data:[{task_id:`partial-${n}`,status:'submitted'}]});}
        if(String(url).includes('/tasks/'))return Response.json({code:200,data:{id:new URL(String(url)).pathname.split('/').pop(),status:'completed',result:{images:[{url:'https://cdn.test/partial.png'}]}}});
        return new Response(blob,{headers:{'content-type':'image/png'}});
      };
      await runtime.startGenerationBatch(partial.batchId,partial.thread.id,{fetchImpl:partialMock,pollIntervalMs:0,maxPolls:2});
      const pv=await batches.readGenerationBatch(partial.batchId,partial.thread.id);
      check(partialPosts===3&&pv.jobs.filter(j=>j.status==='failed').length===1&&pv.jobs.filter(j=>j.status==='downloaded').length===2,'partial success did not continue');
      const retry=await runtime.batchUserAction(partial.thread.id,()=>batches.retryFailedBatch(partial.batchId,partial.thread.id));
      const rv=await batches.readGenerationBatch(retry.id,partial.thread.id);check(rv.batch.status==='draft'&&rv.items.length===1&&rv.jobs.length===0&&partialPosts===3,'retry bypassed paid review');
      const unknown=await prepare([{...args,prompt:'未知结果 A'},{...args,prompt:'未知结果 B'},{...args,prompt:'未知结果 C'},{...args,prompt:'未知结果 D'}]);await confirmFixture(unknown);
      let unknownPosts=0;
      const unknownMock=async(url,init)=>{
        if(init?.method==='POST'){const n=++unknownPosts;if(n===1)throw new TypeError('Fixture lost response');return Response.json({code:200,data:[{task_id:`known-${n}`,status:'submitted'}]});}
        if(String(url).includes('/tasks/'))return Response.json({code:200,data:{id:new URL(String(url)).pathname.split('/').pop(),status:'completed',result:{images:[{url:'https://cdn.test/known.png'}]}}});
        return new Response(blob,{headers:{'content-type':'image/png'}});
      };
      await runtime.startGenerationBatch(unknown.batchId,unknown.thread.id,{fetchImpl:unknownMock,pollIntervalMs:0,maxPolls:2});
      const uv=await batches.readGenerationBatch(unknown.batchId,unknown.thread.id);
      check(uv.jobs.some(j=>j.status==='unknown')&&unknownPosts<=2&&uv.items.some(i=>i.state==='queued'),'unknown acceptance failed to block new dispatch');
      const beforeUnknown=unknownPosts;db.close();await db.open();await runtime.startGenerationBatch(unknown.batchId,unknown.thread.id,{fetchImpl:unknownMock,pollIntervalMs:0,maxPolls:2});
      check(unknownPosts===beforeUnknown,'unknown replay submitted paid work');
      await runtime.stopGenerationBatch(unknown.batchId,unknown.thread.id,'cancel');
      const cancelled=await batches.readGenerationBatch(unknown.batchId,unknown.thread.id);
      check(!cancelled.items.some(i=>i.state==='queued')&&cancelled.jobs.some(j=>j.status==='unknown'),'cancel erased ambiguity or left unsent queue');
      const twentyCandidates=[];
      for(let target=0;target<5;target++){
        const nextShot=await repo.addShot(project.id,episode.id);
        for(let candidate=0;candidate<4;candidate++)twentyCandidates.push({...args,target:{...args.target,entityId:nextShot.id},prompt:`容量验证目标 ${target} 候选 ${candidate}`});
      }
      const twenty=await prepare(twentyCandidates);await confirmFixture(twenty);
      const beforeTwenty=paidPosts;
      await runtime.startGenerationBatch(twenty.batchId,twenty.thread.id,{fetchImpl:mock,pollIntervalMs:0,maxPolls:2});
      const tv=await batches.readGenerationBatch(twenty.batchId,twenty.thread.id);
      check(tv.items.length===20&&tv.jobs.length===20&&tv.jobs.every(job=>job.status==='downloaded'),'20 item execution failed');
      check(paidPosts-beforeTwenty===20&&maxActive===2,'20 item concurrency or POST mismatch');
      return {projectId:project.id,threadId:f.thread.id,batchId:f.batchId,draftThreadId:responses.thread.id,draftBatchId:responses.batchId,paidPosts,maxActive,candidateCount:view.items.length,siblingSlotsAndSwitching:true,manualConflict:true,retainedOutputs:true,chatAndResponses:true,partialPosts,failedRetryDraftOnly:true,unknownPosts,unknownReplayAndCancellation:true,twentyItemQueue:true};
    });
    assert.equal(result.paidPosts,25);assert.equal(result.maxActive,2);assert.deepEqual(errors,[]);
    console.log(JSON.stringify(result,null,2));
    let uiPosts=0;const uiPayloads=[];
    const imageFixtures=await page.evaluate(()=>[0,1].map(index=>{
      const canvas=document.createElement('canvas');canvas.width=640;canvas.height=360;const ctx=canvas.getContext('2d');
      const gradient=ctx.createLinearGradient(0,0,640,360);gradient.addColorStop(0,index?'#34434b':'#162b40');gradient.addColorStop(1,index?'#ba9870':'#816d59');ctx.fillStyle=gradient;ctx.fillRect(0,0,640,360);
      ctx.fillStyle='#101c26';ctx.fillRect(0,265,640,95);ctx.fillRect(65,30,18,245);ctx.fillRect(465,30,18,245);ctx.fillRect(30,45,500,15);
      ctx.fillStyle='#d6b888';ctx.fillRect(index?360:285,115,58,150);ctx.fillStyle='#25313a';ctx.beginPath();ctx.arc(index?389:314,100,22,0,Math.PI*2);ctx.fill();
      ctx.strokeStyle='#d6e5eb44';for(let x=0;x<640;x+=29){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x-70,360);ctx.stroke();}
      return canvas.toDataURL('image/png').split(',')[1];
    }));
    await page.route('https://apimart.test/**',async route=>{
      const request=route.request();let body;
      if(request.method()==='OPTIONS'){await route.fulfill({status:204,headers:{'access-control-allow-origin':'*','access-control-allow-methods':'POST,GET,OPTIONS','access-control-allow-headers':'authorization,content-type'}});return;}
      if(request.method()==='POST'){const id=++uiPosts;uiPayloads.push(request.postDataJSON());body={code:200,data:[{task_id:`ui-${id}`,status:'submitted'}]};}
      else {const id=new URL(request.url()).pathname.split('/').pop();body={code:200,data:{id,status:'completed',progress:100,result:{images:[{url:`https://cdn.test/${id}.png`}]}}};}
      await route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(body)});
    });
    await page.route('https://cdn.test/**',route=>route.fulfill({status:200,contentType:'image/png',headers:{'access-control-allow-origin':'*'},body:Buffer.from(imageFixtures[route.request().url().includes('ui-2')?1:0],'base64')}));
    await page.goto(`http://127.0.0.1:5185/agent/${result.draftThreadId}`);
    await page.getByRole('button',{name:'打开批量生成：雨夜 · 候选比较',exact:true}).click();
    await page.locator('.agent-batch-config-toggle').first().click();
    await page.getByRole('textbox',{name:'画面描述',exact:true}).fill('真实界面修改：雨夜车站电影构图');
    await page.getByRole('combobox',{name:'图片比例',exact:true}).click();
    await page.getByRole('option',{name:'9:16',exact:true}).click();
    await page.getByRole('button',{name:'保存草稿',exact:true}).click();
    await page.getByRole('button',{name:'草稿已保存',exact:true}).waitFor();
    await page.reload();
    await page.getByRole('button',{name:'打开批量生成：雨夜 · 候选比较',exact:true}).click();
    await page.locator('.agent-batch-config-toggle').first().click();
    assert.equal(await page.getByRole('textbox',{name:'画面描述',exact:true}).inputValue(),'真实界面修改：雨夜车站电影构图');
    await page.getByRole('button',{name:/复制 .*候选 A/}).click();
    await page.getByRole('button',{name:'确认生成 2 份',exact:true}).waitFor();
    assert.equal(uiPosts,0);
    await page.screenshot({path:'/tmp/batch-generation-review.png',animations:'disabled'});
    await page.getByRole('button',{name:'确认生成 2 份',exact:true}).click();
    await page.getByRole('button',{name:/选择候选 A：/}).waitFor();
    await page.getByRole('button',{name:/选择候选 B：/}).waitFor();
    assert.equal(uiPosts,2);assert(uiPayloads.every(body=>body.prompt==='真实界面修改：雨夜车站电影构图'&&body.size==='9:16'));
    await page.getByRole('button',{name:/选择候选 A：/}).click();
    await page.getByRole('button',{name:'写入选中的 1 个目标',exact:true}).click();
    await page.locator('.agent-batch-applied').waitFor();
    await page.getByRole('button',{name:/选择候选 B：/}).click();
    await page.getByRole('button',{name:'写入选中的 1 个目标',exact:true}).click();
    await page.getByText('已被替换',{exact:true}).waitFor();
    await page.getByRole('button',{name:/放大查看 .*候选 B/}).click();
    await page.getByRole('button',{name:'关闭素材预览',exact:true}).waitFor();
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('.agent-batch-inspection').count(),0);
    assert.equal(await page.locator('.agent-batch-dialog').count(),1);
    await page.screenshot({path:'/tmp/batch-generation-desktop.png',animations:'disabled'});
    await page.setViewportSize({width:390,height:844});
    await page.screenshot({path:'/tmp/batch-generation-mobile.png',animations:'disabled'});
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    assert(await page.locator('.agent-batch-dialog').evaluate(el=>el.scrollWidth<=el.clientWidth));
    await page.keyboard.press('Escape');
    await page.getByRole('button',{name:'打开批量生成：雨夜 · 候选比较',exact:true}).waitFor();
    await page.reload();assert.equal(uiPosts,2);
    assert.deepEqual(errors,[]);
    console.log('UI PASS: persisted prompt edit, clone, exact two confirmed POSTs, selection/apply/switch, nested Escape, 390px layout, reload without submission');
  }catch(error){await page.screenshot({path:'/tmp/batch-generation-failure.png',animations:'disabled'});throw error;}finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
