import Dexie from "dexie";
import {db} from "@/db/database";
import {addShot} from "@/db/shots";
import {createChatThread} from "@/db/chat";
import {createProject} from "@/db/projects";
import {putMedia} from "@/db/media";
import {beginAgentRun} from "@/db/agentRuns";
import {updateGeneralAgentConfig} from "@/db/agentSettings";
import {saveToolRound, startModelStep, transitionToolCall} from "@/db/agentTools";
import {claimGenerationJob, storeGenerationMedia, updateGenerationJob} from "@/db/agentGeneration";
import {applyBatchSelections, claimBatchItem, confirmGenerationBatch, controlGenerationBatch, frozenGeneration, prepareGenerationBatch, readGenerationBatch, selectBatchCandidate} from "@/db/agentGenerationBatches";
import {readGenerationTarget} from "@/db/agentGenerationTarget";
import {createAgentTask, updateAgentTask} from "@/db/agentTasks";
import {editableAgentTask} from "@/db/agentTaskGuards";
import {saveTaskRecord} from "@/db/agentTaskRecords";
import {cancelTaskWrapup, startTaskWrapup} from "@/db/agentTaskWrapups";
import {getOfferedToolNames, toolNamesForCall} from "@/domain/agentToolSelection";
import type {AgentRun} from "@/domain/agent";
import type {AgentGenerationJob} from "@/domain/agentGeneration";
import type {ConnectorConfig} from "@/domain/types";
import {registerPendingDraft} from "@/lib/debouncedDraft";
import {loadGenerationInputs, prepareGenerationSnapshot} from "@/lib/agent/generationPreparation";
import {applyAgentGeneration, prepareAgentGeneration} from "@/lib/agent/generationRuntime";
import type {GenerationSubmitArgs} from "@/lib/agent/generationProfiles";
import {preloadFixtureGroups} from "../../helpers/toolDispatch";

function check(value: unknown, message: string): asserts value {
    if (!value) throw new Error(message);
}

async function fixture() {
    await updateGeneralAgentConfig({permissionMode: "full", enabledSkillIds: ["media-generation"]});
    const config: ConnectorConfig = {id: "d01-hub", definitionId: "aihubmix", baseUrl: "https://fixture.test/v1", apiKey: "fixture", updatedAt: "now"};
    await db.connectors.put(config);
    const project = await createProject("D01 transaction boundary");
    const episode = await db.episodes.where("projectId").equals(project.id).first();
    check(episode, "missing episode");
    const shot = await addShot(project.id, episode.id);
    const thread = await createChatThread();
    const run = await preloadFixtureGroups(await beginAgentRun({threadId: thread.id, connector: config, model: "fixture", content: "prepare local fixture"}), ["media-generation"]);
    const mediaId = `${project.id}-reference`;
    await putMedia({id: mediaId, projectId: project.id, filename: "reference.png", mimeType: "image/png", blob: new Blob(["local fixture input"], {type: "image/png"}), createdAt: project.createdAt});
    const args: GenerationSubmitArgs = {connectorId: config.id, model: "gpt-image-2", target: {kind: "shot", projectId: project.id, episodeId: episode.id, entityId: shot.id, slot: "firstFrame"}, prompt: "fixture", parameters: {}, inputs: [{role: "reference-image", mediaId}]};
    return {project, shot, run, args};
}

async function runningTool(run: AgentRun, name: string, args: unknown, effect: "network" | "write" | "bookkeeping") {
    const step = await startModelStep(run.id, 32);
    check(getOfferedToolNames(step).includes(name), "tool absent from frozen ceiling");
    check(toolNamesForCall(step, step.modelStep ?? 1).includes(name), "tool absent from own request");
    const providerCallId = `${name}-${step.modelStep}`;
    await saveToolRound(run.id, "", [{id: providerCallId, type: "function", function: {name, arguments: JSON.stringify(args)}}], [{title: name, effect, highRisk: false, atomic: effect !== "network"}]);
    const call = await db.agentToolCalls.where("runId").equals(run.id).filter(row => row.providerCallId === providerCallId).first();
    check(call, "missing tool ledger");
    await transitionToolCall(run.id, call.id, ["pending"], "running");
    return {runId: run.id, threadId: run.threadId, callId: call.id, signal: new AbortController().signal};
}

async function observePreparation(f: Awaited<ReturnType<typeof fixture>>, execute: () => Promise<void>) {
    let hashes = 0, flushes = 0, flushed = false;
    const originalDigest = crypto.subtle.digest;
    crypto.subtle.digest = function (...args: Parameters<SubtleCrypto["digest"]>) {
        check(!Dexie.currentTransaction, "Blob hashing entered a Dexie transaction");
        hashes++;
        return originalDigest.call(this, ...args);
    };
    const unregister = registerPendingDraft(f.project.id, async () => {
        check(!Dexie.currentTransaction, "draft flush entered a Dexie transaction");
        flushes++;
        if (!flushed) {
            await db.shots.update(f.shot.id, {content: "latest pending draft"});
            flushed = true;
        }
    });
    try {
        await execute();
        check(hashes >= 3 && flushes >= 3, "preparation and apply did not exercise input hashing and draft flush");
        check((await db.shots.get(f.shot.id))?.content === "latest pending draft", "pending draft lost");
        return {hashes, flushes, hashOutsideTransactions: true, flushOutsideTransactions: true};
    } finally {
        unregister();
        crypto.subtle.digest = originalDigest;
    }
}

