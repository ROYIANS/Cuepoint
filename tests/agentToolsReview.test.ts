import { describe, expect, it, vi } from "vitest";
import { db } from "@/db/database";
import { beginAgentRun, checkpointAgentRun, interruptThreadRuns } from "@/db/agentRuns";
import { resolveAgentToolApproval, saveToolRound, startModelStep, transitionToolCall } from "@/db/agentTools";
import { updateGeneralAgentConfig } from "@/db/agentSettings";
import { createChatThread, deleteChatThread } from "@/db/repo";
import type { AgentWireToolCall } from "@/domain/agent";
import type { ConnectorConfig } from "@/domain/types";
import { executeChatRun, resumeChatRun } from "@/lib/agent/runChat";
import { recoverAbandonedRuns, withThreadRunLock, type ThreadLockManager } from "@/lib/agent/runOwnership";
import { BUILTIN_TOOLS, type AgentToolDefinition } from "@/lib/agent/tools";

const connector: ConnectorConfig = { id: "review", name: "Review fixture", definitionId: "openai-compatible", baseUrl: "https://review.invalid/v1", apiKey: "fixture-key", updatedAt: "2026-09-18" };
const wireCall = (id: string): AgentWireToolCall => ({ id, type: "function", function: { name: "workspace_overview", arguments: "{}" } });
const toolResponse = (ids = ["call-1"]) => Response.json({ choices: [{ message: { content: "需要执行以下操作", tool_calls: ids.map(wireCall) }, finish_reason: "tool_calls" }] });
const answer = () => Response.json({ choices: [{ message: { content: "已完成" }, finish_reason: "stop" }] });
const writeTool = (): AgentToolDefinition => ({ ...BUILTIN_TOOLS[0], effect: "write", execute: vi.fn(async () => ({ saved: true })) });
async function begin() {
  const thread = await createChatThread();
  return beginAgentRun({ threadId: thread.id, connector, model: "fixture", content: "检查执行恢复" });
}
function locksFixture(): ThreadLockManager {
  const owned = new Set<string>();
  return { async request(name, _options, callback) {
    if (owned.has(name)) return callback(null);
    owned.add(name);
    try { return await callback({ name }); } finally { owned.delete(name); }
  } };
}

