import { assertProjectToolScope, frozenProjectScope } from "./projectScope";
import * as repo from "@/db/repo";
import { db } from "@/db/database";
import { executeAtomicTool, AtomicToolRollbackError } from "@/db/agentTools";
import { flushPendingDrafts } from "@/lib/debouncedDraft";
import { validateGenerationDefaults } from "@/domain/output";
import { emptySlot, parseGenerationSlot } from "@/domain/slot";
import { CHARACTER_SLOTS, SCENE_SLOTS, PROP_SLOTS, STYLE_SLOTS, STUDIO_LIBRARY_ID, normalizeEpisodeStory, SHOT_STATUS_LABELS,
  type CharacterImageSlot, type SceneImageSlot, type PropImageSlot, type StyleImageSlot, type ShotPictureField, type Shot, type StoryBeat } from "@/domain/types";
import type { AgentToolContext, AgentToolDefinition } from "./tools";
import type { AgentToolPreview } from "@/domain/agent";
import * as s from "./businessSchemas";
import { bounded, getRow, listRows, navigation, projection, summarize, targetRevision, ownerSnapshot, mediaUsage, mediaRetention, assetMediaDependencies,
  requireOwner, requireEpisode, readTables, textAt, relationsAt, BUSINESS_LABELS, type AssetKind, type BusinessKind, type BusinessRow } from "./businessStore";

