import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { db } from "@/db/database";
import { beginAgentRun, interruptThreadRuns } from "@/db/agentRuns";
import { updateGeneralAgentConfig } from "@/db/agentSettings";
import { AtomicToolRollbackError, executeAtomicTool, markRunningToolsUnknown, resolveAgentToolApproval, resumeAgentRun, saveToolPreview, saveToolRound, transitionToolCall } from "@/db/agentTools";
import { createChatThread, createProject } from "@/db/repo";
import type { AgentPermissionMode, AgentRun, AgentToolPreview } from "@/domain/agent";
import type { ConnectorConfig } from "@/domain/types";
import { executeChatRun, resumeChatRun } from "@/lib/agent/runChat";
import type { AgentToolDefinition } from "@/lib/agent/tools";

const connector: ConnectorConfig = { id: "transaction-fixture", name: "fixture", definitionId: "openai-compatible", baseUrl: "https://example.test/v1", apiKey: "fixture-key", updatedAt: "2026-09-19" };
const toolName = "fixture_create_project";
const preview: AgentToolPreview = { summary: "创建项目", changes: ["新增项目和首集"], revision: "revision-1" };

function fixtureTool(overrides: Partial<AgentToolDefinition> = {}): AgentToolDefinition {
  return {
    name: toolName, title: "创建项目", description: "Local transaction test fixture", effect: "write", atomic: true,
    parameters: { type: "object", properties: {}, additionalProperties: false },
    parseArguments: (raw) => z.object({}).strict().parse(raw), highRisk: () => false,
    prepare: vi.fn(async () => structuredClone(preview)),
    execute: vi.fn(async (_args, context) => executeAtomicTool(context, async () => {
      const project = await createProject("事务项目");
      return { projectId: project.id };
    })),
    ...overrides,
  };
}

async function begin(mode: AgentPermissionMode = "full"): Promise<AgentRun> {
  await updateGeneralAgentConfig({ permissionMode: mode });
  const thread = await createChatThread();
  const run = await beginAgentRun({ threadId: thread.id, connector, model: "fixture-model", content: "创建项目" });
  // Isolate the fixture from the growing default skill registry.
  // Synthetic runtime fixture starts with this one tool already offered.
  const toolLoading = { version: 1 as const, groups: [], foundationToolNames: [toolName], foundationInstructions: "", loadedGroupIds: [], loadedToolNames: [] };
  const offeredTools = [{ step: 1, names: [toolName] }];
  await db.agentRuns.update(run.id, { enabledToolNames: [toolName], toolLoading, offeredTools });
  return { ...run, enabledToolNames: [toolName], toolLoading, offeredTools };
}

async function pendingCall(run: AgentRun) {
  await saveToolRound(run.id, "", [{ id: "provider-call", type: "function", function: { name: toolName, arguments: "{}" } }], [{ title: "创建项目", effect: "write", highRisk: false, atomic: true }]);
  return (await db.agentToolCalls.where("runId").equals(run.id).toArray())[0];
}

const responseWithTool = () => Response.json({ choices: [{ message: { content: "", tool_calls: [{ id: "provider-call", type: "function", function: { name: toolName, arguments: "{}" } }] }, finish_reason: "tool_calls" }] });
const answer = () => Response.json({ choices: [{ message: { content: "已处理工具结果" }, finish_reason: "stop" }] });