describe("independent tool lifecycle review regressions", () => {
  it("restores an approval recorded before a crash parks the run, without executing automatically", async () => {
    const run = await begin();
    await startModelStep(run.id, 8);
    await checkpointAgentRun(run.id, 1, { content: "准备修改，需要批准" });
    await saveToolRound(run.id, "准备修改，需要批准", [wireCall("call-1")], [{ title: "Fixture write", effect: "write", highRisk: false }]);
    const call = (await db.agentToolCalls.toArray())[0];
    await transitionToolCall(run.id, call.id, ["pending"], "awaiting_approval");
    // Crash here, before pauseForApproval. Startup only reconciles local state.
    await recoverAbandonedRuns(locksFixture());
    expect(await db.agentRuns.get(run.id)).toMatchObject({ status: "waiting_approval" });
    expect(await db.chatMessages.get(run.assistantMessageId)).toMatchObject({ status: "pending", content: "准备修改，需要批准" });
    expect((await db.agentToolCalls.get(call.id))?.status).toBe("awaiting_approval");
    await resolveAgentToolApproval(run.id, call.id, "approve");
    const tool = writeTool();
    await resumeChatRun(run.id, connector.apiKey, new AbortController(), vi.fn(async () => answer()), [tool, BUILTIN_TOOLS[1]]);
    expect(tool.execute).toHaveBeenCalledTimes(1);
    expect((await db.agentRuns.get(run.id))?.status).toBe("completed");
  });

  it("requires each approval and preserves one ordered tool chain after mixed decisions", async () => {
    const run = await begin();
    const tool = writeTool();
    await executeChatRun(run, connector.apiKey, new AbortController(), vi.fn(async () => toolResponse(["first", "second"])), [tool, BUILTIN_TOOLS[1]]);
    const calls = (await db.agentToolCalls.toArray()).sort((a, b) => a.order - b.order);
    await resolveAgentToolApproval(run.id, calls[0].id, "approve");
    await expect(resumeChatRun(run.id, connector.apiKey, new AbortController(), vi.fn(async () => answer()), [tool, BUILTIN_TOOLS[1]])).rejects.toThrow("批准");
    expect(tool.execute).not.toHaveBeenCalled();
    await resolveAgentToolApproval(run.id, calls[1].id, "reject");
    const fetcher = vi.fn(async (_url, init) => {
      const body = JSON.parse(String(init?.body));
      expect(body.messages.slice(-3).map((message: { role: string }) => message.role)).toEqual(["assistant", "tool", "tool"]);
      expect(body.messages.slice(-2).map((message: { tool_call_id: string }) => message.tool_call_id)).toEqual(["first", "second"]);
      expect(body.messages.at(-1).content).toContain("用户拒绝");
      return answer();
    });
    await resumeChatRun(run.id, connector.apiKey, new AbortController(), fetcher, [tool, BUILTIN_TOOLS[1]]);
    expect(tool.execute).toHaveBeenCalledTimes(1);
  });

  it("keeps saved approvals actionable after parking fails without concealing the failure", async () => {
    const run = await begin();
    const tool = writeTool();
    const messageWrite = vi.spyOn(db.chatMessages, "update").mockRejectedValueOnce(new Error("temporary storage failure"));
    try {
      // Empty content avoids a stream checkpoint, so the failing write belongs
      // to pauseForApproval after the immutable pending call has been saved.
      await executeChatRun(run, connector.apiKey, new AbortController(), vi.fn(async () => Response.json({ choices: [{ message: { content: "", tool_calls: [wireCall("first"), wireCall("second")] }, finish_reason: "tool_calls" }] })), [tool, BUILTIN_TOOLS[1]]);
    } finally { messageWrite.mockRestore(); }
    const calls = (await db.agentToolCalls.toArray()).sort((a, b) => a.order - b.order);
    expect((await db.agentRuns.get(run.id))?.status).toBe("failed");
    expect(calls.map((call) => call.status)).toEqual(["awaiting_approval", "awaiting_approval"]);
    await updateGeneralAgentConfig({ permissionMode: "full" });
    await resolveAgentToolApproval(run.id, calls[0].id, "approve");
    expect((await db.agentRuns.get(run.id))?.status).toBe("failed");
    await expect(resumeChatRun(run.id, connector.apiKey, new AbortController(), vi.fn(async () => answer()), [tool, BUILTIN_TOOLS[1]])).rejects.toThrow("批准");
    await resolveAgentToolApproval(run.id, calls[1].id, "reject");
    expect((await db.agentRuns.get(run.id))?.status).toBe("failed");
    expect(tool.execute).not.toHaveBeenCalled();
    await resumeChatRun(run.id, connector.apiKey, new AbortController(), vi.fn(async () => answer()), [tool, BUILTIN_TOOLS[1]]);
    expect(tool.execute).toHaveBeenCalledTimes(1);
    expect((await db.agentRuns.get(run.id))?.status).toBe("completed");
  });

  it("refuses approval when the run has been superseded or message ownership mismatches", async () => {
    const run = await begin();
    const tool = writeTool();
    await executeChatRun(run, connector.apiKey, new AbortController(), vi.fn(async () => toolResponse()), [tool, BUILTIN_TOOLS[1]]);
    const call = (await db.agentToolCalls.toArray())[0];
    await db.chatMessages.add({ id: "later-user", threadId: run.threadId, role: "user", content: "later", createdAt: new Date(Date.parse(run.createdAt) + 100).toISOString(), status: "complete" });
    await expect(resolveAgentToolApproval(run.id, call.id, "approve")).rejects.toThrow("最后一次");
    await db.chatMessages.delete("later-user");
    await db.chatMessages.update(run.assistantMessageId, { runId: "foreign" });
    await expect(resolveAgentToolApproval(run.id, call.id, "approve")).rejects.toThrow("归属");
    expect((await db.agentToolCalls.get(call.id))?.status).toBe("awaiting_approval");
  });

  it("cannot recover or resume a tool while its owner tab holds the thread lock", async () => {
    const locks = locksFixture();
    const run = await begin();
    const tool = writeTool();
    await executeChatRun(run, connector.apiKey, new AbortController(), vi.fn(async () => toolResponse()), [tool, BUILTIN_TOOLS[1]]);
    const call = (await db.agentToolCalls.toArray())[0];
    await resolveAgentToolApproval(run.id, call.id, "approve");
    tool.execute = vi.fn(async () => {
      await recoverAbandonedRuns(locks);
      expect((await db.agentRuns.get(run.id))?.status).toBe("running");
      expect((await db.agentToolCalls.get(call.id))?.status).toBe("running");
      await expect(withThreadRunLock(run.threadId, () => resumeChatRun(run.id, connector.apiKey, new AbortController()), locks)).rejects.toThrow("另一个页面");
      return { saved: true };
    });
    await withThreadRunLock(run.threadId, () => resumeChatRun(run.id, connector.apiKey, new AbortController(), vi.fn(async () => answer()), [tool, BUILTIN_TOOLS[1]]), locks);
    expect(tool.execute).toHaveBeenCalledTimes(1);
  });

  it("does not recreate deleted runs or ledgers when a tool finishes late", async () => {
    await updateGeneralAgentConfig({ permissionMode: "full" });
    const run = await begin();
    const tool = writeTool();
    tool.execute = vi.fn(async () => { await deleteChatThread(run.threadId); return { saved: true }; });
    const fetcher = vi.fn(async () => toolResponse());
    await executeChatRun(run, connector.apiKey, new AbortController(), fetcher, [tool, BUILTIN_TOOLS[1]]);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(await db.agentRuns.count()).toBe(0);
    expect(await db.agentToolCalls.count()).toBe(0);
    expect(await db.chatMessages.count()).toBe(0);
  });

  it("keeps unresolved effects interrupted even if another call needs approval", async () => {
    const run = await begin();
    await saveToolRound(run.id, "", [wireCall("first"), wireCall("second")], [{ title: "A", effect: "write", highRisk: false }, { title: "B", effect: "write", highRisk: false }]);
    const calls = (await db.agentToolCalls.toArray()).sort((a, b) => a.order - b.order);
    await transitionToolCall(run.id, calls[0].id, ["pending"], "running");
    await transitionToolCall(run.id, calls[1].id, ["pending"], "awaiting_approval");
    await interruptThreadRuns(run.threadId);
    expect((await db.agentRuns.get(run.id))?.status).toBe("interrupted");
    expect((await db.agentToolCalls.get(calls[0].id))?.status).toBe("unknown");
    await expect(resolveAgentToolApproval(run.id, calls[1].id, "approve")).rejects.toThrow();
  });
});
