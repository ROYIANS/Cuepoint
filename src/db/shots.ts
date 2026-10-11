import type {ProductStore} from "@/lib/storage/types";
import {
    type GenerationSlot,
    type Id,
    type MediaRecord,
    normalizeEpisodeStory,
    normalizeShotSettings,
    normalizeShotStatus,
    type Shot,
    type ShotPictureField,
    type StoryBeat
} from "@/domain/types";
import {db as productDb} from "./database";
import {sameSlotValue, SHOT_PICTURE_FIELDS, slotMediaIds} from "@/domain/slot";
import {DraftConflictError, sameDraftStructure} from "@/lib/draftConflict";
import {createId} from "@/lib/ids";
import {
    assertAssetReferences,
    assertCompleteOrder,
    assertShotReferences,
    assertTextPatch,
    assertVideoProject,
    pickPatch,
    PRODUCTION_TABLES,
    touchProject
} from "./productionShared";
import {emptyShot} from "./productionRecords";
import {assertSlotMedia, deleteMediaIfOrphans, recycleSlotMedia} from "./media";

async function nextShotNumber(episodeId: Id, store?: ProductStore): Promise<string> {
    const db = store ?? productDb;
    const shots = await db.shots.where("episodeId").equals(episodeId).toArray();
    const max = shots.reduce((current, shot) => {
        const value = Number.parseInt(shot.shotNumber, 10);
        return Number.isFinite(value) ? Math.max(current, value) : current;
    }, 0);
    return String(max + 1);
}

async function reindexShots(episodeId: Id, store?: ProductStore): Promise<void> {
    const db = store ?? productDb;
    const shots = (await db.shots.where("episodeId").equals(episodeId).toArray()).sort(
        (a, b) => a.order - b.order,
    );
    await Promise.all(
        shots.map((shot, index) => db.shots.put({...shot, order: index + 1})),
    );
}

function beatRank(beats: StoryBeat[], beatId: Id | undefined): number {
    if (!beatId) return Number.POSITIVE_INFINITY;
    const index = beats.findIndex((beat) => beat.id === beatId);
    return index === -1 ? Number.POSITIVE_INFINITY : index;
}

function insertOrderForBeat(beats: StoryBeat[], shots: Shot[], beatId?: Id): number {
    const sorted = [...shots].sort((a, b) => a.order - b.order);
    if (sorted.length === 0) return 1;
    const target = beatRank(beats, beatId);
    let lastLeq = 0;
    for (const shot of sorted) {
        if (beatRank(beats, shot.beatId) <= target) lastLeq = shot.order;
    }
    if (lastLeq === 0) return sorted[0]?.order ?? 1;
    return lastLeq + 1;
}

export async function addShots(
    projectId: Id,
    episodeId: Id,
    count: number,
    options?: { atOrder?: number; beatId?: Id }, store?: ProductStore
): Promise<Shot[]> {
    const db = store ?? productDb;
    if (count <= 0) return [];
    return db.transaction("rw", PRODUCTION_TABLES, async (db) => {
        await assertVideoProject(projectId, db);
        const episode = await db.episodes.get(episodeId);
        if (!episode || episode.projectId !== projectId) return [];
        const project = await db.projects.get(projectId);
        if (!project) return [];
        const beats = normalizeEpisodeStory(episode.story).beats;
        const beat = options?.beatId === undefined ? undefined : beats.find((item) => item.id === options.beatId);
        if (options?.beatId !== undefined && !beat) throw new Error("场次不属于当前集");
        if (beat) await assertAssetReferences(projectId, beat, db);
        const shots = (await db.shots.where("episodeId").equals(episodeId).toArray()).sort(
            (a, b) => a.order - b.order,
        );
        const insertAt = options?.atOrder ?? insertOrderForBeat(beats, shots, options?.beatId);
        for (const shot of shots) {
            if (shot.order >= insertAt) {
                await db.shots.put({...shot, order: shot.order + count});
            }
        }
        const created: Shot[] = [];
        const shotSettings = normalizeShotSettings(project.shotSettings);
        const nextNumber = shotSettings.autoIncrementShotNumber
            ? Number.parseInt(await nextShotNumber(episodeId, db), 10) || shots.length + 1
            : insertAt;
        for (let index = 0; index < count; index += 1) {
            const shotNumber = shotSettings.autoIncrementShotNumber
                ? String(nextNumber + index)
                : String(insertAt + index);
            const shot = emptyShot(
                projectId,
                episodeId,
                insertAt + index,
                shotNumber,
                shotSettings.defaultDurationSec,
                options?.beatId,
            );
            if (beat) {
                shot.characterIds = [...beat.characterIds];
                shot.sceneId = beat.sceneId;
            }
            await db.shots.add(shot);
            created.push(shot);
        }
        await touchProject(projectId, db);
        return created;
    });
}

