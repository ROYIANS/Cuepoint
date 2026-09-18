import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { db } from "@/db/database";
import {
  addCharacter, addEpisode, addProp, addScene, addShot, addShots, addStoryBeat, addStyle,
  copyStudioCharacter, copyStudioProp, copyStudioScene, copyStudioStyle, createProject,
  deleteEpisode, deleteProp, deleteShots, deleteStyle, duplicateBeat, duplicateShot,
  patchCharacter, patchEpisodeShots, patchProjectDetails, patchProp, patchScene, patchShot,
  patchStoryBeat, patchStyle, restoreEpisode, restoreShots, setShotSlot,
} from "@/db/repo";
import { defaultImageGeneration, defaultVideoGeneration } from "@/domain/output";
import { PACKAGE_FORMAT, STUDIO_LIBRARY_ID } from "@/domain/types";
import { emptySlot } from "@/domain/slot";
import { exportProjectZip, importProjectZip } from "@/lib/projectPackage";

async function fixture() {
  const project = await createProject("电影");
  const episode = (await db.episodes.where("projectId").equals(project.id).first())!;
  const character = await addCharacter(project.id);
  const scene = await addScene(project.id);
  const prop = await addProp(project.id);
  const style = await addStyle(project.id);
  return { project, episode, character, scene, prop, style };
}

