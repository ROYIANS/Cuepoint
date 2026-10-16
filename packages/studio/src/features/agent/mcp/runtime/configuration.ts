import {z} from "zod";
import {StorageError} from "../../../../platform/storage/errors";
import type {ProductStore} from "../../../../platform/storage/types";
import type {McpHostServices, McpPrivateRevisionRef} from "../../../../platform/runtime/mcp";
import {McpHostError} from "../../../../platform/runtime/mcpErrors";
import {mcpPrivateConfigSchema} from "../../../../platform/runtime/mcpWire";
import {mutateMcpCatalogue, reconcileMcpMutation} from "../commands/catalogue";
import {getMcpCatalogue} from "../queries/catalogue";
import type {McpCatalogueMutation, McpMutationReceipt} from "../models/connection";
import type {McpConfigurationOutcome, McpSaveIntent} from "../models/operations";
import {mcpPrivateCleanupDecision} from "./privateRevisions";
import {mcpDigest, mcpId, mcpJson} from "./validation";
import {parseMcpMutation} from "./mutation";

type SaveMutation = Extract<McpCatalogueMutation, {readonly kind: "save"}>;
const intentSchema = z.object({operationId: z.string(), serverId: z.string(), catalogueRevision: z.number(), expectedConfigRevision: z.number(), label: z.string(), enabled: z.boolean(), privateConfig: mcpPrivateConfigSchema}).strict();
interface Intent {
    readonly operationId: string;
    readonly serverId: string;
    readonly fingerprint: string;
    /** Public projection only: the pending-operation map never retains plaintext configuration. */
    readonly draft?: SaveMutation;
    phase: "retiring" | "preparing" | "writing" | "settled";
    mutation?: McpCatalogueMutation;
    receipt?: McpMutationReceipt;
    result?: McpConfigurationOutcome;
    pending?: Promise<McpConfigurationOutcome>;
}

export interface McpConfigurationOwner {
    save(input: McpSaveIntent): Promise<McpConfigurationOutcome>;
    mutate(input: Exclude<McpCatalogueMutation, {readonly kind: "save"}>): Promise<McpConfigurationOutcome>;
    reconcile(operationId: string): Promise<McpConfigurationOutcome>;
    hasUnresolved(serverId: string): boolean;
}

