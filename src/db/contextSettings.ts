import { db } from "./database";
import { getGeneralAgentConfig } from "./agentSettings";
import type { ContextPolicy } from "@/domain/context";
import { normalizeContextPolicy } from "@/lib/agent/contextPolicy";
import { nowIso } from "@/lib/ids";

export async function updateContextPolicy(threadId: string | undefined, policy: ContextPolicy): Promise<void> {
  await db.transaction("rw", [db.chatThreads, db.agents], async () => {
    const contextPolicy = normalizeContextPolicy(policy);
    if (threadId) {
      if (!await db.chatThreads.get(threadId)) throw new Error("对话不存在");
      await db.chatThreads.update(threadId, { contextPolicy, updatedAt: nowIso() });
    } else {
      const agent = await getGeneralAgentConfig();
      await db.agents.update(agent.id, { contextPolicy, updatedAt: nowIso() });
    }
  });
}
export async function resetThreadContextPolicy(threadId: string): Promise<void> {
  await db.transaction("rw", [db.chatThreads, db.agents], async () => {
    const agent = await getGeneralAgentConfig();
    await updateContextPolicy(threadId, normalizeContextPolicy(agent.contextPolicy));
  });
}
export async function saveContextPolicyAsDefault(threadId: string): Promise<void> {
  await db.transaction("rw", [db.chatThreads, db.agents], async () => {
    const thread = await db.chatThreads.get(threadId);
    if (!thread) throw new Error("对话不存在");
    await updateContextPolicy(undefined, normalizeContextPolicy(thread.contextPolicy));
  });
}
