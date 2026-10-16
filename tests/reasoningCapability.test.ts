// @vitest-environment jsdom
import {act, createElement as h} from "react";
import {createRoot, type Root} from "react-dom/client";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {ModelSelectTrigger} from "@/features/agent/ui/ModelSelectTrigger";
import type {ChatModelPolicy} from "@/features/settings/models/chatModelPolicy";
import type {ConnectorConfig} from "@/features/settings/models/connector";
import {applySyncedSnapshot, resetModelCatalogForTests} from "@/features/settings/modelCatalog/store";
import {assertReasoningEffort, reasoningCapability} from "@/features/settings/models/reasoningPolicy";
import {streamChatCompletions} from "@/features/agent/providers/chatStream";
import type {AgentReasoningEffort} from "@/features/agent/models/agent";

vi.mock("@/features/agent/ui/ModelIcons", () => ({ModelIcon: () => null, ProviderIcon: () => null}));
(globalThis as {IS_REACT_ACT_ENVIRONMENT?: boolean}).IS_REACT_ACT_ENVIRONMENT = true;

const compat: ConnectorConfig = {id: "c1", name: "t", definitionId: "openai-compatible", baseUrl: "https://example.test/v1", apiKey: "k", updatedAt: ""};
const policy = {verified: true, incompatibleModels: []} as unknown as ChatModelPolicy;
let root: Root, container: HTMLDivElement;

beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    applySyncedSnapshot({
        source: "synced", syncedAt: "2026-10-01T00:00:00.000Z", providerOrigins: {},
        entries: [
            {provider: "openai", id: "thinker-x", name: "Thinker", reasoning: true},
            {provider: "openai", id: "plain-x", name: "Plain", reasoning: false},
        ],
    } as never);
});
afterEach(() => {
    act(() => root.unmount());
    container.remove();
    resetModelCatalogForTests();
    document.body.innerHTML = "";
});

describe("reasoningCapability sources and precedence", () => {
    it("derives default low/medium/high from models.dev reasoning:true", () => {
        expect(reasoningCapability(compat, "thinker-x")).toMatchObject({levels: ["low", "medium", "high"], source: "models.dev"});
        expect(reasoningCapability(compat, "plain-x")).toBeUndefined();
        expect(reasoningCapability(compat, "unknown-model")).toBeUndefined();
    });
    it("built-in table refines the models.dev default for known models", () => {
        expect(reasoningCapability(compat, "gpt-5")?.levels).toEqual(["minimal", "low", "medium", "high"]);
    });
    it("provider /models facts beat models.dev and the table", () => {
        expect(reasoningCapability(compat, "gpt-5", {provider: {levels: ["low", "high"]}})?.levels).toEqual(["low", "high"]);
        expect(reasoningCapability(compat, "unknown-model", {provider: {reasoning: true}})?.levels).toEqual(["low", "medium", "high"]);
        expect(reasoningCapability(compat, "thinker-x", {provider: {reasoning: false}})).toBeUndefined();
    });
    it("user override beats every other source and can disable", () => {
        expect(reasoningCapability(compat, "gpt-5", {override: ["medium"], provider: {levels: ["low"]}})).toMatchObject({levels: ["medium"], source: "user"});
        expect(reasoningCapability(compat, "thinker-x", {override: false})).toBeUndefined();
    });
    it("clips to adapter levels: aihubmix drops max, deepseek/apimart expose nothing", () => {
        expect(reasoningCapability({...compat, definitionId: "aihubmix"}, "x", {override: ["high", "max"]})?.levels).toEqual(["high"]);
        for (const definitionId of ["deepseek", "apimart"] as const) {
            expect(reasoningCapability({...compat, definitionId}, "thinker-x")).toBeUndefined();
            expect(() => assertReasoningEffort({...compat, definitionId}, "thinker-x", "high")).toThrow("不支持");
        }
    });
    it("requests carry the models.dev-derived effort and reject unsupported levels before the network", async () => {
        const bodies: Array<Record<string, unknown>> = [];
        const fetchImpl = vi.fn(async (_url: unknown, init?: RequestInit) => {
            bodies.push(JSON.parse(String(init?.body)));
            return Response.json({choices: [{message: {content: "ok"}, finish_reason: "stop"}]});
        });
        const base = {baseUrl: compat.baseUrl, apiKey: "k", connectorDefinitionId: compat.definitionId, model: "thinker-x", messages: [{role: "user" as const, content: "hi"}]};
        expect((await streamChatCompletions({...base, reasoningEffort: "medium"}, {fetchImpl})).ok).toBe(true);
        expect(bodies[0]?.reasoning_effort).toBe("medium");
        expect((await streamChatCompletions({...base, reasoningEffort: "xhigh"}, {fetchImpl})).ok).toBe(false);
        expect(fetchImpl).toHaveBeenCalledTimes(1);
    });
});

