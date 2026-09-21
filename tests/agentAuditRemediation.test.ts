import { BUSINESS_TOOLS } from "@/lib/agent/businessTools";
import { recoverAbandonedRuns } from "@/lib/agent/runOwnership";
import { describe, expect, it, vi } from 'vitest';
import { db } from '@/db/database';
import { beginAgentRun, finishAgentRun, interruptThreadRuns } from '@/db/agentRuns';
import { createAgentTaskForThread } from '@/db/agentTasks';
import { saveToolRound, transitionToolCall, updateRunPlanAndComplete, AtomicToolRollbackError } from '@/db/agentTools';
import { getReferenceSource, removeProjectReference } from '@/db/references';
import { addCharacter, createChatThread, createProject, putMedia } from '@/db/repo';
import type { ConnectorConfig } from '@/domain/types';
import { BUILTIN_TOOLS, type AgentToolContext } from '@/lib/agent/tools';
import { prepareAgentGeneration, submitAgentGeneration } from '@/lib/agent/generationRuntime';
import type { GenerationSubmitArgs } from '@/lib/agent/generationProfiles';
import { REFERENCE_TOOLS } from '@/lib/agent/referenceTools';
import { executeChatRun, resumeChatRun } from '@/lib/agent/runChat';
import { getProjectContext, refreshRunProjectContext } from '@/lib/agent/projectContext';
import { listModels, testConnection } from '@/lib/ai/openaiCompatible';

const chat: ConnectorConfig = { id: 'audit-chat', definitionId: 'openai-compatible', baseUrl: 'https://audit.test/v1', apiKey: 'audit-secret-only', updatedAt: '2026-09-21' };
async function claim(runId: string, threadId: string, name: string, args: unknown): Promise<AgentToolContext> {
  const providerId = `provider-${name}`;
  await saveToolRound(runId, '', [{ id: providerId, type: 'function', function: { name, arguments: JSON.stringify(args) } }], [{ title: name, effect: name === 'submit_generation' ? 'network' : 'read', highRisk: false }]);
  const call = (await db.agentToolCalls.where('runId').equals(runId).toArray()).find(row => row.providerCallId === providerId)!;
  await transitionToolCall(runId, call.id, ['pending'], 'running');
  return { runId, threadId, callId: call.id, signal: new AbortController().signal };
}

