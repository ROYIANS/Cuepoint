import {z} from "zod";
import {nowIso} from "../../../platform/identity";
import {targetRevision} from "../../../platform/data/revision";
import {binaryByteLength, binaryMimeType, type BinaryContent} from "../../../platform/media/binaryTypes";
import {Sha256} from "../../../platform/media/sha256";
import {db as productDb} from "../../../platform/product/store";
import {isBinaryReference} from "../../../platform/storage/codec";
import {StorageError} from "../../../platform/storage/errors";
import type {ProductStore} from "../../../platform/storage/types";
import {toolNamesForCall} from "../../agent/models/agentToolSelection";
import {desktopImportProvenanceSchema, type DesktopImportProvenance} from "../models/media";
import type {DesktopMediaImport, DesktopMediaImportActor, DesktopMediaImportReceipt, DesktopMediaImportSelection, DesktopMediaImportStatus} from "../models/desktopMediaImport";
import {touchProject} from "../../projects/commands/ownership";

const opaque = z.string().min(1).max(160).regex(/^[a-zA-Z0-9_-]+$/u);
const hasControl = (value: string) => Array.from(value).some(character => {const code = character.codePointAt(0)!; return code < 32 || code >= 127 && code <= 159;});
const revision = z.string().min(1).max(256).refine(value => !hasControl(value));
const itemSchema = z.object({entryId: opaque, revision,
    filename: z.string().min(1).max(300).refine(value => !/[/\\]/u.test(value) && !hasControl(value)),
    mimeType: z.enum(["video/mp4", "video/webm", "video/quicktime", "video/x-matroska", "video/x-msvideo"]),
    byteLength: z.number().int().positive().max(512 * 1024 * 1024), sourceMediaId: opaque, thumbnailMediaId: opaque}).strict();
const selectionSchema = z.object({grantId: opaque, scanId: opaque, revision, items: z.array(itemSchema).min(1).max(64)}).strict();
const actorSchema = z.discriminatedUnion("kind", [z.object({kind: z.literal("human")}).strict(),
    z.object({kind: z.literal("agent"), runId: opaque, threadId: opaque, callId: opaque}).strict()]);
const tables = (db: ProductStore) => [db.desktopMediaImports, db.media, db.projects, db.agentRuns, db.agentToolCalls, db.chatThreads, db.chatMessages];
const active = (status: DesktopMediaImportStatus) => ["accepted", "running", "stopping"].includes(status);

async function project(projectId: string, db: ProductStore) {
    const row = await db.projects.get(projectId);
    if (!row || row.archivedAt || row.kind !== undefined && row.kind !== "video") throw new Error("导入目标视频项目已不存在或已归档");
    return row;
}
async function agentAuthority(actor: DesktopMediaImportActor, projectId: string, selection: DesktopMediaImportSelection, db: ProductStore): Promise<string | undefined> {
    if (actor.kind === "human") return undefined;
    const [run, call, thread] = await Promise.all([db.agentRuns.get(actor.runId), db.agentToolCalls.get(actor.callId), db.chatThreads.get(actor.threadId)]);
    const message = run && await db.chatMessages.get(run.assistantMessageId);
    if (!run || !call || !thread || thread.projectId !== projectId || run.projectId !== projectId || run.threadId !== thread.id ||
        !message || message.threadId !== thread.id || message.runId !== run.id || run.status !== "running" || call.status !== "running" ||
        call.runId !== run.id || call.threadId !== thread.id || call.name !== "desktop_media_import" || call.step !== (run.modelStep ?? 1) ||
        !toolNamesForCall(run, call.step).includes(call.name)) throw new Error("本地素材导入的 Agent 执行归属已变化");
    if (call.effect !== "write" || call.highRisk !== false || call.atomic === true || call.requiresConfirmation !== true || call.decision !== "approve" ||
        call.preview?.revision !== targetRevision({projectId, selection})) throw new Error("本地素材导入未获得与当前冻结选择一致的确认");
    return targetRevision({name: call.name, arguments: call.arguments, step: call.step, effect: call.effect, highRisk: call.highRisk,
        atomic: call.atomic, requiresConfirmation: call.requiresConfirmation, preview: call.preview, decision: call.decision, decidedAt: call.decidedAt});
}
function validateSelection(selection: DesktopMediaImportSelection) {
    const entryIds = new Set(selection.items.map(item => item.entryId));
    const mediaIds = selection.items.flatMap(item => [item.sourceMediaId, item.thumbnailMediaId]);
    if (entryIds.size !== selection.items.length || new Set(mediaIds).size !== mediaIds.length || selection.items.reduce((n, item) => n + item.byteLength, 0) > 2 * 1024 * 1024 * 1024)
        throw new Error("导入选择重复或超过文件总量限制");
}
async function owned(id: string, projectId: string, db: ProductStore): Promise<DesktopMediaImport> {
    await project(projectId, db);
    const row = await db.desktopMediaImports.get(id);
    if (!row || row.projectId !== projectId) throw new Error("素材导入记录不存在或不属于当前项目");
    return row;
}
function requireRevision(row: DesktopMediaImport, expected: number) {
    if (row.revision !== expected) throw new Error("素材导入状态已变化，请重新读取");
}

