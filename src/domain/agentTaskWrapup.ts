export interface WrapupItem { text: string; sourceIds: string[] }
export interface WrapupContent {
  overview: string;
  results: WrapupItem[];
  acceptance: Array<{ criterionIndex: number; criterion: string; status: "met" | "unmet" | "review"; note: string; sourceIds: string[] }>;
  decisions: WrapupItem[];
  lessons: WrapupItem[];
  unresolved: WrapupItem[];
}
export interface WrapupEvidence {
  id: string;
  kind: "message" | "tool" | "record" | "generation" | "entity" | "reference";
  label: string;
  body: string;
  outcome: "fact" | "downloaded" | "applied" | "unresolved";
  available: boolean;
  href?: string;
  truncated?: boolean;
  supportsResult?: boolean;
  reference?: { projectId: string; referenceId: string; revision: number };
}
export interface WrapupSnapshot {
  fingerprint: string;
  taskRevision: number;
  criteria: string[];
  evidence: WrapupEvidence[];
  coverage: { total: number; included: number; omitted: number; truncated: number };
}
export interface AgentTaskWrapup {
  id: string;
  taskId: string;
  threadId: string;
  revision: number;
  status: "preparing" | "draft" | "failed" | "interrupted";
  author: "ai" | "user";
  content: WrapupContent;
  snapshot: WrapupSnapshot;
  confirmedAt?: string;
  createdAt: string;
  updatedAt: string;
  error?: string;
}
export interface AgentTaskWrapupVersion extends AgentTaskWrapup { versionId: string }
export interface TaskWrapupState {
  latest?: AgentTaskWrapup;
  confirmed?: AgentTaskWrapup;
  history: AgentTaskWrapup[];
  stale: boolean;
  currentEvidence: WrapupEvidence[];
  completionBlockers: string[];
}
