import {describe, expect, it, vi} from "vitest";
import {createBrowserMcpServices, type BrowserMcpCatalogue} from "@/platform/runtime/browserMcp";
import {createBoundedMcpFetch} from "@/platform/runtime/browserMcpFetch";
import {handleBrowserMcpCallback} from "@/platform/runtime/browserMcpCallback";
import {browserMcpJson} from "@/platform/runtime/browserMcpData";
import type {McpHostServices, McpPrivateConfig, McpPrivateRevisionRef} from "@/platform/runtime/mcp";

const fingerprint = "a".repeat(64);
const config: McpPrivateConfig = {transport: "streamable_http", endpoint: "http://127.0.0.1:19999/mcp?private-marker=secret", auth: {kind: "none"}};
function fixture() {
    let snapshot: BrowserMcpCatalogue = {revision: 0, entries: [], receipts: []};
    let calls = 0, effectStatus = 200;
    const source = vi.fn<typeof fetch>(async (_input, init) => {
        if (init?.method === "GET") return new Response(null, {status: 405});
        const message = JSON.parse(await new Response(init?.body).text()) as {id?: number; method: string};
        if (message.id === undefined) return new Response(null, {status: 202});
        const result = message.method === "initialize" ? {protocolVersion: "2025-11-25", capabilities: {tools: {}, resources: {}}, serverInfo: {name: "fixture", version: "1"}}
            : message.method === "tools/list" ? {tools: [{name: "counter", inputSchema: {type: "object", properties: {a: {type: "number"}, b: {type: "number"}}}}]}
                : message.method === "resources/list" ? {resources: [{name: "sample", uri: "fixture:text"}]}
                    : message.method === "tools/call" ? (calls++, {content: [{type: "text", text: "done"}]}) : undefined;
        if (message.method === "tools/call" && effectStatus !== 200) return new Response("private raw error", {status: effectStatus});
        return Response.json(result ? {jsonrpc: "2.0", id: message.id, result} : {jsonrpc: "2.0", id: message.id, error: {code: -32601, message: "method missing"}});
    });
    const options = {readCatalogue: async () => snapshot, fetch: source, requestTimeoutMs: 250};
    const host = createBrowserMcpServices(options);
    async function save(value: McpPrivateConfig = config): Promise<McpPrivateRevisionRef> {
        const reference = await host.preparePrivateRevision({operationId: "save", serverId: "server", catalogueRevision: 0, expectedConfigRevision: 0, config: value});
        snapshot = {revision: 1, entries: [{serverId: "server", configRevision: 1, enabled: true, transport: "streamable_http", auth: "none", endpointDisplay: "http://127.0.0.1:19999", privateRevision: reference}],
            receipts: [{operationId: "save", serverId: "server", kind: "save", fingerprint, publishedPrivateRevision: reference}]};
        await host.confirmPrivateRevision({operationId: "save", serverId: "server", reference, catalogueFingerprint: fingerprint});
        return reference;
    }
    return {host, save, source, options, get snapshot() {return snapshot;}, replace: (value: BrowserMcpCatalogue) => {snapshot = value;},
        get calls() {return calls;}, status: (value: number) => {effectStatus = value;}};
}
async function connect(host: McpHostServices, reference: McpPrivateRevisionRef) {
    return host.connect({operationId: "connect", serverId: "server", configRevision: 1, privateRevision: reference}, new AbortController().signal);
}

