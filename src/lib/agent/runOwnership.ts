import { recoverAbandonedGenerationBatches } from "@/db/agentGenerationBatches";
import { db } from "@/db/database";
import { interruptThreadRuns } from "@/db/agentRuns";

export interface ThreadLockManager {
  request<T>(name: string, options: { ifAvailable: true }, callback: (lock: unknown | null) => Promise<T>): Promise<T>;
}

function browserLocks(): ThreadLockManager {
  if (typeof navigator === "undefined" || !navigator.locks) {
    throw new Error("此浏览器无法安全协调执行，请使用支持 Web Locks 的浏览器并通过 HTTPS 或 localhost 打开");
  }
  return navigator.locks;
}

export async function withThreadRunLock<T>(threadId: string, execute: () => Promise<T>, locks: ThreadLockManager = browserLocks()): Promise<T> {
  return locks.request(`cuepoint:agent:${threadId}`, { ifAvailable: true }, async (lock) => {
    if (!lock) throw new Error("此对话正在另一个页面执行，请先在那里停止或等待完成");
    await recoverAbandonedGenerationBatches(threadId);
    await interruptThreadRuns(threadId);
    return execute();
  });
}

export async function recoverAbandonedRuns(locks: ThreadLockManager = browserLocks()): Promise<void> {
  const active = await db.agentRuns.where("status").equals("running").toArray();
  const batches = await db.agentGenerationBatches.where("status").equals("running").toArray();
  for (const threadId of new Set([...active, ...batches].map((run) => run.threadId))) {
    await locks.request(`cuepoint:agent:${threadId}`, { ifAvailable: true }, async (lock) => {
      if (lock) { await recoverAbandonedGenerationBatches(threadId); await interruptThreadRuns(threadId); }
    });
  }
}
