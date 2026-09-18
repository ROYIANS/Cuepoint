import type { AgentRequestMessage, AgentResponseItem, AgentTokenUsage, AgentWireToolCall } from "@/domain/agent";
import type { StreamChatHandlers, StreamChatInput, StreamChatResult } from "@/lib/ai/chatStream";
import { authHeaders, normalizeBaseUrl } from "@/lib/ai/openaiCompatible";
import { assertReasoningEffort } from "@/lib/ai/reasoningPolicy";

export type ResponsesResult = StreamChatResult & { responseOutput?: AgentResponseItem[] };
const MAX_ENVELOPE_SIZE = 4_194_304;
function record(value: unknown): value is Record<string, unknown> { return !!value && typeof value === "object" && !Array.isArray(value); }
function text(value: unknown, max = MAX_ENVELOPE_SIZE): string {
  if (typeof value !== "string" || value.length > max) throw new Error("Responses 返回了无效或过大的字段");
  return value;
}
function id(value: unknown): string { const result = text(value, 256); if (!result) throw new Error("Responses 缺少调用标识"); return result; }
function usageOf(value: unknown): AgentTokenUsage | undefined {
  if (!record(value)) return;
  const usage: AgentTokenUsage = {};
  for (const [wire, name] of [["input_tokens", "inputTokens"], ["output_tokens", "outputTokens"], ["total_tokens", "totalTokens"]] as const) {
    const count = value[wire];
    if (typeof count === "number" && Number.isSafeInteger(count) && count >= 0) usage[name] = count;
  }
  return Object.keys(usage).length ? usage : undefined;
}

export function toResponseInput(messages: readonly AgentRequestMessage[]): AgentResponseItem[] {
  return messages.flatMap((message): AgentResponseItem[] => {
    if (message.role === "tool") return [{ type: "function_call_output", call_id: message.tool_call_id, output: message.content }];
    const items: AgentResponseItem[] = message.content ? [{ type: "message", role: message.role, content: message.content }] : [];
    if (message.role === "assistant") for (const call of message.tool_calls ?? []) items.push({ type: "function_call", call_id: call.id, name: call.function.name, arguments: call.function.arguments });
    return items;
  });
}

/** Final output is authoritative. Incomplete argument deltas never dispatch a tool. */
function decodeOutput(output: unknown, tools: StreamChatInput["tools"]): { items: AgentResponseItem[]; content: string; reasoning: string; calls: AgentWireToolCall[] } {
  if (!Array.isArray(output) || output.length > 256 || JSON.stringify(output).length > MAX_ENVELOPE_SIZE) throw new Error("Responses 输出信封无效或超过限制");
  let content = "", reasoning = "";
  const calls: AgentWireToolCall[] = [];
  const ids = new Set<string>();
  const items = output.map((item): AgentResponseItem => {
    if (!record(item)) throw new Error("Responses 输出项无效");
    if (item.status != null && item.status !== "completed") throw new Error("Responses 输出项尚未完成");
    const itemId = item.id === undefined ? undefined : id(item.id);
    if (itemId && ids.has(itemId)) throw new Error("Responses 输出标识重复");
    if (itemId) ids.add(itemId);
    if (item.type === "reasoning") {
      if (!Array.isArray(item.summary)) throw new Error("Responses 推理摘要格式无效");
      const summary = item.summary.map((part) => {
        if (!record(part) || part.type !== "summary_text") throw new Error("Responses 推理摘要格式无效");
        const value = text(part.text); reasoning += value;
        return { type: "summary_text" as const, text: value };
      });
      const encrypted = item.encrypted_content == null ? undefined : text(item.encrypted_content);
      // LobeHub drops id-only reasoning in stateless replay: it cannot be looked up.
      return { type: "reasoning", ...(encrypted && itemId ? { id: itemId } : {}), summary, ...(encrypted ? { encrypted_content: encrypted } : {}) };
    }
    if (item.type === "message") {
      if (item.role !== "assistant" || !Array.isArray(item.content)) throw new Error("Responses 回复格式无效");
      const parts = item.content.map((part) => {
        if (!record(part) || part.type !== "output_text") throw new Error("模型拒绝回复或返回了不支持的非文本内容");
        const value = text(part.text); content += value;
        return { type: "output_text" as const, text: value, annotations: [] };
      });
      return { type: "message", role: "assistant", content: parts, ...(itemId ? { id: itemId } : {}), status: "completed", ...(typeof item.phase === "string" ? { phase: text(item.phase, 64) } : {}) };
    }
    if (item.type === "function_call") {
      const callId = id(item.call_id), name = text(item.name, 128), args = text(item.arguments, 32768);
      if (calls.length >= 16 || calls.some((call) => call.id === callId) || !tools?.some((tool) => tool.function.name === name)) throw new Error("Responses 请求了重复、过多或未启用的工具");
      let parsed: unknown;
      try { parsed = JSON.parse(args); } catch { throw new Error("工具调用参数不是完整 JSON"); }
      if (!record(parsed)) throw new Error("工具参数必须是对象");
      calls.push({ id: callId, type: "function", function: { name, arguments: args } });
      return { type: "function_call", call_id: callId, name, arguments: args, ...(itemId ? { id: itemId } : {}), status: "completed" };
    }
    throw new Error("Responses 返回了未启用的输出类型");
  });
  return { items, content, reasoning, calls };
}

