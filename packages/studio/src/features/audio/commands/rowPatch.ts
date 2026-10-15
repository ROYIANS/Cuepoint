import type {ProductStore, StoreTable} from "../../../platform/storage/types";
import {db as productDb} from "../../../platform/product/store";
import {AUDIO_TRANSACTION_TABLES} from "../../../platform/product/scopes";
import type {AudioInput, AudioPatch, AudioRow} from "../models/audio";
import {assertAudioRevision} from "../models/row";
import {ownedAudioRow, touchAudioProject} from "./ownership";
import {nowIso} from "../../../platform/identity";

/** Shared compare-and-swap boundary used by manual controls and Agent tools. */
export async function patchAudioRow<T extends AudioRow>(table: StoreTable<T>, projectId: string, id: string, revision: number, patch: AudioPatch<T>, keys: readonly (keyof AudioInput<T>)[], validate: (row: T, store: ProductStore) => Promise<void>, store?: ProductStore): Promise<T> {
    const db = store ?? productDb;
    return db.transaction("rw", AUDIO_TRANSACTION_TABLES, async (db) => {
        const boundTable = db.table(table.name) as unknown as StoreTable<T>;
        const current = await ownedAudioRow(boundTable, projectId, id);
        assertAudioRevision(current, revision);
        if (Object.keys(patch).some((key) => !keys.includes(key as keyof AudioInput<T>))) throw new Error("包含不支持的编辑字段");
        const accepted = Object.fromEntries(keys.filter((key) => Object.hasOwn(patch, key)).map((key) => [key, patch[key]]));
        const next = {...current, ...accepted, revision: current.revision + 1, updatedAt: nowIso()};
        await validate(next, db);
        await boundTable.put(next);
        await touchAudioProject(projectId, db);
        return next;
    });
}
