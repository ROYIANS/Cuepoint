// @vitest-environment jsdom
import {act, createElement as h} from "react";
import {createRoot, type Root} from "react-dom/client";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {ModelSelectTrigger} from "@/features/agent/ui/ModelSelectTrigger";
import type {ChatModelPolicy} from "@/features/settings/models/chatModelPolicy";
import type {ConnectorConfig} from "@/features/settings/models/connector";
import {applySyncedSnapshot, resetModelCatalogForTests} from "@/features/settings/modelCatalog/store";

// The lazy brand-icon bundle needs a JSON import attribute jsdom cannot provide; icons are irrelevant here.
vi.mock("@/features/agent/ui/ModelIcons", () => ({ModelIcon: () => null, ProviderIcon: () => null}));

(globalThis as {IS_REACT_ACT_ENVIRONMENT?: boolean}).IS_REACT_ACT_ENVIRONMENT = true;

const connector: ConnectorConfig = {id: "c1", definitionId: "deepseek", protocol: "openai-compatible", baseUrl: "https://api.deepseek.com/v1", apiKey: "k", updatedAt: ""};
const policy = {verified: true, incompatibleModels: []} as unknown as ChatModelPolicy;
let root: Root, container: HTMLDivElement;

beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    applySyncedSnapshot({
        source: "synced", syncedAt: "2026-10-01T00:00:00.000Z", providerOrigins: {deepseek: "https://api.deepseek.com"},
        entries: [
            {provider: "deepseek", id: "deepseek-chat", name: "DeepSeek Chat", cost: {input: 0.27, output: 1.1}},
            {provider: "openai", id: "gpt-4o", name: "GPT-4o", cost: {input: 2.5, output: 10, cacheRead: 1.25}},
            {provider: "deepseek", id: "no-price", name: "No price"},
        ],
    });
});
afterEach(() => {
    act(() => root.unmount());
    container.remove();
    resetModelCatalogForTests();
    document.body.innerHTML = "";
});

async function detailFor(model: string): Promise<string> {
    await act(async () => {
        root.render(h(ModelSelectTrigger, {
            model, modelOptions: [{label: model, value: model}], probingModels: false, modelPolicy: policy,
            connectors: [connector], selectedConnectorId: "c1", onConnectorChange: () => undefined, onModelChange: () => undefined,
            open: true, onOpenChange: () => undefined,
        }));
    });
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
    return document.body.querySelector('[data-testid="model-price"]')?.parentElement?.textContent ?? "";
}

describe("ModelDetail price row", () => {
    it("shows the connector's own provider price with its source", async () => {
        const text = await detailFor("deepseek-chat");
        expect(text).toContain("价格 · USD / 每百万 tokens");
        expect(text).toContain("输入 $0.27 · 输出 $1.1 · 缓存命中 — · 缓存创建 —");
        expect(text).toContain("来源：deepseek/deepseek-chat");
        expect(text).not.toContain("官方参考价");
    });
    it("labels an original-vendor price as an official reference", async () => {
        const text = await detailFor("gpt-4o");
        expect(text).toContain("官方参考价");
        expect(text).toContain("缓存命中 $1.25");
        expect(text).toContain("来源：openai/gpt-4o");
    });
    it("shows 价格未知 rather than 0 for an unpriced or unknown model", async () => {
        for (const model of ["no-price", "not-in-catalog"]) {
            const text = await detailFor(model);
            expect(text).toContain("价格未知");
            expect(text).not.toContain("$0");
        }
    });
});
