import { db } from "./database";
import { getTaskWrapupState } from "./agentTaskWrapups";
import type { AgentTaskWrapup } from "@/domain/agentTaskWrapup";
import type {
  MemoryCandidate,
  MemoryInput,
  MemorySaveOptions,
  MemorySaveResult,
  MemorySource,
  MemorySourceRef,
  MemorySourceState,
  ProjectMemory,
  ProjectMemoryVersion,
} from "@/domain/projectMemory";
import {
  memorySourceRefSchema,
  normalizeMemoryText,
  parseMemoryInput,
} from "@/lib/memory/schema";
import { createId, nowIso } from "@/lib/ids";

export class MemoryConflictError extends Error {
  constructor(public readonly existingIds: string[]) {
    super("同主题已有不同内容，请查看后明确替换，或修改主题");
    this.name = "MemoryConflictError";
  }
}
async function project(projectId: string) {
  if (projectId === "studio" || !(await db.projects.get(projectId)))
    throw new Error("项目不存在，无法管理记忆");
}
async function owned(projectId: string, id: string) {
  await project(projectId);
  const row = await db.projectMemories.get(id);
  if (!row || row.projectId !== projectId)
    throw new Error("记忆不存在或不属于当前项目");
  return row;
}
function revision(row: ProjectMemory, expected: number) {
  if (row.revision !== expected)
    throw new Error("记忆已更新，请保留当前编辑并重新核对");
}
async function persist(row: ProjectMemory, reason: string) {
  await db.projectMemories.put(row);
  await db.projectMemoryVersions.add({
    versionId: createId("pmv"),
    memoryId: row.id,
    projectId: row.projectId,
    revision: row.revision,
    reason,
    snapshot: structuredClone(row),
  });
}
const sourceIdentity = (source: MemorySource) =>
  source.kind === "summary"
    ? `${source.projectId}:${source.taskId}:${source.summaryId}:${source.summaryRevision}:${source.itemKind}:${source.itemIndex}`
    : undefined;
const sameContent = (a: MemoryInput, b: MemoryInput) =>
  a.category === b.category &&
  normalizeMemoryText(a.body) === normalizeMemoryText(b.body) &&
  normalizeMemoryText(a.applicability) === normalizeMemoryText(b.applicability);
