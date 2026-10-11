import {useCallback, useEffect, useState} from "react";

export type NativeProject = {id: string; title: string};
export type NativeAsset = {
    id: string;
    projectId: string;
    kind: "media" | "output";
    displayName: string;
    mimeType: string;
    byteLength: number;
    contentHash: string;
    reference: {workspaceId: string; projectId: string; relativePath: string};
};
export type NativeAvailability = {assetId: string; status: "present" | "missing" | "corrupt"};
export type NativeVideoProject = {projectId: string; mode: "film" | "series"; logline: string; updatedAt: string};
export type NativeEpisode = {id: string; projectId: string; order: number; title: string; logline: string; script: string; createdAt: string; updatedAt: string};
export type NativeBeat = {id: string; episodeId: string; order: number; title: string; content: string; timeOfDay: string; scriptStart?: number; scriptEnd?: number};
export type NativeShot = {id: string; projectId: string; episodeId: string; order: number; shotNumber: number; beatId?: string; status: "draft" | "ready" | "framed" | "clipped" | "approved"; durationSec: number; content: string; notes: string; sceneCloseup: string; sound: string; emotion: string; cameraAngle: string; cameraGear: string; focalLength: string};
export type NativeVideoWorkspaceState = {project: NativeProject; video: NativeVideoProject; episodes: NativeEpisode[]; beats: NativeBeat[]; shots: NativeShot[]; referencedAssetIds: string[]};
export type NativeWorkspaceState = {
    schema: 3;
    workspaceId: string;
    projects: NativeProject[];
    assets: NativeAsset[];
    references: Array<{id: string; projectId: string; assetId: string; startSec: number; durationSec: number}>;
    sqliteVersion: string;
    videoProjects: NativeVideoProject[];
    episodes: NativeEpisode[];
    beats: NativeBeat[];
    shots: NativeShot[];
};
type NativeResult =
    | {type: "state"; value: NativeWorkspaceState | null}
    | {type: "outcome"; value: {kind: "state"; value: NativeWorkspaceState} | {kind: "project"; value: NativeProject} | {kind: "asset"; value: NativeAsset} | {kind: "availability"; value: NativeAvailability[]} | {kind: "videoProject"; value: NativeVideoProject} | {kind: "episode"; value: NativeEpisode} | {kind: "beat"; value: NativeBeat} | {kind: "shot"; value: NativeShot} | {kind: "videoState"; value: NativeVideoWorkspaceState}}
    | {type: "canceled"}
    | {type: "closed"};
type NativeAction =
    | {type: "ensure" | "state" | "availability"}
    | {type: "project"; project: NativeProject}
    | {type: "videoState"; projectId: string}
    | {type: "videoProject"; video: NativeVideoProject}
    | {type: "episode"; episode: NativeEpisode}
    | {type: "reorderEpisodes"; projectId: string; orderedIds: string[]}
    | {type: "beat"; beat: NativeBeat}
    | {type: "reorderBeats"; episodeId: string; orderedIds: string[]}
    | {type: "shot"; shot: NativeShot}
    | {type: "reorderShots"; episodeId: string; orderedIds: string[]}
    | {type: "import"; metadata: {projectId: string; assetId: string; kind: "media" | "output"; displayName: string; mimeType: string}};

declare global {
    interface Window {
        __TAURI_INTERNALS__?: {invoke: (command: string, args?: unknown) => Promise<unknown>};
    }
}

export function isNativeWorkspaceRuntime(): boolean {
    return typeof window !== "undefined" && typeof window.__TAURI_INTERNALS__?.invoke === "function";
}

function assertResult(value: unknown): NativeResult {
    if (!value || typeof value !== "object" || !("result" in value)) throw new Error("原生工作区返回格式无效");
    return (value as {result: NativeResult}).result;
}

export class NativeWorkspaceAdapter {
    private generation = 0;

    async request(action: NativeAction): Promise<NativeResult> {
        const invoke = window.__TAURI_INTERNALS__?.invoke;
        if (!invoke) throw new Error("当前运行环境没有原生工作区");
        const value = await invoke("workspace_request", {
            request: {version: 1, operationId: crypto.randomUUID(), expectedGeneration: this.generation, action},
        });
        const reply = value as {generation?: unknown};
        if (typeof reply.generation !== "number") throw new Error("原生工作区响应缺少 generation");
        if (reply.generation < this.generation) throw new Error("原生工作区已切换，忽略旧响应");
        this.generation = reply.generation;
        return assertResult(value);
    }