type PreviewState = { state: unknown; target?: AgentToolPreview["target"]; changes: string[] };
const fieldLabels: Record<string, string> = { mode: "作品模式", count: "数量", includeShots: "同时复制镜头", name: "名称", brief: "创作简述", genre: "类型", audience: "受众", tone: "基调", aspectPreset: "画幅", defaultStyleId: "默认风格", generationDefaults: "生成默认参数", logline: "一句话梗概", setting: "世界设定", coverMediaId: "封面", defaultDurationSec: "默认镜头时长", autoIncrementShotNumber: "自动递增镜号", title: "标题", script: "剧本", content: "内容", timeOfDay: "时段", characterIds: "角色", sceneId: "场景", propIds: "道具", styleId: "风格", inheritStyle: "继承项目风格", shotNumber: "镜号", status: "状态", durationSec: "时长（秒）", notes: "备注", category: "类别", sceneCloseup: "景别", sound: "声音", emotion: "情绪", cameraAngle: "机位", cameraGear: "器材", focalLength: "焦距", beatId: "所属场次", bio: "简介", appearance: "外观", personality: "性格", motivation: "动机", voice: "声音表达", location: "地点", atmosphere: "氛围", geography: "空间布局", lighting: "光线", kind: "类型", material: "材质", size: "尺寸", usage: "使用方式", continuity: "连续性", palette: "色彩", lens: "镜头气质", composition: "构图", negativePrompt: "避免出现", prompt: "画面描述", referenceImageIds: "参考图片", referenceVideoIds: "参考视频", result: "结果素材" };
function changes(patch: object): string[] {
  return Object.entries(patch).map(([key, value]) => {
    const enumLabels: Record<string, Record<string, string>> = {
      mode: { film: "电影", series: "剧集" }, status: SHOT_STATUS_LABELS,
      kind: { image: "图片", video: "视频", character: "角色", scene: "场景", prop: "道具", style: "风格", shot: "镜头", beat: "场次", episode: "分集", project: "项目" },
    };
    const text = value === null ? "清除" : typeof value === "boolean" ? value ? "是" : "否" : typeof value === "string" ? enumLabels[key]?.[value] ?? (value || "清空文本") : JSON.stringify(value);
    return `${fieldLabels[key] ?? key}：${text.length > 600 ? `${text.slice(0, 600)}…（共 ${text.length} 字符，可展开完整参数）` : text}`;
  });
}
function rowResult(kind: BusinessKind, row: BusinessRow) {
  return { ...summarize(kind, row), target: navigation(kind, row), revision: targetRevision(row) };
}
function readTool<T>(name: string, title: string, description: string, spec: s.Spec<T>, execute: (args: T, context?: AgentToolContext) => Promise<unknown>): AgentToolDefinition {
  return { name, title, description, effect: "read", parameters: spec.json, highRisk: () => false,
    parseArguments: (raw) => spec.schema.parse(raw),
    async execute(raw, context) { context.signal.throwIfAborted(); return db.transaction("r", [...readTables(), db.agentRuns, db.chatThreads], async () => { const args=spec.schema.parse(raw); await assertProjectToolScope(context,name,args,false); return execute(args,context); }); },
  };
}
function writeTool<T>(name: string, title: string, description: string, spec: s.Spec<T>,
  scope: (args: T) => string[], prepare: (args: T) => Promise<PreviewState>, execute: (args: T) => Promise<unknown>, highRisk = false): AgentToolDefinition {
  async function preview(args: T): Promise<AgentToolPreview> {
    const info = await prepare(args);
    return { summary: title, changes: info.changes, target: info.target, revision: targetRevision({ tool: name, args, state: info.state }) };
  }
  async function flush(args: T, context: AgentToolContext) {
    context.signal.throwIfAborted();
    for (const ownerId of new Set(scope(args))) await flushPendingDrafts(ownerId);
    context.signal.throwIfAborted();
  }
  return { name, title, description, effect: "write", atomic: true, parameters: spec.json, highRisk: () => highRisk,
    parseArguments: (raw) => spec.schema.parse(raw),
    async prepare(raw, context) {
      const args = spec.schema.parse(raw); await assertProjectToolScope(context,name,args,true); await flush(args, context);
      return db.transaction("r", readTables(), async () => await preview(args));
    },
    async execute(raw, context) {
      const args = spec.schema.parse(raw);
      try { await assertProjectToolScope(context,name,args,true); await flush(args, context); }
      catch (error) { throw new AtomicToolRollbackError(error instanceof Error ? error.message : "草稿保存失败，业务操作尚未开始"); }
      return executeAtomicTool(context, async () => {
        context.signal.throwIfAborted();
        await assertProjectToolScope(context,name,args,true);
        if (!context.preview?.revision || context.preview.revision !== (await preview(args)).revision) throw new Error("目标或影响范围已变化，请重新读取并提出操作，原批准不能覆盖新的内容");
        return execute(args);
      });
    },
  };
}
async function referenceDetails(patch: object, ownerId: string, episodeId?: string): Promise<{ references: unknown[]; changes: string[] }> {
  const fields = { ...patch } as Record<string, unknown>;
  const references: unknown[] = [];
  const relationKinds: Record<string, BusinessKind> = { characterIds: "character", propIds: "prop", sceneId: "scene", beatId: "beat", styleId: "style", defaultStyleId: "style", coverMediaId: "media" };
  for (const [field, kind] of Object.entries(relationKinds)) {
    const value = fields[field];
    if (value === undefined || value === null) continue;
    const ids = Array.isArray(value) ? value : [value];
    const labels: string[] = [];
    for (const id of ids) {
      const row = await getRow(kind, String(id), ownerId, episodeId);
      if (field === "coverMediaId" && (!String(row.mimeType).startsWith("image/") || !row.size)) throw new Error("封面必须是当前项目的可用图片");
      references.push(row);
      labels.push(`${String(row.name ?? row.title ?? row.filename ?? row.id)}（${row.id}）`);
    }
    fields[field] = Array.isArray(value) ? labels : labels[0];
  }
  return { references, changes: changes(fields) };
}
async function targetPreview(kind: BusinessKind, args: { id: string; ownerId: string; episodeId?: string }, patch: object, cascade = false): Promise<PreviewState> {
  const row = await getRow(kind, args.id, args.ownerId, args.episodeId);
  const detail = await referenceDetails(patch, args.ownerId, args.episodeId);
  const state = cascade ? await ownerSnapshot(args.ownerId) : { row, references: detail.references };
  return { state, target: navigation(kind, row), changes: detail.changes };
}
async function createPreview(ownerId: string, kind: BusinessKind, fields: object, episodeId?: string): Promise<PreviewState> {
  await requireOwner(ownerId, ["character", "scene", "prop", "style"].includes(kind));
  if (episodeId) await requireEpisode(ownerId, episodeId);
  const detail = await referenceDetails(fields, ownerId, episodeId);
  return { state: { ownerId, episodeId, references: detail.references }, changes: [`归属：${ownerId === STUDIO_LIBRARY_ID ? "工作室" : (await db.projects.get(ownerId))!.name}`, ...detail.changes] };
}
async function deletePreview(kind: BusinessKind, args: { id: string; ownerId: string; episodeId?: string }): Promise<PreviewState> {
  const info = await targetPreview(kind, args, {}, true);
  const [episodes, shots] = args.ownerId === STUDIO_LIBRARY_ID ? [[], []] : await Promise.all([listRows("episode", args.ownerId), listRows("shot", args.ownerId)]);
  let impact: string[];
  if (kind === "project") {
    const counts = await Promise.all((["character", "scene", "prop", "style", "media"] as const).map(async (asset) => `${(await listRows(asset, args.ownerId)).length} 个${BUSINESS_LABELS[asset]}`));
    impact = [`删除 ${episodes.length} 个分集、${shots.length} 个镜头、${counts.join("、")}及此项目的生成记录。`];
  } else if (kind === "episode") {
    if (episodes.length <= 1) throw new Error("不能删除项目的最后一个分集");
    impact = [`同时删除此分集的 ${shots.filter((shot) => shot.episodeId === args.id).length} 个镜头和全部场次；后续分集重新排序。`];
  } else if (kind === "beat") {
    const linked = shots.filter((shot) => shot.episodeId === args.episodeId && shot.beatId === args.id);
    impact = [`保留 ${linked.length} 个关联镜头并解除场次关联，清理此场次筛选。`];
  } else if (kind === "shot") {
    impact = ["删除该镜头并重排同集镜头；不再使用的素材会清理，共享素材保留。"];
  } else {
    const linkedShots = shots.filter((shot) => kind === "character" ? (shot.characterIds as string[]).includes(args.id) : kind === "scene" ? shot.sceneId === args.id : kind === "prop" ? (shot.propIds as string[] | undefined)?.includes(args.id) : shot.styleId === args.id);
    const linkedBeats = episodes.flatMap((episode) => normalizeEpisodeStory(episode.story).beats).filter((beat) => kind === "character" ? beat.characterIds.includes(args.id) : kind === "scene" && beat.sceneId === args.id);
    impact = [`清除 ${linkedShots.length} 个镜头、${linkedBeats.length} 个场次的关联；不再使用的素材会清理，共享素材保留。`];
    if (kind === "style" && (await db.projects.get(args.ownerId))?.defaultStyleId === args.id) impact.push("清除项目默认风格；显式使用此风格的镜头改为不使用风格。");
  }
  return { ...info, changes: [`删除「${info.target?.label}」。`, ...impact] };
}

