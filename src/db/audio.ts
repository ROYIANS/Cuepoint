import { db } from "./database";
import type { AudioChapter, AudioSpeaker, AudioSegment, AudioTake, AudioTrack, AudioClip, AudioExport, AudioInput, AudioPatch, AudioProjectSnapshot, AudioRow } from "@/domain/audio";
import type { MediaRecord } from "@/domain/types";
import type { Table } from "dexie";
import { AUDIO_TRANSACTION_TABLES, detachAudioGenerationResult, assertAudioProject, finiteAudioNumber, ownedAudioRow, assertAudioRevision, newAudioRow, patchAudioRow, touchAudioProject, validateAudioMetadata, assertOwnedAudioMedia } from "./audioShared";
import { validateSpeechReference } from "@/lib/audioGeneration/reference";
import { validateMimoSpeech } from "@/lib/audioGeneration/input";
import { nowIso } from "@/lib/ids";

export async function validateAudioChapter(row: AudioChapter) {
  await assertAudioProject(row.projectId, "audio");
  finiteAudioNumber(row.order, "章节顺序");
  if (typeof row.title !== "string" || !row.title.trim()) throw new Error("章节名称不能为空");
}
export async function validateAudioSpeaker(row: AudioSpeaker) {
  await assertAudioProject(row.projectId, "audio");
  if (typeof row.name !== "string" || !row.name.trim()) throw new Error("说话人名称不能为空");
  if (row.speed !== undefined) finiteAudioNumber(row.speed, "语速", 0.25, 4);
  if (row.mimo) {
    validateMimoSpeech({ text: "音色配置", voice: row.voice ?? "mimo_default", speed: row.speed ?? 1, mimo: row.mimo });
    await validateSpeechReference(row.projectId, row);
  }
}
export async function validateAudioSegment(row: AudioSegment) {
  await assertAudioProject(row.projectId, "audio");
  await ownedAudioRow(db.audioChapters, row.projectId, row.chapterId);
  finiteAudioNumber(row.order, "段落顺序");
  if (typeof row.text !== "string" || typeof row.notes !== "string") throw new Error("脚本内容必须为文本");
  if (row.speakerId) await ownedAudioRow(db.audioSpeakers, row.projectId, row.speakerId);
  if (row.selectedTakeId) {
    const take = await ownedAudioRow(db.audioTakes, row.projectId, row.selectedTakeId);
    if (take.segmentId !== row.id) throw new Error("配音版本不属于当前段落");
  }
}
export async function validateAudioTake(row: AudioTake) {
  await assertAudioProject(row.projectId, "audio");
  validateAudioMetadata(row);
  if (!["recording", "upload", "library", "tts", "music"].includes(row.source) || typeof row.name !== "string") throw new Error("音频来源无效");
  if (row.segmentId) await ownedAudioRow(db.audioSegments, row.projectId, row.segmentId);
  await assertOwnedAudioMedia(row.projectId, row.mediaId);
}
export async function validateAudioTrack(row: AudioTrack) {
  await assertAudioProject(row.projectId, "audio");
  await ownedAudioRow(db.audioChapters, row.projectId, row.chapterId);
  finiteAudioNumber(row.order, "音轨顺序");
  finiteAudioNumber(row.gain, "音轨音量", 0, 4);
  if (typeof row.muted !== "boolean" || typeof row.solo !== "boolean" || typeof row.name !== "string") throw new Error("音轨设置无效");
  if (!["voice", "music", "effects"].includes(row.role)) throw new Error("未知音轨类型");
}
export async function validateAudioClip(row: AudioClip) {
  await assertAudioProject(row.projectId, "audio");
  const track = await ownedAudioRow(db.audioTracks, row.projectId, row.trackId);
  const take = await ownedAudioRow(db.audioTakes, row.projectId, row.takeId);
  if (take.segmentId && (await ownedAudioRow(db.audioSegments, row.projectId, take.segmentId)).chapterId !== row.chapterId) throw new Error("配音版本不属于当前章节");
  if (track.chapterId !== row.chapterId) throw new Error("音轨不属于当前章节");
  finiteAudioNumber(row.startSec, "片段位置");
  finiteAudioNumber(row.trimStartSec, "裁剪起点");
  finiteAudioNumber(row.trimEndSec, "裁剪终点", 0, take.durationSec);
  const duration = row.trimEndSec - row.trimStartSec;
  if (duration <= 0) throw new Error("裁剪终点必须大于起点");
  finiteAudioNumber(row.gain, "片段音量", 0, 4);
  finiteAudioNumber(row.fadeInSec, "淡入时长", 0, duration);
  finiteAudioNumber(row.fadeOutSec, "淡出时长", 0, duration);
  if (row.fadeInSec + row.fadeOutSec > duration) throw new Error("淡入淡出不能超过片段时长");
}
export async function validateAudioExport(row: AudioExport) {
  await assertAudioProject(row.projectId, "audio");
  if (row.chapterId) await ownedAudioRow(db.audioChapters, row.projectId, row.chapterId);
  await assertOwnedAudioMedia(row.projectId, row.mediaId);
  finiteAudioNumber(row.durationSec, "导出时长", Number.EPSILON);
  if (row.format !== "wav" || !row.fingerprint) throw new Error("导出信息无效");
}
async function add<T extends AudioRow>(table: Table<T, string>, prefix: string, projectId: string, input: AudioInput<T>, validate: (row: T) => Promise<void>, media?: MediaRecord): Promise<T> {
  return db.transaction("rw", AUDIO_TRANSACTION_TABLES, async () => {
    await assertAudioProject(projectId, "audio");
    if (media) {
      if (media.projectId !== projectId) throw new Error("音频文件不属于当前项目");
      await db.media.add(media);
    }
    const row = newAudioRow<T>(projectId, prefix, input);
    await validate(row);
    await table.add(row);
    await touchAudioProject(projectId);
    return row;
  });
}
export const addAudioChapter = (projectId: string, input: AudioInput<AudioChapter>) => add(db.audioChapters, "ach", projectId, input, validateAudioChapter);
export const addAudioSpeaker = (projectId: string, input: AudioInput<AudioSpeaker>) => add(db.audioSpeakers, "asp", projectId, input, validateAudioSpeaker);
export const addAudioSegment = (projectId: string, input: AudioInput<AudioSegment>) => add(db.audioSegments, "asg", projectId, input, validateAudioSegment);
export const addAudioTake = (projectId: string, input: AudioInput<AudioTake>, media?: MediaRecord) => add(db.audioTakes, "atk", projectId, input, validateAudioTake, media);
export const addAudioTrack = (projectId: string, input: AudioInput<AudioTrack>) => add(db.audioTracks, "atr", projectId, input, validateAudioTrack);
export const addAudioClip = (projectId: string, input: AudioInput<AudioClip>) => add(db.audioClips, "acl", projectId, input, validateAudioClip);
export const addAudioExport = (projectId: string, input: AudioInput<AudioExport>, media?: MediaRecord) => add(db.audioExports, "aex", projectId, { ...input, scope: input.chapterId ? "chapter" : "project" }, validateAudioExport, media);
export const patchAudioChapter = (projectId: string, id: string, revision: number, patch: AudioPatch<AudioChapter>) => patchAudioRow(db.audioChapters, projectId, id, revision, patch, ["title", "order"], validateAudioChapter);
export const patchAudioSpeaker = (projectId: string, id: string, revision: number, patch: AudioPatch<AudioSpeaker>) => patchAudioRow(db.audioSpeakers, projectId, id, revision, patch, ["name", "voice", "speed", "mimo"], validateAudioSpeaker);
export const patchAudioSegment = (projectId: string, id: string, revision: number, patch: AudioPatch<AudioSegment>) => patchAudioRow(db.audioSegments, projectId, id, revision, patch, ["speakerId", "order", "text", "notes", "selectedTakeId"], validateAudioSegment);
export const patchAudioTrack = (projectId: string, id: string, revision: number, patch: AudioPatch<AudioTrack>) => patchAudioRow(db.audioTracks, projectId, id, revision, patch, ["name", "role", "order", "gain", "muted", "solo"], validateAudioTrack);
export const patchAudioClip = (projectId: string, id: string, revision: number, patch: AudioPatch<AudioClip>) => patchAudioRow(db.audioClips, projectId, id, revision, patch, ["trackId", "takeId", "startSec", "trimStartSec", "trimEndSec", "gain", "fadeInSec", "fadeOutSec"], validateAudioClip);

