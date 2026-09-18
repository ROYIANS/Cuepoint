import { describe, expect, it, vi } from "vitest";
import { db } from "@/db/database";
import { beginAgentRun, canRetryRun, interruptThreadRuns } from "@/db/agentRuns";
import { cancelAgentRun, resolveAgentToolApproval, resumeAgentRun } from "@/db/agentTools";
import { getGeneralAgentConfig, updateGeneralAgentConfig } from "@/db/agentSettings";
import { createChatThread, deleteChatThread } from "@/db/repo";
import { executeChatRun, resumeChatRun } from "@/lib/agent/runChat";
import { BUILTIN_TOOLS, requiresToolApproval, validateToolCall, type AgentToolDefinition } from "@/lib/agent/tools";
import type { AgentPermissionMode, AgentToolEffect } from "@/domain/agent";
import type { ConnectorConfig } from "@/domain/types";

const connector: ConnectorConfig = { id: "cx", name: "test", definitionId: "openai-compatible", baseUrl: "https://example.test/v1", apiKey: "secret", updatedAt: "2026-01-01" };
async function begin(mode: AgentPermissionMode = "ask") {
  await updateGeneralAgentConfig({ permissionMode: mode });
  const thread = await createChatThread();
  return beginAgentRun({ threadId: thread.id, connector, model: "model", content: "制作计划" });
}
const answer = () => Response.json({ choices: [{ message: { content: "完成" }, finish_reason: "stop" }] });
const toolResponse = (name: string, args = "{}", id = "call-1") => Response.json({ choices: [{ message: { content: "", tool_calls: [{ id, type: "function", function: { name, arguments: args } }] }, finish_reason: "tool_calls" }] });
function controlled(effect: AgentToolEffect = "write", risk = false): AgentToolDefinition {
  return { ...BUILTIN_TOOLS[0], effect, highRisk: () => risk, execute: vi.fn(async () => ({ changed: true })) };
}

describe("tool permissions and skill snapshots", () => {
  it("uses the accepted permission matrix without model-supplied flags", () => {
    for (const mode of ["ask", "assist", "full"] as const) {
      for (const effect of ["read", "bookkeeping", "write", "network"] as const) {
        expect(requiresToolApproval(mode, controlled(effect), {})).toBe(mode === "ask" && ["write", "network"].includes(effect));
        expect(requiresToolApproval(mode, controlled(effect, true), {})).toBe(mode !== "full");
      }
    }
    expect(() => validateToolCall("workspace_overview", '{"approved":true}', ["workspace_overview"])).toThrow("参数无效");
  });
  it("defaults to ask, validates settings, and freezes skills for each run", async () => {
    expect((await getGeneralAgentConfig()).permissionMode).toBe("ask");
    await expect(updateGeneralAgentConfig({ enabledSkillIds: ["made-up"] })).rejects.toThrow();
    const run = await begin();
    await updateGeneralAgentConfig({ permissionMode: "full", enabledSkillIds: [] });
    expect((await db.agentRuns.get(run.id))?.permissionMode).toBe("ask");
    expect(run.enabledToolNames).toEqual(["workspace_overview", "update_run_plan"]);
    expect(run.requestMessages[0].content).toContain("workspace_overview");
    expect(() => validateToolCall("workspace_overview", "{}", [])).toThrow("未启用");
    expect(() => validateToolCall("unknown", "{}", ["unknown"])).toThrow("未知");
    expect(() => validateToolCall("update_run_plan", '{"steps":[{"id":"a","title":"a","status":"in_progress"},{"id":"a","title":"b","status":"in_progress"}]}', ["update_run_plan"])).toThrow();
  });
});

