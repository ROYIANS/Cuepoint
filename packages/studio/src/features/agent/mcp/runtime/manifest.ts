import type {McpHostBinding} from "../../../../platform/runtime/mcp";
import type {McpManifest, McpResourceManifest, McpToolManifest} from "../models/manifest";
import {MCP_LIMITS} from "./limits";
import {compileMcpInputSchema} from "./schema";
import {freezeMcp, mcpDigest, mcpId, mcpInteger, mcpJson, mcpOrdinal, mcpKeys, mcpRecord, mcpText} from "./validation";

/** Full digest of an unambiguous identity tuple, including server identity. */
export function mcpPublicToolName(serverId: string, rawName: string): string {
    mcpId(serverId); mcpText(rawName, MCP_LIMITS.rawNameBytes);
    return `mcp_${mcpDigest(JSON.stringify([serverId, "tool", rawName])).slice(0, 60)}`;
}

function description(raw: unknown): string {
    if (raw === undefined || raw === "") return "";
    // Newlines in server descriptions are untrusted content, never instructions.
    if (typeof raw !== "string" || /[\p{Cc}\p{Cf}]/u.test(raw.replaceAll("\n", "").replaceAll("\t", "")) || new TextEncoder().encode(raw).byteLength > MCP_LIMITS.textBytes) throw new Error("MCP 描述无效或过长");
    return raw;
}

function tool(raw: unknown, serverId: string): McpToolManifest {
    mcpJson(raw, MCP_LIMITS.toolBytes);
    const record = mcpRecord(raw);
    mcpKeys(record, ["name", "title", "description", "inputSchema", "outputSchema", "annotations", "_meta"]);
    const rawName = mcpText(record.name, MCP_LIMITS.rawNameBytes);
    return {name: mcpPublicToolName(serverId, rawName), rawName, description: description(record.description), inputSchema: compileMcpInputSchema(record.inputSchema).jsonSchema};
}

function resource(raw: unknown, serverId: string): McpResourceManifest {
    const record = mcpRecord(raw);
    mcpKeys(record, ["uri", "name", "title", "description", "mimeType", "size", "annotations", "_meta"]);
    const uri = mcpText(record.uri, 2_048);
    if (!/^[A-Za-z][A-Za-z0-9+.-]*:/u.test(uri)) throw new Error("MCP resource URI 无效");
    return {handleId: `resource_${mcpDigest(JSON.stringify([serverId, uri]))}`, uri, name: mcpText(record.name, 256), description: description(record.description),
        ...(record.mimeType === undefined ? {} : {mimeType: mcpText(record.mimeType, 128)})};
}

/** Captures the whole validated generation or throws before publication. */
export function normalizeMcpManifest(serverId: string, raw: unknown): McpManifest {
    mcpId(serverId);
    mcpJson(raw, MCP_LIMITS.generationBytes, 40, 32_768);
    const record = mcpRecord(raw);
    mcpKeys(record, ["tools", "resources"]);
    if (!Array.isArray(record.tools) || record.tools.length > MCP_LIMITS.tools || !Array.isArray(record.resources) || record.resources.length > MCP_LIMITS.resources) throw new Error("MCP 目录数量超过上限");
    const tools = record.tools.map(item => tool(item, serverId)).sort((a, b) => mcpOrdinal(a.name, b.name));
    const resources = record.resources.map(item => resource(item, serverId)).sort((a, b) => mcpOrdinal(a.handleId, b.handleId));
    if (new Set(tools.map(item => item.rawName)).size !== tools.length || new Set(tools.map(item => item.name)).size !== tools.length || new Set(resources.map(item => item.uri)).size !== resources.length) throw new Error("MCP 目录包含重复名称或资源");
    const revision = mcpDigest(mcpJson({tools, resources}, MCP_LIMITS.generationBytes, 40, 32_768));
    return freezeMcp({version: 1, revision, tools, resources});
}

export function parseMcpBinding(raw: unknown): McpHostBinding {
    const record = mcpRecord(raw);
    mcpKeys(record, ["serverId", "configRevision", "manifestRevision", "registrationId", "hostSessionId", "principalRevision"]);
    const configRevision = mcpInteger(record.configRevision);
    if (!configRevision) throw new Error("MCP 配置版本无效");
    return freezeMcp({serverId: mcpId(record.serverId), configRevision, manifestRevision: mcpId(record.manifestRevision), registrationId: mcpId(record.registrationId), hostSessionId: mcpId(record.hostSessionId), principalRevision: mcpId(record.principalRevision)});
}

export function mcpBindingMatches(a: McpHostBinding, b: McpHostBinding): boolean {
    return a.serverId === b.serverId && a.configRevision === b.configRevision && a.manifestRevision === b.manifestRevision
        && a.registrationId === b.registrationId && a.hostSessionId === b.hostSessionId && a.principalRevision === b.principalRevision;
}

/** Bounded pagination only. A failed traversal returns no partial manifest. */
export async function collectMcpPages<T>(
    fetchPage: (cursor: string | undefined, signal: AbortSignal) => Promise<unknown>,
    parseItem: (item: unknown) => T,
    maximumItems: number,
    signal: AbortSignal,
): Promise<readonly T[]> {
    if (!Number.isInteger(maximumItems) || maximumItems < 0 || maximumItems > MCP_LIMITS.tools) throw new Error("MCP 分页上限无效");
    const items: T[] = [], seen = new Set<string>();
    let cursor: string | undefined;
    for (let pageNumber = 0; pageNumber < MCP_LIMITS.pages; pageNumber++) {
        signal.throwIfAborted();
        const raw = await fetchPage(cursor, signal);
        signal.throwIfAborted();
        mcpJson(raw, MCP_LIMITS.generationBytes, 40, 32_768);
        const page = mcpRecord(raw);
        mcpKeys(page, ["items", "nextCursor"]);
        if (!Array.isArray(page.items) || items.length + page.items.length > maximumItems) throw new Error("MCP 分页数量超过上限");
        items.push(...page.items.map(parseItem));
        if (page.nextCursor === undefined) return Object.freeze(items);
        cursor = mcpText(page.nextCursor, 512);
        if (seen.has(cursor)) throw new Error("MCP 分页游标重复");
        seen.add(cursor);
    }
    throw new Error("MCP 分页超过上限");
}
