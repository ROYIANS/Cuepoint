import {afterEach, describe, expect, it, vi} from "vitest";
import {streamChatCompletions} from "@/lib/ai/chatStream";
import {streamResponses} from "@/lib/ai/responsesStream";
import {MAX_ERROR_BYTES, MAX_JSON_BYTES} from "@/lib/resource/limits";

const input = {baseUrl: "https://example.test/v1", apiKey: "sk-secret", connectorDefinitionId: "openai-compatible", model: "gpt-5.6-luna", messages: [{role: "user" as const, content: "hello"}]};
const frame = (delta: Record<string, unknown>, finish: string | null = null) => ({choices: [{delta, finish_reason: finish}]});
const sse = (value: unknown) => `data: ${JSON.stringify(value)}\n\n`;
function stream(wire: string, split = false) {
    const bytes = new TextEncoder().encode(wire);
    let at = 0;
    const cancel = vi.fn();
    const body = new ReadableStream<Uint8Array>({pull(controller) {
        if (at === bytes.length) return controller.close();
        const end = split ? Math.min(at + 4096, bytes.length) : bytes.length;
        controller.enqueue(bytes.subarray(at, end)); at = end;
    }, cancel}, {highWaterMark: 0});
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response(body, {headers: {"content-type": "text/event-stream"}}));
    return {body, cancel, fetchImpl};
}
afterEach(() => vi.restoreAllMocks());

describe("Chat bounded event and retained output", () => {
    it.each([false, true])("accepts usage-rich streams larger than an event budget, split=%s", async split => {
        const usage = sse({choices: [], usage: {total_tokens: 42}, ignored: "u".repeat(2048)});
        const fixture = stream(usage.repeat(2100) + sse(frame({reasoning_content: "想", content: "答"}, "stop")) + "data: [DONE]\n\n", split);
        const result = await streamChatCompletions(input, {fetchImpl: fixture.fetchImpl});
        expect(result).toMatchObject({ok: true, content: "答", reasoning: "想", usage: {totalTokens: 42}});
        expect(fixture.fetchImpl).toHaveBeenCalledOnce();
        expect(fixture.cancel).toHaveBeenCalledOnce();
        expect(fixture.body.locked).toBe(false);
    });
    it.each(["line", "event"])("rejects giant %s before any handler", async mode => {
        const wire = mode === "line" ? "data: " + "x".repeat(MAX_JSON_BYTES + 1) : ("data: " + "x".repeat(1024) + "\n").repeat(4096) + "\n";
        const fixture = stream(wire);
        const onDelta = vi.fn(), onReasoning = vi.fn();
        expect(await streamChatCompletions(input, {fetchImpl: fixture.fetchImpl, onDelta, onReasoning})).toMatchObject({ok: false, message: expect.stringContaining("资源限制")});
        expect(onDelta).not.toHaveBeenCalled(); expect(onReasoning).not.toHaveBeenCalled();
        expect(fixture.cancel).toHaveBeenCalledOnce(); expect(fixture.body.locked).toBe(false);
    });
    it("checks combined content/reasoning before either overflowing handler and keeps prior partial output", async () => {
        const prior = "a".repeat(MAX_JSON_BYTES - 100);
        const fixture = stream(sse(frame({content: prior})) + sse(frame({reasoning_content: "中".repeat(34), content: "bad"})));
        const onDelta = vi.fn(), onReasoning = vi.fn();
        const result = await streamChatCompletions(input, {fetchImpl: fixture.fetchImpl, onDelta, onReasoning});
        expect(result).toMatchObject({ok: false}); expect(onDelta).toHaveBeenCalledOnce(); expect(onDelta.mock.calls[0][0].length).toBe(prior.length);
        expect(onReasoning).not.toHaveBeenCalled(); expect(fixture.cancel).toHaveBeenCalledOnce();
    });
    it("counts retained tools with output, replaces repeated IDs and accepts complete tool finish", async () => {
        const tools = [{type: "function" as const, function: {name: "tool", description: "test", parameters: {type: "object"}}}];
        const id = "call-1";
        const initial = {index: 0, id, type: "function", function: {name: "tool", arguments: "{}"}};
        const retained = new TextEncoder().encode(id + "tool" + "{}").length;
        const exact = "a".repeat(MAX_JSON_BYTES - retained);
        const fixture = stream(sse(frame({tool_calls: [initial]})) + sse(frame({content: exact.slice(0, 2097152)})) + sse(frame({content: exact.slice(2097152)})) + sse(frame({tool_calls: [{index: 0, id}]})).repeat(20) + sse(frame({}, "tool_calls")) + "data: [DONE]\n\n");
        expect(await streamChatCompletions({...input, tools}, {fetchImpl: fixture.fetchImpl})).toMatchObject({ok: true, toolCalls: [{id, function: {name: "tool", arguments: "{}"}}]});
        const overflow = stream(sse(frame({tool_calls: [initial]})) + sse(frame({content: exact.slice(0, 2097152)})) + sse(frame({content: exact.slice(2097152)})) + sse(frame({content: "b"})));
        const onDelta = vi.fn();
        expect(await streamChatCompletions({...input, tools}, {fetchImpl: overflow.fetchImpl, onDelta})).toMatchObject({ok: false});
        expect(onDelta).toHaveBeenCalledTimes(2);
        expect(onDelta.mock.calls.flat().join("").length).toBe(exact.length);
    });
    it("preserves 16-call and field limits", async () => {
        const tools = [{type: "function" as const, function: {name: "tool", description: "test", parameters: {type: "object"}}}];
        for (const fragment of [{index: 16, id: "x", function: {name: "tool", arguments: "{}"}}, {index: 0, id: "x", function: {name: "tool", arguments: "x".repeat(32769)}}]) {
            const fixture = stream(sse(frame({tool_calls: [fragment]}, "tool_calls")));
            expect(await streamChatCompletions({...input, tools}, {fetchImpl: fixture.fetchImpl})).toMatchObject({ok: false});
        }
    });
    it("rejects a multibyte retained-output overflow although character count is below the limit", async () => {
        const first = "中".repeat(700000), second = "文".repeat(700000);
        const fixture = stream(sse(frame({content: first})) + sse(frame({content: second})));
        const onDelta = vi.fn();
        expect(await streamChatCompletions(input, {fetchImpl: fixture.fetchImpl, onDelta})).toMatchObject({ok: false});
        expect(onDelta).toHaveBeenCalledOnce(); expect(onDelta.mock.calls[0][0].length).toBe(first.length);
    });
});

