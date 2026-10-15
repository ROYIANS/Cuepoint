import type {Id} from "../../../platform/identity";
import {recoverLegacyText} from "../../../platform/data/legacyScalar";
import {recoverLegacyIds} from "../../../platform/data/legacyScalar";
import {isLegacyScalar} from "../../../platform/data/legacyScalar";

export interface StoryBeat {
    id: Id;
    title: string;
    content: string;
    characterIds: Id[];
    sceneId?: Id;
    timeOfDay: string;
    scriptRange?: {
        start: number;
        end: number;
        excerpt: string;
    };
}

export interface ProjectStory {
    logline: string;
}

export interface EpisodeStory {
    logline: string;
    script: string;
    beats: StoryBeat[];
}

export function emptySeriesStory(): ProjectStory {
    return {logline: ""};
}

export function normalizeSeriesStory(raw: unknown): ProjectStory {
    const story = emptySeriesStory();
    if (!raw || typeof raw !== "object") return story;
    const record = raw as Record<string, unknown>;
    story.logline = recoverLegacyText(record.logline);
    return story;
}

export function emptyEpisodeStory(): EpisodeStory {
    return {logline: "", script: "", beats: []};
}

function normalizeStoryBeat(raw: unknown, index: number): StoryBeat {
    const beat =
        raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
    const normalized: StoryBeat = {
        id: recoverLegacyText(beat.id, `beat_${index}`),
        title: recoverLegacyText(beat.title),
        content: recoverLegacyText(beat.content),
        characterIds: recoverLegacyIds(beat.characterIds),
        sceneId: beat.sceneId && isLegacyScalar(beat.sceneId) ? String(beat.sceneId) : undefined,
        timeOfDay: recoverLegacyText(beat.timeOfDay),
    };
    if (beat.scriptRange && typeof beat.scriptRange === "object") {
        const range = beat.scriptRange as Record<string, unknown>;
        const start = isLegacyScalar(range.start) ? Number(range.start) : NaN;
        const end = isLegacyScalar(range.end) ? Number(range.end) : NaN;
        // Associations require authored string evidence, never a manufactured excerpt.
        const excerpt = typeof range.excerpt === "string" ? range.excerpt : "";
        if (
            Number.isInteger(start) &&
            Number.isInteger(end) &&
            start >= 0 &&
            end > start &&
            excerpt.length === end - start
        ) {
            normalized.scriptRange = {start, end, excerpt};
        }
    }
    return normalized;
}

export function normalizeEpisodeStory(raw: unknown): EpisodeStory {
    const story = emptyEpisodeStory();
    if (!raw || typeof raw !== "object") return story;
    const record = raw as Record<string, unknown>;
    story.logline = recoverLegacyText(record.logline);
    story.script = recoverLegacyText(record.script);
    const beats: unknown[] = Array.isArray(record.beats) ? record.beats : [];
    const reservedIds = new Set(beats.map((beat, index) => normalizeStoryBeat(beat, index).id));
    story.beats = beats.map((beat, index) => {
        const normalized = normalizeStoryBeat(beat, index);
        const rawId = beat && typeof beat === "object" ? (beat as Record<string, unknown>).id : undefined;
        if (!isLegacyScalar(rawId)) {
            let suffix = 0;
            while (reservedIds.has(normalized.id)) normalized.id = `beat_${index}_recovered_${++suffix}`;
            reservedIds.add(normalized.id);
        }
        if (
            normalized.scriptRange &&
            story.script.slice(normalized.scriptRange.start, normalized.scriptRange.end) !==
            normalized.scriptRange.excerpt
        ) {
            delete normalized.scriptRange;
        }
        return normalized;
    });
    return story;
}
