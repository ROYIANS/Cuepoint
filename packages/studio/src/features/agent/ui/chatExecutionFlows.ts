import type {useNavigate} from "@tanstack/react-router";
import type {ChatThread} from "../models/chat";
import type {ConnectorConfig} from "../../settings/models/connector";
import type {AgentReasoningEffort, AgentRun, AgentInteractionMode} from "../models/agent";
import type {ChatModelCatalog} from "../../settings/models/chatModelPolicy";
import type {RunAction} from "../models/chatRunAction";
import type {useReferenceDraft} from "./useReferenceDraft";
import type {ChatAdmissionIdentity} from "../models/chatSubmission";
import type {ExecutionFeedbackInvocation} from "../runtime/executionFeedback";
import {db} from "../../../platform/product/store";
import * as flows from "../runtime/chatExecutionFlows";

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

/** Existing foreground handoff; execution itself is React/router independent. */
export function executeNewChatMessage(input: NewMessageFlow) {
    return flows.executeNewChatMessage({...input, originThreadId: input.activeThreadId,
        modelMetadata: input.catalogMatches ? input.modelCatalog?.metadata?.[input.model] : undefined,
        onThreadReady: thread => {
            input.onThreadReady(thread);
            if (!input.controller.signal.aborted) input.bindThread(thread.id);
        },
        beforeAdmission: async thread => {
            if (!input.activeThread || input.navigateToThread) {
                if (!input.destinationReserved) {
                    input.references.reserveDestination(JSON.stringify([thread.id, input.projectId]));
                    input.onDestinationReady?.();
                }
                input.bindThread(thread.id);
                await input.navigate({to: "/agent/$threadId", params: {threadId: thread.id}});
            }
        }
    }, {store: db});
}

interface ExistingRunFlow {
    runId: string;
    activeThreadId?: string;
    controller: AbortController;
    isThreadCurrent: (id: string) => boolean;
    feedback?: ExecutionFeedbackInvocation;
}

export function retryFrozenChatRun(input: ExistingRunFlow) {
    return flows.retryFrozenChatRun({...input, threadId: input.activeThreadId ?? "",
        isCurrent: () => input.isThreadCurrent(input.activeThreadId ?? "")}, {store: db});
}

export function resolveChatRunAction(input: ExistingRunFlow & {action: RunAction; callId?: string}) {
    return flows.resolveChatRunAction({...input, threadId: input.activeThreadId ?? "",
        isCurrent: () => input.isThreadCurrent(input.activeThreadId ?? "")}, {store: db});
}
