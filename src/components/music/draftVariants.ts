import { defaultMusicSettings, type MusicSettings } from "@/domain/music";

export type MusicVariant = "suno-simple" | "suno-custom" | "flowmusic";
export function musicVariant(settings: MusicSettings): MusicVariant {
  return settings.engine === "flowmusic" ? "flowmusic" : settings.custom ? "suno-custom" : "suno-simple";
}
/** A description is never lyrics. Inactive variants remain separate durable drafts. */
export function newVariantSettings(current: MusicSettings, target: MusicVariant): MusicSettings {
  if (target === musicVariant(current)) return structuredClone(current);
  if (target === "flowmusic") return { ...defaultMusicSettings("flowmusic"), title: current.title };
  const defaults = defaultMusicSettings("suno");
  if (defaults.engine !== "suno") throw new Error("Suno defaults unavailable");
  return {
    ...(current.engine === "suno" ? current : defaults),
    title: current.title,
    custom: target === "suno-custom",
    prompt: "",
  };
}
export type VariantLinks = Record<string, Partial<Record<MusicVariant, string>>>;
export function parseVariantLinks(raw: string | null): VariantLinks {
  try {
    const value: unknown = JSON.parse(raw ?? "{}");
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    const result: VariantLinks = {};
    for (const [id, group] of Object.entries(value)) {
      if (!id.startsWith("mdr_") || !group || typeof group !== "object" || Array.isArray(group)) continue;
      const links: Partial<Record<MusicVariant, string>> = {};
      for (const key of ["suno-simple", "suno-custom", "flowmusic"] as const) {
        const target: unknown = (group as Record<string, unknown>)[key];
        if (typeof target === "string" && target.startsWith("mdr_")) links[key] = target;
      }
      result[id] = links;
    }
    return result;
  } catch { return {}; }
}
export function linkMusicVariants(links: VariantLinks, source: { id: string; settings: MusicSettings }, target: { id: string; settings: MusicSettings }): VariantLinks {
  const group = { ...links[source.id], [musicVariant(source.settings)]: source.id, [musicVariant(target.settings)]: target.id };
  const next = { ...links };
  for (const id of Object.values(group)) next[id] = group;
  return next;
}
