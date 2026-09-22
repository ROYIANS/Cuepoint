import { z } from "zod";
import type { AudioGenerationInput } from "@/domain/audioGeneration";
import { MIMO_VOICES } from "@/lib/ai/mimoSpeech";
import type { MusicSettings } from "@/domain/music";
import { musicInputSchema, speechInputSchema, type MusicInput, type SpeechInput } from "@/lib/ai/apimartAudio";

export const mimoSpeechSettingsSchema = z.object({
  mode: z.enum(["preset", "design", "clone"]), instruction: z.string().max(20000),
  referenceMediaId: z.string().min(1).optional(), optimizeTextPreview: z.boolean().optional(),
}).strict().superRefine((value, ctx) => {
  if (value.mode === "clone" ? !value.referenceMediaId : value.referenceMediaId !== undefined) ctx.addIssue({ code: "custom", message: "克隆模式必须选择参考音频，其他模式不能携带参考音频" });
  if (value.mode !== "design" && value.optimizeTextPreview !== undefined) ctx.addIssue({ code: "custom", message: "只有音色设计支持文本优化" });
  if (value.mode === "design" && !value.instruction.trim()) ctx.addIssue({ code: "custom", message: "请描述要设计的音色" });
});
export function validateMimoSpeech(input: { text: string; voice: string; speed: number; mimo: unknown }) {
  const settings = mimoSpeechSettingsSchema.parse(input.mimo);
  if (input.speed !== 1) throw new Error("MiMo 语速请通过风格描述设置，数值语速必须为 1");
  if (!input.text.trim() && !(settings.mode === "design" && settings.optimizeTextPreview)) throw new Error("请输入配音文本");
  if (settings.mode === "preset" && !(MIMO_VOICES as readonly string[]).includes(input.voice)) throw new Error("请选择有效的 MiMo 预置音色");
  return settings;
}
export const musicSettingsSchema = z.discriminatedUnion("engine", [
  z.object({ engine: z.literal("flowmusic"), soundPrompt: z.string().max(20000), lyrics: z.string().max(20000), title: z.string().max(1000), bpm: z.string().optional(), lengthSec: z.number().int().min(1).max(240).optional(), seed: z.string().optional() }).strict(),
  z.object({ engine: z.literal("suno"), version: z.enum(["v6", "v6-wild", "v6-mini"]), custom: z.boolean(), instrumental: z.boolean(), prompt: z.string().max(10000), title: z.string().max(160), style: z.string().max(2000), negativeTags: z.string().max(2000), durationSec: z.number().int().min(10).max(360).optional() }).strict(),
]);
export const audioGenerationInputSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("speech"), text: z.string().max(8192), voice: z.string(), speed: z.number(), mimo: mimoSpeechSettingsSchema.optional(), segmentId: z.string().min(1).optional(), segmentRevision: z.number().int().min(1).optional() }).strict(),
  z.object({ kind: z.literal("music"), settings: musicSettingsSchema, draftId: z.string().min(1).optional(), draftRevision: z.number().int().min(1).optional() }).strict(),
]);
export function musicWireInput(settings: MusicSettings): MusicInput {
  const s = musicSettingsSchema.parse(settings);
  return musicInputSchema.parse(s.engine === "flowmusic" ? {
    model: "flowmusic", sound_prompt: s.soundPrompt, lyrics: s.lyrics, title: s.title,
    ...(s.bpm !== undefined ? { bpm: s.bpm } : {}), ...(s.lengthSec !== undefined ? { length: s.lengthSec } : {}), ...(s.seed !== undefined ? { seed: s.seed } : {}),
  } : {
    model: "suno", version: s.version, custom: s.custom, instrumental: s.instrumental, prompt: s.prompt,
    ...(s.custom ? { title: s.title, style: s.style, negative_tags: s.negativeTags, ...(s.durationSec !== undefined ? { duration: s.durationSec } : {}) } : {}),
  });
}
export function speechWireInput(input: Extract<AudioGenerationInput, { kind: "speech" }>): SpeechInput {
  return speechInputSchema.parse({ model: "gpt-4o-mini-tts", input: input.text, voice: input.voice, speed: input.speed, response_format: "wav" });
}
export function validateGenerationInput(raw: unknown): AudioGenerationInput {
  const input = audioGenerationInputSchema.parse(raw);
  if (input.kind === "speech") {
    if (input.mimo) validateMimoSpeech({ ...input, mimo: input.mimo }); else speechWireInput(input);
  } else musicWireInput(input.settings);
  return input;
}
