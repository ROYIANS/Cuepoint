import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { db } from "@/db/database";
import { createAudioMusicProject, createProject, ensureFirstEpisode, collectMediaIds, deleteMediaIfOrphan, deleteProject } from "@/db/repo";
import { addAudioChapter, addAudioSegment, addAudioTake, addAudioClip, patchAudioClip, patchAudioSegment, replaceAudioClips, getAudioProjectSnapshot, deleteAudioSegment, deleteAudioTake, adoptMusicWorkAsAudioTake } from "@/db/audio";
import { prepareAudioGenerationJob, claimAudioGenerationJob } from "@/db/audioGeneration";
import { exportProjectZip, importProjectZip } from "@/lib/projectPackage";
import { addMusicWork } from "@/db/music";
import { promoteLegacyMaterial } from "@/db/materials";
import { getProjectKind } from "@/domain/types";

async function source(projectId: string, segmentId?: string) {
  const mediaId = `media-${crypto.randomUUID()}`;
  return addAudioTake(projectId, { mediaId, segmentId, name: "录音", source: "upload", durationSec: 5, sampleRate: 48000, channels: 1 }, { id: mediaId, projectId, filename: "take.webm", mimeType: "audio/webm;codecs=opus", blob: new Blob(["audio"], { type: "audio/webm;codecs=opus" }) });
}
async function fixture() {
  const project = await createAudioMusicProject("声音", "audio");
  const snapshot = await getAudioProjectSnapshot(project.id);
  const chapter = snapshot.chapters[0], track = snapshot.tracks[0];
  const segment = await addAudioSegment(project.id, { chapterId: chapter.id, order: 0, text: "你好", notes: "" });
  const take = await source(project.id, segment.id);
  const clip = await addAudioClip(project.id, { chapterId: chapter.id, trackId: track.id, takeId: take.id, startSec: 0, trimStartSec: 0, trimEndSec: 5, gain: 1, fadeInSec: 0, fadeOutSec: 0 });
  return { project, chapter, track, segment, take, clip };
}

