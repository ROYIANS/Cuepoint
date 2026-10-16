import {vi} from "vitest";
import {createDesktopMediaServices, type DesktopMediaAction, type DesktopMediaEntry} from "@/platform/runtime/desktopMedia";
import type {NativeSession} from "@/platform/storage/protocol";
export function deferred<T = void>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>(done => {resolve = done;});
    return {promise, resolve};
}
export function desktopMediaHost(count = 2) {
    const session: NativeSession = {version: 1, session: crypto.randomUUID(), workspaceId: crypto.randomUUID(), generation: 1};
    const grantId = crypto.randomUUID(), scanId = crypto.randomUUID();
    const limits = {maxDepth: 8, maxEntries: 4096, maxVideos: 256, maxFileBytes: 536870912, maxTotalBytes: 2147483648, maxPage: 100, maxActiveOperations: 2};
    const entries: DesktopMediaEntry[] = Array.from({length: count}, (_, index) => ({entryId: crypto.randomUUID(), displayName: `clip-${index}.mp4`, relativeName: `folder/clip-${index}.mp4`, mimeType: "video/mp4", byteLength: 4, revision: String(index % 10).repeat(64)}));
    const states = new Map<string, Record<string, unknown>>(), canceled = new Set<string>();
    let beforeReserve: (() => Promise<void>) | undefined;
    let beforePrepare: ((index: number) => Promise<void>) | undefined, prepares = 0;
    const call = vi.fn(async (_command: string, args: Record<string, unknown>): Promise<unknown> => {
        const request = args.request as NativeSession & {projectId: string; action: DesktopMediaAction};
        const action = request.action;
        switch (action.type) {
            case "pickDirectory": {const value = {status: "granted", operationId: action.operationId, grantId, label: "Videos", limits}; states.set(action.operationId, value); return value;}
            case "scan": {const value = {status: "scanned", operationId: action.operationId, grantId, scanId, count: entries.length, skipped: 3, totalBytes: count * 4, limits}; states.set(action.operationId, value); return value;}
            case "readScanPage": return {status: "scanPage", grantId, scanId, offset: action.offset, entries: entries.slice(action.offset, action.offset + action.limit), total: entries.length, nextOffset: action.offset + action.limit < entries.length ? action.offset + action.limit : null};
            case "prepareVideo": {
                const index = prepares++;
                await beforeReserve?.();
                states.set(action.operationId, {status: "running", operationId: action.operationId, phase: "decoding"});
                await beforePrepare?.(index);
                if (canceled.has(action.operationId)) {const value = {status: "stopped", operationId: action.operationId, error: {code: "canceled", message: "本地处理已停止"}}; states.set(action.operationId, value); return value;}
                const claim = (mimeType: string, contentHash: string) => ({stageId: crypto.randomUUID(), reference: {version: 1, workspaceId: session.workspaceId, binaryId: crypto.randomUUID(), mimeType, byteLength: 4, contentHash}});
                const value = {status: "prepared", operationId: action.operationId, grantId, scanId, entry: entries.find(entry => entry.entryId === action.entryId), sourceClaim: claim("video/mp4", "a".repeat(64)), thumbnailClaim: claim("image/png", "b".repeat(64)), thumbnail: {width: 640, height: 360, preset: "thumbnail-v1", atSeconds: 0, decoder: "FFmpeg 8.0.3"}};
                states.set(action.operationId, value); return value;
            }
            case "readOperation": {const state = states.get(action.operationId); if (!state) throw new Error("Owner unavailable"); return state;}
            case "cancelOperation": {
                const old = states.get(action.operationId);
                if (!old) throw new Error("Owner not reserved");
                canceled.add(action.operationId);
                if (old?.status !== "running" && old?.status !== "stopping") return old;
                return {status: "stopping", operationId: action.operationId};
            }
            case "discardPrepared": {const value = {status: "discarded", operationId: action.operationId}; states.set(action.operationId, value); return value;}
            case "releaseOperation": states.delete(action.operationId); return {status: "released", operationId: action.operationId};
            case "revokeDirectory": return {status: "revoked", grantId};
        }
    });
    const services = createDesktopMediaServices(async () => session, call);
    return {session, services, call, entries, grantId, scanId, states, setBeforeReserve(work: () => Promise<void>) {beforeReserve = work;}, setBeforePrepare(work: (index: number) => Promise<void>) {beforePrepare = work;}, actions: () => call.mock.calls.map(([, args]) => (args.request as {action: DesktopMediaAction}).action)};
}
