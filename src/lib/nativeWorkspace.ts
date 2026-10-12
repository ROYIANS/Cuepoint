import { isTauriRuntime } from "@/lib/runtimeIdentity";
import { DraftConflictError } from "@/lib/draftConflict";
import type { Shot, StoryBeat, ShotFilters } from "@/domain/types";

import {
  nativeProductReplySchema,
  type NativeResult,
} from "@/lib/nativeWorkspaceContract";
import type {
  NativeProject,
  NativeVideoProject,
  NativeEpisode,
  NativeBeat,
  NativeShot,
  NativeAsset,
  NativeAvailability,
  NativeWorkspaceState,
  NativeVideoWorkspaceState,
} from "@/lib/nativeWorkspaceContract";
export type {
  NativeProject,
  NativeVideoProject,
  NativeEpisode,
  NativeBeat,
  NativeShot,
  NativeAsset,
  NativeAvailability,
  NativeWorkspaceState,
  NativeVideoWorkspaceState,
  NativeUndoReceipt,
} from "@/lib/nativeWorkspaceContract";
type NativeShotPatch = Partial<
  Pick<
    Shot,
    | "status"
    | "durationSec"
    | "content"
    | "notes"
    | "category"
    | "sceneCloseup"
    | "sound"
    | "emotion"
    | "cameraAngle"
    | "cameraGear"
    | "focalLength"
    | "shotNumber"
    | "characterIds"
    | "propIds"
  >
> & {
  beatId?: string | null;
  sceneId?: string | null;
  styleId?: string | null;
};
type NativeBeatPatch = Partial<
  Pick<StoryBeat, "title" | "content" | "timeOfDay" | "characterIds">
> & { sceneId?: string | null; scriptRange?: StoryBeat["scriptRange"] | null };
type NativeBaseline = { fields: Array<{ field: string; value: string }> };
export type NativeAction =
  | { type: "ensure" | "state" | "availability" }
  | { type: "project"; project: NativeProject }
  | {
      type: "createVideoProject";
      project: NativeProject;
      video: NativeVideoProject;
    }
  | {
      type: "addShots";
      projectId: string;
      episodeId: string;
      count: number;
      atOrder?: number;
      beatId?: string;
    }
  | { type: "deleteProject"; projectId: string }
  | { type: "videoState"; projectId: string }
  | {
      type: "videoProject";
      video: NativeVideoProject;
      baseline?: NativeBaseline;
    }
  | {
      type: "patchVideoProject";
      projectId: string;
      patch: Partial<
        Pick<
          NativeVideoProject,
          | "mode"
          | "aspectPreset"
          | "outputWidth"
          | "outputHeight"
          | "archivedAt"
          | "brief"
          | "genre"
          | "audience"
          | "tone"
          | "logline"
          | "columnSettings"
          | "shotSettings"
        >
      > & { title?: string };
      baseline?: NativeBaseline;
    }
  | { type: "episode"; episode: NativeEpisode }
  | {
      type: "patchEpisode";
      episodeId: string;
      patch: {
        title?: string;
        logline?: string;
        script?: string;
        shotFilters?: ShotFilters;
      };
      baseline?: NativeBaseline;
    }
  | { type: "reorderEpisodes"; projectId: string; orderedIds: string[] }
  | { type: "deleteEpisode"; episodeId: string }
  | { type: "beat"; beat: NativeBeat }
  | {
      type: "patchBeat";
      episodeId: string;
      beatId: string;
      patch: NativeBeatPatch;
      baseline?: NativeBaseline;
    }
  | { type: "reorderBeats"; episodeId: string; orderedIds: string[] }
  | { type: "deleteBeat"; episodeId: string; beatId: string }
  | {
      type: "duplicateBeat";
      episodeId: string;
      beatId: string;
      includeShots: boolean;
    }
  | { type: "shot"; shot: NativeShot }
  | {
      type: "patchShot";
      shotId: string;
      patch: NativeShotPatch;
      baseline?: NativeBaseline;
    }
  | { type: "reorderShots"; episodeId: string; orderedIds: string[] }
  | { type: "deleteShots"; episodeId: string; shotIds: string[] }
  | { type: "duplicateShot"; episodeId: string; shotId: string }
  | {
      type: "bulkShots";
      episodeId: string;
      shotIds: string[];
      patch: NativeShotPatch;
    }
  | {
      type: "videoUndo";
      receipt: { token: string; resource: string; ids: string[] };
    }
  | {
      type: "import";
      metadata: {
        projectId: string;
        assetId: string;
        kind: "media" | "output";
        displayName: string;
        mimeType: string;
      };
    };

function baselineValue(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  )
    return String(value);
  return JSON.stringify(value);
}

export function nativeBaseline(
  patch: object,
  baseline: object | undefined,
): NativeBaseline | undefined {
  if (!baseline) return undefined;
  return {
    fields: Object.keys(patch).map((field) => ({
      field,
      value: baselineValue((baseline as { [key: string]: unknown })[field]),
    })),
  };
}

