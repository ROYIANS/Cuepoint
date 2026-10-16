import {afterEach, describe, expect, it, vi} from "vitest";
import {db} from "@/platform/product/store";
import {createChatThread} from "@/features/agent/commands/chat";
import {beginAgentRun, finishAgentRun} from "@/features/agent/commands/agentRuns";
import {readAgentContextPreview} from "@/features/agent/commands/agentContextPreview";
import {updateGeneralAgentConfig} from "@/features/agent/commands/agentSettings";
import {resolveAgentToolApproval} from "@/features/agent/commands/agentTools";
import {executeChatRun, resumeChatRun} from "@/features/agent/runtime/runChat";
import {installMcpHostServices, clearMcpHostServices} from "@/platform/runtime/mcpServices";
import {mcpRuntimeOwner} from "@/features/agent/mcp/runtime/owner";
import {mcpPublicToolName} from "@/features/agent/mcp/runtime/manifest";
import {mcpResourceHelperNames} from "@/features/agent/mcp/runtime/snapshot";
import {createMcpRunRegistry, mcpCapabilityBinding} from "@/features/agent/mcp/runtime/runRegistry";
import {getOfferedToolNames} from "@/features/agent/runtime/toolLoading";
import {toolSchemas} from "@/features/agent/runtime/tools";
import type {McpHostServices} from "@/platform/runtime/mcp";
import type {AgentRun, AgentWireToolCall} from "@/features/agent/models/agent";
import type {ConnectorConfig} from "@/features/settings/models/connector";
import {interceptStoreTable} from "./helpers/storeFaults";

const connector: ConnectorConfig = {id: "cx", definitionId: "openai-compatible", protocol: "openai-compatible", baseUrl: "https://model.example/v1", apiKey: "MODEL_SECRET", updatedAt: "now"};
const call = (name: string, args: unknown, id: string): AgentWireToolCall => ({id, type: "function", function: {name, arguments: JSON.stringify(args)}});
function response(protocol: AgentRun["protocol"], calls: AgentWireToolCall[] = []) {
    return protocol === "responses" ? Response.json({id: "response", status: "completed", output: calls.length ? calls.map(item => ({type: "function_call", call_id: item.id, name: item.function.name, arguments: item.function.arguments})) : [{type: "message", role: "assistant", content: [{type: "output_text", text: "已完成", annotations: []}]}]})
        : Response.json({choices: [{message: {content: calls.length ? "" : "已完成", ...(calls.length ? {tool_calls: calls} : {})}, finish_reason: calls.length ? "tool_calls" : "stop"}]});
}
function wireTools(body: Record<string, unknown>) {return (body.tools ?? []) as Array<{name?: string; function?: {name: string; parameters: unknown}; parameters?: unknown}>;}
const wireNames = (body: Record<string, unknown>) => wireTools(body).map(item => item.name ?? item.function!.name);
const reference = {kind: "native_vault" as const, ownerId: "vault_one", revisionId: "private_one"};
let installed: McpHostServices | undefined;
async function fixture(options: {tools?: number; resources?: boolean; permission?: "ask" | "full"; skills?: string[]} = {}) {
    let active = true, registration = 0, authority = 0;
    const host: McpHostServices = {
        get active() {return active;}, capabilities: {host: "desktop", stdio: true, streamableHttp: true, oauth: true, rememberedCredentials: true},
        async initialize() {return this.capabilities;}, preparePrivateRevision: vi.fn(async () => reference),
        privateRevisionStatus: vi.fn(async () => ({status: "prepared" as const, reference})), confirmPrivateRevision: vi.fn(async () => undefined), discardPrivateRevision: vi.fn(async () => undefined),
        retireServer: vi.fn(async () => ({status: "drained" as const})),
        connect: vi.fn(async input => ({binding: {serverId: input.serverId, configRevision: input.configRevision, manifestRevision: "host_raw_revision", registrationId: `registration_${++registration}`, hostSessionId: "host_one", principalRevision: "principal_one"},
            discovery: {tools: Array.from({length: options.tools ?? 1}, (_, index) => ({name: `action_${String(index).padStart(3, "0")}`, description: "Fixture external action", inputSchema: {type: "object", properties: {value: {type: "string"}}, required: ["value"], additionalProperties: false}})),
                resources: options.resources ? [{uri: "file:///private/no-dereference", name: "Fixture resource"}] : []}})),
        disconnect: vi.fn(async () => ({status: "drained" as const})),
        prepare: vi.fn(async input => ({authorityId: `authority_${++authority}`, binding: input.binding, scope: input.scope, target: input.target, argumentsDigest: "a".repeat(64)})),
        invoke: vi.fn(async input => ({status: "completed" as const, operationId: input.operationId, result: {content: [{type: "text", text: "External fixture result"}]}})),
        invocationStatus: vi.fn(async input => ({status: "unknown" as const, operationId: input.operationId, code: "reply_lost" as const})),
        stop: vi.fn(async input => ({status: "unknown" as const, operationId: input.operationId, code: "stopped" as const})),
        oauthBegin: vi.fn(async () => ({attemptId: "login_one"})), oauthStatus: vi.fn(async () => ({attemptId: "login_one", state: "pending" as const})), oauthCancel: vi.fn(async () => undefined),
        dispose: vi.fn(async () => {active = false; return {status: "drained" as const};}),
    };
    installed = host;
    installMcpHostServices(host);
    const owner = mcpRuntimeOwner()!.connections;
    await updateGeneralAgentConfig({enabledSkillIds: options.skills ?? ["workspace", "planning"], permissionMode: options.permission ?? "full"});
    await owner.save({operationId: "save_one", serverId: "server_one", catalogueRevision: 0, expectedConfigRevision: 0, label: "Fixture service", enabled: true,
        privateConfig: {transport: "stdio", executable: "/private/mcp-server", args: ["--secret"], environment: {TOKEN: "PRIVATE_SECRET"}}});
    const generation = await owner.connect({operationId: "connect_one", serverId: "server_one", configRevision: 1});
    const thread = await createChatThread();
    const begin = () => beginAgentRun({threadId: thread.id, connector, model: "fixture", content: "Use external tools"});
    return {host, owner, generation, thread, begin};
}
afterEach(async () => {vi.restoreAllMocks(); if (installed) await clearMcpHostServices(installed); installed = undefined;});

