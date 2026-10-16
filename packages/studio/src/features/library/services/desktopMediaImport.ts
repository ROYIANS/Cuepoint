import {productEffectAdmission} from "../../../platform/runtime/effectAdmission";
import {targetRevision} from "../../../platform/data/revision";
import {Sha256} from "../../../platform/media/sha256";
import {db as productDb} from "../../../platform/product/store";
import {desktopMediaServices, DesktopMediaUncertainError, type DesktopMediaServices, type DesktopMediaOperation, type DesktopMediaEntry, type DesktopMediaGrant, type DesktopMediaScan, type DesktopMediaPrepared} from "../../../platform/runtime/desktopMedia";
import {StorageError} from "../../../platform/storage/errors";
import type {ProductStore} from "../../../platform/storage/types";
import {admitDesktopMediaImport, publishDesktopMediaImportItem, readDesktopMediaImport, transitionDesktopMediaImport} from "../commands/desktopMediaImport";
import type {DesktopMediaImport, DesktopMediaImportActor, DesktopMediaImportSelection} from "../models/desktopMediaImport";

export interface DesktopMediaCandidates {projectId: string; grant: DesktopMediaGrant; scan: DesktopMediaScan; entries: DesktopMediaEntry[]; revision: string}
const activeImports = new Map<string, {projectId: string; controller: AbortController; done: Promise<DesktopMediaImport>}>();
const directorySelections = new Set<{controller: AbortController; done: Promise<DesktopMediaCandidates | undefined>}>();
let importShutdown: Promise<void> | undefined;
const candidatesByScan = new Map<string, DesktopMediaCandidates>();
interface DesktopMediaProgress {record: DesktopMediaImport; currentFilename?: string}
const terminal = (status: string) => !["accepted", "running", "stopping"].includes(status);
const uncertain = (cause: unknown) => cause instanceof DesktopMediaUncertainError || cause instanceof StorageError && cause.certainty === "unknown";
function native(services?: DesktopMediaServices): DesktopMediaServices {
    const value = services ?? desktopMediaServices();
    if (!value) throw new Error("导入文件夹需要 macOS 或 Windows 桌面版，并使用桌面工作区。");
    return value;
}
function operation(value: Awaited<ReturnType<DesktopMediaServices["request"]>>): DesktopMediaOperation {
    if (!("operationId" in value)) throw new DesktopMediaUncertainError("本地素材操作返回了不匹配的结果。");
    return value;
}
function requireResult<T extends DesktopMediaOperation["status"]>(value: DesktopMediaOperation, status: T): Extract<DesktopMediaOperation, {status: T}> {
    if (value.status === "unknown") throw new DesktopMediaUncertainError(value.error.message);
    if (value.status === "failed" || value.status === "stopped") throw new Error(value.error.message);
    if (value.status !== status) throw new DesktopMediaUncertainError("本地素材操作尚未确认结束，请核对原有记录。");
    return value as Extract<DesktopMediaOperation, {status: T}>;
}
/** Same intent/item always names the same native operation. Reading it never starts work. */
export function desktopMediaOperationId(importId: string, entryId: string): string {
    const hash = new Sha256(); hash.update(new TextEncoder().encode(`desktop-media-v1:${importId}:${entryId}`));
    const hex = hash.digest();
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}
async function drain(services: DesktopMediaServices, projectId: string, operationId: string): Promise<DesktopMediaOperation> {
    // The native owner has a ten-minute total deadline. A renderer timeout is
    // uncertainty, never proof of process termination or permission to replay.
    const deadline = Date.now() + 11 * 60_000;
    while (Date.now() < deadline) {
        const state = operation(await services.request(projectId, {type: "readOperation", operationId}));
        if (state.status !== "running" && state.status !== "stopping") return state;
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new DesktopMediaUncertainError("无法确认本地处理是否停止，请核对原有记录。");
}
async function runNative(services: DesktopMediaServices, projectId: string, action: Extract<Parameters<DesktopMediaServices["request"]>[1], {operationId: string}>, signal: AbortSignal): Promise<DesktopMediaOperation> {
    let pending = true, cancelRequest: Promise<void> | undefined, complete!: () => void;
    const completed = new Promise<void>(resolve => {complete = resolve;});
    const stop = () => {
        cancelRequest ??= (async () => {
            // Tauri may schedule cancel before the original blocking owner has
            // reserved its ID. A not-found response is not cancellation proof.
            while (pending) {
                try {
                    const current = operation(await services.request(projectId, {type: "readOperation", operationId: action.operationId}));
                    if (current.status !== "running" && current.status !== "stopping") return;
                    await services.request(projectId, {type: "cancelOperation", operationId: action.operationId});
                } catch { /* Wait for this same operation; never dispatch another producer. */ }
                await Promise.race([completed, new Promise(resolve => setTimeout(resolve, 100))]);
            }
        })();
    };
    signal.addEventListener("abort", stop, {once: true});
    try {
        signal.throwIfAborted();
        let result: DesktopMediaOperation;
        try {result = operation(await services.request(projectId, action));}
        catch (cause) {
            if (!uncertain(cause)) throw cause;
            result = await drain(services, projectId, action.operationId);
        }
        pending = false; complete(); await cancelRequest;
        if (result.status === "running" || result.status === "stopping") return drain(services, projectId, action.operationId);
        return result;
    } finally {pending = false; complete(); signal.removeEventListener("abort", stop); await cancelRequest;}
}

async function readDesktopMediaCandidates(projectId: string, grant: DesktopMediaGrant, scan: DesktopMediaScan, services?: DesktopMediaServices): Promise<DesktopMediaCandidates> {
    const host = native(services), entries: DesktopMediaEntry[] = [];
    let offset = 0;
    do {
        const page = await host.request(projectId, {type: "readScanPage", grantId: grant.grantId, scanId: scan.scanId, offset, limit: 100});
        if (page.status !== "scanPage" || page.total !== scan.count || page.entries.some(item => entries.some(existing => existing.entryId === item.entryId))) throw new DesktopMediaUncertainError("目录内容已变化，请重新选择目录。");
        entries.push(...page.entries);
        if (page.nextOffset === null) break;
        offset = page.nextOffset;
    } while (entries.length < 256);
    if (entries.length !== scan.count) throw new DesktopMediaUncertainError("目录列表不完整，请重新选择目录。");
    const candidates = {projectId, grant, scan, entries, revision: targetRevision({projectId, grantId: grant.grantId, scanId: scan.scanId, entries})};
    if (!candidatesByScan.has(scan.scanId) && candidatesByScan.size >= 8) {
        const oldest = candidatesByScan.keys().next().value;
        if (oldest) candidatesByScan.delete(oldest);
    }
    candidatesByScan.set(scan.scanId, candidates);
    return candidates;
}
export function pickDesktopMediaDirectory(projectId: string, signal: AbortSignal, services?: DesktopMediaServices, store?: ProductStore): Promise<DesktopMediaCandidates | undefined> {
    if (!productEffectAdmission.open || importShutdown) return Promise.reject(new Error("应用正在退出，无法选择素材目录"));
    const controller = new AbortController();
    let resolve!: (value: DesktopMediaCandidates | undefined) => void, reject!: (cause: unknown) => void;
    const done = new Promise<DesktopMediaCandidates | undefined>((yes, no) => {resolve = yes; reject = no;});
    const owner = {controller, done};
    directorySelections.add(owner);
    void selectDirectory(projectId, AbortSignal.any([signal, controller.signal]), services, store).then(
        value => {directorySelections.delete(owner); resolve(value);},
        cause => {directorySelections.delete(owner); reject(cause);},
    );
    return done;
}
async function selectDirectory(projectId: string, signal: AbortSignal, services?: DesktopMediaServices, store?: ProductStore): Promise<DesktopMediaCandidates | undefined> {
    const host = native(services), pickId = crypto.randomUUID();
    const retainedImports = await (store ?? productDb).desktopMediaImports.where("projectId").equals(projectId).toArray();
    if (retainedImports.some(row => ["accepted", "running", "stopping", "unknown"].includes(row.status))) throw new Error("请先核对当前项目已有的导入，再选择新的目录。");
    for (const old of candidatesByScan.values()) if (old.projectId === projectId) await revokeDesktopMediaCandidates(old, host);
    const picked = await runNative(host, projectId, {type: "pickDirectory", operationId: pickId}, signal);
    if (picked.status === "canceled") {await host.request(projectId, {type: "releaseOperation", operationId: pickId}); return undefined;}
    if (picked.status !== "granted") {
        if (picked.status !== "unknown") await host.request(projectId, {type: "releaseOperation", operationId: pickId}).catch(() => undefined);
        requireResult(picked, "granted");
        return undefined;
    }
    const grant = picked;
    await host.request(projectId, {type: "releaseOperation", operationId: pickId});
    const scanId = crypto.randomUUID();
    try {
        const scan = requireResult(await runNative(host, projectId, {type: "scan", operationId: scanId, grantId: grant.grantId}, signal), "scanned");
        await host.request(projectId, {type: "releaseOperation", operationId: scanId});
        signal.throwIfAborted();
        const candidates = await readDesktopMediaCandidates(projectId, grant, scan, host);
        if (signal.aborted) {
            await revokeDesktopMediaCandidates(candidates, host);
            signal.throwIfAborted();
        }
        return candidates;
    } catch (cause) {
        if (!uncertain(cause)) {
            await host.request(projectId, {type: "releaseOperation", operationId: scanId}).catch(() => undefined);
            await host.request(projectId, {type: "revokeDirectory", grantId: grant.grantId}).catch(() => undefined);
        }
        throw cause;
    }
}
export function desktopMediaSelection(candidates: DesktopMediaCandidates, entryIds: readonly string[], importId: string): DesktopMediaImportSelection {
    if (!entryIds.length || entryIds.length > 64 || new Set(entryIds).size !== entryIds.length) throw new Error("请选择 1 至 64 个视频。");
    const items = entryIds.map(id => {
        const entry = candidates.entries.find(item => item.entryId === id);
        if (!entry) throw new Error("所选视频不属于原目录列表。");
        return {entryId: id, revision: entry.revision, filename: entry.displayName, mimeType: entry.mimeType, byteLength: entry.byteLength,
            sourceMediaId: `media_${desktopMediaOperationId(importId, `${id}:source`)}`, thumbnailMediaId: `media_${desktopMediaOperationId(importId, `${id}:thumbnail`)}`};
    });
    return {grantId: candidates.grant.grantId, scanId: candidates.scan.scanId, revision: candidates.revision, items};
}

type ImportInput = {id: string; projectId: string; actor: DesktopMediaImportActor; selection: DesktopMediaImportSelection; signal: AbortSignal; onProgress?: (value: DesktopMediaProgress) => void};
type ImportOptions = {store?: ProductStore; services?: DesktopMediaServices};
export function importDesktopMedia(input: ImportInput, options: ImportOptions = {}): Promise<DesktopMediaImport> {
    if (!productEffectAdmission.open || importShutdown) return Promise.reject(new Error("应用正在退出，无法导入素材"));
    if (activeImports.has(input.id)) return Promise.reject(new Error("此素材导入仍在进行，请等待原操作结束"));
    const controller = new AbortController();
    let resolve!: (value: DesktopMediaImport) => void, reject!: (cause: unknown) => void;
    const done = new Promise<DesktopMediaImport>((yes, no) => {resolve = yes; reject = no;});
    const owner = {projectId: input.projectId, controller, done};
    activeImports.set(input.id, owner);
    void performImport(input, options, controller).then(
        value => {if (activeImports.get(input.id) === owner) activeImports.delete(input.id); resolve(value);},
        cause => {if (activeImports.get(input.id) === owner) activeImports.delete(input.id); reject(cause);},
    );
    return done;
}
async function performImport(input: ImportInput, options: ImportOptions, controller: AbortController): Promise<DesktopMediaImport> {
    const store = options.store ?? productDb, host = native(options.services);
    const signal = AbortSignal.any([input.signal, controller.signal]);
    signal.throwIfAborted();
    const admission = await admitDesktopMediaImport({id: input.id, projectId: input.projectId, actor: input.actor, selection: input.selection}, store);
    let row = admission.import;
    input.onProgress?.({record: row});
    // A readback proves retention, never admission permission to dispatch again.
    if (!admission.admitted) return row;
    let queue: Promise<void> = Promise.resolve(), stopping = false, activeOperation: string | undefined, currentFilename: string | undefined;
    let stopRequest: Promise<unknown> | undefined;
    let activePrepared: DesktopMediaPrepared | undefined;
    const update = (work: () => Promise<DesktopMediaImport>) => {
        queue = queue.then(async () => {row = await work(); input.onProgress?.({record: row, currentFilename});});
        return queue;
    };
    const stop = () => {
        if (stopping || terminal(row.status)) return;
        stopping = true;
        if (activeOperation) stopRequest = host.request(input.projectId, {type: "cancelOperation", operationId: activeOperation}).catch(() => undefined);
        void update(async () => terminal(row.status) ? row : transitionDesktopMediaImport(row.id, row.projectId, row.revision, "stopping", undefined, store)).catch(() => undefined);
    };
    signal.addEventListener("abort", stop, {once: true});
    try {
        await update(() => transitionDesktopMediaImport(row.id, row.projectId, row.revision, "running", undefined, store));
        if (signal.aborted) stop();
        for (const item of row.selection.items) {
            await queue;
            if (stopping || signal.aborted) break;
            currentFilename = item.filename; input.onProgress?.({record: row, currentFilename});
            activeOperation = desktopMediaOperationId(row.id, item.entryId);
            let prepared: DesktopMediaPrepared | undefined;
            try {
                prepared = requireResult(await runNative(host, row.projectId, {type: "prepareVideo", operationId: activeOperation, grantId: row.selection.grantId, scanId: row.selection.scanId, entryId: item.entryId, expectedRevision: item.revision}, signal), "prepared");
                await queue;
                if (stopping || signal.aborted) {
                    await host.request(row.projectId, {type: "discardPrepared", operationId: activeOperation});
                    await host.request(row.projectId, {type: "releaseOperation", operationId: activeOperation});
                    activeOperation = undefined; break;
                }
                const verified = prepared; activePrepared = verified;
                await update(async () => (await publishDesktopMediaImportItem({importId: row.id, projectId: row.projectId, itemId: item.entryId, expectedRevision: row.revision, source: verified.source, thumbnail: verified.thumbnailBinary,
                    provenance: {version: 1, importId: row.id, itemId: item.entryId, grantId: row.selection.grantId, scanId: row.selection.scanId, entryRevision: item.revision, sourceHash: verified.source.contentHash,
                        thumbnail: {preset: verified.thumbnail.preset, contentHash: verified.thumbnailBinary.contentHash, width: verified.thumbnail.width, height: verified.thumbnail.height, atSeconds: verified.thumbnail.atSeconds}, decoder: {name: "ffmpeg", version: verified.thumbnail.decoder}}}, store)).import);
                await host.request(row.projectId, {type: "releaseOperation", operationId: activeOperation});
                activeOperation = undefined; activePrepared = undefined;
            } catch (cause) {
                if (!uncertain(cause) && activeOperation) {
                    // This call follows a settled native request; cancellation is
                    // drained before staged bytes are ever eligible for cleanup.
                    if (prepared) await host.request(row.projectId, {type: "discardPrepared", operationId: activeOperation});
                    await host.request(row.projectId, {type: "releaseOperation", operationId: activeOperation});
                    activeOperation = undefined;
                }
                throw cause;
            }
        }
        await queue; await stopRequest;
        if (!terminal(row.status)) await update(() => transitionDesktopMediaImport(row.id, row.projectId, row.revision, "stopped", undefined, store));
        return row;
    } catch (cause) {
        await queue.catch(() => undefined); await stopRequest;
        // Acknowledged receipts outrank a late Stop or lost return value. Fresh
        // status reads reconcile only; they never re-enter the native producer.
        const retained = await readDesktopMediaImport(row.id, row.projectId, store).catch(() => undefined);
        if (retained) row = retained;
        if (activeOperation && activePrepared) {
            const prepared = activePrepared, item = row.selection.items.find(value => desktopMediaOperationId(row.id, value.entryId) === activeOperation);
            const receipt = item && row.receipts.find(value => value.itemId === item.entryId && value.sourceMediaId === item.sourceMediaId && value.thumbnailMediaId === item.thumbnailMediaId &&
                value.provenance.entryRevision === item.revision && value.provenance.sourceHash === prepared.source.contentHash && value.provenance.thumbnail.contentHash === prepared.thumbnailBinary.contentHash);
            if (receipt) {
                // Exact atomic receipt establishes publication after a lost ACK.
                // Release only its already adopted native operation; never replay.
                try {await host.request(row.projectId, {type: "releaseOperation", operationId: activeOperation}); activeOperation = undefined;}
                catch { /* Retain uncertain cleanup ownership for inspection. */ }
            }
        }
        if (!terminal(row.status)) {
            const status = uncertain(cause) ? "unknown" : stopping || signal.aborted ? "stopped" : "failed";
            row = await transitionDesktopMediaImport(row.id, row.projectId, row.revision, status, cause instanceof Error ? cause.message : "素材导入未能完成", store);
        }
        input.onProgress?.({record: row, currentFilename});
        return row;
    } finally {
        signal.removeEventListener("abort", stop);
        await queue.catch(() => undefined); await stopRequest;
        if (terminal(row.status) && row.status !== "unknown" && !activeOperation) {
            await host.request(row.projectId, {type: "revokeDirectory", grantId: row.selection.grantId}).catch(() => undefined);
            candidatesByScan.delete(row.selection.scanId);
        }
    }
}

/** Inspection reconciles retained status only, with no copying, decoding or publication. */
export async function inspectDesktopMediaImport(id: string, projectId: string, store?: ProductStore, services?: DesktopMediaServices): Promise<DesktopMediaImport> {
    const db = store ?? productDb, row = await readDesktopMediaImport(id, projectId, db);
    if (ownsDesktopMediaImport(id, projectId) || ["completed", "stopped", "failed"].includes(row.status)) return row;
    const next = row.selection.items.find(item => !row.receipts.some(receipt => receipt.itemId === item.entryId));
    if (!next) return row;
    let status: "stopped" | "failed" | "unknown" = "unknown";
    let error = "上次导入的处理结果尚未确认，未导入项不会自动继续。请保留此记录核对。";
    try {
        const state = operation(await native(services).request(projectId, {type: "readOperation", operationId: desktopMediaOperationId(row.id, next.entryId)}));
        if (state.status === "stopped" || state.status === "failed") {status = state.status; error = state.error.message;}
        else if (state.status === "discarded") {status = "stopped"; error = "上次处理已停止，未导入的临时文件已移除。";}
        // A prepared artifact is not a product receipt. Running/foreign/missing
        // owners also cannot establish termination or authorize another start.
    } catch { /* Missing/foreign session is deliberately unknown, never stopped. */ }
    if (row.status === status) return row;
    try {return await transitionDesktopMediaImport(row.id, projectId, row.revision, status, error, db);}
    catch (cause) {
        const current = await readDesktopMediaImport(id, projectId, db);
        if (current.revision !== row.revision) return current;
        throw cause;
    }
}

/** Native grants are deliberately not restored from model text or persisted history. */
export async function currentDesktopMediaCandidates(projectId: string, grantId: string, scanId: string, services?: DesktopMediaServices): Promise<DesktopMediaCandidates> {
    const retained = candidatesByScan.get(scanId);
    if (!retained || retained.projectId !== projectId || retained.grant.grantId !== grantId) throw new Error("此目录授权已不可用，请重新选择素材目录。");
    return readDesktopMediaCandidates(projectId, retained.grant, retained.scan, services);
}
export async function revokeDesktopMediaCandidates(candidates: DesktopMediaCandidates, services?: DesktopMediaServices): Promise<void> {
    await native(services).request(candidates.projectId, {type: "revokeDirectory", grantId: candidates.grant.grantId});
    candidatesByScan.delete(candidates.scan.scanId);
}

/** Stops only the actual live producer; persisted rows never create another owner. */
export function stopDesktopMediaImport(id: string, projectId: string): boolean {
    const active = activeImports.get(id);
    if (!active || active.projectId !== projectId || active.controller.signal.aborted) return false;
    active.controller.abort(); return true;
}
export function ownsDesktopMediaImport(id: string, projectId: string): boolean {
    return activeImports.get(id)?.projectId === projectId;
}

/** Capture the actual original picker/import promises before signalling any owner. */
export function shutdownDesktopMediaImports(): Promise<void> {
    if (importShutdown) return importShutdown;
    let resolve!: () => void;
    importShutdown = new Promise<void>(done => {resolve = done;});
    const original = [...activeImports.values(), ...directorySelections];
    for (const owner of original) owner.controller.abort();
    void Promise.allSettled(original.map(owner => owner.done)).then(() => resolve());
    return importShutdown;
}
