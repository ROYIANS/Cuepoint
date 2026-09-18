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

/** One SSE/JSON chunk may carry answer text, reasoning text, or both. */
export type StreamDelta = {
  content?: string;
  reasoning?: string;
};

export type StreamChatHandlers = {
  onDelta?: (text: string) => void;
  onReasoning?: (text: string) => void;
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
};

export type StreamChatResult =
  | { ok: true; content: string; reasoning: string; via: "stream" | "json" }
  | { ok: false; message: string; aborted?: boolean };

/**
 * Accumulate reasoning/content deltas and close reasoning on first answer token
 * (LobeHub lifecycle without an operation store).
 */
export type ReasoningAccum = {
  content: string;
  reasoning: string;
  reasoningActive: boolean;
  reasoningStartedAt: number | null;
  reasoningDurationMs?: number;
};

export function createReasoningAccum(): ReasoningAccum {
  return {
    content: "",
    reasoning: "",
    reasoningActive: false,
    reasoningStartedAt: null,
  };
}

export function accumulateStreamDelta(
  state: ReasoningAccum,
  delta: StreamDelta,
  nowMs: number,
): ReasoningAccum {
  let content = state.content;
  let reasoning = state.reasoning;
  let reasoningActive = state.reasoningActive;
  let reasoningStartedAt = state.reasoningStartedAt;
  let reasoningDurationMs = state.reasoningDurationMs;

  if (delta.reasoning) {
    if (reasoningStartedAt == null) {
      reasoningStartedAt = nowMs;
    }
    reasoning += delta.reasoning;
    if (!content) reasoningActive = true;
  }

  if (delta.content) {
    if (reasoningActive && reasoningStartedAt != null && reasoningDurationMs == null) {
      reasoningDurationMs = Math.max(0, nowMs - reasoningStartedAt);
      reasoningActive = false;
    }
    content += delta.content;
  }

  return {
    content,
    reasoning,
    reasoningActive,
    reasoningStartedAt,
    reasoningDurationMs,
  };
}

/** End reasoning on abort/complete so the panel can collapse. */
export function finalizeReasoningAccum(
  state: ReasoningAccum,
  nowMs: number,
): ReasoningAccum {
  if (!state.reasoningActive) return state;
  const started = state.reasoningStartedAt;
  return {
    ...state,
    reasoningActive: false,
    reasoningDurationMs:
      state.reasoningDurationMs ??
      (started != null ? Math.max(0, nowMs - started) : undefined),
  };
}

function pickReasoningText(source: { reasoning_content?: unknown; reasoning?: unknown } | undefined): string | undefined {
  if (!source) return undefined;
  if (typeof source.reasoning_content === "string" && source.reasoning_content.length > 0) {
    return source.reasoning_content;
  }
  if (typeof source.reasoning === "string" && source.reasoning.length > 0) {
    return source.reasoning;
  }
  return undefined;
}

function pickContentText(source: { content?: unknown } | undefined): string | undefined {
  if (typeof source?.content === "string" && source.content.length > 0) {
    return source.content;
  }
  return undefined;
}

/**
 * Extract assistant content/reasoning from one SSE `data:` JSON payload.
 * Returns null for keep-alives / role-only / incomplete chunks.
 */
export function parseSseDataPayload(data: string): StreamDelta | null {
  const trimmed = data.trim();
  if (!trimmed || trimmed === "[DONE]") return null;
  try {
    const json = JSON.parse(trimmed) as {
      choices?: Array<{
        delta?: { content?: unknown; reasoning_content?: unknown; reasoning?: unknown };
        message?: { content?: unknown; reasoning_content?: unknown; reasoning?: unknown };
      }>;
    };
    const choice = json.choices?.[0];
    const delta = choice?.delta;
    const message = choice?.message;

    const content = pickContentText(delta) ?? pickContentText(message);
    const reasoning = pickReasoningText(delta) ?? pickReasoningText(message);

    if (!content && !reasoning) return null;
    const out: StreamDelta = {};
    if (content) out.content = content;
    if (reasoning) out.reasoning = reasoning;
    return out;
  } catch {
    return null;
  }
}

