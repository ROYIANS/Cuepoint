import {afterEach, describe, expect, it, vi} from "vitest";
import {createRuntimeFetch, type RuntimeFetchServices} from "@/platform/runtime/runtimeFetch";

afterEach(() => vi.unstubAllGlobals());

describe("native HTTP page lifecycle", () => {
    it("aborts all pending headers and stalled bodies on page close, removes completed controllers and refuses late requests", async () => {
        const events = new EventTarget();
        vi.stubGlobal("window", events);
        let completedSignal: AbortSignal | undefined;
        const cancel = vi.fn();
        const nativeFetch = vi.fn<RuntimeFetchServices["nativeFetch"]>(async (url, init) => {
            if (url.endsWith("/complete")) {
                completedSignal = init.signal ?? undefined;
                return new Response("finished");
            }
            if (url.endsWith("/headers")) return new Promise((_resolve, reject) => {
                init.signal?.addEventListener("abort", () => reject(new Error("native closed")), {once: true});
            });
            return new Response(new ReadableStream<Uint8Array>({pull: () => new Promise<void>(() => undefined), cancel}, {highWaterMark: 0}));
        });
        const fetchImpl = createRuntimeFetch({
            native: () => true, webFetch: vi.fn<typeof fetch>(), nativeFetch,
            authorize: async url => ({origin: url.origin, allowHttp: false}), grant: async () => undefined,
        });
        expect(await (await fetchImpl("https://fixture.example/complete")).text()).toBe("finished");
        const pendingHeaders = fetchImpl("https://fixture.example/headers");
        await vi.waitFor(() => expect(nativeFetch).toHaveBeenCalledTimes(2));
        const body = await fetchImpl("https://fixture.example/body");
        const pendingRead = body.text();
        events.dispatchEvent(new Event("pagehide"));
        await expect(pendingHeaders).rejects.toMatchObject({name: "AbortError"});
        await expect(pendingRead).rejects.toMatchObject({name: "AbortError"});
        await vi.waitFor(() => expect(cancel).toHaveBeenCalledOnce());
        expect(completedSignal?.aborted).toBe(false);
        await expect(fetchImpl("https://fixture.example/late")).rejects.toMatchObject({name: "AbortError"});
        expect(nativeFetch).toHaveBeenCalledTimes(3);
        events.dispatchEvent(new Event("beforeunload"));
        expect(cancel).toHaveBeenCalledOnce();
        events.dispatchEvent(new Event("pageshow"));
        expect(await (await fetchImpl("https://fixture.example/complete")).text()).toBe("finished");
        events.dispatchEvent(new Event("beforeunload"));
        // A canceled native/browser close warning must not permanently disable the remaining page.
        expect(await (await fetchImpl("https://fixture.example/complete")).text()).toBe("finished");
    });
});