const searchSpec = s.object({ kind: s.entityKind, ownerId: s.optional(s.id), episodeId: s.optional(s.id), query: s.optional(s.text(200)), ...s.page });
const detailSpec = s.object({ kind: s.entityKind, ownerId: s.optional(s.id), episodeId: s.optional(s.id), id: s.id });
const reads = [
  readTool("business_search", "查询创作资料", "按类型、明确归属和关键词查询项目、分集、场次、镜头、角色、场景、道具、风格或素材。除项目列表外必须提供 ownerId，工作室资产用 studio。结果仅候选，不根据同名结果自动操作；offset/limit 分页，最多50项。", searchSpec, async (args, context) => {
    const query = args.query?.trim().toLocaleLowerCase();
    const projectId=context?await frozenProjectScope(context):undefined;
    const rows = (await listRows(args.kind, args.ownerId, args.episodeId)).filter((row) => (!projectId || args.kind !== "project" || row.id===projectId) && (!query || JSON.stringify(projection(args.kind, row)).toLocaleLowerCase().includes(query)));
    rows.sort((a, b) => typeof a.order === "number" && typeof b.order === "number" ? a.order - b.order : a.id.localeCompare(b.id));
    const offset = args.offset ?? 0, limit = args.limit ?? 20;
    const items: Array<ReturnType<typeof summarize> & { target: ReturnType<typeof navigation> }> = [];
    for (const row of rows.slice(offset, offset + limit)) {
      const item = { ...summarize(args.kind, row), target: navigation(args.kind, row) };
      if (JSON.stringify([...items, item]).length > 60000) { if (!items.length) throw new Error("单条记录标识过长，无法返回"); break; }
      items.push(item);
    }
    return { items, total: rows.length, nextOffset: offset + items.length < rows.length ? offset + items.length : null };
  }),
  readTool("business_detail", "查看创作详情", "按稳定 ID 查看允许的创作字段、关系和版本，除项目外必须提供 ownerId，场次还需 episodeId。不返回扩展袋或文件内容。长内容显式截断，可用 business_read_text 分段读。", detailSpec, async (args) => {
    const row = await getRow(args.kind, args.id, args.ownerId, args.episodeId);
    const usage = args.kind === "media" ? await mediaUsage(args.ownerId!, args.id) : undefined;
    const retention = args.kind === "media" ? await mediaRetention(args.ownerId!, args.id) : undefined;
    return { ...bounded({ record: projection(args.kind, row), ...(usage ? { usage: usage.slice(0, 50), usageCount: usage.length, retention } : {}) }), revision: targetRevision(row), target: navigation(args.kind, row) };
  }),
  readTool("business_read_relations", "分段读取关联标识", "读取 characterIds、propIds、referenceImageIds 等标识数组，支持 slots.front.referenceImageIds 点路径，按 offset/limit 分页；不读取记录数组或内部扩展。", s.object({ kind: s.entityKind, ownerId: s.optional(s.id), episodeId: s.optional(s.id), id: s.id, field: s.text(100, 1), ...s.page }), async (args) => {
    const row = await getRow(args.kind, args.id, args.ownerId, args.episodeId);
    const ids = relationsAt(args.kind, row, args.field), offset = args.offset ?? 0, limit = args.limit ?? 50;
    return { id: row.id, field: args.field, ids: ids.slice(offset, offset + limit), total: ids.length, nextOffset: offset + limit < ids.length ? offset + limit : null, revision: targetRevision(row) };
  }),
  readTool("business_read_text", "分段读取创作文本", "读取详情中的文本字段，支持 story.script、story.logline、setting.worldview、slots.front.prompt 等点路径。每次最多12000字符，返回 totalLength/nextOffset；禁止内部扩展与文件字段。", s.object({ kind: s.entityKind, ownerId: s.optional(s.id), episodeId: s.optional(s.id), id: s.id, field: s.text(100, 1), offset: s.optional(s.number(0, 10000000, true)), limit: s.optional(s.number(1, 12000, true)) }), async (args) => {
    const row = await getRow(args.kind, args.id, args.ownerId, args.episodeId);
    const text = textAt(args.kind, row, args.field), offset = args.offset ?? 0, limit = args.limit ?? 6000;
    return { id: row.id, field: args.field, text: text.slice(offset, offset + limit), totalLength: text.length, nextOffset: offset + limit < text.length ? offset + limit : null, revision: targetRevision(row) };
  }),
];

