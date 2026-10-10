import {db} from "@/db/database";
import {PRODUCTION_TABLES} from "@/db/productionShared";
import {
    type Character,
    CHARACTER_SLOTS,
    type Episode,
    type MediaRecord,
    normalizeEpisodeStory,
    type Project,
    type Prop,
    PROP_SLOTS,
    type Scene,
    SCENE_SLOTS,
    type Shot,
    type StoryBeat,
    STUDIO_LIBRARY_ID,
    STYLE_SLOTS,
    type VisualStyle
} from "@/domain/types";
import {targetRevision} from "@/lib/productionRevision";
import {parseGenerationSlot, slotMediaIds} from "@/domain/slot";

export type BusinessKind = "project" | "episode" | "beat" | "shot" | "character" | "scene" | "prop" | "style" | "media";
type AssetKind = "character" | "scene" | "prop" | "style";
export type BusinessRow = Record<string, unknown> & { id: string };
type RowByKind = {
    project: Project; episode: Episode; shot: Shot;
    beat: StoryBeat & { projectId: string; episodeId: string; order?: number };
    character: Character; scene: Scene; prop: Prop; style: VisualStyle;
    media: ReturnType<typeof metadata>;
};
export type OwnedBusinessRecord = { [K in BusinessKind]: { kind: K; row: RowByKind[K] } }[BusinessKind];

export const BUSINESS_LABELS: Record<BusinessKind, string> = {
    project: "项目",
    episode: "分集",
    beat: "场次",
    shot: "镜头",
    character: "角色",
    scene: "场景",
    prop: "道具",
    style: "风格",
    media: "素材"
};
const tables = {
    project: "projects",
    episode: "episodes",
    shot: "shots",
    character: "characters",
    scene: "scenes",
    prop: "props",
    style: "styles",
    media: "media"
} as const;
export const readTables = () => [...PRODUCTION_TABLES];

function metadata(record: MediaRecord) {
    return {
        id: record.id,
        projectId: record.projectId,
        filename: record.filename,
        mimeType: record.mimeType,
        size: record.blob.size
    };
}

export async function requireOwner(ownerId: string, allowStudio = true): Promise<void> {
    if (ownerId === STUDIO_LIBRARY_ID) {
        if (!allowStudio) throw new Error("工作室不是项目，不能执行此操作");
        return;
    }
    if (!(await db.projects.get(ownerId))) throw new Error("项目不存在，请先查询并确认项目标识");
}

export async function requireEpisode(ownerId: string, episodeId: string) {
    await requireOwner(ownerId, false);
    const episode = await db.episodes.get(episodeId);
    if (!episode || episode.projectId !== ownerId) throw new Error("分集不存在或不属于当前项目");
    return episode;
}

/** Owned typed records are used by commands; dynamic views remain presentation only. */
export async function readBusinessRecord(kind: BusinessKind, id: string, ownerId?: string, episodeId?: string): Promise<OwnedBusinessRecord> {
    if (kind === "project") {
        if (id === STUDIO_LIBRARY_ID) throw new Error("工作室不是项目");
        const project = await db.projects.get(id);
        if (!project) throw new Error("项目不存在");
        if (ownerId !== undefined && ownerId !== id) throw new Error("项目归属不匹配");
        return {kind, row: {...project}};
    }
    if (!ownerId) throw new Error("必须明确提供 ownerId；工作室资产使用 studio");
    await requireOwner(ownerId, !["episode", "shot", "beat"].includes(kind));
    if (kind === "beat") {
        if (!episodeId) throw new Error("场次需要分集标识");
        const episode = await requireEpisode(ownerId, episodeId);
        const beat = normalizeEpisodeStory(episode.story).beats.find(item => item.id === id);
        if (!beat) throw new Error("场次不存在或不属于当前分集");
        return {kind, row: {...beat, projectId: ownerId, episodeId}};
    }
    const owned = <T extends { projectId: string }>(row: T | undefined): T => {
        if (!row || row.projectId !== ownerId) throw new Error(`${BUSINESS_LABELS[kind]}不存在或归属不匹配`);
        return row;
    };
    switch (kind) {
        case "episode":
            return {kind, row: owned(await db.episodes.get(id))};
        case "character":
            return {kind, row: owned(await db.characters.get(id))};
        case "scene":
            return {kind, row: owned(await db.scenes.get(id))};
        case "prop":
            return {kind, row: owned(await db.props.get(id))};
        case "style":
            return {kind, row: owned(await db.styles.get(id))};
        case "media":
            return {kind, row: metadata(owned(await db.media.get(id)))};
        case "shot": {
            const row = owned(await db.shots.get(id));
            if (typeof row.episodeId !== "string") throw new Error("镜头缺少有效分集");
            await requireEpisode(ownerId, row.episodeId);
            if (episodeId !== undefined && row.episodeId !== episodeId) throw new Error("镜头不属于当前分集");
            return {kind, row};
        }
    }
}