describe("asset/output foundation repository", () => {
  it("patches independent details atomically and validates default ownership/settings", async () => {
    const { project, style } = await fixture();
    await Promise.all([
      patchProjectDetails(project.id, { brief: "主旨", genre: "悬疑" }),
      patchProjectDetails(project.id, { audience: "成人", tone: "克制" }),
    ]);
    const defaults = { image: defaultImageGeneration(), video: defaultVideoGeneration() };
    await patchProjectDetails(project.id, { defaultStyleId: style.id, generationDefaults: defaults, aspectPreset: "21:9" });
    expect(await db.projects.get(project.id)).toMatchObject({ brief: "主旨", genre: "悬疑", audience: "成人", tone: "克制", defaultStyleId: style.id, generationDefaults: defaults, aspectPreset: "21:9" });
    const foreign = await addStyle(STUDIO_LIBRARY_ID);
    await expect(patchProjectDetails(project.id, { defaultStyleId: foreign.id, tone: "坏" })).rejects.toThrow("风格");
    await expect(patchProjectDetails(project.id, { generationDefaults: { video: { ...defaultVideoGeneration(), duration: 3 } } })).rejects.toThrow();
    expect((await db.projects.get(project.id))?.tone).toBe("克制");
    await expect(patchProjectDetails(project.id, { name: "   ", brief: "should not save" })).rejects.toThrow("项目名称不能为空");
    expect(await db.projects.get(project.id)).toMatchObject({ name: "电影", brief: "主旨" });
    await patchProjectDetails(project.id, { defaultStyleId: undefined, generationDefaults: undefined });
    expect((await db.projects.get(project.id))?.defaultStyleId).toBeUndefined();
    expect((await db.projects.get(project.id))?.generationDefaults).toBeUndefined();
  });

  it("seeds beat cast and scene only on creation; duplication preserves shot choices", async () => {
    const { project, episode, character, scene, prop, style } = await fixture();
    const beat = await addStoryBeat(episode.id);
    await patchStoryBeat(episode.id, beat.id, { characterIds: [character.id], sceneId: scene.id });
    const shots = await addShots(project.id, episode.id, 2, { beatId: beat.id });
    for (const shot of shots) expect(shot).toMatchObject({ characterIds: [character.id], sceneId: scene.id });
    await patchShot(shots[0].id, { characterIds: [], sceneId: undefined, propIds: [prop.id], styleId: null });
    await patchStoryBeat(episode.id, beat.id, { characterIds: [], sceneId: undefined });
    expect(await db.shots.get(shots[1].id)).toMatchObject({ characterIds: [character.id], sceneId: scene.id });
    const copy = await duplicateShot(shots[0].id);
    expect(copy).toMatchObject({ characterIds: [], propIds: [prop.id], styleId: null });
    expect(copy.sceneId).toBeUndefined();
    await patchShot(shots[1].id, { styleId: style.id });
    const duplicatedBeat = await duplicateBeat(episode.id, beat.id, { includeShots: true });
    expect(duplicatedBeat.shots.map((shot) => shot.styleId)).toEqual([null, null, style.id]);
    await expect(addShot(project.id, episode.id, { beatId: "foreign-beat" })).rejects.toThrow("场次");
  });

  it("rejects foreign references at patch, bulk, duplicate and restore boundaries", async () => {
    const local = await fixture();
    const foreign = await fixture();
    const shot = await addShot(local.project.id, local.episode.id);
    for (const patch of [{ propIds: [foreign.prop.id] }, { styleId: foreign.style.id }, { characterIds: [foreign.character.id] }, { sceneId: foreign.scene.id }]) {
      await expect(patchShot(shot.id, patch)).rejects.toThrow("当前项目");
      await expect(patchEpisodeShots(local.episode.id, [shot.id], patch)).rejects.toThrow("当前项目");
    }
    await db.shots.update(shot.id, { propIds: [foreign.prop.id] });
    await expect(duplicateShot(shot.id)).rejects.toThrow("当前项目");
    await db.shots.update(shot.id, { propIds: [] });
    await deleteShots([shot.id]);
    await expect(restoreShots([{ ...shot, styleId: foreign.style.id }])).rejects.toThrow("当前项目");
    expect(await db.shots.get(shot.id)).toBeUndefined();
    await restoreShots([shot]);
    await expect(restoreShots([shot])).rejects.toThrow("已存在");
    const extraEpisode = await addEpisode(local.project.id);
    await addShot(local.project.id, extraEpisode.id);
    const snapshot = (await deleteEpisode(extraEpisode.id))!;
    snapshot.shots[0].propIds = [foreign.prop.id];
    await expect(restoreEpisode(snapshot)).rejects.toThrow("当前项目");
    expect(await db.episodes.get(extraEpisode.id)).toBeUndefined();
  });

  it("cleans deleted prop/style references and preserves inherited versus explicit none", async () => {
    const { project, episode, prop, style } = await fixture();
    await patchProjectDetails(project.id, { defaultStyleId: style.id });
    const inherited = await addShot(project.id, episode.id);
    const explicit = await addShot(project.id, episode.id);
    await patchShot(explicit.id, { propIds: [prop.id], styleId: style.id });
    await deleteProp(prop.id);
    await deleteStyle(style.id);
    expect(await db.shots.get(explicit.id)).toMatchObject({ propIds: [], styleId: null });
    expect((await db.shots.get(inherited.id))?.styleId).toBeUndefined();
    expect((await db.projects.get(project.id))?.defaultStyleId).toBeUndefined();
  });

  it("copies new optional fields as independent studio snapshots", async () => {
    const { project } = await fixture();
    const character = await addCharacter(STUDIO_LIBRARY_ID);
    const scene = await addScene(STUDIO_LIBRARY_ID);
    const prop = await addProp(STUDIO_LIBRARY_ID);
    const style = await addStyle(STUDIO_LIBRARY_ID);
    await patchCharacter(character.id, { personality: "警觉", motivation: "回家", voice: "低沉" });
    await patchScene(scene.id, { geography: "北岸", lighting: "月光" });
    await patchProp(prop.id, { appearance: "磨损", material: "铜", size: "掌心", usage: "开门", continuity: "右手" });
    await patchStyle(style.id, { palette: "蓝", lighting: "侧光", lens: "35mm", composition: "留白", negativePrompt: "荧光色" });
    const copies = await Promise.all([copyStudioCharacter(project.id, character.id), copyStudioScene(project.id, scene.id), copyStudioProp(project.id, prop.id), copyStudioStyle(project.id, style.id)]);
    expect(copies[0]).toMatchObject({ personality: "警觉", motivation: "回家", voice: "低沉" });
    expect(copies[1]).toMatchObject({ geography: "北岸", lighting: "月光" });
    expect(copies[2]).toMatchObject({ material: "铜", continuity: "右手" });
    expect(copies[3]).toMatchObject({ palette: "蓝", negativePrompt: "荧光色" });
    await patchProp(copies[2].id, { material: "木" });
    expect((await db.props.get(prop.id))?.material).toBe("铜");
  });

  it("rejects stale or foreign media reuse and permits shared same-owner references", async () => {
    const { project, episode } = await fixture();
    const shot = await addShot(project.id, episode.id);
    const slot = { ...emptySlot(), result: { mediaId: "media", kind: "image" as const } };
    await expect(setShotSlot(shot.id, "firstFrame", slot)).rejects.toThrow("素材");
    await db.media.put({ id: "media", projectId: "foreign", filename: "a.png", mimeType: "image/png", blob: new Blob(["x"]) });
    await expect(setShotSlot(shot.id, "firstFrame", slot)).rejects.toThrow("素材");
    await db.media.update("media", { projectId: project.id });
    await db.media.update("media", { blob: new Blob([]) });
    await expect(setShotSlot(shot.id, "firstFrame", slot)).rejects.toThrow("素材");
    await db.media.update("media", { blob: new Blob(["x"]) });
    await setShotSlot(shot.id, "firstFrame", slot);
    await setShotSlot(shot.id, "lastFrame", slot);
    await setShotSlot(shot.id, "firstFrame", emptySlot());
    expect(await db.media.get("media")).toBeDefined();
  });
});

