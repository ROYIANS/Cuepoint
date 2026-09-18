import JSZip from "jszip";
import { z } from "zod";
import { db } from "@/db/database";
import { collectMediaIds } from "@/db/repo";
import {
  DEFAULT_VISIBLE_COLUMNS,
  normalizeEpisodeStory,
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
import { parseGenerationSlot, parseShotPictureSlots, remapSlot } from "@/domain/slot";
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
  if (fromName && fromName !== filename && fromName.length <= 5) return fromName;
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
    webp: "image/webp",
    gif: "image/gif",
    mp4: "video/mp4",
    webm: "video/webm",
    mov: "video/quicktime",
  };
  return (extension && known[extension]) || "application/octet-stream";
}

const PROJECT_KEYS = [
  "id",
  "name",
  "mode",
  "createdAt",
  "updatedAt",
  "columnSettings",
  "shotSettings",
  "story",
  "setting",
  "extra",
];

function parseProject(raw: Record<string, unknown>, fallbackName: string): Project {
  const visible = (raw.columnSettings as { visible?: ShotColumnId[] } | undefined)
    ?.visible;
  const at = nowIso();
  return {
    id: String(raw.id ?? createId("prj")),
    name: String(raw.name ?? fallbackName),
    mode: normalizeProjectMode(raw.mode),
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
}

const CHARACTER_KEYS = [
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
    for (const [key, value] of Object.entries(rawSlots as Record<string, unknown>)) {
      slots[key as K] = parseGenerationSlot(value);
    }
  }
  if (legacyImages && typeof legacyImages === "object") {
    for (const [key, value] of Object.entries(legacyImages as Record<string, unknown>)) {
      if (!slots[key as K]) slots[key as K] = parseGenerationSlot(undefined, value);
    }
  }
  return slots;
}

function parseCharacter(raw: Record<string, unknown>, projectId: Id): Character {
  const at = nowIso();
  return {
    id: String(raw.id ?? createId("chr")),
    projectId,
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
    name: String(raw.name ?? "未命名风格"),
    notes: String(raw.notes ?? ""),
    slots: parseNamedSlots<StyleImageSlot>(raw.slots, undefined),
    createdAt: String(raw.createdAt ?? at),
    updatedAt: String(raw.updatedAt ?? at),
    extra: pickExtra(raw, STYLE_KEYS),
  };
}

const EPISODE_KEYS = [
  "id",
  "projectId",
  "order",
  "title",
  "story",
  "createdAt",
  "updatedAt",
  "extra",
];

function parseEpisode(raw: Record<string, unknown>, projectId: Id, index: number): Episode {
  const at = nowIso();
  return {
    id: String(raw.id ?? createId("ep")),
    projectId,
    order: Number.isFinite(Number(raw.order)) ? Number(raw.order) : index,
    title: String(raw.title ?? ""),
    story: normalizeEpisodeStory(raw.story),
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

function remapId(map: Map<string, string>, oldId: string | undefined, prefix: string) {
  if (!oldId) return undefined;
  const existing = map.get(oldId);
  if (existing) return existing;
  const next = createId(prefix);
  map.set(oldId, next);
  return next;
}

export async function exportProjectZip(projectId: Id): Promise<Blob> {
  const project = await db.projects.get(projectId);
  if (!project) throw new PackageError("项目不存在");
  const [characters, scenes, props, styles, episodes, shots] = await Promise.all([
    db.characters.where("projectId").equals(projectId).toArray(),
    db.scenes.where("projectId").equals(projectId).toArray(),
    db.props.where("projectId").equals(projectId).toArray(),
    db.styles.where("projectId").equals(projectId).toArray(),
    db.episodes.where("projectId").equals(projectId).sortBy("order"),
    db.shots.where("projectId").equals(projectId).sortBy("order"),
  ]);
  const mediaIds = await collectMediaIds(projectId);
  const zip = new JSZip();
  zip.file(
    "manifest.json",
    JSON.stringify(
      { format: PACKAGE_FORMAT, exportedAt: nowIso(), projectName: project.name },
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
  for (const mediaId of mediaIds) {
    const media = await db.media.get(mediaId);
    if (!media) continue;
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
  const manifestJson = JSON.parse(await manifestFile.async("string")) as unknown;
  const manifest = manifestSchema.safeParse(manifestJson);
  if (!manifest.success) {
    throw new PackageError("不是爱分镜项目包（manifest.format 不匹配）");
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

  const projectRaw = asRecord(await readJson("project.json", true), "project.json");
  const charactersRaw = asArray(await readJson("characters.json"), "characters.json");
  const scenesRaw = asArray(await readJson("scenes.json"), "scenes.json");
  const propsRaw = asArray(await readJson("props.json"), "props.json");
  const stylesRaw = asArray(await readJson("styles.json"), "styles.json");
  const episodesFile = await readJson("episodes.json");
  const episodesRaw = episodesFile == null ? [] : asArray(episodesFile, "episodes.json");
  const shotsRaw = asArray(await readJson("shots.json"), "shots.json");
  const hasEpisodes = episodesRaw.length > 0;

  const project = parseProject(projectRaw, "导入的项目");
  const projectId = createId("prj");
  const at = nowIso();
  project.id = projectId;
  project.createdAt = at;
  project.updatedAt = at;
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
    const newId = remapId(mediaMap, oldId, "med")!;
    const blob = await entry.async("blob");
    const mimeType = blob.type || mimeForFilename(base);
    mediaRecords.push({
      id: newId,
      projectId,
      mimeType,
      filename: base,
      blob: blob.type ? blob : new Blob([blob], { type: mimeType }),
    });
  }

  const mapMedia = (id?: string) => (id ? mediaMap.get(id) : undefined);

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

  const parsedEpisodes = hasEpisodes
    ? episodesRaw.map((raw, index) => parseEpisode(raw, projectId, index))
    : [synthesizeFirstEpisode(project, projectRaw)];

  const episodes = parsedEpisodes.map((episode) => {
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
    return episode;
  });

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
    const beatMap = beatMaps.get(oldEpisodeId) ?? beatMaps.values().next().value;
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
