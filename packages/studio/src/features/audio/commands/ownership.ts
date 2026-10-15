import {binaryByteLength} from "../../../platform/media/binaryTypes";
import type {ProductStore, StoreTable} from "../../../platform/storage/types";
import {db as productDb} from "../../../platform/product/store";
import {getProjectKind, type ProjectKind} from "./../../projects/models/project";
import {nowIso} from "../../../platform/identity";

export async function assertAudioProject(projectId: string, kind?: ProjectKind, store?: ProductStore) {
    const db = store ?? productDb;
    const project = await db.projects.get(projectId);
    if (!project) throw new Error("项目不存在或已删除");
    const actual = getProjectKind(project);
    if (kind ? actual !== kind : actual === "video") throw new Error("项目类型不匹配");
    return project;
}

export async function ownedAudioRow<T extends {
    projectId: string
}>(table: StoreTable<T>, projectId: string, id: string): Promise<T> {
    const row = await table.get(id);
    if (!row || row.projectId !== projectId) throw new Error("记录不存在或不属于当前项目");
    return row;
}

export async function touchAudioProject(projectId: string, store?: ProductStore) {
    const db = store ?? productDb;
    await db.projects.update(projectId, {updatedAt: nowIso()});
}

export async function assertOwnedAudioMedia(projectId: string, mediaId: string, store?: ProductStore) {
    const db = store ?? productDb;
    const media = await ownedAudioRow(db.media, projectId, mediaId);
    if (!binaryByteLength(media.blob) || !media.mimeType.startsWith("audio/")) throw new Error("需要有效的音频文件");
}
