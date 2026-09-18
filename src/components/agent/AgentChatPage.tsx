import type { AgentReasoningEffort } from "@/domain/agent";
import { getReasoningPolicy } from "@/lib/ai/reasoningPolicy";
import { ContextUsageTrigger } from "./ContextUsagePanel";
import type { RunAction } from "./AgentRunDetails";
import { cancelAgentRun, resolveAgentToolApproval } from "@/db/agentTools";
import { Link, useNavigate } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { Button, Empty, Flexbox } from "@lobehub/ui";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { ChatWorkspace } from "@/components/agent/ChatWorkspace";
import type { AgentInteractionMode, ChatSurfaceMode, ComposerProps } from "@/components/agent/composerTypes";
import { HomeWelcome } from "@/components/agent/HomeWelcome";
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
import { Button as UiButton } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { db } from "@/db/database";
import {
  createChatThread,
  deleteChatThread,
  updateChatThread,
} from "@/db/repo";
import type { ChatThread, Id } from "@/domain/types";
import { assertRetryConnector, beginAgentRun, canRetryRun } from "@/db/agentRuns";
import { executeChatRun, resumeChatRun } from "@/lib/agent/runChat";
import { recoverAbandonedRuns, withThreadRunLock } from "@/lib/agent/runOwnership";
import { deriveChatTitle } from "@/lib/chatTitle";
import { discoverConnectorChatModels, runWithCompatibleChatModel } from "@/lib/ai/connectors";
import {
  buildChatModelOptions,
  chatModelIssue,
  getChatModelPolicy,
  sameChatModelConnector,
  type ChatModelCatalog,
} from "@/lib/ai/chatModelPolicy";

export function AgentChatPage({ threadId }: { threadId?: Id }) {
  return <AgentChatInner threadId={threadId} />;
}

