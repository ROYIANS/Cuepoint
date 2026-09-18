import type { ConnectorConfig, Id } from "@/domain/types";
import type { ChatModelPolicy } from "@/lib/ai/chatModelPolicy";

export type ChatSurfaceMode = "agent" | "task";

export type ComposerProps = {
  value: string;
  sending: boolean;
  connectors: ConnectorConfig[];
  selectedConnectorId?: Id;
  model: string;
  modelOptions: Array<{ label: string; value: string }>;
  probingModels: boolean;
  modelPolicy: ChatModelPolicy;
  modelWarning?: string;
  chatMode: ChatSurfaceMode;
  onChange: (value: string) => void;
  onSend: () => void;
  onStop: () => void;
  onConnectorChange: (id: string) => void;
  onModelChange: (model: string) => void;
  onChatModeChange: (mode: ChatSurfaceMode) => void;
  large?: boolean;
};
