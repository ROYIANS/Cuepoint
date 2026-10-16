import type {McpHostServices} from "./mcp";

let installed: McpHostServices | undefined;
let removeListeners: (() => void) | undefined;

/** Installed only beside the fixed native ProductStore; no browser fallback. */
export function installMcpHostServices(services: McpHostServices, events: Pick<Window, "addEventListener" | "removeEventListener"> | undefined = typeof window === "undefined" ? undefined : window): void {
    if (installed) throw new Error("MCP 服务已安装");
    installed = services;
    const close = () => {void clearMcpHostServices(services);};
    events?.addEventListener("pagehide", close);
    removeListeners = () => {
        events?.removeEventListener("pagehide", close);
    };
}

export function mcpHostServices(): McpHostServices | undefined {return installed?.active ? installed : undefined;}

/** Drop local eligibility before awaiting native drainage. */
export function clearMcpHostServices(expected: McpHostServices): Promise<{readonly status: "drained" | "draining"}> {
    if (installed === expected) {
        installed = undefined;
        removeListeners?.();
        removeListeners = undefined;
    }
    return expected.dispose().catch(() => ({status: "draining" as const}));
}
