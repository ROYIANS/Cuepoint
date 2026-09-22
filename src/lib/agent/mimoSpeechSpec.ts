import * as s from "./businessSchemas";
import { mimoSpeechSettingsSchema } from "@/lib/audioGeneration/input";
import type { MimoSpeechSettings } from "@/domain/audio";
const fields = s.object({ mode: s.choice(["preset", "design", "clone"]), instruction: s.text(8000), referenceMediaId: s.optional(s.id), optimizeTextPreview: s.optional(s.bool) });
export const mimoSpeechSpec: s.Spec<MimoSpeechSettings> = { ...fields, schema: fields.schema.pipe(mimoSpeechSettingsSchema) };
