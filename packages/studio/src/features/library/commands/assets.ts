import type {ProductStore} from "../../../platform/storage/types";
import {type Character, type Prop, type Scene, type VisualStyle} from "../models/assets";
import {type CharacterImageSlot, type GenerationSlot, type PropImageSlot, type SceneImageSlot, type StyleImageSlot} from "../models/slots";
import {type Id} from "../../../platform/identity";
import {normalizeEpisodeStory} from "../../video/models/story";
import {db as productDb} from "../../../platform/product/store";
import {assertDraftBaseline, DraftConflictError} from "../../../platform/product/draftConflict";
import {collectSlotsMedia, sameSlotValue} from "../models/slot";
import {assertProjectOwner, touchProject} from "../../projects/commands/ownership";
import {assertTextPatch, pickPatch, touch} from "../../../platform/data/patch";
import {PRODUCTION_TABLES} from "../../../platform/product/scopes";
import {emptyCharacter, emptyProp, emptyScene, emptyStyle} from "../models/newAssets";
import {assertSlotMedia, deleteMediaIfOrphans, recycleSlotMedia} from "./media";

export async function addCharacter(projectId: Id, store?: ProductStore): Promise<Character> {
    const db = store ?? productDb;
    return db.transaction("rw", [db.projects, db.characters].flat(), async (db) => {
        await assertProjectOwner(projectId, db);
        const character = emptyCharacter(projectId);
        await db.characters.add(character);
        await touchProject(projectId, db);
        return character;
    });
}

export async function patchCharacter(
    id: Id,
    patch: Partial<Omit<Character, "id" | "projectId" | "createdAt" | "slots">>,
    baseline?: Partial<Character>, store?: ProductStore
): Promise<void> {
    const db = store ?? productDb;
    assertTextPatch(patch, ["slots"]);
    await db.transaction("rw", [db.projects, db.characters].flat(), async (db) => {
        const character = await db.characters.get(id);
        if (!character) throw new Error("角色不存在，无法保存");
        patch = pickPatch(patch, ["name", "bio", "appearance", "notes", "personality", "motivation", "voice", "extra"]);
        assertDraftBaseline(character, patch, baseline);
        await db.characters.put(touch({...character, ...patch}));
        await touchProject(character.projectId, db);
    });
}

export async function setCharacterSlot(
    id: Id,
    slotKey: CharacterImageSlot,
    slot: GenerationSlot,
    baseline?: GenerationSlot, store?: ProductStore
): Promise<void> {
    const db = store ?? productDb;
    await db.transaction("rw", PRODUCTION_TABLES, async (db) => {
        const character = await db.characters.get(id);
        if (!character) throw new Error("角色不存在，无法保存");
        if (baseline && !sameSlotValue(character.slots[slotKey], baseline) && !sameSlotValue(character.slots[slotKey], slot)) throw new DraftConflictError();
        await assertSlotMedia(character.projectId, slot, undefined, db);
        const previous = character.slots[slotKey];
        await db.characters.put(
            touch({...character, slots: {...character.slots, [slotKey]: slot}}),
        );
        await touchProject(character.projectId, db);
        await recycleSlotMedia(previous, slot, db);
    });
}

export async function deleteCharacter(id: Id, store?: ProductStore): Promise<void> {
    const db = store ?? productDb;
    await db.transaction("rw", PRODUCTION_TABLES, async (db) => {
        const character = await db.characters.get(id);
        if (!character) return;
        const mediaIds = collectSlotsMedia(Object.values(character.slots));
        await db.characters.delete(id);
        const shots = await db.shots.where("projectId").equals(character.projectId).toArray();
        for (const shot of shots) {
            if (shot.characterIds.includes(id)) {
                await db.shots.put({
                    ...shot,
                    characterIds: shot.characterIds.filter((item) => item !== id),
                });
            }
        }
        const episodes = await db.episodes.where("projectId").equals(character.projectId).toArray();
        for (const episode of episodes) {
            const story = normalizeEpisodeStory(episode.story);
            const beats = story.beats.map((beat) => ({
                ...beat,
                characterIds: beat.characterIds.filter((item) => item !== id),
            }));
            if (beats.some((beat, index) => beat.characterIds.length !== story.beats[index]?.characterIds.length)) {
                await db.episodes.put(touch({...episode, story: {...story, beats}}));
            }
        }
        await touchProject(character.projectId, db);
        await deleteMediaIfOrphans(mediaIds, db);
    });
}

