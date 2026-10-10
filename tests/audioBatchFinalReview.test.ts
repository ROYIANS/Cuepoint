import {describe, expect, it, vi} from "vitest";
import {db} from "@/db/database";
import {createAudioMusicProject} from "@/db/projects";
import {addAudioSegment, addAudioSpeaker} from "@/db/audio";
import {createChatThread} from "@/db/chat";
import {createAgentTaskForThread} from "@/db/agentTasks";
import {beginAgentRun, finishAgentRun} from "@/db/agentRuns";
import {transitionToolCall} from "@/db/agentTools";
import {confirmAudioGenerationBatch, readAudioGenerationBatch, retryFailedAudioBatch} from "@/db/audioGenerationBatches";
import {startAudioGenerationBatch} from "@/lib/audioGeneration/batchRuntime";
import {AUDIO_BATCH_TOOLS} from "@/lib/agent/audioBatchTools";
import {collectFinalReviewSnapshot, finalReviewTables} from "@/lib/agent/finalReviewEvidence";
import type {AgentToolContext} from "@/lib/agent/tools";
import type {ThreadLockManager} from "@/lib/agent/runOwnership";
import type {ConnectorConfig} from "@/domain/types";
import {registeredTools} from "./helpers/registeredTools";
import {saveFixtureToolRound} from "./helpers/toolDispatch";

const connector: ConnectorConfig = {id: "batch-review-provider", definitionId: "apimart", apiKey: "fixture-only-key", baseUrl: "https://fixture.invalid/v1", updatedAt: "2026-10-10"};
const decode = async () => ({durationSec: 2.5, sampleRate: 48000, channels: 1});
const binary = () => new Response(new Uint8Array([82, 73, 70, 70]), {headers: {"Content-Type": "audio/wav"}});
const locks: ThreadLockManager = {async request(_name, _options, callback) {return callback({});}};

async function fixture(withTask = true, fail = false) {
    const project = await createAudioMusicProject("批次结果声明核对", "audio");
    const chapter = (await db.audioChapters.where("projectId").equals(project.id).first())!;
    await db.connectors.put(connector);
    const speaker = await addAudioSpeaker(project.id, {name: "旁白", voice: "alloy", speed: 1});
    const segment = await addAudioSegment(project.id, {chapterId: chapter.id, text: "需要真实核对的声音", speakerId: speaker.id, order: 0, notes: ""});
    const thread = await createChatThread({projectId: project.id});
    const task = withTask ? await createAgentTaskForThread(thread.id, {projectId: project.id, title: "配音", goal: "保存一段声音"}) : undefined;
    const run = await beginAgentRun({threadId: thread.id, connector, model: "fixture", content: "准备批量配音"});
    await db.agentRuns.update(run.id, {interactionMode: "smart", permissionMode: "full", enabledToolNames: ["prepare_audio_generation_batch", "audio_read_generation_batch"], toolLoading: undefined});
    const tool = registeredTools(AUDIO_BATCH_TOOLS).find(row => row.name === "prepare_audio_generation_batch")!;
    const args = {projectId: project.id, chapterId: chapter.id, segmentIds: [segment.id]};
    await saveFixtureToolRound(run.id, "", [{id: "prepare-audio-review", type: "function", function: {name: tool.name, arguments: JSON.stringify(args)}}], [{title: tool.title, effect: tool.effect, highRisk: false, atomic: true}]);
    const call = (await db.agentToolCalls.where("runId").equals(run.id).first())!;
    await transitionToolCall(run.id, call.id, ["pending"], "running");
    const context: AgentToolContext = {runId: run.id, threadId: thread.id, callId: call.id, projectId: project.id, signal: new AbortController().signal};
    const result = await tool.execute(tool.parseArguments(args), context) as {batchId: string};
    await finishAgentRun(run.id, "completed");
    const currentRun = (await db.agentRuns.get(run.id))!;
    const snapshot = () => db.transaction("r", finalReviewTables(), () => collectFinalReviewSnapshot(currentRun));
    const prepared = await snapshot();
    const draft = (await readAudioGenerationBatch(project.id, result.batchId)).batch;
    await confirmAudioGenerationBatch(project.id, draft.id, draft.revision);
    await startAudioGenerationBatch(project.id, draft.id, {locks, decode, fetchImpl: vi.fn(async () => fail ? new Response("bad request", {status: 400}) : binary())});
    const view = await readAudioGenerationBatch(project.id, draft.id);
    return {project, chapter, segment, thread, task, run: currentRun, call, batch: view.batch, item: view.items[0], job: view.jobs[0], prepared, snapshot};
}

