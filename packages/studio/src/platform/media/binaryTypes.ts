/** Native bytes are workspace-owned immutable files; browser bytes are Blobs. */
export interface ManagedBinaryRef {
    version: 1;
    workspaceId: string;
    binaryId: string;
    byteLength: number;
    contentHash: string;
    mimeType: string;
}

export type BinaryContent = Blob | ManagedBinaryRef;

/** Metadata only: neither helper proves that managed bytes currently exist. */
export function binaryByteLength(binary: BinaryContent): number {
    return binary instanceof Blob ? binary.size : binary.byteLength;
}

export function binaryMimeType(binary: BinaryContent): string {
    return binary instanceof Blob ? binary.type : binary.mimeType;
}
