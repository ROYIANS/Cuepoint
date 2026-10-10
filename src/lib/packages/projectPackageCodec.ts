import {isLegacyScalar, type LegacyScalar} from "@/domain/legacyScalar";
import {
    type Character,
    type CharacterImageSlot,
    DEFAULT_VISIBLE_COLUMNS,
    type Episode,
    type GenerationSlot,
    getEpisodeShotFilters,
    getProjectKind,
    type Id,
    normalizeAspectPreset,
    normalizeEpisodeStory,
    normalizeProjectMode,
    normalizeSeriesStory,
    normalizeSetting,
    normalizeShotFilters,
    normalizeShotSettings,
    normalizeShotStatus,
    type Project,
    type ProjectKind,
    type Prop,
    type PropImageSlot,
    type Scene,
    type SceneImageSlot,
    type Shot,
    SHOT_UNASSIGNED_BEAT,
    type ShotColumnId,
    type StyleImageSlot,
    type VisualStyle
} from "@/domain/types";
import {parseReferencePackage} from "@/lib/references/package";
import type {MemorySource, ProjectMemory, ProjectMemoryVersion,} from "@/domain/projectMemory";
import {normalizeMemoryText, projectMemorySchema, projectMemoryVersionSchema,} from "@/lib/memory/schema";
import {parseGenerationDefaults} from "@/domain/output";
import {z} from "zod";
import {parseGenerationSlot, parseShotPictureSlots, remapSlot} from "@/domain/slot";
import {createId, nowIso} from "@/lib/ids";
import {parseAudioPackage, remapAudioPackage} from "./audioPackageCodec";
import {PackageError} from "./packageError";

const recordSchema = z.object({}).passthrough();

export function asRecord(value: unknown, label: string): Record<string, unknown> {
    const parsed = recordSchema.safeParse(value);
    if (!parsed.success) throw new PackageError(`${label} 不是有效对象`);
    return parsed.data;
}

export function asArray(value: unknown, label: string): Record<string, unknown>[] {
    if (value == null) return [];
    if (!Array.isArray(value)) throw new PackageError(`${label} 必须是数组`);
    return value.map((item, index) => asRecord(item, `${label}[${index}]`));
}

/** Narrow only named historical fields; extension bags and future profiles stay structured. */
function assertLegacyFields<K extends string>(
    raw: Record<string, unknown>, keys: readonly K[], path: string,
): asserts raw is Record<string, unknown> & Record<K, LegacyScalar> {
    for (const key of keys) {
        if (!isLegacyScalar(raw[key])) throw new PackageError(`${path}.${key} 必须是文本、数字或布尔值`);
        // Empty row IDs cannot be remapped; missing/null identities still synthesize.
        if (key === "id" && raw[key] === "") throw new PackageError(`${path}.id 不能为空`);
    }
}

function validateLegacyIds(value: unknown, path: string): asserts value is LegacyScalar[] | null | undefined {
    if (value == null) return;
    if (!Array.isArray(value)) throw new PackageError(`${path} 必须是 ID 数组`);
    value.forEach((id: unknown, index) => {
        if (!isLegacyScalar(id)) throw new PackageError(`${path}[${index}] 必须是标量 ID`);
    });
}

function validatePackageStory(value: unknown, path: string): void {
    if (value == null) return;
    const story = asRecord(value, path);
    assertLegacyFields(story, ["logline", "script"], path);
    asArray(story.beats, `${path}.beats`).forEach((beat, index) => {
        const beatPath = `${path}.beats[${index}]`;
        assertLegacyFields(beat, ["id", "title", "content", "timeOfDay", "sceneId"], beatPath);
        validateLegacyIds(beat.characterIds, `${beatPath}.characterIds`);
        if (beat.scriptRange != null) {
            const range = asRecord(beat.scriptRange, `${beatPath}.scriptRange`);
            assertLegacyFields(range, ["start", "end", "excerpt"], `${beatPath}.scriptRange`);
        }
    });
}

function validatePackageSlot(value: unknown, path: string): void {
    if (value == null) return;
    const slot = asRecord(value, path);
    assertLegacyFields(slot, ["prompt"], path);
    validateLegacyIds(slot.referenceImageIds, `${path}.referenceImageIds`);
    validateLegacyIds(slot.referenceVideoIds, `${path}.referenceVideoIds`);
    if (slot.result != null) {
        const result = asRecord(slot.result, `${path}.result`);
        assertLegacyFields(result, ["mediaId", "kind"], `${path}.result`);
    }
}

