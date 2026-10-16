import {lookupModel, lookupModelByDefinition} from "../modelCatalog/store";
import type {AgentProtocol, AgentReasoningEffort} from "../../agent/models/agent";
import type {ConnectorConfig} from "./connector";

export interface ReasoningPolicy {
    levels: readonly AgentReasoningEffort[];
    source: string;
    contextWindow?: number;
}

/** Facts a caller may supply on top of the built-in sources. */
export interface ReasoningCapabilityHints {
    /** Highest priority. `false` hides the control; a list replaces every other source. */
    override?: false | readonly AgentReasoningEffort[];
    /** Facts reported by the connector's own /models response. */
    provider?: { reasoning?: boolean; levels?: readonly AgentReasoningEffort[] };
}

/** models.dev only says "reasoning: true"; without level data these are the safe common levels. */
const DEFAULT_REASONING_LEVELS: readonly AgentReasoningEffort[] = ["low", "medium", "high"];

/** Built-in per-model level sets for models with documented, narrower or wider contracts. */
const KNOWN_LEVELS: Readonly<Record<string, { levels: readonly AgentReasoningEffort[]; source: string }>> = {
    "gpt-5": {
        levels: ["minimal", "low", "medium", "high"],
        source: "https://developers.openai.com/api/docs/models/gpt-5"
    },
    "gpt-5-2025-08-07": {
        levels: ["minimal", "low", "medium", "high"],
        source: "https://developers.openai.com/api/docs/models/gpt-5"
    },
    "gpt-5.1": {
        levels: ["none", "low", "medium", "high"],
        source: "https://developers.openai.com/api/docs/models/gpt-5.1"
    },
    "gpt-5.2": {
        levels: ["none", "low", "medium", "high", "xhigh"],
        source: "https://developers.openai.com/api/docs/guides/latest-model?model=gpt-5.2"
    },
    "gpt-5.6-luna": {
        levels: ["none", "low", "medium", "high", "xhigh", "max"],
        source: "https://developers.openai.com/api/docs/models/gpt-5.6-luna"
    },
    // gpt-5-pro only accepts high; models.dev's generic default would send rejected values.
    "gpt-5-pro": {
        levels: ["high"],
        source: "https://developers.openai.com/api/docs/models/gpt-5-pro"
    },
    "o3": {
        levels: ["low", "medium", "high"],
        source: "https://developers.openai.com/api/docs/guides/latest-model?model=gpt-5.2"
    },
};

type ReasoningConnector = Pick<ConnectorConfig, "definitionId" | "baseUrl">;

export const REASONING_EFFORT_LABELS: Record<AgentReasoningEffort, string> = {
    none: "关闭", minimal: "最低", low: "低", medium: "中", high: "高", xhigh: "极高", max: "最高",
};

const EFFORT_ORDER: readonly AgentReasoningEffort[] = ["none", "minimal", "low", "medium", "high", "xhigh", "max"];

function sorted(levels: readonly AgentReasoningEffort[]): AgentReasoningEffort[] {
    return EFFORT_ORDER.filter((level) => levels.includes(level));
}

/** Level set the connector's request adapter can put on the wire. Undefined: no reasoning adapter. */
function adapterLevels(connector: ReasoningConnector): readonly AgentReasoningEffort[] | undefined {
    // The generic connector explicitly uses the OpenAI Chat Completions contract.
    // It may be a user-configured proxy; this table is not a provider availability probe.
    if (connector.definitionId === "openai-compatible") return EFFORT_ORDER;
    // Its current Chat Completions schema only documents values through xhigh.
    // https://docs.aihubmix.com/cn/api-reference/openai-compatible/create-a-chat-completion.md
    if (connector.definitionId === "aihubmix") return EFFORT_ORDER.filter((level) => level !== "max");
    // APIMart and native DeepSeek need independent provider-specific contracts.
    return undefined;
}

function pickLevels(connector: ReasoningConnector, id: string, hints: ReasoningCapabilityHints): { levels: readonly AgentReasoningEffort[]; source: string } | undefined {
    if (hints.override === false) return undefined;
    if (hints.override) return {levels: hints.override, source: "user"};
    if (hints.provider?.levels?.length) return {levels: hints.provider.levels, source: "provider"};
    if (hints.provider?.reasoning === false) return undefined;
    const known = Object.hasOwn(KNOWN_LEVELS, id) ? KNOWN_LEVELS[id] : undefined;
    if (known) return known;
    if (hints.provider?.reasoning === true) return {levels: DEFAULT_REASONING_LEVELS, source: "provider"};
    return lookupModel(connector, id)?.entry.reasoning === true ? {levels: DEFAULT_REASONING_LEVELS, source: "models.dev"} : undefined;
}

/**
 * Which reasoning levels the model offers on this connector.
 * Precedence: user override, provider /models facts, built-in per-model table (exact levels),
 * models.dev `reasoning: true` (default levels). Every source is clipped to the adapter's wire levels.
 */
export function reasoningCapability(connector: ReasoningConnector | undefined, model: string, hints: ReasoningCapabilityHints = {}): ReasoningPolicy | undefined {
    if (!connector) return undefined;
    const allowed = adapterLevels(connector);
    if (!allowed) return undefined;
    const id = model.trim();
    if (!id) return undefined;
    const picked = pickLevels(connector, id, hints);
    if (!picked) return undefined;
    const {levels, source} = picked;
    const usable = sorted(levels.filter((level) => allowed.includes(level)));
    if (usable.length === 0) return undefined;
    return {levels: usable, source, contextWindow: lookupModelByDefinition(connector.definitionId, id)?.entry.context};
}

export function getReasoningPolicy(connector: ReasoningConnector | undefined, model: string, hints?: ReasoningCapabilityHints): ReasoningPolicy | undefined {
    return reasoningCapability(connector, model, hints);
}

export function assertReasoningEffort(connector: ReasoningConnector | undefined, model: string, effort: AgentReasoningEffort | undefined, hints?: ReasoningCapabilityHints): void {
    if (effort === undefined) return;
    const policy = getReasoningPolicy(connector, model, hints);
    if (!policy || !policy.levels.includes(effort)) throw new Error("当前连接和模型不支持此推理强度，请使用模型默认设置");
}


/** Route before dispatch; never use an HTTP rejection as a paid fallback probe. */
export function selectAgentProtocol(connector: ReasoningConnector, model: string, effort: AgentReasoningEffort | undefined, hasTools: boolean): AgentProtocol {
    return model.trim() === "gpt-5.6-luna" && hasTools && effort !== "none" &&
    (connector.definitionId === "openai-compatible" || connector.definitionId === "aihubmix") ? "responses" : "chat-completions";
}
