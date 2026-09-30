import {describe, expect, it} from "vitest";
import {db} from "@/db/database";
import {addCharacter, addShot, createProject} from "@/db/repo";
import {createAgentTask} from "@/db/agentTasks";
import {beginAgentRun, finishAgentRun} from "@/db/agentRuns";
import {listTaskGenerationSources, saveTaskRecord, taskGenerationSource, writeTaskRecord} from "@/db/agentTaskRecords";
import {cancelTaskWrapup, getTaskWrapupState, publishTaskWrapup, startTaskWrapup} from "@/db/agentTaskWrapups";
import {validateWrapupContent} from "@/lib/agent/wrapupSchema";
import type {AgentToolCall, AgentToolCallStatus} from "@/domain/agent";
import type {AgentGenerationJob, AgentGenerationStatus} from "@/domain/agentGeneration";
import type {GenerationBatch} from "@/domain/agentGenerationBatch";
import type {MediaKind} from "@/domain/types";

async function fixture(kind: MediaKind = "image", batch = true) {
    const project = await createProject("成果证据测试");
    const task = await createAgentTask({projectId: project.id, title: "核实成果", goal: "核实本地文件", acceptanceCriteria: []});
    const run = await beginAgentRun({threadId: task.threadId, model: "model", content: "生成素材", connector: {
        id: "connector", name: "test", definitionId: "openai-compatible", baseUrl: "https://example.test", apiKey: "fixture", updatedAt: "now"
    }});
    const character = await addCharacter(project.id);
    const episode = (await db.episodes.where("projectId").equals(project.id).toArray())[0];
    const shot = await addShot(project.id, episode.id);
    const target = kind === "image" ? {kind: "character" as const, projectId: project.id, entityId: character.id, slot: "front" as const}
        : {kind: "shot" as const, projectId: project.id, episodeId: episode.id, entityId: shot.id, slot: "clip" as const};
    const job: AgentGenerationJob = {version: 1, id: "job", runId: run.id, threadId: task.threadId, projectId: project.id,
        ...(batch ? {batchId: "batch", batchItemId: "item"} : {callId: "submit"}),
        connectorId: "connector", provider: "apimart", baseUrl: "https://example.test", model: "model", kind, target,
        baseRevision: "base", sourceRevisions: [], parameters: {}, inputs: [], fingerprint: "fingerprint", status: "applied",
        result: {kind, mediaId: "output"}, createdAt: run.createdAt, updatedAt: run.createdAt};
    if (batch) {
        const row: GenerationBatch = {version: 1, id: "batch", projectId: project.id, threadId: task.threadId, runId: run.id, taskId: task.id,
            originCallId: "prepare", title: "批量", revision: 1, status: "settled", itemIds: ["item"], confirmedItemIds: ["item"], entityRevisions: {},
            selections: {}, applications: [], createdAt: run.createdAt, updatedAt: run.createdAt};
        await db.agentGenerationBatches.add(row);
    }
    await db.agentGenerationJobs.add(job);
    await db.media.add({id: "output", projectId: project.id, mimeType: `${kind}/${kind === "image" ? "png" : "mp4"}`, filename: "output", blob: new Blob(["fixture"]), createdAt: run.createdAt});
    const slot = {prompt: "", referenceImageIds: [], referenceVideoIds: [], result: job.result};
    if (kind === "image") await db.characters.update(character.id, {slots: {front: slot}});
    else await db.shots.update(shot.id, {clip: slot});
    await finishAgentRun(run.id, "completed", {content: "已保存"});
    const call: AgentToolCall = {id: "check", runId: run.id, threadId: task.threadId, providerCallId: "check", step: 1, order: 0,
        name: "check_generation", title: "查询生成", arguments: JSON.stringify({jobId: job.id}), effect: "network", highRisk: false,
        status: "completed", result: JSON.stringify({jobId: job.id, status: "applied", applied: true, result: job.result}), createdAt: run.createdAt, updatedAt: run.createdAt};
    await db.agentToolCalls.add(call);
    return {task, run, character, shot, episode, job, call};
}

