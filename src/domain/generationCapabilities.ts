/** Verified scalar policies. No credentials, transport, persistence or proposal repair. */
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
    return includes(APIMART_IMAGE_MODELS, model);
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


export const GENERATION_CAPABILITIES = [
    {
        provider: "apimart",
        model: "gpt-image-2",
        kind: "image",
        label: "GPT Image 2",
        sizes: [...IMAGE_RATIOS, "auto"],
        resolutions: IMAGE_RESOLUTIONS,
        inputRoles: ["reference-image"],
        maxImages: 15
    },
    {
        provider: "apimart",
        model: "gpt-image-2.5-flare",
        kind: "image",
        label: "GPT Image 2.5 Flare",
        sizes: [...IMAGE_RATIOS, "auto"],
        resolutions: IMAGE_RESOLUTIONS,
        qualities: [...IMAGE_QUALITIES],
        inputRoles: ["reference-image"],
        maxImages: 16
    },
    {
        provider: "apimart",
        model: "gpt-image-2.5-sunburst",
        kind: "image",
        label: "GPT Image 2.5 Sunburst",
        sizes: [...IMAGE_RATIOS, "auto"],
        resolutions: IMAGE_RESOLUTIONS,
        qualities: [...IMAGE_QUALITIES],
        inputRoles: ["reference-image"],
        maxImages: 16
    },
    {
        provider: "apimart",
        model: "gpt-image-2.5-ext",
        kind: "image",
        label: "GPT Image 2.5 Ext",
        sizes: [...IMAGE_EXT_RATIOS, "auto"],
        resolutions: IMAGE_RESOLUTIONS,
        versions: IMAGE_EXT_VERSIONS,
        inputRoles: ["reference-image"],
        maxImages: 16
    },
    {
        provider: "apimart",
        model: "MiniMax-H3",
        kind: "video",
        label: "MiniMax H3",
        ratios: VIDEO_RATIOS,
        resolutions: VIDEO_RESOLUTIONS,
        duration: "整数4–15",
        inputRoles: ["first-frame", "last-frame", "reference-image"],
        maxImages: 9,
        imageFormats: ["image/png", "image/jpeg", "image/webp"],
        imageDimensions: "256–5760px，宽高比0.4–2.5",
        maxImageBytes: 20 * 1024 * 1024
    },
    {
        provider: "aihubmix",
        model: "gpt-image-2",
        kind: "image",
        label: "GPT Image 2",
        sizes: ["auto", "1024x1024", "1536x1024", "1024x1536"],
        inputRoles: ["reference-image"],
        maxImages: 16,
        requiresAsyncEnabled: true
    },
    {
        provider: "aihubmix",
        model: "veo-3.1-fast-generate-preview",
        kind: "video",
        label: "Veo 3.1 Fast",
        ratios: ["16:9", "9:16"],
        resolutions: ["720p", "1080p", "4K"],
        durations: [4, 6, 8],
        inputRoles: ["first-frame", "last-frame", "reference-image", "reference-video"],
        constraints: "高分辨率和参考输入须8秒；参考视频须720p",
        requiresAsyncEnabled: true
    },
] as const;


export type GenerationCapability = typeof GENERATION_CAPABILITIES[number];
export type GenerationInputRole = "first-frame" | "last-frame" | "reference-image" | "reference-video";
export interface CapabilityParameters {
    size?: string;
    resolution?: string;
    duration?: number;
    aspectRatio?: string;
    mode?: string;
    quality?: string;
    version?: string;
}
export type ParameterContext =
    | {purpose: "project-defaults"; mode?: string}
    | {purpose: "request"; mode: string; inputRoles: readonly GenerationInputRole[]};

export function getGenerationCapability(provider: string, model: string, kind: "image" | "video"): GenerationCapability | undefined {
    return GENERATION_CAPABILITIES.find(profile => profile.provider === provider && profile.model === model && profile.kind === kind);
}

const AIHUBMIX_IMAGE_QUALITIES = ["low", "medium", "high"] as const;
const H3_DURATIONS = Array.from({length: 12}, (_, index) => index + 4);

function includes(values: readonly string[], value: string): boolean {
    return values.includes(value);
}

export function defaultImageParameters(model: string, context: {purpose: "request"} | {purpose: "project-defaults"; targetAspect: string}) {
    let size = "auto";
    if (context.purpose === "project-defaults") size = apimartImageSizes(model).includes(context.targetAspect) ? context.targetAspect : "16:9";
    return {
        size, resolution: IMAGE_RESOLUTIONS[0],
        ...(isApimartImage25(model) ? {quality: "auto" as const} : {}),
        ...(isApimartImageExt(model) ? {version: IMAGE_EXT_VERSIONS[0]} : {}),
    };
}

function defaultVideoRatio(context: ParameterContext, targetAspect: string): string | undefined {
    if (context.mode === "frames") return context.purpose === "request" ? undefined : "adaptive";
    if (context.mode === "reference") return "adaptive";
    return includes(VIDEO_RATIOS, targetAspect) ? targetAspect : "16:9";
}

