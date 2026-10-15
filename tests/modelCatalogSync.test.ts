import {afterEach, describe, expect, it, vi} from "vitest";
import {db} from "@/platform/product/store";
import {DEVICE_SETTING_MAX_BYTES} from "@/features/settings/commands/deviceSettings";
import {
    CATALOG_SELECTION_KEY, clearSyncedCatalog, fetchCatalogIndex, getCatalogSelection, MODEL_CATALOG_MAX_BYTES, putCatalogSelection, syncModelCatalog,
} from "@/features/settings/modelCatalog/sync";
import {getModelCatalog, initModelCatalog, lookupModel, MODEL_CATALOG_KEY, resetModelCatalogForTests, subscribeModelCatalog} from "@/features/settings/modelCatalog/store";
import {parseSyncedSnapshot} from "@/features/settings/modelCatalog/validate";

afterEach(() => { resetModelCatalogForTests(); vi.useRealTimers(); });

const today = new Date().toISOString().slice(0, 10);
const model = (id: string, extra: Record<string, unknown> = {}) => ({
    id, name: `Name ${id}`, release_date: today, type: "chat",
    modalities: {input: ["text"], output: ["text"]},
    limit: {context: 128000, output: 8192}, cost: {input: 1, output: 2}, ...extra,
});
const provider = (id: string, models: Record<string, unknown>, api?: string) => ({id, name: id, ...(api ? {api} : {}), models});

function fixture(): Record<string, unknown> {
    return {
        deepseek: provider("deepseek", {"deepseek-chat": model("deepseek-chat", {limit: {context: 64000, output: 4096}, status: "deprecated"})}, "https://api.deepseek.com"),
        aihubmix: provider("aihubmix", {"gpt-4o": model("gpt-4o", {canonical_model_id: "openai/gpt-4o", cost: {input: 9, output: 9}})}, "https://aihubmix.com/v1"),
        xiaomi: provider("xiaomi", {"mimo-v2": model("mimo-v2")}),
        openai: provider("openai", {"gpt-4o": model("gpt-4o", {canonical_model_id: "openai/gpt-4o"})}, "https://api.openai.com/v1"),
        anthropic: provider("anthropic", {
            "claude-new": model("claude-new"),
            "claude-old": model("claude-old", {release_date: "2019-01-01"}),
        }),
        // Outside the common scope: only reachable by a manual pick.
        groq: provider("groq", {"gpt-4o": model("gpt-4o", {canonical_model_id: "openai/gpt-4o"}), "llama-x": model("llama-x")}, "https://api.groq.com"),
        other: provider("other", {"openai/gpt-4o": model("openai/gpt-4o", {}), "vendor/Foo": model("vendor/Foo"), foo: model("foo")}),
    };
}

function respond(body: unknown, init: ResponseInit = {}) {
    return vi.fn<typeof fetch>().mockImplementation(async () =>
        new Response(typeof body === "string" ? body : JSON.stringify(body), {status: 200, headers: {"content-type": "application/json"}, ...init}));
}

const common = {autoIncludeCommon: true, modelKeys: []};
const row = () => db.deviceSettings.get(MODEL_CATALOG_KEY);

