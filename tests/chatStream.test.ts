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

  it("falls back to non-stream JSON when stream is rejected", async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { stream?: boolean };
      if (body.stream) {
        return new Response("stream not supported", { status: 400 });
      }
      return Response.json({
        choices: [{ message: { role: "assistant", content: "离线回复" } }],
      });
    });

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

    expect(result).toEqual({
      ok: true,
      content: "离线回复",
      reasoning: "",
      via: "json",
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("reads reasoning from JSON fallback message fields", async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { stream?: boolean };
      if (body.stream) {
        return new Response("no stream", { status: 400 });
      }
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
