import {afterEach, describe, expect, it, vi} from "vitest";
import {db} from "@/platform/product/store";
import {createRuntimeFetch, type RuntimeFetchServices} from "@/platform/runtime/runtimeFetch";
import {authorizeRuntimeHttp, remoteHttpUrl} from "@/platform/product/httpPolicy";

afterEach(() => vi.restoreAllMocks());

async function configure(baseUrl = "https://model.example/v1", id = "connector") {
    await db.connectors.put({id, definitionId: id === "connector" ? "openai-compatible" : "deepseek", protocol: "openai-compatible", baseUrl, apiKey: "test-only-key", updatedAt: new Date().toISOString()});
}

function services() {
    return {
        native: () => true,
        webFetch: vi.fn<typeof fetch>().mockResolvedValue(new Response("web")),
        nativeFetch: vi.fn<RuntimeFetchServices["nativeFetch"]>().mockImplementation(async () => new Response("native")),
        grant: vi.fn<RuntimeFetchServices["grant"]>().mockResolvedValue(undefined),
        authorize: authorizeRuntimeHttp,
    };
}

function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>(done => { resolve = done; });
    return {promise, resolve};
}

function redirect(location?: string, status = 302) {
    const cancel = vi.fn();
    const body = new ReadableStream<Uint8Array>({cancel}, {highWaterMark: 0});
    return {response: new Response(body, {status, headers: location ? {location} : {}}), cancel};
}

