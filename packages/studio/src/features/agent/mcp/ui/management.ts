import {useSyncExternalStore} from "react";
import {db} from "../../../../platform/product/store";
import {createId} from "../../../../platform/identity";
import type {McpOAuthStatus} from "../../../../platform/runtime/mcp";
import {McpHostError} from "../../../../platform/runtime/mcpErrors";
import {mcpRuntimeOwner} from "../runtime/owner";
import type {McpConnectionOwner} from "../runtime/connections";
import type {McpCatalogue, McpServerConfig} from "../models/connection";
import type {McpConfigurationOutcome} from "../models/operations";
import type {McpRunGeneration} from "../models/manifest";
import {getMcpCatalogue} from "../queries/catalogue";
import {mcpEditorConfig, newMcpEditor, type McpEditorDraft} from "./editor";

type Runtime = NonNullable<ReturnType<typeof mcpRuntimeOwner>>;
type Unresolved = {readonly kind: "mutation" | "session"; readonly operationId: string; readonly serverId: string; readonly savedDraft?: boolean};
export interface McpManagementState {
    readonly catalogue?: McpCatalogue;
    readonly generations: readonly McpRunGeneration[];
    readonly selected?: string;
    readonly draft?: McpEditorDraft;
    readonly pending?: string;
    readonly unresolved?: Unresolved;
    readonly login?: {readonly serverId: string; readonly attemptId: string; readonly state: McpOAuthStatus["state"]};
    readonly error?: string;
}
const managers = new WeakMap<McpConnectionOwner, McpManagementOwner>();
const EMPTY: McpManagementState = {generations: []};
const noSubscription = () => () => undefined;

function actionError(cause: unknown, browser = false): string {
    if (cause instanceof McpHostError) {
        if (browser && ["transport", "unsupported", "remote_error"].includes(cause.code)) return "浏览器无法连接此服务。请确认浏览器支持请求流、服务使用 HTTP/2 或 HTTP/3，并允许当前工作区来源的 CORS 请求；也可改用桌面端连接。";
        if (cause.code === "vault_unavailable") return "无法使用设备安全凭据存储，请检查系统钥匙串或凭据管理器权限后重试。";
        if (cause.code === "auth_required") return "此服务需要认证。请登录授权，或替换配置并填写正确的 Token / 请求头后重新连接。";
        return cause.message;
    }
    return "操作未完成，请检查配置与连接状态后重试。私有配置不会显示在错误信息中。";
}