export async function listBusinessRecords(kind: BusinessKind, ownerId?: string, episodeId?: string): Promise<OwnedBusinessRecord[]> {
    if (kind === "project") return (await db.projects.toArray()).filter(row => row.id !== STUDIO_LIBRARY_ID).map(row => ({
        kind,
        row: {...row}
    }));
    if (!ownerId) throw new Error("必须明确提供 ownerId");
    await requireOwner(ownerId, !["episode", "shot", "beat"].includes(kind));
    if (kind === "beat") {
        if (!episodeId) throw new Error("场次需要分集标识");
        const episode = await requireEpisode(ownerId, episodeId);
        return normalizeEpisodeStory(episode.story).beats.map((beat, order) => ({
            kind,
            row: {...beat, projectId: ownerId, episodeId, order}
        }));
    }
    if (episodeId) await requireEpisode(ownerId, episodeId);
    switch (kind) {
        case "episode":
            return (await db.episodes.where("projectId").equals(ownerId).toArray()).map(row => ({kind, row}));
        case "character":
            return (await db.characters.where("projectId").equals(ownerId).toArray()).map(row => ({kind, row}));
        case "scene":
            return (await db.scenes.where("projectId").equals(ownerId).toArray()).map(row => ({kind, row}));
        case "prop":
            return (await db.props.where("projectId").equals(ownerId).toArray()).map(row => ({kind, row}));
        case "style":
            return (await db.styles.where("projectId").equals(ownerId).toArray()).map(row => ({kind, row}));
        case "media":
            return (await db.media.where("projectId").equals(ownerId).toArray()).map(row => ({
                kind,
                row: metadata(row)
            }));
        case "shot":
            return (await db.shots.where("projectId").equals(ownerId).toArray()).filter(row => !episodeId || row.episodeId === episodeId).map(row => ({
                kind,
                row
            }));
    }
}

/** Compatibility projections preserve original row envelopes and hashes. */
export async function getRow(kind: BusinessKind, id: string, ownerId?: string, episodeId?: string): Promise<BusinessRow> {
    return {...(await readBusinessRecord(kind, id, ownerId, episodeId)).row};
}

export async function listRows(kind: BusinessKind, ownerId?: string, episodeId?: string): Promise<BusinessRow[]> {
    return (await listBusinessRecords(kind, ownerId, episodeId)).map(record => ({...record.row}));
}

const visibleFields: Record<BusinessKind, readonly string[]> = {
    project: ["id", "name", "mode", "aspectPreset", "brief", "genre", "audience", "tone", "story", "setting", "defaultStyleId", "generationDefaults", "coverMediaId", "shotSettings"],
    episode: ["id", "projectId", "title", "order", "story"],
    beat: ["id", "projectId", "episodeId", "order", "title", "content", "characterIds", "sceneId", "timeOfDay", "scriptRange"],
    shot: ["id", "projectId", "episodeId", "order", "shotNumber", "status", "durationSec", "content", "notes", "category", "sceneCloseup", "sound", "emotion", "cameraAngle", "cameraGear", "focalLength", "characterIds", "sceneId", "propIds", "styleId", "beatId", "firstFrame", "lastFrame", "clip"],
    character: ["id", "projectId", "name", "bio", "appearance", "notes", "personality", "motivation", "voice", "slots"],
    scene: ["id", "projectId", "name", "location", "timeOfDay", "atmosphere", "notes", "geography", "lighting", "slots"],
    prop: ["id", "projectId", "name", "kind", "notes", "appearance", "material", "size", "usage", "continuity", "slots"],
    style: ["id", "projectId", "name", "notes", "palette", "lighting", "lens", "composition", "negativePrompt", "slots"],
    media: ["id", "projectId", "filename", "mimeType", "size"],
};

