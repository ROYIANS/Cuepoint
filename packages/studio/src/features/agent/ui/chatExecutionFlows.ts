import type {useNavigate} from "@tanstack/react-router";
import type {ChatThread} from "../models/chat";
import type {ConnectorConfig} from "../../settings/models/connector";
import type {AgentReasoningEffort} from "../models/agent";
import type {AgentInteractionMode} from "./composerTypes";
import type {ChatModelCatalog} from "../../settings/models/chatModelPolicy";
import type {RunAction} from "./AgentRunDetails";
import type {useReferenceDraft} from "./useReferenceDraft";
import {createChatThread, updateChatThread} from "../commands/chat";
import type {ChatAdmissionIdentity} from "../models/chatSubmission";
import type {AgentRun} from "../models/agent";
import {resolveConnector} from "../../settings/commands/connectors";
import {db} from "../../../platform/product/store";
import {assertRetryConnector, beginAgentRun} from "../commands/agentRuns";
import {cancelAgentRun, resolveAgentToolApproval} from "../commands/agentTools";
import {executeChatRun, resumeChatRun} from "../runtime/runChat";
import {withThreadRunLock} from "../runtime/runOwnership";
import {runWithCompatibleChatModel} from "../../settings/models/connectors";
import {deriveChatTitle} from "../models/chatTitle";
import type {ExecutionFeedbackInvocation} from "../runtime/executionFeedback";

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
    threadId: string;
    admission: ChatAdmissionIdentity;
    onThreadReady: (thread: ChatThread) => void;
    onAdmitted: (run: AgentRun) => void;
    navigateToThread?: boolean;
    destinationReserved?: boolean;
    onDestinationReady?: () => void;
    feedback?: ExecutionFeedbackInvocation;
}

export async function executeNewChatMessage({
                                                content,
                                                attachments,
                                                references,
                                                activeThread,
                                                activeThreadId,
                                                connector,
                                                model,
                                                taskMode,
                                                projectId,
                                                interactionMode,
                                                reasoningEffort,
                                                catalogMatches,
                                                modelCatalog,
                                                controller,
                                                bindThread,
                                                navigate,
                                                isCurrent, threadId, admission, onThreadReady, onAdmitted,
                                                navigateToThread, destinationReserved, onDestinationReady, feedback
                                            }: NewMessageFlow) {
    return runWithCompatibleChatModel(connector, model, async () => {
        let thread = activeThread;
        if (!thread) {
            thread = await createChatThread({
                id: threadId,
                connectorId: connector.id,
                model,
                title: deriveChatTitle(content),
                taskMode,
                projectId
            });
            onThreadReady(thread);
            feedback?.bindThread(thread.id);
            if (controller.signal.aborted) return;
            bindThread(thread.id);

        }
        const targetThread = thread;
        await withThreadRunLock(targetThread.id, async (ownership) => {
            if (controller.signal.aborted) return;
            // Acquire execution ownership before mounting detail recovery effects.
            if (!activeThread || navigateToThread) {
                if (!destinationReserved) {
                    references.reserveDestination(JSON.stringify([targetThread.id, projectId]));
                    onDestinationReady?.();
                }
                bindThread(targetThread.id);
                await navigate({to: "/agent/$threadId", params: {threadId: targetThread.id}});
            }
            if (controller.signal.aborted) return;
            await db.transaction("rw", [db.chatThreads], async tx => {
                const current = await tx.chatThreads.get(targetThread.id);
                if (!current || current.projectId !== projectId) throw new Error("对话或项目归属已变化，请核对后重新发送");
                await updateChatThread(targetThread.id, {
                    interactionMode: activeThreadId ? interactionMode : "smart",
                    reasoningSelection: {
                        connectorId: connector.id,
                        baseUrl: connector.baseUrl,
                        model,
                        value: reasoningEffort
                    }
                }, tx);
            });
            if (controller.signal.aborted) return;
            const run = await beginAgentRun({
                admission,
                expectedOwner: {projectId},
                threadId: targetThread.id,
                connector,
                model,
                content,
                attachments,
                modelMetadata: catalogMatches ? modelCatalog?.metadata?.[model] : undefined,
                reasoningEffort,
                interactionMode: activeThreadId ? interactionMode : "smart"
            });
            onAdmitted(run);
            feedback?.admitted(run);
            await executeChatRun(run, connector.apiKey, controller, undefined, undefined, undefined, ownership, feedback?.runtime);
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
    feedback?: ExecutionFeedbackInvocation;
}

export async function retryFrozenChatRun({runId, activeThreadId, controller, isThreadCurrent, feedback}: ExistingRunFlow) {
    const previous = await db.agentRuns.get(runId);
    if (!previous || previous.threadId !== activeThreadId) throw new Error("执行不存在");
    const connector = await resolveConnector(previous.connector.id);
    if (!connector) throw new Error("原连接已删除，请重新配置后发送新消息");
    assertRetryConnector(previous, connector);
    return runWithCompatibleChatModel(connector, previous.model, () =>
        withThreadRunLock(previous.threadId, async (ownership) => {
            if (controller.signal.aborted) return;
            const run = await beginAgentRun({
                threadId: previous.threadId,
                connector,
                model: previous.model,
                retryOfRunId: previous.id
            });
            feedback?.admitted(run);
            await executeChatRun(run, connector.apiKey, controller, undefined, undefined, undefined, ownership, feedback?.runtime);
        }), {
        signal: controller.signal,
        isCurrent: () => isThreadCurrent(previous.threadId),
    });

}

export async function resolveChatRunAction({
                                               runId,
                                               action,
                                               callId,
                                               activeThreadId,
                                               controller,
                                               isThreadCurrent, feedback
                                           }: ExistingRunFlow & { action: RunAction; callId?: string }) {
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
        withThreadRunLock(run.threadId, async (ownership) => {
            if (controller.signal.aborted) return;
            await resumeChatRun(run.id, connector.apiKey, controller, undefined, undefined, undefined, ownership, feedback?.runtime);
        }), {
        signal: controller.signal,
        isCurrent: () => isThreadCurrent(run.threadId),
    });

}
