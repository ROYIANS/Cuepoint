// Native IndexedDB and actual Agent tool transport with isolated data and mocked HTTP.
const { chromium } = require('/Users/xiaomengdao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({executablePath:'/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',headless:true});
  const context = await browser.newContext({viewport:{width:1440,height:1000}});
  const page = await context.newPage();
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  try {
    await page.goto('http://127.0.0.1:5185/agent');
    const result=await page.evaluate(async()=>{
      const {db}=await import('/src/db/database.ts');
      const repo=await import('/src/db/repo.ts');
      const tasks=await import('/src/db/agentTasks.ts');
      const wrap=await import('/src/db/agentTaskWrapups.ts');
      const memory=await import('/src/db/projectMemories.ts');
      const runs=await import('/src/db/agentRuns.ts');
      const {executeChatRun}=await import('/src/lib/agent/runChat.ts');
      const {withThreadRunLock}=await import('/src/lib/agent/runOwnership.ts');
      const {updateGeneralAgentConfig}=await import('/src/db/agentSettings.ts');
      const check=(condition,message)=>{if(!condition)throw new Error(message);};
      await updateGeneralAgentConfig({permissionMode:'full'});
      const project=await repo.createProject('父任务集成 · 雨夜角色');
      const connector={id:'parent-fixture',definitionId:'openai-compatible',baseUrl:'https://example.test/v1',apiKey:'fixture-only',updatedAt:new Date().toISOString()};
      await db.connectors.put(connector);
      const call=(name,args,id)=>({id,type:'function',function:{name,arguments:JSON.stringify(args)}});
      const reply=(calls)=>Response.json({choices:[{message:calls?{content:'',tool_calls:calls}:{content:'已完成本轮验证。'},finish_reason:calls?'tool_calls':'stop'}]});
      const taskA=await tasks.createAgentTask({projectId:project.id,title:'任务 A · 雨夜角色',goal:'创建雨夜角色小雨并核对名称',acceptanceCriteria:['角色小雨存在'],plan:[]});
      const runA=await withThreadRunLock(taskA.threadId,async()=>{
        const run=await runs.beginAgentRun({threadId:taskA.threadId,connector,model:'fixture-model',content:'创建雨夜角色小雨，先确认轮廓再生成素材。'});
        let n=0;
        await executeChatRun(run,connector.apiKey,new AbortController(),async()=>reply(++n===1?[call('character_create',{ownerId:project.id,fields:{name:'小雨'}},'create-character')]:undefined));
        return run;
      });
      const callsA=await db.agentToolCalls.where('runId').equals(runA.id).toArray();
      const effect=callsA.find(row=>row.name==='character_create');
      check(effect?.status==='completed','actual character tool did not complete');
      const characterId=JSON.parse(effect.result).id;
      check((await db.characters.get(characterId))?.name==='小雨','actual character missing');
      const draft=await wrap.createManualWrapup(taskA.id);
      const sourceId=`tool:${effect.id}`;
      check(draft.snapshot.evidence.find(row=>row.id===sourceId)?.supportsResult,'effect evidence missing');
      const saved=await wrap.saveWrapup(taskA.id,draft.id,{...draft.content,overview:'角色小雨已建立并检查。',results:[{text:'角色小雨存在',sourceIds:[sourceId]}],acceptance:draft.content.acceptance.map(row=>({...row,status:'met',sourceIds:[sourceId]})),lessons:[{text:'雨夜角色先确认轮廓和动作，再生成候选。',sourceIds:[sourceId]}]},draft.revision);
      const confirmed=await wrap.confirmWrapup(taskA.id,saved.id,saved.revision);
      await tasks.setAgentTaskLifecycle(taskA.id,'completed',{id:confirmed.id,revision:confirmed.revision});
      const promoted=(await memory.promoteProjectMemory(project.id,{taskId:taskA.id,summaryId:confirmed.id,summaryRevision:confirmed.revision,itemKind:'lesson',itemIndex:0,itemText:confirmed.content.lessons[0].text},{category:'lesson',inclusion:'project',title:'雨夜角色制作顺序',topicKey:'rain-silhouette',body:confirmed.content.lessons[0].text,applicability:'雨夜角色设计',tags:['雨夜','角色']})).memory;
      const threadB=await repo.createChatThread({projectId:project.id});
      await db.chatThreads.update(threadB.id,{taskMode:true});
      check(await db.agentTasks.where('threadId').equals(threadB.id).count()===0,'sending must not create task prematurely');
      const requests=[];
      const runB=await withThreadRunLock(threadB.id,async()=>{
        const run=await runs.beginAgentRun({threadId:threadB.id,connector,model:'fixture-model',content:'为雨夜角色准备候选方案，先建立任务。'});
        check(await db.agentTasks.where('threadId').equals(threadB.id).count()===0,'begin must not auto-create task');
        await executeChatRun(run,connector.apiKey,new AbortController(),async(_url,init)=>{
          requests.push(JSON.parse(init.body));
          if(requests.length===1)return reply([call('task_create',{title:'任务 B · 雨夜候选',goal:'依据已有经验准备雨夜角色候选',acceptanceCriteria:['候选方案可审阅'],steps:[{id:'proposal',title:'准备候选方案',status:'pending'}],sources:[{type:'message',id:run.userMessageId}]},'create-task-b')]);
          return reply();
        });return run;
      });
      const taskB=await db.agentTasks.where('threadId').equals(threadB.id).first();
      const b=await db.agentRuns.get(runB.id);
      check(taskB&&b.taskId===taskB.id,'actual task_create did not bind task B');
      check(JSON.stringify(requests[0]).includes(promoted.body),'promoted memory absent from actual request');
      check(b.memoryAudit?.some(a=>JSON.stringify(a).includes(promoted.id)),'memory audit missing provenance');
      check(await db.agentTaskRecords.where('taskId').equals(taskB.id).count()>0,'task requirements record missing');
      // Continue the actual task B into video candidates, local output evidence and reviewed completion.
      const batches=await import('/src/db/agentGenerationBatches.ts');
      const batchRuntime=await import('/src/lib/agent/generationBatchRuntime.ts');
      const records=await import('/src/db/agentTaskRecords.ts');
      const generator={id:'parent-video',definitionId:'apimart',baseUrl:'https://apimart.test/v1',apiKey:'fixture-only',updatedAt:new Date().toISOString()};
      await db.connectors.put(generator);
      const episode=await repo.firstEpisode(project.id),shot=await repo.addShot(project.id,episode.id);
      const candidate={connectorId:generator.id,model:'MiniMax-H3',target:{kind:'shot',projectId:project.id,episodeId:episode.id,entityId:shot.id,slot:'clip'},prompt:'雨夜角色先确认轮廓，再比较动作',parameters:{},inputs:[]};
      const videoRun=await withThreadRunLock(threadB.id,async()=>{
        const run=await runs.beginAgentRun({threadId:threadB.id,connector,model:'fixture-model',content:'根据经验准备两个视频候选。'});let n=0;
        await executeChatRun(run,connector.apiKey,new AbortController(),async()=>reply(++n===1?[call('prepare_generation_batch',{title:'任务 B 视频候选',candidates:[candidate,candidate]},'video-batch')]:undefined));return run;
      });
      const videoCall=(await db.agentToolCalls.where('runId').equals(videoRun.id).toArray()).find(row=>row.name==='prepare_generation_batch');
      check(videoCall?.status==='completed','video batch tool failed');
      const batchId=JSON.parse(videoCall.result).batchId;
      let state=await batches.readGenerationBatch(batchId,threadB.id);
      let taskState=await wrap.getTaskWrapupState(taskB.id);
      check(taskState.completionBlockers.some(reason=>reason.includes('批量')),'draft did not block completion');
      check(!taskState.currentEvidence.find(row=>row.id===`tool:${videoCall.id}`)?.supportsResult,'draft claimed a result');
      const canvas=document.createElement('canvas');canvas.width=320;canvas.height=180;const ctx=canvas.getContext('2d');
      const stream=canvas.captureStream(12),chunks=[];const recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp8'});
      const recorded=new Promise(resolve=>{recorder.ondataavailable=event=>chunks.push(event.data);recorder.onstop=()=>resolve(new Blob(chunks,{type:'video/webm'}));});
      recorder.start();for(let i=0;i<5;i++){ctx.fillStyle='#193246';ctx.fillRect(0,0,320,180);ctx.fillStyle='#d6b888';ctx.fillRect(70+i*25,60,40,100);await new Promise(resolve=>setTimeout(resolve,90));}recorder.stop();
      const videoBlob=await recorded;stream.getTracks().forEach(track=>track.stop());
      let videoPosts=0;
      const mockVideo=async(url,init)=>{
        if(init?.method==='POST')return Response.json({code:200,data:[{task_id:`video-${++videoPosts}`,status:'submitted'}]});
        if(String(url).includes('/tasks/'))return Response.json({code:200,data:{id:new URL(String(url)).pathname.split('/').pop(),status:'completed',result:{videos:[{url:'https://cdn.test/video.webm'}]}}});
        return new Response(videoBlob,{headers:{'content-type':'video/webm'}});
      };
      await batchRuntime.batchUserAction(threadB.id,()=>batches.confirmGenerationBatch(batchId,threadB.id,state.batch.revision,new AbortController().signal));
      await batchRuntime.startGenerationBatch(batchId,threadB.id,{fetchImpl:mockVideo,pollIntervalMs:0,maxPolls:2});
      state=await batches.readGenerationBatch(batchId,threadB.id);
      check(videoPosts===2&&state.jobs.every(job=>job.status==='downloaded'),'video downloads failed');
      const savedMedia=await db.media.get(state.jobs[0].result.mediaId),video=document.createElement('video');
      const localUrl=URL.createObjectURL(savedMedia.blob);video.src=localUrl;
      await new Promise((resolve,reject)=>{video.onloadeddata=resolve;video.onerror=()=>reject(new Error('saved video not playable'));video.load();});
      check(video.videoWidth===320&&video.videoHeight===180,'video metadata mismatch');URL.revokeObjectURL(localUrl);
      for(const item of state.items)await batchRuntime.batchUserAction(threadB.id,async()=>{await batches.selectBatchCandidate(batchId,threadB.id,item.id);check((await batches.applyBatchSelections(batchId,threadB.id)).every(row=>row.applied),'video apply failed');});
      check(!(await records.taskGenerationSource(taskB,state.items[0].jobId)).applied,'replaced candidate still current');
      check((await records.taskGenerationSource(taskB,state.items[1].jobId)).applied,'selected candidate not current');
      await records.saveTaskRecord(taskB.id,{kind:'verification',claim:'result',title:'视频核验',body:'两个本地视频可播放，第二份已写入镜头。',sources:[{type:'generation',id:state.items[1].jobId}]});
      await tasks.updateAgentTask(taskB.id,{plan:taskB.plan.map(row=>({...row,status:'completed'}))});
      const summaryB=await wrap.createManualWrapup(taskB.id),videoSource=`generation:${state.items[1].jobId}`;
      check(summaryB.snapshot.evidence.find(row=>row.id===videoSource)?.outcome==='applied','current evidence did not follow slot');
      const savedB=await wrap.saveWrapup(taskB.id,summaryB.id,{...summaryB.content,overview:'视频候选已保存并选用第二份。',results:[{text:'本地视频可播放，第二份已应用',sourceIds:[videoSource]}],acceptance:summaryB.content.acceptance.map(row=>({...row,status:'met',sourceIds:[videoSource]})),unresolved:[]},summaryB.revision);
      const confirmedB=await wrap.confirmWrapup(taskB.id,savedB.id,savedB.revision);
      await tasks.setAgentTaskLifecycle(taskB.id,'completed',{id:confirmedB.id,revision:confirmedB.revision});
      check((await db.agentTasks.get(taskB.id)).lifecycle==='completed','reviewed task B did not complete');
      await tasks.setAgentTaskLifecycle(taskA.id,'archived');
      const archivedSource=await memory.getMemorySourceState(project.id,promoted.id);
      check(archivedSource.state!=='missing','archive lost source');
      const replacement=(await memory.createProjectMemory(project.id,{category:'lesson',inclusion:'project',title:'雨夜角色制作修订',topicKey:'rain-silhouette',body:'CORRECTED_RAIN_RULE：先检查明暗层次，再确认动作。',applicability:'雨夜角色',tags:['雨夜']},{replace:{id:promoted.id,expectedRevision:promoted.revision}})).memory;
      const later=[];
      async function capture(owner,text){
        const thread=await repo.createChatThread({projectId:owner});
        return withThreadRunLock(thread.id,async()=>{
          const run=await runs.beginAgentRun({threadId:thread.id,connector,model:'fixture-model',content:text,interactionMode:'conversation'});
          let payload;await executeChatRun(run,connector.apiKey,new AbortController(),async(_url,init)=>{payload=JSON.parse(init.body);return reply();});return JSON.stringify(payload);
        });
      }
      later.push(await capture(project.id,'雨夜角色构图'));
      check(later[0].includes('CORRECTED_RAIN_RULE')&&!later[0].includes(promoted.body),'superseded memory leaked');
      const other=await repo.createProject('无关项目');
      check(!(await capture(other.id,'雨夜角色')).includes('CORRECTED_RAIN_RULE'),'foreign project inherited memory');
      const disabled=await memory.setProjectMemoryStatus(project.id,replacement.id,'disabled',replacement.revision);
      check(!(await capture(project.id,'雨夜角色')).includes('CORRECTED_RAIN_RULE'),'disabled memory leaked');
      await memory.deleteProjectMemory(project.id,disabled.id,disabled.revision);
      check(!(await capture(project.id,'雨夜角色')).includes('CORRECTED_RAIN_RULE'),'deleted memory leaked');
      return {projectId:project.id,taskA:taskA.id,taskB:taskB.id,threadB:threadB.id,characterId,taskALifecycle:(await db.agentTasks.get(taskA.id)).lifecycle,taskBCreatedByTool:true,memoryInActualRequest:true,sourceAfterArchive:archivedSource.state,supersessionAndScope:true,disabledAndDeletedAbsent:true,requestsForTaskB:requests.length,videoPosts,playableVideo:true,currentGenerationEvidence:true,reviewedTaskBCompleted:true};
    });
    assert.equal(result.taskALifecycle,'archived');assert.equal(result.requestsForTaskB,2);
    assert.deepEqual(errors,[]);
    console.log(JSON.stringify(result,null,2));
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
