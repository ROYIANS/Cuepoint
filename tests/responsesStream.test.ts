import { describe, expect, it, vi } from "vitest";
import { streamResponses, toResponseInput } from "@/lib/ai/responsesStream";
import { beginAgentRun, finishAgentRun } from "@/db/agentRuns";
import { appendToolResults, resolveAgentToolApproval } from "@/db/agentTools";
import { createChatThread } from "@/db/repo";
import { db } from "@/db/database";
import { executeChatRun, resumeChatRun } from "@/lib/agent/runChat";
import { BUILTIN_TOOLS, toolSchemas, type AgentToolDefinition } from "@/lib/agent/tools";
import { selectAgentProtocol } from "@/lib/ai/reasoningPolicy";
import type { ConnectorConfig } from "@/domain/types";
const connector: ConnectorConfig = { id: "cx", name: "test", definitionId: "openai-compatible", baseUrl: "https://example.test/v1", apiKey: "secret", updatedAt: "2026-09-18" };
const input = { baseUrl: connector.baseUrl, apiKey: connector.apiKey, connectorDefinitionId: connector.definitionId, model: "gpt-5.6-luna", messages: [{ role: "user" as const, content: "hi" }], tools: toolSchemas(["workspace_overview"], BUILTIN_TOOLS) };
const message = { type: "message", id: "msg-1", role: "assistant", status: "completed", content: [{ type: "output_text", text: "完成", annotations: [] }] };
const reasoning = { type: "reasoning", id: "rs-1", summary: [{ type: "summary_text", text: "先检查" }], encrypted_content: "opaque-provider-state" };
const call = { type: "function_call", id: "fc-1", call_id: "call-1", name: "workspace_overview", arguments: "{}", status: "completed" };
const response = (output: unknown[] = [message]) => ({ id: "resp-1", status: "completed", output, usage: { input_tokens: 5, output_tokens: 3, total_tokens: 8 } });
const sse = (events: unknown[]) => events.map((event) => `data: ${JSON.stringify(event)}\r\n\r\n`).join("");

