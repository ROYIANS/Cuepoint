import { afterEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db/database";
import { getVideoWorkspaceRepository } from "@/lib/videoWorkspaceRepository";
import { DraftConflictError } from "@/lib/draftConflict";
import { nativeProductReplySchema } from "@/lib/nativeWorkspaceContract";

const project = { id: "native-project", title: "Native film" };
const video = {
  projectId: project.id,
  mode: "film",
  kind: "video",
  aspectPreset: "16:9",
  outputWidth: 1920,
  outputHeight: 1080,
  archivedAt: null,
  createdAt: "2026-10-11T01:00:00Z",
  brief: "",
  genre: "",
  audience: "",
  tone: "",
  logline: "logline",
  updatedAt: "2026-10-11T01:00:00Z",
  columnSettings: { visible: ["content", "durationSec"] },
  shotSettings: {
    defaultDurationSec: 3,
    autoIncrementShotNumber: true,
    workspaceView: "design",
    filters: { statuses: [], beatIds: [], gaps: [] },
  },
};
const episode = {
  id: "native-episode",
  projectId: project.id,
  order: 0,
  title: "Episode",
  logline: "story",
  script: "hello",
  createdAt: "2026-10-11T01:00:00Z",
  updatedAt: "2026-10-11T01:00:00Z",
  shotFilters: { statuses: [], beatIds: [], gaps: [] },
};
const shot = {
  id: "native-shot",
  projectId: project.id,
  episodeId: episode.id,
  order: 0,
  shotNumber: "A-01",
  beatId: null,
  status: "draft",
  durationSec: 3,
  content: "content",
  notes: "note",
  sceneCloseup: "",
  sound: "",
  emotion: "",
  cameraAngle: "",
  cameraGear: "",
  focalLength: "",
  category: "",
  characterIds: [],
  sceneId: null,
  propIds: [],
  styleId: null,
};
const state = {
  schema: 4,
  workspaceId: "native-workspace",
  projects: [project],
  assets: [],
  references: [],
  sqliteVersion: "3.45",
  videoProjects: [video],
  episodes: [episode],
  beats: [],
  shots: [shot],
};
const videoState = {
  project,
  video,
  episodes: [episode],
  beats: [],
  shots: [shot],
  referencedAssetIds: [],
};
function reply(kind: string, value: unknown) {
  return {
    version: 1,
    generation: 50,
    result: { type: "outcome", value: { kind, value } },
  };
}
function native(invoke: ReturnType<typeof vi.fn>) {
  vi.stubGlobal("window", {
    __TAURI_INTERNALS__: { invoke },
    dispatchEvent: vi.fn(),
  });
  return getVideoWorkspaceRepository();
}
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("shared video repository runtime boundary", () => {
  it("preserves explicit scalar clears in the serialized native wire", async () => {
    const actions: unknown[] = [];
    const invoke = vi.fn((_command: string, args: unknown) => {
      const wire = JSON.parse(JSON.stringify(args)) as {
        request: { action: { type: string } };
      };
      actions.push(wire.request.action);
      if (wire.request.action.type === "patchBeat")
        return Promise.resolve(
          reply("beat", {
            id: "native-beat",
            episodeId: episode.id,
            order: 0,
            title: "Scene",
            content: "",
            timeOfDay: "",
            characterIds: [],
            sceneId: null,
            scriptRange: null,
          }),
        );
      return Promise.resolve(reply("shot", shot));
    });
    const repository = native(invoke);
    await repository.patchShot(
      shot.id,
      { beatId: undefined },
      { beatId: "previous-beat" },
    );
    await repository.patchStoryBeat(episode.id, "native-beat", {
      sceneId: undefined,
      scriptRange: undefined,
    });
    expect(actions).toEqual([
      {
        type: "patchShot",
        shotId: shot.id,
        patch: { beatId: null },
        baseline: { fields: [{ field: "beatId", value: "previous-beat" }] },
      },
      {
        type: "patchBeat",
        episodeId: episode.id,
        beatId: "native-beat",
        patch: { sceneId: null, scriptRange: null },
      },
    ]);
  });

  it("serializes bulk unassignment and unarchive as null rather than missing fields", async () => {
    const actions: Array<{ type: string; patch?: unknown }> = [];
    const invoke = vi.fn((_command: string, args: unknown) => {
      const wire = JSON.parse(JSON.stringify(args)) as {
        request: { action: { type: string; patch?: unknown } };
      };
      const action = wire.request.action;
      actions.push(action);
      if (action.type === "bulkShots")
        return Promise.resolve(
          reply("undo", {
            token: "clear-beat",
            resource: "shotBulk",
            ids: [shot.id],
          }),
        );
      if (action.type === "patchVideoProject")
        return Promise.resolve(reply("videoProject", video));
      return Promise.resolve(reply("state", state));
    });
    const repository = native(invoke);
    await repository.patchEpisodeShots(episode.id, [shot.id], {
      beatId: undefined,
    });
    await repository.setProjectArchived(project.id, false);
    expect(
      actions.find((action) => action.type === "bulkShots")?.patch,
    ).toEqual({ beatId: null });
    expect(
      actions.find((action) => action.type === "patchVideoProject")?.patch,
    ).toEqual({ archivedAt: null });
  });

  it("preserves browser commands and field conflicts without invoking Tauri", async () => {
    const repository = getVideoWorkspaceRepository();
    expect(repository.runtime).toBe("browser");
    const created = await repository.createProject(
      "Browser parity",
      "series",
      "9:16",
    );
    const first = (await repository.episodes(created.id))[0];
    await repository.updateEpisodeDraft(
      first.id,
      { script: "saved" },
      { script: "" },
    );
    await expect(
      repository.updateEpisodeDraft(
        first.id,
        { script: "stale" },
        { script: "" },
      ),
    ).rejects.toBeInstanceOf(DraftConflictError);
    expect((await repository.project(created.id))?.aspectPreset).toBe("9:16");
    expect((await repository.episode(first.id))?.story.script).toBe("saved");
  });

  it("uses native snapshots with no browser database reads", async () => {
    const browserRead = vi.spyOn(db.projects, "get");
    const browserEpisodes = vi.spyOn(db.episodes, "where");
    const invoke = vi.fn(
      (_command: string, args: { request: { action: { type: string } } }) =>
        Promise.resolve(
          args.request.action.type === "videoState"
            ? reply("videoState", videoState)
            : reply("state", state),
        ),
    );
    const repository = native(invoke);
    const result = await repository.snapshot(project.id);
    expect(result?.project.name).toBe(project.title);
    expect(result?.project.aspectPreset).toBe("16:9");
    expect(result?.episodes[0].story.script).toBe("hello");
    expect(result?.shots[0].shotNumber).toBe("A-01");
    expect(result?.shots[0].order).toBe(1);
    expect(
      result?.capabilities.find((item) => item.id === "mediaSlots")?.status,
    ).toBe("unavailable");
    expect(browserRead).not.toHaveBeenCalled();
    expect(browserEpisodes).not.toHaveBeenCalled();
  });

  it("uses a typed partial native patch and only changed field baselines", async () => {
    const invoke = vi.fn().mockResolvedValue(reply("episode", episode));
    const repository = native(invoke);
    await repository.updateEpisodeDraft(
      episode.id,
      { script: "updated" },
      { title: "old title", script: "hello" },
    );
    expect(invoke.mock.calls[0][1].request.action).toEqual({
      type: "patchEpisode",
      episodeId: episode.id,
      patch: { script: "updated" },
      baseline: { fields: [{ field: "script", value: "hello" }] },
    });
  });

  it("turns native conflict errors into the shared retained-draft error", async () => {
    const repository = native(
      vi.fn().mockRejectedValue({ code: "conflict", message: "changed" }),
    );
    await expect(
      repository.patchShot(shot.id, { content: "new" }, { content: "old" }),
    ).rejects.toBeInstanceOf(DraftConflictError);
  });

  it("captures distinct committed reorder receipts for consecutive inverses", async () => {
    let token = 0;
    const invoke = vi.fn(
      (_command: string, args: { request: { action: { type: string } } }) =>
        Promise.resolve(
          args.request.action.type === "videoUndo"
            ? reply("state", state)
            : reply("undo", {
                token: `undo-${++token}`,
                resource: "episodes",
                ids: [episode.id],
              }),
        ),
    );
    const repository = native(invoke);
    const first = await repository.reorderEpisodes(project.id, [episode.id]);
    const second = await repository.reorderEpisodes(project.id, [episode.id]);
    await first?.restore();
    await second?.restore();
    expect(
      invoke.mock.calls
        .slice(2)
        .map(
          (call) =>
            (call[1] as { request: { action: { receipt: { token: string } } } })
              .request.action.receipt.token,
        ),
    ).toEqual(["undo-1", "undo-2"]);
  });

  it("derives aspect dimension baselines from the shared project preset", async () => {
    const invoke = vi.fn().mockResolvedValue(reply("videoProject", video));
    const repository = native(invoke);
    await repository.patchProjectDetails(
      project.id,
      { aspectPreset: "9:16" },
      { aspectPreset: "16:9" },
    );
    expect(invoke.mock.calls[0][1].request.action).toEqual({
      type: "patchVideoProject",
      projectId: project.id,
      patch: { aspectPreset: "9:16", outputWidth: 1080, outputHeight: 1920 },
      baseline: {
        fields: [
          { field: "aspectPreset", value: "16:9" },
          { field: "outputWidth", value: "1920" },
          { field: "outputHeight", value: "1080" },
        ],
      },
    });
  });

  it("maps shared one-based shot insertion to one atomic native action", async () => {
    const invoke = vi.fn().mockResolvedValue(reply("shots", [shot]));
    const repository = native(invoke);
    await expect(
      repository.addShots(project.id, episode.id, 1, { atOrder: 1 }),
    ).resolves.toMatchObject([{ order: 1 }]);
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(invoke.mock.calls[0][1].request.action).toEqual({
      type: "addShots",
      projectId: project.id,
      episodeId: episode.id,
      count: 1,
      atOrder: 0,
      beatId: undefined,
    });
  });

  it("exposes unsupported relation reads without touching either store", async () => {
    const invoke = vi.fn();
    const browserRead = vi.spyOn(db.characters, "where");
    const repository = native(invoke);
    await expect(repository.characters(project.id)).resolves.toEqual([]);
    await expect(repository.styles(project.id)).resolves.toEqual([]);
    expect(invoke).not.toHaveBeenCalled();
    expect(browserRead).not.toHaveBeenCalled();
  });

  it("serializes complete native settings read-modify-write while preserving different fields", async () => {
    let stored = structuredClone(video);
    let readCount = 0;
    let releaseFirstRead: (() => void) | undefined;
    const firstRead = new Promise<void>((resolve) => {
      releaseFirstRead = resolve;
    });
    const operations: string[] = [];
    const invoke = vi.fn(
      async (
        _command: string,
        args: {
          request: {
            action: {
              type: string;
              patch?: { shotSettings: typeof video.shotSettings };
            };
          };
        },
      ) => {
        const action = args.request.action;
        if (action.type === "ensure" || action.type === "state")
          return reply("state", { ...state, videoProjects: [stored] });
        if (action.type === "videoState") {
          operations.push("read");
          const captured = structuredClone(stored);
          if (++readCount === 1) await firstRead;
          return reply("videoState", { ...videoState, video: captured });
        }
        operations.push("patch");
        stored = { ...stored, shotSettings: action.patch!.shotSettings };
        return reply("videoProject", stored);
      },
    );
    const repository = native(invoke);
    const first = repository.updateShotSettings(project.id, {
      defaultDurationSec: 5,
    });
    const second = repository.updateShotSettings(project.id, {
      autoIncrementShotNumber: false,
    });
    await vi.waitFor(() => {
      expect(readCount).toBe(1);
    });
    expect(operations).toEqual(["read"]);
    releaseFirstRead!();
    await Promise.all([first, second]);
    expect(operations).toEqual(["read", "patch", "read", "patch"]);
    expect(stored.shotSettings).toMatchObject({
      defaultDurationSec: 5,
      autoIncrementShotNumber: false,
    });
  });

  it("serializes episode filter read-modify-write without losing a different filter edit", async () => {
    let stored = structuredClone(episode);
    let readCount = 0;
    let releaseFirstRead: (() => void) | undefined;
    const firstRead = new Promise<void>((resolve) => {
      releaseFirstRead = resolve;
    });
    const operations: string[] = [];
    const invoke = vi.fn(
      async (
        _command: string,
        args: {
          request: {
            action: {
              type: string;
              patch?: { shotFilters: typeof episode.shotFilters };
            };
          };
        },
      ) => {
        if (
          args.request.action.type === "state" ||
          args.request.action.type === "ensure"
        ) {
          operations.push("read");
          const captured = structuredClone(stored);
          if (++readCount === 1) await firstRead;
          return reply("state", { ...state, episodes: [captured] });
        }
        operations.push("patch");
        stored = {
          ...stored,
          shotFilters: args.request.action.patch!.shotFilters,
        };
        return reply("episode", stored);
      },
    );
    const repository = native(invoke);
    const first = repository.updateEpisodeShotFilters(episode.id, {
      statuses: ["draft"],
    });
    const second = repository.updateEpisodeShotFilters(episode.id, {
      gaps: ["missingClip"],
    });
    await vi.waitFor(() => {
      expect(readCount).toBe(1);
    });
    expect(operations).toEqual(["read"]);
    releaseFirstRead!();
    await Promise.all([first, second]);
    expect(operations).toEqual(["read", "patch", "read", "patch"]);
    expect(stored.shotFilters).toMatchObject({
      statuses: ["draft"],
      gaps: ["missingClip"],
    });
  });

  it("allows a settings mutation after a prior owner mutation failed", async () => {
    let failed = false;
    const invoke = vi.fn(
      (
        _command: string,
        args: {
          request: {
            action: {
              type: string;
              patch?: { shotSettings: typeof video.shotSettings };
            };
          };
        },
      ) => {
        if (args.request.action.type === "videoState")
          return Promise.resolve(reply("videoState", videoState));
        if (
          args.request.action.type === "state" ||
          args.request.action.type === "ensure"
        )
          return Promise.resolve(reply("state", state));
        if (!failed) {
          failed = true;
          return Promise.reject({ code: "sqlite", message: "write failed" });
        }
        return Promise.resolve(
          reply("videoProject", {
            ...video,
            shotSettings: args.request.action.patch!.shotSettings,
          }),
        );
      },
    );
    const repository = native(invoke);
    const first = repository.updateShotSettings(project.id, {
      defaultDurationSec: 6,
    });
    const rejected = expect(first).rejects.toThrow("本地数据库操作失败");
    const second = repository.updateShotSettings(project.id, {
      autoIncrementShotNumber: false,
    });
    await rejected;
    await expect(second).resolves.toBeUndefined();
  });

  it("rejects unknown native fields and invalid shot status in the shared parser", () => {
    expect(() =>
      nativeProductReplySchema.parse(
        reply("state", { ...state, accessToken: "secret" }),
      ),
    ).toThrow();
    expect(() =>
      nativeProductReplySchema.parse(
        reply("shot", { ...shot, status: "finished" }),
      ),
    ).toThrow();
  });
});