export function defaultVideoParameters(provider: string, context: ParameterContext, targetAspect = "16:9") {
    if (provider === "aihubmix") return {resolution: "720p", duration: 8, aspectRatio: "16:9"};
    return {resolution: VIDEO_RESOLUTIONS[1], duration: 5, aspectRatio: defaultVideoRatio(context, targetAspect)};
}

function parameterResolutions(profile: GenerationCapability, context: ParameterContext): readonly string[] {
    if (!("resolutions" in profile)) return [];
    if (profile.provider === "aihubmix" && context.purpose === "request" && context.inputRoles.includes("reference-video")) return ["720p"];
    return profile.resolutions;
}

function videoDurations(profile: GenerationCapability, raw: Readonly<CapabilityParameters>, context: ParameterContext): readonly number[] {
    if (profile.kind !== "video") return [];
    if (profile.provider === "apimart") return H3_DURATIONS;
    if (raw.resolution && raw.resolution !== "720p" || context.mode === "reference") return [8];
    return profile.durations;
}

function videoRatios(profile: GenerationCapability, context: ParameterContext): readonly string[] {
    if (profile.kind !== "video") return [];
    if (profile.provider !== "apimart") return profile.ratios;
    if (context.mode === "frames") return ["adaptive"];
    return [...profile.ratios, ...(context.mode === "reference" ? ["adaptive"] : [])];
}

function imageQualities(profile: GenerationCapability): readonly string[] {
    if (profile.kind === "image" && profile.provider === "aihubmix") return AIHUBMIX_IMAGE_QUALITIES;
    return "qualities" in profile ? profile.qualities : [];
}

/** A view of legal controls; raw values are never repaired or applied on render. */
export function projectGenerationParameters(profile: GenerationCapability, raw: Readonly<CapabilityParameters>, context: ParameterContext) {
    const imageDefaults = defaultImageParameters(profile.model, {purpose: "request"});
    const videoDefaults = defaultVideoParameters(profile.provider, context);
    let defaultResolution: string | undefined = videoDefaults.resolution;
    if (profile.kind === "image") defaultResolution = profile.provider === "apimart" ? imageDefaults.resolution : undefined;
    return {
        sizes: "sizes" in profile ? profile.sizes : [],
        resolutions: parameterResolutions(profile, context),
        durations: videoDurations(profile, raw, context),
        ratios: videoRatios(profile, context),
        qualities: imageQualities(profile),
        versions: "versions" in profile ? profile.versions : [],
        showAspectRatio: !(profile.provider === "apimart" && context.mode === "frames" && context.purpose === "request"),
        defaultSize: imageDefaults.size,
        defaultResolution,
        defaultDuration: videoDefaults.duration,
        defaultRatio: videoDefaults.aspectRatio,
        defaultQuality: profile.provider === "apimart" ? imageDefaults.quality : undefined,
        defaultVersion: imageDefaults.version,
    };
}

/** Only the existing explicit Veo resolution edit changes duration. */
export function generationResolutionChange(profile: GenerationCapability, resolution: string): {resolution: string; duration?: number} {
    return {resolution, ...(profile.provider === "aihubmix" && profile.kind === "video" && resolution !== "720p" ? {duration: 8} : {})};
}

export interface ParameterIssue {
    field: keyof CapabilityParameters | "constraint";
    message: string;
}

function imageSizeMessage(profile: GenerationCapability): string {
    if (profile.provider === "aihubmix") return "AIHubMix GPT Image 2 使用 auto 或已验证的像素尺寸";
    if (isApimartImageExt(profile.model)) return "请选择 GPT Image 2.5 Ext 支持的图片比例";
    return "请选择 GPT Image 2 支持的图片比例";
}

function imageExtraIssues(profile: GenerationCapability, raw: Readonly<CapabilityParameters>, request: boolean): ParameterIssue[] {
    const issues: ParameterIssue[] = [];
    if (profile.provider === "aihubmix") {
        if (raw.quality && !includes(AIHUBMIX_IMAGE_QUALITIES, raw.quality)) issues.push({field: "quality", message: "AIHubMix GPT Image 2 画质仅支持 low、medium 或 high"});
        return issues;
    }
    if (isApimartImage25(profile.model)) {
        if (raw.quality !== undefined && !includes(IMAGE_QUALITIES, raw.quality)) issues.push({field: "quality", message: "请选择 GPT Image 2.5 支持的画质"});
        if (raw.version !== undefined) issues.push({field: "version", message: "标准 GPT Image 2.5 不使用 Ext 版本参数"});
        return issues;
    }
    if (isApimartImageExt(profile.model)) {
        if (raw.quality !== undefined) issues.push({field: "quality", message: "GPT Image 2.5 Ext 不支持画质参数"});
        // Strict submit schema owns the Ext enum at request entry; preserve direct-call behavior.
        if (!request && raw.version !== undefined && !includes(IMAGE_EXT_VERSIONS, raw.version)) issues.push({field: "version", message: "请选择 Ext 版本 flare 或 sunburst"});
        return issues;
    }
    if (raw.quality !== undefined) issues.push({field: "quality", message: "GPT Image 2 不支持画质参数"});
    if (raw.version !== undefined) issues.push({field: "version", message: "GPT Image 2 不使用 Ext 版本参数"});
    return issues;
}

