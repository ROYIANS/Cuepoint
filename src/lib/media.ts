import {useEffect, useRef, useState} from "react";
import {useProductQuery} from "@/lib/storage/hooks";
import {putMedia} from "@/db/media";
import {kindFromMime} from "@/domain/slot";
import type {Id, MediaKind} from "@/domain/types";
import {BROWSER_WORKSPACE_ID, copyIntoManagedWorkspace, type ManagedCopy} from "@/lib/workspace";
import {binaryAvailability, createBinaryObjectUrl} from "@/lib/storage/binary";
import type {BinaryContent} from "@/domain/binary";
import {BinaryUnavailableError} from "@/lib/storage/nativeBinary";

export const IMAGE_ACCEPT = "image/png,image/jpeg,image/webp,image/gif";
export const VIDEO_ACCEPT = "video/mp4,video/webm,video/quicktime";
export const MEDIA_ACCEPT = `${IMAGE_ACCEPT},${VIDEO_ACCEPT}`;

export interface MediaView {
    url: string;
    mimeType: string;
    kind: MediaKind;
    onError: () => void;
}
export type MediaState = {status: "ready";media: MediaView}
    | {status: "empty" | "loading" | "missing" | "corrupt" | "error"};

export function useMedia(mediaId: Id | undefined): MediaView | undefined {
    const state = useMediaState(mediaId);
    return state.status === "ready" ? state.media : undefined;
}

export type BinaryPreviewState = {status: "ready"; url: string; onError: () => void}
    | {status: "empty" | "loading" | "missing" | "corrupt" | "error"};

/** One lifecycle for project files and immutable material snapshots. */
export function useBinaryPreview(binary: BinaryContent | undefined, enabled = true): BinaryPreviewState {
    const [view, setView] = useState<{binary: BinaryContent; state: BinaryPreviewState}>();
    const [revision, setRevision] = useState(0);
    const wanted = useRef({binary, enabled});
    wanted.current = {binary, enabled};
    const current = useRef<object | undefined>(undefined);
    useEffect(() => {
        if (!binary || !enabled) {setView(undefined);return;}
        const owner = {};
        current.current = owner;
        const controller = new AbortController();
        let release: (() => void) | undefined;
        let failed = false;
        const isCurrent = () => current.current === owner && wanted.current.binary === binary && wanted.current.enabled && !controller.signal.aborted;
        const releaseOwned = () => {const owned = release;release = undefined;owned?.();};
        const onError = () => {
            if (!isCurrent() || failed) return;
            failed = true;
            releaseOwned();
            setView({binary, state: {status: "loading"}});
            void binaryAvailability(binary, controller.signal).then(availability => {
                if (isCurrent()) setView({binary, state: {status: availability === "ready" ? "error" : availability}});
            }).catch(() => {
                if (isCurrent()) setView({binary, state: {status: "error"}});
            });
        };
        if (binary instanceof Blob) {
            const url = URL.createObjectURL(binary);
            release = () => URL.revokeObjectURL(url);
            setView({binary, state: {status: "ready", url, onError}});
        } else {
            setView(undefined);
            void createBinaryObjectUrl(binary, controller.signal).then(preview => {
                if (!isCurrent()) {preview.release();return;}
                release = () => preview.release();
                setView({binary, state: {status: "ready", url: preview.url, onError}});
            }).catch((error: unknown) => {
                if (isCurrent()) setView({binary, state: {status: error instanceof BinaryUnavailableError ? error.availability : "error"}});
            });
        }
        return () => {
            if (current.current === owner) current.current = undefined;
            controller.abort();
            releaseOwned();
        };
    }, [binary, enabled, revision]);
    useEffect(() => {
        const refresh = () => setRevision(value => value + 1);
        window.addEventListener("focus", refresh);
        if (typeof document !== "undefined") document.addEventListener("visibilitychange", refresh);
        return () => {
            window.removeEventListener("focus", refresh);
            if (typeof document !== "undefined") document.removeEventListener("visibilitychange", refresh);
        };
    }, []);
    if (!binary || !enabled) return {status: "empty"};
    return view?.binary === binary ? view.state : {status: "loading"};
}

export function binaryPreviewMessage(state: BinaryPreviewState): string {
    switch (state.status) {
        case "missing": return "素材已丢失，请重新导入";
        case "corrupt": return "素材内容已损坏，无法预览";
        case "error": return "读取素材失败，请重新打开后重试";
        case "empty": return "没有素材";
        case "loading": return "正在读取素材…";
        case "ready": return "素材已就绪";
    }
}

export function useMediaState(mediaId: Id | undefined): MediaState {
    const record = useProductQuery(async (db) => mediaId ? (await db.media.get(mediaId)) ?? null : null, [mediaId]);
    const view = useBinaryPreview(record && record.id === mediaId ? record.blob : undefined);
    if (!mediaId) return {status: "empty"};
    if (record === null) return {status: "missing"};
    if (!record || record.id !== mediaId) return {status: "loading"};
    return view.status === "ready" ? {status: "ready", media: {url: view.url, mimeType: record.mimeType, kind: kindFromMime(record.mimeType), onError: view.onError}} : view;
}

export async function uploadMediaFile(projectId: Id, file: File, signal?: AbortSignal): Promise<{
    id: Id;
    kind: MediaKind;
}> {
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
