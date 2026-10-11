import {useEffect, useState} from "react";
import {useLiveQuery} from "dexie-react-hooks";
import {isNativeWorkspaceRuntime} from "@/lib/nativeWorkspace";
import {db} from "@/db/database";
import {putMedia} from "@/db/media";
import {kindFromMime} from "@/domain/slot";
import type {Id, MediaKind, MediaRecord} from "@/domain/types";
import {BROWSER_WORKSPACE_ID, copyIntoManagedWorkspace, type ManagedCopy} from "@/lib/workspace";

export const IMAGE_ACCEPT = "image/png,image/jpeg,image/webp,image/gif";
export const VIDEO_ACCEPT = "video/mp4,video/webm,video/quicktime";
export const MEDIA_ACCEPT = `${IMAGE_ACCEPT},${VIDEO_ACCEPT}`;

export interface MediaView {
    url: string;
    mimeType: string;
    kind: MediaKind;
}

export function useMedia(mediaId: Id | undefined): MediaView | undefined {
    const [view, setView] = useState<{ id: Id; record: MediaRecord; media: MediaView }>();
    const record = useLiveQuery(async () => isNativeWorkspaceRuntime() ? null : mediaId ? (await db.media.get(mediaId)) ?? null : null, [mediaId]);

    useEffect(() => {
        if (!mediaId || !record || record.id !== mediaId) {
            setView(undefined);
            return;
        }
        const url = URL.createObjectURL(record.blob);
        setView({
            id: mediaId,
            record,
            media: {
                url,
                mimeType: record.mimeType,
                kind: kindFromMime(record.mimeType),
            },
        });
        return () => URL.revokeObjectURL(url);
    }, [mediaId, record]);

    return view && view.id === mediaId && view.record === record ? view.media : undefined;
}

export async function uploadMediaFile(projectId: Id, file: File, signal?: AbortSignal): Promise<{
    id: Id;
    kind: MediaKind;
}> {
    if (isNativeWorkspaceRuntime()) throw new Error("原生媒体槽尚未支持上传");
    if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
        throw new Error("请选择图片或视频文件");
    }
    const kind = kindFromMime(file.type);
    const staged = await copyIntoManagedWorkspace(file, {
        workspaceId: BROWSER_WORKSPACE_ID,
        projectId, filename: file.name, mimeType: file.type,
    }, signal);
    return staged.commit(async (copy: ManagedCopy) => {
        await putMedia({
            id: copy.mediaId, projectId,
            mimeType: copy.mimeType, filename: copy.sourceName, blob: copy.blob,
        });
        return {id: copy.mediaId, kind};
    });
}

export function pickMediaFile(accept: string): Promise<File | null> {
    return new Promise((resolve) => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = accept;
        input.onchange = () => {
            resolve(input.files?.[0] ?? null);
        };
        input.oncancel = () => resolve(null);
        input.click();
    });
}
