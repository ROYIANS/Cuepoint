import type {ProductStore} from "../../../../platform/storage/types";
import type {McpPrivateRevisionRef} from "../../../../platform/runtime/mcp";
import type {McpCatalogue, McpMutationReceipt, McpServerConfig} from "../models/connection";
import {MCP_LIMITS} from "./limits";
import {freezeMcp, mcpId, mcpInteger, mcpJson, mcpKeys, mcpRecord, mcpText} from "./validation";

export const MCP_CATALOGUE_KEY = "agentMcp.catalog.v1";

function parseMcpPrivateRevision(raw: unknown): McpPrivateRevisionRef {
    const record = mcpRecord(raw);
    mcpKeys(record, ["kind", "ownerId", "revisionId"]);
    if (record.kind !== "native_vault" && record.kind !== "session_memory") throw new Error("MCP 凭据引用无效");
    return {kind: record.kind, ownerId: mcpId(record.ownerId), revisionId: mcpId(record.revisionId)};
}

/** Only a public origin is stored. Exact paths/query/auth remain with the private owner. */
export function mcpEndpointDisplay(raw: unknown): string {
    const text = mcpText(raw, 512);
    const url = new URL(text);
    const loopback = url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]";
    if (url.protocol !== "https:" && !(url.protocol === "http:" && loopback) || url.username || url.password || url.search || url.hash || url.pathname !== "/" || url.origin !== text) throw new Error("MCP 公开地址必须是安全的服务来源");
    return text;
}

export function parseMcpServerConfig(raw: unknown): McpServerConfig {
    const record = mcpRecord(raw);
    mcpKeys(record, ["serverId", "configRevision", "label", "enabled", "transport", "auth", "endpointDisplay", "privateRevision"]);
    if (record.transport !== "stdio" && record.transport !== "streamable_http" || record.auth !== "none" && record.auth !== "manual" && record.auth !== "oauth" || typeof record.enabled !== "boolean") throw new Error("MCP 连接配置无效");
    if (record.transport === "stdio" && (record.auth !== "none" || record.endpointDisplay !== undefined)) throw new Error("本地 MCP 连接不能包含远程登录配置");
    const configRevision = mcpInteger(record.configRevision);
    if (configRevision < 1) throw new Error("MCP 配置版本无效");
    return {serverId: mcpId(record.serverId), configRevision, label: mcpText(record.label, 128), enabled: record.enabled,
        transport: record.transport, auth: record.auth, ...(record.transport === "streamable_http" ? {endpointDisplay: mcpEndpointDisplay(record.endpointDisplay)} : {}),
        privateRevision: parseMcpPrivateRevision(record.privateRevision)};
}

function parseReceipt(raw: unknown): McpMutationReceipt {
    const record = mcpRecord(raw);
    mcpKeys(record, ["operationId", "fingerprint", "kind", "serverId", "catalogueRevision", "configRevision", "publishedPrivateRevision", "retiredPrivateRevision"]);
    if (record.kind !== "save" && record.kind !== "set_enabled" && record.kind !== "remove" || typeof record.fingerprint !== "string" || !/^[a-f0-9]{64}$/u.test(record.fingerprint)) throw new Error("MCP 保存回执无效");
    const catalogueRevision = mcpInteger(record.catalogueRevision), configRevision = mcpInteger(record.configRevision);
    if (!catalogueRevision || !configRevision) throw new Error("MCP 保存回执版本无效");
    return {operationId: mcpId(record.operationId), fingerprint: record.fingerprint, kind: record.kind, serverId: mcpId(record.serverId), catalogueRevision, configRevision,
        ...(record.publishedPrivateRevision === undefined ? {} : {publishedPrivateRevision: parseMcpPrivateRevision(record.publishedPrivateRevision)}),
        ...(record.retiredPrivateRevision === undefined ? {} : {retiredPrivateRevision: parseMcpPrivateRevision(record.retiredPrivateRevision)})};
}

export function parseMcpCatalogue(raw: unknown): McpCatalogue {
    mcpJson(raw, MCP_LIMITS.catalogueBytes);
    const record = mcpRecord(raw);
    mcpKeys(record, ["version", "revision", "entries", "receipts"]);
    if (record.version !== 1 || !Array.isArray(record.entries) || record.entries.length > MCP_LIMITS.servers || !Array.isArray(record.receipts) || record.receipts.length > MCP_LIMITS.receipts) throw new Error("MCP 目录无效或超过上限");
    const entries = record.entries.map(parseMcpServerConfig), receipts = record.receipts.map(parseReceipt), revision = mcpInteger(record.revision);
    if (new Set(entries.map(entry => entry.serverId)).size !== entries.length || new Set(receipts.map(receipt => receipt.operationId)).size !== receipts.length
        || receipts.some((receipt, index) => receipt.catalogueRevision > revision || index > 0 && receipt.catalogueRevision !== receipts[index - 1].catalogueRevision + 1)
        || (revision === 0 ? receipts.length !== 0 || entries.length !== 0 : receipts.at(-1)?.catalogueRevision !== revision)) throw new Error("MCP 目录版本或标识冲突");
    return freezeMcp({version: 1, revision, entries, receipts});
}

export async function readMcpCatalogueRecord(store: ProductStore): Promise<McpCatalogue> {
    const row = await store.deviceSettings.get(MCP_CATALOGUE_KEY);
    return row ? parseMcpCatalogue(row.value) : freezeMcp({version: 1, revision: 0, entries: [], receipts: []});
}
