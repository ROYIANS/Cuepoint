import { describe, expect, it } from "vitest";
import { db } from "@/db/database";
import { createAudioMusicProject } from "@/db/repo";
import { createAgentTask } from "@/db/agentTasks";
import { beginAgentRun, finishAgentRun } from "@/db/agentRuns";
import { addAudioClip, addAudioSegment, addAudioTake } from "@/db/audio";
import { addMusicWork } from "@/db/music";
import { listTaskGenerationSources, taskGenerationSource, validateTaskSources } from "@/db/agentTaskRecords";
import { createManualWrapup, getTaskWrapupState, publishTaskWrapup, startTaskWrapup } from "@/db/agentTaskWrapups";
import { defaultMusicSettings } from "@/domain/music";
import type { AudioGenerationJob } from "@/domain/audioGeneration";
import type { AgentToolCall } from "@/domain/agent";
import type { ConnectorConfig } from "@/domain/types";
import { TASK_TOOLS } from "@/lib/agent/taskTools";

const connector: ConnectorConfig = { id: "chat", definitionId: "openai-compatible", baseUrl: "https://fixture.test/v1", apiKey: "fixture", updatedAt: "2026-09-22" };
const metadata = { durationSec: 3, sampleRate: 24000, channels: 1 };

async function fixture(kind: "audio" | "music" = "music") {
  const project = await createAudioMusicProject("声音作品", kind);
  const task = await createAgentTask({ projectId: project.id, title: "声音创作", goal: "生成并保存声音", acceptanceCriteria: ["声音文件已保存"] });
  const run = await beginAgentRun({ threadId: task.threadId, connector, model: "fixture", content: "开始生成" });
  const chapter = kind === "audio" ? (await db.audioChapters.where("projectId").equals(project.id).first())! : undefined;
  const segment = chapter ? await addAudioSegment(project.id, { chapterId: chapter.id, text: "你好", notes: "", order: 0 }) : undefined;
  const job: AudioGenerationJob = { id: "sound-job", projectId: project.id, revision: 1, intentId: "agent-audio:submit",
    input: kind === "audio" ? { kind: "speech", text: "你好", voice: "alloy", speed: 1, segmentId: segment!.id, segmentRevision: segment!.revision }
      : { kind: "music", settings: defaultMusicSettings(), draftId: "original-draft", draftRevision: 4 },
    connector: { id: "sound", provider: "apimart", baseUrl: "https://fixture.test/v1" }, source: { kind: "agent", runId: run.id, callId: "submit" },
    status: "saved", taskIds: ["remote-task"], taskObservations: [{ taskId: "remote-task", checkedAt: "2026-09-22T03:00:00.000Z", status: "completed", lastVerified: { status: "completed", observedAt: "2026-09-22T03:00:00.000Z" } }],
    results: [], createdAt: run.createdAt, updatedAt: run.createdAt };
  const media = { id: "sound-media", projectId: project.id, filename: "sound.wav", mimeType: "audio/wav", blob: new Blob(["fixture decoded audio"]) };
  const provenance = { provider: "apimart" as const, model: "fixture", jobId: job.id, taskId: "remote-task" };
  const output = kind === "audio"
    ? await addAudioTake(project.id, { ...metadata, mediaId: media.id, name: "配音", source: "tts", segmentId: segment!.id, provenance }, media)
    : await addMusicWork(project.id, { ...metadata, mediaId: media.id, title: "音乐", lyrics: "", notes: "", favorite: false, provenance }, media);
  job.results = [{ key: "result", title: "声音", mediaId: media.id, ...(kind === "audio" ? { takeId: output.id } : { workId: output.id }), provenance }];
  await db.audioGenerationJobs.add(job);
  const call: AgentToolCall = { id: "submit", runId: run.id, threadId: run.threadId, providerCallId: "submit", step: 1, order: 0,
    name: kind === "audio" ? "audio_generate_speech" : "music_generate", title: "生成声音", effect: "network", highRisk: false,
    arguments: JSON.stringify({ projectId: project.id }), status: "completed", decision: "approve", requiresConfirmation: true, result: JSON.stringify({ id: job.id, status: "saved", results: job.results }), createdAt: run.createdAt, updatedAt: run.createdAt };
  await db.agentToolCalls.add(call);
  await finishAgentRun(run.id, "completed", { content: "生成完成" });
  return { project, task, run, job, call, output, media, chapter, segment };
}

