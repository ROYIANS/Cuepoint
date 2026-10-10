import type {z} from "zod";
import type {TypedToolDefinition} from './toolDefinition';
import {defineTool} from './toolDefinition';
import {assertProjectToolScope, frozenProjectScope} from "./projectScope";
import {assertAgentProjectCreation, bindCreatedAgentProject} from "@/db/agentProjectCreation";
import {
    createAudioMusicProject,
    createProject,
    patchProjectDetails,
    patchProjectOutput,
    updateSeriesLogline,
    updateShotSettings,
    updateWorldSetting
} from "@/db/projects";
import {
    addEpisode,
    addStoryBeat,
    deleteEpisode,
    deleteStoryBeat,
    duplicateBeat,
    firstEpisode,
    patchStoryBeat,
    reorderBeats,
    reorderEpisodes,
    updateEpisodeDraft
} from "@/db/episodes";
import {deleteProject} from "@/db/cascadeCommands";
import {addShots, deleteEpisodeShots, duplicateShot, patchShot, reorderShots, setShotSlot} from "@/db/shots";
import {
    addCharacter,
    addProp,
    addScene,
    addStyle,
    deleteCharacter,
    deleteProp,
    deleteScene,
    deleteStyle,
    patchCharacter,
    patchProp,
    patchScene,
    patchStyle,
    setCharacterSlot,
    setPropSlot,
    setSceneSlot,
    setStyleSlot
} from "@/db/assets";
import {copyStudioCharacter, copyStudioProp, copyStudioScene, copyStudioStyle} from "@/db/assetReuse";
import {deleteMediaIfOrphan} from "@/db/media";
import {db} from "@/db/database";
import {AtomicToolRollbackError, executeAtomicTool} from "@/db/agentTools";
import {flushPendingDrafts} from "@/lib/debouncedDraft";
import {validateGenerationDefaults} from "@/domain/output";
import {emptySlot, parseGenerationSlot} from "@/domain/slot";
import {
    CHARACTER_SLOTS,
    type CharacterImageSlot,
    normalizeEpisodeStory,
    PROP_SLOTS,
    type PropImageSlot,
    SCENE_SLOTS,
    type SceneImageSlot,
    type Shot,
    SHOT_STATUS_LABELS,
    type ShotPictureField,
    type StoryBeat,
    STUDIO_LIBRARY_ID,
    STYLE_SLOTS,
    type StyleImageSlot
} from "@/domain/types";
import type {AgentToolContext} from "./tools";
import type {AgentToolPreview} from "@/domain/agent";
import * as s from "./businessSchemas";
import {captureBusinessDeletion, withBusinessWriteReceipt} from "./businessWriteReceipt";
import {
    assetMediaDependencies,
    bounded,
    BUSINESS_LABELS,
    type BusinessKind,
    type BusinessRow,
    businessRowText,
    getRow,
    isReadableBusinessFieldPath,
    listBusinessRecords,
    listRows,
    mediaRetention,
    mediaUsage,
    navigation,
    ownerSnapshot,
    projection,
    readBusinessRecord,
    readTables,
    relationsAt,
    requireEpisode,
    requireOwner,
    summarize,
    targetRevision,
    textAt
} from "./businessStore";

type PreviewState = { state: unknown; target?: AgentToolPreview["target"]; changes: string[] };
const fieldLabels: Record<string, string> = {
    continueInProject: "在当前对话继续创作",
    mode: "作品模式",
    count: "数量",
    includeShots: "同时复制镜头",
    name: "名称",
    brief: "创作简述",
    genre: "类型",
    audience: "受众",
    tone: "基调",
    aspectPreset: "画幅",
    defaultStyleId: "默认风格",
    generationDefaults: "生成默认参数",
    logline: "一句话梗概",
    setting: "世界设定",
    coverMediaId: "封面",
    defaultDurationSec: "默认镜头时长",
    autoIncrementShotNumber: "自动递增镜号",
    title: "标题",
    script: "剧本",
    content: "内容",
    timeOfDay: "时段",
    characterIds: "角色",
    sceneId: "场景",
    propIds: "道具",
    styleId: "风格",
    inheritStyle: "继承项目风格",
    shotNumber: "镜号",
    status: "状态",
    durationSec: "时长（秒）",
    notes: "备注",
    category: "类别",
    sceneCloseup: "景别",
    sound: "声音",
    emotion: "情绪",
    cameraAngle: "机位",
    cameraGear: "器材",
    focalLength: "焦距",
    beatId: "所属场次",
    bio: "简介",
    appearance: "外观",
    personality: "性格",
    motivation: "动机",
    voice: "声音表达",
    location: "地点",
    atmosphere: "氛围",
    geography: "空间布局",
    lighting: "光线",
    kind: "类型",
    material: "材质",
    size: "尺寸",
    usage: "使用方式",
    continuity: "连续性",
    palette: "色彩",
    lens: "镜头气质",
    composition: "构图",
    negativePrompt: "避免出现",
    prompt: "画面描述",
    referenceImageIds: "参考图片",
    referenceVideoIds: "参考视频",
    result: "结果素材"
};

function changes(patch: object): string[] {
    return Object.entries(patch).map(([key, value]) => {
        const enumLabels: Record<string, Record<string, string>> = {
            mode: {film: "电影", series: "剧集"}, status: SHOT_STATUS_LABELS,
            kind: {
                audio: "音频",
                music: "音乐",
                image: "图片",
                video: "视频",
                character: "角色",
                scene: "场景",
                prop: "道具",
                style: "风格",
                shot: "镜头",
                beat: "场次",
                episode: "分集",
                project: "项目"
            },
        };
        const text = value === null ? "清除" : typeof value === "boolean" ? value ? "是" : "否" : typeof value === "string" ? enumLabels[key]?.[value] ?? (value || "清空文本") : JSON.stringify(value);
        return `${fieldLabels[key] ?? key}：${text.length > 600 ? `${text.slice(0, 600)}…（共 ${text.length} 字符，可展开完整参数）` : text}`;
    });
}

