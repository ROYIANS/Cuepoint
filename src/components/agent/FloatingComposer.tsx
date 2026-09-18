import { ActionIcon } from "@lobehub/ui";
import { Dropdown, Input, Switch, Tag } from "antd";
import {
  Brain,
  Check,
  ChevronDown,
  ChevronRight,
  Cloud,
  FileUp,
  Globe,
  Infinity as InfinityIcon,
  LayoutList,
  Plus,
  Settings2,
  Type,
} from "lucide-react";
import { useRef } from "react";
import { toast } from "sonner";
import type { ChatSurfaceMode, ComposerProps } from "@/components/agent/composerTypes";
import { ModelSelectTrigger, SendCircleButton } from "@/components/agent/ModelSelectTrigger";

function soon(label: string) {
  toast.info(`${label}：即将支持`);
}

function popupRoot(): HTMLElement {
  return document.querySelector<HTMLElement>(".agent-chat-root") ?? document.body;
}

function PlusMenu() {
  return (
    <div className="agent-plus-panel" onMouseDown={(event) => event.stopPropagation()}>
      <button type="button" className="agent-plus-item" onClick={() => soon("附件")}>
        <FileUp size={16} />
        <span style={{ flex: 1 }}>附件</span>
        <ChevronRight size={14} color="#6f6f6f" />
      </button>
      <div className="agent-plus-sep" />
      <button type="button" className="agent-plus-item" onClick={() => soon("记忆")}>
        <Brain size={16} />
        <span style={{ flex: 1 }}>记忆</span>
        <Switch disabled size="small" />
      </button>
      <button type="button" className="agent-plus-item" onClick={() => soon("联网搜索")}>
        <Globe size={16} />
        <span style={{ flex: 1 }}>联网搜索</span>
        <Switch disabled size="small" />
      </button>
      <button type="button" className="agent-plus-item" onClick={() => soon("技能")}>
        <Settings2 size={16} />
        <span style={{ flex: 1 }}>技能</span>
        <Tag style={{ marginInlineEnd: 0 }}>自动</Tag>
        <ChevronRight size={14} color="#6f6f6f" />
      </button>
      <div className="agent-plus-sep" />
      <button type="button" className="agent-plus-item" onClick={() => soon("格式工具")}>
        <Type size={16} />
        <span style={{ flex: 1 }}>格式工具</span>
        <Switch disabled size="small" />
      </button>
      <button type="button" className="agent-plus-item" onClick={() => soon("Agent Gateway")}>
        <Cloud size={16} />
        <span style={{ flex: 1 }}>Agent Gateway</span>
        <Tag color="blue" style={{ marginInlineEnd: 4 }}>
          Beta
        </Tag>
        <Switch disabled size="small" />
      </button>
      <button type="button" className="agent-plus-item" onClick={() => soon("高级参数")}>
        <Settings2 size={16} />
        <span style={{ flex: 1 }}>高级参数</span>
      </button>
    </div>
  );
}

function ModeSwitch({
  mode,
  onChange,
}: {
  mode: ChatSurfaceMode;
  onChange: (mode: ChatSurfaceMode) => void;
}) {
  return (
    <Dropdown
      trigger={["click"]}
      placement="topLeft"
      getPopupContainer={popupRoot}
      menu={{ items: [] }}
      popupRender={() => (
        <div className="agent-mode-panel" onMouseDown={(event) => event.stopPropagation()}>
          <button
            type="button"
            className={`agent-mode-item${mode === "agent" ? " is-active" : ""}`}
            onClick={() => onChange("agent")}
          >
            <InfinityIcon size={16} style={{ marginTop: 2 }} />
            <span>
              <div className="agent-mode-item-title">
                Agent
                {mode === "agent" ? <Check size={12} style={{ marginLeft: 8, display: "inline" }} /> : null}
              </div>
              <div className="agent-mode-item-desc">自由聊天，后续可接入操作</div>
            </span>
          </button>
          <button
            type="button"
            className={`agent-mode-item${mode === "task" ? " is-active" : ""}`}
            onClick={() => onChange("task")}
          >
            <LayoutList size={16} style={{ marginTop: 2 }} />
            <span>
              <div className="agent-mode-item-title">任务</div>
              <div className="agent-mode-item-desc">按任务管理，看板稍后设计</div>
            </span>
          </button>
        </div>
      )}
    >
      <button type="button" className="agent-chip agent-mode-chip" aria-label={mode === "task" ? "任务模式" : "Agent 模式"}>
        {mode === "task" ? <LayoutList size={14} /> : <InfinityIcon size={14} />}
        <span>{mode === "task" ? "任务" : "Agent"}</span>
        <ChevronDown size={12} style={{ flexShrink: 0, opacity: 0.7 }} />
      </button>
    </Dropdown>
  );
}

