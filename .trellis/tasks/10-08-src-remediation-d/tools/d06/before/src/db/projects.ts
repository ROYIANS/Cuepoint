import {
    type Project,
    type ProjectMode,
    type AspectPresetId,
    type Id,
    normalizeAspectPreset,
    type ShotSettings,
    normalizeShotSettings,
    normalizeSeriesStory,
    type WorldSetting,
    emptySetting,
    type ShotColumnId
} from "@/domain/types";
import {db} from "./database";
import {nowIso} from "@/lib/ids";
import {sameDraftStructure, DraftConflictError, assertDraftBaseline} from "@/lib/draftConflict";
import {validateGenerationDefaults} from "@/domain/output";
import {emptySlot} from "@/domain/slot";
import {AUDIO_TABLES, newAudioRow} from "./audioShared";
import {type AudioChapter, type AudioTrack} from "@/domain/audio";
import {type MusicDraft, defaultMusicSettings} from "@/domain/music";
import {emptyProject, emptyEpisode} from "./productionRecords";
import {touch, PRODUCTION_TABLES, assertVideoProject} from "./productionShared";
import {assertSlotMedia, deleteMediaIfOrphan} from "./media";

export async function listProjects(): Promise<Project[]> {
    const rows = await db.projects.toArray();
    return rows.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function createProject(
    name: string,
    mode: ProjectMode = "film",
    aspectPreset: AspectPresetId = "16:9",
    ipId?: Id | null,
): Promise<Project> {
    const project = emptyProject(name, mode, aspectPreset);
    const episode = emptyEpisode(project.id, 0);
    await db.transaction("rw", [db.projects, db.episodes, ...(ipId ? [db.ipProfiles, db.projectIpLinks] : [])], async () => {
        if (ipId) {
            const profile = await db.ipProfiles.get(ipId);
            if (!profile || profile.archived) throw new Error("请选择未归档的 IP");
            await db.projectIpLinks.add({projectId: project.id, ipId, updatedAt: nowIso()});
        }
        await db.projects.add(project);
        await db.episodes.add(episode);
    });
    return project;
}

export async function renameProject(id: Id, name: string): Promise<void> {
    await db.transaction("rw", db.projects, async () => {
        const project = await db.projects.get(id);
        if (!project) throw new Error("项目不存在，无法保存");
        await db.projects.put(touch({...project, name: name.trim() || project.name}));
    });
}

/** Optional project metadata uses explicit undefined to clear saved defaults. */
type ProjectDetailsPatch = Partial<Pick<Project, "name" | "brief" | "genre" | "audience" | "tone" | "aspectPreset" | "defaultStyleId" | "generationDefaults">>;

function assertProjectDetailsBaseline(project: Project, next: Project, patch: ProjectDetailsPatch, baseline?: Partial<Project>): void {
    if (!baseline) return;
    for (const key of Object.keys(patch) as Array<keyof ProjectDetailsPatch>) {
        if (key === "generationDefaults") {
            if (!sameDraftStructure(project[key] ?? {}, baseline[key] ?? {}) &&
                !sameDraftStructure(project[key] ?? {}, next[key] ?? {})) throw new DraftConflictError();
        } else if (key === "aspectPreset") {
            if (normalizeAspectPreset(project[key]) !== normalizeAspectPreset(baseline[key]) &&
                normalizeAspectPreset(project[key]) !== next[key]) throw new DraftConflictError();
        } else assertDraftBaseline(project, {[key]: next[key]}, baseline);
    }
}

export async function patchProjectDetails(
    id: Id,
    patch: ProjectDetailsPatch,
    baseline?: Partial<Project>,
): Promise<void> {
    await db.transaction("rw", db.projects, db.styles, async () => {
        const project = await db.projects.get(id);
        if (!project) throw new Error("项目不存在，无法保存");
        const next = {...project};
        for (const key of ["name", "brief", "genre", "audience", "tone"] as const) {
            if (key in patch) {
                if (patch[key] !== undefined && typeof patch[key] !== "string") throw new Error("项目信息必须是文本");
                if (key === "name") {
                    if (!patch.name?.trim()) throw new Error("项目名称不能为空");
                    next.name = patch.name.trim();
                } else next[key] = patch[key];
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
        assertProjectDetailsBaseline(project, next, patch, baseline);
        await db.projects.put(touch(next));
    });
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
        const next = {...project, ...patch};
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
        if (patch.coverMediaId !== undefined && patch.coverMediaId !== null) {
            await assertSlotMedia(id, {...emptySlot(), result: {mediaId: patch.coverMediaId, kind: "image"}});
        }
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
        await assertVideoProject(id);
        const project = await db.projects.get(id);
        if (!project) throw new Error("项目不存在，无法保存");
        const definedPatch = Object.fromEntries(
            Object.entries(patch).filter(([, value]) => value !== undefined),
        ) as Partial<ShotSettings>;
        await db.projects.put(touch({
            ...project,
            shotSettings: {...normalizeShotSettings(project.shotSettings), ...definedPatch},
        }));
    });
}

export async function updateSeriesLogline(id: Id, logline: string, baseline?: string): Promise<void> {
    await db.transaction("rw", db.projects, async () => {
        await assertVideoProject(id);
        const project = await db.projects.get(id);
        if (!project) throw new Error("项目不存在，无法保存");
        assertDraftBaseline(normalizeSeriesStory(project.story), {logline}, baseline === undefined ? undefined : {logline: baseline});
        await db.projects.put(touch({
            ...project,
            story: {...normalizeSeriesStory(project.story), logline},
        }));
    });
}

export async function updateWorldSetting(
    id: Id,
    patch: Partial<WorldSetting>,
    baseline?: Partial<WorldSetting>,
): Promise<void> {
    await db.transaction("rw", db.projects, async () => {
        await assertVideoProject(id);
        const project = await db.projects.get(id);
        if (!project) throw new Error("项目不存在，无法保存");
        assertDraftBaseline({...emptySetting(), ...project.setting}, patch, baseline);
        await db.projects.put(touch({
            ...project,
            setting: {...emptySetting(), ...project.setting, ...patch},
        }));
    });
}

export async function setVisibleColumns(
    projectId: Id,
    visible: ShotColumnId[],
): Promise<void> {
    await updateProject(projectId, {columnSettings: {visible}});
}

export async function createAudioMusicProject(name: string, kind: "audio" | "music", ipId?: Id | null): Promise<Project> {
    if (kind !== "audio" && kind !== "music") throw new Error("不支持的项目类型");
    const project = {...emptyProject(name), kind};
    await db.transaction("rw", [db.projects, ...AUDIO_TABLES, db.ipProfiles, db.projectIpLinks], async () => {
        if (ipId) {
            const profile = await db.ipProfiles.get(ipId);
            if (!profile || profile.archived) throw new Error("请选择未归档的 IP");
            await db.projectIpLinks.add({projectId: project.id, ipId, updatedAt: nowIso()});
        }
        await db.projects.add(project);
        if (kind === "audio") {
            const chapter = newAudioRow<AudioChapter>(project.id, "ach", {title: "第一章", order: 0});
            await db.audioChapters.add(chapter);
            await db.audioTracks.add(newAudioRow<AudioTrack>(project.id, "atr", {
                chapterId: chapter.id,
                role: "voice",
                name: "人声",
                order: 0,
                gain: 1,
                muted: false,
                solo: false
            }));
        } else await db.musicDrafts.add(newAudioRow<MusicDraft>(project.id, "mdr", {settings: defaultMusicSettings()}));
    });
    return project;
}