function rowResult(kind: BusinessKind, row: BusinessRow) {
    return {...summarize(kind, row), target: navigation(kind, row), revision: targetRevision(row)};
}

function readTool<T, const Name extends string>(name: Name, title: string, description: string, spec: s.Spec<T>, execute: (args: NoInfer<T>, context?: AgentToolContext) => Promise<unknown>): TypedToolDefinition<T, Name> {
    return defineTool(spec, {
        name,
        title,
        description,
        effect: "read",
        highRisk: () => false,
        async execute(raw, context) {
            context.signal.throwIfAborted();
            return db.transaction("r", [...readTables(), db.agentRuns, db.chatThreads], async () => {
                const args = spec.schema.parse(raw);
                await assertProjectToolScope(context, name, args, false);
                return execute(args, context);
            });
        }
    });
}

type WriteHooks<Args> = {
    beforePreview?: (args: Args, context: AgentToolContext) => Promise<void>;
    beforeWrite?: (args: Args, context: AgentToolContext) => Promise<void>;
    completedReplay?: (args: Args, context: AgentToolContext) => Promise<{ value: unknown } | undefined>;
};

function writeTool<T, const Name extends string>(name: Name, title: string, description: string, spec: s.Spec<T>,
                                                 scope: (args: NoInfer<T>) => string[], prepare: (args: NoInfer<T>) => Promise<PreviewState>, execute: (args: NoInfer<T>, context: AgentToolContext) => Promise<unknown>, highRisk = false, hooks: WriteHooks<NoInfer<T>> = {}): TypedToolDefinition<T, Name> {
    async function preview(args: T): Promise<AgentToolPreview> {
        const info = await prepare(args);
        return {
            summary: title,
            changes: info.changes,
            target: info.target,
            revision: targetRevision({tool: name, args, state: info.state})
        };
    }

    async function flush(args: T, context: AgentToolContext) {
        context.signal.throwIfAborted();
        for (const ownerId of new Set(scope(args))) await flushPendingDrafts(ownerId);
        context.signal.throwIfAborted();
    }

    return defineTool(spec, {
        name,
        title,
        description,
        effect: "write",
        atomic: true,
        highRisk: () => highRisk,
        async prepare(raw, context) {
            const args = spec.schema.parse(raw);
            await assertProjectToolScope(context, name, args, true);
            await flush(args, context);
            return db.transaction("r", name === "project_create" ? db.tables : readTables(), async () => {
                await hooks.beforePreview?.(args, context);
                return preview(args);
            });
        },
        async execute(raw, context) {
            const args = spec.schema.parse(raw);
            try {
                const replay = await hooks.completedReplay?.(args, context);
                if (replay) return replay.value;
                await assertProjectToolScope(context, name, args, true);
                await flush(args, context);
            } catch (error) {
                throw new AtomicToolRollbackError(error instanceof Error ? error.message : "草稿保存失败，业务操作尚未开始");
            }
            return executeAtomicTool(context, async () => {
                context.signal.throwIfAborted();
                await assertProjectToolScope(context, name, args, true);
                if (!context.preview?.revision || context.preview.revision !== (await preview(args)).revision) throw new Error("目标或影响范围已变化，请重新读取并提出操作，原批准不能覆盖新的内容");
                await hooks.beforeWrite?.(args, context);
                const deleted = await captureBusinessDeletion(name, args);
                const result = await execute(args, context);
                return withBusinessWriteReceipt(name, args, result, deleted);
            });
        }
    });
}

async function referenceDetails(patch: object, ownerId: string, episodeId?: string): Promise<{
    references: unknown[];
    changes: string[]
}> {
    const fields = {...patch} as Record<string, unknown>;
    const references: unknown[] = [];
    const relationKinds: Record<string, BusinessKind> = {
        characterIds: "character",
        propIds: "prop",
        sceneId: "scene",
        beatId: "beat",
        styleId: "style",
        defaultStyleId: "style",
        coverMediaId: "media"
    };
    for (const [field, kind] of Object.entries(relationKinds)) {
        const value = fields[field];
        if (value === undefined || value === null) continue;
        const ids = Array.isArray(value) ? value : [value];
        const labels: string[] = [];
        for (const id of ids) {
            const row = await getRow(kind, String(id), ownerId, episodeId);
            if (field === "coverMediaId" && (!String(row.mimeType).startsWith("image/") || !row.size)) throw new Error("封面必须是当前项目的可用图片");
            references.push(row);
            labels.push(`${businessRowText(row, ["name", "title", "filename"], row.id)}（${row.id}）`);
        }
        fields[field] = Array.isArray(value) ? labels : labels[0];
    }
    return {references, changes: changes(fields)};
}

async function targetPreview(kind: BusinessKind, args: {
    id: string;
    ownerId: string;
    episodeId?: string
}, patch: object, cascade = false): Promise<PreviewState> {
    const row = await getRow(kind, args.id, args.ownerId, args.episodeId);
    const detail = await referenceDetails(patch, args.ownerId, args.episodeId);
    const state = cascade ? await ownerSnapshot(args.ownerId) : {row, references: detail.references};
    return {state, target: navigation(kind, row), changes: detail.changes};
}

async function createPreview(ownerId: string, kind: BusinessKind, fields: object, episodeId?: string): Promise<PreviewState> {
    await requireOwner(ownerId, ["character", "scene", "prop", "style"].includes(kind));
    if (episodeId) await requireEpisode(ownerId, episodeId);
    const detail = await referenceDetails(fields, ownerId, episodeId);
    return {
        state: {ownerId, episodeId, references: detail.references},
        changes: [`归属：${ownerId === STUDIO_LIBRARY_ID ? "工作室" : (await db.projects.get(ownerId))!.name}`, ...detail.changes]
    };
}