/** Original intents span vault and ProductStore boundaries; no network or vault IO enters a Tx. */
export function createMcpConfigurationOwner(store: ProductStore, host: McpHostServices, retire: (serverId: string) => Promise<unknown>): McpConfigurationOwner {
    const intents = new Map<string, Intent>();
    const unknown = (intent: Intent): McpConfigurationOutcome => ({status: "unknown", operationId: intent.operationId});
    const unresolved = (intent: Intent) => !intent.result || intent.result.status === "unknown" || intent.result.status === "committed" && !intent.result.hostConfirmed;
    function publicDraft(source: McpSaveIntent): SaveMutation {
        const parsed = parseMcpMutation({kind: "save", operationId: source.operationId, serverId: source.serverId,
            catalogueRevision: source.catalogueRevision, expectedConfigRevision: source.expectedConfigRevision,
            config: {label: source.label, enabled: source.enabled, privateRevision: {kind: "native_vault", ownerId: "pending", revisionId: "pending"}, transport: source.privateConfig.transport,
                auth: source.privateConfig.transport === "stdio" ? "none" : source.privateConfig.auth.kind,
                ...(source.privateConfig.transport === "streamable_http" ? {endpointDisplay: new URL(source.privateConfig.endpoint).origin} : {})}});
        if (parsed.kind !== "save") throw new Error("MCP 保存操作无效");
        return parsed;
    }
    function prepared(intent: Intent, reference: McpPrivateRevisionRef): void {
        if (!intent.draft) throw new Error("MCP 原保存操作缺失");
        intent.mutation = parseMcpMutation({...intent.draft, config: {...intent.draft.config, privateRevision: reference}});
    }
    async function cleanup(intent: Intent, committed: boolean): Promise<boolean> {
        if (!intent.mutation) return false;
        try {
            const current = await getMcpCatalogue(store);
            const decision = mcpPrivateCleanupDecision(intent.mutation, committed && intent.receipt ? {status: "committed", receipt: intent.receipt} : {status: "confirmed_rollback"}, current);
            if (decision.status === "quarantined") return true;
            for (const reference of decision.collect) await host.discardPrivateRevision({serverId: intent.serverId, reference});
            return false;
        } catch {return true;}
    }
    async function rejected(intent: Intent, code: "conflict" | "unavailable"): Promise<McpConfigurationOutcome> {
        intent.phase = "settled";
        intent.result = {status: "rejected", operationId: intent.operationId, code, cleanupPending: await cleanup(intent, false)};
        return intent.result;
    }
    async function publish(intent: Intent): Promise<McpConfigurationOutcome> {
        const receipt = intent.receipt;
        if (!receipt) return unknown(intent);
        let hostConfirmed = true;
        if (intent.mutation?.kind === "save" && receipt.publishedPrivateRevision) {
            try {await host.confirmPrivateRevision({operationId: intent.operationId, serverId: intent.serverId, reference: receipt.publishedPrivateRevision, catalogueFingerprint: receipt.fingerprint});}
            catch {hostConfirmed = false;}
        }
        intent.phase = "settled";
        intent.result = {status: "committed", receipt, hostConfirmed, cleanupPending: await cleanup(intent, true)};
        return intent.result;
    }
    async function commit(intent: Intent): Promise<McpConfigurationOutcome> {
        if (!intent.mutation) return unknown(intent);
        intent.phase = "writing";
        try {intent.receipt = await mutateMcpCatalogue(intent.mutation, store);}
        catch (error) {
            if (!(error instanceof StorageError) || error.certainty !== "rollback") return unknown(intent);
            return rejected(intent, error.code === "conflict" ? "conflict" : "unavailable");
        }
        return publish(intent);
    }
    async function retireOriginal(intent: Intent): Promise<McpConfigurationOutcome | undefined> {
        try {await retire(intent.serverId); return undefined;}
        catch (error) {
            if (error instanceof McpHostError && error.certainty === "not_started") return rejected(intent, "unavailable");
            return unknown(intent);
        }
    }
    async function run(intent: Intent, task: () => Promise<McpConfigurationOutcome>): Promise<McpConfigurationOutcome> {
        if (intent.pending) return intent.pending;
        intent.pending = task().catch(() => unknown(intent));
        try {return await intent.pending;}
        finally {intent.pending = undefined;}
    }
    function insert(operationId: string, serverId: string, fingerprint: string, draft?: SaveMutation, mutation?: McpCatalogueMutation): {intent: Intent; fresh: boolean} {
        const existing = intents.get(operationId);
        if (existing) {
            if (existing.fingerprint !== fingerprint) throw new StorageError("conflict", "MCP 操作标识已用于其他内容");
            return {intent: existing, fresh: false};
        }
        if ([...intents.values()].some(intent => intent.serverId === serverId && unresolved(intent))) throw new StorageError("conflict", "请先核对这条 MCP 连接的原操作");
        if (intents.size >= 64) {
            const settled = [...intents.values()].find(intent => !unresolved(intent) && intent.result?.status !== "unknown" && !intent.result?.cleanupPending);
            if (!settled) throw new StorageError("unavailable", "待核对的 MCP 操作过多，请先处理原操作");
            intents.delete(settled.operationId);
        }
        const intent: Intent = {operationId, serverId, fingerprint, phase: "retiring", ...(draft ? {draft} : {}), ...(mutation ? {mutation} : {})};
        intents.set(operationId, intent);
        return {intent, fresh: true};
    }
    const owner: McpConfigurationOwner = {
        save(input) {
            const owned = intentSchema.parse(JSON.parse(mcpJson(input, 65_536)) as unknown);
            mcpJson(owned.privateConfig, 32_768);
            const draft = publicDraft(owned);
            const {intent, fresh} = insert(draft.operationId, draft.serverId, mcpDigest(JSON.stringify(owned)), draft);
            if (!fresh) return intent.pending ?? owner.reconcile(intent.operationId);
            return run(intent, async () => {
                const retired = await retireOriginal(intent);
                if (retired) return retired;
                intent.phase = "preparing";
                try {prepared(intent, await host.preparePrivateRevision({operationId: owned.operationId, serverId: owned.serverId, catalogueRevision: owned.catalogueRevision, expectedConfigRevision: owned.expectedConfigRevision, config: owned.privateConfig}));}
                catch (error) {
                    if (error instanceof McpHostError && error.certainty === "not_started") return rejected(intent, "unavailable");
                    return unknown(intent);
                }
                return commit(intent);
            });
        },
        mutate(input) {
            const mutation = parseMcpMutation(input);
            const {intent, fresh} = insert(mutation.operationId, mutation.serverId, mcpDigest(JSON.stringify(mutation)), undefined, mutation);
            if (!fresh) return intent.pending ?? owner.reconcile(intent.operationId);
            return run(intent, async () => {const retired = await retireOriginal(intent); return retired ?? commit(intent);});
        },
        reconcile(operationId) {
            const intent = intents.get(mcpId(operationId));
            if (!intent) return Promise.resolve({status: "unknown", operationId});
            return run(intent, async () => {
                if (intent.result?.status === "rejected") return intent.result.cleanupPending ? rejected(intent, intent.result.code) : intent.result;
                if (intent.result?.status === "committed" && intent.result.hostConfirmed) {
                    if (!intent.result.cleanupPending) return intent.result;
                    intent.result = {...intent.result, cleanupPending: await cleanup(intent, true)};
                    return intent.result;
                }
                if (intent.phase === "retiring") {
                    const retired = await retireOriginal(intent);
                    if (retired) return retired;
                    if (intent.draft) {
                        // No vault action was issued. Settle this original operation; a new
                        // explicit save can now proceed without retaining plaintext here.
                        return rejected(intent, "unavailable");
                    }
                    return commit(intent);
                }
                if (!intent.mutation && intent.draft) {
                    const status = await host.privateRevisionStatus({operationId: intent.operationId, serverId: intent.serverId});
                    if (status.status === "unknown") return unknown(intent);
                    prepared(intent, status.reference);
                    // Prepare ACK was lost before any catalogue write was issued.
                    return commit(intent);
                }
                if (!intent.mutation) return unknown(intent);
                const resolution = await reconcileMcpMutation(intent.mutation, store);
                if (resolution.status !== "committed") return unknown(intent);
                intent.receipt = resolution.receipt;
                return publish(intent);
            });
        },
        hasUnresolved(serverId) {return [...intents.values()].some(intent => intent.serverId === serverId && unresolved(intent));},
    };
    return owner;
}
