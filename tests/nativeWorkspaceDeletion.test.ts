import {afterEach, describe, expect, it, vi} from "vitest";
import {createNativeWorkspaceAdapter} from "@/platform/runtime/reference/nativeWorkspace";

afterEach(() => vi.unstubAllGlobals());

describe("native project deletion outcome", () => {
    it("accepts the state committed by the Rust delete-project transaction", async () => {
        const state = {
            schema: 4, workspaceId: "delete-workspace", projects: [], assets: [], references: [],
            sqliteVersion: "3.45", videoProjects: [], episodes: [], beats: [], shots: [],
        };
        const invoke = vi.fn().mockResolvedValue({
            version: 1, generation: 1, result: {type: "outcome", value: {kind: "state", value: state}},
        });
        vi.stubGlobal("window", {__TAURI_INTERNALS__: {invoke}});
        await expect(createNativeWorkspaceAdapter().command({type: "deleteProject", projectId: "deleted-project"}))
            .resolves.toEqual({type: "outcome", value: {kind: "state", value: state}});
    });
});
