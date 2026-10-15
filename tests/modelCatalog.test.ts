import {readFileSync} from "node:fs";
import {afterEach, describe, expect, it, vi} from "vitest";
import {db} from "@/db/database";
import {putDeviceSetting} from "@/db/deviceSettings";
import {estimateRunCost} from "@/lib/ai/modelCatalog/cost";
import {connectorProviderId} from "@/lib/ai/modelCatalog/connectorProviders";
import {matchModel} from "@/lib/ai/modelCatalog/match";
import {
    getModelCatalog, initModelCatalog, lookupModel, MODEL_CATALOG_KEY, resetModelCatalogForTests, subscribeModelCatalog,
} from "@/lib/ai/modelCatalog/store";
import type {CatalogEntry, CatalogSnapshot} from "@/lib/ai/modelCatalog/types";
import {parseBaselineSnapshot, parseSyncedSnapshot} from "@/lib/ai/modelCatalog/validate";
import baseline from "@/lib/ai/modelCatalog/baseline.generated.json";
// @ts-expect-error plain ESM script without declarations
import {BASELINE_PATH, compareBaseline, projectBaseline} from "../tooling/models-dev-baseline.mjs";

afterEach(() => resetModelCatalogForTests());

const entry = (provider: string, id: string, extra: Partial<CatalogEntry> = {}): CatalogEntry => ({provider, id, name: id, ...extra});
const snap = (entries: CatalogEntry[], providerOrigins: Record<string, string> = {}): CatalogSnapshot => ({source: "baseline", providerOrigins, entries});
const deepseek = {definitionId: "deepseek", baseUrl: "https://api.deepseek.com/v1"} as const;
const apimart = {definitionId: "apimart", baseUrl: "https://api.apimart.ai/v1"} as const;
const compat = (baseUrl: string) => ({definitionId: "openai-compatible", baseUrl}) as const;

describe("committed baseline", () => {
    it("passes strict validation", () => {
        const parsed = parseBaselineSnapshot(baseline);
        expect(parsed?.entries.length).toBeGreaterThan(100);
        expect(parsed?.packageVersion).toBe(baseline.packageVersion);
    });

    it("rejects malformed rows and unknown formats", () => {
        const first = baseline.entries[0];
        expect(parseBaselineSnapshot({...baseline, format: 2})).toBeUndefined();
        expect(parseBaselineSnapshot({...baseline, entries: [{...first, context: 0}]})).toBeUndefined();
        expect(parseBaselineSnapshot({...baseline, entries: [{...first, cost: {input: -1}}]})).toBeUndefined();
        expect(parseBaselineSnapshot({...baseline, entries: [first, first]})).toBeUndefined();
    });

    it("regenerates identically from the installed package; only real drift fails verify", async () => {
        const snapshot = await import("@opencode-ai/models/snapshot");
        const pkg = JSON.parse(readFileSync("node_modules/@opencode-ai/models/package.json", "utf8"));
        const scope = JSON.parse(readFileSync("packages/studio/src/lib/ai/modelCatalog/scope.json", "utf8"));
        const fresh = projectBaseline({providers: snapshot.providers, snapshotGeneratedAt: snapshot.generatedAt, packageVersion: pkg.version}, scope);
        const committed = JSON.parse(readFileSync(BASELINE_PATH, "utf8"));
        expect(compareBaseline(committed, fresh)).toEqual([]);
        expect(compareBaseline({...committed, generatedAt: "1999-01-01T00:00:00.000Z"}, fresh)).toEqual([]);
        const tampered = structuredClone(committed);
        tampered.entries[0].name = "tampered";
        expect(compareBaseline(tampered, fresh)).toHaveLength(1);
        expect(compareBaseline({...committed, packageVersion: "0.0.1"}, fresh).length).toBeGreaterThan(0);
    });

    it("does not store absent facts as 0 and drops pricing tiers", () => {
        const projected = projectBaseline({
            providers: {deepseek: {models: {m: {id: "m", name: "M", release_date: "2026-01-01", status: "deprecated", modalities: {input: ["text"], output: ["text"]}, limit: {context: 10, output: 0}, cost: {input: 1, output: 2, tiers: [{tier: {}}]}}}}},
            snapshotGeneratedAt: "2026-10-01T00:00:00.000Z", packageVersion: "x",
        }, {recentMonths: 18, fullProviders: ["deepseek"], originProviders: []});
        expect(projected.entries).toEqual([{provider: "deepseek", id: "m", name: "M", context: 10, imageInput: false, cost: {input: 1, output: 2}, releaseDate: "2026-01-01"}]);
    });
});

