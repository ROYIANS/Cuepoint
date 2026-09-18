import { Dropdown } from "antd";
import { Check, ChevronDown } from "lucide-react";
import { useState } from "react";
import type { AgentReasoningEffort } from "@/domain/agent";
import type { ConnectorConfig } from "@/domain/types";
import { getReasoningPolicy, REASONING_EFFORT_LABELS } from "@/lib/ai/reasoningPolicy";
import { modelDisplayName } from "@/lib/ai/modelVendors";

export function ModelSettingsMenu({ connector, model, effort, onChange, onChooseModel }: {
  connector?: ConnectorConfig; model: string; effort?: AgentReasoningEffort;
  onChange: (effort: AgentReasoningEffort | undefined) => void; onChooseModel: () => void;
}) {
  const [open, setOpen] = useState(false);
  const policy = connector ? getReasoningPolicy(connector, model) : undefined;
  return <Dropdown open={open} onOpenChange={setOpen} trigger={["click"]} placement="topRight" autoFocus
    getPopupContainer={() => document.querySelector<HTMLElement>(".agent-chat-root") ?? document.body}
    menu={{
      className: "agent-composer-menu",
      items: [
        ...(policy ? [{ key: "effort", label: `推理强度 · ${effort ? REASONING_EFFORT_LABELS[effort] : "模型默认"}`, children: [
          { key: "default", label: "模型默认", icon: effort === undefined ? <Check size={14} /> : undefined },
          ...policy.levels.map((value) => ({ key: value, label: REASONING_EFFORT_LABELS[value], icon: value === effort ? <Check size={14} /> : undefined })),
        ] }, { type: "divider" as const }] : []),
        { key: "model", label: <span className="agent-control-option"><span>更换模型</span><small>{modelDisplayName(model)}</small></span> },
      ],
      onClick: ({ key }) => {
        if (key === "model") onChooseModel();
        else if (key === "default") onChange(undefined);
        else if (policy?.levels.some((value) => value === key)) onChange(key as AgentReasoningEffort);
        setOpen(false);
      },
    }}>
    <button type="button" className="agent-chip" aria-label={`模型设置：${model}`} aria-haspopup="menu" aria-expanded={open}>
      <span className="agent-model-setting-label">{modelDisplayName(model)}</span>
      {policy && effort && <small className="agent-model-effort-label">{REASONING_EFFORT_LABELS[effort]}</small>}
      <ChevronDown size={12} aria-hidden />
    </button>
  </Dropdown>;
}
