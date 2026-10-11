import type {ProductStore} from "@/lib/storage/types";
import {db as productDb} from "./database";
import {getGeneralAgentConfig} from "./agentSettings";
import type {ContextPolicy} from "@/domain/context";
import {normalizeContextPolicy} from "@/lib/agent/contextPolicy";
import {nowIso} from "@/lib/ids";

async function writeContextPolicy(
    threadId: string | undefined,
    policy: Partial<ContextPolicy>,
    replace: boolean, store?: ProductStore
): Promise<void> {
    const db = store ?? productDb;
    await db.transaction("rw", [db.chatThreads, db.agents], async (db) => {
        if (threadId) {
            const thread = await db.chatThreads.get(threadId);
            if (!thread) throw new Error("对话不存在");
            const contextPolicy = normalizeContextPolicy(replace ? policy : {...normalizeContextPolicy(thread.contextPolicy), ...policy});
            await db.chatThreads.update(threadId, {contextPolicy, updatedAt: nowIso()});
        } else {
            const agent = await getGeneralAgentConfig(db);
            const contextPolicy = normalizeContextPolicy(replace ? policy : {...normalizeContextPolicy(agent.contextPolicy), ...policy});
            await db.agents.update(agent.id, {contextPolicy, updatedAt: nowIso()});
        }
    });
}

// Each explicit field is applied to the transaction's latest policy; same-field
// updates follow commit order. Reset/default copies deliberately replace it all.
export async function updateContextPolicy(threadId: string | undefined, patch: Partial<ContextPolicy>, store?: ProductStore): Promise<void> {
    const db = store ?? productDb;
    await writeContextPolicy(threadId, patch, false, db);
}

export async function resetThreadContextPolicy(threadId: string, store?: ProductStore): Promise<void> {
    const db = store ?? productDb;
    await db.transaction("rw", [db.chatThreads, db.agents], async (db) => {
        const agent = await getGeneralAgentConfig(db);
        await writeContextPolicy(threadId, normalizeContextPolicy(agent.contextPolicy), true, db);
    });
}

export async function saveContextPolicyAsDefault(threadId: string, store?: ProductStore): Promise<void> {
    const db = store ?? productDb;
    await db.transaction("rw", [db.chatThreads, db.agents], async (db) => {
        const thread = await db.chatThreads.get(threadId);
        if (!thread) throw new Error("对话不存在");
        await writeContextPolicy(undefined, normalizeContextPolicy(thread.contextPolicy), true, db);
    });
}
