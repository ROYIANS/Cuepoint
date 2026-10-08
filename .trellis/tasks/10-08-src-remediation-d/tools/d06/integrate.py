from pathlib import Path
p=Path('src/domain/output.ts');s=p.read_text();start=s.index('    const sizes = apimartImageSizes(model);',s.index('export function defaultImageGeneration'));end=s.index('\nfunction record',start)
s=s[:start]+'''    return {
        provider: "apimart", model, profileVersion: OUTPUT_PROFILE_VERSION,
        ...defaultImageParameters(model, {purpose: "project-defaults", targetAspect: ratio}),
    };
}

export function defaultVideoGeneration(ratio = "16:9"): VideoGenerationDefaults {
    const parameters = defaultVideoParameters("apimart", {purpose: "project-defaults", mode: "text"}, ratio);
    return {
        provider: "apimart", model: "MiniMax-H3", profileVersion: OUTPUT_PROFILE_VERSION,
        mode: "text", ...parameters, aspectRatio: parameters.aspectRatio ?? "16:9",
    };
}
''' + s[end:]
start=s.index('            if (![...apimartImageSizes');end=s.index('\n        }\n    }\n    if (config?.video)',start)
s=s[:start]+'''            const profile = getGenerationCapability("apimart", image.model, "image")!;
            issues.push(...validateGenerationParameters(profile, image, {purpose: "project-defaults"}).map(issue => issue.message));''' + s[end:]
start=s.index('        if (!(VIDEO_RESOLUTIONS');end=s.index('\n    }\n    return issues;',start)
s=s[:start]+'''        // Unknown imported video profiles still receive the existing H3 scalar diagnostics.
        const profile = getGenerationCapability("apimart", "MiniMax-H3", "video")!;
        issues.push(...validateGenerationParameters(profile, video, {purpose: "project-defaults", mode: video.mode}).map(issue => issue.message));''' + s[end:]
s=s.replace('    apimartImageSizes, defaultImageParameters','    defaultImageParameters')
p.write_text(s)
p=Path('src/lib/agent/generationProfiles.ts');s=p.read_text();start=s.index('import {\n    IMAGE_EXT');end=s.index('import {validateProductionTarget}',start)
s=s[:start]+'''import {
    defaultImageParameters, defaultVideoParameters, getGenerationCapability,
    isApimartImage25, isApimartImageExt, isApimartImageModel,
    validateGenerationParameters,
} from "@/domain/generationCapabilities";
'''+s[end:]
s=s.replace('    const parameters: Record<string, string | number | boolean> = {prompt: args.prompt};','''    const profile = getGenerationCapability(provider, args.model, kind);
    const parameterIssues = profile ? validateGenerationParameters(profile, p, {purpose: "request", mode, inputRoles: inputs.map(input => input.role)}) : [];
    const invalid = (...fields: Array<typeof parameterIssues[number]["field"]>) => parameterIssues.some(issue => fields.includes(issue.field));
    const parameters: Record<string, string | number | boolean> = {prompt: args.prompt};''')
s=s.replace('            const sizes = isApimartImageExt(args.model) ? IMAGE_EXT_RATIOS : IMAGE_RATIOS;\n            const maxImages = args.model === "gpt-image-2" ? 15 : 16;','''            const maxImages = profile && "maxImages" in profile ? profile.maxImages : 15;''')
s=s.replace('![...sizes, "auto"].includes(String(parameters.size)) || !["1k", "2k", "4k"].includes(p.resolution ?? "1k")','invalid("size", "resolution")')
s=s.replace('if (!(IMAGE_QUALITIES as readonly string[]).includes(quality))','if (invalid("quality"))')
s=s.replace('if (!["auto", "1024x1024", "1536x1024", "1024x1536"].includes(String(parameters.size)))','if (invalid("size"))')
s=s.replace('if (!["low", "medium", "high"].includes(p.quality))','if (invalid("quality"))')
s=s.replace('parameters.resolution = p.resolution ?? "1k"','parameters.resolution = p.resolution ?? defaultImageParameters(args.model, {purpose: "request"}).resolution')
s=s.replace('parameters.resolution = (p.resolution ?? "1k").toUpperCase()','parameters.resolution = (p.resolution ?? defaultImageParameters(args.model, {purpose: "request"}).resolution).toUpperCase()')
s=s.replace('            parameters.resolution = p.resolution ?? "2K";\n            parameters.duration = p.duration ?? 5;','''            const defaults = defaultVideoParameters(provider, {purpose: "request", mode, inputRoles: inputs.map(input => input.role)});
            parameters.resolution = p.resolution ?? defaults.resolution;
            parameters.duration = p.duration ?? defaults.duration;''')
s=s.replace('if (!["768P", "2K"].includes(String(parameters.resolution)) || Number(parameters.duration) < 4 || Number(parameters.duration) > 15)','if (invalid("resolution", "duration"))')
s=s.replace('if (p.aspectRatio !== undefined && p.aspectRatio !== "adaptive")','if (invalid("aspectRatio"))')
s=s.replace('parameters.aspect_ratio = p.aspectRatio ?? (mode === "reference" ? "adaptive" : "16:9");','parameters.aspect_ratio = p.aspectRatio ?? defaults.aspectRatio ?? "16:9";')
s=s.replace('if (!(VIDEO_RATIOS as readonly string[]).includes(String(parameters.aspect_ratio)) && !(mode === "reference" && parameters.aspect_ratio === "adaptive"))','if (invalid("aspectRatio"))')
s=s.replace('            parameters.duration = p.duration ?? 8;\n            parameters.resolution = p.resolution ?? "720p";\n            parameters.aspect_ratio = p.aspectRatio ?? "16:9";','''            const defaults = defaultVideoParameters(provider, {purpose: "request", mode, inputRoles: inputs.map(input => input.role)});
            parameters.duration = p.duration ?? defaults.duration;
            parameters.resolution = p.resolution ?? defaults.resolution;
            parameters.aspect_ratio = p.aspectRatio ?? defaults.aspectRatio ?? "16:9";''')
s=s.replace('if (![4, 6, 8].includes(Number(parameters.duration)) || !["720p", "1080p", "4K"].includes(String(parameters.resolution)) || !["16:9", "9:16"].includes(String(parameters.aspect_ratio)))','if (invalid("duration", "resolution", "aspectRatio"))')
s=s.replace('if (parameters.resolution !== "720p" && parameters.duration !== 8 || mode === "reference" && parameters.duration !== 8 || count("reference-video") && parameters.resolution !== "720p")','if (invalid("constraint"))')
p.write_text(s)
