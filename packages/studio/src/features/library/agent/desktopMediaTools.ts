import {z} from "zod";
import {DesktopMediaUncertainError} from "../../../platform/runtime/desktopMedia";
import {targetRevision} from "../../../platform/data/revision";
import {db as productDb} from "../../../platform/product/store";
import {StorageError} from "../../../platform/storage/errors";
import {defineTool} from "../../agent/runtime/toolDefinition";
import type {AgentToolContext} from "../../agent/runtime/tools";
import {requireBoundProjectScope} from "../../agent/runtime/projectScope";
import {ToolPendingError} from "../../agent/runtime/toolErrors";
import {getProjectKind} from "../../projects/models/project";
import {currentDesktopMediaCandidates, desktopMediaSelection, importDesktopMedia, inspectDesktopMediaImport, pickDesktopMediaDirectory, type DesktopMediaCandidates} from "../services/desktopMediaImport";

const uuid = z.string().uuid();
const scanSchema = z.object({}).strict();
const readSchema = z.object({grantId: uuid, scanId: uuid, offset: z.number().int().min(0).max(255).default(0), limit: z.number().int().min(1).max(50).default(30)}).strict();
const importSchema = z.object({grantId: uuid, scanId: uuid, entryIds: z.array(uuid).min(1).max(64)}).strict().refine(value => new Set(value.entryIds).size === value.entryIds.length, "所选视频不能重复");
const statusSchema = z.object({importId: z.string().min(1).max(160).regex(/^[a-zA-Z0-9_-]+$/u)}).strict();
async function project(context: AgentToolContext) {
    const store = context.store ?? productDb, projectId = await requireBoundProjectScope(context, undefined, store);
    const current = await store.projects.get(projectId);
    if (!current || current.archivedAt || getProjectKind(current) !== "video") throw new Error("请选择当前绑定的视频项目导入素材。");
    return projectId;
}
function page(value: DesktopMediaCandidates, offset = 0, limit = 30) {
    const entries = value.entries.slice(offset, offset + limit).map(({entryId, displayName, mimeType, byteLength, revision}) => ({entryId, filename: displayName, mimeType, byteLength, revision}));
    return {projectId: value.projectId, grantId: value.grant.grantId, scanId: value.scan.scanId, directory: value.grant.label, total: value.entries.length, skipped: value.scan.skipped,
        entries, offset, nextOffset: offset + entries.length < value.entries.length ? offset + entries.length : null};
}
async function frozen(args: z.infer<typeof importSchema>, context: AgentToolContext) {
    const projectId = await project(context), candidates = await currentDesktopMediaCandidates(projectId, args.grantId, args.scanId);
    const selection = desktopMediaSelection(candidates, args.entryIds, context.callId);
    return {projectId, selection, revision: targetRevision({projectId, selection})};
}
const idsJson = {grantId: {type: "string", format: "uuid"}, scanId: {type: "string", format: "uuid"}};
export const DESKTOP_MEDIA_TOOLS = [
    defineTool({schema: scanSchema, json: {type: "object", properties: {}, additionalProperties: false}}, {
        name: "desktop_media_scan", title: "选择本地视频目录", effect: "read", highRisk: () => false, requiresConfirmation: true,
        description: "经确认打开原生目录选择器，由用户亲自选择授权目录，再扫描本地视频；不接受路径。仅macOS/Windows桌面工作区，Windows首版只支持本地固定NTFS。返回前30项；扫描不会修改源文件，也不代表已导入。",
        async prepare(_args, context) {return {summary: "选择并扫描本地视频目录", changes: ["由你在系统窗口中选择素材目录。", "列出视频后，导入前仍需确认具体文件。"], revision: targetRevision({projectId: await project(context)})};},
        async execute(_args, context) {
            const projectId = await project(context);
            if (context.preview?.revision !== targetRevision({projectId})) throw new Error("目录选择的项目归属已变化，请重新确认。");
            try {
                const candidates = await pickDesktopMediaDirectory(projectId, context.signal, undefined, context.store);
                return candidates ? page(candidates) : {canceled: true, message: "未选择目录。"};
            } catch (cause) {
                if (cause instanceof DesktopMediaUncertainError) throw new ToolPendingError("目录选择或扫描结果尚未确认，不会自动重新打开选择器。", {cause});
                throw cause;
            }
        }
    }),
    defineTool({schema: readSchema, json: {type: "object", additionalProperties: false, required: ["grantId", "scanId"], properties: {...idsJson, offset: {type: "integer", minimum: 0, maximum: 255, default: 0}, limit: {type: "integer", minimum: 1, maximum: 50, default: 30}}}}, {
        name: "desktop_media_read", title: "读取目录视频列表", effect: "read", highRisk: () => false,
        description: "分页读取本次真实目录授权中的视频列表，最多50项；授权过期需用户重新选择，不恢复历史路径。文件名不是视频内容，不声称已观看。",
        async execute(args, context) {return page(await currentDesktopMediaCandidates(await project(context), args.grantId, args.scanId), args.offset, args.limit);}
    }),
    defineTool({schema: importSchema, json: {type: "object", additionalProperties: false, required: ["grantId", "scanId", "entryIds"], properties: {...idsJson, entryIds: {type: "array", minItems: 1, maxItems: 64, uniqueItems: true, items: {type: "string", format: "uuid"}}}}}, {
        name: "desktop_media_import", title: "导入选中的本地视频", effect: "write", highRisk: () => false, requiresConfirmation: true,
        description: "确认冻结的视频选择后，逐项复制并生成真实PNG缩略图，导入当前绑定视频项目。最多64项，每项512MiB、合计2GiB。停止会等待当前本地处理结束；保留已导入结果。未知结果只能核对，不可重试或用新调用重复导入。",
        async prepare(args, context) {
            const value = await frozen(args, context);
            return {summary: `导入 ${value.selection.items.length} 个本地视频`, changes: value.selection.items.map(item => item.filename), revision: value.revision};
        },
        async execute(args, context) {
            const value = await frozen(args, context);
            if (value.revision !== context.preview?.revision) throw new Error("目录或选择已变化，导入尚未开始，请重新确认。");
            try {
                const record = await importDesktopMedia({id: context.callId, projectId: value.projectId, actor: {kind: "agent", runId: context.runId, threadId: context.threadId, callId: context.callId}, selection: value.selection, signal: context.signal}, {store: context.store});
                if (record.status === "unknown" || ["accepted", "running", "stopping"].includes(record.status)) throw new ToolPendingError("原导入结果尚未确认，请核对已有导入记录，不会重复处理视频。");
                return {importId: record.id, projectId: record.projectId, status: record.status, imported: record.receipts.length, total: record.selection.items.length, mediaIds: record.receipts.map(receipt => receipt.sourceMediaId), ...(record.error ? {error: record.error} : {})};
            } catch (cause) {
                if (cause instanceof StorageError && cause.certainty === "unknown") throw new ToolPendingError("导入保存结果尚未确认，请核对已有导入记录，不会自动重复执行。", {cause});
                throw cause;
            }
        }
    }),
    defineTool({schema: statusSchema, json: {type: "object", additionalProperties: false, required: ["importId"], properties: {importId: {type: "string", minLength: 1, maxLength: 160}}}}, {
        name: "desktop_media_status", title: "核对本地导入结果", effect: "read", highRisk: () => false,
        description: "读取当前绑定项目已有导入记录和真实保存回执，不重新扫描、解码或导入。",
        async execute(args, context) {
            const record = await inspectDesktopMediaImport(args.importId, await project(context), context.store);
            return {importId: record.id, status: record.status, imported: record.receipts.length, total: record.selection.items.length, mediaIds: record.receipts.map(receipt => receipt.sourceMediaId), ...(record.error ? {error: record.error} : {})};
        }
    })
];
