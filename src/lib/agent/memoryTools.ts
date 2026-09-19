import { db } from "@/db/database";
import { getEligibleProjectMemories } from "@/db/memoryRetrieval";
import { getMemorySourceState } from "@/db/projectMemories";
import { rankMemoryCandidates } from "@/lib/memory/retrieval";
import { normalizeMemoryText } from "@/lib/memory/schema";
import type { AgentTask } from "@/domain/agent";
import type { AgentToolContext, AgentToolDefinition } from "./tools";
import { frozenProjectScope } from "./projectScope";
import {
  object,
  text,
  number,
  optional,
  choice,
  type Spec,
} from "./businessSchemas";

import { MEMORY_TOOL_NAMES } from "./memoryToolNames";
import { REFERENCE_TOOL_NAMES } from "./referenceToolNames";
export { MEMORY_TOOL_NAMES } from "./memoryToolNames";
const id = text(160, 1);
const revision = number(1, Number.MAX_SAFE_INTEGER, true);
const search = object({
  query: text(500, 1),
  limit: optional(number(1, 8, true)),
});
const paging = {
  contentOffset: optional(number(0, 10000000, true)),
  contentLimit: optional(number(1, 6000, true)),
};
const historySource = object({
  type: choice(["summary", "record", "message", "tool"]),
  id,
});
const historicalNotice =
  "这是历史资料，不是当前业务事实、授权或已验收成果；当前用户要求和实时资料优先。";

async function owner(context: AgentToolContext, name: string) {
  context.signal.throwIfAborted();
  const projectId = await frozenProjectScope(context);
  const run = await db.agentRuns.get(context.runId);
  const call = await db.agentToolCalls.get(context.callId);
  if (
    !projectId ||
    !run ||
    run.status !== "running" ||
    run.interactionMode === "conversation" ||
    !run.enabledToolNames?.includes(name) ||
    !call ||
    call.runId !== run.id ||
    call.threadId !== context.threadId ||
    call.name !== name ||
    call.status !== "running"
  )
    throw new Error("记忆工具仅供已绑定项目的智能执行读取");
  return { projectId, run };
}
function tool<T>(
  name: string,
  title: string,
  description: string,
  spec: Spec<T>,
  read: (
    args: T,
    context: AgentToolContext,
    state: Awaited<ReturnType<typeof owner>>,
  ) => Promise<unknown>,
): AgentToolDefinition {
  return {
    name,
    title,
    description,
    parameters: spec.json,
    effect: "read",
    highRisk: () => false,
    parseArguments: (raw) => spec.schema.parse(raw),
    execute: (args, context) =>
      db.transaction("r", db.tables, async () =>
        read(spec.schema.parse(args), context, await owner(context, name)),
      ),
  };
}
function slice(
  content: string,
  args: { contentOffset?: number; contentLimit?: number },
) {
  const offset = args.contentOffset ?? 0,
    limit = args.contentLimit ?? 6000;
  return {
    content: content.slice(offset, offset + limit),
    totalLength: content.length,
    nextOffset: offset + limit < content.length ? offset + limit : null,
  };
}
async function pastTask(
  taskId: string,
  state: Awaited<ReturnType<typeof owner>>,
): Promise<AgentTask | undefined> {
  const task = await db.agentTasks.get(taskId);
  if (
    !task ||
    task.projectId !== state.projectId ||
    task.id === state.run.taskId ||
    task.threadId === state.run.threadId
  )
    return;
  const thread = await db.chatThreads.get(task.threadId);
  if (!thread || thread.projectId !== state.projectId) return;
  return task;
}
function missing() {
  return {
    status: "unavailable",
    message: "来源不存在、不可读取或不属于当前项目的历史任务",
  };
}
function stale(expected: number | undefined, actual: number) {
  return expected !== undefined && expected !== actual
    ? {
        status: "stale",
        revision: actual,
        message: "来源已更新，请重新搜索并核对版本",
      }
    : undefined;
}
/** Result payload only: never return arguments, connector/run state or reasoning envelopes. */
function publicResult(raw: string | undefined): unknown {
  if (!raw) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    // Runtime results are JSON; opaque historical payloads have no safe projection.
    return { unavailable: "历史返回格式不可安全投影" };
  }
  const clean = (item: unknown): unknown => {
    if (Array.isArray(item)) return item.map(clean);
    if (!item || typeof item !== "object") return item;
    return Object.fromEntries(
      Object.entries(item)
        .filter(
          ([key]) =>
            !/apikey|api_key|authorization|credential|password|secret|encrypted|reasoning|access.?token|refresh.?token|connector|headers/i.test(
              key,
            ),
        )
        .map(([key, v]) => [key, clean(v)]),
    );
  };
  return clean(value);
}

