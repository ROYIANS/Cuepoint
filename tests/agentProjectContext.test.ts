import { describe, expect, it, vi } from 'vitest';
import { db } from '@/db/database';
import * as repo from '@/db/repo';
import { beginAgentRun, finishAgentRun } from '@/db/agentRuns';
import { prepareRunContext } from '@/lib/agent/contextCompaction';
import { updateContextPolicy } from '@/db/contextSettings';
import { createManualWrapup, getTaskWrapupState } from '@/db/agentTaskWrapups';
import { createAgentTask } from '@/db/agentTasks';
import { startModelStep } from '@/db/agentTools';
import { getProjectContext, refreshRunProjectContext } from '@/lib/agent/projectContext';
import { BUSINESS_TOOLS } from '@/lib/agent/businessTools';
import { prepareAgentGeneration, applyAgentGeneration } from '@/lib/agent/generationRuntime';
import type { AgentToolContext } from '@/lib/agent/tools';
import type { AgentRun } from '@/domain/agent';
import type { ConnectorConfig } from '@/domain/types';
import { createId } from '@/lib/ids';
const connector:ConnectorConfig={id:'cx',definitionId:'openai-compatible',baseUrl:'https://example.test/v1',apiKey:'fixture',updatedAt:'2026-09-19'};
async function begin(projectId?:string,taskMode=false){const thread=await repo.createChatThread({projectId,taskMode});return beginAgentRun({threadId:thread.id,connector,model:'model',content:'创作项目'});}
function context(run:AgentRun):AgentToolContext{return {runId:run.id,threadId:run.threadId,callId:createId('call'),signal:new AbortController().signal};}
function tool(name:string){return BUSINESS_TOOLS.find(t=>t.name===name)!;}
async function prepare(run:AgentRun,name:string,args:unknown){const def=tool(name),ctx=context(run),parsed=def.parseArguments(args);ctx.preview=await def.prepare?.(parsed,ctx);await db.agentToolCalls.add({id:ctx.callId,runId:run.id,threadId:run.threadId,providerCallId:ctx.callId,step:1,order:0,name,title:def.title,arguments:JSON.stringify(args),effect:def.effect,highRisk:false,atomic:true,status:'running',createdAt:'2026-09-19',updatedAt:'2026-09-19'});return ()=>def.execute(parsed,ctx);}
describe('project-bound execution and factual context',()=>{
 it('projects only whitelisted facts and preserves individual world rules despite a long worldview',async()=>{
  const project=await repo.createProject('A');await db.projects.update(project.id,{setting:{worldview:'x'.repeat(5000),background:'背景',rules:'不能飞行'},generationDefaults:{extra:{secret:'SECRET_ROOT'},image:{provider:'apimart',model:'gpt-image-2',extra:{secret:'SECRET_IMAGE'}}} as never});
  const snapshot=await getProjectContext(project.id);expect(snapshot.content).not.toContain('SECRET');expect(snapshot.content).toContain('不能飞行');expect(snapshot.content).toContain('背景');expect(snapshot.content).toContain('gpt-image-2');expect(snapshot.coverage.truncated).toBe(true);
 });
 it('omits unchanged snapshot content and appends only changed project fields or index entries',async()=>{
  const project=await repo.createProject('A'),character=await repo.addCharacter(project.id);await db.projects.update(project.id,{brief:'UNCHANGED_LONG_BRIEF'.repeat(30)});
  const run=await begin(project.id);await db.characters.update(character.id,{notes:'detail only changes fingerprint'});
  const silent=await refreshRunProjectContext(run.id);expect(silent.projectContext?.fingerprint).not.toBe(run.projectContext?.fingerprint);expect(silent.continuationMessages).toEqual(run.continuationMessages);
  await db.characters.update(character.id,{name:'新人物名'});const changed=await refreshRunProjectContext(run.id);const patch=changed.continuationMessages!.at(-1)!.content;
  expect(patch).toContain('新人物名');expect(patch).not.toContain('UNCHANGED_LONG_BRIEF');expect(patch).toContain('upsert');expect(changed.requestMessages).toEqual(run.requestMessages);
 });
 it('does not activate or issue another compression request when its project is deleted during the response',async()=>{
  const project=await repo.createProject('A'),thread=await repo.createChatThread({projectId:project.id});
  await updateContextPolicy(thread.id,{autoCompress:true,limitHistory:false,historyMessageCount:20,customContextTokens:4096});
  await db.chatMessages.bulkAdd(Array.from({length:8},(_,i)=>({id:`m${i}`,threadId:thread.id,role:i%2?'assistant' as const:'user' as const,content:'x'.repeat(900),status:'complete' as const,createdAt:new Date(1000+i).toISOString()})));
  const run=await beginAgentRun({threadId:thread.id,connector,model:'unknown',content:'继续',interactionMode:'conversation'});
  const fetcher=vi.fn(async()=>{await repo.deleteProject(project.id);return Response.json({choices:[{message:{content:'简明摘要'},finish_reason:'stop'}]});});
  await expect(prepareRunContext(run.id,[],connector.apiKey,new AbortController().signal,fetcher)).rejects.toThrow('项目');
  expect(fetcher).toHaveBeenCalledTimes(1);expect((await db.contextCompactions.toArray()).every(r=>r.status==='failed')).toBe(true);expect((await db.agentRuns.get(run.id))?.context?.summaryId).toBeUndefined();expect((await db.agentRuns.get(run.id))?.requestMessages).toEqual(run.requestMessages);
 });
 it('requires project for task intake and manual tasks, while ordinary projectless conversation is intentional',async()=>{
  const thread=await repo.createChatThread({taskMode:true});
  await expect(beginAgentRun({threadId:thread.id,connector,model:'model',content:'任务'})).rejects.toThrow('项目');
  expect(await db.chatMessages.count()).toBe(0);
  await expect(createAgentTask({title:'任务',goal:'目标'})).rejects.toThrow('项目');
  expect((await begin()).projectId).toBeUndefined();
  const p=await repo.createProject('项目');const task=await createAgentTask({projectId:p.id,title:'任务',goal:'目标'});
  expect(task.projectId).toBe(p.id);expect((await db.chatThreads.get(task.threadId))?.projectId).toBe(p.id);
 });
 it('invalidates review eligibility when current project facts change while preserving the saved review',async()=>{
  const project=await repo.createProject('A'),task=await createAgentTask({projectId:project.id,title:'任务',goal:'目标'});
  const draft=await createManualWrapup(task.id);await db.projects.update(project.id,{brief:'修改的需求'});
  const state=await getTaskWrapupState(task.id);expect(state.stale).toBe(true);expect(state.latest?.id).toBe(draft.id);
 });
 it('binds only empty conversations with CAS and never silently reassigns existing project or execution',async()=>{
  const a=await repo.createProject('A'),b=await repo.createProject('B'),thread=await repo.createChatThread();
  await repo.bindChatThreadProject(thread.id,a.id);
  await expect(repo.bindChatThreadProject(thread.id,b.id)).rejects.toThrow('已变化');
  await expect(repo.bindChatThreadProject(thread.id,b.id,a.id)).rejects.toThrow('新建');
  const run=await begin();await expect(repo.bindChatThreadProject(run.threadId,a.id)).rejects.toThrow('新建');
 });
 it('injects bounded current project facts into a new run without foreign assets or full scripts',async()=>{
  const p=await repo.createProject('A'),foreign=await repo.createProject('B');
  await db.projects.update(p.id,{brief:'项目简报',setting:{rules:'必须遵守的世界规则'}});
  const episode=(await db.episodes.where('projectId').equals(p.id).toArray())[0];await db.episodes.update(episode.id,{script:'FULL_PRIVATE_SCRIPT'});
  for(let i=0;i<43;i++)await repo.addCharacter(p.id);
  const other=await repo.addCharacter(foreign.id);await db.characters.update(other.id,{name:'FOREIGN_SECRET'});
  const snapshot=await getProjectContext(p.id);expect(snapshot.coverage.assets).toEqual({total:43,included:40});expect(snapshot.coverage.truncated).toBe(true);
  expect(snapshot.content).toContain('项目简报');expect(snapshot.content).not.toContain('FULL_PRIVATE_SCRIPT');expect(snapshot.content).not.toContain('FOREIGN_SECRET');
  const run=await begin(p.id);expect(run.projectId).toBe(p.id);expect(run.projectContext?.fingerprint).toBe(snapshot.fingerprint);expect(run.requestMessages[0].content).toContain('项目简报');
  expect((await begin(p.id)).projectContext?.fingerprint).toBe(snapshot.fingerprint);
 });
 it.each(['chat-completions','responses'] as const)('appends safe fresh facts for %s without replacing original requests or prior envelopes',async(protocol)=>{
  const p=await repo.createProject('A'),run=await begin(p.id);await db.agentRuns.update(run.id,{protocol});
  const before=(await db.agentRuns.get(run.id))!;await db.projects.update(p.id,{brief:'另一个标签页的新简报'});
  const fresh=await refreshRunProjectContext(run.id);expect(fresh.requestMessages).toEqual(before.requestMessages);expect(fresh.agentSnapshot).toEqual(before.agentSnapshot);
  expect(fresh.continuationMessages?.at(-1)?.content).toContain('另一个标签页的新简报');
  expect((await refreshRunProjectContext(run.id)).continuationMessages).toEqual(fresh.continuationMessages);
  if(protocol==='responses'){expect(fresh.responseItems?.at(-1)).toMatchObject({role:'user'});const prefix=fresh.responseItems!;await db.projects.update(p.id,{brief:'第三版'});expect((await refreshRunProjectContext(run.id)).responseItems?.slice(0,prefix.length)).toEqual(prefix);}
 });
 it('rejects foreign reads/writes, studio writes and forged context; allows read and independent explicit studio copy',async()=>{
  const p=await repo.createProject('A'),b=await repo.createProject('B'),run=await begin(p.id),ctx=context(run);
  const studio=await repo.addCharacter('studio');await db.characters.update(studio.id,{name:'原始人物'});
  const read=tool('business_detail');await expect(read.execute(read.parseArguments({kind:'project',id:b.id}),ctx)).rejects.toThrow('绑定项目');
  await expect(tool('character_create').prepare!({ownerId:b.id,fields:{name:'bad'}},ctx)).rejects.toThrow('绑定项目');
  await expect(tool('character_update').prepare!({ownerId:'studio',id:studio.id,patch:{name:'bad'}},ctx)).rejects.toThrow('原始资料');
  await expect(tool('project_create').prepare!({name:'bad'},ctx)).rejects.toThrow('不能创建');
  await expect(read.execute(read.parseArguments({kind:'project',id:p.id}),{...ctx,projectId:b.id})).rejects.toThrow('归属');
  expect(await read.execute(read.parseArguments({kind:'character',ownerId:'studio',id:studio.id}),ctx)).toBeTruthy();
  const copy=await (await prepare(run,'asset_copy_from_studio',{kind:'character',sourceId:studio.id,ownerId:p.id}))() as {id:string};
  expect(copy.id).not.toBe(studio.id);expect((await db.characters.get(copy.id))?.projectId).toBe(p.id);expect((await db.characters.get(studio.id))?.name).toBe('原始人物');
 });
 it('rechecks frozen scope inside atomic execution even when a preview exists',async()=>{
  const p=await repo.createProject('A'),b=await repo.createProject('B'),run=await begin(p.id);
  const execute=await prepare(run,'character_create',{ownerId:p.id,fields:{name:'never created'}});
  await db.chatThreads.update(run.threadId,{projectId:b.id});await expect(execute()).rejects.toThrow('归属');expect(await db.characters.count()).toBe(0);
 });
 it('rejects foreign generation preparation before connector access and foreign existing job apply',async()=>{
  const p=await repo.createProject('A'),b=await repo.createProject('B'),run=await begin(p.id),ctx=context(run);
  await expect(prepareAgentGeneration({connectorId:'missing',model:'gpt-image-2',prompt:'image',target:{kind:'character',projectId:b.id,entityId:'foreign',slot:'front'},parameters:{},inputs:[]},ctx)).rejects.toThrow('绑定项目');
  await db.agentGenerationJobs.add({id:'foreign-job',runId:run.id,threadId:run.threadId,projectId:b.id} as never);
  await expect(applyAgentGeneration('foreign-job',ctx)).rejects.toThrow('绑定项目');
 });
 it('preserves history after project deletion but blocks new requests, model steps, refresh and tools',async()=>{
  const p=await repo.createProject('A'),task=await createAgentTask({projectId:p.id,title:'任务',goal:'目标'});
  const run=await beginAgentRun({threadId:task.threadId,connector,model:'model',content:'开始'});await repo.deleteProject(p.id);
  expect(await db.agentTasks.get(task.id)).toBeDefined();expect(await db.chatThreads.get(run.threadId)).toBeDefined();expect(await db.agentRuns.get(run.id)).toBeDefined();
  await expect(refreshRunProjectContext(run.id)).rejects.toThrow('项目');await expect(startModelStep(run.id,64)).rejects.toThrow('项目');
  await expect(tool('character_create').prepare!({ownerId:p.id,fields:{}},context(run))).rejects.toThrow('项目');
  await finishAgentRun(run.id,'failed',{content:'项目已删除'});
  await expect(beginAgentRun({threadId:run.threadId,connector,model:'model',content:'继续'})).rejects.toThrow('项目');
 });
});