describe("production Agent MCP admission and exact offers", () => {
    it("shares a bounded 128-tool surface with preview, counts resource/report foundations and excludes private configuration", async () => {
        const {generation, thread, begin} = await fixture({tools: 128, resources: true});
        const preview = await readAgentContextPreview({threadId: thread.id, draft: "Use external tools", attachments: [], model: "fixture"});
        expect(preview.status).toBe("ready");
        if (preview.status !== "ready") throw new Error("preview not ready");
        const run = await begin();
        expect(run.mcpSnapshot).toEqual(preview.facts.skillSurface.mcpSnapshot);
        const snapshot = run.mcpSnapshot!;
        expect(snapshot.groups.length).toBeGreaterThan(3);
        expect(snapshot.foundationToolNames).toEqual(expect.arrayContaining(["workspace_overview", "update_run_plan", "load_tool_groups", "read_job_result", ...mcpResourceHelperNames("server_one")]));
        for (const group of snapshot.groups) expect(new Set([...snapshot.foundationToolNames, ...group.toolNames]).size).toBeLessThanOrEqual(36);
        expect(snapshot.generations[0].manifest.revision).not.toBe(generation.binding.manifestRevision);
        const definitions = createMcpRunRegistry(snapshot).definitions;
        expect(preview.facts.toolSchemas).toEqual(toolSchemas(definitions.filter(tool => getOfferedToolNames(run).includes(tool.name)).map(tool => tool.name), definitions));
        expect(JSON.stringify({snapshot, preview})).not.toMatch(/PRIVATE_SECRET|\/private\/mcp-server|--secret/);
        expect(run.toolLoading?.groups.map(group => group.id)).toEqual(snapshot.groups.map(group => group.id));
    });

    it("MCP binding checks keep the same registration guarantees as the core registry (documented no-grant-port divergence)", async () => {
        const {begin} = await fixture({tools: 1});
        const run = await begin();
        const registry = createMcpRunRegistry(run.mcpSnapshot);
        const binding = mcpCapabilityBinding(run.mcpSnapshot!.generations[0]);
        await expect(registry.assertBinding(undefined)).resolves.toBeUndefined();
        await expect(registry.assertBinding(binding)).resolves.toBeUndefined();
        for (const forged of [{...binding, registrationId: "other"}, {...binding, version: "other"}, {...binding, capabilityId: "mcp/other"}])
            await expect(registry.assertBinding(forged)).rejects.toThrow();
        // Every offered MCP tool is advertised with exactly the saved binding.
        expect(registry.definitions.filter(tool => tool.binding).every(tool => tool.binding!.registrationId === binding.registrationId)).toBe(true);
    });

    it("keeps every built-in group loadable after eight resource servers consume the final foundation", async () => {
        const {host, owner, begin} = await fixture({tools: 0, resources: true, skills: ["workspace", "planning", "business-read", "story-edit", "asset-edit", "audio-production"]});
        vi.spyOn(host, "preparePrivateRevision").mockImplementation(async input => ({...reference, revisionId: `private_${input.serverId}`}));
        for (let index = 1; index < 8; index++) {
            const serverId = `server_${index}`;
            await owner.save({operationId: `save_${index}`, serverId, catalogueRevision: index, expectedConfigRevision: 0, label: `Resource ${index}`, enabled: true,
                privateConfig: {transport: "stdio", executable: "/fixture/server", args: [], environment: {}}});
            await owner.connect({operationId: `connect_${index}`, serverId, configRevision: 1});
        }
        const run = await begin(), state = run.toolLoading!;
        expect(state.foundationToolNames).toHaveLength(20);
        expect(state.groups.some(group => group.id === "story-edit")).toBe(false);
        expect(state.groups.some(group => group.id.startsWith("story-edit-part-16-"))).toBe(true);
        expect(state.groups.some(group => group.id === "business-read")).toBe(true);
        for (const group of state.groups) expect(new Set([...state.foundationToolNames, ...group.toolNames]).size).toBeLessThanOrEqual(36);
        const bodies: Record<string, unknown>[] = [];
        await executeChatRun(run, connector.apiKey, new AbortController(), async (_url, init) => {
            const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
            const previous = state.groups[bodies.length - 1];
            if (previous) expect(wireNames(body)).toEqual(expect.arrayContaining(previous.toolNames));
            bodies.push(body);
            expect(wireNames(body).length).toBeLessThanOrEqual(36);
            const next = state.groups[bodies.length - 1];
            return response(run.protocol, next ? [call("load_tool_groups", {groupIds: [next.id]}, `load_${bodies.length}`)] : []);
        });
        expect(bodies.length).toBeGreaterThanOrEqual(state.groups.length + 1);
        expect((await db.agentRuns.get(run.id))?.status).toBe("completed");
        const calls = await db.agentToolCalls.where("runId").equals(run.id).toArray();
        expect(calls).toHaveLength(state.groups.length);
        expect(calls.every(item => item.status === "completed")).toBe(true);
    });

    it.each(["chat-completions", "responses"] as const)("uses actual frozen definitions, loads the next request and persists exact binding on %s", async protocol => {
        const {host, begin, generation} = await fixture();
        const run = await begin();
        await db.agentRuns.update(run.id, {protocol});
        const rawName = "action_000", name = mcpPublicToolName("server_one", rawName), group = run.mcpSnapshot!.groups[0].id;
        const bodies: Record<string, unknown>[] = [];
        await executeChatRun({...run, protocol}, connector.apiKey, new AbortController(), async (_url, init) => {
            const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
            bodies.push(body);
            if (bodies.length === 1) return response(protocol, [call("load_tool_groups", {groupIds: [group]}, "load_one")]);
            if (bodies.length === 2) return response(protocol, [call(name, {value: "hello"}, "external_one")]);
            return response(protocol);
        });
        expect(wireNames(bodies[0])).not.toContain(name);
        expect(wireNames(bodies[1])).toContain(name);
        expect(wireNames(bodies[1]).length).toBeLessThanOrEqual(36);
        const tool = wireTools(bodies[1]).find(item => (item.name ?? item.function?.name) === name)!;
        expect(tool.parameters ?? tool.function?.parameters).toEqual(generation.manifest.tools[0].inputSchema);
        const saved = (await db.agentToolCalls.where("runId").equals(run.id).toArray()).find(item => item.name === name)!;
        expect(saved).toMatchObject({status: "completed", binding: mcpCapabilityBinding(generation), preview: {mcp: {binding: generation.binding, manifestDigest: generation.manifest.revision, target: {kind: "tool", rawName}}}});
        expect(JSON.stringify(saved.preview)).not.toMatch(/authorityId|argumentsDigest|PRIVATE_SECRET/);
        expect(host.invoke).toHaveBeenCalledTimes(1);
        expect(host.invoke).toHaveBeenCalledWith(expect.objectContaining({operationId: saved.id, authority: expect.objectContaining({binding: generation.binding})}), expect.any(AbortSignal));
        expect((await db.agentRuns.get(run.id))?.offeredTools?.map(item => item.names)).toEqual(bodies.map(wireNames));
    });

    it("rejects load plus a never-offered external call in the same response without dispatch", async () => {
        const {host, begin} = await fixture();
        const run = await begin(), name = mcpPublicToolName("server_one", "action_000");
        let requests = 0;
        await executeChatRun(run, connector.apiKey, new AbortController(), async () => response(run.protocol, ++requests === 1 ? [call("load_tool_groups", {groupIds: [run.mcpSnapshot!.groups[0].id]}, "load_one"), call(name, {value: "hello"}, "forbidden")] : []));
        expect(host.invoke).not.toHaveBeenCalled();
        const denied = (await db.agentToolCalls.where("runId").equals(run.id).toArray()).find(item => item.name === name);
        expect(denied).toMatchObject({status: "failed"});
        expect(denied?.binding).toBeUndefined();
    });

    it("keeps conversation and historical retry without an MCP snapshot isolated from current connections", async () => {
        const {thread, begin} = await fixture();
        const conversation = await beginAgentRun({threadId: thread.id, connector, model: "fixture", content: "Only conversation", interactionMode: "conversation"});
        expect(conversation.mcpSnapshot).toBeUndefined();
        expect(conversation.enabledToolNames).toEqual([]);
        await finishAgentRun(conversation.id, "completed");
        const original = await begin();
        await db.agentRuns.update(original.id, {mcpSnapshot: undefined, enabledToolNames: [], toolLoading: undefined, skillInstructions: ""});
        await finishAgentRun(original.id, "failed");
        const retry = await beginAgentRun({threadId: thread.id, connector, model: "fixture", retryOfRunId: original.id});
        expect(retry.mcpSnapshot).toBeUndefined();
        expect(retry.enabledToolNames).toEqual([]);
    });

    it("rolls back admission when the captured local generation is retired during its final transaction", async () => {
        const {owner, begin} = await fixture();
        let reached = false;
        const hook = interceptStoreTable(db, "chatMessages", "add", async (_tx, _args, next) => {
            if (!reached) {reached = true; await owner.disconnect("server_one");}
            return next();
        });
        await expect(begin()).rejects.toThrow(/MCP 连接已变化/);
        hook.mockRestore();
        expect(reached).toBe(true);
        expect(await db.agentRuns.count()).toBe(0);
        expect(await db.chatMessages.count()).toBe(0);
    });

    it("reprepares the same approved generation on resume without persisting its authority", async () => {
        const {host, begin, generation} = await fixture({permission: "ask"});
        const run = await begin(), name = mcpPublicToolName("server_one", "action_000");
        let requests = 0;
        await executeChatRun(run, connector.apiKey, new AbortController(), async () => response(run.protocol, ++requests === 1 ? [call("load_tool_groups", {groupIds: [run.mcpSnapshot!.groups[0].id]}, "load_one")] : [call(name, {value: "hello"}, "external_one")]));
        const saved = (await db.agentToolCalls.where("runId").equals(run.id).toArray()).find(item => item.name === name)!;
        expect(saved.status).toBe("awaiting_approval");
        expect(host.prepare).toHaveBeenCalledTimes(1);
        expect(host.invoke).not.toHaveBeenCalled();
        await resolveAgentToolApproval(run.id, saved.id, "approve");
        await resumeChatRun(run.id, connector.apiKey, new AbortController(), async () => response(run.protocol));
        expect(host.prepare).toHaveBeenCalledTimes(2);
        expect(host.invoke).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({operationId: saved.id, authority: expect.objectContaining({authorityId: "authority_2", binding: generation.binding})}), expect.any(AbortSignal));
        expect(await db.agentToolCalls.get(saved.id)).toMatchObject({status: "completed", binding: saved.binding, preview: saved.preview});
        expect(JSON.stringify(await db.agentToolCalls.get(saved.id))).not.toMatch(/authorityId|argumentsDigest/);
        expect((await db.agentRuns.get(run.id))?.status).toBe("completed");
    });

    it("rejects an approved original generation after its connection is replaced", async () => {
        const {host, owner, begin} = await fixture({permission: "ask"});
        const run = await begin(), name = mcpPublicToolName("server_one", "action_000");
        let requests = 0;
        await executeChatRun(run, connector.apiKey, new AbortController(), async () => response(run.protocol, ++requests === 1 ? [call("load_tool_groups", {groupIds: [run.mcpSnapshot!.groups[0].id]}, "load_one")] : [call(name, {value: "hello"}, "external_one")]));
        const saved = (await db.agentToolCalls.where("runId").equals(run.id).toArray()).find(item => item.name === name)!;
        expect(saved.status).toBe("awaiting_approval");
        expect(host.invoke).not.toHaveBeenCalled();
        await resolveAgentToolApproval(run.id, saved.id, "approve");
        await owner.disconnect("server_one");
        await owner.connect({operationId: "reconnect_one", serverId: "server_one", configRevision: 1});
        await resumeChatRun(run.id, connector.apiKey, new AbortController(), async () => response(run.protocol));
        expect(host.invoke).not.toHaveBeenCalled();
        expect((await db.agentToolCalls.get(saved.id))?.binding).toEqual(saved.binding);
        expect((await db.agentToolCalls.get(saved.id))?.status).toBe("failed");
    });
});