/** Stateless Responses adapter: one POST, local continuation, no automatic fallback. */
export async function streamResponses(input: StreamChatInput & { responseItems?: AgentResponseItem[] }, handlers: StreamChatHandlers = {}): Promise<ResponsesResult> {
  const base = normalizeBaseUrl(input.baseUrl), apiKey = input.apiKey.trim(), model = input.model.trim();
  const signal = handlers.signal;
  const startedAt = Date.now();
  let firstTokenAt: number | undefined, usage: AgentTokenUsage | undefined;
  let content = "", reasoning = "";
  const redact = (value: string) => value.split(apiKey || "\0").join("[已隐藏]").replace(/Bearer\s+[^\s"',;]+/gi, "Bearer [已隐藏]").slice(0, 300);
  const result = (value: ResponsesResult): ResponsesResult => ({ ...value, ...(usage ? { usage } : {}), metrics: { startedAt, endedAt: Date.now(), ...(firstTokenAt === undefined ? {} : { firstTokenAt }), ...(usage ? { usage } : {}) } });
  const emit = (kind: "content" | "reasoning", value: string, streaming = true) => {
    signal?.throwIfAborted();
    if (!value) return;
    if (streaming && firstTokenAt === undefined) firstTokenAt = Date.now();
    if (kind === "content") { content += value; handlers.onDelta?.(value); }
    else { reasoning += value; handlers.onReasoning?.(value); }
    signal?.throwIfAborted();
  };
  const finish = (response: unknown, via: "json" | "stream"): ResponsesResult => {
    if (!record(response)) throw new Error("Responses 缺少完整结果");
    usage = usageOf(response.usage) ?? usage;
    if (response.status !== "completed" || response.error != null) {
      const detail = record(response.error) && typeof response.error.message === "string" ? response.error.message : response.status === "incomplete" ? "回复达到限制或被过滤，内容未完成" : "Responses 执行失败或尚未完成";
      return result({ ok: false, message: redact(detail), finishReason: typeof response.status === "string" ? response.status : undefined });
    }
    const parsed = decodeOutput(response.output, input.tools);
    if (!parsed.content.startsWith(content) || !parsed.reasoning.startsWith(reasoning)) throw new Error("Responses 最终内容与流事件不一致");
    // A terminal envelope is a complete payload, not evidence of first-token
    // latency. Only actual delta events establish streaming throughput timing.
    emit("reasoning", parsed.reasoning.slice(reasoning.length), false);
    emit("content", parsed.content.slice(content.length), false);
    if (!parsed.calls.length && !parsed.content.trim()) throw new Error("模型未返回有效的回答内容");
    return result({ ok: true, content, reasoning, via, finishReason: parsed.calls.length ? "tool_calls" : "stop", ...(parsed.calls.length ? { toolCalls: parsed.calls } : {}), responseOutput: parsed.items });
  };
  try {
    signal?.throwIfAborted();
    if (!base || !apiKey || !model) throw new Error("请配置连接、API Key 和模型");
    if (!input.messages.length && !input.responseItems?.length) throw new Error("消息不能为空");
    if (input.connectorDefinitionId !== "openai-compatible" && input.connectorDefinitionId !== "aihubmix") throw new Error("当前连接尚未支持 Responses 协议");
    assertReasoningEffort({ definitionId: input.connectorDefinitionId, baseUrl: base }, model, input.reasoningEffort);
    const res = await (handlers.fetchImpl ?? fetch)(`${base}/responses`, {
      method: "POST", headers: authHeaders(apiKey), signal,
      body: JSON.stringify({ model, input: input.responseItems ?? toResponseInput(input.messages), stream: true, store: false, include: ["reasoning.encrypted_content"],
        ...(input.reasoningEffort !== undefined ? { reasoning: { effort: input.reasoningEffort, summary: "auto" } } : { reasoning: { summary: "auto" } }),
        ...(input.tools?.length ? { tools: input.tools.map((tool) => ({ type: "function", ...tool.function, strict: false })) } : {}),
      }),
    });
    if (signal?.aborted) { await res.body?.cancel().catch(() => undefined); signal.throwIfAborted(); }
    if (!res.ok) return result({ ok: false, message: `请求失败（${res.status}）：${redact(await res.text().catch(() => ""))}` });
    if (!(res.headers.get("content-type") ?? "").includes("text/event-stream")) return finish(await res.json(), "json");
    if (!res.body) throw new Error("Responses 返回了空的响应流");
    const reader = res.body.getReader(), decoder = new TextDecoder("utf-8", { fatal: true });
    let buffer = "", lines: string[] = [], eventName = "", terminal: ResponsesResult | undefined;
    const dispatch = () => {
      if (!lines.length && !eventName) return;
      const data = lines.join("\n"); lines = [];
      const name = eventName; eventName = "";
      if (!data || data.trim() === "[DONE]") return;
      const value: unknown = JSON.parse(data);
      if (!record(value) || typeof value.type !== "string") throw new Error("Responses 流事件无效");
      if (name && name !== value.type) throw new Error("Responses 流事件类型不一致");
      if (value.type === "error") throw new Error(typeof value.message === "string" ? value.message : "Responses 返回错误");
      if (["response.completed", "response.failed", "response.incomplete"].includes(value.type)) {
        if (!record(value.response) || value.type !== `response.${value.response.status}`) throw new Error("Responses 结束事件状态不一致");
        terminal = finish(value.response, "stream"); return;
      }
      if (value.type === "response.output_text.delta") emit("content", text(value.delta));
      if (value.type === "response.reasoning_summary_text.delta") emit("reasoning", text(value.delta));
      // Never render raw reasoning_text or encrypted_content. Tool argument
      // fragments are accepted only via the complete terminal output envelope.
      if (content.length + reasoning.length > MAX_ENVELOPE_SIZE) throw new Error("Responses 输出超过限制");
    };
    const consume = (eof = false) => {
      while (!terminal) {
        const match = /[\r\n]/.exec(buffer); if (!match) break;
        const at = match.index;
        if (!eof && buffer[at] === "\r" && at === buffer.length - 1) break;
        const size = buffer[at] === "\r" && buffer[at + 1] === "\n" ? 2 : 1;
        const line = buffer.slice(0, at); buffer = buffer.slice(at + size);
        if (!line) { dispatch(); continue; }
        if (line.startsWith(":")) continue;
        const colon = line.indexOf(":"); const field = colon < 0 ? line : line.slice(0, colon);
        const value = colon < 0 ? "" : line.slice(colon + 1).replace(/^ /, "");
        if (field === "data") lines.push(value);
        if (field === "event") eventName = value;
      }
    };
    const abort = () => { void reader.cancel().catch(() => undefined); };
    signal?.addEventListener("abort", abort, { once: true });
    try {
      while (!terminal) {
        signal?.throwIfAborted();
        const next = await reader.read(); signal?.throwIfAborted();
        buffer += next.done ? decoder.decode() : decoder.decode(next.value, { stream: true });
        if (buffer.length + lines.reduce((sum, line) => sum + line.length, 0) > MAX_ENVELOPE_SIZE) throw new Error("Responses 流事件超过限制");
        consume(next.done);
        if (next.done) break;
      }
      signal?.throwIfAborted();
      if (!terminal) throw new Error("Responses 回复流意外中断，已保留收到的内容");
      return terminal;
    } finally {
      signal?.removeEventListener("abort", abort); void reader.cancel().catch(() => undefined); reader.releaseLock();
    }
  } catch (error) {
    return result(signal?.aborted || (error instanceof DOMException && error.name === "AbortError") ? { ok: false, message: "已停止", aborted: true } : { ok: false, message: redact(error instanceof Error ? error.message : "Responses 请求失败") });
  }
}
