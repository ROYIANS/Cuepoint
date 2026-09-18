import {
  authHeaders,
  chatCompletionsUrl,
  normalizeBaseUrl,
} from "@/lib/ai/openaiCompatible";

export type ChatCompletionMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type StreamChatInput = {
  baseUrl: string;
  apiKey: string;
  model: string;
  messages: ChatCompletionMessage[];
};

export type StreamChatHandlers = {
  onDelta?: (text: string) => void;
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
};

export type StreamChatResult =
  | { ok: true; content: string; via: "stream" | "json" }
  | { ok: false; message: string; aborted?: boolean };

/**
 * Extract assistant text from one SSE `data:` JSON payload.
 * Returns null for keep-alives / role-only / incomplete chunks.
 */
export function parseSseDataPayload(data: string): string | null {
  const trimmed = data.trim();
  if (!trimmed || trimmed === "[DONE]") return null;
  try {
    const json = JSON.parse(trimmed) as {
      choices?: Array<{ delta?: { content?: unknown }; message?: { content?: unknown } }>;
    };
    const choice = json.choices?.[0];
    const delta = choice?.delta?.content;
    if (typeof delta === "string" && delta.length > 0) return delta;
    const message = choice?.message?.content;
    if (typeof message === "string" && message.length > 0) return message;
    return null;
  } catch {
    return null;
  }
}

/**
 * Parse an SSE buffer chunk; returns emitted text pieces and leftover incomplete line.
 */
export function consumeSseBuffer(buffer: string): { pieces: string[]; rest: string } {
  const parts = buffer.split(/\r?\n/);
  const rest = parts.pop() ?? "";
  const pieces: string[] = [];
  for (const line of parts) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) continue;
    const payload = trimmed.slice(5).trimStart();
    const text = parseSseDataPayload(payload);
    if (text) pieces.push(text);
  }
  return { pieces, rest };
}

function formatHttpError(status: number, body: string): string {
  const trimmed = body.trim().slice(0, 200);
  if (status === 401 || status === 403) {
    return trimmed ? `鉴权失败（${status}）：${trimmed}` : `鉴权失败（${status}）`;
  }
  return trimmed ? `请求失败（${status}）：${trimmed}` : `请求失败（${status}）`;
}

function extractJsonContent(data: unknown): string {
  const record = data as {
    choices?: Array<{ message?: { content?: unknown } }>;
  } | null;
  const content = record?.choices?.[0]?.message?.content;
  return typeof content === "string" ? content : "";
}

async function chatCompletionsJson(
  input: StreamChatInput,
  signal: AbortSignal | undefined,
  fetchImpl: typeof fetch,
): Promise<StreamChatResult> {
  const res = await fetchImpl(chatCompletionsUrl(input.baseUrl), {
    method: "POST",
    headers: authHeaders(input.apiKey),
    signal,
    body: JSON.stringify({
      model: input.model.trim(),
      messages: input.messages,
      stream: false,
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { ok: false, message: formatHttpError(res.status, text) };
  }
  const data = await res.json().catch(() => null);
  return { ok: true, content: extractJsonContent(data), via: "json" };
}

/**
 * Stream OpenAI-compatible chat/completions. Falls back to non-stream JSON
 * when the server rejects streaming or returns a non-SSE body.
 */
export async function streamChatCompletions(
  input: StreamChatInput,
  handlers: StreamChatHandlers = {},
): Promise<StreamChatResult> {
  const base = normalizeBaseUrl(input.baseUrl);
  const apiKey = input.apiKey.trim();
  const model = input.model.trim();
  if (!base) return { ok: false, message: "请填写 Base URL" };
  if (!apiKey) return { ok: false, message: "请填写 API Key" };
  if (!model) return { ok: false, message: "请选择模型" };
  if (input.messages.length === 0) return { ok: false, message: "消息不能为空" };

  const fetchImpl = handlers.fetchImpl ?? fetch;
  const signal = handlers.signal;

  try {
    const res = await fetchImpl(chatCompletionsUrl(base), {
      method: "POST",
      headers: authHeaders(apiKey),
      signal,
      body: JSON.stringify({
        model,
        messages: input.messages,
        stream: true,
      }),
    });

    if (!res.ok) {
      // Some proxies reject stream=true — retry once without streaming.
      if (res.status === 400 || res.status === 422 || res.status === 404 || res.status === 405) {
        return chatCompletionsJson({ ...input, baseUrl: base, apiKey, model }, signal, fetchImpl);
      }
      const text = await res.text().catch(() => "");
      return { ok: false, message: formatHttpError(res.status, text) };
    }

    const contentType = res.headers.get("content-type") ?? "";
    if (!res.body || !contentType.includes("text/event-stream")) {
      // Non-SSE success body — parse as JSON completion.
      const data = await res.json().catch(() => null);
      if (data) {
        const content = extractJsonContent(data);
        if (content) handlers.onDelta?.(content);
        return { ok: true, content, via: "json" };
      }
      return chatCompletionsJson({ ...input, baseUrl: base, apiKey, model }, signal, fetchImpl);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let content = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const { pieces, rest } = consumeSseBuffer(buffer);
      buffer = rest;
      for (const piece of pieces) {
        content += piece;
        handlers.onDelta?.(piece);
      }
    }

    if (buffer.trim()) {
      const { pieces } = consumeSseBuffer(`${buffer}\n`);
      for (const piece of pieces) {
        content += piece;
        handlers.onDelta?.(piece);
      }
    }

    return { ok: true, content, via: "stream" };
  } catch (err) {
    if (signal?.aborted || (err instanceof DOMException && err.name === "AbortError")) {
      return { ok: false, message: "已停止", aborted: true };
    }
    return {
      ok: false,
      message: err instanceof Error ? err.message : "网络错误",
    };
  }
}
