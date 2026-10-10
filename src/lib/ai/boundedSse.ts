import {assertResponseBytes, cancelBody, utf8Bytes} from "./boundedResponse";
import {MAX_JSON_BYTES} from "@/lib/resource/limits";

interface SseEvent {
    data: string;
    event: string
}

/** Per-event actual UTF-8 budget, independent of the lifetime of a usage-rich stream. */
function createEventParser(limit: number) {
    let pending: string[] = [], data: string[] = [], event = "", bytes = 0;
    let pendingCr = false;
    const line = (): SseEvent | undefined => {
        const value = pending.join("");
        pending = [];
        if (!value) {
            const result = {data: data.join("\n"), event};
            data = [];
            event = "";
            bytes = 0;
            return result;
        }
        if (value.startsWith(":")) return;
        const colon = value.indexOf(":");
        const field = colon < 0 ? value : value.slice(0, colon);
        const content = colon < 0 ? "" : value.slice(colon + 1).replace(/^ /, "");
        if (field === "data") data.push(content);
        if (field === "event") event = content;
    };
    return {
        * push(text: string, eof = false): Generator<SseEvent> {
            // Defer a trailing CR until its possible LF arrives, including the LF
            // in the same event budget before dispatching its blank line.
            let start = 0;
            if (pendingCr) {
                if (!text.length && !eof) return;
                if (text.startsWith("\n")) {
                    assertResponseBytes(++bytes, limit);
                    start = 1;
                }
                pendingCr = false;
                const result = line();
                if (result) yield result;
            }
            const newline = /[\r\n]/g;
            newline.lastIndex = start;
            for (let match = newline.exec(text); match; match = newline.exec(text)) {
                const end = match.index;
                const part = text.slice(start, end);
                const crlf = text[end] === "\r" && text[end + 1] === "\n";
                bytes += utf8Bytes(part) + (crlf ? 2 : 1);
                assertResponseBytes(bytes, limit);
                pending.push(part);
                if (crlf) newline.lastIndex++;
                start = newline.lastIndex;
                if (text[end] === "\r" && end === text.length - 1 && !eof) {
                    pendingCr = true;
                    break;
                }
                const result = line();
                if (result) yield result;
            }
            const tail = text.slice(start);
            bytes += utf8Bytes(tail);
            assertResponseBytes(bytes, limit);
            if (tail) pending.push(tail);
        },
        finish() {
            if (pending.length || data.length || event) throw new Error("回复流意外中断，已保留收到的内容");
        },
    };
}

/** Fatal UTF-8 decoding, CRLF across reads, blank-line dispatch, cancellation and lock release. */
export async function* readSseEvents(response: Response, signal?: AbortSignal, limit = MAX_JSON_BYTES): AsyncGenerator<SseEvent> {
    if (!response.body) throw new Error("模型返回了空的响应流");
    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8", {fatal: true});
    const parser = createEventParser(limit);
    const abort = () => {
        void cancelBody(reader);
    };
    signal?.addEventListener("abort", abort, {once: true});
    try {
        while (true) {
            signal?.throwIfAborted();
            const next = await reader.read();
            signal?.throwIfAborted();
            if (next.done) break;
            for (let start = 0; start < next.value.byteLength; start += 16384) {
                const part = next.value.subarray(start, start + 16384);
                yield* parser.push(decoder.decode(part, {stream: true}));
            }
        }
        yield* parser.push(decoder.decode(), true);
        parser.finish();
    } finally {
        signal?.removeEventListener("abort", abort);
        await cancelBody(reader);
        reader.releaseLock();
    }
}
