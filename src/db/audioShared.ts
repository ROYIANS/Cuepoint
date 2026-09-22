import type { Table } from "dexie";
import { db } from "./database";
import { getProjectKind, type ProjectKind } from "@/domain/types";
import type { AudioInput, AudioPatch, AudioRow, AudioSourceMetadata } from "@/domain/audio";
import { createId, nowIso } from "@/lib/ids";

export const AUDIO_TABLES = [db.audioChapters, db.audioSpeakers, db.audioSegments, db.audioTakes, db.audioTracks, db.audioClips, db.audioExports, db.musicDrafts, db.musicWorks, db.audioGenerationJobs];
export const AUDIO_TRANSACTION_TABLES = [db.projects, db.media, ...AUDIO_TABLES];
export async function assertAudioProject(projectId: string, kind?: ProjectKind) {
  const project = await db.projects.get(projectId);
  if (!project) throw new Error("项目不存在或已删除");
  const actual = getProjectKind(project);
  if (kind ? actual !== kind : actual === "video") throw new Error("项目类型不匹配");
  return project;
}
export function finiteAudioNumber(value: number, label: string, min = 0, max = Number.MAX_SAFE_INTEGER) {
  if (!Number.isFinite(value) || value < min || value > max) throw new Error(`${label}超出有效范围`);
}
export function validateAudioMetadata(source: AudioSourceMetadata) {
  finiteAudioNumber(source.durationSec, "音频时长", Number.EPSILON);
  finiteAudioNumber(source.sampleRate, "采样率", 1, 384000);
  finiteAudioNumber(source.channels, "声道数", 1, 32);
  if (!Number.isInteger(source.sampleRate) || !Number.isInteger(source.channels)) throw new Error("采样率与声道数必须为整数");
}
export async function ownedAudioRow<T extends { projectId: string }>(table: Table<T, string>, projectId: string, id: string): Promise<T> {
  const row = await table.get(id);
  if (!row || row.projectId !== projectId) throw new Error("记录不存在或不属于当前项目");
  return row;
}
export function assertAudioRevision(row: AudioRow, expectedRevision: number) {
  if (row.revision !== expectedRevision) throw new Error("内容已被其他操作修改，请刷新后重试");
}
export function newAudioRow<T extends AudioRow>(projectId: string, prefix: string, input: AudioInput<T>): T {
  const at = nowIso();
  return { ...input, id: createId(prefix), projectId, revision: 1, createdAt: at, updatedAt: at } as T;
}
export async function touchAudioProject(projectId: string) {
  await db.projects.update(projectId, { updatedAt: nowIso() });
}
/** Shared compare-and-swap boundary used by manual controls and Agent tools. */
export async function patchAudioRow<T extends AudioRow>(table: Table<T, string>, projectId: string, id: string, revision: number, patch: AudioPatch<T>, keys: readonly (keyof AudioInput<T>)[], validate: (row: T) => Promise<void>): Promise<T> {
  return db.transaction("rw", AUDIO_TRANSACTION_TABLES, async () => {
    const current = await ownedAudioRow(table, projectId, id);
    assertAudioRevision(current, revision);
    if (Object.keys(patch).some((key) => !keys.includes(key as keyof AudioInput<T>))) throw new Error("包含不支持的编辑字段");
    const accepted = Object.fromEntries(keys.filter((key) => Object.hasOwn(patch, key)).map((key) => [key, patch[key]]));
    const next = { ...current, ...accepted, revision: current.revision + 1, updatedAt: nowIso() };
    await validate(next);
    await table.put(next);
    await touchAudioProject(projectId);
    return next;
  });
}
export async function assertOwnedAudioMedia(projectId: string, mediaId: string) {
  const media = await ownedAudioRow(db.media, projectId, mediaId);
  if (!media.blob.size || !media.mimeType.startsWith("audio/")) throw new Error("需要有效的音频文件");
}

/** Called inside the owning delete transaction; keeps generation history without stale FKs. */
export async function detachAudioGenerationResult(projectId: string, kind: "takeId" | "workId", id: string): Promise<void> {
  await db.audioGenerationJobs.where("projectId").equals(projectId)
    .filter((job) => job.results.some((result) => result[kind] === id))
    .modify((job) => {
      job.results = job.results.map((result) => {
        if (result[kind] !== id) return result;
        const next = { ...result, deleted: true };
        delete next[kind];
        return next;
      });
      job.revision++;
      job.updatedAt = nowIso();
    });
}
