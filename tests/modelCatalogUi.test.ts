// @vitest-environment jsdom
import {act, createElement as h} from "react";
import {createRoot, type Root} from "react-dom/client";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {ModelCatalogPicker} from "@/components/connectors/ModelCatalogPicker";
import {ModelCatalogSection} from "@/components/connectors/ModelCatalogSection";
import {ModelPriceTable} from "@/components/connectors/ModelPriceTable";
import {resetReportedErrorsForTests} from "@/lib/diagnostics/reportError";
import {applySyncedSnapshot, getModelCatalog, initModelCatalog, resetModelCatalogForTests} from "@/lib/ai/modelCatalog/store";
import {getCatalogSelection, putCatalogSelection} from "@/lib/ai/modelCatalog/sync";
import {db} from "@/db/database";
import {MODEL_CATALOG_KEY} from "@/lib/ai/modelCatalog/store";
import type {CatalogEntry} from "@/lib/ai/modelCatalog/types";

vi.mock("sonner", () => ({toast: {error: vi.fn(), success: vi.fn()}}));
const {toast} = await import("sonner");
(globalThis as {IS_REACT_ACT_ENVIRONMENT?: boolean}).IS_REACT_ACT_ENVIRONMENT = true;

const entries: CatalogEntry[] = [
    {provider: "openai", id: "gpt-4o", name: "GPT-4o", canonicalId: "openai/gpt-4o", releaseDate: "2024-05-13", cost: {input: 2.5, output: 10, cacheRead: 1.25}},
    {provider: "aihubmix", id: "gpt-4o", name: "GPT-4o", canonicalId: "openai/gpt-4o", releaseDate: "2024-05-13", cost: {input: 3, output: 11}},
    {provider: "anthropic", id: "claude-new", name: "Claude New", releaseDate: "2026-01-01", cost: {input: 0, output: 5}},
    {provider: "deepseek", id: "deepseek-chat", name: "DeepSeek Chat", releaseDate: "2025-03-01"},
];
const snapshot = (source: "baseline" | "synced" = "baseline") => ({
    source, ...(source === "baseline" ? {packageVersion: "0.0.9"} : {syncedAt: "2026-10-01T08:00:00.000Z"}), providerOrigins: {}, entries,
});

let root: Root, container: HTMLDivElement;
const flush = () => act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
async function until(condition: () => boolean) {
    for (let attempt = 0; attempt < 50 && !condition(); attempt++) await flush();
}
const body = () => document.body.textContent ?? "";
const button = (label: string | RegExp) => [...document.body.querySelectorAll<HTMLElement>("button")]
    .find(b => typeof label === "string" ? b.textContent?.trim() === label : label.test(b.textContent ?? ""))!;
const click = (element: Element | undefined) => act(async () => { (element as HTMLElement).click(); });
const lists = (label: string) => document.body.querySelector(`[role=list][aria-label="${label}"]`);
const items = (label: string) => [...lists(label)?.querySelectorAll("[role=listitem]") ?? []];
const checkboxes = () => [...document.body.querySelectorAll<HTMLElement>("[role=checkbox]")];
function type(input: HTMLInputElement | HTMLSelectElement, value: string) {
    const proto = input instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    return act(async () => {
        Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(input, value);
        input.dispatchEvent(new Event(input instanceof HTMLSelectElement ? "change" : "input", {bubbles: true}));
    });
}

const apiModel = (id: string, name = id, extra: Record<string, unknown> = {}) => ({id, name, release_date: "2026-02-01", modalities: {input: ["text"], output: ["text"]}, ...extra});
const apiFixture = () => ({
    openai: {id: "openai", name: "OpenAI", models: {"gpt-4o": apiModel("gpt-4o", "GPT-4o", {canonical_model_id: "openai/gpt-4o", cost: {input: 2.5, output: 10}})}},
    groq: {id: "groq", name: "Groq", models: {"llama-x": apiModel("llama-x", "Llama X"), "llama-y": apiModel("llama-y", "Llama Y")}},
});
const jsonResponse = (body: unknown, init: ResponseInit = {}) => new Response(JSON.stringify(body), {status: 200, headers: {"content-type": "application/json"}, ...init});

let fetchSpy: ReturnType<typeof vi.spyOn>;
beforeEach(async () => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    resetReportedErrorsForTests();
    fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async () => { throw new Error("unexpected network"); });
    applySyncedSnapshot(snapshot());
});
afterEach(async () => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
    resetModelCatalogForTests();
    document.body.innerHTML = "";
});

