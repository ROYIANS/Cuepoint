import type { ConnectorConfig, Id } from "@/domain/types";

export type ChatSurfaceMode = "agent" | "task";

export type ComposerProps = {
  value: string;
  sending: boolean;
  connectors: ConnectorConfig[];
  selectedConnectorId?: Id;
  model: string;
  modelOptions: Array<{ label: string; value: string }>;
  probingModels: boolean;
  chatMode: ChatSurfaceMode;
  onChange: (value: string) => void;
  onSend: () => void;
  onStop: () => void;
  onConnectorChange: (id: string) => void;
  onModelChange: (model: string) => void;
  onChatModeChange: (mode: ChatSurfaceMode) => void;
  large?: boolean;
};
