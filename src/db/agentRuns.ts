import { createAgentTaskForThread } from "@/db/agentTasks";
import { buildTaskInstructions } from "@/lib/agent/taskState";
import { db } from "@/db/database";
import type { AgentInteractionMode, AgentModelMetrics, AgentTokenUsage, AgentReasoningEffort, AgentRun, AgentRunOutput, AgentRunStatus } from "@/domain/agent";
import type { ChatMessage, ConnectorConfig } from "@/domain/types";
import { createId, nowIso } from "@/lib/ids";
import { getGeneralAgentConfig } from "@/db/agentSettings";
import { normalizeContextPolicy, resolveContextCapacity } from "@/lib/agent/contextPolicy";
import { buildContextMessages, findApplicableSummary, selectContextHistory } from "@/lib/agent/contextPlanner";
import type { ChatModelMetadata } from "@/lib/ai/modelMetadata";
import { assembleSkills } from "@/lib/agent/skills";
import { assertReasoningEffort, selectAgentProtocol } from "@/lib/ai/reasoningPolicy";
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

export function canRetryRun(run: AgentRun, runs: AgentRun[], messages: ChatMessage[]): boolean {
  if (run.status === "running" || run.status === "waiting_approval" || run.status === "completed" || run.hasToolCalls) return false;
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
  reasoningEffort?: AgentReasoningEffort;
  interactionMode?: AgentInteractionMode;
  createTask?: boolean;
  modelMetadata?: ChatModelMetadata;
}): Promise<AgentRun> {
  const identity = connectorRunIdentity(input.connector);
  if (!input.model.trim() || !input.connector.apiKey.trim()) throw new Error("请选择模型并配置 API Key");
  return db.transaction("rw", [db.chatThreads, db.chatMessages, db.agentRuns, db.agents, db.agentTasks, db.contextCompactions], async () => {
    const thread = await db.chatThreads.get(input.threadId);
    if (!thread) throw new Error("对话不存在");
    const runs = await db.agentRuns.where("threadId").equals(thread.id).toArray();
    if (runs.some((run) => run.status === "running" || run.status === "waiting_approval" || (run.hasToolCalls && (run.status === "interrupted" || run.status === "failed")))) throw new Error("此对话已有执行，请等待完成或恢复中断状态");
    const history = await db.chatMessages.where("threadId").equals(thread.id).sortBy("createdAt");
    // Keep order deterministic even when several IndexedDB writes share a millisecond.
    const at = new Date(Math.max(Date.now(), ...history.map((m) => Date.parse(m.createdAt) + 1).filter(Number.isFinite))).toISOString();
    const agent = await getGeneralAgentConfig();
    const previous = input.retryOfRunId ? runs.find((run) => run.id === input.retryOfRunId) : undefined;
    if (input.retryOfRunId && (!previous || !canRetryRun(previous, runs, history))) {
      throw new Error("只能重新生成当前最后一次未完成的回复；后续已有消息时请发送新问题");
    }
    if (previous) {
      assertRetryConnector(previous, input.connector);
      if (previous.model !== input.model.trim()) throw new Error("重新生成必须使用原模型");
    }
    const reasoningEffort = previous ? previous.reasoningEffort : input.reasoningEffort;
    assertReasoningEffort(identity, input.model, reasoningEffort);
    const content = input.content?.trim() ?? "";
    if (!previous && !content) throw new Error("消息不能为空");
    let task = await db.agentTasks.where("threadId").equals(thread.id).first();
    if (input.createTask && !task && !previous) task = await createAgentTaskForThread(thread.id, { title: deriveChatTitle(content), goal: content });
    if (task && task.lifecycle !== "open") throw new Error("请先重新打开任务，再继续对话");
    if (previous?.taskId && previous.taskId !== task?.id) throw new Error("原任务关联已失效");
    const instructions = buildTaskInstructions(agent.instructions, task);
    const userMessageId = previous?.userMessageId ?? createId("cmsg");
    const runId = createId("run");
    const assistantMessageId = createId("cmsg");
    const interactionMode = previous ? previous.interactionMode ?? "smart" : input.interactionMode ?? thread.interactionMode ?? "smart";
    const skills = assembleSkills(agent.enabledSkillIds ?? []);
    const enabledToolNames = interactionMode === "conversation" ? [] : (previous ? previous.enabledToolNames ?? [] : skills.enabledToolNames);
    const skillInstructions = interactionMode === "conversation" ? "" : (previous ? previous.skillInstructions ?? "" : skills.skillInstructions);
    const policy = normalizeContextPolicy(thread.contextPolicy);
    const selectedHistory = selectContextHistory(history, policy);
    const summary = policy.autoCompress ? findApplicableSummary(selectedHistory, await db.contextCompactions.where("threadId").equals(thread.id).toArray()) : undefined;
    const baseMessages = buildContextMessages(instructions, skillInstructions, selectedHistory, content, summary);
    const requestMessages = previous?.context?.baseMessages ?? previous?.requestMessages ?? baseMessages;
    const context = previous ? previous.context : { policy, history: selectedHistory, baseMessages, draft: content, summaryId: summary?.id, ...resolveContextCapacity(input.model, input.modelMetadata, identity.definitionId, policy) };
    const run: AgentRun = {
      context,
      id: runId, threadId: thread.id, taskId: previous?.taskId ?? task?.id, plan: previous?.plan ?? task?.plan, agentId: previous?.agentId ?? agent.id,
      agentSnapshot: previous?.agentSnapshot ?? { name: agent.name, instructions },
      userMessageId, assistantMessageId, retryOfRunId: previous?.id,
      model: input.model.trim(), connector: identity, requestMessages,
      protocol: previous?.protocol ?? (previous?.hasToolCalls ? "chat-completions" : selectAgentProtocol(identity, input.model, reasoningEffort, enabledToolNames.length > 0)),
      ...(reasoningEffort !== undefined ? { reasoningEffort } : {}),
      permissionMode: previous ? previous.permissionMode ?? "ask" : agent.permissionMode ?? "ask",
      interactionMode,
      enabledToolNames,
      skillInstructions,
      status: "running", checkpoint: 0, createdAt: at, updatedAt: at,
    };
    if (!previous) await db.chatMessages.add({ id: userMessageId, threadId: thread.id, role: "user", content, createdAt: at, status: "complete" });
    await db.chatMessages.add({ id: assistantMessageId, threadId: thread.id, role: "assistant", content: "", createdAt: new Date(Date.parse(at) + 1).toISOString(), status: "streaming", runId });
    await db.agentRuns.add(run);
    if (task) await db.agentTasks.update(task.id, { updatedAt: at });
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

export async function finishAgentRun(runId: string, status: Exclude<AgentRunStatus, "running" | "waiting_approval">, output?: AgentRunOutput, error?: string, finishReason?: string): Promise<void> {
  await db.transaction("rw", db.agentRuns, db.chatMessages, async () => {
    const run = await db.agentRuns.get(runId);
    if (!run || (run.status !== "running" && run.status !== "waiting_approval")) return;
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
  await db.transaction("rw", db.agentRuns, db.agentToolCalls, db.chatMessages, db.contextCompactions, async () => {
    const runs = await db.agentRuns.where("threadId").equals(threadId).toArray();
    for (const run of runs) {
      if (run.status !== "running") continue;
      await db.contextCompactions.where("runId").equals(run.id).filter((record) => record.status === "running").modify({ status: "interrupted", error: "整理已中断，未启用未完成的摘要。请手动继续或重新生成。", updatedAt: nowIso() });
      await db.agentToolCalls.where("runId").equals(run.id).filter((call) => call.status === "running").modify({
        status: "unknown", error: "执行中断，结果尚不确定，不能自动重跑。", updatedAt: nowIso(),
      });
      const calls = await db.agentToolCalls.where("runId").equals(run.id).toArray();
      // A crash may fall between persisting an approval request and parking the
      // run. Restore its actionable waiting state instead of stranding the call
      // behind an interrupted run that cannot accept an approval or resume.
      if (calls.some((call) => call.status === "awaiting_approval") && !calls.some((call) => call.status === "unknown")) {
        await db.agentRuns.update(run.id, { status: "waiting_approval", updatedAt: nowIso() });
        await db.chatMessages.update(run.assistantMessageId, { status: "pending", error: undefined });
        continue;
      }
      await finishAgentRun(run.id, "interrupted", undefined, run.hasToolCalls
        ? "执行已中断。继续时将使用已保存的步骤与结果；结果不确定的操作需要先核实。"
        : "上次生成已中断，已保留收到的内容。重新生成会创建一次新的请求。");
    }
  });
}


/** One immutable metrics record per model step, safe to replay after local recovery. */
export async function recordAgentModelMetrics(runId: string, metrics: AgentModelMetrics): Promise<void> {
  await db.transaction("rw", db.agentRuns, async () => {
    const run = await db.agentRuns.get(runId);
    if (!run || run.status !== "running") return;
    if (!Number.isSafeInteger(metrics.step) || metrics.step < 1 || metrics.step !== run.modelStep) throw new Error("模型用量所属步骤无效");
    if (run.modelMetrics?.some((item) => item.step === metrics.step)) return;
    const modelMetrics = [...(run.modelMetrics ?? []), metrics].sort((a, b) => a.step - b.step);
    const usage: AgentTokenUsage = {};
    const completeSteps = modelMetrics.length === run.modelStep;
    for (const name of ["inputTokens", "outputTokens", "totalTokens"] as const) {
      if (completeSteps && modelMetrics.every((item) => item.usage?.[name] !== undefined)) {
        const sum = modelMetrics.reduce((total, item) => total + item.usage![name]!, 0);
        if (Number.isSafeInteger(sum)) usage[name] = sum;
      }
    }
    // Streaming generation speed excludes first-token latency, tool execution and
    // approval waits. JSON responses cannot reveal a first-token timestamp.
    const duration = modelMetrics.reduce((total, item) => total + (item.firstTokenAt === undefined ? 0 : item.endedAt - item.firstTokenAt), 0);
    const measurable = completeSteps && modelMetrics.every((item) => item.firstTokenAt !== undefined && item.endedAt > item.firstTokenAt);
    const outputTokensPerSecond = measurable && duration > 0 && usage.outputTokens !== undefined ? usage.outputTokens * 1000 / duration : undefined;
    await db.agentRuns.update(runId, { modelMetrics, usage: Object.keys(usage).length ? usage : undefined, outputTokensPerSecond });
  });
}