async function deletePreview(kind: BusinessKind, args: {
    id: string;
    ownerId: string;
    episodeId?: string
}): Promise<PreviewState> {
    const info = await targetPreview(kind, args, {}, true);
    const [episodes, shotRecords] = args.ownerId === STUDIO_LIBRARY_ID ? [[], []] : await Promise.all([listRows("episode", args.ownerId), listBusinessRecords("shot", args.ownerId)]);
    const shots = shotRecords.flatMap(record => record.kind === "shot" ? [record.row] : []);
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
        const linkedShots = shots.filter((shot) => kind === "character" ? shot.characterIds.includes(args.id) : kind === "scene" ? shot.sceneId === args.id : kind === "prop" ? shot.propIds?.includes(args.id) : shot.styleId === args.id);
        const linkedBeats = episodes.flatMap((episode) => normalizeEpisodeStory(episode.story).beats).filter((beat) => kind === "character" ? beat.characterIds.includes(args.id) : kind === "scene" && beat.sceneId === args.id);
        impact = [`清除 ${linkedShots.length} 个镜头、${linkedBeats.length} 个场次的关联；不再使用的素材会清理，共享素材保留。`];
        if (kind === "style" && (await db.projects.get(args.ownerId))?.defaultStyleId === args.id) impact.push("清除项目默认风格；显式使用此风格的镜头改为不使用风格。");
    }
    return {...info, changes: [`删除「${info.target?.label}」。`, ...impact]};
}

const searchSpec = s.object({
    kind: s.entityKind,
    ownerId: s.optional(s.id),
    episodeId: s.optional(s.id),
    query: s.optional(s.text(200)), ...s.page
});
const detailSpec = s.object({kind: s.entityKind, ownerId: s.optional(s.id), episodeId: s.optional(s.id), id: s.id});
const readTextBaseSpec = s.object({
    kind: s.entityKind,
    ownerId: s.optional(s.id),
    episodeId: s.optional(s.id),
    id: s.id,
    field: s.text(100, 1),
    offset: s.optional(s.number(0, 10000000, true)),
    limit: s.optional(s.number(1, 12000, true))
});
const readTextSpec = {
    ...readTextBaseSpec,
    schema: readTextBaseSpec.schema.superRefine((args, context) => {
        if (!isReadableBusinessFieldPath(args.kind, args.field)) context.addIssue({
            code: "custom", path: ["field"], message: "不是可读取的创作文本字段",
            params: {diagnosticCode: args.kind === "episode" && args.field === "script" ? "episode_script_path" : "business_field_path"},
        });
    }),
};
const reads = [
    readTool("business_search", "查询创作资料", "按类型、明确归属和关键词查询项目、分集、场次、镜头、角色、场景、道具、风格或素材。除项目列表外必须提供 ownerId，工作室资产用 studio。结果仅候选，不根据同名结果自动操作；offset/limit 分页，最多50项。", searchSpec, async (args, context) => {
        const query = args.query?.trim().toLocaleLowerCase();
        const projectId = context ? await frozenProjectScope(context) : undefined;
        const rows = (await listRows(args.kind, args.ownerId, args.episodeId)).filter((row) => (!projectId || args.kind !== "project" || row.id === projectId) && (!query || JSON.stringify(projection(args.kind, row)).toLocaleLowerCase().includes(query)));
        rows.sort((a, b) => typeof a.order === "number" && typeof b.order === "number" ? a.order - b.order : a.id.localeCompare(b.id));
        const offset = args.offset ?? 0, limit = args.limit ?? 20;
        const items: Array<ReturnType<typeof summarize> & { target: ReturnType<typeof navigation> }> = [];
        for (const row of rows.slice(offset, offset + limit)) {
            const item = {...summarize(args.kind, row), target: navigation(args.kind, row)};
            if (JSON.stringify([...items, item]).length > 60000) {
                if (!items.length) throw new Error("单条记录标识过长，无法返回");
                break;
            }
            items.push(item);
        }
        return {
            items,
            total: rows.length,
            nextOffset: offset + items.length < rows.length ? offset + items.length : null
        };
    }),
    readTool("business_detail", "查看创作详情", "按稳定 ID 查看允许的创作字段、关系和版本，除项目外必须提供 ownerId，场次还需 episodeId。不返回扩展袋或文件内容。长内容显式截断，可用 business_read_text 分段读。", detailSpec, async (args) => {
        const row = await getRow(args.kind, args.id, args.ownerId, args.episodeId);
        const usage = args.kind === "media" ? await mediaUsage(args.ownerId!, args.id) : undefined;
        const retention = args.kind === "media" ? await mediaRetention(args.ownerId!, args.id) : undefined;
        return {
            ...bounded({
                record: projection(args.kind, row), ...(usage ? {
                    usage: usage.slice(0, 50),
                    usageCount: usage.length,
                    retention
                } : {})
            }), revision: targetRevision(row), target: navigation(args.kind, row)
        };
    }),
    readTool("business_read_relations", "分段读取关联标识", "读取 characterIds、propIds、referenceImageIds 等标识数组，支持 slots.front.referenceImageIds 点路径，按 offset/limit 分页；不读取记录数组或内部扩展。", s.object({
        kind: s.entityKind,
        ownerId: s.optional(s.id),
        episodeId: s.optional(s.id),
        id: s.id,
        field: s.text(100, 1), ...s.page
    }), async (args) => {
        const row = await getRow(args.kind, args.id, args.ownerId, args.episodeId);
        const ids = relationsAt(args.kind, row, args.field), offset = args.offset ?? 0, limit = args.limit ?? 50;
        return {
            id: row.id,
            field: args.field,
            ids: ids.slice(offset, offset + limit),
            total: ids.length,
            nextOffset: offset + limit < ids.length ? offset + limit : null,
            revision: targetRevision(row)
        };
    }),
    readTool("business_read_text", "分段读取创作文本", "读取详情中的文本字段，支持 story.script、story.logline、setting.worldview、slots.front.prompt 等点路径。分集 episode 的剧本字段是 story.script，不是 script。每次最多12000字符，返回 totalLength/nextOffset；禁止内部扩展与文件字段。", readTextSpec, async (args) => {
        const row = await getRow(args.kind, args.id, args.ownerId, args.episodeId);
        const text = textAt(args.kind, row, args.field), offset = args.offset ?? 0, limit = args.limit ?? 6000;
        return {
            id: row.id,
            field: args.field,
            text: text.slice(offset, offset + limit),
            totalLength: text.length,
            nextOffset: offset + limit < text.length ? offset + limit : null,
            revision: targetRevision(row)
        };
    }),
];