describe('Agent audit boundary regressions', () => {
  it.each(['remove', 'baseUrl', 'provider', 'emptyKey', 'rotateKey', 'input', 'target', 'stop'])('single generation stops before paid POST after upload-time change: %s', async (change) => {
    const project = await createProject('audit generation');
    const asset = await addCharacter(project.id);
    const config: ConnectorConfig = { ...chat, id: 'audit-generation', definitionId: 'apimart', baseUrl: 'https://generation.test/v1' };
    await db.connectors.put(config);
    await putMedia({ id: 'audit-input', projectId: project.id, mimeType: 'image/png', filename: 'reference.png', blob: new Blob(['reference fixture'], { type: 'image/png' }) });
    const thread = await createChatThread({ projectId: project.id });
    const run = await beginAgentRun({ threadId: thread.id, connector: chat, model: 'audit-model', content: 'generate' });
    const args: GenerationSubmitArgs = { connectorId: config.id, model: 'gpt-image-2', target: { kind: 'character', projectId: project.id, entityId: asset.id, slot: 'front' }, prompt: 'audit', parameters: {}, inputs: [{ mediaId: 'audit-input', role: 'reference-image' }] };
    const context = await claim(run.id, thread.id, 'submit_generation', args);
    context.preview = await prepareAgentGeneration(args, context);
    let paidPosts = 0;
    const fetchImpl = vi.fn<typeof fetch>(async (url, init) => {
      if (String(url).includes('/uploads/')) {
        if (change === 'remove') await db.connectors.delete(config.id);
        else if (change === 'baseUrl') await db.connectors.update(config.id, {baseUrl:'https://changed.test/v1'});
        else if (change === 'provider') await db.connectors.update(config.id, {definitionId:'aihubmix'});
        else if (change === 'emptyKey') await db.connectors.update(config.id, {apiKey:' '});
        else if (change === 'rotateKey') await db.connectors.update(config.id, {apiKey:'rotated-secret'});
        else if (change === 'input') await db.media.delete('audit-input');
        else if (change === 'target') await db.characters.update(asset.id, {name:'changed target'});
        else await finishAgentRun(run.id, 'interrupted');
        return Response.json({ url: 'https://cdn.test/upload.png' });
      }
      if (init?.method === 'POST') { paidPosts++; return Response.json({ code: 200, data: [{ task_id: 'paid-after-delete' }] }); }
      throw new Error('fixture: no polling expected after connector deletion');
    });
    await submitAgentGeneration(args, context, { fetchImpl, maxPolls: 1 }).catch(() => undefined);
    expect(fetchImpl.mock.calls.some(([url]) => String(url).includes('/uploads/'))).toBe(true);
    expect(paidPosts).toBe(0);
    expect(await db.agentGenerationJobs.where('callId').equals(context.callId).first()).toMatchObject({status:'failed'});
  });

  it.each((["chat", "responses"] as const).flatMap(protocol => (["detail", "index", "nested"] as const).flatMap(lookup => (["withdrawn", "revised", "foreign"] as const).map(state => ({protocol,lookup,state})))))('task_read blocks cached source body: $protocol / $lookup / $state', async ({protocol,lookup,state}) => {
    const project = await createProject('audit references');
    const thread = await createChatThread({ projectId: project.id });
    await createAgentTaskForThread(thread.id, { title: 'audit task', goal: 'review references' });
    const marker = 'WITHDRAWN_SOURCE_SENTINEL_AUDIT';
    const blob = new Blob([marker], { type: 'text/plain' });
    await putMedia({ id: 'audit-document', projectId: project.id, filename: 'audit.txt', mimeType: 'text/plain', blob });
    const reference = { referenceId: 'audit-reference', revision: 1 };
    await db.projectReferences.add({ id: reference.referenceId, projectId: project.id, mediaId: 'audit-document', digest: 'fixture-digest', kind: 'text', filename: 'audit.txt', mimeType: 'text/plain', size: blob.size, revision: 1, status: 'ready', operationId: 'fixture', coverage: { totalUnits: 1, processedUnits: 1, emptyUnits: [], characters: marker.length, truncated: false }, warnings: [], createdAt: '2026-09-21', updatedAt: '2026-09-21' });
    await db.referenceChunks.add({ id: 'audit-chunk', projectId: project.id, referenceId: reference.referenceId, revision: 1, index: 0, text: marker, locator: { kind: 'lines', start: 1, end: 1 } });
    const first = await beginAgentRun({ threadId: thread.id, connector: chat, model: 'audit-model', content: 'read source' });
    const context = await claim(first.id, thread.id, 'project_reference_read', reference);
    const value = await REFERENCE_TOOLS.find(tool => tool.name === 'project_reference_read')!.execute(reference, context);
    await transitionToolCall(first.id, context.callId, ['running'], 'completed', { result: JSON.stringify(value) });
    await finishAgentRun(first.id, 'completed', { content: 'Reference inspected.' });
    if (state === "withdrawn") await removeProjectReference(project.id, reference.referenceId);
    else if (state === "revised") await db.projectReferences.update(reference.referenceId, {revision:2});
    else await db.projectReferences.update(reference.referenceId, {projectId:(await createProject("foreign")).id});
    await expect(getReferenceSource(project.id, reference)).rejects.toThrow();
    let sourceId = context.callId;
    if (lookup === "nested") {
      const original = (await db.agentToolCalls.get(context.callId))!;
      sourceId = "legacy-history-call";
      await db.agentToolCalls.add({...original,id:sourceId,providerCallId:"legacy-history",name:"project_history_read",result:JSON.stringify({content:JSON.stringify(value),nested:{result:value}})});
    }
    const next = await beginAgentRun({ threadId: thread.id, connector: chat, model: protocol === "responses" ? "gpt-5.6-luna" : 'audit-model', content: 'inspect task sources; authored statement preserved' });
    expect(next.protocol === "responses").toBe(protocol === "responses");
    const requests: string[] = [];
    const fetchImpl = vi.fn<typeof fetch>(async (_url, init) => {
      requests.push(String(init?.body));
      const args = JSON.stringify(lookup === "index" ? {} : {source:{type:"tool",id:sourceId}});
      if (protocol === "responses") return Response.json({id:"fixture-response",status:"completed",output:requests.length === 1 ? [{type:"function_call",id:"fc-task",call_id:"task-read",name:"task_read",arguments:args,status:"completed"}] : [{type:"message",id:"msg-done",role:"assistant",status:"completed",content:[{type:"output_text",text:"done",annotations:[]}]}]});
      if (requests.length === 1) return Response.json({ choices: [{ message: { content: '', tool_calls: [{ id: 'task-read', type: 'function', function: { name: 'task_read', arguments: args } }] }, finish_reason: 'tool_calls' }] });
      return Response.json({ choices: [{ message: { content: 'done' }, finish_reason: 'stop' }] });
    });
    await executeChatRun(next, chat.apiKey, new AbortController(), fetchImpl);
    expect(requests).toHaveLength(2);
    expect(requests[0]).not.toContain(marker);
    expect(requests[1].includes(marker)).toBe(false);
    expect(requests[1]).toContain('authored statement preserved');
    expect(requests[1]).toContain(lookup === 'nested' ? 'historical_source_lookup' : 'historical_reference_read');
  });

  it('project context should preserve the selected Image Ext version', async () => {
    const project = await createProject('audit image defaults');
    await db.projects.update(project.id, { generationDefaults: { image: { provider: 'apimart', profileVersion: '2026-09-18', model: 'gpt-image-2.5-ext', size: '16:9', resolution: '2k', version: 'sunburst' } } });
    const context = await getProjectContext(project.id);
    expect(JSON.parse(context.content).generationDefaults.image.version).toBe('sunburst');
  });

  it.each([listModels, testConnection])('generic connector errors must redact echoed API keys (%#)', async (probe) => {
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response(`Invalid API key: ${chat.apiKey}`, { status: 401 }));
    const result = await probe(chat, fetchImpl);
    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).not.toContain(chat.apiKey);
  });

  it('a crashed atomic update_run_plan claim should remain safely resumable', async () => {
    const thread = await createChatThread();
    const run = await beginAgentRun({ threadId: thread.id, connector: chat, model: 'audit-model', content: 'plan' });
    const tool = BUILTIN_TOOLS.find(item => item.name === 'update_run_plan')!;
    const args = { steps: [{ id: 'step', title: 'Work', status: 'in_progress' }] };
    await saveToolRound(run.id, '', [{ id: 'plan-call', type: 'function', function: { name: tool.name, arguments: JSON.stringify(args) } }], [{ title: tool.title, effect: tool.effect, highRisk: tool.highRisk(args), atomic: tool.atomic, recovery: tool.recovery }]);
    const call = (await db.agentToolCalls.where('runId').equals(run.id).toArray())[0];
    await transitionToolCall(run.id, call.id, ['pending'], 'running');
    // Simulate reload between claim and the atomic mutation/result transaction.
    db.close(); await db.open();
    await interruptThreadRuns(thread.id);
    expect((await db.agentRuns.get(run.id))?.plan).toBeUndefined();
    expect((await db.agentToolCalls.get(call.id))?.status).toBe('pending');
  });
});

