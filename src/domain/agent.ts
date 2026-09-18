import type { ChatMessageRole, ConnectorConfig, Id } from "@/domain/types";

export interface AgentConfig {
  id: Id;
  name: string;
  instructions: string;
  updatedAt: string;
}

export type AgentRunStatus = "running" | "completed" | "failed" | "cancelled" | "interrupted";
export interface AgentRequestMessage { role: ChatMessageRole; content: string }

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
  connector: Pick<ConnectorConfig, "id" | "definitionId" | "baseUrl">;
  requestMessages: AgentRequestMessage[];
  status: AgentRunStatus;
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