export async function addShot(
    projectId: Id,
    episodeId: Id,
    options?: { atOrder?: number; beatId?: Id }, store?: ProductStore
): Promise<Shot> {
    const db = store ?? productDb;
    const [shot] = await addShots(projectId, episodeId, 1, options, db);
    if (!shot) throw new Error("项目或集不存在");
    return shot;
}

export async function patchShot(
    id: Id,
    patch: Partial<Omit<Shot, "id" | "projectId" | "episodeId" | ShotPictureField>>,
    baseline?: Partial<Shot>, store?: ProductStore
): Promise<void> {
    const db = store ?? productDb;
    assertTextPatch(patch, SHOT_PICTURE_FIELDS);
    await db.transaction("rw", PRODUCTION_TABLES, async (db) => {
        const shot = await db.shots.get(id);
        if (!shot) throw new Error("镜头不存在，无法保存");
        patch = pickPatch(patch, ["order", "shotNumber", "status", "category", "durationSec", "content", "notes", "sceneCloseup", "sound", "emotion", "cameraAngle", "cameraGear", "focalLength", "characterIds", "sceneId", "beatId", "propIds", "styleId", "extra"]);
        if (baseline) {
            for (const key of Object.keys(patch) as Array<keyof typeof patch>) {
                const current = key === "durationSec" ? shot.durationSec ?? 0 : shot[key] ?? "";
                const original = key === "durationSec" ? baseline.durationSec ?? 0 : baseline[key] ?? "";
                const final = key === "durationSec" ? patch.durationSec ?? 0 : patch[key] ?? "";
                if (!sameDraftStructure(current, original) && !sameDraftStructure(current, final)) throw new DraftConflictError();
            }
        }
        await assertShotReferences({...shot, ...patch}, db);
        await db.shots.put({...shot, ...patch});
        await touchProject(shot.projectId, db);
    });
}

/** Apply one checkbox intention to the latest membership, preserving other edits. */
export async function setShotCharacterSelected(id: Id, characterId: Id, selected: boolean, store?: ProductStore): Promise<void> {
    const db = store ?? productDb;
    await db.transaction("rw", PRODUCTION_TABLES, async (db) => {
        const shot = await db.shots.get(id);
        if (!shot) throw new Error("镜头不存在，无法保存");
        const character = await db.characters.get(characterId);
        if ((selected && !character) || (character && character.projectId !== shot.projectId)) {
            throw new Error("角色不属于当前项目");
        }
        // Removing a deleted reference is permitted only if all remaining
        // references validate. Selecting it can never resurrect the old row.
        let characterIds = shot.characterIds;
        if (selected) {
            if (!characterIds.includes(characterId)) characterIds = [...characterIds, characterId];
        } else {
            characterIds = characterIds.filter((item) => item !== characterId);
        }
        const next = {...shot, characterIds};
        await assertShotReferences(next, db);
        await db.shots.put(next);
        await touchProject(shot.projectId, db);
    });
}

export type EpisodeShotBulkPatch = Partial<
    Pick<Shot, "beatId" | "durationSec" | "status" | "characterIds" | "sceneId" | "propIds" | "styleId" | "notes">
>;

