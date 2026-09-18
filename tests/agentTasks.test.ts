import { describe, expect, it, vi } from "vitest";
import { db } from "@/db/database";
import { createAgentTask, createAgentTaskForThread, updateAgentTask, setAgentTaskLifecycle, pinAgentTaskResult, unpinAgentTaskResult } from "@/db/agentTasks";
import { beginAgentRun, finishAgentRun } from "@/db/agentRuns";
import { saveToolRound, transitionToolCall, updateRunPlanAndComplete } from "@/db/agentTools";
import { createChatThread, deleteChatThread } from "@/db/repo";
import { getTaskDisplayState, isTaskBusy } from "@/lib/agent/taskState";
import { executeChatRun } from "@/lib/agent/runChat";
import type { AgentPlanItem } from "@/domain/agent";
import type { ConnectorConfig } from "@/domain/types";

const connector: ConnectorConfig = { id: "cx", name: "test", definitionId: "openai-compatible", baseUrl: "https://example.test/v1", apiKey: "fixture", updatedAt: "2026-09-19" };
const plan: AgentPlanItem[] = [{ id: "outline", title: "整理故事主题", status: "pending" }];
async function runTask() {
  const task = await createAgentTask({ title: "整理故事", goal: "产出一份完整故事提纲", plan });
  const run = await beginAgentRun({ threadId: task.threadId, connector, model: "model", content: "请开始" });
  return { task, run };
}