function AgentChatInner({ threadId }: { threadId?: Id }) {
  const navigate = useNavigate();
  const threads = useLiveQuery(() => db.chatThreads.orderBy("updatedAt").reverse().toArray(), []);
  const connectors = useLiveQuery(() => db.connectors.toArray(), []);
  const activeThreadId = threadId;
  const [draft, setDraft] = useState("");
  const [contextOpen, setContextOpen] = useState(false);
  const [sessionConnectorId, setSessionConnectorId] = useState<Id | undefined>();
  const [sessionModel, setSessionModel] = useState("");
  const [effortSelection, setEffortSelection] = useState<{ threadId?: Id; connectorId?: string; baseUrl?: string; model: string; value?: AgentReasoningEffort }>();
  const [modelCatalog, setModelCatalog] = useState<ChatModelCatalog>();
  const [chatMode, setChatMode] = useState<ChatSurfaceMode>("agent");
  const [interactionSelection, setInteractionSelection] = useState<{ threadId?: Id; mode: AgentInteractionMode }>();
  const [sending, setSending] = useState(false);
  const [renameTarget, setRenameTarget] = useState<ChatThread>();
  const [renameValue, setRenameValue] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<ChatThread>();
  const abortRef = useRef<AbortController | null>(null);
  const executionThreadRef = useRef<Id | undefined>(undefined);
  const sendLockRef = useRef(false);
  const selectionRevisionRef = useRef(0);

  useEffect(() => () => abortRef.current?.abort(), []);

  useEffect(() => {
    // Covers browser back/forward as well as links. New-thread sends assign their
    // destination before navigating, so that navigation does not cancel itself.
    if (executionThreadRef.current !== activeThreadId) abortRef.current?.abort();
  }, [activeThreadId]);

  const loaded = threads !== undefined && connectors !== undefined;
  const threadList = threads ?? [];
  const connectorList = connectors ?? [];

  const openThread = useCallback(
    (id: Id) => {
      if (executionThreadRef.current !== id) abortRef.current?.abort();
      void navigate({ to: "/agent/$threadId", params: { threadId: id } });
    },
    [navigate],
  );

  const routedThread = useLiveQuery(
    async () => {
      if (!activeThreadId) {
        return { forId: null as Id | null, thread: null as ChatThread | null };
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
      void navigate({ to: "/agent", replace: true });
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
    if (!loaded) return;
    if (activeThread) {
      setSessionConnectorId(activeThread.connectorId ?? connectorList[0]?.id);
      setSessionModel(activeThread.model?.trim() ?? "");
      return;
    }
    setSessionConnectorId((prev) => prev ?? connectorList[0]?.id);
  }, [loaded, activeThread?.id, activeThread?.connectorId, activeThread?.model, connectorList]);

  const selectedConnector = useMemo(() => {
    if (sessionConnectorId) {
      return connectorList.find((c) => c.id === sessionConnectorId) ?? connectorList[0];
    }
    return connectorList[0];
  }, [sessionConnectorId, connectorList]);

  const modelValue = sessionModel.trim();
  const showHome = !activeThreadId;
  const interactionMode = interactionSelection?.threadId === activeThreadId ? interactionSelection?.mode ?? "smart" : activeThread?.interactionMode ?? "smart";
  const effortPolicy = selectedConnector ? getReasoningPolicy(selectedConnector, modelValue) : undefined;
  const effectiveEffort = effortSelection?.threadId === activeThreadId ? effortSelection : activeThread?.reasoningSelection;
  const reasoningEffort = effectiveEffort?.connectorId === selectedConnector?.id && effectiveEffort?.baseUrl === selectedConnector?.baseUrl && effectiveEffort?.model === modelValue && effectiveEffort.value && effortPolicy?.levels.includes(effectiveEffort.value) ? effectiveEffort.value : undefined;

  const selectionRef = useRef({ connector: selectedConnector, model: modelValue, threadId: activeThreadId });
  selectionRef.current = { connector: selectedConnector, model: modelValue, threadId: activeThreadId };
  const modelPolicy = useMemo(() => getChatModelPolicy(selectedConnector, modelCatalog), [selectedConnector, modelCatalog]);
  const catalogMatches = sameChatModelConnector(selectedConnector, modelCatalog?.connector);
  const probingModels = Boolean(selectedConnector && (!catalogMatches || modelCatalog?.status === "loading"));

  useEffect(() => {
    if (!selectedConnector) return;
    let cancelled = false;
    const controller = new AbortController();
    setModelCatalog((previous) => ({
      connector: selectedConnector,
      status: "loading",
      models: [],
      incompatibleModels: sameChatModelConnector(selectedConnector, previous?.connector)
        ? previous?.incompatibleModels ?? [] : [],
    }));
    void discoverConnectorChatModels(selectedConnector, { signal: controller.signal })
      .then((result) => {
        if (cancelled) return;
        setModelCatalog((previous) => ({
          connector: selectedConnector,
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
  }, [selectedConnector?.id, selectedConnector?.definitionId, selectedConnector?.baseUrl, selectedConnector?.apiKey]);

  const handleNewTopic = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
    }
    setDraft("");
    void (async () => {
      const thread = await createChatThread({
        connectorId: selectedConnector?.id,
        model: modelValue || undefined,
      });
      openThread(thread.id);
    })();
  }, [openThread, selectedConnector?.id, modelValue]);

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
    setDeleteTarget(thread);
  }, []);

  const commitDelete = useCallback(async () => {
    if (!deleteTarget) return;
    if (abortRef.current && executionThreadRef.current === deleteTarget.id) {
      abortRef.current.abort();
    }
    await deleteChatThread(deleteTarget.id);
    if (activeThreadId === deleteTarget.id) {
      void navigate({ to: "/agent", replace: true });
    }
    setDeleteTarget(undefined);
  }, [activeThreadId, deleteTarget, navigate]);

  const handleConnectorChange = useCallback(
    async (connectorId: string) => {
      selectionRevisionRef.current += 1;
      setSessionConnectorId(connectorId);
      if (activeThread) {
        await updateChatThread(activeThread.id, { connectorId });
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
        await updateChatThread(activeThread.id, { model });
      }
    },
    [activeThread, modelPolicy],
  );

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const handleSend = useCallback(async () => {
    const content = draft.trim();
    if (!content || sendLockRef.current) return;
    const connector = selectedConnector && { ...selectedConnector };
    const model = modelValue;
    if (!connector) {
      toast.error("请先配置连接");
      return;
    }

    // Capture the UI selection before any await; thread persistence may still be catching up.
    const selectionRevision = selectionRevisionRef.current;
    const controller = new AbortController();
    sendLockRef.current = true;
    abortRef.current = controller;
    executionThreadRef.current = activeThreadId;
    setSending(true);
    try {
      const checked = await runWithCompatibleChatModel(connector, model, async () => {
        let thread = activeThread;
        if (!thread) {
          thread = await createChatThread({ connectorId: connector.id, model, title: deriveChatTitle(content) });
          if (controller.signal.aborted) return;
          executionThreadRef.current = thread.id;
          await navigate({ to: "/agent/$threadId", params: { threadId: thread.id } });
        }
        const targetThread = thread;
        await withThreadRunLock(targetThread.id, async () => {
          if (controller.signal.aborted) return;
          await updateChatThread(targetThread.id, { interactionMode: activeThreadId ? interactionMode : "smart", reasoningSelection: { connectorId: connector.id, baseUrl: connector.baseUrl, model, value: reasoningEffort } });
          const run = await beginAgentRun({ threadId: targetThread.id, connector, model, content, reasoningEffort, interactionMode: activeThreadId ? interactionMode : "smart" });
          setDraft((current) => current === draft ? "" : current);
          await executeChatRun(run, connector.apiKey, controller);
        });

      }, {
        signal: controller.signal,
        isCurrent: () => selectionRevisionRef.current === selectionRevision &&
          sameChatModelConnector(selectionRef.current.connector, connector) &&
          selectionRef.current.model === model && selectionRef.current.threadId === activeThreadId,
      });
      if (!checked.ok && !checked.aborted) toast.error(checked.message);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "发送失败，请重试");
    } finally {
      sendLockRef.current = false;
      if (abortRef.current === controller) {
        abortRef.current = null;
        setSending(false);
      }
    }
  }, [navigate, draft, activeThread, activeThreadId, selectedConnector, modelValue, reasoningEffort, interactionMode]);

  const handleRetry = useCallback(async (runId: string) => {
    if (sendLockRef.current) return;
    const controller = new AbortController();
    sendLockRef.current = true;
    abortRef.current = controller;
    executionThreadRef.current = activeThreadId;
    setSending(true);
    try {
      const previous = await db.agentRuns.get(runId);
      if (!previous || previous.threadId !== activeThreadId) throw new Error("执行不存在");
      const connector = await db.connectors.get(previous.connector.id);
      if (!connector) throw new Error("原连接已删除，请重新配置后发送新消息");
      assertRetryConnector(previous, connector);
      const checked = await runWithCompatibleChatModel(connector, previous.model, () =>
        withThreadRunLock(previous.threadId, async () => {
          if (controller.signal.aborted) return;
          const run = await beginAgentRun({ threadId: previous.threadId, connector, model: previous.model, retryOfRunId: previous.id });
          await executeChatRun(run, connector.apiKey, controller);
        }), {
        signal: controller.signal,
        isCurrent: () => selectionRef.current.threadId === previous.threadId,
      });
      if (!checked.ok && !checked.aborted) toast.error(checked.message);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "重新生成失败");
    } finally {
      sendLockRef.current = false;
      if (abortRef.current === controller) { abortRef.current = null; setSending(false); }
    }
  }, [activeThreadId]);

  const handleRunAction = useCallback(async (runId: string, action: RunAction, callId?: string) => {
    if (sendLockRef.current) return;
    const controller = new AbortController();
    sendLockRef.current = true;
    abortRef.current = controller;
    executionThreadRef.current = activeThreadId;
    setSending(true);
    try {
      const run = await db.agentRuns.get(runId);
      if (!run || run.threadId !== activeThreadId) throw new Error("执行不存在");
      if (action === "cancel") {
        await withThreadRunLock(run.threadId, async () => { await cancelAgentRun(run.id); });
        return;
      }
      // Persist the decision independently of connector availability, so refusal
      // never requires sending another model request or having a working API key.
      if ((action === "approve" || action === "reject") && callId) {
        await withThreadRunLock(run.threadId, async () => {
          if (controller.signal.aborted) return;
          await resolveAgentToolApproval(run.id, callId, action);
        });
        const outstanding = await db.agentToolCalls.where("runId").equals(run.id).filter((call) => call.status === "awaiting_approval").count();
        if (outstanding > 0) return;
      }
      if (controller.signal.aborted) return;
      const connector = await db.connectors.get(run.connector.id);
      if (!connector) throw new Error("决定已保存。原连接不存在，请恢复连接后继续或结束执行。");
      assertRetryConnector(run, connector);
      const checked = await runWithCompatibleChatModel(connector, run.model, () =>
        withThreadRunLock(run.threadId, async () => {
          if (controller.signal.aborted) return;
          await resumeChatRun(run.id, connector.apiKey, controller);
        }), {
          signal: controller.signal,
          isCurrent: () => selectionRef.current.threadId === run.threadId,
        });
      if (!checked.ok && !checked.aborted) toast.error(checked.message);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "处理执行失败");
    } finally {
      sendLockRef.current = false;
      if (abortRef.current === controller) { abortRef.current = null; setSending(false); }
    }
  }, [activeThreadId]);
  const onRunAction = useCallback((runId: string, action: RunAction, callId?: string) => {
    void handleRunAction(runId, action, callId);
  }, [handleRunAction]);

  const retryableRunId = useMemo(() => {
    const latest = runs?.at(-1);
    return latest && canRetryRun(latest, runs ?? [], messages ?? []) ? latest.id : undefined;
  }, [runs, messages]);
  const onRetryRun = useCallback((id: string) => { void handleRetry(id); }, [handleRetry]);

  const selectModelOptions = useMemo(() => buildChatModelOptions(
    catalogMatches ? modelCatalog?.models ?? [] : [], modelValue, "", modelPolicy,
  ).map((id) => ({ label: id, value: id })), [catalogMatches, modelCatalog, modelValue, modelPolicy]);

  const routedThreadPending =
    Boolean(activeThreadId) &&
    (routedThread === undefined ||
      routedThread.forId !== activeThreadId ||
      (routedThread.forId === activeThreadId && routedThread.thread === null));

  if (!loaded || routedThreadPending) {
    return (
      <Flexbox align="center" justify="center" height="100%" style={{ minHeight: "100vh" }}>
        加载中…
      </Flexbox>
    );
  }

  if (connectorList.length === 0 && !activeThreadId) {
    return (
      <Flexbox
        align="center"
        justify="center"
        height="100%"
        gap={16}
        style={{ minHeight: "100vh", padding: 32 }}
      >
        <Empty
          title="还没有可用的连接"
          description="对话需要先配置 OpenAI 兼容连接（Base URL + API Key）。密钥只保存在本机。"
        />
        <Link to="/connectors">
          <Button type="primary">前往连接</Button>
        </Link>
      </Flexbox>
    );
  }

  const currentRun = runs?.filter((r) => r.threadId === activeThreadId).at(-1);
  const composerProps: ComposerProps = {
    status: currentRun && (currentRun.status === "running" || currentRun.status === "waiting_approval" || currentRun.status === "interrupted" || currentRun.status === "failed") ? (
      <div className="agent-composer-run-status" role="status">
        <span><i />{currentRun.status === "running" ? "正在执行" : currentRun.status === "waiting_approval" ? "等待你批准操作" : currentRun.status === "interrupted" ? "执行已中断，进度已保存" : "执行未完成"}</span>
        {currentRun.status === "running" && <button type="button" onClick={handleStop} disabled={!sending}>停止</button>}
      </div>
    ) : undefined,
    contextUsage: <ContextUsageTrigger interactionMode={interactionMode} draft={draft} messages={messages?.filter((m) => m.threadId === activeThreadId) ?? []} runs={runs?.filter((r) => r.threadId === activeThreadId) ?? []} model={modelValue} connector={selectedConnector} modelMetadata={catalogMatches ? modelCatalog?.metadata : undefined} open={contextOpen} onOpenChange={setContextOpen} />,

    reasoningEffort,
    onReasoningEffortChange: (value) => {
      if (!selectedConnector) return;
      const selection = { connectorId: selectedConnector.id, baseUrl: selectedConnector.baseUrl, model: modelValue, value };
      selectionRevisionRef.current += 1;
      setEffortSelection({ ...selection, threadId: activeThreadId });
      if (activeThreadId) void updateChatThread(activeThreadId, { reasoningSelection: selection }).catch(() => toast.error("推理设置保存失败，当前页面仍保留所选值"));
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
    onConnectorChange: (id) => void handleConnectorChange(id),
    onModelChange: (model) => void handleModelChange(model),
    onChatModeChange: (mode) => {
      setChatMode(mode);
      if (mode === "task") toast.info("任务看板即将开放");
    },
    onInteractionModeChange: (mode) => {
      setInteractionSelection({ threadId: activeThreadId, mode });
      if (activeThreadId) void updateChatThread(activeThreadId, { interactionMode: mode }).catch(() => toast.error("对话模式保存失败，请重试"));
    },
  };

  return (
    <>
      {showHome ? (
        <HomeWelcome
          threads={threadList}
          composer={composerProps}
          onSelectThread={openThread}
        />
      ) : (
        <ChatWorkspace
          key={activeThreadId}
          threads={threadList}
          activeThreadId={activeThreadId}
          activeThread={activeThread}
          messages={messages?.filter((message) => message.threadId === activeThreadId)}
          runs={runs?.filter((run) => run.threadId === activeThreadId)}
          retryableRunId={sending ? undefined : retryableRunId}
          onRetryRun={onRetryRun}
          onRunAction={onRunAction}
          composer={composerProps}
          onSelectThread={openThread}
          onNewTopic={handleNewTopic}
          onRenameThread={handleRenameThread}
          onDeleteThread={handleDeleteThread}
        />
      )}

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
        onOpenChange={(open) => !open && setDeleteTarget(undefined)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除话题</AlertDialogTitle>
            <AlertDialogDescription>
              删除「{deleteTarget?.title}」及其消息？无法恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => void commitDelete()}
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
