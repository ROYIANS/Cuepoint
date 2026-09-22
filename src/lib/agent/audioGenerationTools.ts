import { z } from "zod";
import { db } from "@/db/database";
import { resolveConnector } from "@/db/repo";
import { assertAudioProject, ownedAudioRow, assertAudioRevision } from "@/db/audioShared";
import { AtomicToolRollbackError } from "@/db/agentTools";
import type { AgentToolContext, AgentToolDefinition } from "./tools";
import type { AudioGenerationInput } from "@/domain/audioGeneration";
import { requireBoundProjectScope } from "./projectScope";
import { targetRevision } from "@/lib/productionRevision";
import { prepareAudioGeneration, submitAudioGeneration, refreshAudioGeneration, readAudioJobSummary } from "@/lib/audioGeneration/runtime";
import { validateGenerationInput } from "@/lib/audioGeneration/input";
import { SPEECH_VOICES } from "@/lib/ai/apimartAudio";
import { MIMO_VOICES, MIMO_MODELS } from "@/lib/ai/mimoSpeech";
import { mimoSpeechSpec } from "./mimoSpeechSpec";
import { defaultMimoConnector, speakerSpeechProfile } from "@/lib/audioGeneration/defaults";
import { validateSpeechReference } from "@/lib/audioGeneration/reference";
import * as s from "./businessSchemas";