const projectCreate = s.object({ name: s.text(200, 1), mode: s.optional(s.choice(["film", "series"])), aspectPreset: s.optional(s.choice(["21:9", "16:9", "4:3", "1:1", "3:4", "9:16"])) });
const projectUpdate = s.object({ id: s.id, patch: s.nonempty(s.object(s.projectFields)) });
const projectTools = [
  writeTool("project_create", "创建项目", "创建电影或剧集项目及首个分集，返回两个稳定 ID；后续操作须使用返回 ID。", projectCreate, () => [], async (args) => ({ state: {}, changes: changes(args) }), async (args) => {
    const project = await repo.createProject(args.name, args.mode, args.aspectPreset);
    return { ...rowResult("project", { ...project }), firstEpisodeId: (await repo.firstEpisode(project.id))!.id };
  }),
  writeTool("project_update", "修改项目资料", "修改明确项目的创作信息、梗概、世界设定、默认风格和经过验证的生成默认参数；不修改已有镜头。null 清除默认风格/封面/生成配置。", projectUpdate, (args) => [args.id], async (args) => {
    const row = await getRow("project", args.id);
    if (Object.hasOwn(args.patch, "generationDefaults")) {
      const errors = validateGenerationDefaults(args.patch.generationDefaults ?? undefined);
      if (errors.length) throw new Error(errors.join("；"));
    }
    const detail = await referenceDetails(args.patch, args.id);
    return { state: { row, references: detail.references }, target: navigation("project", row), changes: detail.changes };
  }, async ({ id, patch }) => {
    await getRow("project", id);
    const { logline, setting, coverMediaId, defaultDurationSec, autoIncrementShotNumber, ...details } = patch;
    if (Object.keys(details).length) await repo.patchProjectDetails(id, { ...details,
      ...(Object.hasOwn(details, "defaultStyleId") ? { defaultStyleId: details.defaultStyleId ?? undefined } : {}),
      ...(Object.hasOwn(details, "generationDefaults") ? { generationDefaults: details.generationDefaults ?? undefined } : {}) } as Parameters<typeof repo.patchProjectDetails>[1]);
    if (logline !== undefined) await repo.updateSeriesLogline(id, logline);
    if (setting !== undefined) await repo.updateWorldSetting(id, setting);
    if (Object.hasOwn(patch, "coverMediaId")) {
      if (coverMediaId) { const media = await getRow("media", coverMediaId, id); if (!String(media.mimeType).startsWith("image/") || !media.size) throw new Error("封面必须是当前项目的可用图片"); }
      await repo.patchProjectOutput(id, { coverMediaId });
    }
    if (defaultDurationSec !== undefined || autoIncrementShotNumber !== undefined) await repo.updateShotSettings(id, { defaultDurationSec, autoIncrementShotNumber });
    return rowResult("project", await getRow("project", id));
  }),
  writeTool("project_delete", "删除项目及内容", "永久删除指定项目及全部分集、镜头、资产和素材；审批预览绑定级联范围。工作室不能删除。", s.object({ id: s.id }), (args) => [args.id], (args) => deletePreview("project", { id: args.id, ownerId: args.id }), async (args) => { await repo.deleteProject(args.id); return { deletedId: args.id }; }, true),
];