async function remove<T extends AudioRow>(table: Table<T, string>, projectId: string, id: string, revision: number, before: (row: T) => Promise<void>) {
  return db.transaction("rw", AUDIO_TRANSACTION_TABLES, async () => {
    await assertAudioProject(projectId, "audio");
    const row = await ownedAudioRow(table, projectId, id);
    assertAudioRevision(row, revision);
    await before(row);
    await table.delete(id);
    await touchAudioProject(projectId);
  });
}
export const deleteAudioClip = (projectId: string, id: string, revision: number) => remove(db.audioClips, projectId, id, revision, async () => {});
export const deleteAudioTrack = (projectId: string, id: string, revision: number) => remove(db.audioTracks, projectId, id, revision, async () => {
  await db.audioClips.where("trackId").equals(id).delete();
});
export const deleteAudioSpeaker = (projectId: string, id: string, revision: number) => remove(db.audioSpeakers, projectId, id, revision, async () => {
  await db.audioSegments.where("speakerId").equals(id).modify((row) => { delete row.speakerId; row.revision++; row.updatedAt = nowIso(); });
});
export const deleteAudioSegment = (projectId: string, id: string, revision: number) => remove(db.audioSegments, projectId, id, revision, async () => {
  // Retain all recorded/generated sources and placed clips when deleting script.
  await db.audioTakes.where("segmentId").equals(id).modify((row) => { delete row.segmentId; row.revision++; row.updatedAt = nowIso(); });
});
export const deleteAudioTake = (projectId: string, id: string, revision: number) => remove(db.audioTakes, projectId, id, revision, async () => {
  if (await db.audioClips.where("takeId").equals(id).count() || await db.audioSegments.where("projectId").equals(projectId).filter((s) => s.selectedTakeId === id).count()) throw new Error("此版本已被采用，请先移除引用");
  await detachAudioGenerationResult(projectId, "takeId", id);
});
export const deleteAudioChapter = (projectId: string, id: string, revision: number) => remove(db.audioChapters, projectId, id, revision, async (chapter) => {
  if (await db.audioChapters.where("projectId").equals(projectId).count() <= 1) throw new Error("至少保留一个章节");
  const segments = await db.audioSegments.where("chapterId").equals(id).toArray();
  for (const segment of segments) await db.audioTakes.where("segmentId").equals(segment.id).modify((row) => { delete row.segmentId; row.revision++; row.updatedAt = nowIso(); });
  await db.audioSegments.where("chapterId").equals(id).delete();
  await db.audioClips.where("chapterId").equals(id).delete();
  await db.audioTracks.where("chapterId").equals(id).delete();
  await db.audioExports.where("projectId").equals(projectId).filter((row) => row.chapterId === id).modify((row) => { row.scope = "chapter"; row.chapterTitle = chapter.title; delete row.chapterId; row.revision++; row.updatedAt = nowIso(); });
});
export async function getAudioProjectSnapshot(projectId: string): Promise<AudioProjectSnapshot> {
  return db.transaction("r", AUDIO_TRANSACTION_TABLES, async () => {
    await assertAudioProject(projectId, "audio");
    const [chapters, speakers, segments, takes, tracks, clips, exports] = await Promise.all([
      db.audioChapters.where("projectId").equals(projectId).sortBy("order"), db.audioSpeakers.where("projectId").equals(projectId).toArray(),
      db.audioSegments.where("projectId").equals(projectId).sortBy("order"), db.audioTakes.where("projectId").equals(projectId).toArray(),
      db.audioTracks.where("projectId").equals(projectId).sortBy("order"), db.audioClips.where("projectId").equals(projectId).toArray(), db.audioExports.where("projectId").equals(projectId).toArray(),
    ]);
    return { chapters, speakers, segments, takes, tracks, clips, exports };
  });
}
/** Atomic edit batch for drag/split/undo. A stale row aborts the entire command. */
export async function editAudioClips(projectId: string, edits: Array<{ id: string; revision: number; patch: AudioPatch<AudioClip> }>): Promise<AudioClip[]> {
  if (new Set(edits.map((edit) => edit.id)).size !== edits.length) throw new Error("片段 ID 重复");
  return db.transaction("rw", AUDIO_TRANSACTION_TABLES, async () => {
    const rows: AudioClip[] = [];
    for (const edit of edits) rows.push(await patchAudioClip(projectId, edit.id, edit.revision, edit.patch));
    return rows;
  });
}

