export class ResponseLimitError extends Error {
    constructor() {
        super("服务响应超过本地资源限制，已停止读取；不会自动重新提交");
        this.name = "ResponseLimitError";
    }
}

export function isReadAbort(error: unknown, signal?: AbortSignal): boolean {
    return signal?.aborted === true || (error instanceof Error || error instanceof DOMException) && error.name === "AbortError";
}

export function utf8Bytes(value: string): number {
    return new TextEncoder().encode(value).byteLength;
}

/** UTF-8 size of appended text also handles a surrogate pair split across deltas. */
export function appendedUtf8Bytes(previous: string, delta: string): number {
    const last = previous.charCodeAt(previous.length - 1), first = delta.charCodeAt(0);
    const paired = last >= 0xd800 && last <= 0xdbff && first >= 0xdc00 && first <= 0xdfff;
    return utf8Bytes(delta) - (paired ? 2 : 0);
}

export function assertResponseBytes(bytes: number, limit: number): void {
    if (bytes > limit) throw new ResponseLimitError();
}

/** Cancellation is cleanup: never replace the original protocol/abort/read error. */
export async function cancelBody(body: ReadableStream<Uint8Array> | ReadableStreamDefaultReader<Uint8Array> | null): Promise<void> {
    try {
        await body?.cancel();
    } catch { /* Best effort, including synchronous failures and already errored bodies. */ }
}

/** Read actual bytes before allocating text, JSON or a Blob. Headers only permit early rejection. */
export async function readResponseBytes(response: Response, limit: number, signal?: AbortSignal): Promise<Uint8Array<ArrayBuffer>> {
    if (signal?.aborted || Number(response.headers.get("content-length")) > limit) {
        await cancelBody(response.body);
        signal?.throwIfAborted();
        throw new ResponseLimitError();
    }
    if (!response.body) return new Uint8Array();
    const reader = response.body.getReader();
    const abort = () => { void cancelBody(reader); };
    signal?.addEventListener("abort", abort, {once: true});
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
        while (true) {
            signal?.throwIfAborted();
            const next = await reader.read();
            signal?.throwIfAborted();
            if (next.done) break;
            assertResponseBytes(size + next.value.byteLength, limit);
            size += next.value.byteLength;
            chunks.push(next.value);
        }
        const bytes = new Uint8Array(size);
        let offset = 0;
        for (const chunk of chunks) {
            bytes.set(chunk, offset);
            offset += chunk.byteLength;
        }
        return bytes;
    } finally {
        signal?.removeEventListener("abort", abort);
        await cancelBody(reader);
        reader.releaseLock();
    }
}

export async function readResponseText(response: Response, limit: number, signal?: AbortSignal, fatal = true): Promise<string> {
    return new TextDecoder("utf-8", {fatal}).decode(await readResponseBytes(response, limit, signal));
}

export async function readResponseJson(response: Response, limit: number, signal?: AbortSignal, fatal = true): Promise<unknown> {
    return JSON.parse(await readResponseText(response, limit, signal, fatal));
}

export async function readResponseBlob(response: Response, limit: number, signal?: AbortSignal): Promise<Blob> {
    return new Blob([await readResponseBytes(response, limit, signal)], {type: response.headers.get("content-type") ?? ""});
}

/** Known HTTP failure remains authoritative when its optional diagnostic body fails. */
export async function readErrorText(response: Response, limit: number, signal?: AbortSignal): Promise<string> {
    try {
        return await readResponseText(response, limit, signal);
    } catch (error) {
        if (isReadAbort(error, signal)) throw error;
        return "";
    }
}