const episodeTools = [
  writeTool("episode_create", "创建分集", "在明确项目内创建分集，可填写标题、梗概和剧本。", s.object({ ...s.owner, fields: s.optional(s.object(s.episodeFields)) }), (args) => [args.ownerId], (args) => createPreview(args.ownerId, "episode", args.fields ?? {}), async (args) => {
    const episode = await repo.addEpisode(args.ownerId); if (args.fields) await repo.updateEpisodeDraft(episode.id, args.fields);
    return rowResult("episode", await getRow("episode", episode.id, args.ownerId));
  }),
  writeTool("episode_update", "修改分集故事", "修改标题、梗概或剧本；保留现有场次并清理不再匹配的原文范围。", s.object({ ...s.target, patch: s.nonempty(s.object(s.episodeFields)) }), (args) => [args.ownerId], (args) => targetPreview("episode", args, args.patch), async (args) => { await repo.updateEpisodeDraft(args.id, args.patch); return rowResult("episode", await getRow("episode", args.id, args.ownerId)); }),
  writeTool("episode_delete", "删除分集", "删除分集、场次及其镜头，保护项目最后一集。", s.object(s.target), (args) => [args.ownerId], (args) => deletePreview("episode", args), async (args) => { await repo.deleteEpisode(args.id); return { deletedId: args.id }; }, true),
];
function beatPatch(patch: { sceneId?: string | null } & Record<string, unknown>): Partial<StoryBeat> {
  return { ...patch, ...(Object.hasOwn(patch, "sceneId") ? { sceneId: patch.sceneId ?? undefined } : {}) } as Partial<StoryBeat>;
}
function shotPatch(patch: { sceneId?: string | null; beatId?: string | null; styleId?: string | null; inheritStyle?: boolean } & Record<string, unknown>): Partial<Shot> {
  if (patch.inheritStyle && Object.hasOwn(patch, "styleId")) throw new Error("继承项目风格与显式风格不能同时设置");
  const { inheritStyle, ...rest } = patch;
  return { ...rest,
    ...(Object.hasOwn(patch, "sceneId") ? { sceneId: patch.sceneId ?? undefined } : {}),
    ...(Object.hasOwn(patch, "beatId") ? { beatId: patch.beatId ?? undefined } : {}),
    ...(inheritStyle ? { styleId: undefined } : {}),
  } as Partial<Shot>;
}
const beatTools = [
  writeTool("beat_create", "创建故事场次", "在明确项目分集中创建场次，可设置人物与场景；后续创建镜头会复制此时的角色和场景。", s.object({ ...s.episodeTarget, fields: s.optional(s.object(s.beatFields)) }), (args) => [args.ownerId], (args) => createPreview(args.ownerId, "beat", args.fields ?? {}, args.episodeId), async (args) => {
    const beat = await repo.addStoryBeat(args.episodeId); if (args.fields) await repo.patchStoryBeat(args.episodeId, beat.id, beatPatch(args.fields));
    return rowResult("beat", await getRow("beat", beat.id, args.ownerId, args.episodeId));
  }),
  writeTool("beat_update", "修改故事场次", "修改场次文本或角色、场景关联；不覆盖已有镜头。sceneId:null 解除场景。", s.object({ ...s.beatTarget, patch: s.nonempty(s.object(s.beatFields)) }), (args) => [args.ownerId], (args) => targetPreview("beat", args, args.patch), async (args) => { await repo.patchStoryBeat(args.episodeId, args.id, beatPatch(args.patch)); return rowResult("beat", await getRow("beat", args.id, args.ownerId, args.episodeId)); }),
  writeTool("beat_delete", "删除故事场次", "删除场次，保留其镜头并解除场次关联。", s.object(s.beatTarget), (args) => [args.ownerId], (args) => deletePreview("beat", args), async (args) => { await repo.deleteStoryBeat(args.episodeId, args.id); return { deletedId: args.id, linkedShotsPreserved: true }; }, true),
];
const shotTools = [
  writeTool("shot_create", "创建镜头", "在明确项目分集中创建1–20个镜头，可归属场次并复制其角色/场景；fields 应用于每个新镜头，后续可分别编辑。", s.object({ ...s.episodeTarget, count: s.optional(s.number(1, 20, true)), beatId: s.optional(s.id), fields: s.optional(s.object(s.shotFields)) }), (args) => [args.ownerId], async (args) => {
    const base = await createPreview(args.ownerId, "shot", { count: args.count ?? 1, ...args.fields }, args.episodeId);
    const project = (await db.projects.get(args.ownerId))!;
    return { ...base, state: { base: base.state, settings: project.shotSettings, beat: args.beatId ? await getRow("beat", args.beatId, args.ownerId, args.episodeId) : undefined } };
  }, async (args) => {
    const rows = await repo.addShots(args.ownerId, args.episodeId, args.count ?? 1, { beatId: args.beatId });
    for (const row of rows) if (args.fields) await repo.patchShot(row.id, shotPatch(args.fields));
    return { items: await Promise.all(rows.map(async (row) => rowResult("shot", await getRow("shot", row.id, args.ownerId, args.episodeId)))) };
  }),
  writeTool("shot_update", "修改镜头", "修改镜头文字、时长、手动状态或同项目资产关联。sceneId/beatId:null 清除关联；styleId:null 不用风格；inheritStyle:true 恢复继承，不能同时传 styleId。", s.object({ ...s.target, episodeId: s.id, patch: s.nonempty(s.object(s.shotFields)) }), (args) => [args.ownerId], (args) => targetPreview("shot", args, args.patch), async (args) => { await repo.patchShot(args.id, shotPatch(args.patch)); return rowResult("shot", await getRow("shot", args.id, args.ownerId, args.episodeId)); }),
  writeTool("shot_delete", "删除镜头", "删除指定镜头，重排当前分集；清理仅此镜头使用的素材并保护共享引用。", s.object({ ...s.target, episodeId: s.id }), (args) => [args.ownerId], (args) => deletePreview("shot", args), async (args) => { await repo.deleteEpisodeShots(args.episodeId, [args.id]); return { deletedId: args.id }; }, true),
];

