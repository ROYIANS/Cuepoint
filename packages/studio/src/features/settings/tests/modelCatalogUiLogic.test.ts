import {describe, expect, it} from "vitest";
import {commonScopeCount, filterRows, rowSelected, selectedCount, setRows, toggleRow} from "@/features/settings/ui/catalogRows";
import {computeWindow} from "@/features/settings/ui/virtualWindow";
import {formatPrice} from "@/features/settings/modelCatalog/format";
import {MAX_SELECTION_KEYS, type CatalogRow} from "@/features/settings/modelCatalog/sync";

describe("computeWindow", () => {
    const base = {rowHeight: 50, viewportHeight: 200, overscan: 2};
    it("renders the first rows plus a buffer at the top and reports the full height", () => {
        expect(computeWindow({...base, count: 1000, scrollTop: 0})).toEqual({start: 0, end: 6, totalHeight: 50_000, offsetTop: 0});
    });
    it("moves the window and its offset with the scroll position", () => {
        // rows 10..13 visible (500..700), buffer 2 each side.
        expect(computeWindow({...base, count: 1000, scrollTop: 500})).toEqual({start: 8, end: 16, totalHeight: 50_000, offsetTop: 400});
        // Partial rows count as visible.
        expect(computeWindow({...base, count: 1000, scrollTop: 525})).toMatchObject({start: 8, end: 17});
    });
    it("clamps at the bottom and for out-of-range scroll values", () => {
        const bottom = computeWindow({...base, count: 100, scrollTop: 1e9});
        expect(bottom).toMatchObject({start: 94, end: 100, totalHeight: 5000});
        expect(computeWindow({...base, count: 100, scrollTop: -40})).toMatchObject({start: 0});
    });
    it("handles empty and shorter-than-viewport lists", () => {
        expect(computeWindow({...base, count: 0, scrollTop: 0})).toEqual({start: 0, end: 0, totalHeight: 0, offsetTop: 0});
        expect(computeWindow({...base, count: 3, scrollTop: 100})).toEqual({start: 0, end: 3, totalHeight: 150, offsetTop: 0});
    });
    it("never renders more than the viewport plus buffers for a huge list", () => {
        const window = computeWindow({...base, count: 8800, scrollTop: 123_457});
        expect(window.end - window.start).toBeLessThanOrEqual(4 + 1 + 4 + 1);
    });
});

const row = (id: string, provider: string, keys: string[] = [`${provider}/${id}`]): CatalogRow => ({
    provider, providerName: provider, id, name: id.toUpperCase(), providers: [...new Set(keys.map(key => key.split("/")[0]))], modelKeys: keys,
});

describe("catalog row helpers", () => {
    const rows = [row("gpt-4o", "openai", ["aihubmix/gpt-4o", "openai/gpt-4o"]), row("claude", "anthropic"), row("deepseek-chat", "deepseek")];
    it("filters by provider (any merged provider) and by name or id", () => {
        expect(filterRows(rows, {provider: "aihubmix", search: ""}).map(r => r.id)).toEqual(["gpt-4o"]);
        expect(filterRows(rows, {provider: "", search: " CLAU "}).map(r => r.id)).toEqual(["claude"]);
        expect(filterRows(rows, {provider: "", search: "aihubmix/gpt"}).map(r => r.id)).toEqual(["gpt-4o"]);
        expect(filterRows(rows, {provider: "deepseek", search: "claude"})).toEqual([]);
    });
    it("toggling a merged row (un)selects every equivalent key", () => {
        const on = toggleRow(rows[0], new Set(), true)!;
        expect([...on].sort()).toEqual(["aihubmix/gpt-4o", "openai/gpt-4o"]);
        expect(rowSelected(rows[0], new Set(["openai/gpt-4o"]))).toBe(true);
        expect(toggleRow(rows[0], on, false)!.size).toBe(0);
    });
    it("bulk select/clear only touches the given rows", () => {
        const start = new Set(["deepseek/deepseek-chat"]);
        const all = setRows([rows[1]], start, true)!;
        expect([...all].sort()).toEqual(["anthropic/claude", "deepseek/deepseek-chat"]);
        expect([...setRows([rows[1]], all, false)!]).toEqual(["deepseek/deepseek-chat"]);
    });
    it("refuses a selection beyond the stored limit", () => {
        const many = Array.from({length: MAX_SELECTION_KEYS}, (_, i) => `p/m${i}`);
        expect(setRows([row("extra", "p")], new Set(many), true)).toBeUndefined();
        expect(setRows([row("m0", "p")], new Set(many), true)?.size).toBe(MAX_SELECTION_KEYS);
    });
    it("counts equivalent keys once and still counts keys without a row", () => {
        expect(selectedCount(rows, new Set(["aihubmix/gpt-4o", "openai/gpt-4o", "other/unlisted"]))).toBe(2);
    });
    it("counts common-scope entries and formats prices without inventing zero", () => {
        expect(commonScopeCount([{provider: "openai", id: "a", name: "a"}, {provider: "groq", id: "b", name: "b"}], ["openai"])).toBe(1);
        expect(formatPrice(undefined)).toBe("—");
        expect(formatPrice(0)).toBe("$0");
        expect(formatPrice(2.5)).toBe("$2.5");
        expect(formatPrice(0.30000001)).toBe("$0.3");
    });
});