const projectCreateBase = s.object({
    continueInProject: s.optional(s.bool),
    kind: s.optional(s.choice(["video", "audio", "music"])),
    name: s.text(200, 1),
    mode: s.optional(s.choice(["film", "series"])),
    aspectPreset: s.optional(s.choice(["21:9", "16:9", "4:3", "1:1", "3:4", "9:16"]))
});
const projectCreate = {
    ...projectCreateBase,
    schema: projectCreateBase.schema.superRefine((args, context) => {
        if (args.kind === "audio" || args.kind === "music") {
            for (const field of ["mode", "aspectPreset"] as const) if (args[field] !== undefined) {
                context.addIssue({code: "custom", path: [field], message: "音频和音乐项目不接受视频模式或画幅"});
            }
        }
    }),
};
const projectUpdate = s.object({id: s.id, patch: s.nonempty(s.object(s.projectFields))});

function createdProjectResultId(raw: string | undefined): string | undefined {
    const result: unknown = raw ? JSON.parse(raw) : undefined;
    if (!result || typeof result !== "object" || Array.isArray(result) || !("id" in result) || typeof result.id !== "string") return;
    return result.id;
}

const projectTools = [
    writeTool("project_create", "创建项目", "创建视频、音频或音乐项目。kind 缺省为 video；mode/aspectPreset 仅用于视频。返回真实 ID。仅未绑定普通智能对话可创建；默认绑定新项目并继续创作，continueInProject=false 则仅创建、不绑定。", projectCreate, () => [], (args) => Promise.resolve({
        state: {creationContract: 2, continueInProject: args.continueInProject !== false}, changes: [
            ...changes({...args, kind: args.kind ?? "video"}),
            args.kind === "audio" ? "初始化第一章和人声轨" : args.kind === "music" ? "初始化音乐创作草稿" : "初始化首个分集",
            args.continueInProject === false ? "仅创建项目，当前对话保持未绑定；可从结果入口开启项目对话。" : "创建后将此对话绑定新项目，并在当前执行中继续创作。",
        ]
    }), async (args, context) => {
        const kind = args.kind ?? "video";
        const project = kind === "video" ? await createProject(args.name, args.mode, args.aspectPreset) : await createAudioMusicProject(args.name, kind);
        if (args.continueInProject !== false) await bindCreatedAgentProject(context, project.id);
        const result = {
            ...rowResult("project", {...project}), projectKind: kind,
            continuation: {
                projectId: project.id,
                action: args.continueInProject === false ? "new_project_conversation" : "current_project_conversation",
                note: args.continueInProject === false ? "当前对话未绑定，可从结果入口开启项目对话。" : "当前对话已绑定这个新项目。请立即在同一次执行的下一轮读取项目并继续用户已要求的创作，无需再让用户发送开始或继续。"
            }
        };
        if (kind === "audio") return {
            ...result,
            firstChapterId: (await db.audioChapters.where("projectId").equals(project.id).first())!.id,
            firstTrackId: (await db.audioTracks.where("projectId").equals(project.id).first())!.id
        };
        if (kind === "music") return {
            ...result,
            firstDraftId: (await db.musicDrafts.where("projectId").equals(project.id).first())!.id
        };
        return {...result, firstEpisodeId: (await firstEpisode(project.id))!.id};
    }, false, {
        beforePreview: async (args, context) => {
            await assertAgentProjectCreation(context, args.continueInProject !== false);
        },
        beforeWrite: async (args, context) => {
            await assertAgentProjectCreation(context, args.continueInProject !== false, true);
        },
        completedReplay: async (args, context) => {
            return db.transaction("rw", db.tables, async () => {
                const call = await db.agentToolCalls.get(context.callId);
                if (call?.status !== "completed") return undefined;
                if (call.name !== "project_create" || targetRevision(projectCreate.schema.parse(JSON.parse(call.arguments))) !== targetRevision(args)) throw new Error("创建项目的重放参数与原调用不匹配");
                const resultId = createdProjectResultId(call.result);
                const run = await db.agentRuns.get(context.runId);
                const continued = args.continueInProject !== false;
                if (!resultId || !await db.projects.get(resultId) || (context.projectId !== undefined && context.projectId !== resultId) ||
                    (continued && (run?.createdProjectBinding?.callId !== call.id || run.createdProjectBinding.projectId !== resultId || run.projectId !== resultId)) ||
                    (!continued && run?.projectId)) throw new Error("已创建项目不存在或来源不匹配，不能重放");
                return {
                    value: await executeAtomicTool(context, () => {
                        throw new Error("创建项目重放状态已变化");
                    })
                };
            });
        },
    }),
    writeTool("project_update", "修改项目资料", "修改明确项目的创作信息、梗概、世界设定、默认风格和经过验证的生成默认参数；不修改已有镜头。null 清除默认风格/封面/生成配置。", projectUpdate, (args) => [args.id], async (args) => {
        const row = await getRow("project", args.id);
        if (Object.hasOwn(args.patch, "generationDefaults")) {
            const errors = validateGenerationDefaults(args.patch.generationDefaults ?? undefined);
            if (errors.length) throw new Error(errors.join("；"));
        }
        const detail = await referenceDetails(args.patch, args.id);
        return {
            state: {row, references: detail.references},
            target: navigation("project", row),
            changes: detail.changes
        };
    }, async ({id, patch}) => {
        await getRow("project", id);
        const {logline, setting, coverMediaId, defaultDurationSec, autoIncrementShotNumber, ...details} = patch;
        if (Object.keys(details).length) {
            const nativeDetails: Parameters<typeof patchProjectDetails>[1] = {
                ...details, defaultStyleId: details.defaultStyleId ?? undefined,
                generationDefaults: details.generationDefaults ?? undefined,
            };
            if (!Object.hasOwn(details, "defaultStyleId")) delete nativeDetails.defaultStyleId;
            if (!Object.hasOwn(details, "generationDefaults")) delete nativeDetails.generationDefaults;
            await patchProjectDetails(id, nativeDetails);
        }
        if (logline !== undefined) await updateSeriesLogline(id, logline);
        if (setting !== undefined) await updateWorldSetting(id, setting);
        if (Object.hasOwn(patch, "coverMediaId")) {
            if (coverMediaId) {
                const media = await getRow("media", coverMediaId, id);
                if (!String(media.mimeType).startsWith("image/") || !media.size) throw new Error("封面必须是当前项目的可用图片");
            }
            await patchProjectOutput(id, {coverMediaId});
        }
        if (defaultDurationSec !== undefined || autoIncrementShotNumber !== undefined) await updateShotSettings(id, {
            defaultDurationSec,
            autoIncrementShotNumber
        });
        return rowResult("project", await getRow("project", id));
    }),
    writeTool("project_delete", "删除项目及内容", "永久删除指定项目及全部分集、镜头、资产和素材；审批预览绑定级联范围。工作室不能删除。", s.object({id: s.id}), (args) => [args.id], (args) => deletePreview("project", {
        id: args.id,
        ownerId: args.id
    }), async (args) => {
        await deleteProject(args.id);
        return {deletedId: args.id};
    }, true),
];

