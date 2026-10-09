import type {useNavigate} from "@tanstack/react-router";
import type {ChatThread, ConnectorConfig} from "@/domain/types";
import type {AgentReasoningEffort} from "@/domain/agent";
import type {AgentInteractionMode} from "./composerTypes";
import type {ChatModelCatalog} from "@/lib/ai/chatModelPolicy";
import type {RunAction} from "./AgentRunDetails";
import type {useReferenceDraft} from "./useReferenceDraft";
import {createChatThread, updateChatThread} from "@/db/chat";
import {resolveConnector} from "@/db/connectors";
import {db} from "@/db/database";
import {beginAgentRun, assertRetryConnector} from "@/db/agentRuns";
import {cancelAgentRun, resolveAgentToolApproval} from "@/db/agentTools";
import {executeChatRun, resumeChatRun} from "@/lib/agent/runChat";
import {withThreadRunLock} from "@/lib/agent/runOwnership";
import {runWithCompatibleChatModel} from "@/lib/ai/connectors";
import {deriveChatTitle} from "@/lib/chatTitle";

type ReferenceDraft = ReturnType<typeof useReferenceDraft>;
interface NewMessageFlow {
    submitted: ReturnType<ReferenceDraft["capture"]>;
    content: string;
    attachments: ReturnType<ReferenceDraft["capture"]>["attachments"];
    references: ReferenceDraft;
    activeThread?: ChatThread;
    activeThreadId?: string;
    connector: ConnectorConfig;
    model: string;
    taskMode: boolean;
    projectId?: string;
    interactionMode: AgentInteractionMode;
    reasoningEffort?: AgentReasoningEffort;
    catalogMatches: boolean;
    modelCatalog?: ChatModelCatalog;
    controller: AbortController;
    bindThread: (id: string) => void;
    navigate: ReturnType<typeof useNavigate>;
    isCurrent: () => boolean;
}

export async function executeNewChatMessage({submitted, content, attachments, references, activeThread, activeThreadId, connector, model, taskMode, projectId, interactionMode, reasoningEffort, catalogMatches, modelCatalog, controller, bindThread, navigate, isCurrent}: NewMessageFlow) {
    return runWithCompatibleChatModel(connector, model, async () => {
        let thread = activeThread;
        if (!thread) {
            thread = await createChatThread({
                connectorId: connector.id,
                model,
                title: deriveChatTitle(content),
                taskMode,
                projectId
            });
            if (controller.signal.aborted) return;
            bindThread(thread.id);

        }
        const targetThread = thread;
        await withThreadRunLock(targetThread.id, async () => {
            if (controller.signal.aborted) return;
            // Acquire execution ownership before mounting detail recovery effects.
            let owner = submitted;
            if (!activeThread) {
                const transfer = references.moveTo(JSON.stringify([targetThread.id, projectId]), submitted);
                owner = transfer.submitted;
                try {
                    await navigate({to: "/agent/$threadId", params: {threadId: targetThread.id}});
                } catch (error) {
                    if (!transfer.restore()) throw new Error(`打开话题失败，发送草稿保留在「${targetThread.title}」中，请打开后重试`, {cause: error});
                    throw error;
                }
            }
            if (controller.signal.aborted) return;
            await updateChatThread(targetThread.id, {
                interactionMode: activeThreadId ? interactionMode : "smart",
                reasoningSelection: {
                    connectorId: connector.id,
                    baseUrl: connector.baseUrl,
                    model,
                    value: reasoningEffort
                }
            });
            const run = await beginAgentRun({
                threadId: targetThread.id,
                connector,
                model,
                content,
                attachments,
                modelMetadata: catalogMatches ? modelCatalog?.metadata?.[model] : undefined,
                reasoningEffort,
                interactionMode: activeThreadId ? interactionMode : "smart"
            });
            references.acknowledge(owner);
            await executeChatRun(run, connector.apiKey, controller);
        });

    }, {
        signal: controller.signal,
        isCurrent,
    });

}

interface ExistingRunFlow {
    runId: string;
    activeThreadId?: string;
    controller: AbortController;
    isThreadCurrent: (id: string) => boolean;
}
export async function retryFrozenChatRun({runId, activeThreadId, controller, isThreadCurrent}: ExistingRunFlow) {
    const previous = await db.agentRuns.get(runId);
    if (!previous || previous.threadId !== activeThreadId) throw new Error("执行不存在");
    const connector = await resolveConnector(previous.connector.id);
    if (!connector) throw new Error("原连接已删除，请重新配置后发送新消息");
    assertRetryConnector(previous, connector);
    return runWithCompatibleChatModel(connector, previous.model, () =>
        withThreadRunLock(previous.threadId, async () => {
            if (controller.signal.aborted) return;
            const run = await beginAgentRun({
                threadId: previous.threadId,
                connector,
                model: previous.model,
                retryOfRunId: previous.id
            });
            await executeChatRun(run, connector.apiKey, controller);
        }), {
        signal: controller.signal,
        isCurrent: () => isThreadCurrent(previous.threadId),
    });

}

export async function resolveChatRunAction({runId, action, callId, activeThreadId, controller, isThreadCurrent}: ExistingRunFlow & {action: RunAction; callId?: string}) {
    const run = await db.agentRuns.get(runId);
    if (!run || run.threadId !== activeThreadId) throw new Error("执行不存在");
    if (action === "cancel") {
        await withThreadRunLock(run.threadId, async () => {
            await cancelAgentRun(run.id);
        });
        return;
    }
    // Persist the decision independently of connector availability, so refusal
    // never requires sending another model request or having a working API key.
    if ((action === "approve" || action === "reject") && callId) {
        await withThreadRunLock(run.threadId, async () => {
            if (controller.signal.aborted) return;
            await resolveAgentToolApproval(run.id, callId, action);
        });
    }
    const outstanding = await db.agentToolCalls.where("runId").equals(run.id).filter((call) => call.status === "awaiting_approval").count();
    if (outstanding > 0) return;
    if (controller.signal.aborted) return;
    const connector = await resolveConnector(run.connector.id);
    if (!connector) throw new Error("决定已保存。原连接不存在，请恢复连接后继续或结束执行。");
    assertRetryConnector(run, connector);
    return runWithCompatibleChatModel(connector, run.model, () =>
        withThreadRunLock(run.threadId, async () => {
            if (controller.signal.aborted) return;
            await resumeChatRun(run.id, connector.apiKey, controller);
        }), {
        signal: controller.signal,
        isCurrent: () => isThreadCurrent(run.threadId),
    });

}
