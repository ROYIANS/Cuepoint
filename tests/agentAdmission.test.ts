import {describe, expect, it, vi} from "vitest";
import {db} from "@/platform/product/store";
import {beginAgentRun, connectorRunIdentity, finishAgentRun} from "@/features/agent/commands/agentRuns";
import {createChatThread} from "@/features/agent/commands/chat";
import {readAgentAdmission} from "@/features/agent/queries/agentAdmission";
import type {ChatAdmissionIdentity} from "@/features/agent/models/chatSubmission";
import type {ConnectorConfig} from "@/features/settings/models/connector";
import type {ProjectReference, ReferenceAttachment} from "@/features/references/models/references";
import {createProject} from "@/features/projects/commands/projects";
import {UnknownCommitError} from "@/platform/storage/errors";
import {failStoreTableOnce} from "./helpers/storeFaults";
import * as visionCapability from "@/features/settings/models/visionCapability";

const connector: ConnectorConfig = {
    id: "admission-connector", definitionId: "openai-compatible", baseUrl: "https://example.test/v1/",
    apiKey: "private-current-key", updatedAt: "2026-10-15T00:00:00Z"
};
const admission: ChatAdmissionIdentity = {
    runId: "run_admission", userMessageId: "cmsg_submitted", assistantMessageId: "cmsg_reply"
};

async function fixture(options: {project?: boolean; attachments?: boolean; content?: string} = {}) {
    const project = options.project || options.attachments ? await createProject("准入归属") : undefined;
    const thread = await createChatThread({id: "cth_admission", projectId: project?.id});
    const attachments: ReferenceAttachment[] = [];
    if (project && options.attachments) {
        for (const id of ["source_a", "source_b"]) {
            await db.media.add({id: `media_${id}`, projectId: project.id, mimeType: "text/plain", filename: `${id}.txt`, blob: new Blob([id])});
            const reference: ProjectReference = {
                id, projectId: project.id, mediaId: `media_${id}`, digest: id, kind: "text", filename: `${id}.txt`,
                mimeType: "text/plain", size: id.length, revision: 1, status: "ready", operationId: `import_${id}`,
                coverage: {totalUnits: 1, processedUnits: 1, emptyUnits: [], characters: id.length, truncated: false},
                warnings: [], createdAt: "2026-10-15T00:00:00Z", updatedAt: "2026-10-15T00:00:00Z"
            };
            await db.projectReferences.add(reference);
            await db.referenceChunks.add({
                id: `chunk_${id}`, projectId: project.id, referenceId: id, revision: 1, index: 0,
                text: id, locator: {kind: "lines", start: 1, end: 1}
            });
            attachments.push({referenceId: id, revision: 1});
        }
    }
    const input = {
        threadId: thread.id, admission, connector: connectorRunIdentity(connector), model: "test-model",
        content: options.content ?? "  同一份提交  ", attachments, projectId: project?.id
    };
    return {thread, input, begin: () => beginAgentRun({...input, connector, expectedOwner: {projectId: input.projectId}})};
}

