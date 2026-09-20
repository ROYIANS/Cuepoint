import { z } from "zod";
import {
  IMAGE_EXT_RATIOS, IMAGE_QUALITIES, IMAGE_RATIOS, VIDEO_RATIOS,
  isApimartImage25, isApimartImageExt, isApimartImageModel,
} from "@/domain/output";
import { validateProductionTarget } from "@/lib/productionRevision";
import type { ProductionTarget } from "@/domain/production";

const id = z.string().trim().min(1).max(160);
export const generationSubmitSchema = z.object({
  connectorId: id, model: z.enum(["gpt-image-2", "gpt-image-2.5-flare", "gpt-image-2.5-sunburst", "gpt-image-2.5-ext", "MiniMax-H3", "veo-3.1-fast-generate-preview"]),
  target: z.object({ kind: z.enum(["shot", "character", "scene", "prop", "style"]), projectId: id, entityId: id,
    episodeId: id.optional(), slot: z.string().min(1).max(30) }).strict(),
  prompt: z.string().trim().min(1).max(32000),
  parameters: z.object({ size: z.string().max(30).optional(), resolution: z.string().max(10).optional(),
    duration: z.number().int().optional(), aspectRatio: z.string().max(10).optional(),
    mode: z.enum(["text", "frames", "reference"]).optional(),
    quality: z.enum(["low", "medium", "high", "xhigh", "max", "auto"]).optional(),
    version: z.enum(["flare", "sunburst"]).optional() }).strict().default({}),
  inputs: z.array(z.object({mediaId:id, role:z.enum(["first-frame", "last-frame", "reference-image", "reference-video"])}).strict()).max(16).default([]),
}).strict();
export type GenerationSubmitArgs = z.infer<typeof generationSubmitSchema>;
export const generationJobSchema = z.object({jobId:id}).strict();

export function profileRequest(args: GenerationSubmitArgs, provider: "apimart" | "aihubmix") {
  const target: ProductionTarget = validateProductionTarget(args.target);
  if (!target.slot) throw new Error("生成目标必须指定素材槽位");
  const kind: "image" | "video" = target.kind === "shot" && target.slot === "clip" ? "video" : "image";
  const p = args.parameters;
  const inputs = args.inputs;
  if (new Set(inputs.map((input) => `${input.role}:${input.mediaId}`)).size !== inputs.length) throw new Error("输入素材用途重复");
  const count = (role: string) => inputs.filter((input) => input.role === role).length;
  if (count("first-frame") > 1 || count("last-frame") > 1) throw new Error("首尾帧不能重复");
  const mode = p.mode ?? (inputs.length ? "reference" : "text");
  const parameters: Record<string, string | number | boolean> = {prompt:args.prompt};
  const disallow = (...keys: Array<keyof typeof p>) => { if (keys.some((key) => p[key] !== undefined)) throw new Error("当前模型不支持这些生成参数"); };
  if (kind === "image") {
    if (inputs.some((input) => input.role !== "reference-image")) throw new Error("图片槽位仅支持已验证的图片模型与参考图片输入");
    disallow("duration", "aspectRatio", "mode");
    parameters.n = 1;
    parameters.size = p.size ?? "auto";
    if (provider === "apimart") {
      if (!isApimartImageModel(args.model)) throw new Error("图片槽位仅支持已验证的 APIMart 图片模型与参考图片输入");
      const sizes = isApimartImageExt(args.model) ? IMAGE_EXT_RATIOS : IMAGE_RATIOS;
      const maxImages = args.model === "gpt-image-2" ? 15 : 16;
      if (![...sizes, "auto"].includes(String(parameters.size)) || !["1k", "2k", "4k"].includes(p.resolution ?? "1k") || inputs.length > maxImages) {
        throw new Error(isApimartImageExt(args.model)
          ? "APIMart GPT Image 2.5 Ext 比例、分辨率或参考图数量无效"
          : "APIMart GPT Image 比例、分辨率或参考图数量无效");
      }
      if (isApimartImage25(args.model)) {
        disallow("version");
        const quality = p.quality ?? "auto";
        if (!(IMAGE_QUALITIES as readonly string[]).includes(quality)) throw new Error("请选择 GPT Image 2.5 支持的画质");
        parameters.quality = quality;
        parameters.resolution = p.resolution ?? "1k";
      } else if (isApimartImageExt(args.model)) {
        disallow("quality");
        parameters.version = p.version ?? "flare";
        parameters.resolution = (p.resolution ?? "1k").toUpperCase();
      } else {
        disallow("quality", "version");
        parameters.resolution = p.resolution ?? "1k";
      }
    } else {
      if (args.model !== "gpt-image-2") throw new Error("AIHubMix 图片当前仅支持已验证的 GPT Image 2");
      disallow("resolution", "version");
      // Verified safe common size subset also valid for image editing.
      if (!["auto", "1024x1024", "1536x1024", "1024x1536"].includes(String(parameters.size))) throw new Error("AIHubMix GPT Image 2 使用 auto 或已验证的像素尺寸");
      parameters.output_format = "png";
      parameters.async = true;
      if (p.quality) {
        if (!["low", "medium", "high"].includes(p.quality)) throw new Error("AIHubMix GPT Image 2 画质仅支持 low、medium 或 high");
        parameters.quality = p.quality;
      }
    }
  } else {
    disallow("size", "quality", "version");
    if (mode === "text" && inputs.length || mode === "frames" && (!count("first-frame") || count("reference-image") || count("reference-video")) || mode === "reference" && (!inputs.length || count("first-frame") || count("last-frame"))) throw new Error("视频生成方式与明确的输入素材用途不匹配");
    parameters.mode = mode;
    if (provider === "apimart") {
      if (args.model !== "MiniMax-H3") throw new Error("APIMart 视频当前仅支持已验证的 MiniMax-H3");
      if (args.prompt.length > 7000 || count("reference-image") > 9) throw new Error("MiniMax H3 提示词或参考图片超出限制");
      if (count("reference-video")) throw new Error("APIMart 暂无本地视频上传适配，不能提交参考视频；请选择文字或图片输入");
      parameters.resolution = p.resolution ?? "2K";
      parameters.duration = p.duration ?? 5;
      if (!["768P", "2K"].includes(String(parameters.resolution)) || Number(parameters.duration) < 4 || Number(parameters.duration) > 15) throw new Error("MiniMax H3 分辨率须为 768P/2K，时长为 4–15 秒整数");
      if (mode === "frames") {
        if (p.aspectRatio !== undefined && p.aspectRatio !== "adaptive") throw new Error("首尾帧比例跟随输入图片");
      } else {
        parameters.aspect_ratio = p.aspectRatio ?? (mode === "reference" ? "adaptive" : "16:9");
        if (!(VIDEO_RATIOS as readonly string[]).includes(String(parameters.aspect_ratio)) && !(mode === "reference" && parameters.aspect_ratio === "adaptive")) throw new Error("MiniMax H3 视频比例无效");
      }
    } else {
      if (args.model !== "veo-3.1-fast-generate-preview") throw new Error("AIHubMix 视频当前仅支持已验证的 Veo 3.1 Fast");
      parameters.duration = p.duration ?? 8; parameters.resolution = p.resolution ?? "720p"; parameters.aspect_ratio = p.aspectRatio ?? "16:9";
      if (![4, 6, 8].includes(Number(parameters.duration)) || !["720p", "1080p", "4K"].includes(String(parameters.resolution)) || !["16:9", "9:16"].includes(String(parameters.aspect_ratio))) throw new Error("Veo 3.1 Fast 时长、分辨率或比例无效");
      if (parameters.resolution !== "720p" && parameters.duration !== 8 || mode === "reference" && parameters.duration !== 8 || count("reference-video") && parameters.resolution !== "720p") throw new Error("Veo 高分辨率/参考输入要求 8 秒，参考视频要求 720p");
      if (count("reference-image") > 3 || count("reference-video") > 1) throw new Error("Veo 最多 3 张参考图片与 1 段参考视频");
    }
  }
  return { target, kind, parameters, inputs };
}

