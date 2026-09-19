import type { AgentVisionCapability } from "@/domain/referenceInput";
import type { ChatModelMetadata } from "./modelMetadata";
import { getModelBankVision } from "./modelBank";
export async function resolveVisionCapability(model: string, providerId?: string, metadata?: ChatModelMetadata): Promise<AgentVisionCapability> {
  if (metadata?.vision !== undefined) return { supported: metadata.vision, source: "provider" };
  return await getModelBankVision(model, providerId) ?? { supported: false, source: "unknown" };
}
export function requireVision(capability: AgentVisionCapability | undefined): void {
  if (!capability?.supported) throw new Error(capability?.source === "unknown" ? "尚未确认当前模型支持图片输入，请切换到支持视觉的模型，或移除图片后发送" : "当前模型不支持图片输入，请切换到支持视觉的模型，或移除图片后发送");
}
