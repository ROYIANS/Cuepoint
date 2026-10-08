import {db} from "@/db/database";
import {readGenerationTarget} from "@/db/agentGenerationTarget";
import {resolveConnector} from "@/db/connectors";
import type {AgentGenerationJob} from "@/domain/agentGeneration";
import type {MediaRecord} from "@/domain/types";
import type {GenerationMediaInput} from "@/domain/production";
import {flushPendingDrafts} from "@/lib/debouncedDraft";
import {targetRevision} from "@/lib/productionRevision";
import {generationImageDimensions} from "./generationMedia";
import {type GenerationSubmitArgs, generationSubmitSchema, profileRequest} from "./generationProfiles";

const targetTables = () => [db.projects, db.episodes, db.shots, db.characters, db.scenes, db.props, db.styles];

export async function resolveGenerationConnector(id: string, frozen?: Pick<AgentGenerationJob, "provider" | "baseUrl">) {
    const item = await resolveConnector(id);
    if (!item || (item.definitionId !== "apimart" && item.definitionId !== "aihubmix") || !item.apiKey.trim()) throw new Error("生成供应商尚未配置有效密钥");
    const url = new URL(item.baseUrl);
    if (!/^https?:$/.test(url.protocol) || url.username || url.password || url.search || url.hash || !url.pathname.endsWith("/v1")) throw new Error("供应商 Base URL 无效");
    if (frozen && (item.definitionId !== frozen.provider || item.baseUrl !== frozen.baseUrl)) throw new Error("供应商配置已变化，请恢复原配置后查询已有任务；不会重新提交");
    return item;
}

async function inputRevision(media: MediaRecord) {
    const digest = await crypto.subtle.digest("SHA-256", await media.blob.arrayBuffer());
    return targetRevision({
        id: media.id, projectId: media.projectId, mimeType: media.mimeType, size: media.blob.size,
        hash: [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("")
    });
}

function validateGenerationMedia(media: MediaRecord | undefined, projectId: string, role: GenerationMediaInput["role"]): asserts media is MediaRecord {
    const kind = role === "reference-video" ? "video" : "image";
    if (!media || media.projectId !== projectId || !media.blob.size || !media.mimeType.startsWith(`${kind}/`)) throw new Error("输入素材已删除、为空、类型错误或属于其他项目");
    if (kind === "image" && !["image/png", "image/jpeg", "image/webp", "image/gif"].includes(media.mimeType)) throw new Error("参考图片格式尚未支持");
}

async function validateApimartReference(media: MediaRecord, model: string) {
    if (media.blob.size > 20 * 1024 * 1024) throw new Error("APIMart 参考图不能超过20MiB");
    if (model !== "MiniMax-H3") return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(media.mimeType)) throw new Error("MiniMax H3 本地参考图仅支持 PNG、JPEG、WebP");
    const {width, height} = await generationImageDimensions(media.blob);
    if (width < 256 || height < 256 || width > 5760 || height > 5760 || width / height < 0.4 || width / height > 2.5) throw new Error("MiniMax H3 图片宽高须为256–5760px，比例0.4–2.5");
}

/** Flush and hash outside writes; only the target/media snapshot uses a read transaction. */
export async function prepareGenerationSnapshot(raw: GenerationSubmitArgs, signal: AbortSignal) {
    signal.throwIfAborted();
    const args = generationSubmitSchema.parse(raw);
    await flushPendingDrafts(args.target.projectId);
    const config = await resolveGenerationConnector(args.connectorId);
    const provider = config.definitionId as "apimart" | "aihubmix";
    const request = profileRequest(args, provider);
    const snapshot = await db.transaction("r", [...targetTables(), db.media], async () => {
        const current = await readGenerationTarget(request.target);
        const records = await db.media.bulkGet(request.inputs.map((input) => input.mediaId));
        return {current, records};
    });
    const inputs = [];
    let bytes = 0;
    for (const [index, input] of request.inputs.entries()) {
        const media = snapshot.records[index];
        validateGenerationMedia(media, request.target.projectId, input.role);
        if (provider === "apimart") await validateApimartReference(media, args.model);
        bytes += Math.ceil(media.blob.size / 3) * 4;
        inputs.push({...input, revision: await inputRevision(media)});
    }
    if (provider === "aihubmix" && bytes + new TextEncoder().encode(args.prompt).length + 8192 > 32 * 1024 * 1024) throw new Error("AIHubMix 内联素材请求超过32MiB限制");
    signal.throwIfAborted();
    const fingerprint = targetRevision({
        target: request.target,
        connectorId: config.id,
        provider,
        baseUrl: config.baseUrl,
        model: args.model,
        parameters: request.parameters,
        inputs,
        baseRevision: snapshot.current.revision
    });
    return {args, config, provider, request, inputs, fingerprint, current: snapshot.current, records: snapshot.records};
}

/** Blob revision checks must finish before the caller enters its write transaction. */
export async function loadGenerationInputs(job: AgentGenerationJob) {
    const rows: MediaRecord[] = [];
    for (const input of job.inputs) {
        const media = await db.media.get(input.mediaId);
        if (!media || media.projectId !== job.projectId || await inputRevision(media) !== input.revision) throw new Error("生成输入素材已变化，保留任务但不使用新的素材");
        rows.push(media);
    }
    return rows;
}
