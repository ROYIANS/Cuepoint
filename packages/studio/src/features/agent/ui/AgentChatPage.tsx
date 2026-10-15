import {ModuleLayout} from "../../../app/layout/ModuleLayout";
import {ShotDetailsProvider} from "../../../app/details/ShotDetails";
import {TopicSidebar} from "./TopicSidebar";
import {useChatSelection} from "./useChatSelection";
import {useChatExecutionSession} from "./useChatExecutionSession";
import {executeNewChatMessage, resolveChatRunAction, retryFrozenChatRun} from "./chatExecutionFlows";
import {createChatThread, updateChatThread} from "../commands/chat";
import {deleteChatThread} from "./../commands/lifecycle";
import {pauseThreadGeneration} from "../../video/agent/generationBatchRuntime";
import {pauseAudioGenerationBatches} from "../../audio/generation/batchRuntime";
import {useReferenceDraft} from "./useReferenceDraft";
import {useThreadDeparture} from "./useThreadDeparture";
import {runBlocksThread} from "../models/agentToolSelection";
import {TaskBoard} from "./TaskBoard";
import {TaskInspector} from "./TaskInspector";
import type {ManualDraftDeparture} from "../../../app/drafts/useManualDraftGuard";
import {AgentActivityNavigationProvider} from "./AgentActivityNavigation";
import {AgentComposerAttention} from "./AgentComposerAttention";
import {createAgentTaskForThread, setAgentTaskLifecycle} from "../commands/agentTasks";
import {getTaskDisplayState, TASK_STATE_LABELS} from "../runtime/taskState";
import type {AgentRun} from "../models/agent";
import {ContextUsageTrigger} from "./ContextUsagePanel";
import type {RunAction} from "./AgentRunDetails";
import {Link, useNavigate} from "@tanstack/react-router";
import {useProductQuery} from "../../../platform/product/queries";
import {Button, Empty, Flexbox} from "@lobehub/ui";
import {useCallback, useEffect, useMemo, useRef, useState,} from "react";
import {toast} from "sonner";
import {showError} from "../../../app/errors/showError";
import {ChatWorkspace} from "./ChatWorkspace";
import {createSubmissionAttempt, yieldSubmissionPaint, type ChatSubmissionAttempt} from "./chatSubmissionAttempts";
import {readAgentAdmission} from "../queries/agentAdmission";
import {resolveConnector} from "../../settings/commands/connectors";
import {StorageError} from "../../../platform/storage/errors";
import type {ComposerProps} from "./composerTypes";
import {HomeWelcome} from "./HomeWelcome";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "../../../ui/alert-dialog";
import {Button as UiButton} from "../../../ui/button";
import {Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,} from "../../../ui/dialog";
import {Input} from "../../../ui/input";
import {type ChatThread} from "../models/chat";
import {type Id} from "../../../platform/identity";
import {STUDIO_LIBRARY_ID} from "../../library/models/ownership";
import {canRetryRun} from "../commands/agentRuns";
import {recoverAbandonedRuns, withThreadRunLock} from "../runtime/runOwnership";
import type {SubmissionAction} from "./SubmissionMessage";
import {recoverTaskWrapups} from "../runtime/taskWrapup";
import {discoverConnectorChatModels} from "../../settings/models/connectors";
import {
    buildChatModelOptions,
    type ChatModelCatalog,
    chatModelIssue,
    sameChatModelConnector,
} from "../../settings/models/chatModelPolicy";

export function AgentChatPage({threadId, view}: { threadId?: Id; view?: "tasks" }) {
    return <ShotDetailsProvider><AgentActivityNavigationProvider threadId={threadId}><AgentChatInner threadId={threadId}
                                                                                view={view}/></AgentActivityNavigationProvider></ShotDetailsProvider>;
}