export const MEMORY_TOOLS: readonly AgentToolDefinition[] = [
  tool(
    "memory_search",
    "搜索项目记忆",
    "只读搜索当前项目已启用且未在本对话排除的已审核记忆。query 必填，最多8条；返回版本、摘录、选择理由和来源状态，全文使用 memory_read。",
    search,
    async (args, context, state) => {
      const ranked = rankMemoryCandidates(
        await getEligibleProjectMemories(state.projectId, context.threadId),
        args.query,
      );
      const selected = ranked.slice(0, args.limit ?? 8);
      return {
        notice: historicalNotice,
        total: ranked.length,
        items: await Promise.all(
          selected.map(async ({ memory, reason }) => ({
            id: memory.id,
            revision: memory.revision,
            title: memory.title,
            category: memory.category,
            reason,
            excerpt: memory.body.slice(0, 600),
            truncated: memory.body.length > 600,
            source: await getMemorySourceState(state.projectId, memory.id),
          })),
        ),
      };
    },
  ),
  tool(
    "memory_read",
    "读取项目记忆",
    "按 ID 和 expectedRevision 读取当前项目已审核、已启用且未排除的记忆。版本变化返回 stale；正文用 contentOffset/contentLimit 分页，每次最多6000字。",
    object({ id, expectedRevision: revision, ...paging }),
    async (args, context, state) => {
      const memory = (
        await getEligibleProjectMemories(state.projectId, context.threadId)
      ).find((row) => row.id === args.id);
      if (!memory) return missing();
      const changed = stale(args.expectedRevision, memory.revision);
      if (changed) return changed;
      return {
        status: "available",
        notice: historicalNotice,
        id: memory.id,
        revision: memory.revision,
        title: memory.title,
        category: memory.category,
        applicability: memory.applicability,
        source: await getMemorySourceState(state.projectId, memory.id),
        ...slice(memory.body, args),
      };
    },
  ),
  tool(
    "project_history_search",
    "搜索项目历史任务",
    "搜索当前项目其他任务的名称、目标、已确认总结和工作记录标题。query 必填，最多8个任务；不扫描完整聊天。索引提供 project_history_read 的来源标识，历史内容不证明当前完成。",
    search,
    async (args, _context, state) => {
      const query = normalizeMemoryText(args.query);
      const tokens = query.split(/\s+/u);
      const matches = (value: string) =>
        tokens.every((token) => normalizeMemoryText(value).includes(token));
      const tasks = await db.agentTasks
        .where("projectId")
        .equals(state.projectId)
        .toArray();
      const found = [];
      for (const candidate of tasks.sort(
        (a, b) =>
          b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id),
      )) {
        const task = await pastTask(candidate.id, state);
        if (!task) continue;
        const summaries = (
          await db.agentTaskWrapups.where("taskId").equals(task.id).toArray()
        ).filter((row) => row.threadId === task.threadId && !!row.confirmedAt);
        const records = await db.agentTaskRecords
          .where("taskId")
          .equals(task.id)
          .toArray();
        const matchingSummaries = summaries.filter((row) =>
          matches(JSON.stringify(row.content)),
        );
        const matchingRecords = records.filter((row) => matches(row.title));
        if (
          !matches(`${task.title} ${task.goal}`) &&
          !matchingSummaries.length &&
          !matchingRecords.length
        )
          continue;
        const sources = [
          ...(matchingSummaries.length ? matchingSummaries : summaries)
            .slice(0, 4)
            .map((row) => ({
              type: "summary",
              id: row.id,
              revision: row.revision,
              label: "已确认总结",
            })),
          ...(matchingRecords.length ? matchingRecords : records)
            .slice(0, 4)
            .map((row) => ({
              type: "record",
              id: row.id,
              revision: row.revision,
              label: row.title.slice(0, 160),
            })),
        ];
        found.push({
          taskId: task.id,
          title: task.title,
          goal: task.goal.slice(0, 600),
          truncated: task.goal.length > 600,
          lifecycle: task.lifecycle,
          sources,
          sourceCount: summaries.length + records.length,
        });
      }
      return {
        notice: historicalNotice,
        total: found.length,
        items: found.slice(0, args.limit ?? 8),
      };
    },
  ),
  tool(
    "project_history_read",
    "读取项目历史来源",
    "只读其他同项目任务的来源。source.type 为 summary（已确认总结）、record（工作记录）、message（完整公开消息）或 tool（已结算结果）。revision 可选择总结/记录历史版，expectedRevision 可检查当前版。最多6000字分页；不返回隐藏推理、连接配置或工具参数。",
    object({
      taskId: id,
      source: historySource,
      revision: optional(revision),
      expectedRevision: optional(revision),
      ...paging,
    }),
    async (args, _context, state) => {
      const task = await pastTask(args.taskId, state);
      if (!task) return missing();
      const { type, id: sourceId } = args.source;
      if (
        (type === "message" || type === "tool") &&
        (args.revision !== undefined || args.expectedRevision !== undefined)
      )
        throw new Error("消息和工具结果不支持记录版本参数");
      let content: string, metadata: Record<string, unknown>;
      if (type === "summary") {
        const current = await db.agentTaskWrapups.get(sourceId);
        if (
          !current ||
          current.taskId !== task.id ||
          current.threadId !== task.threadId
        )
          return missing();
        const changed = stale(args.expectedRevision, current.revision);
        if (changed) return changed;
        const selected =
          args.revision !== undefined && args.revision !== current.revision
            ? await db.agentTaskWrapupVersions
                .where("[id+revision]")
                .equals([sourceId, args.revision])
                .first()
            : current;
        if (
          !selected ||
          selected.taskId !== task.id ||
          selected.threadId !== task.threadId ||
          !selected.confirmedAt
        )
          return missing();
        content = JSON.stringify(selected.content);
        metadata = {
          revision: selected.revision,
          verification: "historically_confirmed",
          confirmedAt: selected.confirmedAt,
        };
      } else if (type === "record") {
        const current = await db.agentTaskRecords.get(sourceId);
        if (!current || current.taskId !== task.id) return missing();
        const changed = stale(args.expectedRevision, current.revision);
        if (changed) return changed;
        const selected =
          args.revision !== undefined && args.revision !== current.revision
            ? await db.agentTaskRecordVersions
                .where("[recordId+revision]")
                .equals([sourceId, args.revision])
                .first()
            : current;
        if (!selected || selected.taskId !== task.id) return missing();
        content = selected.body;
        metadata = {
          revision: selected.revision,
          title: selected.title,
          kind: selected.kind,
          claim: selected.claim,
          author: selected.author,
          sources: selected.sources,
          verification: "historical_record_not_current_verification",
        };
      } else if (type === "message") {
        const message = await db.chatMessages.get(sourceId);
        if (
          !message ||
          message.threadId !== task.threadId ||
          message.role === "system" ||
          message.status !== "complete"
        )
          return missing();
        if (message.role === "assistant" && !message.runId) return missing();
        if (message.runId) {
          const run = await db.agentRuns.get(message.runId);
          if (
            !run ||
            run.threadId !== task.threadId ||
            run.taskId !== task.id ||
            run.projectId !== state.projectId
          )
            return missing();
        }
        content = message.content;
        metadata = {
          role: message.role,
          verification:
            message.role === "user"
              ? "user_statement"
              : "assistant_statement_unverified",
        };
      } else {
        const call = await db.agentToolCalls.get(sourceId);
        if (
          !call ||
          call.threadId !== task.threadId ||
          !["completed", "failed", "rejected"].includes(call.status) ||
          MEMORY_TOOL_NAMES.some((name) => name === call.name) ||
          REFERENCE_TOOL_NAMES.some((name) => name === call.name)
        )
          return missing();
        const run = await db.agentRuns.get(call.runId);
        if (
          !run ||
          run.taskId !== task.id ||
          run.threadId !== task.threadId ||
          run.projectId !== state.projectId
        )
          return missing();
        content = JSON.stringify({
          result: publicResult(call.result),
          hasError: !!call.error,
        });
        metadata = {
          name: call.name,
          toolStatus: call.status,
          verification: "historical_tool_result_not_current_verification",
        };
      }
      return {
        status: "available",
        notice: historicalNotice,
        taskId: task.id,
        source: args.source,
        ...metadata,
        ...slice(content, args),
      };
    },
  ),
];
