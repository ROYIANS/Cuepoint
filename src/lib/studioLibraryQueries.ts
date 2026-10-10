import {db} from "@/db/database";
import type {Id} from "@/domain/types";

/** Exact fallback-owner ranges share one readonly snapshot; cursor rows remain complete. */
export async function readProjectCoverIds(projectIds: readonly Id[]): Promise<Map<Id, Id>> {
    const candidates = new Map<Id, { order: number; mediaId: Id }>();
    const ids = [...new Set(projectIds)];
    if (ids.length) {
        await db.transaction("r", db.shots, () => Promise.all(ids.map(projectId => db.shots.where("projectId").equals(projectId).each(shot => {
            const mediaId = shot.firstFrame.result?.mediaId;
            if (!mediaId) return;
            const current = candidates.get(shot.projectId);
            // The projectId index visits primary keys in the original toArray order.
            // Strict comparison keeps the first input row when orders tie, across episodes.
            if (!current || shot.order < current.order) candidates.set(shot.projectId, {order: shot.order, mediaId});
        }))));
    }
    return new Map([...candidates].map(([projectId, candidate]) => [projectId, candidate.mediaId]));
}
