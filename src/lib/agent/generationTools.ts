import { prepareGenerationBatch, readGenerationBatch } from "@/db/agentGenerationBatches";
import { validateBatchLimits } from "@/domain/agentGenerationBatch";
import { frozenProjectScope, assertProjectToolScope } from "./projectScope";
import { z } from "zod";
import { getGenerationPreferenceState } from "@/db/generationPreferences";
import { recommendGenerationSelection } from "./generationSelection";
import { db } from "@/db/database";
import { generationJobSummary } from "@/db/agentGeneration";
import type { AgentToolDefinition } from "./tools";
import { GENERATION_PROFILES, generationJobSchema, generationSubmitSchema, type GenerationSubmitArgs } from "./generationProfiles";
import { applyAgentGeneration, monitorAgentGeneration, prepareAgentGeneration, prepareGenerationApply, submitAgentGeneration } from "./generationRuntime";

const id={type:"string",minLength:1,maxLength:160};
const jobParameters={type:"object",additionalProperties:false,required:["jobId"],properties:{jobId:id}};
const submitParameters={type:"object",additionalProperties:false,required:["connectorId","model","target","prompt"],properties:{
  connectorId:id,model:{type:"string",enum:["gpt-image-2","gpt-image-2.5-flare","gpt-image-2.5-sunburst","gpt-image-2.5-ext","MiniMax-H3","veo-3.1-fast-generate-preview"]},prompt:{type:"string",minLength:1,maxLength:32000},
  target:{type:"object",additionalProperties:false,required:["kind","projectId","entityId","slot"],properties:{kind:{type:"string",enum:["shot","character","scene","prop","style"]},projectId:id,entityId:id,episodeId:id,slot:{type:"string"}}},
  parameters:{type:"object",additionalProperties:false,properties:{size:{type:"string"},resolution:{type:"string"},duration:{type:"integer"},aspectRatio:{type:"string"},mode:{type:"string",enum:["text","frames","reference"]},quality:{type:"string",enum:["low","medium","high","xhigh","max","auto"]},version:{type:"string",enum:["flare","sunburst"]}}},
  inputs:{type:"array",maxItems:16,items:{type:"object",additionalProperties:false,required:["mediaId","role"],properties:{mediaId:id,role:{type:"string",enum:["first-frame","last-frame","reference-image","reference-video"]}}}},
}};
const batchSchema = z.object({title:z.string().trim().min(1).max(160),candidates:z.array(generationSubmitSchema).min(1).max(20)}).strict().superRefine((value,ctx)=>{try{validateBatchLimits(value.candidates.map(draft=>({draft})));}catch(error){ctx.addIssue({code:"custom",message:error instanceof Error?error.message:"候选数量无效"});}});
export const GENERATION_TOOLS: readonly AgentToolDefinition[] = [
  {name:"prepare_generation_batch",title:"准备批量生成",description:"准备多个目标槽位的图片/视频候选草稿，每个槽位默认1份、最多4份，每批最多20份。每份独立配置。只保存草稿，不上传或付费提交；用户在批量面板编辑并一次确认。结果必须由用户比较选用，禁止自动写入。",effect:"bookkeeping",atomic:true,highRisk:()=>false,
    parameters:{type:"object",additionalProperties:false,required:["title","candidates"],properties:{title:{type:"string",minLength:1,maxLength:160},candidates:{type:"array",minItems:1,maxItems:20,items:submitParameters}}},parseArguments:raw=>batchSchema.parse(raw),
    execute:(args,context)=>{const parsed=batchSchema.parse(args);return prepareGenerationBatch(parsed.title,parsed.candidates,context);}},
  {name:"read_generation_batch",title:"读取批量结果",description:"读取当前对话指定批次的候选状态和当前选用结果，不发送网络请求。draft不是生成成功，queued是未发送，unknown不可重试。",effect:"read",highRisk:()=>false,
    parameters:{type:"object",additionalProperties:false,required:["batchId"],properties:{batchId:id}},parseArguments:raw=>z.object({batchId:z.string().trim().min(1).max(160)}).strict().parse(raw),
    async execute(args,context){await frozenProjectScope(context);const state=await readGenerationBatch((args as {batchId:string}).batchId,context.threadId);await assertProjectToolScope(context,"read_generation_batch",{projectId:state.batch.projectId},false);return {batchId:state.batch.id,title:state.batch.title,status:state.batch.status,pauseReason:state.batch.pauseReason,candidates:state.items.map(item=>{const job=state.jobs.find(j=>j.id===item.jobId);return {itemId:item.id,target:item.baseline.target,label:item.label,status:job?.status??item.state,selected:state.batch.selections[item.targetKey]===item.id,applied:!!job?.result&&state.currentMedia[item.targetKey]===job.result.mediaId,...(job?{jobId:job.id,provider:job.provider,model:job.model,result:job.result,error:job.error}: {})};})};}},
  {name:"generation_capabilities",title:"查看生成能力",description:"列出已配置供应商、代码已验证的模型参数，以及项目/全局生成推荐。传 projectId 获取项目默认；用户明确选择优先于项目、全局和自动建议。有问题的推荐不得静默降级。能力列表不是账户授权或余额保证。",effect:"read",highRisk:()=>false,
    parameters:{type:"object",properties:{projectId:id},additionalProperties:false},parseArguments:(raw)=>z.object({projectId:z.string().trim().min(1).max(160).optional()}).strict().parse(raw),
    async execute(args,context) {
      const {signal}=context;
      const boundProject=await frozenProjectScope(context);
      signal.throwIfAborted();
      const projectId=(args as {projectId?:string}).projectId??boundProject;
      if(projectId)await assertProjectToolScope(context,"generation_capabilities",{projectId},false);
      const project=projectId && projectId!=="studio" ? await db.projects.get(projectId):undefined;
      if(projectId && projectId!=="studio" && !project) throw new Error("项目不存在，请重新选择生成目标");
      const connectors=(await db.connectors.toArray()).filter((item)=>["apimart","aihubmix"].includes(item.definitionId));
      const state=await getGenerationPreferenceState();
      const recommendations=Object.fromEntries((["image","video"] as const).map((kind)=>[kind,recommendGenerationSelection({kind,connectors,projectDefaults:project?.generationDefaults,preferences:state.preferences,preferenceIssues:state.issues})]));
      signal.throwIfAborted();
      return {connectors:connectors.map((item)=>({id:item.id,provider:item.definitionId,label:item.label,configured:Boolean(item.apiKey.trim())})),profiles:GENERATION_PROFILES,recommendations,profileDate:"2026-09-19",note:"AI 先准备供应商/模型/提示/参数，用户可在确认处调整；付费提交始终需要确认。没有列出的模型/参数组合明确不支持，不会自动替换。"};
    }},
  {name:"submit_generation",title:"生成图片或视频",description:"为合法目标槽位提交一次付费生成并等待查询/下载。先查 generation_capabilities。必须使用稳定目标ID和本地素材ID。返回 downloaded 才表示本地素材可用；还需 apply_generation 写入目标。失败/未知提交不可当作成功，也不可盲目重发。",effect:"network",recovery:"generation",requiresConfirmation:true,highRisk:()=>false,
    parameters:submitParameters,parseArguments:(raw)=>generationSubmitSchema.parse(raw),prepare:(args,context)=>prepareAgentGeneration(args as GenerationSubmitArgs,context),
    async execute(args,context){const job=await submitAgentGeneration(args as GenerationSubmitArgs,context);return {...generationJobSummary(job),parameters:job.parameters,inputs:job.inputs.map(({mediaId,role})=>({mediaId,role}))};}},
  {name:"check_generation",title:"继续查询生成任务",description:"查询当前对话已有任务并下载真实结果；等待不会消耗模型轮次。只恢复已有任务，不会再次付费提交。返回 downloaded 后才可 apply_generation。",effect:"network",recovery:"repeatable",highRisk:()=>false,
    parameters:jobParameters,parseArguments:(raw)=>generationJobSchema.parse(raw),
    async execute(args,context){return generationJobSummary(await monitorAgentGeneration((args as {jobId:string}).jobId,context));}},
  {name:"apply_generation",title:"写入生成素材",description:"将已下载的生成结果写入原目标槽位；核验归属和原始版本，冲突保留结果且不覆盖手动修改。不改变文字/时长/人工状态。重复应用返回同一结果。",effect:"write",atomic:true,highRisk:()=>false,
    parameters:jobParameters,parseArguments:(raw)=>generationJobSchema.parse(raw),prepare:(args,context)=>prepareGenerationApply((args as {jobId:string}).jobId,context),
    execute:(args,context)=>applyAgentGeneration((args as {jobId:string}).jobId,context)},
  {name:"list_generation_jobs",title:"查看生成记录",description:"列出当前对话最近30项生成任务及真实本地状态，不发送网络请求。未知提交需核实，不可重新提交。",effect:"read",highRisk:()=>false,
    parameters:{type:"object",properties:{},additionalProperties:false},parseArguments:(raw)=>z.object({}).strict().parse(raw),
    async execute(_args,context){context.signal.throwIfAborted();await frozenProjectScope(context);return (await db.agentGenerationJobs.where("threadId").equals(context.threadId).toArray()).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)).slice(0,30).map(generationJobSummary);}},
];
