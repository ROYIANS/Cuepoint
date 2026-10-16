import {afterEach, describe, expect, it, vi} from "vitest";
import {createNativeMcpServices} from "@/platform/runtime/nativeMcp";
import {McpHostError} from "@/platform/runtime/mcpErrors";
import {clearMcpHostServices, installMcpHostServices, mcpHostServices} from "@/platform/runtime/mcpServices";
import type {NativeSession} from "@/platform/storage/protocol";
import type {McpPreparedAuthority} from "@/platform/runtime/mcp";

type Request = {version: number; operationId: string; session: NativeSession; hostSessionId?: string; action: Record<string, unknown> & {type: string}};
const session: NativeSession = {version: 1, session: "session_one", workspaceId: "workspace_one", generation: 1};
const binding = {serverId: "server_one", configRevision: 1, manifestRevision: "raw_manifest_one", registrationId: "registration_one", hostSessionId: "host_one", principalRevision: "principal_one"};
const scope = {runId: "run_one", callId: "call_one", scopeId: "scope_one"};
const authority: McpPreparedAuthority = {authorityId: "authority_one", binding, scope, target: {kind: "tool", rawName: "do_it"}, argumentsDigest: "a".repeat(64)};
const reference = {kind: "native_vault" as const, ownerId: "vault_one", revisionId: "revision_one"};
const capabilities = {host: "desktop", stdio: true, streamableHttp: true, oauth: true, rememberedCredentials: true};
const reply = (request: Request, status: string, result?: unknown) => ({version: 1, operationId: request.operationId, hostSessionId: "host_one", status, ...(result === undefined ? {} : {result})});
function deferred<T>() {let resolve!: (value: T) => void; const promise = new Promise<T>(done => {resolve = done;}); return {promise, resolve};}
function fixture(handler: (request: Request) => Promise<unknown> | unknown, getSession: () => Promise<NativeSession> = async () => session) {
    const call = vi.fn(async (command: string, args: Record<string, unknown>) => {
        expect(command).toBe("mcp_service_request");
        const request = args.request as Request;
        if (request.action.type === "capabilities") return reply(request, "completed", capabilities);
        return handler(request);
    });
    return {call, host: createNativeMcpServices(getSession, call)};
}
afterEach(async () => {const host = mcpHostServices(); if (host) await clearMcpHostServices(host); vi.restoreAllMocks();});

