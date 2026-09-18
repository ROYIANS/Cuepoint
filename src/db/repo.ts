import { db } from "./database";
import {
  DEFAULT_SHOT_SETTINGS,
  DEFAULT_VISIBLE_COLUMNS,
  emptyEpisodeStory,
  emptySeriesStory,
  emptySetting,
  isStudioLibrary,
  normalizeEpisodeStory,
  normalizeShotSettings,
  normalizeShotStatus,
  normalizeSeriesStory,
  type Character,
  type CharacterImageSlot,
  type Episode,
  type EpisodeStory,
  type GenerationSlot,
  type Id,
  type MediaRecord,
  type Project,
  type ProjectMode,
  type Prop,
  type PropImageSlot,
  type Scene,
  type SceneImageSlot,
  type Shot,
  type ShotColumnId,
  type ShotPictureField,
  type ShotSettings,
  type StoryBeat,
  type StyleImageSlot,
  type VisualStyle,
  type WorldSetting,
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

export function emptyProject(name: string, mode: ProjectMode = "film"): Project {
  const at = nowIso();
  return {
    id: createId("prj"),
    name: name.trim() || "未命名项目",
    mode,
    createdAt: at,
    updatedAt: at,
    columnSettings: { visible: [...DEFAULT_VISIBLE_COLUMNS] },
    shotSettings: {
      ...DEFAULT_SHOT_SETTINGS,
      filters: { statuses: [], beatIds: [], gaps: [] },
    },
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
    status: "draft",
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

export async function createProject(
  name: string,
  mode: ProjectMode = "film",
): Promise<Project> {
  const project = emptyProject(name, mode);
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
  patch: Partial<
    Pick<Project, "name" | "mode" | "columnSettings" | "shotSettings" | "story" | "setting">
  >,
): Promise<void> {
  const project = await db.projects.get(id);
  if (!project) return;
  await db.projects.put(touch({ ...project, ...patch }));
}

export async function updateShotSettings(
  id: Id,
  patch: Partial<ShotSettings>,
): Promise<void> {
  await db.transaction("rw", db.projects, async () => {
    const project = await db.projects.get(id);
    if (!project) return;
    const definedPatch = Object.fromEntries(
      Object.entries(patch).filter(([, value]) => value !== undefined),
    ) as Partial<ShotSettings>;
    await db.projects.put(touch({
      ...project,
      shotSettings: { ...normalizeShotSettings(project.shotSettings), ...definedPatch },
    }));
  });
}

export async function updateSeriesLogline(id: Id, logline: string): Promise<void> {
  await db.transaction("rw", db.projects, async () => {
    const project = await db.projects.get(id);
    if (!project) return;
    await db.projects.put(touch({
      ...project,
      story: { ...normalizeSeriesStory(project.story), logline },
    }));
  });
}

export async function updateWorldSetting(
  id: Id,
  patch: Partial<WorldSetting>,
): Promise<void> {
  await db.transaction("rw", db.projects, async () => {
    const project = await db.projects.get(id);
    if (!project) return;
    await db.projects.put(touch({
      ...project,
      setting: { ...emptySetting(), ...project.setting, ...patch },
    }));
  });
}

export async function listEpisodes(projectId: Id): Promise<Episode[]> {
  const rows = await db.episodes.where("projectId").equals(projectId).toArray();
  return rows.sort((a, b) => a.order - b.order);
}

export async function firstEpisode(projectId: Id): Promise<Episode | undefined> {
  const episodes = await listEpisodes(projectId);
  return episodes[0];
}

export async function ensureFirstEpisode(projectId: Id): Promise<Episode> {
  return db.transaction("rw", db.projects, db.episodes, async () => {
    const project = await db.projects.get(projectId);
    if (!project) throw new Error("项目不存在");
    const existing = await firstEpisode(projectId);
    if (existing) return existing;
    const episode = emptyEpisode(projectId, 0);
    await db.episodes.add(episode);
    await db.projects.put(touch(project));
    return episode;
  });
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

export async function updateEpisodeDraft(
  id: Id,
  patch: { title?: string; logline?: string; script?: string },
): Promise<void> {
  await db.transaction("rw", db.episodes, db.projects, async () => {
    const episode = await db.episodes.get(id);
    if (!episode) return;
    const story = normalizeEpisodeStory(episode.story);
    const storyPatch: Partial<Pick<EpisodeStory, "logline" | "script">> = {};
    if (patch.logline !== undefined) storyPatch.logline = patch.logline;
    if (patch.script !== undefined) storyPatch.script = patch.script;
    const nextStory = normalizeEpisodeStory({ ...story, ...storyPatch });
    await db.episodes.put(touch({
      ...episode,
      ...(patch.title === undefined ? {} : { title: patch.title }),
      story: nextStory,
    }));
    await touchProject(episode.projectId);
  });
}

export interface DeletedEpisodeSnapshot {
  episode: Episode;
  shots: Shot[];
  media: MediaRecord[];
}

export async function deleteEpisode(id: Id): Promise<DeletedEpisodeSnapshot | undefined> {
  const episode = await db.episodes.get(id);
  if (!episode) return undefined;
  const siblings = await listEpisodes(episode.projectId);
  if (siblings.length <= 1) throw new Error("不能删除最后一集");
  const shots = await db.shots.where("episodeId").equals(id).toArray();
  const mediaIds = shots.flatMap((shot) =>
    slotMediaIds(shot.firstFrame).concat(slotMediaIds(shot.lastFrame), slotMediaIds(shot.clip)),
  );
  const media = (await db.media.bulkGet([...new Set(mediaIds)])).filter(
    (record): record is MediaRecord => record !== undefined,
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
  return { episode, shots, media };
}

export async function restoreEpisode(snapshot: DeletedEpisodeSnapshot): Promise<void> {
  const { episode, shots, media } = snapshot;
  await db.transaction(
    "rw",
    db.episodes,
    db.shots,
    db.media,
    db.projects,
    async () => {
      if (await db.episodes.get(episode.id)) return;
      const siblings = await db.episodes.where("projectId").equals(episode.projectId).toArray();
      for (const sibling of siblings) {
        if (sibling.order >= episode.order) {
          await db.episodes.put({ ...sibling, order: sibling.order + 1 });
        }
      }
      await db.episodes.add(episode);
      if (shots.length > 0) await db.shots.bulkPut(shots);
      if (media.length > 0) await db.media.bulkPut(media);
      await touchProject(episode.projectId);
    },
  );
}

function assertCompleteOrder(actualIds: Id[], orderedIds: Id[]): void {
  if (
    orderedIds.length !== actualIds.length ||
    new Set(orderedIds).size !== orderedIds.length ||
    actualIds.some((id) => !orderedIds.includes(id))
  ) {
    throw new Error("排序列表必须包含同一范围内的全部且唯一记录");
  }
}

export async function reorderEpisodes(projectId: Id, orderedIds: Id[]): Promise<void> {
  await db.transaction("rw", db.episodes, db.projects, async () => {
    if (!(await db.projects.get(projectId))) throw new Error("项目不存在");
    const episodes = await db.episodes.where("projectId").equals(projectId).toArray();
    assertCompleteOrder(episodes.map((episode) => episode.id), orderedIds);
    const byId = new Map(episodes.map((episode) => [episode.id, episode]));
    await Promise.all(
      orderedIds.map((id, order) => db.episodes.put(touch({ ...byId.get(id)!, order }))),
    );
    await touchProject(projectId);
  });
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

type SnapshotAsset = Character | Scene | Prop | VisualStyle;
type SnapshotKind = "character" | "scene" | "prop" | "style";

const SNAPSHOT_PREFIX: Record<SnapshotKind, string> = {
  character: "chr",
  scene: "scn",
  prop: "prp",
  style: "sty",
};

async function copyStudioSnapshot<T extends SnapshotAsset>(
  projectId: Id,
  kind: SnapshotKind,
  sourceId: Id,
): Promise<T> {
  if (isStudioLibrary(projectId)) throw new Error("目标必须是项目");
  return db.transaction(
    "rw",
    [db.projects, db.characters, db.scenes, db.props, db.styles, db.media],
    async () => {
      const project = await db.projects.get(projectId);
      if (!project) throw new Error("项目不存在");

      const source =
        kind === "character"
          ? await db.characters.get(sourceId)
          : kind === "scene"
            ? await db.scenes.get(sourceId)
            : kind === "prop"
              ? await db.props.get(sourceId)
              : await db.styles.get(sourceId);
      if (!source || !isStudioLibrary(source.projectId)) {
        throw new Error("工作室资产不存在");
      }

      const destinationAssets =
        kind === "character"
          ? await db.characters.where("projectId").equals(projectId).toArray()
          : kind === "scene"
            ? await db.scenes.where("projectId").equals(projectId).toArray()
            : kind === "prop"
              ? await db.props.where("projectId").equals(projectId).toArray()
              : await db.styles.where("projectId").equals(projectId).toArray();
      if (destinationAssets.some((asset) => asset.extra?.sourceAssetId === sourceId)) {
        throw new Error("该工作室资产已添加到项目");
      }

      const mediaMap = new Map<Id, Id>();
      const slots: Record<string, GenerationSlot> = {};
      for (const [slotKey, slot] of Object.entries(source.slots ?? {})) {
        if (!slot) continue;
        for (const oldMediaId of new Set(slotMediaIds(slot))) {
          if (mediaMap.has(oldMediaId)) continue;
          const media = await db.media.get(oldMediaId);
          if (!media) continue;
          const newMediaId = createId("med");
          mediaMap.set(oldMediaId, newMediaId);
          await db.media.add({
            ...media,
            id: newMediaId,
            projectId,
          });
        }
        const mapMedia = (id?: Id) => (id ? mediaMap.get(id) : undefined);
        slots[slotKey] = {
          prompt: slot.prompt,
          referenceImageIds: slot.referenceImageIds
            .map(mapMedia)
            .filter((id): id is Id => Boolean(id)),
          referenceVideoIds: slot.referenceVideoIds
            .map(mapMedia)
            .filter((id): id is Id => Boolean(id)),
          result:
            slot.result && mapMedia(slot.result.mediaId)
              ? {
                  ...slot.result,
                  mediaId: mapMedia(slot.result.mediaId)!,
                }
              : undefined,
        };
      }

      const at = nowIso();
      const copy = {
        ...structuredClone(source),
        id: createId(SNAPSHOT_PREFIX[kind]),
        projectId,
        slots,
        createdAt: at,
        updatedAt: at,
        extra: {
          ...(source.extra ?? {}),
          sourceAssetId: source.id,
        },
      } as unknown as T;

      if (kind === "character") await db.characters.add(copy as Character);
      else if (kind === "scene") await db.scenes.add(copy as Scene);
      else if (kind === "prop") await db.props.add(copy as Prop);
      else await db.styles.add(copy as VisualStyle);
      await db.projects.put(touch(project));
      return copy;
    },
  );
}

export function copyStudioCharacter(projectId: Id, sourceId: Id): Promise<Character> {
  return copyStudioSnapshot<Character>(projectId, "character", sourceId);
}

export function copyStudioScene(projectId: Id, sourceId: Id): Promise<Scene> {
  return copyStudioSnapshot<Scene>(projectId, "scene", sourceId);
}

export function copyStudioProp(projectId: Id, sourceId: Id): Promise<Prop> {
  return copyStudioSnapshot<Prop>(projectId, "prop", sourceId);
}

export function copyStudioStyle(projectId: Id, sourceId: Id): Promise<VisualStyle> {
  return copyStudioSnapshot<VisualStyle>(projectId, "style", sourceId);
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

export async function addStoryBeat(
  episodeId: Id,
  options?: { scriptRange?: StoryBeat["scriptRange"] },
): Promise<StoryBeat> {
  return db.transaction("rw", db.episodes, db.projects, async () => {
    const episode = await db.episodes.get(episodeId);
    if (!episode) throw new Error("集不存在");
    const story = normalizeEpisodeStory(episode.story);
    const requestedRange = options?.scriptRange;
    const validRange =
      requestedRange &&
      Number.isInteger(requestedRange.start) &&
      Number.isInteger(requestedRange.end) &&
      requestedRange.start >= 0 &&
      requestedRange.end > requestedRange.start &&
      story.script.slice(requestedRange.start, requestedRange.end) === requestedRange.excerpt
        ? requestedRange
        : undefined;
    const beat: StoryBeat = {
      id: createId("beat"),
      title: `场 ${story.beats.length + 1}`,
      content: requestedRange?.excerpt ?? "",
      characterIds: [],
      timeOfDay: "",
      ...(validRange ? { scriptRange: validRange } : {}),
    };
    await db.episodes.put(touch({
      ...episode,
      story: { ...story, beats: [...story.beats, beat] },
    }));
    await touchProject(episode.projectId);
    return beat;
  });
}

export async function patchStoryBeat(
  episodeId: Id,
  beatId: Id,
  patch: Partial<
    Pick<
      StoryBeat,
      "title" | "content" | "characterIds" | "sceneId" | "timeOfDay" | "scriptRange"
    >
  >,
): Promise<void> {
  await db.transaction("rw", db.episodes, db.projects, async () => {
    const episode = await db.episodes.get(episodeId);
    if (!episode) return;
    const story = normalizeEpisodeStory(episode.story);
    await db.episodes.put(touch({
      ...episode,
      story: {
        ...story,
        beats: story.beats.map((beat) => (beat.id === beatId ? { ...beat, ...patch } : beat)),
      },
    }));
    await touchProject(episode.projectId);
  });
}

export async function reorderBeats(episodeId: Id, orderedIds: Id[]): Promise<void> {
  await db.transaction("rw", db.episodes, db.shots, db.projects, async () => {
    const episode = await db.episodes.get(episodeId);
    if (!episode) throw new Error("集不存在");
    const story = normalizeEpisodeStory(episode.story);
    assertCompleteOrder(story.beats.map((beat) => beat.id), orderedIds);
    const byId = new Map(story.beats.map((beat) => [beat.id, beat]));
    const shots = await db.shots.where("episodeId").equals(episodeId).toArray();
    if (shots.some((shot) => shot.projectId !== episode.projectId)) {
      throw new Error("镜头与集不属于同一项目");
    }
    const rank = new Map(orderedIds.map((id, index) => [id, index]));
    shots.sort(
      (left, right) =>
        (rank.get(left.beatId ?? "") ?? Number.POSITIVE_INFINITY) -
          (rank.get(right.beatId ?? "") ?? Number.POSITIVE_INFINITY) ||
        left.order - right.order,
    );
    await db.episodes.put(touch({
      ...episode,
      story: { ...story, beats: orderedIds.map((id) => byId.get(id)!) },
    }));
    await Promise.all(
      shots.map((shot, index) => db.shots.put({ ...shot, order: index + 1 })),
    );
    await touchProject(episode.projectId);
  });
}

export async function duplicateBeat(
  episodeId: Id,
  beatId: Id,
  options?: { includeShots?: boolean },
): Promise<{ beat: StoryBeat; shots: Shot[] }> {
  return db.transaction("rw", db.episodes, db.shots, db.projects, async () => {
    const episode = await db.episodes.get(episodeId);
    if (!episode) throw new Error("集不存在");
    const story = normalizeEpisodeStory(episode.story);
    const sourceIndex = story.beats.findIndex((beat) => beat.id === beatId);
    if (sourceIndex < 0) throw new Error("场次不存在");
    const source = story.beats[sourceIndex]!;
    const beat: StoryBeat = structuredClone({
      ...source,
      id: createId("beat"),
      title: `${source.title} 副本`,
    });
    story.beats.splice(sourceIndex + 1, 0, beat);

    const created: Shot[] = [];
    if (options?.includeShots) {
      const shots = (await db.shots.where("episodeId").equals(episodeId).toArray()).sort(
        (left, right) => left.order - right.order,
      );
      if (shots.some((shot) => shot.projectId !== episode.projectId)) {
        throw new Error("镜头与集不属于同一项目");
      }
      const sourceShots = shots.filter((shot) => shot.beatId === beatId);
      const lastSourceOrder = sourceShots.at(-1)?.order ?? shots.length;
      for (const shot of shots) {
        if (shot.order > lastSourceOrder) {
          await db.shots.put({ ...shot, order: shot.order + sourceShots.length });
        }
      }
      for (const [index, sourceShot] of sourceShots.entries()) {
        const copy = structuredClone({
          ...sourceShot,
          id: createId("sht"),
          beatId: beat.id,
          order: lastSourceOrder + index + 1,
        });
        await db.shots.add(copy);
        created.push(copy);
      }
    }

    await db.episodes.put(touch({ ...episode, story }));
    await touchProject(episode.projectId);
    return { beat, shots: created };
  });
}

export async function restoreStoryBeat(
  episodeId: Id,
  beat: StoryBeat,
  index: number,
  shotIds: Id[] = [],
): Promise<void> {
  await db.transaction("rw", db.episodes, db.shots, db.projects, async () => {
    const episode = await db.episodes.get(episodeId);
    if (!episode) throw new Error("集不存在");
    const story = normalizeEpisodeStory(episode.story);
    if (story.beats.some((item) => item.id === beat.id)) return;
    const beats = [...story.beats];
    beats.splice(Math.max(0, Math.min(index, beats.length)), 0, beat);
    await db.episodes.put(touch({ ...episode, story: { ...story, beats } }));
    for (const shotId of shotIds) {
      const shot = await db.shots.get(shotId);
      if (shot?.episodeId === episodeId) await db.shots.put({ ...shot, beatId: beat.id });
    }
    await touchProject(episode.projectId);
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
  projectId: Id,
  episodeId: Id,
  count: number,
  options?: { atOrder?: number; beatId?: Id },
): Promise<Shot[]> {
  if (count <= 0) return [];
  return db.transaction("rw", db.episodes, db.projects, db.shots, async () => {
    const episode = await db.episodes.get(episodeId);
    if (!episode || episode.projectId !== projectId) return [];
    const project = await db.projects.get(projectId);
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
    const shotSettings = normalizeShotSettings(project.shotSettings);
    const nextNumber = shotSettings.autoIncrementShotNumber
      ? Number.parseInt(await nextShotNumber(episodeId), 10) || shots.length + 1
      : insertAt;
    for (let index = 0; index < count; index += 1) {
      const shotNumber = shotSettings.autoIncrementShotNumber
        ? String(nextNumber + index)
        : String(insertAt + index);
      const shot = emptyShot(
        projectId,
        episodeId,
        insertAt + index,
        shotNumber,
        shotSettings.defaultDurationSec,
        options?.beatId,
      );
      await db.shots.add(shot);
      created.push(shot);
    }
    await touchProject(projectId);
    return created;
  });
}

export async function addShot(
  projectId: Id,
  episodeId: Id,
  options?: { atOrder?: number; beatId?: Id },
): Promise<Shot> {
  const [shot] = await addShots(projectId, episodeId, 1, options);
  if (!shot) throw new Error("项目或集不存在");
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

export type EpisodeShotBulkPatch = Partial<
  Pick<Shot, "beatId" | "durationSec" | "status" | "characterIds" | "sceneId" | "notes">
>;

export async function patchEpisodeShots(
  episodeId: Id,
  ids: Id[],
  patch: EpisodeShotBulkPatch,
): Promise<void> {
  if (ids.length === 0) return;
  await db.transaction("rw", db.shots, db.episodes, db.projects, async () => {
    const episode = await db.episodes.get(episodeId);
    if (!episode) throw new Error("集不存在");
    if (new Set(ids).size !== ids.length) throw new Error("镜头列表包含重复记录");
    const shots = await db.shots.bulkGet(ids);
    if (
      shots.some(
        (shot) =>
          !shot || shot.episodeId !== episodeId || shot.projectId !== episode.projectId,
      )
    ) {
      throw new Error("所选镜头不属于当前集");
    }
    if (
      patch.beatId !== undefined &&
      !normalizeEpisodeStory(episode.story).beats.some((beat) => beat.id === patch.beatId)
    ) {
      throw new Error("场次不属于当前集");
    }
    const nextPatch: EpisodeShotBulkPatch = { ...patch };
    if ("status" in patch) {
      nextPatch.status = normalizeShotStatus(patch.status);
    }
    if ("characterIds" in patch) {
      nextPatch.characterIds = Array.isArray(patch.characterIds)
        ? [...patch.characterIds]
        : [];
    }
    await Promise.all(shots.map((shot) => db.shots.put({ ...shot!, ...nextPatch })));
    await touchProject(episode.projectId);
  });
}

export async function reorderShots(episodeId: Id, orderedIds: Id[]): Promise<void> {
  await db.transaction("rw", db.shots, db.episodes, db.projects, async () => {
    const episode = await db.episodes.get(episodeId);
    if (!episode) throw new Error("集不存在");
    const shots = await db.shots.where("episodeId").equals(episodeId).toArray();
    if (shots.some((shot) => shot.projectId !== episode.projectId)) {
      throw new Error("镜头与集不属于同一项目");
    }
    assertCompleteOrder(shots.map((shot) => shot.id), orderedIds);
    const byId = new Map(shots.map((shot) => [shot.id, shot]));
    await Promise.all(
      orderedIds.map((id, index) => db.shots.put({ ...byId.get(id)!, order: index + 1 })),
    );
    await touchProject(episode.projectId);
  });
}

export async function duplicateShot(id: Id): Promise<Shot> {
  return db.transaction("rw", db.shots, db.episodes, db.projects, async () => {
    const source = await db.shots.get(id);
    if (!source) throw new Error("镜头不存在");
    const episode = await db.episodes.get(source.episodeId);
    if (!episode || episode.projectId !== source.projectId) {
      throw new Error("镜头与集不属于同一项目");
    }
    const siblings = await db.shots.where("episodeId").equals(source.episodeId).toArray();
    if (siblings.some((shot) => shot.projectId !== episode.projectId)) {
      throw new Error("镜头与集不属于同一项目");
    }
    for (const shot of siblings) {
      if (shot.order > source.order) {
        await db.shots.put({ ...shot, order: shot.order + 1 });
      }
    }
    const copy = structuredClone({
      ...source,
      id: createId("sht"),
      order: source.order + 1,
    });
    await db.shots.add(copy);
    await touchProject(source.projectId);
    return copy;
  });
}

export async function restoreShots(shots: Shot[], media: MediaRecord[] = []): Promise<void> {
  if (shots.length === 0) return;
  await db.transaction("rw", db.shots, db.episodes, db.projects, db.media, async () => {
    if (media.length > 0) await db.media.bulkPut(media);
    const episodeIds = new Set(shots.map((shot) => shot.episodeId));
    for (const episodeId of episodeIds) {
      const episode = await db.episodes.get(episodeId);
      if (!episode) throw new Error("集不存在");
      const scoped = shots
        .filter((shot) => shot.episodeId === episodeId)
        .sort((left, right) => left.order - right.order);
      if (scoped.some((shot) => shot.projectId !== episode.projectId)) {
        throw new Error("镜头与集不属于同一项目");
      }
      const all = (await db.shots.where("episodeId").equals(episodeId).toArray()).sort(
        (left, right) => left.order - right.order,
      );
      for (const shot of scoped) {
        all.splice(Math.max(0, Math.min(shot.order - 1, all.length)), 0, shot);
      }
      await Promise.all(
        all.map((shot, index) => db.shots.put({ ...shot, order: index + 1 })),
      );
      await touchProject(episode.projectId);
    }
  });
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
  const affected = new Map<Id, Id>();
  const mediaIds: Id[] = [];
  for (const id of ids) {
    const shot = await db.shots.get(id);
    if (!shot) continue;
    affected.set(shot.episodeId, shot.projectId);
    mediaIds.push(
      ...slotMediaIds(shot.firstFrame),
      ...slotMediaIds(shot.lastFrame),
      ...slotMediaIds(shot.clip),
    );
    await db.shots.delete(id);
  }
  for (const [episodeId, projectId] of affected) {
    await reindexShots(episodeId);
    await touchProject(projectId);
  }
  for (const mediaId of mediaIds) await deleteMediaIfOrphan(mediaId);
}

export async function deleteEpisodeShots(episodeId: Id, ids: Id[]): Promise<void> {
  if (ids.length === 0) return;
  const episode = await db.episodes.get(episodeId);
  if (!episode) throw new Error("集不存在");
  if (new Set(ids).size !== ids.length) throw new Error("镜头列表包含重复记录");
  const shots = await db.shots.bulkGet(ids);
  if (
    shots.some(
      (shot) =>
        !shot || shot.episodeId !== episodeId || shot.projectId !== episode.projectId,
    )
  ) {
    throw new Error("所选镜头不属于当前集");
  }
  await deleteShots(ids);
}

export async function setVisibleColumns(
  projectId: Id,
  visible: ShotColumnId[],
): Promise<void> {
  await updateProject(projectId, { columnSettings: { visible } });
}
