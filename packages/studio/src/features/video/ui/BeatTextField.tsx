import {useVideoWorkspaceRepository} from "../services/workspaceRepository";
import type {StoryBeat} from "../models/story";
import {TextDraftField} from "../../../app/drafts/TextDraftField";
import type {TextDraftStatusChange} from "../../../app/drafts/useTextDraftRetention";

export function BeatTextField({projectId, episodeId, beat, field, onDraftStatus, ...control}: {
    projectId: string;
    episodeId: string;
    beat: StoryBeat;
    field: "title" | "content" | "timeOfDay";
    onDraftStatus?: TextDraftStatusChange;
} & Pick<Parameters<typeof TextDraftField>[0], "multiline" | "rows" | "placeholder" | "ariaLabel" | "className" | "containerClassName" | "unavailable">) {
    const repository = useVideoWorkspaceRepository();
    return <TextDraftField {...control} projectId={projectId} draftKey={`episode:${episodeId}:beat:${beat.id}:${field}`}
                           value={beat[field] ?? ""}
                           persist={(value, baseline) => repository.patchStoryBeat(episodeId, beat.id, {[field]: value}, {[field]: baseline})}
                           onStatusChange={status => onDraftStatus?.(beat.id, field, status)}/>;
}
