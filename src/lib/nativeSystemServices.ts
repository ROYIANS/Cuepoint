import {invoke} from "@tauri-apps/api/core";
import {z} from "zod";
import {Sha256} from "@/lib/sha256";

const CHUNK_BYTES = 262_144;
const receiptSchema = z.discriminatedUnion("type", [
    z.object({type: z.literal("canceled")}).strict(),
    z.object({type: z.literal("ready"), session: z.string().uuid(), chunkBytes: z.literal(CHUNK_BYTES)}).strict(),
    z.object({type: z.literal("saved"), byteLength: z.number().int().nonnegative().safe(), contentHash: z.string().regex(/^[a-f0-9]{64}$/)}).strict(),
    z.object({type: z.literal("publishedWithError"), byteLength: z.number().int().nonnegative().safe(), contentHash: z.string().regex(/^[a-f0-9]{64}$/), code: z.enum(["directorySync", "stageCleanup", "fileSync"])}).strict(),
]);
type PublishedSaveCode = "directorySync" | "stageCleanup" | "fileSync";
const publishedSaveMessages: Record<PublishedSaveCode, string> = {
    directorySync: "文件已保存，但系统未能确认最后的保存步骤。请检查已保存的文件。",
    stageCleanup: "文件已保存，但系统未能确认最后的保存步骤。请检查已保存的文件。",
    fileSync: "文件已保存，但系统未能确认内容已写入磁盘。请检查已保存的文件。",
};

/** The native file exists; callers must not display cancellation or retry this export automatically. */
class NativeSavePublishedError extends Error {
    readonly published = true;
    constructor(readonly byteLength: number, readonly contentHash: string, readonly code: PublishedSaveCode) {
        super(publishedSaveMessages[code]);
        this.name = "NativeSavePublishedError";
    }
}

/** Transfers an existing product Blob; it never opens or invents a SQLite project. */
export async function saveNativeBlob(blob: Blob, filename: string, signal?: AbortSignal): Promise<"saved" | "canceled"> {
    if (signal?.aborted) return "canceled";
    if (!Number.isSafeInteger(blob.size)) throw new Error("文件大小无法安全传输。");
    const operationId = crypto.randomUUID();
    let session: string = operationId;
    const cancel = async () => {
        await invoke("product_save_cancel", {request: {version: 1, session}});
    };
    const onAbort = () => {void cancel().catch(() => undefined);};
    signal?.addEventListener("abort", onAbort, {once: true});
    let finished = false;
    let finalizing = false;
    try {
        const begin = receiptSchema.parse(await invoke("product_save_begin", {request: {
            version: 1, operationId, fileName: filename, mimeType: blob.type, byteLength: blob.size,
        }}));
        if (begin.type === "canceled") return "canceled";
        if (begin.type !== "ready") throw new Error("文件保存返回了错误的阶段。");
        session = begin.session;
        const hash = new Sha256();
        for (let offset = 0; offset < blob.size; offset += CHUNK_BYTES) {
            if (signal?.aborted) return "canceled";
            const bytes = new Uint8Array(await blob.slice(offset, offset + CHUNK_BYTES).arrayBuffer());
            if (signal?.aborted) return "canceled";
            const written = await invoke<unknown>("product_save_chunk", {request: {version: 1, session, offset, bytes: Array.from(bytes)}});
            if (written !== offset + bytes.byteLength) throw new Error("文件传输未确认正确的字节位置。");
            hash.update(bytes);
        }
        if (signal?.aborted) return "canceled";
        // Do not race this promise with abort: publication may win. Its truthful result takes priority.
        finalizing = true;
        const result = receiptSchema.parse(await invoke("product_save_finish", {request: {version: 1, session, contentHash: hash.digest()}}));
        finished = true;
        if (result.type === "canceled") return "canceled";
        if (result.type !== "saved" && result.type !== "publishedWithError") throw new Error("文件保存未返回完成结果。");
        if (result.byteLength !== blob.size || result.contentHash !== hash.digest()) throw new Error("保存后的文件校验结果不匹配。");
        if (result.type === "publishedWithError") throw new NativeSavePublishedError(result.byteLength, result.contentHash, result.code);
        return "saved";
    } catch (error) {
        // An interrupted write/dialog cannot have published. A finish error has an unknown outcome.
        if (signal?.aborted && !finalizing) return "canceled";
        throw error;
    } finally {
        signal?.removeEventListener("abort", onAbort);
        if (!finished) await cancel().catch(() => undefined);
    }
}

export async function nativeOpenExternalUrl(url: string): Promise<void> {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password) throw new Error("只能打开 HTTP 或 HTTPS 外部链接。");
    await invoke("product_open_external", {url: parsed.href});
}