declare global {
  interface Window {
    __TAURI_INTERNALS__?: {
      invoke: (command: string, args?: unknown) => Promise<unknown>;
    };
  }
}

export function isNativeWorkspaceRuntime(): boolean {
  return isTauriRuntime();
}

function assertActionResult(action: NativeAction, result: NativeResult): void {
  if (result.type === "outcome" && result.value.kind === "conflict")
    throw new DraftConflictError();
  if (action.type === "ensure" || action.type === "state") {
    if (
      result.type === "state" ||
      (result.type === "outcome" && result.value.kind === "state") ||
      (action.type === "ensure" && result.type === "canceled")
    )
      return;
  } else if (action.type === "import" && result.type === "canceled") return;
  else {
    const expected: {
      [K in Exclude<NativeAction["type"], "ensure" | "state">]: Extract<
        NativeResult,
        { type: "outcome" }
      >["value"]["kind"];
    } = {
      project: "project",
      createVideoProject: "project",
      deleteProject: "state",
      videoState: "videoState",
      videoProject: "videoProject",
      patchVideoProject: "videoProject",
      episode: "episode",
      patchEpisode: "episode",
      reorderEpisodes: "undo",
      deleteEpisode: "undo",
      beat: "beat",
      patchBeat: "beat",
      reorderBeats: "undo",
      deleteBeat: "undo",
      duplicateBeat: "duplicateBeat",
      shot: "shot",
      addShots: "shots",
      patchShot: "shot",
      reorderShots: "undo",
      deleteShots: "undo",
      duplicateShot: "duplicateShot",
      bulkShots: "undo",
      videoUndo: "state",
      availability: "availability",
      import: "asset",
    };
    if (
      result.type === "outcome" &&
      result.value.kind === expected[action.type]
    )
      return;
  }
  throw new Error("原生工作区返回了与操作不符的结果，修改未确认保存");
}
export function nativeWorkspacePublishedError(): Error & {
  published: true;
  code: "published";
} {
  return Object.assign(
    new Error("文件已保存，但系统未能确认保存收尾。请检查已保存的文件。"),
    { published: true as const, code: "published" as const },
  );
}

function nativeError(cause: unknown): Error {
  const code =
    cause && typeof cause === "object" && "code" in cause
      ? cause.code
      : undefined;
  if (code === "conflict") return new DraftConflictError();
  if (code === "published") {
    return nativeWorkspacePublishedError();
  }
  const messages: Record<string, string> = {
    bridge: "原生工作区连接失败，请重新打开应用",
    untrusted: "原生工作区连接失败，请重新打开应用",
    busy: "原生工作区正在处理其他操作，请稍后重试",
    closed: "原生工作区已关闭，请重新打开",
    canceled: "操作已取消，修改未保存",
    missing: "内容已不存在，修改未保存",
    ownership: "内容不属于当前项目，修改未保存",
    order: "顺序已发生变化，请读取最新内容后重试",
    range: "剧本范围无效，请重新选择",
    invalid: "数据未通过校验，修改未保存",
    schema: "工作区格式不符合当前版本，请使用新的工作区",
    undo: "无法撤销此操作，后续修改已保留",
    corrupt: "工作区数据校验失败，请检查工作区",
    sqlite: "本地数据库操作失败，请稍后重试",
    containment: "工作区文件校验失败，请重新打开工作区",
  };
  return new Error(
    typeof code === "string" && messages[code]
      ? messages[code]
      : "原生工作区操作失败，请重试或重新打开应用",
  );
}

export class NativeWorkspaceAdapter {
  private generation = 0;
  private queue: Promise<void> = Promise.resolve();
  private opening?: Promise<NativeWorkspaceState>;
  private opened = false;

  async request(action: NativeAction): Promise<NativeResult> {
    const operation = this.queue.then(() => this.performRequest(action));
    this.queue = operation.then(
      () => undefined,
      () => undefined,
    );
    return operation;
  }

  private async performRequest(action: NativeAction): Promise<NativeResult> {
    const invoke = window.__TAURI_INTERNALS__?.invoke;
    if (!invoke) throw new Error("当前运行环境没有原生工作区");
    let value: unknown;
    try {
      value = await invoke("workspace_request", {
        request: {
          version: 1,
          operationId: crypto.randomUUID(),
          expectedGeneration: this.generation,
          action,
        },
      });
    } catch (cause) {
      throw nativeError(cause);
    }

    const reply = nativeProductReplySchema.parse(value);
    if (reply.generation < this.generation)
      throw new Error("原生工作区已切换，忽略旧响应");
    assertActionResult(action, reply.result);
    this.generation = reply.generation;
    return reply.result;
  }

  async command(action: NativeAction): Promise<NativeResult> {
    try {
      const result = await this.request(action);
      if (result.type === "outcome" && result.value.kind === "conflict")
        throw new DraftConflictError();
      return result;
    } catch (cause) {
      if (
        cause &&
        typeof cause === "object" &&
        "code" in cause &&
        cause.code === "conflict"
      )
        throw new DraftConflictError();
      throw cause;
    }
  }

