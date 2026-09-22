import { db } from "@/db/database";
import { resolveConnector } from "@/db/repo";
import { addAudioTake } from "@/db/audio";
import { addMusicWork } from "@/db/music";
import { claimAudioGenerationJob, patchAudioGenerationJob, prepareAudioGenerationJob } from "@/db/audioGeneration";
import { AUDIO_TRANSACTION_TABLES, assertAudioProject, ownedAudioRow, assertAudioRevision } from "@/db/audioShared";
import type { AudioGenerationInput, AudioGenerationJob, AudioGenerationResult, AudioGenerationStatus } from "@/domain/audioGeneration";
import type { AudioSourceMetadata } from "@/domain/audio";
import { generateApimartSpeech, submitApimartMusic, getApimartMusicTask, downloadApimartAudio } from "@/lib/ai/apimartAudio";
import type { ApimartRequestOptions } from "@/lib/ai/apimart";
import { normalizeBaseUrl } from "@/lib/ai/openaiCompatible";
import { audioBufferMetadata, decodeAudioBlob } from "@/lib/audio/engine";
import { createId } from "@/lib/ids";
import { detectAudioMime, audioMimeExtension } from "@/lib/audio/mime";
import { musicWireInput, speechWireInput, validateGenerationInput } from "./input";

export interface AudioGenerationOptions extends ApimartRequestOptions {
  /** Test seam; production always validates through a real audio decoder. */
  decode?: (blob: Blob) => Promise<AudioSourceMetadata>;
  beforeSubmit?: () => Promise<void>;
}
const localLocks = new Map<string, Promise<unknown>>();
async function locked<T>(id: string, operation: () => Promise<T>): Promise<T> {
  if (typeof navigator !== "undefined" && navigator.locks) return navigator.locks.request(`cuepoint.audio-job.${id}`, operation);
  const previous = localLocks.get(id) ?? Promise.resolve();
  const pending = previous.catch(() => {}).then(operation);
  localLocks.set(id, pending);
  try { return await pending; } finally { if (localLocks.get(id) === pending) localLocks.delete(id); }
}
const readJob = (projectId: string, id: string) => ownedAudioRow(db.audioGenerationJobs, projectId, id);
const change = (job: AudioGenerationJob, patch: Parameters<typeof patchAudioGenerationJob>[3]) => patchAudioGenerationJob(job.projectId, job.id, job.revision, patch);
async function connection(job: Pick<AudioGenerationJob, "connector">) {
  const value = await resolveConnector(job.connector.id);
  if (!value || value.definitionId !== "apimart" || !value.apiKey.trim() || normalizeBaseUrl(value.baseUrl) !== normalizeBaseUrl(job.connector.baseUrl)) throw new Error("APIMart 连接已删除或地址发生变化，请恢复原连接后继续查询");
  return value;
}
async function validateTarget(projectId: string, input: AudioGenerationInput) {
  await assertAudioProject(projectId, input.kind === "speech" ? "audio" : "music");
  if (input.kind === "speech" && input.segmentId) {
    const segment = await ownedAudioRow(db.audioSegments, projectId, input.segmentId);
    if (input.segmentRevision !== undefined) assertAudioRevision(segment, input.segmentRevision);
  }
  if (input.kind === "music" && input.draftId) {
    const draft = await ownedAudioRow(db.musicDrafts, projectId, input.draftId);
    if (input.draftRevision !== undefined) assertAudioRevision(draft, input.draftRevision);
  }
}
export async function prepareAudioGeneration(args: {
  projectId: string; connectorId: string; input: AudioGenerationInput; intentId?: string; source?: AudioGenerationJob["source"];
}): Promise<AudioGenerationJob> {
  const input = validateGenerationInput(args.input);
  await validateTarget(args.projectId, input);
  const connector = await resolveConnector(args.connectorId);
  if (!connector || connector.definitionId !== "apimart" || !connector.apiKey.trim()) throw new Error("请先选择已配置密钥的 APIMart 连接");
  return prepareAudioGenerationJob(args.projectId, { intentId: args.intentId ?? createId("audio-intent"), input,
    connector: { id: connector.id, provider: "apimart", baseUrl: normalizeBaseUrl(connector.baseUrl) }, source: args.source ?? { kind: "manual" } });
}
async function persistResult(job: AudioGenerationJob, result: AudioGenerationResult, blob: Blob, options: AudioGenerationOptions) {
  const metadata = await (options.decode ?? (async audio => audioBufferMetadata(await decodeAudioBlob(audio))))(blob);
  const mime = await detectAudioMime(blob);
  options.signal?.throwIfAborted();
  return db.transaction("rw", AUDIO_TRANSACTION_TABLES, async () => {
    const latest = await readJob(job.projectId, job.id);
    await assertAudioProject(job.projectId);
    const prior = latest.results.find(row => row.key === result.key);
    if (prior?.deleted || prior?.takeId || prior?.workId) return latest;
    const mediaId = createId("med");
    const media = { id: mediaId, projectId: job.projectId, filename: `${result.title || "音频"}.${audioMimeExtension(mime)}`, mimeType: mime, blob: new Blob([blob], { type: mime }) };
    let saved: AudioGenerationResult;
    if (latest.input.kind === "speech") {
      const segment = latest.input.segmentId ? await db.audioSegments.get(latest.input.segmentId) : undefined;
      const take = await addAudioTake(job.projectId, { ...metadata, mediaId, name: result.title, source: "tts", textSnapshot: latest.input.text,
        ...(segment?.projectId === job.projectId ? { segmentId: segment.id } : {}), provenance: result.provenance }, media);
      saved = { ...result, mediaId, takeId: take.id, durationSec: metadata.durationSec, error: undefined };
    } else {
      const work = await addMusicWork(job.projectId, { ...metadata, mediaId, title: result.title, notes: "", favorite: false,
        lyrics: result.lyrics ?? "", settings: latest.input.settings, provenance: result.provenance }, media);
      saved = { ...result, mediaId, workId: work.id, durationSec: metadata.durationSec, error: undefined };
    }
    // Only this job owns its temporary raw speech response; promotion is atomic.
    if (prior?.mediaId && !prior.takeId && !prior.workId && prior.mediaId !== mediaId) await db.media.delete(prior.mediaId);
    return change(latest, { results: latest.results.map(row => row.key === result.key ? saved : row) });
  });
}
async function downloadResults(job: AudioGenerationJob, options: AudioGenerationOptions, finishStatus: AudioGenerationStatus = "saved", monitoringError?: string): Promise<AudioGenerationJob> {
  job = await change(job, { status: "downloading", error: undefined });
  const errors: string[] = [];
  for (const result of job.results) {
    if (result.deleted || result.takeId || result.workId) continue;
    try {
      options.signal?.throwIfAborted();
      let blob = result.mediaId ? (await db.media.get(result.mediaId))?.blob : undefined;
      if (!blob && result.provenance.audioUrl) {
        const downloaded = await downloadApimartAudio(result.provenance.audioUrl, options);
        if (!downloaded.ok) throw new Error(downloaded.message);
        blob = downloaded.blob;
      }
      if (!blob) throw new Error("原始音频暂不可用，请保留任务并重试下载");
      job = await persistResult(job, result, blob, options);
    } catch (error) {
      const message = error instanceof Error ? error.message : "无法保存音频，请重试下载";
      errors.push(`${result.title}：${message}`);
      job = await readJob(job.projectId, job.id);
      job = await change(job, { results: job.results.map(row => row.key === result.key ? { ...row, error: message } : row) });
      if (options.signal?.aborted) break;
    }
  }
  return change(job, { status: errors.length && finishStatus === "saved" ? "remote-completed" : finishStatus,
    error: [monitoringError, ...errors].filter(Boolean).join("；") || undefined });
}
export async function submitAudioGeneration(projectId: string, jobId: string, options: AudioGenerationOptions = {}): Promise<AudioGenerationJob> {
  return locked(jobId, async () => {
    let job = await readJob(projectId, jobId);
    if (job.status !== "prepared" || job.dormant) return job;
    if (job.source.kind === "agent" && !options.beforeSubmit) throw new Error("助手生成需要通过已确认的工具调用提交");
    validateGenerationInput(job.input);
    await validateTarget(projectId, job.input);
    const credentials = await connection(job);
    options.signal?.throwIfAborted();
    await options.beforeSubmit?.();
    job = await claimAudioGenerationJob(projectId, job.id, job.revision, createId("submit"));
    try {
      await validateTarget(projectId, job.input);
      const current = await connection(job);
      if (current.apiKey !== credentials.apiKey) throw new Error("连接密钥已变化，请重新准备生成");
      await options.beforeSubmit?.();
      options.signal?.throwIfAborted();
    } catch (error) { return change(job, { status: "failed", error: error instanceof Error ? error.message : "提交前检查失败" }); }
    if (job.input.kind === "speech") {
      const response = await generateApimartSpeech(credentials, speechWireInput(job.input), options);
      if (!response.ok) return change(job, { status: ["network", "aborted", "protocol"].includes(response.kind) ? "uncertain" : "failed", error: response.message });
      const result: AudioGenerationResult = { key: `${job.id}:speech`, title: job.input.text.slice(0, 24) || "配音", provenance: { provider: "apimart", model: "gpt-4o-mini-tts", jobId: job.id } };
      // Persist returned bytes before decoding, so interrupted local processing can recover without another paid request.
      job = await db.transaction("rw", AUDIO_TRANSACTION_TABLES, async () => {
        await assertAudioProject(projectId);
        const rawId = createId("med");
        await db.media.add({ id: rawId, projectId, filename: "speech.wav", mimeType: response.blob.type, blob: response.blob });
        return change(job, { status: "remote-completed", results: [{ ...result, mediaId: rawId }] });
      });
      return downloadResults(job, options);
    }
    const response = await submitApimartMusic(credentials, musicWireInput(job.input.settings), options);
    if (!response.ok) return change(job, { status: ["network", "aborted", "protocol"].includes(response.kind) ? "uncertain" : "failed", error: response.message });
    return change(job, { status: "submitted", taskIds: response.taskIds, error: undefined });
  });
}
/** One bounded monitoring pass. Mounting a workspace may call this, never submit. */
export async function refreshAudioGeneration(projectId: string, jobId: string, options: AudioGenerationOptions = {}): Promise<AudioGenerationJob> {
  return locked(jobId, async () => {
    let job = await readJob(projectId, jobId);
    if (job.dormant || job.status === "saved" || job.status === "prepared") return job;
    await assertAudioProject(projectId);
    if (job.status === "submitting") return change(job, { status: "uncertain", error: "提交过程已中断，结果尚不确定；请核实后再创建新的生成" });
    if ((job.status === "remote-completed" || job.status === "downloading" && job.input.kind === "speech") && job.results.length) return downloadResults(job, options);
    if (!job.taskIds.length) return job;
    const credentials = await connection(job);
    const results: AudioGenerationResult[] = [...job.results];
    const errors: string[] = [];
    let allTerminal = true;
    for (const taskId of job.taskIds) {
      options.signal?.throwIfAborted();
      const response = await getApimartMusicTask(credentials, taskId, options);
      if (!response.ok) { errors.push(response.message); allTerminal = false; continue; }
      if (response.task.status === "failed") { errors.push(response.task.error ?? "音乐生成失败"); continue; }
      if (response.task.status === "unknown") { errors.push(`服务商返回未知状态：${response.task.providerStatus.slice(0, 80)}，请手动查询确认`); allTerminal = false; continue; }
      if (response.task.status !== "completed") { allTerminal = false; continue; }
      if (response.task.error) errors.push(response.task.error);
      for (const track of response.task.tracks) {
        const key = `${taskId}:${track.audioIndex}`;
        if (results.some(row => row.key === key)) continue;
        results.push({ key, title: track.title, lyrics: track.lyrics, durationSec: track.duration,
          provenance: { provider: "apimart", model: job.input.kind === "music" ? job.input.settings.engine : "gpt-4o-mini-tts", jobId,
            taskId, audioIndex: track.audioIndex, clipId: track.clipId, audioUrl: track.audioUrl, coverUrl: track.imageUrl } });
      }
    }
    const status = allTerminal ? errors.length ? "failed" : "remote-completed" : "running";
    job = await change(job, { status, results, error: errors.join("；") || undefined });
    if (!results.length) return job;
    return downloadResults(job, options, allTerminal ? errors.length ? "failed" : "saved" : "running", job.error);
  });
}

export function audioJobSummary(job: AudioGenerationJob) {
  return { id: job.id, projectId: job.projectId, status: job.status, error: job.error, taskIds: job.taskIds,
    results: job.results.map(({ title, takeId, workId, mediaId, error }) => ({ title, takeId, workId, mediaId, error })),
    note: job.status === "saved" ? "音频已保存在项目中；配音版本仍需明确选用和放入时间线。" : "这是任务状态，不代表已有可用成品。" };
}
