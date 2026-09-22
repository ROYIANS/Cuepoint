import { z } from "zod";
import { db } from "@/db/database";
import { resolveConnector } from "@/db/repo";
import { assertAudioProject, ownedAudioRow, assertAudioRevision } from "@/db/audioShared";
import { AtomicToolRollbackError } from "@/db/agentTools";
import type { AgentToolContext, AgentToolDefinition } from "./tools";
import type { AudioGenerationInput } from "@/domain/audioGeneration";
import { frozenProjectScope } from "./projectScope";
import { targetRevision } from "@/lib/productionRevision";
import { prepareAudioGeneration, submitAudioGeneration, refreshAudioGeneration, audioJobSummary } from "@/lib/audioGeneration/runtime";
import { validateGenerationInput } from "@/lib/audioGeneration/input";
import { SPEECH_VOICES } from "@/lib/ai/apimartAudio";
import * as s from "./businessSchemas";

const base = { projectId: s.id, connectorId: s.id };
const speech = s.object({ ...base, text: s.text(8192, 1), voice: s.choice(SPEECH_VOICES), speed: s.number(.25, 4), segmentId: s.optional(s.id), segmentRevision: s.optional(s.number(1, 1e9, true)) });
const music = s.object({ ...base, draftId: s.id, draftRevision: s.number(1, 1e9, true) });
const jobSpec = s.object({ projectId: s.id, jobId: s.id });
type Submission = { projectId: string; connectorId: string; input: AudioGenerationInput };
async function scope(projectId: string, context: AgentToolContext) {
  context.signal.throwIfAborted();
  const bound = await frozenProjectScope(context);
  if (!bound || bound !== projectId) throw new Error("请在目标项目绑定的对话中操作声音作品");
  await assertAudioProject(projectId);
}
async function inputState(args: Submission, context: AgentToolContext) {
  await scope(args.projectId, context);
  validateGenerationInput(args.input);
  const connector = await resolveConnector(args.connectorId);
  if (!connector || connector.definitionId !== "apimart" || !connector.apiKey.trim()) throw new Error("需要已配置的 APIMart 连接");
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
  return { revision: targetRevision({ args, target, connector: { id: connector.id, definitionId: connector.definitionId, baseUrl: connector.baseUrl, credentialRevision: targetRevision(connector.apiKey) } }), connector };
}
async function preview(args: Submission, context: AgentToolContext) {
  const state = await inputState(args, context);
  const changes = args.input.kind === "speech"
    ? [`APIMart · gpt-4o-mini-tts · ${args.input.voice} · ${args.input.speed} 倍速`, `文字：${args.input.text.slice(0, 1600)}`, "生成一个新配音版本，保留当前选用和时间线。"]
    : [`APIMart · ${args.input.settings.engine}`, `创作设置：${JSON.stringify(args.input.settings).slice(0, 1600)}`, "生成结果保存到音乐项目；不覆盖已有作品。"];
  return { summary: args.input.kind === "speech" ? "生成配音（付费）" : "生成音乐（付费）", revision: state.revision, changes,
    target: { label: "打开作品项目", href: `/p/${encodeURIComponent(args.projectId)}` } };
}
async function runSubmission(args: Submission, context: AgentToolContext) {
  const intentId = `agent-audio:${context.callId}`;
  const validate = async () => {
    const call = await db.agentToolCalls.get(context.callId), run = await db.agentRuns.get(context.runId);
    if (!call || call.runId !== context.runId || call.threadId !== context.threadId || call.status !== "running" || call.decision !== "approve" || !call.requiresConfirmation || run?.status !== "running") throw new AtomicToolRollbackError("生成请求尚未得到有效确认或执行已停止");
    if (!context.preview?.revision || context.preview.revision !== (await inputState(args, context)).revision) throw new AtomicToolRollbackError("生成目标、参数或连接已变化，请重新准备并确认");
  };
  try {
    await scope(args.projectId, context);
    const existing = await db.audioGenerationJobs.where("intentId").equals(intentId).first();
    if (existing) {
      if (existing.projectId !== args.projectId || existing.source.kind !== "agent" || existing.source.callId !== context.callId || existing.source.runId !== context.runId) throw new Error("生成任务归属不匹配");
      // A recovery repeats only local lookup / GET, never the paid submission.
      if (existing.status !== "prepared") return audioJobSummary(await refreshAudioGeneration(args.projectId, existing.id, { signal: context.signal }));
    }
    await validate();
    const job = existing ?? await prepareAudioGeneration({ ...args, intentId, source: { kind: "agent", callId: context.callId, runId: context.runId } });
    return audioJobSummary(await submitAudioGeneration(args.projectId, job.id, { signal: context.signal, beforeSubmit: validate }));
  } catch (error) {
    if (error instanceof AtomicToolRollbackError) throw error;
    // The durable job describes uncertainty if a POST started; preflight errors have no effect.
    const job = await db.audioGenerationJobs.where("intentId").equals(intentId).first();
    if (job && job.status !== "prepared") return { ...audioJobSummary(job), error: job.error ?? (error instanceof Error ? error.message : "生成未完成") };
    throw new AtomicToolRollbackError(error instanceof Error ? error.message : "生成准备失败");
  }
}
const speechArgs = (raw: unknown): Submission => {
  const args = speech.schema.parse(raw);
  return { projectId: args.projectId, connectorId: args.connectorId, input: { kind: "speech", text: args.text, voice: args.voice, speed: args.speed, segmentId: args.segmentId, segmentRevision: args.segmentRevision } };
};
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
  { name: "audio_generation_capabilities", title: "查看声音生成能力", description: "列出 APIMart 音频/音乐连接与已支持能力，不探测付费接口，不保证余额。", effect: "read", highRisk: () => false,
    parameters: { type: "object", properties: {}, additionalProperties: false }, parseArguments: raw => z.object({}).strict().parse(raw),
    async execute(_args, context) { const projectId = await frozenProjectScope(context); if (!projectId) throw new Error("请先绑定项目"); await scope(projectId, context); return {
      connectors: (await db.connectors.where("definitionId").equals("apimart").toArray()).map(c => ({ id: c.id, label: c.label, configured: !!c.apiKey.trim() })),
      speech: { model: "gpt-4o-mini-tts", voices: SPEECH_VOICES, maxCharacters: 4096, speed: [.25, 4] }, music: { engines: ["flowmusic", "suno"], sunoVersions: ["v6", "v6-wild", "v6-mini"] }, note: "先保存音乐草稿再 music_generate。付费请求必须经用户确认；不支持编曲或音频听取。",
    }; } },
  { name: "audio_generate_speech", title: "生成配音", description: "为当前音频项目生成一个新配音版本；提供真实段落 ID 和版本，先确认音色/文字。保留已有版本与时间线。", effect: "network", recovery: "repeatable", requiresConfirmation: true, highRisk: () => false,
    parameters: speech.json, parseArguments: raw => speech.schema.parse(raw), prepare: (raw, context) => preview(speechArgs(raw), context), execute: (raw, context) => runSubmission(speechArgs(raw), context) },
  { name: "music_generate", title: "生成音乐", description: "提交当前已保存音乐草稿的指定版本；先用音乐草稿工具准备参数。经用户确认后提交一次，后续只查询已有任务。", effect: "network", recovery: "repeatable", requiresConfirmation: true, highRisk: () => false,
    parameters: music.json, parseArguments: raw => music.schema.parse(raw), prepare: async (raw, context) => preview(await musicArgs(raw), context),
    async execute(raw, context) {
      let args: Submission;
      // Resolving local draft state has no network side effect. A stale draft
      // is a known rejection, not an uncertain paid submission.
      try { args = await musicArgs(raw, context); }
      catch (error) { throw new AtomicToolRollbackError(error instanceof Error ? error.message : "音乐草稿准备失败"); }
      return runSubmission(args, context);
    } },
  { name: "audio_generation_check", title: "查询声音生成结果", description: "对当前项目已存在的任务查询一次并保存可用结果；不会重新生成。pending/running 不等于成品，不要密集循环查询。", effect: "network", recovery: "repeatable", highRisk: () => false,
    parameters: jobSpec.json, parseArguments: raw => jobSpec.schema.parse(raw), async execute(raw, context) { const args = jobSpec.schema.parse(raw); await scope(args.projectId, context); return audioJobSummary(await refreshAudioGeneration(args.projectId, args.jobId, { signal: context.signal })); } },
];