/** Do not return extension bags; imported extras can contain arbitrary data. */
export function projection(kind: BusinessKind, row: BusinessRow): Record<string, unknown> {
    const result = Object.fromEntries(visibleFields[kind].filter((key) => key in row).map((key) => [key, row[key]]));
    const select = (value: unknown, keys: readonly string[]) => {
        const record = value && typeof value === "object" ? value as Record<string, unknown> : {};
        return Object.fromEntries(keys.filter((key) => key in record).map((key) => [key, record[key]]));
    };
    if (kind === "project") {
        result.story = select(row.story, ["logline"]);
        result.setting = select(row.setting, ["worldview", "background", "rules"]);
        result.shotSettings = select(row.shotSettings, ["defaultDurationSec", "autoIncrementShotNumber"]);
        if (row.generationDefaults) {
            const defaults = row.generationDefaults as Record<string, unknown>;
            result.generationDefaults = {
                ...(defaults.image ? {image: select(defaults.image, ["provider", "model", "profileVersion", "size", "resolution", "quality", "version"])} : {}),
                ...(defaults.video ? {video: select(defaults.video, ["provider", "model", "profileVersion", "mode", "aspectRatio", "resolution", "duration"])} : {}),
            };
        }
    }
    if (kind === "episode") {
        const story = normalizeEpisodeStory(row.story);
        result.story = {
            logline: story.logline,
            script: story.script,
            beats: story.beats.map((beat) => projection("beat", {...beat}))
        };
    }
    if (kind === "shot") for (const slot of ["firstFrame", "lastFrame", "clip"]) result[slot] = parseGenerationSlot(row[slot]);
    if (["character", "scene", "prop", "style"].includes(kind)) {
        const catalog = {
            character: CHARACTER_SLOTS,
            scene: SCENE_SLOTS,
            prop: PROP_SLOTS,
            style: STYLE_SLOTS
        }[kind as AssetKind];
        const slots = row.slots as Record<string, unknown> | undefined;
        result.slots = Object.fromEntries(catalog.filter(({id}) => slots?.[id] !== undefined).map(({id}) => [id, parseGenerationSlot(slots?.[id])]));
    }
    return result;
}

type BusinessTextField = "name" | "title" | "filename" | "shotNumber" | "content" | "bio" | "notes";

/** Presentation only: malformed compound fields fall through to the next owned scalar.
 * Empty strings and legacy primitive values retain their display semantics; raw rows
 * still supply revisions, approval snapshots and relation checks.
 */
export function businessRowText(row: BusinessRow, fields: readonly BusinessTextField[], fallback: string): string {
    for (const field of fields) {
        const value = row[field];
        if (typeof value === "string") return value;
        if (typeof value === "number" || typeof value === "boolean") return String(value);
    }
    return fallback;
}

export function summarize(kind: BusinessKind, row: BusinessRow) {
    return {
        id: row.id, kind, ownerId: kind === "project" ? row.id : row.projectId, episodeId: row.episodeId,
        label: businessRowText(row, ["name", "title", "filename", "shotNumber"], row.id).slice(0, 200),
        excerpt: businessRowText(row, ["content", "bio", "notes"], "").slice(0, 300), order: row.order
    };
}

