import type {McpHostBinding, McpHostServices, McpOAuthAttempt, McpOAuthStatus} from "../../../../platform/runtime/mcp";
import {McpHostError} from "../../../../platform/runtime/mcpErrors";
import type {ProductStore} from "../../../../platform/storage/types";
import type {McpCatalogueMutation, McpServerConfig} from "../models/connection";
import type {McpRunGeneration} from "../models/manifest";
import type {McpConfigurationOutcome, McpSaveIntent} from "../models/operations";
import {getMcpCatalogue} from "../queries/catalogue";
import {createMcpConfigurationOwner} from "./configuration";
import {MCP_LIMITS} from "./limits";
import {normalizeMcpManifest, parseMcpBinding} from "./manifest";
import {freezeMcp, mcpId} from "./validation";

interface PendingConnection {readonly token: object; readonly controller: AbortController}
interface Login {readonly serverId: string; readonly configRevision: number; readonly epoch: number; readonly attempt: McpOAuthAttempt}
export interface McpConnectionOwner {
    save(input: McpSaveIntent): Promise<McpConfigurationOutcome>;
    mutate(input: Exclude<McpCatalogueMutation, {readonly kind: "save"}>): Promise<McpConfigurationOutcome>;
    reconcile(operationId: string): Promise<McpConfigurationOutcome>;
    connect(input: {readonly operationId: string; readonly serverId: string; readonly configRevision: number}, signal?: AbortSignal): Promise<McpRunGeneration>;
    disconnect(serverId: string): Promise<{readonly status: "drained" | "draining"}>;
    connected(): Promise<readonly McpRunGeneration[]>;
    oauthBegin(input: {readonly operationId: string; readonly serverId: string; readonly configRevision: number}): Promise<McpOAuthAttempt>;
    oauthStatus(attemptId: string): Promise<McpOAuthStatus>;
    oauthCancel(attemptId: string): Promise<void>;
    dispose(): Promise<{readonly status: "drained" | "draining"}>;
}

