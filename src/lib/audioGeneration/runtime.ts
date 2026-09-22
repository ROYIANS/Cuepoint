import { describeAudioGeneration } from "./presentation";
import { db } from "@/db/database";
import { resolveConnector } from "@/db/repo";
import { addAudioTake } from "@/db/audio";
import { addMusicWork } from "@/db/music";
import { claimAudioGenerationJob, patchAudioGenerationJob, prepareAudioGenerationJob } from "@/db/audioGeneration";
import { AUDIO_TRANSACTION_TABLES, assertAudioProject, ownedAudioRow, assertAudioRevision } from "@/db/audioShared";
import type { AudioGenerationInput, AudioGenerationJob, AudioGenerationResult, AudioGenerationStatus, AudioTaskObservation } from "@/domain/audioGeneration";
import type { AudioSourceMetadata } from "@/domain/audio";
import { generateApimartSpeech, submitApimartMusic, getApimartMusicTask, downloadApimartAudio } from "@/lib/ai/apimartAudio";
import { generateMimoSpeech, MIMO_MODELS } from "@/lib/ai/mimoSpeech";
import { validateSpeechReference } from "./reference";
import type { ApimartRequestOptions } from "@/lib/ai/apimart";
import { normalizeBaseUrl } from "@/lib/ai/openaiCompatible";
import { audioBufferMetadata, decodeAudioBlob } from "@/lib/audio/engine";
import { createId, nowIso } from "@/lib/ids";
import { detectAudioMime, audioMimeExtension } from "@/lib/audio/mime";
import { musicWireInput, speechWireInput, validateGenerationInput } from "./input";
import { observeAudioTask } from "./observations";
import { inspectAudioGenerationOutputs } from "./outputEvidence";

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
  if (!value || value.definitionId !== job.connector.provider || !value.apiKey.trim() || normalizeBaseUrl(value.baseUrl) !== normalizeBaseUrl(job.connector.baseUrl)) throw new Error("生成连接已删除或地址发生变化，请恢复原连接后继续查询");
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
  const reference = input.kind === "speech" ? await validateSpeechReference(args.projectId, input) : undefined;
  const provider = input.kind === "speech" && input.mimo ? "mimo" : "apimart";
  const connector = await resolveConnector(args.connectorId);
  if (!connector || connector.definitionId !== provider || !connector.apiKey.trim()) throw new Error(`请先选择已配置密钥的 ${provider === "mimo" ? "MiMo" : "APIMart"} 连接`);
  return prepareAudioGenerationJob(args.projectId, { intentId: args.intentId ?? createId("audio-intent"), input,
    connector: { id: connector.id, provider, baseUrl: normalizeBaseUrl(connector.baseUrl) }, source: args.source ?? { kind: "manual" }, ...(reference ? { referenceFingerprint: reference.fingerprint } : {}) });
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
      const take = await addAudioTake(job.projectId, { ...metadata, mediaId, name: result.title, source: "tts", textSnapshot: result.finalTextPreview ?? latest.input.text,
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
    let reference = job.input.kind === "speech" ? await validateSpeechReference(projectId, job.input) : undefined;
    if (job.referenceFingerprint && reference?.fingerprint !== job.referenceFingerprint) throw new Error("克隆参考音频已变化，请重新准备生成");
    const credentials = await connection(job);
    options.signal?.throwIfAborted();
    await options.beforeSubmit?.();
    job = await claimAudioGenerationJob(projectId, job.id, job.revision, createId("submit"));
    try {
      await validateTarget(projectId, job.input);
      const current = await connection(job);
      if (current.apiKey !== credentials.apiKey) throw new Error("连接密钥已变化，请重新准备生成");
      await options.beforeSubmit?.();
      reference = job.input.kind === "speech" ? await validateSpeechReference(projectId, job.input) : undefined;
      if (job.referenceFingerprint && reference?.fingerprint !== job.referenceFingerprint) throw new Error("克隆参考音频已变化，请重新准备生成");
      options.signal?.throwIfAborted();
    } catch (error) { return change(job, { status: "failed", error: error instanceof Error ? error.message : "提交前检查失败" }); }
    if (job.input.kind === "speech") {
      const response = job.input.mimo
        ? await generateMimoSpeech(credentials, { text: job.input.text, voice: job.input.voice, mimo: job.input.mimo, referenceBlob: reference?.blob }, options)
        : await generateApimartSpeech(credentials, speechWireInput(job.input), options);
      if (!response.ok) return change(job, { status: ["network", "aborted", "protocol"].includes(response.kind) ? "uncertain" : "failed", error: response.message });
      const result: AudioGenerationResult = { key: `${job.id}:speech`, title: job.input.text.slice(0, 24) || "配音", provenance: { provider: job.connector.provider, model: job.input.mimo ? MIMO_MODELS[job.input.mimo.mode] : "gpt-4o-mini-tts", jobId: job.id },
        ...("finalTextPreview" in response && typeof response.finalTextPreview === "string" ? { finalTextPreview: response.finalTextPreview } : {}) };
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
    const results: AudioGenerationResult[] = [...job.results];
    const errors: string[] = [];
    const observed: AudioTaskObservation[] = [];
    const observe = (taskId: string, status: AudioTaskObservation["status"]) => {
      const row = observeAudioTask(taskId, status, nowIso(), job.taskObservations?.find(item => item.taskId === taskId));
      observed.push(row);
      return row;
    };
    const persistObservations = async () => {
      // During a partial pass, only this pass's verified processing can set running.
      const taskObservations = job.taskIds.flatMap(taskId => {
        const row = observed.find(item => item.taskId === taskId) ?? job.taskObservations?.find(item => item.taskId === taskId);
        return row ? [row] : [];
      });
      job = await change(job, { taskObservations, results: [...results], status: observed.some(row => row.status === "processing") ? "running" : "submitted",
        error: errors.join("；") || undefined });
    };
    let credentials: Awaited<ReturnType<typeof connection>>;
    try { credentials = await connection(job); }
    catch (error) {
      for (const taskId of job.taskIds) observe(taskId, "query-failed");
      errors.push(error instanceof Error ? error.message : "查询连接不可用，请恢复连接后重试查询");
      await persistObservations();
      return job;
    }
    for (const taskId of job.taskIds) {
      if (options.signal?.aborted) {
        // Preserve completed sibling responses; interrupted checks provide no new provider fact.
        for (const remaining of job.taskIds.filter(id => !observed.some(row => row.taskId === id))) observe(remaining, "query-failed");
        errors.push("查询已停止，未检查的任务状态尚未核实");
        await persistObservations();
        return job;
      }
      const response = await getApimartMusicTask(credentials, taskId, options);
      observe(taskId, response.ok ? response.task.status : "query-failed");
      if (!response.ok) errors.push(response.message);
      else if (response.task.status === "failed") errors.push(response.task.error ?? "音乐生成失败");
      else if (response.task.status === "unknown") errors.push("服务商返回未知状态，请稍后重新查询确认");
      else if (response.task.status === "completed") {
        if (response.task.error) errors.push(response.task.error);
        for (const track of response.task.tracks) {
          const key = `${taskId}:${track.audioIndex}`;
          if (results.some(row => row.key === key)) continue;
          results.push({ key, title: track.title, lyrics: track.lyrics, durationSec: track.duration,
            provenance: { provider: "apimart", model: job.input.kind === "music" ? job.input.settings.engine : "gpt-4o-mini-tts", jobId,
              taskId, audioIndex: track.audioIndex, clipId: track.clipId, audioUrl: track.audioUrl, coverUrl: track.imageUrl } });
        }
      }
      // Save every response before the next request; reload/Stop never discards earlier siblings.
      await persistObservations();
    }
    const allTerminal = observed.every(row => row.status === "completed" || row.status === "failed");
    const unresolvedStatus = observed.some(row => row.status === "processing") ? "running" : "submitted";
    const status = allTerminal ? errors.length ? "failed" : "remote-completed" : unresolvedStatus;
    job = await change(job, { status, error: errors.join("；") || undefined });
    if (!results.length || options.signal?.aborted) return job;
    return downloadResults(job, options, allTerminal ? errors.length ? "failed" : "saved" : unresolvedStatus, job.error);
  });
}

