import type {Id} from "../../../platform/identity";

/** Studio-global BYOK connectors (not part of project ZIP). */
export type ConnectorProtocol = "openai-compatible";

export type ConnectorDefinitionId = "openai-compatible" | "deepseek" | "apimart" | "aihubmix" | "mimo";

export interface ConnectorConfig {
    id: Id;
    definitionId: ConnectorDefinitionId;
    protocol: ConnectorProtocol;
    label?: string;
    baseUrl: string;
    apiKey: string;
    /** Optional; unused by Agent chat (model picked there). Kept for probe fallback only. */
    defaultModel?: string;
    updatedAt: string;
}
