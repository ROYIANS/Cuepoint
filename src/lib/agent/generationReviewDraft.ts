import type { GenerationSelection } from "@/domain/generationPreferences";
import { generationSubmitSchema, type GenerationSubmitArgs } from "./generationProfiles";

/** Apply an explicit selection without changing the proposal's target or input roles. */
export function applyGenerationSelection(
  draft: GenerationSubmitArgs,
  selection: GenerationSelection,
  provider: "apimart" | "aihubmix",
): GenerationSubmitArgs {
  const parameters = { ...selection.parameters };
  if (draft.target.kind === "shot" && draft.target.slot === "clip") {
    const frames = draft.inputs.some((input) => input.role === "first-frame" || input.role === "last-frame");
    parameters.mode = frames ? "frames" : draft.inputs.length ? "reference" : "text";
    if (provider === "apimart" && frames) delete parameters.aspectRatio;
  }
  // Parse only the shape here. Profile validation must explain incompatible choices
  // rather than silently changing resolution, duration or other selected values.
  const { prompt, ...context } = draft;
  const next = generationSubmitSchema.omit({ prompt: true }).parse({ ...context, connectorId: selection.connectorId, model: selection.model, parameters });
  // A user may change models while editing an empty/whitespace prompt. Preserve
  // that draft verbatim; the form's confirmation validation handles completeness.
  return { ...next, prompt };
}