describe("syncModelCatalog success", () => {
    it("projects the common scope, keeps provider origins, persists, updates memory and notifies", async () => {
        await initModelCatalog();
        const before = getModelCatalog();
        const listener = vi.fn();
        subscribeModelCatalog(listener);
        const fetchImpl = respond(fixture());
        const result = await syncModelCatalog(common, {fetchImpl});
        expect(result).toMatchObject({ok: true, truncated: false});
        expect(fetchImpl).toHaveBeenCalledOnce();
        expect(fetchImpl.mock.calls[0][0]).toBe("https://models.dev/api.json");
        expect(fetchImpl.mock.calls[0][1]).toMatchObject({method: "GET", credentials: "omit"});
        const snapshot = getModelCatalog()!;
        expect(snapshot).not.toBe(before);
        expect(snapshot.source).toBe("synced");
        expect(listener).toHaveBeenCalledTimes(1);
        // deprecated connector-provider model kept; old vendor model dropped; text-only filter applies.
        expect(snapshot.entries.map(e => `${e.provider}/${e.id}`).sort()).toEqual([
            "aihubmix/gpt-4o", "anthropic/claude-new", "deepseek/deepseek-chat", "openai/gpt-4o", "xiaomi/mimo-v2",
        ]);
        expect(snapshot.providerOrigins).toEqual({deepseek: "https://api.deepseek.com", aihubmix: "https://aihubmix.com", openai: "https://api.openai.com"});
        // Immediately visible to the synchronous lookup, tier-1 per connector.
        const hit = lookupModel({definitionId: "deepseek", baseUrl: "https://api.deepseek.com/v1"}, "deepseek-chat");
        expect(hit).toMatchObject({tier: "provider"});
        expect(hit?.entry.context).toBe(64000);
        expect(lookupModel({definitionId: "aihubmix", baseUrl: "https://aihubmix.com/v1"}, "gpt-4o")?.price?.input).toBe(9);
        expect(result.ok && parseSyncedSnapshot((await row())!.value)?.entries).toEqual(snapshot.entries);
    });

    it("round-trips: a fresh initModelCatalog reads the same stored snapshot", async () => {
        await syncModelCatalog(common, {fetchImpl: respond(fixture())});
        const synced = getModelCatalog()!;
        resetModelCatalogForTests();
        await initModelCatalog();
        expect(getModelCatalog()).toMatchObject({source: "synced", syncedAt: synced.syncedAt, entries: synced.entries, providerOrigins: synced.providerOrigins});
    });

    it("adds manual picks, merges duplicates by normalized id preferring the original vendor, and reports origins", async () => {
        const selection = {autoIncludeCommon: false, modelKeys: ["groq/gpt-4o", "other/openai/gpt-4o", "openai/gpt-4o", "groq/llama-x", "groq/llama-x", "other/vendor/Foo", "other/foo", "nope/x", "groq/missing", "badkey"]};
        const result = await syncModelCatalog(selection, {fetchImpl: respond(fixture())});
        expect(result).toMatchObject({ok: true, count: 4});
        const keys = getModelCatalog()!.entries.map(e => `${e.provider}/${e.id}`);
        // Same canonicalId (openai/gpt-4o): one survives, the original vendor. Without canonicalId the id is
        // lowercased with its prefix removed, so other/vendor/Foo and other/foo merge (and stay distinct from gpt-4o).
        expect(keys).toEqual(["groq/llama-x", "openai/gpt-4o", "other/foo", "other/openai/gpt-4o"]);
        expect(getModelCatalog()!.providerOrigins).toMatchObject({groq: "https://api.groq.com"});
    });

    it("does not repeat a manual pick that the common scope already has, and keeps the aggregator entry", async () => {
        const result = await syncModelCatalog({autoIncludeCommon: true, modelKeys: ["openai/gpt-4o", "groq/llama-x"]}, {fetchImpl: respond(fixture())});
        expect(result).toMatchObject({ok: true, count: 6});
        expect(getModelCatalog()!.entries.filter(e => e.id === "gpt-4o").map(e => e.provider).sort()).toEqual(["aihubmix", "openai"]);
    });

    it("drops one bad entry (and a bad optional field) but still succeeds", async () => {
        const data = fixture();
        (data.openai as {models: Record<string, unknown>}).models["bad-1"] = {id: "bad-1"};
        (data.openai as {models: Record<string, unknown>}).models["bad-2"] = "nope";
        (data.openai as {models: Record<string, unknown>}).models["long-name"] = model("long-name", {name: "x".repeat(600)});
        (data.openai as {models: Record<string, unknown>}).models["odd-cost"] = model("odd-cost", {cost: {input: "free", output: 3}});
        data.broken = "not a provider";
        const result = await syncModelCatalog(common, {fetchImpl: respond(data)});
        expect(result.ok).toBe(true);
        const ids = getModelCatalog()!.entries.filter(e => e.provider === "openai").map(e => e.id);
        expect(ids).toContain("odd-cost");
        expect(ids).not.toContain("bad-1");
        expect(ids).not.toContain("bad-2");
        expect(ids).not.toContain("long-name");
        expect(getModelCatalog()!.entries.find(e => e.id === "odd-cost")?.cost).toEqual({output: 3});
    });

    it("truncates the oldest releases when the row exceeds 2 MiB and flags it", async () => {
        const data = fixture();
        const many: Record<string, unknown> = {};
        for (let i = 0; i < 6000; i++) many[`m-${i}`] = model(`m-${i}`, {name: "n".repeat(400), release_date: `2020-${String(1 + i % 12).padStart(2, "0")}`});
        many["newest"] = model("newest", {name: "n".repeat(400), release_date: today});
        data.openai = provider("openai", many);
        const result = await syncModelCatalog(common, {fetchImpl: respond(data)});
        expect(result).toMatchObject({ok: true, truncated: true});
        const stored = JSON.stringify((await row())!.value);
        expect(new TextEncoder().encode(stored).byteLength).toBeLessThanOrEqual(DEVICE_SETTING_MAX_BYTES);
        const entries = getModelCatalog()!.entries;
        expect(entries.some(e => e.id === "newest")).toBe(true);
        expect(entries.some(e => e.provider === "deepseek")).toBe(true);
        expect(entries.length).toBeLessThan(6000);
    });
});

