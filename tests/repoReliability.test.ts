import Dexie from "dexie";
import { describe, expect, it } from "vitest";
import { db } from "@/db/database";
import {
  addCharacter, addEpisode, addProp, addScene, addShot, addStoryBeat, addStyle,
  createProject, deleteEpisode, deleteMediaIfOrphan, deleteStoryBeat,
  patchCharacter, patchProjectOutput, patchProp, patchScene, patchShot, patchStyle,
  renameProject, setCharacterSlot, setPropSlot, setSceneSlot, setShotSlot, setStyleSlot,
  touchProject, updateEpisode, updateEpisodeDraft, updateEpisodeShotFilters,
  updateProject, updateShotSettings, updateWorldSetting,
} from "@/db/repo";
import { emptySlot } from "@/domain/slot";
import { getEpisodeShotFilters, type GenerationSlot } from "@/domain/types";

const slot = (prompt: string): GenerationSlot => ({ ...emptySlot(), prompt });

describe("atomic production persistence", () => {
  it("preserves concurrent independent project, output, preferences and world edits", async () => {
    const project = await createProject("before");
    await Promise.all([
      renameProject(project.id, "renamed"),
      patchProjectOutput(project.id, { aspectPreset: "9:16" }),
      updateProject(project.id, { mode: "series" }),
      updateWorldSetting(project.id, { background: "background" }),
      updateWorldSetting(project.id, { worldview: "world" }),
      updateShotSettings(project.id, { defaultDurationSec: 5 }),
      touchProject(project.id),
    ]);
    expect(await db.projects.get(project.id)).toMatchObject({
      name: "renamed", mode: "series", aspectPreset: "9:16",
      setting: { background: "background", worldview: "world" },
      shotSettings: { defaultDurationSec: 5 },
    });
  });

  it("preserves independent episode and shot fields alongside slot writes", async () => {
    const project = await createProject("concurrent");
    const episode = (await db.episodes.where("projectId").equals(project.id).first())!;
    const shot = await addShot(project.id, episode.id);
    await Promise.all([
      updateEpisode(episode.id, { title: "episode" }),
      updateEpisodeDraft(episode.id, { script: "script" }),
      patchShot(shot.id, { content: "content" }),
      patchShot(shot.id, { notes: "notes" }),
      setShotSlot(shot.id, "firstFrame", slot("first")),
      setShotSlot(shot.id, "clip", slot("clip")),
    ]);
    expect(await db.episodes.get(episode.id)).toMatchObject({ title: "episode", story: { script: "script" } });
    expect(await db.shots.get(shot.id)).toMatchObject({ content: "content", notes: "notes", firstFrame: slot("first"), clip: slot("clip") });
  });

  it("preserves scalar and separate nested slots for every asset kind", async () => {
    const project = await createProject("assets");
    const character = await addCharacter(project.id);
    const scene = await addScene(project.id);
    const prop = await addProp(project.id);
    const style = await addStyle(project.id);
    await Promise.all([
      patchCharacter(character.id, { bio: "bio" }), patchCharacter(character.id, { name: "character" }),
      setCharacterSlot(character.id, "front", slot("front")), setCharacterSlot(character.id, "side", slot("side")),
      patchScene(scene.id, { location: "place" }), patchScene(scene.id, { name: "scene" }),
      setSceneSlot(scene.id, "wide", slot("wide")), setSceneSlot(scene.id, "detail", slot("detail")),
      patchProp(prop.id, { kind: "key" }), patchProp(prop.id, { name: "prop" }),
      setPropSlot(prop.id, "hero", slot("hero")), setPropSlot(prop.id, "worn", slot("worn")),
      patchStyle(style.id, { notes: "notes" }), patchStyle(style.id, { name: "style" }),
      setStyleSlot(style.id, "look", slot("look")), setStyleSlot(style.id, "light", slot("light")),
    ]);
    expect(await db.characters.get(character.id)).toMatchObject({ bio: "bio", name: "character", slots: { front: slot("front"), side: slot("side") } });
    expect(await db.scenes.get(scene.id)).toMatchObject({ location: "place", name: "scene", slots: { wide: slot("wide"), detail: slot("detail") } });
    expect(await db.props.get(prop.id)).toMatchObject({ kind: "key", name: "prop", slots: { hero: slot("hero"), worn: slot("worn") } });
    expect(await db.styles.get(style.id)).toMatchObject({ notes: "notes", name: "style", slots: { look: slot("look"), light: slot("light") } });
  });

  it("keeps one episode when two deletes race, and serializes new episode ordering", async () => {
    const project = await createProject("series", "series");
    const first = (await db.episodes.where("projectId").equals(project.id).first())!;
    const second = await addEpisode(project.id);
    const results = await Promise.allSettled([deleteEpisode(first.id), deleteEpisode(second.id)]);
    expect(results.map((r) => r.status).sort()).toEqual(["fulfilled", "rejected"]);
    expect(await db.episodes.where("projectId").equals(project.id).count()).toBe(1);
    await Promise.all([addEpisode(project.id), addEpisode(project.id)]);
    expect((await db.episodes.where("projectId").equals(project.id).sortBy("order")).map((e) => e.order)).toEqual([0, 1, 2]);
  });

  it("does not collect shared media until its final committed reference is removed", async () => {
    const project = await createProject("shared");
    const character = await addCharacter(project.id);
    const scene = await addScene(project.id);
    const mediaId = "shared-image";
    await db.media.add({ id: mediaId, projectId: project.id, mimeType: "image/png", filename: "image.png", blob: new Blob(["image"]) });
    const shared = { ...emptySlot(), result: { mediaId, kind: "image" as const } };
    await setCharacterSlot(character.id, "front", shared);
    await setSceneSlot(scene.id, "wide", shared);
    await Promise.all([setCharacterSlot(character.id, "front", emptySlot()), deleteMediaIfOrphan(mediaId)]);
    expect(await db.media.get(mediaId)).toBeDefined();
    await setSceneSlot(scene.id, "wide", emptySlot());
    expect(await db.media.get(mediaId)).toBeUndefined();
  });

  it("rolls back a slot edit and its cleanup together when storage fails", async () => {
    const project = await createProject("rollback");
    const character = await addCharacter(project.id);
    const mediaId = "previous-result";
    await db.media.add({ id: mediaId, projectId: project.id, mimeType: "image/png", filename: "image.png", blob: new Blob(["image"]) });
    const original = { ...slot("keep"), result: { mediaId, kind: "image" as const } };
    await setCharacterSlot(character.id, "front", original);
    const fail = () => { throw new Error("simulated storage failure"); };
    db.media.hook("deleting", fail);
    try {
      await expect(setCharacterSlot(character.id, "front", slot("replacement"))).rejects.toThrow("simulated storage failure");
    } finally {
      db.media.hook("deleting").unsubscribe(fail);
    }
    expect((await db.characters.get(character.id))?.slots.front).toEqual(original);
    expect(await db.media.get(mediaId)).toBeDefined();
  });

  it("rejects saves after their target was deleted", async () => {
    await expect(setCharacterSlot("deleted", "front", slot("draft"))).rejects.toThrow("无法保存");
    await expect(setShotSlot("deleted", "clip", slot("draft"))).rejects.toThrow("无法保存");
    await expect(patchStyle("deleted", { notes: "draft" })).rejects.toThrow("无法保存");
  });
});

