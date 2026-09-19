import type { ChatModelMetadata } from "@/lib/ai/modelMetadata";
import { resolveModelMetadata } from "@/lib/ai/modelMetadata";
import { resolveVisionCapability } from "@/lib/ai/visionCapability";
import { useLiveQuery } from "dexie-react-hooks";
import { formatTokenCount } from "@/lib/agent/contextUsage";
import { ModelIcon, ProviderIcon } from "@lobehub/icons";
import { ActionIcon } from "@lobehub/ui";
import * as Popover from "@radix-ui/react-popover";
import { ArrowUp, Check, ChevronDown, Eye, Plug, Square, Wrench } from "lucide-react";
import { useEffect, useMemo, useState, useRef, type ReactNode } from "react";
import { SURFACE_ELEVATED, TEXT, TEXT_TERTIARY } from "@/components/agent/agentTheme";
import type { ConnectorConfig, Id } from "@/domain/types";
import { buildChatModelOptions, type ChatModelPolicy } from "@/lib/ai/chatModelPolicy";
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

function ModelDetail({ modelId, metadata, providerId }: { modelId: string; metadata?: ChatModelMetadata; providerId?: string }) {
  const resolved = resolveModelMetadata(modelId, metadata, providerId);
  const contextWindow = resolved.contextWindow?.tokens;
  const vendor = lookupVendor(modelId);
  const hints = inferModelHints(modelId);
  const visionKey = `${providerId ?? ""}:${modelId}:${metadata?.vision ?? "unknown"}`;
  const visionResult = useLiveQuery(async () => ({ key: visionKey, capability: await resolveVisionCapability(modelId, providerId, metadata) }), [visionKey]);
  const vision = visionResult?.key === visionKey ? visionResult.capability : undefined;
  const abilities = [
    vision?.supported ? "视觉识别" : null,
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
          <dt>上下文上限{contextWindow ? resolved.contextWindow?.source === "provider" ? " · 供应商" : " · Model Bank" : ""}</dt>
          <dd title={resolved.contextWindow?.sourceUrl}>{contextWindow ? `${formatTokenCount(contextWindow)} tokens` : "供应商未提供"}</dd>
        </div>
        {resolved.maxOutputTokens && <div><dt>最大输出 · {resolved.maxOutputTokens.source === "provider" ? "供应商" : "Model Bank"}</dt><dd title={resolved.maxOutputTokens.sourceUrl}>{formatTokenCount(resolved.maxOutputTokens.tokens)} tokens</dd></div>}
        <div>
          <dt>能力</dt>
          <dd>
            {abilities.length > 0 ? abilities.join(" · ") : "暂无已确认的能力"}
            <div style={{ marginTop: 8, display: "flex", gap: 6, color: "#aaa" }}>
              {vision?.supported ? <Eye size={14} /> : null}
              {hints.tools ? <Wrench size={14} /> : null}
              {hints.reasoning ? <Check size={14} /> : null}
            </div>
          </dd>
        </div>
        <div>
          <dt>图片输入{vision && vision.source !== "unknown" ? ` · ${vision.source === "provider" ? "供应商" : "Model Bank"}` : ""}</dt>
          <dd title={vision?.sourceUrl}>{!vision ? "正在确认…" : vision.supported ? "支持 · 使用当前模型识图" : vision.source === "unknown" ? "能力未确认" : "不支持"}</dd>
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
  trigger,
  modelOptions,
  modelMetadata,
  probingModels,
  modelPolicy,
  connectors,
  selectedConnectorId,
  onConnectorChange,
  onModelChange,
  open: controlledOpen,
  onOpenChange,
}: {
  model: string;
  trigger?: ReactNode;
  modelMetadata?: Record<string, ChatModelMetadata>;
  modelOptions: Array<{ label: string; value: string }>;
  probingModels: boolean;
  modelPolicy: ChatModelPolicy;
  connectors: ConnectorConfig[];
  selectedConnectorId?: Id;
  onConnectorChange: (id: string) => void;
  onModelChange: (model: string) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [localOpen, setLocalOpen] = useState(false);
  const open = controlledOpen ?? localOpen;
  const setOpen = (next: boolean) => { setLocalOpen(next); onOpenChange?.(next); };
  const searchRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const [preview, setPreview] = useState(model);
  useEffect(() => {
    if (open) requestAnimationFrame(() => searchRef.current?.focus({ preventScroll: true }));
    if (open) { setPreview(model); setSearch(""); }
  }, [open, model]);

  const ids = useMemo(() => buildChatModelOptions(
    modelOptions.map((opt) => opt.value), model, search, modelPolicy,
  ), [modelOptions, model, search, modelPolicy]);

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
    : groups[0]?.models[0];

  const panel = (
    <div
      className="agent-model-panel"
      role="dialog"
      aria-label="选择模型"
      onMouseDown={(event) => event.stopPropagation()}
    >
      <div className="agent-model-list">
        <input
          ref={searchRef}
          className="agent-model-search"
          value={search}
          placeholder="搜索模型…"
          aria-label="搜索模型"
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
                {connector.definitionId === "apimart" ? (
                  <Plug size={14} />
                ) : (
                  <ProviderIcon
                    provider={connectorProviderKey(connector.definitionId)}
                    size={14}
                    type="color"
                  />
                )}
                {connectorDisplayName(connector)}
              </button>
            ))}
          </div>
        ) : null}
        <div className="agent-model-rows">
          {groups.length === 0 ? (
            <div className="agent-model-group">{probingModels ? "拉取模型中…" : !modelPolicy.verified ? "无法确认模型类型，请切换连接后重试" : "没有匹配的模型"}</div>
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
      {previewId ? <ModelDetail modelId={previewId} metadata={modelMetadata?.[previewId]} providerId={connectors.find((item) => item.id === selectedConnectorId)?.definitionId} /> : null}
    </div>
  );

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      {trigger ? <Popover.Anchor asChild><span className="agent-model-settings-anchor">{trigger}</span></Popover.Anchor> : <Popover.Trigger asChild><button type="button" className="agent-chip" aria-label={model || "选择模型"} aria-haspopup="dialog" aria-expanded={open}>
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
      </button></Popover.Trigger>}
      <Popover.Portal container={popupRoot()}>
        <Popover.Content side="top" align="end" sideOffset={10} collisionPadding={16} className="agent-model-popover" onOpenAutoFocus={(event) => { event.preventDefault(); searchRef.current?.focus({ preventScroll: true }); }} onCloseAutoFocus={(event) => { if (trigger) { event.preventDefault(); document.querySelector<HTMLButtonElement>(".agent-model-settings-anchor button" )?.focus({ preventScroll: true }); } }}>
          {panel}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
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