function pickExtra(
    raw: Record<string, unknown>,
    known: string[],
): Record<string, unknown> | undefined {
    const nested = raw.extra;
    const extra: Record<string, unknown> =
        nested && typeof nested === "object" && !Array.isArray(nested)
            ? {...(nested as Record<string, unknown>)}
            : {};
    const knownSet = new Set(known);
    for (const [key, value] of Object.entries(raw)) {
        if (key !== "extra" && !knownSet.has(key)) extra[key] = value;
    }
    return Object.keys(extra).length > 0 ? extra : undefined;
}

function optionalText(
    raw: Record<string, unknown>,
    key: string,
): string | undefined {
    if (raw[key] === undefined) return undefined;
    if (typeof raw[key] !== "string") throw new PackageError(`${key} 必须是文本`);
    return raw[key];
}

function optionalIds(
    raw: Record<string, unknown>,
    key: string,
): Id[] | undefined {
    const value = raw[key];
    if (value === undefined) return undefined;
    if (!Array.isArray(value) || value.some((id) => typeof id !== "string"))
        throw new PackageError(`${key} 必须是 ID 数组`);
    return [...new Set(value as string[])];
}

const PROJECT_KEYS = [
    "kind",
    "archivedAt",
    "brief",
    "genre",
    "audience",
    "tone",
    "defaultStyleId",
    "generationDefaults",
    "id",
    "name",
    "mode",
    "aspectPreset",
    "coverMediaId",
    "createdAt",
    "updatedAt",
    "columnSettings",
    "shotSettings",
    "story",
    "setting",
    "extra",
];

function parseProject(
    raw: Record<string, unknown>,
    fallbackName: string,
): Project {
    assertLegacyFields(raw, ["id", "name", "createdAt", "updatedAt", "coverMediaId"], "project.json");
    validatePackageStory(raw.story, "project.json.story");
    if (raw.setting != null) {
        const setting = asRecord(raw.setting, "project.json.setting");
        assertLegacyFields(setting, ["worldview", "background", "rules"], "project.json.setting");
    }
    const visible = (
        raw.columnSettings as { visible?: ShotColumnId[] } | undefined
    )?.visible;
    const at = nowIso();
    const coverMediaId =
        raw.coverMediaId != null && String(raw.coverMediaId).trim()
            ? String(raw.coverMediaId)
            : undefined;
    getProjectKind({kind: raw.kind as ProjectKind | undefined});
    const project: Project = {
        kind: raw.kind as ProjectKind | undefined,
        id: String(raw.id ?? createId("prj")),
        name: String(raw.name ?? fallbackName),
        archivedAt: optionalText(raw, "archivedAt"),
        brief: optionalText(raw, "brief"),
        genre: optionalText(raw, "genre"),
        audience: optionalText(raw, "audience"),
        tone: optionalText(raw, "tone"),
        defaultStyleId: optionalText(raw, "defaultStyleId"),
        generationDefaults: parseGenerationDefaults(raw.generationDefaults),
        mode: normalizeProjectMode(raw.mode),
        aspectPreset: normalizeAspectPreset(raw.aspectPreset),
        createdAt: String(raw.createdAt ?? at),
        updatedAt: String(raw.updatedAt ?? at),
        columnSettings: {
            visible:
                Array.isArray(visible) && visible.length > 0
                    ? visible
                    : [...DEFAULT_VISIBLE_COLUMNS],
        },
        shotSettings: normalizeShotSettings(raw.shotSettings),
        story: normalizeSeriesStory(raw.story),
        setting: normalizeSetting(raw.setting),
        extra: pickExtra(raw, PROJECT_KEYS),
    };
    if (coverMediaId) project.coverMediaId = coverMediaId;
    return project;
}

const CHARACTER_KEYS = [
    "personality",
    "motivation",
    "voice",
    "id",
    "projectId",
    "name",
    "bio",
    "appearance",
    "notes",
    "slots",
    "images",
    "createdAt",
    "updatedAt",
    "extra",
];

function parseNamedSlots<K extends string>(
    rawSlots: unknown,
    legacyImages: unknown,
    path: string,
): Partial<Record<K, GenerationSlot>> {
    const slots: Partial<Record<K, GenerationSlot>> = {};
    if (rawSlots != null) {
        for (const [key, value] of Object.entries(asRecord(rawSlots, `${path}.slots`))) {
            validatePackageSlot(value, `${path}.slots.${key}`);
            slots[key as K] = parseGenerationSlot(value);
        }
    }
    if (legacyImages != null) {
        const images = asRecord(legacyImages, `${path}.images`);
        for (const [key, value] of Object.entries(images)) {
            if (!isLegacyScalar(value)) throw new PackageError(`${path}.images.${key} 必须是标量媒体 ID`);
            if (!slots[key as K])
                slots[key as K] = parseGenerationSlot(undefined, value);
        }
    }
    return slots;
}

