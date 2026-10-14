import type {ProductStore} from "@/lib/storage/types";
import {db as productDb} from "./database";
import {getMemorySelection} from "./memoryRetrieval";
import {type AgentInteractionMode, type AgentRun, GENERAL_AGENT_ID} from "@/domain/agent";
import type {ReferenceAttachment} from "@/domain/references";
import type {ChatModelMetadata} from "@/lib/ai/modelMetadata";
import {initModelCatalog} from "@/lib/ai/modelCatalog/store";
import {requireVision, resolveVisionCapability} from "@/lib/ai/visionCapability";
import {getTaskContext} from "@/lib/agent/taskContext";
import {projectContextTables} from "@/lib/agent/projectContext";
import {normalizeContextPolicy, resolveContextCapacity} from "@/lib/agent/contextPolicy";
import {selectContextHistory} from "@/lib/agent/contextPlanner";
import {referenceSelectionCharacterBudget, selectReferenceContext} from "@/lib/agent/referenceContext";

export type ContextPreviewInput = {
    threadId?: string;
    projectId?: string;
    interactionMode?: AgentInteractionMode;
    draft: string;
    attachments: ReferenceAttachment[];
    model: string;
    providerId?: string;
    metadata?: ChatModelMetadata;
};

/** Scope and request inputs only; credentials and parent-page loading results are excluded. */
export function contextPreviewIdentity(input: ContextPreviewInput): string {
    return JSON.stringify([input.threadId ?? null, input.projectId ?? null, input.interactionMode ?? "smart",
        input.draft, input.attachments, input.model, input.providerId ?? null, input.metadata ?? null]);
}

/** Includes every store used by nested project/task/memory/reference readers. */
export function contextPreviewTables(store?: ProductStore) {
    const db = store ?? productDb;
    return [...new Set([db.agents, db.chatThreads, db.chatMessages, db.agentRuns, db.contextCompactions,
        db.agentTasks, db.agentTaskRecords, db.projectMemories, db.projectReferences, db.referenceChunks,
        db.media, ...projectContextTables(db)])];
}

type Unavailable = { identity: string; status: "unavailable"; message: string };
type Missing = { identity: string; status: "missing"; entity: "agent" | "thread" | "project" };

async function readScopedRows(threadId: string | undefined, projectId: string | undefined, store?: ProductStore) {
    const db = store ?? productDb;
    const [config, messages, runs, records, project, task] = await Promise.all([
        db.agents.get(GENERAL_AGENT_ID),
        threadId ? db.chatMessages.where("threadId").equals(threadId).sortBy("createdAt") : [],
        threadId ? db.agentRuns.where("threadId").equals(threadId).sortBy("createdAt") : [],
        threadId ? db.contextCompactions.where("threadId").equals(threadId).sortBy("createdAt") : [],
        projectId ? db.projects.get(projectId) : undefined,
        threadId ? db.agentTasks.where("threadId").equals(threadId).first() : undefined,
    ]);
    return {config, messages, runs, records, project, task};
}

function currentSavedRun(runs: Awaited<ReturnType<typeof readScopedRows>>["runs"]) {
    const latest = runs.at(-1);
    if (!latest) return undefined;
    const active = latest.status === "running" || latest.status === "waiting_approval";
    const recoverable = latest.hasToolCalls && (latest.status === "failed" || latest.status === "interrupted");
    return active || recoverable ? latest : undefined;
}

async function selectPreviewMaterials(input: ContextPreviewInput, rows: Awaited<ReturnType<typeof readScopedRows>>,
                                      thread: import("@/domain/types").ChatThread | undefined, projectId: string | undefined,
                                      vision: Awaited<ReturnType<typeof resolveVisionCapability>>, activeRun: AgentRun | undefined, store?: ProductStore) {
    const db = store ?? productDb;
    // Optional saved fields remain absent, rather than acquiring new live selections.
    if (activeRun) return {
        previewPolicy: normalizeContextPolicy(activeRun.context?.policy),
        taskContext: undefined, memorySelection: undefined, selectedReferences: undefined
    };
    const previewPolicy = normalizeContextPolicy(thread ? thread.contextPolicy : rows.config?.contextPolicy);
    const taskContext = await getTaskContext(input.threadId, rows.config?.instructions ?? "",
        thread?.taskMode, input.interactionMode, projectId, db);
    const capacity = resolveContextCapacity(input.model, input.metadata, input.providerId, previewPolicy).capacity;
    const memorySelection = taskContext.projectContext ? await getMemorySelection({
        projectId: taskContext.projectContext.projectId, threadId: input.threadId, draft: input.draft,
        recentUserTurns: selectContextHistory(rows.messages, previewPolicy).filter(message => message.role === "user").map(message => message.content),
        taskTitle: taskContext.task?.title, taskGoal: taskContext.task?.goal, capacity,
    }, db) : undefined;
    const selectedReferences = await selectReferenceContext(projectId, input.attachments, referenceSelectionCharacterBudget(capacity), db);
    if (selectedReferences?.images?.length) requireVision(vision);
    return {previewPolicy, taskContext, memorySelection, selectedReferences};
}

async function readFacts(input: ContextPreviewInput, identity: string, vision: Awaited<ReturnType<typeof resolveVisionCapability>>, store?: ProductStore) {
    const db = store ?? productDb;
    return db.transaction("r", [contextPreviewTables(db)].flat(), async (db) => {
        const thread = input.threadId ? await db.chatThreads.get(input.threadId) : undefined;
        if (input.threadId && !thread) return {identity, status: "missing", entity: "thread"} satisfies Missing;
        if (thread && input.projectId !== undefined && thread.projectId !== input.projectId)
            return {identity, status: "unavailable", message: "对话与当前项目范围不匹配"} satisfies Unavailable;
        const projectId = thread ? thread.projectId : input.projectId;
        const rows = await readScopedRows(input.threadId, projectId, db);
        const activeRun = currentSavedRun(rows.runs);
        if ((rows.task && rows.task.projectId !== projectId) || (activeRun && activeRun.projectId !== projectId))
            return {identity, status: "unavailable", message: "任务或执行记录与对话范围不匹配"} satisfies Unavailable;
        const projectAvailable = !projectId || (!!rows.project && projectId !== "studio");
        if (!activeRun && !rows.config) return {identity, status: "missing", entity: "agent"} satisfies Missing;
        if (!activeRun && !projectAvailable) return {identity, status: "missing", entity: "project"} satisfies Missing;
        const selected = await selectPreviewMaterials(input, rows, thread, projectId, vision, activeRun, db);
        return {
            identity, status: "ready" as const, facts: {
                config: rows.config, thread, projectId, available: projectAvailable && !!rows.config,
                messages: rows.messages, records: rows.records, activeRun, ...selected,
            }
        };
    });
}

export type ContextPreviewRead = Awaited<ReturnType<typeof readFacts>> | {
    identity: string;
    status: "error";
    message: string
};

/** Model catalog loading finishes before the final coherent IndexedDB read. */
export async function readAgentContextPreview(input: ContextPreviewInput, store?: ProductStore): Promise<ContextPreviewRead> {
    const db = store ?? productDb;
    const identity = contextPreviewIdentity(input);
    try {
        await initModelCatalog();
        const vision = await resolveVisionCapability(input.model, input.providerId, input.metadata);
        return await readFacts(input, identity, vision, db);
    } catch (error) {
        return {identity, status: "error", message: error instanceof Error ? error.message : "上下文暂时无法读取"};
    }
}
