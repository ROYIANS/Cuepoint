import type {Id} from "./../../../platform/identity";
import type {ProductStore} from "../../../platform/storage/types";
import {db as productDb} from "../../../platform/product/store";
import {isStudioLibrary} from "./../../library/models/ownership";
import {nowIso} from "../../../platform/identity";

export async function touchProject(projectId: Id, store?: ProductStore): Promise<void> {
    const db = store ?? productDb;
    if (isStudioLibrary(projectId)) return;
    await db.projects.update(projectId, {updatedAt: nowIso()});
}

export async function assertProjectOwner(projectId: Id, store?: ProductStore): Promise<void> {
    const db = store ?? productDb;
    if (isStudioLibrary(projectId)) return;
    if (!await db.projects.get(projectId)) throw new Error("项目不存在，无法保存");
}
