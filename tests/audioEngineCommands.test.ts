import { describe, expect, it } from "vitest";
import { AudioClipHistory } from "@/lib/audio/commands";
import { createAudioMusicProject } from "@/db/repo";
import { addAudioClip, addAudioTake, getAudioProjectSnapshot, patchAudioClip } from "@/db/audio";
import { db } from "@/db/database";

async function fixture() {
  const project = await createAudioMusicProject("录音", "audio");
  const snapshot = await getAudioProjectSnapshot(project.id);
  const chapter = snapshot.chapters[0]; const track = snapshot.tracks[0];
  const media = { id: "audio-source", projectId: project.id, blob: new Blob(["audio"], { type: "audio/wav" }), mimeType: "audio/wav", createdAt: new Date().toISOString() };
  await db.media.add(media);
  const take = await addAudioTake(project.id, { mediaId: media.id, name: "录音", source: "upload", durationSec: 10, sampleRate: 48_000, channels: 1 });
  const clip = await addAudioClip(project.id, { chapterId: chapter.id, trackId: track.id, takeId: take.id, startSec: 2, trimStartSec: 1, trimEndSec: 7, gain: 1, fadeInSec: 0.5, fadeOutSec: 0.5 });
  const history = new AudioClipHistory(project.id, chapter.id);
  return { project, chapter, clip, history };
}

describe("audio timeline history", () => {
  it("splits source offsets atomically, then undoes/redoes without touching original media", async () => {
    const { clip, history } = await fixture();
    const split = await history.split(clip, 5);
    expect(split.map((row) => [row.startSec, row.trimStartSec, row.trimEndSec, row.fadeInSec, row.fadeOutSec]).sort((a, b) => a[0] - b[0])).toEqual([[2, 1, 4, 0.5, 0], [5, 4, 7, 0, 0.5]]);
    expect(history.canUndo).toBe(true); await history.undo();
    expect(await db.audioClips.count()).toBe(1); expect(history.canRedo).toBe(true);
    await history.redo(); expect(await db.audioClips.count()).toBe(2);
    expect(await db.audioTakes.count()).toBe(1); expect(await db.media.count()).toBe(1);
  });

  it("supports sequential undo and redo with fresh revisions after each restoration", async () => {
    const { clip, history } = await fixture();
    const [moved] = await history.executePatch(clip, { startSec: 4 });
    await history.executePatch(moved, { gain: 0.5 });
    await history.undo(); await history.undo();
    expect(await db.audioClips.get(clip.id)).toMatchObject({ startSec: 2, gain: 1 });
    await history.redo(); await history.redo();
    expect(await db.audioClips.get(clip.id)).toMatchObject({ startSec: 4, gain: 0.5 });
  });

  it("rejects stale undo atomically after an external update", async () => {
    const { clip, history, project } = await fixture();
    const [moved] = await history.executePatch(clip, { startSec: 4 });
    await patchAudioClip(project.id, moved.id, moved.revision, { gain: 0.3 });
    await expect(history.undo()).rejects.toThrow("其他操作修改");
    expect(await db.audioClips.get(clip.id)).toMatchObject({ startSec: 4, gain: 0.3 });
  });

  it("restores deletions and refuses a split that would change a partial fade", async () => {
    const { clip, history } = await fixture();
    await expect(history.split(clip, 2.25)).rejects.toThrow("淡入淡出");
    expect(await db.audioClips.count()).toBe(1);
    await history.remove(clip); expect(await db.audioClips.count()).toBe(0);
    await history.undo(); expect(await db.audioClips.get(clip.id)).toMatchObject({ takeId: clip.takeId, startSec: 2 });
  });
});