export async function addScene(projectId: Id, store?: ProductStore): Promise<Scene> {
    const db = store ?? productDb;
    return db.transaction("rw", [db.projects, db.scenes].flat(), async (db) => {
        await assertProjectOwner(projectId, db);
        const scene = emptyScene(projectId);
        await db.scenes.add(scene);
        await touchProject(projectId, db);
        return scene;
    });
}

export async function patchScene(
    id: Id,
    patch: Partial<Omit<Scene, "id" | "projectId" | "createdAt" | "slots">>,
    baseline?: Partial<Scene>, store?: ProductStore
): Promise<void> {
    const db = store ?? productDb;
    assertTextPatch(patch, ["slots"]);
    await db.transaction("rw", [db.projects, db.scenes].flat(), async (db) => {
        const scene = await db.scenes.get(id);
        if (!scene) throw new Error("场景不存在，无法保存");
        patch = pickPatch(patch, ["name", "location", "timeOfDay", "atmosphere", "notes", "geography", "lighting", "extra"]);
        assertDraftBaseline(scene, patch, baseline);
        await db.scenes.put(touch({...scene, ...patch}));
        await touchProject(scene.projectId, db);
    });
}

export async function setSceneSlot(
    id: Id,
    slotKey: SceneImageSlot,
    slot: GenerationSlot,
    baseline?: GenerationSlot, store?: ProductStore
): Promise<void> {
    const db = store ?? productDb;
    await db.transaction("rw", PRODUCTION_TABLES, async (db) => {
        const scene = await db.scenes.get(id);
        if (!scene) throw new Error("场景不存在，无法保存");
        if (baseline && !sameSlotValue(scene.slots[slotKey], baseline) && !sameSlotValue(scene.slots[slotKey], slot)) throw new DraftConflictError();
        await assertSlotMedia(scene.projectId, slot, undefined, db);
        const previous = scene.slots[slotKey];
        await db.scenes.put(touch({...scene, slots: {...scene.slots, [slotKey]: slot}}));
        await touchProject(scene.projectId, db);
        await recycleSlotMedia(previous, slot, db);
    });
}

export async function deleteScene(id: Id, store?: ProductStore): Promise<void> {
    const db = store ?? productDb;
    await db.transaction("rw", PRODUCTION_TABLES, async (db) => {
        const scene = await db.scenes.get(id);
        if (!scene) return;
        const mediaIds = collectSlotsMedia(Object.values(scene.slots));
        await db.scenes.delete(id);
        const shots = await db.shots.where("projectId").equals(scene.projectId).toArray();
        for (const shot of shots) {
            if (shot.sceneId === id) {
                await db.shots.put({...shot, sceneId: undefined});
            }
        }
        const episodes = await db.episodes.where("projectId").equals(scene.projectId).toArray();
        for (const episode of episodes) {
            const story = normalizeEpisodeStory(episode.story);
            const beats = story.beats.map((beat) =>
                beat.sceneId === id ? {...beat, sceneId: undefined} : beat,
            );
            if (beats.some((beat, index) => beat.sceneId !== story.beats[index]?.sceneId)) {
                await db.episodes.put(touch({...episode, story: {...story, beats}}));
            }
        }
        await touchProject(scene.projectId, db);
        await deleteMediaIfOrphans(mediaIds, db);
    });
}

export async function addProp(projectId: Id, store?: ProductStore): Promise<Prop> {
    const db = store ?? productDb;
    return db.transaction("rw", [db.projects, db.props].flat(), async (db) => {
        await assertProjectOwner(projectId, db);
        const prop = emptyProp(projectId);
        await db.props.add(prop);
        await touchProject(projectId, db);
        return prop;
    });
}

export async function patchProp(
    id: Id,
    patch: Partial<Omit<Prop, "id" | "projectId" | "createdAt" | "slots">>,
    baseline?: Partial<Prop>, store?: ProductStore
): Promise<void> {
    const db = store ?? productDb;
    assertTextPatch(patch, ["slots"]);
    await db.transaction("rw", [db.projects, db.props].flat(), async (db) => {
        const prop = await db.props.get(id);
        if (!prop) throw new Error("道具不存在，无法保存");
        patch = pickPatch(patch, ["name", "kind", "notes", "appearance", "material", "size", "usage", "continuity", "extra"]);
        assertDraftBaseline(prop, patch, baseline);
        await db.props.put(touch({...prop, ...patch}));
        await touchProject(prop.projectId, db);
    });
}

