import type {McpPrivateConfig} from "../../../../platform/runtime/mcp";
import type {McpMutationExpectation, McpMutationReceipt} from "./connection";

export interface McpSaveIntent extends McpMutationExpectation {
    readonly serverId: string;
    readonly expectedConfigRevision: number;
    readonly label: string;
    readonly enabled: boolean;
    readonly privateConfig: McpPrivateConfig;
}

export type McpConfigurationOutcome = {readonly status: "committed"; readonly receipt: McpMutationReceipt; readonly hostConfirmed: boolean; readonly cleanupPending: boolean}
    | {readonly status: "unknown"; readonly operationId: string}
    | {readonly status: "rejected"; readonly operationId: string; readonly code: "conflict" | "unavailable"; readonly cleanupPending: boolean};
