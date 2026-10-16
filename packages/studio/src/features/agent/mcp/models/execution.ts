import type {McpHostBinding, McpHostTarget} from '../../../../platform/runtime/mcp';

/** Safe durable facts. A prepared host authority, credentials and arguments never belong here. */
export interface McpToolPreviewFacts {
    readonly version: 1;
    readonly binding: McpHostBinding;
    readonly manifestDigest: string;
    readonly publicName: string;
    readonly operation: 'tool' | 'resource_read' | 'resource_list';
    readonly target: McpHostTarget | {readonly kind: 'catalogue'};
}
export interface McpJobSelection {
    readonly kind: 'mcp';
    readonly execution: McpToolPreviewFacts;
    /** The original call's immutable invocation ID; status never creates a new invocation. */
    readonly operationId: string;
}