describe("syncModelCatalog failures keep the original snapshot", () => {
    async function expectFailure(run: () => ReturnType<typeof syncModelCatalog>, code: string) {
        await initModelCatalog();
        const before = getModelCatalog();
        const listener = vi.fn();
        subscribeModelCatalog(listener);
        const result = await run();
        expect(result).toMatchObject({ok: false, code});
        if (!result.ok) expect(result.message).not.toMatch(/models\.dev\/api|\?|undefined|Error/);
        expect(getModelCatalog()).toBe(before);
        expect(listener).not.toHaveBeenCalled();
        expect(await row()).toBeUndefined();
    }

    it("non-200", () => expectFailure(() => syncModelCatalog(common, {fetchImpl: respond("x", {status: 503})}), "http-status"));
    it("non-JSON content type", () => expectFailure(() => syncModelCatalog(common, {fetchImpl: respond("<html>", {headers: {"content-type": "text/html"}})}), "invalid-format"));
    it("invalid JSON", () => expectFailure(() => syncModelCatalog(common, {fetchImpl: respond("{oops")}), "invalid-format"));
    it("non-object root", () => expectFailure(() => syncModelCatalog(common, {fetchImpl: respond([])}), "invalid-format"));
    it("no usable providers", () => expectFailure(() => syncModelCatalog(common, {fetchImpl: respond({a: 1, b: {models: []}})}), "invalid-format"));
    it("too many scope providers missing", () => expectFailure(() => syncModelCatalog(common, {fetchImpl: respond({openai: provider("openai", {x: model("x")}), other: provider("other", {})})}), "invalid-format"));
    it("zero projected entries", () => expectFailure(() => syncModelCatalog({autoIncludeCommon: false, modelKeys: ["groq/none"]}, {fetchImpl: respond(fixture())}), "invalid-format"));
    it("network error", () => expectFailure(() => syncModelCatalog(common, {fetchImpl: vi.fn<typeof fetch>().mockRejectedValue(new TypeError("net https://models.dev/api.json?secret=1"))}), "network"));

    it("body over 8 MiB is stopped while reading", async () => {
        const chunk = new Uint8Array(1024 * 1024).fill(32);
        let sent = 0;
        const fetchImpl = vi.fn<typeof fetch>().mockImplementation(async () => new Response(new ReadableStream<Uint8Array>({
            pull(c) { c.enqueue(chunk); sent++; if (sent > 20) c.close(); },
        }, {highWaterMark: 0}), {status: 200, headers: {"content-type": "application/json"}}));
        await expectFailure(() => syncModelCatalog(common, {fetchImpl}), "too-large");
        expect(sent).toBeLessThanOrEqual(MODEL_CATALOG_MAX_BYTES / chunk.length + 1);
        expect(MODEL_CATALOG_MAX_BYTES).toBe(8 * 1024 * 1024);
    });

    it("cancellation before and during the request", async () => {
        const pre = new AbortController();
        pre.abort();
        const fetchImpl = respond(fixture());
        await expectFailure(() => syncModelCatalog(common, {fetchImpl, signal: pre.signal}), "cancelled");
        expect(fetchImpl).not.toHaveBeenCalled();
        const during = new AbortController();
        const hang = vi.fn<typeof fetch>().mockImplementation((_input, init) => new Promise<Response>((_, reject) => {
            init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
        }));
        await expectFailure(() => {
            const pending = syncModelCatalog(common, {fetchImpl: hang, signal: during.signal});
            queueMicrotask(() => during.abort());
            return pending;
        }, "cancelled");
    });

    it("cancellation while the body is stalled", async () => {
        const during = new AbortController();
        const stalled = vi.fn<typeof fetch>().mockImplementation(async () => new Response(new ReadableStream<Uint8Array>({
            start(c) { c.enqueue(new TextEncoder().encode("{")); },
        }, {highWaterMark: 0}), {status: 200, headers: {"content-type": "application/json"}}));
        await expectFailure(() => {
            const pending = syncModelCatalog(common, {fetchImpl: stalled, signal: during.signal});
            setTimeout(() => during.abort(), 10);
            return pending;
        }, "cancelled");
    });

    it("times out after 60 seconds", async () => {
        await initModelCatalog();
        vi.useFakeTimers();
        const hang = vi.fn<typeof fetch>().mockImplementation((_input, init) => new Promise<Response>((_, reject) => {
            init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
        }));
        const pending = syncModelCatalog(common, {fetchImpl: hang});
        await vi.advanceTimersByTimeAsync(59_999);
        await vi.advanceTimersByTimeAsync(2);
        expect(await pending).toMatchObject({ok: false, code: "timeout"});
        vi.useRealTimers();
        expect(await row()).toBeUndefined();
    });

    it("a failed write (closed database) leaves the memory snapshot untouched", async () => {
        await initModelCatalog();
        const before = getModelCatalog();
        db.close();
        const result = await syncModelCatalog(common, {fetchImpl: respond(fixture())});
        expect(result).toMatchObject({ok: false, code: "storage"});
        expect(getModelCatalog()).toBe(before);
    });
});