const SHOT_BULK_FIELDS = ["beatId", "durationSec", "status", "characterIds", "sceneId", "propIds", "styleId", "notes"] as const;

type ShotBulkField = (typeof SHOT_BULK_FIELDS)[number];

export interface EpisodeShotBulkUndo {
    projectId: Id;
    episodeId: Id;
    shots: Array<{ id: Id; before: EpisodeShotBulkPatch; after: EpisodeShotBulkPatch }>;
}

function shotBulkSnapshot(shot: Shot, fields: readonly ShotBulkField[]): EpisodeShotBulkPatch {
    // Include absent optional values so undo can explicitly clear a newly assigned reference.
    return structuredClone(pickPatch({
        beatId: shot.beatId, durationSec: shot.durationSec, status: shot.status,
        characterIds: shot.characterIds, sceneId: shot.sceneId, propIds: shot.propIds,
        styleId: shot.styleId, notes: shot.notes,
    }, fields));
}

function sameShotBulkValue(left: EpisodeShotBulkPatch[ShotBulkField], right: EpisodeShotBulkPatch[ShotBulkField]): boolean {
    if (Array.isArray(left) && Array.isArray(right)) {
        return left.length === right.length && left.every((id, index) => id === right[index]);
    }
    return left === right;
}

export async function patchEpisodeShots(
    episodeId: Id,
    ids: Id[],
    patch: EpisodeShotBulkPatch, store?: ProductStore
): Promise<EpisodeShotBulkUndo | undefined> {
    const db = store ?? productDb;
    if (ids.length === 0) return;
    ids = [...ids];
    patch = structuredClone(pickPatch(patch, SHOT_BULK_FIELDS));
    return db.transaction("rw", PRODUCTION_TABLES, async (db) => {
        const episode = await db.episodes.get(episodeId);
        if (!episode) throw new Error("集不存在");
        await assertVideoProject(episode.projectId, db);
        if (new Set(ids).size !== ids.length) throw new Error("镜头列表包含重复记录");
        const rows = await db.shots.bulkGet(ids);
        const shots: Shot[] = [];
        for (const shot of rows) {
            if (!shot || shot.episodeId !== episodeId || shot.projectId !== episode.projectId) {
                throw new Error("所选镜头不属于当前集");
            }
            shots.push(shot);
        }
        const fields = SHOT_BULK_FIELDS.filter((key) => Object.hasOwn(patch, key));
        if (fields.length === 0) return;
        const nextPatch: EpisodeShotBulkPatch = {...patch};
        if ("status" in patch) nextPatch.status = normalizeShotStatus(patch.status);
        if ("characterIds" in patch) {
            nextPatch.characterIds = Array.isArray(patch.characterIds) ? [...patch.characterIds] : [];
        }
        const updated = shots.map((shot) => ({...shot, ...nextPatch}));
        for (const shot of updated) await assertShotReferences(shot, db);
        const undo: EpisodeShotBulkUndo = {
            projectId: episode.projectId, episodeId,
            shots: shots.map((shot, index) => ({
                id: shot.id,
                before: shotBulkSnapshot(shot, fields),
                after: shotBulkSnapshot(updated[index], fields),
            })),
        };
        await db.shots.bulkPut(updated);
        await touchProject(episode.projectId, db);
        return undo;
    });
}

