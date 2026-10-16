import {nowIso} from "../../../../platform/identity";
import {db as productDb} from "../../../../platform/product/store";
import {StorageError} from "../../../../platform/storage/errors";
import type {ProductStore} from "../../../../platform/storage/types";
import type {McpCatalogueMutation, McpMutationReceipt, McpMutationReconciliation, McpServerConfig} from "../models/connection";
import {MCP_LIMITS} from "../runtime/limits";
import {MCP_CATALOGUE_KEY, parseMcpCatalogue, parseMcpServerConfig, readMcpCatalogueRecord} from "../runtime/records";
import {mcpMutationFingerprint, parseMcpMutation} from "../runtime/mutation";

function updatedConfig(mutation: McpCatalogueMutation, existing: McpServerConfig | undefined): McpServerConfig | undefined {
    const configRevision = mutation.expectedConfigRevision + 1;
    switch (mutation.kind) {
        case "save": return parseMcpServerConfig({...mutation.config, serverId: mutation.serverId, configRevision});
        case "set_enabled":
            if (!existing) throw new StorageError("conflict", "MCP 连接已不存在");
            return {...existing, enabled: mutation.enabled, configRevision};
        case "remove": return undefined;
    }
}

/** A single ProductStore transaction; never starts a host process or writes a vault. */
export async function mutateMcpCatalogue(input: McpCatalogueMutation, store: ProductStore = productDb): Promise<McpMutationReceipt> {
    const mutation = parseMcpMutation(input), fingerprint = mcpMutationFingerprint(mutation);
    return store.transaction("rw", ["deviceSettings"], async tx => {
        const catalogue = await readMcpCatalogueRecord(tx);
        const prior = catalogue.receipts.find(receipt => receipt.operationId === mutation.operationId);
        if (prior) {
            if (prior.fingerprint !== fingerprint) throw new StorageError("conflict", "MCP 操作标识已用于其他内容");
            return prior;
        }
        const existing = catalogue.entries.find(entry => entry.serverId === mutation.serverId);
        if (catalogue.revision !== mutation.catalogueRevision || (existing?.configRevision ?? 0) !== mutation.expectedConfigRevision || !existing && mutation.kind !== "save") throw new StorageError("conflict", "MCP 连接已变化，请重新查看后再操作");
        const configRevision = mutation.expectedConfigRevision + 1;
        const next = updatedConfig(mutation, existing);
        const entries = [...catalogue.entries.filter(entry => entry.serverId !== mutation.serverId), ...(next ? [next] : [])];
        const publishedPrivateRevision = next?.privateRevision;
        const retiredPrivateRevision = existing && JSON.stringify(existing.privateRevision) !== JSON.stringify(publishedPrivateRevision) ? existing.privateRevision : undefined;
        // A candidate cannot be shared between servers: collection has one connection owner.
        if (new Set(entries.map(entry => JSON.stringify(entry.privateRevision))).size !== entries.length) throw new Error("MCP 凭据版本不能由不同连接共享");
        const receipt: McpMutationReceipt = {operationId: mutation.operationId, fingerprint, kind: mutation.kind, serverId: mutation.serverId,
            catalogueRevision: catalogue.revision + 1, configRevision,
            ...(publishedPrivateRevision ? {publishedPrivateRevision} : {}), ...(retiredPrivateRevision ? {retiredPrivateRevision} : {})};
        const updated = parseMcpCatalogue({version: 1, revision: catalogue.revision + 1, entries,
            receipts: [...catalogue.receipts, receipt].slice(-MCP_LIMITS.receipts)});
        await tx.deviceSettings.put({key: MCP_CATALOGUE_KEY, value: updated, updatedAt: nowIso()});
        return updated.receipts.at(-1)!;
    });
}

/** Readback of this exact intent only. Missing receipts never authorize another write. */
export async function reconcileMcpMutation(input: McpCatalogueMutation, store: ProductStore = productDb): Promise<McpMutationReconciliation> {
    const mutation = parseMcpMutation(input), fingerprint = mcpMutationFingerprint(mutation);
    return store.transaction("r", ["deviceSettings"], async tx => {
        const catalogue = await readMcpCatalogueRecord(tx);
        const receipt = catalogue.receipts.find(item => item.operationId === mutation.operationId);
        if (receipt) return receipt.fingerprint === fingerprint ? {status: "committed", receipt} : {status: "conflict"};
        return {status: catalogue.revision === mutation.catalogueRevision ? "unresolved" : "conflict"};
    });
}
