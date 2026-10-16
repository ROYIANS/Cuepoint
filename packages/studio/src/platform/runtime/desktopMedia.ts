import {invoke} from "@tauri-apps/api/core";
import {z} from "zod";
import type {ManagedBinaryRef} from "../media/binaryTypes";
import {registerNativePreparedBinary} from "../storage/nativeBinary";
import type {NativeSession} from "../storage/protocol";

const uuid = z.string().uuid();
const safeLabel = (max = 1024) => z.string().min(1).max(max).refine(value => !Array.from(value).some(c => {const n = c.codePointAt(0)!; return n < 32 || n >= 127 && n <= 159;}));
const hash = z.string().regex(/^[a-f0-9]{64}$/u);
const limitsSchema = z.object({maxDepth: z.literal(8), maxEntries: z.literal(4096), maxVideos: z.literal(256), maxFileBytes: z.literal(536870912), maxTotalBytes: z.literal(2147483648), maxPage: z.literal(100), maxActiveOperations: z.literal(2)}).strict();
const entrySchema = z.object({entryId: uuid, displayName: safeLabel(300).refine(value => !/[/\\]/u.test(value)), relativeName: safeLabel(), mimeType: z.enum(["video/mp4", "video/webm", "video/quicktime", "video/x-matroska", "video/x-msvideo"]), byteLength: z.number().int().positive().max(536870912), revision: hash}).strict();
const grantedSchema = z.object({status: z.literal("granted"), operationId: uuid, grantId: uuid, label: safeLabel(), limits: limitsSchema}).strict();
const scannedSchema = z.object({status: z.literal("scanned"), operationId: uuid, grantId: uuid, scanId: uuid, count: z.number().int().min(0).max(256), skipped: z.number().int().min(0).max(4096), totalBytes: z.number().int().min(0).max(2147483648), limits: limitsSchema}).strict();
const pageSchema = z.object({status: z.literal("scanPage"), grantId: uuid, scanId: uuid, offset: z.number().int().min(0).max(256), entries: z.array(entrySchema).max(100), total: z.number().int().min(0).max(256), nextOffset: z.number().int().min(1).max(256).nullable()}).strict();
const preparedSchema = z.object({status: z.literal("prepared"), operationId: uuid, grantId: uuid, scanId: uuid, entry: entrySchema, sourceClaim: z.unknown(), thumbnailClaim: z.unknown(), thumbnail: z.object({width: z.number().int().positive().max(640), height: z.number().int().positive().max(640), preset: z.literal("thumbnail-v1"), atSeconds: z.literal(0), decoder: z.literal("FFmpeg 8.0.3")}).strict()}).strict();
const failureSchema = z.object({status: z.enum(["failed", "stopped", "unknown"]), operationId: uuid, error: z.object({code: z.string().min(1).max(80), message: z.string().max(2000)}).strict()}).strict();
const unavailableErrorSchema = z.object({code: z.literal("platform"), message: z.string().max(2000)}).strict();
const operationSchema = z.union([grantedSchema, scannedSchema, preparedSchema, failureSchema,
    z.object({status: z.enum(["canceled", "discarded", "alreadyAdopted", "released", "stopping"]), operationId: uuid}).strict(),
    z.object({status: z.literal("running"), operationId: uuid, phase: z.enum(["picking", "scanning", "copying", "decoding"])}).strict()]);

export type DesktopMediaEntry = z.infer<typeof entrySchema>;
export type DesktopMediaGrant = z.infer<typeof grantedSchema>;
export type DesktopMediaScan = z.infer<typeof scannedSchema>;
export type DesktopMediaPage = z.infer<typeof pageSchema>;
type WireOperation = z.infer<typeof operationSchema>;
export type DesktopMediaPrepared = Omit<z.infer<typeof preparedSchema>, "sourceClaim" | "thumbnailClaim"> & {source: ManagedBinaryRef; thumbnailBinary: ManagedBinaryRef};
export type DesktopMediaOperation = Exclude<WireOperation, {status: "prepared"}> | DesktopMediaPrepared;
export type DesktopMediaAction = {type: "pickDirectory"; operationId: string} | {type: "scan"; operationId: string; grantId: string}
    | {type: "readScanPage"; grantId: string; scanId: string; offset: number; limit: number}
    | {type: "prepareVideo"; operationId: string; grantId: string; scanId: string; entryId: string; expectedRevision: string}
    | {type: "readOperation" | "cancelOperation" | "discardPrepared" | "releaseOperation"; operationId: string}
    | {type: "revokeDirectory"; grantId: string};
