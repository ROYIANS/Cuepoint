import { describe, expect, it } from "vitest";
import { db } from "@/db/database";
import {
  addCharacter, addEpisode, addProp, addScene, addShot, addStoryBeat, addStyle,
  createProject, patchEpisodeShots, patchShot, putMedia, setShotSlot,
  undoEpisodeShotBulkPatch,
} from "@/db/repo";
import type { EpisodeShotBulkPatch, EpisodeShotBulkUndo } from "@/db/repo";
import type { Shot } from "@/domain/types";
import { emptySlot } from "@/domain/slot";

async function seed(count = 2) {
  const project = await createProject("bulk undo");
  const episode = await db.episodes.where("projectId").equals(project.id).first();
  if (!episode) throw new Error("missing fixture episode");
  const shots: Shot[] = [];
  for (let index = 0; index < count; index++) shots.push(await addShot(project.id, episode.id));
  return { project, episode, shots };
}

async function bulkUndo(episodeId: string, shots: Shot[], patch: EpisodeShotBulkPatch): Promise<EpisodeShotBulkUndo> {
  const undo = await patchEpisodeShots(episodeId, shots.map((shot) => shot.id), patch);
  if (!undo) throw new Error("missing inverse payload");
  return undo;
}

async function references(projectId: string, episodeId: string) {
  const beat = await addStoryBeat(episodeId);
  const characters = [await addCharacter(projectId), await addCharacter(projectId)];
  const scene = await addScene(projectId);
  const props = [await addProp(projectId), await addProp(projectId)];
  const style = await addStyle(projectId);
  return { beat, characters, scene, props, style };
}

