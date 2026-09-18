import { ModelIcon, ProviderIcon } from "@lobehub/icons";
import { ActionIcon } from "@lobehub/ui";
import { Dropdown } from "antd";
import { ArrowUp, Check, ChevronDown, Eye, Square, Wrench } from "lucide-react";
import { useMemo, useState } from "react";
import { SURFACE_ELEVATED, TEXT, TEXT_TERTIARY } from "@/components/agent/agentTheme";
import type { ConnectorConfig, Id } from "@/domain/types";
import {
  connectorDisplayName,
  connectorProviderKey,
} from "@/lib/ai/catalog";
import {
  groupModelsByVendor,
  inferModelHints,
  lookupVendor,
  modelDisplayName,
} from "@/lib/ai/modelVendors";

function popupRoot(): HTMLElement {
  return document.querySelector<HTMLElement>(".agent-chat-root") ?? document.body;
}

function ModelDetail({ modelId }: { modelId: string }) {
  const vendor = lookupVendor(modelId);
  const hints = inferModelHints(modelId);
  const abilities = [
    hints.vision ? "视觉识别" : null,
    hints.tools ? "工具调用" : null,
    hints.reasoning ? "深度思考" : null,
  ].filter(Boolean);

  return (
    <aside className="agent-model-detail">
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <ModelIcon model={modelId} size={28} type="color" />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.3 }}>
            {modelDisplayName(modelId)}
          </div>
          <div style={{ fontSize: 12, color: "#aaa" }}>{vendor.title}</div>
        </div>
      </div>
      <dl style={{ margin: 0, display: "grid", gap: 12 }}>
        <div>
          <dt>上下文长度</dt>
          <dd>即将开放</dd>
        </div>
        <div>
          <dt>能力</dt>
          <dd>
            {abilities.length > 0 ? abilities.join(" · ") : "即将开放"}
            <div style={{ marginTop: 8, display: "flex", gap: 6, color: "#aaa" }}>
              {hints.vision ? <Eye size={14} /> : null}
              {hints.tools ? <Wrench size={14} /> : null}
              {hints.reasoning ? <Check size={14} /> : null}
            </div>
          </dd>
        </div>
        <div>
          <dt>价格</dt>
          <dd>即将开放</dd>
        </div>
      </dl>
    </aside>
  );
}

/**
 * Right-side model chip — vendor groups + detail pane, hosted inside
 * `.agent-chat-root` so the chat theme (not document.body) styles the popup.
 */
export function ModelSelectTrigger({
  model,
  modelOptions,
  probingModels,
  connectors,
  selectedConnectorId,
  onConnectorChange,
  onModelChange,
}: {
  model: string;
  modelOptions: Array<{ label: string; value: string }>;
  probingModels: boolean;
  connectors: ConnectorConfig[];
  selectedConnectorId?: Id;
  onConnectorChange: (id: string) => void;
  onModelChange: (model: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [preview, setPreview] = useState(model);

  const ids = useMemo(() => {
    const set = new Set(modelOptions.map((opt) => opt.value));
    if (model) set.add(model);
    const extra = search.trim();
    if (extra) set.add(extra);
    return [...set];
  }, [modelOptions, model, search]);

  const groups = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return groupModelsByVendor(ids)
      .map((group) => ({
        ...group,
        models: needle ? group.models.filter((id) => id.toLowerCase().includes(needle)) : group.models,
      }))
      .filter((group) => group.models.length > 0);
  }, [ids, search]);

  const previewId = groups.some((group) => group.models.includes(preview))
    ? preview
    : (groups[0]?.models[0] ?? model);

  const panel = (
    <div
      className="agent-model-panel"
      onMouseDown={(event) => event.stopPropagation()}
    >
      <div className="agent-model-list">
        <input
          className="agent-model-search"
          value={search}
          placeholder="搜索模型…"
          onChange={(event) => setSearch(event.target.value)}
        />
        {connectors.length > 0 ? (
          <div className="agent-model-providers">
            {connectors.map((connector) => (
              <button
                key={connector.id}
                type="button"
                className={`agent-model-provider${connector.id === selectedConnectorId ? " is-active" : ""}`}
                onClick={() => onConnectorChange(connector.id)}
              >
                <ProviderIcon
                  provider={connectorProviderKey(connector.definitionId)}
                  size={14}
                  type="color"
                />
                {connectorDisplayName(connector)}
              </button>
            ))}
          </div>
        ) : null}
        <div className="agent-model-rows">
          {groups.length === 0 ? (
            <div className="agent-model-group">{probingModels ? "拉取模型中…" : "没有匹配的模型"}</div>
          ) : (
            groups.map((group) => (
              <div key={group.key}>
                <div className="agent-model-group" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <ProviderIcon provider={group.provider} size={16} type="color" />
                  <span>{group.title}</span>
                </div>
                {group.models.map((id) => (
                  <button
                    key={id}
                    type="button"
                    className={`agent-model-row${id === model || id === previewId ? " is-active" : ""}`}
                    onMouseEnter={() => setPreview(id)}
                    onClick={() => {
                      onModelChange(id);
                      setSearch("");
                      setOpen(false);
                    }}
                  >
                    <ModelIcon model={id} size={18} type="color" />
                    <span
                      style={{
                        flex: 1,
                        minWidth: 0,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {modelDisplayName(id)}
                    </span>
                    {id === model ? <Check size={14} color="#aaa" /> : null}
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
      </div>
      {previewId ? <ModelDetail modelId={previewId} /> : null}
    </div>
  );

  return (
    <Dropdown
      trigger={["click"]}
      placement="topRight"
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setPreview(model);
          setSearch("");
        }
      }}
      getPopupContainer={popupRoot}
      menu={{ items: [] }}
      popupRender={() => panel}
    >
      <button type="button" className="agent-chip" aria-label={model || "选择模型"}>
        {model ? <ModelIcon model={model} size={16} type="color" /> : null}
        <span
          style={{
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {model ? modelDisplayName(model) : probingModels ? "拉取模型中…" : "选择模型"}
        </span>
        <ChevronDown size={12} style={{ flexShrink: 0, opacity: 0.7 }} />
      </button>
    </Dropdown>
  );
}

export function SendCircleButton({
  sending,
  canSend,
  onSend,
  onStop,
}: {
  sending: boolean;
  canSend: boolean;
  onSend: () => void;
  onStop: () => void;
}) {
  if (sending) {
    return (
      <ActionIcon
        icon={Square}
        title="停止"
        onClick={onStop}
        className="agent-composer-send"
        style={{
          width: 36,
          height: 36,
          background: TEXT,
          color: "#111",
          borderRadius: 999,
        }}
      />
    );
  }

  return (
    <ActionIcon
      icon={ArrowUp}
      title="发送"
      onClick={onSend}
      disabled={!canSend}
      className="agent-composer-send"
      style={{
        width: 36,
        height: 36,
        background: canSend ? TEXT : SURFACE_ELEVATED,
        color: canSend ? "#111" : TEXT_TERTIARY,
        borderRadius: 999,
        cursor: canSend ? "pointer" : "not-allowed",
      }}
    />
  );
}
