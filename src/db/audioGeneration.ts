import { db } from "./database";
import type { AudioGenerationJob, AudioGenerationStatus } from "@/domain/audioGeneration";
import { AUDIO_TRANSACTION_TABLES, assertAudioProject, assertAudioRevision, finiteAudioNumber, newAudioRow, ownedAudioRow, touchAudioProject } from "./audioShared";
import { validateMusicSettings } from "./music";
import { validateGenerationInput } from "@/lib/audioGeneration/input";
import { validateSpeechReference } from "@/lib/audioGeneration/reference";
import { nowIso } from "@/lib/ids";

export async function validateAudioGenerationJob(row: AudioGenerationJob) {
  await assertAudioProject(row.projectId, row.input.kind === "speech" ? "audio" : "music");
  if (!row.intentId || !row.connector.id || !["apimart", "mimo"].includes(row.connector.provider)) throw new Error("生成任务标识无效");
  if (row.input.kind === "speech") {
    if (Boolean(row.input.mimo) !== (row.connector.provider === "mimo")) throw new Error("配音设置与服务商不匹配");
    if (row.input.mimo) {
      validateGenerationInput(row.input);
      const reference = await validateSpeechReference(row.projectId, row.input);
      if (row.referenceFingerprint && row.referenceFingerprint !== reference?.fingerprint) throw new Error("克隆参考音频已变化，请重新准备生成");
    }
    if (!row.input.mimo && (!row.input.text.trim() || [...row.input.text].length > 4096)) throw new Error("配音文本需要 1–4096 个字符");
    finiteAudioNumber(row.input.speed, "语速", 0.25, 4);
    if (row.input.segmentId) await ownedAudioRow(db.audioSegments, row.projectId, row.input.segmentId);
  } else {
    if (row.connector.provider !== "apimart") throw new Error("音乐生成仅支持 APIMart");
    validateMusicSettings(row.input.settings);
    if (row.input.draftId) await ownedAudioRow(db.musicDrafts, row.projectId, row.input.draftId);
  }
}
export async function prepareAudioGenerationJob(projectId: string, input: Pick<AudioGenerationJob, "intentId" | "input" | "connector" | "source" | "referenceFingerprint">): Promise<AudioGenerationJob> {
  return db.transaction("rw", AUDIO_TRANSACTION_TABLES, async () => {
    const existing = await db.audioGenerationJobs.where("intentId").equals(input.intentId).first();
    if (existing) {
      if (existing.projectId !== projectId || JSON.stringify(existing.input) !== JSON.stringify(input.input) || JSON.stringify(existing.connector) !== JSON.stringify(input.connector) || JSON.stringify(existing.source) !== JSON.stringify(input.source)) throw new Error("生成意图已存在且参数不同");
      await assertAudioProject(projectId);
      return existing;
    }
    const row = newAudioRow<AudioGenerationJob>(projectId, "agj", { ...input, status: "prepared", taskIds: [], results: [] });
    await validateAudioGenerationJob(row);
    if (row.input.kind === "speech" && row.input.mimo?.mode === "clone") {
      row.referenceFingerprint = (await validateSpeechReference(projectId, row.input))!.fingerprint;
    }
    await db.audioGenerationJobs.add(row);
    await touchAudioProject(projectId);
    return row;
  });
}
export async function claimAudioGenerationJob(projectId: string, id: string, revision: number, owner: string): Promise<AudioGenerationJob> {
  return db.transaction("rw", AUDIO_TRANSACTION_TABLES, async () => {
    const row = await ownedAudioRow(db.audioGenerationJobs, projectId, id);
    assertAudioRevision(row, revision);
    await validateAudioGenerationJob(row);
    if (row.dormant || row.status !== "prepared" || row.claim) throw new Error("生成任务已提交或不可继续");
    if (!owner) throw new Error("缺少提交者标识");
    if (row.input.kind === "speech" && row.input.segmentId && row.input.segmentRevision !== undefined) assertAudioRevision(await ownedAudioRow(db.audioSegments, projectId, row.input.segmentId), row.input.segmentRevision);
    if (row.input.kind === "music" && row.input.draftId && row.input.draftRevision !== undefined) assertAudioRevision(await ownedAudioRow(db.musicDrafts, projectId, row.input.draftId), row.input.draftRevision);
    const next: AudioGenerationJob = { ...row, status: "submitting", claim: { owner, claimedAt: nowIso() }, revision: row.revision + 1, updatedAt: nowIso() };
    await db.audioGenerationJobs.put(next);
    return next;
  });
}
const NEXT: Record<AudioGenerationStatus, readonly AudioGenerationStatus[]> = {
  prepared: ["failed"], submitting: ["uncertain", "submitted", "remote-completed", "downloading", "failed"],
  uncertain: ["submitted", "remote-completed", "failed"], submitted: ["running", "downloading", "remote-completed", "failed"],
  running: ["downloading", "remote-completed", "failed"], "remote-completed": ["downloading", "saved", "target-conflict", "failed"],
  downloading: ["running", "remote-completed", "saved", "target-conflict", "failed"], saved: [], failed: ["downloading", "running", "remote-completed"], "target-conflict": ["saved", "downloading"],
};
export async function patchAudioGenerationJob(projectId: string, id: string, revision: number, patch: Partial<Pick<AudioGenerationJob, "status" | "taskIds" | "results" | "error">>): Promise<AudioGenerationJob> {
  return db.transaction("rw", AUDIO_TRANSACTION_TABLES, async () => {
    await assertAudioProject(projectId);
    const row = await ownedAudioRow(db.audioGenerationJobs, projectId, id);
    assertAudioRevision(row, revision);
    if (row.dormant) throw new Error("导入的历史任务不能继续生成");
    if (patch.status && patch.status !== row.status && !NEXT[row.status].includes(patch.status)) throw new Error("生成任务状态转换无效");
    const next: AudioGenerationJob = { ...row, ...patch, revision: row.revision + 1, updatedAt: nowIso() };
    if (new Set(next.results.map((r) => r.key)).size !== next.results.length) throw new Error("生成结果标识重复");
    for (const result of next.results) {
      if (result.mediaId) await ownedAudioRow(db.media, projectId, result.mediaId);
      if (result.takeId) await ownedAudioRow(db.audioTakes, projectId, result.takeId);
      if (result.workId) await ownedAudioRow(db.musicWorks, projectId, result.workId);
    }
    await db.audioGenerationJobs.put(next);
    await touchAudioProject(projectId);
    return next;
  });
}
