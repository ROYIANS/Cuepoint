import { db } from "@/db/database";
import { claimGenerationJob, generationJobSummary, storeGenerationMedia, updateGenerationJob } from "@/db/agentGeneration";
import { AtomicToolRollbackError, executeAtomicTool } from "@/db/agentTools";
import { setCharacterSlot, setPropSlot, setSceneSlot, setShotSlot, setStyleSlot } from "@/db/repo";
import type { AgentGenerationJob } from "@/domain/agentGeneration";
import type { AgentToolPreview } from "@/domain/agent";
import type { ProductionTarget } from "@/domain/production";
import type { ConnectorConfig, GenerationSlot, MediaRecord } from "@/domain/types";
import { emptySlot } from "@/domain/slot";
import { targetRevision } from "@/lib/productionRevision";
import { flushPendingDrafts } from "@/lib/debouncedDraft";
import { createId, nowIso } from "@/lib/ids";
import { getApimartTask, submitApimartImageGeneration, submitApimartVideoGeneration, uploadApimartImage } from "@/lib/ai/apimart";
import { downloadAIHubMixResult, getAIHubMixImageTask, getAIHubMixVideoTask, submitAIHubMixImageGeneration, submitAIHubMixVideoGeneration } from "@/lib/ai/aihubmix";
import type { AIHubMixGenerationRequest, AIHubMixTask } from "@/lib/ai/aihubmix";
import type { AgentToolContext } from "./tools";
import { ToolPendingError } from "./toolErrors";
import { generationImageDimensions } from "./generationMedia";
import { generationSubmitSchema, profileRequest, type GenerationSubmitArgs } from "./generationProfiles";

