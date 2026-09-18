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
  | { ok: true; content: string; reasoning: string; via: "stream" | "json"; finishReason?: string }
  | { ok: false; message: string; aborted?: boolean; finishReason?: string };

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
    const { content, reasoning } = decodeCompletion(JSON.parse(trimmed), true).delta;
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

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function redactError(message: string, apiKey: string): string {
  // Redact before truncating, including provider errors that echo authorization.
  return message.split(apiKey).join("[已隐藏]")
    .replace(/Bearer\s+[^\s"',;]+/gi, "Bearer [已隐藏]").slice(0, 300);
}

function decodeCompletion(data: unknown, stream: boolean): {
  delta: StreamDelta;
  finishReason?: string;
} {
  if (!record(data)) throw new Error("模型返回了无效的响应格式");
  if (data.error != null) {
    const error = data.error;
    throw new Error(record(error) && typeof error.message === "string"
      ? error.message : typeof error === "string" ? error : "模型服务返回错误");
  }
  if (!Array.isArray(data.choices)) throw new Error("模型响应缺少 choices");
  if (stream && data.choices.length === 0 && record(data.usage)) return { delta: {} };
  const choice = data.choices[0];
  if (!record(choice)) throw new Error("模型响应缺少有效的回复");
  const source = stream ? (choice.delta ?? choice.message) : choice.message;
  if (!record(source)) throw new Error("模型回复格式无效");
  for (const name of ["content", "reasoning_content", "reasoning"]) {
    if (source[name] != null && typeof source[name] !== "string") {
      throw new Error("当前聊天仅支持文本回复");
    }
  }
  if ((Array.isArray(source.tool_calls) && source.tool_calls.length > 0) || source.function_call != null) {
    throw new Error("模型请求了工具调用，当前执行尚未启用工具能力");
  }
  const finishReason = choice.finish_reason;
  if (finishReason != null && (typeof finishReason !== "string" || !finishReason)) {
    throw new Error("模型返回了无效的结束状态");
  }
  return {
    delta: {
      ...(pickContentText(source) ? { content: pickContentText(source) } : {}),
      ...(pickReasoningText(source) ? { reasoning: pickReasoningText(source) } : {}),
    },
    ...(typeof finishReason === "string" ? { finishReason } : {}),
  };
}

function completionResult(
  content: string,
  reasoning: string,
  via: "stream" | "json",
  finishReason?: string,
): StreamChatResult {
  const metadata = finishReason ? { finishReason } : {};
  if (finishReason && finishReason !== "stop") {
    const message = finishReason === "length" ? "回复达到模型长度上限，内容未完成"
      : finishReason === "content_filter" ? "回复被模型内容过滤中断"
        : finishReason === "tool_calls" || finishReason === "function_call"
          ? "模型请求了工具调用，当前执行尚未启用工具能力"
          : "模型返回了未支持的结束状态";
    return { ok: false, message, ...metadata };
  }
  if (!content.trim()) return { ok: false, message: "模型未返回有效的回答内容", ...metadata };
  return { ok: true, content, reasoning, via, ...metadata };
}

function applyDeltaHandlers(
  handlers: StreamChatHandlers,
  delta: StreamDelta,
  acc: { content: string; reasoning: string },
): void {
  handlers.signal?.throwIfAborted();
  if (delta.reasoning) {
    acc.reasoning += delta.reasoning;
    handlers.onReasoning?.(delta.reasoning);
  }
  handlers.signal?.throwIfAborted();
  if (delta.content) {
    acc.content += delta.content;
    handlers.onDelta?.(delta.content);
  }
}

/** One POST per attempt. A JSON response to that same request is supported. */
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
    signal?.throwIfAborted();
    const res = await fetchImpl(chatCompletionsUrl(base), {
      method: "POST",
      headers: authHeaders(apiKey),
      signal,
      body: JSON.stringify({ model, messages: input.messages, stream: true }),
    });
    signal?.throwIfAborted();
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      signal?.throwIfAborted();
      return { ok: false, message: formatHttpError(res.status, redactError(body, apiKey)) };
    }

    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().includes("text/event-stream")) {
      const data: unknown = await res.json().catch(() => null);
      signal?.throwIfAborted();
      const { delta, finishReason } = decodeCompletion(data, false);
      const acc = { content: "", reasoning: "" };
      applyDeltaHandlers(handlers, delta, acc);
      signal?.throwIfAborted();
      return completionResult(acc.content, acc.reasoning, "json", finishReason ? redactError(finishReason, apiKey) : undefined);
    }
    if (!res.body) throw new Error("模型返回了空的响应流");

    const reader = res.body.getReader();
    const decoder = new TextDecoder("utf-8", { fatal: true });
    let buffer = "";
    let eventData: string[] = [];
    let eventType = "";
    let completed = false;
    let finishReason: string | undefined;
    const acc = { content: "", reasoning: "" };
    const dispatchEvent = () => {
      if (eventData.length === 0 && eventType !== "error") { eventType = ""; return; }
      const data = eventData.join("\n");
      eventData = [];
      const type = eventType;
      eventType = "";
      if (type === "error") {
        let detail = data;
        try {
          const value: unknown = JSON.parse(data);
          if (record(value)) {
            const error = record(value.error) ? value.error : value;
            if (typeof error.message === "string") detail = error.message;
          }
        } catch { /* Some providers use plain-text error events. */ }
        throw new Error(detail || "模型服务返回错误");
      }
      if (data.trim() === "[DONE]") { completed = true; return; }
      let value: unknown;
      try { value = JSON.parse(data); } catch { throw new Error("模型返回了无效的流事件"); }
      const frame = decodeCompletion(value, true);
      if (finishReason && (frame.delta.content || frame.delta.reasoning || frame.finishReason)) {
        throw new Error("模型在结束状态后继续返回内容");
      }
      applyDeltaHandlers(handlers, frame.delta, acc);
      if (frame.finishReason) finishReason = redactError(frame.finishReason, apiKey);
    };
    const consumeLine = (line: string) => {
      if (line === "") { dispatchEvent(); return; }
      if (line.startsWith(":")) return;
      const colon = line.indexOf(":");
      const field = colon < 0 ? line : line.slice(0, colon);
      const value = colon < 0 ? "" : line.slice(colon + 1).replace(/^ /, "");
      if (field === "data") eventData.push(value);
      if (field === "event") eventType = value;
    };
    const consumeBuffer = (eof = false) => {
      // Preserve a trailing CR between reads so a split CRLF remains one newline.
      while (!completed) {
        const match = /[\r\n]/.exec(buffer);
        if (!match) break;
        const index = match.index;
        if (!eof && buffer[index] === "\r" && index === buffer.length - 1) break;
        const length = buffer[index] === "\r" && buffer[index + 1] === "\n" ? 2 : 1;
        const line = buffer.slice(0, index);
        buffer = buffer.slice(index + length);
        signal?.throwIfAborted();
        consumeLine(line);
      }
    };
    const onAbort = () => { void reader.cancel().catch(() => undefined); };
    signal?.addEventListener("abort", onAbort, { once: true });
    try {
      while (!completed) {
        signal?.throwIfAborted();
        const { done, value } = await reader.read();
        signal?.throwIfAborted();
        buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
        consumeBuffer(done);
        if (done) break;
      }
      signal?.throwIfAborted();
      // Undelimited trailing events cannot certify completion; SSE dispatch requires a blank line.
      if (!completed && (buffer.trim() || eventData.length || eventType)) {
        throw new Error("回复流意外中断，已保留收到的内容");
      }
      if (!completed && !finishReason) throw new Error("回复流意外中断，已保留收到的内容");
      return completionResult(acc.content, acc.reasoning, "stream", finishReason);
    } finally {
      signal?.removeEventListener("abort", onAbort);
      void reader.cancel().catch(() => undefined);
      reader.releaseLock();
    }
  } catch (err) {
    if (signal?.aborted || (err instanceof DOMException && err.name === "AbortError")) {
      return { ok: false, message: "已停止", aborted: true };
    }
    return { ok: false, message: redactError(err instanceof Error ? err.message : "网络错误", apiKey) };
  }
}
