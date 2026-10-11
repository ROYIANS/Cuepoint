import type {VideoWorkspaceRepository} from "@/lib/videoWorkspaceRepository";
import type {EpisodeShotBulkPatch} from "@/db/shots";
import {getVideoWorkspaceRepository} from "@/lib/videoWorkspaceRepository";
import {reorderGroupInFullOrder, sameIdOrder} from "@/lib/reorderIds";
import type {UndoAction} from "@/lib/undo";

export async function applyShotBulkCommand({repository = getVideoWorkspaceRepository(), episodeId, selectedIds, patch, label}: {
    repository?: VideoWorkspaceRepository; episodeId: string; selectedIds: string[]; patch: EpisodeShotBulkPatch; label: string;
}): Promise<UndoAction | undefined> {
    const inverse = await repository.patchEpisodeShots(episodeId, selectedIds, patch);
    return inverse ? {label, restore: () => repository.undoEpisodeShotBulkPatch(inverse)} : undefined;
}

export async function deleteShotSelectionCommand({repository = getVideoWorkspaceRepository(), episodeId, selectedIds}: {
    repository?: VideoWorkspaceRepository; episodeId: string; selectedIds: string[];
}): Promise<UndoAction | undefined> {
    const snapshot = await repository.deleteEpisodeShots(episodeId, selectedIds);
    if (!snapshot?.shots.length) return undefined;
    return {
        label: `已删除 ${snapshot.shots.length} 个镜头`,
        restore: () => repository.restoreShots(snapshot.shots, snapshot.media)
    };
}

export async function reorderShotGroupCommand({repository = getVideoWorkspaceRepository(), episodeId, fullOrder, groupIds, activeId, overId}: {
    repository?: VideoWorkspaceRepository; episodeId: string; fullOrder: string[]; groupIds: string[]; activeId: string; overId: string;
}): Promise<UndoAction | undefined> {
    const previous = [...fullOrder];
    const next = reorderGroupInFullOrder(previous, groupIds, activeId, overId);
    if (!next || sameIdOrder(previous, next)) return undefined;
    const committed = await repository.reorderShots(episodeId, next);
    return {label: "已调整镜头顺序", restore: committed?.restore ?? (async () => {await repository.reorderShots(episodeId, previous);})};
}
