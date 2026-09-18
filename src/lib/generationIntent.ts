import { db } from "@/db/database";
import type { GenerationIntent, GenerationMediaInput, ProductionChange, ProductionTarget, ProposalSource, SourceRevision } from "@/domain/production";
import type { GenerationResult } from "@/domain/types";
import { generationParameters, OUTPUT_PROFILE_VERSION, validateGenerationDefaults, type ProjectGenerationDefaults } from "@/domain/output";
import type { ProductionContext } from "@/lib/productionContext";
import { targetRevision, validateProductionTarget } from "@/lib/productionRevision";
import { createId } from "@/lib/ids";

const STATUSES = ["prepared", "submitted", "running", "succeeded", "failed", "cancelled"] as const;
const ROLES = ["first-frame", "last-frame", "reference-image", "reference-video"] as const;
const PARAMETER_KEYS = ["prompt", "size", "resolution", "n", "duration", "aspect_ratio", "mode", "profileVersion"];
const isVideo = (target: ProductionTarget) => target.kind === "shot" && target.slot === "clip";
function record(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("生成任务格式无效");
  return raw as Record<string, unknown>;
}
function text(raw: unknown, label: string): string {
  if (typeof raw !== "string" || !raw.trim()) throw new Error(`${label}不能为空`);
  return raw;
}
function resultValue(raw: unknown, target: ProductionTarget): GenerationResult {
  const result = record(raw);
  const kind = isVideo(target) ? "video" : "image";
  if (result.kind !== kind) throw new Error("生成结果类型与目标槽位不匹配");
  return { mediaId: text(result.mediaId, "结果素材"), kind };
}
function revisions(raw: unknown): SourceRevision[] {
  if (!Array.isArray(raw)) throw new Error("缺少来源版本");
  return raw.map((item) => {
    const row = record(item);
    const revision = text(row.revision, "来源版本");
    if (!/^sha256-v1:[a-f0-9]{64}$/.test(revision)) throw new Error("来源版本格式无效");
    return { kind: text(row.kind, "来源类型"), id: text(row.id, "来源标识"), revision };
  });
}