export const GENERATION_PROFILES = [
  {provider:"apimart",model:"gpt-image-2",kind:"image",label:"GPT Image 2",sizes:[...IMAGE_RATIOS,"auto"],resolutions:["1k","2k","4k"],inputRoles:["reference-image"],maxImages:15},
  {provider:"apimart",model:"gpt-image-2.5-flare",kind:"image",label:"GPT Image 2.5 Flare",sizes:[...IMAGE_RATIOS,"auto"],resolutions:["1k","2k","4k"],qualities:[...IMAGE_QUALITIES],inputRoles:["reference-image"],maxImages:16},
  {provider:"apimart",model:"gpt-image-2.5-sunburst",kind:"image",label:"GPT Image 2.5 Sunburst",sizes:[...IMAGE_RATIOS,"auto"],resolutions:["1k","2k","4k"],qualities:[...IMAGE_QUALITIES],inputRoles:["reference-image"],maxImages:16},
  {provider:"apimart",model:"gpt-image-2.5-ext",kind:"image",label:"GPT Image 2.5 Ext",sizes:[...IMAGE_EXT_RATIOS,"auto"],resolutions:["1k","2k","4k"],versions:["flare","sunburst"],inputRoles:["reference-image"],maxImages:16},
  {provider:"apimart",model:"MiniMax-H3",kind:"video",label:"MiniMax H3",ratios:VIDEO_RATIOS,resolutions:["768P","2K"],duration:"整数4–15",inputRoles:["first-frame","last-frame","reference-image"],maxImages:9,imageFormats:["image/png","image/jpeg","image/webp"],imageDimensions:"256–5760px，宽高比0.4–2.5",maxImageBytes:20*1024*1024},
  {provider:"aihubmix",model:"gpt-image-2",kind:"image",label:"GPT Image 2",sizes:["auto","1024x1024","1536x1024","1024x1536"],inputRoles:["reference-image"],maxImages:16,requiresAsyncEnabled:true},
  {provider:"aihubmix",model:"veo-3.1-fast-generate-preview",kind:"video",label:"Veo 3.1 Fast",ratios:["16:9","9:16"],resolutions:["720p","1080p","4K"],durations:[4,6,8],inputRoles:["first-frame","last-frame","reference-image","reference-video"],constraints:"高分辨率和参考输入须8秒；参考视频须720p",requiresAsyncEnabled:true},
] as const;
