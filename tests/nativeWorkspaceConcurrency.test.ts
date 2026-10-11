import {afterEach, describe, expect, it, vi} from "vitest";
import {createNativeWorkspaceAdapter} from "@/lib/nativeWorkspace";

const state = {
    schema: 4 as const, workspaceId: "concurrent-workspace", projects: [], assets: [], references: [],
    sqliteVersion: "3.45", videoProjects: [], episodes: [], beats: [], shots: [],
};

afterEach(() => vi.unstubAllGlobals());

describe("native workspace concurrent startup", () => {
    it("opens the worker before simultaneous shared-page reads use its generation", async () => {
        let finishOpen!: () => void;
        const opening = new Promise<void>(resolve => {finishOpen = resolve;});
        let started!: () => void;
        const hasStarted = new Promise<void>(resolve => {started = resolve;});
        let generation = 0;
        let opened = false;
        const invoke = vi.fn(async (_command: string, args: {request: {expectedGeneration: number; action: {type: string}}}) => {
            const {expectedGeneration, action} = args.request;
            if (expectedGeneration !== generation) throw new Error("stale native generation");
            if (action.type === "ensure" && !opened) {
                started();
                await opening;
                if (expectedGeneration !== generation) throw new Error("duplicate open raced the transition");
                opened = true;
                generation += 1;
            } else if (!opened) throw new Error("native worker is not ready");
            return {version: 1, generation, result: {type: "state", value: state}};
        });
        vi.stubGlobal("window", {__TAURI_INTERNALS__: {invoke}});
        const adapter = createNativeWorkspaceAdapter();
        const first = adapter.ensure();
        await hasStarted;
        const settled = Promise.allSettled([first, adapter.ensure(), adapter.state()]);
        finishOpen();
        expect(await settled).toEqual([
            {status: "fulfilled", value: state}, {status: "fulfilled", value: state}, {status: "fulfilled", value: state},
        ]);
        const reads = invoke.mock.calls.filter(call => call[1].request.action.type === "state");
        expect(reads.length).toBeGreaterThan(0);
        expect(reads.every(call => call[1].request.expectedGeneration === 1)).toBe(true);
    });

    it("recovers the initialization barrier after a failed open", async () => {
        const invoke = vi.fn()
            .mockRejectedValueOnce(new Error("temporary native open failure"))
            .mockResolvedValue({version: 1, generation: 1, result: {type: "state", value: state}});
        vi.stubGlobal("window", {__TAURI_INTERNALS__: {invoke}});
        const adapter = createNativeWorkspaceAdapter();
        await expect(adapter.ensure()).rejects.toThrow("原生工作区操作失败");
        await expect(adapter.ensure()).resolves.toEqual(state);
        expect(invoke.mock.calls[1][1].request.expectedGeneration).toBe(0);
    });
});