describe("retained UTF-8 exact boundary across JSON deltas", () => {
    it.each(["chat", "responses"] as const)("%s accepts a split surrogate at the exact combined content/reasoning budget", async protocol => {
        const content = "a".repeat(MAX_JSON_BYTES / 2);
        const reasoning = "b".repeat(MAX_JSON_BYTES / 2 - 4);
        const deltas = [{content}, {reasoning_content: reasoning}, {reasoning_content: "\ud83d"}, {reasoning_content: "\ude00"}, {content: "overflow"}];
        const wire = deltas.map(delta => sse(protocol === "chat" ? frame(delta) : {
            type: delta.content === undefined ? "response.reasoning_summary_text.delta" : "response.output_text.delta",
            delta: delta.content ?? delta.reasoning_content,
        })).join("");
        const fixture = stream(wire), onDelta = vi.fn(), onReasoning = vi.fn();
        const transport = protocol === "chat" ? streamChatCompletions : streamResponses;
        const result = await transport(input, {fetchImpl: fixture.fetchImpl, onDelta, onReasoning});
        expect(result).toMatchObject({ok: false, message: expect.stringContaining("资源限制")});
        expect(new TextEncoder().encode(onDelta.mock.calls.flat().join("") + onReasoning.mock.calls.flat().join("")).byteLength).toBe(MAX_JSON_BYTES);
        expect(onDelta.mock.calls.flat().join("")).toBe(content);
        expect(onReasoning.mock.calls.flat().join("")).toBe(reasoning + "😀");
        expect(onReasoning).toHaveBeenCalledTimes(3);
        expect(fixture.fetchImpl).toHaveBeenCalledOnce();
        expect(fixture.cancel).toHaveBeenCalledOnce(); expect(fixture.body.locked).toBe(false);
    });
});

