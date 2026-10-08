import { describe, expect, it } from "vitest";
import type { AudioGenerationJob, AudioTaskObservation } from "@/domain/audioGeneration";
import { describeAudioGeneration } from "@/lib/audioGeneration/presentation";
import { audioJobSummary } from "@/lib/audioGeneration/runtime";

function job(patch: Partial<AudioGenerationJob> = {}): AudioGenerationJob {
  return { id: "job", projectId: "project", revision: 3, intentId: "intent", createdAt: "2026-09-22T00:00:00.000Z", updatedAt: "2026-09-22T00:01:00.000Z",
    connector: { id: "connection", provider: "apimart", baseUrl: "https://fixture.invalid/v1" },
    input: { kind: "music", draftId: "draft", draftRevision: 4, settings: { engine: "flowmusic", title: "Song", soundPrompt: "piano", lyrics: "" } },
    source: { kind: "agent", runId: "original-run", callId: "original-submit" }, status: "submitted", taskIds: ["remote"], results: [], ...patch };
}
function observation(status: AudioTaskObservation["status"], taskId = "remote"): AudioTaskObservation {
  return { taskId, status, checkedAt: "2026-09-22T00:02:00.000Z" };
}

describe("shared sound job state presentation", () => {
  it("never labels legacy running or unqueried submissions as verified processing", () => {
    expect(describeAudioGeneration(job()).label).toBe("已提交，待查询");
    expect(describeAudioGeneration(job({ status: "running" })).label).toBe("已提交，待核实进度");
    expect(describeAudioGeneration(job()).checkedAt).toBeUndefined();
  });
  it.each([
    ["pending", "最近查询：排队中"], ["processing", "最近查询：生成中"],
    ["unknown", "服务商状态未知"], ["query-failed", "查询失败，进度待核实"],
  ] as const)("presents %s as its observed state", (status, label) => {
    expect(describeAudioGeneration(job({ status: status === "processing" ? "running" : "submitted", taskObservations: [observation(status)] }))).toMatchObject({ label, checkedAt: "2026-09-22T00:02:00.000Z" });
  });
  it("does not promote an unchecked sibling's older processing record during a partial refresh", () => {
    const data = job({ status: "submitted", taskIds: ["fresh", "older"], taskObservations: [
      observation("completed", "fresh"),
      { ...observation("processing", "older"), checkedAt: "2026-09-22T00:01:00.000Z" },
    ] });
    const summary = describeAudioGeneration(data);
    expect(summary.label).toBe("部分进度待核实");
    expect(summary.detail).toContain("各任务最近记录");
    expect(summary.counts.processing).toBe(1);
    expect(audioJobSummary(data).statusLabel).toBe(summary.label);
  });
  it("does not substitute old processing evidence for a failed current query", () => {
    const summary = describeAudioGeneration(job({ taskObservations: [{ ...observation("query-failed"), lastVerified: { status: "processing", observedAt: "2026-09-22T00:01:00.000Z" } }] }));
    expect(summary.counts.processing).toBe(0);
    expect(summary.counts.queryFailed).toBe(1);
    expect(summary.label).not.toContain("生成中");
  });
  it("keeps mixed task observations visible while local saving is a separate phase", () => {
    const data = job({ status: "downloading", taskIds: ["a", "b", "c"], taskObservations: [observation("completed", "a"), observation("pending", "b"), observation("failed", "c")] });
    expect(describeAudioGeneration(data)).toMatchObject({ label: "保存音频中", counts: { completed: 1, pending: 1, failed: 1, processing: 0 } });
    expect(describeAudioGeneration(data).detail).toContain("远端失败 1");
  });
  it("ignores foreign task metadata and counts missing coverage conservatively", () => {
    const summary = describeAudioGeneration(job({ taskIds: ["remote", "missing"], taskObservations: [observation("processing"), observation("processing"), observation("processing", "foreign")] }));
    expect(summary.counts.processing).toBe(1);
    expect(summary.counts.unobserved).toBe(1);
    expect(summary.label).toBe("已提交，部分进度未查询");
  });
  it("keeps remote completion, local saving and removed outputs distinguishable", () => {
    expect(describeAudioGeneration(job({ status: "remote-completed" })).label).toBe("远端已完成，等待保存");
    const result = { key: "remote:1", title: "Song", deleted: true, provenance: { provider: "apimart" as const, model: "flowmusic", audioUrl: "https://private.example/audio?token=secret" } };
    const data = job({ status: "saved", results: [result] });
    expect(describeAudioGeneration(data).label).toContain("作品已移除");
    const summary = audioJobSummary(data);
    expect(summary.results[0].deleted).toBe(true);
    expect(JSON.stringify(summary)).not.toContain("private.example");
    expect(JSON.stringify(summary)).not.toContain("secret");
  });
  it("returns original source, draft version and job version without claiming a new submission", () => {
    const summary = audioJobSummary(job({ taskObservations: [observation("processing")] }));
    expect(summary).toMatchObject({ revision: 3, draftId: "draft", draftRevision: 4, source: { runId: "original-run", callId: "original-submit" }, checkedAt: "2026-09-22T00:02:00.000Z" });
    expect(summary.note).toContain("查询不代表本轮新提交");
    expect(summary.note).toContain("未试听");
  });
});
