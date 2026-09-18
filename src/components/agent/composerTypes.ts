import type { ChatModelMetadata } from "@/lib/ai/modelMetadata";
import type { AgentInteractionMode, AgentReasoningEffort } from "@/domain/agent";
import type { ReactNode } from "react";
import type { ConnectorConfig, Id } from "@/domain/types";
import type { ChatModelPolicy } from "@/lib/ai/chatModelPolicy";

export type ChatSurfaceMode = "agent" | "task";
export type { AgentInteractionMode } from "@/domain/agent";

export type ComposerProps = {
  value: string;
  sending: boolean;
  blocked?: boolean;
  connectors: ConnectorConfig[];
  selectedConnectorId?: Id;
  model: string;
  reasoningEffort?: AgentReasoningEffort;
  onReasoningEffortChange: (value: AgentReasoningEffort | undefined) => void;
  modelMetadata?: Record<string, ChatModelMetadata>;
  modelOptions: Array<{ label: string; value: string }>;
  probingModels: boolean;
  modelPolicy: ChatModelPolicy;
  modelWarning?: string;
  chatMode: ChatSurfaceMode;
  interactionMode: AgentInteractionMode;
  onChange: (value: string) => void;
  onSend: () => void;
  onStop: () => void;
  onConnectorChange: (id: string) => void;
  onModelChange: (model: string) => void;
  onChatModeChange: (mode: ChatSurfaceMode) => void;
  onInteractionModeChange: (mode: AgentInteractionMode) => void;
  large?: boolean;
  contextUsage?: ReactNode;
  status?: ReactNode;
};