describe("synced snapshot parsing", () => {
    const valid = {v: 1, syncedAt: "2026-10-14T00:00:00.000Z", providerOrigins: {}, entries: [entry("openai", "a")]};
    it("accepts a valid stored value and rejects bad versions, times and rows", () => {
        expect(parseSyncedSnapshot(valid)?.source).toBe("synced");
        expect(parseSyncedSnapshot({...valid, v: 2})).toBeUndefined();
        expect(parseSyncedSnapshot({...valid, syncedAt: "never"})).toBeUndefined();
        expect(parseSyncedSnapshot({...valid, entries: [{id: "a"}]})).toBeUndefined();
        expect(parseSyncedSnapshot("junk")).toBeUndefined();
    });
    it("rejects an over-budget value", () => {
        const entries = Array.from({length: 9000}, (_, i) => entry("openai", `m-${i}`, {name: "x".repeat(400)}));
        expect(parseSyncedSnapshot({...valid, entries})).toBeUndefined();
    });
});

describe("model catalog store", () => {
    const synced = {v: 1, syncedAt: "2026-10-14T00:00:00.000Z", providerOrigins: {}, entries: [entry("deepseek", "only-synced", {context: 5})]};

    it("answers unknown, without throwing, before initialization", () => {
        expect(getModelCatalog()).toBeUndefined();
        expect(lookupModel(deepseek, "deepseek-v4-pro")).toBeUndefined();
    });

    it("prefers a valid synced snapshot and notifies subscribers", async () => {
        await putDeviceSetting(MODEL_CATALOG_KEY, synced);
        const listener = vi.fn();
        subscribeModelCatalog(listener);
        await initModelCatalog();
        expect(getModelCatalog()?.source).toBe("synced");
        expect(lookupModel(deepseek, "only-synced")?.entry.context).toBe(5);
        expect(listener).toHaveBeenCalledTimes(1);
    });

    it.each([
        ["corrupt", {v: 1, syncedAt: "2026-10-14T00:00:00.000Z", providerOrigins: {}, entries: "no"}],
        ["wrong version", {...synced, v: 9}],
        ["over budget", {...synced, entries: Array.from({length: 9000}, (_, i) => entry("openai", `m-${i}`, {name: "x".repeat(400)}))}],
    ])("falls back to the baseline for a %s stored value", async (_name, value) => {
        await db.deviceSettings.put({key: MODEL_CATALOG_KEY, value, updatedAt: "2026-10-14T00:00:00.000Z"});
        await initModelCatalog();
        expect(getModelCatalog()?.source).toBe("baseline");
    });

    it("falls back to the baseline when the setting cannot be read", async () => {
        db.close();
        await initModelCatalog();
        expect(getModelCatalog()?.source).toBe("baseline");
    });

    it("hits known ids for each connector provider using structural assertions", async () => {
        await initModelCatalog();
        const catalog = getModelCatalog()!;
        const sample = (provider: string) => catalog.entries.find(e => e.provider === provider && e.context && e.context > 0)!;
        const cases = [
            [deepseek, "deepseek"],
            [{definitionId: "aihubmix", baseUrl: "https://aihubmix.com/v1"}, "aihubmix"],
            [{definitionId: "mimo", baseUrl: "https://api.xiaomimimo.com/v1"}, "xiaomi"],
            [compat("https://api.openai.com/v1"), "openai"],
        ] as const;
        for (const [connector, provider] of cases) {
            const target = sample(provider);
            const hit = lookupModel(connector, target.id);
            expect(hit?.tier).toBe("provider");
            expect(hit?.entry.provider).toBe(provider);
            expect(hit?.entry.context).toBeGreaterThan(0);
        }
        // apimart has no provider: an id that only an original vendor lists falls to tier 2.
        const vendorOnly = catalog.entries.find(e => e.provider === "anthropic")!;
        expect(lookupModel(apimart, vendorOnly.id)?.tier).toBe("origin");
    });

    it("lets a query callback read the catalog inside a real observe transaction", async () => {
        await initModelCatalog();
        const target = getModelCatalog()!.entries.find(e => e.provider === "deepseek")!;
        const value = await new Promise<unknown>((resolve, reject) => {
            const stop = db.observe(async tx => {
                await tx.chatThreads.toArray();
                return lookupModel(deepseek, target.id)?.entry.id;
            }, {next: v => { stop(); resolve(v); }, error: e => { stop(); reject(e); }});
        });
        expect(value).toBe(target.id);
    });
});

