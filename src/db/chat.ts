import {
    type ChatMessage,
    type ChatMessageRole,
    type ChatMessageStatus,
    type ChatThread,
    type Id,
    STUDIO_LIBRARY_ID
} from "@/domain/types";
import {db} from "./database";
import {createId, nowIso} from "@/lib/ids";
import {normalizeContextPolicy} from "@/lib/agent/contextPolicy";
import {getGeneralAgentConfig} from "./agentSettings";


export async function createChatThread(options?: {
    projectId?: Id;
    taskMode?: boolean;
    title?: string;
    connectorId?: Id;
    model?: string;
}): Promise<ChatThread> {
    const at = nowIso();
    const thread: ChatThread = {
        contextPolicy: normalizeContextPolicy((await getGeneralAgentConfig()).contextPolicy),
        id: createId("cth"),
        title: options?.title?.trim() || "新对话",
        taskMode: options?.taskMode === true,
        projectId: options?.projectId,
        connectorId: options?.connectorId,
        model: options?.model?.trim() || undefined,
        createdAt: at,
        updatedAt: at,
    };
    await db.transaction("rw", [db.chatThreads, db.projects], async () => {
        if (thread.projectId && (thread.projectId === STUDIO_LIBRARY_ID || !await db.projects.get(thread.projectId))) throw new Error("请选择可用项目");
        await db.chatThreads.add(thread);
    });
    return thread;
}

export async function updateChatThread(
    id: Id,
    patch: Partial<Pick<ChatThread, "title" | "connectorId" | "model" | "reasoningSelection" | "interactionMode">>,
): Promise<void> {
    await db.transaction("rw", db.chatThreads, async () => {
        const existing = await db.chatThreads.get(id);
        if (!existing) return;
        const next: ChatThread = {
            ...existing,
            updatedAt: nowIso(),
        };
        if (patch.title !== undefined) {
            const title = patch.title.trim();
            next.title = title || existing.title;
        }
        if (patch.connectorId !== undefined) {
            next.connectorId = patch.connectorId || undefined;
        }
        if (patch.model !== undefined) {
            const model = patch.model.trim();
            next.model = model || undefined;
        }
        if (patch.interactionMode !== undefined) next.interactionMode = patch.interactionMode;
        if (patch.reasoningSelection !== undefined) next.reasoningSelection = patch.reasoningSelection;
        await db.chatThreads.put(next);
    });
}


export async function appendChatMessage(input: {
    threadId: Id;
    role: ChatMessageRole;
    content?: string;
    status?: ChatMessageStatus;
}): Promise<ChatMessage> {
    const at = nowIso();
    const message: ChatMessage = {
        id: createId("cmsg"),
        threadId: input.threadId,
        role: input.role,
        content: input.content ?? "",
        createdAt: at,
        status: input.status,
    };
    await db.transaction("rw", db.chatThreads, db.chatMessages, async () => {
        const thread = await db.chatThreads.get(input.threadId);
        if (!thread) throw new Error("对话不存在");
        await db.chatMessages.put(message);
        await db.chatThreads.put({...thread, updatedAt: at});
    });
    return message;
}


/** Bind once before any conversation execution; changing projects starts a new thread. */
export async function bindChatThreadProject(threadId: string, projectId: string, expectedProjectId?: string): Promise<void> {
    await db.transaction("rw", [db.chatThreads, db.projects, db.agentRuns, db.chatMessages, db.agentTasks], async () => {
        const thread = await db.chatThreads.get(threadId);
        if (!thread || thread.projectId !== expectedProjectId) throw new Error("对话项目已变化，请重新读取");
        if (projectId === STUDIO_LIBRARY_ID || !await db.projects.get(projectId)) throw new Error("请选择可用项目");
        if (thread.projectId === projectId) return;
        if (thread.projectId || await db.agentRuns.where("threadId").equals(threadId).count() || await db.chatMessages.where("threadId").equals(threadId).count() || await db.agentTasks.where("threadId").equals(threadId).count()) throw new Error("已有对话不能切换项目，请新建对话");
        await db.chatThreads.update(threadId, {projectId, updatedAt: nowIso()});
    });
}