const episodeTools = [
    writeTool("episode_create", "创建分集", "在明确项目内创建分集，可填写标题、梗概和剧本。", s.object({
        ...s.owner,
        fields: s.optional(s.object(s.episodeFields))
    }), (args) => [args.ownerId], (args) => createPreview(args.ownerId, "episode", args.fields ?? {}), async (args) => {
        const episode = await addEpisode(args.ownerId);
        if (args.fields) await updateEpisodeDraft(episode.id, args.fields);
        return rowResult("episode", await getRow("episode", episode.id, args.ownerId));
    }),
    writeTool("episode_update", "修改分集故事", "修改标题、梗概或剧本；保留现有场次并清理不再匹配的原文范围。", s.object({
        ...s.target,
        patch: s.nonempty(s.object(s.episodeFields))
    }), (args) => [args.ownerId], (args) => targetPreview("episode", args, args.patch), async (args) => {
        await updateEpisodeDraft(args.id, args.patch);
        return rowResult("episode", await getRow("episode", args.id, args.ownerId));
    }),
    writeTool("episode_delete", "删除分集", "删除分集、场次及其镜头，保护项目最后一集。", s.object(s.target), (args) => [args.ownerId], (args) => deletePreview("episode", args), async (args) => {
        await deleteEpisode(args.id);
        return {deletedId: args.id};
    }, true),
];

const beatFieldsSpec = s.object(s.beatFields);
const shotFieldsSpec = s.object(s.shotFields);

function beatPatch(patch: z.output<typeof beatFieldsSpec.schema>): Partial<StoryBeat> {
    const nativePatch: Partial<StoryBeat> = {...patch, sceneId: patch.sceneId ?? undefined};
    if (!Object.hasOwn(patch, "sceneId")) delete nativePatch.sceneId;
    return nativePatch;
}

function shotPatch(patch: z.output<typeof shotFieldsSpec.schema>): Partial<Shot> {
    if (patch.inheritStyle && Object.hasOwn(patch, "styleId")) throw new Error("继承项目风格与显式风格不能同时设置");
    const {inheritStyle, ...rest} = patch;
    const nativePatch: Partial<Shot> = {
        ...rest,
        sceneId: patch.sceneId ?? undefined,
        beatId: patch.beatId ?? undefined
    };
    if (!Object.hasOwn(patch, "sceneId")) delete nativePatch.sceneId;
    if (!Object.hasOwn(patch, "beatId")) delete nativePatch.beatId;
    if (inheritStyle) nativePatch.styleId = undefined;
    return nativePatch;
}

const beatTools = [
    writeTool("beat_create", "创建故事场次", "在明确项目分集中创建场次，可设置人物与场景；后续创建镜头会复制此时的角色和场景。", s.object({
        ...s.episodeTarget,
        fields: s.optional(s.object(s.beatFields))
    }), (args) => [args.ownerId], (args) => createPreview(args.ownerId, "beat", args.fields ?? {}, args.episodeId), async (args) => {
        const beat = await addStoryBeat(args.episodeId);
        if (args.fields) await patchStoryBeat(args.episodeId, beat.id, beatPatch(args.fields));
        return rowResult("beat", await getRow("beat", beat.id, args.ownerId, args.episodeId));
    }),
    writeTool("beat_update", "修改故事场次", "修改场次文本或角色、场景关联；不覆盖已有镜头。sceneId:null 解除场景。", s.object({
        ...s.beatTarget,
        patch: s.nonempty(s.object(s.beatFields))
    }), (args) => [args.ownerId], (args) => targetPreview("beat", args, args.patch), async (args) => {
        await patchStoryBeat(args.episodeId, args.id, beatPatch(args.patch));
        return rowResult("beat", await getRow("beat", args.id, args.ownerId, args.episodeId));
    }),
    writeTool("beat_delete", "删除故事场次", "删除场次，保留其镜头并解除场次关联。", s.object(s.beatTarget), (args) => [args.ownerId], (args) => deletePreview("beat", args), async (args) => {
        await deleteStoryBeat(args.episodeId, args.id);
        return {deletedId: args.id, linkedShotsPreserved: true};
    }, true),
];
const shotTools = [
    writeTool("shot_create", "创建镜头", "在明确项目分集中创建1–20个镜头，可归属场次并复制其角色/场景；fields 应用于每个新镜头，后续可分别编辑。", s.object({
        ...s.episodeTarget,
        count: s.optional(s.number(1, 20, true)),
        beatId: s.optional(s.id),
        fields: s.optional(s.object(s.shotFields))
    }), (args) => [args.ownerId], async (args) => {
        const base = await createPreview(args.ownerId, "shot", {count: args.count ?? 1, ...args.fields}, args.episodeId);
        const project = (await db.projects.get(args.ownerId))!;
        return {
            ...base,
            state: {
                base: base.state,
                settings: project.shotSettings,
                beat: args.beatId ? await getRow("beat", args.beatId, args.ownerId, args.episodeId) : undefined
            }
        };
    }, async (args) => {
        const rows = await addShots(args.ownerId, args.episodeId, args.count ?? 1, {beatId: args.beatId});
        for (const row of rows) if (args.fields) await patchShot(row.id, shotPatch(args.fields));
        return {items: await Promise.all(rows.map(async (row) => rowResult("shot", await getRow("shot", row.id, args.ownerId, args.episodeId))))};
    }),
    writeTool("shot_update", "修改镜头", "修改镜头文字、时长、手动状态或同项目资产关联。sceneId/beatId:null 清除关联；styleId:null 不用风格；inheritStyle:true 恢复继承，不能同时传 styleId。", s.object({
        ...s.target,
        episodeId: s.id,
        patch: s.nonempty(s.object(s.shotFields))
    }), (args) => [args.ownerId], (args) => targetPreview("shot", args, args.patch), async (args) => {
        await patchShot(args.id, shotPatch(args.patch));
        return rowResult("shot", await getRow("shot", args.id, args.ownerId, args.episodeId));
    }),
    writeTool("shot_delete", "删除镜头", "删除指定镜头，重排当前分集；清理仅此镜头使用的素材并保护共享引用。", s.object({
        ...s.target,
        episodeId: s.id
    }), (args) => [args.ownerId], (args) => deletePreview("shot", args), async (args) => {
        await deleteEpisodeShots(args.episodeId, [args.id]);
        return {deletedId: args.id};
    }, true),
];