export async function admitDesktopMediaImport(input: {id: string; projectId: string; actor: DesktopMediaImportActor; selection: DesktopMediaImportSelection}, store?: ProductStore): Promise<{import: DesktopMediaImport; admitted: boolean}> {
    const db = store ?? productDb;
    const id = opaque.parse(input.id), projectId = opaque.parse(input.projectId), actor = actorSchema.parse(input.actor), selection = selectionSchema.parse(input.selection);
    validateSelection(selection);
    const reconcile = async (tx: ProductStore, callRevision: string | undefined) => {
        const existing = await tx.desktopMediaImports.get(id);
        if (!existing) return undefined;
        if (existing.projectId !== projectId || targetRevision(existing.actor) !== targetRevision(actor) || existing.callRevision !== callRevision || targetRevision(existing.selection) !== targetRevision(selection))
            throw new Error("原素材导入的目标、身份或选择不可替换");
        return {import: existing, admitted: false};
    };
    try {
        return await db.transaction("rw", tables(db), async tx => {
            await project(projectId, tx);
            const callRevision = await agentAuthority(actor, projectId, selection, tx);
            const existing = await reconcile(tx, callRevision);
            if (existing) return existing;
            if (actor.kind === 'agent' && (await tx.desktopMediaImports.where('projectId').equals(projectId).toArray()).some(row => row.actor.kind === 'agent' && row.actor.callId === actor.callId))
                throw new Error("同一工具调用已受理导入，不可用新 ID 再次启动");
            const rows = await tx.desktopMediaImports.where("projectId").equals(projectId).toArray();
            if (rows.some(row => active(row.status) || row.status === "unknown")) throw new Error("当前项目已有进行中或待确认的导入，请先处理");
            for (const item of selection.items) if (await tx.media.get(item.sourceMediaId) || await tx.media.get(item.thumbnailMediaId)) throw new Error("预留媒体 ID 已被占用");
            const at = nowIso();
            const row: DesktopMediaImport = {id, projectId, actor, ...(callRevision ? {callRevision} : {}), selection, status: "accepted", revision: 1, receipts: [], createdAt: at, updatedAt: at};
            await tx.desktopMediaImports.add(row);
            return {import: row, admitted: true};
        });
    } catch (cause) {
        if (cause instanceof StorageError && cause.certainty === "unknown") {
            try {
                const existing = await db.transaction("r", tables(db), async tx => {await project(projectId, tx); return reconcile(tx, await agentAuthority(actor, projectId, selection, tx));});
                if (existing) return existing;
            } catch { /* An unresolved admission is never permission to start native work. */ }
        }
        throw cause;
    }
}

export async function readDesktopMediaImport(id: string, projectId: string, store?: ProductStore): Promise<DesktopMediaImport> {
    const db = store ?? productDb;
    return db.transaction("r", [db.desktopMediaImports, db.projects], tx => owned(id, projectId, tx));
}

export async function transitionDesktopMediaImport(id: string, projectId: string, expectedRevision: number, status: DesktopMediaImportStatus, error?: string, store?: ProductStore): Promise<DesktopMediaImport> {
    const db = store ?? productDb;
    return db.transaction("rw", [db.desktopMediaImports, db.projects], async tx => {
        const row = await owned(id, projectId, tx); requireRevision(row, expectedRevision);
        const allowed: Record<DesktopMediaImportStatus, DesktopMediaImportStatus[]> = {
            accepted: ["running", "stopping", "stopped", "failed", "unknown"], running: ["stopping", "stopped", "failed", "unknown"],
            stopping: ["stopped", "failed", "unknown"], stopped: [], completed: [], failed: [], unknown: ["stopped", "failed"]};
        if (row.status === status) return row;
        if (!allowed[row.status].includes(status)) throw new Error("素材导入状态不可恢复执行或重复启动");
        const next: DesktopMediaImport = {...row, status, revision: row.revision + 1, updatedAt: nowIso(), ...(error ? {error: error.slice(0, 2000)} : {})};
        await tx.desktopMediaImports.put(next); return next;
    });
}

