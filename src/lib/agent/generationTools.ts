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
  connectorId:id,model:{type:"string",enum:["gpt-image-2","MiniMax-H3","veo-3.1-fast-generate-preview"]},prompt:{type:"string",minLength:1,maxLength:32000},
  target:{type:"object",additionalProperties:false,required:["kind","projectId","entityId","slot"],properties:{kind:{type:"string",enum:["shot","character","scene","prop","style"]},projectId:id,entityId:id,episodeId:id,slot:{type:"string"}}},
  parameters:{type:"object",additionalProperties:false,properties:{size:{type:"string"},resolution:{type:"string"},duration:{type:"integer"},aspectRatio:{type:"string"},mode:{type:"string",enum:["text","frames","reference"]},quality:{type:"string",enum:["low","medium","high"]}}},
  inputs:{type:"array",maxItems:16,items:{type:"object",additionalProperties:false,required:["mediaId","role"],properties:{mediaId:id,role:{type:"string",enum:["first-frame","last-frame","reference-image","reference-video"]}}}},
}};
export const GENERATION_TOOLS: readonly AgentToolDefinition[] = [
  {name:"generation_capabilities",title:"查看生成能力",description:"列出已配置供应商、代码已验证的模型参数，以及项目/全局生成推荐。传 projectId 获取项目默认；用户明确选择优先于项目、全局和自动建议。有问题的推荐不得静默降级。能力列表不是账户授权或余额保证。",effect:"read",highRisk:()=>false,
    parameters:{type:"object",properties:{projectId:id},additionalProperties:false},parseArguments:(raw)=>z.object({projectId:z.string().trim().min(1).max(160).optional()}).strict().parse(raw),
    async execute(args,{signal}) {
      signal.throwIfAborted();
      const {projectId}=args as {projectId?:string};
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
    async execute(_args,context){context.signal.throwIfAborted();return (await db.agentGenerationJobs.where("threadId").equals(context.threadId).toArray()).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)).slice(0,30).map(generationJobSummary);}},
];
