import { describe, expect, it, vi } from "vitest";
import {
  consumeSseBuffer,
  parseSseDataPayload,
  streamChatCompletions,
} from "@/lib/ai/chatStream";

describe("chatStream SSE parse", () => {
  it("parses delta content from SSE data payloads", () => {
    expect(parseSseDataPayload("[DONE]")).toBeNull();
    expect(parseSseDataPayload("")).toBeNull();
    expect(parseSseDataPayload('{"choices":[{"delta":{"role":"assistant"}}]}')).toBeNull();
    expect(parseSseDataPayload('{"choices":[{"delta":{"content":"你"}}]}')).toBe("你");
    expect(
      parseSseDataPayload('{"choices":[{"message":{"content":"完整回复"}}]}'),
    ).toBe("完整回复");
    expect(parseSseDataPayload("not-json")).toBeNull();
  });

  it("consumes buffered SSE lines and keeps a partial trailing line", () => {
    const { pieces, rest } = consumeSseBuffer(
      'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\ndata: {"choices":[{"delta":{"content":" "}}]}\ndata: {"choices":[{"delta":{"content":"wor',
    );
    expect(pieces).toEqual(["Hello", " "]);
    expect(rest).toBe('data: {"choices":[{"delta":{"content":"wor');
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

    expect(result).toEqual({ ok: true, content: "一二", via: "stream" });
    expect(deltas).toEqual(["一", "二"]);
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toMatchObject({
      stream: true,
      model: "demo",
    });
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

    expect(result).toEqual({ ok: true, content: "离线回复", via: "json" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
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