/** Replace one chapter's clip document with a CAS guard; undo never copies Blobs. */
export async function replaceAudioClips(projectId: string, chapterId: string, expected: AudioClip[], next: AudioClip[]): Promise<AudioClip[]> {
  return db.transaction("rw", AUDIO_TRANSACTION_TABLES, async () => {
    await assertAudioProject(projectId, "audio");
    await ownedAudioRow(db.audioChapters, projectId, chapterId);
    const current = await db.audioClips.where("chapterId").equals(chapterId).toArray();
    if (new Set(expected.map((r) => r.id)).size !== expected.length || new Set(next.map((r) => r.id)).size !== next.length) throw new Error("片段 ID 重复");
    if (expected.length !== current.length || expected.some((row) => row.projectId !== projectId || row.chapterId !== chapterId || !current.some((c) => c.id === row.id && c.revision === row.revision))) throw new Error("时间线已被其他操作修改，请刷新后重试");
    const rows: AudioClip[] = [];
    for (const row of next) {
      if (!row.id || !Number.isSafeInteger(row.revision) || row.revision < 1) throw new Error("片段标识或版本无效");
      if (row.projectId !== projectId || row.chapterId !== chapterId) throw new Error("片段不属于当前章节");
      const existing = await db.audioClips.get(row.id);
      if (existing && !current.some((c) => c.id === row.id)) throw new Error("片段 ID 已被占用");
      const changed = { ...row, revision: Math.max(row.revision, existing?.revision ?? 0) + 1, updatedAt: nowIso() };
      await validateAudioClip(changed);
      rows.push(changed);
    }
    await db.audioClips.where("chapterId").equals(chapterId).delete();
    await db.audioClips.bulkAdd(rows);
    await touchAudioProject(projectId);
    return rows;
  });
}

/** Copy a completed music work; edits/deletion in either project stay independent. */
export async function adoptMusicWorkAsAudioTake(projectId: string, workId: string, segmentId?: string): Promise<AudioTake> {
  return db.transaction("rw", AUDIO_TRANSACTION_TABLES, async () => {
    await assertAudioProject(projectId, "audio");
    const work = await db.musicWorks.get(workId);
    if (!work) throw new Error("音乐作品不存在");
    await assertAudioProject(work.projectId, "music");
    const media = await ownedAudioRow(db.media, work.projectId, work.mediaId);
    const mediaId = crypto.randomUUID();
    return addAudioTake(projectId, {
      mediaId, segmentId, name: work.title, source: "music", durationSec: work.durationSec, sampleRate: work.sampleRate, channels: work.channels,
      provenance: work.provenance ? { ...work.provenance, jobId: undefined } : undefined,
    }, { ...media, id: mediaId, projectId, libraryRetained: undefined });
  });
}
