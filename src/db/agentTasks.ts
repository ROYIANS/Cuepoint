import { assertTaskWrapupCompletion } from "./agentTaskWrapups";
import { writeTaskRecord } from "./agentTaskRecords";
import { getGeneralAgentConfig } from "./agentSettings";
import { normalizeContextPolicy } from "@/lib/agent/contextPolicy";
import { db } from "@/db/database";
import { GENERAL_AGENT_ID, type AgentTask, type AgentPlanItem } from "@/domain/agent";
import { createId, nowIso } from "@/lib/ids";
import { deriveChatTitle } from "@/lib/chatTitle";
import { isTaskBusy, validateTaskPlan, formatTaskRequirements } from "@/lib/agent/taskState";

export type TaskInput = { projectId?: string; title: string; goal: string; plan?: AgentPlanItem[]; acceptanceCriteria?: string[] };
const tables = () => db.tables;
export function taskFields(input: TaskInput) {
  const title = input.title.trim();
  const goal = input.goal.trim();
  if (!title || title.length > 120 || !goal || goal.length > 20_000) throw new Error("请填写任务名称与目标（名称最多 120 字，目标最多 20,000 字）");
  const acceptanceCriteria = input.acceptanceCriteria ?? [];
  if (acceptanceCriteria.length > 20 || acceptanceCriteria.some((value) => !value.trim() || value.length > 500)) throw new Error("验收要求最多 20 项，每项 1–500 字");
  return { title, goal, acceptanceCriteria: acceptanceCriteria.map((value) => value.trim()), plan: validateTaskPlan(input.plan ?? []) };
}
export async function editableAgentTask(id: string) {
  const task = await db.agentTasks.get(id);
  if (!task || !(await db.chatThreads.get(task.threadId))) throw new Error("任务或关联对话不存在");
  if (!task.projectId || !await db.projects.get(task.projectId)) throw new Error("关联项目已不存在，任务仅供查看");
  if (await db.agentTaskWrapups.where("taskId").equals(id).filter((record) => record.status === "preparing").count()) throw new Error("总结正在整理，请先等待或停止");
  const runs = await db.agentRuns.where("threadId").equals(task.threadId).toArray();
  if (isTaskBusy(runs)) throw new Error("请先处理当前执行，再修改任务");
  return task;
}

/** Can be nested inside beginAgentRun's transaction; creation never dispatches a request. */
export async function createAgentTaskForThread(threadId: string, input: TaskInput): Promise<AgentTask> {
  return db.transaction("rw", [db.agentTasks, db.chatThreads, db.agentRuns, db.projects], async () => {
    const thread = await db.chatThreads.get(threadId);
    if (!thread) throw new Error("对话不存在");
    if (!thread.projectId || !await db.projects.get(thread.projectId) || input.projectId && input.projectId !== thread.projectId) throw new Error("任务需要绑定可用项目");
    const existing = await db.agentTasks.where("threadId").equals(threadId).first();
    if (existing) return existing;
    const runs = await db.agentRuns.where("threadId").equals(threadId).toArray();
    if (isTaskBusy(runs)) throw new Error("请先处理当前执行，再关联任务");
    const at = nowIso();
    const task: AgentTask = { ...taskFields(input), id: createId("task"), projectId: thread.projectId, threadId, agentId: GENERAL_AGENT_ID, revision: 1, lifecycle: "open", artifacts: [], createdAt: at, updatedAt: at };
    await db.agentTasks.add(task);
    return task;
  });
}

export async function createAgentTask(input: TaskInput): Promise<AgentTask> {
  const clean = taskFields(input);
  if (!input.projectId || !await db.projects.get(input.projectId)) throw new Error("请选择任务所属项目");
  return db.transaction("rw", tables(), async () => {
    const at = nowIso();
    const threadId = createId("cth");
    await db.chatThreads.add({ contextPolicy: normalizeContextPolicy((await getGeneralAgentConfig()).contextPolicy), id: threadId, projectId: input.projectId, title: deriveChatTitle(clean.title), createdAt: at, updatedAt: at });
    return createAgentTaskForThread(threadId, clean);
  });
}

export async function updateAgentTask(id: string, patch: Partial<TaskInput>, expectedRevision?: number): Promise<void> {
  await db.transaction("rw", tables(), async () => {
    const task = await editableAgentTask(id);
    if (task.lifecycle !== "open") throw new Error("请先重新打开任务");
    if (expectedRevision !== undefined && expectedRevision !== (task.revision ?? 1)) throw new Error("任务已更新，请重新读取后修改");
    if (patch.projectId !== undefined && patch.projectId !== task.projectId) throw new Error("已有任务不能切换项目");
    const next = taskFields({ ...task, ...patch });
    await writeTaskRecord(task, { kind: "approach", claim: "decision", title: "用户修订任务要求", body: `调整前\n${formatTaskRequirements(task)}\n\n调整后\n${formatTaskRequirements(next)}`, sources: [] }, { author: "user", requirementSnapshot: true });
    await db.agentTasks.update(id, { ...next, revision: (task.revision ?? 1) + 1, updatedAt: nowIso() });
  });
}

export async function setAgentTaskLifecycle(id: string, lifecycle: AgentTask["lifecycle"], expectedReview?: { id: string; revision: number }): Promise<void> {
  await db.transaction("rw", tables(), async () => {
    const task = await editableAgentTask(id);
    if (!["open", "completed", "archived"].includes(lifecycle)) throw new Error("任务状态无效");
    if (lifecycle === "completed" && task.plan.some((item) => item.status !== "completed")) throw new Error("还有未完成的步骤，请先更新计划");
    if (lifecycle === "completed") await assertTaskWrapupCompletion(task, expectedReview);
    await db.agentTasks.update(id, { lifecycle, ...(lifecycle === "open" && task.lifecycle !== "open" ? { revision: (task.revision ?? 1) + 1 } : {}), updatedAt: nowIso() });
  });
}

export async function pinAgentTaskResult(id: string, runId: string): Promise<void> {
  await db.transaction("rw", tables(), async () => {
    const task = await editableAgentTask(id);
    if (task.lifecycle !== "open") throw new Error("请先重新打开任务");
    const run = await db.agentRuns.get(runId);
    const message = run ? await db.chatMessages.get(run.assistantMessageId) : undefined;
    if (!run || run.taskId !== id || run.threadId !== task.threadId || run.status !== "completed" || !message ||
      message.runId !== runId || message.threadId !== task.threadId || message.role !== "assistant" || message.status !== "complete" || !message.content.trim()) throw new Error("只能保存当前任务已完成的回复");
    if (task.artifacts.some((item) => item.runId === runId)) return;
    const at = nowIso();
    await db.agentTasks.update(id, { artifacts: [...task.artifacts, { id: createId("artifact"), runId, messageId: message.id, createdAt: at }], updatedAt: at });
  });
}

export async function unpinAgentTaskResult(id: string, artifactId: string): Promise<void> {
  await db.transaction("rw", tables(), async () => {
    const task = await editableAgentTask(id);
    if (task.lifecycle !== "open") throw new Error("请先重新打开任务");
    await db.agentTasks.update(id, { artifacts: task.artifacts.filter((item) => item.id !== artifactId), updatedAt: nowIso() });
  });
}
