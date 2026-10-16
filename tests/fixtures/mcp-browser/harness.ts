import {createBrowserMcpServices} from "@/platform/runtime/browserMcp";
import {handleBrowserMcpCallback} from "@/platform/runtime/browserMcpOAuth";
import type {McpHostConnection, McpHostServices, McpInvocationIdentity, McpPrivateConfig} from "@/platform/runtime/mcp";
import {db} from "@/platform/product/store";
import {getMcpCatalogue} from "@/features/agent/mcp/queries/catalogue";
import {createMcpConnectionOwner} from "@/features/agent/mcp/runtime/connections";

// The actual feature/store/port/SDK execute unchanged. The HTTP peer is local.
if (location.pathname === "/mcp/oauth/callback") {
    handleBrowserMcpCallback(window);
} else {
    await db.open();
    let host: McpHostServices = createHost();
    let owner = createMcpConnectionOwner(db, host);
    let connection: McpHostConnection | undefined;
    let original: McpInvocationIdentity | undefined;
    let loginResult: unknown;
    const fetchCalls: string[] = [];
    function createHost() {
        return createBrowserMcpServices({readCatalogue: () => getMcpCatalogue(db), window, requestTimeoutMs: 1200, oauthTimeoutMs: 8000,
            fetch: (input, init) => {fetchCalls.push(init?.method ?? "GET"); return fetch(input, init);}});
    }
    function safe(error: unknown) {
        if (error && typeof error === "object") {
            const value = error as {name?: unknown; code?: unknown; certainty?: unknown; message?: unknown};
            return {name: value.name, code: value.code, certainty: value.certainty, message: value.message};
        }
        return {name: "UnknownError"};
    }
    async function fresh() {
        await owner.dispose();
        await db.delete(); await db.open();
        host = createHost(); owner = createMcpConnectionOwner(db, host);
        connection = undefined; original = undefined; loginResult = undefined;
        fetchCalls.length = 0;
    }
    async function save(endpoint: string, auth: "none" | "manual" | "oauth" = "none", clientId?: string) {
        const privateConfig: McpPrivateConfig = {transport: "streamable_http", endpoint,
            auth: auth === "manual" ? {kind: "manual", headers: {"X-Fixture-Marker": "header-private-marker"}} : auth === "oauth" ? {kind: "oauth", ...(clientId ? {clientId} : {}), scopes: ["fixture.read"]} : {kind: "none"}};
        return owner.save({operationId: "save_browser", serverId: "server_browser", catalogueRevision: 0, expectedConfigRevision: 0,
            label: "Browser fixture", enabled: true, privateConfig});
    }
    async function connect() {
        const captured = await owner.connect({operationId: "connect_browser", serverId: "server_browser", configRevision: 1});
        connection = {binding: captured.binding, discovery: captured.manifest};
        return {binding: captured.binding, tools: captured.manifest.tools.map(tool => tool.rawName), resources: captured.manifest.resources.map(item => item.handleId)};
    }
    async function invoke(callId = "call_browser") {
        if (!connection) throw new Error("Connect first");
        const authority = await host.prepare({binding: connection.binding, scope: {runId: "run_browser", callId, scopeId: "thread_browser"}, target: {kind: "tool", rawName: "counter"}, arguments: {}});
        original = {operationId: callId, authority};
        return host.invoke({...original, arguments: {}}, new AbortController().signal);
    }
    async function result(task: () => Promise<unknown>) {try {return {ok: true, value: await task()};} catch (error) {return {ok: false, error: safe(error)};}}
    const api = {
        fresh,
        save: (endpoint: string, auth?: "none" | "manual" | "oauth", clientId?: string) => result(() => save(endpoint, auth, clientId)),
        connect: () => result(connect),
        invoke: (callId?: string) => result(() => invoke(callId)),
        readback: () => result(async () => {if (!original) throw new Error("No original"); return host.invocationStatus(original);}),
        stop: () => result(async () => {if (!original) throw new Error("No original"); return host.stop(original);}),
        disconnect: () => result(() => owner.disconnect("server_browser")),
        async snapshots() {return {catalogue: await getMcpCatalogue(db), deviceSettings: await db.deviceSettings.toArray(), local: {...localStorage}, session: {...sessionStorage}, capabilities: host.capabilities};},
        async restored() {return result(() => connect());},
        startLogin() {
            const operationId = "login_browser";
            host.reserveOAuthPopup?.();
            void result(async () => {
                const attempt = await owner.oauthBegin({operationId, serverId: "server_browser", configRevision: 1});
                let status = await owner.oauthStatus(attempt.attemptId);
                while (status.state === "pending") {
                    await new Promise(resolve => setTimeout(resolve, 30));
                    status = await owner.oauthStatus(attempt.attemptId);
                }
                return status;
            }).then(value => {loginResult = value; return value;});
        },
        login: () => loginResult,
        fetchCalls: () => [...fetchCalls],
    };
    Object.assign(window, {mcpBrowserFixture: api});
    document.getElementById("login")!.addEventListener("click", () => api.startLogin());
    document.getElementById("status")!.textContent = "Browser fixture ready";
}