export async function undoEpisodeShotBulkPatch(undo: EpisodeShotBulkUndo, store?: ProductStore): Promise<void> {
    const db = store ?? productDb;
    if (undo.shots.length === 0) return;
    undo = structuredClone(undo);
    await db.transaction("rw", PRODUCTION_TABLES, async (db) => {
        const episode = await db.episodes.get(undo.episodeId);
        if (!episode || episode.projectId !== undo.projectId) throw new Error("撤销的集不属于当前项目");
        await assertVideoProject(undo.projectId, db);
        const ids = undo.shots.map((entry) => entry.id);
        if (new Set(ids).size !== ids.length) throw new Error("镜头列表包含重复记录");
        const shots = await db.shots.bulkGet(ids);
        const restored: Shot[] = [];
        for (const [index, entry] of undo.shots.entries()) {
            const shot = shots[index];
            if (!shot || shot.projectId !== undo.projectId || shot.episodeId !== undo.episodeId) {
                throw new Error("所选镜头不属于当前集，无法撤销");
            }
            const fields = SHOT_BULK_FIELDS.filter((key) => Object.hasOwn(entry.after, key));
            if (fields.length === 0 || fields.length !== Object.keys(entry.after).length ||
                fields.length !== Object.keys(entry.before).length || fields.some((key) => !Object.hasOwn(entry.before, key))) {
                throw new Error("批量撤销字段无效");
            }
            for (const key of fields) {
                // A field already restored to before can converge; any third value is a conflict.
                if (!sameShotBulkValue(shot[key], entry.after[key]) && !sameShotBulkValue(shot[key], entry.before[key])) {
                    throw new Error("镜头已被再次修改，无法撤销批量修改。后续修改已保留。");
                }
            }
            const next = {...shot, ...entry.before};
            await assertShotReferences(shot, db);
            await assertShotReferences(next, db);
            restored.push(next);
        }
        // Validate every target and relationship before the first write, then commit as one group.
        await db.shots.bulkPut(restored);
        await touchProject(undo.projectId, db);
    });
}

export async function reorderShots(episodeId: Id, orderedIds: Id[], store?: ProductStore): Promise<void> {
    const db = store ?? productDb;
    await db.transaction("rw", [db.shots, db.episodes, db.projects].flat(), async (db) => {
        const episode = await db.episodes.get(episodeId);
        if (!episode) throw new Error("集不存在");
        await assertVideoProject(episode.projectId, db);
        const shots = await db.shots.where("episodeId").equals(episodeId).toArray();
        if (shots.some((shot) => shot.projectId !== episode.projectId)) {
            throw new Error("镜头与集不属于同一项目");
        }
        assertCompleteOrder(shots.map((shot) => shot.id), orderedIds);
        const byId = new Map(shots.map((shot) => [shot.id, shot]));
        await Promise.all(
            orderedIds.map((id, index) => db.shots.put({...byId.get(id)!, order: index + 1})),
        );
        await touchProject(episode.projectId, db);
    });
}

export async function duplicateShot(id: Id, store?: ProductStore): Promise<Shot> {
    const db = store ?? productDb;
    return db.transaction("rw", PRODUCTION_TABLES, async (db) => {
        const source = await db.shots.get(id);
        if (!source) throw new Error("镜头不存在");
        const episode = await db.episodes.get(source.episodeId);
        if (!episode || episode.projectId !== source.projectId) {
            throw new Error("镜头与集不属于同一项目");
        }
        const siblings = await db.shots.where("episodeId").equals(source.episodeId).toArray();
        if (siblings.some((shot) => shot.projectId !== episode.projectId)) {
            throw new Error("镜头与集不属于同一项目");
        }
        for (const shot of siblings) {
            if (shot.order > source.order) {
                await db.shots.put({...shot, order: shot.order + 1});
            }
        }
        const copy = structuredClone({
            ...source,
            id: createId("sht"),
            order: source.order + 1,
        });
        await assertShotReferences(copy, db);
        await db.shots.add(copy);
        await touchProject(source.projectId, db);
        return copy;
    });
}