const assetApi = {
  character: { add: repo.addCharacter, patch: repo.patchCharacter, remove: repo.deleteCharacter, copy: repo.copyStudioCharacter },
  scene: { add: repo.addScene, patch: repo.patchScene, remove: repo.deleteScene, copy: repo.copyStudioScene },
  prop: { add: repo.addProp, patch: repo.patchProp, remove: repo.deleteProp, copy: repo.copyStudioProp },
  style: { add: repo.addStyle, patch: repo.patchStyle, remove: repo.deleteStyle, copy: repo.copyStudioStyle },
};
const assetTools = (Object.keys(assetApi) as AssetKind[]).flatMap((kind): AgentToolDefinition[] => {
  const api = assetApi[kind], fields = s.object(s.assetFields[kind]), label = BUSINESS_LABELS[kind];
  return [
    writeTool(`${kind}_create`, `创建${label}`, `在明确项目或 studio 工作室中创建${label}；只接受此类资产的创作字段。`, s.object({ ...s.owner, fields: s.optional(fields) }), (args) => [args.ownerId], (args) => createPreview(args.ownerId, kind, args.fields ?? {}), async (args) => {
      const row = await api.add(args.ownerId); if (args.fields) await api.patch(row.id, args.fields);
      return rowResult(kind, await getRow(kind, row.id, args.ownerId));
    }),
    writeTool(`${kind}_update`, `修改${label}`, `修改明确归属的${label}创作字段；不可修改归属、来源、ID 或素材槽位。素材使用 slot_update。`, s.object({ ...s.target, patch: s.nonempty(fields) }), (args) => [args.ownerId], (args) => targetPreview(kind, args, args.patch), async (args) => { await api.patch(args.id, args.patch); return rowResult(kind, await getRow(kind, args.id, args.ownerId)); }),
    writeTool(`${kind}_delete`, `删除${label}`, `删除${label}并清理同项目引用，保护仍在使用的素材。项目快照和工作室来源相互独立。`, s.object(s.target), (args) => [args.ownerId], (args) => deletePreview(kind, args), async (args) => { await api.remove(args.id); return { deletedId: args.id }; }, true),
  ];
});

