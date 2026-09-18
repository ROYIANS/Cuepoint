import { describe, expect, it, vi } from "vitest";
import {
  accumulateStreamDelta,
  consumeSseBuffer,
  createReasoningAccum,
  finalizeReasoningAccum,
  parseSseDataPayload,
  streamChatCompletions,
} from "@/lib/ai/chatStream";

describe("chatStream SSE parse", () => {
  it("parses delta content from SSE data payloads", () => {
    expect(parseSseDataPayload("[DONE]")).toBeNull();
    expect(parseSseDataPayload("")).toBeNull();
    expect(parseSseDataPayload('{"choices":[{"delta":{"role":"assistant"}}]}')).toBeNull();
    expect(parseSseDataPayload('{"choices":[{"delta":{"content":"你"}}]}')).toEqual({
      content: "你",
    });
    expect(
      parseSseDataPayload('{"choices":[{"message":{"content":"完整回复"}}]}'),
    ).toEqual({ content: "完整回复" });
    expect(parseSseDataPayload("not-json")).toBeNull();
  });

  it("parses reasoning_content and reasoning separately from content", () => {
    expect(
      parseSseDataPayload(
        '{"choices":[{"delta":{"reasoning_content":"先想"}}]}',
      ),
    ).toEqual({ reasoning: "先想" });
    expect(
      parseSseDataPayload('{"choices":[{"delta":{"reasoning":"备选字段"}}]}'),
    ).toEqual({ reasoning: "备选字段" });
    expect(
      parseSseDataPayload(
        '{"choices":[{"delta":{"reasoning_content":"想","content":"答"}}]}',
      ),
    ).toEqual({ content: "答", reasoning: "想" });
    expect(
      parseSseDataPayload(
        '{"choices":[{"message":{"content":"答","reasoning_content":"想完"}}]}',
      ),
    ).toEqual({ content: "答", reasoning: "想完" });
  });

  it("consumes buffered SSE lines and keeps a partial trailing line", () => {
    const { chunks, rest } = consumeSseBuffer(
      'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\ndata: {"choices":[{"delta":{"content":" "}}]}\ndata: {"choices":[{"delta":{"content":"wor',
    );
    expect(chunks).toEqual([{ content: "Hello" }, { content: " " }]);
    expect(rest).toBe('data: {"choices":[{"delta":{"content":"wor');
  });
});

describe("reasoning lifecycle", () => {
  it("opens on first reasoning and closes on first content", () => {
    let state = createReasoningAccum();
    state = accumulateStreamDelta(state, { reasoning: "a" }, 1000);
    expect(state).toMatchObject({
      reasoning: "a",
      reasoningActive: true,
      reasoningStartedAt: 1000,
      content: "",
    });

    state = accumulateStreamDelta(state, { reasoning: "b" }, 1100);
    expect(state.reasoning).toBe("ab");
    expect(state.reasoningActive).toBe(true);
    expect(state.reasoningDurationMs).toBeUndefined();

    state = accumulateStreamDelta(state, { content: "x" }, 1500);
    expect(state).toMatchObject({
      content: "x",
      reasoning: "ab",
      reasoningActive: false,
      reasoningDurationMs: 500,
    });

    state = accumulateStreamDelta(state, { content: "y" }, 1600);
    expect(state.content).toBe("xy");
    expect(state.reasoningDurationMs).toBe(500);
  });

  it("finalize ends active reasoning on abort/complete", () => {
    let state = createReasoningAccum();
    state = accumulateStreamDelta(state, { reasoning: "partial" }, 2000);
    state = finalizeReasoningAccum(state, 2300);
    expect(state.reasoningActive).toBe(false);
    expect(state.reasoningDurationMs).toBe(300);
  });
});

