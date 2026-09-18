import type { ConnectorDefinitionId, ConnectorProtocol } from "@/domain/types";

export type ConnectorDefinition = {
  id: ConnectorDefinitionId;
  title: string;
  blurb: string;
  protocol: ConnectorProtocol;
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
    defaultBaseUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-4o-mini",
    mark: "OA",
  },
  {
    id: "deepseek",
    title: "DeepSeek",
    blurb: "DeepSeek OpenAI 兼容接口，安装后填写 API Key 即可",
    protocol: "openai-compatible",
    defaultBaseUrl: "https://api.deepseek.com/v1",
    defaultModel: "deepseek-chat",
    mark: "DS",
  },
] as const;

export function getConnectorDefinition(
  id: ConnectorDefinitionId,
): ConnectorDefinition | undefined {
  return CONNECTOR_CATALOG.find((item) => item.id === id);
}