describe("finite desktop MCP wire", () => {
    it("handshakes once, sends exact actions and compares parsed authority fields rather than caller key order", async () => {
        const {host, call} = fixture(request => {
            switch (request.action.type) {
                case "privatePrepare": return reply(request, "prepared", {reference});
                case "privateConfirm": return reply(request, "completed", {confirmed: true});
                case "prepare": return reply(request, "prepared", authority);
                default: return reply(request, "drained");
            }
        });
        await host.preparePrivateRevision({operationId: "save_one", serverId: "server_one", catalogueRevision: 0, expectedConfigRevision: 0, config: {transport: "stdio", executable: "/bin/server", args: [], environment: {TOKEN: "SECRET"}}});
        await host.confirmPrivateRevision({operationId: "save_one", serverId: "server_one", reference, catalogueFingerprint: "f".repeat(64)});
        const reordered = {principalRevision: binding.principalRevision, hostSessionId: binding.hostSessionId, registrationId: binding.registrationId, manifestRevision: binding.manifestRevision, configRevision: 1, serverId: "server_one"};
        expect(await host.prepare({binding: reordered, scope: {scopeId: "scope_one", callId: "call_one", runId: "run_one"}, target: {rawName: "do_it", kind: "tool"}, arguments: {}})).toEqual(authority);
        expect(call.mock.calls.filter(([, args]) => (args.request as Request).action.type === "capabilities")).toHaveLength(1);
        for (const [, args] of call.mock.calls.slice(1)) expect(args.request).toMatchObject({version: 1, hostSessionId: "host_one", session});
        expect(host.capabilities).toMatchObject({stdio: true, oauth: true});
    });

    it.each(["mismatched_operation", "mismatched_host", "oversized", "raw_rejection"])("sanitizes %s without storing raw response/cause", async failure => {
        const {host} = fixture(request => {
            if (failure === "raw_rejection") throw new Error("Authorization SECRET https://private.example?token=SECRET");
            if (failure === "oversized") return reply(request, "prepared", {reference, secret: "SECRET".repeat(200_000)});
            return {...reply(request, "prepared", {reference}), ...(failure === "mismatched_operation" ? {operationId: "other_operation"} : {hostSessionId: "other_host"})};
        });
        let caught: unknown;
        try {await host.preparePrivateRevision({operationId: "save_one", serverId: "server_one", catalogueRevision: 0, expectedConfigRevision: 0, config: {transport: "stdio", executable: "/bin/server", args: [], environment: {}}});} catch (error) {caught = error;}
        expect(caught).toBeInstanceOf(McpHostError);
        expect(caught).toMatchObject({certainty: "unknown", operationId: "save_one"});
        expect(JSON.stringify(caught)).not.toMatch(/SECRET|private.example/);
        expect(caught).not.toHaveProperty("cause");
    });

    it("reads the original invocation after a lost reply without invoking again", async () => {
        const {host, call} = fixture(request => {
            if (request.action.type === "invoke") throw new Error("lost reply SECRET");
            return reply(request, "completed", {content: [{type: "text", text: "done"}]});
        });
        const input = {operationId: "invoke_one", authority};
        expect(await host.invoke({...input, arguments: {}}, new AbortController().signal)).toEqual({status: "unknown", operationId: "invoke_one", code: "reply_lost"});
        expect(await host.invocationStatus(input)).toMatchObject({status: "completed", operationId: "invoke_one"});
        expect(call.mock.calls.filter(([, args]) => (args.request as Request).action.type === "invoke")).toHaveLength(1);
        expect(call.mock.calls.at(-1)?.[1].request).toMatchObject({operationId: "invoke_one", action: {type: "status", identity: input}});
    });

    it("does not dispatch an invocation stopped while its store session is still resolving", async () => {
        const started = deferred<void>(), held = deferred<NativeSession>();
        let holdSession = false;
        const {host, call} = fixture(request => reply(request, "notStarted"), async () => {
            if (!holdSession) return session;
            started.resolve();
            return held.promise;
        });
        await host.initialize();
        holdSession = true;
        const controller = new AbortController();
        const invocation = host.invoke({operationId: "invoke_one", authority, arguments: {}}, controller.signal);
        const rejected = expect(invocation).rejects.toMatchObject({code: "canceled", certainty: "not_started", operationId: "invoke_one"});
        await started.promise;
        controller.abort();
        held.resolve(session);
        await rejected;
        expect(call.mock.calls.filter(([, args]) => (args.request as Request).action.type === "invoke")).toHaveLength(0);
    });

    it("keeps known original completion when Stop and disposal race a late reply", async () => {
        const started = deferred<Request>(), held = deferred<unknown>(), stopped = deferred<void>();
        const {host, call} = fixture(request => {
            if (request.action.type === "invoke") {started.resolve(request); return held.promise;}
            if (request.action.type === "stop") {stopped.resolve(); return {...reply(request, "unknown"), error: {code: "stopped", message: "stopped"}};}
            return reply(request, "drained");
        });
        const controller = new AbortController();
        const invocation = host.invoke({operationId: "invoke_one", authority, arguments: {}}, controller.signal);
        const original = await started.promise;
        controller.abort();
        await stopped.promise;
        await host.dispose();
        held.resolve(reply(original, "completed", {done: true}));
        expect(await invocation).toEqual({status: "completed", operationId: "invoke_one", result: {done: true}});
        expect(call.mock.calls.some(([, args]) => (args.request as Request).action.type === "stop")).toBe(true);
    });

    it("closes immediately but waits for a pending capability handshake before draining its original host", async () => {
        const started = deferred<Request>(), held = deferred<unknown>();
        let currentSession = session;
        const call = vi.fn(async (_command: string, args: Record<string, unknown>) => {
            const request = args.request as Request;
            if (request.action.type === "capabilities") {started.resolve(request); return held.promise;}
            expect(request).toMatchObject({hostSessionId: "host_one", session});
            return reply(request, "drained");
        });
        const host = createNativeMcpServices(async () => currentSession, call);
        const initialized = host.initialize(), original = await started.promise;
        const disposal = host.dispose();
        let settled = false;
        void disposal.then(() => {settled = true;});
        expect(host.active).toBe(false);
        currentSession = {...session, generation: 2};
        await Promise.resolve();
        expect(settled).toBe(false);
        await expect(host.privateRevisionStatus({operationId: "save_one", serverId: "server_one"})).rejects.toMatchObject({code: "closed"});
        held.resolve(reply(original, "completed", capabilities));
        await initialized;
        expect(await disposal).toEqual({status: "drained"});
        expect(call).toHaveBeenCalledTimes(2);
    });

    it("reports uncertain drainage after a lost handshake and fences a replaced store generation", async () => {
        const uncertain = createNativeMcpServices(async () => session, async () => {throw new Error("lost");});
        await expect(uncertain.initialize()).rejects.toMatchObject({certainty: "unknown"});
        expect(await uncertain.dispose()).toEqual({status: "draining"});
        let currentSession = session;
        const {host, call} = fixture(request => reply(request, "drained"), async () => currentSession);
        await host.initialize();
        currentSession = {...session, generation: 2};
        await expect(host.disconnect(binding)).rejects.toMatchObject({code: "closed", certainty: "not_started"});
        expect(host.active).toBe(false);
        expect(await host.dispose()).toEqual({status: "drained"});
        expect(call.mock.calls.at(-1)?.[1].request).toMatchObject({session});
    });

    it("pagehide removes the installed native port before asynchronous drainage", async () => {
        const held = deferred<unknown>();
        const {host} = fixture(() => held.promise);
        await host.initialize();
        const events = new EventTarget();
        installMcpHostServices(host, events);
        events.dispatchEvent(new Event("pagehide"));
        expect(mcpHostServices()).toBeUndefined();
        expect(host.active).toBe(false);
        held.resolve({version: 1, operationId: "unmatched", hostSessionId: "host_one", status: "drained"});
        expect(await host.dispose()).toEqual({status: "draining"});
    });
    it("owns private references and payloads while initialization is pending, and refuses native count overflow before IPC", async () => {
        const started = deferred<Request>(), held = deferred<unknown>(), requests: Request[] = [];
        const host = createNativeMcpServices(async () => session, async (_command, args) => {
            const request = args.request as Request;
            requests.push(request);
            if (request.action.type === "capabilities") {started.resolve(request); return held.promise;}
            return reply(request, "completed", {confirmed: true});
        });
        const mutableReference = {...reference};
        const pending = host.confirmPrivateRevision({operationId: "save_one", serverId: "server_one", reference: mutableReference, catalogueFingerprint: "f".repeat(64)});
        const handshake = await started.promise;
        mutableReference.revisionId = "changed_late";
        held.resolve(reply(handshake, "completed", capabilities));
        await pending;
        expect(requests.at(-1)?.action).toMatchObject({type: "privateConfirm", reference});
        const environments = Object.fromEntries(Array.from({length: 65}, (_, index) => [`KEY_${index}`, "value"]));
        await expect(host.preparePrivateRevision({operationId: "overflow", serverId: "server_one", catalogueRevision: 0, expectedConfigRevision: 0, config: {transport: "stdio", executable: "/bin/server", args: [], environment: environments}})).rejects.toMatchObject({code: "invalid", certainty: "not_started"});
        expect(requests).toHaveLength(2);
    });

    it("keeps the port usable when a dirty draft cancels beforeunload", async () => {
        const {host} = fixture(request => request.action.type === "privateStatus" ? reply(request, "prepared", {reference}) : reply(request, "drained"));
        await host.initialize();
        const events = new EventTarget();
        installMcpHostServices(host, events);
        events.addEventListener("beforeunload", event => event.preventDefault());
        expect(events.dispatchEvent(new Event("beforeunload", {cancelable: true}))).toBe(false);
        expect(mcpHostServices()).toBe(host);
        expect(host.active).toBe(true);
        expect(await host.privateRevisionStatus({operationId: "save_one", serverId: "server_one"})).toEqual({status: "prepared", reference});
        events.dispatchEvent(new Event("pagehide"));
        expect(mcpHostServices()).toBeUndefined();
        expect(await host.dispose()).toEqual({status: "drained"});
    });

    it("advances disposal of the same original owner from draining to drained", async () => {
        let drains = 0;
        const {host, call} = fixture(request => reply(request, ++drains === 1 ? "draining" : "drained"));
        await host.initialize();
        expect(await host.dispose()).toEqual({status: "draining"});
        expect(host.active).toBe(false);
        expect(await host.dispose()).toEqual({status: "drained"});
        expect(await host.dispose()).toEqual({status: "drained"});
        expect(call.mock.calls.filter(([, args]) => (args.request as Request).action.type === "dispose")).toHaveLength(2);
        expect(call.mock.calls.every(([, args]) => (args.request as Request).session.session === session.session)).toBe(true);
    });

    it("shares overlapping retirement and waits for it before admitting another connect", async () => {
        const started = deferred<Request>(), held = deferred<unknown>();
        const {host, call} = fixture(request => {
            if (request.action.type === "retire") {started.resolve(request); return held.promise;}
            return reply(request, "connected", {binding, discovery: {tools: [], resources: []}});
        });
        const first = host.retireServer({serverId: "server_one"});
        const retiring = await started.promise;
        const second = host.retireServer({serverId: "server_one"});
        const connecting = host.connect({operationId: "connect_one", serverId: "server_one", configRevision: 1, privateRevision: reference}, new AbortController().signal);
        await Promise.resolve();
        expect(call.mock.calls.filter(([, args]) => (args.request as Request).action.type === "retire")).toHaveLength(1);
        expect(call.mock.calls.filter(([, args]) => (args.request as Request).action.type === "connect")).toHaveLength(0);
        held.resolve(reply(retiring, "drained"));
        expect(await first).toEqual({status: "drained"});
        expect(await second).toEqual({status: "drained"});
        expect(await connecting).toMatchObject({binding});
    });

});
