import { STUDIO_LIBRARY_ID } from "@/domain/types";
import { getGeneralAgentConfig } from "./agentSettings";
import { normalizeContextPolicy } from "@/lib/agent/contextPolicy";
import { validateGenerationDefaults } from "@/domain/output";
import { db } from "./database";
import {
  DEFAULT_SHOT_SETTINGS,
  DEFAULT_VISIBLE_COLUMNS,
  emptyEpisodeStory,
  emptySeriesStory,
  emptySetting,
  isStudioLibrary,
  normalizeAspectPreset,
  normalizeEpisodeStory,
  getEpisodeShotFilters,
  normalizeShotFilters,
  normalizeShotSettings,
  normalizeShotStatus,
  normalizeSeriesStory,
  type AspectPresetId,
  type Character,
  type CharacterImageSlot,
  type ChatMessage,
  type ChatMessageRole,
  type ChatMessageStatus,
  type ChatThread,
  type ConnectorConfig,
  type ConnectorDefinitionId,
  type ConnectorProtocol,
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
  type ShotFilters,
  type StoryBeat,
  type StyleImageSlot,
  type VisualStyle,
  type WorldSetting,
} from "@/domain/types";
import { normalizeBaseUrl } from "@/lib/ai/openaiCompatible";
import { collectSlotsMedia, emptySlot, SHOT_PICTURE_FIELDS, slotMediaIds } from "@/domain/slot";
import { createId, nowIso } from "@/lib/ids";

// Media recycling must hold the same lock as every committed slot/cover writer.
export const PRODUCTION_TABLES = [
  db.projects, db.episodes, db.characters, db.scenes,
  db.props, db.styles, db.shots, db.media, db.productionProposals, db.agentGenerationJobs, db.projectReferences, db.referenceChunks,
];

function pickPatch<T extends object>(patch: T, keys: readonly (keyof T)[]): Partial<T> {
  return Object.fromEntries(keys.filter((key) => Object.hasOwn(patch, key)).map((key) => [key, patch[key]])) as Partial<T>;
}

function touch<T extends { updatedAt: string }>(record: T): T {
  return { ...record, updatedAt: nowIso() };
}

export async function touchProject(projectId: Id): Promise<void> {
  if (isStudioLibrary(projectId)) return;
  await db.projects.update(projectId, { updatedAt: nowIso() });
}