describe("durable bounded tool loop", () => {
  it("passes complete assistant/tool chains, saves plan atomically, and finishes", async () => {
    const run = await begin();
    const bodies: Array<{ messages: Array<{role:string;tool_call_id?:string}> }> = [];
    const fetcher = vi.fn(async (_url, init) => {
      bodies.push(JSON.parse(String(init?.body)));
      if (bodies.length === 1) return toolResponse("workspace_overview");
      if (bodies.length === 2) return toolResponse("update_run_plan", '{"steps":[{"id":"inspect","title":"检查工作区","status":"completed"}]}', "call-2");
      return answer();
    });
    await executeChatRun(run, connector.apiKey, new AbortController(), fetcher);
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(bodies[1].messages.slice(-2).map((m) => m.role)).toEqual(["assistant", "tool"]);
    expect(bodies[2].messages.filter((m) => m.role === "tool").map((m) => m.tool_call_id)).toEqual(["call-1", "call-2"]);
    expect(await db.agentRuns.get(run.id)).toMatchObject({ status: "completed", modelStep: 3, plan: [{ id: "inspect", title: "检查工作区", status: "completed" }] });
    const calls = await db.agentToolCalls.where("runId").equals(run.id).toArray();
    expect(calls.every((call) => call.status === "completed" && !!call.result)).toBe(true);
    expect((await db.chatMessages.get(run.assistantMessageId))?.content).toBe("完成");
  });
  it("persists approval, binds one immutable call and rejects double decisions", async () => {
    const run = await begin(); const tool = controlled();
    await executeChatRun(run, connector.apiKey, new AbortController(), vi.fn(async () => toolResponse(tool.name)), [tool, BUILTIN_TOOLS[1]]);
    expect(tool.execute).not.toHaveBeenCalled();
    expect((await db.agentRuns.get(run.id))?.status).toBe("waiting_approval");
    const call = (await db.agentToolCalls.toArray())[0];
    expect(call).toMatchObject({ arguments: "{}", effect: "write", status: "awaiting_approval" });
    await expect(resolveAgentToolApproval("foreign", call.id, "approve")).rejects.toThrow();
    await updateGeneralAgentConfig({ permissionMode: "full" });
    await expect(resumeAgentRun(run.id)).rejects.toThrow("批准");
    await resolveAgentToolApproval(run.id, call.id, "approve");
    await expect(resolveAgentToolApproval(run.id, call.id, "approve")).rejects.toThrow("已处理");
    const fetcher = vi.fn(async () => answer());
    await resumeChatRun(run.id, connector.apiKey, new AbortController(), fetcher, [tool, BUILTIN_TOOLS[1]]);
    expect(tool.execute).toHaveBeenCalledTimes(1);
    expect(await db.agentToolCalls.get(call.id)).toMatchObject({ arguments: "{}", decision: "approve", status: "completed" });
    await expect(resumeChatRun(run.id, connector.apiKey, new AbortController(), fetcher, [tool, BUILTIN_TOOLS[1]])).rejects.toThrow();
    expect(tool.execute).toHaveBeenCalledTimes(1);
  });
  it("resumes rejection as an explicit tool result without dispatch", async () => {
    const run = await begin(); const tool = controlled("network");
    await executeChatRun(run, connector.apiKey, new AbortController(), vi.fn(async () => toolResponse(tool.name)), [tool, BUILTIN_TOOLS[1]]);
    const call = (await db.agentToolCalls.toArray())[0];
    await resolveAgentToolApproval(run.id, call.id, "reject");
    const fetcher = vi.fn(async (_url, init) => { expect(String(init?.body)).toContain("用户拒绝"); return answer(); });
    await resumeChatRun(run.id, connector.apiKey, new AbortController(), fetcher, [tool, BUILTIN_TOOLS[1]]);
    expect(tool.execute).not.toHaveBeenCalled();
    expect((await db.agentRuns.get(run.id))?.status).toBe("completed");
  });
  it("never replays completed calls after a failed next model request", async () => {
    const run = await begin("full"); const tool = controlled(); let requests = 0;
    await executeChatRun(run, connector.apiKey, new AbortController(), vi.fn(async () => ++requests === 1 ? toolResponse(tool.name) : new Response("down", { status: 500 })), [tool, BUILTIN_TOOLS[1]]);
    const saved = (await db.agentRuns.get(run.id))!;
    expect(saved.status).toBe("failed");
    expect(canRetryRun(saved, [saved], await db.chatMessages.toArray())).toBe(false);
    await resumeChatRun(run.id, connector.apiKey, new AbortController(), vi.fn(async () => answer()), [tool, BUILTIN_TOOLS[1]]);
    expect(tool.execute).toHaveBeenCalledTimes(1);
    expect((await db.agentRuns.get(run.id))?.status).toBe("completed");
  });
  it("blocks ambiguous effects and allows explicit cancel without replay", async () => {
    const run = await begin("full"); const tool = controlled(); tool.execute = vi.fn(async () => { throw new Error("lost result"); });
    await executeChatRun(run, connector.apiKey, new AbortController(), vi.fn(async () => toolResponse(tool.name)), [tool, BUILTIN_TOOLS[1]]);
    expect((await db.agentToolCalls.toArray())[0].status).toBe("unknown");
    await expect(resumeAgentRun(run.id)).rejects.toThrow("不确定");
    await expect(beginAgentRun({ threadId: run.threadId, connector, model: "model", content: "next" })).rejects.toThrow("已有执行");
    await cancelAgentRun(run.id);
    expect((await db.agentRuns.get(run.id))?.status).toBe("cancelled");
    expect(tool.execute).toHaveBeenCalledTimes(1);
  });
  it("recovers executing tools to unknown but leaves pending approvals intact", async () => {
    const run = await begin(); const tool = controlled();
    await executeChatRun(run, connector.apiKey, new AbortController(), vi.fn(async () => toolResponse(tool.name)), [tool, BUILTIN_TOOLS[1]]);
    await interruptThreadRuns(run.threadId);
    expect((await db.agentRuns.get(run.id))?.status).toBe("waiting_approval");
    const call = (await db.agentToolCalls.toArray())[0];
    await db.agentRuns.update(run.id, { status: "running" });
    await db.agentToolCalls.update(call.id, { status: "running" });
    await interruptThreadRuns(run.threadId);
    expect((await db.agentToolCalls.get(call.id))?.status).toBe("unknown");
    await expect(resumeAgentRun(run.id)).rejects.toThrow("不确定");
  });
  it("rejects argument errors before tool execution and lets model correct them", async () => {
    const run = await begin("full"); const tool = controlled(); let requests = 0;
    await executeChatRun(run, connector.apiKey, new AbortController(), vi.fn(async () => ++requests === 1 ? toolResponse(tool.name, '{"approve":true}') : answer()), [tool, BUILTIN_TOOLS[1]]);
    expect(tool.execute).not.toHaveBeenCalled();
    expect((await db.agentToolCalls.toArray())[0].status).toBe("failed");
    expect((await db.agentRuns.get(run.id))?.status).toBe("completed");
  });
  it("bounds model steps and cannot bypass budget by resume", async () => {
    const run = await begin("full"); const tool = controlled(); let requests = 0;
    const fetcher = vi.fn(async () => toolResponse(tool.name, "{}", `call-${++requests}`));
    await executeChatRun(run, connector.apiKey, new AbortController(), fetcher, [tool, BUILTIN_TOOLS[1]]);
    expect(fetcher).toHaveBeenCalledTimes(8);
    expect((await db.agentRuns.get(run.id))?.error).toContain("上限");
    await resumeChatRun(run.id, connector.apiKey, new AbortController(), fetcher, [tool, BUILTIN_TOOLS[1]]);
    expect(fetcher).toHaveBeenCalledTimes(8);
    expect(tool.execute).toHaveBeenCalledTimes(8);
  });
  it("blocks reuse of provider call IDs and preserves the first result", async () => {
    const run = await begin("full"); const tool = controlled();
    await executeChatRun(run, connector.apiKey, new AbortController(), vi.fn(async () => toolResponse(tool.name)), [tool, BUILTIN_TOOLS[1]]);
    expect(tool.execute).toHaveBeenCalledTimes(1);
    expect((await db.agentRuns.get(run.id))?.error).toContain("重复");
  });
  it("does not apply an old approval after a tool effect definition changes", async () => {
    const run = await begin(); const tool = controlled();
    await executeChatRun(run, connector.apiKey, new AbortController(), vi.fn(async () => toolResponse(tool.name)), [tool, BUILTIN_TOOLS[1]]);
    const call = (await db.agentToolCalls.toArray())[0];
    await resolveAgentToolApproval(run.id, call.id, "approve");
    const changed = { ...tool, effect: "network" as const };
    await resumeChatRun(run.id, connector.apiKey, new AbortController(), vi.fn(async () => answer()), [changed, BUILTIN_TOOLS[1]]);
    expect(tool.execute).not.toHaveBeenCalled();
    expect((await db.agentRuns.get(run.id))?.error).toContain("定义已变化");
  });
  it("thread deletion cascades pending ledger without resurrection", async () => {
    const run = await begin(); const tool = controlled();
    await executeChatRun(run, connector.apiKey, new AbortController(), vi.fn(async () => toolResponse(tool.name)), [tool, BUILTIN_TOOLS[1]]);
    const call = (await db.agentToolCalls.toArray())[0];
    await deleteChatThread(run.threadId);
    await expect(resolveAgentToolApproval(run.id, call.id, "approve")).rejects.toThrow("已删除");
    expect(await db.agentToolCalls.count()).toBe(0);
  });
  it("Stop after a settled tool keeps its result and can continue without replay", async () => {
    const run = await begin("full"); const controller = new AbortController(); const tool = controlled();
    tool.execute = vi.fn(async () => { controller.abort(); return { changed: true }; });
    await executeChatRun(run, connector.apiKey, controller, vi.fn(async () => toolResponse(tool.name)), [tool, BUILTIN_TOOLS[1]]);
    expect((await db.agentRuns.get(run.id))?.status).toBe("interrupted");
    expect((await db.agentToolCalls.toArray())[0].status).toBe("completed");
    await resumeChatRun(run.id, connector.apiKey, new AbortController(), vi.fn(async () => answer()), [tool, BUILTIN_TOOLS[1]]);
    expect(tool.execute).toHaveBeenCalledTimes(1);
    expect((await db.agentRuns.get(run.id))?.status).toBe("completed");
  });
  it("preserves the saved reply when a resumed pending step fails before the next request", async () => {
    const run = await begin(); const tool = controlled();
    await executeChatRun(run, connector.apiKey, new AbortController(), vi.fn(async () => toolResponse(tool.name)), [tool, BUILTIN_TOOLS[1]]);
    const call = (await db.agentToolCalls.toArray())[0];
    await db.chatMessages.update(run.assistantMessageId, { content: "已保存的解释", reasoning: "已保存思考" });
    await resolveAgentToolApproval(run.id, call.id, "approve");
    await resumeChatRun(run.id, connector.apiKey, new AbortController(), vi.fn(async () => answer()), [{ ...tool, effect: "network" }, BUILTIN_TOOLS[1]]);
    expect(await db.chatMessages.get(run.assistantMessageId)).toMatchObject({ content: "已保存的解释", reasoning: "已保存思考" });
  });
  it("does not dispatch a second tool after Stop during the first tool", async () => {
    const run = await begin("full"); const controller = new AbortController(); const tool = controlled();
    tool.execute = vi.fn(async () => { controller.abort(); return { changed: true }; });
    const fetcher = vi.fn(async () => Response.json({ choices: [{ message: { content: "", tool_calls: ["first", "second"].map((id) => ({ id, type: "function", function: { name: tool.name, arguments: "{}" } })) }, finish_reason: "tool_calls" }] }));
    await executeChatRun(run, connector.apiKey, controller, fetcher, [tool, BUILTIN_TOOLS[1]]);
    expect(tool.execute).toHaveBeenCalledTimes(1);
    const calls = await db.agentToolCalls.toArray();
    expect(calls.filter((call) => call.status === "pending")).toHaveLength(1);
    expect(calls.filter((call) => call.status === "completed")).toHaveLength(1);
  });

  it("reports checkpoint persistence failure distinctly from user Stop", async () => {
    const run = await begin();
    const persist = vi.spyOn(db.chatMessages, "update");
    persist.mockRejectedValueOnce(new Error("quota"));
    try {
      await expect(executeChatRun(run, connector.apiKey, new AbortController(), vi.fn(async () => answer()))).rejects.toThrow("本地保存失败");
      expect((await db.agentRuns.get(run.id))?.status).toBe("failed");
      expect((await db.chatMessages.get(run.assistantMessageId))?.error).toContain("本地保存失败");
    } finally { persist.mockRestore(); }
  });

});
