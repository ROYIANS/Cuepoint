import type {ProductStore} from "../../../platform/storage/types";
import {db as productDb} from "../../../platform/product/store";
import {nowIso} from "../../../platform/identity";

/** Called inside the owning delete transaction; keeps generation history without stale FKs. */
export async function detachAudioGenerationResult(projectId: string, kind: "takeId" | "workId", id: string, store?: ProductStore): Promise<void> {
    const db = store ?? productDb;
    await db.audioGenerationJobs.where("projectId").equals(projectId)
        .filter((job) => job.results.some((result) => result[kind] === id))
        .modify((job) => {
            job.results = job.results.map((result) => {
                if (result[kind] !== id) return result;
                const next = {...result, deleted: true};
                delete next[kind];
                return next;
            });
            job.revision++;
            job.updatedAt = nowIso();
        });
}
