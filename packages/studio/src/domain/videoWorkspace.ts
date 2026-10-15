import type {Episode, Project, Shot, StoryBeat} from "./types";

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
