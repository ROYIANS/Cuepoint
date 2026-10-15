import type {Id} from "../../../platform/identity";
import type {CharacterImageSlot} from "./slots";
import type {GenerationSlot} from "./slots";
import type {SceneImageSlot} from "./slots";
import type {PropImageSlot} from "./slots";
import type {StyleImageSlot} from "./slots";

export interface Character {
    personality?: string;
    motivation?: string;
    voice?: string;
    id: Id;
    projectId: Id;
    name: string;
    bio: string;
    appearance: string;
    notes: string;
    slots: Partial<Record<CharacterImageSlot, GenerationSlot>>;
    createdAt: string;
    updatedAt: string;
    extra?: Record<string, unknown>;
}

export interface Scene {
    geography?: string;
    lighting?: string;
    id: Id;
    projectId: Id;
    name: string;
    location: string;
    timeOfDay: string;
    atmosphere: string;
    notes: string;
    slots: Partial<Record<SceneImageSlot, GenerationSlot>>;
    createdAt: string;
    updatedAt: string;
    extra?: Record<string, unknown>;
}

export interface Prop {
    appearance?: string;
    material?: string;
    size?: string;
    usage?: string;
    continuity?: string;
    id: Id;
    projectId: Id;
    name: string;
    kind: string;
    notes: string;
    slots: Partial<Record<PropImageSlot, GenerationSlot>>;
    createdAt: string;
    updatedAt: string;
    extra?: Record<string, unknown>;
}

export interface VisualStyle {
    palette?: string;
    lighting?: string;
    lens?: string;
    composition?: string;
    negativePrompt?: string;
    id: Id;
    projectId: Id;
    name: string;
    notes: string;
    slots: Partial<Record<StyleImageSlot, GenerationSlot>>;
    createdAt: string;
    updatedAt: string;
    extra?: Record<string, unknown>;
}
