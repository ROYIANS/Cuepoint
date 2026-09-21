import { parseReferencePackage, remapReferencePackage } from "./references/package";
import type {
  ProjectMemory,
  ProjectMemoryVersion,
  MemorySource,
} from "@/domain/projectMemory";
import {
  normalizeMemoryText,
  projectMemorySchema,
  projectMemoryVersionSchema,
} from "@/lib/memory/schema";
import { parseGenerationDefaults } from "@/domain/output";
import JSZip from "jszip";
import { z } from "zod";
import { db } from "@/db/database";
import { collectMediaIds } from "@/db/repo";
import {
  DEFAULT_VISIBLE_COLUMNS,
  normalizeAspectPreset,
  normalizeEpisodeStory,
  getEpisodeShotFilters,
  normalizeShotFilters,
  SHOT_UNASSIGNED_BEAT,
  normalizeProjectMode,
  normalizeShotSettings,
  normalizeShotStatus,
  normalizeSeriesStory,
  normalizeSetting,
  PACKAGE_FORMAT,
  type Character,
  type CharacterImageSlot,
  type Episode,
  type GenerationSlot,
  type Id,
  type MediaRecord,
  type Project,
  type Prop,
  type PropImageSlot,
  type Scene,
  type SceneImageSlot,
  type Shot,
  type ShotColumnId,
  type StyleImageSlot,
  type VisualStyle,
} from "@/domain/types";
import {
  parseGenerationSlot,
  parseShotPictureSlots,
  remapSlot,
} from "@/domain/slot";
import { createId, nowIso } from "./ids";

const recordSchema = z.object({}).passthrough();

const manifestSchema = z.object({
  format: z.literal(PACKAGE_FORMAT),
  exportedAt: z.string().optional(),
});

export class PackageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PackageError";
  }
}

function asRecord(value: unknown, label: string): Record<string, unknown> {
  const parsed = recordSchema.safeParse(value);
  if (!parsed.success) throw new PackageError(`${label} 不是有效对象`);
  return parsed.data as Record<string, unknown>;
}

function asArray(value: unknown, label: string): Record<string, unknown>[] {
  if (value == null) return [];
  if (!Array.isArray(value)) throw new PackageError(`${label} 必须是数组`);
  return value.map((item, index) => asRecord(item, `${label}[${index}]`));
}

function pickExtra(
  raw: Record<string, unknown>,
  known: string[],
): Record<string, unknown> | undefined {
  const nested = raw.extra;
  const extra: Record<string, unknown> =
    nested && typeof nested === "object" && !Array.isArray(nested)
      ? { ...(nested as Record<string, unknown>) }
      : {};
  const knownSet = new Set(known);
  for (const [key, value] of Object.entries(raw)) {
    if (key !== "extra" && !knownSet.has(key)) extra[key] = value;
  }
  return Object.keys(extra).length > 0 ? extra : undefined;
}

function extFor(mimeType: string, filename: string): string {
  const fromName = filename.split(".").pop();
  if (fromName && fromName !== filename && fromName.length <= 5)
    return fromName;
  if (mimeType.includes("png")) return "png";
  if (mimeType.includes("webp")) return "webp";
  if (mimeType.includes("gif")) return "gif";
  if (mimeType.includes("mp4")) return "mp4";
  if (mimeType.includes("webm")) return "webm";
  if (mimeType.includes("quicktime")) return "mov";
  if (mimeType.startsWith("video/")) return "mp4";
  return "jpg";
}

function mimeForFilename(filename: string): string {
  const extension = filename.split(".").pop()?.toLowerCase();
  const known: Record<string, string> = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    jfif: "image/jpeg",
    webp: "image/webp",
    gif: "image/gif",
    mp4: "video/mp4",
    webm: "video/webm",
    mov: "video/quicktime",
  };
  return (extension && known[extension]) || "application/octet-stream";
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
  const visible = (
    raw.columnSettings as { visible?: ShotColumnId[] } | undefined
  )?.visible;
  const at = nowIso();
  const coverMediaId =
    raw.coverMediaId != null && String(raw.coverMediaId).trim()
      ? String(raw.coverMediaId)
      : undefined;
  const project: Project = {
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
          ? (visible as ShotColumnId[])
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
): Partial<Record<K, GenerationSlot>> {
  const slots: Partial<Record<K, GenerationSlot>> = {};
  if (rawSlots && typeof rawSlots === "object") {
    for (const [key, value] of Object.entries(
      rawSlots as Record<string, unknown>,
    )) {
      slots[key as K] = parseGenerationSlot(value);
    }
  }
  if (legacyImages && typeof legacyImages === "object") {
    for (const [key, value] of Object.entries(
      legacyImages as Record<string, unknown>,
    )) {
      if (!slots[key as K])
        slots[key as K] = parseGenerationSlot(undefined, value);
    }
  }
  return slots;
}

