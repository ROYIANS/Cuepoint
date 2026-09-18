import { db } from "@/db/database";
import { GENERAL_AGENT_ID, type AgentConfig, type AgentRun, type AgentRunOutput, type AgentRunStatus } from "@/domain/agent";
import type { ChatMessage, ConnectorConfig } from "@/domain/types";
import { createId, nowIso } from "@/lib/ids";
import { deriveChatTitle } from "@/lib/chatTitle";

export function connectorRunIdentity(connector: ConnectorConfig): AgentRun["connector"] {
  const url = new URL(connector.baseUrl.trim());
  if (!/^https?:$/.test(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error("连接地址必须是无凭据、查询参数或片段的 HTTP(S) 地址");
  }
  return { id: connector.id, definitionId: connector.definitionId, baseUrl: url.toString().replace(/\/+$/, "") };
}

export function assertRetryConnector(run: AgentRun, connector: ConnectorConfig): void {
  const identity = connectorRunIdentity(connector);
  if (identity.id !== run.connector.id || identity.definitionId !== run.connector.definitionId || identity.baseUrl !== run.connector.baseUrl) {
    throw new Error("原连接已更改，请恢复原连接配置或发送新消息");
  }
}

/** Called inside the same transaction that creates a run. */
async function getGeneralAgent(): Promise<AgentConfig> {
  const existing = await db.agents.get(GENERAL_AGENT_ID);
  if (existing) return existing;
  const agent: AgentConfig = {
    id: GENERAL_AGENT_ID, name: "创作助手",
    instructions: "你是小光点的通用创作助手，帮助用户梳理创意、剧本和制作计划。准确说明已完成的工作，不要声称执行了没有实际调用的工具或修改了系统数据。",
    updatedAt: nowIso(),
  };
  await db.agents.add(agent);
  return agent;
}

export function canRetryRun(run: AgentRun, runs: AgentRun[], messages: ChatMessage[]): boolean {
  if (run.status === "running" || run.status === "completed") return false;
  const latest = [...runs].sort((a, b) => a.createdAt.localeCompare(b.createdAt)).at(-1);
  if (latest?.id !== run.id) return false;
  const lastUser = [...messages].filter((m) => m.role === "user").sort((a, b) => a.createdAt.localeCompare(b.createdAt)).at(-1);
  return lastUser?.id === run.userMessageId;
}

export async function beginAgentRun(input: {
  threadId: string;
  connector: ConnectorConfig;
  model: string;
  content?: string;
  retryOfRunId?: string;
}): Promise<AgentRun> {
  const identity = connectorRunIdentity(input.connector);
  if (!input.model.trim() || !input.connector.apiKey.trim()) throw new Error("请选择模型并配置 API Key");
  return db.transaction("rw", [db.chatThreads, db.chatMessages, db.agentRuns, db.agents], async () => {
    const thread = await db.chatThreads.get(input.threadId);
    if (!thread) throw new Error("对话不存在");
    const runs = await db.agentRuns.where("threadId").equals(thread.id).toArray();
    if (runs.some((run) => run.status === "running")) throw new Error("此对话已有执行，请等待完成或恢复中断状态");
    const history = await db.chatMessages.where("threadId").equals(thread.id).sortBy("createdAt");
    // Keep order deterministic even when several IndexedDB writes share a millisecond.
    const at = new Date(Math.max(Date.now(), ...history.map((m) => Date.parse(m.createdAt) + 1).filter(Number.isFinite))).toISOString();
    const agent = await getGeneralAgent();
    const previous = input.retryOfRunId ? runs.find((run) => run.id === input.retryOfRunId) : undefined;
    if (input.retryOfRunId && (!previous || !canRetryRun(previous, runs, history))) {
      throw new Error("只能重新生成当前最后一次未完成的回复；后续已有消息时请发送新问题");
    }
    if (previous) {
      assertRetryConnector(previous, input.connector);
      if (previous.model !== input.model.trim()) throw new Error("重新生成必须使用原模型");
    }
    const content = input.content?.trim() ?? "";
    if (!previous && !content) throw new Error("消息不能为空");
    const userMessageId = previous?.userMessageId ?? createId("cmsg");
    const runId = createId("run");
    const assistantMessageId = createId("cmsg");
    const requestMessages = previous?.requestMessages ?? [
      { role: "system" as const, content: agent.instructions },
      ...history.filter((m) => !m.status || m.status === "complete").map((m) => ({ role: m.role, content: m.content })),
      { role: "user" as const, content },
    ];
    const run: AgentRun = {
      id: runId, threadId: thread.id, agentId: previous?.agentId ?? agent.id,
      agentSnapshot: previous?.agentSnapshot ?? { name: agent.name, instructions: agent.instructions },
      userMessageId, assistantMessageId, retryOfRunId: previous?.id,
      model: input.model.trim(), connector: identity, requestMessages,
      status: "running", checkpoint: 0, createdAt: at, updatedAt: at,
    };
    if (!previous) await db.chatMessages.add({ id: userMessageId, threadId: thread.id, role: "user", content, createdAt: at, status: "complete" });
    await db.chatMessages.add({ id: assistantMessageId, threadId: thread.id, role: "assistant", content: "", createdAt: new Date(Date.parse(at) + 1).toISOString(), status: "streaming", runId });
    await db.agentRuns.add(run);
    await db.chatThreads.update(thread.id, {
      updatedAt: at, connectorId: identity.id, model: run.model,
      ...(!previous && (thread.title === "新话题" || thread.title === "新对话")
        ? { title: deriveChatTitle(content) } : {}),
    });
    return run;
  });
}

export async function checkpointAgentRun(runId: string, sequence: number, output: AgentRunOutput): Promise<void> {
  await db.transaction("rw", db.agentRuns, db.chatMessages, async () => {
    const run = await db.agentRuns.get(runId);
    if (!run) throw new Error("执行已删除");
    if (run.status !== "running" || sequence <= run.checkpoint) return;
    const message = await db.chatMessages.get(run.assistantMessageId);
    if (!message || message.runId !== run.id) throw new Error("执行消息不存在");
    await db.chatMessages.update(message.id, output);
    await db.agentRuns.update(run.id, { checkpoint: sequence, updatedAt: nowIso() });
  });
}

export async function finishAgentRun(runId: string, status: Exclude<AgentRunStatus, "running">, output?: AgentRunOutput, error?: string, finishReason?: string): Promise<void> {
  await db.transaction("rw", db.agentRuns, db.chatMessages, async () => {
    const run = await db.agentRuns.get(runId);
    if (!run || run.status !== "running") return;
    const message = await db.chatMessages.get(run.assistantMessageId);
    if (!message || message.runId !== run.id) throw new Error("执行消息不存在");
    const at = nowIso();
    const messageStatus = { completed: "complete", failed: "error", cancelled: "aborted", interrupted: "interrupted" } as const;
    await db.chatMessages.update(message.id, { ...output, status: messageStatus[status], error });
    await db.agentRuns.update(run.id, { status, error, finishReason, updatedAt: at, endedAt: at });
  });
}

/** Caller must own the thread's Web Lock; elapsed wall time is not proof of abandonment. */
export async function interruptThreadRuns(threadId: string): Promise<void> {
  const runs = await db.agentRuns.where("threadId").equals(threadId).toArray();
  for (const run of runs) {
    if (run.status === "running") await finishAgentRun(run.id, "interrupted", undefined, "上次生成已中断，已保留收到的内容。重新生成会创建一次新的请求。");
  }
}