const actionSchema = z.discriminatedUnion("type", [
    z.object({type: z.literal("pickDirectory"), operationId: uuid}).strict(),
    z.object({type: z.literal("scan"), operationId: uuid, grantId: uuid}).strict(),
    z.object({type: z.literal("readScanPage"), grantId: uuid, scanId: uuid, offset: z.number().int().min(0).max(256), limit: z.number().int().min(1).max(100)}).strict(),
    z.object({type: z.literal("prepareVideo"), operationId: uuid, grantId: uuid, scanId: uuid, entryId: uuid, expectedRevision: hash}).strict(),
    ...(["readOperation", "cancelOperation", "discardPrepared", "releaseOperation"] as const).map(type => z.object({type: z.literal(type), operationId: uuid}).strict()),
    z.object({type: z.literal("revokeDirectory"), grantId: uuid}).strict()
]);
export interface DesktopMediaServices {
    request(projectId: string, action: DesktopMediaAction): Promise<DesktopMediaOperation | DesktopMediaPage | {status: "revoked"; grantId: string}>;
}
export class DesktopMediaUncertainError extends Error {
    readonly name = "DesktopMediaUncertainError";
}

/** One finite IPC owner, installed only beside the actual native ProductStore driver. */
export function createDesktopMediaServices(getSession: () => Promise<NativeSession>, call: (command: string, args: Record<string, unknown>) => Promise<unknown> = invoke): DesktopMediaServices {
    return {async request(projectId, action) {
        actionSchema.parse(action);
        z.string().min(1).max(160).regex(/^[a-zA-Z0-9_-]+$/u).parse(projectId);
        const session = await getSession();
        const request = {version: session.version, session: session.session, workspaceId: session.workspaceId, generation: session.generation, projectId, action};
        let raw: unknown;
        try {raw = await call("desktop_media_request", {request});}
        catch (cause) {
            // The native platform guard rejects before reserving any operation.
            // Only its closed Rust DTO proves unavailability; transport failures
            // and unrecognized replies retain their original uncertainty.
            if (unavailableErrorSchema.safeParse(cause).success) throw new Error("从文件夹导入视频需要 macOS 或 Windows 桌面版；Windows 首版支持本地固定 NTFS 磁盘。", {cause});
            throw new DesktopMediaUncertainError("无法确认本地素材操作的结果，请核对原有导入记录，不要重复执行。", {cause});
        }
        try {
            if (action.type === "readScanPage") {
                const page = pageSchema.parse(raw);
                if (page.grantId !== action.grantId || page.scanId !== action.scanId || page.offset !== action.offset || page.entries.length > action.limit || page.nextOffset !== (page.offset + page.entries.length < page.total ? page.offset + page.entries.length : null)) throw new Error("目录分页结果不匹配");
                return page;
            }
            if (action.type === "revokeDirectory") {
                const result = z.object({status: z.literal("revoked"), grantId: uuid}).strict().parse(raw);
                if (result.grantId !== action.grantId) throw new Error("目录权限结果不匹配");
                return result;
            }
            const result = operationSchema.parse(raw);
            if (result.operationId !== action.operationId) throw new Error("素材操作结果不匹配");
            if (result.status === "scanned" && (action.type !== "scan" && action.type !== "readOperation" || action.type === "scan" && result.grantId !== action.grantId)) throw new Error("目录扫描结果不匹配");
            if (result.status !== "prepared") return result;
            if (action.type === "prepareVideo" && (result.grantId !== action.grantId || result.scanId !== action.scanId || result.entry.entryId !== action.entryId || result.entry.revision !== action.expectedRevision)) throw new Error("待导入视频与冻结选择不匹配");
            const {sourceClaim, thumbnailClaim, ...summary} = result;
            const source = registerNativePreparedBinary(sourceClaim, session), thumbnailBinary = registerNativePreparedBinary(thumbnailClaim, session);
            if (source.mimeType !== result.entry.mimeType || source.byteLength !== result.entry.byteLength || thumbnailBinary.mimeType !== "image/png" || thumbnailBinary.byteLength < 1 || thumbnailBinary.byteLength > 8388608) throw new Error("待导入文件校验结果不匹配");
            return {...summary, source, thumbnailBinary};
        } catch (cause) {throw new DesktopMediaUncertainError("本地素材返回结果无法确认，请核对原有操作，不要重复执行。", {cause});}
    }};
}
let installed: DesktopMediaServices | undefined;
export function installDesktopMediaServices(services: DesktopMediaServices): void {
    if (installed) throw new Error("本地素材服务已安装");
    installed = services;
}
export function desktopMediaServices(): DesktopMediaServices | undefined {return installed;}