function parseCharacter(
    raw: Record<string, unknown>,
    projectId: Id,
    path: string,
): Character {
    assertLegacyFields(raw, ["id", "name", "bio", "appearance", "notes", "createdAt", "updatedAt"], path);
    const at = nowIso();
    return {
        id: String(raw.id ?? createId("chr")),
        projectId,
        personality: optionalText(raw, "personality"),
        motivation: optionalText(raw, "motivation"),
        voice: optionalText(raw, "voice"),
        name: String(raw.name ?? "未命名角色"),
        bio: String(raw.bio ?? ""),
        appearance: String(raw.appearance ?? ""),
        notes: String(raw.notes ?? ""),
        slots: parseNamedSlots<CharacterImageSlot>(raw.slots, raw.images, path),
        createdAt: String(raw.createdAt ?? at),
        updatedAt: String(raw.updatedAt ?? at),
        extra: pickExtra(raw, CHARACTER_KEYS),
    };
}

const SCENE_KEYS = [
    "geography",
    "lighting",
    "id",
    "projectId",
    "name",
    "location",
    "timeOfDay",
    "atmosphere",
    "notes",
    "slots",
    "images",
    "createdAt",
    "updatedAt",
    "extra",
];

function parseScene(raw: Record<string, unknown>, projectId: Id, path: string): Scene {
    assertLegacyFields(raw, ["id", "name", "location", "timeOfDay", "atmosphere", "notes", "createdAt", "updatedAt"], path);
    const at = nowIso();
    return {
        id: String(raw.id ?? createId("scn")),
        projectId,
        geography: optionalText(raw, "geography"),
        lighting: optionalText(raw, "lighting"),
        name: String(raw.name ?? "未命名场景"),
        location: String(raw.location ?? ""),
        timeOfDay: String(raw.timeOfDay ?? ""),
        atmosphere: String(raw.atmosphere ?? ""),
        notes: String(raw.notes ?? ""),
        slots: parseNamedSlots<SceneImageSlot>(raw.slots, raw.images, path),
        createdAt: String(raw.createdAt ?? at),
        updatedAt: String(raw.updatedAt ?? at),
        extra: pickExtra(raw, SCENE_KEYS),
    };
}

const PROP_KEYS = [
    "appearance",
    "material",
    "size",
    "usage",
    "continuity",
    "id",
    "projectId",
    "name",
    "kind",
    "notes",
    "slots",
    "createdAt",
    "updatedAt",
    "extra",
];

function parseProp(raw: Record<string, unknown>, projectId: Id, path: string): Prop {
    assertLegacyFields(raw, ["id", "name", "kind", "notes", "createdAt", "updatedAt"], path);
    const at = nowIso();
    return {
        id: String(raw.id ?? createId("prp")),
        projectId,
        appearance: optionalText(raw, "appearance"),
        material: optionalText(raw, "material"),
        size: optionalText(raw, "size"),
        usage: optionalText(raw, "usage"),
        continuity: optionalText(raw, "continuity"),
        name: String(raw.name ?? "未命名道具"),
        kind: String(raw.kind ?? ""),
        notes: String(raw.notes ?? ""),
        slots: parseNamedSlots<PropImageSlot>(raw.slots, undefined, path),
        createdAt: String(raw.createdAt ?? at),
        updatedAt: String(raw.updatedAt ?? at),
        extra: pickExtra(raw, PROP_KEYS),
    };
}

const STYLE_KEYS = [
    "palette",
    "lighting",
    "lens",
    "composition",
    "negativePrompt",
    "id",
    "projectId",
    "name",
    "notes",
    "slots",
    "createdAt",
    "updatedAt",
    "extra",
];

