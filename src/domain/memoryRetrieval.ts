import type { MemoryCategory, MemorySource } from "./projectMemory";
export interface MemorySelectionEntry {
  id: string;
  revision: number;
  title: string;
  category: MemoryCategory;
  inclusion: "project" | "relevant";
  body: string;
  applicability: string;
  source: MemorySource;
  reason: string;
}
export interface MemorySelection {
  projectId: string;
  query: string;
  plannerVersion: 1;
  fingerprint: string;
  entries: MemorySelectionEntry[];
  envelope: string;
  estimatedTokens: number;
  budget: number;
  eligibleCount: number;
  selectedCount: number;
  omittedCount: number;
}
export interface MemoryDispatchAudit {
  step: number;
  preparedAt: string;
  selection: MemorySelection;
}
export interface MemoryQueryOptions {
  projectId: string;
  threadId?: string;
  draft: string;
  recentUserTurns?: readonly string[];
  taskTitle?: string;
  taskGoal?: string;
  capacity?: number;
}