/** Validate the currently verified profiles only; unknown fields never enter an intent. */
export function validateGenerationIntent(raw: unknown): GenerationIntent {
  const row = record(raw);
  const target = validateProductionTarget(row.target);
  if (!target.slot) throw new Error("生成任务必须明确素材槽位");
  const provider = text(row.provider, "供应商"); const model = text(row.model, "模型");
  const parameters = record(row.parameters);
  for (const [key, value] of Object.entries(parameters)) {
    if (!PARAMETER_KEYS.includes(key) || !(typeof value === "string" || typeof value === "boolean" || typeof value === "number" && Number.isFinite(value))) throw new Error(`不支持的生成参数：${key}`);
  }
  text(parameters.prompt, "提示词");
  const video = isVideo(target);
  const config = video ? { video: { provider, model, profileVersion: parameters.profileVersion, mode: parameters.mode,
    aspectRatio: parameters.mode === "frames" ? "adaptive" : parameters.aspect_ratio, resolution: parameters.resolution, duration: parameters.duration } }
    : { image: { provider, model, profileVersion: parameters.profileVersion, size: parameters.size, resolution: parameters.resolution } };
  const errors = validateGenerationDefaults(config);
  if (errors.length) throw new Error(errors.join("；"));
  if (!video && (parameters.n !== 1 || parameters.mode !== undefined || parameters.duration !== undefined || parameters.aspect_ratio !== undefined)) throw new Error("图片任务参数不兼容");
  if (video && (parameters.n !== undefined || parameters.size !== undefined || parameters.mode === "frames" && parameters.aspect_ratio !== undefined)) throw new Error("视频任务参数不兼容");
  if (!Array.isArray(row.inputs)) throw new Error("生成输入素材格式无效");
  const inputs: GenerationMediaInput[] = row.inputs.map((rawInput) => {
    const input = record(rawInput);
    if (!(ROLES as readonly unknown[]).includes(input.role)) throw new Error("必须明确输入素材用途");
    return { mediaId: text(input.mediaId, "输入素材"), role: input.role as GenerationMediaInput["role"] };
  });
  if (new Set(inputs.map((item) => `${item.role}:${item.mediaId}`)).size !== inputs.length) throw new Error("输入素材用途重复");
  for (const role of ["first-frame", "last-frame"]) if (inputs.filter((item) => item.role === role).length > 1) throw new Error("首尾帧用途不能重复");
  if (!video && inputs.some((item) => item.role !== "reference-image")) throw new Error("图片任务仅支持参考图片输入");
  if (!video && inputs.length > 15) throw new Error("GPT Image 2 最多支持 15 张参考图片");
  if (video) {
    if ((parameters.prompt as string).length > 7000) throw new Error("MiniMax H3 提示词不能超过 7000 字符");
    if (inputs.filter((item) => item.role === "reference-image").length > 9 || inputs.filter((item) => item.role === "reference-video").length > 3) throw new Error("MiniMax H3 参考素材数量超出限制");
    if (parameters.mode === "text" && inputs.length) throw new Error("文字生视频不能携带素材输入");
    if (parameters.mode === "frames" && (!inputs.some((item) => item.role === "first-frame") || inputs.some((item) => item.role !== "first-frame" && item.role !== "last-frame"))) throw new Error("首尾帧方式需要明确首帧，可选尾帧");
    if (parameters.mode === "reference" && (!inputs.length || inputs.some((item) => item.role !== "reference-image" && item.role !== "reference-video"))) throw new Error("参考素材方式需要明确参考图片或视频");
  }
  if (!(STATUSES as readonly unknown[]).includes(row.status)) throw new Error("生成任务状态无效");
  const status = row.status as GenerationIntent["status"];
  const baseRevision = text(row.baseRevision, "目标版本");
  if (!/^sha256-v1:[a-f0-9]{64}$/.test(baseRevision)) throw new Error("目标版本格式无效");
  const sourceRevisions = revisions(row.sourceRevisions);
  if (!sourceRevisions.some((source) => source.kind === target.kind && source.id === target.entityId && source.revision === baseRevision)) throw new Error("目标与上下文来源版本不匹配");
  if (status === "succeeded" && !row.result) throw new Error("成功任务缺少完整结果");
  if (status !== "succeeded" && row.result !== undefined) throw new Error("未成功任务不能携带结果");
  if (status === "failed" && (typeof row.error !== "string" || !row.error.trim())) throw new Error("失败任务缺少原因");
  if (status !== "failed" && row.error !== undefined) throw new Error("当前任务状态不能携带失败原因");
  if (status === "prepared" && row.providerTaskId !== undefined) throw new Error("未提交任务不能携带供应商任务标识");
  return {
    id: text(row.id, "任务标识"), target, baseRevision, sourceRevisions, provider, model,
    parameters: { ...parameters } as GenerationIntent["parameters"], inputs, status,
    ...(row.providerTaskId === undefined ? {} : { providerTaskId: text(row.providerTaskId, "供应商任务标识") }),
    ...(status === "failed" ? { error: row.error as string } : {}),
    ...(status === "succeeded" ? { result: resultValue(row.result, target) } : {}),
  };
}

