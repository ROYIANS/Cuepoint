import type { GenerationMediaInput, ProductionTarget, SourceRevision } from "./production";
import type { GenerationResult, MediaKind } from "./types";

export type AgentGenerationStatus = "submitting" | "unknown" | "submitted" | "running" | "remote_completed" | "downloading" | "downloaded" | "applied" | "conflict" | "failed";
export interface AgentGenerationInput extends GenerationMediaInput { revision: string }
export type AgentGenerationJob = AgentGenerationJobData & (
  { callId: string; batchId?: never; batchItemId?: never } |
  { callId?: never; batchId: string; batchItemId: string }
);
interface AgentGenerationJobData {
  version: 1;
  id: string;
  runId: string;
  threadId: string;
  projectId: string;
  connectorId: string;
  provider: "apimart" | "aihubmix";
  /** No key is persisted. Changing the connector destination blocks recovery. */
  baseUrl: string;
  model: string;
  kind: MediaKind;
  target: ProductionTarget;
  baseRevision: string;
  sourceRevisions: SourceRevision[];
  parameters: Record<string, string | number | boolean>;
  inputs: AgentGenerationInput[];
  fingerprint: string;
  status: AgentGenerationStatus;
  providerTaskId?: string;
  /** Unexpected multi-task responses require manual reconciliation, never resubmission. */
  providerTaskIds?: string[];
  providerStatus?: string;
  progress?: number;
  error?: string;
  result?: GenerationResult;
  createdAt: string;
  updatedAt: string;
}