describe("episode bulk undo", () => {
  it("returns the latest committed before snapshot, scoped and limited to affected fields", async () => {
    const { project, episode, shots } = await seed(1);
    const staleView = shots[0];
    await patchShot(staleView.id, { notes: "latest committed", content: "independent" });
    const undo = await patchEpisodeShots(episode.id, [staleView.id], { notes: "bulk" });
    expect(undo).toEqual({
      projectId: project.id, episodeId: episode.id,
      shots: [{ id: staleView.id, before: { notes: "latest committed" }, after: { notes: "bulk" } }],
    });
  });

  it("returns normalized after values instead of the raw input", async () => {
    const { project, episode, shots } = await seed(1);
    const undo = await patchEpisodeShots(episode.id, [shots[0].id], { status: undefined, characterIds: undefined });
    expect(undo).toEqual({
      projectId: project.id, episodeId: episode.id,
      shots: [{ id: shots[0].id, before: { status: "draft", characterIds: [] }, after: { status: "draft", characterIds: [] } }],
    });
  });

  it("restores all eight fields including propIds/styleId, retaining independent text and media edits", async () => {
    const { project, episode, shots } = await seed();
    const beforeRefs = await references(project.id, episode.id);
    const afterRefs = await references(project.id, episode.id);
    const before: EpisodeShotBulkPatch = {
      beatId: beforeRefs.beat.id, durationSec: 2, status: "framed",
      characterIds: beforeRefs.characters.map((item) => item.id), sceneId: beforeRefs.scene.id,
      propIds: beforeRefs.props.map((item) => item.id), styleId: beforeRefs.style.id, notes: "before",
    };
    for (const shot of shots) await patchShot(shot.id, before);
    const after: EpisodeShotBulkPatch = {
      beatId: afterRefs.beat.id, durationSec: 8, status: "approved",
      characterIds: afterRefs.characters.map((item) => item.id), sceneId: afterRefs.scene.id,
      propIds: afterRefs.props.map((item) => item.id), styleId: afterRefs.style.id, notes: "after",
    };
    const undo = await bulkUndo(episode.id, shots, after);
    expect(undo.shots).toEqual(shots.map((shot) => ({ id: shot.id, before, after })));
    await putMedia({ id: "independent-media", projectId: project.id, filename: "result.png", mimeType: "image/png", blob: new Blob(["image"]) });
    const firstFrame = { ...emptySlot(), prompt: "later generation", result: { mediaId: "independent-media", kind: "image" as const } };
    await setShotSlot(shots[0].id, "firstFrame", firstFrame);
    await patchShot(shots[0].id, { content: "later content", shotNumber: "later number", cameraAngle: "later angle" });
    await undoEpisodeShotBulkPatch(undo);
    for (const shot of shots) expect(await db.shots.get(shot.id)).toMatchObject(before);
    expect(await db.shots.get(shots[0].id)).toMatchObject({ content: "later content", shotNumber: "later number", cameraAngle: "later angle", firstFrame });
    expect(await db.media.get("independent-media")).toBeDefined();
  });

  it("restores the transaction snapshot rather than the stale rendered snapshot", async () => {
    const { episode, shots } = await seed(1);
    const staleView = shots[0];
    await patchShot(staleView.id, { notes: "committed after render" });
    const undo = await bulkUndo(episode.id, shots, { notes: "bulk" });
    await undoEpisodeShotBulkPatch(undo);
    expect((await db.shots.get(staleView.id))?.notes).toBe("committed after render");
    expect(staleView.notes).not.toBe("committed after render");
  });

  it("rejects a later affected-field edit on one shot without restoring any sibling", async () => {
    const { project, episode, shots } = await seed();
    const undo = await bulkUndo(episode.id, shots, { durationSec: 5, notes: "bulk" });
    await patchShot(shots[1].id, { durationSec: 9 });
    const beforeAttempt = await db.shots.bulkGet(shots.map((shot) => shot.id));
    const projectBefore = await db.projects.get(project.id);
    let writes = 0;
    const count = () => { writes++; };
    db.shots.hook("updating", count);
    try {
      await expect(undoEpisodeShotBulkPatch(undo)).rejects.toThrow("再次修改");
    } finally {
      db.shots.hook("updating").unsubscribe(count);
    }
    expect(writes).toBe(0);
    expect(await db.shots.bulkGet(shots.map((shot) => shot.id))).toEqual(beforeAttempt);
    expect(await db.projects.get(project.id)).toEqual(projectBefore);
  });

  it.each(["missing", "foreign episode", "foreign project", "duplicate", "wrong scope"] as const)(
    "rejects %s inverse targets before writing any shot", async (invalid) => {
      const { project, episode, shots } = await seed();
      const undo = await bulkUndo(episode.id, shots, { notes: "bulk" });
      if (invalid === "missing") await db.shots.delete(shots[1].id);
      if (invalid === "foreign episode") {
        const otherEpisode = await addEpisode(project.id);
        await db.shots.update(shots[1].id, { episodeId: otherEpisode.id });
      }
      if (invalid === "foreign project") {
        const otherProject = await createProject("foreign");
        await db.shots.update(shots[1].id, { projectId: otherProject.id });
      }
      if (invalid === "duplicate") undo.shots[1] = structuredClone(undo.shots[0]);
      if (invalid === "wrong scope") undo.projectId = (await createProject("foreign scope")).id;
      const rowsBefore = await db.shots.bulkGet(shots.map((shot) => shot.id));
      await expect(undoEpisodeShotBulkPatch(undo)).rejects.toThrow();
      expect(await db.shots.bulkGet(shots.map((shot) => shot.id))).toEqual(rowsBefore);
    },
  );

  it.each(["missing", "foreign episode", "foreign project", "duplicate"] as const)(
    "rejects %s forward targets atomically", async (invalid) => {
      const { project, episode, shots } = await seed();
      const ids = shots.map((shot) => shot.id);
      if (invalid === "missing") ids[1] = "missing";
      if (invalid === "foreign episode") ids[1] = (await addShot(project.id, (await addEpisode(project.id)).id)).id;
      if (invalid === "foreign project") {
        const other = await seed(1);
        ids[1] = other.shots[0].id;
      }
      if (invalid === "duplicate") ids[1] = ids[0];
      await expect(patchEpisodeShots(episode.id, ids, { notes: "invalid" })).rejects.toThrow();
      expect(await db.shots.bulkGet(shots.map((shot) => shot.id))).toEqual(shots);
    },
  );

  it("compares array contents structurally and protects a later reordered array", async () => {
    const { project, episode, shots } = await seed();
    const refs = await references(project.id, episode.id);
    const characterIds = refs.characters.map((item) => item.id);
    const propIds = refs.props.map((item) => item.id);
    const undo = await bulkUndo(episode.id, shots, { characterIds, propIds });
    // Separate persisted arrays with equal contents meet the after precondition.
    await patchShot(shots[0].id, { characterIds: [...characterIds], propIds: [...propIds] });
    await patchShot(shots[1].id, { propIds: [...propIds].reverse() });
    const rowsBefore = await db.shots.bulkGet(shots.map((shot) => shot.id));
    await expect(undoEpisodeShotBulkPatch(undo)).rejects.toThrow("再次修改");
    expect(await db.shots.bulkGet(shots.map((shot) => shot.id))).toEqual(rowsBefore);
    await patchShot(shots[1].id, { propIds: [...propIds] });
    await undoEpisodeShotBulkPatch(undo);
    expect((await db.shots.get(shots[0].id))?.characterIds).toEqual([]);
    expect((await db.shots.get(shots[0].id))?.propIds).toBeUndefined();
  });

  it("detaches before/after arrays from inputs, persisted rows, and sibling entries", async () => {
    const { project, episode, shots } = await seed();
    const refs = await references(project.id, episode.id);
    const characterIds = refs.characters.map((item) => item.id);
    const propIds = refs.props.map((item) => item.id);
    const expectedCharacters = [...characterIds];
    const expectedProps = [...propIds];
    const undo = await bulkUndo(episode.id, shots, { characterIds, propIds });
    characterIds.length = 0;
    propIds.length = 0;
    expect(undo.shots[0].after).toEqual({ characterIds: expectedCharacters, propIds: expectedProps });
    undo.shots[0].after.characterIds?.pop();
    expect(undo.shots[1].after.characterIds).toEqual(expectedCharacters);
    expect((await db.shots.get(shots[0].id))?.characterIds).toEqual(expectedCharacters);
  });

  it("converges coherent already-before fields, whole rows and repeated undo", async () => {
    const { episode, shots } = await seed();
    const undo = await bulkUndo(episode.id, shots, { durationSec: 5, notes: "bulk" });
    await patchShot(shots[0].id, undo.shots[0].before);
    await patchShot(shots[1].id, { durationSec: undo.shots[1].before.durationSec });
    await undoEpisodeShotBulkPatch(undo);
    expect(await db.shots.bulkGet(shots.map((shot) => shot.id))).toEqual(shots);
    await undoEpisodeShotBulkPatch(undo);
    expect(await db.shots.bulkGet(shots.map((shot) => shot.id))).toEqual(shots);
  });

  it("clears formerly absent references and preserves null style inheritance semantics", async () => {
    const { project, episode, shots } = await seed();
    const refs = await references(project.id, episode.id);
    await patchShot(shots[1].id, { styleId: null });
    const undo = await bulkUndo(episode.id, shots, {
      beatId: refs.beat.id, sceneId: refs.scene.id, propIds: [refs.props[0].id], styleId: refs.style.id,
    });
    await undoEpisodeShotBulkPatch(undo);
    expect(await db.shots.get(shots[0].id)).toMatchObject({ beatId: undefined, sceneId: undefined, propIds: undefined, styleId: undefined });
    expect((await db.shots.get(shots[1].id))?.styleId).toBeNull();
  });

  it.each(["beat", "character", "scene", "prop", "style"] as const)(
    "validates every restored %s relationship before any writes", async (kind) => {
      const { project, episode, shots } = await seed();
      const refs = await references(project.id, episode.id);
      const before: EpisodeShotBulkPatch = {
        beatId: refs.beat.id, characterIds: [refs.characters[0].id], sceneId: refs.scene.id,
        propIds: [refs.props[0].id], styleId: refs.style.id,
      };
      // Only the second target has the reference, so validating the first cannot commit it early.
      await patchShot(shots[1].id, before);
      const undo = await bulkUndo(episode.id, shots, {
        beatId: undefined, characterIds: [], sceneId: undefined, propIds: [], styleId: null,
      });
      if (kind === "beat") await db.episodes.update(episode.id, { story: { ...episode.story, beats: [] } });
      if (kind === "character") await db.characters.delete(refs.characters[0].id);
      if (kind === "scene") await db.scenes.delete(refs.scene.id);
      if (kind === "prop") await db.props.delete(refs.props[0].id);
      if (kind === "style") await db.styles.delete(refs.style.id);
      const rowsBefore = await db.shots.bulkGet(shots.map((shot) => shot.id));
      let writes = 0;
      const count = () => { writes++; };
      db.shots.hook("updating", count);
      try {
        await expect(undoEpisodeShotBulkPatch(undo)).rejects.toThrow();
      } finally {
        db.shots.hook("updating").unsubscribe(count);
      }
      expect(writes).toBe(0);
      expect(await db.shots.bulkGet(shots.map((shot) => shot.id))).toEqual(rowsBefore);
    },
  );

  it("validates independent current relationships before restoring touched fields", async () => {
    const { project, episode, shots } = await seed();
    const undo = await bulkUndo(episode.id, shots, { notes: "bulk" });
    const foreign = await addScene((await createProject("foreign refs")).id);
    await db.shots.update(shots[1].id, { sceneId: foreign.id });
    const rowsBefore = await db.shots.bulkGet(shots.map((shot) => shot.id));
    await expect(undoEpisodeShotBulkPatch(undo)).rejects.toThrow("场景不属于当前项目");
    expect(await db.shots.bulkGet(shots.map((shot) => shot.id))).toEqual(rowsBefore);
    expect(await db.projects.get(project.id)).toBeDefined();
  });

  it.each(["unsupported", "different keys", "empty"] as const)("rejects %s inverse fields", async (kind) => {
    const { episode, shots } = await seed();
    const undo = await bulkUndo(episode.id, shots, { notes: "bulk" });
    if (kind === "unsupported") {
      const invalidBefore = { ...undo.shots[1].before, content: "forged" };
      const invalidAfter = { ...undo.shots[1].after, content: "" };
      undo.shots[1] = { ...undo.shots[1], before: invalidBefore, after: invalidAfter };
    }
    if (kind === "different keys") undo.shots[1].before = { durationSec: 0 };
    if (kind === "empty") { undo.shots[1].before = {}; undo.shots[1].after = {}; }
    const rowsBefore = await db.shots.bulkGet(shots.map((shot) => shot.id));
    await expect(undoEpisodeShotBulkPatch(undo)).rejects.toThrow("撤销字段无效");
    expect(await db.shots.bulkGet(shots.map((shot) => shot.id))).toEqual(rowsBefore);
  });

  it.each(["shot write", "project touch"] as const)("rolls back every undo write on %s storage failure and allows retry", async (failure) => {
    const { project, episode, shots } = await seed();
    const undo = await bulkUndo(episode.id, shots, { notes: "bulk" });
    const rowsBefore = await db.shots.bulkGet(shots.map((shot) => shot.id));
    const projectBefore = await db.projects.get(project.id);
    const failShot = (_changes: unknown, key: unknown) => { if (key === shots[1].id) throw new Error("storage failure"); };
    const failProject = () => { throw new Error("storage failure"); };
    if (failure === "shot write") db.shots.hook("updating", failShot);
    else db.projects.hook("updating", failProject);
    try {
      await expect(undoEpisodeShotBulkPatch(undo)).rejects.toThrow("storage failure");
    } finally {
      db.shots.hook("updating").unsubscribe(failShot);
      db.projects.hook("updating").unsubscribe(failProject);
    }
    expect(await db.shots.bulkGet(shots.map((shot) => shot.id))).toEqual(rowsBefore);
    expect(await db.projects.get(project.id)).toEqual(projectBefore);
    await undoEpisodeShotBulkPatch(undo);
    expect(await db.shots.bulkGet(shots.map((shot) => shot.id))).toEqual(shots);
  });

  it("rolls back the forward operation rather than returning an inverse after storage failure", async () => {
    const { project, episode, shots } = await seed();
    const projectBefore = await db.projects.get(project.id);
    const fail = (_changes: unknown, key: unknown) => { if (key === shots[1].id) throw new Error("forward storage failure"); };
    db.shots.hook("updating", fail);
    try {
      await expect(patchEpisodeShots(episode.id, shots.map((shot) => shot.id), { notes: "bulk" })).rejects.toThrow("forward storage failure");
    } finally {
      db.shots.hook("updating").unsubscribe(fail);
    }
    expect(await db.shots.bulkGet(shots.map((shot) => shot.id))).toEqual(shots);
    expect(await db.projects.get(project.id)).toEqual(projectBefore);
  });

  it("keeps no-selection and empty-inverse calls as no-ops", async () => {
    const { project, episode, shots } = await seed();
    const projectBefore = await db.projects.get(project.id);
    await expect(patchEpisodeShots("missing episode", [], { notes: "bulk" })).resolves.toBeUndefined();
    await expect(patchEpisodeShots(episode.id, [shots[0].id], {})).resolves.toBeUndefined();
    await undoEpisodeShotBulkPatch({ projectId: "missing project", episodeId: "missing episode", shots: [] });
    expect(await db.shots.bulkGet(shots.map((shot) => shot.id))).toEqual(shots);
    expect(await db.projects.get(project.id)).toEqual(projectBefore);
  });

});
