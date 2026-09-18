/** Verified APIMart standard-channel profiles, independent of connector credentials. */
export const OUTPUT_PROFILE_VERSION = "2026-09-18";
export const IMAGE_RATIOS = ["1:1", "3:2", "2:3", "4:3", "3:4", "5:4", "4:5", "16:9", "9:16", "2:1", "1:2", "3:1", "1:3", "21:9", "9:21"] as const;
export const VIDEO_RATIOS = ["21:9", "16:9", "4:3", "1:1", "3:4", "9:16"] as const;
export const IMAGE_RESOLUTIONS = ["1k", "2k", "4k"] as const;
export const VIDEO_RESOLUTIONS = ["768P", "2K"] as const;

// Strings deliberately retain unknown/older profiles for review after import.
export interface ImageGenerationDefaults {
  provider: string;
  model: string;
  profileVersion: string;
  size: string;
  resolution: string;
  extra?: Record<string, unknown>;
}
export interface VideoGenerationDefaults {
  provider: string;
  model: string;
  profileVersion: string;
  mode: string;
  aspectRatio: string;
  resolution: string;
  duration: number;
  extra?: Record<string, unknown>;
}
export interface ProjectGenerationDefaults {
  image?: ImageGenerationDefaults;
  video?: VideoGenerationDefaults;
  extra?: Record<string, unknown>;
}

export function defaultImageGeneration(ratio = "16:9"): ImageGenerationDefaults {
  return { provider: "apimart", model: "gpt-image-2", profileVersion: OUTPUT_PROFILE_VERSION,
    size: IMAGE_RATIOS.includes(ratio as typeof IMAGE_RATIOS[number]) ? ratio : "16:9", resolution: "1k" };
}
export function defaultVideoGeneration(ratio = "16:9"): VideoGenerationDefaults {
  return { provider: "apimart", model: "MiniMax-H3", profileVersion: OUTPUT_PROFILE_VERSION,
    mode: "text", aspectRatio: VIDEO_RATIOS.includes(ratio as typeof VIDEO_RATIOS[number]) ? ratio : "16:9", resolution: "2K", duration: 5 };
}

function record(raw: unknown, label: string): Record<string, unknown> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error(`${label}格式无效`);
  return raw as Record<string, unknown>;
}
function textField(raw: Record<string, unknown>, key: string): string {
  if (typeof raw[key] !== "string") throw new Error(`生成配置 ${key} 必须是文本`);
  return raw[key];
}
function extras(raw: Record<string, unknown>, known: string[]): Record<string, unknown> | undefined {
  const result = { ...(raw.extra === undefined ? {} : record(raw.extra, "扩展配置")) };
  for (const [key, value] of Object.entries(raw)) {
    if (key !== "extra" && !known.includes(key)) result[key] = value;
  }
  return Object.keys(result).length ? result : undefined;
}

/** Shape validation only: unknown models/unsupported values survive ZIP round trips. */
export function parseGenerationDefaults(raw: unknown): ProjectGenerationDefaults | undefined {
  if (raw === undefined) return undefined;
  const root = record(raw, "生成默认值");
  const parsed: ProjectGenerationDefaults = { extra: extras(root, ["image", "video"]) };
  if (root.image !== undefined) {
    const image = record(root.image, "图片默认值");
    parsed.image = {
      provider: textField(image, "provider"), model: textField(image, "model"),
      profileVersion: textField(image, "profileVersion"), size: textField(image, "size"),
      resolution: textField(image, "resolution"), extra: extras(image, ["provider", "model", "profileVersion", "size", "resolution"]),
    };
  }
  if (root.video !== undefined) {
    const video = record(root.video, "视频默认值");
    if (typeof video.duration !== "number" || !Number.isFinite(video.duration)) throw new Error("视频时长必须是有限数值");
    parsed.video = {
      provider: textField(video, "provider"), model: textField(video, "model"),
      profileVersion: textField(video, "profileVersion"), mode: textField(video, "mode"),
      aspectRatio: textField(video, "aspectRatio"), resolution: textField(video, "resolution"), duration: video.duration,
      extra: extras(video, ["provider", "model", "profileVersion", "mode", "aspectRatio", "resolution", "duration"]),
    };
  }
  return parsed;
}

export function validateGenerationDefaults(raw: unknown): string[] {
  let config: ProjectGenerationDefaults | undefined;
  try { config = parseGenerationDefaults(raw); }
  catch (error) { return [error instanceof Error ? error.message : "生成默认值格式无效"]; }
  const issues: string[] = [];
  if (config?.image) {
    const image = config.image;
    if (image.provider !== "apimart" || image.model !== "gpt-image-2" || image.profileVersion !== OUTPUT_PROFILE_VERSION) {
      issues.push("图片配置版本或模型尚不支持，请明确选择 GPT Image 2 标准通道或清除配置");
    }
    if (![...IMAGE_RATIOS, "auto"].includes(image.size)) issues.push("请选择 GPT Image 2 支持的图片比例");
    if (!(IMAGE_RESOLUTIONS as readonly string[]).includes(image.resolution)) issues.push("图片清晰度须为 1k、2k 或 4k");
  }
  if (config?.video) {
    const video = config.video;
    if (video.provider !== "apimart" || video.model !== "MiniMax-H3" || video.profileVersion !== OUTPUT_PROFILE_VERSION) {
      issues.push("视频配置版本或模型尚不支持，请明确选择 MiniMax H3 或清除配置");
    }
    if (!(VIDEO_RESOLUTIONS as readonly string[]).includes(video.resolution)) issues.push("MiniMax H3 分辨率须为 768P 或 2K");
    if (!Number.isInteger(video.duration) || video.duration < 4 || video.duration > 15) issues.push("MiniMax H3 时长须为 4–15 秒整数");
    if (video.mode === "frames") {
      if (video.aspectRatio !== "adaptive") issues.push("首尾帧生视频的比例由输入图片决定，请选择跟随输入图片");
    } else if (video.mode === "text" || video.mode === "reference") {
      if (!(VIDEO_RATIOS as readonly string[]).includes(video.aspectRatio) && !(video.mode === "reference" && video.aspectRatio === "adaptive")) {
        issues.push("请选择当前视频方式支持的比例");
      }
    } else issues.push("请选择文字、首尾帧或参考素材生视频方式");
  }
  return issues;
}

/** Common native parameters only; prompt/media-role preflight belongs to generation. */
export function generationParameters(config: ProjectGenerationDefaults, kind: "image" | "video"): Record<string, string | number> {
  const selected = kind === "image" ? { image: config.image } : { video: config.video };
  const errors = validateGenerationDefaults(selected);
  if (errors.length) throw new Error(errors.join("；"));
  if (kind === "image" && config.image) {
    return { model: config.image.model, size: config.image.size, resolution: config.image.resolution, n: 1 };
  }
  if (kind === "video" && config.video) {
    const video = config.video;
    return { model: video.model, resolution: video.resolution, duration: video.duration,
      ...(video.mode === "frames" ? {} : { aspect_ratio: video.aspectRatio }) };
  }
  throw new Error("尚未配置此类生成默认值");
}
