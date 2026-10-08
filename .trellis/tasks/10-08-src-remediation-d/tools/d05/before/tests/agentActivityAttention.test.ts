import { describe, expect, it } from "vitest";
import { selectActivityAttention } from "@/lib/agent/activityAttention";

type Input = Parameters<typeof selectActivityAttention>[0];
const run: Input["runs"][number] = { id: "run", threadId: "thread", status: "completed", hasToolCalls: true, createdAt: "2026-09-21T00:00:00Z" };
const batch: Input["batches"][number] = { id: "batch", threadId: "thread", runId: "run", status: "draft", title: "镜头候选" };
const call: Input["calls"][number] = { id: "call", threadId: "thread", runId: "run", status: "awaiting_approval", title: "修改项目" };
const input = (patch: Partial<Input> = {}): Input => ({ threadId: "thread", runs: [run], calls: [], batches: [], items: [], jobs: [], tasks: [], messages: [], ...patch });

describe("composer activity attention", () => {
  it("keeps draft confirmation visible after its model run completed", () => {
    expect(selectActivityAttention(input({ batches: [batch] }))).toMatchObject([{ kind: "batch", label: "待你确认生成", target: { runId: "run", batchId: "batch" } }]);
  });
  it("keeps multiple independently actionable batches and approvals", () => {
    const result = selectActivityAttention(input({ runs: [{ ...run, status: "waiting_approval" }], batches: [batch, { ...batch, id: "second" }], calls: [call, { ...call, id: "second-call" }] }));
    expect(result.map(row => row.id)).toEqual(["call:call", "call:second-call", "batch:batch", "batch:second"]);
  });
  it("scopes every row to the current thread and owned runs", () => {
    expect(selectActivityAttention(input({ batches: [{ ...batch, threadId: "other" }, { ...batch, runId: "missing" }], calls: [{ ...call, status: "unknown", threadId: "other" }], jobs: [{ id: "foreign", threadId: "other", runId: "run", batchId: "batch", status: "unknown" }] }))).toEqual([]);
  });
  it("does not direct users to stale approvals or recovery after a newer run or user message", () => {
    const paused = { ...run, status: "waiting_approval" as const };
    expect(selectActivityAttention(input({ runs: [paused, { ...run, id: "new", createdAt: "2026-09-21T01:00:00Z" }], calls: [call] }))).toEqual([]);
    expect(selectActivityAttention(input({ runs: [paused], calls: [call], messages: [{ threadId: "thread", role: "user", createdAt: "2026-09-21T00:01:00Z" }] }))).toEqual([]);
    expect(selectActivityAttention(input({ runs: [paused, { ...run, id: "same-time" }], calls: [call] }))).toEqual([]);
  });
  it("gives unknown results priority and never suggests approving/resuming unresolved operations", () => {
    const result = selectActivityAttention(input({ runs: [{ ...run, status: "failed" }], calls: [call, { ...call, id: "unknown", status: "unknown" }], batches: [batch] }));
    expect(result.map(row => row.kind)).toEqual(["unknown", "batch"]);
    expect(result[0].target.callId).toBe("unknown");
  });
  it("reports batch unknown acceptance even on cancelled batches and closed tasks, without offering execution", () => {
    const result = selectActivityAttention(input({ batches: [{ ...batch, status: "cancelled", taskId: "task" }], tasks: [{ id: "task", threadId: "thread", lifecycle: "completed" }], jobs: [{ id: "job", threadId: "thread", runId: "run", batchId: "batch", status: "unknown" }] }));
    expect(result).toMatchObject([{ kind: "unknown", action: "查看批次", detail: "镜头候选 · 当前仅可查看记录" }]);
  });
  it("does not show actionable drafts or approval for closed/missing tasks or missing projects", () => {
    expect(selectActivityAttention(input({ runs: [{ ...run, status: "waiting_approval", taskId: "missing" }], calls: [call], batches: [{ ...batch, taskId: "missing" }] }))).toEqual([]);
    expect(selectActivityAttention(input({ runs: [{ ...run, status: "waiting_approval" }], calls: [call], batches: [batch], projectUnavailable: true }))).toEqual([]);
  });
  it("only suggests continuing a batch with queued or accepted outstanding work", () => {
    expect(selectActivityAttention(input({ batches: [{ ...batch, status: "paused" }] }))).toEqual([]);
    expect(selectActivityAttention(input({ batches: [{ ...batch, status: "paused" }], items: [{ batchId: "batch", threadId: "thread", state: "queued" }] }))).toMatchObject([{ label: "批次已暂停" }]);
    expect(selectActivityAttention(input({ batches: [{ ...batch, status: "ready" }], jobs: [{ id: "job", threadId: "thread", runId: "run", batchId: "batch", status: "submitted" }] }))).toMatchObject([{ label: "批次等待开始" }]);
  });
  it("offers saved progress navigation only for the recoverable latest run", () => {
    expect(selectActivityAttention(input({ runs: [{ ...run, status: "interrupted", pauseReason: "model_step_limit" }] }))).toMatchObject([{ kind: "resume", label: "阶段已暂停" }]);
    expect(selectActivityAttention(input({ runs: [{ ...run, status: "interrupted", hasToolCalls: false }] }))).toEqual([]);
  });
  it("deduplicates a single unknown generation job with its unknown call", () => {
    expect(selectActivityAttention(input({ calls: [{ ...call, status: "unknown" }], jobs: [{ id: "job", threadId: "thread", runId: "run", callId: "call", status: "unknown" }] }))).toHaveLength(1);
  });
});