const planArgs = {steps:[{id:"work",title:"Work",status:"in_progress" as const}]};
async function oldPlanFixture() {
  const project = await createProject("Legacy plans");
  const thread = await createChatThread({projectId:project.id});
  const task = await createAgentTaskForThread(thread.id,{title:"Task",goal:"Plan safely"});
  const run = await beginAgentRun({threadId:thread.id,connector:chat,model:"audit-model",content:"plan"});
  await saveToolRound(run.id,"",[{id:"old-plan",type:"function",function:{name:"update_run_plan",arguments:JSON.stringify(planArgs)}}],[{title:"更新执行计划",effect:"bookkeeping",highRisk:false}]);
  const call = (await db.agentToolCalls.where("runId").equals(run.id).first())!;
  return {run,call,task,thread};
}
it.each(["pending", "running", "unknown", "completed"] as const)("legacy plan %s survives recovery and executes once", async (status) => {
  const {run,call,task} = await oldPlanFixture();
  if (status !== "pending") await transitionToolCall(run.id,call.id,["pending"],"running");
  if (status === "unknown") {
    await db.agentToolCalls.update(call.id,{status:"unknown",error:"old ambiguous classification"});
    await finishAgentRun(run.id,"interrupted");
  }
  if (status === "completed") await updateRunPlanAndComplete(run.id,call.id,planArgs.steps);
  db.close(); await db.open();
  await recoverAbandonedRuns({request:async(_name,_options,callback)=>callback({})});
  expect(await db.agentToolCalls.get(call.id)).toMatchObject({status:status === "completed" ? "completed" : "pending"});
  const completed = BUILTIN_TOOLS.find(tool=>tool.name === "update_run_plan")!;
  const execute = vi.fn(completed.execute);
  await resumeChatRun(run.id,chat.apiKey,new AbortController(),vi.fn(async()=>Response.json({choices:[{message:{content:"done"},finish_reason:"stop"}]})),BUILTIN_TOOLS.map(tool=>tool.name === completed.name ? {...tool,execute} : tool));
  expect(execute).toHaveBeenCalledTimes(status === "completed" ? 0 : 1);
  expect(await db.agentTasks.get(task.id)).toMatchObject({plan:planArgs.steps});
  expect(await db.agentTaskRecords.where("taskId").equals(task.id).filter(record=>record.title === "Todo 更新").count()).toBe(1);
});
it("plan ledger failure rolls back plan and task records before safe recovery", async () => {
  const {run,call,task,thread} = await oldPlanFixture();
  await db.agentToolCalls.update(call.id,{status:"running",atomic:true});
  const update = db.agentToolCalls.update.bind(db.agentToolCalls);
  const failure = vi.spyOn(db.agentToolCalls,"update").mockImplementation((id,changes)=>{
    if (typeof changes === "object" && changes.status === "completed") return Promise.reject(new Error("ledger disk failure")) as ReturnType<typeof update>;
    return update(id,changes);
  });
  try { await expect(updateRunPlanAndComplete(run.id,call.id,planArgs.steps)).rejects.toBeInstanceOf(AtomicToolRollbackError); }
  finally { failure.mockRestore(); }
  expect((await db.agentRuns.get(run.id))?.plan).toEqual([]);
  expect(await db.agentTaskRecords.where("taskId").equals(task.id).filter(record=>record.title === "Todo 更新").count()).toBe(0);
  await interruptThreadRuns(thread.id);
  expect(await db.agentToolCalls.get(call.id)).toMatchObject({status:"pending"});
});
it("legacy repair cannot make unknown external effects repeatable", async () => {
  const {run,call,thread} = await oldPlanFixture();
  await db.agentToolCalls.update(call.id,{name:"submit_generation",effect:"network",status:"unknown"});
  await finishAgentRun(run.id,"interrupted");
  await interruptThreadRuns(thread.id);
  expect(await db.agentToolCalls.get(call.id)).toMatchObject({status:"unknown"});
  await expect(resumeChatRun(run.id,chat.apiKey,new AbortController(),vi.fn())).rejects.toThrow("不确定");
});

