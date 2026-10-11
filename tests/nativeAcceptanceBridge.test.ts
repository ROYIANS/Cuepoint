import {afterEach, describe, expect, it, vi} from "vitest";
import {native} from "../desktop/tauri/ui/bridge";

afterEach(() => {
    vi.unstubAllGlobals();
    native.generation = 0;
    native.active.clear();
});

describe("acceptance bridge shared result contract", () => {
    it("accepts the same closed conflict shape as the product adapter", async () => {
        const conflict = {
            resource: "shot", id: "shot-1",
            fields: [{field: "content", current: "current", expected: "old", requested: "next"}],
        };
        const invoke = vi.fn().mockResolvedValue({
            version: 1, generation: 1,
            result: {type: "outcome", value: {kind: "conflict", value: conflict}},
        });
        vi.stubGlobal("window", {__TAURI_INTERNALS__: {invoke}});
        await expect(native.request({type: "patchShot", shotId: "shot-1", patch: {content: "next"}}))
            .resolves.toEqual({type: "outcome", value: {kind: "conflict", value: conflict}});
        expect(native.generation).toBe(1);
        expect(native.active.size).toBe(0);
    });

    it("does not advance generation for an invalid shared result", async () => {
        const invoke = vi.fn().mockResolvedValue({
            version: 1, generation: 99,
            result: {type: "outcome", value: {kind: "conflict", value: {resource: "shot", id: "s", fields: [], extra: "invalid"}}},
        });
        vi.stubGlobal("window", {__TAURI_INTERNALS__: {invoke}});
        await expect(native.request({type: "patchShot", shotId: "s", patch: {notes: "next"}})).rejects.toThrow();
        expect(native.generation).toBe(0);
        expect(native.active.size).toBe(0);
    });
});
