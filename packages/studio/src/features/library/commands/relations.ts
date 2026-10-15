import type {Id} from "./../../../platform/identity";
import type {ProductStore} from "../../../platform/storage/types";
import {db as productDb} from "../../../platform/product/store";

export async function assertAssetReferences(
    projectId: Id,
    fields: { characterIds?: Id[]; sceneId?: Id; propIds?: Id[]; styleId?: Id | null }, store?: ProductStore
): Promise<void> {
    const db = store ?? productDb;
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
