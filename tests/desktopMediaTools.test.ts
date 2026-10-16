import {afterEach, describe, expect, it, vi} from "vitest";
import {createDesktopMediaServices, DesktopMediaUncertainError} from "@/platform/runtime/desktopMedia";
import * as runtime from "@/platform/runtime/desktopMedia";
import {db} from "@/platform/product/store";
import {createProject} from "@/features/projects/commands/projects";
import {validateToolCall, BUILTIN_TOOLS} from "@/features/agent/runtime/tools";
import {AGENT_SKILLS, assembleSkills} from "@/features/agent/runtime/skills";
import {createToolLoading} from "@/features/agent/runtime/toolLoading";
import {pickDesktopMediaDirectory} from "@/features/library/services/desktopMediaImport";
import type {AgentRun, AgentToolCall} from "@/features/agent/models/agent";
import type {AgentToolContext} from "@/features/agent/runtime/tools";
import {desktopMediaHost} from "./helpers/desktopMediaHost";

async function owner(name = "desktop_media_import") {
    const project = await createProject("Native tool target"), id = crypto.randomUUID(), at = "2026-10-16T00:00:00Z";
    const run: AgentRun = {id: `run_${id}`, threadId: `thread_${id}`, projectId: project.id, userMessageId: `user_${id}`, assistantMessageId: `assistant_${id}`, agentId: "agent", agentSnapshot: {name: "Agent", instructions: ""}, connector: {id: "c", definitionId: "openai-compatible", baseUrl: "https://unused.test"}, model: "test", status: "running", requestMessages: [], enabledToolNames: [name], offeredTools: [{step: 1, names: [name]}], checkpoint: 0, createdAt: at, updatedAt: at};
    const call: AgentToolCall = {id: `call_${id}`, runId: run.id, threadId: run.threadId, providerCallId: `provider_${id}`, name, title: name, arguments: "{}", status: "running", step: 1, order: 0, effect: name === "desktop_media_import" ? "write" : "read", highRisk: false, requiresConfirmation: true, decision: "approve", decidedAt: at, createdAt: at, updatedAt: at};
    await db.chatThreads.add({id: run.threadId, projectId: project.id, title: "Native", connectorId: "c", model: "test", createdAt: at, updatedAt: at});
    await db.chatMessages.add({id: run.assistantMessageId, threadId: run.threadId, runId: run.id, role: "assistant", content: "", status: "streaming", createdAt: at});
    await db.agentRuns.add(run); await db.agentToolCalls.add(call);
    const context: AgentToolContext = {runId: run.id, callId: call.id, threadId: run.threadId, projectId: project.id, signal: new AbortController().signal};
    return {project, run, call, context};
}
afterEach(() => vi.restoreAllMocks());
describe("closed desktop media tools and transport", () => {
    it("registers one finite discoverable group and leaves common editing groups inside their tool budget", () => {
        const group = AGENT_SKILLS.find(skill => skill.id === "desktop-media")!;
        expect(group.toolNames).toEqual(["desktop_media_scan", "desktop_media_read", "desktop_media_import", "desktop_media_status"]);
        expect(group.toolNames.every(name => BUILTIN_TOOLS.some(tool => tool.name === name))).toBe(true);
        const assembled = assembleSkills(["desktop-media"]), loading = createToolLoading(["desktop-media"], assembled.enabledToolNames)!;
        expect(loading.groups[0].id).toBe("desktop-media"); expect(loading.loadedToolNames).toEqual([]);
        expect(new Set(AGENT_SKILLS.filter(skill => ["story-edit", "asset-edit"].includes(skill.id)).flatMap(skill => [...skill.toolNames])).size).toBeLessThanOrEqual(36);
        for (const name of ["desktop_media_scan", "desktop_media_import"]) expect(BUILTIN_TOOLS.find(tool => tool.name === name)?.requiresConfirmation).toBe(true);
        expect(() => validateToolCall("desktop_media_scan", '{"path":"/tmp"}', ["desktop_media_scan"])).toThrow();
        expect(() => validateToolCall("desktop_media_import", JSON.stringify({grantId: crypto.randomUUID(), scanId: crypto.randomUUID(), entryIds: [], shell: "ffmpeg"}), ["desktop_media_import"])).toThrow();
    });
    it("rejects unknown response fields, forged managed claims and mismatched ownership without adopting binaries", async () => {
        const host = desktopMediaHost(1), project = (await createProject("DTO")).id, operationId = crypto.randomUUID();
        const base = await host.services.request(project, {type: "pickDirectory", operationId});
        const malformed = createDesktopMediaServices(async () => host.session, async () => ({...base, sourcePath: "/private/file"}));
        await expect(malformed.request(project, {type: "pickDirectory", operationId})).rejects.toBeInstanceOf(DesktopMediaUncertainError);
        const mismatch = createDesktopMediaServices(async () => host.session, async () => ({...base, operationId: crypto.randomUUID()}));
        await expect(mismatch.request(project, {type: "pickDirectory", operationId})).rejects.toBeInstanceOf(DesktopMediaUncertainError);
        const raw = await host.call("desktop_media_request", {request: {...host.session, projectId: project, action: {type: "prepareVideo", operationId, grantId: host.grantId, scanId: host.scanId, entryId: host.entries[0].entryId, expectedRevision: host.entries[0].revision}}});
        const foreign = {...raw as Record<string, unknown>, sourceClaim: {stageId: crypto.randomUUID(), reference: {version: 1, workspaceId: crypto.randomUUID(), binaryId: crypto.randomUUID(), byteLength: 4, mimeType: "video/mp4", contentHash: "a".repeat(64)}}};
        const invalid = createDesktopMediaServices(async () => host.session, async () => foreign);
        await expect(invalid.request(project, {type: "readOperation", operationId})).rejects.toBeInstanceOf(DesktopMediaUncertainError);
    });
    it("freezes exact native selection in preview and refuses changed selection before any decoder starts", async () => {
        const f = await owner(), host = desktopMediaHost(2); vi.spyOn(runtime, "desktopMediaServices").mockReturnValue(host.services);
        const candidates = (await pickDesktopMediaDirectory(f.project.id, f.context.signal, host.services))!;
        const args = {grantId: candidates.grant.grantId, scanId: candidates.scan.scanId, entryIds: [host.entries[0].entryId]};
        const parsed = validateToolCall("desktop_media_import", JSON.stringify(args), ["desktop_media_import"]);
        const preview = await parsed.tool.prepare!(parsed.args, f.context); expect(preview.changes).toEqual(["clip-0.mp4"]);
        await expect(parsed.tool.execute({...args, entryIds: [host.entries[1].entryId]}, {...f.context, preview})).rejects.toThrow("选择已变化");
        expect(host.actions().some(action => action.type === "prepareVideo")).toBe(false);
        await db.agentToolCalls.update(f.call.id, {arguments: JSON.stringify(args), preview});
        const result = await parsed.tool.execute(parsed.args, {...f.context, preview});
        expect(result).toMatchObject({status: "completed", imported: 1, total: 1});
        expect((await db.desktopMediaImports.get(f.call.id))?.actor).toEqual({kind: "agent", runId: f.run.id, threadId: f.run.threadId, callId: f.call.id});
    });
    it("keeps browser and expired/fabricated grants unavailable before native effects", async () => {
        const f = await owner("desktop_media_scan"); vi.spyOn(runtime, "desktopMediaServices").mockReturnValue(undefined);
        const scan = validateToolCall("desktop_media_scan", "{}", ["desktop_media_scan"]), preview = await scan.tool.prepare!(scan.args, f.context);
        await expect(scan.tool.execute(scan.args, {...f.context, preview})).rejects.toThrow("桌面版");
        const read = validateToolCall("desktop_media_read", JSON.stringify({grantId: crypto.randomUUID(), scanId: crypto.randomUUID()}), ["desktop_media_read"]);
        await expect(read.tool.execute(read.args, f.context)).rejects.toThrow("授权已不可用");
        expect(await db.desktopMediaImports.count()).toBe(0);
    });
});
