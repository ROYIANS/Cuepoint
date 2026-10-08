import {describe, expect, it} from "vitest";
import {GENERATION_PROFILES, generationSubmitSchema, profileRequest} from "@/lib/agent/generationProfiles";
import {defaultImageGeneration, defaultVideoGeneration, parseGenerationDefaults, validateGenerationDefaults, generationParameters} from "@/domain/output";
import {getGenerationCapability, projectGenerationParameters, generationResolutionChange} from "@/domain/generationCapabilities";
import {applyGenerationSelection} from "@/lib/agent/generationReviewDraft";
import {GENERATION_PROFILES as originalProfiles, generationSubmitSchema as originalSchema, profileRequest as originalRequest} from "../.trellis/tasks/10-08-src-remediation-d/tools/d06/before/src/lib/agent/generationProfiles";
import * as originalOutput from "../.trellis/tasks/10-08-src-remediation-d/tools/d06/before/src/domain/output";

function outcome(action: () => unknown) {
    try {return {value: action()};} catch (error) {return {error: error instanceof Error ? error.message : String(error)};}
}
const frame = [{mediaId: "first", role: "first-frame"}, {mediaId: "last", role: "last-frame"}];
const reference = [{mediaId: "reference", role: "reference-image"}];
const videoReference = [{mediaId: "reference", role: "reference-video"}];
const target = (video: boolean) => ({kind: "shot", projectId: "project", episodeId: "episode", entityId: "shot", slot: video ? "clip" : "firstFrame"});

function compareRequest(model: string, provider: "apimart" | "aihubmix", parameters: unknown, inputs: unknown[] = []) {
    const raw = {connectorId: "chosen", model, target: target(model === "MiniMax-H3" || model.startsWith("veo")), prompt: "画面", parameters, inputs};
    expect(outcome(() => profileRequest(generationSubmitSchema.parse(raw), provider))).toEqual(outcome(() => originalRequest(originalSchema.parse(raw), provider)));
}

describe("D06 original-source capability compatibility", () => {
    it("preserves seven ordered advertised records byte for byte and schema output", () => {
        expect(GENERATION_PROFILES).toHaveLength(7);
        expect(JSON.stringify(GENERATION_PROFILES)).toBe(JSON.stringify(originalProfiles));
        for (const profile of GENERATION_PROFILES) compareRequest(profile.model, profile.provider, {});
        const raw = {connectorId: "chosen", model: "gpt-image-2", target: target(false), prompt: "  画面  "};
        expect(generationSubmitSchema.parse(raw)).toEqual(originalSchema.parse(raw));
    });
    it("matches image scalar, hidden-field, role and reference-limit behavior", () => {
        const sizes = [undefined, "auto", "1:1", "2:1", "9:21", "1536x1024", "unknown"];
        const qualities = [undefined, "low", "high", "auto", "max"];
        for (const profile of GENERATION_PROFILES.filter(profile => profile.kind === "image")) {
            for (const size of sizes) for (const quality of qualities) {
                for (const resolution of [undefined, "1k", "4k", "4K"]) compareRequest(profile.model, profile.provider, {size, quality, resolution});
            }
            for (const parameters of [{duration: 4}, {aspectRatio: "16:9"}, {mode: "text"}, {version: "sunburst"}, {version: "unknown"}, {quality: "low", version: "flare"}, {size: "unknown", resolution: "unknown", quality: "max"}]) compareRequest(profile.model, profile.provider, parameters);
            for (const inputs of [frame, videoReference, [...reference, ...reference], Array.from({length: 15}, (_, i) => ({mediaId: String(i), role: "reference-image"})), Array.from({length: 16}, (_, i) => ({mediaId: String(i), role: "reference-image"}))]) compareRequest(profile.model, profile.provider, {}, inputs);
        }
    });
    it("matches video matrix, ordered scalar errors and explicit roles including missing mode", () => {
        for (const [provider, model] of [["apimart", "MiniMax-H3"], ["aihubmix", "veo-3.1-fast-generate-preview"]] as const) {
            for (const mode of [undefined, "text", "frames", "reference", "unknown"]) {
                for (const inputs of [[], frame, reference, videoReference, [{mediaId: "last", role: "last-frame"}], [...frame, ...reference]]) {
                    for (const resolution of [undefined, "768P", "2K", "720p", "1080p", "4K", "unknown"]) {
                        for (const duration of [undefined, 3, 4, 5, 6, 8, 15, 16, 4.5]) {
                            for (const aspectRatio of [undefined, "16:9", "9:16", "adaptive", "1:1", "unknown"]) compareRequest(model, provider, {mode, resolution, duration, aspectRatio}, inputs);
                        }
                    }
                }
            }
            for (const parameters of [{size: "auto"}, {quality: "low"}, {version: "flare"}]) compareRequest(model, provider, parameters);
        }
    });
    it("preserves project defaults, permissive imports and accumulated diagnostics", () => {
        for (const model of ["gpt-image-2", "gpt-image-2.5-flare", "gpt-image-2.5-sunburst", "gpt-image-2.5-ext"] as const) {
            for (const ratio of ["16:9", "9:21", "2:1", "unknown", "auto"]) expect(defaultImageGeneration(ratio, model)).toEqual(originalOutput.defaultImageGeneration(ratio, model));
            for (const size of ["auto", "2:1", "9:16", "unknown"]) for (const quality of [undefined, "auto", "max", "unknown"]) for (const version of [undefined, "flare", "unknown"]) {
                const config = {image: {...defaultImageGeneration("16:9", model), size, quality, version, resolution: "4k"}};
                expect(validateGenerationDefaults(config)).toEqual(originalOutput.validateGenerationDefaults(config));
                expect(outcome(() => generationParameters(config, "image"))).toEqual(outcome(() => originalOutput.generationParameters(config, "image")));
            }
        }
        for (const ratio of ["16:9", "9:16", "adaptive", "unknown"]) expect(JSON.stringify(defaultVideoGeneration(ratio))).toBe(JSON.stringify(originalOutput.defaultVideoGeneration(ratio)));
        for (const model of ["MiniMax-H3", "future-model"]) for (const mode of ["text", "frames", "reference", "unknown"]) for (const aspectRatio of ["16:9", "adaptive", "unknown"]) for (const resolution of ["768P", "2K", "unknown"]) for (const duration of [3, 4, 4.5, 15, 16]) {
            const config = {video: {...defaultVideoGeneration(), model, mode, aspectRatio, resolution, duration}};
            expect(validateGenerationDefaults(config)).toEqual(originalOutput.validateGenerationDefaults(config));
        }
        const imported = {image: {...defaultImageGeneration(), model: "future", profileVersion: "old", quality: "unknown", future: {keep: true}}, video: {...defaultVideoGeneration(), mode: "frames", extra: {keep: 1}}, extra: {root: true}};
        expect(parseGenerationDefaults(imported)).toEqual(originalOutput.parseGenerationDefaults(imported));
        expect(validateGenerationDefaults(imported)).toEqual(originalOutput.validateGenerationDefaults(imported));
        expect(validateGenerationDefaults(imported)).toHaveLength(2);
    });
});

