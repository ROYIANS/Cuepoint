import { saveFixtureToolRound } from "./helpers/toolDispatch";
import { createProject as createBoundTestProject } from "@/db/repo";
import { describe, expect, it } from "vitest";
import { TASK_TOOLS } from "@/lib/agent/taskTools";
import { db } from "@/db/database";
import { createAgentTask, updateAgentTask } from "@/db/agentTasks";
import { beginAgentRun, finishAgentRun } from "@/db/agentRuns";
import {  transitionToolCall, updateRunPlanAndComplete } from "@/db/agentTools";
import { validateTaskSources } from "@/db/agentTaskRecords";
import type { ConnectorConfig } from "@/domain/types";
const connector:ConnectorConfig={id:"fixture",name:"Fixture",definitionId:"openai-compatible",baseUrl:"https://example.test/v1",apiKey:"fake",updatedAt:"now"};
async function fixture(){
 const task=await createAgentTask({projectId:(await createBoundTestProject("测试项目")).id,title:"任务",goal:"制作可验证的角色图片"});
 const run=await beginAgentRun({threadId:task.threadId,connector,model:"fixture",content:"继续"});
 return {task,run};
}
async function effect(runId:string,name:string,effect:"write"|"network",result:unknown){
 await saveFixtureToolRound(runId,"",[{id:name,type:"function",function:{name,arguments:"{}"}}],[{title:name,effect,highRisk:false}]);
 const call=(await db.agentToolCalls.where("runId").equals(runId).toArray()).find(call=>call.providerCallId===name)!;
 await db.agentToolCalls.update(call.id,{status:"completed",result:JSON.stringify(result)});
 return [{type:"tool" as const,id:call.id}];
}
describe("task orchestration independent boundaries",()=>{
 it.each([
  ["submit_generation","network",{status:"failed",error:"provider failed"}],
  ["apply_generation","write",{status:"conflict",applied:false,result:{mediaId:"kept",kind:"image"}}],
  ["check_generation","network",{status:"running",progress:80}],
 ] as const)("does not certify %s unsuccessful output as a completed result",async(name,kind,result)=>{
  const {task,run}=await fixture();const sources=await effect(run.id,name,kind,result);
  await expect(validateTaskSources(task,sources,"result","ai")).rejects.toThrow("实际业务");
  await expect(validateTaskSources(task,sources,"observation","ai")).resolves.toBeUndefined();
 });
 it.each(["downloaded","applied"])("accepts the actual %s generation stage as evidence without requiring another submission",async(status)=>{
  const {task,run}=await fixture();const sources=await effect(run.id,"submit_generation","network",{status,applied:status==="applied",result:{mediaId:"actual",kind:"image"}});
  await expect(validateTaskSources(task,sources,"result","ai")).resolves.toBeUndefined();
 });
 it("pages full owned source text, rejects foreign sources and bounds artifact previews",async()=>{
  const {task,run}=await fixture();
  const body="前".repeat(6000)+"后".repeat(6000);
  await db.chatMessages.update(run.userMessageId,{content:body});
  const source=await effect(run.id,"business_detail","write",{body});
  const foreign=await fixture();
  const tool=TASK_TOOLS.find(tool=>tool.name==="task_read")!;let serial=0;
  const read=async(args:unknown)=>{
    const id=`read-${++serial}`;
    await saveFixtureToolRound(run.id,"",[{id,type:"function",function:{name:tool.name,arguments:JSON.stringify(args)}}],[{title:tool.title,effect:tool.effect,highRisk:false,atomic:true}]);
    const call=(await db.agentToolCalls.where("runId").equals(run.id).toArray()).find(call=>call.providerCallId===id)!;
    await transitionToolCall(run.id,call.id,["pending"],"running");
    return tool.execute(tool.parseArguments(args),{runId:run.id,threadId:run.threadId,callId:call.id,signal:new AbortController().signal});
  };
  expect(await read({source:{type:"message",id:run.userMessageId},contentOffset:6000,contentLimit:6000})).toMatchObject({content:"后".repeat(6000),totalLength:12000,nextOffset:null});
  expect(await read({source:source[0],contentOffset:6000,contentLimit:10})).toMatchObject({content:JSON.stringify({body}).slice(6000,6010),nextOffset:6010});
  await expect(read({source:{type:"message",id:foreign.run.userMessageId}})).rejects.toThrow("来源不是");
  await expect(read({source:{type:"tool",id:(await db.agentToolCalls.where("[runId+providerCallId]").equals([run.id, "read-1"]).first())!.id}})).rejects.toThrow("来源不是");
  expect(()=>tool.parseArguments({source:source[0],contentLimit:6001})).toThrow();
  const artifacts=Array.from({length:1000},(_,index)=>({id:`artifact-${index}`,runId:run.id,messageId:run.assistantMessageId,createdAt:"now"}));
  await db.agentTasks.update(task.id,{artifacts});
  const result=await read({}) as {task:{artifacts:unknown[];artifactCount:number}};
  expect(result.task.artifacts).toHaveLength(10);expect(result.task.artifactCount).toBe(1000);
  expect((await db.agentTasks.get(task.id))?.artifacts).toHaveLength(1000);
 });
 it("retains maximal valid Todo and requirement changes without truncating history",async()=>{
  const plan=Array.from({length:30},(_,i)=>({id:`${i}`.padEnd(80,"x"),title:"长".repeat(240),status:"pending" as const}));
  const task=await createAgentTask({projectId:(await createBoundTestProject("测试项目")).id,title:"题".repeat(120),goal:"目".repeat(20000),acceptanceCriteria:Array.from({length:20},()=>"标".repeat(500)),plan});
  const run=await beginAgentRun({threadId:task.threadId,connector,model:"fixture",content:"继续"});
  await saveFixtureToolRound(run.id,"",[{id:"plan",type:"function",function:{name:"update_run_plan",arguments:"{}"}}],[{title:"计划",effect:"bookkeeping",highRisk:false}]);
  const call=(await db.agentToolCalls.where("runId").equals(run.id).first())!;
  await transitionToolCall(run.id,call.id,["pending"],"running");
  const next=plan.map(step=>({...step,title:"新".repeat(240)}));
  await updateRunPlanAndComplete(run.id,call.id,next,"调整分镜顺序");
  const history=(await db.agentTaskRecords.toArray())[0];expect(history.body.length).toBeGreaterThan(12000);expect(history.body).toContain(next[29].title);
  await finishAgentRun(run.id,"completed");await updateAgentTask(task.id,{goal:"修".repeat(20000)},2);
  const revision=(await db.agentTaskRecords.toArray()).find(record=>record.title==="用户修订任务要求")!;
  expect(revision.body.length).toBeGreaterThan(80000);expect(revision.body).toContain("修".repeat(20000));expect(revision.body).toContain("目".repeat(20000));
 });
});