    async ensure(): Promise<NativeWorkspaceState> {
        const result = await this.request({type: "ensure"});
        if (result.type === "canceled") throw new Error("原生工作区初始化已取消");
        if (result.type === "state") return result.value ?? await this.state();
        if (result.type === "outcome" && result.value.kind === "state") return result.value.value;
        throw new Error("原生工作区初始化未返回状态");
    }

    async state(): Promise<NativeWorkspaceState> {
        const result = await this.request({type: "state"});
        if (result.type === "state" && result.value) return result.value;
        if (result.type === "outcome" && result.value.kind === "state") return result.value.value;
        throw new Error("原生工作区尚未打开");
    }

    async createProject(title: string): Promise<NativeProject> {
        const project = {id: crypto.randomUUID(), title: title.trim() || "未命名项目"};
        const result = await this.request({type: "project", project});
        if (result.type === "outcome" && result.value.kind === "project") return result.value.value;
        throw new Error("原生项目创建未返回项目");
    }

    async importAsset(projectId: string, displayName: string, mimeType: string): Promise<NativeAsset | null> {
        const result = await this.request({type: "import", metadata: {projectId, assetId: crypto.randomUUID(), kind: "media", displayName, mimeType}});
        if (result.type === "canceled") return null;
        if (result.type === "outcome" && result.value.kind === "asset") return result.value.value;
        throw new Error("原生素材导入未返回素材");
    }