function parseStyle(raw: Record<string, unknown>, projectId: Id, path: string): VisualStyle {
    assertLegacyFields(raw, ["id", "name", "notes", "createdAt", "updatedAt"], path);
    const at = nowIso();
    return {
        id: String(raw.id ?? createId("sty")),
        projectId,
        palette: optionalText(raw, "palette"),
        lighting: optionalText(raw, "lighting"),
        lens: optionalText(raw, "lens"),
        composition: optionalText(raw, "composition"),
        negativePrompt: optionalText(raw, "negativePrompt"),
        name: String(raw.name ?? "未命名风格"),
        notes: String(raw.notes ?? ""),
        slots: parseNamedSlots<StyleImageSlot>(raw.slots, undefined, path),
        createdAt: String(raw.createdAt ?? at),
        updatedAt: String(raw.updatedAt ?? at),
        extra: pickExtra(raw, STYLE_KEYS),
    };
}

const EPISODE_KEYS = [
    "shotFilters",
    "id",
    "projectId",
    "order",
    "title",
    "story",
    "createdAt",
    "updatedAt",
    "extra",
];

/** Only original string identities can satisfy modern package relationships. */
function originalId(raw: Record<string, unknown>): string | undefined {
    return typeof raw.id === "string" && raw.id ? raw.id : undefined;
}

function assertUniqueOriginalIds(rows: Record<string, unknown>[], label: string): void {
    const ids = new Set<string>();
    for (const row of rows) {
        if (typeof row.id !== "string" && typeof row.id !== "number" && typeof row.id !== "boolean") continue;
        // Match parser identity coercion for collisions, without making repaired IDs valid references.
        const id = String(row.id);
        if (ids.has(id)) throw new PackageError(`${label} ID 重复：${id}`);
        ids.add(id);
    }
}

function originalBeatIds(episode: Record<string, unknown>): Set<string> {
    const story = episode.story;
    if (!story || typeof story !== "object" || Array.isArray(story)) return new Set();
    const beats = (story as Record<string, unknown>).beats;
    if (!Array.isArray(beats)) return new Set();
    const rows = beats.filter((beat): beat is Record<string, unknown> =>
        Boolean(beat) && typeof beat === "object" && !Array.isArray(beat));
    assertUniqueOriginalIds(rows, "场次");
    return new Set(rows.flatMap((row) => originalId(row) ?? []));
}

/** Run before parsers synthesize identities or mutate/remap the original scope. */
function validateModernShotRelations(
    episodes: Record<string, unknown>[],
    shots: Record<string, unknown>[],
): void {
    // Missing and explicitly empty episodes remain the existing legacy format.
    if (!episodes.length) return;
    assertUniqueOriginalIds(episodes, "分集");
    assertUniqueOriginalIds(shots, "分镜");
    const beatsByEpisode = new Map<string, Set<string>>();
    for (const [index, episode] of episodes.entries()) {
        assertLegacyFields(episode, ["id"], `episodes.json[${index}]`);
        const beats = originalBeatIds(episode);
        const id = originalId(episode);
        if (id) beatsByEpisode.set(id, beats);
    }
    for (const [index, shot] of shots.entries()) {
        assertLegacyFields(shot, ["id"], `shots.json[${index}]`);
        const beats = typeof shot.episodeId === "string" ? beatsByEpisode.get(shot.episodeId) : undefined;
        if (!beats) throw new PackageError(`shots.json[${index}].episodeId：分镜必须引用包内有效的原始分集 ID`);
        if (!shot.beatId) continue;
        if (typeof shot.beatId !== "string" || !beats.has(shot.beatId)) {
            throw new PackageError(`shots.json[${index}].beatId：分镜场次必须属于它引用的分集`);
        }
    }
}

function parseEpisode(
    raw: Record<string, unknown>,
    projectId: Id,
    index: number,
): Episode {
    const path = `episodes.json[${index}]`;
    assertLegacyFields(raw, ["id", "title", "createdAt", "updatedAt"], path);
    validatePackageStory(raw.story, `${path}.story`);
    const at = nowIso();
    const story = normalizeEpisodeStory(raw.story);
    // Synthesized beat identities must not merge with explicit ones during remapping.
    assertUniqueOriginalIds(story.beats.map((beat) => ({id: beat.id})), "场次");
    return {
        id: String(raw.id ?? createId("ep")),
        projectId,
        order: Number.isFinite(Number(raw.order)) ? Number(raw.order) : index,
        title: String(raw.title ?? ""),
        story,
        ...(raw.shotFilters === undefined
            ? {}
            : {shotFilters: normalizeShotFilters(raw.shotFilters)}),
        createdAt: String(raw.createdAt ?? at),
        updatedAt: String(raw.updatedAt ?? at),
        extra: pickExtra(raw, EPISODE_KEYS),
    };
}