describe("Responses transport", () => {
  it("maps tools, effort and messages once without chat-only fields", async () => {
    const fetcher = vi.fn(async (url, init) => {
      expect(url).toBe("https://example.test/v1/responses");
      expect(JSON.parse(String(init?.body))).toMatchObject({ store: false, stream: true, input: [{ type: "message", role: "user", content: "hi" }], tools: [{ type: "function", name: "workspace_overview", strict: false }], reasoning: { effort: "high", summary: "auto" }, include: ["reasoning.encrypted_content"] });
      expect(String(init?.body)).not.toContain("reasoning_effort");
      return Response.json(response([reasoning, call]));
    });
    const delta = vi.fn();
    const result = await streamResponses({ ...input, reasoningEffort: "high" }, { fetchImpl: fetcher, onReasoning: delta });
    expect(result).toMatchObject({ ok: true, finishReason: "tool_calls", toolCalls: [{ id: "call-1" }], usage: { inputTokens: 5, outputTokens: 3, totalTokens: 8 }, responseOutput: [reasoning, call] });
    expect(delta).toHaveBeenCalledWith("先检查");
    expect(JSON.stringify(delta.mock.calls)).not.toContain("opaque-provider-state");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("streams split UTF-8 and CRLF, ignores raw reasoning, completes only on final envelope", async () => {
    const bytes = new TextEncoder().encode(sse([
      { type: "response.reasoning_text.delta", delta: "private raw thought" },
      { type: "response.reasoning_summary_text.delta", delta: "先检查" },
      { type: "response.output_text.delta", delta: "完" },
      { type: "response.output_text.delta", delta: "成" },
      { type: "response.completed", response: response([reasoning, message]) },
    ]));
    let index = 0;
    const stream = new ReadableStream({ pull(controller) { if (index === bytes.length) controller.close(); else controller.enqueue(bytes.slice(index, ++index)); } });
    const text = vi.fn(), summary = vi.fn();
    const result = await streamResponses(input, { fetchImpl: vi.fn(async () => new Response(stream, { headers: { "Content-Type": "text/event-stream" } })), onDelta: text, onReasoning: summary });
    expect(result).toMatchObject({ ok: true, content: "完成", reasoning: "先检查" });
    expect(text.mock.calls.flat().join("")).toBe("完成");
    expect(summary.mock.calls.flat().join("")).toBe("先检查");
    expect(result.metrics?.firstTokenAt).toBeTypeOf("number");
  });
  it("does not dispatch incomplete, invalid, foreign or duplicate tools", async () => {
    for (const output of [[{ ...call, name: "delete_project" }], [call, { ...call, id: "fc-2" }], [{ ...call, arguments: "{" }], [{ ...call, arguments: "[]" }], [{ ...call, status: "in_progress" }], [{ type: "web_search_call", id: "web-1" }]]) {
      const result = await streamResponses(input, { fetchImpl: vi.fn(async () => Response.json(response(output))) });
      expect(result.ok).toBe(false);
      expect(result).not.toHaveProperty("toolCalls");
    }
    const truncated = await streamResponses(input, { fetchImpl: vi.fn(async () => new Response(sse([{ type: "response.function_call_arguments.delta", delta: "{}" }, { type: "response.output_item.done", item: call }]) + "data: [DONE]\n\n", { headers: { "Content-Type": "text/event-stream" } })) });
    expect(truncated.ok).toBe(false);
  });
  it("fails incomplete/failed response and HTTP without fallback, keeps real usage and redacts errors", async () => {
    for (const status of ["failed", "incomplete", "in_progress"]) {
      const result = await streamResponses(input, { fetchImpl: vi.fn(async () => Response.json({ ...response([call]), status })) });
      expect(result.ok).toBe(false);
      expect(result.usage?.totalTokens).toBe(8);
      expect(result).not.toHaveProperty("toolCalls");
    }
    const fetcher = vi.fn(async () => new Response("secret denied", { status: 400 }));
    const result = await streamResponses(input, { fetchImpl: fetcher });
    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).not.toContain("secret");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("stops pending reads and never executes after cancellation", async () => {
    const controller = new AbortController();
    const cancel = vi.fn();
    const stream = new ReadableStream({ pull() { controller.abort(); }, cancel }, { highWaterMark: 0 });
    const result = await streamResponses(input, { signal: controller.signal, fetchImpl: vi.fn(async () => new Response(stream, { headers: { "Content-Type": "text/event-stream" } })) });
    expect(result).toMatchObject({ ok: false, aborted: true });
    expect(cancel).toHaveBeenCalled();
  });
  it("requires consistent terminal status and authoritative streamed content", async () => {
    for (const events of [
      [{ type: "response.completed", response: { ...response([call]), status: "incomplete" } }],
      [{ type: "response.output_text.delta", delta: "different" }, { type: "response.completed", response: response([call]) }],
      [{ type: "response.failed", response: { ...response([call]), status: "failed" } }],
      [{ type: "response.incomplete", response: { ...response([call]), status: "incomplete" } }],
    ]) {
      const result = await streamResponses(input, { fetchImpl: vi.fn(async () => new Response(sse(events), { headers: { "Content-Type": "text/event-stream" } })) });
      expect(result.ok).toBe(false);
      expect(result).not.toHaveProperty("toolCalls");
    }
    const result = await streamResponses(input, { fetchImpl: vi.fn(async () => new Response(sse([{ type: "response.completed", response: response([reasoning, call]) }]), { headers: { "Content-Type": "text/event-stream" } })) });
    expect(result).toMatchObject({ ok: true, toolCalls: [{ id: "call-1" }] });
    expect(result.metrics).not.toHaveProperty("firstTokenAt");
    const terminalAnswer = await streamResponses(input, { fetchImpl: vi.fn(async () => new Response(sse([{ type: "response.completed", response: response() }]), { headers: { "Content-Type": "text/event-stream" } })) });
    expect(terminalAnswer).toMatchObject({ ok: true, content: "完成" });
    expect(terminalAnswer.metrics).not.toHaveProperty("firstTokenAt");
  });
  it("converts wire calls/results and strips id-only reasoning during stateless replay", async () => {
    expect(toResponseInput([{ role: "assistant", content: "", tool_calls: [{ id: "c", type: "function", function: { name: "f", arguments: "{}" } }] }, { role: "tool", tool_call_id: "c", content: "ok" }])).toEqual([{ type: "function_call", call_id: "c", name: "f", arguments: "{}" }, { type: "function_call_output", call_id: "c", output: "ok" }]);
    const result = await streamResponses(input, { fetchImpl: vi.fn(async () => Response.json(response([{ type: "reasoning", id: "not-stored", summary: [] }, message]))) });
    expect(result.responseOutput?.[0]).toEqual({ type: "reasoning", summary: [] });
  });
});

describe("durable Responses tool loop", () => {
  it("selects before request, migrates legacy text retries but freezes explicit protocols", async () => {
    expect(selectAgentProtocol(connector, "gpt-5.6-luna", undefined, true)).toBe("responses");
    expect(selectAgentProtocol(connector, "gpt-5.6-luna", "none", true)).toBe("chat-completions");
    expect(selectAgentProtocol(connector, "gpt-5.6-luna", "high", false)).toBe("chat-completions");
    expect(selectAgentProtocol({ ...connector, definitionId: "aihubmix" }, "gpt-5.6-luna", "high", true)).toBe("responses");
    const thread = await createChatThread();
    const run = await beginAgentRun({ threadId: thread.id, connector, model: input.model, content: "hi" });
    expect(run.protocol).toBe("responses");
    await finishAgentRun(run.id, "failed", { content: "" });
    await db.agentRuns.update(run.id, { protocol: undefined });
    const retry = await beginAgentRun({ threadId: thread.id, connector, model: input.model, retryOfRunId: run.id });
    expect(retry.protocol).toBe("responses");
    await finishAgentRun(retry.id, "failed", { content: "" });
    await db.agentRuns.update(retry.id, { protocol: "chat-completions" });
    const frozen = await beginAgentRun({ threadId: thread.id, connector, model: input.model, retryOfRunId: retry.id });
    expect(frozen.protocol).toBe("chat-completions");
  });
  it("atomically saves encrypted envelope before approval, resumes once with paired outputs", async () => {
    const thread = await createChatThread();
    const run = await beginAgentRun({ threadId: thread.id, connector, model: input.model, content: "hi", reasoningEffort: "high" });
    const tool: AgentToolDefinition = { ...BUILTIN_TOOLS[0], effect: "write", execute: vi.fn(async () => ({ changed: true })) };
    const bodies: Array<{input: unknown[]}> = [];
    const fetcher = vi.fn(async (url, init) => { expect(String(url)).toContain("/responses"); bodies.push(JSON.parse(String(init?.body))); return Response.json(response(bodies.length === 1 ? [reasoning, call] : [message])); });
    await executeChatRun(run, connector.apiKey, new AbortController(), fetcher, [tool, BUILTIN_TOOLS[1]]);
    expect(tool.execute).not.toHaveBeenCalled();
    const saved = (await db.agentRuns.get(run.id))!;
    expect(saved.status).toBe("waiting_approval");
    expect(saved.responseItems?.slice(-2)).toEqual([reasoning, call]);
    expect((await db.chatMessages.get(run.assistantMessageId))?.reasoning).not.toContain("opaque");
    const ledger = (await db.agentToolCalls.toArray())[0];
    await resolveAgentToolApproval(run.id, ledger.id, "approve");
    await resumeChatRun(run.id, connector.apiKey, new AbortController(), fetcher, [tool, BUILTIN_TOOLS[1]]);
    expect(tool.execute).toHaveBeenCalledTimes(1);
    expect(bodies[1].input.slice(-3)).toEqual([reasoning, call, { type: "function_call_output", call_id: "call-1", output: '{"changed":true}' }]);
    expect((await db.agentRuns.get(run.id))?.usage?.totalTokens).toBe(16);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("does not replay a completed tool if the next response failed, and refuses missing envelopes", async () => {
    const thread = await createChatThread();
    const run = await beginAgentRun({ threadId: thread.id, connector, model: input.model, content: "hi" });
    const tool: AgentToolDefinition = { ...BUILTIN_TOOLS[0], execute: vi.fn(async () => ({ ok: true })) };
    let count = 0;
    await executeChatRun(run, connector.apiKey, new AbortController(), vi.fn(async () => ++count === 1 ? Response.json(response([reasoning, call])) : new Response("offline", { status: 500 })), [tool, BUILTIN_TOOLS[1]]);
    expect((await db.agentRuns.get(run.id))?.status).toBe("failed");
    await resumeChatRun(run.id, connector.apiKey, new AbortController(), vi.fn(async (_url, init) => {
      const request = JSON.parse(String(init?.body));
      expect(request.input.filter((item: {type:string}) => item.type === "function_call_output")).toHaveLength(1);
      return Response.json(response());
    }), [tool, BUILTIN_TOOLS[1]]);
    expect(tool.execute).toHaveBeenCalledTimes(1);
    await db.agentRuns.update(run.id, { status: "running", responseItems: undefined });
    await expect(appendToolResults(run.id)).rejects.toThrow("信封");
  });
  it("continues a rejected call with a durable result without performing its edit", async () => {
    const thread = await createChatThread();
    const run = await beginAgentRun({ threadId: thread.id, connector, model: input.model, content: "hi" });
    const tool: AgentToolDefinition = { ...BUILTIN_TOOLS[0], effect: "write", execute: vi.fn() };
    await executeChatRun(run, connector.apiKey, new AbortController(), vi.fn(async () => Response.json(response([reasoning, call]))), [tool, BUILTIN_TOOLS[1]]);
    const ledger = (await db.agentToolCalls.where("runId").equals(run.id).toArray())[0];
    await resolveAgentToolApproval(run.id, ledger.id, "reject");
    await resumeChatRun(run.id, connector.apiKey, new AbortController(), vi.fn(async (_url, init) => {
      const body = JSON.parse(String(init?.body));
      const outputs = body.input.filter((item: {type:string}) => item.type === "function_call_output");
      expect(outputs).toHaveLength(1);
      expect(outputs[0]).toMatchObject({ call_id: "call-1" });
      expect(outputs[0].output).toContain("用户拒绝");
      return Response.json(response());
    }), [tool, BUILTIN_TOOLS[1]]);
    expect(tool.execute).not.toHaveBeenCalled();
    expect((await db.agentRuns.get(run.id))?.status).toBe("completed");
  });
  it("refuses side effects before replay when the saved envelope no longer matches", async () => {
    const thread = await createChatThread();
    const run = await beginAgentRun({ threadId: thread.id, connector, model: input.model, content: "hi" });
    const tool: AgentToolDefinition = { ...BUILTIN_TOOLS[0], effect: "write", execute: vi.fn() };
    await executeChatRun(run, connector.apiKey, new AbortController(), vi.fn(async () => Response.json(response([reasoning, call]))), [tool, BUILTIN_TOOLS[1]]);
    const ledger = (await db.agentToolCalls.where("runId").equals(run.id).toArray())[0];
    await resolveAgentToolApproval(run.id, ledger.id, "approve");
    await db.agentRuns.update(run.id, { responseItems: undefined });
    const fetcher = vi.fn();
    await resumeChatRun(run.id, connector.apiKey, new AbortController(), fetcher, [tool, BUILTIN_TOOLS[1]]);
    expect(tool.execute).not.toHaveBeenCalled();
    expect(fetcher).not.toHaveBeenCalled();
    expect((await db.agentRuns.get(run.id))?.error).toContain("信封");
  });
});
