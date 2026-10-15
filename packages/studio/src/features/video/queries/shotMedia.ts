import {binaryByteLength} from "../../../platform/media/binaryTypes";
import type {BinaryAvailability} from "../../../platform/storage/nativeBinary";
import type {GenerationResult, MediaKind} from "../../library/models/slots";
import type {MediaRecord} from "../../library/models/media";

export type ShotMediaIndex = ReadonlyMap<string, MediaRecord>;
export type ShotBinaryState = BinaryAvailability | "error";
const verified = new WeakMap<ShotMediaIndex, ReadonlyMap<string, ShotBinaryState>>();

/** Logical rows stay in the index even when bytes are missing or corrupt. */
export function verifiedShotMediaIndex(rows: Iterable<readonly [string, MediaRecord]>, states: ReadonlyMap<string, ShotBinaryState>): ShotMediaIndex {
    const index = new Map(rows);
    verified.set(index, new Map(states));
    return index;
}

export function shotBinaryState(media: ShotMediaIndex, id: string): ShotBinaryState | "pending" {
    const record = media.get(id);
    if (!record) return "missing";
    if (record.blob instanceof Blob) return "ready";
    return verified.get(media)?.get(id) ?? "pending";
}

/** A stored ID alone is not evidence that a deliverable exists. */
export function validShotMediaId(
    result: GenerationResult | undefined,
    kind: MediaKind,
    projectId: string,
    media: ShotMediaIndex,
): string | undefined {
    if (!result || result.kind !== kind) return undefined;
    const record = media.get(result.mediaId);
    return record && record.projectId === projectId && binaryByteLength(record.blob) > 0 && shotBinaryState(media, record.id) === "ready" &&
    record.mimeType.startsWith(`${kind}/`)
        ? record.id
        : undefined;
}
