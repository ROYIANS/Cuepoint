import {describe, expect, it} from "vitest";
import {db} from "@/platform/product/store";
import {createChatThread, updateChatThread} from "@/features/agent/commands/chat";
import {beginAgentRun, checkpointAgentRun, finishAgentRun, interruptThreadRuns, recordAgentModelMetrics} from "@/features/agent/commands/agentRuns";
import {pauseForApproval, transitionToolCall} from "@/features/agent/commands/agentTools";
import {deleteChatThread} from "@/features/agent/commands/lifecycle";
import {acknowledgeAgentReportRead, acknowledgeThreadRead, prepareThreadActivityKey, readThreadActivity} from "@/features/agent/commands/threadActivity";
import {admitAgentJob, checkpointAgentJob, clearAgentJobResult, markAgentJobRunning, publishAgentJob, recoverAgentJobs} from "@/features/agent/commands/agentJobs";
import {withExecutionOwnership} from "@/features/agent/runtime/runOwnership";
import {sha256Bytes} from "@/platform/media/sha256";
import {failStoreTableOnce, interceptStoreTable} from "./helpers/storeFaults";
import {saveFixtureToolRound} from "./helpers/toolDispatch";
import {createProject} from "@/features/projects/commands/projects";
import {deleteProject, prepareProjectReportDeletion} from "@/features/projects/commands/lifecycle";
const connector = {id: "activity-model", protocol: "openai-compatible" as const, definitionId: "openai-compatible" as const, baseUrl: "https://fixture.invalid/v1", apiKey: "local", updatedAt: "now"};
async function begin(projectId?: string) {
    const thread = await createChatThread({projectId});
    const run = await beginAgentRun({threadId: thread.id, connector, model: "fixture", content: "hello"});
    return {thread, run};
}
function activity(threadId: string) {
    const identity = prepareThreadActivityKey(threadId);
    return db.transaction("r", [db.deviceSettings], tx => readThreadActivity(identity, tx));
}
async function jobFixture(projectId?: string) {
    const {thread, run} = await begin(projectId);
    await db.agentRuns.update(run.id, {toolLoading: undefined, enabledToolNames: ["web_read"]});
    await saveFixtureToolRound(run.id, "", [{id: "wire", type: "function", function: {name: "web_read", arguments: "{}"}}], [{title: "read", effect: "network", highRisk: false}]);
    const call = (await db.agentToolCalls.where("runId").equals(run.id).first())!;
    await transitionToolCall(run.id, call.id, ["pending"], "running");
    const context = {runId: run.id, threadId: thread.id, callId: call.id, projectId};
    const admitted = await admitAgentJob(context, {kind: "web_read", urls: ["https://fixture.invalid/source"]});
    let job = await markAgentJobRunning(context, admitted.job.id, admitted.job.revision, {serviceMayHaveRun: true});
    job = await checkpointAgentJob(context, job.id, job.revision, {completed: 1});
    return {thread, run, call, context, job};
}
describe("E11 real ProductStore public and read revisions", () => {
    it("hashes exact JSON UTF16 identities before transactions without truncation", () => {
        for (const threadId of ["a/b", "x".repeat(300), "\ud800", "\ud801", "�"]) {
            expect(prepareThreadActivityKey(threadId).key).toBe(`agent.thread-activity.${sha256Bytes(new TextEncoder().encode(JSON.stringify(threadId)))}`);
        }
        expect(prepareThreadActivityKey("\ud800").key).not.toBe(prepareThreadActivityKey("�").key);
    });
    it("ignores admission, identical/empty/timing checkpoints, title and metrics; terminal publishes once", async () => {
        const {thread, run} = await begin();
        expect(await activity(thread.id)).toBeNull();
        await checkpointAgentRun(run.id, 1, {content: ""});
        expect(await activity(thread.id)).toBeNull();
        await checkpointAgentRun(run.id, 2, {content: "answer", reasoning: "reason"});
        expect(await activity(thread.id)).toMatchObject({publicRevision: 1, readRevision: 0});
        await checkpointAgentRun(run.id, 3, {content: "answer", reasoning: "reason", reasoningDurationMs: 20});
        await checkpointAgentRun(run.id, 4, {content: "answer"});
        await updateChatThread(thread.id, {title: "renamed", model: "another"});
        await db.agentRuns.update(run.id, {modelStep: 1});
        await recordAgentModelMetrics(run.id, {step: 1, startedAt: 1, endedAt: 2});
        expect((await activity(thread.id))?.publicRevision).toBe(1);
        await finishAgentRun(run.id, "completed", {content: "answer", reasoning: "reason"});
        await finishAgentRun(run.id, "failed", {content: "wrong"});
        expect((await activity(thread.id))?.publicRevision).toBe(2);
        expect(await db.chatMessages.get(run.assistantMessageId)).toMatchObject({publicRevision: 2, content: "answer", status: "complete"});
    });
    it("passes the prepared identity through real nested scopes even after cache eviction", async () => {
        const {thread, run} = await begin(), identity = prepareThreadActivityKey(thread.id);
        for (let index = 0; index < 513; index++) prepareThreadActivityKey(`eviction-${index}`);
        await db.transaction("rw", [db.agentRuns, db.chatMessages, db.chatThreads, db.deviceSettings], tx => checkpointAgentRun(run.id, 1, {content: "nested accepted output"}, tx, identity));
        expect((await activity(thread.id))?.publicRevision).toBe(1);
    });
    it("acknowledges captured41 after42 without clearing42, no-op writes or reordering", async () => {
        const {thread, run} = await begin();
        for (let revision = 1; revision <= 41; revision++) await checkpointAgentRun(run.id, revision, {content: `output ${revision}`});
        const input = {threadId: thread.id, observedRevision: 41};
        const queued = acknowledgeThreadRead(input);
        input.observedRevision = 99;
        await checkpointAgentRun(run.id, 42, {content: "output 42"});
        await queued;
        expect(await activity(thread.id)).toMatchObject({publicRevision: 42, readRevision: 41});
        const at = (await db.chatThreads.get(thread.id))!.updatedAt;
        let writes = 0;
        const spy = interceptStoreTable(db, "deviceSettings", "put", async (_tx, _args, next) => {writes++; return next();});
        await acknowledgeThreadRead({threadId: thread.id, observedRevision: 40});
        await acknowledgeThreadRead({threadId: thread.id, observedRevision: 41});
        spy.mockRestore();
        expect(writes).toBe(0);
        expect((await db.chatThreads.get(thread.id))!.updatedAt).toBe(at);
        await expect(acknowledgeThreadRead({threadId: thread.id, observedRevision: 43})).rejects.toThrow();
    });
    it("rolls back source content and terminal state with activity failures, never treats corruption as read", async () => {
        const {thread, run} = await begin();
        const failure = failStoreTableOnce(db, "deviceSettings", "put", new Error("activity unavailable"));
        await expect(checkpointAgentRun(run.id, 1, {content: "must roll back"})).rejects.toThrow("activity unavailable");
        failure.mockRestore();
        expect((await db.chatMessages.get(run.assistantMessageId))!.content).toBe("");
        expect((await db.agentRuns.get(run.id))!.checkpoint).toBe(0);
        expect(await activity(thread.id)).toBeNull();
        const terminal = failStoreTableOnce(db, "deviceSettings", "put", new Error("terminal unavailable"));
        await expect(finishAgentRun(run.id, "completed")).rejects.toThrow("terminal unavailable");
        terminal.mockRestore();
        expect((await db.agentRuns.get(run.id))!.status).toBe("running");
        await db.deviceSettings.put({key: prepareThreadActivityKey(thread.id).key, value: {version: 1, threadId: thread.id, publicRevision: 4, readRevision: 9, reports: []}, updatedAt: "now"});
        await expect(activity(thread.id)).rejects.toThrow();
        await expect(acknowledgeThreadRead({threadId: thread.id, observedRevision: 4})).rejects.toThrow();
    });
    it("publishes approval/restoration once and deletion wins late output or acknowledgement", async () => {
        const {thread, run} = await begin();
        await saveFixtureToolRound(run.id, "review", [{id: "approval", type: "function", function: {name: "workspace_overview", arguments: "{}"}}], [{title: "review", effect: "read", highRisk: false}]);
        const call = (await db.agentToolCalls.where("runId").equals(run.id).first())!;
        await transitionToolCall(run.id, call.id, ["pending"], "awaiting_approval");
        await pauseForApproval(run.id);
        expect((await activity(thread.id))!.publicRevision).toBe(2);
        await interruptThreadRuns(thread.id);
        expect((await activity(thread.id))!.publicRevision).toBe(2);
        await deleteChatThread(thread.id);
        await acknowledgeThreadRead({threadId: thread.id, observedRevision: 2});
        await finishAgentRun(run.id, "completed");
        await expect(checkpointAgentRun(run.id, 4, {content: "late"})).rejects.toThrow();
        expect(await activity(thread.id)).toBeNull();
        expect(await db.chatThreads.get(thread.id)).toBeUndefined();
    });
    it("restores a half-committed approval once without publishing internal claims", async () => {
        const {thread, run} = await begin();
        await saveFixtureToolRound(run.id, "", [{id: "approval", type: "function", function: {name: "workspace_overview", arguments: "{}"}}], [{title: "review", effect: "read", highRisk: false}]);
        const call = (await db.agentToolCalls.where("runId").equals(run.id).first())!;
        await transitionToolCall(run.id, call.id, ["pending"], "awaiting_approval");
        expect((await activity(thread.id))?.publicRevision).toBe(1);
        await interruptThreadRuns(thread.id);
        expect((await db.agentRuns.get(run.id))?.status).toBe("waiting_approval");
        expect((await activity(thread.id))?.publicRevision).toBe(2);
        await interruptThreadRuns(thread.id);
        expect((await activity(thread.id))?.publicRevision).toBe(2);
    });
    it("rolls back report chunks, job revision and original call when its public cursor fails", async () => {
        const f = await jobFixture(), before = await activity(f.thread.id);
        const failure = failStoreTableOnce(db, "deviceSettings", "put", new Error("report cursor unavailable"));
        await expect(publishAgentJob(f.context, f.job.id, f.job.revision, {status: "completed", text: "retained report"})).rejects.toThrow("report cursor unavailable");
        failure.mockRestore();
        expect(await db.agentJobs.get(f.job.id)).toEqual(f.job);
        expect((await db.agentToolCalls.get(f.call.id))?.status).toBe("running");
        expect(await db.agentJobResultChunks.where("jobId").equals(f.job.id).count()).toBe(0);
        expect(await activity(f.thread.id)).toEqual(before);
    });
    it("publishes exact accepted report independently; historical report ack never consumes newer tail", async () => {
        const f = await jobFixture();
        const before = (await activity(f.thread.id))!.publicRevision;
        await publishAgentJob(f.context, f.job.id, f.job.revision, {status: "completed", text: "actual retained result"});
        const accepted = (await db.agentJobs.get(f.job.id))!;
        const record = (await activity(f.thread.id))!;
        expect(record.publicRevision).toBe(before);
        expect(record.reports).toEqual([{jobId: accepted.id, assistantMessageId: f.run.assistantMessageId, publicRevision: accepted.revision, readRevision: 0}]);
        await finishAgentRun(f.run.id, "completed");
        const next = await beginAgentRun({threadId: f.thread.id, connector, model: "fixture", content: "newer turn"});
        await checkpointAgentRun(next.id, 1, {content: "new tail"});
        await acknowledgeAgentReportRead({threadId: f.thread.id, jobId: accepted.id, observedRevision: accepted.revision});
        const read = (await activity(f.thread.id))!;
        expect(read.readRevision).toBe(0);
        expect(read.reports[0].readRevision).toBe(accepted.revision);
        await acknowledgeThreadRead({threadId: f.thread.id, observedRevision: read.publicRevision});
        await clearAgentJobResult({threadId: f.thread.id, original: {runId: f.run.id, callId: f.call.id}}, accepted.id);
        await acknowledgeAgentReportRead({threadId: f.thread.id, jobId: accepted.id, observedRevision: accepted.revision});
        await expect(publishAgentJob(f.context, accepted.id, f.job.revision, {status: "completed", text: "late replacement"})).rejects.toThrow();
        expect((await activity(f.thread.id))!.reports).toEqual([]);
    });
    it("publishes direct unknown recovery with actual original job revision and no replay", async () => {
        const f = await jobFixture();
        await withExecutionOwnership(f.thread.id, ownership => recoverAgentJobs(f.thread.id, ownership));
        const job = (await db.agentJobs.get(f.job.id))!;
        expect(job.status).toBe("unknown");
        expect((await activity(f.thread.id))!.reports[0]).toMatchObject({jobId: job.id, publicRevision: job.revision, readRevision: 0});
        await withExecutionOwnership(f.thread.id, ownership => recoverAgentJobs(f.thread.id, ownership));
        expect((await db.agentJobs.get(job.id))!.revision).toBe(job.revision);
    });
    it("clears deleted project reports atomically while preserving chat history, rejecting a changed deletion scope", async () => {
        const project = await createProject("Report owner"), f = await jobFixture(project.id);
        await publishAgentJob(f.context, f.job.id, f.job.revision, {status: "completed", text: "project report"});
        const prepared = await prepareProjectReportDeletion(project.id);
        const second = await jobFixture(project.id);
        await expect(deleteProject(project.id, db, prepared)).rejects.toThrow("项目报告范围已变化");
        expect(await db.projects.get(project.id)).toBeDefined();
        const current = await prepareProjectReportDeletion(project.id);
        const failure = failStoreTableOnce(db, "projects", "delete", new Error("late delete failure"));
        await expect(deleteProject(project.id, db, current)).rejects.toThrow("late delete failure");
        failure.mockRestore();
        expect((await activity(f.thread.id))?.reports).toHaveLength(1);
        expect(await db.agentJobs.get(f.job.id)).toBeDefined();
        await db.transaction("rw", db.tables, tx => deleteProject(project.id, tx, current));
        expect(await db.agentJobs.get(f.job.id)).toBeUndefined();
        expect(await db.agentJobs.get(second.job.id)).toBeUndefined();
        expect((await activity(f.thread.id))?.reports).toEqual([]);
        expect(await db.chatThreads.get(f.thread.id)).toBeDefined();
        await acknowledgeAgentReportRead({threadId: f.thread.id, jobId: f.job.id, observedRevision: f.job.revision});
        await expect(publishAgentJob(f.context, f.job.id, f.job.revision, {status: "completed", text: "late"})).rejects.toThrow();
        expect((await activity(f.thread.id))?.reports).toEqual([]);
    });
});