/**
 * Parse an SSE buffer chunk; returns emitted deltas and leftover incomplete line.
 */
export function consumeSseBuffer(buffer: string): { chunks: StreamDelta[]; rest: string } {
  const parts = buffer.split(/\r?\n/);
  const rest = parts.pop() ?? "";
  const chunks: StreamDelta[] = [];
  for (const line of parts) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) continue;
    const payload = trimmed.slice(5).trimStart();
    const delta = parseSseDataPayload(payload);
    if (delta) chunks.push(delta);
  }
  return { chunks, rest };
}

function formatHttpError(status: number, body: string): string {
  const trimmed = body.trim().slice(0, 200);
  if (status === 401 || status === 403) {
    return trimmed ? `鉴权失败（${status}）：${trimmed}` : `鉴权失败（${status}）`;
  }
  return trimmed ? `请求失败（${status}）：${trimmed}` : `请求失败（${status}）`;
}

function extractJsonCompletion(data: unknown): { content: string; reasoning: string } {
  const record = data as {
    choices?: Array<{
      message?: {
        content?: unknown;
        reasoning_content?: unknown;
        reasoning?: unknown;
      };
    }>;
  } | null;
  const message = record?.choices?.[0]?.message;
  const content = pickContentText(message) ?? "";
  const reasoning = pickReasoningText(message) ?? "";
  return { content, reasoning };
}

function emitCompletion(
  handlers: StreamChatHandlers,
  content: string,
  reasoning: string,
): void {
  if (reasoning) handlers.onReasoning?.(reasoning);
  if (content) handlers.onDelta?.(content);
}

async function chatCompletionsJson(
  input: StreamChatInput,
  signal: AbortSignal | undefined,
  fetchImpl: typeof fetch,
  handlers: StreamChatHandlers = {},
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
  const { content, reasoning } = extractJsonCompletion(data);
  emitCompletion(handlers, content, reasoning);
  return { ok: true, content, reasoning, via: "json" };
}

function applyDeltaHandlers(
  handlers: StreamChatHandlers,
  delta: StreamDelta,
  acc: { content: string; reasoning: string },
): void {
  if (delta.reasoning) {
    acc.reasoning += delta.reasoning;
    handlers.onReasoning?.(delta.reasoning);
  }
  if (delta.content) {
    acc.content += delta.content;
    handlers.onDelta?.(delta.content);
  }
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
        return chatCompletionsJson(
          { ...input, baseUrl: base, apiKey, model },
          signal,
          fetchImpl,
          handlers,
        );
      }
      const text = await res.text().catch(() => "");
      return { ok: false, message: formatHttpError(res.status, text) };
    }

    const contentType = res.headers.get("content-type") ?? "";
    if (!res.body || !contentType.includes("text/event-stream")) {
      // Non-SSE success body — parse as JSON completion.
      const data = await res.json().catch(() => null);
      if (data) {
        const { content, reasoning } = extractJsonCompletion(data);
        emitCompletion(handlers, content, reasoning);
        return { ok: true, content, reasoning, via: "json" };
      }
      return chatCompletionsJson(
        { ...input, baseUrl: base, apiKey, model },
        signal,
        fetchImpl,
        handlers,
      );
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    const acc = { content: "", reasoning: "" };

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const { chunks, rest } = consumeSseBuffer(buffer);
      buffer = rest;
      for (const chunk of chunks) {
        applyDeltaHandlers(handlers, chunk, acc);
      }
    }

    if (buffer.trim()) {
      const { chunks } = consumeSseBuffer(`${buffer}\n`);
      for (const chunk of chunks) {
        applyDeltaHandlers(handlers, chunk, acc);
      }
    }

    return { ok: true, content: acc.content, reasoning: acc.reasoning, via: "stream" };
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