/** Foreground UI intent is shared across Agent/Settings and survives panel unmount. */
function createMcpManagementOwner(runtime: Runtime) {
    let state: McpManagementState = {generations: runtime.connections.capture()};
    const listeners = new Set<() => void>();
    let stopStore: (() => void) | undefined, stopConnections: (() => void) | undefined;
    function publish(patch: Partial<McpManagementState>) {state = {...state, ...patch}; for (const listener of listeners) {try {listener();} catch { /* UI observation cannot change the admitted operation. */ }}}
    function isPending() {return !!state.pending || !!state.unresolved || state.login?.state === "pending";}
    function lock(name: string, recovery = false): boolean {
        if (state.pending || !recovery && isPending()) return false;
        publish({pending: name, error: undefined});
        return true;
    }
    async function refresh() {
        try {publish({catalogue: await getMcpCatalogue(), generations: runtime.connections.capture()});}
        catch {publish({error: "连接列表暂时无法读取，请刷新后再操作。"});}
    }
    function settleMutation(outcome: McpConfigurationOutcome, original: Unresolved) {
        if (outcome.status === "committed" && outcome.hostConfirmed && !outcome.cleanupPending) {
            publish({unresolved: undefined, error: undefined, ...(original.savedDraft ? {draft: undefined, selected: original.serverId} : {})});
        } else if (outcome.status === "rejected" && !outcome.cleanupPending) {
            publish({unresolved: undefined, error: outcome.code === "conflict" ? "连接已被其他操作修改。请刷新列表，重新查看后再编辑。" : "配置未保存。请检查权限、凭据存储和配置后重试。"});
        } else publish({unresolved: original, error: outcome.status === "committed" ? "保存已确认，连接发布或凭据清理尚未完成。请核对原操作结果。" : "保存结果尚未确认。请核对原操作结果，避免重复保存。"});
    }
    async function mutation(original: Unresolved, action: () => Promise<McpConfigurationOutcome>) {
        try {settleMutation(await action(), original); await refresh();}
        catch (cause) {publish({error: actionError(cause, runtime.host.capabilities.host === "browser")});}
        finally {publish({pending: undefined});}
    }
    async function session(name: string, serverId: string, action: () => Promise<void>, recovery = false) {
        if (!lock(name, recovery)) return;
        try {await action();}
        catch (cause) {
            const unknown = cause instanceof McpHostError && cause.certainty === "unknown";
            publish({error: actionError(cause, runtime.host.capabilities.host === "browser"), ...(unknown ? {unresolved: {kind: "session", operationId: cause.operationId, serverId}} : {})});
        } finally {publish({pending: undefined, generations: runtime.connections.capture()});}
    }
    function loginFailure(cause: unknown, login: NonNullable<McpManagementState["login"]>) {
        // A retired local attempt cannot prove that the host canceled the original login.
        publish({error: actionError(cause, runtime.host.capabilities.host === "browser"),
            unresolved: {kind: "session", operationId: login.attemptId, serverId: login.serverId}});
    }
    const owner = {
        runtime,
        getSnapshot: () => state,
        isPending,
        isEditing: () => !!state.draft || isPending(),
        subscribe: (listener: () => void) => {
            listeners.add(listener);
            if (!stopStore) {
                stopStore = db.observe(tx => getMcpCatalogue(tx), {next: catalogue => publish({catalogue}), error: () => publish({error: "连接列表暂时无法读取，请刷新后再操作。"})});
                stopConnections = runtime.connections.subscribe(() => publish({generations: runtime.connections.capture()}));
            }
            return () => {listeners.delete(listener); if (!listeners.size) {stopStore?.(); stopConnections?.(); stopStore = undefined; stopConnections = undefined;}};
        },
        refresh,
        select(serverId?: string) {if (!isPending() && !state.draft) publish({selected: serverId, error: undefined});},
        edit(row?: McpServerConfig) {
            if (isPending() || state.draft || !state.catalogue) return;
            publish({selected: row?.serverId, error: undefined, draft: newMcpEditor(row?.serverId ?? createId("mcpserver"), state.catalogue.revision, runtime.host.capabilities.stdio, row)});
        },
        updateDraft(patch: Partial<Pick<McpEditorDraft, "label" | "enabled" | "transport" | "executable" | "args" | "cwd" | "environment" | "endpoint" | "auth" | "headers" | "clientId" | "scopes">>) {
            if (state.draft && !isPending()) publish({draft: {...state.draft, ...patch, dirty: true}});
        },
        discardDraft() {if (!isPending()) publish({draft: undefined, error: undefined});},
        save() {
            const draft = state.draft;
            if (!draft || !lock("save")) return Promise.resolve();
            let privateConfig;
            try {privateConfig = mcpEditorConfig(draft);}
            catch {publish({pending: undefined, error: "请检查 JSON 参数、环境变量、请求头及授权范围的格式。"}); return Promise.resolve();}
            const operationId = createId("mcpsave"), original: Unresolved = {kind: "mutation", operationId, serverId: draft.serverId, savedDraft: true};
            return mutation(original, () => runtime.connections.save({operationId, serverId: draft.serverId, catalogueRevision: draft.catalogueRevision, expectedConfigRevision: draft.configRevision,
                label: draft.label, enabled: draft.enabled, privateConfig}));
        },
        toggle(row: McpServerConfig, enabled: boolean) {
            if (!state.catalogue || state.draft || !lock("enable")) return Promise.resolve();
            const operationId = createId("mcpchange"), catalogueRevision = state.catalogue.revision;
            return mutation({kind: "mutation", operationId, serverId: row.serverId}, () => runtime.connections.mutate({kind: "set_enabled", operationId, catalogueRevision, serverId: row.serverId, expectedConfigRevision: row.configRevision, enabled}));
        },
        remove(row: McpServerConfig) {
            if (!state.catalogue || state.draft || !lock("remove")) return Promise.resolve();
            const operationId = createId("mcpremove"), catalogueRevision = state.catalogue.revision;
            return mutation({kind: "mutation", operationId, serverId: row.serverId}, () => runtime.connections.mutate({kind: "remove", operationId, catalogueRevision, serverId: row.serverId, expectedConfigRevision: row.configRevision}));
        },
        reconcile() {
            const original = state.unresolved;
            if (!original || original.kind !== "mutation" || !lock("reconcile", true)) return Promise.resolve();
            return mutation(original, () => runtime.connections.reconcile(original.operationId));
        },
        connect(row: McpServerConfig) {
            if (state.draft || !row.enabled) return Promise.resolve();
            const operationId = createId("mcpconnect");
            return session("connect", row.serverId, async () => {await runtime.connections.connect({operationId, serverId: row.serverId, configRevision: row.configRevision});});
        },
        disconnect(serverId: string) {
            const original = state.unresolved?.kind === "session" && state.unresolved.serverId === serverId ? state.unresolved : {kind: "session" as const, operationId: serverId, serverId};
            return session("disconnect", serverId, async () => {
                const result = await runtime.connections.disconnect(serverId);
                if (result.status === "draining") publish({unresolved: original, error: "连接已停用，仍在释放进程或请求。请再次检查清理结果。"});
                else publish({unresolved: undefined, login: undefined, error: undefined});
            }, state.unresolved?.kind === "session");
        },
        login(row: McpServerConfig) {
            if (state.draft || !row.enabled || !lock("login")) return Promise.resolve();
            try {runtime.host.reserveOAuthPopup?.();}
            catch (cause) {publish({pending: undefined, error: actionError(cause, runtime.host.capabilities.host === "browser")}); return Promise.resolve();}
            const operationId = createId("mcplogin");
            return (async () => {
                try {const attempt = await runtime.connections.oauthBegin({operationId, serverId: row.serverId, configRevision: row.configRevision}); publish({login: {serverId: row.serverId, attemptId: attempt.attemptId, state: "pending"}});}
                catch (cause) {publish({error: actionError(cause, runtime.host.capabilities.host === "browser"), ...(cause instanceof McpHostError && cause.certainty === "unknown" ? {unresolved: {kind: "session", operationId, serverId: row.serverId}} : {})});}
                finally {runtime.host.cancelReservedOAuthPopup?.(); publish({pending: undefined, generations: runtime.connections.capture()});}
            })();
        },
        checkLogin() {
            const login = state.login;
            if (!login || !lock("login-status", true)) return Promise.resolve();
            return (async () => {
                try {const result = await runtime.connections.oauthStatus(login.attemptId); publish({login: {...login, state: result.state}, error: result.state === "failed" || result.state === "expired" ? "登录未完成，请重新授权。" : undefined});}
                catch (cause) {loginFailure(cause, login);}
                finally {publish({pending: undefined});}
            })();
        },
        cancelLogin() {
            const login = state.login;
            if (!login || !lock("login-cancel", true)) return Promise.resolve();
            return (async () => {
                try {await runtime.connections.oauthCancel(login.attemptId); publish({login: undefined});}
                catch (cause) {loginFailure(cause, login);}
                finally {publish({pending: undefined});}
            })();
        },
    };
    return owner;
}
export type McpManagementOwner = ReturnType<typeof createMcpManagementOwner>;

export function mcpManagementOwner(): McpManagementOwner | undefined {
    const runtime = mcpRuntimeOwner();
    if (!runtime) return undefined;
    let manager = managers.get(runtime.connections);
    if (!manager) {manager = createMcpManagementOwner(runtime); managers.set(runtime.connections, manager);}
    return manager;
}
export function useMcpManagement() {
    const owner = mcpManagementOwner();
    const state = useSyncExternalStore(owner?.subscribe ?? noSubscription, owner?.getSnapshot ?? (() => EMPTY), () => EMPTY);
    return {owner, state};
}
