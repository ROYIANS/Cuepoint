import {useVideoWorkspaceRepository} from "../../lib/videoWorkspaceRepository";
import type {Shot} from "../../domain/types";
import {TextDraftField} from "../drafts/TextDraftField";
import type {TextDraftStatusChange} from "../../lib/useTextDraftRetention";
import type {TextShotField} from "./shotColumnFields";

export function ShotTextField({shot, field, onDraftStatus, ...control}: {
    shot: Shot;
    field: TextShotField | "shotNumber";
    onDraftStatus?: TextDraftStatusChange;
} & Pick<Parameters<typeof TextDraftField>[0], "multiline" | "rows" | "placeholder" | "ariaLabel" | "className" | "containerClassName" | "unavailable">) {
    const repository = useVideoWorkspaceRepository();
    return <TextDraftField {...control} projectId={shot.projectId} draftKey={`shot:${shot.id}:${field}`}
                           value={shot[field] ?? ""}
                           persist={(value, baseline) => repository.patchShot(shot.id, {[field]: value}, {[field]: baseline})}
                           onStatusChange={status => onDraftStatus?.(shot.id, field, status)}/>;
}
