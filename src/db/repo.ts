import { db } from "./database";
import {
  DEFAULT_SHOT_SETTINGS,
  DEFAULT_VISIBLE_COLUMNS,
  emptyEpisodeStory,
  emptySeriesStory,
  emptySetting,
  isStudioLibrary,
  normalizeEpisodeStory,
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
  type ShotPictureField,
  type StoryBeat,
  type StyleImageSlot,
  type VisualStyle,
} from "@/domain/types";
import { collectSlotsMedia, emptySlot, SHOT_PICTURE_FIELDS, slotMediaIds } from "@/domain/slot";
import { createId, nowIso } from "@/lib/ids";

function touch<T extends { updatedAt: string }>(record: T): T {
  return { ...record, updatedAt: nowIso() };
}

export async function touchProject(projectId: Id): Promise<void> {
  if (isStudioLibrary(projectId)) return;
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
    story: emptySeriesStory(),
    setting: emptySetting(),
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

export function emptyProp(projectId: Id, name = "未命名道具"): Prop {
  const at = nowIso();
  return {
    id: createId("prp"),
    projectId,
    name,
    kind: "",
    notes: "",
    slots: {},
    createdAt: at,
    updatedAt: at,
  };
}

export function emptyStyle(projectId: Id, name = "未命名风格"): VisualStyle {
  const at = nowIso();
  return {
    id: createId("sty"),
    projectId,
    name,
    notes: "",
    slots: {},
    createdAt: at,
    updatedAt: at,
  };
}

export function emptyEpisode(projectId: Id, order: number, title = ""): Episode {
  const at = nowIso();
  return {
    id: createId("ep"),
    projectId,
    order,
    title,
    story: emptyEpisodeStory(),
    createdAt: at,
    updatedAt: at,
  };
}

export function emptyShot(
  projectId: Id,
  episodeId: Id,
  order: number,
  shotNumber: string,
  durationSec: number,
  beatId?: Id,
): Shot {
  return {
    id: createId("sht"),
    projectId,
    episodeId,
    order,
    shotNumber,
    firstFrame: emptySlot(),
    lastFrame: emptySlot(),
    clip: emptySlot(),
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
    ...(beatId ? { beatId } : {}),
  };
}

export async function listProjects(): Promise<Project[]> {
  const rows = await db.projects.toArray();
  return rows.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function createProject(name: string): Promise<Project> {
  const project = emptyProject(name);
  const episode = emptyEpisode(project.id, 0);
  await db.transaction("rw", db.projects, db.episodes, async () => {
    await db.projects.add(project);
    await db.episodes.add(episode);
  });
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
      await db.characters.where("projectId").equals(id).delete();
      await db.scenes.where("projectId").equals(id).delete();
      await db.props.where("projectId").equals(id).delete();
      await db.styles.where("projectId").equals(id).delete();
      await db.episodes.where("projectId").equals(id).delete();
      await db.shots.where("projectId").equals(id).delete();
      await db.media.where("projectId").equals(id).delete();
      await db.projects.delete(id);
    },
  );
}

export async function updateProject(
  id: Id,
  patch: Partial<Pick<Project, "name" | "columnSettings" | "shotSettings" | "story" | "setting">>,
): Promise<void> {
  const project = await db.projects.get(id);
  if (!project) return;
  await db.projects.put(touch({ ...project, ...patch }));
}

export async function listEpisodes(projectId: Id): Promise<Episode[]> {
  const rows = await db.episodes.where("projectId").equals(projectId).toArray();
  return rows.sort((a, b) => a.order - b.order);
}

export async function firstEpisode(projectId: Id): Promise<Episode | undefined> {
  const episodes = await listEpisodes(projectId);
  return episodes[0];
}

export async function addEpisode(projectId: Id): Promise<Episode> {
  const project = await db.projects.get(projectId);
  if (!project) throw new Error("项目不存在");
  const existing = await listEpisodes(projectId);
  const nextOrder = existing.reduce((max, episode) => Math.max(max, episode.order), -1) + 1;
  const episode = emptyEpisode(projectId, nextOrder);
  await db.episodes.add(episode);
  await touchProject(projectId);
  return episode;
}