function synthesizeFirstEpisode(
    project: Project,
    projectRaw: Record<string, unknown>,
): Episode {
    return {
        id: createId("ep"),
        projectId: project.id,
        order: 0,
        title: "",
        story: normalizeEpisodeStory(projectRaw.story),
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
    };
}

const SHOT_KEYS = [
    "propIds",
    "styleId",
    "id",
    "projectId",
    "episodeId",
    "order",
    "shotNumber",
    "status",
    "firstFrame",
    "lastFrame",
    "clip",
    "frame",
    "reference",
    "frameMediaId",
    "referenceMediaId",
    "category",
    "durationSec",
    "content",
    "notes",
    "sceneCloseup",
    "sound",
    "emotion",
    "cameraAngle",
    "cameraGear",
    "focalLength",
    "characterIds",
    "sceneId",
    "beatId",
    "extra",
];

function parseShot(
    raw: Record<string, unknown>,
    projectId: Id,
    episodeId: Id,
    index: number,
): Shot {
    const path = `shots.json[${index}]`;
    assertLegacyFields(raw, ["id", "shotNumber", "category", "content", "notes", "sceneCloseup", "sound", "emotion", "cameraAngle", "cameraGear", "focalLength", "sceneId", "beatId", "frameMediaId", "referenceMediaId"], path);
    validateLegacyIds(raw.characterIds, `${path}.characterIds`);
    for (const field of ["firstFrame", "lastFrame", "clip", "frame", "reference"]) validatePackageSlot(raw[field], `${path}.${field}`);
    const slots = parseShotPictureSlots(raw);
    return {
        id: String(raw.id ?? createId("sht")),
        projectId,
        episodeId,
        order: Number(raw.order ?? index + 1) || index + 1,
        shotNumber: String(raw.shotNumber ?? index + 1),
        status: normalizeShotStatus(raw.status),
        propIds: optionalIds(raw, "propIds"),
        styleId: raw.styleId === null ? null : optionalText(raw, "styleId"),
        firstFrame: slots.firstFrame,
        lastFrame: slots.lastFrame,
        clip: slots.clip,
        category: String(raw.category ?? ""),
        durationSec: Number(raw.durationSec ?? 0) || 0,
        content: String(raw.content ?? ""),
        notes: String(raw.notes ?? ""),
        sceneCloseup: String(raw.sceneCloseup ?? ""),
        sound: String(raw.sound ?? ""),
        emotion: String(raw.emotion ?? ""),
        cameraAngle: String(raw.cameraAngle ?? ""),
        cameraGear: String(raw.cameraGear ?? ""),
        focalLength: String(raw.focalLength ?? ""),
        characterIds: Array.isArray(raw.characterIds)
            ? raw.characterIds.map((id) => String(id))
            : [],
        sceneId: raw.sceneId ? String(raw.sceneId) : undefined,
        beatId: raw.beatId ? String(raw.beatId) : undefined,
        extra: pickExtra(raw, SHOT_KEYS),
    };
}

function remapShotStoryScope(
    shot: Shot,
    hasEpisodes: boolean,
    fallbackEpisodeId: Id,
    episodeMap: Map<string, string>,
    beatMaps: Map<string, Map<string, string>>,
): void {
    const oldEpisodeId = shot.episodeId;
    if (!hasEpisodes) {
        shot.episodeId = fallbackEpisodeId;
        const legacyBeatMap = beatMaps.values().next().value;
        shot.beatId = shot.beatId ? legacyBeatMap?.get(shot.beatId) : undefined;
        return;
    }
    const episodeId = episodeMap.get(oldEpisodeId);
    if (!episodeId) throw new PackageError("分镜分集 ID 无法重映射");
    shot.episodeId = episodeId;
    if (!shot.beatId) return;
    const beatId = beatMaps.get(oldEpisodeId)?.get(shot.beatId);
    if (!beatId) throw new PackageError("分镜场次 ID 无法重映射");
    shot.beatId = beatId;
}

export function remapId(
    map: Map<string, string>,
    oldId: string | undefined,
    prefix: string,
) {
    if (!oldId) return undefined;
    const existing = map.get(oldId);
    if (existing) return existing;
    const next = createId(prefix);
    map.set(oldId, next);
    return next;
}

type MemoryPackage = {
    memories: ProjectMemory[];
    memoryVersions: ProjectMemoryVersion[];
};