const invalidOutputs = ["missing", "empty", "foreign", "mime", "mime-subtype", "not-blob", "result-kind", "target-owner", "no-result", "failed", "unknown", "running", "downloading", "remote_completed"] as const;
describe("current image/video evidence at record and wrapup boundaries", () => {
    it.each(["image", "video"] as const)("keeps valid %s file and current application evidence", async kind => {
        const {task, call} = await fixture(kind);
        expect(await taskGenerationSource(task, "job")).toMatchObject({available: true, applied: true, supportsResult: true});
        expect(await listTaskGenerationSources(task)).toEqual([expect.objectContaining({id: "job", applied: true})]);
        const draft = await startTaskWrapup(task.id, "ai");
        expect(draft.snapshot.evidence.find(e => e.id === "generation:job")).toMatchObject({available: true, outcome: "applied", supportsResult: true});
        expect(draft.snapshot.evidence.find(e => e.id === `tool:${call.id}`)).toMatchObject({available: true, outcome: "applied", supportsResult: true});
        const saved = await publishTaskWrapup(draft.id, {...draft.content, results: [{text: "文件已生成", sourceIds: ["generation:job", "tool:check"]}]}, new AbortController().signal);
        expect(saved.content.results).toHaveLength(1);
        await db.transaction("rw", db.tables, () => writeTaskRecord(task, {kind: "verification", claim: "result", title: "交付", body: "文件可用", sources: [{type: "tool", id: call.id}]}, {author: "ai"}));
    });

    it.each((["image", "video"] as const).flatMap(kind => invalidOutputs.map(fault => ({kind, fault}))))("rejects $kind $fault outputs, preserving historical ledger", async ({kind, fault}) => {
        const {task, call, job} = await fixture(kind);
        if (fault === "missing") await db.media.delete("output");
        else if (fault === "empty") await db.media.update("output", {blob: new Blob([])});
        else if (fault === "foreign") await db.media.update("output", {projectId: "foreign"});
        else if (fault === "mime") await db.media.update("output", {mimeType: "audio/wav"});
        else if (fault === "mime-subtype") await db.media.update("output", {mimeType: `${kind}/`});
        else if (fault === "not-blob") await db.table<Record<string, unknown>, string>("media").update("output", {blob: {size: 10}});
        else if (fault === "result-kind") await db.agentGenerationJobs.update(job.id, {result: {mediaId: "output", kind: kind === "image" ? "video" : "image"}});
        else if (fault === "target-owner") await db.agentGenerationJobs.update(job.id, {target: {...job.target, projectId: "foreign"}});
        else if (fault === "no-result") await db.agentGenerationJobs.update(job.id, {result: undefined});
        else await db.agentGenerationJobs.update(job.id, {status: fault as AgentGenerationStatus});
        const historicalJob = await db.agentGenerationJobs.get(job.id);
        expect(await taskGenerationSource(task, job.id)).toMatchObject({available: false, applied: false, supportsResult: false});
        const draft = await startTaskWrapup(task.id, "ai");
        for (const id of ["generation:job", "tool:check"]) {
            expect(draft.snapshot.evidence.find(e => e.id === id)).toMatchObject({available: false, outcome: "unresolved", supportsResult: false});
            const content = {...draft.content, results: [{text: "交付成果", sourceIds: [id]}]};
            expect(() => validateWrapupContent(content, draft.snapshot, "ai")).toThrow("真实来源");
            await expect(publishTaskWrapup(draft.id, content, new AbortController().signal)).rejects.toThrow("真实来源");
        }
        for (const source of [{type: "generation" as const, id: job.id}, {type: "tool" as const, id: call.id}]) {
            await expect(db.transaction("rw", db.tables, () => writeTaskRecord(task, {kind: "verification", claim: "result", title: "成果", body: "交付", sources: [source]}, {author: "ai"}))).rejects.toThrow("完成结果");
        }
        await cancelTaskWrapup(task.id, draft.id);
        // User notes can still describe historical outputs without claiming AI verification.
        await saveTaskRecord(task.id, {kind: "verification", claim: "proposal", title: "待核实", body: "保留历史事实", sources: [{type: "generation", id: job.id}]});
        expect(await db.agentToolCalls.get(call.id)).toEqual(call);
        expect(await db.agentGenerationJobs.get(job.id)).toEqual(historicalJob);
        expect(await db.agentTaskRecords.count()).toBe(1);
    });

    it.each(["replaced", "deleted", "foreign-target", "deleted-episode", "wrong-episode", "illegal-slot", "slot-kind"] as const)("retains independent downloaded file after %s, without inventing application", async fault => {
        const {task, job, character, shot, episode} = await fixture(fault === "slot-kind" || fault.includes("episode") ? "video" : "image");
        if (fault === "replaced") await db.characters.update(character.id, {slots: {}});
        if (fault === "deleted") await db.characters.delete(character.id);
        if (fault === "foreign-target") await db.characters.update(character.id, {projectId: "foreign"});
        if (fault === "deleted-episode") await db.episodes.delete(episode.id);
        if (fault === "wrong-episode") await db.shots.update(shot.id, {episodeId: "foreign"});
        if (fault === "illegal-slot") {
            await db.table<Record<string, unknown>, string>("characters").update(character.id, {slots: {concept: {result: job.result}}});
            await db.table<Record<string, unknown>, string>("agentGenerationJobs").update(job.id, {target: {...job.target, slot: "concept"}});
        }
        if (fault === "slot-kind") await db.shots.update(shot.id, {clip: {prompt: "", referenceImageIds: [], referenceVideoIds: [], result: {kind: "image", mediaId: "output"}}});
        expect(await taskGenerationSource(task, job.id)).toMatchObject({available: true, applied: false, supportsResult: true});
        const state = await getTaskWrapupState(task.id);
        expect(state.currentEvidence.find(e => e.id === "generation:job")).toMatchObject({outcome: "downloaded", available: true, supportsResult: true});
    });

    it.each(["downloaded", "conflict"] as const)("keeps valid %s lifecycle as downloaded without a matching slot", async status => {
        const {task, job, character} = await fixture();
        await db.characters.update(character.id, {slots: {}});
        await db.agentGenerationJobs.update(job.id, {status});
        expect(await taskGenerationSource(task, job.id)).toMatchObject({available: true, applied: false});
        expect((await getTaskWrapupState(task.id)).currentEvidence.find(e => e.id === "generation:job")?.outcome).toBe("downloaded");
    });
});

