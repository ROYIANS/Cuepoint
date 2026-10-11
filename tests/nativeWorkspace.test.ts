import {afterEach, describe, expect, it, vi} from "vitest";
import {createNativeWorkspaceAdapter, isNativeWorkspaceRuntime} from "@/lib/nativeWorkspace";

const state = {
    schema: 1 as const,
    workspaceId: "workspace-1",
    projects: [],
    assets: [],
    references: [],
    sqliteVersion: "3.45",
};

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("native workspace renderer boundary", () => {
    it("keeps browser mode separate from the Tauri runtime", () => {
        expect(isNativeWorkspaceRuntime()).toBe(false);
        vi.stubGlobal("window", {__TAURI_INTERNALS__: {invoke: vi.fn()}});
        expect(isNativeWorkspaceRuntime()).toBe(true);
    });

    it("uses closed typed results and carries the generation through product calls", async () => {
        const invoke = vi.fn()
            .mockResolvedValueOnce({generation: 1, result: {type: "outcome", value: {kind: "state", value: state}}})
            .mockResolvedValueOnce({generation: 1, result: {type: "outcome", value: {kind: "project", value: {id: "project-1", title: "新项目"}}}})
            .mockResolvedValueOnce({generation: 1, result: {type: "outcome", value: {kind: "availability", value: []}}});
        vi.stubGlobal("window", {__TAURI_INTERNALS__: {invoke}});
        const adapter = createNativeWorkspaceAdapter();

        await expect(adapter.ensure()).resolves.toEqual(state);
        await expect(adapter.createProject(" 新项目 ")).resolves.toEqual({id: "project-1", title: "新项目"});
        await expect(adapter.availability()).resolves.toEqual([]);
        expect(invoke.mock.calls.map(call => call[1])).toEqual([
            {request: {version: 1, operationId: expect.any(String), expectedGeneration: 0, action: {type: "ensure"}}},
            {request: {version: 1, operationId: expect.any(String), expectedGeneration: 1, action: {type: "project", project: {id: expect.any(String), title: "新项目"}}}},
            {request: {version: 1, operationId: expect.any(String), expectedGeneration: 1, action: {type: "availability"}}},
        ]);
    });

    it("rejects an older generation instead of accepting stale state", async () => {
        const invoke = vi.fn()
            .mockResolvedValueOnce({generation: 3, result: {type: "outcome", value: {kind: "state", value: state}}})
            .mockResolvedValueOnce({generation: 2, result: {type: "outcome", value: {kind: "state", value: state}}});
        vi.stubGlobal("window", {__TAURI_INTERNALS__: {invoke}});
        const adapter = createNativeWorkspaceAdapter();

        await adapter.ensure();
        await expect(adapter.state()).rejects.toThrow("已切换");
    });
});