async function openPicker(onClose = vi.fn()) {
    await act(async () => { root.render(h(ModelCatalogPicker, {entries: getModelCatalog()!.entries, onClose})); });
    await flush();
    return onClose;
}

describe("ModelCatalogPicker", () => {
    it("lists rows merged by normalized id with four prices, unknown as a dash", async () => {
        await openPicker();
        const rows = items("可选模型");
        expect(rows).toHaveLength(3);
        const gpt = rows.find(r => r.textContent?.includes("GPT-4o"))!;
        expect(gpt.textContent).toContain("openai/gpt-4o".split("/")[1]);
        expect(gpt.querySelector('[aria-label="输入价格 $2.5"]')).not.toBeNull();
        expect(gpt.querySelector('[aria-label="缓存创建价格 —"]')).not.toBeNull();
        const deepseek = rows.find(r => r.textContent?.includes("DeepSeek Chat"))!;
        expect(deepseek.querySelectorAll('[aria-label$="价格 —"]')).toHaveLength(4);
        // A known zero stays "$0": only a missing price is a dash.
        expect(rows.find(r => r.textContent?.includes("Claude New"))!.querySelector('[aria-label="输入价格 $0"]')).not.toBeNull();
        expect(body()).toContain("已选 0 个模型");
        expect(body()).toContain("归一化 ID 相同的选项只会导入一次");
        expect(items("可选模型")[0].getAttribute("aria-setsize")).toBe("3");
    });

    it("filters by search and by provider; select-all and clear only affect the filtered rows", async () => {
        await openPicker();
        await type(document.body.querySelector<HTMLInputElement>('input[aria-label="搜索名称或 ID"]')!, "claude");
        expect(items("可选模型")).toHaveLength(1);
        expect(body()).toContain("全选筛选结果（1）");
        await click(button(/全选筛选结果/));
        expect(body()).toContain("已选 1 个模型");
        await type(document.body.querySelector<HTMLInputElement>('input[aria-label="搜索名称或 ID"]')!, "");
        await type(document.body.querySelector<HTMLSelectElement>('select[aria-label="供应商"]')!, "deepseek");
        expect(items("可选模型")).toHaveLength(1);
        await click(button(/全选筛选结果/));
        expect(body()).toContain("已选 2 个模型");
        await click(button("清空筛选结果"));
        // Only the deepseek row was cleared; the claude pick survives.
        expect(body()).toContain("已选 1 个模型");
        await type(document.body.querySelector<HTMLSelectElement>('select[aria-label="供应商"]')!, "aihubmix");
        expect(items("可选模型")).toHaveLength(1);
    });

    it("ticking a merged row selects every equivalent entry and saving persists them", async () => {
        const onClose = await openPicker();
        await click(checkboxes().find(c => c.getAttribute("aria-label") === "GPT-4o"));
        expect(body()).toContain("已选 1 个模型");
        await click(button("保存"));
        await flush();
        expect((await getCatalogSelection()).modelKeys.sort()).toEqual(["aihubmix/gpt-4o", "openai/gpt-4o"]);
        expect(toast.success).toHaveBeenCalled();
        expect(onClose).toHaveBeenCalledOnce();
    });

    it("cancel saves nothing, and an existing selection is shown", async () => {
        await putCatalogSelection({autoIncludeCommon: false, modelKeys: ["anthropic/claude-new"]});
        const onClose = await openPicker();
        expect(body()).toContain("已选 1 个模型");
        await click(checkboxes().find(c => c.getAttribute("aria-label") === "DeepSeek Chat"));
        await click(button("取消"));
        expect(onClose).toHaveBeenCalledOnce();
        expect(await getCatalogSelection()).toEqual({autoIncludeCommon: false, modelKeys: ["anthropic/claude-new"]});
    });

    it("loads the full list on demand without persisting or replacing the catalog", async () => {
        const before = getModelCatalog();
        await openPicker();
        expect(body()).toContain("点击「加载完整清单」");
        fetchSpy.mockImplementation(async () => jsonResponse(apiFixture()));
        await click(button("加载完整清单"));
        await until(() => body().includes("已加载完整清单"));
        expect(fetchSpy).toHaveBeenCalledOnce();
        expect(String(fetchSpy.mock.calls[0][0])).toBe("https://models.dev/api.json");
        expect(items("可选模型").map(r => r.textContent).join("|")).toContain("Llama X");
        expect(items("可选模型")).toHaveLength(3);
        expect(body()).toContain("已加载完整清单");
        expect(getModelCatalog()).toBe(before);
        expect(await db.deviceSettings.get(MODEL_CATALOG_KEY)).toBeUndefined();
    });

    it("reports a full-list failure through the unified error exit, without the URL", async () => {
        await openPicker();
        fetchSpy.mockImplementation(async () => new Response("x", {status: 503}));
        await click(button("加载完整清单"));
        await until(() => vi.mocked(toast.error).mock.calls.length > 0);
        expect(toast.error).toHaveBeenCalledOnce();
        const [title, options] = vi.mocked(toast.error).mock.calls[0] as [string, {action: {label: string}; description?: string}];
        expect(options.action.label).toBe("查看详情");
        expect(title + (options.description ?? "")).not.toMatch(/models\.dev\/api/);
        expect(items("可选模型")).toHaveLength(3);
    });

    it("cancels a stalled full-list load quietly", async () => {
        await openPicker();
        fetchSpy.mockImplementation((_input, init) => new Promise<Response>((_, reject) => {
            init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
        }));
        await click(button("加载完整清单"));
        expect(button("取消加载")).toBeTruthy();
        await click(button("取消加载"));
        await flush();
        expect(toast.error).not.toHaveBeenCalled();
        expect(button("加载完整清单")).toBeTruthy();
    });

    it("rows are keyboard-reachable native checkbox buttons", async () => {
        await openPicker();
        expect(checkboxes().length).toBeGreaterThanOrEqual(3);
        expect(checkboxes().every(c => c.tagName === "BUTTON")).toBe(true);
    });
});