describe("clearSyncedCatalog", () => {
    it("deletes the row and falls back to the baseline", async () => {
        await syncModelCatalog(common, {fetchImpl: respond(fixture())});
        expect(getModelCatalog()?.source).toBe("synced");
        const listener = vi.fn();
        subscribeModelCatalog(listener);
        expect(await clearSyncedCatalog()).toBe(true);
        expect(getModelCatalog()?.source).toBe("baseline");
        expect(listener).toHaveBeenCalledOnce();
        expect(await row()).toBeUndefined();
    });

    it("keeps the current snapshot when the delete fails", async () => {
        await syncModelCatalog(common, {fetchImpl: respond(fixture())});
        const before = getModelCatalog();
        db.close();
        expect(await clearSyncedCatalog()).toBe(false);
        expect(getModelCatalog()).toBe(before);
    });
});

describe("catalog selection", () => {
    it("defaults, round-trips and de-duplicates", async () => {
        expect(await getCatalogSelection()).toEqual({autoIncludeCommon: true, modelKeys: []});
        await putCatalogSelection({autoIncludeCommon: false, modelKeys: ["a/b", "a/b", "c/d"]});
        expect(await getCatalogSelection()).toEqual({autoIncludeCommon: false, modelKeys: ["a/b", "c/d"]});
    });

    it("falls back on corrupt storage and an unreadable database", async () => {
        await db.deviceSettings.put({key: CATALOG_SELECTION_KEY, value: {autoIncludeCommon: "yes", modelKeys: 3}, updatedAt: "2026-10-14T00:00:00.000Z"});
        expect(await getCatalogSelection()).toEqual({autoIncludeCommon: true, modelKeys: []});
        await db.deviceSettings.put({key: CATALOG_SELECTION_KEY, value: {autoIncludeCommon: true, modelKeys: ["x".repeat(257)]}, updatedAt: "2026-10-14T00:00:00.000Z"});
        expect(await getCatalogSelection()).toEqual({autoIncludeCommon: true, modelKeys: []});
        db.close();
        expect(await getCatalogSelection()).toEqual({autoIncludeCommon: true, modelKeys: []});
    });

    it("rejects too many or too long keys before writing", async () => {
        await expect(putCatalogSelection({autoIncludeCommon: true, modelKeys: Array.from({length: 2001}, (_, i) => `p/${i}`)})).rejects.toThrow("模型选择无效");
        await expect(putCatalogSelection({autoIncludeCommon: true, modelKeys: ["p/" + "x".repeat(255)]})).rejects.toThrow("模型选择无效");
        await putCatalogSelection({autoIncludeCommon: true, modelKeys: Array.from({length: 2000}, (_, i) => `p/${i}`)});
        expect((await getCatalogSelection()).modelKeys).toHaveLength(2000);
        expect(await db.deviceSettings.get(CATALOG_SELECTION_KEY)).toBeDefined();
    });
});

