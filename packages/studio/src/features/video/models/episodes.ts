import type {Id} from "../../../platform/identity";
import type {EpisodeStory} from "./story";
import type {ShotFilters} from "./shots";
import type {Project} from "../../projects/models/project";
import {normalizeShotFilters} from "./shots";
import {normalizeEpisodeStory} from "./story";
import {SHOT_UNASSIGNED_BEAT} from "./shots";

export interface Episode {
    id: Id;
    projectId: Id;
    order: number;
    title: string;
    story: EpisodeStory;
    /** Episode-local filters. Missing on legacy records only. */
    shotFilters?: ShotFilters;
    createdAt: string;
    updatedAt: string;
    extra?: Record<string, unknown>;
}

/** Read legacy preferences without leaking another episode's beat IDs. */
export function getEpisodeShotFilters(
    episode: Pick<Episode, "story" | "shotFilters">,
    project?: Pick<Project, "shotSettings">,
): ShotFilters {
    const filters = normalizeShotFilters(episode.shotFilters ?? project?.shotSettings?.filters);
    const beatIds = new Set(normalizeEpisodeStory(episode.story).beats.map((beat) => beat.id));
    return {...filters, beatIds: filters.beatIds.filter((id) => id === SHOT_UNASSIGNED_BEAT || beatIds.has(id))};
}

export function episodeLabel(episode: Pick<Episode, "order" | "title">): string {
    const heading = `第${episode.order + 1}集`;
    const title = episode.title.trim();
    return title ? `${heading} · ${title}` : heading;
}