describe("D06 controls do not repair executable proposals", () => {
    it("projects Veo conditional choices and retains invalid raw values until explicit edit", () => {
        const profile = getGenerationCapability("aihubmix", "veo-3.1-fast-generate-preview", "video");
        expect(profile).toBeDefined(); if (!profile) throw new Error("fixture profile missing");
        const raw = {resolution: "1080p", duration: 4};
        const controls = projectGenerationParameters(profile, raw, {purpose: "request", mode: "reference", inputRoles: ["reference-video"]});
        expect(controls.resolutions).toEqual(["720p"]); expect(controls.durations).toEqual([8]);
        expect(raw).toEqual({resolution: "1080p", duration: 4});
        expect(generationResolutionChange(profile, "1080p")).toEqual({resolution: "1080p", duration: 8});
        expect(generationResolutionChange(profile, "720p")).toEqual({resolution: "720p"});
        compareRequest(profile.model, profile.provider, {...raw, mode: "reference"}, videoReference);
        expect(outcome(() => profileRequest(generationSubmitSchema.parse({connectorId: "chosen", model: profile.model, target: target(true), prompt: "画面", parameters: {...raw, mode: "reference"}, inputs: videoReference}), profile.provider))).toHaveProperty("error");
    });
    it("keeps request frame omission distinct from explicit project adaptive", () => {
        const raw = {connectorId: "chosen", model: "MiniMax-H3", target: target(true), prompt: "  未修剪  ", parameters: {}, inputs: frame};
        const draft = generationSubmitSchema.parse({...raw, prompt: "未修剪"}); draft.prompt = raw.prompt;
        expect(() => profileRequest(draft, "apimart")).toThrow("输入素材用途不匹配");
        const applied = applyGenerationSelection(draft, {connectorId: "other", model: "MiniMax-H3", parameters: {aspectRatio: "16:9"}}, "apimart");
        expect(applied.target).toEqual(draft.target); expect(applied.inputs).toEqual(draft.inputs); expect(applied.prompt).toBe(raw.prompt);
        expect(applied.parameters).toEqual({mode: "frames"});
        expect(profileRequest(applied, "apimart").parameters).not.toHaveProperty("aspect_ratio");
        expect(validateGenerationDefaults({video: {...defaultVideoGeneration(), mode: "frames"}})).toEqual(["首尾帧生视频的比例由输入图片决定，请选择跟随输入图片"]);
        expect(validateGenerationDefaults({video: {...defaultVideoGeneration(), mode: "frames", aspectRatio: "adaptive"}})).toEqual([]);
    });
});