function parseCharacter(
  raw: Record<string, unknown>,
  projectId: Id,
): Character {
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
    slots: parseNamedSlots<CharacterImageSlot>(raw.slots, raw.images),
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

function parseScene(raw: Record<string, unknown>, projectId: Id): Scene {
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
    slots: parseNamedSlots<SceneImageSlot>(raw.slots, raw.images),
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

function parseProp(raw: Record<string, unknown>, projectId: Id): Prop {
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
    slots: parseNamedSlots<PropImageSlot>(raw.slots, undefined),
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

function parseStyle(raw: Record<string, unknown>, projectId: Id): VisualStyle {
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
    slots: parseNamedSlots<StyleImageSlot>(raw.slots, undefined),
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

function parseEpisode(
  raw: Record<string, unknown>,
  projectId: Id,
  index: number,
): Episode {
  const at = nowIso();
  return {
    id: String(raw.id ?? createId("ep")),
    projectId,
    order: Number.isFinite(Number(raw.order)) ? Number(raw.order) : index,
    title: String(raw.title ?? ""),
    story: normalizeEpisodeStory(raw.story),
    ...(raw.shotFilters === undefined
      ? {}
      : { shotFilters: normalizeShotFilters(raw.shotFilters) }),
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
  const slots = parseShotPictureSlots(raw);
  return {
    id: String(raw.id ?? createId("sht")),
    projectId,
    episodeId: String(raw.episodeId ?? episodeId),
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

function remapId(
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
  return { memories, memoryVersions };
}

function detachedMemorySource(row: ProjectMemory): MemorySource {
  const source = row.source;
  if (source.kind === "imported") return { ...source };
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
  return { memories, memoryVersions };
}

export async function exportProjectZip(projectId: Id): Promise<Blob> {
  // Snapshot all JSON rows and referenced Blobs under one read transaction.
  // Compression happens after the transaction closes; no external awaits hold it open.
  const {
    project,
    characters,
    scenes,
    props,
    styles,
    episodes,
    shots,
    mediaRecords,
    memories,
    memoryVersions,
    references,
    referenceChunks,
  } = await db.transaction(
    "r",
    [
      db.projects,
      db.characters,
      db.scenes,
      db.props,
      db.styles,
      db.episodes,
      db.shots,
      db.media,
      db.materialUses,
      db.projectMemories,
      db.projectMemoryVersions,
      db.projectReferences,
      db.referenceChunks,
    ],
    async () => {
      const project = await db.projects.get(projectId);
      if (!project) throw new PackageError("项目不存在");
      const [
        characters,
        scenes,
        props,
        styles,
        episodes,
        shots,
        memories,
        memoryVersions,
        references,
        referenceChunks,
      ] = await Promise.all([
        db.characters.where("projectId").equals(projectId).toArray(),
        db.scenes.where("projectId").equals(projectId).toArray(),
        db.props.where("projectId").equals(projectId).toArray(),
        db.styles.where("projectId").equals(projectId).toArray(),
        db.episodes.where("projectId").equals(projectId).sortBy("order"),
        db.shots.where("projectId").equals(projectId).sortBy("order"),
        db.projectMemories.where("projectId").equals(projectId).toArray(),
        db.projectMemoryVersions.where("projectId").equals(projectId).toArray(),
        db.projectReferences.where("projectId").equals(projectId).toArray(),
        db.referenceChunks.where("projectId").equals(projectId).toArray(),
      ]);
      const mediaIds = await collectMediaIds(projectId);
      const mediaRecords = (await db.media.bulkGet([...mediaIds])).filter(
        (media): media is MediaRecord =>
          media !== undefined && media.projectId === projectId,
      );
      return {
        project,
        characters,
        scenes,
        props,
        styles,
        episodes,
        shots,
        mediaRecords,
        memories,
        memoryVersions,
        references,
        referenceChunks,
      };
    },
  );
  const zip = new JSZip();
  zip.file(
    "manifest.json",
    JSON.stringify(
      {
        format: PACKAGE_FORMAT,
        exportedAt: nowIso(),
        projectName: project.name,
      },
      null,
      2,
    ),
  );
  zip.file("project.json", JSON.stringify(project, null, 2));
  zip.file("characters.json", JSON.stringify(characters, null, 2));
  zip.file("scenes.json", JSON.stringify(scenes, null, 2));
  zip.file("props.json", JSON.stringify(props, null, 2));
  zip.file("styles.json", JSON.stringify(styles, null, 2));
  zip.file("episodes.json", JSON.stringify(episodes, null, 2));
  zip.file("shots.json", JSON.stringify(shots, null, 2));
  zip.file("memories.json", JSON.stringify(memories, null, 2));
  zip.file("memoryVersions.json", JSON.stringify(memoryVersions, null, 2));
  zip.file("references.json", JSON.stringify(references));
  zip.file("referenceChunks.json", JSON.stringify(referenceChunks));
  zip.file("mediaMetadata.json", JSON.stringify(mediaRecords.map((media) => ({
    id: media.id, projectId: media.projectId, filename: media.filename, mimeType: media.mimeType, libraryRetained: media.libraryRetained,
  }))));
  for (const media of mediaRecords) {
    const filename = `media/${media.id}.${extFor(media.mimeType, media.filename)}`;
    zip.file(filename, media.blob);
  }
  return zip.generateAsync({ type: "blob" });
}

export async function importProjectZip(file: Blob): Promise<Project> {
  const zip = await JSZip.loadAsync(file).catch(() => {
    throw new PackageError("无法读取 zip 文件");
  });
  const manifestFile = zip.file("manifest.json");
  if (!manifestFile) throw new PackageError("缺少 manifest.json");
  const manifestJson = JSON.parse(
    await manifestFile.async("string"),
  ) as unknown;
  const manifest = manifestSchema.safeParse(manifestJson);
  if (!manifest.success) {
    throw new PackageError("不是小光点项目包（manifest.format 不匹配）");
  }

  const readJson = async (name: string, required = false) => {
    const entry = zip.file(name);
    if (!entry) {
      if (required) throw new PackageError(`缺少 ${name}`);
      return undefined;
    }
    try {
      return JSON.parse(await entry.async("string")) as unknown;
    } catch {
      throw new PackageError(`${name} 不是合法 JSON`);
    }
  };

  const projectRaw = asRecord(
    await readJson("project.json", true),
    "project.json",
  );
  const charactersRaw = asArray(
    await readJson("characters.json"),
    "characters.json",
  );
  const scenesRaw = asArray(await readJson("scenes.json"), "scenes.json");
  const propsRaw = asArray(await readJson("props.json"), "props.json");
  const stylesRaw = asArray(await readJson("styles.json"), "styles.json");
  const episodesFile = await readJson("episodes.json");
  const episodesRaw =
    episodesFile == null ? [] : asArray(episodesFile, "episodes.json");
  const shotsRaw = asArray(await readJson("shots.json"), "shots.json");
  const memoryPackage = parseMemoryPackage(
    await readJson("memories.json"),
    await readJson("memoryVersions.json"),
    projectRaw.id,
  );
  const referencePackage = parseReferencePackage(await readJson("references.json"), await readJson("referenceChunks.json"), projectRaw.id);
  const mediaMetadataRaw = await readJson("mediaMetadata.json");
  const mediaMetadata = new Map<string, { filename: string; mimeType: string; libraryRetained?: boolean }>();
  if (mediaMetadataRaw !== undefined) {
    for (const raw of asArray(mediaMetadataRaw, "mediaMetadata.json")) {
      const row = asRecord(raw, "mediaMetadata.json");
      if (typeof row.id !== "string" || !row.id || /[/\\]/.test(row.id) || mediaMetadata.has(row.id)
        || row.projectId !== projectRaw.id || typeof row.filename !== "string" || !row.filename
        || typeof row.mimeType !== "string" || !/^[a-zA-Z0-9!#$&^_.+-]+\/[a-zA-Z0-9!#$&^_.+-]+$/.test(row.mimeType)) {
        throw new PackageError("媒体元数据无效、重复或不属于当前项目");
      }
      if (row.libraryRetained !== undefined && typeof row.libraryRetained !== "boolean") throw new PackageError("素材保留标记无效");
      mediaMetadata.set(row.id, { filename: row.filename, mimeType: row.mimeType, libraryRetained: row.libraryRetained });
    }
  }
  const hasEpisodes = episodesRaw.length > 0;

  const project = parseProject(projectRaw, "导入的项目");
  const projectId = createId("prj");
  const at = nowIso();
  project.id = projectId;
  project.createdAt = at;
  project.updatedAt = at;
  const { memories, memoryVersions } = remapMemoryPackage(
    memoryPackage,
    projectId,
    at,
  );
  if (!hasEpisodes) {
    project.columnSettings = { visible: [...DEFAULT_VISIBLE_COLUMNS] };
  }

  const mediaMap = new Map<string, string>();
  const characterMap = new Map<string, string>();
  const sceneMap = new Map<string, string>();
  const propMap = new Map<string, string>();
  const styleMap = new Map<string, string>();
  const episodeMap = new Map<string, string>();
  const beatMaps = new Map<string, Map<string, string>>();
  const shotMap = new Map<string, string>();

  const mediaRecords: MediaRecord[] = [];
  const mediaFiles = zip.file(/^media\//);
  for (const entry of mediaFiles) {
    if (entry.dir) continue;
    const base = entry.name.split("/").pop() ?? entry.name;
    const oldId = base.replace(/\.[^.]+$/, "");
    if (mediaMap.has(oldId)) throw new PackageError("项目包中存在重复媒体 ID");
    const metadata = mediaMetadata.get(oldId);
    if (mediaMetadataRaw !== undefined && !metadata) throw new PackageError("媒体缺少元数据");
    const newId = remapId(mediaMap, oldId, "med")!;
    const blob = await entry.async("blob");
    const mimeType = metadata?.mimeType ?? (blob.type || mimeForFilename(base));
    mediaRecords.push({
      id: newId,
      projectId,
      mimeType,
      filename: metadata?.filename ?? base,
      libraryRetained: metadata?.libraryRetained,
      blob: new Blob([blob], { type: mimeType }),
    });
  }

  if ([...mediaMetadata.keys()].some((id) => !mediaMap.has(id))) throw new PackageError("媒体元数据对应的文件缺失");

  const { references, chunks: referenceChunks } = await remapReferencePackage(referencePackage, projectId, mediaMap, mediaRecords);

  const mapMedia = (id?: string) => (id ? mediaMap.get(id) : undefined);

  if (project.coverMediaId) {
    const mappedCover = mapMedia(project.coverMediaId);
    if (mappedCover) project.coverMediaId = mappedCover;
    else delete project.coverMediaId;
  }

  const characters = charactersRaw.map((raw) => {
    const character = parseCharacter(raw, projectId);
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

  const scenes = scenesRaw.map((raw) => {
    const scene = parseScene(raw, projectId);
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

  const props = propsRaw.map((raw) => {
    const prop = parseProp(raw, projectId);
    prop.id = remapId(propMap, prop.id, "prp")!;
    prop.slots = Object.fromEntries(
      Object.entries(prop.slots).map(([slot, value]) => [
        slot,
        value ? remapSlot(value, mapMedia) : value,
      ]),
    ) as Prop["slots"];
    return prop;
  });

  const styles = stylesRaw.map((raw) => {
    const style = parseStyle(raw, projectId);
    style.id = remapId(styleMap, style.id, "sty")!;
    style.slots = Object.fromEntries(
      Object.entries(style.slots).map(([slot, value]) => [
        slot,
        value ? remapSlot(value, mapMedia) : value,
      ]),
    ) as VisualStyle["slots"];
    return style;
  });

  if (project.defaultStyleId !== undefined)
    project.defaultStyleId = styleMap.get(project.defaultStyleId);

  const parsedEpisodes = hasEpisodes
    ? episodesRaw.map((raw, index) => parseEpisode(raw, projectId, index))
    : [synthesizeFirstEpisode(project, projectRaw)];

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
    const shot = parseShot(raw, projectId, fallbackEpisodeId, index);
    const oldEpisodeId = shot.episodeId;
    shot.id = remapId(shotMap, shot.id, "sht")!;
    shot.projectId = projectId;
    shot.episodeId = episodeMap.get(oldEpisodeId) ?? fallbackEpisodeId;
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
    const beatMap =
      beatMaps.get(oldEpisodeId) ?? beatMaps.values().next().value;
    shot.beatId = shot.beatId ? beatMap?.get(shot.beatId) : undefined;
    return shot;
  });

  try {
    await db.transaction(
      "rw",
      [
        db.projects,
        db.characters,
        db.scenes,
        db.props,
        db.styles,
        db.episodes,
        db.shots,
        db.media,
        db.projectMemories,
        db.projectMemoryVersions,
        db.projectReferences,
        db.referenceChunks,
      ],
      async () => {
        await db.projects.add(project);
        if (characters.length) await db.characters.bulkAdd(characters);
        if (scenes.length) await db.scenes.bulkAdd(scenes);
        if (props.length) await db.props.bulkAdd(props);
        if (styles.length) await db.styles.bulkAdd(styles);
        if (episodes.length) await db.episodes.bulkAdd(episodes);
        if (shots.length) await db.shots.bulkAdd(shots);
        if (mediaRecords.length) await db.media.bulkAdd(mediaRecords);
        if (references.length) await db.projectReferences.bulkAdd(references);
        if (referenceChunks.length) await db.referenceChunks.bulkAdd(referenceChunks);
        if (memories.length) await db.projectMemories.bulkAdd(memories);
        if (memoryVersions.length)
          await db.projectMemoryVersions.bulkAdd(memoryVersions);
      },
    );
  } catch (error) {
    throw new PackageError(
      error instanceof Error ? `导入失败：${error.message}` : "导入失败",
    );
  }

  return project;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
