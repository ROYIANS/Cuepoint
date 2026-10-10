import {useChatSelection} from "./useChatSelection";
import {useChatExecutionSession} from "./useChatExecutionSession";
import {executeNewChatMessage, resolveChatRunAction, retryFrozenChatRun} from "./chatExecutionFlows";
import {createChatThread, updateChatThread} from "@/db/chat";
import {deleteChatThread} from "@/db/cascadeCommands";
import {pauseThreadGeneration} from "@/lib/agent/generationBatchRuntime";
import {useReferenceDraft} from "./useReferenceDraft";
import {TaskBoard} from "./TaskBoard";
import {TaskInspector} from "./TaskInspector";
import type {ManualDraftDeparture} from "@/lib/useManualDraftGuard";
import {AgentActivityNavigationProvider} from "./AgentActivityNavigation";
import {AgentComposerAttention} from "./AgentComposerAttention";
import {createAgentTaskForThread, setAgentTaskLifecycle} from "@/db/agentTasks";
import {getTaskDisplayState, TASK_STATE_LABELS} from "@/lib/agent/taskState";
import type {AgentRun} from "@/domain/agent";
import {ContextUsageTrigger} from "./ContextUsagePanel";
import type {RunAction} from "./AgentRunDetails";
import {Link, useNavigate} from "@tanstack/react-router";
import {useLiveQuery} from "dexie-react-hooks";
import {Button, Empty, Flexbox} from "@lobehub/ui";
import {useCallback, useEffect, useMemo, useRef, useState,} from "react";
import {toast} from "sonner";
import {ChatWorkspace} from "@/components/agent/ChatWorkspace";
import type {ComposerProps} from "@/components/agent/composerTypes";
import {HomeWelcome} from "@/components/agent/HomeWelcome";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {Button as UiButton} from "@/components/ui/button";
import {Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,} from "@/components/ui/dialog";
import {Input} from "@/components/ui/input";
import {db} from "@/db/database";
import {type ChatThread, type Id, STUDIO_LIBRARY_ID} from "@/domain/types";
import {canRetryRun} from "@/db/agentRuns";
import {recoverAbandonedRuns} from "@/lib/agent/runOwnership";
import {recoverTaskWrapups} from "@/lib/agent/taskWrapup";
import {discoverConnectorChatModels} from "@/lib/ai/connectors";
import {
    buildChatModelOptions,
    type ChatModelCatalog,
    chatModelIssue,
    sameChatModelConnector,
} from "@/lib/ai/chatModelPolicy";

export function AgentChatPage({threadId, view}: { threadId?: Id; view?: "tasks" }) {
    return <AgentActivityNavigationProvider threadId={threadId}><AgentChatInner threadId={threadId}
                                                                                view={view}/></AgentActivityNavigationProvider>;
}

