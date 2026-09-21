import type { AgentReferenceInput, AgentReferenceAudit, AgentVisionCapability } from "./referenceInput";
import type { MemorySelection, MemoryDispatchAudit } from "./memoryRetrieval";
import type { ProjectContextSnapshot } from "./projectContext";
import type { GenerationPreferences } from "./generationPreferences";
import type { ContextPolicy, ContextSnapshot } from "./context";
import type { ConnectorConfig, Id } from "@/domain/types";

export interface AgentConfig {
  generationPreferences?: GenerationPreferences;
  contextPolicy?: ContextPolicy;
  id: Id;
  name: string;
  instructions: string;
  updatedAt: string;
  permissionMode?: AgentPermissionMode;
  enabledSkillIds?: string[];
  skillDefaultsVersion?: number;
}

export type AgentReasoningEffort = "none" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max";

export type AgentRunStatus = "running" | "waiting_approval" | "completed" | "failed" | "cancelled" | "interrupted";
export type AgentPermissionMode = "ask" | "assist" | "full";
export type AgentInteractionMode = "smart" | "conversation";
export interface AgentWireToolCall { id: string; type: "function"; function: { name: string; arguments: string } }
export interface AgentToolSchema { type: "function"; function: { name: string; description: string; parameters: Record<string, unknown> } }
export type AgentRequestMessage = (
  | { role: "user" | "system"; content: string }
  | { role: "assistant"; content: string; tool_calls?: AgentWireToolCall[] }
  | { role: "tool"; content: string; tool_call_id: string }) & { referenceInput?: AgentReferenceInput; sourceToolCallId?: string };
export interface AgentPlanItem { id: string; title: string; status: "pending" | "in_progress" | "completed" }
export type AgentToolCallStatus = "pending" | "awaiting_approval" | "approved" | "running" | "completed" | "failed" | "rejected" | "unknown";
export type AgentToolEffect = "read" | "write" | "network" | "bookkeeping";
export interface AgentToolPreview {
  summary: string;
  changes: string[];
  revision?: string;
  target?: { label: string; href: string };
}
export interface AgentToolCall {
  /** Explicit user-reviewed request; original provider arguments/envelopes stay immutable. */
  generationOverride?: { arguments: string; preview: AgentToolPreview };
  requiresConfirmation?: boolean;
  preview?: AgentToolPreview;
  atomic?: boolean;
  recovery?: "generation" | "repeatable";
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
export type AgentResponseItem = (
  | { type: "message"; role: "system" | "user" | "assistant"; content: string | Array<{ type: "output_text"; text: string; annotations: unknown[] }>; id?: string; status?: "completed"; phase?: string }
  | { type: "reasoning"; id?: string; summary: Array<{ type: "summary_text"; text: string }>; encrypted_content?: string }
  | { type: "function_call"; id?: string; call_id: string; name: string; arguments: string; status?: "completed" }
  | { type: "function_call_output"; call_id: string; output: string }) & { referenceInput?: AgentReferenceInput; sourceToolCallId?: string };

/** Provider-reported counts only; absence is unknown, never zero. */
export interface AgentTokenUsage { cachedInputTokens?: number; inputTokens?: number; outputTokens?: number; totalTokens?: number }
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

export interface AgentToolGroupSnapshot {
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

/** Frozen execution inputs. Credentials are resolved from the connector at dispatch. */
export interface AgentRun {
  visionCapability?: AgentVisionCapability;
  referenceAudit?: AgentReferenceAudit[];
  memorySelection?: MemorySelection;
  memoryAudit?: MemoryDispatchAudit[];
  projectId?: Id;
  projectContext?: ProjectContextSnapshot;
  /** Frozen task-intake eligibility; never inferred from model arguments. */
  taskMode?: boolean;
  context?: ContextSnapshot;
  id: Id;
  threadId: Id;
  taskId?: Id;
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
  activitySteps?: AgentActivityStep[];
  usage?: AgentTokenUsage;
  outputTokensPerSecond?: number;
  connector: Pick<ConnectorConfig, "id" | "definitionId" | "baseUrl">;
  requestMessages: AgentRequestMessage[];
  status: AgentRunStatus;
  permissionMode?: AgentPermissionMode;
  /** Frozen per-run execution surface. Conversation mode never exposes tools. */
  interactionMode?: AgentInteractionMode;
  enabledToolNames?: string[];
  /** Absent on legacy runs: retain their original full-tool surface. */
  toolLoading?: AgentToolLoading;
  offeredTools?: Array<{ step: number; names: string[] }>;
  skillInstructions?: string;
  continuationMessages?: AgentRequestMessage[];
  modelStep?: number;
  /** Cumulative step at the last explicit budget continuation; legacy runs start at zero. */
  modelStepSegmentStart?: number;
  pauseReason?: "model_step_limit";
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
export const MODEL_STEPS_PER_SEGMENT = 32;

export interface AgentTask {
  projectId: Id;
  acceptanceCriteria?: string[];
  revision?: number;
  id: Id;
  threadId: Id;
  title: string;
  goal: string;
  agentId: Id;
  plan: AgentPlanItem[];
  lifecycle: "open" | "completed" | "archived";
  artifacts: Array<{ id: Id; runId: Id; messageId: Id; createdAt: string }>;
  createdAt: string;
  updatedAt: string;
}
