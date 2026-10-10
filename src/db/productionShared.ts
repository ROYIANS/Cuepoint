import {AUDIO_TABLES} from "./audioShared";
import {db} from "./database";
import {nowIso} from "@/lib/ids";
import {getProjectKind, type Id, isStudioLibrary, normalizeEpisodeStory, type Project, type Shot} from "@/domain/types";

// Media recycling must hold the same lock as every committed slot/cover writer.
export const PRODUCTION_TABLES = [
    ...AUDIO_TABLES,
    db.projects, db.episodes, db.characters, db.scenes,
    db.props, db.styles, db.shots, db.media, db.materialUses, db.productionProposals, db.agentGenerationJobs, db.agentGenerationBatches, db.agentGenerationBatchItems, db.projectReferences, db.referenceChunks,
];

export function pickPatch<T extends object>(patch: T, keys: readonly (keyof T)[]): Partial<T> {
    return Object.fromEntries(keys.filter((key) => Object.hasOwn(patch, key)).map((key) => [key, patch[key]])) as Partial<T>;
}

export function assertTextPatch(patch: object, mediaFields: readonly string[]): void {
    if (mediaFields.some(field => Object.hasOwn(patch, field))) {
        throw new Error("媒体字段请通过专用槽位接口保存");
    }
}

export function touch<T extends { updatedAt: string }>(record: T): T {
    return {...record, updatedAt: nowIso()};
}

export async function touchProject(projectId: Id): Promise<void> {
    if (isStudioLibrary(projectId)) return;
    await db.projects.update(projectId, {updatedAt: nowIso()});
}

export async function assertProjectOwner(projectId: Id): Promise<void> {
    if (isStudioLibrary(projectId)) return;
    if (!await db.projects.get(projectId)) throw new Error("项目不存在，无法保存");
}

export function assertCompleteOrder(actualIds: Id[], orderedIds: Id[]): void {
    if (
        orderedIds.length !== actualIds.length ||
        new Set(orderedIds).size !== orderedIds.length ||
        actualIds.some((id) => !orderedIds.includes(id))
    ) {
        throw new Error("排序列表必须包含同一范围内的全部且唯一记录");
    }
}

export async function assertAssetReferences(
    projectId: Id,
    fields: { characterIds?: Id[]; sceneId?: Id; propIds?: Id[]; styleId?: Id | null },
): Promise<void> {
    for (const [ids, table, label] of [
        [fields.characterIds, db.characters, "角色"],
        [fields.propIds, db.props, "道具"],
    ] as const) {
        if (ids !== undefined) {
            if (!Array.isArray(ids) || ids.some((id) => typeof id !== "string")) throw new Error(`${label}引用无效`);
            const rows = await table.bulkGet(ids);
            if (rows.some((row) => !row || row.projectId !== projectId)) throw new Error(`${label}不属于当前项目`);
        }
    }
    if (fields.sceneId !== undefined && (await db.scenes.get(fields.sceneId))?.projectId !== projectId) throw new Error("场景不属于当前项目");
    if (fields.styleId !== undefined && fields.styleId !== null && (await db.styles.get(fields.styleId))?.projectId !== projectId) throw new Error("风格不属于当前项目");
}

export async function assertShotReferences(shot: Shot): Promise<void> {
    await assertVideoProject(shot.projectId);
    const episode = await db.episodes.get(shot.episodeId);
    if (!episode || episode.projectId !== shot.projectId) throw new Error("镜头与集不属于同一项目");
    if (shot.beatId !== undefined && !normalizeEpisodeStory(episode.story).beats.some((beat) => beat.id === shot.beatId)) throw new Error("场次不属于当前集");
    await assertAssetReferences(shot.projectId, shot);
}

export async function assertVideoProject(projectId: Id): Promise<Project> {
    const project = await db.projects.get(projectId);
    if (!project) throw new Error("项目不存在");
    if (getProjectKind(project) !== "video") throw new Error("此操作仅适用于视频项目");
    return project;
}