describe("generation tool history eligibility", () => {
    it.each((["rejected", "failed", "unknown", "pending", "awaiting_approval", "approved", "running"] satisfies AgentToolCallStatus[]).flatMap(status => ["applied", "downloaded", "missing"].map(output => ({status, output}))))("never promotes $status call with $output old output", async ({status, output}) => {
        const {task, call, job, character} = await fixture();
        if (output === "downloaded") await db.characters.update(character.id, {slots: {}});
        if (output === "missing") await db.media.delete("output");
        await db.agentToolCalls.update(call.id, {status});
        const ledger = await db.agentToolCalls.get(call.id);
        const draft = await startTaskWrapup(task.id, "ai");
        expect(draft.snapshot.evidence.find(e => e.id === "tool:check")).toMatchObject({outcome: "unresolved", supportsResult: false});
        await expect(publishTaskWrapup(draft.id, {...draft.content, results: [{text: "查询成功", sourceIds: ["tool:check"]}]}, new AbortController().signal)).rejects.toThrow("真实来源");
        expect(draft.snapshot.evidence.find(e => e.id === "generation:job")?.supportsResult).toBe(output !== "missing");
        if (output !== "missing") await publishTaskWrapup(draft.id, {...draft.content, results: [{text: "独立文件可用", sourceIds: ["generation:job"]}]}, new AbortController().signal);
        expect(await db.agentToolCalls.get(call.id)).toEqual(ledger);
        expect(await db.agentGenerationJobs.get(job.id)).toEqual(job);
    });

    it.each(["non-generation", "remote-failed", "apply-conflict", "wrong-job", "wrong-media", "wrong-kind", "wrong-args", "no-result", "foreign-job", "ok-false", "success-false"] as const)("does not certify completed %s calls via old job", async fault => {
        const {task, call, job} = await fixture();
        if (fault === "non-generation") await db.agentToolCalls.update(call.id, {name: "list_generation_jobs", effect: "read"});
        if (fault === "remote-failed") await db.agentToolCalls.update(call.id, {result: JSON.stringify({jobId: job.id, status: "failed", result: job.result, error: "remote failed"})});
        if (fault === "apply-conflict") await db.agentToolCalls.update(call.id, {name: "apply_generation", effect: "write", result: JSON.stringify({jobId: job.id, status: "conflict", applied: false, result: job.result})});
        if (fault === "wrong-job") await db.agentToolCalls.update(call.id, {result: JSON.stringify({jobId: "foreign", status: "applied", result: job.result})});
        if (fault === "wrong-media") await db.agentToolCalls.update(call.id, {result: JSON.stringify({jobId: job.id, status: "applied", result: {...job.result, mediaId: "foreign"}})});
        if (fault === "wrong-kind") await db.agentToolCalls.update(call.id, {result: JSON.stringify({jobId: job.id, status: "applied", result: {...job.result, kind: "video"}})});
        if (fault === "wrong-args") await db.agentToolCalls.update(call.id, {arguments: JSON.stringify({jobId: "foreign"})});
        if (fault === "no-result") await db.agentToolCalls.update(call.id, {result: undefined});
        if (fault === "foreign-job") await db.agentGenerationJobs.update(job.id, {projectId: "foreign"});
        if (fault === "ok-false" || fault === "success-false") await db.agentToolCalls.update(call.id, {result: JSON.stringify({jobId: job.id, status: "applied", result: job.result, [fault === "ok-false" ? "ok" : "success"]: false})});
        const ledger = await db.agentToolCalls.get(call.id);
        const draft = await startTaskWrapup(task.id, "ai");
        expect(draft.snapshot.evidence.find(e => e.id === "tool:check")?.supportsResult).toBe(false);
        await expect(publishTaskWrapup(draft.id, {...draft.content, results: [{text: "此调用交付成果", sourceIds: ["tool:check"]}]}, new AbortController().signal)).rejects.toThrow("真实来源");
        await expect(db.transaction("rw", db.tables, () => writeTaskRecord(task, {kind: "verification", claim: "result", title: "成果", body: "交付", sources: [{type: "tool", id: call.id}]}, {author: "ai"}))).rejects.toThrow(/完成结果|已完成的业务工具结果/);
        expect(await db.agentToolCalls.get(call.id)).toEqual(ledger);
    });

    it.each(["image", "video"] as const)("keeps completed %s apply evidence tied to its actual job", async kind => {
        const {task, call} = await fixture(kind, false);
        await db.agentToolCalls.update(call.id, {name: "apply_generation", effect: "write"});
        expect((await getTaskWrapupState(task.id)).currentEvidence.find(e => e.id === "tool:check")).toMatchObject({available: true, supportsResult: true, outcome: "applied"});
        await db.transaction("rw", db.tables, () => writeTaskRecord(task, {kind: "verification", claim: "result", title: "应用", body: "已写入原槽位", sources: [{type: "tool", id: call.id}]}, {author: "ai"}));
    });

    it.each(["submit_generation", "check_generation"] as const)("checks %s provenance across two owned runs", async name => {
        const {task, call, job} = await fixture("image", false);
        const followup = await beginAgentRun({threadId: task.threadId, model: "model", content: "核实旧成果", connector: {
            id: "connector", name: "test", definitionId: "openai-compatible", baseUrl: "https://example.test", apiKey: "fixture", updatedAt: "now"
        }});
        await db.agentToolCalls.update(call.id, {name, runId: followup.id});
        // A submit is the origin of its job; a later check may inspect that same job.
        await db.agentGenerationJobs.update(job.id, {callId: call.id});
        await finishAgentRun(followup.id, "completed", {content: "核实完成"});
        const ledgerCall = await db.agentToolCalls.get(call.id), ledgerJob = await db.agentGenerationJobs.get(job.id);
        const draft = await startTaskWrapup(task.id, "ai");
        expect(draft.snapshot.evidence.find(e => e.id === `tool:${call.id}`)?.supportsResult).toBe(name === "check_generation");
        expect(draft.snapshot.evidence.find(e => e.id === "generation:job")?.supportsResult).toBe(true);
        const content = {...draft.content, results: [{text: "此调用生成或核实文件", sourceIds: [`tool:${call.id}`]}]};
        const write = () => db.transaction("rw", db.tables, () => writeTaskRecord(task, {kind: "verification", claim: "result", title: "核实", body: "文件可用", sources: [{type: "tool", id: call.id}]}, {author: "ai"}));
        if (name === "submit_generation") {
            const wrapupVersions = await db.agentTaskWrapupVersions.count();
            await expect(publishTaskWrapup(draft.id, content, new AbortController().signal)).rejects.toThrow("真实来源");
            await expect(write()).rejects.toThrow("完成结果");
            expect(await db.agentTaskRecords.count()).toBe(0);
            expect(await db.agentTaskRecordVersions.count()).toBe(0);
            expect(await db.agentTaskWrapups.get(draft.id)).toEqual(draft);
            expect(await db.agentTaskWrapupVersions.count()).toBe(wrapupVersions);
        } else {
            await publishTaskWrapup(draft.id, content, new AbortController().signal);
            await write();
        }
        expect(await db.agentToolCalls.get(call.id)).toEqual(ledgerCall);
        expect(await db.agentGenerationJobs.get(job.id)).toEqual(ledgerJob);
    });

    it("preserves completed non-generation write facts even when they mention an old job", async () => {
        const {task, call} = await fixture("image", false);
        const write = {...call, id: "submit", providerCallId: "write", name: "metadata_update", effect: "write" as const, result: JSON.stringify({ok: true, jobId: "job"})};
        await db.agentToolCalls.add(write);
        await db.media.delete("output");
        expect((await getTaskWrapupState(task.id)).currentEvidence.find(e => e.id === "tool:submit")).toMatchObject({available: true, supportsResult: true, outcome: "fact"});
        await db.transaction("rw", db.tables, () => writeTaskRecord(task, {kind: "verification", claim: "result", title: "元数据", body: "历史写操作", sources: [{type: "tool", id: write.id}]}, {author: "ai"}));
        expect(await db.agentToolCalls.get(write.id)).toEqual(write);
    });

    it.each(["batch-owner", "batch-project", "run-project"] as const)("rejects foreign %s provenance without breaking source inventory", async fault => {
        const {task, run, job} = await fixture();
        if (fault === "batch-owner") await db.agentGenerationBatches.update("batch", {taskId: "foreign"});
        if (fault === "batch-project") await db.agentGenerationBatches.update("batch", {projectId: "foreign"});
        if (fault === "run-project") await db.agentRuns.update(run.id, {projectId: "foreign"});
        await expect(taskGenerationSource(task, job.id)).rejects.toThrow(/不属于|来源已失效/);
        expect(await listTaskGenerationSources(task)).toEqual([]);
        const state = await getTaskWrapupState(task.id);
        for (const id of ["generation:job", "tool:check"]) expect(state.currentEvidence.find(e => e.id === id)).toMatchObject({supportsResult: false, outcome: "unresolved"});
    });

    it("marks a downloaded job snapshot stale when its owning run becomes foreign, even without tool evidence", async () => {
        const {task, run, character, call} = await fixture();
        await db.agentToolCalls.delete(call.id);
        await db.characters.update(character.id, {slots: {}});
        const draft = await startTaskWrapup(task.id, "user");
        expect(draft.snapshot.evidence.find(e => e.id === "generation:job")?.outcome).toBe("downloaded");
        expect((await getTaskWrapupState(task.id)).stale).toBe(false);
        await db.agentRuns.update(run.id, {projectId: "foreign"});
        const state = await getTaskWrapupState(task.id);
        expect(state.currentEvidence.find(e => e.id === "generation:job")).toMatchObject({available: false, supportsResult: false});
        expect(state.stale).toBe(true);
    });

    it("verifies a completed submit's own job and keeps tool body historical", async () => {
        const {task, call, job} = await fixture("image", false);
        const submit = {...call, id: "submit", providerCallId: "submit", name: "submit_generation", arguments: JSON.stringify({target: job.target}), result: JSON.stringify({jobId: job.id, status: "downloaded", result: job.result})};
        await db.agentToolCalls.add(submit);
        const state = await getTaskWrapupState(task.id);
        const evidence = state.currentEvidence.find(e => e.id === "tool:submit")!;
        expect(evidence).toMatchObject({supportsResult: true, outcome: "applied"});
        expect(evidence.body).toContain('"status":"downloaded"');
        expect(await db.agentToolCalls.get(submit.id)).toEqual(submit);
        await db.agentToolCalls.add({...submit, id: "unrelated-submit", providerCallId: "unrelated-submit"});
        expect((await getTaskWrapupState(task.id)).currentEvidence.find(e => e.id === "tool:unrelated-submit")?.supportsResult).toBe(false);
    });
});