async function mount(model: string, effort: AgentReasoningEffort | undefined, onEffort = vi.fn(), onModel = vi.fn(), connector = compat) {
    await act(async () => {
        root.render(h(ModelSelectTrigger, {
            model, modelOptions: [{label: "thinker-x", value: "thinker-x"}, {label: "plain-x", value: "plain-x"}],
            probingModels: false, modelPolicy: policy, connectors: [connector], selectedConnectorId: connector.id,
            onConnectorChange: () => undefined, onModelChange: onModel, reasoningEffort: effort, onReasoningEffortChange: onEffort,
            open: true, onOpenChange: () => undefined,
        }));
    });
    return {onEffort, onModel};
}

describe("model + effort popover", () => {
    it("shows the effort control for a reasoning model and reports changes", async () => {
        const {onEffort} = await mount("thinker-x", "low");
        const control = document.body.querySelector('[data-testid="reasoning-effort"]');
        expect(control).not.toBeNull();
        expect(control?.querySelector("strong")?.textContent).toBe("低");
        const high = [...control!.querySelectorAll<HTMLButtonElement>('[role="radio"]')].find(b => b.textContent === "高")!;
        await act(async () => { high.click(); });
        expect(onEffort).toHaveBeenCalledWith("high");
        const chip = document.body.querySelector(".agent-model-chip");
        expect(chip?.textContent).toContain("低");
    });
    it("keeps segmented buttons when more than four levels exist", async () => {
        await mount("gpt-5.6-luna", "high");
        const control = document.body.querySelector('[data-testid="reasoning-effort"]');
        expect(document.body.querySelector('input[type="range"]')).toBeNull();
        expect([...control!.querySelectorAll('[role="radio"]')].map(item => item.textContent)).toContain("高");
    });
    it("marks the selected model separately from the previewed one and has no effort control for non-reasoning models", async () => {
        const {onModel} = await mount("plain-x", undefined);
        expect(document.body.querySelector('[data-testid="reasoning-effort"]')).toBeNull();
        const rows = [...document.body.querySelectorAll<HTMLButtonElement>(".agent-model-row")];
        const thinker = rows.find(r => r.title === "thinker-x")!;
        await act(async () => { thinker.focus(); });
        expect(rows.find(r => r.title === "plain-x")?.className).toContain("is-selected");
        expect(thinker.className).toContain("is-previewed");
        expect(thinker.className).not.toContain("is-selected");
        await act(async () => { thinker.click(); });
        expect(onModel).toHaveBeenCalledWith("thinker-x");
    });
    it("hides the control on connectors whose adapter cannot send effort", async () => {
        await mount("thinker-x", "high", vi.fn(), vi.fn(), {...compat, definitionId: "deepseek"});
        expect(document.body.querySelector('[data-testid="reasoning-effort"]')).toBeNull();
        expect(document.body.querySelector(".agent-model-chip")?.textContent).not.toContain("高");
    });
});
