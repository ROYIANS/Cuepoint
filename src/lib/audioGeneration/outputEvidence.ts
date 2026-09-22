import Dexie from "dexie";
import { db } from "@/db/database";
import { validateAudioClip } from "@/db/audio";
import { validateAudioMetadata } from "@/db/audioShared";
import type { AudioGenerationJob } from "@/domain/audioGeneration";
import { getProjectKind } from "@/domain/types";
import { targetRevision } from "@/lib/productionRevision";

export interface AudioOutputEvidenceItem {
  key: string;
  title: string;
  takeId?: string;
  workId?: string;
  mediaId?: string;
  outputRevision?: number;
  media?: { size: number; mimeType: string; durationSec: number; sampleRate: number; channels: number };
  availability: "available" | "deleted" | "missing-output" | "missing-media" | "invalid-media" | "unverified";
  available: boolean;
  selected: boolean;
  timelineClipIds: string[];
  timelineClipCount: number;
  placementRevision?: string;
}
export interface AudioOutputEvidence {
  results: AudioOutputEvidenceItem[];
  total: number;
  included: number;
  omitted: number;
  availableCount: number;
  selectedCount: number;
  timelineClipCount: number;
  allAvailable: boolean;
  note: string;
}

/** Local evidence only. Callers supply a current job inside a consistent read transaction. */
export async function inspectAudioGenerationOutputs(job: AudioGenerationJob): Promise<AudioOutputEvidence> {
  const project = await db.projects.get(job.projectId);
  const projectMatches = !!project && getProjectKind(project) === (job.input.kind === "speech" ? "audio" : "music");
  const results: AudioOutputEvidenceItem[] = [];
  for (const result of job.results.slice(0, 100)) {
    const item: AudioOutputEvidenceItem = { key: result.key, title: result.title.slice(0, 240), takeId: result.takeId,
      workId: result.workId, mediaId: result.mediaId, availability: "unverified", available: false,
      selected: false, timelineClipIds: [], timelineClipCount: 0 };
    results.push(item);
    if (result.deleted) { item.availability = "deleted"; continue; }
    if (!projectMatches) continue;
    const output = job.input.kind === "speech"
      ? result.takeId ? await db.audioTakes.get(result.takeId) : undefined
      : result.workId ? await db.musicWorks.get(result.workId) : undefined;
    if (!output) { item.availability = "missing-output"; continue; }
    // A raw provider response or an unrelated reusable media row is not a saved work.
    if (output.projectId !== job.projectId || output.mediaId !== result.mediaId || output.provenance?.jobId !== job.id) continue;
    item.outputRevision = output.revision;
    const media = await db.media.get(output.mediaId);
    if (!media) { item.availability = "missing-media"; continue; }
    if (media.projectId !== job.projectId) continue;
    if (!(media.blob instanceof Blob) || media.blob.size === 0 || !media.mimeType.toLowerCase().startsWith("audio/")) {
      item.availability = "invalid-media"; continue;
    }
    try { validateAudioMetadata(output); } catch { item.availability = "invalid-media"; continue; }
    item.available = true; item.availability = "available";
    item.media = { size: media.blob.size, mimeType: media.mimeType, durationSec: output.durationSec, sampleRate: output.sampleRate, channels: output.channels };
    if (job.input.kind !== "speech" || !result.takeId) continue;
    const take = await db.audioTakes.get(result.takeId);
    const segment = take?.segmentId ? await db.audioSegments.get(take.segmentId) : undefined;
    const chapter = segment ? await db.audioChapters.get(segment.chapterId) : undefined;
    item.selected = !!segment && segment.projectId === job.projectId && chapter?.projectId === job.projectId && segment.selectedTakeId === result.takeId;
    const clips = await db.audioClips.where("takeId").equals(result.takeId).toArray();
    const placementState: unknown[] = [segment ?? null, chapter ?? null];
    for (const clip of clips) {
      if (clip.projectId !== job.projectId || (await db.audioChapters.get(clip.chapterId))?.projectId !== job.projectId) continue;
      try { await validateAudioClip(clip); } catch (error) {
        // Invalid references/trim ranges are unavailable placements; failed reads
        // cannot be silently reported as if a consistent inventory was inspected.
        if (error instanceof Dexie.DexieError || error instanceof DOMException) throw error;
        continue;
      }
      placementState.push({ clip, track: await db.audioTracks.get(clip.trackId) });
      item.timelineClipCount++;
      if (item.timelineClipIds.length < 100) item.timelineClipIds.push(clip.id);
    }
    item.placementRevision = targetRevision(placementState);
  }
  const availableCount = results.filter(item => item.available).length;
  return { results, total: job.results.length, included: results.length, omitted: job.results.length - results.length,
    availableCount, selectedCount: results.filter(item => item.selected).length,
    timelineClipCount: results.reduce((count, item) => count + item.timelineClipCount, 0),
    allAvailable: results.length > 0 && results.length === job.results.length && availableCount === results.length,
    note: "仅核对当前作品归属、音频文件与保存时的解码元信息；未重新解码、播放或试听。数量只覆盖已列出的结果，不能证明远端所有任务完成。selected 表示稿件选用，timelineClipCount 表示有效时间线片段，均不代表可听效果已验收。" };
}
