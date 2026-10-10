import type {AudioClip, AudioRow, AudioSegment, AudioTake} from "./audio";

export const AUDIO_ARRANGEMENT_LIMIT = 20;
export class AudioArrangementConflictError extends Error {
    constructor(readonly reason: "snapshot_changed" | "proposal_changed", message: string) {
        super(message);
        this.name = "AudioArrangementConflictError";
    }
}
export type AudioArrangementOwner = {type: "manual"} | {type: "agent"; threadId: string; runId: string; callId: string};
export interface AudioTakeChoice {segmentId: string; segmentRevision: number; takeId: string; takeRevision: number}
export interface AudioArrangementRequest {
    segmentIds: string[];
    trackId: string;
    gapSec?: number;
    startSec?: number;
    trims?: Array<{segmentId: string; startSec: number; endSec: number}>;
}
export interface AudioArrangementItem {
    segmentId: string;
    takeId: string;
    text: string;
    takeName: string;
    textMismatch: boolean;
    durationSec: number;
    status: "add" | "already_placed" | "manual_conflict";
    preservedClipIds: string[];
    clip?: AudioClip;
}
interface AudioSelectionItem {
    segment: AudioSegment;
    take: AudioTake;
    textMismatch: boolean;
}
export interface AudioArrangementReceipt {
    proposalId: string;
    projectId: string;
    kind: "selection" | "arrangement";
    selected: AudioSegment[];
    added: AudioClip[];
    preserved: number;
    conflicts: number;
    before: AudioClip[];
    after: AudioClip[];
    replayed?: boolean;
    currentAddedIds?: string[];
}
export interface AudioArrangementProposal extends AudioRow {
    chapterId: string;
    kind: "selection" | "arrangement";
    state: "prepared" | "applied";
    owner: AudioArrangementOwner;
    /** Imported previews are inspectable history; they grant no local approval. */
    dormant?: boolean;
    fingerprint: string;
    choices: AudioTakeChoice[];
    request?: AudioArrangementRequest;
    selections: AudioSelectionItem[];
    items: AudioArrangementItem[];
    before: AudioClip[];
    receipt?: AudioArrangementReceipt;
    reverted?: boolean;
}
