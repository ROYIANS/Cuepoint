import {
    type Id,
    type Character,
    type CharacterImageSlot,
    type GenerationSlot,
    normalizeEpisodeStory,
    type Scene,
    type SceneImageSlot,
    type Prop,
    type PropImageSlot,
    type VisualStyle,
    type StyleImageSlot
} from "@/domain/types";
import {db} from "./database";
import {assertDraftBaseline, DraftConflictError} from "@/lib/draftConflict";
import {sameSlotValue, collectSlotsMedia} from "@/domain/slot";
import {
    assertProjectOwner,
    touchProject,
    assertTextPatch,
    pickPatch,
    touch,
    PRODUCTION_TABLES
} from "./productionShared";
import {emptyCharacter, emptyScene, emptyProp, emptyStyle} from "./productionRecords";
import {assertSlotMedia, recycleSlotMedia, deleteMediaIfOrphans} from "./media";

export async function addCharacter(projectId: Id): Promise<Character> {
    return db.transaction("rw", db.projects, db.characters, async () => {
        await assertProjectOwner(projectId);
        const character = emptyCharacter(projectId);
        await db.characters.add(character);
        await touchProject(projectId);
        return character;
    });
}

export async function patchCharacter(
    id: Id,
    patch: Partial<Omit<Character, "id" | "projectId" | "createdAt" | "slots">>,
    baseline?: Partial<Character>,
): Promise<void> {
    assertTextPatch(patch, ["slots"]);
    await db.transaction("rw", db.projects, db.characters, async () => {
        const character = await db.characters.get(id);
        if (!character) throw new Error("角色不存在，无法保存");
        patch = pickPatch(patch, ["name", "bio", "appearance", "notes", "personality", "motivation", "voice", "extra"]);
        assertDraftBaseline(character, patch, baseline);
        await db.characters.put(touch({...character, ...patch}));
        await touchProject(character.projectId);
    });
}

export async function setCharacterSlot(
    id: Id,
    slotKey: CharacterImageSlot,
    slot: GenerationSlot,
    baseline?: GenerationSlot,
): Promise<void> {
    await db.transaction("rw", PRODUCTION_TABLES, async () => {
        const character = await db.characters.get(id);
        if (!character) throw new Error("角色不存在，无法保存");
        if (baseline && !sameSlotValue(character.slots[slotKey], baseline) && !sameSlotValue(character.slots[slotKey], slot)) throw new DraftConflictError();
        await assertSlotMedia(character.projectId, slot);
        const previous = character.slots[slotKey];
        await db.characters.put(
            touch({...character, slots: {...character.slots, [slotKey]: slot}}),
        );
        await touchProject(character.projectId);
        await recycleSlotMedia(previous, slot);
    });
}

export async function deleteCharacter(id: Id): Promise<void> {
    await db.transaction("rw", PRODUCTION_TABLES, async () => {
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
        await touchProject(character.projectId);
        await deleteMediaIfOrphans(mediaIds);
    });
}

export async function addScene(projectId: Id): Promise<Scene> {
    return db.transaction("rw", db.projects, db.scenes, async () => {
        await assertProjectOwner(projectId);
        const scene = emptyScene(projectId);
        await db.scenes.add(scene);
        await touchProject(projectId);
        return scene;
    });
}

export async function patchScene(
    id: Id,
    patch: Partial<Omit<Scene, "id" | "projectId" | "createdAt" | "slots">>,
    baseline?: Partial<Scene>,
): Promise<void> {
    assertTextPatch(patch, ["slots"]);
    await db.transaction("rw", db.projects, db.scenes, async () => {
        const scene = await db.scenes.get(id);
        if (!scene) throw new Error("场景不存在，无法保存");
        patch = pickPatch(patch, ["name", "location", "timeOfDay", "atmosphere", "notes", "geography", "lighting", "extra"]);
        assertDraftBaseline(scene, patch, baseline);
        await db.scenes.put(touch({...scene, ...patch}));
        await touchProject(scene.projectId);
    });
}

export async function setSceneSlot(
    id: Id,
    slotKey: SceneImageSlot,
    slot: GenerationSlot,
    baseline?: GenerationSlot,
): Promise<void> {
    await db.transaction("rw", PRODUCTION_TABLES, async () => {
        const scene = await db.scenes.get(id);
        if (!scene) throw new Error("场景不存在，无法保存");
        if (baseline && !sameSlotValue(scene.slots[slotKey], baseline) && !sameSlotValue(scene.slots[slotKey], slot)) throw new DraftConflictError();
        await assertSlotMedia(scene.projectId, slot);
        const previous = scene.slots[slotKey];
        await db.scenes.put(touch({...scene, slots: {...scene.slots, [slotKey]: slot}}));
        await touchProject(scene.projectId);
        await recycleSlotMedia(previous, slot);
    });
}

export async function deleteScene(id: Id): Promise<void> {
    await db.transaction("rw", PRODUCTION_TABLES, async () => {
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
        await touchProject(scene.projectId);
        await deleteMediaIfOrphans(mediaIds);
    });
}

