import type {MediaKind} from "../models/slots";
import type {MediaRecord} from "../models/media";
import {binaryByteLength} from "../../../platform/media/binaryTypes";

export function reusableMedia(records: MediaRecord[], ownerId: string, kinds: readonly MediaKind[], query = ""): MediaRecord[] {
    const needle = query.trim().toLocaleLowerCase();
    return records.filter((record) => record.projectId === ownerId && binaryByteLength(record.blob) > 0 &&
        kinds.some((kind) => record.mimeType.startsWith(`${kind}/`)) &&
        (!needle || record.filename.toLocaleLowerCase().includes(needle)));
}