describe("browser MCP host", () => {
    it("owns memory-only private config and confirms only a positive live catalogue receipt", async () => {
        const f = fixture();
        try {
            const reference = await f.host.preparePrivateRevision({operationId: "save", serverId: "server", catalogueRevision: 0, expectedConfigRevision: 0, config});
            expect(reference.kind).toBe("session_memory");
            await expect(f.host.confirmPrivateRevision({operationId: "save", serverId: "server", reference, catalogueFingerprint: fingerprint})).rejects.toMatchObject({code: "conflict"});
            expect(await f.host.privateRevisionStatus({operationId: "save", serverId: "server"})).toEqual({status: "prepared", reference});
            expect(f.source).not.toHaveBeenCalled();
        } finally {await f.host.dispose();}
    });
    it("rejects stdio and browser-forbidden headers before making a network request", async () => {
        for (const value of [{transport: "stdio", executable: "/bin/tool", args: [], environment: {}}, {transport: "streamable_http", endpoint: "https://example.test", auth: {kind: "manual", headers: {Cookie: "secret"}}}] as McpPrivateConfig[]) {
            const f = fixture();
            try {await expect(f.save(value)).rejects.toMatchObject({code: "unsupported", certainty: "not_started"}); expect(f.source).not.toHaveBeenCalled();}
            finally {await f.host.dispose();}
        }
    });
    it("after a fresh host owner public references require reconfiguration instead of restoring plaintext", async () => {
        const f = fixture(), reference = await f.save();
        await f.host.dispose();
        const restored = createBrowserMcpServices(f.options);
        try {await expect(connect(restored, reference)).rejects.toMatchObject({code: "auth_required"}); expect(f.source).not.toHaveBeenCalled();}
        finally {await restored.dispose();}
    });
    it("uses the real SDK once, binds canonical arguments and retains the original reply", async () => {
        const f = fixture();
        try {
            const reference = await f.save(), connection = await connect(f.host, reference);
            const authority = await f.host.prepare({binding: connection.binding, scope: {runId: "run", callId: "call", scopeId: "scope"}, target: {kind: "tool", rawName: "counter"}, arguments: {b: 2, a: 1}});
            const identity = {operationId: "effect", authority};
            expect(await f.host.invoke({...identity, arguments: {a: 1, b: 2}}, new AbortController().signal)).toMatchObject({status: "completed"});
            await f.host.disconnect(connection.binding);
            expect(await f.host.invoke({...identity, arguments: {b: 2, a: 1}}, new AbortController().signal)).toMatchObject({status: "completed"});
            expect(await f.host.invocationStatus(identity)).toMatchObject({status: "completed"});
            expect(f.calls).toBe(1);
            expect(JSON.stringify(f.snapshot)).not.toContain("private-marker");
        } finally {await f.host.dispose();}
    });
    it.each([401, 403, 404])("never repeats a possible effect after HTTP %i", async status => {
        const f = fixture();
        try {
            const reference = await f.save(), connection = await connect(f.host, reference);
            const authority = await f.host.prepare({binding: connection.binding, scope: {runId: "run", callId: "call", scopeId: "scope"}, target: {kind: "tool", rawName: "counter"}, arguments: {}});
            const identity = {operationId: "effect", authority};
            f.status(status);
            expect(await f.host.invoke({...identity, arguments: {}}, new AbortController().signal)).toMatchObject({status: "unknown"});
            await f.host.stop(identity); await f.host.invocationStatus(identity);
            expect(await f.host.invoke({...identity, arguments: {}}, new AbortController().signal)).toMatchObject({status: "unknown"});
            expect(f.calls).toBe(1);
        } finally {await f.host.dispose();}
    });
    it("a configuration change while prepared denies the effect before send", async () => {
        const f = fixture();
        try {
            const reference = await f.save(), connection = await connect(f.host, reference);
            const authority = await f.host.prepare({binding: connection.binding, scope: {runId: "run", callId: "call", scopeId: "scope"}, target: {kind: "tool", rawName: "counter"}, arguments: {}});
            f.replace({...f.snapshot, entries: f.snapshot.entries.map(row => ({...row, configRevision: 2}))});
            expect(await f.host.invoke({operationId: "effect", authority, arguments: {}}, new AbortController().signal)).toMatchObject({status: "not_started"});
            expect(f.calls).toBe(0);
        } finally {await f.host.dispose();}
    });
});

describe("bounded browser MCP IO", () => {
    it("uses a single-use stream for a POST and never retries a failed fetch", async () => {
        const source = vi.fn<typeof fetch>(async (_url, init) => {
            expect(init?.body).toBeInstanceOf(ReadableStream);
            expect((init as RequestInit & {duplex: string}).duplex).toBe("half");
            expect(await new Response(init?.body).text()).toBe('{"method":"tools/call"}');
            throw new TypeError("Fixture lost reply");
        });
        const fetch = createBoundedMcpFetch({fetch: source, oneShotBody: true});
        await expect(fetch("https://example.test", {method: "POST", body: '{"method":"tools/call"}'})).rejects.toBeInstanceOf(TypeError);
        expect(source).toHaveBeenCalledTimes(1);
    });
    it("rejects oversized actual body chunks before handing them to SDK JSON parsing", async () => {
        let canceled = false;
        const fetch = createBoundedMcpFetch({maximumBytes: 4, fetch: async () => new Response(new ReadableStream({pull(stream) {stream.enqueue(new Uint8Array(5));}, cancel() {canceled = true;}}))});
        const response = await fetch("https://example.test");
        await expect(response.text()).rejects.toMatchObject({code: "limit"});
        expect(canceled).toBe(true);
    });
    it("forces cookie and redirect policy and aborts a stalled body", async () => {
        const source = vi.fn<typeof fetch>(async () => new Response(new ReadableStream()));
        const fetch = createBoundedMcpFetch({fetch: source, timeoutMs: 10});
        const response = await fetch("https://example.test", {credentials: "include", redirect: "follow"});
        await expect(response.text()).rejects.toBeDefined();
        expect(source.mock.calls[0][1]).toMatchObject({credentials: "omit", redirect: "error"});
    });
    it("canonical input validation never invokes an accessor or toJSON", () => {
        const getter = vi.fn(() => "secret"), value = Object.defineProperty({}, "payload", {get: getter, enumerable: true});
        expect(() => browserMcpJson(value)).toThrow(); expect(getter).not.toHaveBeenCalled();
        expect(() => browserMcpJson({toJSON: getter})).toThrow(); expect(getter).not.toHaveBeenCalled();
    });
    it("scrubs callback query data before dispatch and rejects duplicate state", () => {
        const postMessage = vi.fn(), replaceState = vi.fn(), root = {textContent: ""};
        const target = {location: {origin: "https://app.test", pathname: "/mcp/oauth/callback", search: "?state=one&state=two&code=private-code"}, history: {replaceState},
            opener: {postMessage}, document: {getElementById: () => root}} as unknown as Window;
        expect(handleBrowserMcpCallback(target)).toBe(true);
        expect(replaceState).toHaveBeenCalledWith(null, "", "/mcp/oauth/callback"); expect(postMessage).not.toHaveBeenCalled();
        expect(root.textContent).not.toContain("private-code");
    });
});
