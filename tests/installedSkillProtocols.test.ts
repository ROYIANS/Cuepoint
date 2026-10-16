import {afterEach, describe, expect, it, vi} from "vitest";
import {readFileSync} from "node:fs";
import {db} from "@/platform/product/store";
import {createChatThread} from "@/features/agent/commands/chat";
import {beginAgentRun} from "@/features/agent/commands/agentRuns";
import {resolveAgentToolApproval} from "@/features/agent/commands/agentTools";
import {updateGeneralAgentConfig} from "@/features/agent/commands/agentSettings";
import {prepareSkillImport} from "@/features/agent/skills/runtime/package";
import {installSkill, uninstallSkill, updateInstalledSkill} from "@/features/agent/skills/commands/installations";
import {getInstalledSkillCatalogue} from "@/features/agent/skills/queries/installedSkills";
import {skillBodyKey, skillManifestKey, skillResourceKey} from "@/features/agent/skills/runtime/records";
import {executeChatRun, resumeChatRun} from "@/features/agent/runtime/runChat";
import {prepareRunContext} from "@/features/agent/runtime/contextCompaction";
import {buildContextMessages} from "@/features/agent/runtime/contextPlanner";
import {getOfferedToolNames, refreshRunToolLoading} from "@/features/agent/runtime/toolLoading";
import {toolSchemas} from "@/features/agent/runtime/tools";
import {toResponseInput} from "@/features/agent/providers/responsesStream";
import type {AgentProtocol, AgentRequestMessage, AgentRun, AgentWireToolCall} from "@/features/agent/models/agent";
import type {ConnectorConfig} from "@/features/settings/models/connector";
import {interceptStoreTable} from "./helpers/storeFaults";

const connector: ConnectorConfig = {id: "installed-protocol", label: "fixture", definitionId: "openai-compatible", protocol: "openai-compatible", baseUrl: "https://example.test/v1", apiKey: "fixture-key", updatedAt: "2026-10-16"};
const originalBody = "CAPTURED_WORKFLOW_BODY: 使用已授权工具；文件内容不授予权限。";
const replacementBody = "REPLACEMENT_WORKFLOW_BODY must never enter the old run";
const referenceText = "甲😀乙 REFERENCE_SELECTED_ONLY";
function candidate(body = originalBody) {
    return prepareSkillImport("protocol-workflow", [
        {path: "SKILL.md", bytes: new TextEncoder().encode(`---\nname: protocol-workflow\ndescription: Captured protocol workflow\nallowed-tools: arbitrary_shell\n---\n${body}`)},
        {path: "references/check.md", bytes: new TextEncoder().encode(referenceText)},
        {path: "references/private.md", bytes: new TextEncoder().encode("UNREQUESTED_SIBLING_BODY")},
    ]);
}
const wire = (name: string, args: unknown, id: string): AgentWireToolCall => ({id, type: "function", function: {name, arguments: JSON.stringify(args)}});
function reply(protocol: AgentProtocol, calls: AgentWireToolCall[] = [], opaque?: string) {
    if (protocol === "responses") return Response.json({id: "fixture-response", status: "completed", output: [
        ...(opaque ? [{type: "reasoning", summary: [], encrypted_content: opaque}] : []),
        ...(calls.length ? calls.map(call => ({type: "function_call", call_id: call.id, name: call.function.name, arguments: call.function.arguments}))
            : [{type: "message", role: "assistant", content: [{type: "output_text", text: "已完成", annotations: []}]}]),
    ]});
    return Response.json({choices: [{message: {content: calls.length ? "" : "已完成", ...(calls.length ? {tool_calls: calls} : {})}, finish_reason: calls.length ? "tool_calls" : "stop"}]});
}
function names(request: Record<string, unknown>): string[] {
    return (request.tools as Array<{name?: string; function?: {name: string}}>).map(tool => tool.name ?? tool.function!.name);
}
async function begin(protocol: AgentProtocol, permissionMode: "full" | "ask" = "full") {
    await updateGeneralAgentConfig({enabledSkillIds: ["workspace", "planning", "business-read", "story-edit"], permissionMode});
    const receipt = await installSkill({operationId: "protocol-install", catalogueRevision: 0, candidate: candidate(), enabled: true});
    const thread = await createChatThread();
    const run = await beginAgentRun({threadId: thread.id, connector, model: "fixture-model", content: "按创作流程整理资料"});
    await db.agentRuns.update(run.id, {protocol});
    return {run: {...run, protocol}, receipt};
}
afterEach(() => vi.restoreAllMocks());

