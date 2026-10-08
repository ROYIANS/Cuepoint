/** Verified APIMart standard-channel profiles, independent of connector credentials. */
export const OUTPUT_PROFILE_VERSION = "2026-09-18";
import {
    defaultImageParameters, defaultVideoParameters,
    getGenerationCapability, isApimartImageModel, validateGenerationParameters,
    type ApimartImageModel,
} from "./generationCapabilities";
export {
    IMAGE_RATIOS, IMAGE_EXT_RATIOS, VIDEO_RATIOS, IMAGE_RESOLUTIONS,
    IMAGE_QUALITIES, IMAGE_EXT_VERSIONS, VIDEO_RESOLUTIONS, APIMART_IMAGE_MODELS,
    isApimartImageModel, isApimartImage25, isApimartImageExt, apimartImageSizes,
    type ApimartImageModel,
} from "./generationCapabilities";

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
    return {
        provider: "apimart", model, profileVersion: OUTPUT_PROFILE_VERSION,
        ...defaultImageParameters(model, {purpose: "project-defaults", targetAspect: ratio}),
    };
}

export function defaultVideoGeneration(ratio = "16:9"): VideoGenerationDefaults {
    const parameters = defaultVideoParameters("apimart", {purpose: "project-defaults", mode: "text"}, ratio);
    return {
        provider: "apimart", model: "MiniMax-H3", profileVersion: OUTPUT_PROFILE_VERSION,
        mode: "text", aspectRatio: parameters.aspectRatio ?? "16:9",
        resolution: parameters.resolution, duration: parameters.duration,
    };
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
    const result = {...(raw.extra === undefined ? {} : record(raw.extra, "扩展配置"))};
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
    const parsed: ProjectGenerationDefaults = {extra: extras(root, ["image", "video"])};
    if (root.image !== undefined) {
        const image = record(root.image, "图片默认值");
        const quality = optionalText(image, "quality");
        const version = optionalText(image, "version");
        parsed.image = {
            provider: textField(image, "provider"), model: textField(image, "model"),
            profileVersion: textField(image, "profileVersion"), size: textField(image, "size"),
            resolution: textField(image, "resolution"), extra: extras(image, IMAGE_KNOWN),
            ...(quality !== undefined ? {quality} : {}),
            ...(version !== undefined ? {version} : {}),
        };
    }
    if (root.video !== undefined) {
        const video = record(root.video, "视频默认值");
        if (typeof video.duration !== "number" || !Number.isFinite(video.duration)) throw new Error("视频时长必须是有限数值");
        parsed.video = {
            provider: textField(video, "provider"),
            model: textField(video, "model"),
            profileVersion: textField(video, "profileVersion"),
            mode: textField(video, "mode"),
            aspectRatio: textField(video, "aspectRatio"),
            resolution: textField(video, "resolution"),
            duration: video.duration,
            extra: extras(video, ["provider", "model", "profileVersion", "mode", "aspectRatio", "resolution", "duration"]),
        };
    }
    return parsed;
}

export function validateGenerationDefaults(raw: unknown): string[] {
    let config: ProjectGenerationDefaults | undefined;
    try {
        config = parseGenerationDefaults(raw);
    } catch (error) {
        return [error instanceof Error ? error.message : "生成默认值格式无效"];
    }
    const issues: string[] = [];
    if (config?.image) {
        const image = config.image;
        if (image.provider !== "apimart" || !isApimartImageModel(image.model) || image.profileVersion !== OUTPUT_PROFILE_VERSION) {
            issues.push("图片配置版本或模型尚不支持，请明确选择已验证的 APIMart 图片模型或清除配置");
        } else {
            const profile = getGenerationCapability("apimart", image.model, "image");
            if (profile) issues.push(...validateGenerationParameters(profile, image, {purpose: "project-defaults"}).map(issue => issue.message));
        }
    }
    if (config?.video) {
        const video = config.video;
        if (video.provider !== "apimart" || video.model !== "MiniMax-H3" || video.profileVersion !== OUTPUT_PROFILE_VERSION) {
            issues.push("视频配置版本或模型尚不支持，请明确选择 MiniMax H3 或清除配置");
        }
        // Unknown imported video profiles still receive the existing H3 scalar diagnostics.
        const profile = getGenerationCapability("apimart", "MiniMax-H3", "video");
        if (profile) issues.push(...validateGenerationParameters(profile, video, {purpose: "project-defaults", mode: video.mode}).map(issue => issue.message));
    }
    return issues;
}

/** Common native parameters only; prompt/media-role preflight belongs to generation. */
export function generationParameters(config: ProjectGenerationDefaults, kind: "image" | "video"): Record<string, string | number> {
    const selected = kind === "image" ? {image: config.image} : {video: config.video};
    const errors = validateGenerationDefaults(selected);
    if (errors.length) throw new Error(errors.join("；"));
    if (kind === "image" && config.image) {
        return {
            model: config.image.model, size: config.image.size, resolution: config.image.resolution, n: 1,
            ...(config.image.quality ? {quality: config.image.quality} : {}),
            ...(config.image.version ? {version: config.image.version} : {}),
        };
    }
    if (kind === "video" && config.video) {
        const video = config.video;
        return {
            model: video.model, resolution: video.resolution, duration: video.duration,
            ...(video.mode === "frames" ? {} : {aspect_ratio: video.aspectRatio})
        };
    }
    throw new Error("尚未配置此类生成默认值");
}
