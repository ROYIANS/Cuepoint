import { collectModelMetadata, type ChatModelMetadata } from "@/lib/ai/modelMetadata";
import type { ConnectorConfig } from "@/domain/types";
import { listApimartModels, testApimartConnection } from "@/lib/ai/apimart";
import { listAIHubMixModels, testAIHubMixConnection } from "@/lib/ai/aihubmix";
import { getConnectorDefinition } from "@/lib/ai/catalog";
import { chatModelIssue, requiresChatModelVerification, type ChatModelConnector } from "@/lib/ai/chatModelPolicy";
import {
  listModels,
  testConnection,
  type ListModelsResult,
  type TestConnectionResult,
} from "@/lib/ai/openaiCompatible";

type ConnectorAccess = Pick<ConnectorConfig, "definitionId" | "baseUrl" | "apiKey">;

export type ChatModelDiscoveryResult =
  | { ok: true; models: string[]; incompatibleModels: string[]; metadata?: Record<string, ChatModelMetadata> }
  | { ok: false; message: string };

/** Keep media restrictions beside suggestions so manual/saved options cannot reinsert them. */
export async function discoverConnectorChatModels(
  connector: ConnectorAccess,
  options: { fetchImpl?: typeof fetch; signal?: AbortSignal } = {},
): Promise<ChatModelDiscoveryResult> {
  if (connector.definitionId === "aihubmix") {
    const result = await listAIHubMixModels(connector, options);
    if (!result.ok) return result;
    const incompatibleModels = new Set<string>();
    const suggestions = new Set<string>();
    const uncertainModels = new Set<string>();
    for (const model of result.models) {
      const incompatible = model.types.some((type) => [
        "image_generation", "video", "tts", "stt", "embedding", "rerank", "ocr", "search", "3d",
      ].includes(type)) || model.outputModalities.some((type) => ["image", "audio", "video"].includes(type)) ||
        (model.endpoints.length > 0 && !model.endpoints.includes("chat_completions"));
      if (incompatible) incompatibleModels.add(model.id);
      else if (model.metadataStatus === "available" && model.types.includes("llm") &&
        (model.outputModalities.length === 0 || model.outputModalities.includes("text"))) suggestions.add(model.id);
      else uncertainModels.add(model.id);
    }
    return {
      ok: true,
      models: [...suggestions].filter((id) => !incompatibleModels.has(id) && !uncertainModels.has(id)).sort((a, b) => a.localeCompare(b)),
      incompatibleModels: [...incompatibleModels],
      ...(result.models.some((m) => m.metadata) ? { metadata: collectModelMetadata(result.models.flatMap((m) => m.metadata ? [[m.id, m.metadata]] : [])) } : {}),
    };
  }
  if (connector.definitionId !== "apimart") {
    const result = await listModels(connector, options.fetchImpl);
    return result.ok ? { ...result, incompatibleModels: [] } : result;
  }
  const result = await listApimartModels(connector, { expand: "category" }, options);
  if (!result.ok) return result;
  const incompatibleModels = [...new Set(result.models
    .filter((model) => ["image", "video", "audio"].includes(model.category))
    .map((model) => model.id))];
  return {
    ok: true,
    models: [...new Set(result.models.filter((model) => model.category === "chat")
      .map((model) => model.id))].filter((id) => !incompatibleModels.includes(id)).sort((a, b) => a.localeCompare(b)),
    incompatibleModels,
    ...(result.models.some((m) => m.metadata) ? { metadata: collectModelMetadata(result.models.flatMap((m) => m.metadata ? [[m.id, m.metadata]] : [])) } : {}),
  };
}

/** Run all chat mutations/transport only after validating the captured connector and model. */
export async function runWithCompatibleChatModel<T>(
  connector: ChatModelConnector,
  model: string,
  action: () => Promise<T>,
  options: { fetchImpl?: typeof fetch; signal?: AbortSignal; isCurrent?: () => boolean } = {},
): Promise<{ ok: true; value: T } | { ok: false; message: string; aborted?: boolean }> {
  if (!model.trim()) return { ok: false, message: "请选择或填写模型" };
  if (!connector.baseUrl.trim() || !connector.apiKey.trim()) return { ok: false, message: "请先完善连接的 Base URL 和 API Key" };
  const stale = () => options.signal?.aborted || options.isCurrent?.() === false;
  if (stale()) return { ok: false, message: "模型或连接已变更，请重新发送", aborted: true };
  if (requiresChatModelVerification(connector)) {
    const result = await discoverConnectorChatModels(connector, options);
    if (stale()) return { ok: false, message: "模型或连接已变更，请重新发送", aborted: true };
    if (!result.ok) return { ok: false, message: `无法确认 ${getConnectorDefinition(connector.definitionId)?.title ?? "当前连接"} 模型兼容性：${result.message}。请重试。` };
    const issue = chatModelIssue(model, { verified: true, incompatibleModels: result.incompatibleModels });
    if (issue) return { ok: false, message: issue };
  }
  return { ok: true, value: await action() };
}

/** Provider-specific discovery; unknown classifications are manual-entry only in chat. */
export async function listConnectorModels(
  connector: ConnectorAccess,
  usage: "all" | "chat" = "all",
  fetchImpl: typeof fetch = fetch,
): Promise<ListModelsResult> {
  if (usage === "chat") {
    const result = await discoverConnectorChatModels(connector, { fetchImpl });
    return result.ok ? { ok: true, models: result.models } : result;
  }
  if (connector.definitionId === "aihubmix") {
    const result = await listAIHubMixModels(connector, { fetchImpl });
    return result.ok ? { ok: true, models: [...new Set(result.models.map((model) => model.id))].sort((a, b) => a.localeCompare(b)) } : result;
  }
  if (connector.definitionId !== "apimart") return listModels(connector, fetchImpl);
  const result = await listApimartModels(connector, { expand: "category" }, { fetchImpl });
  if (!result.ok) return result;
  return {
    ok: true,
    models: [...new Set(result.models
      .map((model) => model.id))].sort((a, b) => a.localeCompare(b)),
  };
}

export type ConnectorTestResult = TestConnectionResult | { ok: true; via: "authenticated-read" };

/** Dedicated media providers never fall back to a paid POST for connection testing. */
export async function testConnectorConnection(
  connector: ConnectorAccess,
  fetchImpl: typeof fetch = fetch,
): Promise<ConnectorTestResult> {
  if (connector.definitionId === "aihubmix") {
    const result = await testAIHubMixConnection(connector, { fetchImpl });
    return result.ok ? { ok: true, via: "authenticated-read" } : result;
  }
  if (connector.definitionId === "apimart") {
    const result = await testApimartConnection(connector, { fetchImpl });
    return result.ok ? { ok: true, via: "models", modelCount: result.modelCount } : result;
  }
  return testConnection({
    ...connector,
    defaultModel: getConnectorDefinition(connector.definitionId)?.defaultModel,
  }, fetchImpl);
}