describe("ModelPriceTable", () => {
    it("shows raw entry prices, unknown as a dash, and filters", async () => {
        await act(async () => { root.render(h(ModelPriceTable, {entries})); });
        expect(items("模型定价")).toHaveLength(4);
        expect(body()).toContain("USD / 每百万 Tokens");
        const ds = items("模型定价").find(r => r.textContent?.includes("deepseek-chat"))!;
        expect(ds.querySelectorAll('[aria-label$="价格 —"]')).toHaveLength(4);
        await type(document.body.querySelector<HTMLInputElement>('input[aria-label="搜索定价表"]')!, "gpt");
        expect(items("模型定价")).toHaveLength(2);
        await type(document.body.querySelector<HTMLSelectElement>('select[aria-label="按供应商筛选定价"]')!, "aihubmix");
        expect(items("模型定价")).toHaveLength(1);
        expect(items("模型定价")[0].querySelector('[aria-label="输入价格 $3"]')).not.toBeNull();
    });

    it("windows a large catalog instead of mounting every row, and follows scroll", async () => {
        const many = Array.from({length: 8800}, (_, i): CatalogEntry => ({provider: "p", id: `m-${String(i).padStart(4, "0")}`, name: `Model ${i}`}));
        await act(async () => { root.render(h(ModelPriceTable, {entries: many})); });
        expect(items("模型定价").length).toBeLessThan(30);
        expect(items("模型定价")[0].getAttribute("aria-posinset")).toBe("1");
        const scroller = lists("模型定价")!.parentElement!;
        await act(async () => { scroller.scrollTop = 48 * 5000; scroller.dispatchEvent(new Event("scroll", {bubbles: true})); });
        const positions = items("模型定价").map(r => Number(r.getAttribute("aria-posinset")));
        expect(positions[0]).toBeLessThanOrEqual(5001);
        expect(positions.at(-1)!).toBeGreaterThan(5001);
        expect(items("模型定价").length).toBeLessThan(30);
    });
});