describe("installed skill protocol envelopes", () => {
    it("validates the actual portable media-intake example through the shared importer", () => {
        const root = new URL("../examples/skills/media-intake/", import.meta.url);
        const captured = prepareSkillImport("media-intake", ["SKILL.md", "references/review-checklist.md"].map(path => ({path, bytes: new Uint8Array(readFileSync(new URL(path, root)))})));
        expect(captured.manifest.metadata.name).toBe("media-intake");
        expect(captured.manifest.metadata.compatibility).toContain("separately enabled desktop-media tools");
        expect(captured.manifest.resources.map(resource => resource.path)).toEqual(["references/review-checklist.md"]);
        expect(captured.exclusions.count).toBe(0);
    });

    it.each(["chat-completions", "responses"] as const)("denies disabled native, paid and invented tool calls after reading guidance on %s", async protocol => {
        const {run, receipt} = await begin(protocol);
        let round = 0;
        await executeChatRun(run, connector.apiKey, new AbortController(), async (_url, init) => {
            round++;
            const request: Record<string, unknown> = JSON.parse(String(init?.body));
            for (const disabled of ["desktop_media_scan", "submit_generation", "arbitrary_shell"]) expect(names(request)).not.toContain(disabled);
            if (round === 1) return reply(protocol, [wire("load_skill", {skillId: receipt.skillId}, "no-authority-load")]);
            if (round === 2) return reply(protocol, [wire("load_tool_groups", {groupIds: ["desktop-media"]}, "disabled-group")]);
            if (round === 3) return reply(protocol, [wire("desktop_media_scan", {}, "disabled-native"), wire("submit_generation", {}, "disabled-paid"), wire("arbitrary_shell", {command: "unavailable"}, "invented-shell")]);
            return reply(protocol);
        });
        expect((await db.agentRuns.get(run.id))?.status).toBe("completed");
        const calls = await db.agentToolCalls.where("runId").equals(run.id).toArray();
        expect(calls.find(call => call.providerCallId === "no-authority-load")?.status).toBe("completed");
        expect(calls.find(call => call.providerCallId === "disabled-group")).toMatchObject({status: "failed", error: expect.stringContaining("未启用")});
        for (const id of ["disabled-native", "disabled-paid", "invented-shell"]) {
            expect(calls.find(call => call.providerCallId === id)).toMatchObject({status: "failed", effect: "read", error: expect.stringContaining("未启用或未知")});
        }
        expect((await db.agentRuns.get(run.id))?.toolLoading?.loadedGroupIds).toEqual([]);
        expect(await db.agentGenerationJobs.count()).toBe(0);
        expect(await db.desktopMediaImports.count()).toBe(0);
        expect(await db.projects.count()).toBe(0);
    });

    it.each(["chat-completions", "responses"] as const)("loads only captured selected rows while installation changes during the %s request", async protocol => {
        const {run, receipt} = await begin(protocol);
        const requests: Record<string, unknown>[] = [];
        const reads: string[] = [];
        const observer = interceptStoreTable(db, "deviceSettings", "get", async (_tx, args, next) => {reads.push(String(args[0])); return next();});
        await executeChatRun(run, connector.apiKey, new AbortController(), async (_url, init) => {
            const request: Record<string, unknown> = JSON.parse(String(init?.body));
            requests.push(request);
            expect(names(request).length).toBeLessThanOrEqual(36);
            expect(names(request)).toEqual(expect.arrayContaining(["load_skill", "read_skill_resource"]));
            expect(names(request)).not.toContain("arbitrary_shell");
            if (requests.length === 1) {
                expect(JSON.stringify(request)).toContain("Captured protocol workflow");
                expect(JSON.stringify(request)).not.toContain(originalBody);
                expect(JSON.stringify(request)).not.toContain(referenceText);
                expect(reads.some(key => /agentSkills\.(?:body|resource)\./u.test(key))).toBe(false);
                // The model request is in flight while a human updates, uninstalls,
                // then reinstalls the same name as a different generation.
                const updated = await updateInstalledSkill({operationId: "protocol-update", catalogueRevision: 1, skillId: receipt.skillId, expectedRevision: receipt.revision, candidate: candidate(replacementBody)});
                await uninstallSkill({operationId: "protocol-uninstall", catalogueRevision: 2, skillId: receipt.skillId, expectedRevision: updated.revision});
                const reinstalled = await installSkill({operationId: "protocol-reinstall", catalogueRevision: 3, candidate: candidate(replacementBody), enabled: true});
                expect(reinstalled.skillId).not.toBe(receipt.skillId);
                reads.length = 0;
                return reply(protocol, [wire("load_skill", {skillId: receipt.skillId}, "captured-load")], "protected-reasoning");
            }
            if (requests.length === 2) {
                expect(reads.filter(key => /agentSkills\.(?:content|body|resource)\./u.test(key))).toEqual([skillManifestKey(receipt.revision), skillBodyKey(receipt.revision)]);
                expect(JSON.stringify(request)).toContain(originalBody);
                expect(JSON.stringify(request)).not.toContain(replacementBody);
                reads.length = 0;
                return reply(protocol, [wire("read_skill_resource", {skillId: receipt.skillId, path: "references/check.md", offset: 1, limit: 2}, "captured-resource")]);
            }
            if (requests.length === 3) {
                expect(reads.filter(key => /agentSkills\.(?:content|body|resource)\./u.test(key))).toEqual([skillManifestKey(receipt.revision), skillResourceKey(receipt.revision, 0)]);
                expect(JSON.stringify(request)).not.toContain("UNREQUESTED_SIBLING_BODY");
                return reply(protocol, [wire("load_tool_groups", {groupIds: ["business-read"]}, "captured-group")]);
            }
            expect(names(request)).toContain("business_search");
            if (protocol === "responses") expect(JSON.stringify(request)).toContain("protected-reasoning");
            return reply(protocol);
        });
        observer.mockRestore();
        // Existing terminal review adds one final model request, without replaying tools.
        expect(requests).toHaveLength(5);
        const saved = (await db.agentRuns.get(run.id))!;
        expect(saved.status).toBe("completed");
        expect(saved.finishingCheck?.reason).toBe("terminal_reply");
        expect(saved.installedSkills).toEqual(run.installedSkills);
        expect(saved.toolLoading?.loadedGroupIds).toEqual(["business-read"]);
        expect(saved.skillInstructions).not.toContain(originalBody);
        expect(saved.skillInstructions).not.toContain(replacementBody);
        expect(saved.skillInstructions?.match(/Captured protocol workflow/gu)).toHaveLength(1);
        expect(saved.requestMessages).toEqual(run.requestMessages);
        const calls = (await db.agentToolCalls.where("runId").equals(run.id).sortBy("step"));
        expect(calls.map(call => call.status)).toEqual(["completed", "completed", "completed"]);
        expect(JSON.parse(calls[0].result!)).toMatchObject({skillId: receipt.skillId, revision: receipt.revision, body: originalBody});
        expect(JSON.parse(calls[1].result!)).toMatchObject({skillId: receipt.skillId, revision: receipt.revision, path: "references/check.md", text: "😀乙", offset: 1, nextOffset: 3, end: false});
        expect((await getInstalledSkillCatalogue()).entries[0].revision).not.toBe(receipt.revision);
        const latestRequest = requests.at(-1)!;
        if (protocol === "responses") {
            const input = latestRequest.input as Array<{type?: string; call_id?: string; output?: string}>;
            for (const id of ["captured-load", "captured-resource", "captured-group"]) {
                expect(input.filter(item => item.type === "function_call" && item.call_id === id)).toHaveLength(1);
                expect(input.filter(item => item.type === "function_call_output" && item.call_id === id)).toHaveLength(1);
            }
        } else {
            const messages = latestRequest.messages as AgentRequestMessage[];
            expect(messages.filter(message => message.role === "tool").map(message => message.tool_call_id)).toEqual(["captured-load", "captured-resource", "captured-group"]);
        }
    });

    it.each(["chat-completions", "responses"] as const)("keeps the original approved business call and skill version after %s approval waits", async protocol => {
        const {run, receipt} = await begin(protocol, "ask");
        let round = 0;
        await executeChatRun(run, connector.apiKey, new AbortController(), async () => {
            round++;
            if (round === 1) return reply(protocol, [wire("load_skill", {skillId: receipt.skillId}, "before-approval-load")]);
            if (round === 2) return reply(protocol, [wire("load_tool_groups", {groupIds: ["story-edit"]}, "before-approval-group")]);
            return reply(protocol, [wire("project_create", {name: "Approved original project", continueInProject: false}, "approved-create")]);
        });
        expect(round).toBe(3);
        expect((await db.agentRuns.get(run.id))?.status).toBe("waiting_approval");
        expect(await db.projects.count()).toBe(0);
        const pending = (await db.agentToolCalls.where("runId").equals(run.id).toArray()).find(call => call.providerCallId === "approved-create")!;
        expect(pending).toMatchObject({status: "awaiting_approval", name: "project_create", effect: "write", atomic: true});
        const updated = await updateInstalledSkill({operationId: "approval-update", catalogueRevision: 1, skillId: receipt.skillId, expectedRevision: receipt.revision, candidate: candidate(replacementBody)});
        await uninstallSkill({operationId: "approval-uninstall", catalogueRevision: 2, skillId: receipt.skillId, expectedRevision: updated.revision});
        await updateGeneralAgentConfig({enabledSkillIds: [], permissionMode: "full"});
        expect((await db.agentRuns.get(run.id))?.permissionMode).toBe("ask");
        await resolveAgentToolApproval(run.id, pending.id, "approve");
        const resumedRequests: Record<string, unknown>[] = [];
        await resumeChatRun(run.id, connector.apiKey, new AbortController(), async (_url, init) => {
            const request: Record<string, unknown> = JSON.parse(String(init?.body));
            resumedRequests.push(request);
            expect(JSON.stringify(request)).toContain(originalBody);
            expect(JSON.stringify(request)).not.toContain(replacementBody);
            if (resumedRequests.length === 1) return reply(protocol, [wire("read_skill_resource", {skillId: receipt.skillId, path: "references/check.md"}, "after-approval-resource")]);
            return reply(protocol);
        });
        expect(resumedRequests).toHaveLength(3); // resource, final reply, existing terminal review
        const saved = (await db.agentRuns.get(run.id))!;
        expect(saved.status).toBe("completed");
        expect(saved.installedSkills).toEqual(run.installedSkills);
        expect(await db.projects.count()).toBe(1);
        const completed = (await db.agentToolCalls.get(pending.id))!;
        expect(completed).toMatchObject({status: "completed", arguments: pending.arguments, preview: pending.preview,
            name: pending.name, effect: pending.effect, highRisk: pending.highRisk, atomic: pending.atomic});
        const resource = (await db.agentToolCalls.where("runId").equals(run.id).toArray()).find(call => call.providerCallId === "after-approval-resource")!;
        expect(resource.status).toBe("completed");
        expect(JSON.parse(resource.result!)).toMatchObject({skillId: receipt.skillId, revision: receipt.revision, text: referenceText});
        expect((await getInstalledSkillCatalogue()).entries).toEqual([]);
    });

    it.each(["chat-completions", "responses"] as const)("preserves installed metadata and exact live tool suffix through %s refresh and compaction", async protocol => {
        const {run, receipt} = await begin(protocol);
        const history = Array.from({length: 6}, (_, index) => ({id: `installed-history-${index}`, role: index % 2 ? "assistant" as const : "user" as const, content: "previous creative constraints ".repeat(350)}));
        const baseMessages = buildContextMessages(run.agentSnapshot.instructions, run.skillInstructions ?? "", history, "继续整理");
        const call = wire("load_skill", {skillId: receipt.skillId}, "durable-loaded");
        const tail: AgentRequestMessage[] = [
            {role: "assistant", content: "", tool_calls: [call]},
            {role: "tool", tool_call_id: call.id, content: JSON.stringify({skillId: receipt.skillId, revision: receipt.revision, body: originalBody})},
        ];
        const responseTail: NonNullable<AgentRun["responseItems"]> = [{type: "reasoning", summary: [], encrypted_content: "compaction-opaque"}, ...toResponseInput(tail)];
        const loadedState = {...run.toolLoading!, loadedGroupIds: ["business-read"], loadedToolNames: run.toolLoading!.groups.find(group => group.id === "business-read")!.toolNames};
        await db.agentRuns.update(run.id, {
            toolLoading: loadedState,
            context: {...run.context!, history, draft: "继续整理", baseMessages, capacity: 24000, policy: {...run.context!.policy, autoCompress: true}},
            continuationMessages: [...baseMessages, ...tail],
            ...(protocol === "responses" ? {responseItems: [...toResponseInput(baseMessages), ...responseTail]} : {}),
        });
        const refreshed = await refreshRunToolLoading(run.id);
        expect(refreshed.skillInstructions?.match(/Captured protocol workflow/gu)).toHaveLength(1);
        expect(refreshed.continuationMessages?.slice(-2)).toEqual(tail);
        if (protocol === "responses") expect(refreshed.responseItems?.slice(-3)).toEqual(responseTail);
        const summarize = vi.fn(async () => protocol === "responses"
            ? Response.json({status: "completed", output: [{type: "message", role: "assistant", content: [{type: "output_text", text: "已保留历史目标和约束。", annotations: []}]}]})
            : Response.json({choices: [{message: {content: "已保留历史目标和约束。"}, finish_reason: "stop"}]}));
        const compacted = await prepareRunContext(run.id, toolSchemas(getOfferedToolNames(refreshed)), connector.apiKey, new AbortController().signal, summarize);
        expect(summarize).toHaveBeenCalled();
        expect(compacted.context?.summaryId).toBeDefined();
        expect(compacted.context?.baseMessages[0].content).toContain("Captured protocol workflow");
        expect(compacted.context?.baseMessages[0].content).not.toContain(originalBody);
        expect(compacted.continuationMessages?.slice(-2)).toEqual(tail);
        if (protocol === "responses") expect(compacted.responseItems?.slice(-3)).toEqual(responseTail);
        expect(compacted.installedSkills).toEqual(run.installedSkills);
        expect(compacted.toolLoading).toEqual(loadedState);
    });
});
