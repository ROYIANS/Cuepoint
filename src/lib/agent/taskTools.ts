import { formatTaskRequirements } from "./taskState";
import { db } from "@/db/database";
import { taskFields } from "@/db/agentTasks";
import { listTaskRecords, listTaskRecordVersions, validateTaskSources, writeTaskRecord } from "@/db/agentTaskRecords";
import { executeAtomicTool } from "@/db/agentTools";
import { GENERAL_AGENT_ID, type AgentTask } from "@/domain/agent";
import { TASK_RECORD_KINDS, TASK_RECORD_CLAIMS } from "@/domain/agentTaskRecords";
import type { AgentToolContext, AgentToolDefinition } from "./tools";
import { object, text, array, choice, optional, number, type Spec } from "./businessSchemas";
import { createId, nowIso } from "@/lib/ids";

const id = text(120,1);
const source = object({ type: choice(["message","tool"]), id });
const sources = array(source,12);
const steps = array(object({ id: text(80,1), title: text(240,1), status: choice(["pending","in_progress","completed"]) }),30);
const taskFieldsSpec = { title:text(120,1), goal:text(20000,1), acceptanceCriteria:array(text(500,1),20), steps };
const recordFields = { kind:choice(TASK_RECORD_KINDS), claim:choice(TASK_RECORD_CLAIMS), title:text(120,1), body:text(12000,1), sources, todoId:optional(text(80,1)) };

