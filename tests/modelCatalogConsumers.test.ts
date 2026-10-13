import {afterEach, beforeAll, describe, expect, it} from "vitest";
import {db} from "@/db/database";
import {createChatThread} from "@/db/chat";
import {beginAgentRun} from "@/db/agentRuns";
import type {AgentRun} from "@/domain/agent";
import type {ConnectorConfig} from "@/domain/types";
import {resolveContextCapacity} from "@/lib/agent/contextPolicy";
import {estimateRunCost} from "@/lib/ai/modelCatalog/cost";
import {getModelCatalog, initModelCatalog, resetModelCatalogForTests} from "@/lib/ai/modelCatalog/store";
import {resolveModelMetadata} from "@/lib/ai/modelMetadata";
import {requireVision, resolveVisionCapability} from "@/lib/ai/visionCapability";

const connector = (definitionId: ConnectorConfig["definitionId"], baseUrl: string): ConnectorConfig =>
    ({id: `c-${definitionId}`, definitionId, baseUrl, apiKey: "k", updatedAt: "2026-10-14"});

async function begin(c: ConnectorConfig, model: string) {
    const thread = await createChatThread({});
    return beginAgentRun({threadId: thread.id, connector: c, model, content: "hi"});
}

afterEach(() => resetModelCatalogForTests());

describe("catalog startup", () => {
    it("is not awaited by the caller and never rejects, even when storage is unreadable", async () => {
        const pending = initModelCatalog();
        expect(getModelCatalog()).toBeUndefined();
        db.close();
        await expect(pending).resolves.toBeUndefined();
        await expect(initModelCatalog()).resolves.toBeUndefined();
    });
});

describe("synchronous consumers inside a database transaction", () => {
    beforeAll(() => initModelCatalog());

    it("reads limits and vision from memory in an observe callback without PrematureCommitError", async () => {
        await initModelCatalog();
        const result = await new Promise<unknown>((resolve, reject) => {
            const stop = db.observe(async tx => {
                await tx.chatThreads.toArray();
                return {
                    limits: resolveModelMetadata("gpt-5", undefined, "openai-compatible"),
                    vision: await resolveVisionCapability("gpt-5", "openai-compatible"),
                };
            }, {next: v => { stop(); resolve(v); }, error: e => { stop(); reject(e); }});
        });
        expect(result).toMatchObject({
            limits: {contextWindow: {tokens: 400000, source: "models-dev"}},
            vision: {supported: true, source: "models-dev"},
        });
    });

    it("labels new capacity provenance as the model catalog", async () => {
        await initModelCatalog();
        expect(resolveContextCapacity("gpt-5", undefined, "openai-compatible").capacitySource).toBe("模型目录");
    });
});

describe("run price snapshot", () => {
    it("freezes the connector provider's own price and awaits the catalog itself", async () => {
        // No explicit init: beginAgentRun must make the catalog ready before the transaction.
        const entry = (await import("@/lib/ai/modelCatalog/baseline.generated.json")).default.entries
            .find(e => e.provider === "deepseek" && e.cost?.input !== undefined && e.cost?.output !== undefined)!;
        const run = await begin(connector("deepseek", "https://api.deepseek.com/v1"), entry.id);
        expect(run.modelPricing).toMatchObject({
            source: "baseline", provider: "deepseek", modelId: entry.id, reference: false,
            currency: "USD", unit: "per_million_tokens", input: entry.cost!.input, output: entry.cost!.output,
        });
        expect(Date.parse(run.modelPricing!.capturedAt)).not.toBeNaN();
        expect((await db.agentRuns.get(run.id))?.modelPricing).toEqual(run.modelPricing);
    });

    it("keeps reference: true for an original-vendor price through a gateway connector", async () => {
        const entry = (await import("@/lib/ai/modelCatalog/baseline.generated.json")).default.entries
            .find(e => e.provider === "anthropic" && e.cost?.input !== undefined)!;
        const run = await begin(connector("apimart", "https://api.apimart.ai/v1"), entry.id);
        expect(run.modelPricing).toMatchObject({provider: "anthropic", reference: true, input: entry.cost!.input});
    });

    it("writes no modelPricing field, and never zeros, when the price is unknown", async () => {
        const run = await begin(connector("deepseek", "https://api.deepseek.com/v1"), "unlisted-custom-model");
        expect("modelPricing" in run).toBe(false);
        expect("modelPricing" in (await db.agentRuns.get(run.id))!).toBe(false);
    });
});

describe("older run records", () => {
    it("reads without modelPricing and with the legacy vision source", async () => {
        const run = await begin(connector("deepseek", "https://api.deepseek.com/v1"), "unlisted-custom-model");
        await db.agentRuns.update(run.id, {visionCapability: {supported: true, source: "model-bank", sourceUrl: "https://example.test/old"}});
        const stored = (await db.agentRuns.get(run.id)) as AgentRun;
        expect(stored.modelPricing).toBeUndefined();
        expect(() => requireVision(stored.visionCapability)).not.toThrow();
        expect(estimateRunCost(stored.usage, stored.modelPricing)).toEqual({complete: false});
    });
});