export interface GenerationRuntimeOptions { fetchImpl?: typeof fetch; pollIntervalMs?: number; maxPolls?: number }
export class GenerationPendingError extends ToolPendingError { constructor(public readonly jobId: string, message: string) { super(message); this.name = "GenerationPendingError"; } }
const targetTables = () => [db.projects, db.episodes, db.shots, db.characters, db.scenes, db.props, db.styles];
export async function readGenerationTarget(target: ProductionTarget) {
  if (target.projectId !== "studio" && !await db.projects.get(target.projectId)) throw new Error("生成目标项目已删除");
  const entity = target.kind === "shot" ? await db.shots.get(target.entityId) : target.kind === "character" ? await db.characters.get(target.entityId)
    : target.kind === "scene" ? await db.scenes.get(target.entityId) : target.kind === "prop" ? await db.props.get(target.entityId) : await db.styles.get(target.entityId);
  if (!entity || entity.projectId !== target.projectId) throw new Error("生成目标不存在或归属不匹配");
  if (target.kind === "shot") {
    const episode = await db.episodes.get(target.episodeId);
    if (!episode || episode.projectId !== target.projectId || !("episodeId" in entity) || entity.episodeId !== target.episodeId) throw new Error("生成目标不属于当前故事");
  }
  if (!target.slot) throw new Error("生成目标缺少素材槽位");
  const slot = "slots" in entity ? (entity.slots as Partial<Record<string, GenerationSlot>>)[target.slot] ?? emptySlot()
    : target.kind === "shot" ? entity[target.slot!] : emptySlot();
  return { entity, slot, revision: targetRevision(entity), label: "name" in entity ? entity.name : `镜头 ${entity.shotNumber || entity.order + 1}` };
}
export function generationTargetHref(target: ProductionTarget): string {
  const id = encodeURIComponent(target.entityId);
  if (target.kind === "shot") return `/p/${encodeURIComponent(target.projectId)}/e/${encodeURIComponent(target.episodeId)}/shots?shot=${id}`;
  const plural = target.kind === "character" ? "characters" : target.kind === "scene" ? "scenes" : target.kind === "prop" ? "props" : "styles";
  return target.projectId === "studio" ? `/${plural}/${id}` : `/p/${encodeURIComponent(target.projectId)}/assets/${plural}/${id}`;
}
async function connector(id: string, frozen?: Pick<AgentGenerationJob, "provider" | "baseUrl">) {
  const item = await db.connectors.get(id);
  if (!item || (item.definitionId !== "apimart" && item.definitionId !== "aihubmix") || !item.apiKey.trim()) throw new Error("生成供应商尚未配置有效密钥");
  const url = new URL(item.baseUrl);
  if (!/^https?:$/.test(url.protocol) || url.username || url.password || url.search || url.hash || !url.pathname.endsWith("/v1")) throw new Error("供应商 Base URL 无效");
  if (frozen && (item.definitionId !== frozen.provider || item.baseUrl !== frozen.baseUrl)) throw new Error("供应商配置已变化，请恢复原配置后查询已有任务；不会重新提交");
  return item;
}
function safeTaskId(id: string, config: ConnectorConfig) {
  if (!id.trim() || id.includes(config.apiKey.trim()) || /[\\/?#%]/.test(id) || id === "." || id === "..") throw new Error("供应商任务标识格式异常，提交结果需人工核实");
  return id;
}
async function inputRevision(media: MediaRecord) {
  const digest = await crypto.subtle.digest("SHA-256", await media.blob.arrayBuffer());
  return targetRevision({id:media.id,projectId:media.projectId,mimeType:media.mimeType,size:media.blob.size,
    hash:[...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2,"0")).join("")});
}
function cleanError(error: unknown, config?: ConnectorConfig) {
  const text = error instanceof Error ? error.message : "生成操作失败";
  return (config?.apiKey ? text.split(config.apiKey.trim()).join("[已隐藏]") : text).replace(/Bearer\s+[^\s"',;]+/gi,"Bearer [已隐藏]").slice(0,700);
}
async function prepareSnapshot(raw: GenerationSubmitArgs, signal: AbortSignal) {
  signal.throwIfAborted();
  const args = generationSubmitSchema.parse(raw);
  await flushPendingDrafts(args.target.projectId);
  const config = await connector(args.connectorId);
  const provider = config.definitionId as "apimart" | "aihubmix";
  const request = profileRequest(args,provider);
  const snapshot = await db.transaction("r", [...targetTables(),db.media], async () => {
    const current = await readGenerationTarget(request.target);
    const records = await db.media.bulkGet(request.inputs.map((input) => input.mediaId));
    return {current,records};
  });
  const inputs = [];
  let bytes = 0;
  for (const [index,input] of request.inputs.entries()) {
    const media = snapshot.records[index];
    const kind = input.role === "reference-video" ? "video" : "image";
    if (!media || media.projectId !== request.target.projectId || !media.blob.size || !media.mimeType.startsWith(`${kind}/`)) throw new Error("输入素材已删除、为空、类型错误或属于其他项目");
    if (kind === "image" && !["image/png","image/jpeg","image/webp","image/gif"].includes(media.mimeType)) throw new Error("参考图片格式尚未支持");
    if (provider === "apimart" && media.blob.size > 20 * 1024 * 1024) throw new Error("APIMart 参考图不能超过20MiB");
    if (provider === "apimart" && args.model === "MiniMax-H3") {
      if (!["image/png","image/jpeg","image/webp"].includes(media.mimeType)) throw new Error("MiniMax H3 本地参考图仅支持 PNG、JPEG、WebP");
      const {width,height}=await generationImageDimensions(media.blob);
      if (width<256||height<256||width>5760||height>5760||width/height<0.4||width/height>2.5) throw new Error("MiniMax H3 图片宽高须为256–5760px，比例0.4–2.5");
    }
    bytes += Math.ceil(media.blob.size / 3) * 4;
    inputs.push({...input,revision:await inputRevision(media)});
  }
  if (provider === "aihubmix" && bytes + new TextEncoder().encode(args.prompt).length + 8192 > 32 * 1024 * 1024) throw new Error("AIHubMix 内联素材请求超过32MiB限制");
  signal.throwIfAborted();
  const fingerprint = targetRevision({target:request.target,connectorId:config.id,provider,baseUrl:config.baseUrl,model:args.model,parameters:request.parameters,inputs,baseRevision:snapshot.current.revision});
  return {args,config,provider,request,inputs,fingerprint,current:snapshot.current};
}
export async function prepareAgentGeneration(raw: GenerationSubmitArgs, context: AgentToolContext): Promise<AgentToolPreview> {
  const snapshot = await prepareSnapshot(raw,context.signal);
  return { summary:`使用 ${snapshot.provider} / ${snapshot.args.model} 为「${snapshot.current.label}」生成${snapshot.request.kind === "image" ? "图片" : "视频"}`,
    changes:[`槽位：${snapshot.request.target.slot}`,`提示词：${snapshot.args.prompt.slice(0,1500)}`,`参数：${JSON.stringify(snapshot.request.parameters).slice(0,1800)}`,`参考素材：${snapshot.inputs.length} 项；此操作可能产生供应商费用，完成后需要单独写入目标。`],
    revision:snapshot.fingerprint,target:{label:snapshot.current.label,href:generationTargetHref(snapshot.request.target)}};
}
async function jobForContext(jobId: string, context: AgentToolContext) {
  const job = await db.agentGenerationJobs.get(jobId);
  if (!job || job.threadId !== context.threadId || !await db.chatThreads.get(job.threadId) || !await db.agentRuns.get(job.runId)) throw new Error("生成任务不存在或不属于当前对话");
  return job;
}
async function loadInputs(job: AgentGenerationJob) {
  const rows: MediaRecord[] = [];
  for (const input of job.inputs) {
    const media = await db.media.get(input.mediaId);
    if (!media || media.projectId !== job.projectId || await inputRevision(media) !== input.revision) throw new Error("生成输入素材已变化，保留任务但不使用新的素材");
    rows.push(media);
  }
  return rows;
}
async function dataUri(media: MediaRecord) {
  const bytes = new Uint8Array(await media.blob.arrayBuffer());
  let binary = "";
  for (let offset=0;offset<bytes.length;offset+=32768) binary += String.fromCharCode(...bytes.subarray(offset,offset+32768));
  return `data:${media.mimeType};base64,${btoa(binary)}`;
}
async function nativeRequest(job: AgentGenerationJob, config: ConnectorConfig, context: AgentToolContext, options: GenerationRuntimeOptions): Promise<AIHubMixGenerationRequest> {
  const records = await loadInputs(job);
  const input: AIHubMixGenerationRequest = {model:job.model,prompt:String(job.parameters.prompt)};
  for (const [key,value] of Object.entries(job.parameters)) if (!["mode","quality"].includes(key)) input[key]=value;
  if (job.provider === "aihubmix" && job.parameters.quality) input.extra = {quality:job.parameters.quality};
  const urls: string[] = [];
  for (const media of records) {
    context.signal.throwIfAborted();
    if (job.provider === "apimart") {
      const uploaded = await uploadApimartImage(config, new Blob([media.blob],{type:media.mimeType}),{signal:context.signal,fetchImpl:options.fetchImpl,filename:media.filename});
      if (!uploaded.ok) throw new Error(uploaded.message);
      urls.push(uploaded.image.url);
    } else urls.push(await dataUri(media));
  }
  if (urls.length) {
    if (job.provider === "apimart") {
      if (job.kind === "image") input.image_urls = urls;
      else input.image_with_roles = job.inputs.map((item,index) => ({url:urls[index],role:item.role.replaceAll("-","_")}));
    } else if (job.kind === "image") input.images=urls;
    else if (job.parameters.mode === "frames") input.frame_images=job.inputs.map((item,index) => ({frame_type:item.role.replaceAll("-","_"),image_url:{url:urls[index]}}));
    else input.input_references=job.inputs.map((item,index) => ({type:item.role === "reference-video" ? "video_url" : "image_url",url:urls[index]}));
  }
  return input;
}

export async function submitAgentGeneration(raw: GenerationSubmitArgs, context: AgentToolContext, options: GenerationRuntimeOptions = {}): Promise<AgentGenerationJob> {
  context.signal.throwIfAborted();
  const saved = await db.agentGenerationJobs.where("callId").equals(context.callId).first();
  if (saved) {
    if (saved.runId !== context.runId || saved.threadId !== context.threadId) throw new Error("生成记录归属不匹配");
    return monitorAgentGeneration(saved.id,context,options);
  }
  let snapshot;
  try {
    snapshot = await prepareSnapshot(raw,context.signal);
    if (context.preview?.revision && context.preview.revision !== snapshot.fingerprint) throw new Error("生成目标、输入或配置已变化，请重新确认，尚未付费提交");
  } catch(error) { throw new AtomicToolRollbackError(cleanError(error)); }
  const at=nowIso();
  const claim=await claimGenerationJob({version:1,id:createId("genjob"),runId:context.runId,threadId:context.threadId,callId:context.callId,
    projectId:snapshot.request.target.projectId,connectorId:snapshot.config.id,provider:snapshot.provider,baseUrl:snapshot.config.baseUrl,model:snapshot.args.model,
    kind:snapshot.request.kind,target:snapshot.request.target,baseRevision:snapshot.current.revision,
    sourceRevisions:[{kind:snapshot.request.target.kind,id:snapshot.request.target.entityId,revision:snapshot.current.revision}],
    parameters:snapshot.request.parameters,inputs:snapshot.inputs,fingerprint:snapshot.fingerprint,status:"submitting",createdAt:at,updatedAt:at}).catch((error:unknown)=>{throw new AtomicToolRollbackError(cleanError(error,snapshot.config));});
  if (!claim.claimed) return monitorAgentGeneration(claim.job.id,context,options);
  let postStarted=false;
  try {
    const request=await nativeRequest(claim.job,snapshot.config,context,options);
    // Reference uploads may take time; never submit paid work against a changed target.
    const latest=await readGenerationTarget(claim.job.target);
    if (latest.revision !== claim.job.baseRevision) throw new Error("生成目标已修改，尚未付费提交");
    context.signal.throwIfAborted();
    const active=await db.agentRuns.get(context.runId);
    const activeCall=await db.agentToolCalls.get(context.callId);
    if (!await db.agentGenerationJobs.get(claim.job.id) || !active || active.status!=="running" || !activeCall || activeCall.status!=="running") throw new Error("生成记录或执行已停止，尚未付费提交");
    postStarted=true;
    if (snapshot.provider === "apimart") {
      const result=await (claim.job.kind === "image" ? submitApimartImageGeneration : submitApimartVideoGeneration)(snapshot.config,request,{signal:context.signal,fetchImpl:options.fetchImpl});
      if (!result.ok) {
        await updateGenerationJob(claim.job.id,{status:result.kind === "validation" || result.kind === "http" && [400,401,402,403,404,422,429].includes(result.httpStatus ?? 0) ? "failed" : "unknown",error:cleanError(new Error(result.message),snapshot.config)});
        return monitorAgentGeneration(claim.job.id,context,options);
      }
      // n=1 profiles create exactly one task. Preserve first received identity before further work.
      await updateGenerationJob(claim.job.id,{providerTaskId:safeTaskId(result.tasks[0].id,snapshot.config),status:"submitted"});
      if (result.tasks.length !== 1) {
        await updateGenerationJob(claim.job.id,{status:"unknown",providerTaskIds:result.tasks.map((task)=>safeTaskId(task.id,snapshot.config)),error:"供应商返回多个任务，已保留任务标识，请核实账户记录，不能自动选择结果或重复提交"});
        throw new GenerationPendingError(claim.job.id,"供应商返回多个任务，需要人工核实，不能自动选择或重新提交");
      }
    } else {
      const result=await (claim.job.kind === "image" ? submitAIHubMixImageGeneration : submitAIHubMixVideoGeneration)(snapshot.config,request,{signal:context.signal,fetchImpl:options.fetchImpl});
      if (!result.ok) {
        await updateGenerationJob(claim.job.id,{...(result.taskId ? {providerTaskId:safeTaskId(result.taskId,snapshot.config)} : {}),status:result.taskId ? "submitted" : result.kind === "validation" || result.kind === "http" && [400,401,402,403,404,422,429].includes(result.httpStatus ?? 0) ? "failed" : "unknown",error:cleanError(new Error(result.message),snapshot.config)});
        if (!result.taskId) return monitorAgentGeneration(claim.job.id,context,options);
      } else {
        await updateGenerationJob(claim.job.id,{providerTaskId:safeTaskId(result.task.id,snapshot.config),status:"submitted"});
        // Synchronous completion may carry the only copy of base64 output.
        if (result.task.status === "completed") return await acceptHubTask(claim.job.id,result.task,snapshot.config,context,options);
      }
    }
  } catch(error) {
    const current=await db.agentGenerationJobs.get(claim.job.id);
    if (!current) throw error;
    await updateGenerationJob(current.id,{status:current.providerTaskId ? current.status : postStarted ? "unknown" : "failed",error:cleanError(error,snapshot.config)});
    if (!postStarted) throw new AtomicToolRollbackError(cleanError(error,snapshot.config));
    if (context.signal.aborted) throw new GenerationPendingError(current.id,"已停止本地等待；远端提交结果需核实，不能当作远端取消");
    throw new GenerationPendingError(current.id,cleanError(error,snapshot.config));
  }
  return monitorAgentGeneration(claim.job.id,context,options);
}

async function validateBlob(blob: Blob, kind: "image"|"video") {
  if (!blob.size) throw new Error("供应商结果文件为空");
  const bytes=new Uint8Array(await blob.slice(0,32).arrayBuffer());
  const ascii=(start:number,end:number)=>String.fromCharCode(...bytes.slice(start,end));
  let mime="";
  if (bytes[0]===137 && ascii(1,4)==="PNG") mime="image/png";
  else if (bytes[0]===255 && bytes[1]===216 && bytes[2]===255) mime="image/jpeg";
  else if (ascii(0,3)==="GIF") mime="image/gif";
  else if (ascii(0,4)==="RIFF" && ascii(8,12)==="WEBP") mime="image/webp";
  else if (ascii(4,8)==="ftyp") mime="video/mp4";
  else if (bytes[0]===0x1a && bytes[1]===0x45 && bytes[2]===0xdf && bytes[3]===0xa3) mime="video/webm";
  if (!mime.startsWith(`${kind}/`)) throw new Error("下载内容不是可识别的目标图片/视频，未写入素材");
  return new Blob([blob],{type:mime});
}
async function saveBlob(job: AgentGenerationJob, blob: Blob) {
  const verified=await validateBlob(blob,job.kind);
  const ext=verified.type.split("/")[1];
  return storeGenerationMedia(job.id,{id:createId("media"),projectId:job.projectId,mimeType:verified.type,filename:`${job.model}-${job.id}.${ext}`,blob:verified});
}
async function acceptHubTask(jobId:string, task:AIHubMixTask, config:ConnectorConfig, context:AgentToolContext, options:GenerationRuntimeOptions) {
  let job=await jobForContext(jobId,context);
  if (task.model !== job.model) throw new Error("供应商实际模型与已确认模型不同，保留任务但不应用结果");
  if (task.status === "failed" || task.status === "cancelled") return updateGenerationJob(jobId,{status:"failed",providerStatus:cleanError(new Error(task.providerStatus),config),error:cleanError(new Error(task.error?.message ?? "远端任务失败或已取消"),config)});
  if (task.status !== "completed") return updateGenerationJob(jobId,{status:task.status === "running" ? "running" : "submitted",providerStatus:cleanError(new Error(task.providerStatus),config),error:undefined});
  if (task.outputs.length !== 1) throw new Error("预期单个生成结果，供应商返回数量不匹配，请核实任务");
  job=await updateGenerationJob(jobId,{status:"downloading",providerStatus:cleanError(new Error(task.providerStatus),config),error:undefined});
  const output=task.outputs[0];
  let blob:Blob;
  if (output.b64Json) {
    let decoded:string;
    try { decoded=atob(output.b64Json); } catch { throw new Error("生成结果 Base64 格式无效"); }
    blob=new Blob([Uint8Array.from(decoded,(character)=>character.charCodeAt(0))]);
  } else {
    const result=await downloadAIHubMixResult(config,task,output,{signal:context.signal,fetchImpl:options.fetchImpl});
    if (!result.ok) throw new Error(result.message);
    blob=result.blob;
  }
  context.signal.throwIfAborted();
  return saveBlob(job,blob);
}
export async function checkAgentGeneration(jobId:string,context:AgentToolContext,options:GenerationRuntimeOptions={}):Promise<AgentGenerationJob> {
  context.signal.throwIfAborted();
  let job;
  try { job=await jobForContext(jobId,context); } catch(error) {throw new AtomicToolRollbackError(cleanError(error));}
  if (["downloaded","applied","conflict","failed"].includes(job.status)) return job;
  if (job.status === "unknown") return job;
  if (!job.providerTaskId) {
    if (job.status === "submitting") job=await updateGenerationJob(jobId,{status:"unknown",error:"付费提交结果尚未确认；无任务标识，不能自动再次提交。请到供应商后台核实。"});
    return job;
  }
  let config: ConnectorConfig | undefined;
  try {
    config=await connector(job.connectorId,job);
    if (job.provider === "aihubmix") {
      const response=await (job.kind === "image" ? getAIHubMixImageTask : getAIHubMixVideoTask)(config,job.providerTaskId,{signal:context.signal,fetchImpl:options.fetchImpl});
      if (!response.ok) throw new Error(response.message);
      return await acceptHubTask(jobId,response.task,config,context,options);
    }
    const response=await getApimartTask(config,job.providerTaskId,{signal:context.signal,fetchImpl:options.fetchImpl});
    if (!response.ok) throw new Error(response.message);
    const task=response.task;
    if (task.status === "failed" || task.status === "cancelled") return updateGenerationJob(jobId,{status:"failed",providerStatus:cleanError(new Error(task.providerStatus),config),error:cleanError(new Error(task.error?.message ?? "远端任务失败或已取消"),config)});
    if (task.status !== "completed") return updateGenerationJob(jobId,{status:task.status === "processing" ? "running" : "submitted",providerStatus:cleanError(new Error(task.providerStatus),config),progress:task.progress,error:undefined});
    const urls=(job.kind === "image" ? task.images : task.videos).flatMap((item)=>item.urls);
    if (urls.length !== 1) throw new Error("预期单个生成结果，供应商返回数量或类型不匹配");
    const url=new URL(urls[0]);
    if (!/^https?:$/.test(url.protocol)||url.username||url.password) throw new Error("供应商结果下载地址无效");
    job=await updateGenerationJob(jobId,{status:"downloading",providerStatus:cleanError(new Error(task.providerStatus),config),progress:task.progress,error:undefined});
    // Public signed CDN result: never attach connector credentials or cookies.
    const download=await (options.fetchImpl??fetch)(url.href,{signal:context.signal,credentials:"omit",redirect:"error"});
    if (!download.ok) throw new Error(`结果下载失败（${download.status}），请检查过期时间、网络和跨域限制`);
    const blob=await download.blob();
    context.signal.throwIfAborted();
    return await saveBlob(job,blob);
  } catch(error) {
    await updateGenerationJob(jobId,{error:cleanError(error,config)});
    if (context.signal.aborted) throw new GenerationPendingError(jobId,"已停止本地查询或下载；远端任务仍可能继续，稍后可恢复查询");
    throw new GenerationPendingError(jobId,cleanError(error,config));
  }
}
function wait(ms:number,signal:AbortSignal) {
  return new Promise<void>((resolve,reject)=>{
    signal.throwIfAborted();
    const abort=()=>{clearTimeout(timer);signal.removeEventListener("abort",abort);reject(new DOMException("本地监控已停止","AbortError"));};
    const timer=setTimeout(()=>{signal.removeEventListener("abort",abort);resolve();},ms);
    signal.addEventListener("abort",abort,{once:true});
  });
}
export async function monitorAgentGeneration(jobId:string,context:AgentToolContext,options:GenerationRuntimeOptions={}) {
  for(let step=0;step<(options.maxPolls??40);step++) {
    const job=await checkAgentGeneration(jobId,context,options);
    if (job.status === "unknown") throw new GenerationPendingError(jobId,job.error ?? "提交结果未知，请核实供应商账户，不会自动重试");
    if (["downloaded","applied","conflict","failed"].includes(job.status)) return job;
    try { await wait(options.pollIntervalMs??Math.min(15000,3000+step*2000),context.signal); }
    catch { throw new GenerationPendingError(jobId,"本地监控已停止；远端任务没有取消，继续执行时只查询已有任务"); }
  }
  throw new GenerationPendingError(jobId,"本轮等待已暂停；任务仍在远端处理，继续执行可恢复查询，无需重新提交");
}
export async function prepareGenerationApply(jobId:string,context:AgentToolContext):Promise<AgentToolPreview> {
  const job=await jobForContext(jobId,context);
  if (!job.result) throw new Error("生成结果尚未下载到本地，不能写入目标");
  await flushPendingDrafts(job.projectId);
  let label="已删除或失效的目标";
  try { label=(await readGenerationTarget(job.target)).label; } catch { /* Apply records a visible conflict while preserving output. */ }
  return {summary:`将生成${job.kind === "image" ? "图片" : "视频"}写入「${label}」`,changes:[`目标槽位：${job.target.slot}`,`结果素材：${job.result.mediaId}`,"不会改变镜头文字、时长或人工状态。"],revision:job.baseRevision,target:{label,href:generationTargetHref(job.target)}};
}
export async function applyAgentGeneration(jobId:string,context:AgentToolContext) {
  let original;
  try { original=await jobForContext(jobId,context); await flushPendingDrafts(original.projectId); }
  catch(error) {throw new AtomicToolRollbackError(cleanError(error));}
  if (!original.result || !["downloaded","conflict","applied"].includes(original.status)) throw new AtomicToolRollbackError("没有可写入的本地生成结果");
  if (original.status === "applied") return executeAtomicTool(context,async()=>generationJobSummary(await jobForContext(jobId,context)));
  // Hash Blob inputs outside Dexie; atomic callback rechecks immutable record metadata.
  let records: MediaRecord[];
  try { records=await loadInputs(original); }
  catch(error) {
    return executeAtomicTool(context,async()=>generationJobSummary(await updateGenerationJob(original.id,{status:"conflict",error:cleanError(error)})));
  }
  return executeAtomicTool(context,async()=>{
    const job=await jobForContext(jobId,context);
    if (job.status === "applied") return generationJobSummary(job);
    if (!job.result || !["downloaded","conflict"].includes(job.status)) throw new Error("没有可写入的本地生成结果");
    let current;
    try { current=await readGenerationTarget(job.target); }
    catch { return generationJobSummary(await updateGenerationJob(job.id,{status:"conflict",error:"目标已删除或归属变化；生成结果已保留，未写入目标"})); }
    if (current.revision !== job.baseRevision || context.preview?.revision && context.preview.revision !== job.baseRevision) {
      return generationJobSummary(await updateGenerationJob(job.id,{status:"conflict",error:"目标已被修改；生成结果已保留，请手动确认后使用已有素材"}));
    }
    for (const record of records) {
      const saved=await db.media.get(record.id);
      if (!saved || saved.projectId!==record.projectId || saved.mimeType!==record.mimeType || saved.blob.size!==record.blob.size) throw new Error("输入素材已变化，结果未应用");
    }
    const result=await db.media.get(job.result.mediaId);
    if (!result || result.projectId !== job.projectId || !result.blob.size || !result.mimeType.startsWith(`${job.kind}/`)) throw new Error("生成结果素材已删除或类型不匹配");
    const slot={...current.slot,result:job.result};
    switch(job.target.kind) {
      case "shot": await setShotSlot(job.target.entityId,job.target.slot!,slot);break;
      case "character": await setCharacterSlot(job.target.entityId,job.target.slot,slot);break;
      case "scene": await setSceneSlot(job.target.entityId,job.target.slot,slot);break;
      case "prop": await setPropSlot(job.target.entityId,job.target.slot,slot);break;
      case "style": await setStyleSlot(job.target.entityId,job.target.slot,slot);break;
    }
    return generationJobSummary(await updateGenerationJob(job.id,{status:"applied",error:undefined}));
  });
}