export async function addProp(projectId: Id): Promise<Prop> {
    return db.transaction("rw", db.projects, db.props, async () => {
        await assertProjectOwner(projectId);
        const prop = emptyProp(projectId);
        await db.props.add(prop);
        await touchProject(projectId);
        return prop;
    });
}

export async function patchProp(
    id: Id,
    patch: Partial<Omit<Prop, "id" | "projectId" | "createdAt" | "slots">>,
    baseline?: Partial<Prop>,
): Promise<void> {
    assertTextPatch(patch, ["slots"]);
    await db.transaction("rw", db.projects, db.props, async () => {
        const prop = await db.props.get(id);
        if (!prop) throw new Error("道具不存在，无法保存");
        patch = pickPatch(patch, ["name", "kind", "notes", "appearance", "material", "size", "usage", "continuity", "extra"]);
        assertDraftBaseline(prop, patch, baseline);
        await db.props.put(touch({...prop, ...patch}));
        await touchProject(prop.projectId);
    });
}

export async function setPropSlot(
    id: Id,
    slotKey: PropImageSlot,
    slot: GenerationSlot,
    baseline?: GenerationSlot,
): Promise<void> {
    await db.transaction("rw", PRODUCTION_TABLES, async () => {
        const prop = await db.props.get(id);
        if (!prop) throw new Error("道具不存在，无法保存");
        if (baseline && !sameSlotValue(prop.slots[slotKey], baseline) && !sameSlotValue(prop.slots[slotKey], slot)) throw new DraftConflictError();
        await assertSlotMedia(prop.projectId, slot);
        const previous = prop.slots[slotKey];
        await db.props.put(touch({...prop, slots: {...prop.slots, [slotKey]: slot}}));
        await touchProject(prop.projectId);
        await recycleSlotMedia(previous, slot);
    });
}

export async function deleteProp(id: Id): Promise<void> {
    await db.transaction("rw", PRODUCTION_TABLES, async () => {
        const prop = await db.props.get(id);
        if (!prop) return;
        const mediaIds = collectSlotsMedia(Object.values(prop.slots));
        await db.props.delete(id);
        await db.shots.where("projectId").equals(prop.projectId).modify((shot) => {
            if (shot.propIds?.includes(id)) shot.propIds = shot.propIds.filter((value) => value !== id);
        });
        await touchProject(prop.projectId);
        await deleteMediaIfOrphans(mediaIds);
    });
}

export async function addStyle(projectId: Id): Promise<VisualStyle> {
    return db.transaction("rw", db.projects, db.styles, async () => {
        await assertProjectOwner(projectId);
        const style = emptyStyle(projectId);
        await db.styles.add(style);
        await touchProject(projectId);
        return style;
    });
}

export async function patchStyle(
    id: Id,
    patch: Partial<Omit<VisualStyle, "id" | "projectId" | "createdAt" | "slots">>,
    baseline?: Partial<VisualStyle>,
): Promise<void> {
    assertTextPatch(patch, ["slots"]);
    await db.transaction("rw", db.projects, db.styles, async () => {
        const style = await db.styles.get(id);
        if (!style) throw new Error("风格不存在，无法保存");
        patch = pickPatch(patch, ["name", "notes", "palette", "lighting", "lens", "composition", "negativePrompt", "extra"]);
        assertDraftBaseline(style, patch, baseline);
        await db.styles.put(touch({...style, ...patch}));
        await touchProject(style.projectId);
    });
}

export async function setStyleSlot(
    id: Id,
    slotKey: StyleImageSlot,
    slot: GenerationSlot,
    baseline?: GenerationSlot,
): Promise<void> {
    await db.transaction("rw", PRODUCTION_TABLES, async () => {
        const style = await db.styles.get(id);
        if (!style) throw new Error("风格不存在，无法保存");
        if (baseline && !sameSlotValue(style.slots[slotKey], baseline) && !sameSlotValue(style.slots[slotKey], slot)) throw new DraftConflictError();
        await assertSlotMedia(style.projectId, slot);
        const previous = style.slots[slotKey];
        await db.styles.put(touch({...style, slots: {...style.slots, [slotKey]: slot}}));
        await touchProject(style.projectId);
        await recycleSlotMedia(previous, slot);
    });
}

export async function deleteStyle(id: Id): Promise<void> {
    await db.transaction("rw", PRODUCTION_TABLES, async () => {
        const style = await db.styles.get(id);
        if (!style) return;
        const mediaIds = collectSlotsMedia(Object.values(style.slots));
        await db.styles.delete(id);
        const project = await db.projects.get(style.projectId);
        if (project?.defaultStyleId === id) await db.projects.update(project.id, {defaultStyleId: undefined});
        await db.shots.where("projectId").equals(style.projectId).modify((shot) => {
            if (shot.styleId === id) shot.styleId = null;
        });
        await touchProject(style.projectId);
        await deleteMediaIfOrphans(mediaIds);
    });
}
