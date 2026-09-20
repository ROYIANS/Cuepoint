/** Verified APIMart standard-channel profiles, independent of connector credentials. */
export const OUTPUT_PROFILE_VERSION = "2026-09-18";
export const IMAGE_RATIOS = ["1:1", "3:2", "2:3", "4:3", "3:4", "5:4", "4:5", "16:9", "9:16", "2:1", "1:2", "3:1", "1:3", "21:9", "9:21"] as const;
export const IMAGE_EXT_RATIOS = ["1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3", "5:4", "4:5", "21:9"] as const;
export const VIDEO_RATIOS = ["21:9", "16:9", "4:3", "1:1", "3:4", "9:16"] as const;
export const IMAGE_RESOLUTIONS = ["1k", "2k", "4k"] as const;
export const IMAGE_QUALITIES = ["low", "medium", "high", "xhigh", "max", "auto"] as const;
export const IMAGE_EXT_VERSIONS = ["flare", "sunburst"] as const;
export const VIDEO_RESOLUTIONS = ["768P", "2K"] as const;
export const APIMART_IMAGE_MODELS = ["gpt-image-2", "gpt-image-2.5-flare", "gpt-image-2.5-sunburst", "gpt-image-2.5-ext"] as const;
export type ApimartImageModel = typeof APIMART_IMAGE_MODELS[number];

export function isApimartImageModel(model: string): model is ApimartImageModel {
  return (APIMART_IMAGE_MODELS as readonly string[]).includes(model);
}
export function isApimartImage25(model: string): boolean {
  return model === "gpt-image-2.5-flare" || model === "gpt-image-2.5-sunburst";
}
export function isApimartImageExt(model: string): boolean {
  return model === "gpt-image-2.5-ext";
}
export function apimartImageSizes(model: string): readonly string[] {
  return isApimartImageExt(model) ? IMAGE_EXT_RATIOS : IMAGE_RATIOS;
}

// Strings deliberately retain unknown/older profiles for review after import.
export interface ImageGenerationDefaults {
  provider: string;
  model: string;
  profileVersion: string;
  size: string;
  resolution: string;
  quality?: string;
  version?: string;
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

export function defaultImageGeneration(ratio = "16:9", model: ApimartImageModel = "gpt-image-2"): ImageGenerationDefaults {
  const sizes = apimartImageSizes(model);
  return {
    provider: "apimart", model, profileVersion: OUTPUT_PROFILE_VERSION,
    size: (sizes as readonly string[]).includes(ratio) ? ratio : "16:9", resolution: "1k",
    ...(isApimartImage25(model) ? { quality: "auto" } : {}),
    ...(isApimartImageExt(model) ? { version: "flare" } : {}),
  };
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
function optionalText(raw: Record<string, unknown>, key: string): string | undefined {
  return raw[key] === undefined ? undefined : textField(raw, key);
}
function extras(raw: Record<string, unknown>, known: string[]): Record<string, unknown> | undefined {
  const result = { ...(raw.extra === undefined ? {} : record(raw.extra, "扩展配置")) };
  for (const [key, value] of Object.entries(raw)) {
    if (key !== "extra" && !known.includes(key)) result[key] = value;
  }
  return Object.keys(result).length ? result : undefined;
}

const IMAGE_KNOWN = ["provider", "model", "profileVersion", "size", "resolution", "quality", "version"];

/** Shape validation only: unknown models/unsupported values survive ZIP round trips. */
export function parseGenerationDefaults(raw: unknown): ProjectGenerationDefaults | undefined {
  if (raw === undefined) return undefined;
  const root = record(raw, "生成默认值");
  const parsed: ProjectGenerationDefaults = { extra: extras(root, ["image", "video"]) };
  if (root.image !== undefined) {
    const image = record(root.image, "图片默认值");
    const quality = optionalText(image, "quality");
    const version = optionalText(image, "version");
    parsed.image = {
      provider: textField(image, "provider"), model: textField(image, "model"),
      profileVersion: textField(image, "profileVersion"), size: textField(image, "size"),
      resolution: textField(image, "resolution"), extra: extras(image, IMAGE_KNOWN),
      ...(quality !== undefined ? { quality } : {}),
      ...(version !== undefined ? { version } : {}),
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
    if (image.provider !== "apimart" || !isApimartImageModel(image.model) || image.profileVersion !== OUTPUT_PROFILE_VERSION) {
      issues.push("图片配置版本或模型尚不支持，请明确选择已验证的 APIMart 图片模型或清除配置");
    } else {
      if (![...apimartImageSizes(image.model), "auto"].includes(image.size)) {
        issues.push(isApimartImageExt(image.model) ? "请选择 GPT Image 2.5 Ext 支持的图片比例" : "请选择 GPT Image 2 支持的图片比例");
      }
      if (!(IMAGE_RESOLUTIONS as readonly string[]).includes(image.resolution)) issues.push("图片清晰度须为 1k、2k 或 4k");
      if (isApimartImage25(image.model)) {
        if (image.quality !== undefined && !(IMAGE_QUALITIES as readonly string[]).includes(image.quality)) issues.push("请选择 GPT Image 2.5 支持的画质");
        if (image.version !== undefined) issues.push("标准 GPT Image 2.5 不使用 Ext 版本参数");
      } else if (isApimartImageExt(image.model)) {
        if (image.quality !== undefined) issues.push("GPT Image 2.5 Ext 不支持画质参数");
        if (image.version !== undefined && !(IMAGE_EXT_VERSIONS as readonly string[]).includes(image.version)) issues.push("请选择 Ext 版本 flare 或 sunburst");
      } else {
        if (image.quality !== undefined) issues.push("GPT Image 2 不支持画质参数");
        if (image.version !== undefined) issues.push("GPT Image 2 不使用 Ext 版本参数");
      }
    }
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
    return {
      model: config.image.model, size: config.image.size, resolution: config.image.resolution, n: 1,
      ...(config.image.quality ? { quality: config.image.quality } : {}),
      ...(config.image.version ? { version: config.image.version } : {}),
    };
  }
  if (kind === "video" && config.video) {
    const video = config.video;
    return { model: video.model, resolution: video.resolution, duration: video.duration,
      ...(video.mode === "frames" ? {} : { aspect_ratio: video.aspectRatio }) };
  }
  throw new Error("尚未配置此类生成默认值");
}