describe("layered matching", () => {
    const origins = {deepseek: "https://api.deepseek.com", moon: "https://api.moon.example"};

    it("tier 1 uses the connector provider's exact id and own price (not reference)", () => {
        const match = matchModel(snap([entry("deepseek", "m", {context: 10, cost: {input: 1}}), entry("anthropic", "m", {context: 99})]), deepseek, "m");
        expect(match).toMatchObject({tier: "provider", entry: {context: 10}, price: {input: 1, reference: false, provider: "deepseek"}});
    });

    it("tier 2 uses original vendors and marks the price as reference", () => {
        const match = matchModel(snap([entry("anthropic", "m", {context: 10, cost: {input: 3}}), entry("openrouter", "m", {context: 5, cost: {input: 1}})]), deepseek, "m");
        expect(match).toMatchObject({tier: "origin", entry: {provider: "anthropic", context: 10}, price: {input: 3, reference: true}});
    });

    it("tier 2 conflicts take the smallest limit; vision conflicts and price conflicts become unknown", () => {
        const match = matchModel(snap([
            entry("anthropic", "m", {context: 10, output: 4, imageInput: true, cost: {input: 3}}),
            entry("google", "m", {context: 7, output: 8, imageInput: false, cost: {input: 2}}),
        ]), apimart, "m")!;
        expect(match.tier).toBe("origin");
        expect(match.entry.context).toBe(7);
        expect(match.entry.output).toBe(4);
        expect(match.entry.imageInput).toBeUndefined();
        expect(match.price).toBeUndefined();
    });

    it("tier 3 requires one canonical model and agreeing fields, and never prices", () => {
        const canonical = (p: string, extra: Partial<CatalogEntry>) => entry(p, "m", {canonicalId: "lab/m", ...extra});
        const agree = matchModel(snap([canonical("r1", {context: 10, cost: {input: 1}}), canonical("r2", {context: 10, output: 3})]), apimart, "m")!;
        expect(agree.tier).toBe("canonical");
        expect(agree.entry.context).toBe(10);
        expect(agree.entry.output).toBeUndefined();
        expect(agree.price).toBeUndefined();
        const disagree = matchModel(snap([canonical("r1", {context: 10}), canonical("r2", {context: 12})]), apimart, "m")!;
        expect(disagree.entry.context).toBeUndefined();
        expect(matchModel(snap([canonical("r1", {}), entry("r2", "m", {canonicalId: "lab/other"})]), apimart, "m")).toBeUndefined();
        expect(matchModel(snap([entry("r1", "m", {context: 1})]), apimart, "m")).toBeUndefined();
        expect(matchModel(snap([canonical("r1", {context: 10})]), apimart, "lab/m")?.tier).toBe("canonical");
    });

    it("does not fold case or invent aliases", () => {
        expect(matchModel(snap([entry("deepseek", "Model-A", {context: 1})]), deepseek, "model-a")).toBeUndefined();
        expect(matchModel(snap([entry("deepseek", "model-a", {context: 1})]), deepseek, " model-a ")?.tier).toBe("provider");
    });

    it("matches openai-compatible by the current base URL origin", () => {
        const snapshot = snap([entry("openai", "m", {context: 1}), entry("moon", "m", {context: 2})], origins);
        expect(connectorProviderId(compat("https://api.openai.com/v1"), origins)).toBe("openai");
        expect(matchModel(snapshot, compat("https://api.moon.example/v1"), "m")?.entry.provider).toBe("moon");
        expect(connectorProviderId(compat("http://192.168.1.2:8000/v1"), origins)).toBeUndefined();
        expect(connectorProviderId(compat("not a url"), origins)).toBeUndefined();
        expect(connectorProviderId(compat("https://api.shared.example/v1"), {a: "https://api.shared.example", b: "https://api.shared.example"})).toBeUndefined();
    });
});

describe("estimateRunCost", () => {
    const pricing = {input: 2, output: 8, cacheRead: 0.5};
    it("prices uncached input, cached input and output per million tokens", () => {
        expect(estimateRunCost({inputTokens: 1_000_000, cachedInputTokens: 400_000, outputTokens: 100_000}, pricing))
            .toEqual({amount: 2 * 0.6 + 0.5 * 0.4 + 8 * 0.1, complete: true});
    });
    it("treats zero usage as a complete zero cost", () => {
        expect(estimateRunCost({inputTokens: 0, outputTokens: 0}, {})).toEqual({amount: 0, complete: true});
    });
    it("is incomplete, not zero, when a needed price or count is missing", () => {
        expect(estimateRunCost({inputTokens: 10, cachedInputTokens: 5, outputTokens: 1}, {input: 1, output: 1})).toEqual({complete: false});
        expect(estimateRunCost({inputTokens: 10, outputTokens: 1}, {input: 1})).toEqual({complete: false});
        expect(estimateRunCost({inputTokens: 10}, pricing)).toEqual({complete: false});
        expect(estimateRunCost({inputTokens: 1, outputTokens: 1}, undefined)).toEqual({complete: false});
    });
});
