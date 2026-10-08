import {patchStoryBeat} from "@/db/episodes";
import type {StoryBeat} from "@/domain/types";
import {TextDraftField} from "@/components/drafts/TextDraftField";
import type {TextDraftStatusChange} from "@/lib/useTextDraftRetention";

export function BeatTextField({projectId, episodeId, beat, field, onDraftStatus, ...control}: {
    projectId: string;
    episodeId: string;
    beat: StoryBeat;
    field: "title" | "content" | "timeOfDay";
    onDraftStatus?: TextDraftStatusChange;
} & Pick<Parameters<typeof TextDraftField>[0], "multiline" | "rows" | "placeholder" | "ariaLabel" | "className" | "containerClassName" | "unavailable">) {
    return <TextDraftField {...control} projectId={projectId} draftKey={`episode:${episodeId}:beat:${beat.id}:${field}`}
                           value={beat[field] ?? ""}
                           persist={(value, baseline) => patchStoryBeat(episodeId, beat.id, {[field]: value}, {[field]: baseline})}
                           onStatusChange={status => onDraftStatus?.(beat.id, field, status)}/>;
}
