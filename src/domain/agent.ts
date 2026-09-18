import type { ConnectorConfig, Id } from "@/domain/types";

export interface AgentConfig {
  id: Id;
  name: string;
  instructions: string;
  updatedAt: string;
  permissionMode?: AgentPermissionMode;
  enabledSkillIds?: string[];
}

export type AgentReasoningEffort = "none" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max";

export type AgentRunStatus = "running" | "waiting_approval" | "completed" | "failed" | "cancelled" | "interrupted";
export type AgentPermissionMode = "ask" | "assist" | "full";
export type AgentInteractionMode = "smart" | "conversation";
export interface AgentWireToolCall { id: string; type: "function"; function: { name: string; arguments: string } }
export interface AgentToolSchema { type: "function"; function: { name: string; description: string; parameters: Record<string, unknown> } }
export type AgentRequestMessage =
  | { role: "user" | "system"; content: string }
  | { role: "assistant"; content: string; tool_calls?: AgentWireToolCall[] }
  | { role: "tool"; content: string; tool_call_id: string };
export interface AgentPlanItem { id: string; title: string; status: "pending" | "in_progress" | "completed" }
export type AgentToolCallStatus = "pending" | "awaiting_approval" | "approved" | "running" | "completed" | "failed" | "rejected" | "unknown";
export type AgentToolEffect = "read" | "write" | "network" | "bookkeeping";
export interface AgentToolCall {
  id: string;
  runId: string;
  threadId: string;
  providerCallId: string;
  step: number;
  order: number;
  name: string;
  title: string;
  arguments: string;
  effect: AgentToolEffect;
  highRisk: boolean;
  status: AgentToolCallStatus;
  result?: string;
  error?: string;
  decision?: "approve" | "reject";
  decidedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type AgentProtocol = "chat-completions" | "responses";
/** Opaque provider continuation lives only in the run, never in display messages. */
export type AgentResponseItem =
  | { type: "message"; role: "system" | "user" | "assistant"; content: string | Array<{ type: "output_text"; text: string; annotations: unknown[] }>; id?: string; status?: "completed"; phase?: string }
  | { type: "reasoning"; id?: string; summary: Array<{ type: "summary_text"; text: string }>; encrypted_content?: string }
  | { type: "function_call"; id?: string; call_id: string; name: string; arguments: string; status?: "completed" }
  | { type: "function_call_output"; call_id: string; output: string };

/** Provider-reported counts only; absence is unknown, never zero. */
export interface AgentTokenUsage { inputTokens?: number; outputTokens?: number; totalTokens?: number }
export interface AgentModelMetrics {
  step: number;
  startedAt: number;
  firstTokenAt?: number;
  endedAt: number;
  usage?: AgentTokenUsage;
}

/** Frozen execution inputs. Credentials are resolved from the connector at dispatch. */
export interface AgentRun {
  id: Id;
  threadId: Id;
  agentId: Id;
  agentSnapshot: Pick<AgentConfig, "name" | "instructions">;
  userMessageId: Id;
  assistantMessageId: Id;
  retryOfRunId?: Id;
  model: string;
  reasoningEffort?: AgentReasoningEffort;
  protocol?: AgentProtocol;
  responseItems?: AgentResponseItem[];
  modelMetrics?: AgentModelMetrics[];
  usage?: AgentTokenUsage;
  outputTokensPerSecond?: number;
  connector: Pick<ConnectorConfig, "id" | "definitionId" | "baseUrl">;
  requestMessages: AgentRequestMessage[];
  status: AgentRunStatus;
  permissionMode?: AgentPermissionMode;
  /** Frozen per-run execution surface. Conversation mode never exposes tools. */
  interactionMode?: AgentInteractionMode;
  enabledToolNames?: string[];
  skillInstructions?: string;
  continuationMessages?: AgentRequestMessage[];
  modelStep?: number;
  hasToolCalls?: boolean;
  plan?: AgentPlanItem[];
  checkpoint: number;
  error?: string;
  finishReason?: string;
  createdAt: string;
  updatedAt: string;
  endedAt?: string;
}

export interface AgentRunOutput {
  content: string;
  reasoning?: string;
  reasoningDurationMs?: number;
}

export const GENERAL_AGENT_ID = "agent_general";
