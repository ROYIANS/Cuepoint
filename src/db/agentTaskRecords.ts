import { db } from "./database";
import { editableAgentTask } from "./agentTasks";
import type { AgentTaskRecord, TaskRecordInput, TaskRecordSource } from "@/domain/agentTaskRecords";
import { TASK_RECORD_KINDS, TASK_RECORD_CLAIMS } from "@/domain/agentTaskRecords";
import type { AgentTask, AgentToolCall } from "@/domain/agent";
import { createId, nowIso } from "@/lib/ids";

export async function listTaskRecords(taskId: string): Promise<AgentTaskRecord[]> {
  return db.agentTaskRecords.where("taskId").equals(taskId).sortBy("updatedAt");
}
export async function listTaskRecordVersions(taskId: string, recordId: string) {
  const record = await db.agentTaskRecords.get(recordId);
  if (!record || record.taskId !== taskId) throw new Error("记录不属于当前任务");
  return db.agentTaskRecordVersions.where("recordId").equals(recordId).sortBy("revision");
}
/** A completed ledger entry may describe a failed remote job or an apply conflict. */
export function provesCompletedEffect(call: AgentToolCall): boolean {
  let value: unknown;
  try { value = JSON.parse(call.result ?? "null"); } catch { return false; }
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const result = value as Record<string, unknown>;
  if (result.error || result.ok === false || result.success === false) return false;
  if (["submit_generation", "check_generation", "apply_generation"].includes(call.name)) {
    const media = result.result as { mediaId?: unknown; kind?: unknown } | undefined;
    return (call.name === "apply_generation" ? result.status === "applied" && result.applied === true : result.status === "downloaded" || result.status === "applied") &&
      typeof media?.mediaId === "string" && !!media.mediaId && (media.kind === "image" || media.kind === "video");
  }
  // Other network tools can report a check without producing a business result.
  return call.effect === "write" && result.applied !== false;
}
export async function validateTaskSources(task: Pick<AgentTask, "id" | "threadId">, sources: TaskRecordSource[], claim: TaskRecordInput["claim"], author: "ai" | "user") {
  if (!Array.isArray(sources) || sources.length > 12) throw new Error("来源最多 12 项");
  let userEvidence = false, completedEffect = false;
  for (const source of sources) {
    if (!source.id || source.id.length > 120) throw new Error("来源标识无效");
    if (source.type === "message") {
      const message = await db.chatMessages.get(source.id);
      if (!message || message.threadId !== task.threadId || message.role !== "user" || (!message.content.trim() && !message.attachments?.length)) throw new Error("只能引用当前对话真实的用户消息");
      userEvidence = true;
    } else if (source.type === "tool") {
      const call = await db.agentToolCalls.get(source.id);
      const run = call && await db.agentRuns.get(call.runId);
      if (!call || !run || call.threadId !== task.threadId || run.threadId !== task.threadId || run.taskId !== task.id || call.status !== "completed" || !call.result || call.effect === "bookkeeping") throw new Error("来源不是当前任务已完成的业务工具结果");
      completedEffect ||= provesCompletedEffect(call);
    } else throw new Error("来源类型无效");
  }
  if (author === "ai" && claim === "decision" && !userEvidence) throw new Error("确认决策必须引用用户消息");
  if (author === "ai" && claim === "result" && !completedEffect) throw new Error("完成结果必须引用已完成的实际业务操作");
  if (author === "ai" && claim === "observation" && sources.length === 0) throw new Error("调研观察必须附真实来源；未核实内容请记为方案或待解决问题");
}

/** Transaction-internal write, shared by guarded manual saves and ledger-atomic tools. */
export async function writeTaskRecord(task: AgentTask, input: TaskRecordInput, options: { id?: string; expectedRevision?: number; author: "user" | "ai"; runId?: string; requirementSnapshot?: boolean }): Promise<AgentTaskRecord> {
  if (task.lifecycle !== "open") throw new Error("请先重新打开任务");
  if (!TASK_RECORD_KINDS.includes(input.kind) || !TASK_RECORD_CLAIMS.includes(input.claim) || !input.title.trim() || input.title.length > 120 || !input.body.trim() || input.body.length > (options.requirementSnapshot ? 100_000 : 12_000)) throw new Error("记录类型或内容无效：标题最多 120 字，正文最多 12,000 字");
  if (input.todoId && !task.plan.some((item) => item.id === input.todoId)) throw new Error("关联 Todo 不存在");
  await validateTaskSources(task, input.sources, input.claim, options.author);
  const existing = options.id ? await db.agentTaskRecords.get(options.id) : undefined;
  if (options.id && (!existing || existing.taskId !== task.id)) throw new Error("记录不属于当前任务");
  if (existing && options.expectedRevision !== existing.revision) throw new Error("记录已更新，请重新读取后修改");
  if (!existing && options.expectedRevision !== undefined) throw new Error("新记录不应指定旧版本");
  if (!existing && options.runId) {
    const duplicate = (await listTaskRecords(task.id)).find((record) => record.runId === options.runId && record.author === options.author && record.kind === input.kind && record.claim === input.claim && record.title === input.title.trim() && record.body === input.body.trim() && record.todoId === input.todoId && JSON.stringify(record.sources) === JSON.stringify(input.sources));
    if (duplicate) return duplicate;
  }
  const at = nowIso();
  const record: AgentTaskRecord = { ...input, title: input.title.trim(), body: input.body.trim(), id: existing?.id ?? createId("trec"), taskId: task.id, revision: (existing?.revision ?? 0) + 1, author: options.author, runId: options.runId, createdAt: existing?.createdAt ?? at, updatedAt: at };
  await db.agentTaskRecords.put(record);
  await db.agentTaskRecordVersions.add({ ...record, recordId: record.id, versionId: `${record.id}:${record.revision}` });
  await db.agentTasks.update(task.id, { updatedAt: at });
  return record;
}
export async function saveTaskRecord(taskId: string, input: TaskRecordInput, options: { id?: string; expectedRevision?: number } = {}): Promise<AgentTaskRecord> {
  return db.transaction("rw", [db.agentTasks, db.chatThreads, db.agentRuns, db.chatMessages, db.agentToolCalls, db.agentTaskRecords, db.agentTaskRecordVersions, db.agentTaskWrapups, db.projects], async () => writeTaskRecord(await editableAgentTask(taskId), input, { ...options, author: "user" }));
}
