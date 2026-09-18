import type { MediaKind } from "./types";

/** Only reusable selection parameters: no prompt, target, references or credentials. */
export interface GenerationSelectionParameters {
  size?: string;
  resolution?: string;
  duration?: number;
  aspectRatio?: string;
  mode?: "text" | "frames" | "reference";
  quality?: "low" | "medium" | "high";
}
export type GenerationPreferenceParameters = Omit<GenerationSelectionParameters, "mode">;

export interface GenerationSelection {
  connectorId: string;
  model: string;
  parameters: GenerationSelectionParameters;
}
export interface GenerationPreference {
  connectorId: string;
  model: string;
  parameters: GenerationPreferenceParameters;
}
export interface GenerationPreferences {
  image?: GenerationPreference;
  video?: GenerationPreference;
}
/** Invalid saved selections are visible as issues; reads never rewrite user choices. */
export interface GenerationPreferenceState {
  preferences: GenerationPreferences;
  issues: Partial<Record<MediaKind, string[]>>;
}