const assetApi = {
    character: {
        add: addCharacter,
        patch: patchCharacter,
        remove: deleteCharacter,
        copy: copyStudioCharacter
    },
    scene: {add: addScene, patch: patchScene, remove: deleteScene, copy: copyStudioScene},
    prop: {add: addProp, patch: patchProp, remove: deleteProp, copy: copyStudioProp},
    style: {add: addStyle, patch: patchStyle, remove: deleteStyle, copy: copyStudioStyle},
};
const assetTools = [

    writeTool("character_create", `创建角色`, `在明确项目或 studio 工作室中创建角色；只接受此类资产的创作字段。`, s.object({
        ...s.owner,
        fields: s.optional(s.object(s.assetFields.character))
    }), (args) => [args.ownerId], (args) => createPreview(args.ownerId, "character", args.fields ?? {}), async (args) => {
        const row = await addCharacter(args.ownerId);
        if (args.fields) await patchCharacter(row.id, args.fields);
        return rowResult("character", await getRow("character", row.id, args.ownerId));
    }),
    writeTool("character_update", `修改角色`, `修改明确归属的角色创作字段；不可修改归属、来源、ID 或素材槽位。素材使用 slot_update。`, s.object({
        ...s.target,
        patch: s.nonempty(s.object(s.assetFields.character))
    }), (args) => [args.ownerId], (args) => targetPreview("character", args, args.patch), async (args) => {
        await patchCharacter(args.id, args.patch);
        return rowResult("character", await getRow("character", args.id, args.ownerId));
    }),
    writeTool("character_delete", `删除角色`, `删除角色并清理同项目引用，保护仍在使用的素材。项目快照和工作室来源相互独立。`, s.object(s.target), (args) => [args.ownerId], (args) => deletePreview("character", args), async (args) => {
        await deleteCharacter(args.id);
        return {deletedId: args.id};
    }, true),

    writeTool("scene_create", `创建场景`, `在明确项目或 studio 工作室中创建场景；只接受此类资产的创作字段。`, s.object({
        ...s.owner,
        fields: s.optional(s.object(s.assetFields.scene))
    }), (args) => [args.ownerId], (args) => createPreview(args.ownerId, "scene", args.fields ?? {}), async (args) => {
        const row = await addScene(args.ownerId);
        if (args.fields) await patchScene(row.id, args.fields);
        return rowResult("scene", await getRow("scene", row.id, args.ownerId));
    }),
    writeTool("scene_update", `修改场景`, `修改明确归属的场景创作字段；不可修改归属、来源、ID 或素材槽位。素材使用 slot_update。`, s.object({
        ...s.target,
        patch: s.nonempty(s.object(s.assetFields.scene))
    }), (args) => [args.ownerId], (args) => targetPreview("scene", args, args.patch), async (args) => {
        await patchScene(args.id, args.patch);
        return rowResult("scene", await getRow("scene", args.id, args.ownerId));
    }),
    writeTool("scene_delete", `删除场景`, `删除场景并清理同项目引用，保护仍在使用的素材。项目快照和工作室来源相互独立。`, s.object(s.target), (args) => [args.ownerId], (args) => deletePreview("scene", args), async (args) => {
        await deleteScene(args.id);
        return {deletedId: args.id};
    }, true),

    writeTool("prop_create", `创建道具`, `在明确项目或 studio 工作室中创建道具；只接受此类资产的创作字段。`, s.object({
        ...s.owner,
        fields: s.optional(s.object(s.assetFields.prop))
    }), (args) => [args.ownerId], (args) => createPreview(args.ownerId, "prop", args.fields ?? {}), async (args) => {
        const row = await addProp(args.ownerId);
        if (args.fields) await patchProp(row.id, args.fields);
        return rowResult("prop", await getRow("prop", row.id, args.ownerId));
    }),
    writeTool("prop_update", `修改道具`, `修改明确归属的道具创作字段；不可修改归属、来源、ID 或素材槽位。素材使用 slot_update。`, s.object({
        ...s.target,
        patch: s.nonempty(s.object(s.assetFields.prop))
    }), (args) => [args.ownerId], (args) => targetPreview("prop", args, args.patch), async (args) => {
        await patchProp(args.id, args.patch);
        return rowResult("prop", await getRow("prop", args.id, args.ownerId));
    }),
    writeTool("prop_delete", `删除道具`, `删除道具并清理同项目引用，保护仍在使用的素材。项目快照和工作室来源相互独立。`, s.object(s.target), (args) => [args.ownerId], (args) => deletePreview("prop", args), async (args) => {
        await deleteProp(args.id);
        return {deletedId: args.id};
    }, true),

    writeTool("style_create", `创建风格`, `在明确项目或 studio 工作室中创建风格；只接受此类资产的创作字段。`, s.object({
        ...s.owner,
        fields: s.optional(s.object(s.assetFields.style))
    }), (args) => [args.ownerId], (args) => createPreview(args.ownerId, "style", args.fields ?? {}), async (args) => {
        const row = await addStyle(args.ownerId);
        if (args.fields) await patchStyle(row.id, args.fields);
        return rowResult("style", await getRow("style", row.id, args.ownerId));
    }),
    writeTool("style_update", `修改风格`, `修改明确归属的风格创作字段；不可修改归属、来源、ID 或素材槽位。素材使用 slot_update。`, s.object({
        ...s.target,
        patch: s.nonempty(s.object(s.assetFields.style))
    }), (args) => [args.ownerId], (args) => targetPreview("style", args, args.patch), async (args) => {
        await patchStyle(args.id, args.patch);
        return rowResult("style", await getRow("style", args.id, args.ownerId));
    }),
    writeTool("style_delete", `删除风格`, `删除风格并清理同项目引用，保护仍在使用的素材。项目快照和工作室来源相互独立。`, s.object(s.target), (args) => [args.ownerId], (args) => deletePreview("style", args), async (args) => {
        await deleteStyle(args.id);
        return {deletedId: args.id};
    }, true),
];

