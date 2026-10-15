import {afterEach, describe, expect, it, vi} from "vitest";
import {db} from "@/platform/product/store";
import {createRuntimeFetch, runtimeFetchFor, type RuntimeFetchServices} from "@/platform/runtime/runtimeFetch";
import {authorizeRuntimeHttp} from "@/platform/product/httpPolicy";

afterEach(() => vi.restoreAllMocks());

const URL_OK = "https://models.dev/api.json";

function services() {
    return {
        native: () => true,
        webFetch: vi.fn<typeof fetch>().mockResolvedValue(new Response("web")),
        nativeFetch: vi.fn<RuntimeFetchServices["nativeFetch"]>().mockImplementation(async () => new Response("native")),
        grant: vi.fn<RuntimeFetchServices["grant"]>().mockResolvedValue(undefined),
        authorize: authorizeRuntimeHttp,
    };
}

const catalog = (deps: ReturnType<typeof services>) => createRuntimeFetch(deps, {purpose: "model-catalog"});

async function configure(baseUrl: string, id = "connector") {
    await db.connectors.put({id, definitionId: "openai-compatible", protocol: "openai-compatible", baseUrl, apiKey: "test-only-key", updatedAt: new Date().toISOString()});
}

describe("model-catalog purpose", () => {
    it("allows exactly the anonymous GET of https://models.dev/api.json, with no configured connector", async () => {
        const deps = services();
        expect(await (await catalog(deps)(URL_OK, {method: "GET", headers: {Accept: "application/json"}})).text()).toBe("native");
        expect(deps.grant).toHaveBeenCalledExactlyOnceWith("https://models.dev", false);
        expect(deps.nativeFetch).toHaveBeenCalledOnce();
        expect(runtimeFetchFor("model-catalog")).toBe(runtimeFetchFor("model-catalog"));
    });

    it.each([
        "https://models.dev/models.json",
        "https://models.dev/api.json/../x",
        "https://models.dev/api.json?x=1",
        "https://models.dev/api.json?",
        "https://models.dev/api.json#frag",
        "https://models.dev/api.json/",
        "https://models.dev/API.json",
        "https://models.dev/",
        "https://models.dev:8443/api.json",
        "https://models.dev.evil.com/api.json",
        "https://www.models.dev/api.json",
        "https://sub.models.dev/api.json",
        "https://evil.com/models.dev/api.json",
        "http://models.dev/api.json",
    ])("rejects %s before any native traffic", async target => {
        const deps = services();
        await expect(catalog(deps)(target)).rejects.toThrow();
        expect(deps.grant).not.toHaveBeenCalled();
        expect(deps.nativeFetch).not.toHaveBeenCalled();
    });

    it.each(["POST", "PUT", "DELETE", "HEAD"])("rejects method %s", async method => {
        const deps = services();
        await expect(catalog(deps)(URL_OK, {method})).rejects.toThrow("匿名 GET");
        expect(deps.nativeFetch).not.toHaveBeenCalled();
    });

    it("rejects a body", async () => {
        const deps = services();
        await expect(catalog(deps)(URL_OK, {method: "GET", body: "x"})).rejects.toThrow();
        expect(deps.nativeFetch).not.toHaveBeenCalled();
    });

    it.each(["Authorization", "Proxy-Authorization", "Cookie", "Cookie2", "X-Api-Key", "Api-Key", "X-Goog-Api-Key"])("rejects credential header %s", async name => {
        const deps = services();
        await expect(catalog(deps)(URL_OK, {headers: {[name]: "secret"}})).rejects.toThrow("匿名 GET");
        expect(deps.nativeFetch).not.toHaveBeenCalled();
    });

    it("re-authorizes every redirect hop: a non-allowed target is rejected before it is sent", async () => {
        const deps = services();
        deps.nativeFetch.mockResolvedValueOnce(new Response(null, {status: 302, headers: {location: "https://evil.example/api.json"}}));
        await expect(catalog(deps)(URL_OK)).rejects.toThrow("匿名 GET");
        expect(deps.nativeFetch).toHaveBeenCalledOnce();
        expect(deps.grant).toHaveBeenCalledOnce();
    });

    it("rejects a redirect to another models.dev path", async () => {
        const deps = services();
        deps.nativeFetch.mockResolvedValueOnce(new Response(null, {status: 301, headers: {location: "/other.json"}}));
        await expect(catalog(deps)(URL_OK)).rejects.toThrow("匿名 GET");
        expect(deps.nativeFetch).toHaveBeenCalledOnce();
    });

    it("rejects a redirect downgraded to http", async () => {
        const deps = services();
        deps.nativeFetch.mockResolvedValueOnce(new Response(null, {status: 307, headers: {location: "http://models.dev/api.json"}}));
        await expect(catalog(deps)(URL_OK)).rejects.toThrow();
        expect(deps.nativeFetch).toHaveBeenCalledOnce();
    });

    it("follows a redirect back to the same allowed URL and re-authorizes that hop", async () => {
        const deps = services();
        const authorize = vi.fn(deps.authorize);
        deps.authorize = authorize;
        deps.nativeFetch.mockResolvedValueOnce(new Response(null, {status: 302, headers: {location: URL_OK}})).mockResolvedValueOnce(new Response("ok"));
        expect(await (await catalog(deps)(URL_OK)).text()).toBe("ok");
        expect(authorize).toHaveBeenCalledTimes(2);
    });

    it("propagates cancellation without sending", async () => {
        const deps = services();
        const controller = new AbortController();
        controller.abort(new DOMException("stop", "AbortError"));
        await expect(catalog(deps)(URL_OK, {signal: controller.signal})).rejects.toMatchObject({name: "AbortError"});
        expect(deps.nativeFetch).not.toHaveBeenCalled();
    });
});

