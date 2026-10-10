import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {bindChatThreadProject, updateChatThread} from "@/db/chat";
import type {ChatThread, ConnectorConfig, Id} from "@/domain/types";
import type {AgentReasoningEffort} from "@/domain/agent";
import type {AgentInteractionMode, ChatSurfaceMode} from "./composerTypes";
import {getReasoningPolicy} from "@/lib/ai/reasoningPolicy";
import {
    buildChatModelOptions,
    type ChatModelCatalog,
    getChatModelPolicy,
    sameChatModelConnector
} from "@/lib/ai/chatModelPolicy";

type ThreadEffortSelection = NonNullable<ChatThread["reasoningSelection"]> & { threadId?: Id };

/** A thread-local choice is applicable only to the connector destination and model that offered it. */
function reasoningEffortForSelection(threadId: Id | undefined, thread: ChatThread | undefined,
                                     local: ThreadEffortSelection | undefined, connector: ConnectorConfig | undefined, model: string): AgentReasoningEffort | undefined {
    const selection = local?.threadId === threadId ? local : thread?.reasoningSelection;
    if (!selection?.value) return undefined;
    if (selection.connectorId !== connector?.id || selection.baseUrl !== connector?.baseUrl || selection.model !== model) return undefined;
    const policy = getReasoningPolicy(connector, model);
    return policy?.levels.includes(selection.value) ? selection.value : undefined;
}

export function useChatSelection({loaded, activeThread, activeThreadId, connectorList, modelCatalog}: {
    loaded: boolean;
    activeThread?: ChatThread;
    activeThreadId?: string;
    connectorList: ConnectorConfig[];
    modelCatalog?: ChatModelCatalog;
}) {
    const [sessionConnectorId, setSessionConnectorId] = useState<Id | undefined>();
    const [sessionModel, setSessionModel] = useState("");
    const [effortSelection, setEffortSelection] = useState<ThreadEffortSelection>();
    const [chatMode, setChatMode] = useState<ChatSurfaceMode>("agent");
    const [composerProjectId, setComposerProjectId] = useState<Id>();
    const [interactionSelection, setInteractionSelection] = useState<{ threadId?: Id; mode: AgentInteractionMode }>();
    const selectionRevisionRef = useRef(0);
    const threadId = activeThread?.id;
    const threadConnectorId = activeThread?.connectorId;
    const threadModel = activeThread?.model;
    useEffect(() => {
        if (!loaded) return;
        if (threadId !== undefined) {
            setSessionConnectorId(threadConnectorId ?? connectorList[0]?.id);
            setSessionModel(threadModel?.trim() ?? "");
            return;
        }
        setSessionConnectorId((prev) => prev ?? connectorList[0]?.id);
    }, [loaded, threadId, threadConnectorId, threadModel, connectorList]);

    const selectedConnector = useMemo(() => {
        if (sessionConnectorId) {
            return connectorList.find((c) => c.id === sessionConnectorId) ?? connectorList[0];
        }
        return connectorList[0];
    }, [sessionConnectorId, connectorList]);

    const modelValue = sessionModel.trim();
    const projectId = activeThreadId ? activeThread?.projectId : composerProjectId;
    const taskMode = activeThreadId ? Boolean(activeThread?.taskMode) : chatMode === "task";
    const interactionMode = interactionSelection?.threadId === activeThreadId ? interactionSelection?.mode ?? "smart" : activeThread?.interactionMode ?? "smart";
    const reasoningEffort = reasoningEffortForSelection(activeThreadId, activeThread, effortSelection, selectedConnector, modelValue);

    const modelPolicy = useMemo(() => getChatModelPolicy(selectedConnector, modelCatalog), [selectedConnector, modelCatalog]);
    const catalogMatches = sameChatModelConnector(selectedConnector, modelCatalog?.connector);
    const selectionRef = useRef({connector: selectedConnector, model: modelValue, threadId: activeThreadId});
    selectionRef.current = {connector: selectedConnector, model: modelValue, threadId: activeThreadId};
    const handleConnectorChange = useCallback(
        async (connectorId: string) => {
            selectionRevisionRef.current += 1;
            setSessionConnectorId(connectorId);
            if (activeThread) {
                await updateChatThread(activeThread.id, {connectorId});
            }
        },
        [activeThread],
    );

    const handleModelChange = useCallback(
        async (model: string) => {
            if (!buildChatModelOptions([], model, "", modelPolicy).includes(model.trim())) return;
            selectionRevisionRef.current += 1;
            setSessionModel(model);
            if (activeThread) {
                await updateChatThread(activeThread.id, {model});
            }
        },
        [activeThread, modelPolicy],
    );

    const handleProjectChange = useCallback(async (next?: Id) => {
        selectionRevisionRef.current += 1;
        if (activeThread) {
            if (!next) throw new Error("项目归属已锁定，不能清空");
            await bindChatThreadProject(activeThread.id, next, activeThread.projectId);
            return;
        }
        setComposerProjectId(next);
    }, [activeThread]);

    async function handleReasoningEffortChange(value?: AgentReasoningEffort) {
        if (!selectedConnector) return;
        const selection = {
            connectorId: selectedConnector.id,
            baseUrl: selectedConnector.baseUrl,
            model: modelValue,
            value
        };
        selectionRevisionRef.current += 1;
        setEffortSelection({...selection, threadId: activeThreadId});
        if (activeThreadId) await updateChatThread(activeThreadId, {reasoningSelection: selection});
    }

    function handleChatModeChange(mode: ChatSurfaceMode) {
        selectionRevisionRef.current += 1;
        setChatMode(mode);
    }

    async function handleInteractionModeChange(mode: AgentInteractionMode) {
        selectionRevisionRef.current += 1;
        setInteractionSelection({threadId: activeThreadId, mode});
        if (activeThreadId) await updateChatThread(activeThreadId, {interactionMode: mode});
    }

    const snapshot = {
        scope: activeThreadId ?? "home", revision: selectionRevisionRef.current, connector: selectedConnector,
        model: modelValue, reasoningEffort, interactionMode, projectId, taskMode
    };
    return {
        snapshot,
        selectedConnector,
        modelValue,
        projectId,
        taskMode,
        interactionMode,
        reasoningEffort,
        chatMode,
        modelPolicy,
        catalogMatches,
        selectionRef,
        selectionRevisionRef,
        setComposerProjectId,
        handleConnectorChange,
        handleModelChange,
        handleProjectChange,
        handleReasoningEffortChange,
        handleChatModeChange,
        handleInteractionModeChange
    };
}
