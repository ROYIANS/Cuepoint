import Dexie from "dexie";
import { describe, expect, it, vi } from "vitest";
import { db } from "@/db/database";
import { createAudioMusicProject } from "@/db/repo";
import { addAudioClip, addAudioSegment, patchAudioSegment } from "@/db/audio";
import { deleteMusicWork } from "@/db/music";
import { prepareAudioGeneration, readAudioJobSummary, refreshAudioGeneration, submitAudioGeneration } from "@/lib/audioGeneration/runtime";
import type { ConnectorConfig } from "@/domain/types";

async function fixture(kind: "audio" | "music" = "music", decodeFails = false) {
  const project = await createAudioMusicProject("声音核验", kind);
  const connector: ConnectorConfig = { id: "provider", definitionId: "apimart", name: "测试", baseUrl: "https://provider.test/v1", apiKey: "secret", updatedAt: "now" };
  await db.connectors.add(connector);
  const chapter = await db.audioChapters.where("projectId").equals(project.id).first();
  const segment = chapter ? await addAudioSegment(project.id, { chapterId: chapter.id, text: "你好", notes: "", order: 0 }) : undefined;
  const job = await prepareAudioGeneration({ projectId: project.id, connectorId: connector.id,
    input: kind === "music" ? { kind: "music", settings: { engine: "flowmusic", soundPrompt: "piano", lyrics: "", title: "作品" } }
      : { kind: "speech", text: "你好", voice: "alloy", speed: 1, segmentId: segment?.id, segmentRevision: segment?.revision } });
  const fetchImpl = vi.fn<typeof fetch>(async (url, init) => {
    if (String(url).includes("/music/generations") && init?.method === "POST") return Response.json({ code: 200, data: [{ task_id: "remote" }] });
    if (String(url).includes("/music/tasks/")) return Response.json({ code: 200, data: { id: "remote", status: "completed", result: { music: [{ title: "作品", audio_url: "https://cdn.test/signed.wav?secret=example" }] } } });
    return new Response(new Uint8Array([82, 73, 70, 70]), { headers: { "Content-Type": "audio/wav" } });
  });
  const decode = async () => { if (decodeFails) throw new Error("无法解码"); return { durationSec: 2, sampleRate: 48000, channels: 2 }; };
  await submitAudioGeneration(project.id, job.id, { fetchImpl, decode });
  if (kind === "music") await refreshAudioGeneration(project.id, job.id, { fetchImpl, decode });
  const read = () => readAudioJobSummary(project.id, job.id);
  return { project, job, segment, chapter, read, fetchImpl };
}

describe("current local sound output evidence", () => {
  it("returns actual stored works without a query or an audition claim", async () => {
    const f = await fixture(); const count = f.fetchImpl.mock.calls.length;
    const summary = await f.read();
    expect(summary.outputs).toMatchObject({ availableCount: 1, allAvailable: true, selectedCount: 0, timelineClipCount: 0 });
    expect(summary.outputs.results[0]).toMatchObject({ availability: "available", media: { size: 4, durationSec: 2 } });
    expect(summary.outputs.note).toContain("未重新解码、播放或试听");
    expect(JSON.stringify(summary)).not.toContain("signed.wav");
    expect(f.fetchImpl).toHaveBeenCalledTimes(count);
    const foreign = await createAudioMusicProject("其他项目", "music");
    await expect(readAudioJobSummary(foreign.id, f.job.id)).rejects.toThrow("不属于");
  });
  it("does not turn raw downloaded speech bytes into a usable take", async () => {
    const f = await fixture("audio", true); const summary = await f.read();
    expect(summary.results[0].mediaId).toBeTruthy();
    expect(summary.outputs).toMatchObject({ availableCount: 0, allAvailable: false });
    expect(summary.outputs.results[0].availability).toBe("missing-output");
  });
  it.each(["missing", "empty", "wrong-mime", "foreign", "wrong-output", "bad-metadata"] as const)("revokes availability when output is %s", async mode => {
    const f = await fixture(); const result = (await f.read()).results[0];
    if (mode === "missing") await db.media.delete(result.mediaId!);
    if (mode === "empty") await db.media.update(result.mediaId!, { blob: new Blob([]) });
    if (mode === "wrong-mime") await db.media.update(result.mediaId!, { mimeType: "text/html" });
    if (mode === "foreign") await db.media.update(result.mediaId!, { projectId: "another-project" });
    if (mode === "wrong-output") await db.musicWorks.update(result.workId!, { mediaId: "other-media" });
    if (mode === "bad-metadata") await db.musicWorks.update(result.workId!, { durationSec: 0 });
    expect((await f.read()).outputs.availableCount).toBe(0);
  });
  it("keeps deletion history without certifying retained media", async () => {
    const f = await fixture(); const result = (await f.read()).results[0];
    const work = (await db.musicWorks.get(result.workId!))!;
    await deleteMusicWork(f.project.id, work.id, work.revision);
    expect((await f.read()).outputs.results[0]).toMatchObject({ availability: "deleted", available: false });
  });
  it("distinguishes saved takes, manuscript selection and valid timeline placement", async () => {
    const f = await fixture("audio"); const takeId = (await f.read()).results[0].takeId!;
    expect((await f.read()).outputs).toMatchObject({ availableCount: 1, selectedCount: 0, timelineClipCount: 0 });
    await patchAudioSegment(f.project.id, f.segment!.id, f.segment!.revision, { selectedTakeId: takeId });
    expect((await f.read()).outputs).toMatchObject({ selectedCount: 1, timelineClipCount: 0 });
    const track = (await db.audioTracks.where("projectId").equals(f.project.id).first())!;
    const clip = await addAudioClip(f.project.id, { chapterId: f.chapter!.id, trackId: track.id, takeId, startSec: 0, trimStartSec: 0, trimEndSec: 2, gain: 1, fadeInSec: 0, fadeOutSec: 0 });
    expect((await f.read()).outputs.results[0].timelineClipIds).toEqual([clip.id]);
    await db.audioClips.update(clip.id, { trimEndSec: 10 });
    expect((await f.read()).outputs.timelineClipCount).toBe(0);
    await db.audioChapters.delete(f.chapter!.id);
    expect((await f.read()).outputs).toMatchObject({ availableCount: 1, selectedCount: 0, timelineClipCount: 0 });
  });
  it("surfaces storage failures during placement validation instead of certifying a partial inventory", async () => {
    const f = await fixture("audio"); const takeId = (await f.read()).results[0].takeId!;
    const track = (await db.audioTracks.where("projectId").equals(f.project.id).first())!;
    await addAudioClip(f.project.id, { chapterId: f.chapter!.id, trackId: track.id, takeId, startSec: 0, trimStartSec: 0, trimEndSec: 2, gain: 1, fadeInSec: 0, fadeOutSec: 0 });
    const readTrack = vi.spyOn(db.audioTracks, "get").mockRejectedValue(new Dexie.InvalidStateError("storage unavailable"));
    try { await expect(f.read()).rejects.toThrow("storage unavailable"); }
    finally { readTrack.mockRestore(); }
  });
  it("discloses bounded results and never claims omitted outputs are verified", async () => {
    const f = await fixture(); const job = (await db.audioGenerationJobs.get(f.job.id))!;
    await db.audioGenerationJobs.update(job.id, { results: Array.from({ length: 101 }, (_, i) => ({ ...job.results[0], key: `${i}`, deleted: true })) });
    expect((await f.read()).outputs).toMatchObject({ total: 101, included: 100, omitted: 1, allAvailable: false });
  });
});