describe("unified task workspace", () => {
  it("creates manual tasks atomically without a connector and survives reopening the database", async () => {
    await expect(createAgentTask({ title: "", goal: "goal" })).rejects.toThrow();
    expect(await db.chatThreads.count()).toBe(0);
    const task = await createAgentTask({ title: "手动任务", goal: "手动整理即可", plan });
    expect(await db.connectors.count()).toBe(0);
    expect(await db.agentRuns.count()).toBe(0);
    expect(await db.chatThreads.get(task.threadId)).toMatchObject({ title: "手动任务" });
    db.close(); await db.open();
    expect(await db.agentTasks.get(task.id)).toEqual(task);
    expect(getTaskDisplayState(task, [])).toBe("pending");
    expect(await createAgentTaskForThread(task.threadId, { title: "duplicate", goal: "duplicate" })).toEqual(task);
    expect(await db.agentTasks.count()).toBe(1);
  });
  it("projects manually started and finished checklists without inventing model execution", async () => {
    const task = await createAgentTask({ title: "手动", goal: "人工完成", plan });
    expect(getTaskDisplayState({ ...task, plan: [{ ...plan[0], status: "in_progress" }] }, [])).toBe("running");
    expect(getTaskDisplayState({ ...task, plan: [{ ...plan[0], status: "completed" }] }, [])).toBe("review");
    expect(isTaskBusy([])).toBe(false);
  });
  it("creates exactly one task in task mode, no task in Q&A and none on invalid input", async () => {
    const thread = await createChatThread();
    await expect(beginAgentRun({ threadId: thread.id, connector, model: "model", content: "", createTask: true })).rejects.toThrow();
    expect(await db.agentTasks.count()).toBe(0);
    const ordinary = await beginAgentRun({ threadId: thread.id, connector, model: "model", content: "你好" });
    expect(ordinary.taskId).toBeUndefined();
    expect(await db.agentTasks.count()).toBe(0);
    await finishAgentRun(ordinary.id, "completed", { content: "你好" });
    const run = await beginAgentRun({ threadId: thread.id, connector, model: "model", content: "规划作品", createTask: true });
    const task = (await db.agentTasks.toArray())[0];
    expect(task.goal).toBe("规划作品");
    expect(run.taskId).toBe(task.id);
    expect(run.agentSnapshot.instructions).toContain(task.goal);
    await finishAgentRun(run.id, "failed");
    const retry = await beginAgentRun({ threadId: thread.id, connector, model: "model", retryOfRunId: run.id, createTask: true });
    expect(retry.taskId).toBe(task.id);
    expect(retry.requestMessages).toEqual(run.requestMessages);
    expect(await db.agentTasks.count()).toBe(1);
  });
  it("rolls back task creation if its first execution message cannot be saved", async () => {
    const thread = await createChatThread();
    const failure = vi.spyOn(db.chatMessages, "add").mockRejectedValueOnce(new Error("storage unavailable"));
    try {
      await expect(beginAgentRun({ threadId: thread.id, connector, model: "model", content: "任务目标", createTask: true })).rejects.toThrow("storage unavailable");
    } finally { failure.mockRestore(); }
    expect(await db.agentTasks.count()).toBe(0);
    expect(await db.agentRuns.count()).toBe(0);
    expect(await db.chatMessages.count()).toBe(0);
  });
  it("shares tool plans with the task and future turns but preserves old run snapshots", async () => {
    const { task, run } = await runTask();
    const nextPlan: AgentPlanItem[] = [{ ...plan[0], status: "completed" }];
    let calls = 0;
    const fetcher = vi.fn(async () => ++calls === 1
      ? Response.json({ choices: [{ message: { content: "", tool_calls: [{ id: "plan-call", type: "function", function: { name: "update_run_plan", arguments: JSON.stringify({ steps: nextPlan }) } }] }, finish_reason: "tool_calls" }] })
      : Response.json({ choices: [{ message: { content: "主题已整理" }, finish_reason: "stop" }] }));
    await executeChatRun(run, connector.apiKey, new AbortController(), fetcher);
    const saved = (await db.agentTasks.get(task.id))!;
    expect(saved.plan).toEqual(nextPlan);
    expect((await db.agentRuns.get(run.id))?.plan).toEqual(nextPlan);
    expect((await db.agentToolCalls.toArray())[0]).toMatchObject({ status: "completed", result: JSON.stringify({ plan: nextPlan }) });
    expect(getTaskDisplayState(saved, await db.agentRuns.toArray())).toBe("review");
    await updateAgentTask(task.id, { plan: [{ id: "next", title: "完善场景", status: "pending" }] });
    expect((await db.agentRuns.get(run.id))?.plan).toEqual(nextPlan);
    const next = await beginAgentRun({ threadId: task.threadId, connector, model: "model", content: "继续" });
    expect(next.taskId).toBe(task.id);
    expect(next.requestMessages[0].content).toContain("完善场景");
  });
  it("refuses concurrent manual edits and lifecycle changes including recoverable runs", async () => {
    const { task, run } = await runTask();
    await expect(updateAgentTask(task.id, { goal: "overwrite" })).rejects.toThrow("当前执行");
    await expect(setAgentTaskLifecycle(task.id, "archived")).rejects.toThrow("当前执行");
    await db.agentRuns.update(run.id, { status: "interrupted", hasToolCalls: true });
    expect(isTaskBusy(await db.agentRuns.toArray())).toBe(true);
    await expect(setAgentTaskLifecycle(task.id, "completed")).rejects.toThrow("当前执行");
    await db.agentRuns.update(run.id, { status: "cancelled" });
    await updateAgentTask(task.id, { goal: "新目标" });
    expect((await db.agentTasks.get(task.id))?.goal).toBe("新目标");
  });
  it.each(["missing-task", "ledger-write-failure"] as const)("keeps plans and ledger atomic on %s", async (failureKind) => {
    const { task, run } = await runTask();
    const nextPlan: AgentPlanItem[] = [{ ...plan[0], status: "completed" }];
    await saveToolRound(run.id, "", [{ id: "plan-call", type: "function", function: { name: "update_run_plan", arguments: JSON.stringify({ steps: nextPlan }) } }], [{ title: "更新计划", effect: "bookkeeping", highRisk: false }]);
    const call = (await db.agentToolCalls.where("runId").equals(run.id).toArray())[0];
    await transitionToolCall(run.id, call.id, ["pending"], "running");
    if (failureKind === "missing-task") await db.agentTasks.delete(task.id);
    const failure = failureKind === "ledger-write-failure"
      ? vi.spyOn(db.agentToolCalls, "update").mockRejectedValueOnce(new Error("ledger unavailable"))
      : undefined;
    try {
      await expect(updateRunPlanAndComplete(run.id, call.id, nextPlan)).rejects.toThrow(
        failureKind === "missing-task" ? "关联任务不可修改" : "ledger unavailable",
      );
    } finally { failure?.mockRestore(); }
    expect((await db.agentRuns.get(run.id))?.plan).toEqual(plan);
    expect((await db.agentToolCalls.get(call.id))?.status).toBe("running");
    expect((await db.agentToolCalls.get(call.id))?.result).toBeUndefined();
    if (failureKind === "ledger-write-failure") expect((await db.agentTasks.get(task.id))?.plan).toEqual(plan);
  });
  it("requires explicit completion, validates plans and supports reopen/archive", async () => {
    const { task, run } = await runTask();
    await finishAgentRun(run.id, "completed", { content: "reply" });
    await expect(setAgentTaskLifecycle(task.id, "completed")).rejects.toThrow("未完成");
    await expect(updateAgentTask(task.id, { plan: [plan[0], plan[0]] })).rejects.toThrow();
    await updateAgentTask(task.id, { plan: [{ ...plan[0], status: "completed" }] });
    await setAgentTaskLifecycle(task.id, "completed");
    expect(getTaskDisplayState((await db.agentTasks.get(task.id))!, [run])).toBe("completed");
    await expect(beginAgentRun({ threadId: task.threadId, connector, model: "model", content: "继续" })).rejects.toThrow("重新打开");
    await setAgentTaskLifecycle(task.id, "archived");
    await expect(updateAgentTask(task.id, { title: "覆盖" })).rejects.toThrow("重新打开");
    await setAgentTaskLifecycle(task.id, "open");
    await updateAgentTask(task.id, { title: "重新编辑" });
  });
  it("pins only owned successful nonempty replies and cascades linked deletion", async () => {
    const { task, run } = await runTask();
    await finishAgentRun(run.id, "completed", { content: "可保存的成果" });
    const other = await createAgentTask({ title: "其他", goal: "另一个目标" });
    await expect(pinAgentTaskResult(other.id, run.id)).rejects.toThrow("当前任务");
    await pinAgentTaskResult(task.id, run.id); await pinAgentTaskResult(task.id, run.id);
    const artifact = (await db.agentTasks.get(task.id))!.artifacts[0];
    expect((await db.agentTasks.get(task.id))!.artifacts).toHaveLength(1);
    expect(artifact.messageId).toBe(run.assistantMessageId);
    await unpinAgentTaskResult(task.id, artifact.id);
    expect((await db.chatMessages.get(run.assistantMessageId))?.content).toBe("可保存的成果");
    await pinAgentTaskResult(task.id, run.id);
    await deleteChatThread(task.threadId);
    expect(await db.agentTasks.get(task.id)).toBeUndefined();
    expect(await db.agentRuns.get(run.id)).toBeUndefined();
    expect(await db.chatMessages.get(run.assistantMessageId)).toBeUndefined();
    expect(await db.agentTasks.get(other.id)).toBeDefined();
  });
});
