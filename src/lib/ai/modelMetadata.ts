import { getModelBankEntry, MODEL_BANK_COPIED_AT } from "./modelBank";

export interface ChatModelMetadata {
  contextWindow?: number;
  maxOutputTokens?: number;
  source: "provider";
}

export interface ModelLimit {
  tokens: number;
  source: "provider" | "model-bank";
  sourceUrl?: string;
  copiedAt?: string;
}

/** Resolve each field independently: a gateway may report only one limit. */
export function resolveModelMetadata(model: string, provider?: ChatModelMetadata, providerId?: string): {
  contextWindow?: ModelLimit;
  maxOutputTokens?: ModelLimit;
} {
  const reference = getModelBankEntry(model, providerId);
  const resolve = (field: "contextWindow" | "maxOutputTokens"): ModelLimit | undefined => {
    const supplied = positiveInteger(provider?.[field]);
    if (supplied) return { tokens: supplied, source: "provider" };
    const tokens = reference?.[field];
    return tokens ? {
      tokens,
      source: "model-bank",
      sourceUrl: reference.sourceUrl,
      copiedAt: MODEL_BANK_COPIED_AT,
    } : undefined;
  };
  return { contextWindow: resolve("contextWindow"), maxOutputTokens: resolve("maxOutputTokens") };
}

function positiveInteger(value: unknown): number | undefined {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : undefined;
}

/** Only explicit token limits; never infer from a model name or output limit. */
export function parseModelMetadata(value: unknown): ChatModelMetadata | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const row = value as Record<string, unknown>;
  const contextWindow = positiveInteger(row.context_length) ?? positiveInteger(row.context_window);
  const maxOutputTokens = positiveInteger(row.max_output) ?? positiveInteger(row.max_output_tokens);
  return contextWindow || maxOutputTokens ? { ...(contextWindow ? { contextWindow } : {}), ...(maxOutputTokens ? { maxOutputTokens } : {}), source: "provider" } : undefined;
}

/** Duplicate provider rows can describe routes with different limits: use the smallest. */
export function collectModelMetadata(entries: readonly (readonly [string, ChatModelMetadata])[]): Record<string, ChatModelMetadata> {
  const result: Record<string, ChatModelMetadata> = Object.create(null);
  for (const [id, metadata] of entries) {
    const previous = result[id];
    const contextWindow = previous?.contextWindow && metadata.contextWindow ? Math.min(previous.contextWindow, metadata.contextWindow) : previous?.contextWindow ?? metadata.contextWindow;
    const maxOutputTokens = previous?.maxOutputTokens && metadata.maxOutputTokens ? Math.min(previous.maxOutputTokens, metadata.maxOutputTokens) : previous?.maxOutputTokens ?? metadata.maxOutputTokens;
    result[id] = { source: "provider", ...(contextWindow ? { contextWindow } : {}), ...(maxOutputTokens ? { maxOutputTokens } : {}) };
  }
  return result;
}
