export const TASK_RECORD_KINDS = ["research", "approach", "progress", "verification", "question"] as const;
export const TASK_RECORD_CLAIMS = ["observation", "proposal", "decision", "result"] as const;
export type TaskRecordSource = { type: "message" | "tool" | "generation"; id: string };
export interface TaskRecordInput {
  kind: typeof TASK_RECORD_KINDS[number];
  claim: typeof TASK_RECORD_CLAIMS[number];
  title: string;
  body: string;
  sources: TaskRecordSource[];
  todoId?: string;
}
export interface AgentTaskRecord extends TaskRecordInput {
  id: string;
  taskId: string;
  revision: number;
  author: "user" | "ai";
  runId?: string;
  createdAt: string;
  updatedAt: string;
}
export interface AgentTaskRecordVersion extends AgentTaskRecord { versionId: string; recordId: string }
