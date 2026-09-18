import type { ContextPolicy } from "@/domain/context";
import { resolveModelMetadata, type ChatModelMetadata } from "@/lib/ai/modelMetadata";

export const DEFAULT_CONTEXT_POLICY: Readonly<ContextPolicy> = { autoCompress: true, limitHistory: false, historyMessageCount: 20 };
export function normalizeContextPolicy(value?: Partial<ContextPolicy>): ContextPolicy {
  const integer = (n: unknown, min: number, max: number) => typeof n === "number" && Number.isSafeInteger(n) && n >= min && n <= max;
  return {
    autoCompress: typeof value?.autoCompress === "boolean" ? value.autoCompress : DEFAULT_CONTEXT_POLICY.autoCompress,
    limitHistory: typeof value?.limitHistory === "boolean" ? value.limitHistory : DEFAULT_CONTEXT_POLICY.limitHistory,
    historyMessageCount: integer(value?.historyMessageCount, 0, 10000) ? value!.historyMessageCount! : DEFAULT_CONTEXT_POLICY.historyMessageCount,
    ...(integer(value?.customContextTokens, 2048, 10000000) ? { customContextTokens: value!.customContextTokens } : {}),
  };
}
export function resolveContextCapacity(model: string, metadata?: ChatModelMetadata, providerId?: string, policy?: ContextPolicy) {
  const limit = resolveModelMetadata(model, metadata, providerId).contextWindow;
  const local = policy?.customContextTokens;
  if (local && (!limit || local < limit.tokens)) return { capacity: local, capacitySource: "本地预算" };
  return { capacity: limit?.tokens, capacitySource: limit ? limit.source === "provider" ? "供应商" : "Model Bank" : undefined };
}