export async function restoreShots(shots: Shot[], media: MediaRecord[] = [], store?: ProductStore): Promise<void> {
    const db = store ?? productDb;
    if (shots.length === 0) return;
    await db.transaction("rw", PRODUCTION_TABLES, async (db) => {
        if (media.length > 0) await db.media.bulkPut(media);
        const episodeIds = new Set(shots.map((shot) => shot.episodeId));
        for (const episodeId of episodeIds) {
            const episode = await db.episodes.get(episodeId);
            if (!episode) throw new Error("集不存在");
            await assertVideoProject(episode.projectId, db);
            const scoped = shots
                .filter((shot) => shot.episodeId === episodeId)
                .sort((left, right) => left.order - right.order);
            if (scoped.some((shot) => shot.projectId !== episode.projectId)) {
                throw new Error("镜头与集不属于同一项目");
            }
            const all = (await db.shots.where("episodeId").equals(episodeId).toArray()).sort(
                (left, right) => left.order - right.order,
            );
            for (const shot of scoped) {
                await assertShotReferences(shot, db);
                const existing = await db.shots.get(shot.id);
                if (existing) throw new Error("镜头已存在，无法恢复");
                all.splice(Math.max(0, Math.min(shot.order - 1, all.length)), 0, shot);
            }
            await Promise.all(
                all.map((shot, index) => db.shots.put({...shot, order: index + 1})),
            );
            await touchProject(episode.projectId, db);
        }
    });
}

export async function setShotSlot(
    id: Id,
    field: ShotPictureField,
    slot: GenerationSlot,
    baseline?: GenerationSlot, store?: ProductStore
): Promise<void> {
    const db = store ?? productDb;
    await db.transaction("rw", PRODUCTION_TABLES, async (db) => {
        const shot = await db.shots.get(id);
        if (!shot) throw new Error("镜头不存在，无法保存");
        if (baseline && !sameSlotValue(shot[field], baseline) && !sameSlotValue(shot[field], slot)) throw new DraftConflictError();
        await assertSlotMedia(shot.projectId, slot, field === "clip", db);
        const previous = shot[field];
        await db.shots.put({...shot, [field]: slot});
        await touchProject(shot.projectId, db);
        await recycleSlotMedia(previous, slot, db);
    });
}

export async function deleteShots(ids: Id[], store?: ProductStore): Promise<void> {
    const db = store ?? productDb;
    await db.transaction("rw", PRODUCTION_TABLES, async (db) => {
        if (ids.length === 0) return;
        const affected = new Map<Id, Id>();
        const mediaIds: Id[] = [];
        for (const id of ids) {
            const shot = await db.shots.get(id);
            if (!shot) continue;
            affected.set(shot.episodeId, shot.projectId);
            mediaIds.push(
                ...slotMediaIds(shot.firstFrame),
                ...slotMediaIds(shot.lastFrame),
                ...slotMediaIds(shot.clip),
            );
            await db.shots.delete(id);
        }
        for (const [episodeId, projectId] of affected) {
            await reindexShots(episodeId, db);
            await touchProject(projectId, db);
        }
        await deleteMediaIfOrphans(mediaIds, db);
    });
}

export interface DeletedShotsSnapshot {
    projectId: Id;
    episodeId: Id;
    shots: Shot[];
    media: MediaRecord[];
}

export async function deleteEpisodeShots(episodeId: Id, ids: Id[], store?: ProductStore): Promise<DeletedShotsSnapshot | undefined> {
    const db = store ?? productDb;
    return db.transaction("rw", PRODUCTION_TABLES, async (db) => {
        if (ids.length === 0) return;
        const episode = await db.episodes.get(episodeId);
        if (!episode) throw new Error("集不存在");
        await assertVideoProject(episode.projectId, db);
        if (new Set(ids).size !== ids.length) throw new Error("镜头列表包含重复记录");
        const rows = await db.shots.bulkGet(ids);
        const shots: Shot[] = [];
        for (const shot of rows) {
            if (!shot || shot.episodeId !== episodeId || shot.projectId !== episode.projectId) {
                throw new Error("所选镜头不属于当前集");
            }
            shots.push(shot);
        }
        const mediaIds = [...new Set(shots.flatMap((shot) =>
            SHOT_PICTURE_FIELDS.flatMap((field) => slotMediaIds(shot[field])),
        ))];
        const media = (await db.media.bulkGet(mediaIds)).filter(
            (record): record is MediaRecord => record !== undefined,
        );
        // Snapshot and nested deletion share the production lock through cleanup and commit.
        await deleteShots(ids, db);
        return {projectId: episode.projectId, episodeId, shots, media};
    });
}