export function navigation(kind: BusinessKind, row: BusinessRow): { label: string; href: string } {
    const enc = encodeURIComponent;
    const label = `${BUSINESS_LABELS[kind]} · ${businessRowText(row, ["name", "title", "filename", "shotNumber"], row.id).slice(0, 120)}`;
    if (kind === "project") return {label, href: `/p/${enc(row.id)}`};
    const projectId = String(row.projectId);
    if (kind === "media") return {
        label,
        href: projectId === STUDIO_LIBRARY_ID ? "/characters" : `/p/${enc(projectId)}/world`
    };
    if (kind === "episode" || kind === "beat") return {
        label,
        href: `/p/${enc(projectId)}/e/${enc(String(kind === "episode" ? row.id : row.episodeId))}`
    };
    if (kind === "shot") return {
        label,
        href: `/p/${enc(projectId)}/e/${enc(String(row.episodeId))}/shots?shot=${enc(row.id)}`
    };
    const plural = tables[kind];
    return {
        label,
        href: projectId === STUDIO_LIBRARY_ID ? `/${plural}/${enc(row.id)}` : `/p/${enc(projectId)}/assets/${plural}/${enc(row.id)}`
    };
}

/** All truncation is explicit; long prose can be recovered by business_read_text. */
export function bounded(value: unknown): { data: unknown; truncated: boolean } {
    let truncated = false;

    function clip(item: unknown, limit: number): unknown {
        if (typeof item === "string") {
            if (item.length > limit) truncated = true;
            return item.slice(0, limit);
        }
        if (Array.isArray(item)) {
            const count = item.every((entry) => typeof entry === "string") ? 100 : 50;
            if (item.length > count) truncated = true;
            return item.slice(0, count).map((entry) => clip(entry, limit));
        }
        if (item && typeof item === "object") return Object.fromEntries(Object.entries(item).filter(([key]) => key !== "extra").map(([key, entry]) => [key, clip(entry, limit)]));
        return item;
    }

    let result = clip(value, 2000);
    for (const limit of [500, 100, 20]) {
        if (JSON.stringify(result).length < 60000) break;
        truncated = true;
        result = clip(value, limit);
    }
    if (JSON.stringify(result).length >= 60000) throw new Error("结果过大，请缩小范围或分页读取");
    return {data: result, truncated};
}

export function isReadableBusinessFieldPath(kind: BusinessKind, field: string): boolean {
    const path = field.split(".");
    return visibleFields[kind].includes(path[0]) && path.length <= 3 && path.every((part) => part.length > 0 && !["extra", "__proto__", "constructor", "prototype"].includes(part));
}

function fieldAt(kind: BusinessKind, row: BusinessRow, field: string): unknown {
    const path = field.split(".");
    if (!isReadableBusinessFieldPath(kind, field)) throw new Error("不是可读取的创作文本字段");
    let value: unknown = projection(kind, row);
    for (const key of path) {
        if (!value || typeof value !== "object" || !Object.hasOwn(value, key)) throw new Error("文本字段不存在");
        value = (value as Record<string, unknown>)[key];
    }
    return value;
}

export function textAt(kind: BusinessKind, row: BusinessRow, field: string): string {
    const value = fieldAt(kind, row, field);
    if (typeof value !== "string") throw new Error("字段不是文本；数组关系请使用 business_read_relations");
    return value;
}

export function relationsAt(kind: BusinessKind, row: BusinessRow, field: string): string[] {
    const value = fieldAt(kind, row, field);
    if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) throw new Error("字段不是标识列表；创作记录请使用 business_search");
    return value as string[];
}

/** Conservative owner-wide deletion snapshot includes all cascade/recycling participants. */
export async function ownerSnapshot(ownerId: string): Promise<unknown> {
    await requireOwner(ownerId);
    const kinds = ["episode", "shot", "character", "scene", "prop", "style", "media"] as const;
    const groups: Record<string, unknown> = {owner: ownerId === STUDIO_LIBRARY_ID ? {id: ownerId} : await db.projects.get(ownerId)};
    for (const kind of kinds) {
        if (ownerId === STUDIO_LIBRARY_ID && ["episode", "shot"].includes(kind)) continue;
        groups[kind] = (await listRows(kind, ownerId)).sort((a, b) => a.id.localeCompare(b.id));
    }
    groups.references = await db.projectReferences.where("projectId").equals(ownerId).sortBy("id");
    groups.proposals = await db.productionProposals.where("projectId").equals(ownerId).sortBy("id");
    // Optional during additive integration; only hashed internally, never returned to the model.
    const jobs = db.tables.find((table) => table.name === "agentGenerationJobs");
    if (jobs) groups.jobs = await jobs.where("projectId").equals(ownerId).sortBy("id");
    groups.batches = await db.agentGenerationBatches.where("projectId").equals(ownerId).sortBy("id");
    groups.batchItems = await db.agentGenerationBatchItems.where("projectId").equals(ownerId).sortBy("id");
    return groups;
}

