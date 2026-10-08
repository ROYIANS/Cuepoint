import {patchShot} from "@/db/shots";
import type {Shot} from "@/domain/types";
import {TextDraftField} from "@/components/drafts/TextDraftField";
import type {TextDraftStatusChange} from "@/lib/useTextDraftRetention";
import type {TextShotField} from "./shotColumnFields";

export function ShotTextField({shot, field, onDraftStatus, ...control}: {
    shot: Shot;
    field: TextShotField | "shotNumber";
    onDraftStatus?: TextDraftStatusChange;
} & Pick<Parameters<typeof TextDraftField>[0], "multiline" | "rows" | "placeholder" | "ariaLabel" | "className" | "containerClassName" | "unavailable">) {
    return <TextDraftField {...control} projectId={shot.projectId} draftKey={`shot:${shot.id}:${field}`}
                           value={shot[field] ?? ""}
                           persist={(value, baseline) => patchShot(shot.id, {[field]: value}, {[field]: baseline})}
                           onStatusChange={status => onDraftStatus?.(shot.id, field, status)}/>;
}
