import {db} from "./database";
import {getGeneralAgentConfig} from "./agentSettings";
import type {ContextPolicy} from "@/domain/context";
import {normalizeContextPolicy} from "@/lib/agent/contextPolicy";
import {nowIso} from "@/lib/ids";

async function writeContextPolicy(
    threadId: string | undefined,
    policy: Partial<ContextPolicy>,
    replace: boolean,
): Promise<void> {
    await db.transaction("rw", [db.chatThreads, db.agents], async () => {
        if (threadId) {
            const thread = await db.chatThreads.get(threadId);
            if (!thread) throw new Error("对话不存在");
            const contextPolicy = normalizeContextPolicy(replace ? policy : {...normalizeContextPolicy(thread.contextPolicy), ...policy});
            await db.chatThreads.update(threadId, {contextPolicy, updatedAt: nowIso()});
        } else {
            const agent = await getGeneralAgentConfig();
            const contextPolicy = normalizeContextPolicy(replace ? policy : {...normalizeContextPolicy(agent.contextPolicy), ...policy});
            await db.agents.update(agent.id, {contextPolicy, updatedAt: nowIso()});
        }
    });
}

// Each explicit field is applied to the transaction's latest policy; same-field
// updates follow commit order. Reset/default copies deliberately replace it all.
export async function updateContextPolicy(threadId: string | undefined, patch: Partial<ContextPolicy>): Promise<void> {
    await writeContextPolicy(threadId, patch, false);
}

export async function resetThreadContextPolicy(threadId: string): Promise<void> {
    await db.transaction("rw", [db.chatThreads, db.agents], async () => {
        const agent = await getGeneralAgentConfig();
        await writeContextPolicy(threadId, normalizeContextPolicy(agent.contextPolicy), true);
    });
}

export async function saveContextPolicyAsDefault(threadId: string): Promise<void> {
    await db.transaction("rw", [db.chatThreads, db.agents], async () => {
        const thread = await db.chatThreads.get(threadId);
        if (!thread) throw new Error("对话不存在");
        await writeContextPolicy(undefined, normalizeContextPolicy(thread.contextPolicy), true);
    });
}