describe("streamChatCompletions", () => {
  it("streams SSE deltas and supports AbortController stop", async () => {
    const encoder = new TextEncoder();
    const chunks = [
      'data: {"choices":[{"delta":{"content":"一"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"二"}}]}\n\n',
      "data: [DONE]\n\n",
    ];
    let index = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (index >= chunks.length) {
          controller.close();
          return;
        }
        controller.enqueue(encoder.encode(chunks[index]));
        index += 1;
      },
    });

    const fetchMock = vi.fn(async () =>
      new Response(stream, {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      }),
    );

    const deltas: string[] = [];
    const result = await streamChatCompletions(
      {
        baseUrl: "https://api.example.com/v1",
        apiKey: "sk-test",
        model: "demo",
        messages: [{ role: "user", content: "hi" }],
      },
      {
        fetchImpl: fetchMock as typeof fetch,
        onDelta: (text) => deltas.push(text),
      },
    );

    expect(result).toEqual({ ok: true, content: "一二", reasoning: "", via: "stream" });
    expect(deltas).toEqual(["一", "二"]);
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toMatchObject({
      stream: true,
      model: "demo",
    });
  });

  it("streams reasoning then content via dual callbacks", async () => {
    const encoder = new TextEncoder();
    const chunks = [
      'data: {"choices":[{"delta":{"reasoning_content":"想"}}]}\n\n',
      'data: {"choices":[{"delta":{"reasoning_content":"法"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"答"}}]}\n\n',
      "data: [DONE]\n\n",
    ];
    let index = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (index >= chunks.length) {
          controller.close();
          return;
        }
        controller.enqueue(encoder.encode(chunks[index]));
        index += 1;
      },
    });

    const fetchMock = vi.fn(async () =>
      new Response(stream, {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      }),
    );

    const reasoning: string[] = [];
    const deltas: string[] = [];
    const result = await streamChatCompletions(
      {
        baseUrl: "https://api.example.com/v1",
        apiKey: "sk-test",
        model: "demo",
        messages: [{ role: "user", content: "hi" }],
      },
      {
        fetchImpl: fetchMock as typeof fetch,
        onReasoning: (text) => reasoning.push(text),
        onDelta: (text) => deltas.push(text),
      },
    );

    expect(result).toEqual({
      ok: true,
      content: "答",
      reasoning: "想法",
      via: "stream",
    });
    expect(reasoning).toEqual(["想", "法"]);
    expect(deltas).toEqual(["答"]);
  });

  it("returns aborted when the signal fires", async () => {
    const controller = new AbortController();
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("Aborted", "AbortError"));
        });
        controller.abort();
      });
    });

    const result = await streamChatCompletions(
      {
        baseUrl: "https://api.example.com/v1",
        apiKey: "sk-test",
        model: "demo",
        messages: [{ role: "user", content: "hi" }],
      },
      {
        fetchImpl: fetchMock as typeof fetch,
        signal: controller.signal,
      },
    );

    expect(result).toEqual({ ok: false, message: "已停止", aborted: true });
  });

  it.each([400, 404, 405, 422, 500])("does not retry rejected requests (%s)", async (status) => {
    const fetchMock = vi.fn(async () => new Response("stream not supported", { status }));
    const result = await streamChatCompletions(input, { fetchImpl: fetchMock });
    expect(result).toMatchObject({ ok: false });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("reads reasoning from the original JSON response", async () => {
    const fetchMock = vi.fn(async () => {
      return Response.json({
        choices: [
          {
            message: {
              role: "assistant",
              content: "答案",
              reasoning_content: "内心独白",
            },
          },
        ],
      });
    });

    const reasoning: string[] = [];
    const deltas: string[] = [];
    const result = await streamChatCompletions(
      {
        baseUrl: "https://api.example.com/v1",
        apiKey: "sk-test",
        model: "demo",
        messages: [{ role: "user", content: "hi" }],
      },
      {
        fetchImpl: fetchMock as typeof fetch,
        onReasoning: (text) => reasoning.push(text),
        onDelta: (text) => deltas.push(text),
      },
    );

    expect(result).toEqual({
      ok: true,
      content: "答案",
      reasoning: "内心独白",
      via: "json",
    });
    expect(reasoning).toEqual(["内心独白"]);
    expect(deltas).toEqual(["答案"]);
  });

  it("validates required fields", async () => {
    expect(
      await streamChatCompletions({
        baseUrl: "",
        apiKey: "sk",
        model: "m",
        messages: [{ role: "user", content: "x" }],
      }),
    ).toEqual({ ok: false, message: "请填写 Base URL" });
    expect(
      await streamChatCompletions({
        baseUrl: "https://x/v1",
        apiKey: " ",
        model: "m",
        messages: [{ role: "user", content: "x" }],
      }),
    ).toEqual({ ok: false, message: "请填写 API Key" });
    expect(
      await streamChatCompletions({
        baseUrl: "https://x/v1",
        apiKey: "sk",
        model: " ",
        messages: [{ role: "user", content: "x" }],
      }),
    ).toEqual({ ok: false, message: "请选择模型" });
  });
});

const input = {
  baseUrl: "https://api.example.com/v1",
  apiKey: "sk-private-key",
  model: "demo",
  messages: [{ role: "user" as const, content: "hi" }],
};

function sse(data: string) {
  return new Response(data, { headers: { "Content-Type": "text/event-stream" } });
}
const answer = 'data: {"choices":[{"delta":{"content":"部分答案"}}]}\n\n';
const stop = 'data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\n';