/**
 * Floating composer — left Agent/任务, right model (with connector inside) + send.
 */
export function FloatingComposer({
  value,
  sending,
  connectors,
  selectedConnectorId,
  model,
  modelOptions,
  probingModels,
  modelPolicy,
  modelWarning,
  chatMode,
  onChange,
  onSend,
  onStop,
  onConnectorChange,
  onModelChange,
  onChatModeChange,
  large,
}: ComposerProps) {
  const canSend = Boolean(value.trim()) && !sending && !modelPolicy.incompatibleModels.includes(model.trim());
  const composing = useRef(false);

  const trySend = () => {
    if (canSend) onSend();
  };

  return (
    <div className="agent-composer">
      <Input.TextArea
        value={value}
        variant="borderless"
        placeholder="提问、创建内容或启动任务"
        autoSize={{ minRows: large ? 3 : 2, maxRows: 10 }}
        className="agent-composer-input"
        onChange={(event) => onChange(event.target.value)}
        onCompositionStart={() => {
          composing.current = true;
        }}
        onCompositionEnd={() => {
          composing.current = false;
        }}
        onPressEnter={(event) => {
          if (composing.current || event.shiftKey) return;
          event.preventDefault();
          trySend();
        }}
      />
      {modelWarning ? <div role="status" style={{ padding: "0 16px 8px", fontSize: 12, color: "#e0b878" }}>{modelWarning}</div> : null}
      <div className="agent-composer-footer">
        <div className="agent-composer-cluster">
          <ModeSwitch mode={chatMode} onChange={onChatModeChange} />
          <Dropdown
            trigger={["click"]}
            placement="topLeft"
            getPopupContainer={popupRoot}
            menu={{ items: [] }}
            popupRender={() => <PlusMenu />}
          >
            <ActionIcon icon={Plus} title="更多" size="small" />
          </Dropdown>
        </div>

        <div className="agent-composer-cluster agent-composer-cluster-right">
          <Dropdown
            trigger={["click"]}
            placement="topRight"
            getPopupContainer={popupRoot}
            menu={{
              items: [
                { key: "low", label: "推理强度 · 低", disabled: true },
                { key: "medium", label: "推理强度 · 中", disabled: true },
                { key: "high", label: "推理强度 · 高", disabled: true },
                { key: "soon", label: "即将按模型能力开放", disabled: true },
              ],
            }}
          >
            <button type="button" className="agent-chip">
              推理强度
            </button>
          </Dropdown>
          <ModelSelectTrigger
            model={model}
            modelOptions={modelOptions}
            probingModels={probingModels}
            modelPolicy={modelPolicy}
            connectors={connectors}
            selectedConnectorId={selectedConnectorId}
            onConnectorChange={onConnectorChange}
            onModelChange={onModelChange}
          />
          <SendCircleButton
            sending={sending}
            canSend={canSend}
            onSend={trySend}
            onStop={onStop}
          />
        </div>
      </div>
    </div>
  );
}