export function audioJobSummary(job: AudioGenerationJob) {
  const observation = describeAudioGeneration(job);
  return { id: job.id, projectId: job.projectId, revision: job.revision, status: job.status,
    statusLabel: observation.label, taskCounts: observation.counts, checkedAt: observation.checkedAt,
    taskObservations: job.taskObservations ?? [], source: job.source,
    ...(job.input.kind === "music" ? { draftId: job.input.draftId, draftRevision: job.input.draftRevision } : {}),
    error: job.error, taskIds: job.taskIds,
    results: job.results.map(({ title, takeId, workId, mediaId, deleted, error }) => ({ title, takeId, workId, mediaId, deleted, error })),
    note: "这是该任务的状态快照；source 表示原始提交来源，查询不代表本轮新提交。服务商状态以 taskObservations 的查询时间为准；历史 lastVerified 不代表当前状态。远端完成、本地保存与实际试听是不同阶段，未试听。" };
}

/** Reload job and current local outputs together; historical IDs alone prove no delivery. */
export async function readAudioJobSummary(projectId: string, jobId: string) {
  return db.transaction("r", AUDIO_TRANSACTION_TABLES, async () => {
    const job = await readJob(projectId, jobId);
    const outputs = await inspectAudioGenerationOutputs(job);
    return { ...audioJobSummary(job), outputs, inspectedAt: nowIso() };
  });
}