    async videoState(projectId: string): Promise<NativeVideoWorkspaceState> {
        const result = await this.request({type: "videoState", projectId});
        if (result.type === "outcome" && result.value.kind === "videoState") return result.value.value;
        throw new Error("原生视频项目状态未返回");
    }
    async saveVideoProject(video: NativeVideoProject): Promise<NativeVideoProject> {
        const result = await this.request({type: "videoProject", video});
        if (result.type === "outcome" && result.value.kind === "videoProject") return result.value.value;
        throw new Error("原生视频项目保存未返回结果");
    }
    async saveEpisode(episode: NativeEpisode): Promise<NativeEpisode> {
        const result = await this.request({type: "episode", episode});
        if (result.type === "outcome" && result.value.kind === "episode") return result.value.value;
        throw new Error("原生集保存未返回结果");
    }
    async createEpisode(projectId: string, input: Partial<Pick<NativeEpisode, "title" | "logline" | "script">> = {}): Promise<NativeEpisode> {
        const current = await this.videoState(projectId);
        const now = String(Date.now());
        const episode: NativeEpisode = {id: crypto.randomUUID(), projectId, order: current.episodes.length, title: input.title?.trim() || `第${current.episodes.length + 1}集`, logline: input.logline ?? "", script: input.script ?? "", createdAt: now, updatedAt: now};
        return this.saveEpisode(episode);
    }
    async updateEpisode(id: string, patch: Partial<Omit<NativeEpisode, "id" | "projectId" | "order">>, baseline?: Partial<NativeEpisode>): Promise<NativeEpisode> {
        void baseline;
        // The ID is resolved against the native snapshot, keeping ownership in the bridge.
        const state = await this.state();
        const current = state.episodes.find(item => item.id === id);
        if (!current) throw new Error("集不存在");
        return this.saveEpisode({...current, ...patch, updatedAt: String(Date.now())});
    }
    async reorderEpisodes(projectId: string, orderedIds: string[]): Promise<void> {
        const result = await this.request({type: "reorderEpisodes", projectId, orderedIds});
        if (result.type !== "outcome" || result.value.kind !== "videoState") throw new Error("原生集排序未返回结果");
    }
    async saveBeat(beat: NativeBeat): Promise<NativeBeat> {
        const result = await this.request({type: "beat", beat});
        if (result.type === "outcome" && result.value.kind === "beat") return result.value.value;
        throw new Error("原生节拍保存未返回结果");
    }
    async createBeat(episodeId: string, input: Partial<Pick<NativeBeat, "title" | "content" | "timeOfDay">> = {}): Promise<NativeBeat> {
        const current = await this.state();
        const order = current.beats.filter(item => item.episodeId === episodeId).length;
        return this.saveBeat({id: crypto.randomUUID(), episodeId, order, title: input.title?.trim() || `节拍 ${order + 1}`, content: input.content ?? "", timeOfDay: input.timeOfDay ?? ""});
    }
    async updateBeat(episodeId: string, id: string, patch: Partial<Omit<NativeBeat, "id" | "episodeId" | "order">>, baseline?: Partial<NativeBeat>): Promise<NativeBeat> {
        void baseline;
        const current = (await this.state()).beats.find(item => item.id === id && item.episodeId === episodeId);
        if (!current) throw new Error("节拍不存在");
        return this.saveBeat({...current, ...patch});
    }
    async reorderBeats(episodeId: string, orderedIds: string[]): Promise<void> {
        const result = await this.request({type: "reorderBeats", episodeId, orderedIds});
        if (result.type !== "outcome" || result.value.kind !== "videoState") throw new Error("原生节拍排序未返回结果");
    }
    async saveShot(shot: NativeShot): Promise<NativeShot> {
        const result = await this.request({type: "shot", shot});
        if (result.type === "outcome" && result.value.kind === "shot") return result.value.value;
        throw new Error("原生镜头保存未返回结果");
    }
    async createShot(episodeId: string, input: Partial<Omit<NativeShot, "id" | "projectId" | "episodeId" | "order" | "shotNumber">> = {}): Promise<NativeShot> {
        const owner = (await this.state()).episodes.find(item => item.id === episodeId)?.projectId;
        if (!owner) throw new Error("集不存在");
        const current = await this.videoState(owner);
        const order = current.shots.filter(item => item.episodeId === episodeId).length;
        const projectId = current.project.id;
        return this.saveShot({id: crypto.randomUUID(), projectId, episodeId, order, shotNumber: order + 1, status: "draft", durationSec: 0, content: "", notes: "", sceneCloseup: "", sound: "", emotion: "", cameraAngle: "", cameraGear: "", focalLength: "", ...input});
    }
    async updateShot(episodeId: string, id: string, patch: Partial<Omit<NativeShot, "id" | "projectId" | "episodeId" | "order">>, baseline?: Partial<NativeShot>): Promise<NativeShot> {
        void baseline;
        const current = (await this.state()).shots.find(item => item.id === id && item.episodeId === episodeId);
        if (!current) throw new Error("镜头不存在");
        return this.saveShot({...current, ...patch});
    }
    async reorderShots(episodeId: string, orderedIds: string[]): Promise<void> {
        const result = await this.request({type: "reorderShots", episodeId, orderedIds});
        if (result.type !== "outcome" || result.value.kind !== "videoState") throw new Error("原生镜头排序未返回结果");
    }

    async availability(): Promise<NativeAvailability[]> {
        const result = await this.request({type: "availability"});
        if (result.type === "outcome" && result.value.kind === "availability") return result.value.value;
        throw new Error("原生素材检查未返回结果");
    }
}

export function createNativeWorkspaceAdapter(): NativeWorkspaceAdapter {
    return new NativeWorkspaceAdapter();
}

export const nativeWorkspace = createNativeWorkspaceAdapter();

export function useNativeWorkspaceState(): {
    state: NativeWorkspaceState | null | undefined;
    availability: NativeAvailability[];
    error: string | undefined;
    busy: boolean;
    refresh: () => Promise<void>;
} {
    const native = isNativeWorkspaceRuntime();
    const [state, setState] = useState<NativeWorkspaceState | null | undefined>(undefined);
    const [availability, setAvailability] = useState<NativeAvailability[]>([]);
    const [error, setError] = useState<string>();
    const [busy, setBusy] = useState(false);
    const refresh = useCallback(async () => {
        if (!native) return;
        setBusy(true);
        try {
            const nextState = await nativeWorkspace.ensure();
            setState(nextState);
            setAvailability(await nativeWorkspace.availability());
            setError(undefined);
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "原生工作区初始化失败");
        } finally {
            setBusy(false);
        }
    }, [native]);
    useEffect(() => { void refresh(); }, [refresh]);
    return {state, availability, error, busy, refresh};
}
