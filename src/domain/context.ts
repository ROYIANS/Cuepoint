import type { AgentRequestMessage, AgentRun, AgentTokenUsage } from "./agent";

export interface ContextPolicy {
  autoCompress: boolean;
  limitHistory: boolean;
  historyMessageCount: number;
  /** Explicit local budget, never presented as provider metadata. */
  customContextTokens?: number;
}
export interface ContextSource { id: string; role: "user" | "assistant" | "system"; content: string }
export interface ContextSnapshot {
  policy: ContextPolicy;
  capacity?: number;
  capacitySource?: string;
  history: ContextSource[];
  summaryId?: string;
  /** Current base envelope; tool continuation is always appended after it. */
  baseMessages: AgentRequestMessage[];
  draft: string;
}
export interface ContextCompaction {
  id: string;
  threadId: string;
  runId: string;
  previousSummaryId?: string;
  status: "running" | "completed" | "failed" | "interrupted";
  /** Exact source coverage allows validation without hash collision ambiguity. */
  coverage: ContextSource[];
  input: AgentRequestMessage[];
  policy: ContextPolicy;
  connector: AgentRun["connector"];
  model: string;
  content: string;
  beforeTokens: number;
  afterTokens?: number;
  usage?: AgentTokenUsage;
  error?: string;
  createdAt: string;
  updatedAt: string;
  activatedAt?: string;
}