async function preflight(intent: GenerationIntent, checkResult = false) {
  await db.transaction("r", [db.projects, db.episodes, db.shots, db.characters, db.scenes, db.props, db.styles, db.media], async () => {
    const target = intent.target;
    if (!await db.projects.get(target.projectId)) throw new Error("生成目标项目已删除");
    const entity = target.kind === "shot" ? await db.shots.get(target.entityId) : target.kind === "character" ? await db.characters.get(target.entityId) : target.kind === "scene" ? await db.scenes.get(target.entityId) : target.kind === "prop" ? await db.props.get(target.entityId) : await db.styles.get(target.entityId);
    if (!entity || entity.projectId !== target.projectId) throw new Error("生成目标不存在或归属不匹配");
    if (target.kind === "shot") {
      const episode = await db.episodes.get(target.episodeId);
      if (!episode || episode.projectId !== target.projectId || !("episodeId" in entity) || entity.episodeId !== target.episodeId) throw new Error("生成镜头不属于当前集");
    }
    if (targetRevision(entity) !== intent.baseRevision) throw new Error("生成目标已修改，请重新确认上下文");
    const requested = intent.inputs.map((input) => ({ mediaId: input.mediaId, kind: input.role === "reference-video" ? "video" : "image" }));
    if (checkResult && intent.result) requested.push(intent.result);
    const media = await db.media.bulkGet(requested.map((item) => item.mediaId));
    for (const [index, item] of media.entries()) {
      if (!item || item.projectId !== target.projectId || !item.blob?.size || !item.mimeType.startsWith(`${requested[index]!.kind}/`)) throw new Error("生成素材不存在、归属或类型不匹配");
    }
  });
}

export async function prepareGenerationIntent(input: {
  context: ProductionContext; target: ProductionTarget; prompt: string;
  config?: ProjectGenerationDefaults; inputs?: GenerationMediaInput[];
}): Promise<GenerationIntent> {
  const target = validateProductionTarget(input.target);
  if (input.context.project.id !== target.projectId || target.kind === "shot" && (input.context.episode.id !== target.episodeId || input.context.shot.id !== target.entityId)) throw new Error("生成目标与上下文不匹配");
  const source = input.context.sourceRevisions.find((item) => item.kind === target.kind && item.id === target.entityId);
  if (!source) throw new Error("上下文不包含此生成目标");
  const config = input.config ?? input.context.output;
  const video = isVideo(target);
  const selected = video ? config.video : config.image;
  if (!selected) throw new Error("尚未配置此类生成默认值");
  const native = generationParameters(config, video ? "video" : "image");
  const { model: _model, ...parameters } = native;
  const intent = validateGenerationIntent({ id: createId("gen"), target, baseRevision: source.revision, sourceRevisions: input.context.sourceRevisions,
    provider: selected.provider, model: selected.model, parameters: { ...parameters, prompt: input.prompt, profileVersion: OUTPUT_PROFILE_VERSION, ...(video ? { mode: config.video!.mode } : {}) },
    inputs: input.inputs ?? [], status: "prepared" });
  await preflight(intent);
  return intent;
}

const TRANSITIONS: Record<GenerationIntent["status"], GenerationIntent["status"][]> = {
  prepared: ["submitted", "cancelled"], submitted: ["running", "succeeded", "failed", "cancelled"], running: ["succeeded", "failed", "cancelled"], succeeded: [], failed: [], cancelled: [],
};

export function transitionGenerationIntent(raw: GenerationIntent, status: GenerationIntent["status"], detail: { providerTaskId?: string; error?: string; result?: GenerationResult } = {}): GenerationIntent {
  const intent = validateGenerationIntent(raw);
  if (!TRANSITIONS[intent.status].includes(status)) throw new Error(`不能从 ${intent.status} 切换至 ${status}`);
  return validateGenerationIntent({ ...intent, ...detail, status });
}

/** Read-only preparation; caller must create a reviewed proposal and recheck atomically on apply. */
export async function generationIntentToProposalInput(raw: GenerationIntent): Promise<{
  target: ProductionTarget; change: ProductionChange; source: ProposalSource; expectedRevision: string;
}> {
  const intent = validateGenerationIntent(raw);
  if (intent.status !== "succeeded" || !intent.result) throw new Error("只有完整成功的生成结果可以形成提案");
  await preflight(intent, true);
  return { target: intent.target, change: { kind: "slot-result", result: intent.result }, expectedRevision: intent.baseRevision,
    source: { kind: "generation", intentId: intent.id, provider: intent.provider, model: intent.model, providerTaskId: intent.providerTaskId, sourceRevisions: intent.sourceRevisions } };
}