export async function updateEpisode(
  id: Id,
  patch: Partial<Pick<Episode, "title" | "story" | "order">>,
): Promise<void> {
  const episode = await db.episodes.get(id);
  if (!episode) return;
  await db.episodes.put(touch({ ...episode, ...patch }));
  await touchProject(episode.projectId);
}

export async function deleteEpisode(id: Id): Promise<void> {
  const episode = await db.episodes.get(id);
  if (!episode) return;
  const siblings = await listEpisodes(episode.projectId);
  if (siblings.length <= 1) throw new Error("不能删除最后一集");
  const shots = await db.shots.where("episodeId").equals(id).toArray();
  const mediaIds = shots.flatMap((shot) =>
    slotMediaIds(shot.firstFrame).concat(slotMediaIds(shot.lastFrame), slotMediaIds(shot.clip)),
  );
  await db.transaction("rw", db.episodes, db.shots, db.projects, async () => {
    await db.shots.where("episodeId").equals(id).delete();
    await db.episodes.delete(id);
    const remaining = (await listEpisodes(episode.projectId)).sort((a, b) => a.order - b.order);
    await Promise.all(
      remaining.map((item, index) => db.episodes.put({ ...item, order: index })),
    );
    await touchProject(episode.projectId);
  });
  for (const mediaId of mediaIds) await deleteMediaIfOrphan(mediaId);
}