it.each([listModels,testConnection])("connector diagnostics redact raw, bearer and boundary secrets before truncation (%#)", async probe=>{
  const credential = {...chat,apiKey:`  ${chat.apiKey}  `};
  for (const failure of [
    async()=>new Response(`Invalid ${chat.apiKey} / ${chat.apiKey}; Bearer other-secret`,{status:401}),
    async()=>new Response(`${"x".repeat(190)}${chat.apiKey}`,{status:403}),
    async()=>{throw new Error(`Network ${chat.apiKey}; Bearer other-secret`);},
    async()=>{throw new TypeError(`Network ${chat.apiKey}; Bearer other-secret`);},
  ]) {
    const result = await probe(credential,vi.fn(failure));
    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).not.toContain(chat.apiKey);
    expect(JSON.stringify(result)).not.toContain("other-secret");
    expect(JSON.stringify(result)).not.toContain("audit-secret");
  }
});
it("connection chat fallback also redacts returned provider errors", async()=>{
  let requests=0;
  const result = await testConnection(chat,vi.fn(async()=>++requests===1?new Response("missing",{status:404}):new Response(`Invalid ${chat.apiKey}`,{status:401})));
  expect(requests).toBe(2);expect(result.ok).toBe(false);expect(JSON.stringify(result)).not.toContain(chat.apiKey);
});

it("image quality/version are visible in detail, text reads and incremental context", async()=>{
  const project=await createProject("Image defaults"),thread=await createChatThread({projectId:project.id});
  const run=await beginAgentRun({threadId:thread.id,connector:chat,model:"audit-model",content:"defaults"});
  const image={provider:"apimart" as const,profileVersion:"2026-09-18",model:"gpt-image-2.5-ext" as const,size:"16:9",resolution:"2k",quality:"high" as const,version:"sunburst" as const};
  await db.projects.update(project.id,{generationDefaults:{image}});
  const detail=BUSINESS_TOOLS.find(tool=>tool.name==="business_detail")!;
  const detailContext=await claim(run.id,thread.id,detail.name,{kind:"project",id:project.id});
  expect(JSON.stringify(await detail.execute({kind:"project",id:project.id},detailContext))).toContain('"quality":"high"');
  await transitionToolCall(run.id,detailContext.callId,["running"],"completed",{result:"{}"});
  const read=BUSINESS_TOOLS.find(tool=>tool.name==="business_read_text")!;
  const readContext=await claim(run.id,thread.id,read.name,{kind:"project",id:project.id,field:"generationDefaults.image.version"});
  expect(JSON.stringify(await read.execute({kind:"project",id:project.id,field:"generationDefaults.image.version"},readContext))).toContain("sunburst");
  await transitionToolCall(run.id,readContext.callId,["running"],"completed",{result:"{}"});
  const refreshed=await refreshRunProjectContext(run.id);
  expect(refreshed.continuationMessages?.at(-1)?.content).toContain('"quality":"high"');
  expect(refreshed.continuationMessages?.at(-1)?.content).toContain('"version":"sunburst"');
});