describe("fetchCatalogIndex", () => {
    it("returns light rows, merges equivalent ids behind one row and writes nothing", async () => {
        await initModelCatalog();
        const before = getModelCatalog();
        const listener = vi.fn();
        subscribeModelCatalog(listener);
        const fetchImpl = respond(fixture());
        const result = await fetchCatalogIndex({fetchImpl});
        expect(fetchImpl).toHaveBeenCalledOnce();
        expect(fetchImpl.mock.calls[0][0]).toBe("https://models.dev/api.json");
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        // gpt-4o: openai (original vendor) represents aihubmix + groq (same canonicalId). other/openai/gpt-4o has no
        // canonicalId, so its normalized id differs and the sync rule keeps it as its own row.
        const gpt = result.rows.find(r => r.modelKeys.includes("openai/gpt-4o"))!;
        expect(gpt.provider).toBe("openai");
        expect(gpt.modelKeys).toEqual(["aihubmix/gpt-4o", "groq/gpt-4o", "openai/gpt-4o"]);
        expect(gpt.providers).toEqual(["aihubmix", "groq", "openai"]);
        expect(gpt.cost).toEqual({input: 1, output: 2});
        expect(gpt.providerName).toBe("openai");
        // Non-chat/old/deprecated models are not filtered out of the picker; every key appears in exactly one row.
        const keys = result.rows.flatMap(r => r.modelKeys);
        expect(new Set(keys).size).toBe(keys.length);
        expect(keys).toContain("anthropic/claude-old");
        expect(Object.keys(result.rows[0]).sort()).toEqual(expect.arrayContaining(["id", "modelKeys", "name", "provider", "providers"]));
        // Nothing persisted, memory snapshot and subscribers untouched.
        expect(await row()).toBeUndefined();
        expect(await db.deviceSettings.count()).toBe(0);
        expect(getModelCatalog()).toBe(before);
        expect(listener).not.toHaveBeenCalled();
    });

    it("selecting every key of a merged row syncs it once", async () => {
        const result = await fetchCatalogIndex({fetchImpl: respond(fixture())});
        if (!result.ok) throw new Error("index failed");
        const gpt = result.rows.find(r => r.id === "gpt-4o" && r.provider === "openai")!;
        const sync = await syncModelCatalog({autoIncludeCommon: false, modelKeys: gpt.modelKeys}, {fetchImpl: respond(fixture())});
        expect(sync).toMatchObject({ok: true, count: 1});
    });

    const failing = async (run: () => ReturnType<typeof fetchCatalogIndex>, code: string) => {
        await initModelCatalog();
        const before = getModelCatalog();
        const result = await run();
        expect(result).toMatchObject({ok: false, code});
        if (!result.ok) expect(result.message).not.toMatch(/models\.dev\/api|\?|undefined|Error/);
        expect(getModelCatalog()).toBe(before);
        expect(await db.deviceSettings.count()).toBe(0);
    };
    it("reports the same friendly failures as sync", async () => {
        await failing(() => fetchCatalogIndex({fetchImpl: respond("x", {status: 503})}), "http-status");
        await failing(() => fetchCatalogIndex({fetchImpl: respond("<html>", {headers: {"content-type": "text/html"}})}), "invalid-format");
        await failing(() => fetchCatalogIndex({fetchImpl: respond("{oops")}), "invalid-format");
        await failing(() => fetchCatalogIndex({fetchImpl: respond([])}), "invalid-format");
        await failing(() => fetchCatalogIndex({fetchImpl: vi.fn<typeof fetch>().mockRejectedValue(new TypeError("net https://models.dev/api.json?secret=1"))}), "network");
    });
    it("stops a body over 8 MiB", async () => {
        const chunk = new Uint8Array(1024 * 1024).fill(32);
        let sent = 0;
        const fetchImpl = vi.fn<typeof fetch>().mockImplementation(async () => new Response(new ReadableStream<Uint8Array>({
            pull(c) { c.enqueue(chunk); sent++; if (sent > 20) c.close(); },
        }, {highWaterMark: 0}), {status: 200, headers: {"content-type": "application/json"}}));
        await failing(() => fetchCatalogIndex({fetchImpl}), "too-large");
        expect(sent).toBeLessThanOrEqual(MODEL_CATALOG_MAX_BYTES / chunk.length + 1);
    });
    it("is cancellable before and during the request", async () => {
        const pre = new AbortController();
        pre.abort();
        const fetchImpl = respond(fixture());
        await failing(() => fetchCatalogIndex({fetchImpl, signal: pre.signal}), "cancelled");
        expect(fetchImpl).not.toHaveBeenCalled();
        const during = new AbortController();
        const hang = vi.fn<typeof fetch>().mockImplementation((_input, init) => new Promise<Response>((_, reject) => {
            init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
        }));
        await failing(() => {
            const pending = fetchCatalogIndex({fetchImpl: hang, signal: during.signal});
            queueMicrotask(() => during.abort());
            return pending;
        }, "cancelled");
    });
});