describe("other purposes are unchanged by the model-catalog purpose", () => {
    it.each([
        ["https", "https://model.example/v1", "https://model.example/v1/models"],
        ["http", "http://model.example:8080/v1", "http://model.example:8080/v1/models"],
        ["localhost", "http://localhost:11434/v1", "http://localhost:11434/v1/models"],
        ["LAN", "http://192.168.1.20:3210/v1", "http://192.168.1.20:3210/v1/models"],
    ])("configured %s origin is allowed, an unconfigured one is not", async (_name, baseUrl, target) => {
        await configure(baseUrl);
        const deps = services();
        const configured = createRuntimeFetch(deps);
        expect(await (await configured(target)).text()).toBe("native");
        await expect(configured("https://unconfigured.example/v1/models")).rejects.toThrow("当前连接配置");
        expect(deps.nativeFetch).toHaveBeenCalledOnce();
    });

    it("models.dev is rejected in the configured purpose unless the user configured it", async () => {
        const deps = services();
        await expect(createRuntimeFetch(deps)(URL_OK)).rejects.toThrow("当前连接配置");
        await expect(createRuntimeFetch(deps, {purpose: "result-download"})(URL_OK, {headers: {Authorization: "x"}})).rejects.toThrow("结果下载");
        await expect(createRuntimeFetch(deps, {purpose: "search-probe"})(URL_OK)).rejects.toThrow("搜索连接测试地址无效");
        expect(deps.nativeFetch).not.toHaveBeenCalled();
        await configure("https://models.dev/v1");
        expect(await (await createRuntimeFetch(deps)("https://models.dev/v1/models")).text()).toBe("native");
    });

    it("model-catalog does not widen configured: an allowed catalog call never grants other origins", async () => {
        const deps = services();
        await catalog(deps)(URL_OK);
        await expect(createRuntimeFetch(deps)("https://models.dev/api.json")).rejects.toThrow("当前连接配置");
    });

    it("configured redirects are still rechecked on every hop", async () => {
        await configure("https://model.example/v1");
        const deps = services();
        deps.nativeFetch.mockResolvedValueOnce(new Response(null, {status: 302, headers: {location: "https://unconfigured.example/x"}}));
        await expect(createRuntimeFetch(deps)("https://model.example/v1/models")).rejects.toThrow("当前连接配置");
        expect(deps.nativeFetch).toHaveBeenCalledOnce();
    });

    it("configured streaming reads and cancellation still pass through", async () => {
        await configure("https://model.example/v1");
        const deps = services();
        const cancel = vi.fn();
        deps.nativeFetch.mockResolvedValueOnce(new Response(new ReadableStream<Uint8Array>({
            start(c) { c.enqueue(new TextEncoder().encode("a")); }, cancel,
        }, {highWaterMark: 0})));
        const response = await createRuntimeFetch(deps)("https://model.example/v1/models");
        const reader = response.body!.getReader();
        expect((await reader.read()).value).toEqual(new TextEncoder().encode("a"));
        await reader.cancel();
        expect(cancel).toHaveBeenCalled();
    });
});
