import {expect, it, vi} from "vitest";
import {db} from "@/platform/product/store";
import {createNativeMcpServices} from "@/platform/runtime/nativeMcp";
import {productEffectAdmission} from "@/platform/runtime/effectAdmission";
import type {NativeSession} from "@/platform/storage/protocol";
import type {McpHostBinding, McpPreparedAuthority} from "@/platform/runtime/mcp";
import {createApplicationQuit} from "@/app/lifecycle/applicationQuit";
import {createManualQuitGuards} from "@/app/drafts/manualQuitGuards";
import {createChatThread} from "@/features/agent/commands/chat";
import {beginAgentRun} from "@/features/agent/commands/agentRuns";
import {transitionToolCall} from "@/features/agent/commands/agentTools";
import {createMcpTools} from "@/features/agent/mcp/runtime/tools";
import {normalizeMcpManifest} from "@/features/agent/mcp/runtime/manifest";
import {composeMcpRunSnapshot} from "@/features/agent/mcp/runtime/snapshot";
import {reserveAgentThreadWork, shutdownAgentThreadWork} from "@/features/agent/runtime/threadWork";
import {saveFixtureToolRound} from "./helpers/toolDispatch";
function deferred() {let resolve!: () => void; const promise = new Promise<void>(done => {resolve = done;}); return {promise, resolve};}
it("keeps the exact native MCP host/StoreTx publication available while Quit stops and drains its original invocation", async () => {
    const session: NativeSession = {version: 1, session: "original-session", workspaceId: "workspace", generation: 1};
    const binding: McpHostBinding = {serverId: "server_one", configRevision: 1, manifestRevision: "raw_manifest", registrationId: "registration_one", hostSessionId: "host_one", principalRevision: "principal_one"};
    const manifest = normalizeMcpManifest(binding.serverId, {tools: [{name: "effect", inputSchema: {type: "object", properties: {}}}], resources: []});
    const snapshot = composeMcpRunSnapshot([{binding, label: "original", manifest}], ["workspace_overview"]);
    const entered = deferred(), release = deferred(), requests: string[] = [];
    let captured: McpPreparedAuthority | undefined;
    const host = createNativeMcpServices(async () => session, async (_command, args) => {
        const request = args.request as {operationId: string; action: {type: string; binding: McpHostBinding; scope: McpPreparedAuthority["scope"]; target: McpPreparedAuthority["target"]}};
        requests.push(request.action.type);
        const reply = (status: string, result?: unknown) => ({version: 1, hostSessionId: "host_one", operationId: request.operationId, status, ...(result === undefined ? {} : {result})});
        if (request.action.type === "capabilities") return reply("completed", {host: "desktop", stdio: true, streamableHttp: true, oauth: false, rememberedCredentials: false});
        if (request.action.type === "prepare") {captured = {authorityId: "original-authority", binding, scope: request.action.scope, target: request.action.target, argumentsDigest: "a".repeat(64)}; return reply("prepared", captured);}
        if (request.action.type === "invoke") {entered.resolve(); await release.promise; return reply("completed", {content: [{type: "text", text: "original external result"}]});}
        if (request.action.type === "stop" || request.action.type === "status") return reply("unknown", undefined);
        if (request.action.type === "dispose") return reply("drained");
        throw new Error("unexpected native action");
    });
    const thread = await createChatThread(), connector = {id: "fixture", definitionId: "openai-compatible" as const, protocol: "openai-compatible" as const, baseUrl: "https://fixture.invalid", apiKey: "offline-only", updatedAt: "now"};
    const run = await beginAgentRun({threadId: thread.id, connector, model: "fixture", content: "original"});
    const tools = createMcpTools(snapshot, host, async () => {}), tool = tools.find(row => row.name === manifest.tools[0].name)!;
    await db.agentRuns.update(run.id, {toolLoading: undefined, mcpSnapshot: snapshot, enabledToolNames: [tool.name]});
    await saveFixtureToolRound(run.id, "", [{id: "original-wire", type: "function", function: {name: tool.name, arguments: "{}"}}], [{title: tool.title, binding: tool.binding, effect: tool.effect, highRisk: tool.highRisk({})}]);
    const call = (await db.agentToolCalls.where("runId").equals(run.id).first())!, controller = new AbortController();
    const context = {runId: run.id, threadId: thread.id, callId: call.id, signal: controller.signal};
    const preview = await tool.prepare!({}, context); await db.agentToolCalls.update(call.id, {preview}); await transitionToolCall(run.id, call.id, ["pending"], "running");
    const work = reserveAgentThreadWork(db, {kind: "model", threadId: thread.id, invocationId: "original"}, controller);
    const original = tool.execute({}, {...context, preview}); work.follow(original.then(() => undefined)); await entered.promise;
    const acknowledgements: unknown[] = [], closeStorage = vi.fn(async () => {});
    const quit = createApplicationQuit({async request(action) {acknowledgements.push(action); return {version: 1, phase: "quiescing", intentId: "quit", session, visible: true, focused: true};}, async subscribe() {return () => {};}}, createManualQuitGuards(), {
        closeAdmission: () => productEffectAdmission.close(), stopAgent: () => shutdownAgentThreadWork(db), stopReferences: async () => {}, stopDesktopImports: async () => {}, stopNativeEffects: async () => {},
        async disposeMcp() {expect((await db.agentJobs.where("callId").equals(call.id).first())?.status).toBe("completed"); return host.dispose();}, closeStorage,
    });
    quit.handle({version: 1, phase: "quiescing", intentId: "quit", session, visible: true, focused: true});
    await vi.waitFor(() => expect(requests).toContain("stop")); expect(host.active).toBe(true); expect(closeStorage).not.toHaveBeenCalled();
    await host.invocationStatus({operationId: call.id, authority: captured!});
    await expect(host.prepare({binding, scope: captured!.scope, target: captured!.target, arguments: {}})).rejects.toMatchObject({certainty: "not_started"});
    release.resolve(); await original; await quit.done;
    const job = (await db.agentJobs.where("callId").equals(call.id).first())!;
    expect(job.status).toBe("completed"); expect(requests.filter(type => type === "invoke")).toHaveLength(1);
    expect(requests.indexOf("dispose")).toBeGreaterThan(requests.indexOf("stop")); expect(closeStorage).toHaveBeenCalledOnce();
    expect(acknowledgements).toEqual([{kind: "drained", intentId: "quit", outcome: "drained"}]);
});
