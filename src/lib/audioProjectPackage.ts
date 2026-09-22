import { z } from "zod";
import { db } from "@/db/database";
import { AUDIO_TABLES } from "@/db/audioShared";
import { validateAudioChapter, validateAudioSpeaker, validateAudioSegment, validateAudioTake, validateAudioTrack, validateAudioClip, validateAudioExport } from "@/db/audio";
import { validateMusicDraft, validateMusicWork } from "@/db/music";
import { createId } from "./ids";
import type { ProjectKind } from "@/domain/types";

const id = z.string().min(1);
const number = z.number().finite();
const base = { id, projectId: id, revision: number.int().positive(), createdAt: z.string(), updatedAt: z.string() };
const meta = { durationSec: number.positive(), sampleRate: number.int().positive(), channels: number.int().positive() };
const provenance = z.object({ provider: z.literal("apimart"), model: z.string(), taskId: z.string().optional(), clipId: z.string().optional(), audioIndex: number.int().positive().optional(), jobId: id.optional(), audioUrl: z.string().optional(), coverUrl: z.string().optional() });
const settings = z.discriminatedUnion("engine", [
  z.object({ engine: z.literal("flowmusic"), soundPrompt: z.string(), lyrics: z.string(), title: z.string(), bpm: z.string().optional(), lengthSec: number.optional(), seed: z.string().optional() }),
  z.object({ engine: z.literal("suno"), version: z.enum(["v6", "v6-wild", "v6-mini"]), custom: z.boolean(), instrumental: z.boolean(), prompt: z.string(), title: z.string(), style: z.string(), negativeTags: z.string(), durationSec: number.optional() }),
]);
const input = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("speech"), text: z.string(), voice: z.string(), speed: number, segmentId: id.optional(), segmentRevision: number.optional() }),
  z.object({ kind: z.literal("music"), settings, draftId: id.optional(), draftRevision: number.optional() }),
]);
/** Explicit allowlist: credentials, chat permission data and live claims cannot travel. */
const schemas = {
  audioChapters: z.object({ ...base, title: z.string(), order: number }),
  audioSpeakers: z.object({ ...base, name: z.string(), voice: z.string().optional(), speed: number.optional() }),
  audioSegments: z.object({ ...base, chapterId: id, speakerId: id.optional(), order: number, text: z.string(), notes: z.string(), selectedTakeId: id.optional() }),
  audioTakes: z.object({ ...base, ...meta, segmentId: id.optional(), mediaId: id, name: z.string(), source: z.enum(["recording", "upload", "library", "tts", "music"]), textSnapshot: z.string().optional(), provenance: provenance.optional() }),
  audioTracks: z.object({ ...base, chapterId: id, role: z.enum(["voice", "music", "effects"]), name: z.string(), order: number, gain: number, muted: z.boolean(), solo: z.boolean() }),
  audioClips: z.object({ ...base, chapterId: id, trackId: id, takeId: id, startSec: number, trimStartSec: number, trimEndSec: number, gain: number, fadeInSec: number, fadeOutSec: number }),
  audioExports: z.object({ ...base, chapterId: id.optional(), scope: z.enum(["chapter", "project"]).optional(), chapterTitle: z.string().optional(), fingerprint: z.string(), format: z.literal("wav"), mediaId: id, durationSec: number }),
  musicDrafts: z.object({ ...base, settings }),
  musicWorks: z.object({ ...base, ...meta, mediaId: id, title: z.string(), notes: z.string(), favorite: z.boolean(), lyrics: z.string(), settings: settings.optional(), provenance: provenance.optional() }),
  audioGenerationJobs: z.object({ ...base, intentId: id, input, connector: z.object({ id, provider: z.literal("apimart"), baseUrl: z.string() }), source: z.object({ kind: z.literal("manual") }), status: z.enum(["prepared", "submitting", "uncertain", "submitted", "running", "remote-completed", "downloading", "saved", "failed", "target-conflict"]), taskIds: z.array(z.string()), results: z.array(z.object({ key: id, provenance, title: z.string(), lyrics: z.string().optional(), durationSec: number.optional(), mediaId: id.optional(), takeId: id.optional(), workId: id.optional(), deleted: z.boolean().optional(), error: z.string().optional() })), error: z.string().optional(), dormant: z.literal(true) }),
};
type TableName = keyof typeof schemas;
const schema = z.object({ version: z.literal(1),
  audioChapters: z.array(schemas.audioChapters), audioSpeakers: z.array(schemas.audioSpeakers), audioSegments: z.array(schemas.audioSegments), audioTakes: z.array(schemas.audioTakes), audioTracks: z.array(schemas.audioTracks), audioClips: z.array(schemas.audioClips), audioExports: z.array(schemas.audioExports), musicDrafts: z.array(schemas.musicDrafts), musicWorks: z.array(schemas.musicWorks), audioGenerationJobs: z.array(schemas.audioGenerationJobs),
});
export type AudioPackage = z.infer<typeof schema>;
export async function snapshotAudioPackage(projectId: string): Promise<AudioPackage> {
  const entries = await Promise.all(AUDIO_TABLES.map(async (table) => [table.name, await table.where("projectId").equals(projectId).toArray()]));
  const raw = Object.fromEntries(entries);
  raw.audioGenerationJobs = (await db.audioGenerationJobs.where("projectId").equals(projectId).toArray()).map((job) => ({ ...job, source: { kind: "manual" }, dormant: true, claim: undefined }));
  return schema.parse({ version: 1, ...raw });
}
export function parseAudioPackage(raw: unknown, projectId: unknown, kind: ProjectKind): AudioPackage | undefined {
  if (raw === undefined) {
    if (kind !== "video") throw new Error("缺少音频或音乐项目数据");
    return undefined;
  }
  const value = schema.parse(raw);
  const seen = new Set<string>();
  for (const name of Object.keys(schemas) as TableName[]) for (const row of value[name]) {
    if (row.projectId !== projectId || seen.has(row.id)) throw new Error("音频项目记录重复或所有者不匹配");
    seen.add(row.id);
    if (kind === "video" || (kind === "music" && name.startsWith("audio") && name !== "audioGenerationJobs") || (kind === "audio" && name.startsWith("music"))) throw new Error("项目包包含其他类型的数据");
  }
  if (kind === "audio" && !value.audioChapters.length) throw new Error("音频项目至少需要一个章节");
  return value;
}
export function remapAudioPackage(value: AudioPackage | undefined, projectId: string, mediaMap: Map<string, string>): AudioPackage | undefined {
  if (!value) return undefined;
  const map = new Map<string, string>();
  for (const name of Object.keys(schemas) as TableName[]) for (const row of value[name]) map.set(row.id, createId("aud"));
  const reference = (id: string) => {
    const next = map.get(id);
    if (!next) throw new Error("音频项目引用的记录缺失");
    return next;
  };
  const media = (id: string) => {
    const next = mediaMap.get(id);
    if (!next) throw new Error("音频项目引用的文件缺失");
    return next;
  };
  const next = structuredClone(value);
  for (const name of Object.keys(schemas) as TableName[]) for (const row of next[name]) {
    row.id = reference(row.id);
    row.projectId = projectId;
    if ("chapterId" in row && row.chapterId) row.chapterId = reference(row.chapterId);
    if ("speakerId" in row && row.speakerId) row.speakerId = reference(row.speakerId);
    if ("segmentId" in row && row.segmentId) row.segmentId = reference(row.segmentId);
    if ("selectedTakeId" in row && row.selectedTakeId) row.selectedTakeId = reference(row.selectedTakeId);
    if ("trackId" in row) row.trackId = reference(row.trackId);
    if ("takeId" in row) row.takeId = reference(row.takeId);
    if ("mediaId" in row) row.mediaId = media(row.mediaId);
    if ("provenance" in row && row.provenance?.jobId) row.provenance.jobId = map.get(row.provenance.jobId);
  }
  for (const job of next.audioGenerationJobs) {
    job.intentId = createId("imported");
    job.connector = { id: "imported", provider: "apimart", baseUrl: "" };
    job.source = { kind: "manual" };
    job.dormant = true;
    if (job.input.kind === "speech" && job.input.segmentId) job.input.segmentId = map.get(job.input.segmentId);
    if (job.input.kind === "music" && job.input.draftId) job.input.draftId = map.get(job.input.draftId);
    for (const result of job.results) {
      if (result.mediaId) result.mediaId = media(result.mediaId);
      if (result.takeId) result.takeId = map.get(result.takeId);
      if (result.workId) result.workId = map.get(result.workId);
      if (result.provenance.jobId) result.provenance.jobId = map.get(result.provenance.jobId);
    }
  }
  return next;
}
/** Called within the package transaction, after project/media insertion. */
export async function insertAudioPackage(value: AudioPackage | undefined): Promise<void> {
  if (!value) return;
  await db.audioChapters.bulkAdd(value.audioChapters);
  await db.audioSpeakers.bulkAdd(value.audioSpeakers);
  await db.audioSegments.bulkAdd(value.audioSegments);
  await db.audioTakes.bulkAdd(value.audioTakes);
  await db.audioTracks.bulkAdd(value.audioTracks);
  await db.audioClips.bulkAdd(value.audioClips);
  await db.audioExports.bulkAdd(value.audioExports);
  await db.musicDrafts.bulkAdd(value.musicDrafts);
  await db.musicWorks.bulkAdd(value.musicWorks);
  await db.audioGenerationJobs.bulkAdd(value.audioGenerationJobs);
  for (const row of value.audioChapters) await validateAudioChapter(row);
  for (const row of value.audioSpeakers) await validateAudioSpeaker(row);
  for (const row of value.audioSegments) await validateAudioSegment(row);
  for (const row of value.audioTakes) await validateAudioTake(row);
  for (const row of value.audioTracks) await validateAudioTrack(row);
  for (const row of value.audioClips) await validateAudioClip(row);
  for (const row of value.audioExports) await validateAudioExport(row);
  for (const row of value.musicDrafts) await validateMusicDraft(row);
  for (const row of value.musicWorks) await validateMusicWork(row);
  for (const job of value.audioGenerationJobs) {
    for (const result of job.results) {
      if (result.mediaId && (await db.media.get(result.mediaId))?.projectId !== job.projectId) throw new Error("生成结果媒体归属无效");
      if (result.takeId && (await db.audioTakes.get(result.takeId))?.projectId !== job.projectId) throw new Error("生成结果配音归属无效");
      if (result.workId && (await db.musicWorks.get(result.workId))?.projectId !== job.projectId) throw new Error("生成结果作品归属无效");
    }
  }
}