const reuseTools = [
  writeTool("asset_copy_from_studio", "复用工作室资产", "将工作室角色/场景/道具/风格复制为项目内独立快照，连同媒体复制到项目归属；禁止重复添加同一来源。", s.object({ kind: s.assetKind, sourceId: s.id, ownerId: s.id }), (args) => [args.ownerId, STUDIO_LIBRARY_ID], async (args) => {
    await requireOwner(args.ownerId, false);
    const source = await getRow(args.kind, args.sourceId, STUDIO_LIBRARY_ID);
    return { state: { source, media: await assetMediaDependencies(source), ownerId: args.ownerId }, target: navigation(args.kind, source), changes: [`复制「${source.name}」至项目「${(await db.projects.get(args.ownerId))!.name}」，含独立素材副本。`] };
  }, async (args) => { const row = await assetApi[args.kind].copy(args.ownerId, args.sourceId); return rowResult(args.kind, { ...row }); }),
  writeTool("creative_duplicate", "复制场次或镜头", "复制当前分集的指定场次或镜头。场次可显式 includeShots:true 一起复制最多20个关联镜头；不覆盖原项，共享本项目素材。", s.object({ kind: s.choice(["beat", "shot"]), ...s.beatTarget, includeShots: s.optional(s.bool) }), (args) => [args.ownerId], async (args) => {
    const row = await getRow(args.kind, args.id, args.ownerId, args.episodeId);
    const episode = await requireEpisode(args.ownerId, args.episodeId);
    const shots = await listRows("shot", args.ownerId, args.episodeId);
    const count = args.kind === "shot" ? 1 : args.includeShots ? shots.filter((shot) => shot.beatId === args.id).length : 0;
    if (count > 20) throw new Error("一次最多复制20个镜头，请分批复制");
    return { state: { episode, shots }, target: navigation(args.kind, row), changes: [`复制此${BUSINESS_LABELS[args.kind]}${args.kind === "beat" ? `，同时复制 ${count} 个关联镜头` : ""}；后续镜头重新排序。`] };
  }, async (args) => {
    if (args.kind === "shot") { const row = await repo.duplicateShot(args.id); return rowResult("shot", { ...row }); }
    const created = await repo.duplicateBeat(args.episodeId, args.id, { includeShots: args.includeShots });
    return { beat: rowResult("beat", await getRow("beat", created.beat.id, args.ownerId, args.episodeId)), shots: created.shots.map((row) => rowResult("shot", { ...row })) };
  }),
  writeTool("creative_reorder", "调整创作顺序", "提交当前范围完整且无重复的 orderedIds，最多100项。episode 在项目内排序；beat/shot 需 episodeId。场次顺序同时移动其镜头组，不改变关系。", s.object({ kind: s.choice(["episode", "beat", "shot"]), ...s.owner, episodeId: s.optional(s.id), orderedIds: s.ids }), (args) => [args.ownerId], async (args) => {
    await requireOwner(args.ownerId, false);
    if (args.kind !== "episode" && !args.episodeId) throw new Error("场次/镜头排序需要 episodeId");
    const rows = await listRows(args.kind, args.ownerId, args.episodeId);
    if (rows.length !== args.orderedIds.length || rows.some((row) => !args.orderedIds.includes(row.id))) throw new Error("排序必须包含当前范围的全部标识且不能重复");
    const order = new Map(rows.map((row) => [row.id, row]));
    return { state: { rows, ...(args.kind === "beat" ? { shots: await listRows("shot", args.ownerId, args.episodeId) } : {}) }, changes: args.orderedIds.map((id, index) => `${index + 1}. ${String(order.get(id)?.title ?? order.get(id)?.shotNumber ?? id)}`) };
  }, async (args) => {
    if (args.kind === "episode") await repo.reorderEpisodes(args.ownerId, args.orderedIds);
    else if (args.kind === "beat") await repo.reorderBeats(args.episodeId!, args.orderedIds);
    else await repo.reorderShots(args.episodeId!, args.orderedIds);
    return { kind: args.kind, orderedIds: args.orderedIds };
  }),
];

