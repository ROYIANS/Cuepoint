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
export type NativeWorkspaceState = {
    schema: 1;
    workspaceId: string;
    projects: NativeProject[];
    assets: NativeAsset[];
    references: Array<{id: string; projectId: string; assetId: string; startSec: number; durationSec: number}>;
    sqliteVersion: string;
};
type NativeResult =
    | {type: "state"; value: NativeWorkspaceState | null}
    | {type: "outcome"; value: {kind: "state"; value: NativeWorkspaceState} | {kind: "project"; value: NativeProject} | {kind: "asset"; value: NativeAsset} | {kind: "availability"; value: NativeAvailability[]}}
    | {type: "canceled"}
    | {type: "closed"};
type NativeAction =
    | {type: "ensure" | "state" | "availability"}
    | {type: "project"; project: NativeProject}
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