  ensure(): Promise<NativeWorkspaceState> {
    if (this.opening) return this.opening;
    if (this.opened) return this.state();
    this.opening = this.request({ type: "ensure" })
      .then((result) => {
        if (result.type === "canceled")
          throw new Error("原生工作区初始化已取消");
        let state: NativeWorkspaceState;
        if (result.type === "state" && result.value) state = result.value;
        else if (result.type === "outcome" && result.value.kind === "state")
          state = result.value.value;
        else throw new Error("原生工作区初始化未返回状态");
        this.opened = true;
        return state;
      })
      .finally(() => {
        this.opening = undefined;
      });
    return this.opening;
  }

  async state(): Promise<NativeWorkspaceState> {
    if (!this.opened) await this.ensure();
    const result = await this.request({ type: "state" });
    if (result.type === "state" && result.value) return result.value;
    if (result.type === "outcome" && result.value.kind === "state")
      return result.value.value;
    throw new Error("原生工作区尚未打开");
  }

  async createProject(title: string): Promise<NativeProject> {
    const project = {
      id: crypto.randomUUID(),
      title: title.trim() || "未命名项目",
    };
    const result = await this.request({ type: "project", project });
    if (result.type === "outcome" && result.value.kind === "project")
      return result.value.value;
    throw new Error("原生项目创建未返回项目");
  }

  async importAsset(
    projectId: string,
    displayName: string,
    mimeType: string,
  ): Promise<NativeAsset | null> {
    const result = await this.request({
      type: "import",
      metadata: {
        projectId,
        assetId: crypto.randomUUID(),
        kind: "media",
        displayName,
        mimeType,
      },
    });
    if (result.type === "canceled") return null;
    if (result.type === "outcome" && result.value.kind === "asset")
      return result.value.value;
    throw new Error("原生素材导入未返回素材");
  }

  async videoState(projectId: string): Promise<NativeVideoWorkspaceState> {
    if (!this.opened) await this.ensure();
    const result = await this.request({ type: "videoState", projectId });
    if (result.type === "outcome" && result.value.kind === "videoState")
      return result.value.value;
    throw new Error("原生视频项目状态未返回");
  }
  async saveVideoProject(
    video: NativeVideoProject,
  ): Promise<NativeVideoProject> {
    const result = await this.request({ type: "videoProject", video });
    if (result.type === "outcome" && result.value.kind === "videoProject")
      return result.value.value;
    throw new Error("原生视频项目保存未返回结果");
  }
  async saveEpisode(episode: NativeEpisode): Promise<NativeEpisode> {
    const result = await this.request({ type: "episode", episode });
    if (result.type === "outcome" && result.value.kind === "episode")
      return result.value.value;
    throw new Error("原生集保存未返回结果");
  }
  async createEpisode(
    projectId: string,
    input: Partial<Pick<NativeEpisode, "title" | "logline" | "script">> = {},
  ): Promise<NativeEpisode> {
    const current = await this.videoState(projectId);
    const now = new Date().toISOString();
    const episode: NativeEpisode = {
      id: crypto.randomUUID(),
      projectId,
      order: current.episodes.length,
      title: input.title?.trim() || `第${current.episodes.length + 1}集`,
      logline: input.logline ?? "",
      script: input.script ?? "",
      createdAt: now,
      updatedAt: now,
      shotFilters: { statuses: [], beatIds: [], gaps: [] },
    };
    return this.saveEpisode(episode);
  }

  async saveBeat(beat: NativeBeat): Promise<NativeBeat> {
    const result = await this.request({ type: "beat", beat });
    if (result.type === "outcome" && result.value.kind === "beat")
      return result.value.value;
    throw new Error("原生节拍保存未返回结果");
  }
  async createBeat(
    episodeId: string,
    input: Partial<Pick<NativeBeat, "title" | "content" | "timeOfDay">> = {},
  ): Promise<NativeBeat> {
    const current = await this.state();
    const order = current.beats.filter(
      (item) => item.episodeId === episodeId,
    ).length;
    return this.saveBeat({
      id: crypto.randomUUID(),
      episodeId,
      order,
      title: input.title?.trim() || `节拍 ${order + 1}`,
      content: input.content ?? "",
      timeOfDay: input.timeOfDay ?? "",
      characterIds: [],
      sceneId: null,
      scriptRange: null,
    });
  }

  async saveShot(shot: NativeShot): Promise<NativeShot> {
    const result = await this.request({ type: "shot", shot });
    if (result.type === "outcome" && result.value.kind === "shot")
      return result.value.value;
    throw new Error("原生镜头保存未返回结果");
  }

  async availability(): Promise<NativeAvailability[]> {
    const result = await this.request({ type: "availability" });
    if (result.type === "outcome" && result.value.kind === "availability")
      return result.value.value;
    throw new Error("原生素材检查未返回结果");
  }
}

export function createNativeWorkspaceAdapter(): NativeWorkspaceAdapter {
  return new NativeWorkspaceAdapter();
}

export const nativeWorkspace = createNativeWorkspaceAdapter();
