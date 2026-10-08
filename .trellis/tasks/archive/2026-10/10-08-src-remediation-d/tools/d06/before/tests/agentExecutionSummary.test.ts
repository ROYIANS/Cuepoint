import { describe, expect, it } from "vitest";
import type { AgentRun, AgentToolCall } from "@/domain/agent";
import { describeRunExecution } from "@/lib/agent/executionSummary";

const run = (patch: Partial<AgentRun> = {}): AgentRun => ({
  id: "run", threadId: "thread", agentId: "agent", agentSnapshot: { name: "助手", instructions: "private-prompt" },
  userMessageId: "user", assistantMessageId: "assistant", model: "private-model", connector: { id: "connector", definitionId: "openai-compatible", baseUrl: "https://private.example/v1" },
  requestMessages: [], status: "completed", checkpoint: 0, createdAt: "2026-09-22", updatedAt: "2026-09-22", ...patch,
});
const call = (patch: Partial<AgentToolCall> = {}): AgentToolCall => ({
  id: "call", runId: "run", threadId: "thread", providerCallId: "provider-call", step: 1, order: 0, name: "audio_read", title: "读取音频", arguments: "private-arguments", effect: "read", highRisk: false,
  status: "completed", result: "private-result", createdAt: "2026-09-22", updatedAt: "2026-09-22", ...patch,
});

