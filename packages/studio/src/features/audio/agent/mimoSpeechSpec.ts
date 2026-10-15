import * as s from "../../agent/runtime/businessSchemas";
import {mimoSpeechSettingsSchema} from "../generation/input";
import type {MimoSpeechSettings} from "../models/audio";

const fields = s.object({
    mode: s.choice(["preset", "design", "clone"]),
    instruction: s.text(8000),
    referenceMediaId: s.optional(s.id),
    optimizeTextPreview: s.optional(s.bool)
});
export const mimoSpeechSpec: s.Spec<MimoSpeechSettings> = {
    ...fields,
    schema: fields.schema.pipe(mimoSpeechSettingsSchema)
};
