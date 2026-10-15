import type {Id} from "../../../platform/identity";

export type MediaKind = "image" | "video";

export interface GenerationResult {
    mediaId: Id;
    kind: MediaKind;
}

export interface GenerationSlot {
    prompt: string;
    referenceImageIds: Id[];
    referenceVideoIds: Id[];
    result?: GenerationResult;
}

export type CharacterImageSlot =
    | "front"
    | "side"
    | "back"
    | "expression"
    | "costume";

export type SceneImageSlot = "wide" | "medium" | "detail";

export type PropImageSlot = "hero" | "detail" | "worn";

export type StyleImageSlot = "look" | "light" | "lens";

export const CHARACTER_SLOTS: { id: CharacterImageSlot; label: string }[] = [
    {id: "front", label: "正面"},
    {id: "side", label: "侧面"},
    {id: "back", label: "背面"},
    {id: "expression", label: "表情"},
    {id: "costume", label: "服装"},
];

export const SCENE_SLOTS: { id: SceneImageSlot; label: string }[] = [
    {id: "wide", label: "全景"},
    {id: "medium", label: "中景"},
    {id: "detail", label: "细节"},
];

export const PROP_SLOTS: { id: PropImageSlot; label: string }[] = [
    {id: "hero", label: "主图"},
    {id: "detail", label: "细节"},
    {id: "worn", label: "使用"},
];

export const STYLE_SLOTS: { id: StyleImageSlot; label: string }[] = [
    {id: "look", label: "画面"},
    {id: "light", label: "光色"},
    {id: "lens", label: "镜头气质"},
];
