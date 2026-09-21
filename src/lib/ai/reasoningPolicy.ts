import { getModelBankEntry } from "@/lib/ai/modelBank";
import type { AgentProtocol, AgentReasoningEffort } from "@/domain/agent";
import type { ConnectorConfig } from "@/domain/types";

export interface ReasoningPolicy {
  levels: readonly AgentReasoningEffort[];
  source: string;
  contextWindow?: number;
}
// Application transport allowlist, separate from the unmodified upstream dataset.
const WIRE_POLICIES: Readonly<Record<string, { levels: readonly AgentReasoningEffort[]; source: string }>> = {
  "gpt-5": { levels: ["minimal", "low", "medium", "high"], source: "https://developers.openai.com/api/docs/models/gpt-5" },
  "gpt-5-2025-08-07": { levels: ["minimal", "low", "medium", "high"], source: "https://developers.openai.com/api/docs/models/gpt-5" },
  "gpt-5.1": { levels: ["none", "low", "medium", "high"], source: "https://developers.openai.com/api/docs/models/gpt-5.1" },
  "gpt-5.2": { levels: ["none", "low", "medium", "high", "xhigh"], source: "https://developers.openai.com/api/docs/guides/latest-model?model=gpt-5.2" },
  "gpt-5.6-luna": { levels: ["none", "low", "medium", "high", "xhigh", "max"], source: "https://developers.openai.com/api/docs/models/gpt-5.6-luna" },
  "o3": { levels: ["low", "medium", "high"], source: "https://developers.openai.com/api/docs/guides/latest-model?model=gpt-5.2" },
};

type ReasoningConnector = Pick<ConnectorConfig, "definitionId" | "baseUrl">;


export const REASONING_EFFORT_LABELS: Record<AgentReasoningEffort, string> = {
  none: "关闭", minimal: "最低", low: "低", medium: "中", high: "高", xhigh: "极高", max: "最高",
};

export function getReasoningPolicy(connector: ReasoningConnector | undefined, model: string): ReasoningPolicy | undefined {
  if (!connector) return undefined;
  const id = model.trim();
  const wire = Object.hasOwn(WIRE_POLICIES, id) ? WIRE_POLICIES[id] : undefined;
  if (!wire) return undefined;
  const policy: ReasoningPolicy = { ...wire, contextWindow: getModelBankEntry(id, connector.definitionId)?.contextWindow };
  // The generic connector explicitly uses the OpenAI Chat Completions contract.
  // It may be a user-configured proxy; this table is not a provider availability probe.
  if (connector.definitionId === "openai-compatible") return { ...policy, levels: [...policy.levels] };
  if (connector.definitionId === "aihubmix") {
    // Its current Chat Completions schema only documents values through xhigh.
    // https://docs.aihubmix.com/cn/api-reference/openai-compatible/create-a-chat-completion.md
    return { ...policy, levels: policy.levels.filter((level) => level !== "max") };
  }
  // APIMart and native DeepSeek need independent provider-specific contracts.
  return undefined;
}

export function assertReasoningEffort(connector: ReasoningConnector | undefined, model: string, effort: AgentReasoningEffort | undefined): void {
  if (effort === undefined) return;
  const policy = getReasoningPolicy(connector, model);
  if (!policy || !policy.levels.includes(effort)) throw new Error("当前连接和模型不支持此推理强度，请使用模型默认设置");
}


/** Route before dispatch; never use an HTTP rejection as a paid fallback probe. */
export function selectAgentProtocol(connector: ReasoningConnector, model: string, effort: AgentReasoningEffort | undefined, hasTools: boolean): AgentProtocol {
  return model.trim() === "gpt-5.6-luna" && hasTools && effort !== "none" &&
    (connector.definitionId === "openai-compatible" || connector.definitionId === "aihubmix") ? "responses" : "chat-completions";
}
