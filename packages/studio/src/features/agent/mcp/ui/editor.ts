import type {McpPrivateConfig} from "../../../../platform/runtime/mcp";
import type {McpServerConfig} from "../models/connection";

export interface McpEditorDraft {
    readonly serverId: string;
    readonly configRevision: number;
    readonly catalogueRevision: number;
    readonly replacement: boolean;
    readonly dirty: boolean;
    readonly label: string;
    readonly enabled: boolean;
    readonly transport: "stdio" | "streamable_http";
    readonly executable: string;
    readonly args: string;
    readonly cwd: string;
    readonly environment: string;
    readonly endpoint: string;
    readonly auth: "none" | "manual" | "oauth";
    readonly headers: string;
    readonly clientId: string;
    readonly scopes: string;
}

export function newMcpEditor(serverId: string, catalogueRevision: number, stdio: boolean, row?: McpServerConfig): McpEditorDraft {
    return {serverId, catalogueRevision, configRevision: row?.configRevision ?? 0, replacement: !!row, dirty: false,
        label: row?.label ?? "", enabled: row?.enabled ?? false, transport: row?.transport ?? (stdio ? "stdio" : "streamable_http"),
        executable: "", args: "[]", cwd: "", environment: "{}", endpoint: "", auth: row?.auth ?? "none", headers: "{}", clientId: "", scopes: "[]"};
}
function stringArray(text: string, label: string): string[] {
    const value: unknown = JSON.parse(text);
    if (!Array.isArray(value) || !value.every((item: unknown) => typeof item === "string")) throw new Error(`${label}需要 JSON 字符串数组`);
    return value;
}
function stringRecord(text: string, label: string): Record<string, string> {
    const value: unknown = JSON.parse(text);
    if (!value || typeof value !== "object" || Array.isArray(value) || !Object.values(value).every(item => typeof item === "string")) throw new Error(`${label}需要 JSON 字符串对象`);
    return value as Record<string, string>;
}

/** Explicit full replacement only. Private fields are never reconstructed from the public row. */
export function mcpEditorConfig(draft: McpEditorDraft): McpPrivateConfig {
    if (draft.transport === "stdio") return {transport: "stdio", executable: draft.executable.trim(), args: stringArray(draft.args, "参数"),
        ...(draft.cwd.trim() ? {cwd: draft.cwd.trim()} : {}), environment: stringRecord(draft.environment, "环境变量")};
    let auth: Extract<McpPrivateConfig, {transport: "streamable_http"}>["auth"] = {kind: "none"};
    if (draft.auth === "manual") auth = {kind: "manual", headers: stringRecord(draft.headers, "请求头")};
    if (draft.auth === "oauth") auth = {kind: "oauth", ...(draft.clientId.trim() ? {clientId: draft.clientId.trim()} : {}), scopes: stringArray(draft.scopes, "授权范围")};
    return {transport: "streamable_http", endpoint: draft.endpoint.trim(), auth};
}
