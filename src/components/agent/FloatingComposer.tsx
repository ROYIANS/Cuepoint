import { ModelSettingsMenu } from "./ModelSettingsMenu";
import { AgentControls, ComposerPlusMenu } from "@/components/agent/AgentControls";
import { Dropdown, Input } from "antd";
import { Check, ChevronDown, Expand, Infinity as InfinityIcon, LayoutList, MessagesSquare, Mic, Minimize2, Sparkles } from "lucide-react";
import { useEffect, useRef, useState, type ComponentRef } from "react";
import { toast } from "sonner";
import type { ChatSurfaceMode, ComposerProps } from "@/components/agent/composerTypes";
import { ModelSelectTrigger, SendCircleButton } from "@/components/agent/ModelSelectTrigger";
import "./composerControls.css";

function popupRoot(): HTMLElement {
  return document.querySelector<HTMLElement>(".agent-chat-root") ?? document.body;
}

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};

function speechRecognitionConstructor(): (new () => SpeechRecognitionLike) | undefined {
  const browser = window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike };
  return browser.SpeechRecognition ?? browser.webkitSpeechRecognition;
}

function ModeSwitch({ mode, onChange }: {
  mode: ChatSurfaceMode;
  onChange: (mode: ChatSurfaceMode) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dropdown
      trigger={["click"]}
      placement="topLeft"
      getPopupContainer={popupRoot}
      open={open}
      onOpenChange={setOpen}
      autoFocus
      menu={{
        className: "agent-composer-menu",
        selectedKeys: [mode],
        items: [
          { key: "agent", icon: <InfinityIcon size={16} />, label: <span className="agent-control-option"><span>Agent {mode === "agent" && <Check size={14} />}</span><small>聊天并调用已启用的工具</small></span> },
          { key: "task", icon: <LayoutList size={16} />, label: <span className="agent-control-option"><span>任务 {mode === "task" && <Check size={14} />}</span><small>围绕目标规划步骤，追踪进度与成果</small></span> },
        ],
        onClick: ({ key }) => { onChange(key as ChatSurfaceMode); setOpen(false); },
      }}
    >
      <button type="button" className="agent-chip agent-control" aria-label={mode === "task" ? "任务模式" : "Agent 模式"} aria-haspopup="menu" aria-expanded={open}>
        {mode === "task" ? <LayoutList size={16} aria-hidden /> : <InfinityIcon size={16} aria-hidden />}
        <span>{mode === "task" ? "任务" : "Agent"}</span>
        <ChevronDown size={12} aria-hidden />
      </button>
    </Dropdown>
  );
}

function InteractionModeSwitch({ mode, onChange }: {
  mode: ComposerProps["interactionMode"];
  onChange: ComposerProps["onInteractionModeChange"];
}) {
  const [open, setOpen] = useState(false);
  const smart = mode === "smart";
  return (
    <Dropdown trigger={["click"]} placement="topLeft" getPopupContainer={popupRoot} open={open} onOpenChange={setOpen}
      menu={{
        className: "agent-composer-menu",
        selectedKeys: [mode],
        items: [
          { key: "smart", icon: <Sparkles size={16} />, label: <span className="agent-control-option"><span>智能模式 {smart && <Check size={14} />}</span><small>可调用已启用的工具和技能</small></span> },
          { key: "conversation", icon: <MessagesSquare size={16} />, label: <span className="agent-control-option"><span>对话模式 {!smart && <Check size={14} />}</span><small>仅进行普通对话，不调用工具</small></span> },
        ],
        onClick: ({ key }) => { onChange(key as ComposerProps["interactionMode"]); setOpen(false); },
      }}
    >
      <button type="button" className="agent-chip agent-control" aria-label={smart ? "智能模式" : "对话模式"} aria-haspopup="menu" aria-expanded={open}>
        {smart ? <Sparkles size={16} aria-hidden /> : <MessagesSquare size={16} aria-hidden />}
        <span>{smart ? "智能" : "对话"}</span><ChevronDown size={12} aria-hidden />
      </button>
    </Dropdown>
  );
}

