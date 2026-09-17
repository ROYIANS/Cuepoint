import JSZip from "jszip";
import { z } from "zod";
import { db } from "@/db/database";
import { collectMediaIds } from "@/db/repo";
import {
  DEFAULT_VISIBLE_COLUMNS,
  normalizeSetting,
  normalizeStory,
  PACKAGE_FORMAT,
  type Character,
  type CharacterImageSlot,
  type GenerationSlot,
  type Id,
  type MediaRecord,
  type Project,
  type Scene,
  type SceneImageSlot,
  type Shot,
  type ShotColumnId,
} from "@/domain/types";
import { parseGenerationSlot, remapSlot } from "@/domain/slot";
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
  const extra: Record<string, unknown> = {};
  const knownSet = new Set(known);
  for (const [key, value] of Object.entries(raw)) {
    if (!knownSet.has(key)) extra[key] = value;
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

const PROJECT_KEYS = [
  "id",
  "name",
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
  const shotSettings = raw.shotSettings as Project["shotSettings"] | undefined;
  const at = nowIso();
  return {
    id: String(raw.id ?? createId("prj")),
    name: String(raw.name ?? fallbackName),
    createdAt: String(raw.createdAt ?? at),
    updatedAt: String(raw.updatedAt ?? at),
    columnSettings: {
      visible:
        Array.isArray(visible) && visible.length > 0
          ? (visible as ShotColumnId[])
          : [...DEFAULT_VISIBLE_COLUMNS],
    },
    shotSettings: {
      defaultDurationSec: Number(shotSettings?.defaultDurationSec ?? 0) || 0,
      autoIncrementShotNumber: shotSettings?.autoIncrementShotNumber !== false,
    },
    story: normalizeStory(raw.story),
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

const SHOT_KEYS = [
  "id",
  "projectId",
  "order",
  "shotNumber",
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

function parseShot(raw: Record<string, unknown>, projectId: Id, index: number): Shot {
  return {
    id: String(raw.id ?? createId("sht")),
    projectId,
    order: Number(raw.order ?? index + 1) || index + 1,
    shotNumber: String(raw.shotNumber ?? index + 1),
    frame: parseGenerationSlot(raw.frame, raw.frameMediaId),
    reference: parseGenerationSlot(raw.reference, raw.referenceMediaId),
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
  const [characters, scenes, shots] = await Promise.all([
    db.characters.where("projectId").equals(projectId).toArray(),
    db.scenes.where("projectId").equals(projectId).toArray(),
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
  const shotsRaw = asArray(await readJson("shots.json"), "shots.json");

  const project = parseProject(projectRaw, "导入的项目");
  const projectId = createId("prj");
  const at = nowIso();
  project.id = projectId;
  project.createdAt = at;
  project.updatedAt = at;

  const mediaMap = new Map<string, string>();
  const characterMap = new Map<string, string>();
  const sceneMap = new Map<string, string>();
  const shotMap = new Map<string, string>();

  const mediaRecords: MediaRecord[] = [];
  const mediaFiles = zip.file(/^media\//);
  for (const entry of mediaFiles) {
    if (entry.dir) continue;
    const base = entry.name.split("/").pop() ?? entry.name;
    const oldId = base.replace(/\.[^.]+$/, "");
    const newId = remapId(mediaMap, oldId, "med")!;
    const blob = await entry.async("blob");
    const mimeType = blob.type || "application/octet-stream";
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
      images[slot as keyof Scene["slots"]] = remapSlot(value, mapMedia);
    }
    scene.slots = images;
    return scene;
  });

  const shots = shotsRaw.map((raw, index) => {
    const shot = parseShot(raw, projectId, index);
    shot.id = remapId(shotMap, shot.id, "sht")!;
    shot.projectId = projectId;
    shot.frame = remapSlot(shot.frame, mapMedia);
    shot.reference = remapSlot(shot.reference, mapMedia);
    shot.characterIds = shot.characterIds
      .map((id) => characterMap.get(id))
      .filter((id): id is string => Boolean(id));
    shot.sceneId = shot.sceneId ? sceneMap.get(shot.sceneId) : undefined;
    return shot;
  });

  try {
    await db.transaction(
      "rw",
      db.projects,
      db.characters,
      db.scenes,
      db.shots,
      db.media,
      async () => {
        await db.projects.add(project);
        if (characters.length) await db.characters.bulkAdd(characters);
        if (scenes.length) await db.scenes.bulkAdd(scenes);
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
