import { afterEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db/database";
import { createChatThread } from "@/db/repo";
import { beginAgentRun } from "@/db/agentRuns";
import { saveAgentFinishingCheck } from "@/db/agentFinishingCheck";
import * as finishing from "@/db/agentFinishingCheck";
import { executeChatRun, resumeChatRun } from "@/lib/agent/runChat";
import { buildRunActivity } from "@/lib/agent/runPresentation";
import { toResponseInput } from "@/lib/ai/responsesStream";
import { buildContextMessages } from "@/lib/agent/contextPlanner";
import { prepareRunContext } from "@/lib/agent/contextCompaction";
import type { ContextSource } from "@/domain/context";
import { BUILTIN_TOOLS } from "@/lib/agent/tools";
import type { AgentPlanItem, AgentResponseItem, AgentRun, AgentToolCall, AgentWireToolCall } from "@/domain/agent";
import type { ConnectorConfig } from "@/domain/types";

const connector: ConnectorConfig = { id: "local", definitionId: "openai-compatible", baseUrl: "https://model.test/v1", apiKey: "test-secret", updatedAt: "2026-09-22" };
const plan: AgentPlanItem[] = [{ id: "create", title: "创建项目", status: "in_progress" }];
const candidate = { content: "下一步我会创建项目。", reasoning: "计划尚未完成", reasoningDurationMs: 12 };
const messageOutput: AgentResponseItem[] = [
  { type: "reasoning", id: "reason", summary: [{ type: "summary_text", text: candidate.reasoning }], encrypted_content: "opaque-provider-reasoning" },
  { type: "message", id: "msg", role: "assistant", status: "completed", content: [{ type: "output_text", text: candidate.content, annotations: [] }] },
];
const wire = (name: string, args: unknown, id = name): AgentWireToolCall => ({ id, type: "function", function: { name, arguments: JSON.stringify(args) } });
function reply(protocol: AgentRun["protocol"], content: string, calls: AgentWireToolCall[] = [], reasoning = "") {
  return protocol === "responses" ? Response.json({ id: "reply", status: "completed", output: [
    ...(reasoning ? [{ type: "reasoning", id: "reason", summary: [{ type: "summary_text", text: reasoning }], encrypted_content: "opaque-provider-reasoning" }] : []),
    ...(content ? [{ type: "message", role: "assistant", status: "completed", content: [{ type: "output_text", text: content, annotations: [] }] }] : []),
    ...calls.map(call => ({ type: "function_call", call_id: call.id, name: call.function.name, arguments: call.function.arguments, status: "completed" })),
  ] }) : Response.json({ choices: [{ message: { content, reasoning_content: reasoning, ...(calls.length ? { tool_calls: calls } : {}) }, finish_reason: calls.length ? "tool_calls" : "stop" }] });
}
async function begin(protocol: AgentRun["protocol"] = "chat-completions", patch: Partial<AgentRun> = {}) {
  const thread = await createChatThread();
  const initial = await beginAgentRun({ threadId: thread.id, connector, model: protocol === "responses" ? "gpt-5.6-luna" : "fixture", content: "创建一个项目并保存" });
  expect(initial.protocol).toBe(protocol);
  const run: AgentRun = { ...initial, permissionMode: "full", enabledToolNames: ["update_run_plan", "project_create", "workspace_overview"], toolLoading: undefined, ...patch };
  await db.agentRuns.put(run);
  return run;
}
async function eligible(protocol: AgentRun["protocol"] = "chat-completions") {
  const run = await begin(protocol, { modelStep: 2, hasToolCalls: true, plan });
  const call: AgentToolCall = { id: "plan-call", providerCallId: "plan-wire", runId: run.id, threadId: run.threadId, step: 1, order: 0, name: "update_run_plan", title: "更新执行计划", effect: "bookkeeping", atomic: true, highRisk: false, arguments: JSON.stringify({ steps: plan }), result: JSON.stringify({ plan }), status: "completed", createdAt: run.createdAt, updatedAt: run.createdAt };
  await db.agentToolCalls.add(call);
  const messages = [...run.requestMessages, { role: "assistant" as const, content: "制定计划", tool_calls: [wire("update_run_plan", { steps: plan }, "plan-wire")] }, { role: "tool" as const, tool_call_id: "plan-wire", content: call.result! }];
  await db.agentRuns.update(run.id, { continuationMessages: messages, ...(protocol === "responses" ? { responseItems: toResponseInput(messages) } : {}) });
  return { run: (await db.agentRuns.get(run.id))!, call };
}
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("bounded unfinished-plan finishing checkpoint", () => {
  it.each(["chat-completions", "responses"] as const)("continues plan → premature text → real write → final once with %s", async protocol => {
    const run = await begin(protocol), initial = structuredClone(run.requestMessages);
    let count = 0;
    const fetchImpl = vi.fn<typeof fetch>(async (_url, init) => {
      count++;
      const request = String(init?.body);
      if (count === 1) return reply(protocol, "先保存计划", [wire("update_run_plan", { steps: plan })]);
      if (count === 2) return reply(protocol, candidate.content, [], candidate.reasoning);
      if (count === 3) {
        expect(request).toContain("本轮结束前检查");
        expect(request).toContain(candidate.content);
        if (protocol === "responses") expect(request).toContain("opaque-provider-reasoning");
        return reply(protocol, "现在创建", [wire("project_create", { name: "真实项目", continueInProject: false })]);
      }
      return reply(protocol, "项目已创建；其他计划事项尚未继续。");
    });
    await executeChatRun(run, connector.apiKey, new AbortController(), fetchImpl);
    const saved = (await db.agentRuns.get(run.id))!;
    expect(saved.status, saved.error).toBe("completed");
    expect(fetchImpl).toHaveBeenCalledTimes(4);
    expect(saved.finishingCheck).toMatchObject({ step: 2 });
    expect(saved.plan).toEqual(plan);
    expect(saved.requestMessages).toEqual(initial);
    expect(await db.projects.count()).toBe(1);
    const calls = await db.agentToolCalls.where("runId").equals(run.id).sortBy("step");
    expect(calls.map(call => call.name)).toEqual(["update_run_plan", "project_create"]);
    expect(calls.every(call => call.status === "completed")).toBe(true);
    expect(saved.activitySteps).toContainEqual(expect.objectContaining({ step: 2, content: candidate.content, reasoning: candidate.reasoning }));
    const activity = buildRunActivity(saved, calls);
    expect(JSON.stringify(activity)).toContain(candidate.content);
    expect(JSON.stringify(activity)).not.toContain("opaque-provider-reasoning");
    expect((await db.chatMessages.get(run.assistantMessageId))?.content).toBe("项目已创建；其他计划事项尚未继续。");
  });

  it.each(["chat-completions", "responses"] as const)("allows a second plain answer to finish an advice plan under %s", async protocol => {
    const run = await begin(protocol);
    let count = 0;
    const fetchImpl = vi.fn<typeof fetch>(async () => ++count === 1 ? reply(protocol, "", [wire("update_run_plan", { steps: plan })]) : reply(protocol, "用户只需要建议，不进行写入。"));
    await executeChatRun(run, connector.apiKey, new AbortController(), fetchImpl);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect((await db.agentRuns.get(run.id))?.status).toBe("completed");
    expect(await db.projects.count()).toBe(0);
    expect(await db.agentToolCalls.where("runId").equals(run.id).count()).toBe(1);
  });

  it.each(["no plan", "inherited plan", "conversation", "empty tools"])("does not nudge %s text-only responses", async kind => {
    const run = await begin("chat-completions", { ...(kind === "inherited plan" ? { plan } : {}), ...(kind === "conversation" ? { interactionMode: "conversation", plan } : {}), ...(kind === "empty tools" ? { enabledToolNames: [], plan } : {}) });
    const fetchImpl = vi.fn<typeof fetch>(async () => reply(run.protocol, "下一步将开始，先说明建议。"));
    await executeChatRun(run, connector.apiKey, new AbortController(), fetchImpl);
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect((await db.agentRuns.get(run.id))?.finishingCheck).toBeUndefined();
    expect((await db.agentRuns.get(run.id))?.status).toBe("completed");
  });

  it.each(["chat-completions", "responses"] as const)("never adds a finishing request at the last segment step for %s", async protocol => {
    const run = await begin(protocol, { modelStep: 30 });
    let count = 0;
    const fetchImpl = vi.fn<typeof fetch>(async () => ++count === 1 ? reply(protocol, "", [wire("update_run_plan", { steps: plan })]) : reply(protocol, "本段暂时结束。"));
    await executeChatRun(run, connector.apiKey, new AbortController(), fetchImpl);
    const saved = (await db.agentRuns.get(run.id))!;
    expect(saved.modelStep).toBe(32); expect(saved.finishingCheck).toBeUndefined(); expect(saved.status).toBe("completed");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("counts the finishing request within the same segment and allows final step text", async () => {
    const f = await eligible();
    await db.agentRuns.update(f.run.id, { modelStep: 30 });
    let count = 0;
    const fetchImpl = vi.fn<typeof fetch>(async () => reply(f.run.protocol, ++count === 1 ? candidate.content : "仍需要用户输入。"));
    await executeChatRun((await db.agentRuns.get(f.run.id))!, connector.apiKey, new AbortController(), fetchImpl);
    const saved = (await db.agentRuns.get(f.run.id))!;
    expect(saved.finishingCheck?.step).toBe(31); expect(saved.modelStep).toBe(32); expect(saved.status).toBe("completed");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it.each(["chat-completions", "responses"] as const)("retains the marker across Stop, reload and explicit resume for %s", async protocol => {
    const f = await eligible(protocol), controller = new AbortController();
    const save = finishing.saveAgentFinishingCheck;
    vi.spyOn(finishing, "saveAgentFinishingCheck").mockImplementation(async (...args) => { const result = await save(...args); if (result) controller.abort(); return result; });
    const fetchImpl = vi.fn<typeof fetch>(async () => reply(protocol, candidate.content, [], candidate.reasoning));
    await executeChatRun(f.run, connector.apiKey, controller, fetchImpl);
    const stopped = (await db.agentRuns.get(f.run.id))!;
    expect(stopped.finishingCheck?.step).toBe(3); expect(stopped.status).toBe("interrupted");
    expect(fetchImpl).toHaveBeenCalledOnce();
    db.close(); await db.open();
    const resumeFetch = vi.fn<typeof fetch>(async () => reply(protocol, "需要你补充具体内容。"));
    await resumeChatRun(f.run.id, connector.apiKey, new AbortController(), resumeFetch);
    const saved = (await db.agentRuns.get(f.run.id))!;
    expect(saved.finishingCheck).toEqual(stopped.finishingCheck);
    expect(saved.status).toBe("completed"); expect(resumeFetch).toHaveBeenCalledOnce();
    expect(saved.activitySteps?.filter(step => step.step === 3)).toHaveLength(1);
  });

  it("saves candidate and marker exactly once under concurrent calls", async () => {
    const { run } = await eligible();
    const outcomes = await Promise.all([saveAgentFinishingCheck(run.id, 2, candidate), saveAgentFinishingCheck(run.id, 2, candidate)]);
    expect(outcomes.sort()).toEqual([false, true]);
    const saved = (await db.agentRuns.get(run.id))!;
    expect(saved.activitySteps).toHaveLength(1);
    expect(saved.continuationMessages?.filter(item => item.content.includes("本轮结束前检查"))).toHaveLength(1);
    expect(saved.requestMessages).toEqual(run.requestMessages);
  });

  it("preserves explicit tool approval after a finishing check, even in full mode", async () => {
    const run = await begin("chat-completions", { enabledToolNames: ["update_run_plan", "paid_fixture"] });
    const paid = vi.fn(async () => ({ id: "paid-job" }));
    const registry = [...BUILTIN_TOOLS, { name: "paid_fixture", title: "付费生成", description: "approval fixture", effect: "network" as const, requiresConfirmation: true, highRisk: () => false, parameters: { type: "object", properties: {} }, parseArguments: (raw: unknown) => raw, execute: paid }];
    let count = 0;
    const fetchImpl = vi.fn<typeof fetch>(async () => ++count === 1 ? reply(run.protocol, "", [wire("update_run_plan", { steps: plan })]) : count === 2 ? reply(run.protocol, candidate.content) : reply(run.protocol, "", [wire("paid_fixture", {})]));
    await executeChatRun(run, connector.apiKey, new AbortController(), fetchImpl, registry);
    expect((await db.agentRuns.get(run.id))?.status).toBe("waiting_approval");
    expect((await db.agentRuns.get(run.id))?.finishingCheck?.step).toBe(2);
    expect(paid).not.toHaveBeenCalled(); expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect((await db.agentToolCalls.where("runId").equals(run.id).sortBy("step"))[1].status).toBe("awaiting_approval");
  });

  it("parks at the existing budget when the finishing request uses the last step for a tool", async () => {
    const f = await eligible();
    await db.agentRuns.update(f.run.id, { modelStep: 30 });
    let count = 0;
    const fetchImpl = vi.fn<typeof fetch>(async () => ++count === 1 ? reply(f.run.protocol, candidate.content) : reply(f.run.protocol, "", [wire("workspace_overview", {})]));
    await executeChatRun((await db.agentRuns.get(f.run.id))!, connector.apiKey, new AbortController(), fetchImpl);
    const saved = (await db.agentRuns.get(f.run.id))!;
    expect(saved.finishingCheck?.step).toBe(31);
    expect(saved).toMatchObject({ modelStep: 32, status: "interrupted", pauseReason: "model_step_limit" });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it.each(["failed", "rejected", "unknown", "pending", "awaiting_approval", "approved", "running"] as const)("does not checkpoint with a %s sibling", async status => {
    const { run, call } = await eligible();
    await db.agentToolCalls.add({ ...call, id: "other", providerCallId: "other", name: "workspace_overview", effect: "read", status });
    expect(await saveAgentFinishingCheck(run.id, 2, candidate)).toBe(false);
    expect((await db.agentRuns.get(run.id))?.finishingCheck).toBeUndefined();
  });

  it.each(["missing", "foreign", "non-atomic", "wrong-effect", "wrong-result", "wrong-args", "manual-edit", "completed-plan", "future-step", "not-offered"])("requires matching current-run plan provenance: %s", async kind => {
    const { run, call } = await eligible();
    if (kind === "missing") await db.agentToolCalls.delete(call.id);
    if (kind === "foreign") await db.agentToolCalls.update(call.id, { threadId: "other" });
    if (kind === "non-atomic") await db.agentToolCalls.update(call.id, { atomic: false });
    if (kind === "wrong-effect") await db.agentToolCalls.update(call.id, { effect: "read" });
    if (kind === "wrong-result") await db.agentToolCalls.update(call.id, { result: JSON.stringify({ plan: [] }) });
    if (kind === "wrong-args") await db.agentToolCalls.update(call.id, { arguments: JSON.stringify({ steps: [] }) });
    if (kind === "manual-edit") await db.agentRuns.update(run.id, { plan: [{ ...plan[0], title: "后来修改" }] });
    if (kind === "completed-plan") await db.agentRuns.update(run.id, { plan: [{ ...plan[0], status: "completed" }] });
    if (kind === "future-step") await db.agentToolCalls.update(call.id, { step: 2 });
    if (kind === "not-offered") await db.agentRuns.update(run.id, { enabledToolNames: ["workspace_overview"] });
    expect(await saveAgentFinishingCheck(run.id, 2, candidate)).toBe(false);
  });

  it("rejects Stop and rolls back marker if persistence fails", async () => {
    const { run } = await eligible();
    const controller = new AbortController(); controller.abort();
    await expect(saveAgentFinishingCheck(run.id, 2, candidate, undefined, controller.signal)).rejects.toThrow();
    const before = await db.agentRuns.get(run.id);
    vi.spyOn(db.agentRuns, "update").mockRejectedValueOnce(new Error("storage failed"));
    await expect(saveAgentFinishingCheck(run.id, 2, candidate)).rejects.toThrow("storage failed");
    expect(await db.agentRuns.get(run.id)).toEqual(before);
  });

  it("preserves the entire Responses envelope including encrypted reasoning", async () => {
    const { run } = await eligible("responses");
    expect(await saveAgentFinishingCheck(run.id, 2, candidate, messageOutput)).toBe(true);
    const saved = (await db.agentRuns.get(run.id))!;
    expect(saved.responseItems?.slice(-3, -1)).toEqual(messageOutput);
    expect(saved.responseItems?.slice(0, run.responseItems!.length)).toEqual(run.responseItems);
    expect(JSON.stringify(saved.activitySteps)).not.toContain("opaque-provider-reasoning");
  });

  it.each(["absent", "empty", "text-mismatch", "reasoning-mismatch", "tool-call", "tool-result", "user-role", "duplicate-id", "extra-field"])("rejects malformed/mismatched Responses %s with no checkpoint", async kind => {
    const { run } = await eligible("responses");
    let envelope: AgentResponseItem[] | undefined = structuredClone(messageOutput);
    if (kind === "absent") envelope = undefined;
    if (kind === "empty") envelope = [];
    if (kind === "text-mismatch") envelope = [messageOutput[0], { type: "message", role: "assistant", status: "completed", content: [{ type: "output_text", text: "其他文字", annotations: [] }] }];
    if (kind === "reasoning-mismatch") envelope = [messageOutput[1]];
    if (kind === "tool-call") envelope!.push({ type: "function_call", call_id: "unexpected", name: "workspace_overview", arguments: "{}" });
    if (kind === "tool-result") envelope!.push({ type: "function_call_output", call_id: "unexpected", output: "{}" });
    if (kind === "user-role") envelope = [{ type: "message", role: "user", content: candidate.content }];
    if (kind === "duplicate-id") envelope!.push(messageOutput[0]);
    if (kind === "extra-field") envelope![1] = { ...messageOutput[1], referenceInput: { projectId: "other", references: [] } };
    await expect(saveAgentFinishingCheck(run.id, 2, candidate, envelope)).rejects.toThrow();
    expect(await db.agentRuns.get(run.id)).toEqual(run);
  });

  it("rejects a Responses envelope in a Chat run", async () => {
    const { run } = await eligible();
    await expect(saveAgentFinishingCheck(run.id, 2, candidate, messageOutput)).rejects.toThrow("协议");
    expect((await db.agentRuns.get(run.id))?.finishingCheck).toBeUndefined();
  });

  it.each(["chat-completions", "responses"] as const)("preserves the entire checkpoint tail when compacting base history with %s", async protocol => {
    const { run } = await eligible(protocol);
    const history: ContextSource[] = Array.from({ length: 8 }, (_, index) => ({ id: `history-${index}`, role: index % 2 ? "assistant" : "user", content: "先前的创作讨论。".repeat(90) }));
    const baseMessages = buildContextMessages(run.agentSnapshot.instructions, run.skillInstructions ?? "", history, run.context!.draft);
    const originalTail = run.continuationMessages!.slice(run.context!.baseMessages.length);
    await db.agentRuns.update(run.id, {
      requestMessages: baseMessages,
      context: { ...run.context!, history, baseMessages, capacity: 8192, policy: { ...run.context!.policy, autoCompress: true } },
      continuationMessages: [...baseMessages, ...originalTail],
      ...(protocol === "responses" ? { responseItems: [...toResponseInput(baseMessages), ...toResponseInput(originalTail)] } : {}),
    });
    expect(await saveAgentFinishingCheck(run.id, 2, candidate, protocol === "responses" ? messageOutput : undefined)).toBe(true);
    const saved = (await db.agentRuns.get(run.id))!;
    const tail = saved.continuationMessages!.slice(baseMessages.length);
    const responseTail = saved.responseItems?.slice(toResponseInput(baseMessages).length);
    const fetchImpl = vi.fn<typeof fetch>(async () => reply(protocol, "历史目标：继续完成创作。"));
    const compacted = await prepareRunContext(run.id, [], connector.apiKey, new AbortController().signal, fetchImpl);
    expect(fetchImpl).toHaveBeenCalled();
    expect(compacted.context?.summaryId).toBeDefined();
    expect(compacted.requestMessages).toEqual(baseMessages);
    expect(compacted.finishingCheck).toEqual(saved.finishingCheck);
    expect(compacted.continuationMessages?.slice(compacted.context!.baseMessages.length)).toEqual(tail);
    if (protocol === "responses") expect(compacted.responseItems?.slice(toResponseInput(compacted.context!.baseMessages).length)).toEqual(responseTail);
    expect(await saveAgentFinishingCheck(run.id, 2, candidate, protocol === "responses" ? messageOutput : undefined)).toBe(false);
  });

  it.each(["deleted thread", "rebound thread", "deleted message", "foreign message", "missing project"])("rejects invalid ownership: %s", async reason => {
    const { run } = await eligible();
    if (reason === "deleted thread") await db.chatThreads.delete(run.threadId);
    if (reason === "rebound thread") await db.chatThreads.update(run.threadId, { projectId: "foreign" });
    if (reason === "deleted message") await db.chatMessages.delete(run.assistantMessageId);
    if (reason === "foreign message") await db.chatMessages.update(run.assistantMessageId, { runId: "foreign" });
    if (reason === "missing project") {
      await db.chatThreads.update(run.threadId, { projectId: "missing" });
      await db.agentRuns.update(run.id, { projectId: "missing" });
    }
    await expect(saveAgentFinishingCheck(run.id, 2, candidate)).rejects.toThrow("归属");
    expect((await db.agentRuns.get(run.id))?.finishingCheck).toBeUndefined();
  });

  it("rejects stale step callbacks without consuming the one-use checkpoint", async () => {
    const { run } = await eligible();
    expect(await saveAgentFinishingCheck(run.id, 1, candidate)).toBe(false);
    expect(await saveAgentFinishingCheck(run.id, 3, candidate)).toBe(false);
    expect(await saveAgentFinishingCheck(run.id, 2, candidate)).toBe(true);
  });
});