describe("atomic business tool transactions", () => {
  it("commits nested domain writes and the ledger together and replays only the saved result", async () => {
    const run = await begin();
    const call = await pendingCall(run);
    await transitionToolCall(run.id, call.id, ["pending"], "running");
    const context = { runId: run.id, threadId: run.threadId, callId: call.id, signal: new AbortController().signal };
    const mutate = vi.fn(async () => ({ projectId: (await createProject("一次创建")).id }));
    const result = await executeAtomicTool(context, mutate);
    db.close(); await db.open();
    expect(await executeAtomicTool(context, mutate)).toEqual(result);
    expect(mutate).toHaveBeenCalledTimes(1);
    expect(await db.projects.count()).toBe(1);
    expect(await db.episodes.count()).toBe(1);
    expect(await db.agentToolCalls.get(call.id)).toMatchObject({ status: "completed", result: JSON.stringify(result) });
  });

  it("rolls back project and episode creation when the final ledger write fails", async () => {
    const run = await begin(); const call = await pendingCall(run);
    await transitionToolCall(run.id, call.id, ["pending"], "running");
    const failure = vi.spyOn(db.agentToolCalls, "update").mockRejectedValueOnce(new Error("ledger disk failure"));
    try {
      await expect(executeAtomicTool({ runId: run.id, threadId: run.threadId, callId: call.id, signal: new AbortController().signal }, async () => ({ id: (await createProject("必须回滚")).id }))).rejects.toBeInstanceOf(AtomicToolRollbackError);
    } finally { failure.mockRestore(); }
    expect(await db.projects.count()).toBe(0);
    expect(await db.episodes.count()).toBe(0);
    expect(await db.agentToolCalls.get(call.id)).toMatchObject({ status: "running" });
    expect((await db.agentToolCalls.get(call.id))?.result).toBeUndefined();
  });

  it("rolls back domain writes when cancellation arrives before the local commit", async () => {
    const run = await begin(); const call = await pendingCall(run);
    await transitionToolCall(run.id, call.id, ["pending"], "running");
    const controller = new AbortController();
    await expect(executeAtomicTool({ runId: run.id, threadId: run.threadId, callId: call.id, signal: controller.signal }, async () => {
      await createProject("停止后不保存"); controller.abort(); return { success: true };
    })).rejects.toBeInstanceOf(AtomicToolRollbackError);
    expect(await db.projects.count()).toBe(0);
    expect(await db.episodes.count()).toBe(0);
    expect((await db.agentToolCalls.get(call.id))?.status).toBe("running");
  });

  it("rolls back local mutations when their result cannot fit the durable ledger", async () => {
    const run = await begin(); const call = await pendingCall(run);
    await transitionToolCall(run.id, call.id, ["pending"], "running");
    await expect(executeAtomicTool({ runId: run.id, threadId: run.threadId, callId: call.id, signal: new AbortController().signal }, async () => {
      await createProject("超限结果不保存"); return { content: "x".repeat(65_536) };
    })).rejects.toThrow("大小限制");
    expect(await db.projects.count()).toBe(0);
    expect(await db.episodes.count()).toBe(0);
    expect((await db.agentToolCalls.get(call.id))?.result).toBeUndefined();
  });

  it("rejects foreign run/call and thread combinations before invoking a mutation", async () => {
    const owner = await begin(); const call = await pendingCall(owner);
    const other = await begin();
    await transitionToolCall(owner.id, call.id, ["pending"], "running");
    const mutate = vi.fn(async () => createProject("越界"));
    for (const context of [
      { runId: other.id, threadId: other.threadId, callId: call.id },
      { runId: owner.id, threadId: other.threadId, callId: call.id },
    ]) await expect(executeAtomicTool({ ...context, signal: new AbortController().signal }, mutate)).rejects.toBeInstanceOf(AtomicToolRollbackError);
    expect(mutate).not.toHaveBeenCalled();
    expect(await db.projects.count()).toBe(0);
  });
});

