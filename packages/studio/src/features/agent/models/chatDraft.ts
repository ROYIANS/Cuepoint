import type {ReferenceAttachment} from "../../references/models/references";

export type ReferenceImportDraft = {
    id: string;
    filename: string;
    status: "importing" | "failed";
    error?: string;
    file: File;
    referenceId?: string
};
type DraftState = {
    text: string;
    textRevision: number;
    revision: number;
    attachments: ReferenceAttachment[];
    imports: ReferenceImportDraft[]
};
export type SubmittedDraft = Pick<DraftState, "text" | "textRevision" | "attachments" | "imports"> & { scope: string };
export type DraftRecovery = {scope: string; revision: number};

/** Published compose state is immutable; capture creates an independent submission DTO. */
export type DraftSnapshot = Omit<Readonly<DraftState>, "attachments" | "imports"> & {
    readonly attachments: readonly Readonly<ReferenceAttachment>[];
    readonly imports: readonly Readonly<ReferenceImportDraft>[];
};