function imageParameterIssues(profile: GenerationCapability, raw: Readonly<CapabilityParameters>, context: ParameterContext): ParameterIssue[] {
    const issues: ParameterIssue[] = [];
    const controls = projectGenerationParameters(profile, raw, context);
    const request = context.purpose === "request";
    if (!includes(controls.sizes, raw.size ?? (request ? "auto" : ""))) issues.push({field: "size", message: imageSizeMessage(profile)});
    if (profile.provider === "apimart" && !includes(controls.resolutions, raw.resolution ?? (request ? "1k" : ""))) issues.push({field: "resolution", message: "图片清晰度须为 1k、2k 或 4k"});
    return [...issues, ...imageExtraIssues(profile, raw, request)];
}

function videoAspectIssues(profile: GenerationCapability, raw: Readonly<CapabilityParameters>, context: ParameterContext): ParameterIssue[] {
    const request = context.purpose === "request";
    if (profile.provider === "apimart" && context.mode === "frames") {
        if (raw.aspectRatio === "adaptive" || request && raw.aspectRatio === undefined) return [];
        return [{field: "aspectRatio", message: request ? "首尾帧比例跟随输入图片" : "首尾帧生视频的比例由输入图片决定，请选择跟随输入图片"}];
    }
    if (profile.provider === "apimart" && context.mode !== "text" && context.mode !== "reference") return [{field: "mode", message: "请选择文字、首尾帧或参考素材生视频方式"}];
    const defaults = defaultVideoParameters(profile.provider, context);
    const ratio = raw.aspectRatio ?? (request ? defaults.aspectRatio : undefined);
    if (includes(videoRatios(profile, context), ratio ?? "")) return [];
    let message = "Veo 3.1 Fast 时长、分辨率或比例无效";
    if (profile.provider === "apimart") message = request ? "MiniMax H3 视频比例无效" : "请选择当前视频方式支持的比例";
    return [{field: "aspectRatio", message}];
}

function veoConstraintIssues(raw: Readonly<CapabilityParameters>, context: ParameterContext): ParameterIssue[] {
    const resolution = raw.resolution ?? "720p";
    const duration = raw.duration ?? 8;
    const highResolution = resolution !== "720p" && duration !== 8;
    const referenceDuration = context.mode === "reference" && duration !== 8;
    const videoResolution = context.purpose === "request" && context.inputRoles.includes("reference-video") && resolution !== "720p";
    if (highResolution || referenceDuration || videoResolution) return [{field: "constraint", message: "Veo 高分辨率/参考输入要求 8 秒，参考视频要求 720p"}];
    return [];
}

function videoScalarIssues(profile: GenerationCapability, raw: Readonly<CapabilityParameters>, context: ParameterContext): ParameterIssue[] {
    const issues: ParameterIssue[] = [];
    const request = context.purpose === "request";
    const defaults = defaultVideoParameters(profile.provider, context);
    const resolution = raw.resolution ?? (request ? defaults.resolution : "");
    const duration = raw.duration ?? (request ? defaults.duration : NaN);
    const resolutions = "resolutions" in profile ? profile.resolutions : [];
    if (!includes(resolutions, resolution)) issues.push({field: "resolution", message: profile.provider === "apimart" ? "MiniMax H3 分辨率须为 768P 或 2K" : "Veo 3.1 Fast 时长、分辨率或比例无效"});
    let validDuration: boolean;
    if (profile.provider === "apimart") validDuration = (request || Number.isInteger(duration)) && !(duration < 4 || duration > 15);
    else validDuration = "durations" in profile && (profile.durations as readonly number[]).includes(duration);
    if (!validDuration) issues.push({field: "duration", message: profile.provider === "apimart" ? "MiniMax H3 时长须为 4–15 秒整数" : "Veo 3.1 Fast 时长、分辨率或比例无效"});
    return issues;
}

/** Scalar legality shared by project and request adapters; input roles/counts stay with requests. */
export function validateGenerationParameters(profile: GenerationCapability, raw: Readonly<CapabilityParameters>, context: ParameterContext): ParameterIssue[] {
    if (profile.kind === "image") return imageParameterIssues(profile, raw, context);
    return [...videoScalarIssues(profile, raw, context), ...videoAspectIssues(profile, raw, context), ...(profile.provider === "aihubmix" ? veoConstraintIssues(raw, context) : [])];
}
