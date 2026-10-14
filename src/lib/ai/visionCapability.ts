import type {AgentVisionCapability} from "@/domain/referenceInput";
import type {ChatModelMetadata} from "./modelMetadata";
import {lookupModelByDefinition} from "./modelCatalog/store";
import {MODELS_DEV_URL} from "./modelCatalog/types";

// Async by contract (callers await it) although the catalog read is synchronous.
export function resolveVisionCapability(model: string, providerId?: string, metadata?: ChatModelMetadata): Promise<AgentVisionCapability> {
    if (metadata?.vision !== undefined) return Promise.resolve({supported: metadata.vision, source: "provider"});
    // Memory-only lookup (no dynamic import), so this is also safe inside a database transaction.
    const imageInput = lookupModelByDefinition(providerId, model)?.entry.imageInput;
    return Promise.resolve(imageInput === undefined ? {supported: false, source: "unknown"} : {supported: imageInput, source: "models-dev", sourceUrl: MODELS_DEV_URL});
}

export function requireVision(capability: AgentVisionCapability | undefined): void {
    if (!capability?.supported) throw new Error(capability?.source === "unknown" ? "尚未确认当前模型支持图片输入，请切换到支持视觉的模型，或移除图片后发送" : "当前模型不支持图片输入，请切换到支持视觉的模型，或移除图片后发送");
}