export async function setPropSlot(
    id: Id,
    slotKey: PropImageSlot,
    slot: GenerationSlot,
    baseline?: GenerationSlot, store?: ProductStore
): Promise<void> {
    const db = store ?? productDb;
    await db.transaction("rw", PRODUCTION_TABLES, async (db) => {
        const prop = await db.props.get(id);
        if (!prop) throw new Error("道具不存在，无法保存");
        if (baseline && !sameSlotValue(prop.slots[slotKey], baseline) && !sameSlotValue(prop.slots[slotKey], slot)) throw new DraftConflictError();
        await assertSlotMedia(prop.projectId, slot, undefined, db);
        const previous = prop.slots[slotKey];
        await db.props.put(touch({...prop, slots: {...prop.slots, [slotKey]: slot}}));
        await touchProject(prop.projectId, db);
        await recycleSlotMedia(previous, slot, db);
    });
}

export async function deleteProp(id: Id, store?: ProductStore): Promise<void> {
    const db = store ?? productDb;
    await db.transaction("rw", PRODUCTION_TABLES, async (db) => {
        const prop = await db.props.get(id);
        if (!prop) return;
        const mediaIds = collectSlotsMedia(Object.values(prop.slots));
        await db.props.delete(id);
        await db.shots.where("projectId").equals(prop.projectId).modify((shot) => {
            if (shot.propIds?.includes(id)) shot.propIds = shot.propIds.filter((value) => value !== id);
        });
        await touchProject(prop.projectId, db);
        await deleteMediaIfOrphans(mediaIds, db);
    });
}

export async function addStyle(projectId: Id, store?: ProductStore): Promise<VisualStyle> {
    const db = store ?? productDb;
    return db.transaction("rw", [db.projects, db.styles].flat(), async (db) => {
        await assertProjectOwner(projectId, db);
        const style = emptyStyle(projectId);
        await db.styles.add(style);
        await touchProject(projectId, db);
        return style;
    });
}

export async function patchStyle(
    id: Id,
    patch: Partial<Omit<VisualStyle, "id" | "projectId" | "createdAt" | "slots">>,
    baseline?: Partial<VisualStyle>, store?: ProductStore
): Promise<void> {
    const db = store ?? productDb;
    assertTextPatch(patch, ["slots"]);
    await db.transaction("rw", [db.projects, db.styles].flat(), async (db) => {
        const style = await db.styles.get(id);
        if (!style) throw new Error("风格不存在，无法保存");
        patch = pickPatch(patch, ["name", "notes", "palette", "lighting", "lens", "composition", "negativePrompt", "extra"]);
        assertDraftBaseline(style, patch, baseline);
        await db.styles.put(touch({...style, ...patch}));
        await touchProject(style.projectId, db);
    });
}

export async function setStyleSlot(
    id: Id,
    slotKey: StyleImageSlot,
    slot: GenerationSlot,
    baseline?: GenerationSlot, store?: ProductStore
): Promise<void> {
    const db = store ?? productDb;
    await db.transaction("rw", PRODUCTION_TABLES, async (db) => {
        const style = await db.styles.get(id);
        if (!style) throw new Error("风格不存在，无法保存");
        if (baseline && !sameSlotValue(style.slots[slotKey], baseline) && !sameSlotValue(style.slots[slotKey], slot)) throw new DraftConflictError();
        await assertSlotMedia(style.projectId, slot, undefined, db);
        const previous = style.slots[slotKey];
        await db.styles.put(touch({...style, slots: {...style.slots, [slotKey]: slot}}));
        await touchProject(style.projectId, db);
        await recycleSlotMedia(previous, slot, db);
    });
}

export async function deleteStyle(id: Id, store?: ProductStore): Promise<void> {
    const db = store ?? productDb;
    await db.transaction("rw", PRODUCTION_TABLES, async (db) => {
        const style = await db.styles.get(id);
        if (!style) return;
        const mediaIds = collectSlotsMedia(Object.values(style.slots));
        await db.styles.delete(id);
        const project = await db.projects.get(style.projectId);
        if (project?.defaultStyleId === id) await db.projects.update(project.id, {defaultStyleId: undefined});
        await db.shots.where("projectId").equals(style.projectId).modify((shot) => {
            if (shot.styleId === id) shot.styleId = null;
        });
        await touchProject(style.projectId, db);
        await deleteMediaIfOrphans(mediaIds, db);
    });
}