describe("audio project foundation", () => {
  it("keeps missing-kind videos compatible and never repairs non-video episodes", async () => {
    const video = await createProject("video");
    expect(getProjectKind(video)).toBe("video");
    expect(await ensureFirstEpisode(video.id)).toBeTruthy();
    const audio = await createAudioMusicProject("audio", "audio");
    const music = await createAudioMusicProject("music", "music");
    expect(await db.episodes.where("projectId").equals(audio.id).count()).toBe(0);
    expect(await db.episodes.where("projectId").equals(music.id).count()).toBe(0);
    expect(await db.musicDrafts.where("projectId").equals(music.id).count()).toBe(1);
    await expect(ensureFirstEpisode(audio.id)).rejects.toThrow("视频");
    expect(() => getProjectKind({ kind: "alien" as "video" })).toThrow();
  });
  it("rejects cross-project, cross-chapter, invalid trim and stale edits without writing", async () => {
    const { project, chapter, track, take, clip } = await fixture();
    const other = await createAudioMusicProject("other", "audio");
    const otherTake = await source(other.id);
    for (const patch of [{ takeId: otherTake.id }, { startSec: NaN }, { trimEndSec: 6 }, { trimStartSec: 5 }, { fadeInSec: 4, fadeOutSec: 4 }]) await expect(patchAudioClip(project.id, clip.id, 1, patch)).rejects.toThrow();
    const nextChapter = await addAudioChapter(project.id, { title: "next", order: 1 });
    await expect(addAudioClip(project.id, { ...clip, chapterId: nextChapter.id })).rejects.toThrow("章节");
    expect((await db.audioClips.get(clip.id))?.revision).toBe(1);
    const edited = await patchAudioClip(project.id, clip.id, 1, { startSec: 2 });
    await expect(patchAudioClip(project.id, clip.id, 1, { gain: 0 })).rejects.toThrow("修改");
    expect(edited).toMatchObject({ startSec: 2, gain: 1, chapterId: chapter.id, trackId: track.id, takeId: take.id });
  });
  it("keeps new takes independent of selection and preserves sources after script deletion", async () => {
    const { project, segment, take, clip } = await fixture();
    await patchAudioSegment(project.id, segment.id, 1, { selectedTakeId: take.id });
    const alternative = await source(project.id, segment.id);
    expect((await db.audioSegments.get(segment.id))?.selectedTakeId).toBe(take.id);
    await deleteMediaIfOrphan(alternative.mediaId);
    expect(await db.media.get(alternative.mediaId)).toBeTruthy();
    await deleteAudioSegment(project.id, segment.id, 2);
    expect((await db.audioTakes.get(take.id))?.segmentId).toBeUndefined();
    expect(await db.audioClips.get(clip.id)).toBeTruthy();
  });
  it("CAS replacement rejects concurrent additions and rolls invalid split back", async () => {
    const { project, chapter, clip } = await fixture();
    await expect(replaceAudioClips(project.id, chapter.id, [clip], [{ ...clip, trimEndSec: 10 }])).rejects.toThrow();
    expect(await db.audioClips.get(clip.id)).toEqual(clip);
    const next = await replaceAudioClips(project.id, chapter.id, [clip], [{ ...clip, trimEndSec: 2 }, { ...clip, id: "split", startSec: 2, trimStartSec: 2 }]);
    await expect(replaceAudioClips(project.id, chapter.id, [clip], [])).rejects.toThrow("修改");
    const undone = await replaceAudioClips(project.id, chapter.id, next, [clip]);
    expect(undone).toHaveLength(1);
    expect(undone[0].trimEndSec).toBe(5);
    expect(undone[0].revision).toBeGreaterThan(next[0].revision);
  });
  it("round-trips all sources, codec MIME, selected references, provenance and dormant jobs", async () => {
    const { project, segment, take } = await fixture();
    const alternative = await source(project.id, segment.id);
    await patchAudioSegment(project.id, segment.id, 1, { selectedTakeId: take.id });
    const job = await prepareAudioGenerationJob(project.id, { intentId: "intent", input: { kind: "speech", text: "hello", voice: "alloy", speed: 1, segmentId: segment.id }, connector: { id: "secret-connector", provider: "apimart", baseUrl: "https://api.apimart.ai/v1" }, source: { kind: "manual" } });
    await claimAudioGenerationJob(project.id, job.id, 1, "tab-one");
    await db.audioTakes.update(take.id, { provenance: { provider: "apimart", model: "tts", jobId: job.id, taskId: "original-task", clipId: "external-clip", audioIndex: 2 } });
    const zip = await exportProjectZip(project.id);
    const imported = await importProjectZip(zip);
    expect(imported.kind).toBe("audio");
    expect(await db.episodes.where("projectId").equals(imported.id).count()).toBe(0);
    const snap = await getAudioProjectSnapshot(imported.id);
    expect(snap.takes).toHaveLength(2);
    expect(snap.segments[0].selectedTakeId).not.toBe(take.id);
    expect(snap.takes.find((t) => t.id === snap.segments[0].selectedTakeId)?.provenance).toMatchObject({ taskId: "original-task", clipId: "external-clip", audioIndex: 2 });
    const ids = await collectMediaIds(imported.id);
    expect(ids.size).toBe(2);
    const files = await db.media.bulkGet([...ids]);
    expect(files.every((m) => m?.mimeType === "audio/webm;codecs=opus")).toBe(true);
    expect(files.map((m) => m?.id)).not.toContain(alternative.mediaId);
    const importedJob = (await db.audioGenerationJobs.where("projectId").equals(imported.id).first())!;
    expect(importedJob).toMatchObject({ dormant: true, connector: { id: "imported", baseUrl: "" } });
    expect(importedJob.claim).toBeUndefined();
    await expect(claimAudioGenerationJob(imported.id, importedJob.id, importedJob.revision, "tab")).rejects.toThrow();
    await deleteProject(project.id);
    expect(await db.audioTakes.where("projectId").equals(project.id).count()).toBe(0);
    expect(await db.audioGenerationJobs.where("projectId").equals(project.id).count()).toBe(0);
    expect(await db.media.where("projectId").equals(imported.id).count()).toBe(2);
  });
  it("rejects malformed project packages atomically", async () => {
    const { project } = await fixture();
    const zip = await JSZip.loadAsync(await exportProjectZip(project.id));
    const raw = JSON.parse(await zip.file("audioProject.json")!.async("string"));
    raw.audioClips[0].trimEndSec = 999;
    zip.file("audioProject.json", JSON.stringify(raw));
    const before = await db.projects.count();
    await expect(importProjectZip(await zip.generateAsync({ type: "blob" }))).rejects.toThrow();
    expect(await db.projects.count()).toBe(before);
  });
  it("blocks incomplete backups instead of silently dropping an original", async () => {
    const { project, take } = await fixture();
    await db.media.delete(take.mediaId);
    await expect(exportProjectZip(project.id)).rejects.toThrow("缺失");
  });
  it("round-trips music and copies it into audio without sharing mutable media", async () => {
    const music = await createAudioMusicProject("音乐", "music");
    const work = await addMusicWork(music.id, { mediaId: "song", title: "歌", notes: "", favorite: true, lyrics: "词", durationSec: 10, sampleRate: 48000, channels: 2, provenance: { provider: "apimart", model: "suno", taskId: "provider-id", audioIndex: 3 } }, { id: "song", projectId: music.id, blob: new Blob(["song"], { type: "audio/mpeg" }), mimeType: "audio/mpeg", filename: "song.mp3" });
    const imported = await importProjectZip(await exportProjectZip(music.id));
    const copy = (await db.musicWorks.where("projectId").equals(imported.id).first())!;
    expect(copy.provenance).toEqual(work.provenance);
    expect(copy.mediaId).not.toBe(work.mediaId);
    const audio = await createAudioMusicProject("配音", "audio");
    const take = await adoptMusicWorkAsAudioTake(audio.id, work.id);
    const retained = await promoteLegacyMaterial("audio", take.mediaId, { kind: "global" });
    await deleteProject(music.id);
    expect(await db.media.get(take.mediaId)).toBeTruthy();
    await deleteProject(audio.id);
    const version = await db.materialVersions.where("materialId").equals(retained.id).first();
    expect(version?.payload.type).toBe("file");
    if (version?.payload.type === "file") expect(version.payload.blob.size).toBe(4);
  });
  it("keeps deleted generated take history detached from the removed record", async () => {
    const project = await createAudioMusicProject("声音", "audio");
    const take = await source(project.id);
    const job = await prepareAudioGenerationJob(project.id, { intentId: "deleted-take", input: { kind: "speech", text: "hello", voice: "alloy", speed: 1 }, connector: { id: "api", provider: "apimart", baseUrl: "https://api.apimart.ai/v1" }, source: { kind: "manual" } });
    await db.audioGenerationJobs.update(job.id, { status: "saved", results: [{ key: "speech", title: "hello", mediaId: take.mediaId, takeId: take.id, provenance: { provider: "apimart", model: "tts" } }] });
    await deleteAudioTake(project.id, take.id, take.revision);
    expect((await db.audioGenerationJobs.get(job.id))!.results[0]).toMatchObject({ deleted: true, mediaId: take.mediaId });
    expect((await db.audioGenerationJobs.get(job.id))!.results[0].takeId).toBeUndefined();
    await deleteMediaIfOrphan(take.mediaId);
    expect(await db.media.get(take.mediaId)).toBeTruthy();
  });
  it("claims a paid intent only once across concurrent callers", async () => {
    const { project, segment } = await fixture();
    const job = await prepareAudioGenerationJob(project.id, { intentId: "one", input: { kind: "speech", text: "hello", voice: "alloy", speed: 1, segmentId: segment.id, segmentRevision: 1 }, connector: { id: "api", provider: "apimart", baseUrl: "https://api.apimart.ai/v1" }, source: { kind: "manual" } });
    const claims = await Promise.allSettled([claimAudioGenerationJob(project.id, job.id, 1, "tab-a"), claimAudioGenerationJob(project.id, job.id, 1, "tab-b")]);
    expect(claims.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  });
});
