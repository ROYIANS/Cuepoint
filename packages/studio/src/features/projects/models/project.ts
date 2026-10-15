import type {Id} from "../../../platform/identity";
import type {ProjectGenerationDefaults} from "../../video/models/output";
import type {ProjectMode} from "../../video/models/format";
import type {AspectPresetId} from "../../video/models/format";
import type {ColumnSettings} from "../../video/models/shots";
import type {ShotSettings} from "../../video/models/shots";
import type {ProjectStory} from "../../video/models/story";
import type {WorldSetting} from "../../video/models/world";

export type ProjectKind = "video" | "audio" | "music";

export function getProjectKind(project: Pick<Project, "kind">): ProjectKind {
    if (project.kind === undefined) return "video";
    if (project.kind === "video" || project.kind === "audio" || project.kind === "music") return project.kind;
    throw new Error("不支持的项目类型");
}

export interface Project {
    kind?: ProjectKind;
    archivedAt?: string;
    defaultStyleId?: Id;
    generationDefaults?: ProjectGenerationDefaults;
    brief?: string;
    genre?: string;
    audience?: string;
    tone?: string;
    id: Id;
    name: string;
    mode: ProjectMode;
    aspectPreset: AspectPresetId;
    coverMediaId?: Id;
    createdAt: string;
    updatedAt: string;
    columnSettings: ColumnSettings;
    shotSettings: ShotSettings;
    story: ProjectStory;
    setting: WorldSetting;
    extra?: Record<string, unknown>;
    musicVariantLinks?: Record<string, Partial<Record<"suno-simple" | "suno-custom" | "flowmusic", string>>>;
}