describe("episode filter ownership", () => {
  it("keeps every dimension independent and prunes deleted/foreign beats preserving none", async () => {
    const project = await createProject("filters");
    const first = (await db.episodes.where("projectId").equals(project.id).first())!;
    const second = await addEpisode(project.id);
    const beat = await addStoryBeat(first.id);
    const foreign = await addStoryBeat(second.id);
    await updateEpisodeShotFilters(first.id, { statuses: ["approved"], beatIds: [beat.id, foreign.id, "none"], gaps: ["missingClip"] });
    await Promise.all([
      updateEpisodeShotFilters(first.id, { statuses: ["ready"] }),
      updateEpisodeShotFilters(first.id, { gaps: ["missingFirstFrame"] }),
    ]);
    expect((await db.episodes.get(first.id))?.shotFilters).toEqual({ statuses: ["ready"], gaps: ["missingFirstFrame"], beatIds: [beat.id, "none"] });
    expect((await db.episodes.get(second.id))?.shotFilters).toEqual({ statuses: [], gaps: [], beatIds: [] });
    await deleteStoryBeat(first.id, beat.id);
    expect((await db.episodes.get(first.id))?.shotFilters?.beatIds).toEqual(["none"]);
  });

  it("migrates version-5 legacy filters within each episode without stale IDs", async () => {
    const project = await createProject("legacy", "series");
    const first = (await db.episodes.where("projectId").equals(project.id).first())!;
    const second = await addEpisode(project.id);
    const firstBeat = await addStoryBeat(first.id);
    const secondBeat = await addStoryBeat(second.id);
    const episodes = await db.episodes.toArray();
    episodes.forEach((episode) => { delete episode.shotFilters; });
    project.shotSettings.filters = { statuses: ["ready"], gaps: ["missingClip"], beatIds: [firstBeat.id, secondBeat.id, "missing", "none"] };
    const stores = Object.fromEntries(db.tables.map((table) => [table.name, [table.schema.primKey.src, ...table.schema.indexes.map((index) => index.src)].join(", ")]));
    await db.delete();
    const legacy = new Dexie(db.name);
    legacy.version(5).stores(stores);
    await legacy.open();
    await legacy.table("projects").add(project);
    await legacy.table("episodes").bulkAdd(episodes);
    legacy.close();
    await db.open();
    const migratedFirst = (await db.episodes.get(first.id))!;
    const migratedSecond = (await db.episodes.get(second.id))!;
    expect(migratedFirst.shotFilters).toEqual({ statuses: ["ready"], gaps: ["missingClip"], beatIds: [firstBeat.id, "none"] });
    expect(migratedSecond.shotFilters?.beatIds).toEqual([secondBeat.id, "none"]);
    expect(getEpisodeShotFilters({ ...migratedFirst, shotFilters: undefined }, project)).toEqual(migratedFirst.shotFilters);
  });
});