/** Validate the whole aggregate before any imported project or media is persisted. */
function parseMemoryPackage(
    rawRows: unknown,
    rawVersions: unknown,
    projectId: unknown,
): MemoryPackage {
    const rows = z
        .array(projectMemorySchema)
        .safeParse(rawRows === undefined ? [] : rawRows);
    const versions = z
        .array(projectMemoryVersionSchema)
        .safeParse(rawVersions === undefined ? [] : rawVersions);
    if (!rows.success || !versions.success)
        throw new PackageError("项目记忆或历史版本格式无效");
    const memories = rows.data;
    const memoryVersions = versions.data;
    const fail = () => {
        throw new PackageError("项目记忆的归属、替代关系或版本链无效");
    };
    const byId = new Map(memories.map((row) => [row.id, row]));
    if (
        byId.size !== memories.length ||
        new Set(memoryVersions.map((row) => row.versionId)).size !==
        memoryVersions.length
    )
        fail();
    const chains = new Map<string, ProjectMemoryVersion[]>();
    for (const version of memoryVersions) {
        if (
            !byId.has(version.memoryId) ||
            version.projectId !== projectId ||
            version.snapshot.id !== version.memoryId ||
            version.snapshot.projectId !== projectId ||
            version.snapshot.revision !== version.revision
        )
            fail();
        const chain = chains.get(version.memoryId) ?? [];
        chain.push(version);
        chains.set(version.memoryId, chain);
    }
    const validateSnapshot = (row: ProjectMemory) => {
        if (row.projectId !== projectId || row.projectId === "studio") fail();
        if (row.source.kind === "summary" && row.source.projectId !== projectId)
            fail();
        if (row.supersededBy === row.id) fail();
    };
    for (const row of memories) {
        validateSnapshot(row);
        const chain = (chains.get(row.id) ?? []).sort(
            (a, b) => a.revision - b.revision,
        );
        if (
            chain.length !== row.revision ||
            chain.some((v, index) => v.revision !== index + 1)
        )
            fail();
        if (JSON.stringify(chain.at(-1)?.snapshot) !== JSON.stringify(row)) fail();
        for (const version of chain) validateSnapshot(version.snapshot);
        const visited = new Set<string>([row.id]);
        let next = row.supersededBy;
        while (next) {
            if (visited.has(next)) fail();
            visited.add(next);
            next = byId.get(next)?.supersededBy;
        }
    }
    // Match CRUD topic identity after validating the original chain, so normalization
    // cannot conceal inconsistent source snapshots or bypass same-topic conflicts.
    for (const row of memories) row.topicKey = normalizeMemoryText(row.topicKey);
    for (const version of memoryVersions) {
        version.snapshot.topicKey = normalizeMemoryText(version.snapshot.topicKey);
    }
    return {memories, memoryVersions};
}

function detachedMemorySource(row: ProjectMemory): MemorySource {
    const source = row.source;
    if (source.kind === "imported") return {...source};
    return {
        kind: "imported",
        originProjectId: row.projectId,
        originMemoryId: row.id,
        originalKind: source.kind,
        excerpt:
            source.kind === "summary" ? source.excerpt : row.body.slice(0, 3000),
        ...(source.kind === "summary"
            ? {
                taskTitle: source.taskTitle,
                summaryId: source.summaryId,
                summaryRevision: source.summaryRevision,
                evidence: source.evidence,
            }
            : {}),
    };
}

function remapMemoryPackage(
    input: MemoryPackage,
    projectId: Id,
    at: string,
): MemoryPackage {
    const ids = new Map(input.memories.map((row) => [row.id, createId("pm")]));
    const snapshot = (row: ProjectMemory): ProjectMemory => ({
        ...row,
        id: ids.get(row.id)!,
        projectId,
        source: detachedMemorySource(row),
        supersededBy: row.supersededBy ? ids.get(row.supersededBy) : undefined,
    });
    const memoryVersions = input.memoryVersions.map((version) => ({
        ...version,
        versionId: createId("pmv"),
        memoryId: ids.get(version.memoryId)!,
        projectId,
        snapshot: snapshot(version.snapshot),
    }));
    const memories = input.memories.map((row) => {
        const current = {
            ...snapshot(row),
            status: "pending_review" as const,
            revision: row.revision + 1,
            updatedAt: at,
        };
        delete current.reviewedAt;
        const detachedReplacement = input.memoryVersions.some(
            (version) =>
                version.memoryId === row.id &&
                version.snapshot.supersededBy &&
                !ids.has(version.snapshot.supersededBy),
        );
        memoryVersions.push({
            versionId: createId("pmv"),
            memoryId: current.id,
            projectId,
            revision: current.revision,
            reason: `导入项目备份，等待重新审核${detachedReplacement ? "；原替代条目已删除，已解除关联" : ""}`,
            snapshot: current,
        });
        return current;
    });
    return {memories, memoryVersions};
}