async function owner(context: AgentToolContext, name: string) {
  context.signal.throwIfAborted();
  const run = await db.agentRuns.get(context.runId), call = await db.agentToolCalls.get(context.callId);
  const thread = await db.chatThreads.get(context.threadId);
  if (!run || !thread || run.threadId !== thread.id || run.status !== "running" || !call || call.runId !== run.id || call.threadId !== thread.id || call.name !== name || call.status !== "running" || !run.enabledToolNames?.includes(name) || run.interactionMode === "conversation") throw new Error("任务工具执行归属或权限无效");
  const siblings = await db.agentRuns.where("threadId").equals(thread.id).toArray();
  if (siblings.some((other)=>other.id!==run.id && other.createdAt>=run.createdAt)) throw new Error("只能由当前最新执行维护任务");
  const task = await db.agentTasks.where("threadId").equals(thread.id).first();
  if (!run.taskMode && !run.taskId) throw new Error("只有任务模式可以创建或维护任务");
  if (run.taskId && (!task || task.id !== run.taskId)) throw new Error("任务关联已失效");
  if (task && task.lifecycle !== "open") throw new Error("请先重新打开任务");
  return { run, thread, task };
}
/** Task artifacts are appendable; never copy their entire history into a tool result. */
function taskResult(task: AgentTask) {
  return { ...task, artifacts: task.artifacts.slice(-10), artifactCount: task.artifacts.length };
}
function requiredTask(task?: AgentTask): AgentTask { if (!task) throw new Error("需求明确后先创建任务"); return task; }
function tool<T>(name:string,title:string,description:string,spec:Spec<T>,execute:(args:T,context:AgentToolContext,state:Awaited<ReturnType<typeof owner>>)=>Promise<unknown>):AgentToolDefinition {
  return { name,title,description,parameters:spec.json,effect:"bookkeeping",atomic:true,highRisk:()=>false,parseArguments:(raw)=>spec.schema.parse(raw),
    execute:(args,context)=>executeAtomicTool(context,async()=>execute(spec.schema.parse(args),context,await owner(context,name))) };
}
export const TASK_TOOLS:readonly AgentToolDefinition[] = [
  tool("task_read","读取任务工作区","读取当前任务、记录索引及真实用户消息和工具结果的来源 ID。未建任务时读取需求对话。offset/limit 翻页列表；传 source 和 contentOffset/contentLimit 分段读取来源全文，每次最多6000字，不访问其他任务。",object({offset:optional(number(0,100000,true)),limit:optional(number(1,10,true)),source:optional(source),contentOffset:optional(number(0,10000000,true)),contentLimit:optional(number(1,6000,true))}),async(args,_context,{task,thread})=>{
    const offset=args.offset??0, limit=args.limit??5;
    const messages=(await db.chatMessages.where("threadId").equals(thread.id).sortBy("createdAt")).filter((m)=>m.role==="user" && !!m.content.trim()).reverse();
    const taskRunIds=new Set(task?(await db.agentRuns.where("taskId").equals(task.id).toArray()).map((run)=>run.id):[]);
    const calls=(await db.agentToolCalls.where("threadId").equals(thread.id).toArray()).filter((c)=>c.status==="completed" && c.effect!=="bookkeeping" && !!c.result && taskRunIds.has(c.runId)).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));
    if (args.source) {
      const item = args.source.type === "message" ? messages.find((message)=>message.id===args.source!.id) : calls.find((call)=>call.id===args.source!.id);
      if (!item) throw new Error("来源不是当前任务可读取的用户消息或已完成业务工具结果");
      const content = "content" in item ? item.content : item.result ?? "";
      const contentOffset=args.contentOffset??0,contentLimit=args.contentLimit??6000;
      return {source:args.source,content:content.slice(contentOffset,contentOffset+contentLimit),totalLength:content.length,nextOffset:contentOffset+contentLimit<content.length?contentOffset+contentLimit:null};
    }
    const records=task?await listTaskRecords(task.id):[];
    return {task:task?taskResult(task):null, records:records.slice(offset,offset+limit).map(({id,kind,claim,title,revision,author,todoId})=>({id,kind,claim,title,revision,author,todoId})),recordCount:records.length,
      messages:messages.slice(offset,offset+limit).map((m)=>({id:m.id,content:m.content.slice(0,800),truncated:m.content.length>800})),messageCount:messages.length,
      tools:calls.slice(offset,offset+limit).map((c)=>({id:c.id,name:c.name,status:c.status,result:c.result?.slice(0,400),truncated:(c.result?.length??0)>400})),toolCount:calls.length};
  }),
  tool("task_create","建立创作任务","仅在任务模式、需求和交付物足够明确后创建。先通过 task_read 获取用户消息来源。重复创建返回同一任务，不覆盖目标。",object({...taskFieldsSpec,sources:array(source,12,1)}),async(args,_context,{run,thread,task})=>{
    if(task) return {task:taskResult(task),reused:true};
    if(!run.taskMode) throw new Error("只有任务模式可以创建任务");
    await validateTaskSources({id:"",threadId:thread.id},args.sources,"decision","ai");
    if(args.steps.some((step)=>step.status==="completed")) throw new Error("新任务不能预先声称步骤完成");
    const at=nowIso();
    const created:AgentTask={...taskFields({...args,plan:args.steps}),id:createId("task"),threadId:thread.id,agentId:GENERAL_AGENT_ID,revision:1,lifecycle:"open",artifacts:[],createdAt:at,updatedAt:at};
    await db.agentTasks.add(created);
    await db.agentRuns.update(run.id,{taskId:created.id,plan:created.plan,updatedAt:at});
    await db.chatThreads.update(thread.id,{taskMode:true,updatedAt:at});
    await writeTaskRecord(created,{kind:"approach",claim:"decision",title:"任务目标与验收要求",body:formatTaskRequirements(created),sources:args.sources},{author:"ai",runId:run.id,requirementSnapshot:true});
    return {task:taskResult(created),reused:false};
  }),
  tool("task_update","更新任务要求","修改当前任务名称、目标及验收要求，必须引用用户澄清消息并提供读取到的 revision。计划用 update_run_plan。保留变更历史。",object({title:text(120,1),goal:text(20000,1),acceptanceCriteria:array(text(500,1),20),expectedRevision:number(1,1000000,true),sources:array(source,12,1)}),async(args,_context,{task,run})=>{
    const current=requiredTask(task);
    if((current.revision??1)!==args.expectedRevision) throw new Error("任务已更新，请重新读取后修改");
    await validateTaskSources(current,args.sources,"decision","ai");
    await writeTaskRecord(current,{kind:"approach",claim:"decision",title:"任务要求调整",body:`调整前\n${formatTaskRequirements(current)}\n\n调整后\n${formatTaskRequirements(args)}`,sources:args.sources},{author:"ai",runId:run.id,requirementSnapshot:true});
    const updated={...current,...taskFields({...args,plan:current.plan}),revision:(current.revision??1)+1,updatedAt:nowIso()};
    await db.agentTasks.put(updated); return {task:taskResult(updated)};
  }),
  tool("task_record_write","保存任务工作记录","保存调研、方案、进展、验证或待解决问题。proposal 是建议；decision 必须有用户消息来源；observation 引用真实读取结果；result 必须引用完成的业务操作。来源不代表主观目标已通过验收。更新需 id 和 expectedRevision。",object({...recordFields,id:optional(id),expectedRevision:optional(number(1,1000000,true))}),async(args,_context,{task,run})=>{
    const {id,expectedRevision,...input}=args;
    return {record:await writeTaskRecord(requiredTask(task),input,{id,expectedRevision,author:"ai",runId:run.id})};
  }),
  tool("task_record_read","读取任务记录","读取当前任务记录及指定历史版本，按正文 offset/limit 分页。只有当前版本会进入后续任务上下文；旧版本用于追溯。",object({id,revision:optional(number(1,1000000,true)),offset:optional(number(0,120000,true)),limit:optional(number(1,6000,true))}),async(args,_context,{task})=>{
    const current=requiredTask(task), record=await db.agentTaskRecords.get(args.id);
    if(!record||record.taskId!==current.id) throw new Error("记录不属于当前任务");
    const versions=await listTaskRecordVersions(current.id,record.id);
    const selected=args.revision?versions.find((v)=>v.revision===args.revision):record;
    if(!selected) throw new Error("记录版本不存在");
    const offset=args.offset??0,limit=args.limit??6000;
    return {record:{...selected,body:selected.body.slice(offset,offset+limit)},totalLength:selected.body.length,versionCount:versions.length,versions:versions.slice(-50).map(({revision,author,updatedAt})=>({revision,author,updatedAt}))};
  }),
];