describe("shared runtime HTTP owner", () => {
    it("keeps browser and packaged relative/blob resources on Web fetch with unchanged init", async () => {
        const deps = services();
        const fetchImpl = createRuntimeFetch(deps);
        const init = {credentials: "same-origin" as const, redirect: "follow" as const};
        expect(await (await fetchImpl("/pdf.worker.mjs", init)).text()).toBe("web");
        await fetchImpl("blob:tauri://localhost/test", init);
        deps.native = () => false;
        await fetchImpl("https://arbitrary.example", init);
        expect(deps.webFetch.mock.calls.map(call => call[1])).toEqual([init, init, init]);
        expect(deps.nativeFetch).not.toHaveBeenCalled();
        expect(deps.grant).not.toHaveBeenCalled();
    });

    it("rechecks configured exact origins on every call, retains wire policy and does not mutate caller headers", async () => {
        await configure();
        const deps = services();
        const fetchImpl = createRuntimeFetch(deps);
        const headers = new Headers({Authorization: "Bearer test-only-key", "Content-Type": "application/json"});
        const init = {method: "POST", headers, body: "{}", credentials: "same-origin" as const, redirect: "error" as const};
        expect(await (await fetchImpl("https://model.example/v1/chat/completions", init)).text()).toBe("native");
        expect(deps.grant).toHaveBeenCalledExactlyOnceWith("https://model.example", false);
        const nativeInit = deps.nativeFetch.mock.calls[0][1];
        expect(nativeInit).toMatchObject({method: "POST", body: "{}", credentials: "same-origin", redirect: "error", maxRedirections: 0, connectTimeout: 30_000});
        expect(nativeInit.headers).not.toBe(headers);
        expect(new Headers(nativeInit.headers).get("authorization")).toBe(headers.get("authorization"));
        await db.connectors.clear();
        await expect(fetchImpl("https://model.example/v1/models")).rejects.toThrow("当前连接配置");
        expect(deps.nativeFetch).toHaveBeenCalledOnce();
        expect(init.headers.get("authorization")).toBe("Bearer test-only-key");
    });

    it("matches effective ports/IPv6 and rejects authored credentials without exposing URLs", async () => {
        await configure("http://[::1]:3210/v1");
        const deps = services();
        const fetchImpl = createRuntimeFetch(deps);
        await fetchImpl("http://[::1]:3210/v1/models");
        expect(deps.grant).toHaveBeenCalledWith("http://[::1]:3210", true);
        await expect(fetchImpl("http://[::1]:3211/v1/models")).rejects.toThrow("当前连接配置");
        await expect(fetchImpl("https://secret-name:secret-value@model.example/key-query?private=secret")).rejects.toThrow("不含账号信息");
        expect(() => remoteHttpUrl("file:///private/secret")).toThrow("HTTP(S)");
        expect(deps.nativeFetch).toHaveBeenCalledOnce();
    });

    it("permits only scoped unsaved connector and fixed search probes", async () => {
        const deps = services();
        const probe = createRuntimeFetch(deps, {purpose: "configured", probeOrigin: "http://localhost:1234"});
        await probe("http://localhost:1234/v1/models");
        await expect(probe("http://localhost:1235/v1/models")).rejects.toThrow("未配置");
        await createRuntimeFetch(deps, {purpose: "search-probe"})("https://api.tavily.com/usage");
        await expect(createRuntimeFetch(deps)("https://api.tavily.com/search")).rejects.toThrow("当前连接配置");
        await db.searchConnections.put({id: "tavily", provider: "tavily", enabled: true, apiKey: "test-search-key", revision: "r1", updatedAt: "now"});
        await createRuntimeFetch(deps)("https://api.tavily.com/search");
        await db.searchConnections.update("tavily", {enabled: false});
        await expect(createRuntimeFetch(deps)("https://api.tavily.com/search")).rejects.toThrow("当前连接配置");
    });

    it("validates no-auth result GETs separately and restricts HTTP to configured origins", async () => {
        const deps = services();
        const fetchImpl = createRuntimeFetch(deps, {purpose: "result-download"});
        await fetchImpl("https://cdn.example/signed?opaque=signature", {credentials: "omit", redirect: "error"});
        for (const init of [{headers: {Authorization: "Bearer forbidden"}}, {headers: {Cookie: "private=yes"}}, {method: "POST", body: "x"}])
            await expect(fetchImpl("https://cdn.example/file", init)).rejects.toThrow("不含鉴权信息");
        await expect(fetchImpl("http://localhost:4321/file")).rejects.toThrow("HTTPS");
        await configure("http://localhost:4321/v1");
        await fetchImpl("http://localhost:4321/file", {credentials: "omit"});
        expect(deps.nativeFetch).toHaveBeenCalledTimes(2);
        expect(deps.nativeFetch.mock.calls[0][1].credentials).toBe("omit");
    });

    it("never falls back or retries a native transport error", async () => {
        await configure();
        const deps = services();
        const error = new TypeError("fixture uncertain submission https://signed.example/result?signature=fixture-private");
        deps.nativeFetch.mockRejectedValue(error);
        const pending = createRuntimeFetch(deps)("https://model.example/submit", {method: "POST", body: "paid-fixture"});
        await expect(pending).rejects.toBeInstanceOf(TypeError);
        await expect(pending).rejects.toThrow("原生网络请求失败");
        expect(deps.nativeFetch).toHaveBeenCalledOnce();
        expect(deps.webFetch).not.toHaveBeenCalled();
    });

    it("uses bounded per-hop redirects, strips cross-origin auth, applies POST rewrite and cancels discarded bodies", async () => {
        await configure();
        await configure("https://second.example/v1", "second");
        const deps = services();
        const first = redirect("https://second.example/final", 302);
        deps.nativeFetch.mockResolvedValueOnce(first.response).mockResolvedValueOnce(new Response("final"));
        const headers = new Headers({Authorization: "Bearer test-only-key", Cookie: "private=1", "Content-Type": "application/json"});
        const response = await createRuntimeFetch(deps)("https://model.example/start", {method: "POST", body: "{}", headers, credentials: "same-origin", redirect: "follow"});
        expect(await response.text()).toBe("final");
        expect(response.redirected).toBe(true);
        expect(first.cancel).toHaveBeenCalledOnce();
        const next = deps.nativeFetch.mock.calls[1][1];
        expect(next).toMatchObject({method: "GET", body: null, credentials: "same-origin", maxRedirections: 0});
        expect([...new Headers(next.headers)]).toEqual([]);
        expect(headers.get("authorization")).toBe("Bearer test-only-key");
        expect(deps.grant.mock.calls.map(call => call[0])).toEqual(["https://model.example", "https://second.example"]);
    });

    it("preserves 307 body/method, rejects unconfigured hops before sending, handles redirect error/manual and a missing location", async () => {
        await configure();
        const deps = services();
        const fetchImpl = createRuntimeFetch(deps);
        deps.nativeFetch.mockResolvedValueOnce(redirect("/final", 307).response).mockResolvedValueOnce(new Response("done"));
        await fetchImpl("https://model.example/start", {method: "PUT", body: "bytes"});
        expect(deps.nativeFetch.mock.calls[1][1]).toMatchObject({method: "PUT", body: "bytes"});
        deps.nativeFetch.mockClear().mockResolvedValueOnce(redirect("https://unconfigured.example/target").response);
        await expect(fetchImpl("https://model.example/start")).rejects.toThrow("当前连接配置");
        expect(deps.nativeFetch).toHaveBeenCalledOnce();
        const rejected = redirect("/target");
        deps.nativeFetch.mockClear().mockResolvedValueOnce(rejected.response);
        await expect(fetchImpl("https://model.example/start", {redirect: "error"})).rejects.toThrow("拒绝");
        expect(rejected.cancel).toHaveBeenCalledOnce();
        expect(deps.nativeFetch).toHaveBeenCalledOnce();
        deps.nativeFetch.mockResolvedValueOnce(new Response("manual", {status: 302, headers: {location: "/target"}}));
        expect(await (await fetchImpl("https://model.example/start", {redirect: "manual"})).text()).toBe("manual");
        deps.nativeFetch.mockResolvedValueOnce(new Response("no-location", {status: 302}));
        expect(await (await fetchImpl("https://model.example/start")).text()).toBe("no-location");
    });

    it("stops after five followed redirects and rejects credential-bearing redirect targets", async () => {
        await configure();
        const deps = services();
        deps.nativeFetch.mockImplementation(async () => redirect("/next").response);
        await expect(createRuntimeFetch(deps)("https://model.example/start")).rejects.toThrow("超过 5 次");
        expect(deps.nativeFetch).toHaveBeenCalledTimes(6);
        deps.nativeFetch.mockClear().mockResolvedValueOnce(redirect("https://private:secret@model.example").response);
        await expect(createRuntimeFetch(deps)("https://model.example/start")).rejects.toThrow("重定向地址无效");
        expect(deps.nativeFetch).toHaveBeenCalledOnce();
    });

    it("normalizes header/body abort to the exact caller reason and cleans up a stalled body", async () => {
        await configure();
        const deps = services();
        const controller = new AbortController();
        const reason = new DOMException("fixture Stop", "AbortError");
        deps.nativeFetch.mockImplementation((_url, init) => new Promise((_resolve, reject) => init.signal?.addEventListener("abort", () => reject(new Error("plugin cancellation text")), {once: true})));
        const pending = createRuntimeFetch(deps)("https://model.example/slow", {signal: controller.signal});
        await vi.waitFor(() => expect(deps.nativeFetch).toHaveBeenCalledOnce());
        controller.abort(reason);
        await expect(pending).rejects.toBe(reason);
        const bodyController = new AbortController();
        const stalled = deferred<void>();
        const cancel = vi.fn(() => stalled.resolve());
        deps.nativeFetch.mockResolvedValueOnce(new Response(new ReadableStream<Uint8Array>({pull: () => stalled.promise, cancel}, {highWaterMark: 0})));
        const response = await createRuntimeFetch(deps)("https://model.example/body", {signal: bodyController.signal});
        const read = response.text();
        bodyController.abort(reason);
        await expect(read).rejects.toBe(reason);
        await vi.waitFor(() => expect(cancel).toHaveBeenCalledOnce());
        const before = deps.nativeFetch.mock.calls.length;
        await expect(createRuntimeFetch(deps)("https://model.example", {signal: bodyController.signal})).rejects.toBe(reason);
        expect(deps.nativeFetch.mock.calls.length).toBe(before);
    });

    it("preserves HTTP status/headers and reader errors, cancels an unread body and ignores late chunks after Stop", async () => {
        await configure();
        const deps = services();
        const readError = new Error("fixture socket closed");
        const errored = new ReadableStream<Uint8Array>({pull() { throw readError; }}, {highWaterMark: 0});
        deps.nativeFetch.mockResolvedValueOnce(new Response(errored, {status: 503, headers: {"x-fixture": "kept"}}));
        const response = await createRuntimeFetch(deps)("https://model.example/error");
        expect(response.status).toBe(503);
        expect(response.headers.get("x-fixture")).toBe("kept");
        await expect(response.text()).rejects.toBe(readError);
        const cancel = vi.fn();
        deps.nativeFetch.mockResolvedValueOnce(new Response(new ReadableStream<Uint8Array>({cancel}, {highWaterMark: 0})));
        await (await createRuntimeFetch(deps)("https://model.example/cancel")).body?.cancel();
        expect(cancel).toHaveBeenCalledOnce();
        let finish!: () => void;
        const abort = new AbortController();
        const stalled = new ReadableStream<Uint8Array>({pull(controller) {
            return new Promise<void>(resolve => { finish = () => { try { controller.enqueue(Uint8Array.of(1)); } catch { /* Canceled input cannot enqueue. */ } resolve(); }; });
        }}, {highWaterMark: 0});
        deps.nativeFetch.mockResolvedValueOnce(new Response(stalled));
        const reader = (await createRuntimeFetch(deps)("https://model.example/late", {signal: abort.signal})).body!.getReader();
        const pending = reader.read();
        await vi.waitFor(() => expect(finish).toBeTypeOf("function"));
        const reason = new DOMException("late Stop", "AbortError");
        abort.abort(reason);
        await expect(pending).rejects.toBe(reason);
        finish();
        await expect(reader.read()).rejects.toBe(reason);
        deps.nativeFetch.mockResolvedValueOnce(new Response(null, {status: 204}));
        const empty = await createRuntimeFetch(deps)("https://model.example/empty");
        expect(empty.status).toBe(204);
        expect(empty.body).toBeNull();
    });

    it("preserves Request bytes/options without consuming the source or allowing an unbounded streamed body", async () => {
        await configure();
        const deps = services();
        const source = new Request("https://model.example/bytes", {
            method: "POST", body: Uint8Array.of(255, 0, 127), credentials: "omit", redirect: "error",
            cache: "no-store", headers: {"Content-Type": "application/octet-stream"},
        });
        await createRuntimeFetch(deps)(source);
        const wire = deps.nativeFetch.mock.calls[0][1];
        expect(wire).toMatchObject({method: "POST", credentials: "omit", redirect: "error", cache: "no-store"});
        expect([...wire.body as Uint8Array]).toEqual([255, 0, 127]);
        expect(source.bodyUsed).toBe(false);
        await expect(createRuntimeFetch(deps)("https://model.example/upload", {method: "POST", body: new ReadableStream()})).rejects.toThrow("不支持流式上传");
        expect(deps.nativeFetch).toHaveBeenCalledOnce();
    });

    it("keeps multipart Blob bytes, enforces 20 MiB and allows at most two buffered uploads with queued cancellation", async () => {
        await configure();
        const deps = services();
        const first = deferred<Response>(), second = deferred<Response>();
        deps.nativeFetch.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
        const fetchImpl = createRuntimeFetch(deps);
        const form = new FormData();
        form.append("file", new Blob([Uint8Array.of(0, 255, 31)], {type: "image/png"}), "reference.png");
        const one = fetchImpl("https://model.example/upload", {method: "POST", body: form});
        const two = fetchImpl("https://model.example/upload", {method: "POST", body: form});
        const controller = new AbortController();
        const three = fetchImpl("https://model.example/upload", {method: "POST", body: form, signal: controller.signal});
        await vi.waitFor(() => expect(deps.nativeFetch).toHaveBeenCalledTimes(2));
        const reason = new DOMException("queued Stop", "AbortError");
        controller.abort(reason);
        await expect(three).rejects.toBe(reason);
        first.resolve(new Response("one")); second.resolve(new Response("two"));
        await Promise.all([one, two]);
        expect(deps.nativeFetch.mock.calls[0][1].body).toBe(form);
        const file = (deps.nativeFetch.mock.calls[0][1].body as FormData).get("file") as Blob;
        expect([...new Uint8Array(await file.arrayBuffer())]).toEqual([0, 255, 31]);
        await expect(fetchImpl("https://model.example/upload", {method: "POST", body: new Blob([new Uint8Array(20 * 1024 * 1024 + 1)])})).rejects.toThrow("20 MiB");
        expect(deps.nativeFetch).toHaveBeenCalledTimes(2);
        await fetchImpl("https://model.example/upload", {method: "POST", body: "after-cancel"});
        expect(deps.nativeFetch).toHaveBeenCalledTimes(3);
    });

    it("shares upload capacity across configured/probe wrappers and accepts a 20 MiB multipart file without counting encoding overhead as file content", async () => {
        await configure();
        const deps = services();
        const first = deferred<Response>(), second = deferred<Response>();
        deps.nativeFetch.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
        const fetchImpl = createRuntimeFetch(deps);
        const probe = createRuntimeFetch(deps, {purpose: "configured", probeOrigin: "https://model.example"});
        const one = fetchImpl("https://model.example/upload", {method: "POST", body: "1"});
        const two = probe("https://model.example/upload", {method: "POST", body: "2"});
        const form = new FormData();
        form.append("file", new Blob([new Uint8Array(20 * 1024 * 1024)], {type: "image/png"}), "limit.png");
        const three = probe("https://model.example/upload", {method: "POST", body: form});
        await vi.waitFor(() => expect(deps.nativeFetch).toHaveBeenCalledTimes(2));
        first.resolve(new Response("1"));
        await vi.waitFor(() => expect(deps.nativeFetch).toHaveBeenCalledTimes(3));
        second.resolve(new Response("2"));
        await Promise.all([one, two, three]);
        expect(deps.nativeFetch.mock.calls[2][1].body).toBe(form);
    });

    it("retains existing vision/JSON envelope limits instead of applying the binary upload cap to text", async () => {
        await configure();
        const deps = services();
        const body = '"' + "x".repeat(20 * 1024 * 1024 + 1) + '"';
        await createRuntimeFetch(deps)("https://model.example/chat/completions", {method: "POST", headers: {"Content-Type": "application/json"}, body});
        expect(deps.nativeFetch.mock.calls[0][1].body).toBe(body);
        expect(deps.nativeFetch).toHaveBeenCalledOnce();
    });
});
