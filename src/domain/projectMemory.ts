export type MemoryCategory =
  "convention" | "preference" | "decision" | "lesson";
export type MemoryStatus =
  "active" | "disabled" | "superseded" | "pending_review";
export interface MemoryInput {
  category: MemoryCategory;
  title: string;
  topicKey: string;
  body: string;
  applicability: string;
  tags: string[];
}
export interface MemorySourceRef {
  taskId: string;
  summaryId: string;
  summaryRevision: number;
  itemKind: "decision" | "lesson";
  itemIndex: number;
  itemText: string;
}
export interface MemoryEvidence {
  id: string;
  label: string;
  body: string;
  truncated: boolean;
}
export type MemorySource =
  | { kind: "manual" }
  | (MemorySourceRef & {
      kind: "summary";
      projectId: string;
      threadId: string;
      taskTitle: string;
      confirmedAt: string;
      excerpt: string;
      evidence: MemoryEvidence[];
    })
  | {
      kind: "imported";
      originProjectId: string;
      originMemoryId: string;
      originalKind: "manual" | "summary" | "imported";
      excerpt: string;
      evidence?: MemoryEvidence[];
      taskTitle?: string;
      summaryId?: string;
      summaryRevision?: number;
    };
export interface ProjectMemory extends MemoryInput {
  id: string;
  projectId: string;
  status: MemoryStatus;
  revision: number;
  supersededBy?: string;
  source: MemorySource;
  createdAt: string;
  updatedAt: string;
  reviewedAt?: string;
}
export interface ProjectMemoryVersion {
  versionId: string;
  memoryId: string;
  projectId: string;
  revision: number;
  reason: string;
  snapshot: ProjectMemory;
}
export interface MemorySourceState {
  state: "human" | "confirmed" | "historical" | "missing" | "imported";
  href?: string;
  message: string;
}
export interface MemoryCandidate {
  ref: MemorySourceRef;
  input: MemoryInput;
  source: Extract<MemorySource, { kind: "summary" }>;
  state: "confirmed" | "historical";
  href: string;
}
export interface MemorySaveOptions {
  replace?: { id: string; expectedRevision: number };
}
export interface MemorySaveResult {
  memory: ProjectMemory;
  duplicate: boolean;
}