describe("fresh Agent admission identities and readonly reconciliation", () => {
    it("accepts preallocated identities atomically and reads them through one supplied readonly snapshot", async () => {
        const {input, begin} = await fixture({project: true});
        const run = await begin();
        expect(run).toMatchObject({id: admission.runId, userMessageId: admission.userMessageId, assistantMessageId: admission.assistantMessageId});
        expect(JSON.stringify(run)).not.toContain(connector.apiKey);
        const read = vi.spyOn(db, "transaction");
        try {
            const result = await readAgentAdmission({...input, model: " test-model ", connector: {...input.connector, baseUrl: "https://EXAMPLE.test/v1///"}});
            expect(result).toMatchObject({status: "accepted", run: {id: admission.runId}, userMessage: {content: "同一份提交", role: "user"}, assistantMessage: {runId: admission.runId, role: "assistant"}});
            expect(read).toHaveBeenCalledTimes(1);
            expect(read.mock.calls[0]?.[0]).toBe("r");
            expect(read.mock.calls[0]?.[1].map(table => typeof table === "string" ? table : table.name).sort()).toEqual(["agentRuns", "chatMessages", "chatThreads"]);
        } finally {
            read.mockRestore();
        }
        await expect(db.transaction("r", [db.chatThreads, db.agentRuns, db.chatMessages], tx => readAgentAdmission(input, tx))).resolves.toMatchObject({status: "accepted"});
    });

    it("returns absent for no admission rows even when the reserved thread already exists", async () => {
        const {input} = await fixture();
        expect(await readAgentAdmission(input)).toEqual({status: "absent"});
        expect(await db.chatThreads.count()).toBe(1);
        await db.chatThreads.delete(input.threadId);
        expect(await readAgentAdmission(input)).toEqual({status: "absent"});
        expect(await db.agentRuns.count()).toBe(0);
    });

    it("does not treat an existing foreign-owner thread as a retryable absent admission", async () => {
        const {input} = await fixture({project: true});
        expect(await readAgentAdmission({...input, projectId: undefined})).toEqual({status: "mismatch"});
        expect(await readAgentAdmission({...input, projectId: "foreign-project"})).toEqual({status: "mismatch"});
        expect(await db.chatMessages.count()).toBe(0);
    });

    it.each([false, true])("rechecks frozen %s project ownership after asynchronous preparation and before all admission writes", async initiallyBound => {
        const {input} = await fixture({project: initiallyBound});
        const other = await createProject("准备期间改绑");
        const expectedOwner = {projectId: input.projectId};
        const original = visionCapability.resolveVisionCapability;
        const preparation = vi.spyOn(visionCapability, "resolveVisionCapability").mockImplementationOnce(async (...args) => {
            const result = await original(...args);
            await db.chatThreads.update(input.threadId, {projectId: other.id});
            // The caller's mutable record cannot change the command's frozen expectation.
            expectedOwner.projectId = other.id;
            return result;
        });
        try {
            await expect(beginAgentRun({...input, connector, expectedOwner})).rejects.toThrow("项目归属已变化");
        } finally {
            preparation.mockRestore();
        }
        expect(await db.chatMessages.count()).toBe(0);
        expect(await db.agentRuns.count()).toBe(0);
        expect(await db.chatThreads.get(input.threadId)).toMatchObject({projectId: other.id});
    });

    it("never returns an existing fresh admission as begin success or overwrites its messages", async () => {
        const {input, begin} = await fixture();
        const original = await begin();
        await finishAgentRun(original.id, "completed", {content: "已完成的原回复"});
        const before = await db.chatMessages.toArray();
        await expect(begin()).rejects.toThrow();
        expect(await db.agentRuns.count()).toBe(1);
        expect(await db.chatMessages.toArray()).toEqual(before);
        expect(await readAgentAdmission(input)).toMatchObject({status: "accepted", assistantMessage: {content: "已完成的原回复"}});
    });

    it("rejects a duplicate reserved thread ID without changing the original owner or title", async () => {
        const thread = await createChatThread({id: "cth_reserved", title: "原线程"});
        await expect(createChatThread({id: thread.id, title: "覆盖"})).rejects.toThrow();
        expect(await db.chatThreads.get(thread.id)).toEqual(thread);
    });

    it("rejects invalid or colliding supplied IDs before producing admission rows", async () => {
        const {input} = await fixture();
        for (const invalid of ["", "with space", "with\ncontrol", "with\u007fcontrol", "x".repeat(257)]) {
            await expect(createChatThread({id: invalid})).rejects.toThrow("提交标识无效");
            await expect(beginAgentRun({...input, connector, admission: {...admission, runId: invalid}})).rejects.toThrow("提交标识无效");
        }
        await expect(beginAgentRun({...input, connector, admission: {...admission, assistantMessageId: admission.userMessageId}})).rejects.toThrow("不能重复");
        expect(await db.chatThreads.count()).toBe(1);
        expect(await db.chatMessages.count()).toBe(0);
        expect(await db.agentRuns.count()).toBe(0);
    });

    it("keeps durable regeneration separate and preserves optional-free begin behavior", async () => {
        const {input, begin} = await fixture();
        const original = await begin();
        await finishAgentRun(original.id, "failed");
        await expect(beginAgentRun({...input, connector, retryOfRunId: original.id})).rejects.toThrow("重新生成不能复用");
        const retry = await beginAgentRun({threadId: input.threadId, connector, model: input.model, retryOfRunId: original.id});
        expect(retry.userMessageId).toBe(original.userMessageId);
        expect(retry.id).not.toBe(original.id);
        expect(retry.requestMessages).toEqual(original.requestMessages);
        expect(await db.chatMessages.count()).toBe(3);
        expect(await readAgentAdmission(input)).toMatchObject({status: "accepted", run: {id: original.id}});
    });

    it("rolls back both message inserts when the final run insert fails", async () => {
        const {input, thread, begin} = await fixture();
        const failure = new Error("run insert rejected");
        const fault = failStoreTableOnce(db, "agentRuns", "add", failure);
        try { await expect(begin()).rejects.toBe(failure); }
        finally { fault.mockRestore(); }
        expect(await readAgentAdmission(input)).toEqual({status: "absent"});
        expect(await db.chatMessages.count()).toBe(0);
        expect(await db.chatThreads.get(thread.id)).toEqual(thread);
        expect(await begin()).toMatchObject({id: admission.runId});
    });

    it("rolls back provisional rows when only the supplied run ID already belongs to another admission", async () => {
        const {input, begin} = await fixture();
        const original = await begin();
        await finishAgentRun(original.id, "completed", {content: "原记录"});
        const other = await createChatThread();
        await expect(beginAgentRun({...input, threadId: other.id, connector, admission: {
            ...admission, userMessageId: "cmsg_collision_user", assistantMessageId: "cmsg_collision_reply"
        }})).rejects.toThrow();
        expect(await db.chatMessages.where("threadId").equals(other.id).count()).toBe(0);
        expect(await db.agentRuns.count()).toBe(1);
        expect(await db.chatMessages.get(admission.assistantMessageId)).toMatchObject({content: "原记录"});
    });

    it.each(["run", "user", "assistant", "thread"] as const)("refuses partial or missing %s ownership rather than calling it absent", async missing => {
        const {input, begin} = await fixture();
        await begin();
        if (missing === "run") await db.agentRuns.delete(admission.runId);
        if (missing === "user") await db.chatMessages.delete(admission.userMessageId);
        if (missing === "assistant") await db.chatMessages.delete(admission.assistantMessageId);
        if (missing === "thread") await db.chatThreads.delete(input.threadId);
        expect(await readAgentAdmission(input)).toEqual({status: "mismatch"});
    });

    it("requires exact owner, pointers, roles, frozen connector/model and submitted content", async () => {
        const {input, begin} = await fixture({project: true});
        const run = await begin();
        const foreign = await createChatThread();
        const mismatches = [
            {...input, threadId: foreign.id}, {...input, projectId: undefined}, {...input, projectId: "foreign-project"},
            {...input, content: "不同内容"}, {...input, model: "other-model"},
            {...input, connector: {...input.connector, id: "foreign-connector"}},
            {...input, connector: {...input.connector, definitionId: "other-provider"}},
            {...input, connector: {...input.connector, baseUrl: "https://foreign.test/v1"}},
            {...input, connector: {...input.connector, baseUrl: "https://example.test/v1?key=unsafe"}}
        ];
        for (const mismatch of mismatches) expect(await readAgentAdmission(mismatch)).toEqual({status: "mismatch"});
        await db.agentRuns.update(run.id, {userMessageId: "foreign-user"});
        expect(await readAgentAdmission(input)).toEqual({status: "mismatch"});
        await db.agentRuns.update(run.id, {userMessageId: admission.userMessageId});
        await db.chatMessages.update(admission.userMessageId, {role: "system"});
        expect(await readAgentAdmission(input)).toEqual({status: "mismatch"});
        await db.chatMessages.update(admission.userMessageId, {role: "user"});
        await db.chatMessages.update(admission.assistantMessageId, {runId: "foreign-run"});
        expect(await readAgentAdmission(input)).toEqual({status: "mismatch"});
    });

    it("matches attachment-only fallback and exact ordered reference revisions without substituting current sources", async () => {
        const {input, begin} = await fixture({attachments: true, content: "  "});
        await begin();
        expect(await readAgentAdmission(input)).toMatchObject({status: "accepted", userMessage: {content: "请结合附加的参考资料协助我。", attachments: input.attachments}});
        expect(await readAgentAdmission({...input, attachments: [...input.attachments].reverse()})).toEqual({status: "mismatch"});
        expect(await readAgentAdmission({...input, attachments: [{...input.attachments[0], revision: 2}, input.attachments[1]]})).toEqual({status: "mismatch"});
        expect(await readAgentAdmission({...input, attachments: []})).toEqual({status: "mismatch"});
        await db.projectReferences.update(input.attachments[0].referenceId, {status: "unavailable", revision: 2});
        // This establishes historical acceptance only; it does not prepare a new dispatch.
        expect(await readAgentAdmission(input)).toMatchObject({status: "accepted"});
    });

    it("preserves query failures and never converts unknown certainty into absence", async () => {
        const {input} = await fixture();
        const failure = new UnknownCommitError("unknown-operation", "unknown-workspace");
        const fault = failStoreTableOnce(db, "agentRuns", "get", failure);
        try { await expect(readAgentAdmission(input)).rejects.toBe(failure); }
        finally { fault.mockRestore(); }
        expect(await db.chatMessages.count()).toBe(0);
        expect(await db.agentRuns.count()).toBe(0);
    });
});