describe("shared batch provenance in final reply review", () => {
    it.each([true, false])("observes only a confirmed saved output for task ownership=%s", async withTask => {
        const f = await fixture(withTask);
        expect(f.prepared.evidence.filter(row => row.kind === "output")).toEqual([]);
        const snapshot = await f.snapshot(), outputs = snapshot.evidence.filter(row => row.kind === "output");
        expect(outputs).toHaveLength(1);
        expect(outputs[0]).toMatchObject({callId: f.call.id, jobId: f.job.id, resultKey: f.job.results[0].key, available: true, selected: false, placed: false});
        expect(snapshot.fingerprint).not.toBe(f.prepared.fingerprint);
    });

    it.each(["confirmation", "membership", "confirmed-membership", "included", "linked", "chapter", "job", "intent", "segment", "input", "connector", "batch-owner", "call-status", "call-atomic", "call-effect", "call-name", "call-run", "thread-project", "run-project", "task-project", "explicit-origin-with-retry", "dormant-batch", "dormant-job"] as const)("rejects %s corruption before reporting generation evidence", async invalid => {
        const f = await fixture();
        if (invalid === "confirmation") await db.audioGenerationBatches.update(f.batch.id, {confirmedAt: undefined});
        if (invalid === "membership") await db.audioGenerationBatches.update(f.batch.id, {itemIds: []});
        if (invalid === "confirmed-membership") await db.audioGenerationBatches.update(f.batch.id, {confirmedItemIds: []});
        if (invalid === "included") await db.audioGenerationBatchItems.update(f.item.id, {included: false});
        if (invalid === "linked") await db.audioGenerationBatchItems.update(f.item.id, {state: "queued"});
        if (invalid === "chapter") await db.audioGenerationBatchItems.update(f.item.id, {chapterId: "foreign"});
        if (invalid === "job") await db.audioGenerationBatchItems.update(f.item.id, {jobId: "foreign"});
        if (invalid === "intent") await db.audioGenerationBatchItems.update(f.item.id, {intentId: "foreign"});
        if (invalid === "segment") await db.audioGenerationBatchItems.update(f.item.id, {segmentId: "foreign"});
        if (invalid === "input") await db.audioGenerationBatchItems.update(f.item.id, {snapshot: {...f.item.snapshot, input: {...f.item.snapshot.input, text: "changed"}}});
        if (invalid === "connector") await db.audioGenerationBatchItems.update(f.item.id, {snapshot: {...f.item.snapshot, connector: {...f.item.snapshot.connector, id: "foreign"}}});
        if (invalid === "batch-owner") await db.audioGenerationBatches.update(f.batch.id, {owner: {kind: "manual"}});
        if (invalid === "call-status") await db.agentToolCalls.update(f.call.id, {status: "failed"});
        if (invalid === "call-atomic") await db.agentToolCalls.update(f.call.id, {atomic: false});
        if (invalid === "call-effect") await db.agentToolCalls.update(f.call.id, {effect: "network"});
        if (invalid === "call-name") await db.agentToolCalls.update(f.call.id, {name: "audio_read"});
        if (invalid === "call-run") await db.agentToolCalls.update(f.call.id, {runId: "foreign"});
        if (invalid === "thread-project") await db.chatThreads.update(f.thread.id, {projectId: "foreign"});
        if (invalid === "run-project") await db.agentRuns.update(f.run.id, {projectId: "foreign"});
        if (invalid === "task-project") await db.agentTasks.update(f.task!.id, {projectId: "foreign"});
        if (invalid === "explicit-origin-with-retry") await db.audioGenerationBatches.update(f.batch.id, {sourceCallId: "foreign", retrySourceBatchId: "retry"});
        if (invalid === "dormant-batch") await db.audioGenerationBatches.update(f.batch.id, {dormant: true});
        if (invalid === "dormant-job") await db.audioGenerationJobs.update(f.job.id, {dormant: true});
        expect((await f.snapshot()).evidence.filter(row => row.kind === "output")).toEqual([]);
    });

    it("retains original preparation provenance for an actually reviewed failed-only retry", async () => {
        const f = await fixture(true, true);
        expect(f.job).toMatchObject({status: "failed", failureStage: "provider"});
        const draft = await retryFailedAudioBatch(f.project.id, f.batch.id, [f.item.id]);
        expect(draft.sourceCallId).toBeUndefined(); expect(draft.retrySourceBatchId).toBe(f.batch.id);
        expect((await f.snapshot()).evidence.filter(row => row.kind === "output")).toEqual([]);
        await confirmAudioGenerationBatch(f.project.id, draft.id, draft.revision);
        await startAudioGenerationBatch(f.project.id, draft.id, {locks, decode, fetchImpl: vi.fn(async () => binary())});
        const retry = await readAudioGenerationBatch(f.project.id, draft.id);
        const outputs = (await f.snapshot()).evidence.filter(row => row.kind === "output");
        expect(outputs).toHaveLength(1); expect(outputs[0]).toMatchObject({callId: f.call.id, jobId: retry.jobs[0].id, available: true});
        expect(retry.jobs[0].intentId).not.toBe(f.job.intentId);
    });

    it.each(["missing-source", "self-cycle", "cycle", "foreign-owner", "foreign-project", "foreign-chapter", "wrong-result"] as const)("rejects an invalid retry origin chain: %s", async invalid => {
        const f = await fixture(true, true);
        const draft = await retryFailedAudioBatch(f.project.id, f.batch.id, [f.item.id]);
        await confirmAudioGenerationBatch(f.project.id, draft.id, draft.revision);
        await startAudioGenerationBatch(f.project.id, draft.id, {locks, decode, fetchImpl: vi.fn(async () => binary())});
        if (invalid === "missing-source") await db.audioGenerationBatches.update(draft.id, {retrySourceBatchId: "invented-retry-source"});
        if (invalid === "self-cycle") await db.audioGenerationBatches.update(draft.id, {retrySourceBatchId: draft.id});
        if (invalid === "cycle") await db.audioGenerationBatches.update(f.batch.id, {sourceCallId: undefined, retrySourceBatchId: draft.id});
        if (invalid === "foreign-owner") await db.audioGenerationBatches.update(f.batch.id, {owner: {kind: "manual"}});
        if (invalid === "foreign-project") await db.audioGenerationBatches.update(f.batch.id, {projectId: "foreign"});
        if (invalid === "foreign-chapter") await db.audioGenerationBatches.update(f.batch.id, {chapterId: "foreign"});
        if (invalid === "wrong-result") await db.agentToolCalls.update(f.call.id, {result: JSON.stringify({batchId: "unrelated-batch", projectId: f.project.id, chapterId: f.chapter.id})});
        expect((await f.snapshot()).evidence.filter(row => row.kind === "output")).toEqual([]);
    });

    it("bounds origin traversal and leaves an excessively long retry history unverified", async () => {
        const f = await fixture(true, true);
        const draft = await retryFailedAudioBatch(f.project.id, f.batch.id, [f.item.id]);
        await confirmAudioGenerationBatch(f.project.id, draft.id, draft.revision);
        await startAudioGenerationBatch(f.project.id, draft.id, {locks, decode, fetchImpl: vi.fn(async () => binary())});
        expect((await f.snapshot()).evidence.filter(row => row.kind === "output")).toHaveLength(1);
        const intermediates = Array.from({length: 100}, (_, index) => ({
            ...f.batch, id: `origin-history-${index}`, sourceCallId: undefined,
            retrySourceBatchId: index === 99 ? f.batch.id : `origin-history-${index + 1}`,
        }));
        await db.audioGenerationBatches.bulkAdd(intermediates);
        await db.audioGenerationBatches.update(draft.id, {retrySourceBatchId: intermediates[0].id});
        expect((await f.snapshot()).evidence.filter(row => row.kind === "output")).toEqual([]);
    });

    it("invalidates completed review freshness when either durable batch or item progress changes", async () => {
        const f = await fixture(), before = await f.snapshot();
        await db.audioGenerationBatches.update(f.batch.id, {revision: f.batch.revision + 1, pauseReason: "new durable status"});
        const changedBatch = await f.snapshot(); expect(changedBatch.fingerprint).not.toBe(before.fingerprint);
        await db.audioGenerationBatchItems.update(f.item.id, {revision: f.item.revision + 1});
        const changedItem = await f.snapshot(); expect(changedItem.fingerprint).not.toBe(changedBatch.fingerprint);
        expect(changedItem.evidence.filter(row => row.kind === "output")).toHaveLength(1);
    });
});