const reuseTools = [
    writeTool("asset_copy_from_studio", "复用工作室资产", "将工作室角色/场景/道具/风格复制为项目内独立快照，连同媒体复制到项目归属；禁止重复添加同一来源。", s.object({
        kind: s.assetKind,
        sourceId: s.id,
        ownerId: s.id
    }), (args) => [args.ownerId, STUDIO_LIBRARY_ID], async (args) => {
        await requireOwner(args.ownerId, false);
        const source = await getRow(args.kind, args.sourceId, STUDIO_LIBRARY_ID);
        return {
            state: {source, media: await assetMediaDependencies(source), ownerId: args.ownerId},
            target: navigation(args.kind, source),
            changes: [`复制「${businessRowText(source, ["name"], source.id)}」至项目「${(await db.projects.get(args.ownerId))!.name}」，含独立素材副本。`]
        };
    }, async (args) => {
        const row = await assetApi[args.kind].copy(args.ownerId, args.sourceId);
        return rowResult(args.kind, {...row});
    }),
    writeTool("creative_duplicate", "复制场次或镜头", "复制当前分集的指定场次或镜头。场次可显式 includeShots:true 一起复制最多20个关联镜头；不覆盖原项，共享本项目素材。", s.object({
        kind: s.choice(["beat", "shot"]), ...s.beatTarget,
        includeShots: s.optional(s.bool)
    }), (args) => [args.ownerId], async (args) => {
        const row = await getRow(args.kind, args.id, args.ownerId, args.episodeId);
        const episode = await requireEpisode(args.ownerId, args.episodeId);
        const shots = (await listBusinessRecords("shot", args.ownerId, args.episodeId)).flatMap(record => record.kind === "shot" ? [record.row] : []);
        const count = args.kind === "shot" ? 1 : args.includeShots ? shots.filter((shot) => shot.beatId === args.id).length : 0;
        if (count > 20) throw new Error("一次最多复制20个镜头，请分批复制");
        return {
            state: {episode, shots},
            target: navigation(args.kind, row),
            changes: [`复制此${BUSINESS_LABELS[args.kind]}${args.kind === "beat" ? `，同时复制 ${count} 个关联镜头` : ""}；后续镜头重新排序。`]
        };
    }, async (args) => {
        if (args.kind === "shot") {
            const row = await duplicateShot(args.id);
            return rowResult("shot", {...row});
        }
        const created = await duplicateBeat(args.episodeId, args.id, {includeShots: args.includeShots});
        return {
            beat: rowResult("beat", await getRow("beat", created.beat.id, args.ownerId, args.episodeId)),
            shots: created.shots.map((row) => rowResult("shot", {...row}))
        };
    }),
    writeTool("creative_reorder", "调整创作顺序", "提交当前范围完整且无重复的 orderedIds，最多100项。episode 在项目内排序；beat/shot 需 episodeId。场次顺序同时移动其镜头组，不改变关系。", s.object({
        kind: s.choice(["episode", "beat", "shot"]), ...s.owner,
        episodeId: s.optional(s.id),
        orderedIds: s.ids
    }), (args) => [args.ownerId], async (args) => {
        await requireOwner(args.ownerId, false);
        if (args.kind !== "episode" && !args.episodeId) throw new Error("场次/镜头排序需要 episodeId");
        const rows = await listRows(args.kind, args.ownerId, args.episodeId);
        if (rows.length !== args.orderedIds.length || rows.some((row) => !args.orderedIds.includes(row.id))) throw new Error("排序必须包含当前范围的全部标识且不能重复");
        const order = new Map(rows.map((row) => [row.id, row]));
        return {
            state: {rows, ...(args.kind === "beat" ? {shots: await listRows("shot", args.ownerId, args.episodeId)} : {})},
            changes: args.orderedIds.map((id, index) => {
                const row = order.get(id);
                return `${index + 1}. ${row ? businessRowText(row, ["title", "shotNumber"], id) : id}`;
            })
        };
    }, async (args) => {
        if (args.kind === "episode") await reorderEpisodes(args.ownerId, args.orderedIds);
        else if (args.kind === "beat") await reorderBeats(args.episodeId!, args.orderedIds);
        else await reorderShots(args.episodeId!, args.orderedIds);
        return {kind: args.kind, orderedIds: args.orderedIds};
    }),
];

function catalogSlot<Slot extends string>(catalog: readonly { id: Slot }[], value: string): value is Slot {
    return catalog.some(slot => slot.id === value);
}

export function isCharacterSlot(value: string): value is CharacterImageSlot {
    return catalogSlot(CHARACTER_SLOTS, value);
}

function isSceneSlot(value: string): value is SceneImageSlot {
    return catalogSlot(SCENE_SLOTS, value);
}

