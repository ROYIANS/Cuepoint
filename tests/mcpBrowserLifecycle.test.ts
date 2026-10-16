// The SDK is a Studio dependency; use its installed public root entry from this root-level test.
import {Client} from "../packages/studio/node_modules/@modelcontextprotocol/client/dist/index.mjs";
import {describe, expect, it, vi} from "vitest";
import {createBrowserMcpServices, type BrowserMcpCatalogue} from "@/platform/runtime/browserMcp";
import {BROWSER_MCP_CALLBACK_KIND} from "@/platform/runtime/browserMcpCallback";
import type {McpHostBinding, McpPrivateConfig} from "@/platform/runtime/mcp";

function gate() {
    let release!: () => void;
    const wait = new Promise<void>(resolve => {release = resolve;});
    return {wait, release};
}
function hold() {return {entered: gate(), finished: gate()};}

/** Controlled SDK peer and window. Actual CORS/popup behavior is covered by the Chromium fixture. */
async function fixture(oauth = false) {
    const origin = "http://127.0.0.1:19999", appOrigin = "http://127.0.0.1:19998";
    let snapshot: BrowserMcpCatalogue = {revision: 0, entries: [], receipts: []};
    let catalogueHold: ReturnType<typeof hold> | undefined, refreshHold: ReturnType<typeof hold> | undefined, exchangeHold: ReturnType<typeof hold> | undefined;
    let effectHold: ReturnType<typeof hold> | undefined, effects = 0, refreshes = 0;
    let message: ((event: MessageEvent) => void) | undefined;
    const popup = {closed: false, location: {href: "about:blank"}, close() {popup.closed = true;}};
    const target = {location: {origin: appOrigin}, open: () => popup,
        addEventListener(_type: string, listener: (event: MessageEvent) => void) {message = listener;},
        removeEventListener() {message = undefined;}} as unknown as Window;
    const source = vi.fn<typeof fetch>(async (input, init) => {
        const url = new URL(input instanceof Request ? input.url : input.toString());
        if (url.pathname.startsWith("/.well-known/oauth-protected-resource")) return Response.json({resource: `${origin}/mcp`, authorization_servers: [origin]});
        if (url.pathname.startsWith("/.well-known/")) return Response.json({issuer: origin, authorization_endpoint: `${origin}/authorize`, token_endpoint: `${origin}/token`,
            response_types_supported: ["code"], grant_types_supported: ["authorization_code", "refresh_token"], code_challenge_methods_supported: ["S256"],
            token_endpoint_auth_methods_supported: ["none"], authorization_response_iss_parameter_supported: true});
        if (url.pathname === "/token") {
            const params = new URLSearchParams(await new Response(init?.body).text());
            if (params.get("grant_type") === "refresh_token") {
                refreshes++;
                const held = refreshHold; refreshHold = undefined;
                if (held) {held.entered.release(); await held.finished.wait;}
            } else {
                const held = exchangeHold; exchangeHold = undefined;
                if (held) {held.entered.release(); await held.finished.wait;}
            }
            return Response.json({access_token: `access-${refreshes}`, refresh_token: `refresh-${refreshes}`, token_type: "Bearer", expires_in: 3_600, scope: "fixture.read"});
        }
        if (init?.method === "GET") return new Response(null, {status: 405});
        if (init?.method === "DELETE") return new Response(null, {status: 204});
        const rpc = JSON.parse(await new Response(init?.body).text()) as {id?: number; method: string};
        if (rpc.id === undefined) return new Response(null, {status: 202});
        let result: unknown;
        if (rpc.method === "server/discover") result = {resultType: "complete", supportedVersions: ["2026-07-28"], capabilities: {tools: {}, resources: {}}, ttlMs: 0, cacheScope: "private"};
        if (rpc.method === "tools/list") result = {resultType: "complete", tools: [{name: "counter", inputSchema: {type: "object", properties: {}}}], ttlMs: 0, cacheScope: "private"};
        if (rpc.method === "resources/list") result = {resultType: "complete", resources: [], ttlMs: 0, cacheScope: "private"};
        if (rpc.method === "tools/call") {
            effects++;
            const held = effectHold; effectHold = undefined;
            if (held) {held.entered.release(); await held.finished.wait; throw new TypeError("Held fixture reply lost");}
            result = {resultType: "complete", content: [{type: "text", text: "one"}]};
        }
        return Response.json({jsonrpc: "2.0", id: rpc.id, result});
    });
    const host = createBrowserMcpServices({window: target, fetch: source, requestTimeoutMs: 1_000, drainTimeoutMs: 10,
        readCatalogue: async () => {
            const held = catalogueHold; catalogueHold = undefined;
            if (held) {held.entered.release(); await held.finished.wait;}
            return snapshot;
        }});
    const config: McpPrivateConfig = {transport: "streamable_http", endpoint: `${origin}/mcp`,
        auth: oauth ? {kind: "oauth", clientId: "public", scopes: ["fixture.read"]} : {kind: "none"}};
    const reference = await host.preparePrivateRevision({operationId: "save", serverId: "server", catalogueRevision: 0, expectedConfigRevision: 0, config});
    const fingerprint = "a".repeat(64);
    snapshot = {revision: 1, entries: [{serverId: "server", configRevision: 1, privateRevision: reference, enabled: true,
        transport: "streamable_http", auth: oauth ? "oauth" : "none", endpointDisplay: origin}],
        receipts: [{operationId: "save", serverId: "server", kind: "save", fingerprint, publishedPrivateRevision: reference}]};
    await host.confirmPrivateRevision({operationId: "save", serverId: "server", reference, catalogueFingerprint: fingerprint});
    const connect = (operationId = "connect") => host.connect({operationId, serverId: "server", configRevision: 1, privateRevision: reference}, new AbortController().signal);
    const prepare = (binding: McpHostBinding, callId: string) => host.prepare({binding, scope: {runId: "run", callId, scopeId: "scope"}, target: {kind: "tool", rawName: "counter"}, arguments: {}});
    async function startLogin() {
        host.reserveOAuthPopup?.();
        const attempt = await host.oauthBegin({operationId: "login", serverId: "server", configRevision: 1, privateRevision: reference});
        const authorization = new URL(popup.location.href);
        message?.({origin: appOrigin, source: popup, data: {kind: BROWSER_MCP_CALLBACK_KIND, redirect: `${appOrigin}/mcp/oauth/callback`,
            fields: {state: authorization.searchParams.get("state"), code: "fixture-code", iss: origin}}} as unknown as MessageEvent);
        return attempt;
    }
    return {host, connect, prepare, get effects() {return effects;}, get refreshes() {return refreshes;},
        holdCatalogue() {return catalogueHold = hold();}, holdRefresh() {return refreshHold = hold();}, holdExchange() {return exchangeHold = hold();},
        holdEffect() {return effectHold = hold();}, startLogin,
        async login() {
            const attempt = await startLogin();
            await vi.waitFor(async () => {expect((await host.oauthStatus(attempt.attemptId)).state).toBe("authorized");});
        },
    };
}