export async function collectMediaIds(projectId: Id): Promise<Set<Id>> {
  const [characters, scenes, props, styles, shots] = await Promise.all([
    db.characters.where("projectId").equals(projectId).toArray(),
    db.scenes.where("projectId").equals(projectId).toArray(),
    db.props.where("projectId").equals(projectId).toArray(),
    db.styles.where("projectId").equals(projectId).toArray(),
    db.shots.where("projectId").equals(projectId).toArray(),
  ]);
  const ids = new Set<Id>();
  for (const mediaId of collectSlotsMedia([
    ...characters.flatMap((character) => Object.values(character.slots ?? {})),
    ...scenes.flatMap((scene) => Object.values(scene.slots ?? {})),
    ...props.flatMap((prop) => Object.values(prop.slots ?? {})),
    ...styles.flatMap((style) => Object.values(style.slots ?? {})),
    ...shots.flatMap((shot) => SHOT_PICTURE_FIELDS.map((field) => shot[field])),
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
  const episodes = await db.episodes.where("projectId").equals(character.projectId).toArray();
  for (const episode of episodes) {
    const story = normalizeEpisodeStory(episode.story);
    const beats = story.beats.map((beat) => ({
      ...beat,
      characterIds: beat.characterIds.filter((item) => item !== id),
    }));
    if (beats.some((beat, index) => beat.characterIds.length !== story.beats[index]?.characterIds.length)) {
      await db.episodes.put(touch({ ...episode, story: { ...story, beats } }));
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
  const episodes = await db.episodes.where("projectId").equals(scene.projectId).toArray();
  for (const episode of episodes) {
    const story = normalizeEpisodeStory(episode.story);
    const beats = story.beats.map((beat) =>
      beat.sceneId === id ? { ...beat, sceneId: undefined } : beat,
    );
    if (beats.some((beat, index) => beat.sceneId !== story.beats[index]?.sceneId)) {
      await db.episodes.put(touch({ ...episode, story: { ...story, beats } }));
    }
  }
  await touchProject(scene.projectId);
  for (const mediaId of mediaIds) await deleteMediaIfOrphan(mediaId);
}

export async function addProp(projectId: Id): Promise<Prop> {
  const prop = emptyProp(projectId);
  await db.props.add(prop);
  await touchProject(projectId);
  return prop;
}

export async function patchProp(
  id: Id,
  patch: Partial<Omit<Prop, "id" | "projectId" | "createdAt">>,
): Promise<void> {
  const prop = await db.props.get(id);
  if (!prop) return;
  await db.props.put(touch({ ...prop, ...patch }));
  await touchProject(prop.projectId);
}

export async function setPropSlot(
  id: Id,
  slotKey: PropImageSlot,
  slot: GenerationSlot,
): Promise<void> {
  const prop = await db.props.get(id);
  if (!prop) return;
  const previous = prop.slots[slotKey];
  await db.props.put(touch({ ...prop, slots: { ...prop.slots, [slotKey]: slot } }));
  await touchProject(prop.projectId);
  await recycleSlotMedia(previous, slot);
}

export async function deleteProp(id: Id): Promise<void> {
  const prop = await db.props.get(id);
  if (!prop) return;
  const mediaIds = collectSlotsMedia(Object.values(prop.slots));
  await db.props.delete(id);
  await touchProject(prop.projectId);
  for (const mediaId of mediaIds) await deleteMediaIfOrphan(mediaId);
}

export async function addStyle(projectId: Id): Promise<VisualStyle> {
  const style = emptyStyle(projectId);
  await db.styles.add(style);
  await touchProject(projectId);
  return style;
}

export async function patchStyle(
  id: Id,
  patch: Partial<Omit<VisualStyle, "id" | "projectId" | "createdAt">>,
): Promise<void> {
  const style = await db.styles.get(id);
  if (!style) return;
  await db.styles.put(touch({ ...style, ...patch }));
  await touchProject(style.projectId);
}

export async function setStyleSlot(
  id: Id,
  slotKey: StyleImageSlot,
  slot: GenerationSlot,
): Promise<void> {
  const style = await db.styles.get(id);
  if (!style) return;
  const previous = style.slots[slotKey];
  await db.styles.put(touch({ ...style, slots: { ...style.slots, [slotKey]: slot } }));
  await touchProject(style.projectId);
  await recycleSlotMedia(previous, slot);
}

export async function deleteStyle(id: Id): Promise<void> {
  const style = await db.styles.get(id);
  if (!style) return;
  const mediaIds = collectSlotsMedia(Object.values(style.slots));
  await db.styles.delete(id);
  await touchProject(style.projectId);
  for (const mediaId of mediaIds) await deleteMediaIfOrphan(mediaId);
}

async function nextShotNumber(episodeId: Id): Promise<string> {
  const shots = await db.shots.where("episodeId").equals(episodeId).toArray();
  const max = shots.reduce((current, shot) => {
    const value = Number.parseInt(shot.shotNumber, 10);
    return Number.isFinite(value) ? Math.max(current, value) : current;
  }, 0);
  return String(max + 1);
}

async function reindexShots(episodeId: Id): Promise<void> {
  const shots = (await db.shots.where("episodeId").equals(episodeId).toArray()).sort(
    (a, b) => a.order - b.order,
  );
  await Promise.all(
    shots.map((shot, index) => db.shots.put({ ...shot, order: index + 1 })),
  );
}

function beatRank(beats: StoryBeat[], beatId: Id | undefined): number {
  if (!beatId) return Number.POSITIVE_INFINITY;
  const index = beats.findIndex((beat) => beat.id === beatId);
  return index === -1 ? Number.POSITIVE_INFINITY : index;
}

function insertOrderForBeat(beats: StoryBeat[], shots: Shot[], beatId?: Id): number {
  const sorted = [...shots].sort((a, b) => a.order - b.order);
  if (sorted.length === 0) return 1;
  const target = beatRank(beats, beatId);
  let lastLeq = 0;
  for (const shot of sorted) {
    if (beatRank(beats, shot.beatId) <= target) lastLeq = shot.order;
  }
  if (lastLeq === 0) return sorted[0]?.order ?? 1;
  return lastLeq + 1;
}

export async function addStoryBeat(episodeId: Id): Promise<StoryBeat> {
  const episode = await db.episodes.get(episodeId);
  if (!episode) throw new Error("集不存在");
  const story = normalizeEpisodeStory(episode.story);
  const beat: StoryBeat = {
    id: createId("beat"),
    title: `场 ${story.beats.length + 1}`,
    content: "",
    characterIds: [],
    timeOfDay: "",
  };
  await updateEpisode(episodeId, { story: { ...story, beats: [...story.beats, beat] } });
  return beat;
}

export async function patchStoryBeat(
  episodeId: Id,
  beatId: Id,
  patch: Partial<Pick<StoryBeat, "title" | "content" | "characterIds" | "sceneId" | "timeOfDay">>,
): Promise<void> {
  const episode = await db.episodes.get(episodeId);
  if (!episode) return;
  const story = normalizeEpisodeStory(episode.story);
  await updateEpisode(episodeId, {
    story: {
      ...story,
      beats: story.beats.map((beat) => (beat.id === beatId ? { ...beat, ...patch } : beat)),
    },
  });
}

export async function deleteStoryBeat(episodeId: Id, beatId: Id): Promise<void> {
  const episode = await db.episodes.get(episodeId);
  if (!episode) return;
  const shots = await db.shots.where("episodeId").equals(episodeId).toArray();
  await db.transaction("rw", db.episodes, db.shots, db.projects, async () => {
    for (const shot of shots) {
      if (shot.beatId !== beatId) continue;
      const next = { ...shot };
      delete next.beatId;
      await db.shots.put(next);
    }
    const latest = await db.episodes.get(episodeId);
    if (!latest) return;
    const current = normalizeEpisodeStory(latest.story);
    await updateEpisode(episodeId, {
      story: { ...current, beats: current.beats.filter((beat) => beat.id !== beatId) },
    });
  });
}

export async function addShots(
  episodeId: Id,
  count: number,
  options?: { atOrder?: number; beatId?: Id },
): Promise<Shot[]> {
  if (count <= 0) return [];
  const episode = await db.episodes.get(episodeId);
  if (!episode) return [];
  const project = await db.projects.get(episode.projectId);
  if (!project) return [];
  const beats = normalizeEpisodeStory(episode.story).beats;
  const shots = (await db.shots.where("episodeId").equals(episodeId).toArray()).sort(
    (a, b) => a.order - b.order,
  );
  const insertAt = options?.atOrder ?? insertOrderForBeat(beats, shots, options?.beatId);
  for (const shot of shots) {
    if (shot.order >= insertAt) {
      await db.shots.put({ ...shot, order: shot.order + count });
    }
  }
  const created: Shot[] = [];
  let nextNumber = project.shotSettings.autoIncrementShotNumber
    ? Number.parseInt(await nextShotNumber(episodeId), 10) || shots.length + 1
    : insertAt;
  for (let index = 0; index < count; index += 1) {
    const shotNumber = project.shotSettings.autoIncrementShotNumber
      ? String(nextNumber + index)
      : String(insertAt + index);
    const shot = emptyShot(
      episode.projectId,
      episodeId,
      insertAt + index,
      shotNumber,
      project.shotSettings.defaultDurationSec ?? 0,
      options?.beatId,
    );
    await db.shots.add(shot);
    created.push(shot);
  }
  await touchProject(episode.projectId);
  return created;
}

export async function addShot(
  episodeId: Id,
  options?: number | { atOrder?: number; beatId?: Id },
): Promise<Shot> {
  const normalized =
    typeof options === "number" ? { atOrder: options } : (options ?? {});
  const [shot] = await addShots(episodeId, 1, normalized);
  if (!shot) throw new Error("集不存在");
  return shot;
}

export async function patchShot(
  id: Id,
  patch: Partial<Omit<Shot, "id" | "projectId" | "episodeId">>,
): Promise<void> {
  const shot = await db.shots.get(id);
  if (!shot) return;
  await db.shots.put({ ...shot, ...patch });
  await touchProject(shot.projectId);
}

export async function setShotSlot(
  id: Id,
  field: ShotPictureField,
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
    mediaIds.push(
      ...slotMediaIds(shot.firstFrame),
      ...slotMediaIds(shot.lastFrame),
      ...slotMediaIds(shot.clip),
    );
    await db.shots.delete(id);
  }
  if (first) {
    await reindexShots(first.episodeId);
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
