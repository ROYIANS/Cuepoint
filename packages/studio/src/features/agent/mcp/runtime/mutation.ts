import type {McpCatalogueMutation} from "../models/connection";
import {MCP_LIMITS} from "./limits";
import {parseMcpServerConfig} from "./records";
import {mcpDigest, mcpId, mcpInteger, mcpJson, mcpKeys, mcpRecord} from "./validation";

export function parseMcpMutation(raw: McpCatalogueMutation): McpCatalogueMutation {
    mcpJson(raw, MCP_LIMITS.catalogueBytes);
    const input = mcpRecord(raw);
    const extra = [];
    if (input.kind === "save") extra.push("config");
    if (input.kind === "set_enabled") extra.push("enabled");
    mcpKeys(input, ["kind", "operationId", "catalogueRevision", "serverId", "expectedConfigRevision", ...extra]);
    const base = {operationId: mcpId(input.operationId), catalogueRevision: mcpInteger(input.catalogueRevision), serverId: mcpId(input.serverId), expectedConfigRevision: mcpInteger(input.expectedConfigRevision)};
    switch (input.kind) {
        case "save": {
            const config = mcpRecord(input.config);
            mcpKeys(config, ["label", "enabled", "transport", "auth", "endpointDisplay", "privateRevision"]);
            const {serverId: _serverId, configRevision: _configRevision, ...owned} = parseMcpServerConfig({...config, serverId: base.serverId, configRevision: base.expectedConfigRevision + 1});
            return {kind: "save", ...base, config: owned};
        }
        case "set_enabled":
            if (typeof input.enabled !== "boolean") throw new Error("MCP 启用状态无效");
            return {kind: "set_enabled", ...base, enabled: input.enabled};
        case "remove": return {kind: "remove", ...base};
        default: throw new Error("MCP 目录操作无效");
    }
}

export function mcpMutationFingerprint(input: McpCatalogueMutation): string {return mcpDigest(JSON.stringify(parseMcpMutation(input)));}