/** Explicit connection owner. Product configuration is never itself launch authority. */
export function createMcpConnectionOwner(store: ProductStore, host: McpHostServices): McpConnectionOwner {
    let closed = false;
    let disposal: Promise<{readonly status: "drained" | "draining"}> | undefined;
    const generations = new Map<string, McpRunGeneration>();
    const pending = new Map<string, PendingConnection>();
    const epochs = new Map<string, number>();
    const logins = new Map<string, Login>();
    const pendingLogins = new Map<string, {readonly token: object; readonly operationId: string}>();
    const epoch = (serverId: string) => epochs.get(serverId) ?? 0;
    function assertActive(operationId: string): void {
        if (closed || !host.active) throw new McpHostError("closed", "not_started", operationId);
    }
    function fence(serverId: string, preservedLogin?: object): void {
        epochs.set(serverId, epoch(serverId) + 1);
        generations.delete(serverId);
        pending.get(serverId)?.controller.abort();
        pending.delete(serverId);
        if (pendingLogins.get(serverId)?.token !== preservedLogin) pendingLogins.delete(serverId);
        for (const [attemptId, login] of logins) if (login.serverId === serverId) logins.delete(attemptId);
    }
    async function retire(serverId: string): Promise<{readonly status: "drained" | "draining"}> {
        mcpId(serverId);
        fence(serverId);
        return host.retireServer({serverId});
    }
    const configuration = createMcpConfigurationOwner(store, host, retire);
    async function current(serverId: string, configRevision: number, operationId: string): Promise<McpServerConfig> {
        assertActive(operationId);
        const row = (await getMcpCatalogue(store)).entries.find(item => item.serverId === serverId);
        assertActive(operationId);
        if (!row?.enabled || row.configRevision !== configRevision || configuration.hasUnresolved(serverId)) throw new McpHostError("retired", "not_started", operationId);
        return row;
    }
    function assertEpoch(serverId: string, expected: number, signal: AbortSignal, operationId: string, certainty: "not_started" | "unknown"): void {
        if (expected !== epoch(serverId) || signal.aborted) throw new McpHostError("retired", certainty, operationId);
    }
    function sameReference(left: McpServerConfig, right: McpServerConfig): boolean {
        return left.privateRevision.kind === right.privateRevision.kind && left.privateRevision.ownerId === right.privateRevision.ownerId && left.privateRevision.revisionId === right.privateRevision.revisionId;
    }
    async function disconnectBinding(binding: McpHostBinding): Promise<void> {
        try {await host.disconnect(binding);} catch { /* Locally fenced; native teardown retains drainage ownership. */ }
    }
    async function loginCurrent(attemptId: string): Promise<Login> {
        const login = logins.get(mcpId(attemptId));
        if (!login || epoch(login.serverId) !== login.epoch) throw new McpHostError("retired", "not_started", attemptId);
        await current(login.serverId, login.configRevision, attemptId);
        return login;
    }
    const owner: McpConnectionOwner = {
        save(input) {assertActive(input.operationId); return configuration.save(input);},
        mutate(input) {assertActive(input.operationId); return configuration.mutate(input);},
        reconcile(operationId) {assertActive(operationId); return configuration.reconcile(operationId);},
        async connect(input, signal) {
            const operationId = mcpId(input.operationId), serverId = mcpId(input.serverId), revision = input.configRevision;
            assertActive(operationId);
            signal?.throwIfAborted();
            if (pending.has(serverId) || pendingLogins.has(serverId) || [...logins.values()].some(login => login.serverId === serverId)) throw new McpHostError("conflict", "not_started", operationId);
            if (generations.size + pending.size >= MCP_LIMITS.connected && !generations.has(serverId)) throw new McpHostError("limit", "not_started", operationId);
            const token = {}, controller = new AbortController(), initialEpoch = epoch(serverId);
            pending.set(serverId, {token, controller});
            const abort = () => controller.abort();
            signal?.addEventListener("abort", abort, {once: true});
            let admitted: McpHostBinding | undefined;
            try {
                const row = await current(serverId, revision, operationId);
                assertEpoch(serverId, initialEpoch, controller.signal, operationId, "not_started");
                const old = generations.get(serverId);
                generations.delete(serverId);
                if (old) await host.disconnect(old.binding);
                const connection = await host.connect({operationId, serverId, configRevision: revision, privateRevision: row.privateRevision}, controller.signal);
                admitted = parseMcpBinding(connection.binding);
                if (admitted.serverId !== serverId || admitted.configRevision !== revision) throw new McpHostError("protocol", "unknown", operationId);
                const latest = await current(serverId, revision, operationId);
                assertEpoch(serverId, initialEpoch, controller.signal, operationId, "unknown");
                if (!sameReference(latest, row)) throw new McpHostError("retired", "unknown", operationId);
                const generation = freezeMcp({binding: admitted, label: latest.label, manifest: normalizeMcpManifest(serverId, connection.discovery)});
                generations.set(serverId, generation);
                return generation;
            } catch (error) {
                if (admitted) await disconnectBinding(admitted);
                throw error;
            } finally {
                if (pending.get(serverId)?.token === token) pending.delete(serverId);
                signal?.removeEventListener("abort", abort);
            }
        },
        disconnect(serverId) {assertActive(serverId); return retire(serverId);},
        async connected() {
            if (closed || !host.active) return [];
            const catalogue = await getMcpCatalogue(store);
            if (closed || !host.active) return [];
            for (const [serverId, generation] of generations) {
                const row = catalogue.entries.find(item => item.serverId === serverId);
                if (!row?.enabled || row.configRevision !== generation.binding.configRevision || configuration.hasUnresolved(serverId)) {
                    fence(serverId);
                    void host.retireServer({serverId}).catch(() => undefined);
                }
            }
            return Object.freeze([...generations.values()]);
        },
        async oauthBegin(input) {
            const operationId = mcpId(input.operationId), serverId = mcpId(input.serverId), revision = input.configRevision;
            assertActive(operationId);
            if (pendingLogins.has(serverId) || [...logins.values()].some(login => login.serverId === serverId)) throw new McpHostError("conflict", "not_started", operationId);
            if (pendingLogins.size + logins.size >= MCP_LIMITS.servers) throw new McpHostError("limit", "not_started", operationId);
            const token = {};
            pendingLogins.set(serverId, {token, operationId});
            fence(serverId, token);
            const initialEpoch = epoch(serverId);
            let attempt: McpOAuthAttempt | undefined, issued = false;
            try {
                await host.retireServer({serverId});
                const row = await current(serverId, revision, operationId);
                if (initialEpoch !== epoch(serverId)) throw new McpHostError("retired", "not_started", operationId);
                if (row.auth !== "oauth") throw new McpHostError("invalid", "not_started", operationId);
                issued = true;
                attempt = await host.oauthBegin({operationId, serverId, configRevision: revision, privateRevision: row.privateRevision});
                await current(serverId, revision, operationId);
                if (initialEpoch !== epoch(serverId)) throw new McpHostError("retired", "unknown", operationId);
                logins.set(attempt.attemptId, {serverId, configRevision: revision, epoch: initialEpoch, attempt: freezeMcp(attempt)});
                pendingLogins.delete(serverId);
                return attempt;
            } catch (error) {
                if (attempt) void host.oauthCancel(attempt.attemptId).catch(() => undefined);
                // A lost begin reply keeps its original operation reserved. Explicit
                // disconnect retires that attempt before another login may be started.
                const knownNotStarted = error instanceof McpHostError && error.certainty === "not_started";
                if ((!issued || knownNotStarted || attempt) && pendingLogins.get(serverId)?.token === token) pendingLogins.delete(serverId);
                throw error;
            }
        },
        async oauthStatus(attemptId) {
            const login = await loginCurrent(attemptId);
            const status = await host.oauthStatus(attemptId);
            if (closed || !host.active || epoch(login.serverId) !== login.epoch || logins.get(attemptId) !== login) throw new McpHostError("retired", "unknown", attemptId);
            await current(login.serverId, login.configRevision, attemptId);
            if (status.state !== "pending") logins.delete(attemptId);
            return status;
        },
        async oauthCancel(attemptId) {await loginCurrent(attemptId); logins.delete(attemptId); await host.oauthCancel(attemptId);},
        dispose() {
            closed = true;
            for (const serverId of new Set([...generations.keys(), ...pending.keys(), ...pendingLogins.keys(), ...[...logins.values()].map(login => login.serverId)])) fence(serverId);
            disposal ??= host.dispose().catch(() => ({status: "draining" as const})).then(result => {
                if (result.status === "draining") disposal = undefined;
                return result;
            });
            return disposal;
        },
    };
    return owner;
}