const slotSpec = s.object({ kind: s.choice(["character", "scene", "prop", "style", "shot"]), ...s.target, episodeId: s.optional(s.id), slot: s.text(30, 1), patch: s.slotPatch });
const mediaTools = [
  writeTool("slot_update", "修改素材槽位", "修改资产/镜头槽位描述、图片参考、视频参考或已有结果。只允许同归属真实媒体 ID；result:null 清除结果。角色 front/side/back/expression/costume；场景 wide/medium/detail；道具 hero/detail/worn；风格 look/light/lens；镜头 firstFrame/lastFrame/clip。只有 clip 结果允许视频。", slotSpec, (args) => [args.ownerId], async (args) => {
    const row = await getRow(args.kind, args.id, args.ownerId, args.episodeId);
    const slots = { character: CHARACTER_SLOTS.map((slot) => slot.id), scene: SCENE_SLOTS.map((slot) => slot.id), prop: PROP_SLOTS.map((slot) => slot.id), style: STYLE_SLOTS.map((slot) => slot.id), shot: ["firstFrame", "lastFrame", "clip"] };
    if (!(slots[args.kind] as readonly string[]).includes(args.slot)) throw new Error("素材槽位不属于此实体类型");
    if (args.kind === "shot" && !args.episodeId) throw new Error("镜头素材需要明确分集标识");
    if (args.patch.result?.kind === "video" && !(args.kind === "shot" && args.slot === "clip")) throw new Error("此槽位结果仅支持图片");
    const mediaIds = [...(args.patch.referenceImageIds ?? []), ...(args.patch.referenceVideoIds ?? []), ...(args.patch.result ? [args.patch.result.mediaId] : [])];
    const media = await Promise.all(mediaIds.map((id) => getRow("media", id, args.ownerId)));
    return { state: { row, media }, target: navigation(args.kind, row), changes: [`槽位：${args.slot}`, ...changes(args.patch)] };
  }, async (args) => {
    const row = await getRow(args.kind, args.id, args.ownerId, args.episodeId);
    const previous = args.kind === "shot" ? row[args.slot] : (row.slots as Record<string, unknown> | undefined)?.[args.slot];
    const { result, ...patch } = args.patch;
    const slot = { ...emptySlot(), ...parseGenerationSlot(previous), ...patch, ...(Object.hasOwn(args.patch, "result") ? { result: result ?? undefined } : {}) };
    if (args.kind === "character") await repo.setCharacterSlot(args.id, args.slot as CharacterImageSlot, slot);
    else if (args.kind === "scene") await repo.setSceneSlot(args.id, args.slot as SceneImageSlot, slot);
    else if (args.kind === "prop") await repo.setPropSlot(args.id, args.slot as PropImageSlot, slot);
    else if (args.kind === "style") await repo.setStyleSlot(args.id, args.slot as StyleImageSlot, slot);
    else await repo.setShotSlot(args.id, args.slot as ShotPictureField, slot);
    return { ...rowResult(args.kind, await getRow(args.kind, args.id, args.ownerId, args.episodeId)), slot: args.slot, value: slot };
  }),
  writeTool("media_delete_orphan", "清理未引用素材", "仅删除未被项目封面、资产、镜头、参考资料、生成任务或历史提案引用的真实媒体。使用中的文件不会删除；不支持任意文件或 Blob 写入。", s.object(s.target), (args) => [args.ownerId], async (args) => {
    const row = await getRow("media", args.id, args.ownerId);
    const usage = await mediaUsage(args.ownerId, args.id);
    if (usage.length) throw new Error(`素材仍有 ${usage.length} 处引用，请先明确解除关联`);
    const retention = await mediaRetention(args.ownerId, args.id);
    if (retention.proposals || retention.generationJobs) throw new Error(`素材仍被 ${retention.proposals} 个历史提案、${retention.generationJobs} 个生成任务保留，不能删除`);
    return { state: await ownerSnapshot(args.ownerId), target: navigation("media", row), changes: [`删除文件「${row.filename}」（${row.size} 字节）；如参考资料、生成任务或历史提案保留该文件则拒绝删除。`] };
  }, async (args) => { await repo.deleteMediaIfOrphan(args.id); if (await db.media.get(args.id)) throw new Error("素材仍被参考资料、生成任务或历史提案保留，未删除"); return { deletedId: args.id }; }, true),
];

export const BUSINESS_TOOLS: readonly AgentToolDefinition[] = [...reads, ...projectTools, ...episodeTools, ...beatTools, ...shotTools, ...assetTools, ...reuseTools, ...mediaTools];
export { BUSINESS_TOOL_GROUPS } from "./businessToolNames";
