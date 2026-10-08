from pathlib import Path
p=Path('src/lib/agent/businessSchemas.ts');s=p.read_text();pos=s.index('export function number');s=s[:pos]+'''/** Used only where the existing parser trims input before enforcing bounds. */
export function trimmedText(max: number, min = 1): Spec<string> {
    return {schema: z.string().trim().min(min).max(max), json: {type: "string", minLength: min, maxLength: max}};
}

/** A default supplies required output while the advertised input remains optional. */
export function defaulted<T>(spec: Spec<T>, value: z.input<typeof spec.schema> & T): Spec<T> {
    return {...spec, schema: spec.schema.default(value), optional: true};
}

'''+s[pos:];p.write_text(s)
p=Path('src/lib/agent/generationProfiles.ts');s=p.read_text();start=s.index('const id =');end=s.index('\nexport function profileRequest',start)
s=s[:start]+'''const idSpec = s.trimmedText(160);
const boundedParameter = (max: number): s.Spec<string> => ({schema: z.string().max(max), json: {type: "string"}});
const targetSpec = s.object({
    kind: s.choice(["shot", "character", "scene", "prop", "style"]), projectId: idSpec, entityId: idSpec,
    episodeId: s.optional(idSpec), slot: {schema: z.string().min(1).max(30), json: {type: "string"}},
});
const parameterSpec = s.object({
    size: s.optional({...boundedParameter(30), json: {type: "string", description: '图片尺寸：APIMart 使用比例，例如 9:16；AIHubMix 使用已支持的像素尺寸。'}}),
    resolution: s.optional(boundedParameter(10)),
    duration: s.optional({schema: z.number().int(), json: {type: "integer"}}),
    aspectRatio: s.optional({...boundedParameter(10), json: {type: "string", description: "仅视频使用；图片比例使用 size。"}}),
    mode: s.optional({...s.choice(["text", "frames", "reference"]), json: {type: "string", enum: ["text", "frames", "reference"], description: "仅视频使用；图片不要传入。"}}),
    quality: s.optional(s.choice(["low", "medium", "high", "xhigh", "max", "auto"])),
    version: s.optional(s.choice(["flare", "sunburst"])),
});
const inputSpec = s.object({mediaId: idSpec, role: s.choice(["first-frame", "last-frame", "reference-image", "reference-video"])});
const submitSpec = s.object({
    connectorId: idSpec,
    model: s.choice(["gpt-image-2", "gpt-image-2.5-flare", "gpt-image-2.5-sunburst", "gpt-image-2.5-ext", "MiniMax-H3", "veo-3.1-fast-generate-preview"]),
    target: targetSpec, prompt: s.trimmedText(32000),
    parameters: s.defaulted(parameterSpec, {}), inputs: s.defaulted(s.array(inputSpec, 16), []),
});
// The legacy advertisement intentionally has fewer bounds and different property
// ordering than parser output. Keep those wire differences explicit at this leaf.
const submitProperties = {
    connectorId: idSpec.json, model: s.choice(["gpt-image-2", "gpt-image-2.5-flare", "gpt-image-2.5-sunburst", "gpt-image-2.5-ext", "MiniMax-H3", "veo-3.1-fast-generate-preview"]).json,
    prompt: s.trimmedText(32000).json,
    target: {type: "object", additionalProperties: false, required: ["kind", "projectId", "entityId", "slot"], properties: targetSpec.json.properties},
    parameters: {type: "object", additionalProperties: false, properties: parameterSpec.json.properties},
    inputs: {type: "array", maxItems: 16, items: {type: "object", additionalProperties: false, required: ["mediaId", "role"], properties: inputSpec.json.properties}},
};
export const generationSubmitSpec = {...submitSpec, json: {
    type: "object", additionalProperties: false, required: ["connectorId", "model", "target", "prompt"], properties: submitProperties,
}};
export const generationSubmitSchema = generationSubmitSpec.schema;
export type GenerationSubmitArgs = z.output<typeof generationSubmitSchema>;
const jobSpec = s.object({jobId: idSpec});
export const generationJobSpec = {...jobSpec, json: {type: "object", additionalProperties: false, required: ["jobId"], properties: {jobId: idSpec.json}}};
export const generationJobSchema = generationJobSpec.schema;
''' +s[end:];s=s.replace('import {z} from "zod";', 'import {z} from "zod";\nimport * as s from "./businessSchemas";');p.write_text(s)
p=Path('src/lib/agent/generationTools.ts');s=p.read_text();start=s.index('const id =');end=s.index('const batchSchema',start);s=s[:start]+s[end:];s=s.replace('    type GenerationSubmitArgs,','    generationSubmitSpec,\n    generationJobSpec,');s=s.replace('items: submitParameters','items: generationSubmitSpec.json').replace('defineTool({schema: generationSubmitSchema, json: submitParameters}', 'defineTool(generationSubmitSpec').replace('defineTool({schema: generationJobSchema, json: jobParameters}', 'defineTool(generationJobSpec').replace('args as GenerationSubmitArgs','args').replace('(args as { jobId: string }).jobId','args.jobId').replace('(args as { projectId?: string }).projectId','args.projectId');s=s.replace('    generationJobSchema,\n','');p.write_text(s)
