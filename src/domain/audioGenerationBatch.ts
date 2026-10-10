import type {AudioRow} from "./audio";
import type {AudioGenerationInput, AudioGenerationJob} from "./audioGeneration";

export const AUDIO_BATCH_LIMIT = 20;
export const AUDIO_BATCH_CONCURRENCY = 2;
export type AudioBatchOwner = {kind: "manual"} | {
    kind: "agent"; threadId: string; runId: string; callId: string; taskId?: string;
};
export interface AudioBatchSnapshot {
    input: Extract<AudioGenerationInput, {kind: "speech"}>;
    connector: AudioGenerationJob["connector"];
    speakerId?: string;
    speakerRevision?: number;
    /** Hash only; credentials and clone bytes never enter batch records. */
    fingerprint: string;
    referenceFingerprint?: string;
}
export interface AudioGenerationBatch extends AudioRow {
    version: 1;
    chapterId: string;
    title: string;
    owner: AudioBatchOwner;
    sourceCallId?: string;
    status: "draft" | "ready" | "running" | "paused" | "settled" | "cancelled";
    itemIds: string[];
    confirmedItemIds: string[];
    confirmedAt?: string;
    pauseReason?: string;
    retrySourceBatchId?: string;
    dormant?: boolean;
}
export interface AudioGenerationBatchItem extends AudioRow {
    batchId: string;
    chapterId: string;
    segmentId: string;
    order: number;
    included: boolean;
    state: "draft" | "queued" | "linked" | "cancelled";
    snapshot: AudioBatchSnapshot;
    intentId: string;
    jobId?: string;
}
export type AudioBatchItemState = "draft" | "queued" | "submitting" | "pending" | "saved" | "failed" | "uncertain" | "cancelled" | "recovery" | "unavailable";
export function audioBatchItemState(item: AudioGenerationBatchItem, job?: AudioGenerationJob): AudioBatchItemState {
    if (item.state === "cancelled") return "cancelled";
    if (!job) {
        if (item.jobId) return "unavailable";
        return item.state === "draft" ? "draft" : "queued";
    }
    switch (job.status) {
        case "prepared": return "queued";
        case "submitting": return "submitting";
        case "uncertain": return "uncertain";
        case "submitted":
        case "running": return "pending";
        case "remote-completed":
        case "downloading":
        case "target-conflict": return "recovery";
        case "failed": return job.source.kind === "batch" && !job.failureStage ? "uncertain" : "failed";
        case "saved": return job.results.length > 0 && job.results.every(result => !result.deleted && !!result.takeId && !!result.mediaId) ? "saved" : "unavailable";
    }
}