async function downloadFixture(job: AgentGenerationJob) {
    // Seed a locally downloaded result through real repository commands; no provider request.
    await updateGenerationJob(job.id, {status: "downloading"});
    return storeGenerationMedia(job.id, {id: `${job.id}-output`, projectId: job.projectId, filename: "output.png", mimeType: "image/png", blob: new Blob(["local fixture output"], {type: "image/png"}), createdAt: job.createdAt});
}

export async function runSingleBoundary() {
    const f = await fixture();
    return observePreparation(f, async () => {
        const submit = await runningTool(f.run, "submit_generation", f.args, "network");
        const preview = await prepareAgentGeneration(f.args, submit);
        const prepared = await prepareGenerationSnapshot(f.args, submit.signal);
        check(preview.revision === prepared.fingerprint, "preview does not include flushed input snapshot");
        const claim = await claimGenerationJob({...frozenGeneration(prepared), version: 1, id: `${f.run.id}-single`, callId: submit.callId, runId: f.run.id, threadId: f.run.threadId, projectId: f.project.id, status: "submitting", createdAt: f.project.createdAt, updatedAt: f.project.createdAt});
        const job = await downloadFixture(claim.job);
        await transitionToolCall(f.run.id, submit.callId, ["running"], "completed", {result: JSON.stringify({jobId: job.id, result: job.result})});
        const apply = await runningTool(f.run, "apply_generation", {jobId: job.id}, "write");
        await applyAgentGeneration(job.id, apply);
        check((await db.shots.get(f.shot.id))?.firstFrame.result?.mediaId === job.result?.mediaId, "single result was not applied");
        check((await db.agentToolCalls.get(apply.callId))?.status === "completed", "single apply ledger was not committed");
    });
}

export async function runBatchBoundary() {
    const f = await fixture();
    return observePreparation(f, async () => {
        const context = await runningTool(f.run, "prepare_generation_batch", {title: "local batch", candidates: [f.args]}, "bookkeeping");
        const result = await prepareGenerationBatch("local batch", [f.args], context);
        check(result && typeof result === "object" && "batchId" in result && typeof result.batchId === "string", "missing batch result");
        const before = await readGenerationBatch(result.batchId, f.run.threadId);
        await confirmGenerationBatch(result.batchId, f.run.threadId, before.batch.revision, context.signal);
        await controlGenerationBatch(result.batchId, f.run.threadId, "run");
        const claimed = await claimBatchItem(result.batchId, f.run.threadId, before.items[0].id);
        check(claimed, "batch item was not claimed");
        const job = await downloadFixture(claimed);
        await selectBatchCandidate(result.batchId, f.run.threadId, before.items[0].id);
        const outcomes = await applyBatchSelections(result.batchId, f.run.threadId);
        check(outcomes.length === 1 && outcomes[0].applied, "batch result was not applied");
        check((await readGenerationTarget(f.args.target)).slot.result?.mediaId === job.result?.mediaId, "target reader lost batch result");
        const records = await loadGenerationInputs(job);
        check(records.length === 1, "preparation leaf lost input");
        let rolledBack = false;
        try {
            await db.transaction("rw", db.tables, async () => {
                await db.shots.update(f.shot.id, {content: "uncommitted"});
                const current = await readGenerationTarget(f.args.target);
                check("content" in current.entity && current.entity.content === "uncommitted", "target reader did not join caller transaction");
                throw new Error("fixture rollback");
            });
        } catch (error) {check(error instanceof Error && error.message === "fixture rollback", "unexpected reader failure"); rolledBack = true;}
        check(rolledBack, "target transaction did not roll back");
    });
}

export async function runTaskGuardBoundary() {
    const project = await createProject("D01 guard");
    const task = await createAgentTask({projectId: project.id, title: "Guard fixture", goal: "Keep manual mutations guarded"});
    check((await editableAgentTask(task.id)).id === task.id, "valid task unavailable");
    const draft = await startTaskWrapup(task.id, "ai");
    let blocked = 0;
    for (const execute of [
        () => updateAgentTask(task.id, {title: "forbidden"}),
        () => saveTaskRecord(task.id, {kind: "approach", claim: "proposal", title: "forbidden", body: "fixture", sources: []})
    ]) {
        try {await execute();}
        catch (error) {check(error instanceof Error && error.message.includes("总结正在整理"), "unexpected edit guard failure"); blocked++;}
    }
    check(blocked === 2 && !(await db.agentTaskRecords.where("taskId").equals(task.id).count()), "manual commands bypassed guard");
    await cancelTaskWrapup(task.id, draft.id);
    await updateAgentTask(task.id, {title: "accepted"});
    check((await editableAgentTask(task.id)).title === "accepted", "edit guard did not recover");
    return {blockedManualCommands: blocked, guardRecovered: true};
}