function AgentChatInner({threadId, view}: { threadId?: Id; view?: "tasks" }) {
    const navigate = useNavigate();
    const threads = useProductQuery((db) => db.chatThreads.orderBy("updatedAt").reverse().toArray(), []);
    const tasks = useProductQuery((db) => db.agentTasks.orderBy("updatedAt").reverse().toArray(), []);
    const boardRuns = useProductQuery((db) => view === "tasks" ? db.agentRuns.toArray() : Promise.resolve([] as AgentRun[]), [view]);
    const activeTask = tasks?.find((task) => task.threadId === threadId);
    const [taskInspectorOpen, setTaskInspectorOpen] = useState(false);
    const taskDeparture = useRef<ManualDraftDeparture | undefined>(undefined);
    const registerTaskDeparture = useCallback((request: ManualDraftDeparture | undefined) => {
        taskDeparture.current = request;
    }, []);
    const leaveTask = useCallback((leave: () => void) => {
        if (taskDeparture.current) taskDeparture.current(leave);
        else leave();
    }, []);
    const openBoard = () => leaveTask(() => {
        void navigate({to: "/agent/tasks"});
    });
    const connectors = useProductQuery((db) => db.connectors.toArray(), []);
    const projects = useProductQuery((db) => db.projects.orderBy("updatedAt").reverse().filter((project) => project.id !== STUDIO_LIBRARY_ID).toArray(), []);
    const activeThreadId = threadId;
    const [contextOpen, setContextOpen] = useState(false);
    const [modelCatalog, setModelCatalog] = useState<ChatModelCatalog>();
    const [renameTarget, setRenameTarget] = useState<ChatThread>();
    const [renameValue, setRenameValue] = useState("");
    const [deleteTarget, setDeleteTarget] = useState<ChatThread>();
    const deleteLock = useRef<string | undefined>(undefined);
    const [deleting, setDeleting] = useState(false);
    const currentThread = useRef(threadId);
    currentThread.current = threadId;
    const mounted = useRef(true);
    const [submissionAttempts, setSubmissionAttempts] = useState<ChatSubmissionAttempt[]>([]);
    const attemptsRef = useRef(submissionAttempts);
    const presentation = useRef<{threadId: string; key: string} | undefined>(undefined);
    const updateAttempt = useCallback((id: string, patch: Partial<ChatSubmissionAttempt>) => {
        if (!mounted.current) return;
        attemptsRef.current = attemptsRef.current.map(attempt => attempt.admission.userMessageId === id ? {...attempt, ...patch} : attempt);
        setSubmissionAttempts(attemptsRef.current);
    }, []);
    const removeAttempt = useCallback((id: string) => {
        if (!mounted.current) return;
        if (attemptsRef.current.some(attempt => attempt.admission.userMessageId === id && attempt.recoveryRequired)) return;
        attemptsRef.current = attemptsRef.current.filter(attempt => attempt.admission.userMessageId !== id);
        setSubmissionAttempts(attemptsRef.current);
    }, []);
    useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
        };
    }, []);
    const {
        sending,
        abortRef,
        executionThreadRef,
        sendLockRef,
        acquire: acquireExecution,
        release: releaseExecution
    } = useChatExecutionSession(activeThreadId);

    useEffect(() => {
        if (!activeThreadId) return;
        const pause = () => {
            pauseThreadGeneration(activeThreadId);
            pauseAudioGenerationBatches({threadId: activeThreadId});
        };
        window.addEventListener('pagehide', pause);
        return () => {
            window.removeEventListener('pagehide', pause);
            pause();
        };
    }, [activeThreadId]);

    const loaded = threads !== undefined && connectors !== undefined && projects !== undefined;
    const threadList = useMemo(() => threads ?? [], [threads]);
    const connectorList = useMemo(() => connectors ?? [], [connectors]);

    const routedThread = useProductQuery(
        async (db) => {
            if (!activeThreadId) {
                return {forId: null as Id | null, thread: null as ChatThread | null};
            }
            return {
                forId: activeThreadId,
                thread: (await db.chatThreads.get(activeThreadId)) ?? null,
            };
        },
        [activeThreadId],
    );

    useEffect(() => {
        if (!activeThreadId || routedThread === undefined) return;
        // Stale home null while deps already show a new id — ignore until query catches up.
        if (routedThread.forId !== activeThreadId) return;
        if (routedThread.thread === null) {
            void navigate({to: "/agent", replace: true});
        }
    }, [activeThreadId, routedThread, navigate]);

    const activeThread = useMemo(() => {
        const fromList = threadList.find((t) => t.id === activeThreadId);
        if (fromList) return fromList;
        if (
            routedThread &&
            routedThread.forId === activeThreadId &&
            routedThread.thread
        ) {
            return routedThread.thread;
        }
        // Only a positively created first-send receipt can bridge query hydration.
        // A matching null remains a genuine deletion/missing result.
        if (activeThreadId && routedThread?.forId !== activeThreadId) {
            return submissionAttempts.find(attempt => attempt.createdThread?.id === activeThreadId)?.createdThread;
        }
        return undefined;
    }, [threadList, activeThreadId, routedThread, submissionAttempts]);

    const messages = useProductQuery(
        async (db) => {
            if (!activeThreadId) return [];
            return db.chatMessages.where("threadId").equals(activeThreadId).sortBy("createdAt");
        },
        [activeThreadId],
    );

    const compactions = useProductQuery((db) => activeThreadId ? db.contextCompactions.where("threadId").equals(activeThreadId).sortBy("createdAt") : [], [activeThreadId]);
    const runs = useProductQuery(async (db) => {
        if (!activeThreadId) return [];
        return db.agentRuns.where("threadId").equals(activeThreadId).sortBy("createdAt");
    }, [activeThreadId]);

    const {
        request: requestDeparture,
        confirmation: departureConfirmation,
        armOnce: armConfirmedDeparture
    } = useThreadDeparture(activeThreadId, runs);

    const openThread = useCallback(
        (id: Id) => {
            if (id === activeThreadId) return;
            // Topic confirmation first, then the task inspector's own draft guard: the
            // run keeps its saved steps either way, and a declined guard must not
            // silently consume the user's leave request.
            requestDeparture(() => leaveTask(() => {
                if (executionThreadRef.current !== id) abortRef.current?.abort();
                // The decision was already confirmed; the route blocker must not ask again.
                armConfirmedDeparture();
                void navigate({to: "/agent/$threadId", params: {threadId: id}});
            }));
        },
        [abortRef, executionThreadRef, navigate, leaveTask, activeThreadId, requestDeparture, armConfirmedDeparture],
    );


    useEffect(() => {
        const recover = () => void recoverAbandonedRuns().catch((error: unknown) => {
            toast.error(error instanceof Error ? error.message : "恢复执行状态失败");
        });
        recover();
        window.addEventListener("focus", recover);
        return () => window.removeEventListener("focus", recover);
    }, []);

    useEffect(() => {
        if (!activeThreadId) return;
        const recover = () => void recoverTaskWrapups(activeThreadId).catch((error: unknown) => {
            toast.error(error instanceof Error ? error.message : "恢复总结状态失败");
        });
        recover();
        window.addEventListener("focus", recover);
        return () => window.removeEventListener("focus", recover);
    }, [activeThreadId]);

    const selection = useChatSelection({loaded, activeThread, activeThreadId, connectorList, modelCatalog});
    const {
        chatMode, selectionRef, selectionRevisionRef, modelPolicy, catalogMatches, setComposerProjectId,
        handleConnectorChange, handleModelChange, handleProjectChange, handleReasoningEffortChange,
        handleChatModeChange, handleInteractionModeChange
    } = selection;
    const {
        connector: selectedConnector,
        model: modelValue,
        projectId,
        taskMode,
        interactionMode,
        reasoningEffort
    } = selection.snapshot;
    const references = useReferenceDraft(JSON.stringify([activeThreadId ?? "home", projectId]), projectId);
    const {text: draft, setText: setDraft} = references;
    const projectRequired = taskMode && !projectId;
    const projectUnavailable = Boolean(projectId && projects && !projects.some((project) => project.id === projectId));
    const visibleAttempts = submissionAttempts.filter(attempt => activeThreadId ? attempt.threadId === activeThreadId :
        attempt.phase !== "accepted" && attempt.submitted.scope === JSON.stringify(["home", projectId]));
    const showHome = !activeThreadId && view !== "tasks" && visibleAttempts.length === 0;
    const provisionalHome = !activeThreadId && visibleAttempts.length > 0;
    if (presentation.current && activeThreadId && presentation.current.threadId !== activeThreadId) presentation.current = undefined;
    const probingModels = Boolean(selectedConnector && (!catalogMatches || modelCatalog?.status === "loading"));

    // Discovery follows connection identity, independent of unrelated connector metadata updates.
    const discoveryId = selectedConnector?.id;
    const discoveryDefinitionId = selectedConnector?.definitionId;
    const discoveryBaseUrl = selectedConnector?.baseUrl;
    const discoveryApiKey = selectedConnector?.apiKey;
    useEffect(() => {
        if (discoveryDefinitionId === undefined || discoveryBaseUrl === undefined || discoveryApiKey === undefined) return;
        const connector = {
            id: discoveryId,
            definitionId: discoveryDefinitionId,
            baseUrl: discoveryBaseUrl,
            apiKey: discoveryApiKey
        };
        let cancelled = false;
        const controller = new AbortController();
        setModelCatalog((previous) => ({
            connector,
            status: "loading",
            models: [],
            incompatibleModels: sameChatModelConnector(connector, previous?.connector)
                ? previous?.incompatibleModels ?? [] : [],
        }));
        void discoverConnectorChatModels(connector, {signal: controller.signal})
            .then((result) => {
                if (cancelled) return;
                setModelCatalog((previous) => ({
                    connector,
                    status: result.ok ? "ready" : "error",
                    models: result.ok ? result.models : [],
                    metadata: result.ok ? result.metadata : undefined,
                    incompatibleModels: result.ok ? result.incompatibleModels : previous?.incompatibleModels ?? [],
                }));
            })
            .catch(() => {
                // A rejecting transport is an ordinary discovery failure, not a permanent probe.
                if (cancelled) return;
                setModelCatalog((previous) => ({
                    connector,
                    status: "error",
                    models: [],
                    incompatibleModels: sameChatModelConnector(connector, previous?.connector)
                        ? previous?.incompatibleModels ?? [] : [],
                }));
            });
        return () => {
            cancelled = true;
            controller.abort();
        };
    }, [discoveryId, discoveryDefinitionId, discoveryBaseUrl, discoveryApiKey]);

    const createTopic = useCallback((projectOverride?: Id) => leaveTask(() => {
        if (deleteLock.current) return;
        // One confirmation covers the whole action, including the navigation it causes.
        requestDeparture(() => {
            abortRef.current?.abort();
            void (async () => {
                const thread = await createChatThread({
                    connectorId: selectedConnector?.id,
                    model: modelValue || undefined,
                    projectId: projectOverride ?? projectId,
                    taskMode,
                });
                armConfirmedDeparture();
                void navigate({to: "/agent/$threadId", params: {threadId: thread.id}});
            })().catch((error: unknown) => showError({
                title: "创建对话失败",
                cause: error,
                actionName: "create-thread"
            }));
        });
    }), [abortRef, navigate, selectedConnector?.id, modelValue, projectId, taskMode, leaveTask, requestDeparture, armConfirmedDeparture]);
    const handleNewTopic = useCallback(() => createTopic(), [createTopic]);
    const handleNewTopicInProject = useCallback((id: Id) => createTopic(id), [createTopic]);

    const handleRenameThread = useCallback((thread: ChatThread) => {
        setRenameTarget(thread);
        setRenameValue(thread.title);
    }, []);

    const [renaming, setRenaming] = useState(false);
    const commitRename = useCallback(async () => {
        if (!renameTarget || renaming) return;
        setRenaming(true);
        try {
            await updateChatThread(renameTarget.id, {
                title: renameValue.trim() || renameTarget.title,
            });
            setRenameTarget(undefined);
        } catch (error) {
            // Keep the dialog and its typed title so the retry costs no retyping.
            showError({title: "重命名失败", cause: error, actionName: "rename-thread"});
        } finally {
            if (mounted.current) setRenaming(false);
        }
    }, [mounted, renameTarget, renameValue, renaming]);

    const handleDeleteThread = useCallback((thread: ChatThread) => {
        if (deleteLock.current) return;
        setDeleteTarget(thread);
    }, []);

    const commitDelete = useCallback(() => {
        const target = deleteTarget;
        if (!target || deleteLock.current) return;
        const remove = () => {
            if (deleteLock.current || !mounted.current) return;
            deleteLock.current = target.id;
            setTaskInspectorOpen(false);
            setDeleting(true);
            void (async () => {
                try {
                    if (abortRef.current && executionThreadRef.current === target.id) abortRef.current.abort();
                    await deleteChatThread(target.id);
                    if (!mounted.current) return;
                    if (currentThread.current === target.id) {
                        armConfirmedDeparture();
                        void navigate({to: "/agent", replace: true});
                    }
                    setDeleteTarget(current => current?.id === target.id ? undefined : current);
                } catch (error) {
                    if (mounted.current) showError({title: "删除对话失败", cause: error, actionName: "delete-thread"});
                } finally {
                    deleteLock.current = undefined;
                    if (mounted.current) setDeleting(false);
                }
            })();
        };
        // A declined task-departure guard must not silently discard this confirmation:
        // the dialog stays open until removal actually starts.
        if (currentThread.current !== target.id) {
            remove();
            return;
        }
        leaveTask(() => requestDeparture(remove));
    }, [abortRef, deleteTarget, executionThreadRef, navigate, leaveTask, requestDeparture, armConfirmedDeparture]);

    const handleStop = useCallback(() => {
        abortRef.current?.abort();
        if (activeThreadId) pauseAudioGenerationBatches({threadId: activeThreadId});
    }, [abortRef, activeThreadId]);

    const runSubmission = useCallback(async (attempt: ChatSubmissionAttempt, connector: NonNullable<typeof selectedConnector>, retry = false) => {
        const token = acquireExecution();
        if (!token) return;
        const id = attempt.admission.userMessageId;
        const selectionRevision = selectionRevisionRef.current;
        let admitted = attempt.phase === "accepted";
        updateAttempt(id, {phase: "preparing", error: undefined});
        try {
            // The provisional row/composer are already registered before this yield.
            await yieldSubmissionPaint();
            if (token.controller.signal.aborted) throw new Error("发送已停止");
            if (retry) {
                const status = await readAgentAdmission({threadId: attempt.threadId, admission: attempt.admission,
                    connector: attempt.connector, model: attempt.model, projectId: attempt.projectId,
                    content: attempt.submitted.text.trim(), attachments: attempt.submitted.attachments});
                if (status.status === "accepted") {
                    admitted = true;
                    updateAttempt(id, {phase: "accepted", recoveryRequired: status.run.status === "running", error: undefined});
                    return; // Accepted evidence never authorizes another model request.
                }
                if (status.status !== "absent") {
                    updateAttempt(id, {phase: "uncertain", error: "发送记录不一致，请核对话题记录"});
                    return;
                }
                if (token.controller.signal.aborted) throw new Error("发送已停止");
            }
            const checked = await executeNewChatMessage({
                submitted: attempt.submitted, content: attempt.submitted.text.trim(), attachments: attempt.submitted.attachments,
                references, activeThread: attempt.createdThread ?? (activeThread?.id === attempt.threadId ? activeThread : undefined),
                activeThreadId: attempt.originThreadId, connector, model: attempt.model,
                taskMode: attempt.taskMode, projectId: attempt.projectId, interactionMode: attempt.interactionMode,
                reasoningEffort: attempt.reasoningEffort, catalogMatches, modelCatalog,
                controller: token.controller, navigate, threadId: attempt.threadId, admission: attempt.admission,
                navigateToThread: !attempt.originThreadId && currentThread.current !== attempt.threadId,
                destinationReserved: attempt.destinationReserved,
                onDestinationReady: () => updateAttempt(id, {destinationReserved: true}),
                bindThread: target => {executionThreadRef.current = target;},
                onThreadReady: thread => updateAttempt(id, {createdThread: thread}),
                onAdmitted: () => {admitted = true; updateAttempt(id, {phase: "accepted", error: undefined});},
                isCurrent: () => selectionRevisionRef.current === selectionRevision &&
                    sameChatModelConnector(selectionRef.current.connector, connector) &&
                    selectionRef.current.model === attempt.model && selectionRef.current.threadId === activeThreadId
            });
            if (!admitted) updateAttempt(id, {phase: "failed", error: checked && !checked.ok && !checked.aborted ? checked.message : "发送已停止，可重试或恢复草稿"});
        } catch (error) {
            const uncertain = !admitted && error instanceof StorageError && error.certainty === "unknown";
            if (!admitted) {
                updateAttempt(id, {phase: uncertain ? "uncertain" : "failed", error: uncertain ?
                    "尚无法确认发送结果，请核对状态" : "发送未完成，可重试或恢复草稿"});
                if (uncertain) {
                    try {
                        const status = await readAgentAdmission({threadId: attempt.threadId, admission: attempt.admission,
                            connector: attempt.connector, model: attempt.model, projectId: attempt.projectId,
                            content: attempt.submitted.text.trim(), attachments: attempt.submitted.attachments});
                        if (status.status === "accepted") updateAttempt(id, {phase: "accepted", recoveryRequired: status.run.status === "running", error: undefined});
                    } catch { /* An unavailable read never proves rollback. */ }
                }
            }
            showError({title: uncertain ? "发送状态待确认" : "发送失败", cause: error, actionName: "send-message",
                ...(error instanceof Error ? {detail: error.message.replaceAll(connector.apiKey, "[已隐藏]")} : {})});
        } finally {
            releaseExecution(token);
        }
    }, [acquireExecution, releaseExecution, updateAttempt, references, activeThread, activeThreadId, catalogMatches,
        modelCatalog, navigate, executionThreadRef, selectionRevisionRef, selectionRef]);

    const handleSend = useCallback(async () => {
        const submitted = references.capture();
        if (!mounted.current || (!submitted.text.trim() && !submitted.attachments.length) || submitted.imports.length || sendLockRef.current) return;
        if (projectRequired || projectUnavailable) {
            toast.error(projectRequired ? "任务模式请先选择项目" : "项目已不可用，请选择其他项目开启新对话");
            return;
        }
        if (!selectedConnector) {toast.error("请先配置连接"); return;}
        // Calling runSubmission claims its ref lock synchronously, before yielding.
        const attempt = createSubmissionAttempt({originThreadId: activeThreadId, projectId, submitted,
            recovery: references.consume(submitted), connector: {id: selectedConnector.id,
                definitionId: selectedConnector.definitionId, baseUrl: selectedConnector.baseUrl},
            model: modelValue, taskMode: chatMode === "task", interactionMode, reasoningEffort});
        attemptsRef.current = [...attemptsRef.current, attempt];
        setSubmissionAttempts(attemptsRef.current);
        if (!activeThreadId) presentation.current = {threadId: attempt.threadId, key: attempt.admission.userMessageId};
        await runSubmission(attempt, {...selectedConnector});
    }, [references, sendLockRef, projectRequired, projectUnavailable, selectedConnector, activeThreadId, projectId,
        modelValue, chatMode, interactionMode, reasoningEffort, runSubmission]);

    const handleSubmissionAction = useCallback(async (id: string, action: SubmissionAction) => {
        if (sendLockRef.current) return;
        const attempt = attemptsRef.current.find(item => item.admission.userMessageId === id);
        if (!attempt) return;
        if (action === "recover") {
            if (attempt.phase !== "accepted" || !attempt.recoveryRequired || currentThread.current !== attempt.threadId) return;
            const token = acquireExecution();
            if (!token) return;
            try {
                // Explicit state recovery takes the existing thread lock, never dispatches a model.
                await withThreadRunLock(attempt.threadId, () => Promise.resolve());
                updateAttempt(id, {recoveryRequired: false, error: undefined});
            } catch (error) {
                updateAttempt(id, {error: "暂时无法恢复对话，请稍后重试"});
                showError({title: "暂时无法恢复对话", cause: error, actionName: "recover-submission"});
            } finally {releaseExecution(token);}
            return;
        }
        if (currentThread.current ? attempt.threadId !== currentThread.current :
            attempt.submitted.scope !== references.capture().scope) return;
        if (action === "restore") {
            if (attempt.phase !== "failed") return;
            if (references.restore(attempt.submitted, attempt.recovery)) removeAttempt(id);
            else toast.error("当前草稿已有改动，发送内容仍保留在消息中");
            return;
        }
        if (action === "check") {
            if (attempt.phase !== "uncertain") return;
            updateAttempt(id, {phase: "checking"});
            try {
                const status = await readAgentAdmission({threadId: attempt.threadId, admission: attempt.admission,
                    connector: attempt.connector, model: attempt.model, projectId: attempt.projectId,
                    content: attempt.submitted.text.trim(), attachments: attempt.submitted.attachments});
                updateAttempt(id, status.status === "accepted" ? {phase: "accepted", recoveryRequired: status.run.status === "running", error: undefined} :
                    {phase: "uncertain", error: "仍无法确认发送结果，请稍后核对状态"});
            } catch {updateAttempt(id, {phase: "uncertain", error: "读取发送状态失败，请稍后重试核对"});}
            return;
        }
        if (attempt.phase !== "failed") return;
        // Claim synchronously while resolving credentials, blocking duplicate recovery gestures.
        const token = acquireExecution();
        if (!token) return;
        const recoveryScope = currentThread.current;
        try {
            const connector = await resolveConnector(attempt.connector.id);
            if (!connector || connector.id !== attempt.connector.id || connector.definitionId !== attempt.connector.definitionId ||
                connector.baseUrl.replace(/\/+$/, "") !== attempt.connector.baseUrl.replace(/\/+$/, "")) {
                updateAttempt(id, {phase: "failed", error: "原连接已变更，请恢复草稿后重新发送"});
                return;
            }
            if (token.controller.signal.aborted || currentThread.current !== recoveryScope) return;
            releaseExecution(token);
            await runSubmission(attempt, connector, true);
        } catch {updateAttempt(id, {phase: "failed", error: "读取连接失败，请重试"});}
        finally {releaseExecution(token);}
    }, [sendLockRef, references, removeAttempt, updateAttempt, acquireExecution, releaseExecution, runSubmission]);

    const handleRetry = useCallback(async (runId: string) => {
        // A click during an in-flight send must say why it cannot run yet.
        if (sendLockRef.current) {
            toast.info("当前执行尚未结束，请等待完成或先停止。");
            return;
        }
        const token = acquireExecution();
        if (!token) return;
        const {controller} = token;
        try {
            const checked = await retryFrozenChatRun({
                runId, activeThreadId, controller,
                isThreadCurrent: id => selectionRef.current.threadId === id
            });
            if (checked && !checked.ok && !checked.aborted) showError({
                title: "重新生成失败",
                cause: new Error(checked.message),
                actionName: "retry-run",
                detail: checked.message
            });
        } catch (error) {
            showError({
                title: "重新生成失败",
                cause: error,
                actionName: "retry-run", ...(error instanceof Error ? {detail: error.message} : {})
            });
        } finally {
            releaseExecution(token);
        }
    }, [acquireExecution, releaseExecution, activeThreadId, selectionRef, sendLockRef]);

    const handleRunAction = useCallback(async (runId: string, action: RunAction, callId?: string) => {
        // Approval, rejection and cancel decisions are never silently dropped.
        if (sendLockRef.current) {
            toast.info("当前执行尚未结束，请等待完成后再处理这次操作。");
            return;
        }
        const token = acquireExecution();
        if (!token) return;
        const {controller} = token;
        try {
            const checked = await resolveChatRunAction({
                runId, action, callId, activeThreadId, controller,
                isThreadCurrent: id => selectionRef.current.threadId === id
            });
            if (checked && !checked.ok && !checked.aborted) showError({
                title: "处理执行失败",
                cause: new Error(checked.message),
                actionName: "run-action",
                detail: checked.message
            });
        } catch (error) {
            showError({
                title: "处理执行失败",
                cause: error,
                actionName: "run-action", ...(error instanceof Error ? {detail: error.message} : {})
            });
        } finally {
            releaseExecution(token);
        }
    }, [acquireExecution, releaseExecution, activeThreadId, selectionRef, sendLockRef]);
    const onRunAction = useCallback((runId: string, action: RunAction, callId?: string) => {
        void handleRunAction(runId, action, callId);
    }, [handleRunAction]);

    const retryableRunId = useMemo(() => {
        const latest = runs?.at(-1);
        return latest && canRetryRun(latest, runs ?? [], messages ?? []) ? latest.id : undefined;
    }, [runs, messages]);
    const onRetryRun = useCallback((id: string) => {
        void handleRetry(id);
    }, [handleRetry]);

    const selectModelOptions = useMemo(() => buildChatModelOptions(
        catalogMatches ? modelCatalog?.models ?? [] : [], modelValue, "", modelPolicy,
    ).map((id) => ({label: id, value: id})), [catalogMatches, modelCatalog, modelValue, modelPolicy]);

    const routedThreadPending =
        Boolean(activeThreadId) &&
        (routedThread === undefined ||
            routedThread.forId !== activeThreadId ||
            (routedThread.forId === activeThreadId && routedThread.thread === null));
    const createdThreadHydrating = activeThread?.id === activeThreadId && routedThread?.forId !== activeThreadId &&
        submissionAttempts.some(attempt => attempt.createdThread?.id === activeThreadId);

    const unavailableNavigation = <TopicSidebar threads={threadList} activeThreadId={activeThreadId}
                                                onSelect={openThread} onNewTopic={handleNewTopic}
                                                onNewTopicInProject={handleNewTopicInProject} onOpenTasks={openBoard}
                                                onRename={handleRenameThread} onDelete={handleDeleteThread}/>;
    if (!loaded || (routedThreadPending && !createdThreadHydrating)) {
        return (
            <ModuleLayout navigation={unavailableNavigation} navigationLabel="话题导航"><Flexbox align="center"
                                                                                                 justify="center"
                                                                                                 height="100%"
                                                                                                 style={{minHeight: "100%"}}>加载中…</Flexbox></ModuleLayout>
        );
    }

    if (connectorList.length === 0 && showHome) {
        return (
            <ModuleLayout navigation={unavailableNavigation} navigationLabel="话题导航"><Flexbox
                align="center"
                justify="center"
                height="100%"
                gap={16}
                style={{minHeight: "100%", padding: 32}}
            >
                <Empty
                    title="还没有可用的连接"
                    description="对话需要先配置 OpenAI 兼容连接（Base URL + API Key）。密钥只保存在本机。"
                />
                <Link to="/connectors">
                    <Button type="primary">前往连接</Button>
                </Link>
                <Button onClick={openBoard}>先整理任务</Button>
            </Flexbox></ModuleLayout>
        );
    }

    const currentRun = runs?.filter((r) => r.threadId === activeThreadId).at(-1);
    const showRunStatus = currentRun !== undefined && runBlocksThread(currentRun);
    const openTask = async () => {
        if (activeTask) {
            setTaskInspectorOpen(true);
            return;
        }
        if (!activeThreadId) return;
        try {
            await createAgentTaskForThread(activeThreadId, {
                projectId: activeThread?.projectId ?? projectId ?? "",
                title: activeThread?.title ?? "新任务",
                goal: messages?.find((message) => message.threadId === activeThreadId && message.role === "user")?.content || activeThread?.title || "补充任务目标",
                plan: currentRun?.plan,
            });
            setTaskInspectorOpen(true);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "关联任务失败");
        }
    };
    const composerProps: ComposerProps = {
        attachments: references.attachments,
        referenceImports: references.imports,
        onAttachReference: (attachment) => {
            if (!sendLockRef.current) references.attach(attachment);
        },
        onRemoveReference: (attachment) => {
            if (!sendLockRef.current) references.remove(attachment);
        },
        onImportReferences: (files) => {
            if (!sendLockRef.current) void references.importFiles(files);
        },
        onCancelReferenceImport: (id) => {
            if (!sendLockRef.current) references.cancel(id);
        },
        onRetryReferenceImport: (job) => {
            if (!sendLockRef.current) references.retry(job);
        },
        threadId: activeThreadId,
        projects: projects ?? [],
        projectId,
        projectRequired,
        projectLocked: sending || Boolean(activeThreadId && (activeThread?.projectId || messages?.length || runs?.length)),
        onProjectChange: handleProjectChange,
        blocked: projectUnavailable || Boolean(activeTask && activeTask.lifecycle !== "open"),
        readOnly: projectUnavailable,
        blockedReason: projectUnavailable ? "项目不可用 · 历史仍可查看，请新开项目对话" : undefined,
        status: projectUnavailable || activeTask || activeThread?.taskMode || showRunStatus || activeThreadId ? <>
            {activeThreadId &&
                <AgentComposerAttention threadId={activeThreadId} runs={runs ?? []} messages={messages ?? []}
                                        task={activeTask} projectUnavailable={projectUnavailable}
                                        onOpenTask={() => setTaskInspectorOpen(true)}/>}
            {projectUnavailable && <div className="agent-composer-run-status"><span>项目不可用 · 对话与记录仍保留</span>
                <button type="button" onClick={() => {
                    setComposerProjectId(undefined);
                    void navigate({to: "/agent"});
                }}>选择项目，开启新对话
                </button>
            </div>}
            {activeThread?.taskMode && !activeTask &&
                <div className="agent-composer-run-status"><span>需求沟通中 · 明确目标后，助手会建立任务</span></div>}
            {activeTask && <div className="agent-composer-task-summary">
                <button type="button" onClick={() => setTaskInspectorOpen(true)}>
                    <span className="agent-task-summary-label">任务</span><strong>{activeTask.title}</strong>
                    <span>{TASK_STATE_LABELS[getTaskDisplayState(activeTask, runs ?? [])]}{activeTask.plan.length > 0 ? ` · ${activeTask.plan.filter((item) => item.status === "completed").length}/${activeTask.plan.length}` : ""}</span>
                </button>
                {!projectUnavailable && activeTask.lifecycle !== "open" && <button type="button"
                                                                                   onClick={() => void setAgentTaskLifecycle(activeTask.id, "open").catch((error: Error) => toast.error(error.message))}>重新打开</button>}
            </div>}
            {showRunStatus && currentRun.status === "running" ? (
                <div className="agent-composer-run-status" role="status">
                    <span><i/>{compactions?.at(-1)?.status === "running" ? "正在整理较早的对话…" : "正在执行"}</span>
                    <button type="button" onClick={handleStop} disabled={!sending}>停止</button>
                </div>
            ) : null}</> : undefined,
        contextUsage: <ContextUsageTrigger attachments={references.attachments} projectId={projectId}
                                           threadId={activeThreadId} interactionMode={interactionMode}
                                           draft={draft}
                                           model={modelValue} connector={selectedConnector}
                                           modelMetadata={catalogMatches ? modelCatalog?.metadata : undefined}
                                           open={contextOpen} onOpenChange={setContextOpen}/>,

        reasoningEffort,
        onReasoningEffortChange: value => {
            void handleReasoningEffortChange(value).catch((error: unknown) => showError({
                title: "推理设置保存失败",
                cause: error,
                actionName: "save-reasoning-effort",
                detail: "当前页面仍保留所选值"
            }));
        },
        value: draft,
        sending,
        connectors: connectorList,
        selectedConnectorId: selectedConnector?.id,
        model: modelValue,
        modelOptions: selectModelOptions,
        modelMetadata: catalogMatches ? modelCatalog?.metadata : undefined,
        probingModels,
        modelPolicy,
        modelWarning: modelValue
            ? probingModels && !modelPolicy.incompatibleModels.includes(modelValue) && !modelPolicy.verified
                ? "正在确认 APIMart 模型类型…"
                : chatModelIssue(modelValue, modelPolicy)
            : undefined,
        chatMode,
        interactionMode,
        onChange: setDraft,
        onSend: () => void handleSend(),
        onStop: handleStop,
        onConnectorChange: (id) => {
            void handleConnectorChange(id).catch((error: unknown) => showError({
                title: "连接设置保存失败",
                cause: error,
                actionName: "save-connector"
            }));
        },
        onModelChange: (model) => {
            void handleModelChange(model).catch((error: unknown) => showError({
                title: "模型设置保存失败",
                cause: error,
                actionName: "save-model"
            }));
        },
        onChatModeChange: handleChatModeChange,
        onInteractionModeChange: mode => {
            void handleInteractionModeChange(mode).catch((error: unknown) => showError({
                title: "对话模式保存失败",
                cause: error,
                actionName: "save-interaction-mode",
                detail: "请重试"
            }));
        },
    };

    return (
        <>
            {view === "tasks" ? <TaskBoard tasks={tasks} runs={boardRuns} projects={projects ?? []}
                                           onOpenTask={(task) => openThread(task.threadId)}
                                           onBack={() => void navigate({to: "/agent"})}/> : showHome ? (
                <HomeWelcome
                    threads={threadList}
                    composer={composerProps}
                    tasks={tasks ?? []}
                    onOpenTasks={openBoard}
                    onSelectThread={openThread}
                    onNewTopic={handleNewTopic}
                    onNewTopicInProject={handleNewTopicInProject}
                    onRenameThread={handleRenameThread}
                    onDeleteThread={handleDeleteThread}
                />
            ) : (
                <ChatWorkspace
                    key={presentation.current?.key ?? activeThreadId}
                    taskTitle={activeTask?.title}
                    taskGoal={activeTask?.goal}
                    onOpenTask={() => void openTask()}
                    onOpenTasks={openBoard}
                    threads={threadList}
                    activeThreadId={activeThreadId}
                    activeThread={activeThread}
                    messages={provisionalHome ? [] : messages?.filter((message) => message.threadId === activeThreadId)}
                    submissions={visibleAttempts}
                    onSubmissionObserved={removeAttempt}
                    onSubmissionAction={(id, action) => void handleSubmissionAction(id, action)}
                    runs={runs?.filter((run) => run.threadId === activeThreadId)}
                    retryableRunId={sending || projectUnavailable ? undefined : retryableRunId}
                    onRetryRun={onRetryRun}
                    onRunAction={onRunAction}
                    composer={composerProps}
                    onSelectThread={openThread}
                    onNewTopic={handleNewTopic}
                    onNewTopicInProject={handleNewTopicInProject}
                    onRenameThread={handleRenameThread}
                    onDeleteThread={handleDeleteThread}
                />
            )}

            {activeTask &&
                <TaskInspector projectName={projects?.find((project) => project.id === activeTask.projectId)?.name}
                               projectUnavailable={projectUnavailable} key={activeTask.id}
                               summaryModel={selectedConnector && modelValue ? {
                                   connector: selectedConnector,
                                   model: modelValue,
                                   modelMetadata: catalogMatches ? modelCatalog?.metadata?.[modelValue] : undefined,
                                   reasoningEffort
                               } : undefined} task={activeTask}
                               runs={(runs ?? []).filter((run) => run.threadId === activeThreadId)}
                               messages={(messages ?? []).filter((message) => message.threadId === activeThreadId)}
                               open={taskInspectorOpen} onOpenChange={setTaskInspectorOpen} onOpenBoard={openBoard}
                               onDepartureReady={registerTaskDeparture}/>}

            <Dialog
                open={Boolean(renameTarget)}
                onOpenChange={(open) => !open && setRenameTarget(undefined)}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>重命名话题</DialogTitle>
                    </DialogHeader>
                    <Input
                        autoFocus
                        value={renameValue}
                        onChange={(event) => setRenameValue(event.target.value)}
                        onKeyDown={(event) => {
                            if (event.key === "Enter") {
                                event.preventDefault();
                                void commitRename();
                            }
                        }}
                    />
                    <DialogFooter>
                        <UiButton variant="outline" onClick={() => setRenameTarget(undefined)}>
                            取消
                        </UiButton>
                        <UiButton onClick={() => void commitRename()}>确定</UiButton>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <AlertDialog
                open={Boolean(deleteTarget)}
                onOpenChange={(open) => {
                    if (!open && !deleteLock.current) setDeleteTarget(undefined);
                }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>删除话题</AlertDialogTitle>
                        <AlertDialogDescription>
                            删除「{deleteTarget?.title}」及其消息、关联任务与成果记录？无法恢复。
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={deleting}>取消</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive hover:bg-destructive/90"
                            disabled={deleting}
                            onClick={(event) => {
                                event.preventDefault();
                                commitDelete();
                            }}
                        >
                            {deleting ? "删除中…" : "删除"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {departureConfirmation}
        </>
    );
}
