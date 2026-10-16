import type {McpHostBinding} from "../../../../platform/runtime/mcp";

export interface McpToolManifest {
    readonly name: string;
    readonly rawName: string;
    readonly description: string;
    readonly inputSchema: Readonly<Record<string, unknown>>;
}
export interface McpResourceManifest {
    readonly handleId: string;
    readonly uri: string;
    readonly name: string;
    readonly description: string;
    readonly mimeType?: string;
}
export interface McpManifest {
    readonly version: 1;
    readonly revision: string;
    readonly tools: readonly McpToolManifest[];
    readonly resources: readonly McpResourceManifest[];
}
export interface McpRunGeneration {
    readonly binding: McpHostBinding;
    readonly label: string;
    readonly manifest: McpManifest;
}
export interface McpRunSnapshot {
    readonly version: 1;
    readonly generations: readonly McpRunGeneration[];
    readonly foundationToolNames: readonly string[];
    readonly groups: readonly {readonly id: string; readonly name: string; readonly toolNames: readonly string[]}[];
}