export interface ProjectPackageJson {
    project: unknown;
    characters?: unknown;
    scenes?: unknown;
    props?: unknown;
    styles?: unknown;
    episodes?: unknown;
    shots?: unknown;
    memories?: unknown;
    memoryVersions?: unknown;
    references?: unknown;
    referenceChunks?: unknown;
    audioPackage?: unknown;
}

export function parseProjectPackageRows(raw: ProjectPackageJson) {
    const projectRaw = asRecord(
        raw.project,
        "project.json",
    );
    const charactersRaw = asArray(
        raw.characters,
        "characters.json",
    );
    const scenesRaw = asArray(raw.scenes, "scenes.json");
    const propsRaw = asArray(raw.props, "props.json");
    const stylesRaw = asArray(raw.styles, "styles.json");
    const episodesFile = raw.episodes;
    const episodesRaw =
        episodesFile == null ? [] : asArray(episodesFile, "episodes.json");
    const shotsRaw = asArray(raw.shots, "shots.json");
    const memoryPackage = parseMemoryPackage(
        raw.memories,
        raw.memoryVersions,
        projectRaw.id,
    );
    const referencePackage = parseReferencePackage(raw.references, raw.referenceChunks, projectRaw.id);
    const hasEpisodes = episodesRaw.length > 0;
    validateModernShotRelations(episodesRaw, shotsRaw);

    const project = parseProject(projectRaw, "导入的项目");
    const audioPackage = parseAudioPackage(raw.audioPackage, projectRaw.id, getProjectKind(project));
    if (getProjectKind(project) !== "video" && (episodesRaw.length || shotsRaw.length || charactersRaw.length || scenesRaw.length || propsRaw.length || stylesRaw.length)) throw new PackageError("音频或音乐项目不能包含视频记录");
    return {
        projectRaw, charactersRaw, scenesRaw, propsRaw, stylesRaw, episodesRaw, shotsRaw,
        memoryPackage, referencePackage, hasEpisodes, project, audioPackage
    };
}

