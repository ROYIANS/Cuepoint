import {ModuleLayout} from "../../../app/layout/ModuleLayout";
import {ShotDetailsProvider} from "../../../app/details/ShotDetails";
import {TopicSidebar} from "./TopicSidebar";
import {useChatSelection} from "./useChatSelection";
import {useChatExecutionSession} from "./useChatExecutionSession";
import {yieldSubmissionPaint} from "./chatSubmissionAttempts";
import {agentExecution} from "../runtime/agentExecution";
import {chatDrafts} from "../runtime/chatDraftStore";
import {useThreadControl} from "../queries/threadReading";
import {db} from "../../../platform/product/store";
import {createChatThread, updateChatThread} from "../commands/chat";
import {deleteChatThread} from "./../commands/lifecycle";
import {useReferenceDraft} from "./useReferenceDraft";
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
import type {RunAction} from "../models/chatRunAction";
import {Link, useNavigate} from "@tanstack/react-router";
import {useProductQuery} from "../../../platform/product/queries";
import {Button, Empty, Flexbox} from "@lobehub/ui";
import {useCallback, useEffect, useMemo, useRef, useState,} from "react";
import {toast} from "sonner";
import {showError} from "../../../app/errors/showError";
import {ChatWorkspace} from "./ChatWorkspace";
import {createSubmissionAttempt} from "../models/chatSubmissionAttempt";
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
import type {SubmissionAction} from "./SubmissionMessage";
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
    const openBoard = useCallback(() => leaveTask(() => {
        void navigate({to: "/agent/tasks"});
    }), [leaveTask, navigate]);
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
    const presentation = useRef<{threadId: string; key: string} | undefined>(undefined);
    const creationAttachment = useRef<{threadId: string; scope: string; generation: number} | undefined>(undefined);
    const attachment = useRef({scope: "", generation: 0});
    useEffect(() => {mounted.current = true; return () => {mounted.current = false;};}, []);

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
            return agentExecution.snapshot(activeThreadId).attempts.find(attempt => attempt.createdThread?.id === activeThreadId)?.createdThread;
        }
        return undefined;
    }, [threadList, activeThreadId, routedThread]);

    const control = useThreadControl(activeThreadId);
    const runs = control.runs;

    const openThread = useCallback((id: Id) => {
        if (id !== activeThreadId) leaveTask(() => {void navigate({to: "/agent/$threadId", params: {threadId: id}});});
    }, [navigate, leaveTask, activeThreadId]);

    const selection = useChatSelection({loaded, activeThread, activeThreadId, connectorList, modelCatalog});
    const {
        chatMode, modelPolicy, catalogMatches, setComposerProjectId,
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
    const composeScope = JSON.stringify([activeThreadId ?? "home", projectId]);
    const viewScope = JSON.stringify([composeScope, view ?? "chat"]);
    if (attachment.current.scope !== viewScope) attachment.current = {scope: viewScope, generation: attachment.current.generation + 1};
    const references = useReferenceDraft(composeScope, projectId);
    const {snapshot: execution, ownerId, sending, stopping, feedbackSnapshot,
        attempts: submissionAttempts} = useChatExecutionSession(activeThreadId, composeScope);
    const sendLocked = () => {
        const id = activeThreadId ?? [...agentExecution.attemptsForScope(composeScope)].reverse().find(attempt => attempt.phase === "preparing")?.threadId;
        return id ? agentExecution.snapshot(id).active : false;
    };
    const removeAttempt = useCallback((id: string) => {
        const attempt = submissionAttempts.find(item => item.admission.userMessageId === id);
        if (attempt) agentExecution.dismissAttempt({threadId: attempt.threadId, userMessageId: id});
    }, [submissionAttempts]);
    useEffect(() => {
        const target = creationAttachment.current;
        if (!target || !mounted.current || attachment.current.scope !== target.scope || attachment.current.generation !== target.generation) return;
        const receipt = submissionAttempts.find(attempt => attempt.threadId === target.threadId)?.createdThread;
        if (!receipt) return;
        creationAttachment.current = undefined;
        void navigate({to: "/agent/$threadId", params: {threadId: receipt.id}}).catch(() => undefined);
    }, [submissionAttempts, navigate]);
    const {text: draft, setText: setDraft} = references;
    const projectRequired = taskMode && !projectId;
    const projectUnavailable = Boolean(projectId && projects && !projects.some((project) => project.id === projectId));
    const visibleAttempts = submissionAttempts.filter(attempt => activeThreadId ? attempt.threadId === activeThreadId :
        (attempt.phase !== "accepted" || !!attempt.createdThread) && attempt.submitted.scope === JSON.stringify(["home", projectId]));
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
        const generation = attachment.current.generation;
        void createChatThread({connectorId: selectedConnector?.id, model: modelValue || undefined,
            projectId: projectOverride ?? projectId, taskMode}).then(thread => {
            if (mounted.current && attachment.current.generation === generation) void navigate({to: "/agent/$threadId", params: {threadId: thread.id}});
        }).catch((cause: unknown) => showError({title: "创建对话失败", cause, actionName: "create-thread"}));
    }), [navigate, selectedConnector?.id, modelValue, projectId, taskMode, leaveTask]);
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
                    const owner = agentExecution.snapshot(target.id);
                    if (owner.token) agentExecution.requestStop({threadId: target.id, token: owner.token});
                    if (owner.work) agentExecution.requestWorkStop({threadId: target.id, work: owner.work});
                    await owner.work?.done.catch(() => undefined);
                    await deleteChatThread(target.id);
                    if (!mounted.current) return;
                    if (currentThread.current === target.id) {
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
        leaveTask(remove);
    }, [deleteTarget, navigate, leaveTask]);

    const handleStop = useCallback(() => {
        if (execution.token && agentExecution.requestStop({threadId: execution.threadId, token: execution.token})) return;
        if (execution.work) agentExecution.requestWorkStop({threadId: execution.threadId, work: execution.work});
    }, [execution]);

    const handleSend = () => {
        const submitted = references.capture();
        if (!mounted.current || (!submitted.text.trim() && !submitted.attachments.length) || submitted.imports.length || sendLocked()) return;
        if (projectRequired || projectUnavailable) {toast.error(projectRequired ? "任务模式请先选择项目" : "项目已不可用，请选择其他项目开启新对话"); return;}
        if (!selectedConnector) {toast.error("请先配置连接"); return;}
        let recovery: ReturnType<typeof references.consume> | undefined;
        try {
            recovery = references.consume(submitted);
            const attempt = createSubmissionAttempt({originThreadId: activeThreadId, projectId, submitted,
                recovery, connector: {id: selectedConnector.id, definitionId: selectedConnector.definitionId, baseUrl: selectedConnector.baseUrl},
                model: modelValue, taskMode: chatMode === "task", interactionMode, reasoningEffort});
            if (!activeThreadId) {
                chatDrafts.session(submitted.scope, projectId).reserveDestination(JSON.stringify([attempt.threadId, projectId]));
                creationAttachment.current = {threadId: attempt.threadId, ...attachment.current};
                presentation.current = {threadId: attempt.threadId, key: attempt.admission.userMessageId};
            }
            agentExecution.submit({attempt, afterOptimisticPaint: yieldSubmissionPaint(), modelMetadata: catalogMatches ? modelCatalog?.metadata?.[modelValue] : undefined});
        } catch (cause) {
            if (recovery) references.restore(submitted, recovery);
            showError({title: "暂时无法发送", cause, actionName: "send-message"});
        }
    };
    const handleSubmissionAction = (id: string, action: SubmissionAction) => {
        const attempt = submissionAttempts.find(item => item.admission.userMessageId === id);
        if (!attempt || sendLocked()) return;
        try {
            const identity = {threadId: attempt.threadId, userMessageId: id};
            if (action === "restore") {
                if (attempt.phase !== "failed") return;
                if (chatDrafts.session(attempt.submitted.scope, attempt.projectId).restore(attempt.submitted, attempt.recovery)) removeAttempt(id);
                else toast.error("当前草稿已有改动，发送内容仍保留在消息中");
            } else if (action === "recover") agentExecution.recoverAdmissionState(identity);
            else if (action === "check") agentExecution.checkAdmission(identity);
            else agentExecution.retrySubmission(identity);
        } catch (cause) {showError({title: "无法处理发送记录", cause, actionName: "submission-action"});}
    };
    const handleRetry = useCallback((runId: string) => {
        if (!activeThreadId) return;
        try {agentExecution.retry({threadId: activeThreadId, runId});}
        catch (cause) {showError({title: "重新生成失败", cause, actionName: "retry-run"});}
    }, [activeThreadId]);
    const onRunAction = useCallback((runId: string, action: RunAction, callId?: string) => {
        if (!activeThreadId) return;
        try {
            const identity = {threadId: activeThreadId, runId};
            if (action === "approve" || action === "reject") {
                if (!callId) return;
                agentExecution.resolveApproval({...identity, callId, decision: action});
            } else if (action === "cancel") agentExecution.cancelSavedRun(identity);
            else agentExecution.resume(identity);
        } catch (cause) {showError({title: "处理执行失败", cause, actionName: "run-action"});}
    }, [activeThreadId]);

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
    if (!loaded || (routedThreadPending && !createdThreadHydrating && !activeThread)) {
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
    const feedbackOwned = sending && (feedbackSnapshot?.threadId === activeThreadId ||
        (!activeThreadId && provisionalHome));
    const feedbackOwnsRun = currentRun !== undefined && feedbackSnapshot?.threadId === activeThreadId &&
        feedbackSnapshot?.runId === currentRun.id;
    const executionLabel = feedbackOwned ? stopping ? "正在停止…" :
        feedbackSnapshot?.phase === "waiting_model" ? "正在等待回复…" : undefined : undefined;
    const executionStatus = executionLabel ?? (showRunStatus && currentRun.status === "running" &&
        (feedbackOwned ? feedbackSnapshot?.phase === "working" : !feedbackOwnsRun) ?
        control.compacting ? "正在整理较早的对话…" : "正在执行" : undefined);
    const openTask = async () => {
        if (activeTask) {
            setTaskInspectorOpen(true);
            return;
        }
        if (!activeThreadId) return;
        try {
            const targetThreadId = activeThreadId;
            const [firstMessages, latestRuns] = await Promise.all([
                db.chatMessages.where("threadId").equals(targetThreadId).sortBy("createdAt"),
                db.agentRuns.where("threadId").equals(targetThreadId).sortBy("createdAt"),
            ]);
            await createAgentTaskForThread(targetThreadId, {
                projectId: activeThread?.projectId ?? projectId ?? "",
                title: activeThread?.title ?? "新任务",
                goal: firstMessages.find((message) => message.threadId === activeThreadId && message.role === "user")?.content || activeThread?.title || "补充任务目标",
                plan: latestRuns.at(-1)?.plan,
            });
            if (currentThread.current === targetThreadId) setTaskInspectorOpen(true);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "关联任务失败");
        }
    };
    const composerProps: ComposerProps = {
        attachments: references.attachments,
        referenceImports: references.imports,
        onAttachReference: (attachment) => {
            if (!sendLocked()) references.attach(attachment);
        },
        onRemoveReference: (attachment) => {
            if (!sendLocked()) references.remove(attachment);
        },
        onImportReferences: (files) => {
            if (!sendLocked()) void references.importFiles(files).catch((cause: unknown) => showError({title: "导入资料失败", cause, actionName: "import-reference"}));
        },
        onCancelReferenceImport: (id) => {
            if (!sendLocked()) references.cancel(id);
        },
        onRetryReferenceImport: (job) => {
            if (!sendLocked()) void references.retry(job).catch((cause: unknown) => showError({title: "导入资料失败", cause, actionName: "import-reference"}));
        },
        threadId: activeThreadId,
        projects: projects ?? [],
        projectId,
        projectRequired,
        projectLocked: sending || Boolean(activeThreadId && (activeThread?.projectId || control.hasMessages || control.hasRuns)),
        onProjectChange: handleProjectChange,
        blocked: projectUnavailable || Boolean(activeTask && activeTask.lifecycle !== "open"),
        readOnly: projectUnavailable,
        blockedReason: projectUnavailable ? "项目不可用 · 历史仍可查看，请新开项目对话" : undefined,
        status: execution.error || projectUnavailable || activeTask || activeThread?.taskMode || showRunStatus || activeThreadId || executionStatus ? <>
            {execution.error && <div className="agent-composer-run-status" role="alert">{execution.error}</div>}
            {activeThreadId &&
                <AgentComposerAttention threadId={activeThreadId}
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
                    <span>{TASK_STATE_LABELS[getTaskDisplayState(activeTask, runs)]}{activeTask.plan.length > 0 ? ` · ${activeTask.plan.filter((item) => item.status === "completed").length}/${activeTask.plan.length}` : ""}</span>
                </button>
                {!projectUnavailable && activeTask.lifecycle !== "open" && <button type="button"
                                                                                   onClick={() => void setAgentTaskLifecycle(activeTask.id, "open").catch((error: Error) => toast.error(error.message))}>重新打开</button>}
            </div>}
            {executionStatus ? (
                <div className="agent-composer-run-status" role="status">
                    <span><i/>{executionStatus}</span>
                    <button type="button" onClick={handleStop} disabled={!sending || stopping}
                            aria-label={stopping ? "正在停止…" : "停止"}>停止</button>
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
        stopping,
        connectors: connectorList,
        selectedConnectorId: selectedConnector?.id,
        model: modelValue,
        modelOptions: selectModelOptions,
        modelMetadata: catalogMatches ? modelCatalog?.metadata : undefined,
        probingModels,
        modelPolicy,
        modelWarning: modelValue
            ? probingModels && !modelPolicy.incompatibleModels.includes(modelValue) && !modelPolicy.verified
                ? undefined : chatModelIssue(modelValue, modelPolicy)
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
                    taskTitle={activeTask?.title}
                    taskGoal={activeTask?.goal}
                    onOpenTask={() => void openTask()}
                    onOpenTasks={openBoard}
                    threads={threadList}
                    activeThreadId={activeThreadId}
                    activeThread={activeThread}
                    ownerId={ownerId}
                    submissions={visibleAttempts}
                    onSubmissionObserved={removeAttempt}
                    onSubmissionAction={(id, action) => void handleSubmissionAction(id, action)}
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

        </>
    );
}
