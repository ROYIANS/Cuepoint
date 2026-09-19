import { describe, expect, it, vi } from "vitest";
import { db } from "@/db/database";
import { createChatThread, deleteChatThread } from "@/db/repo";
import { beginAgentRun, finishAgentRun } from "@/db/agentRuns";
import { saveToolRound, transitionToolCall } from "@/db/agentTools";
import { saveTaskRecord, listTaskRecords, listTaskRecordVersions } from "@/db/agentTaskRecords";
import { updateAgentTask } from "@/db/agentTasks";
import { TASK_TOOLS } from "@/lib/agent/taskTools";
import { getTaskContext } from "@/lib/agent/taskContext";
import { executeChatRun } from "@/lib/agent/runChat";
import type { ConnectorConfig } from "@/domain/types";
import type { AgentRun } from "@/domain/agent";
import type { TaskRecordInput } from "@/domain/agentTaskRecords";
const connector:ConnectorConfig={id:"cx",name:"test",definitionId:"openai-compatible",baseUrl:"https://example.test/v1",apiKey:"fixture",updatedAt:"2026-09-19"};
const createArgs=(run:AgentRun)=>({title:"建立角色",goal:"创建一位名为小雨的主角",acceptanceCriteria:["工作室中存在小雨角色"],steps:[{id:"create",title:"创建角色",status:"pending"}],sources:[{type:"message",id:run.userMessageId}]});
const recordInput:TaskRecordInput={kind:"approach",claim:"proposal",title:"实施方案",body:"先整理人物设定，再创建角色",sources:[]};
async function start(taskMode=true,interactionMode:"smart"|"conversation"="smart") {
 const thread=await createChatThread({taskMode});
 return beginAgentRun({threadId:thread.id,connector,model:"model",content:"请创建名为小雨的主角",interactionMode});
}
let serial=0;
async function pending(run:AgentRun,name:string,args:unknown){
 const tool=TASK_TOOLS.find((t)=>t.name===name)!;
 await saveToolRound(run.id,"",[{id:`call-${++serial}`,type:"function",function:{name,arguments:JSON.stringify(args)}}],[{title:tool.title,effect:tool.effect,highRisk:false,atomic:true}]);
 const calls=await db.agentToolCalls.where("runId").equals(run.id).toArray();
 const call=calls.find((c)=>c.providerCallId===`call-${serial}`)!;
 await transitionToolCall(run.id,call.id,["pending"],"running");
 const context={runId:run.id,threadId:run.threadId,callId:call.id,signal:new AbortController().signal};
 return {tool,call,context,execute:()=>tool.execute(tool.parseArguments(args),context)};
}
async function invoke(run:AgentRun,name:string,args:unknown){return (await pending(run,name,args)).execute();}
async function create(){const run=await start();await invoke(run,"task_create",createArgs(run));return {run,task:(await db.agentTasks.toArray())[0]};}
describe("AI owned task orchestration",()=>{
 it("persists intake but does not create on send, reload or clarification",async()=>{
  const run=await start();expect(run.taskMode).toBe(true);expect(run.enabledToolNames).toContain("task_create");expect(await db.agentTasks.count()).toBe(0);
  await finishAgentRun(run.id,"completed",{content:"希望什么样的角色？"});db.close();await db.open();
  const next=await beginAgentRun({threadId:run.threadId,connector,model:"model",content:"主人公叫小雨"});
  expect(next.taskMode).toBe(true);expect(await db.agentTasks.count()).toBe(0);expect(next.requestMessages[0].content).toContain("缺少关键要求时先对话澄清");
 });
 it.each([[false,"smart"],[true,"conversation"]] as const)("refuses auto creation outside eligible run %s/%s",async(mode,interaction)=>{
  const run=await start(mode,interaction);expect(run.enabledToolNames).not.toContain("task_create");
  await expect(invoke(run,"task_create",createArgs(run))).rejects.toThrow("权限");expect(await db.agentTasks.count()).toBe(0);
 });
 it("links exactly one task atomically, preserves protocol inputs and reuses different repeated creates",async()=>{
  const run=await start();const original=structuredClone(run.requestMessages);
  const operation=await pending(run,"task_create",createArgs(run));await operation.execute();await operation.execute();
  await invoke(run,"task_create",{...createArgs(run),title:"重复请求"});
  expect(await db.agentTasks.count()).toBe(1);const task=(await db.agentTasks.toArray())[0];
  const saved=(await db.agentRuns.get(run.id))!;expect(saved.taskId).toBe(task.id);expect(saved.requestMessages).toEqual(original);expect(saved.agentSnapshot).toEqual(run.agentSnapshot);
  expect((await db.agentToolCalls.get(operation.call.id))?.status).toBe("completed");expect(task.title).toBe("建立角色");
 });
 it("rolls back task, binding and initial record if ledger persistence fails",async()=>{
  const run=await start(),op=await pending(run,"task_create",createArgs(run));
  const spy=vi.spyOn(db.agentToolCalls,"update").mockRejectedValueOnce(new Error("ledger down"));
  try{await expect(op.execute()).rejects.toThrow("ledger down");}finally{spy.mockRestore();}
  expect(await db.agentTasks.count()).toBe(0);expect(await db.agentTaskRecords.count()).toBe(0);expect((await db.agentRuns.get(run.id))?.taskId).toBeUndefined();
 });
 it("strict schema rejects ownership injection, completed initial Todo and foreign user sources",async()=>{
  const run=await start();expect(()=>TASK_TOOLS.find(t=>t.name==="task_create")!.parseArguments({...createArgs(run),taskId:"foreign"})).toThrow();
  await expect(invoke(run,"task_create",{...createArgs(run),steps:[{id:"x",title:"done",status:"completed"}]})).rejects.toThrow("预先");
  const foreign=await start();await expect(invoke(run,"task_create",{...createArgs(run),sources:[{type:"message",id:foreign.userMessageId}]})).rejects.toThrow("当前对话");
 });
 it("keeps append-only versions, enforces stale edits and deduplicates redelivered records",async()=>{
  const {run,task}=await create();await invoke(run,"task_record_write",recordInput);await invoke(run,"task_record_write",recordInput);
  const record=(await listTaskRecords(task.id)).find(r=>r.title===recordInput.title)!;expect(await listTaskRecordVersions(task.id,record.id)).toHaveLength(1);
  await invoke(run,"task_record_write",{...recordInput,id:record.id,expectedRevision:1,body:"新方案"});
  await expect(invoke(run,"task_record_write",{...recordInput,id:record.id,expectedRevision:1})).rejects.toThrow("已更新");
  expect((await listTaskRecordVersions(task.id,record.id)).map(v=>v.body)).toEqual([recordInput.body,"新方案"]);
 });
 it("requires actual owned evidence and does not launder unknown or bookkeeping into completed result",async()=>{
  const {run}=await create();await expect(invoke(run,"task_record_write",{...recordInput,claim:"result"})).rejects.toThrow("实际业务");
  await expect(invoke(run,"task_record_write",{...recordInput,claim:"decision"})).rejects.toThrow("用户消息");
  const call=(await db.agentToolCalls.where("runId").equals(run.id).toArray())[0];
  await expect(invoke(run,"task_record_write",{...recordInput,claim:"result",sources:[{type:"tool",id:call.id}]})).rejects.toThrow("业务工具");
  await db.agentToolCalls.add({...call,id:"effect",providerCallId:"effect",name:"character_create",effect:"write",status:"unknown"});
  await expect(invoke(run,"task_record_write",{...recordInput,claim:"result",sources:[{type:"tool",id:"effect"}]})).rejects.toThrow("已完成");
  await db.agentToolCalls.update("effect",{status:"completed",result:JSON.stringify({id:"character-real"})});
  await invoke(run,"task_record_write",{...recordInput,claim:"result",sources:[{type:"tool",id:"effect"}]});
 });
 it("manual edits are safe, versioned and reflected only in subsequent snapshots",async()=>{
  const {run,task}=await create();await expect(saveTaskRecord(task.id,recordInput)).rejects.toThrow("当前执行");
  await finishAgentRun(run.id,"completed",{content:"方案完成"});
  const record=await saveTaskRecord(task.id,recordInput);await saveTaskRecord(task.id,{...recordInput,body:"用户纠正后的方案"},{id:record.id,expectedRevision:1});
  await updateAgentTask(task.id,{goal:"改为创建名为小雪的配角",acceptanceCriteria:["配角名字正确"]},1);
  await expect(updateAgentTask(task.id,{goal:"stale"},1)).rejects.toThrow("已更新");
  const next=await beginAgentRun({threadId:run.threadId,connector,model:"model",content:"按修订后的方案执行"});
  expect(next.requestMessages[0].content).toContain("用户纠正后的方案");expect(next.requestMessages[0].content).toContain("小雪");
  expect((await db.agentRuns.get(run.id))?.requestMessages).toEqual(run.requestMessages);
 });
 it("bounds context, rejects foreign record IDs and cascades records/history on deletion",async()=>{
  const {run,task}=await create();for(let i=0;i<12;i++)await invoke(run,"task_record_write",{...recordInput,title:`方案${i}`,body:"长".repeat(12000)});
  const context=await getTaskContext(run.threadId,"system",true);expect(context.instructions.length).toBeLessThan(16000);
  const other=await create();const record=(await listTaskRecords(task.id))[0];
  await expect(invoke(other.run,"task_record_read",{id:record.id})).rejects.toThrow("不属于");
  const late=await pending(run,"task_record_write",recordInput);await deleteChatThread(run.threadId);
  await expect(late.execute()).rejects.toThrow("已删除");expect(await listTaskRecords(task.id)).toHaveLength(0);expect(await db.agentTaskRecordVersions.where("taskId").equals(task.id).count()).toBe(0);
 });

 it("preserves opaque Responses envelopes when task creation binds a running conversation",async()=>{
  const run=await start();await db.agentRuns.update(run.id,{protocol:"responses"});
  const args=createArgs(run),wire={id:"response-call",type:"function" as const,function:{name:"task_create",arguments:JSON.stringify(args)}};
  const opaque=[{type:"reasoning" as const,id:"reason",summary:[],encrypted_content:"opaque-original"},{type:"function_call" as const,call_id:wire.id,name:wire.function.name,arguments:wire.function.arguments}];
  await saveToolRound(run.id,"",[wire],[{title:"建立创作任务",effect:"bookkeeping",highRisk:false,atomic:true}],opaque);
  const call=(await db.agentToolCalls.where("runId").equals(run.id).toArray())[0];await transitionToolCall(run.id,call.id,["pending"],"running");
  const before=(await db.agentRuns.get(run.id))!;
  await TASK_TOOLS.find(t=>t.name==="task_create")!.execute(args,{runId:run.id,threadId:run.threadId,callId:call.id,signal:new AbortController().signal});
  const after=(await db.agentRuns.get(run.id))!;expect(after.responseItems).toEqual(before.responseItems);expect(after.requestMessages).toEqual(before.requestMessages);expect(after.continuationMessages).toEqual(before.continuationMessages);
 });
 it("keeps task tooling with optional skills off and freezes retry eligibility",async()=>{
  const run=await start();await finishAgentRun(run.id,"failed");await db.chatThreads.update(run.threadId,{taskMode:false});
  const retry=await beginAgentRun({threadId:run.threadId,connector,model:"model",retryOfRunId:run.id});expect(retry.taskMode).toBe(true);expect(retry.enabledToolNames).toEqual(run.enabledToolNames);
  await finishAgentRun(retry.id,"completed");await db.agents.update("agent_general",{enabledSkillIds:[]});await db.chatThreads.update(run.threadId,{taskMode:true});
  const next=await beginAgentRun({threadId:run.threadId,connector,model:"model",content:"继续讨论"});expect(next.enabledToolNames).toContain("task_create");expect(next.enabledToolNames).toContain("update_run_plan");expect(next.enabledToolNames).not.toContain("character_create");
 });
 it("rejects task changes on stale revisions and keeps before/after source-backed history",async()=>{
  const {run,task}=await create(),args={title:"新任务名称",goal:"更明确的创作目标",acceptanceCriteria:["验收项"],expectedRevision:1,sources:[{type:"message",id:run.userMessageId}]};
  await invoke(run,"task_update",args);await expect(invoke(run,"task_update",args)).rejects.toThrow("已更新");
  const record=(await listTaskRecords(task.id)).find(r=>r.title==="任务要求调整")!;expect(record.body).toContain(task.goal);expect(record.body).toContain(args.goal);expect(record.sources[0].id).toBe(run.userMessageId);
 });
 it("validates record bounds, Todo references and rolls back a failed version write",async()=>{
  const {run,task}=await create();await expect(invoke(run,"task_record_write",{...recordInput,body:"x".repeat(12001)})).rejects.toThrow();
  await expect(invoke(run,"task_record_write",{...recordInput,todoId:"missing"})).rejects.toThrow("Todo");
  const op=await pending(run,"task_record_write",recordInput),count=await db.agentTaskRecords.count();
  const spy=vi.spyOn(db.agentTaskRecordVersions,"add").mockRejectedValueOnce(new Error("version failure"));try{await expect(op.execute()).rejects.toThrow("version failure");}finally{spy.mockRestore();}
  expect(await db.agentTaskRecords.count()).toBe(count);expect((await db.agentToolCalls.get(op.call.id))?.status).toBe("running");
  await finishAgentRun(run.id,"completed");const record=await saveTaskRecord(task.id,recordInput);await expect(saveTaskRecord(task.id,recordInput,{id:record.id})).rejects.toThrow("已更新");
 });
 it("runs actual model tool loop to bind task and save a proposal without creation approval",async()=>{
  const run=await start();let n=0;const fetcher=vi.fn(async()=>{
   const name=++n===1?"task_create":"task_record_write",args=n===1?createArgs(run):recordInput;
   return Response.json(n<3?{choices:[{message:{content:"",tool_calls:[{id:`wire-${n}`,type:"function",function:{name,arguments:JSON.stringify(args)}}]},finish_reason:"tool_calls"}]}:{choices:[{message:{content:"任务和方案已保存"},finish_reason:"stop"}]});
  });
  await executeChatRun(run,connector.apiKey,new AbortController(),fetcher);
  expect((await db.agentRuns.get(run.id))?.status).toBe("completed");expect(await db.agentTasks.count()).toBe(1);expect(await db.agentTaskRecords.count()).toBe(2);
 });
});
