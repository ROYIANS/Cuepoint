export type RuntimeHttpPurpose = "configured" | "result-download" | "search-probe";
export type RuntimeHttpScope = {purpose: RuntimeHttpPurpose; probeOrigin?: string};

/** Do not include rejected authored URLs (including signed query values) in errors. */
export function remoteHttpUrl(value: string): URL {
    let url: URL;
    try { url = new URL(value); } catch { throw new Error("网络请求地址无效"); }
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password)
        throw new Error("仅支持不含账号信息的 HTTP(S) 请求地址");
    return url;
}

async function configuredOrigins(): Promise<Set<string>> {
    const {db} = await import("@/db/database");
    const [connectors, search] = await Promise.all([
        db.connectors.toArray(), db.searchConnections.get("tavily"),
    ]);
    const origins = new Set<string>();
    for (const connector of connectors) {
        try { origins.add(remoteHttpUrl(connector.baseUrl).origin); } catch { /* Invalid config grants nothing. */ }
    }
    if (search?.enabled && search.apiKey) origins.add("https://api.tavily.com");
    return origins;
}

/** Native ACL grants persist until restart; this policy rechecks current app configuration. */
export async function authorizeRuntimeHttp(
    url: URL, method: string, headers: Headers, body: BodyInit | null | undefined, scope: RuntimeHttpScope,
): Promise<{origin: string; allowHttp: boolean}> {
    const origins = await configuredOrigins();
    const configured = origins.has(url.origin);
    if (scope.purpose === "result-download") {
        if (method !== "GET" || body != null ||
            ["authorization", "proxy-authorization", "cookie", "cookie2", "x-api-key", "api-key"].some(key => headers.has(key)))
            throw new Error("结果下载只能使用不含鉴权信息的 GET 请求");
        if (url.protocol === "http:" && !configured) throw new Error("结果下载需使用 HTTPS 或明确配置的 HTTP 地址");
    } else if (scope.probeOrigin) {
        if (url.origin !== scope.probeOrigin && !configured) throw new Error("连接测试重定向到了未配置的地址");
    } else if (scope.purpose === "search-probe") {
        if (url.origin !== "https://api.tavily.com") throw new Error("搜索连接测试地址无效");
    } else if (!configured) {
        throw new Error("网络请求地址不属于当前连接配置，请在连接页检查设置");
    }
    return {origin: url.origin, allowHttp: url.protocol === "http:"};
}