function isPropSlot(value: string): value is PropImageSlot {
    return catalogSlot(PROP_SLOTS, value);
}

function isStyleSlot(value: string): value is StyleImageSlot {
    return catalogSlot(STYLE_SLOTS, value);
}

function isShotSlot(value: string): value is ShotPictureField {
    return value === "firstFrame" || value === "lastFrame" || value === "clip";
}

const slotSpec = s.object({
    kind: s.choice(["character", "scene", "prop", "style", "shot"]), ...s.target,
    episodeId: s.optional(s.id),
    slot: s.text(30, 1),
    patch: s.slotPatch
});
const mediaTools = [
    writeTool("slot_update", "修改素材槽位", "修改资产/镜头槽位描述、图片参考、视频参考或已有结果。只允许同归属真实媒体 ID；result:null 清除结果。角色 front/side/back/expression/costume；场景 wide/medium/detail；道具 hero/detail/worn；风格 look/light/lens；镜头 firstFrame/lastFrame/clip。只有 clip 结果允许视频。", slotSpec, (args) => [args.ownerId], async (args) => {
        const row = await getRow(args.kind, args.id, args.ownerId, args.episodeId);
        const slots = {
            character: CHARACTER_SLOTS.map((slot) => slot.id),
            scene: SCENE_SLOTS.map((slot) => slot.id),
            prop: PROP_SLOTS.map((slot) => slot.id),
            style: STYLE_SLOTS.map((slot) => slot.id),
            shot: ["firstFrame", "lastFrame", "clip"]
        };
        if (!(slots[args.kind] as readonly string[]).includes(args.slot)) throw new Error("素材槽位不属于此实体类型");
        if (args.kind === "shot" && !args.episodeId) throw new Error("镜头素材需要明确分集标识");
        if (args.patch.result?.kind === "video" && !(args.kind === "shot" && args.slot === "clip")) throw new Error("此槽位结果仅支持图片");
        const mediaIds = [...(args.patch.referenceImageIds ?? []), ...(args.patch.referenceVideoIds ?? []), ...(args.patch.result ? [args.patch.result.mediaId] : [])];
        const media = await Promise.all(mediaIds.map((id) => getRow("media", id, args.ownerId)));
        return {
            state: {row, media},
            target: navigation(args.kind, row),
            changes: [`槽位：${args.slot}`, ...changes(args.patch)]
        };
    }, async (args) => {
        const record = await readBusinessRecord(args.kind, args.id, args.ownerId, args.episodeId);
        const {result, ...patch} = args.patch;
        if (result?.mediaId && (await db.agentGenerationJobs.where("projectId").equals(args.ownerId).toArray()).some(job => job.batchId && job.result?.mediaId === result.mediaId)) throw new Error("批量候选必须由用户在批量面板选择并写入");
        const merge = (previous: unknown) => ({...emptySlot(), ...parseGenerationSlot(previous), ...patch, ...(Object.hasOwn(args.patch, "result") ? {result: result ?? undefined} : {})});
        const invalid = () => {
            throw new Error("素材槽位不属于此实体类型");
        };
        let slot;
        switch (record.kind) {
            case "character":
                if (!isCharacterSlot(args.slot)) return invalid();
                slot = merge(record.row.slots?.[args.slot]);
                await setCharacterSlot(args.id, args.slot, slot);
                break;
            case "scene":
                if (!isSceneSlot(args.slot)) return invalid();
                slot = merge(record.row.slots?.[args.slot]);
                await setSceneSlot(args.id, args.slot, slot);
                break;
            case "prop":
                if (!isPropSlot(args.slot)) return invalid();
                slot = merge(record.row.slots?.[args.slot]);
                await setPropSlot(args.id, args.slot, slot);
                break;
            case "style":
                if (!isStyleSlot(args.slot)) return invalid();
                slot = merge(record.row.slots?.[args.slot]);
                await setStyleSlot(args.id, args.slot, slot);
                break;
            case "shot":
                if (!isShotSlot(args.slot)) return invalid();
                slot = merge(record.row[args.slot]);
                await setShotSlot(args.id, args.slot, slot);
                break;
            case "project":
            case "episode":
            case "beat":
            case "media":
                return invalid();
            default:
                return invalid();
        }
        return {
            ...rowResult(args.kind, await getRow(args.kind, args.id, args.ownerId, args.episodeId)),
            slot: args.slot,
            value: slot
        };
    }),
    writeTool("media_delete_orphan", "清理未引用素材", "仅删除未被项目封面、资产、镜头、参考资料、生成任务或历史提案引用的真实媒体。使用中的文件不会删除；不支持任意文件或 Blob 写入。", s.object(s.target), (args) => [args.ownerId], async (args) => {
        const row = await getRow("media", args.id, args.ownerId);
        const usage = await mediaUsage(args.ownerId, args.id);
        if (usage.length) throw new Error(`素材仍有 ${usage.length} 处引用，请先明确解除关联`);
        const retention = await mediaRetention(args.ownerId, args.id);
        if (retention.proposals || retention.generationJobs || retention.generationBatches) throw new Error(`素材仍被 ${retention.proposals} 个历史提案、${retention.generationJobs} 个生成任务、${retention.generationBatches} 个生成批次保留，不能删除`);
        return {
            state: await ownerSnapshot(args.ownerId),
            target: navigation("media", row),
            changes: [`删除文件「${businessRowText(row, ["filename"], row.id)}」（${typeof row.size === "number" ? row.size : 0} 字节）；如参考资料、生成任务或历史提案保留该文件则拒绝删除。`]
        };
    }, async (args) => {
        await deleteMediaIfOrphan(args.id);
        if (await db.media.get(args.id)) throw new Error("素材仍被参考资料、生成任务或历史提案保留，未删除");
        return {deletedId: args.id};
    }, true),
];

export const BUSINESS_TOOLS = [...reads, ...projectTools, ...episodeTools, ...beatTools, ...shotTools, ...assetTools, ...reuseTools, ...mediaTools];
export {BUSINESS_TOOL_GROUPS} from "./businessToolNames";
