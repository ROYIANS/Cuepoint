import { createProject as createBoundTestProject } from "@/db/repo";
import { describe,it,expect,vi } from 'vitest';
import {db} from '@/db/database';
import {createAgentTask,updateAgentTask,setAgentTaskLifecycle} from '@/db/agentTasks';
import {createManualWrapup,saveWrapup,confirmWrapup,getTaskWrapupState,startTaskWrapup,cancelTaskWrapup,publishTaskWrapup} from '@/db/agentTaskWrapups';
import {beginAgentRun,finishAgentRun} from '@/db/agentRuns';
import {saveTaskRecord} from '@/db/agentTaskRecords';
import {deleteChatThread,addCharacter} from '@/db/repo';
import {prepareTaskWrapup,recoverTaskWrapups} from '@/lib/agent/taskWrapup';
import type {ThreadLockManager} from '@/lib/agent/runOwnership';
import type {ConnectorConfig} from '@/domain/types';
import type {AgentGenerationJob} from '@/domain/agentGeneration';
import type {AgentToolCall} from '@/domain/agent';
const connector:ConnectorConfig={id:'cx',name:'test',definitionId:'openai-compatible',baseUrl:'https://example.test/v1',apiKey:'secret-fixture',updatedAt:'2026-09-19'};
const locks:ThreadLockManager={async request(_name,_options,callback){return callback({});}};
async function task(criteria=['角色名称准确']){return createAgentTask({projectId:(await createBoundTestProject("测试项目")).id,title:'创作任务',goal:'完成角色创作',acceptanceCriteria:criteria,plan:[]});}
async function confirmed(taskId:string){const wrap=await createManualWrapup(taskId);const saved=await saveWrapup(taskId,wrap.id,{...wrap.content,overview:'用户核实了实际结果',acceptance:wrap.content.acceptance.map(a=>({...a,status:'met'}))},wrap.revision);return confirmWrapup(taskId,saved.id,saved.revision);}
async function evidenceTask(){
 const current=await task();const run=await beginAgentRun({threadId:current.threadId,connector,model:'model',content:'建立名为小雨的角色'});
 const character=await addCharacter(current.projectId);await db.characters.update(character.id,{name:'小雨'});
 const call:AgentToolCall={id:'effect',runId:run.id,threadId:run.threadId,providerCallId:'provider-effect',step:1,order:0,name:'character_create',title:'创建角色',arguments:JSON.stringify({ownerId:current.projectId}),effect:'write',highRisk:false,status:'completed',result:JSON.stringify({kind:'character',id:character.id,ownerId:current.projectId,label:'小雨'}),createdAt:run.createdAt,updatedAt:run.createdAt};
 await db.agentToolCalls.add(call);await finishAgentRun(run.id,'completed',{content:'角色已创建'});return {current,run,character,call};
}
describe('task verification and durable wrapup',()=>{
 it('supports offline manual review, separates save/confirm/complete and cannot bypass review',async()=>{
  const current=await task([]);await expect(setAgentTaskLifecycle(current.id,'completed')).rejects.toThrow('总结');
  const draft=await createManualWrapup(current.id);expect(draft.content.acceptance).toEqual([]);expect(await db.connectors.count()).toBe(0);
  const saved=await saveWrapup(current.id,draft.id,{...draft.content,overview:'人工完成并核实'},draft.revision);
  expect((await db.agentTasks.get(current.id))?.lifecycle).toBe('open');
  const review=await confirmWrapup(current.id,saved.id,saved.revision);expect((await db.agentTasks.get(current.id))?.lifecycle).toBe('open');
  expect(await confirmWrapup(current.id,saved.id,saved.revision)).toEqual(review);
  await setAgentTaskLifecycle(current.id,'completed',{id:review.id,revision:review.revision});expect((await db.agentTasks.get(current.id))?.lifecycle).toBe('completed');
 });
 it('preserves partial summaries but unresolved criteria/work and unfinished Todo block completion',async()=>{
  const current=await task();const draft=await createManualWrapup(current.id);
  const saved=await saveWrapup(current.id,draft.id,{...draft.content,overview:'阶段成果',unresolved:[{text:'视觉效果仍待确认',sourceIds:[]}]},1);
  const review=await confirmWrapup(current.id,saved.id,saved.revision);
  await expect(setAgentTaskLifecycle(current.id,'completed',{id:review.id,revision:review.revision})).rejects.toThrow('验收');
  await updateAgentTask(current.id,{plan:[{id:'next',title:'继续核实',status:'pending'}]});
  const complete=await confirmed(current.id);await expect(setAgentTaskLifecycle(current.id,'completed',{id:complete.id,revision:complete.revision})).rejects.toThrow('未完成');
 });
 it('CAS edits, append-only revisions, confirmed history and reopening invalidation',async()=>{
  const current=await task();const draft=await createManualWrapup(current.id),saved=await saveWrapup(current.id,draft.id,{...draft.content,overview:'新稿'},1);
  await expect(saveWrapup(current.id,draft.id,{...draft.content,overview:'覆盖'},1)).rejects.toThrow('已更新');
  const review=await confirmed(current.id);await expect(saveWrapup(current.id,review.id,review.content,review.revision)).rejects.toThrow('历史');
  await setAgentTaskLifecycle(current.id,'completed',{id:review.id,revision:review.revision});await setAgentTaskLifecycle(current.id,'archived');await setAgentTaskLifecycle(current.id,'open');
  const state=await getTaskWrapupState(current.id);expect(state.stale).toBe(true);expect(state.confirmed?.id).toBe(review.id);expect(state.history.some(r=>r.id===saved.id&&r.revision===1)).toBe(true);
 });
 it('makes goal/records/tool/actual business changes stale, including omitted data',async()=>{
  const {current,character,call}=await evidenceTask();const draft=await createManualWrapup(current.id);
  const source=draft.snapshot.evidence.find(e=>e.id===`entity:character:${character.id}`)!;expect(source.href).toBe(`/p/${current.projectId}/assets/characters/${character.id}`);expect(source.available).toBe(true);
  await db.characters.update(character.id,{name:'人工改名'});expect((await getTaskWrapupState(current.id)).stale).toBe(true);
  await expect(saveWrapup(current.id,draft.id,{...draft.content,overview:'old'},1)).rejects.toThrow('依据');
  const next=await createManualWrapup(current.id);await db.agentToolCalls.update(call.id,{result:JSON.stringify({changed:true})});expect((await getTaskWrapupState(current.id)).stale).toBe(true);
  const fresh=await createManualWrapup(current.id);await saveTaskRecord(current.id,{kind:'question',claim:'proposal',title:'新问题',body:'确认角色年龄',sources:[]});
  await expect(confirmWrapup(current.id,next.id,next.revision)).rejects.toThrow();expect((await getTaskWrapupState(current.id)).stale).toBe(true);expect(fresh.id).not.toBe(next.id);
 });
 it('rejects unsupported source IDs and cannot elevate user prose or unknown outcomes to AI delivery evidence',async()=>{
  const {current,run,call}=await evidenceTask();const record=await startTaskWrapup(current.id,'ai');
  await expect(publishTaskWrapup(record.id,{...record.content,overview:'done',results:[{text:'成果',sourceIds:['fake']}]},new AbortController().signal)).rejects.toThrow('来源');
  await expect(publishTaskWrapup(record.id,{...record.content,overview:'done',results:[{text:'成果',sourceIds:[`message:${run.userMessageId}`]}]},new AbortController().signal)).rejects.toThrow('真实来源');
  await cancelTaskWrapup(current.id,record.id);await db.agentToolCalls.update(call.id,{status:'unknown'});
  const unknown=await startTaskWrapup(current.id,'ai');await expect(publishTaskWrapup(unknown.id,{...unknown.content,overview:'done',results:[{text:'成果',sourceIds:[`tool:${call.id}`]}]},new AbortController().signal)).rejects.toThrow();
 });
 it('strictly freezes acceptance wording and AI met findings remain review proposals',async()=>{
  const {current,call}=await evidenceTask();const record=await startTaskWrapup(current.id,'ai');
  await expect(publishTaskWrapup(record.id,{...record.content,acceptance:[]},new AbortController().signal)).rejects.toThrow('验收');
  const published=await publishTaskWrapup(record.id,{...record.content,overview:'完成',results:[{text:'已创建角色',sourceIds:[`tool:${call.id}`]}],acceptance:record.content.acceptance.map(a=>({...a,status:'met',sourceIds:[`tool:${call.id}`]}))},new AbortController().signal);
  expect(published.content.acceptance[0].status).toBe('review');expect((await db.agentTasks.get(current.id))?.lifecycle).toBe('open');
 });
 it('interlocks preparation with new runs and manual writes and survives reload without retry',async()=>{
  const current=await task(),record=await startTaskWrapup(current.id,'ai');
  await expect(beginAgentRun({threadId:current.threadId,connector,model:'model',content:'继续'})).rejects.toThrow('总结');
  await expect(updateAgentTask(current.id,{goal:'覆盖'})).rejects.toThrow('总结');await expect(createManualWrapup(current.id)).rejects.toThrow('总结');
  await expect(saveTaskRecord(current.id,{kind:'progress',claim:'proposal',title:'记录',body:'正文',sources:[]})).rejects.toThrow('总结');
  db.close();await db.open();await recoverTaskWrapups(current.threadId,{async request(_n,_o,cb){return cb(null);}});expect((await db.agentTaskWrapups.get(record.id))?.status).toBe('preparing');
  await recoverTaskWrapups(current.threadId,locks);expect((await db.agentTaskWrapups.get(record.id))?.status).toBe('interrupted');
  await expect(publishTaskWrapup(record.id,record.content,new AbortController().signal)).rejects.toThrow('停止');
 });
 it('preserves earlier confirmed summary on model error/cancellation, redacts credentials and rejects late deleted results',async()=>{
  const current=await task(),review=await confirmed(current.id);const failing=vi.fn(async()=>new Response(`Bearer secret-fixture ${connector.apiKey}`,{status:400}));
  await expect(prepareTaskWrapup(current.id,connector,'model',new AbortController(),failing,undefined,undefined,locks)).rejects.toThrow('已隐藏');
  const state=await getTaskWrapupState(current.id);expect(state.confirmed?.id).toBe(review.id);expect(state.latest?.error).not.toContain(connector.apiKey);expect(failing).toHaveBeenCalledTimes(1);
  const late=await startTaskWrapup(current.id,'ai');await deleteChatThread(current.threadId);await expect(publishTaskWrapup(late.id,late.content,new AbortController().signal)).rejects.toThrow('删除');expect(await db.agentTaskWrapups.count()).toBe(0);expect(await db.agentTaskWrapupVersions.count()).toBe(0);
 });
 it('uses read-only existing transport with no tools and exactly one explicit POST',async()=>{
  const current=await task();const fetcher=vi.fn(async(_url:RequestInfo|URL,init?:RequestInit)=>{
   const input=JSON.parse(String(init?.body));expect(input.tools).toBeUndefined();expect(input.max_tokens ?? input.max_completion_tokens).toBe(8192);const data=JSON.parse(input.messages[1].content);
   return Response.json({choices:[{message:{content:JSON.stringify({overview:'等待人工验收',results:[],acceptance:data.criteria.map((criterion:string,criterionIndex:number)=>({criterion,criterionIndex,status:'review',note:'请用户检查',sourceIds:[]})),decisions:[],lessons:[],unresolved:[]})},finish_reason:'stop'}]});});
  const record=await prepareTaskWrapup(current.id,connector,'model',new AbortController(),fetcher,undefined,undefined,locks);expect(record.status).toBe('draft');expect(fetcher).toHaveBeenCalledTimes(1);expect(await db.agentRuns.count()).toBe(0);expect(await db.agentToolCalls.count()).toBe(0);expect((await db.agentTasks.get(current.id))?.lifecycle).toBe('open');
 });
 it('enforces latest family drafts, retains invalidated conclusions and reserves real outputs in bounded evidence',async()=>{
  const {current,character,call}=await evidenceTask();const first=await confirmed(current.id);const second=await createManualWrapup(current.id);
  await expect(setAgentTaskLifecycle(current.id,'completed',{id:first.id,revision:first.revision})).rejects.toThrow('最新总结');
  await createManualWrapup(current.id);
  await expect(saveWrapup(current.id,second.id,{...second.content,overview:'更新后的不完整草稿'},second.revision)).rejects.toThrow('新的总结');
  const many=await task(['真实角色已经创建']);const event=await beginAgentRun({threadId:many.threadId,connector,model:'model',content:'补充大量讨论'});await finishAgentRun(event.id,'completed',{content:'x'});
  for(let i=0;i<55;i++)await db.chatMessages.add({id:`m${i}`,threadId:many.threadId,role:'user',content:`讨论 ${i}`,createdAt:new Date(Date.now()+i).toISOString(),status:'complete'});
  const c=await db.agentToolCalls.get(call.id);if(c)await db.agentToolCalls.add({...c,id:'many-effect',runId:event.id,threadId:event.threadId,providerCallId:'many-effect',result:JSON.stringify({kind:'character',id:character.id,ownerId:current.projectId,label:'小雨'})});
  const snap=await createManualWrapup(many.id);expect(snap.snapshot.evidence.some(e=>e.kind==='entity'&&e.id.includes(character.id))).toBe(true);expect(snap.snapshot.coverage.omitted).toBeGreaterThan(0);
 });
 it('retains unresolved concerns and lessons during refresh and moves missing deliveries back to review',async()=>{
  const {current,character}=await evidenceTask();const record=await saveTaskRecord(current.id,{kind:'question',claim:'proposal',title:'风格待确认',body:'需要确认视觉风格',sources:[]});
  const draft=await createManualWrapup(current.id),sourceId=`record:${record.id}`,entityId=`entity:character:${character.id}`;
  await saveWrapup(current.id,draft.id,{...draft.content,overview:'部分完成',results:[{text:'角色已创建',sourceIds:[entityId]}],lessons:[{text:'先确认风格',sourceIds:[sourceId]}],unresolved:[{text:'风格待用户决定',sourceIds:[sourceId]}]},1);
  await db.characters.delete(character.id);const refreshed=await createManualWrapup(current.id);
  expect(refreshed.content.lessons[0].text).toBe('先确认风格');expect(refreshed.content.unresolved.map(x=>x.text)).toContain('风格待用户决定');expect(refreshed.content.unresolved.map(x=>x.text)).toContain('重新核实原成果：角色已创建');expect(refreshed.content.results).toHaveLength(0);
 });
 it('honors local context budget before POST and cancellation before starting',async()=>{
  const current=await task();await updateAgentTask(current.id,{goal:'长资料'.repeat(6000)});await db.chatThreads.update(current.threadId,{contextPolicy:{autoCompress:true,limitHistory:false,historyMessageCount:20,customContextTokens:2048}});
  const fetcher=vi.fn();await expect(prepareTaskWrapup(current.id,connector,'gpt-5.6-luna',new AbortController(),fetcher,undefined,undefined,locks)).rejects.toThrow('预算');expect(fetcher).not.toHaveBeenCalled();
  const aborted=new AbortController();aborted.abort();const count=await db.agentTaskWrapups.count();await expect(prepareTaskWrapup(current.id,connector,'model',aborted,fetcher,undefined,undefined,locks)).rejects.toThrow();expect(await db.agentTaskWrapups.count()).toBe(count);
 });
 it('does not let resolved historical failures permanently prevent completion',async()=>{
  const {current,run,call}=await evidenceTask();await db.agentToolCalls.add({...call,id:'old-failure',providerCallId:'old-failure',status:'failed',result:undefined,error:'旧尝试失败'});
  const review=await confirmed(current.id);await setAgentTaskLifecycle(current.id,'completed',{id:review.id,revision:review.revision});expect((await db.agentTasks.get(current.id))?.lifecycle).toBe('completed');expect((await db.agentRuns.get(run.id))?.status).toBe('completed');
 });
 it('does not certify removed CRUD outputs from historical success, while keeping deletion evidence valid',async()=>{
  const {current,character,call}=await evidenceTask();await db.characters.delete(character.id);
  await db.agentToolCalls.add({...call,id:'delete-effect',providerCallId:'delete-effect',name:'character_delete',title:'删除角色',arguments:JSON.stringify({ownerId:current.projectId,id:character.id}),result:JSON.stringify({deleted:true,id:character.id,kind:'character',ownerId:current.projectId})});
  const draft=await startTaskWrapup(current.id,'ai');const created=draft.snapshot.evidence.find(e=>e.id===`tool:${call.id}`)!;
  expect(created.supportsResult).toBe(false);expect(created.outcome).toBe('unresolved');expect(created.available).toBe(true);
  await expect(publishTaskWrapup(draft.id,{...draft.content,overview:'角色已交付',results:[{text:'角色可用',sourceIds:[`tool:${call.id}`]}]},new AbortController().signal)).rejects.toThrow('真实来源');
  const deletion=draft.snapshot.evidence.find(e=>e.id==='tool:delete-effect')!;expect(deletion.supportsResult).toBe(true);expect(deletion.outcome).toBe('fact');
  const saved=await publishTaskWrapup(draft.id,{...draft.content,overview:'已删除原角色',results:[{text:'已执行角色删除',sourceIds:['tool:delete-effect']}],lessons:[{text:'原角色曾创建，后来删除',sourceIds:[`tool:${call.id}`]}]},new AbortController().signal);
  expect(saved.content.lessons).toHaveLength(1);expect(saved.status).toBe('draft');
 });
 it('distinguishes downloaded output from applied slot and notices deleted target/media',async()=>{
  const {current,run,character}=await evidenceTask();await db.media.add({id:'img',projectId:current.projectId,mimeType:'image/png',filename:'image.png',blob:new Blob(['image']),createdAt:run.createdAt});
  const job:AgentGenerationJob={version:1,id:'job',runId:run.id,threadId:run.threadId,callId:'effect',projectId:current.projectId,connectorId:'cx',provider:'apimart',baseUrl:'https://example.test',model:'gpt-image-2',kind:'image',target:{kind:'character',projectId:current.projectId,entityId:character.id,slot:'concept'},baseRevision:'base',sourceRevisions:[],parameters:{},inputs:[],fingerprint:'fingerprint',status:'downloaded',result:{mediaId:'img',kind:'image'},createdAt:run.createdAt,updatedAt:run.createdAt};
  await db.agentGenerationJobs.add(job);let draft=await createManualWrapup(current.id);expect(draft.snapshot.evidence.find(e=>e.id==='generation:job')?.outcome).toBe('downloaded');
  await db.characters.update(character.id,{slots:{concept:{prompt:'',referenceImageIds:[],referenceVideoIds:[],result:{mediaId:'img',kind:'image'}}}});await db.agentGenerationJobs.update(job.id,{status:'applied'});
  draft=await createManualWrapup(current.id);expect(draft.snapshot.evidence.find(e=>e.id==='generation:job')?.outcome).toBe('applied');
  await db.characters.delete(character.id);const state=await getTaskWrapupState(current.id);expect(state.stale).toBe(true);expect(state.currentEvidence.find(e=>e.id===`entity:character:${character.id}`)?.available).toBe(false);
 });
});
