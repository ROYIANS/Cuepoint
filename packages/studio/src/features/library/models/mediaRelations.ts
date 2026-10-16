import type {MediaRecord} from "./media";

/** Resolve only actual root ownership. An orphan video's thumbnail is also orphaned. */
export function mediaDependencyIds(roots: Iterable<string>, records: readonly MediaRecord[]): Set<string> {
    const result = new Set(roots), byId = new Map(records.map(record => [record.id, record]));
    for (const id of result) {
        const source = byId.get(id);
        if (!source?.thumbnailMediaId) continue;
        const thumbnail = byId.get(source.thumbnailMediaId);
        if (!thumbnail || thumbnail.projectId !== source.projectId || !source.mimeType.startsWith("video/") ||
            thumbnail.mimeType !== "image/png" || thumbnail.derivative?.kind !== "video-thumbnail" || thumbnail.derivative.sourceMediaId !== source.id)
            throw new Error("视频缩略图缺失或关联无效，请恢复素材后重试");
        result.add(thumbnail.id);
    }
    return result;
}

export function remapMediaRelations(record: MediaRecord, ids: ReadonlyMap<string, string>, projectId: string): MediaRecord {
    const map = (id: string) => {
        const mapped = ids.get(id);
        if (!mapped) throw new Error("媒体副本缺少依赖映射");
        return mapped;
    };
    return {...record, id: map(record.id), projectId,
        ...(record.thumbnailMediaId ? {thumbnailMediaId: map(record.thumbnailMediaId)} : {}),
        ...(record.derivative ? {derivative: {...record.derivative, sourceMediaId: map(record.derivative.sourceMediaId)}, libraryRetained: false} : {})};
}