describe("Responses bounded reading and handler ordering", () => {
    it("bounds nonstream JSON before parse/callback and sends just one POST", async () => {
        const body = new ReadableStream<Uint8Array>({start(controller) {controller.enqueue(new Uint8Array(MAX_JSON_BYTES + 1));}});
        const cancel = vi.spyOn(body, "cancel");
        const release = vi.spyOn(ReadableStreamDefaultReader.prototype, "releaseLock");
        const fetchImpl = vi.fn<typeof fetch>(async () => new Response(body, {headers: {"content-type": "application/json", "content-length": "1"}}));
        const onDelta = vi.fn();
        expect(await streamResponses(input, {fetchImpl, onDelta})).toMatchObject({ok: false, message: expect.stringContaining("资源限制")});
        expect(onDelta).not.toHaveBeenCalled(); expect(fetchImpl).toHaveBeenCalledOnce();
        expect(release).toHaveBeenCalledOnce(); expect(body.locked).toBe(false);
        // Reader cancellation is used while the stream is locked, not body.cancel().
        expect(cancel).not.toHaveBeenCalled();
    });
    it("guards aggregate bytes before emitting an overflowing delta", async () => {
        const first = "中".repeat(700000);
        const fixture = stream(sse({type: "response.output_text.delta", delta: first}) + sse({type: "response.reasoning_summary_text.delta", delta: first}));
        const onDelta = vi.fn(), onReasoning = vi.fn();
        expect(await streamResponses(input, {fetchImpl: fixture.fetchImpl, onDelta, onReasoning})).toMatchObject({ok: false});
        expect(onDelta).toHaveBeenCalledOnce(); expect(onDelta.mock.calls[0][0].length).toBe(first.length); expect(onReasoning).not.toHaveBeenCalled();
        expect(fixture.cancel).toHaveBeenCalledOnce(); expect(fixture.body.locked).toBe(false);
    });
    it("accepts many small ignored usage events in one chunk, then authoritative terminal content", async () => {
        const wire = sse({type: "response.created", ignored: "u".repeat(2048)}).repeat(2100) + sse({type: "response.completed", response: {status: "completed", output: [{type: "message", role: "assistant", content: [{type: "output_text", text: "done"}]}]}});
        const fixture = stream(wire);
        expect(await streamResponses(input, {fetchImpl: fixture.fetchImpl})).toMatchObject({ok: true, content: "done"});
        expect(fixture.fetchImpl).toHaveBeenCalledOnce(); expect(fixture.body.locked).toBe(false);
    });
});

describe("bounded error bodies and cancellation remain authoritative", () => {
    it.each([streamChatCompletions, streamResponses])("preserves HTTP status when diagnostic body exceeds the modest limit", async transport => {
        const cancel = vi.fn();
        const body = new ReadableStream<Uint8Array>({start(controller) {controller.enqueue(new Uint8Array(MAX_ERROR_BYTES + 1));}, cancel});
        const fetchImpl = vi.fn<typeof fetch>(async () => new Response(body, {status: 403}));
        expect(await transport(input, {fetchImpl})).toMatchObject({ok: false, message: expect.stringContaining("403")});
        expect(cancel).toHaveBeenCalledOnce(); expect(fetchImpl).toHaveBeenCalledOnce(); expect(body.locked).toBe(false);
    });
    it.each([streamChatCompletions, streamResponses])("retains reader AbortError priority even without an AbortSignal", async transport => {
        for (const status of [200, 403]) for (const error of [new DOMException("stop", "AbortError"), Object.assign(new Error("stop"), {name: "AbortError"})]) {
            const body = new ReadableStream<Uint8Array>({pull() {throw error;}}, {highWaterMark: 0});
            const fetchImpl = vi.fn<typeof fetch>(async () => new Response(body, {status, headers: {"content-type": "application/json"}}));
            expect(await transport(input, {fetchImpl})).toMatchObject({ok: false, aborted: true});
            expect(body.locked).toBe(false); expect(fetchImpl).toHaveBeenCalledOnce();
        }
    });
});