describe("browser MCP original cleanup owners", () => {
    it("keeps a held connect visible to repeated retirement and disposal until its actual task finishes", async () => {
        const f = await fixture(), held = f.holdCatalogue();
        const connecting = f.connect().catch(error => error as unknown);
        try {
            await held.entered.wait;
            expect(await f.host.retireServer({serverId: "server"})).toEqual({status: "draining"});
            expect(await f.host.retireServer({serverId: "server"})).toEqual({status: "draining"});
            expect(await f.host.dispose()).toEqual({status: "draining"});
            expect(await f.host.dispose()).toEqual({status: "draining"});
            held.finished.release();
            expect(await connecting).toMatchObject({code: "closed", certainty: "not_started"});
            expect(await f.host.dispose()).toEqual({status: "drained"});
            expect(f.effects).toBe(0);
        } finally {held.finished.release(); await connecting; await f.host.dispose();}
    });
    it("does not finish repeated disconnect while an aborted underlying effect fetch is still held", async () => {
        const f = await fixture(), connection = await f.connect(), authority = await f.prepare(connection.binding, "old"), held = f.holdEffect();
        const original = {operationId: "old", authority};
        const invoking = f.host.invoke({...original, arguments: {}}, new AbortController().signal);
        try {
            await held.entered.wait;
            expect(await f.host.disconnect(connection.binding)).toEqual({status: "draining"});
            expect(await f.host.disconnect(connection.binding)).toEqual({status: "draining"});
            expect(await f.host.dispose()).toEqual({status: "draining"});
            held.finished.release();
            expect(await invoking).toMatchObject({status: "unknown"});
            expect(await f.host.dispose()).toEqual({status: "drained"});
            expect(await f.host.invocationStatus(original)).toMatchObject({status: "unknown"});
            expect(f.effects).toBe(1);
        } finally {held.finished.release(); await invoking; await f.host.dispose();}
    });
    it("retains a held actual SDK OAuth refresh through repeated teardown without sending the effect", async () => {
        const f = await fixture(true);
        let invoking: ReturnType<typeof f.host.invoke> | undefined;
        const held = f.holdRefresh();
        try {
            await f.login();
            const connection = await f.connect(), authority = await f.prepare(connection.binding, "refresh");
            vi.spyOn(Date, "now").mockReturnValue(Date.now() + 3_601_000);
            invoking = f.host.invoke({operationId: "refresh", authority, arguments: {}}, new AbortController().signal);
            await held.entered.wait;
            expect(await f.host.retireServer({serverId: "server"})).toEqual({status: "draining"});
            expect(await f.host.retireServer({serverId: "server"})).toEqual({status: "draining"});
            expect(await f.host.dispose()).toEqual({status: "draining"});
            held.finished.release();
            expect(await invoking).toMatchObject({status: "not_started"});
            expect(await f.host.dispose()).toEqual({status: "drained"});
            expect(f.refreshes).toBe(1); expect(f.effects).toBe(0);
        } finally {held.finished.release(); await invoking; vi.restoreAllMocks(); await f.host.dispose();}
    });
    it("retains a held actual SDK code exchange after its popup attempt is canceled", async () => {
        const f = await fixture(true), held = f.holdExchange();
        try {
            const attempt = await f.startLogin();
            await held.entered.wait;
            expect(await f.host.retireServer({serverId: "server"})).toEqual({status: "draining"});
            expect((await f.host.oauthStatus(attempt.attemptId)).state).toBe("canceled");
            expect(await f.host.retireServer({serverId: "server"})).toEqual({status: "draining"});
            expect(await f.host.dispose()).toEqual({status: "draining"});
            held.finished.release();
            expect(await f.host.dispose()).toEqual({status: "drained"});
            expect(f.effects).toBe(0);
        } finally {held.finished.release(); await f.host.dispose();}
    });
    it("an old late request rejection and old list-change notification cannot retire its replacement", async () => {
        const held = hold(), nativeRequest = Client.prototype.request, nativeHandler = Client.prototype.setNotificationHandler;
        let delayed = false, oldNotification: (() => void) | undefined;
        vi.spyOn(Client.prototype, "request").mockImplementation(function (this: Client, ...args: Parameters<Client["request"]>) {
            const reply = nativeRequest.apply(this, args);
            if (args[0].method !== "tools/call" || delayed) return reply;
            delayed = true;
            return reply.then(async () => {held.entered.release(); await held.finished.wait; throw new TypeError("Old SDK completion");});
        });
        vi.spyOn(Client.prototype, "setNotificationHandler").mockImplementation(function (this: Client, ...args: Parameters<Client["setNotificationHandler"]>) {
            const handler: unknown = args[1];
            if (args[0] === "notifications/tools/list_changed" && !oldNotification && typeof handler === "function") oldNotification = () => {void handler({method: "notifications/tools/list_changed"});};
            return nativeHandler.apply(this, args);
        });
        const f = await fixture();
        let invoking: ReturnType<typeof f.host.invoke> | undefined;
        try {
            const previous = await f.connect(), authority = await f.prepare(previous.binding, "old");
            invoking = f.host.invoke({operationId: "old", authority, arguments: {}}, new AbortController().signal);
            await held.entered.wait;
            const replacement = await f.connect("replacement");
            oldNotification?.();
            held.finished.release();
            expect(await invoking).toMatchObject({status: "unknown"});
            const next = await f.prepare(replacement.binding, "new");
            expect(await f.host.invoke({operationId: "new", authority: next, arguments: {}}, new AbortController().signal)).toMatchObject({status: "completed"});
            expect(f.effects).toBe(2);
        } finally {held.finished.release(); await invoking; vi.restoreAllMocks(); await f.host.dispose();}
    });
});