describe("prepared approvals and known rollback continuation", () => {
  it("refuses an approved call if the registry's atomic contract changed", async () => {
    const run = await begin("ask"); const tool = fixtureTool();
    await executeChatRun(run, connector.apiKey, new AbortController(), vi.fn(async () => responseWithTool()), [tool]);
    const call = (await db.agentToolCalls.where("runId").equals(run.id).toArray())[0];
    await resolveAgentToolApproval(run.id, call.id, "approve");
    const fetcher = vi.fn(async () => answer());
    await resumeChatRun(run.id, connector.apiKey, new AbortController(), fetcher, [{ ...tool, atomic: false }]);
    expect(tool.execute).not.toHaveBeenCalled();
    expect(fetcher).not.toHaveBeenCalled();
    expect((await db.agentRuns.get(run.id))?.error).toContain("定义已变化");
    expect(await db.projects.count()).toBe(0);
  });

  it.each(["ask", "full"] as const)("recovers an uncommitted atomic call in %s mode and keeps its original preview", async (mode) => {
    const run = await begin(mode); const tool = fixtureTool();
    let call;
    if (mode === "ask") {
      await executeChatRun(run, connector.apiKey, new AbortController(), vi.fn(async () => responseWithTool()), [tool]);
      call = (await db.agentToolCalls.where("runId").equals(run.id).toArray())[0];
      await resolveAgentToolApproval(run.id, call.id, "approve");
      await resumeAgentRun(run.id);
      await transitionToolCall(run.id, call.id, ["approved"], "running");
    } else {
      call = await pendingCall(run);
      await saveToolPreview(run.id, call.id, preview);
      await transitionToolCall(run.id, call.id, ["pending"], "running");
    }
    // Simulate a close after claim but before the atomic transaction commits.
    db.close(); await db.open();
    await interruptThreadRuns(run.threadId);
    expect(await db.agentToolCalls.get(call.id)).toMatchObject({ status: mode === "ask" ? "approved" : "pending", preview });
    expect((await db.agentRuns.get(run.id))?.status).toBe("interrupted");
    expect(await db.projects.count()).toBe(0);
    await resumeChatRun(run.id, connector.apiKey, new AbortController(), vi.fn(async () => answer()), [tool]);
    expect(tool.prepare).toHaveBeenCalledTimes(mode === "ask" ? 1 : 0);
    expect(tool.execute).toHaveBeenCalledTimes(1);
    expect(await db.projects.count()).toBe(1);
    expect((await db.agentToolCalls.get(call.id))?.status).toBe("completed");
  });

  it.each(["startup", "runtime-catch"] as const)("keeps old network outcomes unknown while recovering atomic claims during %s", async (path) => {
    const run = await begin();
    await saveToolRound(run.id, "", ["local", "remote"].map((id) => ({ id, type: "function" as const, function: { name: toolName, arguments: "{}" } })), [
      { title: "本地事务", effect: "write", highRisk: false, atomic: true },
      { title: "旧网络操作", effect: "network", highRisk: false },
    ]);
    const calls = await db.agentToolCalls.where("runId").equals(run.id).toArray();
    for (const call of calls) await transitionToolCall(run.id, call.id, ["pending"], "running");
    if (path === "startup") await interruptThreadRuns(run.threadId);
    else { await markRunningToolsUnknown(run.id); await db.agentRuns.update(run.id, { status: "interrupted" }); }
    const recovered = await db.agentToolCalls.where("runId").equals(run.id).toArray();
    expect(recovered.find((call) => call.providerCallId === "local")?.status).toBe("pending");
    expect(recovered.find((call) => call.providerCallId === "remote")?.status).toBe("unknown");
    await expect(resumeAgentRun(run.id)).rejects.toThrow("不确定");
    expect(await db.projects.count()).toBe(0);
  });

  it("saves an immutable preview, refuses foreign replacement, and passes it through reload and approval", async () => {
    const source = structuredClone(preview);
    const tool = fixtureTool({ prepare: vi.fn(async () => source) });
    const run = await begin("ask");
    const request = vi.fn(async () => responseWithTool());
    await executeChatRun(run, connector.apiKey, new AbortController(), request, [tool]);
    const call = (await db.agentToolCalls.where("runId").equals(run.id).toArray())[0];
    expect(call).toMatchObject({ status: "awaiting_approval", preview });
    expect(tool.execute).not.toHaveBeenCalled();
    expect(request).toHaveBeenCalledTimes(1);
    source.changes[0] = "unapproved replacement";
    await expect(saveToolPreview(run.id, call.id, source)).rejects.toThrow();
    const other = await begin();
    await expect(saveToolPreview(other.id, call.id, source)).rejects.toThrow();
    db.close(); await db.open();
    await resolveAgentToolApproval(run.id, call.id, "approve");
    await resumeChatRun(run.id, connector.apiKey, new AbortController(), vi.fn(async () => answer()), [tool]);
    expect(tool.prepare).toHaveBeenCalledTimes(1);
    expect(tool.execute).toHaveBeenCalledExactlyOnceWith({}, expect.objectContaining({ preview }));
    expect((await db.agentToolCalls.get(call.id))?.preview).toEqual(preview);
    expect((await db.agentRuns.get(run.id))?.status).toBe("completed");
    expect(await db.projects.count()).toBe(1);
  });

  it("refuses replacing a preview even while its call is still pending", async () => {
    const run = await begin(); const call = await pendingCall(run);
    await saveToolPreview(run.id, call.id, preview);
    await expect(saveToolPreview(run.id, call.id, { ...preview, revision: "new-unapproved-revision" })).rejects.toThrow("不能替换");
    expect((await db.agentToolCalls.get(call.id))?.preview).toEqual(preview);
  });

  it("turns prepare failures into known failures and lets the model respond without mutation or approval", async () => {
    const tool = fixtureTool({ prepare: vi.fn(async () => { throw new Error("目标已改变"); }) });
    const run = await begin("ask"); let requests = 0;
    const fetcher = vi.fn(async () => ++requests === 1 ? responseWithTool() : answer());
    await executeChatRun(run, connector.apiKey, new AbortController(), fetcher, [tool]);
    expect(tool.execute).not.toHaveBeenCalled();
    expect((await db.agentToolCalls.where("runId").equals(run.id).toArray())[0]).toMatchObject({ status: "failed", error: "目标已改变", result: JSON.stringify({ error: "目标已改变" }) });
    expect((await db.agentRuns.get(run.id))?.status).toBe("completed");
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(await db.projects.count()).toBe(0);
  });

  it("continues after a known atomic rollback without marking the mutation unknown", async () => {
    const tool = fixtureTool({ execute: vi.fn(async (_args, context) => executeAtomicTool(context, async () => {
      await createProject("必须回滚"); throw new Error("stale revision");
    })) });
    const run = await begin(); let requests = 0;
    await executeChatRun(run, connector.apiKey, new AbortController(), vi.fn(async () => ++requests === 1 ? responseWithTool() : answer()), [tool]);
    const call = (await db.agentToolCalls.where("runId").equals(run.id).toArray())[0];
    expect(call).toMatchObject({ status: "failed", error: "stale revision", result: JSON.stringify({ error: "stale revision" }) });
    expect((await db.agentRuns.get(run.id))?.status).toBe("completed");
    expect((await db.agentRuns.get(run.id))?.continuationMessages).toContainEqual({ role: "tool", tool_call_id: call.providerCallId, content: call.result });
    expect(await db.projects.count()).toBe(0);
    expect(await db.episodes.count()).toBe(0);
    expect(requests).toBe(2);
  });
});