function AgentChatInner({threadId, view}: { threadId?: Id; view?: "tasks" }) {
    const navigate = useNavigate();
    const threads = useLiveQuery(() => db.chatThreads.orderBy("updatedAt").reverse().toArray(), []);
    const tasks = useLiveQuery(() => db.agentTasks.orderBy("updatedAt").reverse().toArray(), []);
    const boardRuns = useLiveQuery(() => view === "tasks" ? db.agentRuns.toArray() : Promise.resolve([] as AgentRun[]), [view]);
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
    const connectors = useLiveQuery(() => db.connectors.toArray(), []);
    const projects = useLiveQuery(() => db.projects.orderBy("updatedAt").reverse().filter((project) => project.id !== STUDIO_LIBRARY_ID).toArray(), []);
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
        const pause = () => pauseThreadGeneration(activeThreadId);
        window.addEventListener('pagehide', pause);
        return () => {
            window.removeEventListener('pagehide', pause);
            pause();
        };
    }, [activeThreadId]);

    const loaded = threads !== undefined && connectors !== undefined && projects !== undefined;
    const threadList = useMemo(() => threads ?? [], [threads]);
    const connectorList = useMemo(() => connectors ?? [], [connectors]);

    const openThread = useCallback(
        (id: Id) => {
            if (id === activeThreadId) return;
            leaveTask(() => {
                if (executionThreadRef.current !== id) abortRef.current?.abort();
                void navigate({to: "/agent/$threadId", params: {threadId: id}});
            });
        },
        [abortRef, executionThreadRef, navigate, leaveTask, activeThreadId],
    );

    const routedThread = useLiveQuery(
        async () => {
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
        return undefined;
    }, [threadList, activeThreadId, routedThread]);

    const messages = useLiveQuery(
        async () => {
            if (!activeThreadId) return [];
            return db.chatMessages.where("threadId").equals(activeThreadId).sortBy("createdAt");
        },
        [activeThreadId],
    );

    const compactions = useLiveQuery(() => activeThreadId ? db.contextCompactions.where("threadId").equals(activeThreadId).sortBy("createdAt") : [], [activeThreadId]);
    const runs = useLiveQuery(async () => {
        if (!activeThreadId) return [];
        return db.agentRuns.where("threadId").equals(activeThreadId).sortBy("createdAt");
    }, [activeThreadId]);

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
    const showHome = !activeThreadId && view !== "tasks";
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
            });
        return () => {
            cancelled = true;
            controller.abort();
        };
    }, [discoveryId, discoveryDefinitionId, discoveryBaseUrl, discoveryApiKey]);

    const handleNewTopic = useCallback(() => leaveTask(() => {
        if (deleteLock.current) return;
        abortRef.current?.abort();
        void (async () => {
            const thread = await createChatThread({
                connectorId: selectedConnector?.id,
                model: modelValue || undefined,
                projectId,
                taskMode,
            });
            openThread(thread.id);
        })().catch((error: unknown) => toast.error(error instanceof Error ? error.message : "创建对话失败"));
    }), [abortRef, openThread, selectedConnector?.id, modelValue, projectId, taskMode, leaveTask]);

    const handleRenameThread = useCallback((thread: ChatThread) => {
        setRenameTarget(thread);
        setRenameValue(thread.title);
    }, []);

    const commitRename = useCallback(async () => {
        if (!renameTarget) return;
        await updateChatThread(renameTarget.id, {
            title: renameValue.trim() || renameTarget.title,
        });
        setRenameTarget(undefined);
    }, [renameTarget, renameValue]);

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
            setDeleteTarget(target);
            setTaskInspectorOpen(false);
            setDeleting(true);
            void (async () => {
                try {
                    if (abortRef.current && executionThreadRef.current === target.id) abortRef.current.abort();
                    await deleteChatThread(target.id);
                    if (!mounted.current) return;
                    if (currentThread.current === target.id) void navigate({to: "/agent", replace: true});
                    setDeleteTarget(current => current?.id === target.id ? undefined : current);
                } catch (error) {
                    if (mounted.current) toast.error(error instanceof Error ? error.message : "删除对话失败，请重试");
                } finally {
                    deleteLock.current = undefined;
                    if (mounted.current) setDeleting(false);
                }
            })();
        };
        if (currentThread.current === target.id) {
            setDeleteTarget(undefined);
            leaveTask(remove);
        } else remove();
    }, [abortRef, deleteTarget, executionThreadRef, navigate, leaveTask]);

    const handleStop = useCallback(() => {
        abortRef.current?.abort();
    }, [abortRef]);

    const handleSend = useCallback(async () => {
        const submitted = references.capture();
        const content = submitted.text.trim();
        const attachments = submitted.attachments;
        if ((!content && !attachments.length) || submitted.imports.length || sendLockRef.current) return;
        if (projectRequired) {
            toast.error("任务模式请先选择项目");
            return;
        }
        if (projectUnavailable) {
            toast.error("项目已不可用，请选择其他项目开启新对话");
            return;
        }
        const connector = selectedConnector && {...selectedConnector};
        const model = modelValue;
        if (!connector) {
            toast.error("请先配置连接");
            return;
        }

        // Capture the UI selection before any await; thread persistence may still be catching up.
        const selectionRevision = selectionRevisionRef.current;
        const token = acquireExecution();
        if (!token) return;
        const {controller} = token;
        try {
            const checked = await executeNewChatMessage({
                submitted,
                content,
                attachments,
                references,
                activeThread,
                activeThreadId,
                connector,
                model,
                taskMode: chatMode === "task",
                projectId,
                interactionMode,
                reasoningEffort,
                catalogMatches,
                modelCatalog,
                controller,
                navigate,
                bindThread: id => {
                    executionThreadRef.current = id;
                },
                isCurrent: () => selectionRevisionRef.current === selectionRevision &&
                    sameChatModelConnector(selectionRef.current.connector, connector) &&
                    selectionRef.current.model === model && selectionRef.current.threadId === activeThreadId
            });
            if (checked && !checked.ok && !checked.aborted) toast.error(checked.message);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "发送失败，请重试");
        } finally {
            releaseExecution(token);
        }
    }, [acquireExecution, releaseExecution, navigate, activeThread, activeThreadId, selectedConnector, modelValue, reasoningEffort, interactionMode, chatMode, projectId, projectRequired, projectUnavailable, references, catalogMatches, modelCatalog, executionThreadRef, selectionRef, selectionRevisionRef, sendLockRef]);

    const handleRetry = useCallback(async (runId: string) => {
        if (sendLockRef.current) return;
        const token = acquireExecution();
        if (!token) return;
        const {controller} = token;
        try {
            const checked = await retryFrozenChatRun({
                runId, activeThreadId, controller,
                isThreadCurrent: id => selectionRef.current.threadId === id
            });
            if (checked && !checked.ok && !checked.aborted) toast.error(checked.message);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "重新生成失败");
        } finally {
            releaseExecution(token);
        }
    }, [acquireExecution, releaseExecution, activeThreadId, selectionRef, sendLockRef]);

    const handleRunAction = useCallback(async (runId: string, action: RunAction, callId?: string) => {
        if (sendLockRef.current) return;
        const token = acquireExecution();
        if (!token) return;
        const {controller} = token;
        try {
            const checked = await resolveChatRunAction({
                runId, action, callId, activeThreadId, controller,
                isThreadCurrent: id => selectionRef.current.threadId === id
            });
            if (checked && !checked.ok && !checked.aborted) toast.error(checked.message);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "处理执行失败");
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

    if (!loaded || routedThreadPending) {
        return (
            <Flexbox align="center" justify="center" height="100%" style={{minHeight: "100%"}}>
                加载中…
            </Flexbox>
        );
    }

    if (connectorList.length === 0 && showHome) {
        return (
            <Flexbox
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
            </Flexbox>
        );
    }

    const currentRun = runs?.filter((r) => r.threadId === activeThreadId).at(-1);
    const showRunStatus = currentRun && (currentRun.status === "running" || currentRun.status === "waiting_approval" || currentRun.status === "interrupted" || currentRun.status === "failed");
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
            {showRunStatus ? (
                <div className="agent-composer-run-status" role="status">
                    <span><i/>{currentRun.status === "running" ? compactions?.at(-1)?.status === "running" ? "正在整理较早的对话…" : "正在执行" : currentRun.status === "waiting_approval" ? "等待你批准操作" : currentRun.status === "interrupted" ? currentRun.pauseReason === "model_step_limit" ? "执行已暂停，可继续下一段" : "执行已中断，进度已保存" : "执行未完成"}</span>
                    {currentRun.status === "running" &&
                        <button type="button" onClick={handleStop} disabled={!sending}>停止</button>}
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
            void handleReasoningEffortChange(value).catch(() => toast.error("推理设置保存失败，当前页面仍保留所选值"));
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
            void handleConnectorChange(id).catch(error => toast.error(error instanceof Error ? error.message : "连接设置保存失败"));
        },
        onModelChange: (model) => {
            void handleModelChange(model).catch(error => toast.error(error instanceof Error ? error.message : "模型设置保存失败"));
        },
        onChatModeChange: handleChatModeChange,
        onInteractionModeChange: mode => {
            void handleInteractionModeChange(mode).catch(() => toast.error("对话模式保存失败，请重试"));
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
                />
            ) : (
                <ChatWorkspace
                    key={activeThreadId}
                    taskTitle={activeTask?.title}
                    taskGoal={activeTask?.goal}
                    onOpenTask={() => void openTask()}
                    onOpenTasks={openBoard}
                    threads={threadList}
                    activeThreadId={activeThreadId}
                    activeThread={activeThread}
                    messages={messages?.filter((message) => message.threadId === activeThreadId)}
                    runs={runs?.filter((run) => run.threadId === activeThreadId)}
                    retryableRunId={sending || projectUnavailable ? undefined : retryableRunId}
                    onRetryRun={onRetryRun}
                    onRunAction={onRunAction}
                    composer={composerProps}
                    onSelectThread={openThread}
                    onNewTopic={handleNewTopic}
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
        </>
    );
}
