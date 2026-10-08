import {deleteEpisodeShots, patchEpisodeShots, undoEpisodeShotBulkPatch, reorderShots, restoreShots, type EpisodeShotBulkPatch} from "@/db/shots";
import {reorderGroupInFullOrder, sameIdOrder} from "@/lib/reorderIds";
import type {UndoAction} from "@/lib/undo";

export async function applyShotBulkCommand({episodeId, selectedIds, patch, label}: {
    episodeId: string; selectedIds: string[]; patch: EpisodeShotBulkPatch; label: string;
}): Promise<UndoAction | undefined> {
    const inverse = await patchEpisodeShots(episodeId, selectedIds, patch);
    return inverse ? {label, restore: () => undoEpisodeShotBulkPatch(inverse)} : undefined;
}

export async function deleteShotSelectionCommand({episodeId, selectedIds}: {
    episodeId: string; selectedIds: string[];
}): Promise<UndoAction | undefined> {
    const snapshot = await deleteEpisodeShots(episodeId, selectedIds);
    if (!snapshot?.shots.length) return undefined;
    return {label: `已删除 ${snapshot.shots.length} 个镜头`, restore: () => restoreShots(snapshot.shots, snapshot.media)};
}

export async function reorderShotGroupCommand({episodeId, fullOrder, groupIds, activeId, overId}: {
    episodeId: string; fullOrder: string[]; groupIds: string[]; activeId: string; overId: string;
}): Promise<UndoAction | undefined> {
    const previous = [...fullOrder];
    const next = reorderGroupInFullOrder(previous, groupIds, activeId, overId);
    if (!next || sameIdOrder(previous, next)) return undefined;
    await reorderShots(episodeId, next);
    return {label: "已调整镜头顺序", restore: () => reorderShots(episodeId, previous)};
}
