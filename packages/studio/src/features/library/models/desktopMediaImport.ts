import type {DesktopImportProvenance} from "./media";

export type DesktopMediaImportActor = {kind: "human"} | {kind: "agent"; runId: string; threadId: string; callId: string};
export type DesktopMediaImportStatus = "accepted" | "running" | "stopping" | "stopped" | "completed" | "failed" | "unknown";
interface DesktopMediaImportSelectionItem {
    entryId: string;
    revision: string;
    filename: string;
    mimeType: string;
    byteLength: number;
    sourceMediaId: string;
    thumbnailMediaId: string;
}
export interface DesktopMediaImportSelection {
    grantId: string;
    scanId: string;
    revision: string;
    items: DesktopMediaImportSelectionItem[];
}
export interface DesktopMediaImportReceipt {
    itemId: string;
    sourceMediaId: string;
    thumbnailMediaId: string;
    provenance: DesktopImportProvenance;
    committedAt: string;
}
/** Durable admission precedes native effects; a retained row is not permission to replay them. */
export interface DesktopMediaImport {
    id: string;
    projectId: string;
    actor: DesktopMediaImportActor;
    callRevision?: string;
    selection: DesktopMediaImportSelection;
    status: DesktopMediaImportStatus;
    revision: number;
    receipts: DesktopMediaImportReceipt[];
    error?: string;
    createdAt: string;
    updatedAt: string;
}
