import { db } from "./database";
import type { MemoryQueryOptions } from "@/domain/memoryRetrieval";
import { planMemorySelection } from "@/lib/memory/retrieval";
import { nowIso } from "@/lib/ids";
async function owner(projectId: string, threadId?: string) {
  if (projectId === "studio" || !(await db.projects.get(projectId)))
    throw new Error("项目不存在，无法读取记忆");
  if (!threadId) return;
  const thread = await db.chatThreads.get(threadId);
  if (!thread || thread.projectId !== projectId)
    throw new Error("对话与项目归属不匹配");
  return thread;
}
export async function getThreadMemoryExclusions(
  threadId: string,
  projectId: string,
): Promise<string[]> {
  return db.transaction("r", [db.projects, db.chatThreads], async () => [
    ...((await owner(projectId, threadId))?.excludedMemoryIds ?? []),
  ]);
}
export async function getEligibleProjectMemories(
  projectId: string,
  threadId?: string,
) {
  return db.transaction(
    "r",
    [db.projects, db.chatThreads, db.projectMemories],
    async () => {
      const thread = await owner(projectId, threadId),
        excluded = new Set(thread?.excludedMemoryIds ?? []);
      return (
        await db.projectMemories.where("projectId").equals(projectId).toArray()
      ).filter(
        (row) =>
          row.status === "active" && !!row.reviewedAt && !excluded.has(row.id),
      );
    },
  );
}
export async function getMemorySelection(options: MemoryQueryOptions) {
  return db.transaction(
    "r",
    [db.projects, db.chatThreads, db.projectMemories],
    async () => {
      const memories = await getEligibleProjectMemories(
        options.projectId,
        options.threadId,
      );
      return planMemorySelection({ ...options, memories });
    },
  );
}
export async function setThreadMemoryExcluded(
  threadId: string,
  projectId: string,
  memoryId: string,
  excluded: boolean,
): Promise<void> {
  await db.transaction(
    "rw",
    [db.projects, db.chatThreads, db.projectMemories],
    async () => {
      if (typeof excluded !== "boolean") throw new Error("排除状态无效");
      const thread = await owner(projectId, threadId);
      if (!thread) throw new Error("对话不存在");
      const memory = await db.projectMemories.get(memoryId);
      if ((memory && memory.projectId !== projectId) || (excluded && !memory))
        throw new Error("记忆不属于当前项目或已删除");
      const ids = new Set(thread.excludedMemoryIds ?? []);
      if (excluded) ids.add(memoryId);
      else ids.delete(memoryId);
      await db.chatThreads.update(threadId, {
        excludedMemoryIds: [...ids],
        updatedAt: nowIso(),
      });
    },
  );
}
