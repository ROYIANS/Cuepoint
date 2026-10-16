export const MCP_HOST_ERROR_CODES = ["invalid", "retired", "denied", "canceled", "reply_lost", "stopped", "session_expired", "remote_error", "unsupported", "vault_unavailable", "vault_unknown", "conflict", "auth_required", "oauth_failed", "timeout", "limit", "draining", "closed", "transport", "protocol"] as const;
export type McpHostErrorCode = (typeof MCP_HOST_ERROR_CODES)[number];

function message(code: McpHostErrorCode, certainty: "not_started" | "unknown"): string {
    if (code === "auth_required") return "MCP 连接需要登录";
    if (code === "denied") return "未获得启动本机 MCP 服务的确认，服务没有启动";
    if (code === "closed" || code === "retired") return "MCP 连接已关闭，请重新连接";
    if (certainty === "unknown") return "无法确认这次 MCP 操作的结果，请先核对原操作";
    return "MCP 操作未能完成，请检查连接设置";
}

/** Deliberately has no raw cause/payload: diagnostics may only see safe code and certainty. */
export class McpHostError extends Error {
    readonly name = "McpHostError";
    constructor(readonly code: McpHostErrorCode, readonly certainty: "not_started" | "unknown", readonly operationId: string) {
        super(message(code, certainty));
    }
}
