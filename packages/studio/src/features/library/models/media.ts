import type {Id} from "../../../platform/identity";

export interface MediaRecord {
    /** Explicit library adoption retained even before attachment to a slot. */
    libraryRetained?: boolean;
    id: Id;
    projectId: Id;
    mimeType: string;
    filename: string;
    blob: import("../../../platform/media/binaryTypes").BinaryContent;
}
