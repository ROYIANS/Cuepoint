import { describe, expect, it } from "vitest";
import { db } from "@/db/database";
import {
  addCharacter,
  addEpisode,
  addProp,
  addScene,
  addShot,
  addStyle,
  addStoryBeat,
  copyStudioCharacter,
  copyStudioProp,
  copyStudioScene,
  copyStudioStyle,
  createProject,
  deleteCharacter,
  deleteEpisode,
  deleteEpisodeShots,
  deleteShots,
  duplicateBeat,
  duplicateShot,
  patchStoryBeat,
  patchCharacter,
  patchProp,
  patchScene,
  patchStyle,
  patchEpisodeShots,
  putMedia,
  reorderBeats,
  reorderEpisodes,
  reorderShots,
  restoreEpisode,
  restoreShots,
  touchProject,
  updateEpisodeDraft,
  updateShotSettings,
  patchShot,
} from "@/db/repo";
import { emptySlot } from "@/domain/slot";
import { normalizeEpisodeStory, normalizeShotSettings, STUDIO_LIBRARY_ID } from "@/domain/types";

describe("repository invariants", () => {
  it("creates film projects by default and preserves an explicit series mode", async () => {
    const film = await createProject("film");
    const series = await createProject("series", "series");

    expect(film.mode).toBe("film");
    expect(series.mode).toBe("series");
    expect(await db.episodes.where("projectId").equals(film.id).count()).toBe(1);
    expect(await db.episodes.where("projectId").equals(series.id).count()).toBe(1);
  });

  it("persists the shot workspace view on the project", async () => {
    const project = await createProject("workspace");
    expect(project.shotSettings.workspaceView).toBe("design");

    await updateShotSettings(project.id, { workspaceView: "media" });

    expect((await db.projects.get(project.id))?.shotSettings.workspaceView).toBe("media");
  });

  it("merges shot preference fields against the latest persisted settings", async () => {
    const project = await createProject("workspace settings");

    await updateShotSettings(project.id, { workspaceView: "media" });
    await updateShotSettings(project.id, { defaultDurationSec: 4 });
    await updateShotSettings(project.id, { workspaceView: undefined });

    expect((await db.projects.get(project.id))?.shotSettings).toEqual({
      autoIncrementShotNumber: true,
      defaultDurationSec: 4,
      workspaceView: "media",
      filters: { statuses: [], beatIds: [], gaps: [] },
    });
  });

  it("does not create a project for the studio library owner", async () => {
    await touchProject(STUDIO_LIBRARY_ID);
    expect(await db.projects.get(STUDIO_LIBRARY_ID)).toBeUndefined();
  });

  it("copies all studio asset types as independent project snapshots", async () => {
    const project = await createProject("snapshots");
    const character = await addCharacter(STUDIO_LIBRARY_ID);
    const scene = await addScene(STUDIO_LIBRARY_ID);
    const prop = await addProp(STUDIO_LIBRARY_ID);
    const style = await addStyle(STUDIO_LIBRARY_ID);
    await patchCharacter(character.id, { name: "母版角色", extra: { nested: { kept: true } } });
    await patchScene(scene.id, { name: "母版场景" });
    await patchProp(prop.id, { name: "母版道具" });
    await patchStyle(style.id, { name: "母版风格" });

    const copies = await Promise.all([
      copyStudioCharacter(project.id, character.id),
      copyStudioScene(project.id, scene.id),
      copyStudioProp(project.id, prop.id),
      copyStudioStyle(project.id, style.id),
    ]);

    expect(copies.map((copy) => copy.projectId)).toEqual(Array(4).fill(project.id));
    expect(copies.map((copy) => copy.id)).not.toContain(character.id);
    expect(copies.map((copy) => copy.extra?.sourceAssetId)).toEqual([
      character.id,
      scene.id,
      prop.id,
      style.id,
    ]);
    expect(copies[0]?.extra?.nested).toEqual({ kept: true });

    await patchCharacter(character.id, { name: "修改后的母版" });
    expect((await db.characters.get(copies[0]!.id))?.name).toBe("母版角色");
    await patchCharacter(copies[0]!.id, { name: "项目角色" });
    expect((await db.characters.get(character.id))?.name).toBe("修改后的母版");
    await deleteCharacter(character.id);
    expect(await db.characters.get(copies[0]!.id)).toBeDefined();
  });

  it("remaps and deduplicates snapshot media under the destination project", async () => {
    const project = await createProject("snapshot media");
    const character = await addCharacter(STUDIO_LIBRARY_ID);
    const sourceMediaId = "med_studio";
    await putMedia({
      id: sourceMediaId,
      projectId: STUDIO_LIBRARY_ID,
      mimeType: "image/png",
      filename: "source.png",
      blob: new Blob(["source"], { type: "image/png" }),
    });
    const sharedSlot = {
      ...emptySlot(),
      referenceImageIds: [sourceMediaId],
      result: { mediaId: sourceMediaId, kind: "image" as const },
    };
    await patchCharacter(character.id, {
      slots: { front: sharedSlot, side: sharedSlot },
    });

    const copy = await copyStudioCharacter(project.id, character.id);
    const mappedIds = [
      copy.slots.front?.referenceImageIds[0],
      copy.slots.front?.result?.mediaId,
      copy.slots.side?.referenceImageIds[0],
      copy.slots.side?.result?.mediaId,
    ];

    expect(new Set(mappedIds).size).toBe(1);
    expect(mappedIds[0]).not.toBe(sourceMediaId);
    expect((await db.media.get(mappedIds[0]!))?.projectId).toBe(project.id);
    expect(await db.media.where("projectId").equals(project.id).count()).toBe(1);
  });

  it("rejects copying the same studio source into one project twice", async () => {
    const project = await createProject("snapshot duplicate");
    const character = await addCharacter(STUDIO_LIBRARY_ID);

    await copyStudioCharacter(project.id, character.id);

    await expect(copyStudioCharacter(project.id, character.id)).rejects.toThrow(
      "已添加到项目",
    );
    expect(await db.characters.where("projectId").equals(project.id).count()).toBe(1);
  });

  it("rejects a project and episode ownership mismatch", async () => {
    const left = await createProject("left");
    const right = await createProject("right");
    const rightEpisode = await addEpisode(right.id);

    await expect(addShot(left.id, rightEpisode.id)).rejects.toThrow("项目或集不存在");
    expect(await db.shots.where("episodeId").equals(rightEpisode.id).count()).toBe(0);
  });

  it("preserves beat fields while saving episode text drafts", async () => {
    const project = await createProject("series");
    const episode = (await db.episodes.where("projectId").equals(project.id).first())!;
    const beat = await addStoryBeat(episode.id);

    await Promise.all([
      updateEpisodeDraft(episode.id, { title: "标题", script: "正文" }),
      patchStoryBeat(episode.id, beat.id, { content: "场次更新" }),
    ]);

    const saved = (await db.episodes.get(episode.id))!;
    expect(saved.title).toBe("标题");
    expect(normalizeEpisodeStory(saved.story)).toMatchObject({
      script: "正文",
      beats: [{ id: beat.id, content: "场次更新" }],
    });
  });

  it("creates a beat from a UTF-16 script range and removes a stale association", async () => {
    const project = await createProject("range");
    const episode = (await db.episodes.where("projectId").equals(project.id).first())!;
    await updateEpisodeDraft(episode.id, { script: "开场🙂结束" });
    const beat = await addStoryBeat(episode.id, {
      scriptRange: { start: 2, end: 4, excerpt: "🙂" },
    });

    expect(beat.content).toBe("🙂");
    expect(beat.scriptRange).toEqual({ start: 2, end: 4, excerpt: "🙂" });

    await updateEpisodeDraft(episode.id, { script: "开场已修改" });
    const saved = (await db.episodes.get(episode.id))!;
    expect(normalizeEpisodeStory(saved.story).beats[0]?.content).toBe("🙂");
    expect(normalizeEpisodeStory(saved.story).beats[0]?.scriptRange).toBeUndefined();

    const invalid = await addStoryBeat(episode.id, {
      scriptRange: { start: -1, end: 0, excerpt: "" },
    });
    expect(invalid.scriptRange).toBeUndefined();
  });

  it("validates complete scoped order lists", async () => {
    const project = await createProject("orders", "series");
    const first = (await db.episodes.where("projectId").equals(project.id).first())!;
    const second = await addEpisode(project.id);
    await reorderEpisodes(project.id, [second.id, first.id]);
    expect((await db.episodes.get(second.id))?.order).toBe(0);
    await expect(reorderEpisodes(project.id, [second.id, second.id])).rejects.toThrow(
      "排序列表",
    );
    await expect(reorderEpisodes("missing-project", [])).rejects.toThrow("项目不存在");

    const left = await addStoryBeat(first.id);
    const right = await addStoryBeat(first.id);
    await reorderBeats(first.id, [right.id, left.id]);
    expect(normalizeEpisodeStory((await db.episodes.get(first.id))!.story).beats[0]?.id).toBe(
      right.id,
    );
    await expect(reorderBeats(first.id, [right.id])).rejects.toThrow("排序列表");

    const one = await addShot(project.id, first.id);
    const two = await addShot(project.id, first.id);
    expect(one.status).toBe("draft");
    expect(two.status).toBe("draft");
    await reorderShots(first.id, [two.id, one.id]);
    expect((await db.shots.get(two.id))?.order).toBe(1);
    await expect(reorderShots(first.id, [two.id, "foreign"])).rejects.toThrow("排序列表");
  });

  it("persists shot status and filter preferences", async () => {
    const project = await createProject("status filters");
    const episode = (await db.episodes.where("projectId").equals(project.id).first())!;
    const shot = await addShot(project.id, episode.id);
    expect(shot.status).toBe("draft");

    await patchShot(shot.id, { status: "approved" });
    expect((await db.shots.get(shot.id))?.status).toBe("approved");

    await updateShotSettings(project.id, {
      filters: {
        statuses: ["ready", "approved"],
        beatIds: ["none"],
        gaps: ["missingFirstFrame"],
      },
    });
    expect(normalizeShotSettings((await db.projects.get(project.id))?.shotSettings).filters).toEqual({
      statuses: ["ready", "approved"],
      beatIds: ["none"],
      gaps: ["missingFirstFrame"],
    });
  });

  it("rejects reorder and copy when a shot owner disagrees with its episode", async () => {
    const project = await createProject("owner");
    const other = await createProject("other");
    const episode = (await db.episodes.where("projectId").equals(project.id).first())!;
    const shot = await addShot(project.id, episode.id);
    await db.shots.update(shot.id, { projectId: other.id });

    await expect(reorderShots(episode.id, [shot.id])).rejects.toThrow("不属于同一项目");
    await expect(duplicateShot(shot.id)).rejects.toThrow("不属于同一项目");

    const beat = await addStoryBeat(episode.id);
    await db.shots.update(shot.id, { beatId: beat.id });
    await expect(duplicateBeat(episode.id, beat.id, { includeShots: true })).rejects.toThrow(
      "不属于同一项目",
    );
  });

  it("scopes bulk shot updates and deletion to one episode", async () => {
    const project = await createProject("bulk", "series");
    const first = (await db.episodes.where("projectId").equals(project.id).first())!;
    const second = await addEpisode(project.id);
    const beat = await addStoryBeat(first.id);
    const foreignBeat = await addStoryBeat(second.id);
    const selected = [
      await addShot(project.id, first.id),
      await addShot(project.id, first.id),
    ];
    const foreign = await addShot(project.id, second.id);

    await patchEpisodeShots(first.id, selected.map((shot) => shot.id), {
      beatId: beat.id,
      durationSec: 3,
    });
    expect((await db.shots.get(selected[0]!.id))?.beatId).toBe(beat.id);
    expect((await db.shots.get(selected[1]!.id))?.durationSec).toBe(3);
    await expect(
      patchEpisodeShots(first.id, [selected[0]!.id, foreign.id], { durationSec: 5 }),
    ).rejects.toThrow("当前集");
    await expect(
      patchEpisodeShots(first.id, [selected[0]!.id], { beatId: foreignBeat.id }),
    ).rejects.toThrow("场次不属于当前集");
    expect((await db.shots.get(selected[0]!.id))?.durationSec).toBe(3);
    expect((await db.shots.get(selected[0]!.id))?.beatId).toBe(beat.id);
    await expect(deleteEpisodeShots(first.id, [foreign.id])).rejects.toThrow("当前集");

    await deleteEpisodeShots(first.id, selected.map((shot) => shot.id));
    expect(await db.shots.get(selected[0]!.id)).toBeUndefined();
    expect(await db.shots.get(foreign.id)).toBeDefined();
  });

  it("bulk-replaces status, characters, scene, and notes on selected shots", async () => {
    const project = await createProject("bulk replace");
    const episode = (await db.episodes.where("projectId").equals(project.id).first())!;
    const characterA = await addCharacter(project.id);
    const characterB = await addCharacter(project.id);
    const scene = await addScene(project.id);
    const first = await addShot(project.id, episode.id);
    const second = await addShot(project.id, episode.id);
    await patchShot(first.id, { characterIds: [characterA.id], notes: "old" });
    await patchShot(second.id, { characterIds: [characterA.id, characterB.id], notes: "keep?" });

    await patchEpisodeShots(episode.id, [first.id, second.id], {
      status: "ready",
      characterIds: [characterB.id],
      sceneId: scene.id,
      notes: "batch note",
    });

    const updated = await db.shots.bulkGet([first.id, second.id]);
    expect(updated.map((shot) => shot?.status)).toEqual(["ready", "ready"]);
    expect(updated.map((shot) => shot?.characterIds)).toEqual([
      [characterB.id],
      [characterB.id],
    ]);
    expect(updated.map((shot) => shot?.sceneId)).toEqual([scene.id, scene.id]);
    expect(updated.map((shot) => shot?.notes)).toEqual(["batch note", "batch note"]);

    await patchEpisodeShots(episode.id, [first.id], {
      characterIds: [],
      sceneId: undefined,
      notes: "",
    });
    const cleared = await db.shots.get(first.id);
    expect(cleared?.characterIds).toEqual([]);
    expect(cleared?.sceneId).toBeUndefined();
    expect(cleared?.notes).toBe("");
  });

  it("moves a beat's shots with it when beats are reordered", async () => {
    const project = await createProject("beat order");
    const episode = (await db.episodes.where("projectId").equals(project.id).first())!;
    const firstBeat = await addStoryBeat(episode.id);
    const secondBeat = await addStoryBeat(episode.id);
    const firstShot = await addShot(project.id, episode.id, { beatId: firstBeat.id });
    const secondShot = await addShot(project.id, episode.id, { beatId: secondBeat.id });

    await reorderBeats(episode.id, [secondBeat.id, firstBeat.id]);

    const orderedShots = await db.shots.where("episodeId").equals(episode.id).sortBy("order");
    expect(orderedShots.map((shot) => shot.id)).toEqual([secondShot.id, firstShot.id]);
  });

  it("duplicates beats and shots with independent ids and retained references", async () => {
    const project = await createProject("copies");
    const episode = (await db.episodes.where("projectId").equals(project.id).first())!;
    const beat = await addStoryBeat(episode.id);
    const shot = await addShot(project.id, episode.id, { beatId: beat.id });
    await db.shots.update(shot.id, {
      firstFrame: { ...shot.firstFrame, referenceImageIds: ["media-1"] },
    });

    const copiedShot = await duplicateShot(shot.id);
    expect(copiedShot.id).not.toBe(shot.id);
    expect(copiedShot.firstFrame.referenceImageIds).toEqual(["media-1"]);

    const copiedBeat = await duplicateBeat(episode.id, beat.id, { includeShots: true });
    expect(copiedBeat.beat.id).not.toBe(beat.id);
    expect(copiedBeat.shots).toHaveLength(2);
    expect(copiedBeat.shots.every((item) => item.beatId === copiedBeat.beat.id)).toBe(true);
  });

  it("restores deleted shots at their exact original positions", async () => {
    const project = await createProject("shot restore");
    const episode = (await db.episodes.where("projectId").equals(project.id).first())!;
    const shots = [];
    for (let index = 0; index < 5; index += 1) {
      shots.push(await addShot(project.id, episode.id));
    }
    const deleted = [shots[1]!, shots[3]!];

    await deleteShots(deleted.map((shot) => shot.id));
    await restoreShots(deleted);

    const restored = await db.shots.where("episodeId").equals(episode.id).sortBy("order");
    expect(restored.map((shot) => shot.id)).toEqual(shots.map((shot) => shot.id));
    expect(restored.map((shot) => shot.order)).toEqual([1, 2, 3, 4, 5]);
  });

  it("restores a deleted episode with its shots at the original order", async () => {
    const project = await createProject("restore", "series");
    const first = (await db.episodes.where("projectId").equals(project.id).first())!;
    const second = await addEpisode(project.id);
    const shot = await addShot(project.id, first.id);

    const snapshot = await deleteEpisode(first.id);
    expect(await db.episodes.get(first.id)).toBeUndefined();
    expect(await db.shots.get(shot.id)).toBeUndefined();

    await restoreEpisode(snapshot!);
    expect((await db.episodes.get(first.id))?.order).toBe(0);
    expect((await db.episodes.get(second.id))?.order).toBe(1);
    expect((await db.shots.get(shot.id))?.episodeId).toBe(first.id);
  });
});
