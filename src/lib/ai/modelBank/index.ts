import lookup from "./lookup.generated.json";
import manifest from "../../../../vendor/lobehub/manifest.json";

export const MODEL_BANK_REVISION = manifest.revision;
export const MODEL_BANK_COPIED_AT = manifest.copiedAt;

type LimitRecord = { id: string; contextWindowTokens?: number; maxOutput?: number };
const providers: Readonly<Record<string, readonly LimitRecord[]>> = lookup.providers;
const sources: Readonly<Record<string, string>> = lookup.sources;
const byProvider = new Map(Object.entries(providers).map(([provider, models]) => [provider, new Map(models.map((model) => [model.id, model]))]));
// Prefer an exact ID in an original model vendor's catalog over gateway copies.
// Provider identity is explicit; never infer model aliases from string prefixes.
const originalVendors = new Set(["openai", "anthropic", "google", "deepseek", "qwen", "moonshot", "minimax", "xai", "meta", "mistral", "cohere", "ai21", "baichuan", "hunyuan", "internlm", "jina", "longcat", "sensenova", "spark", "stepfun", "wenxin", "xiaomimimo", "zeroone", "zhipu", "bfl"]);

export interface ModelBankEntry {
  contextWindow?: number;
  maxOutputTokens?: number;
  providerId: string;
  sourceUrl: string;
}

function limitsMatch(models: readonly { model: LimitRecord }[]) {
  return models.every(({ model }) => model.contextWindowTokens === models[0].model.contextWindowTokens && model.maxOutput === models[0].model.maxOutput);
}

/** Exact provider+ID first; never silently merge conflicting gateway capacities. */
export function getModelBankEntry(model: string, providerId?: string): ModelBankEntry | undefined {
  const id = model.trim();
  const direct = providerId ? byProvider.get(providerId)?.get(id) : undefined;
  let selected = direct && providerId ? { provider: providerId, model: direct } : undefined;
  if (!selected) {
    const candidates = [...byProvider].flatMap(([provider, models]) => {
      const found = models.get(id);
      return found ? [{ provider, model: found }] : [];
    });
    const originals = candidates.filter(({ provider }) => originalVendors.has(provider));
    const available = originals.length ? originals : candidates;
    if (!available.length || !limitsMatch(available)) return undefined;
    selected = available[0];
  }
  return {
    contextWindow: selected.model.contextWindowTokens,
    maxOutputTokens: selected.model.maxOutput,
    providerId: selected.provider,
    sourceUrl: `${manifest.repository}/blob/${manifest.revision}/${sources[selected.provider]}`,
  };
}

export type ModelBankValue = string | number | boolean | null | ModelBankValue[] | { [key: string]: ModelBankValue | undefined };
export type ModelBankModel = { id: string; [key: string]: ModelBankValue | undefined };
export type ModelBankDataset = Record<string, ModelBankModel[]>;

/** All raw fields, all provider records; lazy so the composer loads only the limit index. */
export async function loadModelBank(): Promise<ModelBankDataset> {
  const data = await import("./models.generated.json");
  return data.default as ModelBankDataset;
}

/** Derive capabilities from the verified full snapshot, never from model name heuristics. */
export async function getModelBankVision(model: string, providerId?: string) {
  const data = await loadModelBank();
  const direct = providerId ? data[providerId]?.find((row) => row.id === model.trim()) : undefined;
  let candidates = direct && providerId ? [{ provider: providerId, model: direct }] : Object.entries(data).flatMap(([provider, rows]) => rows.filter((row) => row.id === model.trim()).map((model) => ({ provider, model })));
  if (!direct && candidates.some(({ provider }) => originalVendors.has(provider))) candidates = candidates.filter(({ provider }) => originalVendors.has(provider));
  const values = candidates.map(({ model }) => {
    const abilities = model.abilities;
    return abilities && typeof abilities === "object" && !Array.isArray(abilities) ? abilities.vision === true : undefined;
  });
  if (!values.length || values.some((value) => value === undefined || value !== values[0])) return undefined;
  return { supported: values[0] === true, source: "model-bank" as const, sourceUrl: `${manifest.repository}/blob/${manifest.revision}/${sources[candidates[0].provider]}` };
}