describe("asset/output package contract", () => {
  it("round trips optional data/settings and remaps default/override/prop references", async () => {
    const { project, episode, character, scene, prop, style } = await fixture();
    await patchCharacter(character.id, { personality: "警觉", motivation: "回家", voice: "低沉" });
    await patchScene(scene.id, { geography: "北岸", lighting: "月光" });
    await patchProp(prop.id, { appearance: "磨损", material: "铜", size: "掌心", usage: "开门", continuity: "右手" });
    await patchStyle(style.id, { palette: "蓝", lighting: "侧光", lens: "35mm", composition: "留白", negativePrompt: "荧光色" });
    const defaults = { image: defaultImageGeneration(), video: defaultVideoGeneration() };
    await patchProjectDetails(project.id, { brief: "主旨", genre: "悬疑", audience: "成人", tone: "克制", defaultStyleId: style.id, generationDefaults: defaults, aspectPreset: "4:3" });
    const inherited = await addShot(project.id, episode.id);
    const explicit = await addShot(project.id, episode.id);
    const none = await addShot(project.id, episode.id);
    await patchShot(explicit.id, { propIds: [prop.id], styleId: style.id });
    await patchShot(none.id, { styleId: null });
    const imported = await importProjectZip(await exportProjectZip(project.id));
    const [importedStyle] = await db.styles.where("projectId").equals(imported.id).toArray();
    const [importedProp] = await db.props.where("projectId").equals(imported.id).toArray();
    const shots = await db.shots.where("projectId").equals(imported.id).sortBy("order");
    expect(imported).toMatchObject({ brief: "主旨", genre: "悬疑", audience: "成人", tone: "克制", defaultStyleId: importedStyle.id, generationDefaults: defaults, aspectPreset: "4:3" });
    expect(importedStyle.id).not.toBe(style.id);
    expect(importedStyle).toMatchObject({ palette: "蓝", lighting: "侧光", lens: "35mm", composition: "留白", negativePrompt: "荧光色" });
    expect(importedProp).toMatchObject({ appearance: "磨损", material: "铜", size: "掌心", usage: "开门", continuity: "右手" });
    expect((await db.characters.where("projectId").equals(imported.id).first())?.voice).toBe("低沉");
    expect((await db.scenes.where("projectId").equals(imported.id).first())?.geography).toBe("北岸");
    expect(shots.map((shot) => shot.shotNumber)).toEqual([inherited.shotNumber, explicit.shotNumber, none.shotNumber]);
    expect(shots[0].styleId).toBeUndefined();
    expect(shots[1]).toMatchObject({ styleId: importedStyle.id, propIds: [importedProp.id] });
    expect(shots[2].styleId).toBeNull();
  });

  it("retains unsupported generation profiles but removes foreign package references", async () => {
    const zip = new JSZip();
    zip.file("manifest.json", JSON.stringify({ format: PACKAGE_FORMAT }));
    const generationDefaults = { image: { ...defaultImageGeneration(), model: "future-model", profileVersion: "future", size: "future-size" } };
    zip.file("project.json", JSON.stringify({ name: "legacy", defaultStyleId: "external-style", generationDefaults }));
    zip.file("shots.json", JSON.stringify([{ id: "shot", styleId: "external-style", propIds: ["external-prop"] }, { id: "inherited" }]));
    const imported = await importProjectZip(await zip.generateAsync({ type: "blob" }));
    expect(imported.generationDefaults).toMatchObject(generationDefaults);
    expect(imported.defaultStyleId).toBeUndefined();
    const shots = await db.shots.where("projectId").equals(imported.id).sortBy("order");
    expect(shots[0]).toMatchObject({ styleId: null, propIds: [] });
    expect(shots[1].styleId).toBeUndefined();
    await patchProjectDetails(imported.id, { brief: "still editable" });
    expect((await db.projects.get(imported.id))?.generationDefaults).toMatchObject(generationDefaults);
    const again = await importProjectZip(await exportProjectZip(imported.id));
    expect(again.generationDefaults).toMatchObject(generationDefaults);
  });

  it.each([{ propIds: "wrong" }, { styleId: 42 }])("rejects malformed relation fields atomically", async (shot) => {
    const zip = new JSZip();
    zip.file("manifest.json", JSON.stringify({ format: PACKAGE_FORMAT }));
    zip.file("project.json", JSON.stringify({ name: "bad" }));
    zip.file("shots.json", JSON.stringify([shot]));
    await expect(importProjectZip(await zip.generateAsync({ type: "blob" }))).rejects.toThrow();
    expect(await db.projects.count()).toBe(0);
  });
});