describe("ModelCatalogSection", () => {
    const render = async () => { await act(async () => { root.render(h(ModelCatalogSection)); }); await flush(); };

    it("shows the source, version, count and the no-local-data notice", async () => {
        await render();
        expect(body()).toContain("内置基线 · 包版本 0.0.9");
        expect(body()).toContain("当前目录共 4 个模型");
        expect(body()).toContain("不会发送任何本机数据");
        expect(body()).not.toContain("打开目录");
        await act(async () => { applySyncedSnapshot(snapshot("synced")); });
        expect(body()).toContain("已同步 ·");
    });

    it("syncs on click, reports success and shows the new catalog", async () => {
        await render();
        fetchSpy.mockImplementation(async () => jsonResponse({
            deepseek: {id: "deepseek", name: "DeepSeek", models: {"deepseek-chat": apiModel("deepseek-chat", "DeepSeek Chat")}},
            aihubmix: {id: "aihubmix", name: "A", models: {"m1": apiModel("m1")}},
            xiaomi: {id: "xiaomi", name: "X", models: {"mimo": apiModel("mimo")}},
            openai: {id: "openai", name: "OpenAI", models: {"gpt-4o": apiModel("gpt-4o")}},
        }));
        await click(button("立即同步"));
        await until(() => !!document.body.textContent?.includes("上次同步"));
        expect(fetchSpy).toHaveBeenCalledOnce();
        expect(toast.success).toHaveBeenCalledWith(expect.stringContaining("已同步 4 个模型"));
        expect(body()).toContain("上次同步：成功");
        expect(getModelCatalog()?.source).toBe("synced");
        expect(button("立即同步")).toBeTruthy();
    });

    it("turns the button into cancel while syncing and aborts without an error toast", async () => {
        await render();
        fetchSpy.mockImplementation((_input, init) => new Promise<Response>((_, reject) => {
            init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
        }));
        await click(button("立即同步"));
        expect(button("取消")).toBeTruthy();
        await click(button("取消"));
        await flush();
        expect(toast.error).not.toHaveBeenCalled();
        expect(toast.success).not.toHaveBeenCalled();
        expect(body()).toContain("已取消同步");
        expect(getModelCatalog()?.source).toBe("baseline");
        expect(button("立即同步")).toBeTruthy();
    });

    it("reports failure through showError with a details action and no URL", async () => {
        await render();
        fetchSpy.mockImplementation(async () => new Response("x", {status: 503}));
        await click(button("立即同步"));
        await until(() => vi.mocked(toast.error).mock.calls.length > 0);
        expect(toast.error).toHaveBeenCalledOnce();
        const [title, options] = vi.mocked(toast.error).mock.calls[0] as [string, {action: {label: string}; description?: string}];
        expect(title).toBe("同步模型目录失败");
        expect(options.action.label).toBe("查看详情");
        expect(options.description).toContain("HTTP 503");
        expect(`${title}${options.description}`).not.toMatch(/https?:|models\.dev\/api/);
        expect(getModelCatalog()?.source).toBe("baseline");
    });

    it("restores the built-in data only after confirmation", async () => {
        await initModelCatalog();
        await act(async () => { applySyncedSnapshot(snapshot("synced")); });
        await db.deviceSettings.put({key: MODEL_CATALOG_KEY, value: {v: 1}, updatedAt: new Date().toISOString()});
        await render();
        const trigger = document.body.querySelector<HTMLElement>('button[aria-label="更多操作"]')!;
        await act(async () => { trigger.focus(); trigger.dispatchEvent(new KeyboardEvent("keydown", {key: "Enter", bubbles: true})); });
        await click([...document.body.querySelectorAll<HTMLElement>('[role=menuitem]')].find(i => i.textContent === "恢复为内置数据"));
        expect(body()).toContain("恢复为内置数据？");
        expect(await db.deviceSettings.get(MODEL_CATALOG_KEY)).toBeDefined();
        await click(button("取消"));
        expect(getModelCatalog()?.source).toBe("synced");
        expect(await db.deviceSettings.get(MODEL_CATALOG_KEY)).toBeDefined();

        await act(async () => { trigger.focus(); trigger.dispatchEvent(new KeyboardEvent("keydown", {key: "Enter", bubbles: true})); });
        await click([...document.body.querySelectorAll<HTMLElement>('[role=menuitem]')].find(i => i.textContent === "恢复为内置数据"));
        await click(button("恢复"));
        await until(() => vi.mocked(toast.success).mock.calls.length > 0);
        expect(await db.deviceSettings.get(MODEL_CATALOG_KEY)).toBeUndefined();
        expect(getModelCatalog()?.source).toBe("baseline");
        expect(toast.success).toHaveBeenCalledWith("已恢复为内置数据");
    });

    it("opens the picker from the card", async () => {
        await render();
        await click(button("选择模型"));
        await flush();
        expect(body()).toContain("自动包含常用模型");
        await click(button("取消"));
        expect(document.body.querySelector("[role=dialog]")).toBeNull();
    });
});
