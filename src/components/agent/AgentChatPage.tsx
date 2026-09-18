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
import type { ChatSurfaceMode, ComposerProps } from "@/components/agent/composerTypes";
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
  appendChatMessage,
  createChatThread,
  deleteChatThread,
  updateChatMessage,
  updateChatThread,
} from "@/db/repo";
import type { ChatThread, Id } from "@/domain/types";
import {
  accumulateStreamDelta,
  createReasoningAccum,
  finalizeReasoningAccum,
  streamChatCompletions,
  type ChatCompletionMessage,
} from "@/lib/ai/chatStream";
import { discoverConnectorChatModels, runWithCompatibleChatModel } from "@/lib/ai/connectors";
import {
  buildChatModelOptions,
  chatModelIssue,
  getChatModelPolicy,
  sameChatModelConnector,
  type ChatModelCatalog,
} from "@/lib/ai/chatModelPolicy";

function deriveTitle(content: string): string {
  const trimmed = content.trim().replace(/\s+/g, " ");
  if (!trimmed) return "新话题";
  return trimmed.length > 24 ? `${trimmed.slice(0, 24)}…` : trimmed;
}

export function AgentChatPage({ threadId }: { threadId?: Id }) {
  return <AgentChatInner threadId={threadId} />;
}

function AgentChatInner({ threadId }: { threadId?: Id }) {
  const navigate = useNavigate();
  const threads = useLiveQuery(() => db.chatThreads.orderBy("updatedAt").reverse().toArray(), []);
  const connectors = useLiveQuery(() => db.connectors.toArray(), []);
  const activeThreadId = threadId;
  const [draft, setDraft] = useState("");
  const [sessionConnectorId, setSessionConnectorId] = useState<Id | undefined>();
  const [sessionModel, setSessionModel] = useState("");
  const [modelCatalog, setModelCatalog] = useState<ChatModelCatalog>();
  const [chatMode, setChatMode] = useState<ChatSurfaceMode>("agent");
  const [sending, setSending] = useState(false);
  const [renameTarget, setRenameTarget] = useState<ChatThread>();
  const [renameValue, setRenameValue] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<ChatThread>();
  const abortRef = useRef<AbortController | null>(null);
  const sendLockRef = useRef(false);
  const selectionRevisionRef = useRef(0);

  useEffect(() => () => abortRef.current?.abort(), []);

  const loaded = threads !== undefined && connectors !== undefined;
  const threadList = threads ?? [];
  const connectorList = connectors ?? [];

  const openThread = useCallback(
    (id: Id) => {
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
      abortRef.current = null;
      setSending(false);
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
    if (abortRef.current && activeThreadId === deleteTarget.id) {
      abortRef.current.abort();
      abortRef.current = null;
      setSending(false);
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
    setSending(true);
    try {
      const checked = await runWithCompatibleChatModel(connector, model, async () => {
        let thread = activeThread;
        if (!thread) {
          thread = await createChatThread({ connectorId: connector.id, model, title: deriveTitle(content) });
          await navigate({ to: "/agent/$threadId", params: { threadId: thread.id } });
        }
        if (!thread.connectorId || thread.connectorId !== connector.id) {
          await updateChatThread(thread.id, { connectorId: connector.id });
        }
        if (!thread.model || thread.model !== model) {
          await updateChatThread(thread.id, { model });
        }
        if (thread.title === "新对话" || thread.title === "新话题") {
          await updateChatThread(thread.id, { title: deriveTitle(content) });
        }

        const history = (messages ?? []).filter(
          (m) => m.role === "user" || m.role === "assistant" || m.role === "system",
        );
        const userMessage = await appendChatMessage({
          threadId: thread.id,
          role: "user",
          content,
          status: "complete",
        });
        const assistantMessage = await appendChatMessage({
          threadId: thread.id,
          role: "assistant",
          content: "",
          status: "streaming",
        });

        const payload: ChatCompletionMessage[] = [
          ...history.map((m) => ({
            role: m.role as ChatCompletionMessage["role"],
            content: m.content,
          })),
          { role: "user", content: userMessage.content },
        ];

        setDraft((current) => current === draft ? "" : current);
        let accum = createReasoningAccum();

        const persistStreaming = (next: typeof accum) => {
          void updateChatMessage(assistantMessage.id, {
            content: next.content,
            status: "streaming",
            ...(next.reasoning ? { reasoning: next.reasoning } : {}),
            ...(next.reasoningDurationMs != null
              ? { reasoningDurationMs: next.reasoningDurationMs }
              : {}),
          });
        };

        const result = await streamChatCompletions(
          {
            baseUrl: connector.baseUrl,
            apiKey: connector.apiKey,
            model,
            messages: payload,
          },
          {
            signal: controller.signal,
            onReasoning: (piece) => {
              accum = accumulateStreamDelta(accum, { reasoning: piece }, Date.now());
              persistStreaming(accum);
            },
            onDelta: (piece) => {
              accum = accumulateStreamDelta(accum, { content: piece }, Date.now());
              persistStreaming(accum);
            },
          },
        );

        accum = finalizeReasoningAccum(accum, Date.now());
        const reasoningPatch = {
          ...(accum.reasoning ? { reasoning: accum.reasoning } : {}),
          ...(accum.reasoningDurationMs != null
            ? { reasoningDurationMs: accum.reasoningDurationMs }
            : {}),
        };

        if (result.ok) {
          const finalContent = result.content || accum.content;
          const finalReasoning = result.reasoning || accum.reasoning;
          await updateChatMessage(assistantMessage.id, {
            content: finalContent,
            status: "complete",
            ...(finalReasoning ? { reasoning: finalReasoning } : {}),
            ...(accum.reasoningDurationMs != null
              ? { reasoningDurationMs: accum.reasoningDurationMs }
              : {}),
          });
        } else if (result.aborted) {
          await updateChatMessage(assistantMessage.id, {
            content: accum.content || "（已停止）",
            status: "aborted",
            ...reasoningPatch,
          });
        } else {
          await updateChatMessage(assistantMessage.id, {
            content: accum.content || result.message,
            status: "error",
            ...reasoningPatch,
          });
          toast.error(result.message);
        }
      }, {
        signal: controller.signal,
        isCurrent: () => selectionRevisionRef.current === selectionRevision &&
          sameChatModelConnector(selectionRef.current.connector, connector) &&
          selectionRef.current.model === model && selectionRef.current.threadId === activeThreadId,
      });
      if (!checked.ok && !checked.aborted) toast.error(checked.message);
    } catch {
      toast.error("发送失败，请重试");
    } finally {
      sendLockRef.current = false;
      if (abortRef.current === controller) {
        abortRef.current = null;
        setSending(false);
      }
    }
  }, [navigate, draft, activeThread, activeThreadId, selectedConnector, modelValue, messages]);

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

  if (connectorList.length === 0) {
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

  const composerProps: ComposerProps = {
    value: draft,
    sending,
    connectors: connectorList,
    selectedConnectorId: selectedConnector?.id,
    model: modelValue,
    modelOptions: selectModelOptions,
    probingModels,
    modelPolicy,
    modelWarning: modelValue
      ? probingModels && !modelPolicy.incompatibleModels.includes(modelValue) && !modelPolicy.verified
        ? "正在确认 APIMart 模型类型…"
        : chatModelIssue(modelValue, modelPolicy)
      : undefined,
    chatMode,
    onChange: setDraft,
    onSend: () => void handleSend(),
    onStop: handleStop,
    onConnectorChange: (id) => void handleConnectorChange(id),
    onModelChange: (model) => void handleModelChange(model),
    onChatModeChange: (mode) => {
      setChatMode(mode);
      if (mode === "task") toast.info("任务看板即将开放");
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
          threads={threadList}
          activeThreadId={activeThreadId}
          activeThread={activeThread}
          messages={messages}
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
