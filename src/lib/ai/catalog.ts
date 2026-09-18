import type { ConnectorDefinitionId, ConnectorProtocol } from "@/domain/types";

export type ConnectorDefinition = {
  id: ConnectorDefinitionId;
  title: string;
  blurb: string;
  protocol: ConnectorProtocol;
  capabilities: readonly ("chat" | "image" | "video")[];
  defaultBaseUrl: string;
  defaultModel: string;
  mark: string;
};

export const CONNECTOR_CATALOG: readonly ConnectorDefinition[] = [
  {
    id: "openai-compatible",
    title: "OpenAI 兼容",
    blurb: "任意兼容 /v1/chat/completions 的服务（OpenAI、代理、本地网关等）",
    protocol: "openai-compatible",
    capabilities: ["chat"],
    defaultBaseUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-4o-mini",
    mark: "OA",
  },
  {
    id: "deepseek",
    title: "DeepSeek",
    blurb: "DeepSeek OpenAI 兼容接口，安装后填写 API Key 即可",
    protocol: "openai-compatible",
    capabilities: ["chat"],
    defaultBaseUrl: "https://api.deepseek.com/v1",
    defaultModel: "deepseek-chat",
    mark: "DS",
  },
  {
    id: "apimart",
    title: "APIMart",
    blurb: "统一接入聊天、图像与视频模型；生成入口将在后续开放",
    protocol: "openai-compatible",
    capabilities: ["chat", "image", "video"],
    defaultBaseUrl: "https://api.apimart.ai/v1",
    defaultModel: "",
    mark: "AM",
  },
] as const;

export function getConnectorDefinition(
  id: ConnectorDefinitionId,
): ConnectorDefinition | undefined {
  return CONNECTOR_CATALOG.find((item) => item.id === id);
}

export function connectorDisplayName(connector: {
  definitionId: ConnectorDefinitionId;
  label?: string;
}): string {
  if (connector.label?.trim()) return connector.label.trim();
  return getConnectorDefinition(connector.definitionId)?.title ?? connector.definitionId;
}

export function connectorProviderKey(definitionId: ConnectorDefinitionId): string {
  if (definitionId === "apimart") return "apimart";
  return definitionId === "deepseek" ? "deepseek" : "openai";
}