export async function mediaUsage(ownerId: string, mediaId: string): Promise<Array<{
    kind: string;
    id: string;
    label: string;
    slot?: string
}>> {
    const usages: Array<{ kind: string; id: string; label: string; slot?: string }> = [];
    const project = ownerId === STUDIO_LIBRARY_ID ? undefined : await db.projects.get(ownerId);
    if (project?.coverMediaId === mediaId) usages.push({
        kind: "project",
        id: project.id,
        label: project.name,
        slot: "cover"
    });
    for (const kind of ["character", "scene", "prop", "style", "shot"] as const) {
        if (kind === "shot" && ownerId === STUDIO_LIBRARY_ID) continue;
        for (const row of await listRows(kind, ownerId)) {
            const slots = kind === "shot" ? {
                firstFrame: row.firstFrame,
                lastFrame: row.lastFrame,
                clip: row.clip
            } : row.slots as Record<string, unknown>;
            for (const [slot, value] of Object.entries(slots ?? {})) {
                if (slotMediaIds(parseGenerationSlot(value)).includes(mediaId)) usages.push({
                    kind,
                    id: row.id,
                    label: businessRowText(row, ["name", "shotNumber"], row.id),
                    slot
                });
            }
        }
    }
    const references = await db.projectReferences.where("mediaId").equals(mediaId).toArray();
    for (const reference of references) {
        if (reference.projectId === ownerId && reference.status !== "unavailable") usages.push({
            kind: "reference",
            id: reference.id,
            label: reference.filename
        });
    }
    return usages;
}

/** Sanitized retention counts expose why cleanup is blocked without execution internals. */
export async function mediaRetention(ownerId: string, mediaId: string): Promise<{
    proposals: number;
    generationJobs: number;
    generationBatches: number
}> {
    const proposals = (await db.productionProposals.where("projectId").equals(ownerId).toArray()).filter((proposal) =>
        proposal.before.result?.mediaId === mediaId || (proposal.change.kind === "slot-result" && proposal.change.result.mediaId === mediaId)).length;
    const generationJobs = (await db.agentGenerationJobs.where("projectId").equals(ownerId).toArray()).filter((job) =>
        job.result?.mediaId === mediaId || job.inputs.some((input) => input.mediaId === mediaId)).length;
    const items = await db.agentGenerationBatchItems.where("projectId").equals(ownerId).toArray();
    const batches = await db.agentGenerationBatches.where("projectId").equals(ownerId).toArray();
    const retained = new Set(items.filter(item => item.draft.inputs.some(input => input.mediaId === mediaId)).map(item => item.batchId));
    for (const batch of batches) if (batch.applications.some(a => a.before?.mediaId === mediaId || a.result.mediaId === mediaId)) retained.add(batch.id);
    return {proposals, generationJobs, generationBatches: retained.size};
}

/** Validate all referenced dependencies before preview; copying must never silently drop them. */
export async function assetMediaDependencies(source: BusinessRow): Promise<unknown[]> {
    const records = new Map<string, unknown>();
    for (const value of Object.values(source.slots as Record<string, unknown> ?? {})) {
        const slot = parseGenerationSlot(value);
        const dependencies = [
            ...slot.referenceImageIds.map((id) => ({id, kind: "image"})),
            ...slot.referenceVideoIds.map((id) => ({id, kind: "video"})),
            ...(slot.result ? [{id: slot.result.mediaId, kind: slot.result.kind}] : []),
        ];
        for (const dependency of dependencies) {
            const media = await getRow("media", dependency.id, String(source.projectId));
            if (!media.size || !String(media.mimeType).startsWith(`${dependency.kind}/`)) throw new Error("来源素材已失效或类型不匹配");
            records.set(media.id, media);
        }
    }
    return [...records.entries()].sort(([a], [b]) => a.localeCompare(b));
}

export {targetRevision};
