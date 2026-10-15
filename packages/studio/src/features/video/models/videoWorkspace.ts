import type {Episode} from "./episodes";
import type {Project} from "../../projects/models/project";
import type {Shot} from "./shots";
import type {StoryBeat} from "./story";

/** Canonical product rows; adapters own persistence, pages own presentation. */
export type VideoWorkspaceCapability = {
    id: "world" | "generation" | "relations" | "mediaSlots" | "sync";
    status: "available" | "unavailable";
    reason?: string;
};
export type VideoWorkspaceUndoAction = { restore: () => Promise<void> };
export type VideoWorkspaceSnapshot = {
    project: Project;
    episodes: Episode[];
    beats: (StoryBeat & { episodeId: string; order: number })[];
    shots: Shot[];
    capabilities: VideoWorkspaceCapability[];
};