async function contentHash(binary: BinaryContent): Promise<string> {
    if (!(binary instanceof Blob)) {
        if (!isBinaryReference(binary)) throw new Error("媒体引用未通过受信任的存储入口");
        return binary.contentHash;
    }
    const hash = new Sha256();
    for (let offset = 0; offset < binary.size; offset += 262144) hash.update(new Uint8Array(await binary.slice(offset, offset + 262144).arrayBuffer()));
    return hash.digest();
}

/** Native copying/decoding already finished. This transaction contains only local publication. */
export async function publishDesktopMediaImportItem(input: {importId: string; projectId: string; itemId: string; expectedRevision: number; source: BinaryContent; thumbnail: BinaryContent; provenance: DesktopImportProvenance}, store?: ProductStore): Promise<{import: DesktopMediaImport; receipt: DesktopMediaImportReceipt; published: boolean}> {
    const db = store ?? productDb, provenance = desktopImportProvenanceSchema.parse(input.provenance);
    if (binaryByteLength(input.source) <= 0 || binaryByteLength(input.source) > 512 * 1024 * 1024 || binaryByteLength(input.thumbnail) <= 0 || binaryByteLength(input.thumbnail) > 8 * 1024 * 1024 || binaryMimeType(input.thumbnail) !== "image/png") throw new Error("待导入素材或缩略图无效或超过限制");
    const [sourceHash, thumbnailHash] = await Promise.all([contentHash(input.source), contentHash(input.thumbnail)]);
    if (sourceHash !== provenance.sourceHash || thumbnailHash !== provenance.thumbnail.contentHash) throw new Error("待导入素材与已验证的内容哈希不匹配");
    return db.transaction("rw", tables(db), async tx => {
        const row = await owned(input.importId, input.projectId, tx);
        const item = row.selection.items.find(value => value.entryId === input.itemId);
        if (!item || provenance.importId !== row.id || provenance.itemId !== item.entryId || provenance.grantId !== row.selection.grantId ||
            provenance.scanId !== row.selection.scanId || provenance.entryRevision !== item.revision || binaryByteLength(input.source) !== item.byteLength || binaryMimeType(input.source) !== item.mimeType)
            throw new Error("待导入内容与受理时的冻结选择不匹配");
        const receipt = row.receipts.find(value => value.itemId === item.entryId);
        if (receipt) {
            if (targetRevision(receipt.provenance) !== targetRevision(provenance)) throw new Error("原导入回执不可替换");
            const [source, thumbnail] = await tx.media.bulkGet([receipt.sourceMediaId, receipt.thumbnailMediaId]);
            if (!source || !thumbnail || source.projectId !== row.projectId || thumbnail.projectId !== row.projectId || source.thumbnailMediaId !== thumbnail.id || thumbnail.derivative?.sourceMediaId !== source.id || targetRevision(source.source) !== targetRevision(provenance) ||
                binaryByteLength(source.blob) !== item.byteLength || binaryMimeType(source.blob) !== item.mimeType || binaryMimeType(thumbnail.blob) !== 'image/png' ||
                !(source.blob instanceof Blob) && (!isBinaryReference(source.blob) || source.blob.contentHash !== provenance.sourceHash) ||
                !(thumbnail.blob instanceof Blob) && (!isBinaryReference(thumbnail.blob) || thumbnail.blob.contentHash !== provenance.thumbnail.contentHash)) throw new Error("已提交媒体与导入回执不匹配，请检查现有素材");
            return {import: row, receipt, published: false};
        }
        requireRevision(row, input.expectedRevision);
        if (row.status !== "running") throw new Error("导入已停止或结果待确认，不能继续发布");
        if (await agentAuthority(row.actor, row.projectId, row.selection, tx) !== row.callRevision) throw new Error("导入原始调用或确认范围已变化");
        const at = nowIso(), saved: DesktopMediaImportReceipt = {itemId: item.entryId, sourceMediaId: item.sourceMediaId, thumbnailMediaId: item.thumbnailMediaId, provenance, committedAt: at};
        await tx.media.add({id: item.thumbnailMediaId, projectId: row.projectId, mimeType: "image/png", filename: `${item.filename}.thumbnail.png`, blob: input.thumbnail, derivative: {kind: "video-thumbnail", sourceMediaId: item.sourceMediaId}});
        await tx.media.add({id: item.sourceMediaId, projectId: row.projectId, mimeType: item.mimeType, filename: item.filename, blob: input.source, libraryRetained: true, thumbnailMediaId: item.thumbnailMediaId, source: provenance});
        const next: DesktopMediaImport = {...row, receipts: [...row.receipts, saved], status: row.receipts.length + 1 === row.selection.items.length ? "completed" : row.status, revision: row.revision + 1, updatedAt: at};
        await tx.desktopMediaImports.put(next);
        await touchProject(row.projectId, tx);
        return {import: next, receipt: saved, published: true};
    });
}
