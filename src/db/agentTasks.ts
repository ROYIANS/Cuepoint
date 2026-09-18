import { db } from "@/db/database";
import { GENERAL_AGENT_ID, type AgentTask, type AgentPlanItem } from "@/domain/agent";
import { createId, nowIso } from "@/lib/ids";
import { deriveChatTitle } from "@/lib/chatTitle";
import { isTaskBusy, validateTaskPlan } from "@/lib/agent/taskState";

type TaskInput = { title: string; goal: string; plan?: AgentPlanItem[] };
const tables = () => [db.agentTasks, db.chatThreads, db.agentRuns, db.chatMessages];
function fields(input: TaskInput) {
  const title = input.title.trim();
  const goal = input.goal.trim();
  if (!title || title.length > 120 || !goal || goal.length > 20_000) throw new Error("请填写任务名称与目标（名称最多 120 字，目标最多 20,000 字）");
  return { title, goal, plan: validateTaskPlan(input.plan ?? []) };
}
async function editable(id: string) {
  const task = await db.agentTasks.get(id);
  if (!task || !(await db.chatThreads.get(task.threadId))) throw new Error("任务或关联对话不存在");
  const runs = await db.agentRuns.where("threadId").equals(task.threadId).toArray();
  if (isTaskBusy(runs)) throw new Error("请先处理当前执行，再修改任务");
  return task;
}

/** Can be nested inside beginAgentRun's transaction; creation never dispatches a request. */
export async function createAgentTaskForThread(threadId: string, input: TaskInput): Promise<AgentTask> {
  return db.transaction("rw", [db.agentTasks, db.chatThreads, db.agentRuns], async () => {
    const thread = await db.chatThreads.get(threadId);
    if (!thread) throw new Error("对话不存在");
    const existing = await db.agentTasks.where("threadId").equals(threadId).first();
    if (existing) return existing;
    const runs = await db.agentRuns.where("threadId").equals(threadId).toArray();
    if (isTaskBusy(runs)) throw new Error("请先处理当前执行，再关联任务");
    const at = nowIso();
    const task: AgentTask = { ...fields(input), id: createId("task"), threadId, agentId: GENERAL_AGENT_ID, lifecycle: "open", artifacts: [], createdAt: at, updatedAt: at };
    await db.agentTasks.add(task);
    return task;
  });
}

export async function createAgentTask(input: TaskInput): Promise<AgentTask> {
  const clean = fields(input);
  return db.transaction("rw", tables(), async () => {
    const at = nowIso();
    const threadId = createId("cth");
    await db.chatThreads.add({ id: threadId, title: deriveChatTitle(clean.title), createdAt: at, updatedAt: at });
    return createAgentTaskForThread(threadId, clean);
  });
}

export async function updateAgentTask(id: string, patch: Partial<TaskInput>): Promise<void> {
  await db.transaction("rw", tables(), async () => {
    const task = await editable(id);
    if (task.lifecycle !== "open") throw new Error("请先重新打开任务");
    await db.agentTasks.update(id, { ...fields({ ...task, ...patch }), updatedAt: nowIso() });
  });
}

export async function setAgentTaskLifecycle(id: string, lifecycle: AgentTask["lifecycle"]): Promise<void> {
  await db.transaction("rw", tables(), async () => {
    const task = await editable(id);
    if (!["open", "completed", "archived"].includes(lifecycle)) throw new Error("任务状态无效");
    if (lifecycle === "completed" && task.plan.some((item) => item.status !== "completed")) throw new Error("还有未完成的步骤，请先更新计划");
    await db.agentTasks.update(id, { lifecycle, updatedAt: nowIso() });
  });
}

export async function pinAgentTaskResult(id: string, runId: string): Promise<void> {
  await db.transaction("rw", tables(), async () => {
    const task = await editable(id);
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
    const task = await editable(id);
    if (task.lifecycle !== "open") throw new Error("请先重新打开任务");
    await db.agentTasks.update(id, { artifacts: task.artifacts.filter((item) => item.id !== artifactId), updatedAt: nowIso() });
  });
}