describe("truthful owned execution summaries", () => {
  it("distinguishes a no-tool answer from neutral conversation mode", () => {
    expect(describeRunExecution(run(), [])).toMatchObject({ kind: "reply", label: "仅回复，未调用工具", counts: { total: 0, completed: 0, failed: 0, rejected: 0, waiting: 0, unknown: 0 } });
    const conversation = describeRunExecution(run({ interactionMode: "conversation" }), []);
    expect(conversation).toMatchObject({ kind: "conversation", label: "回复已结束" });
    expect(conversation.detail).not.toMatch(/未调用|失败|警告|需要|必须/);
  });

  it("does not present a plan or completed bookkeeping as business execution", () => {
    const plan = [{ id: "first", title: "已生成整部有声书", status: "completed" as const }, { id: "second", title: "private-plan-title", status: "pending" as const }];
    const summary = describeRunExecution(run({ plan }), [call({ effect: "bookkeeping", name: "update_run_plan" })]);
    expect(summary).toMatchObject({ kind: "preparation", label: "仅准备，未执行业务", counts: { completed: 1 } });
    expect(summary.detail).toContain("计划仍有 1 项未标记完成");
    expect(summary.detail).not.toContain("已生成整部有声书");
    expect(describeRunExecution(run({ plan }), []).kind).toBe("reply");
  });

  it("distinguishes completed reads from successful write and network call records", () => {
    expect(describeRunExecution(run(), [call(), call({ id: "plan", effect: "bookkeeping" })]))
      .toMatchObject({ kind: "read", label: "已读取，未执行修改" });
    for (const effect of ["write", "network"] as const) {
      const summary = describeRunExecution(run(), [call({ effect, result: JSON.stringify({ status: "submitted", saved: false }) })]);
      expect(summary).toMatchObject({ kind: "tools", label: "工具调用已结束" });
      expect(summary.detail).toContain("不代表生成结果已保存");
      expect(summary.detail).toContain("不代表整个目标完成");
      expect(summary.detail).not.toContain("submitted");
    }
  });

  it("filters calls by both run and thread before choosing status or counts", () => {
    const foreign = [call({ runId: "other-run", status: "unknown" }), call({ threadId: "other-thread", status: "awaiting_approval" })];
    expect(describeRunExecution(run(), foreign)).toMatchObject({ kind: "reply", counts: { total: 0, unknown: 0, waiting: 0 } });
    expect(describeRunExecution(run(), [...foreign, call()])).toMatchObject({ kind: "read", counts: { total: 1, completed: 1 } });
  });

  it.each(["running", "waiting_approval", "completed", "failed", "interrupted", "cancelled"] as const)("prioritizes unknown effects over %s run state and approval", status => {
    expect(describeRunExecution(run({ status, pauseReason: "model_step_limit" }), [call({ status: "unknown" }), call({ id: "approval", status: "awaiting_approval" })]))
      .toMatchObject({ kind: "unknown", counts: { total: 2, unknown: 1, waiting: 1 } });
  });

  it.each(["waiting_approval", "completed", "failed", "interrupted"] as const)("keeps actionable approvals visible on a %s run", status => {
    const summary = describeRunExecution(run({ status, pauseReason: "model_step_limit" }), [call({ status: "awaiting_approval" })]);
    expect(summary).toMatchObject({ kind: "approval", label: "等待确认", counts: { waiting: 1 } });
    if (status === "failed") expect(summary.detail).toContain("执行曾失败");
    if (status === "interrupted") expect(summary.detail).toContain("执行已中断");
  });

  it("keeps approval parking transient while running and does not revive cancelled approval", () => {
    const waiting = [call({ status: "awaiting_approval" })];
    expect(describeRunExecution(run({ status: "running" }), waiting).kind).toBe("running");
    expect(describeRunExecution(run({ status: "cancelled" }), waiting).kind).toBe("cancelled");
    expect(describeRunExecution(run({ status: "waiting_approval" }), []).label).toBe("等待确认");
  });

  it("keeps active states ahead of stale pause reasons and only labels actual budget pauses", () => {
    expect(describeRunExecution(run({ status: "running", pauseReason: "model_step_limit" }), [call({ status: "running" })]))
      .toMatchObject({ kind: "running", label: "正在调用工具" });
    expect(describeRunExecution(run({ status: "running" }), [call({ status: "approved" })]).detail).toContain("等待执行");
    expect(describeRunExecution(run({ status: "interrupted", pauseReason: "model_step_limit" }), [call()]).kind).toBe("budget");
    expect(describeRunExecution(run({ status: "completed", pauseReason: "model_step_limit" }), [call()]).kind).toBe("read");
    expect(describeRunExecution(run({ status: "failed", error: "model_step_limit budget quota" }), []).kind).toBe("failed");
  });

  it.each(["failed", "interrupted", "cancelled"] as const)("preserves %s lifecycle even with previously completed calls", status => {
    const summary = describeRunExecution(run({ status }), [call({ effect: "write" }), call({ id: "failure", status: "failed" })]);
    expect(summary.kind).toBe(status);
    expect(summary.detail).toContain("1 项调用失败");
    expect(summary.counts).toMatchObject({ total: 2, completed: 1, failed: 1 });
  });

  it.each(["pending", "approved", "running"] as const)("does not mark terminal %s ledger rows as finished", status => {
    expect(describeRunExecution(run(), [call({ status })])).toMatchObject({ kind: "pending", counts: { total: 1, completed: 0 } });
  });

  it("preserves failures and rejections even if later writes complete", () => {
    const summary = describeRunExecution(run(), [call({ status: "failed" }), call({ id: "rejected", status: "rejected", effect: "network" }), call({ id: "write", effect: "write" })]);
    expect(summary).toMatchObject({ kind: "failed", label: "工具调用存在失败或拒绝", counts: { total: 3, failed: 1, rejected: 1, completed: 1 } });
    expect(summary.detail).toContain("1 项调用失败");
    expect(summary.detail).toContain("1 项调用被拒绝");
  });

  it("marks a missing legacy ledger incomplete instead of claiming zero tools ran", () => {
    const summary = describeRunExecution(run({ hasToolCalls: true }), [call({ runId: "other" })]);
    expect(summary).toMatchObject({ kind: "incomplete", label: "执行记录不完整" });
    expect(summary.detail).toContain("无法确认调用数量");
    expect(summary).not.toHaveProperty("modelSteps");
    expect(summary).not.toHaveProperty("offeredTools");
    expect(summary).not.toHaveProperty("protocol");
    expect(describeRunExecution(run({ hasToolCalls: false }), [call()]).kind).toBe("read");
  });

  it("reports actual current-step offers only, without falling back to permissions or prior steps", () => {
    const base = run({ modelStep: 3, protocol: "responses", enabledToolNames: ["a", "b", "c"], offeredTools: [{ step: 1, names: ["a"] }, { step: 3, names: ["a", "a", "b"] }, { step: 4, names: ["a", "b", "c"] }] });
    const originalOffers = structuredClone(base.offeredTools);
    expect(describeRunExecution(base, [])).toMatchObject({ modelSteps: 3, offeredTools: 2, protocol: "responses" });
    expect(base.offeredTools).toEqual(originalOffers);
    expect(describeRunExecution({ ...base, modelStep: 2 }, [])).not.toHaveProperty("offeredTools");
    expect(describeRunExecution({ ...base, offeredTools: [{ step: 3, names: [] }] }, []).offeredTools).toBe(0);
    expect(describeRunExecution({ ...base, offeredTools: [{ step: 3, names: ["old"] }, { step: 3, names: ["a", "b"] }] }, []).offeredTools).toBe(2);
  });

  it.each([undefined, -1, NaN, Infinity])("omits invalid or unknown model step %s", modelStep => {
    const summary = describeRunExecution(run({ modelStep, offeredTools: [{ step: 0, names: [] }] }), []);
    expect(summary).not.toHaveProperty("modelSteps");
    expect(summary).not.toHaveProperty("offeredTools");
  });

  it("retains a recorded zero model step and never copies raw diagnostic text", () => {
    const summary = describeRunExecution(run({ modelStep: 0, error: "secret-key: private-error", protocol: "chat-completions", finishReason: "private-provider-finish", plan: [{ id: "p", title: "private-plan-title", status: "pending" }] }), [call({ error: "private-call-error", status: "failed" })]);
    expect(summary).toMatchObject({ modelSteps: 0, protocol: "chat-completions" });
    expect(JSON.stringify(summary)).not.toMatch(/private-|secret-key/);
  });
});
