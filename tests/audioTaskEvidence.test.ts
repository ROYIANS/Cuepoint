import {registeredTools} from "./helpers/registeredTools";
import { describe, expect, it, vi } from "vitest";
import { refreshAudioGeneration } from "@/lib/audioGeneration/runtime";
import { db } from "@/db/database";
import {createAudioMusicProject} from "@/db/projects";
import { createAgentTask, setAgentTaskLifecycle } from "@/db/agentTasks";
import { beginAgentRun, finishAgentRun } from "@/db/agentRuns";
import { addAudioClip, addAudioSegment, addAudioTake } from "@/db/audio";
import { addMusicWork } from "@/db/music";
import { listTaskGenerationSources, listTaskGenerationSourceInventory, taskGenerationEvidenceId, taskGenerationSource, validateTaskSources, writeTaskRecord } from "@/db/agentTaskRecords";
import { confirmWrapup, createManualWrapup, getTaskWrapupState, publishTaskWrapup, saveWrapup, startTaskWrapup } from "@/db/agentTaskWrapups";
import { defaultMusicSettings } from "@/domain/music";
import type { AudioGenerationJob } from "@/domain/audioGeneration";
import type { AgentToolCall } from "@/domain/agent";
import type { ConnectorConfig } from "@/domain/types";
import { TASK_TOOLS as TASK_TOOLS_DEFINITIONS } from "@/lib/agent/taskTools";
import {taskAudioToolSource} from "@/db/taskAudioGenerationEvidence";
const TASK_TOOLS = registeredTools(TASK_TOOLS_DEFINITIONS);


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
  it("accepts omitted contextual project IDs in status reads while retaining original submission attribution and explicit conflict rejection", async () => {
    const f = await fixture();
    const current = await beginAgentRun({threadId: f.task.threadId, connector, model: "fixture", content: "读取已提交成果"});
    const query: AgentToolCall = {...f.call, id: "query", runId: current.id, providerCallId: "query", name: "audio_generation_check",
      arguments: JSON.stringify({jobId: f.job.id}), decision: undefined, requiresConfirmation: undefined};
    await db.agentToolCalls.add(query);
    const source = await taskAudioToolSource(f.task, query);
    expect(source).toMatchObject({supportsResult: true, available: true});
    expect(JSON.parse(source!.body).source).toEqual(f.job.source);
    await expect(validateTaskSources(f.task, [{type: "tool", id: query.id}], "result", "ai")).resolves.toBeUndefined();
    expect(await taskAudioToolSource(f.task, {...query, arguments: JSON.stringify({jobId: f.job.id, projectId: "conflicting-project"})})).toBeUndefined();
    expect((await db.agentToolCalls.get(query.id))?.arguments).toBe(JSON.stringify({jobId: f.job.id}));
  });

  it.each(["running", "submitted", "failed", "uncertain"] as const)("allows a real single-output record while preserving aggregate %s eligibility and blockers", async status => {
    const f = await fixture();
    await db.audioGenerationJobs.update(f.job.id, {status, results: [...f.job.results, {key: "pending", title: "尚未保存", provenance: f.job.results[0].provenance, ...(status === "failed" ? {error: "此结果下载失败"} : {})}]});
    const reference = {type: "generation" as const, id: f.job.id, resultKey: "result"};
    const one = await taskGenerationSource(f.task, f.job.id, reference.resultKey);
    expect(one).toMatchObject({available: true, supportsResult: true, resultKey: "result"});
    expect(JSON.parse(one.body)).toMatchObject({status, outputs: {total: 2, included: 1, omitted: 1, allAvailable: false}});
    await expect(validateTaskSources(f.task, [{type: "generation", id: f.job.id}], "result", "ai")).rejects.toThrow("实际业务操作");
    const record = await db.transaction("rw", db.tables, () => writeTaskRecord(f.task, {
      kind: "verification", claim: "result", title: "单个文件已保存", body: "只确认这个音频文件；未试听。", sources: [reference]
    }, {author: "ai", runId: f.run.id}));
    expect((await db.agentTaskRecords.get(record.id))?.sources).toEqual([reference]);
    expect((await db.agentTaskRecordVersions.get(`${record.id}:1`))?.sources).toEqual([reference]);
    const draft = await createManualWrapup(f.task.id);
    const sourceId = taskGenerationEvidenceId(f.job.id, reference.resultKey);
    expect(draft.snapshot.evidence.find(item => item.id === sourceId)).toMatchObject({available: true, outcome: "downloaded", supportsResult: true});
    const saved = await saveWrapup(f.task.id, draft.id, {...draft.content, overview: "确认一个本地文件", results: [{text: "单个文件已保存", sourceIds: [sourceId]}], acceptance: draft.content.acceptance.map(item => ({...item, status: "met", sourceIds: [sourceId]}))}, draft.revision);
    const confirmed = await confirmWrapup(f.task.id, saved.id, saved.revision);
    if (status !== "failed") {
      expect((await getTaskWrapupState(f.task.id)).completionBlockers).toContain("声音生成仍有进行中或待核实结果");
      await expect(setAgentTaskLifecycle(f.task.id, "completed", {id: confirmed.id, revision: confirmed.revision})).rejects.toThrow("声音生成");
    }
  });

  it("publishes a single healthy output from a partial job without upgrading the original tool or aggregate source", async () => {
    const f = await fixture();
    await db.audioGenerationJobs.update(f.job.id, {status: "submitted", results: [...f.job.results, {key: "pending", title: "未保存", provenance: f.job.results[0].provenance}]});
    const draft = await startTaskWrapup(f.task.id, "ai");
    const sourceId = taskGenerationEvidenceId(f.job.id, "result");
    const saved = await publishTaskWrapup(draft.id, {...draft.content, overview: "一个文件已保存，其余待核实", results: [{text: "保存了此结果", sourceIds: [sourceId]}]}, new AbortController().signal);
    expect(saved.content.results[0].sourceIds).toEqual([sourceId]);
    expect(saved.snapshot.evidence.find(item => item.id === `tool:${f.call.id}`)?.supportsResult).toBe(false);
    expect(saved.snapshot.evidence.find(item => item.id === `generation:${f.job.id}`)?.supportsResult).toBe(false);
    expect((await db.agentToolCalls.get(f.call.id))?.result).toBe(f.call.result);
  });

  it.each(["wrong-key", "duplicate-key", "wrong-task-id", "wrong-provider", "wrong-model", "wrong-link", "wrong-output-owner", "replaced-media", "tombstone", "invalid-decoder"] as const)("rejects a single-output record and invalidates wrap-up after %s", async reason => {
    const f = await fixture();
    const wrap = await createManualWrapup(f.task.id);
    const reference = {type: "generation" as const, id: f.job.id, resultKey: "result"};
    if (reason === "wrong-key") reference.resultKey = "invented";
    if (reason === "duplicate-key") await db.audioGenerationJobs.update(f.job.id, {results: [...f.job.results, f.job.results[0]]});
    if (reason === "wrong-task-id" || reason === "wrong-provider" || reason === "wrong-model") await db.musicWorks.update(f.output.id, {provenance: {...f.job.results[0].provenance,
      ...(reason === "wrong-task-id" ? {taskId: "foreign-task"} : reason === "wrong-provider" ? {provider: "mimo" as const} : {model: "different-model"})}});
    if (reason === "wrong-link") await db.musicWorks.update(f.output.id, {mediaId: "different-media"});
    if (reason === "wrong-output-owner") await db.musicWorks.update(f.output.id, {projectId: "foreign-project"});
    if (reason === "replaced-media") await db.audioGenerationJobs.update(f.job.id, {results: f.job.results.map(result => ({...result, mediaId: "replaced-media"}))});
    if (reason === "tombstone") await db.audioGenerationJobs.update(f.job.id, {results: f.job.results.map(result => ({...result, deleted: true}))});
    if (reason === "invalid-decoder") await db.musicWorks.update(f.output.id, {sampleRate: 0});
    await expect(db.transaction("rw", db.tables, () => writeTaskRecord(f.task, {
      kind: "verification", claim: "result", title: "不可核实的文件", body: "不能通过", sources: [reference]
    }, {author: "ai", runId: f.run.id}))).rejects.toThrow();
    expect(await db.agentTaskRecords.count()).toBe(0);
    expect(await db.agentTaskRecordVersions.count()).toBe(0);
    if (reason !== "wrong-key") expect((await getTaskWrapupState(f.task.id)).stale).toBe(true);
    const available = (await getTaskWrapupState(f.task.id)).currentEvidence.find(item => item.id === taskGenerationEvidenceId(f.job.id, "result"));
    if (reason !== "wrong-key") expect(available?.supportsResult ?? false).toBe(false);
    expect((await db.agentTaskWrapups.get(wrap.id))?.snapshot.fingerprint).toBe(wrap.snapshot.fingerprint);
  });

  it("rejects resultKey on non-generation sources and picture/video sources", async () => {
    const f = await fixture();
    await expect(validateTaskSources(f.task, [{type: "tool", id: f.call.id, resultKey: "result"}], "result", "ai")).rejects.toThrow("结果键");
    await expect(validateTaskSources(f.task, [{type: "message", id: f.run.userMessageId!, resultKey: "result"}], "decision", "ai")).rejects.toThrow("结果键");
    await expect(taskGenerationSource(f.task, "image-job", "result")).rejects.toThrow("结果键");
  });

  it("keeps individual identity independent of sibling order, selection, placement and audition", async () => {
    const f = await fixture("audio");
    await db.audioGenerationJobs.update(f.job.id, {results: [{key: "pending", title: "未保存", provenance: f.job.results[0].provenance}, ...f.job.results]});
    const one = () => taskGenerationSource(f.task, f.job.id, "result");
    expect(JSON.parse((await one()).body).outputs).toMatchObject({selectedCount: 0, timelineClipCount: 0});
    await db.audioSegments.update(f.segment!.id, {selectedTakeId: f.output.id});
    expect(JSON.parse((await one()).body).outputs).toMatchObject({selectedCount: 1, timelineClipCount: 0});
    const track = (await db.audioTracks.where("projectId").equals(f.project.id).first())!;
    const clip = await addAudioClip(f.project.id, {chapterId: f.chapter!.id, trackId: track.id, takeId: f.output.id, startSec: 0, trimStartSec: 0, trimEndSec: 3, gain: 1, fadeInSec: 0, fadeOutSec: 0});
    const wrapped = await createManualWrapup(f.task.id);
    const sourceId = taskGenerationEvidenceId(f.job.id, "result");
    expect(wrapped.snapshot.evidence.find(item => item.id === sourceId)?.outcome).toBe("applied");
    expect(JSON.parse((await one()).body).note).toContain("未试听");
    await db.audioClips.delete(clip.id);
    await db.audioSegments.update(f.segment!.id, {selectedTakeId: undefined});
    const current = await getTaskWrapupState(f.task.id);
    expect(current.stale).toBe(true);
    expect(current.currentEvidence.find(item => item.id === sourceId)).toMatchObject({outcome: "downloaded", supportsResult: true});
  });

  it("bounds source pages, resolves a healthy 101st result by key and fingerprints omitted output changes", async () => {
    const f = await fixture();
    const pending = Array.from({length: 100}, (_, index) => ({key: `pending:${index}`, title: `待保存 ${index}`, provenance: f.job.results[0].provenance}));
    await db.audioGenerationJobs.update(f.job.id, {status: "submitted", results: [...pending, {...f.job.results[0], key: "saved:last"}]});
    const first = await listTaskGenerationSourceInventory(f.task);
    expect(first.coverage).toEqual({total: 102, included: 100, omitted: 2, offset: 0, nextOffset: 100});
    expect(first.sources).toHaveLength(100);
    const last = await listTaskGenerationSourceInventory(f.task, {offset: 100});
    expect(last.coverage).toEqual({total: 102, included: 2, omitted: 100, offset: 100, nextOffset: null});
    expect(last.sources.find(item => item.resultKey === "saved:last")).toMatchObject({available: true, supportsResult: true});
    const ref = {type: "generation" as const, id: f.job.id, resultKey: "saved:last"};
    await db.transaction("rw", db.tables, () => writeTaskRecord(f.task, {kind: "verification", claim: "result", title: "最后一个文件", body: "已保存且未试听", sources: [ref]}, {author: "ai", runId: f.run.id}));
    const draft = await createManualWrapup(f.task.id);
    expect(draft.snapshot.coverage.omitted).toBeGreaterThan(0);
    const all = await getTaskWrapupState(f.task.id);
    expect(all.currentEvidence.find(item => item.id === taskGenerationEvidenceId(f.job.id, "saved:last"))).toMatchObject({available: true, supportsResult: true});
    await db.media.delete(f.media.id);
    const current = await getTaskWrapupState(f.task.id);
    expect(current.stale).toBe(true);
    expect(current.currentEvidence.find(item => item.id === taskGenerationEvidenceId(f.job.id, "saved:last"))).toMatchObject({available: false, supportsResult: false});
    await expect(validateTaskSources(f.task, [ref], "result", "ai")).rejects.toThrow("实际业务操作");
  });

  it("uses the exact resultKey through actual task_read and ledger-atomic task_record_write, retaining legacy aggregate reads", async () => {
    const f = await fixture();
    await db.audioGenerationJobs.update(f.job.id, {status: "running", results: [...f.job.results, {key: "pending", title: "待保存", provenance: f.job.results[0].provenance}]});
    const run = await beginAgentRun({threadId: f.task.threadId, connector, model: "fixture", content: "记录已保存的一个声音结果"});
    const reference = {type: "generation" as const, id: f.job.id, resultKey: "result"};
    const invoke = async (name: "task_read" | "task_record_write", args: unknown, callId: string) => {
      const call: AgentToolCall = {...f.call, id: callId, providerCallId: callId, runId: run.id, name, effect: "bookkeeping", atomic: true, status: "running", decision: undefined, requiresConfirmation: false, arguments: JSON.stringify(args), result: undefined};
      await db.agentToolCalls.add(call);
      return TASK_TOOLS.find(tool => tool.name === name)!.execute(args, {runId: run.id, threadId: run.threadId, callId, projectId: f.project.id, signal: new AbortController().signal});
    };
    const list = await invoke("task_read", {offset: 0, limit: 2}, "list") as {generations: unknown[]};
    expect(list).toMatchObject({generationCount: 3, generationCoverage: {total: 3, included: 2, omitted: 1, nextOffset: 2}, generations: [{id: f.job.id, supportsResult: false}, {id: f.job.id, resultKey: "result", supportsResult: true}]});
    const read = await invoke("task_read", {source: reference}, "read-result") as {content: string};
    expect(JSON.parse(read.content)).toMatchObject({resultKey: "result", supportsResult: true, source: f.job.source, outputs: {results: [{key: "result", available: true}]}});
    const legacy = await invoke("task_read", {source: {type: "generation", id: f.job.id}}, "read-aggregate") as {content: string};
    expect(JSON.parse(legacy.content)).toMatchObject({available: true, supportsResult: false});
    const record = await invoke("task_record_write", {kind: "verification", claim: "result", title: "单个保存的声音", body: "来源键对应的文件已经本地保存；其他结果和试听尚未验收。", sources: [reference]}, "record-result") as {record: {id: string}};
    expect((await db.agentTaskRecords.get(record.record.id))?.sources).toEqual([reference]);
    expect((await db.agentToolCalls.get("record-result"))?.status).toBe("completed");
    const untouched = await db.agentToolCalls.get(f.call.id);
    expect(untouched?.result).toBe(f.call.result);
    await expect(invoke("task_record_write", {kind: "verification", claim: "result", title: "整批", body: "不应通过", sources: [{type: "generation", id: f.job.id}]}, "invalid-record")).rejects.toThrow("实际业务操作");
    expect(await db.agentTaskRecords.count()).toBe(1);
    expect(await db.agentTaskRecordVersions.count()).toBe(1);
  });
  it.each(["audio", "music"] as const)("resolves current saved %s output and retains original source and query time", async kind => {
    const f = await fixture(kind);
    const source = await taskGenerationSource(f.task, f.job.id);
    expect(source).toMatchObject({ available: true, supportsResult: true, applied: false });
    expect(JSON.parse(source.body)).toMatchObject({ source: f.job.source, checkedAt: "2026-09-22T03:00:00.000Z", status: "saved", outputs: { availableCount: 1, allAvailable: true } });
    if (kind === "music") expect(JSON.parse(source.body).target).toEqual({ draftId: "original-draft", draftRevision: 4 });
    await expect(validateTaskSources(f.task, [{ type: "generation", id: f.job.id }], "result", "ai")).resolves.toBeUndefined();
    await expect(validateTaskSources(f.task, [{ type: "tool", id: f.call.id }], "result", "ai")).resolves.toBeUndefined();
    expect(await listTaskGenerationSources(f.task)).toHaveLength(2);
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
    await expect(taskGenerationSource(other, f.job.id, "result")).rejects.toThrow("不属于");
    expect(await listTaskGenerationSources(other)).toHaveLength(0);
    await db.audioGenerationJobs.update(f.job.id, { projectId: "foreign-project" });
    await expect(taskGenerationSource(f.task, f.job.id)).rejects.toThrow("不属于");
    await expect(taskGenerationSource(f.task, f.job.id, "result")).rejects.toThrow("不属于");
    await db.audioGenerationJobs.update(f.job.id, { projectId: f.project.id, source: { kind: "manual" } });
    await expect(taskGenerationSource(f.task, f.job.id, "result")).rejects.toThrow("不属于");
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

  it("repairs legacy duplicate IDs without changing task origin or promoting historical evidence to a fresh fact", async () => {
    const f = await fixture();
    await db.connectors.add({ id: "sound", definitionId: "apimart", protocol: "openai-compatible", baseUrl: "https://fixture.test/v1", apiKey: "fixture-key", updatedAt: f.run.updatedAt });
    await db.audioGenerationJobs.update(f.job.id, { status: "submitted", taskIds: ["remote-task", "remote-task", "later", "later"] });
    const fetchImpl = vi.fn<typeof fetch>(async (url, init) => {
      expect(init?.method).toBe("GET");
      const taskId = new URL(String(url)).pathname.split("/").at(-1)!;
      return Response.json({ code: 200, data: { id: taskId, status: taskId === "later" ? "processing" : "provider-new-status" } });
    });
    const recovered = await refreshAudioGeneration(f.project.id, f.job.id, { fetchImpl });
    expect(recovered.taskIds).toEqual(["remote-task", "later"]);
    expect(recovered.source).toEqual(f.job.source);
    expect(recovered.results).toEqual(f.job.results);
    expect(recovered.taskObservations![0]).toMatchObject({ status: "unknown", lastVerified: f.job.taskObservations![0].lastVerified });
    expect(recovered.taskObservations![1].status).toBe("processing");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(await db.audioGenerationJobs.count()).toBe(1);
    expect(await db.agentToolCalls.count()).toBe(1);
    const source = await taskGenerationSource(f.task, f.job.id);
    expect(source).toMatchObject({ available: true, supportsResult: false });
    expect(JSON.parse(source.body).source).toEqual(f.job.source);
    expect((await listTaskGenerationSources(f.task)).map(row => ({id: row.id, resultKey: row.resultKey}))).toEqual([
      {id: f.job.id, resultKey: undefined}, {id: f.job.id, resultKey: "result"}
    ]);
    const other = await createAgentTask({ projectId: f.project.id, title: "另一个任务", goal: "查看" });
    await expect(taskGenerationSource(other, f.job.id)).rejects.toThrow("不属于");
    const wrap = await createManualWrapup(f.task.id);
    expect(wrap.snapshot.evidence.find(item => item.id === `generation:${f.job.id}`)).toMatchObject({ outcome: "unresolved", available: true, supportsResult: false });
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
    expect(result).toMatchObject({ generationCount: 3, generations: [
      { id: "image-job", batchId: "image-batch", status: "downloaded", result: { mediaId: "old-image-media", kind: "image" }, available: false },
      { id: f.job.id, sourceType: "generation", available: true, supportsResult: true },
      { id: f.job.id, resultKey: "result", sourceType: "generation", available: true, supportsResult: true },
    ] });
    await db.media.delete(f.media.id);
    const args = { source: { type: "tool", id: f.call.id } };
    await db.agentToolCalls.add({ ...call, id: "read-current", providerCallId: "read-current", arguments: JSON.stringify(args) });
    const read = await tool.execute(args, { runId: run.id, threadId: run.threadId, callId: "read-current", projectId: f.project.id, signal: new AbortController().signal }) as { content: string };
    expect(JSON.parse(read.content)).toMatchObject({ available: false, supportsResult: false, outputs: { results: [{ availability: "missing-media" }] } });
  });
});
