import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createNativeWorkspaceAdapter,
  isNativeWorkspaceRuntime,
} from "@/lib/nativeWorkspace";

const state = {
  schema: 4 as const,
  workspaceId: "workspace-1",
  projects: [],
  assets: [],
  references: [],
  sqliteVersion: "3.45",
  videoProjects: [],
  episodes: [],
  beats: [],
  shots: [],
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("native workspace renderer boundary", () => {
  it("keeps browser mode separate from the Tauri runtime", () => {
    expect(isNativeWorkspaceRuntime()).toBe(false);
    vi.stubGlobal("window", { __TAURI_INTERNALS__: { invoke: vi.fn() } });
    expect(isNativeWorkspaceRuntime()).toBe(true);
  });

  it("uses closed typed results and carries the generation through product calls", async () => {
    const invoke = vi
      .fn()
      .mockResolvedValueOnce({
        version: 1,
        generation: 1,
        result: { type: "outcome", value: { kind: "state", value: state } },
      })
      .mockResolvedValueOnce({
        version: 1,
        generation: 1,
        result: {
          type: "outcome",
          value: {
            kind: "project",
            value: { id: "project-1", title: "新项目" },
          },
        },
      })
      .mockResolvedValueOnce({
        version: 1,
        generation: 1,
        result: { type: "outcome", value: { kind: "availability", value: [] } },
      });
    vi.stubGlobal("window", { __TAURI_INTERNALS__: { invoke } });
    const adapter = createNativeWorkspaceAdapter();

    await expect(adapter.ensure()).resolves.toEqual(state);
    await expect(adapter.createProject(" 新项目 ")).resolves.toEqual({
      id: "project-1",
      title: "新项目",
    });
    await expect(adapter.availability()).resolves.toEqual([]);
    expect(invoke.mock.calls.map((call) => call[1])).toEqual([
      {
        request: {
          version: 1,
          operationId: expect.any(String),
          expectedGeneration: 0,
          action: { type: "ensure" },
        },
      },
      {
        request: {
          version: 1,
          operationId: expect.any(String),
          expectedGeneration: 1,
          action: {
            type: "project",
            project: { id: expect.any(String), title: "新项目" },
          },
        },
      },
      {
        request: {
          version: 1,
          operationId: expect.any(String),
          expectedGeneration: 1,
          action: { type: "availability" },
        },
      },
    ]);
  });

  it("rejects unknown fields without accepting its generation", async () => {
    const invoke = vi
      .fn()
      .mockResolvedValueOnce({
        version: 1,
        generation: 99,
        result: {
          type: "outcome",
          value: { kind: "state", value: { ...state, rawToken: "secret" } },
        },
      })
      .mockResolvedValueOnce({
        version: 1,
        generation: 1,
        result: { type: "outcome", value: { kind: "state", value: state } },
      });
    vi.stubGlobal("window", { __TAURI_INTERNALS__: { invoke } });
    const adapter = createNativeWorkspaceAdapter();
    await expect(adapter.ensure()).rejects.toThrow();
    await expect(adapter.ensure()).resolves.toEqual(state);
    expect(invoke.mock.calls[1][1].request.expectedGeneration).toBe(0);
  });

  it("rejects wrong operation outcomes and canceled writes before advancing generation", async () => {
    const invoke = vi
      .fn()
      .mockResolvedValueOnce({
        version: 1,
        generation: 80,
        result: { type: "state", value: state },
      })
      .mockResolvedValueOnce({
        version: 1,
        generation: 80,
        result: { type: "canceled" },
      })
      .mockResolvedValueOnce({
        version: 1,
        generation: 1,
        result: { type: "outcome", value: { kind: "state", value: state } },
      });
    vi.stubGlobal("window", { __TAURI_INTERNALS__: { invoke } });
    const adapter = createNativeWorkspaceAdapter();
    await expect(
      adapter.command({
        type: "patchEpisode",
        episodeId: "episode",
        patch: { script: "text" },
      }),
    ).rejects.toThrow("与操作不符");
    await expect(
      adapter.command({
        type: "patchEpisode",
        episodeId: "episode",
        patch: { script: "text" },
      }),
    ).rejects.toThrow("与操作不符");
    await adapter.ensure();
    expect(
      invoke.mock.calls.map((call) => call[1].request.expectedGeneration),
    ).toEqual([0, 0, 0]);
  });

  it("maps safe native error codes without exposing backend paths", async () => {
    const invoke = vi
      .fn()
      .mockRejectedValue({
        code: "untrusted",
        message: "forbidden /Users/private/workspace",
      });
    vi.stubGlobal("window", { __TAURI_INTERNALS__: { invoke } });
    const adapter = createNativeWorkspaceAdapter();
    await expect(adapter.ensure()).rejects.toThrow(
      "原生工作区连接失败，请重新打开应用",
    );
    await expect(adapter.ensure()).rejects.not.toThrow("/Users/private");
  });

  it("rejects an older generation instead of accepting stale state", async () => {
    const invoke = vi
      .fn()
      .mockResolvedValueOnce({
        version: 1,
        generation: 3,
        result: { type: "outcome", value: { kind: "state", value: state } },
      })
      .mockResolvedValueOnce({
        version: 1,
        generation: 2,
        result: { type: "outcome", value: { kind: "state", value: state } },
      });
    vi.stubGlobal("window", { __TAURI_INTERNALS__: { invoke } });
    const adapter = createNativeWorkspaceAdapter();

    await adapter.ensure();
    await expect(adapter.state()).rejects.toThrow("已切换");
  });
});