/**
 * Floating composer — left Agent/任务, right model (with connector inside) + send.
 */
export function FloatingComposer({
  threadId,
  value,
  sending,
  blocked,
  connectors,
  selectedConnectorId,
  model,
  reasoningEffort,
  onReasoningEffortChange,
  modelOptions,
  modelMetadata,
  probingModels,
  modelPolicy,
  modelWarning,
  chatMode,
  interactionMode,
  onChange,
  onSend,
  onStop,
  onConnectorChange,
  onModelChange,
  onChatModeChange,
  onInteractionModeChange,
  large,
  contextUsage,
  status,
  surface = "home",
  expanded = false,
  onExpandedChange,
}: ComposerProps & { surface?: "home" | "detail"; expanded?: boolean; onExpandedChange?: (expanded: boolean) => void }) {
  const canSend = Boolean(value.trim()) && !blocked && !sending && !modelPolicy.incompatibleModels.includes(model.trim());
  const composing = useRef(false);
  const inputRef = useRef<ComponentRef<typeof Input.TextArea>>(null);
  useEffect(() => { inputRef.current?.focus({ preventScroll: true }); }, [expanded]);
  const [modelOpen, setModelOpen] = useState(false);

  const [sendShortcut, setSendShortcut] = useState<"enter" | "mod-enter">(() => { try { return localStorage.getItem("cuepoint.agent.sendShortcut") === "mod-enter" ? "mod-enter" : "enter"; } catch { return "enter"; } });
  const [listening, setListening] = useState(false);
  const speechRef = useRef<SpeechRecognitionLike | null>(null);
  const speechBaseRef = useRef("");
  const detail = surface === "detail";

  useEffect(() => {
    if (!expanded) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented && event.target instanceof Element && event.target.closest(".agent-composer-stack")) onExpandedChange?.(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [expanded, onExpandedChange]);

  useEffect(() => () => {
    const speech = speechRef.current;
    if (speech) { speech.onresult = null; speech.onend = null; speech.onerror = null; speech.stop(); }
  }, []);

  const toggleVoiceInput = () => {
    if (listening) {
      speechRef.current?.stop();
      return;
    }
    const Recognition = speechRecognitionConstructor();
    if (!Recognition) {
      toast.info("当前浏览器不支持语音输入");
      return;
    }
    const recognition = new Recognition();
    speechBaseRef.current = value.trimEnd();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = "zh-CN";
    recognition.onresult = (event) => {
      const transcript = Array.from({ length: event.results.length }, (_, index) => event.results[index]?.[0]?.transcript ?? "").join("").trim();
      onChange([speechBaseRef.current, transcript].filter(Boolean).join(" "));
    };
    recognition.onend = () => { setListening(false); speechRef.current = null; };
    recognition.onerror = () => { setListening(false); speechRef.current = null; toast.error("语音输入失败，请重试"); };
    speechRef.current = recognition;
    setListening(true);
    try { recognition.start(); } catch {
      speechRef.current = null;
      setListening(false);
      toast.error("无法启动语音输入，请检查浏览器的麦克风权限");
    }
  };

  const trySend = () => {
    if (canSend && !listening) onSend();
  };

  return (
    <div className={`agent-composer-stack${expanded ? " is-expanded" : ""}`}>
      {status && !expanded ? <div className="agent-composer-status">{status}</div> : null}
    <div className="agent-composer agent-composer-refined">
      <Input.TextArea
        ref={inputRef}
        readOnly={listening}
        value={value}
        variant="borderless"
        placeholder={blocked ? "重新打开任务后可继续对话" : surface === "home" && chatMode === "task" ? "描述你想完成的事，与助手一起明确需求…" : "提问、创建内容或启动任务"}
        autoSize={expanded ? false : { minRows: large ? 3 : 2, maxRows: 10 }}
        className="agent-composer-input"
        onChange={(event) => onChange(event.target.value)}
        onCompositionStart={() => {
          composing.current = true;
        }}
        onCompositionEnd={() => {
          composing.current = false;
        }}
        onPressEnter={(event) => {
          if (composing.current || event.nativeEvent.isComposing || event.shiftKey || event.altKey) return;
          if (expanded) {
            if (event.metaKey || event.ctrlKey) { event.preventDefault(); trySend(); }
            return;
          }
          if (detail && sendShortcut === "mod-enter" && !(event.metaKey || event.ctrlKey)) return;
          if (detail && !expanded && sendShortcut === "enter" && (event.metaKey || event.ctrlKey)) return;
          event.preventDefault();
          trySend();
        }}
      />
      {modelWarning ? <div role="status" style={{ padding: "0 16px 8px", fontSize: 12, color: "#e0b878" }}>{modelWarning}</div> : null}
      <div className="agent-composer-footer">
        <div className="agent-composer-cluster">
          {!detail && <ModeSwitch mode={chatMode} onChange={onChatModeChange} />}
          <ComposerPlusMenu threadId={threadId} />
          {detail ? <button type="button" className="agent-chip agent-control agent-control-icon" aria-label={expanded ? "退出全屏编辑" : "展开编辑器"} onClick={() => onExpandedChange?.(!expanded)}>
            {expanded ? <Minimize2 size={17} aria-hidden /> : <Expand size={17} aria-hidden />}
          </button> : null}
        </div>

        <div className="agent-composer-cluster agent-composer-cluster-right">
          <ModelSelectTrigger
            trigger={model ? <ModelSettingsMenu connector={connectors.find((c) => c.id === selectedConnectorId)} model={model} effort={reasoningEffort} onChange={onReasoningEffortChange} onChooseModel={() => setModelOpen(true)} /> : undefined}
            open={modelOpen}
            onOpenChange={setModelOpen}
            model={model}
            modelOptions={modelOptions}
            modelMetadata={modelMetadata}
            probingModels={probingModels}
            modelPolicy={modelPolicy}
            connectors={connectors}
            selectedConnectorId={selectedConnectorId}
            onConnectorChange={onConnectorChange}
            onModelChange={onModelChange}
          />
          {detail ? <button type="button" className={`agent-chip agent-control agent-control-icon agent-voice-button${listening ? " is-active" : ""}`} aria-label={listening ? "停止语音输入" : "语音输入"} onClick={toggleVoiceInput} disabled={sending} title={listening ? "停止语音输入" : "语音输入"}><Mic size={17} aria-hidden /></button> : null}
          <div className="agent-composer-send-group">
            <SendCircleButton sending={sending} canSend={canSend && !listening} onSend={trySend} onStop={onStop} />
            {detail && !sending ? <Dropdown
              trigger={["click"]}
              placement="topRight"
              getPopupContainer={popupRoot}
              menu={{
                className: "agent-composer-menu",
                selectedKeys: [expanded ? "mod-enter" : sendShortcut],
                items: [
                  { key: "enter", disabled: expanded, label: <span className="agent-control-option"><span>按 Enter 发送 {!expanded && sendShortcut === "enter" && <Check size={14} />}</span><small>Shift + Enter 换行</small></span> },
                  { key: "mod-enter", label: <span className="agent-control-option"><span>按 ⌘ / Ctrl + Enter 发送 {(expanded || sendShortcut === "mod-enter") && <Check size={14} />}</span><small>Enter 换行</small></span> },
                ],
                onClick: ({ key }) => { setSendShortcut(key as "enter" | "mod-enter"); try { localStorage.setItem("cuepoint.agent.sendShortcut", key); } catch { /* Current page still uses the selection. */ } },
              }}
            ><button type="button" className="agent-send-menu-trigger" aria-label="发送方式"><ChevronDown size={13} aria-hidden /></button></Dropdown> : null}
          </div>
        </div>
      </div>
    </div>
    {detail ? <div className="agent-composer-controlbar">
      <div className="agent-composer-cluster">
        <InteractionModeSwitch mode={interactionMode} onChange={onInteractionModeChange} />
      </div>
      <div className="agent-composer-cluster agent-composer-permissions"><AgentControls />{contextUsage}</div>
    </div> : null}
    </div>
  );
}
