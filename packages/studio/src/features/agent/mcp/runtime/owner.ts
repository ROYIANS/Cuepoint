import {db} from "../../../../platform/product/store";
import {mcpHostServices} from "../../../../platform/runtime/mcpServices";
import type {McpHostServices} from "../../../../platform/runtime/mcp";
import {createMcpConnectionOwner, type McpConnectionOwner} from "./connections";

let installed: {readonly host: McpHostServices; readonly connections: McpConnectionOwner} | undefined;

/** One feature owner beside the fixed host. Admission, execution and management reuse it. */
export function mcpRuntimeOwner(): {readonly host: McpHostServices; readonly connections: McpConnectionOwner} | undefined {
    const host = mcpHostServices();
    if (!host) return undefined;
    if (installed?.host !== host) {
        if (installed) void installed.connections.dispose();
        installed = {host, connections: createMcpConnectionOwner(db, host)};
    }
    return installed;
}