const base = { projectId: s.id, connectorId: s.id };
const speech = s.object({ projectId: s.id, connectorId: s.optional(s.id), text: s.text(8192), voice: s.optional(s.choice([...SPEECH_VOICES, ...MIMO_VOICES])), speed: s.optional(s.number(.25, 4)), mimo: s.optional(mimoSpeechSpec), speakerId: s.optional(s.id), speakerRevision: s.optional(s.number(1, 1e9, true)), segmentId: s.optional(s.id), segmentRevision: s.optional(s.number(1, 1e9, true)) });
const music = s.object({ ...base, draftId: s.id, draftRevision: s.number(1, 1e9, true) });
const jobSpec = s.object({ projectId: s.id, jobId: s.id });
type Submission = { projectId: string; connectorId: string; input: AudioGenerationInput; speakerId?: string; speakerRevision?: number };
async function scope(projectId: string, context: AgentToolContext) {
  context.signal.throwIfAborted();
  await requireBoundProjectScope(context, projectId);
  await assertAudioProject(projectId);
}
async function inputState(args: Submission, context: AgentToolContext) {
  await scope(args.projectId, context);
  validateGenerationInput(args.input);
  let speaker;
  if (args.speakerId) { speaker = await ownedAudioRow(db.audioSpeakers, args.projectId, args.speakerId); if (args.speakerRevision === undefined) throw new Error("指定说话人时必须提供当前版本"); assertAudioRevision(speaker, args.speakerRevision); }
  const connector = await resolveConnector(args.connectorId);
  const provider = args.input.kind === "speech" && args.input.mimo ? "mimo" : "apimart";
  if (!connector || connector.definitionId !== provider || !connector.apiKey.trim()) throw new Error(`需要已配置的 ${provider === "mimo" ? "MiMo" : "APIMart"} 连接`);
  const reference = args.input.kind === "speech" ? await validateSpeechReference(args.projectId, args.input) : undefined;
  let target: unknown;
  if (args.input.kind === "speech") {
    await assertAudioProject(args.projectId, "audio");
    if (args.input.segmentId) {
      const row = await ownedAudioRow(db.audioSegments, args.projectId, args.input.segmentId);
      if (args.input.segmentRevision === undefined) throw new Error("指定段落时必须提供当前版本");
      assertAudioRevision(row, args.input.segmentRevision);
      target = row;
    }
  } else {
    await assertAudioProject(args.projectId, "music");
    if (!args.input.draftId || args.input.draftRevision === undefined) throw new Error("请先准备音乐草稿");
    const row = await ownedAudioRow(db.musicDrafts, args.projectId, args.input.draftId);
    assertAudioRevision(row, args.input.draftRevision);
    target = row;
  }
  return { revision: targetRevision({ args, target: { target, speaker }, reference: reference ? { mediaId: reference.mediaId, fingerprint: reference.fingerprint, filename: reference.filename } : undefined, connector: { id: connector.id, definitionId: connector.definitionId, baseUrl: connector.baseUrl, credentialRevision: targetRevision(connector.apiKey) } }), connector, reference };
}
async function preview(args: Submission, context: AgentToolContext) {
  const state = await inputState(args, context);
  const changes = args.input.kind === "speech"
    ? [args.input.mimo ? `MiMo · ${MIMO_MODELS[args.input.mimo.mode]} · ${args.input.mimo.mode === "preset" ? args.input.voice : args.input.mimo.mode === "design" ? "设计音色" : "克隆音色"}` : `APIMart · gpt-4o-mini-tts · ${args.input.voice} · ${args.input.speed} 倍速`,
      ...(args.input.mimo ? [`音色与演绎指导：${args.input.mimo.instruction}`, ...(state.reference ? [`参考声音：${state.reference.filename}（${state.reference.mediaId}）`] : []), ...(args.input.mimo.optimizeTextPreview ? ["允许智能润色或自动生成播报文本；稿件原文保留。"] : [])] : []), `文字：${args.input.text.slice(0, 1600)}`, "生成一个新配音版本，保留当前选用和时间线。"]
    : [`APIMart · ${args.input.settings.engine}`, `创作设置：${JSON.stringify(args.input.settings).slice(0, 1600)}`, "生成结果保存到音乐项目；不覆盖已有作品。"];
  return { summary: args.input.kind === "speech" ? "生成配音（付费）" : "生成音乐（付费）", revision: state.revision, changes,
    target: { label: "打开作品项目", href: `/p/${encodeURIComponent(args.projectId)}` } };
}
async function runSubmission(args: Submission, context: AgentToolContext, resolveCurrent?: () => Promise<Submission>) {
  const intentId = `agent-audio:${context.callId}`;
  const validate = async () => {
    const call = await db.agentToolCalls.get(context.callId), run = await db.agentRuns.get(context.runId);
    if (!call || call.runId !== context.runId || call.threadId !== context.threadId || call.status !== "running" || call.decision !== "approve" || !call.requiresConfirmation || run?.status !== "running") throw new AtomicToolRollbackError("生成请求尚未得到有效确认或执行已停止");
    if (!context.preview?.revision || context.preview.revision !== (await inputState(resolveCurrent ? await resolveCurrent() : args, context)).revision) throw new AtomicToolRollbackError("生成目标、参数或连接已变化，请重新准备并确认");
  };
  try {
    await scope(args.projectId, context);
    const existing = await db.audioGenerationJobs.where("intentId").equals(intentId).first();
    if (existing) {
      if (existing.projectId !== args.projectId || existing.source.kind !== "agent" || existing.source.callId !== context.callId || existing.source.runId !== context.runId) throw new Error("生成任务归属不匹配");
      // A recovery repeats only local lookup / GET, never the paid submission.
      if (existing.status !== "prepared") {
        await refreshAudioGeneration(args.projectId, existing.id, { signal: context.signal });
        return readAudioJobSummary(args.projectId, existing.id);
      }
    }
    await validate();
    const job = existing ?? await prepareAudioGeneration({ ...args, intentId, source: { kind: "agent", callId: context.callId, runId: context.runId } });
    await submitAudioGeneration(args.projectId, job.id, { signal: context.signal, beforeSubmit: validate });
    return readAudioJobSummary(args.projectId, job.id);
  } catch (error) {
    if (error instanceof AtomicToolRollbackError) throw error;
    // The durable job describes uncertainty if a POST started; preflight errors have no effect.
    const job = await db.audioGenerationJobs.where("intentId").equals(intentId).first();
    if (job && job.status !== "prepared") return { ...await readAudioJobSummary(args.projectId, job.id), error: job.error ?? (error instanceof Error ? error.message : "生成未完成") };
    throw new AtomicToolRollbackError(error instanceof Error ? error.message : "生成准备失败");
  }
}
async function speechArgs(raw: unknown, context: AgentToolContext, recover = false): Promise<Submission> {
  const args = speech.schema.parse(raw);
  await scope(args.projectId, context);
  if (recover) {
    const existing = await db.audioGenerationJobs.where("intentId").equals(`agent-audio:${context.callId}`).first();
    if (existing && existing.status !== "prepared" && existing.projectId === args.projectId && existing.source.kind === "agent" && existing.source.callId === context.callId && existing.source.runId === context.runId) {
      return { projectId: args.projectId, connectorId: existing.connector.id, input: existing.input };
    }
  }
  let speakerId = args.speakerId;
  if (args.segmentId) {
    const segment = await ownedAudioRow(db.audioSegments, args.projectId, args.segmentId);
    if (speakerId && segment.speakerId && speakerId !== segment.speakerId) throw new Error("说话人与段落绑定不一致");
    speakerId ??= segment.speakerId;
  }
  if (args.speakerRevision !== undefined && !speakerId) throw new Error("说话人版本需要指定说话人");
  const speaker = speakerId ? await ownedAudioRow(db.audioSpeakers, args.projectId, speakerId) : undefined;
  if (speaker && args.speakerRevision !== undefined) assertAudioRevision(speaker, args.speakerRevision);
  const inherited = speakerSpeechProfile(speaker);
  const explicitApimart = !args.mimo && args.voice !== undefined && (SPEECH_VOICES as readonly string[]).includes(args.voice);
  const explicitMimoPreset = !args.mimo && args.voice !== undefined && (MIMO_VOICES as readonly string[]).includes(args.voice);
  const mimo = explicitApimart ? undefined : args.mimo ?? (explicitMimoPreset ? { mode: "preset" as const, instruction: "" } : inherited.mimo);
  const voice = args.voice ?? (args.mimo ? "mimo_default" : inherited.voice);
  const speed = args.speed ?? (mimo ? 1 : inherited.speed);
  const connectorId = args.connectorId ?? defaultMimoConnector(await db.connectors.toArray())?.id;
  if (!connectorId) throw new Error("请先配置 MiMo 连接，或明确提供 APIMart 连接");
  return { projectId: args.projectId, connectorId, ...(speaker ? { speakerId: speaker.id, speakerRevision: speaker.revision } : {}),
    input: { kind: "speech", text: args.text, voice, speed, ...(mimo ? { mimo } : {}), segmentId: args.segmentId, segmentRevision: args.segmentRevision } };
}
async function musicArgs(raw: unknown, context?: AgentToolContext): Promise<Submission> {
  const args = music.schema.parse(raw);
  if (context) {
    await scope(args.projectId, context);
    const existing = await db.audioGenerationJobs.where("intentId").equals(`agent-audio:${context.callId}`).first();
    if (existing && existing.status !== "prepared" && existing.projectId === args.projectId && existing.source.kind === "agent" && existing.source.callId === context.callId && existing.source.runId === context.runId) {
      return { projectId: args.projectId, connectorId: args.connectorId, input: existing.input };
    }
  }
  const draft = await ownedAudioRow(db.musicDrafts, args.projectId, args.draftId);
  assertAudioRevision(draft, args.draftRevision);
  return { projectId: args.projectId, connectorId: args.connectorId, input: { kind: "music", settings: draft.settings, draftId: draft.id, draftRevision: draft.revision } };
}
export const AUDIO_GENERATION_TOOL_NAMES = ["audio_generation_capabilities", "audio_generate_speech", "music_generate", "audio_generation_check"] as const;
export const AUDIO_GENERATION_TOOLS: readonly AgentToolDefinition[] = [
  { name: "audio_generation_capabilities", title: "查看声音生成能力", description: "列出 MiMo/APIMart 音频和音乐连接与已支持能力，不探测付费接口，不保证余额。", effect: "read", highRisk: () => false,
    parameters: { type: "object", properties: {}, additionalProperties: false }, parseArguments: raw => z.object({}).strict().parse(raw),
    async execute(_args, context) { const projectId = await requireBoundProjectScope(context); await scope(projectId, context); const connections = await db.connectors.where("definitionId").anyOf("apimart", "mimo").toArray(); return {
      defaultSpeech: { provider: "mimo", connectorId: defaultMimoConnector(connections)?.id ?? null, profile: speakerSpeechProfile(), note: "未配置 MiMo 时请先添加连接，不自动改用 APIMart；保存的角色音色优先。" },
      connectors: connections.map(c => ({ id: c.id, label: c.label, provider: c.definitionId, configured: !!c.apiKey.trim() })),
      mimo: { models: MIMO_MODELS, voices: MIMO_VOICES, speed: 1, reference: "clone requires an owned WAV/MP3 media ID; encoded sample <=10 MB", design: "instruction required; optimizeTextPreview explicitly permits text rewrite or empty-text audition" },
      speech: { provider: "apimart", model: "gpt-4o-mini-tts", voices: SPEECH_VOICES, maxCharacters: 4096, speed: [.25, 4] }, music: { provider: "apimart", engines: ["flowmusic", "suno"], sunoVersions: ["v6", "v6-wild", "v6-mini"] }, note: "先保存音乐草稿再 music_generate。付费请求必须经用户确认；不支持编曲或音频听取。",
    }; } },
  { name: "audio_generate_speech", title: "生成配音", description: "生成配音或音色试音；默认 MiMo，connectorId/voice/speed 可省略。speakerId 或段落绑定角色可继承已保存的音色；提供段落时需 segmentRevision。明确的 APIMart 参数仍可使用；MiMo 克隆用项目内参考 mediaId，设计默认不改写文本。必须确认后才生成。", effect: "network", recovery: "repeatable", requiresConfirmation: true, highRisk: () => false,
    parameters: speech.json, parseArguments: raw => speech.schema.parse(raw), prepare: async (raw, context) => preview(await speechArgs(raw, context), context), execute: async (raw, context) => {
      try { return await runSubmission(await speechArgs(raw, context, true), context, () => speechArgs(raw, context)); }
      catch (error) { throw new AtomicToolRollbackError(error instanceof Error ? error.message : "配音准备失败"); }
    } },
  { name: "music_generate", title: "生成音乐", description: "提交当前已保存音乐草稿的指定版本；先用音乐草稿工具准备参数。经用户确认后提交一次，后续只查询已有任务。", effect: "network", recovery: "repeatable", requiresConfirmation: true, highRisk: () => false,
    parameters: music.json, parseArguments: raw => music.schema.parse(raw), prepare: async (raw, context) => {
      const args = music.schema.parse(raw);
      await scope(args.projectId, context);
      return preview(await musicArgs(args), context);
    },
    async execute(raw, context) {
      let args: Submission;
      // Resolving local draft state has no network side effect. A stale draft
      // is a known rejection, not an uncertain paid submission.
      try { args = await musicArgs(raw, context); }
      catch (error) { throw new AtomicToolRollbackError(error instanceof Error ? error.message : "音乐草稿准备失败"); }
      return runSubmission(args, context);
    } },
  { name: "audio_generation_check", title: "查询声音生成结果", description: "对当前项目已存在的任务查询一次并保存可用结果；不会重新生成。pending/running 不等于成品，不要密集循环查询。", effect: "network", recovery: "repeatable", highRisk: () => false,
    parameters: jobSpec.json, parseArguments: raw => jobSpec.schema.parse(raw), async execute(raw, context) { const args = jobSpec.schema.parse(raw); await scope(args.projectId, context); await refreshAudioGeneration(args.projectId, args.jobId, { signal: context.signal }); return readAudioJobSummary(args.projectId, args.jobId); } },
];