async function duplicateOrConflicts(
  projectId: string,
  input: MemoryInput,
  source: MemorySource,
  excludeId?: string,
) {
  const rows = (
    await db.projectMemories.where("projectId").equals(projectId).toArray()
  ).filter((row) => row.id !== excludeId);
  const identity = sourceIdentity(source);
  return {
    duplicate: rows.find(
      (row) =>
        sameContent(row, input) ||
        (identity && sourceIdentity(row.source) === identity),
    ),
    conflicts: rows.filter(
      (row) =>
        row.status === "active" &&
        row.topicKey === input.topicKey &&
        !sameContent(row, input),
    ),
  };
}
async function sourceSummary(projectId: string, raw: MemorySourceRef) {
  await project(projectId);
  const ref = memorySourceRefSchema.parse(raw),
    task = await db.agentTasks.get(ref.taskId);
  if (!task || task.projectId !== projectId)
    throw new Error("来源任务不属于当前项目或已删除");
  const thread = await db.chatThreads.get(task.threadId);
  if (!thread || thread.projectId !== projectId)
    throw new Error("来源对话不属于当前项目或已删除");
  const current = await db.agentTaskWrapups.get(ref.summaryId);
  const summary: AgentTaskWrapup | undefined =
    current?.revision === ref.summaryRevision
      ? current
      : await db.agentTaskWrapupVersions
          .where("[id+revision]")
          .equals([ref.summaryId, ref.summaryRevision])
          .first();
  if (
    !summary ||
    summary.taskId !== task.id ||
    summary.threadId !== thread.id ||
    !summary.confirmedAt
  )
    throw new Error("请选择已确认的总结版本");
  const item =
    summary.content[ref.itemKind === "decision" ? "decisions" : "lessons"][
      ref.itemIndex
    ];
  if (!item || item.text !== ref.itemText)
    throw new Error("来源条目已变化，请重新选择");
  const evidence = item.sourceIds
    .map((id) => summary.snapshot.evidence.find((e) => e.id === id))
    .filter((e) => !!e)
    .slice(0, 8)
    .map((e) => ({
      id: e.id,
      label: e.label.slice(0, 300),
      body: e.body.slice(0, 1200),
      truncated: !!e.truncated || e.body.length > 1200,
    }));
  const source: Extract<MemorySource, { kind: "summary" }> = {
    ...ref,
    kind: "summary",
    projectId,
    threadId: thread.id,
    taskTitle: task.title.slice(0, 160),
    confirmedAt: summary.confirmedAt,
    excerpt: item.text.slice(0, 3000),
    evidence,
  };
  const state = await getTaskWrapupState(task.id);
  const historical =
    state.stale ||
    state.confirmed?.id !== summary.id ||
    state.confirmed.revision !== summary.revision;
  return {
    source,
    state: historical ? ("historical" as const) : ("confirmed" as const),
    href: `/agent/${encodeURIComponent(thread.id)}`,
  };
}
export async function listProjectMemories(
  projectId: string,
): Promise<ProjectMemory[]> {
  return db.transaction("r", db.tables, async () => {
    await project(projectId);
    return (
      await db.projectMemories.where("projectId").equals(projectId).toArray()
    ).sort(
      (a, b) =>
        b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id),
    );
  });
}
export async function getProjectMemory(
  projectId: string,
  id: string,
): Promise<ProjectMemory | undefined> {
  return db.transaction("r", db.tables, async () => {
    await project(projectId);
    const row = await db.projectMemories.get(id);
    if (row && row.projectId !== projectId)
      throw new Error("记忆不属于当前项目");
    return row;
  });
}
export async function listProjectMemoryVersions(
  projectId: string,
  id: string,
): Promise<ProjectMemoryVersion[]> {
  return db.transaction("r", db.tables, async () => {
    await owned(projectId, id);
    return (
      await db.projectMemoryVersions.where("memoryId").equals(id).toArray()
    )
      .filter((row) => row.projectId === projectId)
      .sort((a, b) => b.revision - a.revision);
  });
}
export async function getMemorySourceState(
  projectId: string,
  id: string,
): Promise<MemorySourceState> {
  return db.transaction("r", db.tables, async () => {
    const row = await owned(projectId, id),
      source = row.source;
    if (source.kind === "manual")
      return {
        state: "human",
        message: "人工整理的项目知识；适用性由用户确认",
      };
    if (source.kind === "imported")
      return {
        state: "imported",
        message: "来自项目备份，保留来源摘录；没有连接原项目的实时来源",
      };
    try {
      const current = await sourceSummary(projectId, {
        taskId: source.taskId,
        summaryId: source.summaryId,
        summaryRevision: source.summaryRevision,
        itemKind: source.itemKind,
        itemIndex: source.itemIndex,
        itemText: source.itemText,
      });
      return {
        state: current.state,
        href: current.href,
        message:
          current.state === "confirmed"
            ? "来自已确认的总结版本；当前业务事实优先"
            : "历史已确认总结，当前事实或来源已变化；请自行复核适用性",
      };
    } catch {
      return {
        state: "missing",
        message: "原任务、对话或已确认版本不可用；已保留来源摘录",
      };
    }
  });
}
export async function listMemoryCandidates(
  projectId: string,
  taskId: string,
  summaryId: string,
  summaryRevision: number,
): Promise<MemoryCandidate[]> {
  return db.transaction("r", db.tables, async () => {
    await project(projectId);
    const task = await db.agentTasks.get(taskId);
    if (!task || task.projectId !== projectId)
      throw new Error("来源任务不属于当前项目");
    const current = await db.agentTaskWrapups.get(summaryId);
    const summary =
      current?.revision === summaryRevision
        ? current
        : await db.agentTaskWrapupVersions
            .where("[id+revision]")
            .equals([summaryId, summaryRevision])
            .first();
    if (!summary || summary.taskId !== taskId || !summary.confirmedAt)
      throw new Error("请选择已确认的总结版本");
    const candidates: MemoryCandidate[] = [];
    for (const itemKind of ["decision", "lesson"] as const)
      for (const [itemIndex, item] of summary.content[
        itemKind === "decision" ? "decisions" : "lessons"
      ].entries()) {
        const ref = {
          taskId,
          summaryId,
          summaryRevision,
          itemKind,
          itemIndex,
          itemText: item.text,
        };
        const source = await sourceSummary(projectId, ref);
        const title = item.text.slice(0, 100);
        candidates.push({
          ref,
          ...source,
          input: {
            category: itemKind,
            title,
            topicKey: normalizeMemoryText(title),
            body: item.text,
            applicability: "",
            tags: [],
          },
        });
      }
    return candidates;
  });
}
async function create(
  projectId: string,
  input: MemoryInput,
  source: MemorySource,
  options: MemorySaveOptions = {},
): Promise<MemorySaveResult> {
  await project(projectId);
  const check = await duplicateOrConflicts(projectId, input, source);
  // Repeated submissions never reactivate or overwrite the existing reviewed row.
  if (check.duplicate) return { memory: check.duplicate, duplicate: true };
  const replacing = options.replace
    ? await owned(projectId, options.replace.id)
    : undefined;
  if (replacing) {
    revision(replacing, options.replace!.expectedRevision);
    if (replacing.status === "superseded") throw new Error("旧记忆已被替代");
  }
  if (check.conflicts.some((row) => row.id !== replacing?.id))
    throw new MemoryConflictError(check.conflicts.map((row) => row.id));
  const at = nowIso(),
    row: ProjectMemory = {
      ...input,
      id: createId("pm"),
      projectId,
      status: "active",
      revision: 1,
      source,
      createdAt: at,
      updatedAt: at,
      reviewedAt: at,
    };
  if (replacing)
    await persist(
      {
        ...replacing,
        status: "superseded",
        supersededBy: row.id,
        revision: replacing.revision + 1,
        updatedAt: at,
      },
      "被明确替换",
    );
  await persist(row, replacing ? "明确替换后创建" : "用户确认创建");
  return { memory: row, duplicate: false };
}
export async function createProjectMemory(
  projectId: string,
  raw: MemoryInput,
  options?: MemorySaveOptions,
) {
  const input = parseMemoryInput(raw);
  return db.transaction("rw", db.tables, () =>
    create(projectId, input, { kind: "manual" }, options),
  );
}
export async function promoteProjectMemory(
  projectId: string,
  ref: MemorySourceRef,
  raw: MemoryInput,
  options?: MemorySaveOptions,
) {
  const input = parseMemoryInput(raw);
  return db.transaction("rw", db.tables, async () => {
    const { source } = await sourceSummary(projectId, ref);
    return create(projectId, input, source, options);
  });
}
export async function updateProjectMemory(
  projectId: string,
  id: string,
  raw: MemoryInput,
  expectedRevision: number,
): Promise<ProjectMemory> {
  const input = parseMemoryInput(raw);
  return db.transaction("rw", db.tables, async () => {
    const row = await owned(projectId, id);
    revision(row, expectedRevision);
    if (row.status === "superseded")
      throw new Error("被替代的记忆只能查看历史或删除");
    const check = await duplicateOrConflicts(
      projectId,
      input,
      { kind: "manual" },
      id,
    );
    if (check.duplicate || check.conflicts.length)
      throw new MemoryConflictError([
        ...(check.duplicate ? [check.duplicate.id] : []),
        ...check.conflicts.map((r) => r.id),
      ]);
    const next = {
      ...row,
      ...input,
      revision: row.revision + 1,
      updatedAt: nowIso(),
      reviewedAt: nowIso(),
    };
    await persist(next, "人工修订");
    return next;
  });
}
export async function setProjectMemoryStatus(
  projectId: string,
  id: string,
  status: "active" | "disabled",
  expectedRevision: number,
): Promise<ProjectMemory> {
  return db.transaction("rw", db.tables, async () => {
    if (status !== "active" && status !== "disabled")
      throw new Error("记忆状态无效");
    const row = await owned(projectId, id);
    revision(row, expectedRevision);
    if (row.status === "superseded")
      throw new Error("被替代的记忆不能直接重新启用");
    if (status === "active") {
      const active = (
        await db.projectMemories.where("projectId").equals(projectId).toArray()
      ).filter(
        (other) =>
          other.id !== id &&
          other.status === "active" &&
          (sameContent(other, row) || other.topicKey === row.topicKey),
      );
      if (active.length) throw new MemoryConflictError(active.map((r) => r.id));
    }
    if (row.status === status) return row;
    const next = {
      ...row,
      status,
      supersededBy: undefined,
      revision: row.revision + 1,
      updatedAt: nowIso(),
      ...(status === "active" ? { reviewedAt: nowIso() } : {}),
    };
    await persist(next, status === "active" ? "用户复核启用" : "停用");
    return next;
  });
}
export async function replaceProjectMemory(
  projectId: string,
  oldId: string,
  newId: string,
  expected: { oldRevision: number; newRevision: number },
): Promise<ProjectMemory> {
  return db.transaction("rw", db.tables, async () => {
    if (oldId === newId) throw new Error("不能替换自身");
    const old = await owned(projectId, oldId),
      next = await owned(projectId, newId);
    revision(old, expected.oldRevision);
    revision(next, expected.newRevision);
    if (old.status === "superseded" || next.status === "superseded")
      throw new Error("记忆已被替代，请重新核对");
    const { conflicts } = await duplicateOrConflicts(
      projectId,
      next,
      { kind: "manual" },
      newId,
    );
    if (conflicts.some((row) => row.id !== oldId))
      throw new MemoryConflictError(conflicts.map((r) => r.id));
    const at = nowIso();
    await persist(
      {
        ...old,
        status: "superseded",
        supersededBy: newId,
        revision: old.revision + 1,
        updatedAt: at,
      },
      "被明确替换",
    );
    const active = {
      ...next,
      status: "active" as const,
      supersededBy: undefined,
      revision: next.revision + 1,
      updatedAt: at,
      reviewedAt: at,
    };
    await persist(active, "用户确认替换并启用");
    return active;
  });
}
export async function deleteProjectMemory(
  projectId: string,
  id: string,
  expectedRevision: number,
): Promise<void> {
  await db.transaction("rw", db.tables, async () => {
    const row = await owned(projectId, id);
    revision(row, expectedRevision);
    await db.projectMemories.delete(id);
    await db.projectMemoryVersions
      .where("memoryId")
      .equals(id)
      .and((v) => v.projectId === projectId)
      .delete();
  });
}
