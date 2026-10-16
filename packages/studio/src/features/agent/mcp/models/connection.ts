import type {McpHostBinding, McpPrivateRevisionRef} from "../../../../platform/runtime/mcp";

/** Device-only safe projection. Never contains launch details, endpoint query or headers. */
export interface McpServerConfig {
    readonly serverId: string;
    readonly configRevision: number;
    readonly label: string;
    readonly enabled: boolean;
    readonly transport: "stdio" | "streamable_http";
    readonly auth: "none" | "manual" | "oauth";
    readonly endpointDisplay?: string;
    readonly privateRevision: McpPrivateRevisionRef;
}

export interface McpMutationExpectation {
    readonly operationId: string;
    readonly catalogueRevision: number;
}

export type McpCatalogueMutation = McpMutationExpectation & (
    | {readonly kind: "save"; readonly serverId: string; readonly expectedConfigRevision: number;
        readonly config: Omit<McpServerConfig, "serverId" | "configRevision">}
    | {readonly kind: "set_enabled"; readonly serverId: string; readonly expectedConfigRevision: number; readonly enabled: boolean}
    | {readonly kind: "remove"; readonly serverId: string; readonly expectedConfigRevision: number});

export interface McpMutationReceipt {
    readonly operationId: string;
    readonly fingerprint: string;
    readonly kind: McpCatalogueMutation["kind"];
    readonly serverId: string;
    readonly catalogueRevision: number;
    readonly configRevision: number;
    readonly publishedPrivateRevision?: McpPrivateRevisionRef;
    readonly retiredPrivateRevision?: McpPrivateRevisionRef;
}

export interface McpCatalogue {
    readonly version: 1;
    readonly revision: number;
    readonly entries: readonly McpServerConfig[];
    /** Bounded positive receipts; missing/evicted receipt never proves rollback. */
    readonly receipts: readonly McpMutationReceipt[];
}

export type McpMutationReconciliation = {readonly status: "committed"; readonly receipt: McpMutationReceipt}
    | {readonly status: "unresolved"} | {readonly status: "conflict"};

export interface McpConnectedGeneration {
    readonly binding: McpHostBinding;
    readonly label: string;
    readonly enabled: boolean;
}