export function emptyProject(
  name: string,
  mode: ProjectMode = "film",
  aspectPreset: AspectPresetId = "16:9",
): Project {
  const at = nowIso();
  return {
    id: createId("prj"),
    name: name.trim() || "未命名项目",
    mode,
    aspectPreset: normalizeAspectPreset(aspectPreset),
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
    shotFilters: normalizeShotFilters(undefined),
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
  aspectPreset: AspectPresetId = "16:9",
): Promise<Project> {
  const project = emptyProject(name, mode, aspectPreset);
  const episode = emptyEpisode(project.id, 0);
  await db.transaction("rw", db.projects, db.episodes, async () => {
    await db.projects.add(project);
    await db.episodes.add(episode);
  });
  return project;
}

export async function renameProject(id: Id, name: string): Promise<void> {
  await db.transaction("rw", db.projects, async () => {
    const project = await db.projects.get(id);
    if (!project) throw new Error("项目不存在，无法保存");
    await db.projects.put(touch({ ...project, name: name.trim() || project.name }));
  });
}

/** Optional project metadata uses explicit undefined to clear saved defaults. */
export async function patchProjectDetails(
  id: Id,
  patch: Partial<Pick<Project, "name" | "brief" | "genre" | "audience" | "tone" | "aspectPreset" | "defaultStyleId" | "generationDefaults">>,
): Promise<void> {
  await db.transaction("rw", db.projects, db.styles, async () => {
    const project = await db.projects.get(id);
    if (!project) throw new Error("项目不存在，无法保存");
    const next = { ...project };
    for (const key of ["name", "brief", "genre", "audience", "tone"] as const) {
      if (key in patch) {
        if (patch[key] !== undefined && typeof patch[key] !== "string") throw new Error("项目信息必须是文本");
        if (key === "name") {
          if (!patch.name?.trim()) throw new Error("项目名称不能为空");
          next.name = patch.name.trim();
        }
        else next[key] = patch[key];
      }
    }
    if ("aspectPreset" in patch) next.aspectPreset = normalizeAspectPreset(patch.aspectPreset);
    if ("defaultStyleId" in patch) {
      if (patch.defaultStyleId !== undefined && (await db.styles.get(patch.defaultStyleId))?.projectId !== id) {
        throw new Error("风格不属于当前项目");
      }
      next.defaultStyleId = patch.defaultStyleId;
    }
    if ("generationDefaults" in patch) {
      const errors = validateGenerationDefaults(patch.generationDefaults);
      if (errors.length) throw new Error(errors.join("；"));
      next.generationDefaults = patch.generationDefaults;
    }
    await db.projects.put(touch(next));
  });
}

export async function deleteProject(id: Id): Promise<void> {
  await db.transaction(
    "rw",
    [
      db.projects,
      db.projectReferences,
      db.referenceChunks,
      db.projectMemories,
      db.projectMemoryVersions,
      db.characters,
      db.scenes,
      db.props,
      db.styles,
      db.episodes,
      db.shots,
      db.media,
      db.productionProposals,
      db.agentGenerationJobs,
    ],
    async () => {
      await db.projectReferences.where("projectId").equals(id).delete();
      await db.referenceChunks.where("projectId").equals(id).delete();
      await db.projectMemories.where("projectId").equals(id).delete();
      await db.projectMemoryVersions.where("projectId").equals(id).delete();
      await db.agentGenerationJobs.where("projectId").equals(id).delete();
      await db.productionProposals.where("projectId").equals(id).delete();
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
    Pick<
      Project,
      | "name"
      | "mode"
      | "aspectPreset"
      | "coverMediaId"
      | "columnSettings"
      | "shotSettings"
      | "story"
      | "setting"
    >
  >,
): Promise<void> {
  await db.transaction("rw", db.projects, async () => {
    const project = await db.projects.get(id);
    if (!project) throw new Error("项目不存在，无法保存");
    const next = { ...project, ...patch };
    if (patch.aspectPreset !== undefined) {
      next.aspectPreset = normalizeAspectPreset(patch.aspectPreset);
    }
    await db.projects.put(touch(next));
  });
}

export async function patchProjectOutput(
  id: Id,
  patch: {
    aspectPreset?: AspectPresetId;
    /** Pass `null` to clear the cover. */
    coverMediaId?: Id | null;
  },
): Promise<void> {
  await db.transaction("rw", PRODUCTION_TABLES, async () => {
    const project = await db.projects.get(id);
    if (!project) throw new Error("项目不存在，无法保存");
    const previousCover = project.coverMediaId;
    const next: Project = {
      ...project,
      aspectPreset:
        patch.aspectPreset !== undefined
          ? normalizeAspectPreset(patch.aspectPreset)
          : normalizeAspectPreset(project.aspectPreset),
    };
    if (patch.coverMediaId === null) {
      delete next.coverMediaId;
    } else if (patch.coverMediaId !== undefined) {
      next.coverMediaId = patch.coverMediaId;
    }
    await db.projects.put(touch(next));
    if (previousCover && previousCover !== next.coverMediaId) {
      await deleteMediaIfOrphan(previousCover);
    }
  });
}

export async function updateShotSettings(
  id: Id,
  patch: Partial<ShotSettings>,
): Promise<void> {
  await db.transaction("rw", db.projects, async () => {
    const project = await db.projects.get(id);
    if (!project) throw new Error("项目不存在，无法保存");
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
    if (!project) throw new Error("项目不存在，无法保存");
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
    if (!project) throw new Error("项目不存在，无法保存");
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
  return db.transaction("rw", db.projects, db.episodes, async () => {
    const project = await db.projects.get(projectId);
    if (!project) throw new Error("项目不存在");
    const existing = await listEpisodes(projectId);
    const nextOrder = existing.reduce((max, episode) => Math.max(max, episode.order), -1) + 1;
    const episode = emptyEpisode(projectId, nextOrder);
    await db.episodes.add(episode);
    await touchProject(projectId);
    return episode;
  });
}

export async function updateEpisode(
  id: Id,
  patch: Partial<Pick<Episode, "title" | "story" | "order">>,
): Promise<void> {
  await db.transaction("rw", db.projects, db.episodes, async () => {
    const episode = await db.episodes.get(id);
    if (!episode) throw new Error("集不存在，无法保存");
    await db.episodes.put(touch({ ...episode, ...patch }));
    await touchProject(episode.projectId);
  });
}

export async function updateEpisodeDraft(
  id: Id,
  patch: { title?: string; logline?: string; script?: string },
): Promise<void> {
  await db.transaction("rw", db.episodes, db.projects, async () => {
    const episode = await db.episodes.get(id);
    if (!episode) throw new Error("集不存在，无法保存");
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
  return db.transaction("rw", PRODUCTION_TABLES, async () => {
    const episode = await db.episodes.get(id);
    if (!episode) return undefined;
    const siblings = await listEpisodes(episode.projectId);
    if (siblings.length <= 1) throw new Error("不能删除最后一集");
    const shots = await db.shots.where("episodeId").equals(id).toArray();
    const mediaIds = [...new Set(shots.flatMap((shot) =>
      slotMediaIds(shot.firstFrame).concat(slotMediaIds(shot.lastFrame), slotMediaIds(shot.clip)),
    ))];
    const media = (await db.media.bulkGet(mediaIds)).filter(
      (record): record is MediaRecord => record !== undefined,
    );
    await db.shots.where("episodeId").equals(id).delete();
    await db.episodes.delete(id);
    const remaining = await listEpisodes(episode.projectId);
    await Promise.all(remaining.map((item, order) => db.episodes.update(item.id, { order })));
    await touchProject(episode.projectId);
    for (const mediaId of mediaIds) await deleteMediaIfOrphan(mediaId);
    return { episode, shots, media };
  });
}

export async function restoreEpisode(snapshot: DeletedEpisodeSnapshot): Promise<void> {
  const { episode, shots, media } = snapshot;
  await db.transaction(
    "rw",
    PRODUCTION_TABLES,
    async () => {
      if (await db.episodes.get(episode.id)) return;
      if (!(await db.projects.get(episode.projectId))) throw new Error("项目不存在");
      for (const beat of normalizeEpisodeStory(episode.story).beats) await assertAssetReferences(episode.projectId, beat);
      const siblings = await db.episodes.where("projectId").equals(episode.projectId).toArray();
      for (const sibling of siblings) {
        if (sibling.order >= episode.order) {
          await db.episodes.put({ ...sibling, order: sibling.order + 1 });
        }
      }
      await db.episodes.add(episode);
      for (const shot of shots) {
        if (shot.episodeId !== episode.id || shot.projectId !== episode.projectId) throw new Error("镜头与集不属于同一项目");
        await assertShotReferences(shot);
        if (await db.shots.get(shot.id)) throw new Error("镜头已存在，无法恢复");
      }
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

export async function collectMediaIds(projectId?: Id): Promise<Set<Id>> {
  const [projects, characters, scenes, props, styles, shots, references] = await Promise.all([
    projectId === undefined ? db.projects.toArray() : db.projects.where("id").equals(projectId).toArray(),
    (projectId === undefined ? db.characters : db.characters.where("projectId").equals(projectId)).toArray(),
    (projectId === undefined ? db.scenes : db.scenes.where("projectId").equals(projectId)).toArray(),
    (projectId === undefined ? db.props : db.props.where("projectId").equals(projectId)).toArray(),
    (projectId === undefined ? db.styles : db.styles.where("projectId").equals(projectId)).toArray(),
    (projectId === undefined ? db.shots : db.shots.where("projectId").equals(projectId)).toArray(),
    (projectId === undefined ? db.projectReferences : db.projectReferences.where("projectId").equals(projectId)).toArray(),
  ]);
  const ids = new Set<Id>();
  for (const reference of references) if (reference.status !== "unavailable") ids.add(reference.mediaId);
  for (const project of projects) if (project.coverMediaId) ids.add(project.coverMediaId);
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
  return db.transaction("rw", db.media, db.projects, async () => {
    // Physical replacement is a new record; immutable IDs keep pending previews valid.
    await db.media.add(record);
    await touchProject(record.projectId);
    return record.id;
  });
}

export async function deleteMediaIfOrphan(mediaId: Id | undefined): Promise<void> {
  await db.transaction("rw", PRODUCTION_TABLES, async () => {
    if (!mediaId) return;
    const record = await db.media.get(mediaId);
    if (!record) return;
    const used = await collectMediaIds();
    // Local proposal history retains both results so guarded undo remains possible.
    const proposals = await db.productionProposals.where("projectId").equals(record.projectId).toArray();
    const retained = proposals.some((proposal) => proposal.before.result?.mediaId === mediaId ||
      (proposal.change.kind === "slot-result" && proposal.change.result.mediaId === mediaId));
    const jobs = await db.agentGenerationJobs.where("projectId").equals(record.projectId).toArray();
    const jobRetained = jobs.some((job) => job.result?.mediaId === mediaId || job.inputs.some((input) => input.mediaId === mediaId));
    if (!used.has(mediaId) && !retained && !jobRetained) {
      await db.media.delete(mediaId);
    }
  });
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
        await assertSlotMedia(source.projectId, slot);
        for (const oldMediaId of new Set(slotMediaIds(slot))) {
          if (mediaMap.has(oldMediaId)) continue;
          const media = await db.media.get(oldMediaId);
          if (!media) throw new Error("来源素材已失效，请重新选择");
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
  await db.transaction("rw", db.projects, db.characters, async () => {
    const character = await db.characters.get(id);
    if (!character) throw new Error("角色不存在，无法保存");
    patch = pickPatch(patch, ["name", "bio", "appearance", "notes", "personality", "motivation", "voice", "slots", "extra"]);
    await db.characters.put(touch({
      ...character, ...patch,
      ...(patch.slots ? { slots: { ...character.slots, ...patch.slots } } : {}),
    }));
    await touchProject(character.projectId);
  });
}

async function assertSlotMedia(projectId: Id, slot: GenerationSlot): Promise<void> {
  const expected = [
    ...slot.referenceImageIds.map((id) => ({ id, kind: "image" as const })),
    ...slot.referenceVideoIds.map((id) => ({ id, kind: "video" as const })),
    ...(slot.result ? [{ id: slot.result.mediaId, kind: slot.result.kind }] : []),
  ];
  for (const { id, kind } of expected) {
    const media = await db.media.get(id);
    if (!media || media.projectId !== projectId || media.blob.size === 0 || !media.mimeType.startsWith(`${kind}/`)) {
      throw new Error("素材已失效、类型不符或不属于当前项目，请重新选择");
    }
  }
}

export async function setCharacterSlot(
  id: Id,
  slotKey: CharacterImageSlot,
  slot: GenerationSlot,
): Promise<void> {
  await db.transaction("rw", PRODUCTION_TABLES, async () => {
    const character = await db.characters.get(id);
    if (!character) throw new Error("角色不存在，无法保存");
    await assertSlotMedia(character.projectId, slot);
    const previous = character.slots[slotKey];
    await db.characters.put(
      touch({ ...character, slots: { ...character.slots, [slotKey]: slot } }),
    );
    await touchProject(character.projectId);
    await recycleSlotMedia(previous, slot);
  });
}

export async function deleteCharacter(id: Id): Promise<void> {
  await db.transaction("rw", PRODUCTION_TABLES, async () => {
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
  });
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
  await db.transaction("rw", db.projects, db.scenes, async () => {
    const scene = await db.scenes.get(id);
    if (!scene) throw new Error("场景不存在，无法保存");
    patch = pickPatch(patch, ["name", "location", "timeOfDay", "atmosphere", "notes", "geography", "lighting", "slots", "extra"]);
    await db.scenes.put(touch({
      ...scene, ...patch,
      ...(patch.slots ? { slots: { ...scene.slots, ...patch.slots } } : {}),
    }));
    await touchProject(scene.projectId);
  });
}

export async function setSceneSlot(
  id: Id,
  slotKey: SceneImageSlot,
  slot: GenerationSlot,
): Promise<void> {
  await db.transaction("rw", PRODUCTION_TABLES, async () => {
    const scene = await db.scenes.get(id);
    if (!scene) throw new Error("场景不存在，无法保存");
    await assertSlotMedia(scene.projectId, slot);
    const previous = scene.slots[slotKey];
    await db.scenes.put(touch({ ...scene, slots: { ...scene.slots, [slotKey]: slot } }));
    await touchProject(scene.projectId);
    await recycleSlotMedia(previous, slot);
  });
}

export async function deleteScene(id: Id): Promise<void> {
  await db.transaction("rw", PRODUCTION_TABLES, async () => {
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
  });
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
  await db.transaction("rw", db.projects, db.props, async () => {
    const prop = await db.props.get(id);
    if (!prop) throw new Error("道具不存在，无法保存");
    patch = pickPatch(patch, ["name", "kind", "notes", "appearance", "material", "size", "usage", "continuity", "slots", "extra"]);
    await db.props.put(touch({
      ...prop, ...patch,
      ...(patch.slots ? { slots: { ...prop.slots, ...patch.slots } } : {}),
    }));
    await touchProject(prop.projectId);
  });
}

export async function setPropSlot(
  id: Id,
  slotKey: PropImageSlot,
  slot: GenerationSlot,
): Promise<void> {
  await db.transaction("rw", PRODUCTION_TABLES, async () => {
    const prop = await db.props.get(id);
    if (!prop) throw new Error("道具不存在，无法保存");
    await assertSlotMedia(prop.projectId, slot);
    const previous = prop.slots[slotKey];
    await db.props.put(touch({ ...prop, slots: { ...prop.slots, [slotKey]: slot } }));
    await touchProject(prop.projectId);
    await recycleSlotMedia(previous, slot);
  });
}

export async function deleteProp(id: Id): Promise<void> {
  await db.transaction("rw", PRODUCTION_TABLES, async () => {
    const prop = await db.props.get(id);
    if (!prop) return;
    const mediaIds = collectSlotsMedia(Object.values(prop.slots));
    await db.props.delete(id);
    await db.shots.where("projectId").equals(prop.projectId).modify((shot) => {
      if (shot.propIds?.includes(id)) shot.propIds = shot.propIds.filter((value) => value !== id);
    });
    await touchProject(prop.projectId);
    for (const mediaId of mediaIds) await deleteMediaIfOrphan(mediaId);
  });
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
  await db.transaction("rw", db.projects, db.styles, async () => {
    const style = await db.styles.get(id);
    if (!style) throw new Error("风格不存在，无法保存");
    patch = pickPatch(patch, ["name", "notes", "palette", "lighting", "lens", "composition", "negativePrompt", "slots", "extra"]);
    await db.styles.put(touch({
      ...style, ...patch,
      ...(patch.slots ? { slots: { ...style.slots, ...patch.slots } } : {}),
    }));
    await touchProject(style.projectId);
  });
}

export async function setStyleSlot(
  id: Id,
  slotKey: StyleImageSlot,
  slot: GenerationSlot,
): Promise<void> {
  await db.transaction("rw", PRODUCTION_TABLES, async () => {
    const style = await db.styles.get(id);
    if (!style) throw new Error("风格不存在，无法保存");
    await assertSlotMedia(style.projectId, slot);
    const previous = style.slots[slotKey];
    await db.styles.put(touch({ ...style, slots: { ...style.slots, [slotKey]: slot } }));
    await touchProject(style.projectId);
    await recycleSlotMedia(previous, slot);
  });
}

export async function deleteStyle(id: Id): Promise<void> {
  await db.transaction("rw", PRODUCTION_TABLES, async () => {
    const style = await db.styles.get(id);
    if (!style) return;
    const mediaIds = collectSlotsMedia(Object.values(style.slots));
    await db.styles.delete(id);
    const project = await db.projects.get(style.projectId);
    if (project?.defaultStyleId === id) await db.projects.update(project.id, { defaultStyleId: undefined });
    await db.shots.where("projectId").equals(style.projectId).modify((shot) => {
      if (shot.styleId === id) shot.styleId = null;
    });
    await touchProject(style.projectId);
    for (const mediaId of mediaIds) await deleteMediaIfOrphan(mediaId);
  });
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
  await db.transaction("rw", PRODUCTION_TABLES, async () => {
    const episode = await db.episodes.get(episodeId);
    if (!episode) return;
    await assertAssetReferences(episode.projectId, patch);
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
  return db.transaction("rw", PRODUCTION_TABLES, async () => {
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
    await assertAssetReferences(episode.projectId, beat);
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
        await assertShotReferences(sourceShot);
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
  await db.transaction("rw", PRODUCTION_TABLES, async () => {
    const episode = await db.episodes.get(episodeId);
    if (!episode) throw new Error("集不存在");
    await assertAssetReferences(episode.projectId, beat);
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
  await db.transaction("rw", db.episodes, db.shots, db.projects, async () => {
    const episode = await db.episodes.get(episodeId);
    if (!episode) return;
    const project = await db.projects.get(episode.projectId);
    const story = normalizeEpisodeStory(episode.story);
    const next = { ...episode, story: { ...story, beats: story.beats.filter((beat) => beat.id !== beatId) } };
    next.shotFilters = getEpisodeShotFilters({ ...next, shotFilters: getEpisodeShotFilters(episode, project) }, project);
    await db.episodes.put(touch(next));
    await db.shots.where("episodeId").equals(episodeId).filter((shot) => shot.beatId === beatId)
      .modify((shot) => { delete shot.beatId; });
    await touchProject(episode.projectId);
  });
}

export async function updateEpisodeShotFilters(episodeId: Id, patch: Partial<ShotFilters>): Promise<void> {
  await db.transaction("rw", db.episodes, db.projects, async () => {
    const episode = await db.episodes.get(episodeId);
    if (!episode) throw new Error("集不存在");
    const project = await db.projects.get(episode.projectId);
    const definedPatch = Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined));
    const shotFilters = getEpisodeShotFilters({
      ...episode, shotFilters: { ...getEpisodeShotFilters(episode, project), ...definedPatch },
    }, project);
    await db.episodes.update(episodeId, { shotFilters, updatedAt: nowIso() });
    await touchProject(episode.projectId);
  });
}

async function assertAssetReferences(
  projectId: Id,
  fields: { characterIds?: Id[]; sceneId?: Id; propIds?: Id[]; styleId?: Id | null },
): Promise<void> {
  for (const [ids, table, label] of [
    [fields.characterIds, db.characters, "角色"],
    [fields.propIds, db.props, "道具"],
  ] as const) {
    if (ids !== undefined) {
      if (!Array.isArray(ids) || ids.some((id) => typeof id !== "string")) throw new Error(`${label}引用无效`);
      const rows = await table.bulkGet(ids);
      if (rows.some((row) => !row || row.projectId !== projectId)) throw new Error(`${label}不属于当前项目`);
    }
  }
  if (fields.sceneId !== undefined && (await db.scenes.get(fields.sceneId))?.projectId !== projectId) throw new Error("场景不属于当前项目");
  if (fields.styleId !== undefined && fields.styleId !== null && (await db.styles.get(fields.styleId))?.projectId !== projectId) throw new Error("风格不属于当前项目");
}

async function assertShotReferences(shot: Shot): Promise<void> {
  const episode = await db.episodes.get(shot.episodeId);
  if (!episode || episode.projectId !== shot.projectId) throw new Error("镜头与集不属于同一项目");
  if (shot.beatId !== undefined && !normalizeEpisodeStory(episode.story).beats.some((beat) => beat.id === shot.beatId)) throw new Error("场次不属于当前集");
  await assertAssetReferences(shot.projectId, shot);
}

export async function addShots(
  projectId: Id,
  episodeId: Id,
  count: number,
  options?: { atOrder?: number; beatId?: Id },
): Promise<Shot[]> {
  if (count <= 0) return [];
  return db.transaction("rw", PRODUCTION_TABLES, async () => {
    const episode = await db.episodes.get(episodeId);
    if (!episode || episode.projectId !== projectId) return [];
    const project = await db.projects.get(projectId);
    if (!project) return [];
    const beats = normalizeEpisodeStory(episode.story).beats;
    const beat = options?.beatId === undefined ? undefined : beats.find((item) => item.id === options.beatId);
    if (options?.beatId !== undefined && !beat) throw new Error("场次不属于当前集");
    if (beat) await assertAssetReferences(projectId, beat);
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
      if (beat) {
        shot.characterIds = [...beat.characterIds];
        shot.sceneId = beat.sceneId;
      }
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
  await db.transaction("rw", PRODUCTION_TABLES, async () => {
    const shot = await db.shots.get(id);
    if (!shot) throw new Error("镜头不存在，无法保存");
    patch = pickPatch(patch, ["order", "shotNumber", "status", "firstFrame", "lastFrame", "clip", "category", "durationSec", "content", "notes", "sceneCloseup", "sound", "emotion", "cameraAngle", "cameraGear", "focalLength", "characterIds", "sceneId", "beatId", "propIds", "styleId", "extra"]);
    await assertShotReferences({ ...shot, ...patch });
    await db.shots.put({ ...shot, ...patch });
    await touchProject(shot.projectId);
  });
}

export type EpisodeShotBulkPatch = Partial<
  Pick<Shot, "beatId" | "durationSec" | "status" | "characterIds" | "sceneId" | "propIds" | "styleId" | "notes">
>;

export async function patchEpisodeShots(
  episodeId: Id,
  ids: Id[],
  patch: EpisodeShotBulkPatch,
): Promise<void> {
  if (ids.length === 0) return;
  await db.transaction("rw", PRODUCTION_TABLES, async () => {
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
    patch = pickPatch(patch, ["beatId", "durationSec", "status", "characterIds", "sceneId", "propIds", "styleId", "notes"]);
    const nextPatch: EpisodeShotBulkPatch = { ...patch };
    if ("status" in patch) {
      nextPatch.status = normalizeShotStatus(patch.status);
    }
    if ("characterIds" in patch) {
      nextPatch.characterIds = Array.isArray(patch.characterIds)
        ? [...patch.characterIds]
        : [];
    }
    for (const shot of shots) await assertShotReferences({ ...shot!, ...nextPatch });
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
  return db.transaction("rw", PRODUCTION_TABLES, async () => {
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
    await assertShotReferences(copy);
    await db.shots.add(copy);
    await touchProject(source.projectId);
    return copy;
  });
}

export async function restoreShots(shots: Shot[], media: MediaRecord[] = []): Promise<void> {
  if (shots.length === 0) return;
  await db.transaction("rw", PRODUCTION_TABLES, async () => {
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
        await assertShotReferences(shot);
        const existing = await db.shots.get(shot.id);
        if (existing) throw new Error("镜头已存在，无法恢复");
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
  await db.transaction("rw", PRODUCTION_TABLES, async () => {
    const shot = await db.shots.get(id);
    if (!shot) throw new Error("镜头不存在，无法保存");
    await assertSlotMedia(shot.projectId, slot);
    const previous = shot[field];
    await db.shots.put({ ...shot, [field]: slot });
    await touchProject(shot.projectId);
    await recycleSlotMedia(previous, slot);
  });
}

export async function deleteShots(ids: Id[]): Promise<void> {
  await db.transaction("rw", PRODUCTION_TABLES, async () => {
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
  });
}

export async function deleteEpisodeShots(episodeId: Id, ids: Id[]): Promise<void> {
  await db.transaction("rw", PRODUCTION_TABLES, async () => {
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
  });
}

export async function setVisibleColumns(
  projectId: Id,
  visible: ShotColumnId[],
): Promise<void> {
  await updateProject(projectId, { columnSettings: { visible } });
}

export async function listConnectors(): Promise<ConnectorConfig[]> {
  return db.connectors.orderBy("updatedAt").reverse().toArray();
}

export async function getConnectorByDefinition(
  definitionId: ConnectorDefinitionId,
): Promise<ConnectorConfig | undefined> {
  return db.connectors.where("definitionId").equals(definitionId).first();
}

export type UpsertConnectorInput = {
  definitionId: ConnectorDefinitionId;
  protocol: ConnectorProtocol;
  baseUrl: string;
  apiKey: string;
  label?: string;
};

/** One saved config per catalog definitionId. */
export async function upsertConnector(input: UpsertConnectorInput): Promise<ConnectorConfig> {
  const baseUrl = normalizeBaseUrl(input.baseUrl);
  const apiKey = input.apiKey.trim();
  if (!baseUrl) throw new Error("请填写 Base URL");
  if (!apiKey) throw new Error("请填写 API Key");

  const existing = await getConnectorByDefinition(input.definitionId);
  const at = nowIso();
  const record: ConnectorConfig = {
    id: existing?.id ?? createId("conn"),
    definitionId: input.definitionId,
    protocol: input.protocol,
    label: input.label?.trim() || undefined,
    baseUrl,
    apiKey,
    updatedAt: at,
  };
  await db.connectors.put(record);
  return record;
}

export async function deleteConnector(id: Id): Promise<void> {
  await db.connectors.delete(id);
}

export async function listChatThreads(): Promise<ChatThread[]> {
  return db.chatThreads.orderBy("updatedAt").reverse().toArray();
}

export async function getChatThread(id: Id): Promise<ChatThread | undefined> {
  return db.chatThreads.get(id);
}

export async function createChatThread(options?: {
  projectId?: Id;
  taskMode?: boolean;
  title?: string;
  connectorId?: Id;
  model?: string;
}): Promise<ChatThread> {
  const at = nowIso();
  const thread: ChatThread = {
    contextPolicy: normalizeContextPolicy((await getGeneralAgentConfig()).contextPolicy),
    id: createId("cth"),
    title: options?.title?.trim() || "新对话",
    taskMode: options?.taskMode === true,
    projectId: options?.projectId,
    connectorId: options?.connectorId,
    model: options?.model?.trim() || undefined,
    createdAt: at,
    updatedAt: at,
  };
  await db.transaction("rw", [db.chatThreads, db.projects], async () => {
    if (thread.projectId && (thread.projectId === STUDIO_LIBRARY_ID || !await db.projects.get(thread.projectId))) throw new Error("请选择可用项目");
    await db.chatThreads.add(thread);
  });
  return thread;
}

export async function updateChatThread(
  id: Id,
  patch: Partial<Pick<ChatThread, "title" | "connectorId" | "model" | "reasoningSelection" | "interactionMode">>,
): Promise<void> {
  await db.transaction("rw", db.chatThreads, async () => {
  const existing = await db.chatThreads.get(id);
  if (!existing) return;
  const next: ChatThread = {
    ...existing,
    updatedAt: nowIso(),
  };
  if (patch.title !== undefined) {
    const title = patch.title.trim();
    next.title = title || existing.title;
  }
  if (patch.connectorId !== undefined) {
    next.connectorId = patch.connectorId || undefined;
  }
  if (patch.model !== undefined) {
    const model = patch.model.trim();
    next.model = model || undefined;
  }
  if (patch.interactionMode !== undefined) next.interactionMode = patch.interactionMode;
  if (patch.reasoningSelection !== undefined) next.reasoningSelection = patch.reasoningSelection;
  await db.chatThreads.put(next);
  });
}

export async function deleteChatThread(id: Id): Promise<void> {
  await db.transaction("rw", [...PRODUCTION_TABLES, db.chatThreads, db.chatMessages, db.agentRuns, db.agentToolCalls, db.agentTasks, db.contextCompactions, db.agentTaskRecords, db.agentTaskRecordVersions, db.agentTaskWrapups, db.agentTaskWrapupVersions], async () => {
    const jobs = await db.agentGenerationJobs.where("threadId").equals(id).toArray();
    const jobMedia = new Set(jobs.flatMap((job) => [...job.inputs.map((input) => input.mediaId), ...(job.result ? [job.result.mediaId] : [])]));
    await db.agentGenerationJobs.where("threadId").equals(id).delete();
    await db.contextCompactions.where("threadId").equals(id).delete();
    for (const task of await db.agentTasks.where("threadId").equals(id).toArray()) {
      await db.agentTaskWrapups.where("taskId").equals(task.id).delete();
      await db.agentTaskWrapupVersions.where("taskId").equals(task.id).delete();
      await db.agentTaskRecords.where("taskId").equals(task.id).delete();
      await db.agentTaskRecordVersions.where("taskId").equals(task.id).delete();
    }
    await db.agentTasks.where("threadId").equals(id).delete();
    await db.agentToolCalls.where("threadId").equals(id).delete();
    await db.agentRuns.where("threadId").equals(id).delete();
    await db.chatMessages.where("threadId").equals(id).delete();
    await db.chatThreads.delete(id);
    for (const mediaId of jobMedia) await deleteMediaIfOrphan(mediaId);
  });
}

export async function listChatMessages(threadId: Id): Promise<ChatMessage[]> {
  return db.chatMessages.where("threadId").equals(threadId).sortBy("createdAt");
}

export async function appendChatMessage(input: {
  threadId: Id;
  role: ChatMessageRole;
  content?: string;
  status?: ChatMessageStatus;
}): Promise<ChatMessage> {
  const at = nowIso();
  const message: ChatMessage = {
    id: createId("cmsg"),
    threadId: input.threadId,
    role: input.role,
    content: input.content ?? "",
    createdAt: at,
    status: input.status,
  };
  await db.transaction("rw", db.chatThreads, db.chatMessages, async () => {
    const thread = await db.chatThreads.get(input.threadId);
    if (!thread) throw new Error("对话不存在");
    await db.chatMessages.put(message);
    await db.chatThreads.put({ ...thread, updatedAt: at });
  });
  return message;
}

export async function updateChatMessage(
  id: Id,
  patch: Partial<Pick<ChatMessage, "content" | "status" | "reasoning" | "reasoningDurationMs">>,
): Promise<void> {
  await db.transaction("rw", db.chatMessages, async () => {
    const existing = await db.chatMessages.get(id);
    if (!existing || existing.runId) return;
    await db.chatMessages.update(id, patch);
  });
}

/** Bind once before any conversation execution; changing projects starts a new thread. */
export async function bindChatThreadProject(threadId: string, projectId: string, expectedProjectId?: string): Promise<void> {
  await db.transaction("rw", [db.chatThreads, db.projects, db.agentRuns, db.chatMessages, db.agentTasks], async () => {
    const thread = await db.chatThreads.get(threadId);
    if (!thread || thread.projectId !== expectedProjectId) throw new Error("对话项目已变化，请重新读取");
    if (projectId === STUDIO_LIBRARY_ID || !await db.projects.get(projectId)) throw new Error("请选择可用项目");
    if (thread.projectId === projectId) return;
    if (thread.projectId || await db.agentRuns.where("threadId").equals(threadId).count() || await db.chatMessages.where("threadId").equals(threadId).count() || await db.agentTasks.where("threadId").equals(threadId).count()) throw new Error("已有对话不能切换项目，请新建对话");
    await db.chatThreads.update(threadId, { projectId, updatedAt: nowIso() });
  });
}
