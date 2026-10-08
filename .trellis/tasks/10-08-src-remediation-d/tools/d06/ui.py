from pathlib import Path
p=Path('src/components/agent/GenerationReview.tsx');s=p.read_text();s=s.replace('import {IMAGE_RATIOS, VIDEO_RATIOS} from "@/domain/output";','''import {getGenerationCapability, generationResolutionChange, projectGenerationParameters} from "@/domain/generationCapabilities";''')
s=s.replace('    const referenceVideos = draft.inputs.filter(input => input.role === \'reference-video\').length;','''    const referenceVideos = draft.inputs.filter(input => input.role === 'reference-video').length;
    // Preserve the existing role-based control view; executable validation uses proposal mode.
    const displayProfile = getGenerationCapability(provider ?? "apimart", draft.model, kind)
        ?? getGenerationCapability(provider === "aihubmix" ? "aihubmix" : "apimart", kind === "image" ? "gpt-image-2" : provider === "aihubmix" ? "veo-3.1-fast-generate-preview" : "MiniMax-H3", kind);
    const controls = displayProfile && projectGenerationParameters(displayProfile, p, {
        purpose: "request", mode: frames ? "frames" : references ? "reference" : "text",
        inputRoles: draft.inputs.map(input => input.role),
    });''')
s=s.replace('options={provider === "aihubmix" ? options(["auto", "1024x1024", "1536x1024", "1024x1536"]) : options(profile && "sizes" in profile ? profile.sizes : ["auto", ...IMAGE_RATIOS])}','options={options(controls?.sizes ?? [])}')
s=s.replace('options={[{value: "default", label: "模型默认"}, {\n                                                       value: "low",\n                                                       label: "低"\n                                                   }, {value: "medium", label: "中"}, {value: "high", label: "高"}]}','''options={[{value: "default", label: "模型默认"}, ...(controls?.qualities ?? []).map(value => ({value, label: value === "low" ? "低" : value === "medium" ? "中" : "高"}))]}''')
s=s.replace('options={options(["1k", "2k", "4k"])}','options={options(controls?.resolutions ?? [])}')
s=s.replace('options={options(profile.qualities)}','options={options(controls?.qualities ?? [])}')
s=s.replace('options={[{value: "flare", label: "flare"}, {value: "sunburst", label: "sunburst"}]}','options={options(controls?.versions ?? [])}')
s=s.replace('options={options(provider === "aihubmix" ? referenceVideos ? ["720p"] : ["720p", "1080p", "4K"] : ["768P", "2K"])}','options={options(controls?.resolutions ?? [])}')
s=s.replace('onChange={(resolution) => patch({resolution, ...(provider === "aihubmix" && resolution !== "720p" ? {duration: 8} : {})})}','onChange={(resolution) => patch(displayProfile ? generationResolutionChange(displayProfile, resolution) : {resolution})}')
s=s.replace('options={options(provider === "aihubmix" ? (p.resolution && p.resolution !== "720p" || references) ? [8] : [4, 6, 8] : Array.from({length: 12}, (_, i) => i + 4))}','options={options(controls?.durations ?? [])}')
s=s.replace('{!(frames && provider === "apimart") && <Choice','{controls?.showAspectRatio && <Choice')
s=s.replace('options={options(provider === "aihubmix" ? ["16:9", "9:16"] : [...VIDEO_RATIOS, ...(references ? ["adaptive"] : [])])}','options={options(controls?.ratios ?? [])}')
p.write_text(s)
p=Path('src/components/workspace/ProjectSettingsPanel.tsx');s=p.read_text();s=s.replace('    apimartImageSizes,\n','').replace('    IMAGE_EXT_VERSIONS,\n','').replace('    IMAGE_QUALITIES,\n','').replace('    IMAGE_RESOLUTIONS,\n','').replace('    VIDEO_RATIOS,\n','').replace('    VIDEO_RESOLUTIONS,\n','')
s=s.replace('import {acknowledgeOutputDraft','import {getGenerationCapability, projectGenerationParameters} from "@/domain/generationCapabilities";\nimport {acknowledgeOutputDraft')
s=s.replace('    const imageModel = imageKnown ? image!.model : undefined;','''    const imageModel = imageKnown ? image!.model : undefined;
    const imageProfile = getGenerationCapability("apimart", imageModel ?? "gpt-image-2", "image");
    const videoProfile = getGenerationCapability("apimart", "MiniMax-H3", "video");
    const imageControls = imageProfile && projectGenerationParameters(imageProfile, image ?? {}, {purpose: "project-defaults"});
    const videoControls = videoProfile && projectGenerationParameters(videoProfile, video ?? {}, {purpose: "project-defaults", mode: video?.mode});''')
s=s.replace('options={[...apimartImageSizes(imageModel ?? "gpt-image-2"), "auto"]}','options={imageControls?.sizes ?? []}').replace('options={IMAGE_RESOLUTIONS}','options={imageControls?.resolutions ?? []}').replace('options={IMAGE_QUALITIES}','options={imageControls?.qualities ?? []}').replace('options={[...IMAGE_EXT_VERSIONS]}','options={imageControls?.versions ?? []}')
s=s.replace('options={video.mode === "frames" ? [{\n                            value: "adaptive",\n                            label: "跟随输入图片"\n                        }] : video.mode === "reference" ? [...VIDEO_RATIOS, {\n                            value: "adaptive",\n                            label: "跟随参考素材"\n                        }] : VIDEO_RATIOS}','''options={(videoControls?.ratios ?? []).map(value => value === "adaptive" ? {value, label: video.mode === "frames" ? "跟随输入图片" : "跟随参考素材"} : value)}''')
s=s.replace('options={VIDEO_RESOLUTIONS}','options={videoControls?.resolutions ?? []}')
p.write_text(s)
# No non-null assertions added to adapters.
p=Path('src/domain/output.ts');s=p.read_text().replace('getGenerationCapability("apimart", image.model, "image")!','getGenerationCapability("apimart", image.model, "image")').replace('getGenerationCapability("apimart", "MiniMax-H3", "video")!','getGenerationCapability("apimart", "MiniMax-H3", "video")').replace('            issues.push(...validateGenerationParameters(profile, image','            if (profile) issues.push(...validateGenerationParameters(profile, image').replace('        issues.push(...validateGenerationParameters(profile, video','        if (profile) issues.push(...validateGenerationParameters(profile, video');p.write_text(s)
