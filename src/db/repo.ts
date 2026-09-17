import { db } from "./database";
import {
  DEFAULT_SHOT_SETTINGS,
  DEFAULT_VISIBLE_COLUMNS,
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
import { collectSlotsMedia, emptySlot, slotMediaIds } from "@/domain/slot";
import { createId, nowIso } from "@/lib/ids";

function touch<T extends { updatedAt: string }>(record: T): T {
  return { ...record, updatedAt: nowIso() };
}

export async function touchProject(projectId: Id): Promise<void> {
  const project = await db.projects.get(projectId);
  if (!project) return;
  await db.projects.put(touch(project));
}

export function emptyProject(name: string): Project {
  const at = nowIso();
  return {
    id: createId("prj"),
    name: name.trim() || "未命名项目",
    createdAt: at,
    updatedAt: at,
    columnSettings: { visible: [...DEFAULT_VISIBLE_COLUMNS] },
    shotSettings: { ...DEFAULT_SHOT_SETTINGS },
  };
}

export function emptyCharacter(projectId: Id, name = "未命名角色"): Character {
  const at = nowIso();
  return {
    id: createId("chr"),
    projectId,
    name,
    bio: "",
    appearance: "",
    notes: "",
    slots: {},
    createdAt: at,
    updatedAt: at,
  };
}

export function emptyScene(projectId: Id, name = "未命名场景"): Scene {
  const at = nowIso();
  return {
    id: createId("scn"),
    projectId,
    name,
    location: "",
    timeOfDay: "",
    atmosphere: "",
    notes: "",
    slots: {},
    createdAt: at,
    updatedAt: at,
  };
}

export function emptyShot(
  projectId: Id,
  order: number,
  shotNumber: string,
  durationSec: number,
): Shot {
  return {
    id: createId("sht"),
    projectId,
    order,
    shotNumber,
    frame: emptySlot(),
    reference: emptySlot(),
    category: "",
    durationSec,
    content: "",
    notes: "",
    sceneCloseup: "",
    sound: "",
    emotion: "",
    cameraAngle: "",
    cameraGear: "",
    focalLength: "",
    characterIds: [],
  };
}

export async function listProjects(): Promise<Project[]> {
  const rows = await db.projects.toArray();
  return rows.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function createProject(name: string): Promise<Project> {
  const project = emptyProject(name);
  await db.projects.add(project);
  return project;
}

export async function renameProject(id: Id, name: string): Promise<void> {
  const project = await db.projects.get(id);
  if (!project) return;
  await db.projects.put(touch({ ...project, name: name.trim() || project.name }));
}

export async function deleteProject(id: Id): Promise<void> {
  await db.transaction(
    "rw",
    db.projects,
    db.characters,
    db.scenes,
    db.shots,
    db.media,
    async () => {
      await db.characters.where("projectId").equals(id).delete();
      await db.scenes.where("projectId").equals(id).delete();
      await db.shots.where("projectId").equals(id).delete();
      await db.media.where("projectId").equals(id).delete();
      await db.projects.delete(id);
    },
  );
}

export async function updateProject(
  id: Id,
  patch: Partial<Pick<Project, "name" | "columnSettings" | "shotSettings">>,
): Promise<void> {
  const project = await db.projects.get(id);
  if (!project) return;
  await db.projects.put(touch({ ...project, ...patch }));
}

export async function collectMediaIds(projectId: Id): Promise<Set<Id>> {
  const [characters, scenes, shots] = await Promise.all([
    db.characters.where("projectId").equals(projectId).toArray(),
    db.scenes.where("projectId").equals(projectId).toArray(),
    db.shots.where("projectId").equals(projectId).toArray(),
  ]);
  const ids = new Set<Id>();
  for (const mediaId of collectSlotsMedia([
    ...characters.flatMap((character) => Object.values(character.slots ?? {})),
    ...scenes.flatMap((scene) => Object.values(scene.slots ?? {})),
    ...shots.flatMap((shot) => [shot.frame, shot.reference]),
  ])) {
    ids.add(mediaId);
  }
  return ids;
}

async function recycleSlotMedia(
  previous: GenerationSlot | undefined,
  next: GenerationSlot | undefined,
): Promise<void> {
  const kept = new Set(slotMediaIds(next));
  for (const mediaId of slotMediaIds(previous)) {
    if (!kept.has(mediaId)) await deleteMediaIfOrphan(mediaId);
  }
}

export async function putMedia(record: MediaRecord): Promise<Id> {
  await db.media.put(record);
  await touchProject(record.projectId);
  return record.id;
}

export async function deleteMediaIfOrphan(mediaId: Id | undefined): Promise<void> {
  if (!mediaId) return;
  const record = await db.media.get(mediaId);
  if (!record) return;
  const used = await collectMediaIds(record.projectId);
  if (!used.has(mediaId)) {
    await db.media.delete(mediaId);
  }
}

export async function addCharacter(projectId: Id): Promise<Character> {
  const character = emptyCharacter(projectId);
  await db.characters.add(character);
  await touchProject(projectId);
  return character;
}

export async function patchCharacter(
  id: Id,
  patch: Partial<Omit<Character, "id" | "projectId" | "createdAt">>,
): Promise<void> {
  const character = await db.characters.get(id);
  if (!character) return;
  await db.characters.put(touch({ ...character, ...patch }));
  await touchProject(character.projectId);
}

export async function setCharacterSlot(
  id: Id,
  slotKey: CharacterImageSlot,
  slot: GenerationSlot,
): Promise<void> {
  const character = await db.characters.get(id);
  if (!character) return;
  const previous = character.slots[slotKey];
  await db.characters.put(
    touch({ ...character, slots: { ...character.slots, [slotKey]: slot } }),
  );
  await touchProject(character.projectId);
  await recycleSlotMedia(previous, slot);
}

export async function deleteCharacter(id: Id): Promise<void> {
  const character = await db.characters.get(id);
  if (!character) return;
  const mediaIds = collectSlotsMedia(Object.values(character.slots));
  await db.characters.delete(id);
  const shots = await db.shots.where("projectId").equals(character.projectId).toArray();
  for (const shot of shots) {
    if (shot.characterIds.includes(id)) {
      await db.shots.put({
        ...shot,
        characterIds: shot.characterIds.filter((item) => item !== id),
      });
    }
  }
  await touchProject(character.projectId);
  for (const mediaId of mediaIds) await deleteMediaIfOrphan(mediaId);
}

export async function addScene(projectId: Id): Promise<Scene> {
  const scene = emptyScene(projectId);
  await db.scenes.add(scene);
  await touchProject(projectId);
  return scene;
}

export async function patchScene(
  id: Id,
  patch: Partial<Omit<Scene, "id" | "projectId" | "createdAt">>,
): Promise<void> {
  const scene = await db.scenes.get(id);
  if (!scene) return;
  await db.scenes.put(touch({ ...scene, ...patch }));
  await touchProject(scene.projectId);
}

export async function setSceneSlot(
  id: Id,
  slotKey: SceneImageSlot,
  slot: GenerationSlot,
): Promise<void> {
  const scene = await db.scenes.get(id);
  if (!scene) return;
  const previous = scene.slots[slotKey];
  await db.scenes.put(touch({ ...scene, slots: { ...scene.slots, [slotKey]: slot } }));
  await touchProject(scene.projectId);
  await recycleSlotMedia(previous, slot);
}

export async function deleteScene(id: Id): Promise<void> {
  const scene = await db.scenes.get(id);
  if (!scene) return;
  const mediaIds = collectSlotsMedia(Object.values(scene.slots));
  await db.scenes.delete(id);
  const shots = await db.shots.where("projectId").equals(scene.projectId).toArray();
  for (const shot of shots) {
    if (shot.sceneId === id) {
      await db.shots.put({ ...shot, sceneId: undefined });
    }
  }
  await touchProject(scene.projectId);
  for (const mediaId of mediaIds) await deleteMediaIfOrphan(mediaId);
}

async function nextShotNumber(projectId: Id): Promise<string> {
  const shots = await db.shots.where("projectId").equals(projectId).toArray();
  const max = shots.reduce((current, shot) => {
    const value = Number.parseInt(shot.shotNumber, 10);
    return Number.isFinite(value) ? Math.max(current, value) : current;
  }, 0);
  return String(max + 1);
}

async function reindexShots(projectId: Id): Promise<void> {
  const shots = (await db.shots.where("projectId").equals(projectId).toArray()).sort(
    (a, b) => a.order - b.order,
  );
  await Promise.all(
    shots.map((shot, index) => db.shots.put({ ...shot, order: index + 1 })),
  );
}

export async function addShot(projectId: Id, atOrder?: number): Promise<Shot> {
  const project = await db.projects.get(projectId);
  const shots = (await db.shots.where("projectId").equals(projectId).toArray()).sort(
    (a, b) => a.order - b.order,
  );
  const insertAt = atOrder ?? shots.length + 1;
  for (const shot of shots) {
    if (shot.order >= insertAt) {
      await db.shots.put({ ...shot, order: shot.order + 1 });
    }
  }
  const shotNumber = project?.shotSettings.autoIncrementShotNumber
    ? await nextShotNumber(projectId)
    : String(insertAt);
  const shot = emptyShot(
    projectId,
    insertAt,
    shotNumber,
    project?.shotSettings.defaultDurationSec ?? 0,
  );
  await db.shots.add(shot);
  await touchProject(projectId);
  return shot;
}

export async function patchShot(
  id: Id,
  patch: Partial<Omit<Shot, "id" | "projectId">>,
): Promise<void> {
  const shot = await db.shots.get(id);
  if (!shot) return;
  await db.shots.put({ ...shot, ...patch });
  await touchProject(shot.projectId);
}

export async function setShotSlot(
  id: Id,
  field: "frame" | "reference",
  slot: GenerationSlot,
): Promise<void> {
  const shot = await db.shots.get(id);
  if (!shot) return;
  const previous = shot[field];
  await db.shots.put({ ...shot, [field]: slot });
  await touchProject(shot.projectId);
  await recycleSlotMedia(previous, slot);
}

export async function deleteShots(ids: Id[]): Promise<void> {
  if (ids.length === 0) return;
  const first = await db.shots.get(ids[0]);
  const mediaIds: Id[] = [];
  for (const id of ids) {
    const shot = await db.shots.get(id);
    if (!shot) continue;
    mediaIds.push(...slotMediaIds(shot.frame), ...slotMediaIds(shot.reference));
    await db.shots.delete(id);
  }
  if (first) {
    await reindexShots(first.projectId);
    await touchProject(first.projectId);
  }
  for (const mediaId of mediaIds) await deleteMediaIfOrphan(mediaId);
}

export async function setVisibleColumns(
  projectId: Id,
  visible: ShotColumnId[],
): Promise<void> {
  await updateProject(projectId, { columnSettings: { visible } });
}