describe("sound task generation evidence", () => {
  it.each(["audio", "music"] as const)("resolves current saved %s output and retains original source and query time", async kind => {
    const f = await fixture(kind);
    const source = await taskGenerationSource(f.task, f.job.id);
    expect(source).toMatchObject({ available: true, supportsResult: true, applied: false });
    expect(JSON.parse(source.body)).toMatchObject({ source: f.job.source, checkedAt: "2026-09-22T03:00:00.000Z", status: "saved", outputs: { availableCount: 1, allAvailable: true } });
    if (kind === "music") expect(JSON.parse(source.body).target).toEqual({ draftId: "original-draft", draftRevision: 4 });
    await expect(validateTaskSources(f.task, [{ type: "generation", id: f.job.id }], "result", "ai")).resolves.toBeUndefined();
    await expect(validateTaskSources(f.task, [{ type: "tool", id: f.call.id }], "result", "ai")).resolves.toBeUndefined();
    expect(await listTaskGenerationSources(f.task)).toHaveLength(1);
    const wrap = await createManualWrapup(f.task.id);
    expect(wrap.snapshot.evidence.find(item => item.id === `generation:${f.job.id}`)).toMatchObject({ outcome: "downloaded", available: true, supportsResult: true });
  });

  it("does not permanently block completion for an abandoned preflight-only intent", async () => {
    const f = await fixture();
    await db.audioGenerationJobs.update(f.job.id, { status: "prepared", results: [], taskIds: [], taskObservations: undefined });
    await db.agentToolCalls.update(f.call.id, { status: "failed", error: "配置已变化，提交前检查失败", result: undefined });
    expect(await taskGenerationSource(f.task, f.job.id)).toMatchObject({ available: false, supportsResult: false });
    expect((await getTaskWrapupState(f.task.id)).completionBlockers).not.toContain("声音生成仍有进行中或待核实结果");
    await db.audioGenerationJobs.update(f.job.id, { status: "uncertain" });
    expect((await getTaskWrapupState(f.task.id)).completionBlockers).toContain("声音生成仍有进行中或待核实结果");
  });

  it("rejects remote completion without a locally saved work as a result claim", async () => {
    const f = await fixture();
    await db.audioGenerationJobs.update(f.job.id, { status: "remote-completed", results: [{ key: "remote", title: "远端结果", provenance: f.job.results[0].provenance }] });
    expect(await taskGenerationSource(f.task, f.job.id)).toMatchObject({ available: false, supportsResult: false });
    await expect(validateTaskSources(f.task, [{ type: "generation", id: f.job.id }], "observation", "ai")).resolves.toBeUndefined();
    await expect(validateTaskSources(f.task, [{ type: "generation", id: f.job.id }], "result", "ai")).rejects.toThrow("实际业务操作");
    const wrap = await startTaskWrapup(f.task.id, "ai");
    await expect(publishTaskWrapup(wrap.id, { ...wrap.content, overview: "完成", results: [{ text: "声音已交付", sourceIds: [`generation:${f.job.id}`] }] }, new AbortController().signal)).rejects.toThrow("真实来源");
    expect((await getTaskWrapupState(f.task.id)).completionBlockers).toContain("声音生成仍有进行中或待核实结果");
  });

  it.each(["delete-media", "tombstone", "empty-media", "wrong-media-owner"] as const)("invalidates old completed call and generation claims after %s", async mutation => {
    const f = await fixture();
    const first = await createManualWrapup(f.task.id);
    if (mutation === "delete-media") await db.media.delete(f.media.id);
    if (mutation === "empty-media") await db.media.update(f.media.id, { blob: new Blob([]) });
    if (mutation === "wrong-media-owner") await db.media.update(f.media.id, { projectId: "foreign-project" });
    if (mutation === "tombstone") await db.audioGenerationJobs.update(f.job.id, { results: f.job.results.map(result => ({ ...result, deleted: true })) });
    expect(await taskGenerationSource(f.task, f.job.id)).toMatchObject({ available: false, supportsResult: false });
    await expect(validateTaskSources(f.task, [{ type: "tool", id: f.call.id }], "result", "ai")).rejects.toThrow("实际业务操作");
    const current = await getTaskWrapupState(f.task.id);
    expect(current.latest?.id).toBe(first.id); expect(current.stale).toBe(true);
    expect(current.currentEvidence.find(item => item.id === `tool:${f.call.id}`)).toMatchObject({ outcome: "unresolved", supportsResult: false });
  });

  it("rejects foreign task/project and manual origins without adopting them through a query", async () => {
    const f = await fixture();
    const other = await createAgentTask({ projectId: f.project.id, title: "另一个任务", goal: "查看" });
    await expect(taskGenerationSource(other, f.job.id)).rejects.toThrow("不属于");
    expect(await listTaskGenerationSources(other)).toHaveLength(0);
    await db.audioGenerationJobs.update(f.job.id, { projectId: "foreign-project" });
    await expect(taskGenerationSource(f.task, f.job.id)).rejects.toThrow("不属于");
    await db.audioGenerationJobs.update(f.job.id, { projectId: f.project.id, source: { kind: "manual" } });
    await db.agentToolCalls.add({ ...f.call, id: "check", providerCallId: "check", name: "audio_generation_check", arguments: JSON.stringify({ projectId: f.project.id, jobId: f.job.id }) });
    await expect(validateTaskSources(f.task, [{ type: "tool", id: "check" }], "result", "ai")).rejects.toThrow("实际业务操作");
    expect(await listTaskGenerationSources(f.task)).toHaveLength(0);
  });

  it("keeps partial saved output inspectable without certifying the whole generation", async () => {
    const f = await fixture();
    await db.audioGenerationJobs.update(f.job.id, { status: "submitted", results: [...f.job.results, { key: "pending", title: "未保存", provenance: f.job.results[0].provenance }] });
    const source = await taskGenerationSource(f.task, f.job.id);
    expect(source).toMatchObject({ available: true, supportsResult: false });
    const wrap = await createManualWrapup(f.task.id);
    expect(wrap.snapshot.evidence.find(item => item.id === `generation:${f.job.id}`)).toMatchObject({ outcome: "unresolved", available: true, supportsResult: false });
    expect((await getTaskWrapupState(f.task.id)).completionBlockers).toContain("声音生成仍有进行中或待核实结果");
  });

  it.each(["missing-call", "unapproved", "dormant"] as const)("excludes %s job from task evidence", async reason => {
    const f = await fixture();
    if (reason === "missing-call") await db.agentToolCalls.delete(f.call.id);
    if (reason === "unapproved") await db.agentToolCalls.update(f.call.id, { decision: undefined });
    if (reason === "dormant") await db.audioGenerationJobs.update(f.job.id, { dormant: true });
    await expect(taskGenerationSource(f.task, f.job.id)).rejects.toThrow("不属于");
    expect(await listTaskGenerationSources(f.task)).toHaveLength(0);
    expect((await createManualWrapup(f.task.id)).snapshot.evidence.some(item => item.id === `generation:${f.job.id}`)).toBe(false);
  });

  it("separately verifies current selected take and timeline placement, invalidating old wrapup", async () => {
    const f = await fixture("audio");
    await db.audioSegments.update(f.segment!.id, { selectedTakeId: f.output.id });
    const selected = JSON.parse((await taskGenerationSource(f.task, f.job.id)).body);
    expect(selected.outputs).toMatchObject({ selectedCount: 1, timelineClipCount: 0 });
    const track = (await db.audioTracks.where("projectId").equals(f.project.id).first())!;
    const clip = await addAudioClip(f.project.id, { chapterId: f.chapter!.id, trackId: track.id, takeId: f.output.id, startSec: 0, trimStartSec: 0, trimEndSec: 3, gain: 1, fadeInSec: 0, fadeOutSec: 0 });
    const wrap = await createManualWrapup(f.task.id);
    expect(wrap.snapshot.evidence.find(item => item.id === `generation:${f.job.id}`)?.outcome).toBe("applied");
    await db.audioClips.delete(clip.id); await db.audioSegments.update(f.segment!.id, { selectedTakeId: undefined });
    const current = await getTaskWrapupState(f.task.id);
    expect(current.stale).toBe(true);
    expect(current.currentEvidence.find(item => item.id === `generation:${f.job.id}`)).toMatchObject({ available: true, outcome: "downloaded" });
  });

  it("makes owned sound sources discoverable and pageable through task_read", async () => {
    const f = await fixture();
    const run = await beginAgentRun({ threadId: f.task.threadId, connector, model: "fixture", content: "读取任务依据" });
    const call: AgentToolCall = { ...f.call, id: "read", providerCallId: "read", runId: run.id, name: "task_read", effect: "bookkeeping", atomic: true, status: "running", result: undefined, arguments: "{}" };
    await db.agentToolCalls.add(call);
    const tool = TASK_TOOLS.find(item => item.name === "task_read")!;
    // Existing image/video source fields stay additive when sound sources join the inventory.
    const at = run.createdAt;
    await db.agentGenerationBatches.add({ version: 1, id: "image-batch", projectId: f.project.id, threadId: run.threadId, runId: f.run.id,
      originCallId: "image-origin", taskId: f.task.id, title: "原图片批次", revision: 1, status: "settled", itemIds: [], confirmedItemIds: [],
      entityRevisions: {}, selections: {}, applications: [], createdAt: at, updatedAt: at });
    await db.agentGenerationJobs.add({ version: 1, id: "image-job", batchId: "image-batch", batchItemId: "image-item", runId: f.run.id,
      threadId: run.threadId, projectId: f.project.id, connectorId: "fixture", provider: "apimart", baseUrl: "https://fixture.test/v1", model: "fixture", kind: "image",
      target: { kind: "character", entityId: "removed-character", projectId: f.project.id, slot: "portrait" }, baseRevision: "before", sourceRevisions: [],
      parameters: {}, inputs: [], fingerprint: "image", status: "downloaded", result: { mediaId: "old-image-media", kind: "image" }, createdAt: at, updatedAt: at });
    const result = await tool.execute({}, { runId: run.id, threadId: run.threadId, callId: call.id, projectId: f.project.id, signal: new AbortController().signal });
    expect(result).toMatchObject({ generationCount: 2, generations: [
      { id: "image-job", batchId: "image-batch", status: "downloaded", result: { mediaId: "old-image-media", kind: "image" }, available: false },
      { id: f.job.id, sourceType: "generation", available: true, supportsResult: true },
    ] });
    await db.media.delete(f.media.id);
    const args = { source: { type: "tool", id: f.call.id } };
    await db.agentToolCalls.add({ ...call, id: "read-current", providerCallId: "read-current", arguments: JSON.stringify(args) });
    const read = await tool.execute(args, { runId: run.id, threadId: run.threadId, callId: "read-current", projectId: f.project.id, signal: new AbortController().signal }) as { content: string };
    expect(JSON.parse(read.content)).toMatchObject({ available: false, supportsResult: false, outputs: { results: [{ availability: "missing-media" }] } });
  });
});