export function remapProjectPackageRows(parsed: ReturnType<typeof parseProjectPackageRows>, {projectId, at, mediaMap}: {
    projectId: string; at: string; mediaMap: Map<string, string>;
}) {
    const {
        projectRaw,
        charactersRaw,
        scenesRaw,
        propsRaw,
        stylesRaw,
        episodesRaw,
        shotsRaw,
        memoryPackage,
        hasEpisodes,
        audioPackage
    } = parsed;
    const project = structuredClone(parsed.project);
    project.id = projectId;
    project.createdAt = at;
    project.updatedAt = at;
    const {memories, memoryVersions} = remapMemoryPackage(
        memoryPackage,
        projectId,
        at,
    );
    if (!hasEpisodes) {
        project.columnSettings = {visible: [...DEFAULT_VISIBLE_COLUMNS]};
    }

    const characterMap = new Map<string, string>();
    const sceneMap = new Map<string, string>();
    const propMap = new Map<string, string>();
    const styleMap = new Map<string, string>();
    const episodeMap = new Map<string, string>();
    const beatMaps = new Map<string, Map<string, string>>();
    const shotMap = new Map<string, string>();

    const remappedAudioPackage = remapAudioPackage(audioPackage, projectId, mediaMap);
    const mapMedia = (id?: string) => (id ? mediaMap.get(id) : undefined);

    if (project.coverMediaId) {
        const mappedCover = mapMedia(project.coverMediaId);
        if (mappedCover) project.coverMediaId = mappedCover;
        else delete project.coverMediaId;
    }

    const characters = charactersRaw.map((raw, index) => {
        const character = parseCharacter(raw, projectId, `characters.json[${index}]`);
        const newId = remapId(characterMap, character.id, "chr")!;
        character.id = newId;
        character.projectId = projectId;
        const images: Character["slots"] = {};
        for (const [slot, value] of Object.entries(character.slots)) {
            if (!value) continue;
            images[slot as keyof Character["slots"]] = remapSlot(value, mapMedia);
        }
        character.slots = images;
        return character;
    });

    const scenes = scenesRaw.map((raw, index) => {
        const scene = parseScene(raw, projectId, `scenes.json[${index}]`);
        scene.id = remapId(sceneMap, scene.id, "scn")!;
        scene.projectId = projectId;
        const images: Scene["slots"] = {};
        for (const [slot, value] of Object.entries(scene.slots)) {
            if (!value) continue;
            images[slot as keyof Scene["slots"]] = remapSlot(value, mapMedia);
        }
        scene.slots = images;
        return scene;
    });

    const props = propsRaw.map((raw, index) => {
        const prop = parseProp(raw, projectId, `props.json[${index}]`);
        prop.id = remapId(propMap, prop.id, "prp")!;
        prop.slots = Object.fromEntries(
            Object.entries(prop.slots).map(([slot, value]) => [
                slot,
                value ? remapSlot(value, mapMedia) : value,
            ]),
        );
        return prop;
    });

    const styles = stylesRaw.map((raw, index) => {
        const style = parseStyle(raw, projectId, `styles.json[${index}]`);
        style.id = remapId(styleMap, style.id, "sty")!;
        style.slots = Object.fromEntries(
            Object.entries(style.slots).map(([slot, value]) => [
                slot,
                value ? remapSlot(value, mapMedia) : value,
            ]),
        );
        return style;
    });

    if (project.defaultStyleId !== undefined)
        project.defaultStyleId = styleMap.get(project.defaultStyleId);

    let parsedEpisodes: Episode[] = [];
    if (getProjectKind(project) === "video") {
        parsedEpisodes = hasEpisodes
            ? episodesRaw.map((raw, index) => parseEpisode(raw, projectId, index))
            : [synthesizeFirstEpisode(project, projectRaw)];
    }

    const episodes = parsedEpisodes.map((episode) => {
        const filters = getEpisodeShotFilters(episode, project);
        const oldEpisodeId = episode.id;
        const newId = remapId(episodeMap, oldEpisodeId, "ep")!;
        const beatMap = new Map<string, string>();
        beatMaps.set(oldEpisodeId, beatMap);
        episode.id = newId;
        episode.projectId = projectId;
        episode.story = {
            ...episode.story,
            beats: episode.story.beats.map((beat) => {
                const newBeatId = remapId(beatMap, beat.id, "beat")!;
                return {
                    ...beat,
                    id: newBeatId,
                    characterIds: beat.characterIds
                        .map((id) => characterMap.get(id))
                        .filter((id): id is string => Boolean(id)),
                    sceneId: beat.sceneId ? sceneMap.get(beat.sceneId) : undefined,
                };
            }),
        };
        episode.shotFilters = {
            ...filters,
            beatIds: filters.beatIds.flatMap((id) => {
                if (id === SHOT_UNASSIGNED_BEAT) return [id];
                const mapped = beatMap.get(id);
                return mapped ? [mapped] : [];
            }),
        };
        return episode;
    });
    // Legacy filters have been migrated per episode; never retain obsolete beat IDs.
    project.shotSettings.filters = normalizeShotFilters(undefined);

    const fallbackEpisodeId = episodes[0]?.id ?? createId("ep");

    const shots = shotsRaw.map((raw, index) => {
        // Modern owners were checked before any repair; legacy scopes are deliberately ignored.
        const oldEpisodeId = hasEpisodes && typeof raw.episodeId === "string" ? raw.episodeId : fallbackEpisodeId;
        const shot = parseShot(raw, projectId, oldEpisodeId, index);
        remapShotStoryScope(shot, hasEpisodes, fallbackEpisodeId, episodeMap, beatMaps);
        shot.id = remapId(shotMap, shot.id, "sht")!;
        shot.projectId = projectId;
        shot.firstFrame = remapSlot(shot.firstFrame, mapMedia);
        shot.lastFrame = remapSlot(shot.lastFrame, mapMedia);
        shot.clip = remapSlot(shot.clip, mapMedia);
        shot.characterIds = shot.characterIds
            .map((id) => characterMap.get(id))
            .filter((id): id is string => Boolean(id));
        shot.sceneId = shot.sceneId ? sceneMap.get(shot.sceneId) : undefined;
        if (shot.propIds !== undefined)
            shot.propIds = shot.propIds.flatMap((id) => propMap.get(id) ?? []);
        // A missing explicit style must not unexpectedly inherit a different default.
        if (typeof shot.styleId === "string")
            shot.styleId = styleMap.get(shot.styleId) ?? null;
        return shot;
    });

    return {
        project,
        characters,
        scenes,
        props,
        styles,
        episodes,
        shots,
        memories,
        memoryVersions,
        remappedAudioPackage
    };
}
