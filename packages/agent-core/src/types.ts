export type AgentReasoningEffort = "none" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max";

export type AgentRunStatus = "running" | "waiting_approval" | "completed" | "failed" | "cancelled" | "interrupted";
export type AgentPermissionMode = "ask" | "assist" | "full";
export type AgentInteractionMode = "smart" | "conversation";

export interface AgentWireToolCall {
    id: string;
    type: "function";
    function: { name: string; arguments: string }
}

export interface AgentToolSchema {
    type: "function";
    function: { name: string; description: string; parameters: Record<string, unknown> }
}

export type AgentToolCallStatus =
    "pending"
    | "awaiting_approval"
    | "approved"
    | "running"
    | "completed"
    | "failed"
    | "rejected"
    | "unknown";
export type AgentToolEffect = "read" | "write" | "network" | "bookkeeping";

export interface AgentTokenUsage {
    cachedInputTokens?: number;
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number
}

export interface AgentModelMetrics {
    step: number;
    startedAt: number;
    firstTokenAt?: number;
    endedAt: number;
    usage?: AgentTokenUsage;
}

/** Public model output saved with a tool round; never opaque provider reasoning. */
export interface AgentActivityStep {
    step: number;
    content: string;
    reasoning?: string;
    reasoningDurationMs?: number;
}

interface AgentToolGroupSnapshot {
    id: string;
    name: string;
    description: string;
    instructions: string;
    toolNames: string[];
}

export interface AgentToolLoading {
    version: 1;
    groups: AgentToolGroupSnapshot[];
    foundationToolNames: string[];
    foundationInstructions: string;
    loadedGroupIds: string[];
    loadedToolNames: string[];
}

export interface AgentRunOutput {
    content: string;
    reasoning?: string;
    reasoningDurationMs?: number;
}

export const MODEL_STEPS_PER_SEGMENT = 32;