describe("chat completion protocol boundaries", () => {
  it("retains finish metadata and accepts a complete stop at EOF", async () => {
    const fetchMock = vi.fn(async () => sse(answer + stop));
    expect(await streamChatCompletions(input, { fetchImpl: fetchMock })).toEqual({
      ok: true, content: "部分答案", reasoning: "", via: "stream", finishReason: "stop",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([
    answer,
    answer + 'data: {"choices":',
    answer + 'data: [DONE]',
    answer + 'data: [DONE]\n',
    answer + 'data: not-json\n\n',
    answer + 'data: {}\n\n',
    '',
    ': heartbeat\n\n',
    'data: [DONE]\n\n',
    'data: {"choices":[{"delta":{"reasoning":"thinking"}}]}\n\ndata: [DONE]\n\n',
    'data: {"choices":[{"delta":{"tool_calls":[{"id":"t"}]}}]}\n\ndata: [DONE]\n\n',
  ])("rejects malformed, unfinished or unusable streams without retry (%s)", async (body) => {
    const fetchMock = vi.fn(async () => sse(body));
    const deltas: string[] = [];
    const result = await streamChatCompletions(input, { fetchImpl: fetchMock, onDelta: (text) => deltas.push(text) });
    expect(result.ok).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    if (body.startsWith(answer)) expect(deltas).toEqual(["部分答案"]);
  });

  it.each(["length", "content_filter", "tool_calls", "function_call", "unknown"]) (
    "does not classify finish_reason %s as a complete answer", async (finishReason) => {
      const fetchMock = vi.fn(async () => sse(answer + `data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: finishReason }] })}\n\ndata: [DONE]\n\n`));
      expect(await streamChatCompletions(input, { fetchImpl: fetchMock })).toMatchObject({ ok: false, finishReason });
    },
  );

  it.each([
    'data: {"error":{"message":"secret sk-private-key"}}\n\n',
    'event: error\ndata: {"message":"secret sk-private-key"}\n\n',
    'event: error\ndata: secret sk-private-key\n\n',
  ])("surfaces redacted error events after partial output", async (body) => {
    const deltas: string[] = [];
    const result = await streamChatCompletions(input, {
      fetchImpl: vi.fn(async () => sse(answer + body)), onDelta: (text) => deltas.push(text),
    });
    expect(result).toMatchObject({ ok: false, message: "secret [已隐藏]" });
    expect(deltas).toEqual(["部分答案"]);
  });

  it("handles split UTF-8, CRLF, comments, multiline data and usage frames", async () => {
    const bytes = new TextEncoder().encode(': hello\r\nevent: message\r\ndata: {"choices":\r\ndata: [{"delta":{"content":"你好"}}]}\r\n\r\n' + stop + 'data: {"choices":[],"usage":{"total_tokens":10}}\n\ndata: [DONE]\n\n');
    let i = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (i === bytes.length) controller.close();
        else controller.enqueue(bytes.slice(i, ++i));
      },
    });
    expect(await streamChatCompletions(input, { fetchImpl: vi.fn(async () => new Response(stream, { headers: { "content-type": "text/event-stream" } })) })).toMatchObject({ ok: true, content: "你好", finishReason: "stop" });
  });

  it("finishes and cancels the reader on DONE without waiting for connection close", async () => {
    const cancel = vi.fn();
    const stream = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new TextEncoder().encode(answer + 'data: [DONE]\n\n')); }, cancel });
    expect(await streamChatCompletions(input, { fetchImpl: vi.fn(async () => new Response(stream, { headers: { "content-type": "text/event-stream" } })) })).toMatchObject({ ok: true });
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it("does not dispatch a request when already aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    const fetchMock = vi.fn();
    expect(await streamChatCompletions(input, { signal: controller.signal, fetchImpl: fetchMock })).toEqual({ ok: false, message: "已停止", aborted: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("stops further callbacks when aborted from a delta callback", async () => {
    const controller = new AbortController();
    const onDelta = vi.fn(() => controller.abort());
    expect(await streamChatCompletions(input, { signal: controller.signal, onDelta, fetchImpl: vi.fn(async () => sse(answer + answer + 'data: [DONE]\n\n')) })).toMatchObject({ ok: false, aborted: true });
    expect(onDelta).toHaveBeenCalledTimes(1);
  });

  it("aborts a pending reader even when the transport does not wire the signal", async () => {
    const controller = new AbortController();
    const cancel = vi.fn();
    const stream = new ReadableStream<Uint8Array>({ start(c) { c.enqueue(new TextEncoder().encode(answer)); }, cancel });
    const result = streamChatCompletions(input, {
      signal: controller.signal,
      fetchImpl: vi.fn(async () => new Response(stream, { headers: { "content-type": "text/event-stream" } })),
      onDelta: () => setTimeout(() => controller.abort(), 0),
    });
    expect(await result).toMatchObject({ ok: false, aborted: true });
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it.each([null, {}, { choices: [] }, { choices: [{ message: { content: "" } }] }, { choices: [{ message: { content: [] } }] }, { error: { message: "sk-private-key denied" } }])("rejects malformed or empty JSON without duplicate POSTs", async (body) => {
    const fetchMock = vi.fn(async () => Response.json(body));
    const result = await streamChatCompletions(input, { fetchImpl: fetchMock });
    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).not.toContain(input.apiKey);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rejects invalid JSON without duplicate POSTs", async () => {
    const fetchMock = vi.fn(async () => new Response("not json"));
    expect(await streamChatCompletions(input, { fetchImpl: fetchMock })).toMatchObject({ ok: false });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("redacts HTTP and network errors before retaining or truncating them", async () => {
    for (const fetchImpl of [
      vi.fn(async () => new Response("Bearer sk-private-key", { status: 401 })),
      vi.fn(async () => { throw new Error("Failed sk-private-key Bearer different-token"); }),
    ]) {
      const result = await streamChatCompletions(input, { fetchImpl });
      expect(result.ok).toBe(false);
      expect(JSON.stringify(result)).not.toContain(input.apiKey);
      expect(JSON.stringify(result)).not.toContain("different-token");
    }
  });
});
