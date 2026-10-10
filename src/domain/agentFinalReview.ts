import type {WriteReceiptEntry} from "@/lib/agent/writeReceipt";

export type FinalReviewEvidence =
    | {ref: string; kind: "write"; callId: string; entityKind: WriteReceiptEntry["kind"]; operation: WriteReceiptEntry["operation"]; id: string; ownerId: string; revision?: string | number}
    | {ref: string; kind: "output"; callId: string; jobId: string; resultKey?: string; mediaId?: string; available: boolean; selected?: boolean; placed?: boolean; fingerprint: string};

export interface FinalReviewSnapshot {
    fingerprint: string;
    evidence: FinalReviewEvidence[];
    omitted: number;
    uncoveredWriteCalls: number;
    unresolvedCalls: number;
}

export type FinalReviewPredicate =
    | {type: "historical_write"; ref: string; entityKind: WriteReceiptEntry["kind"]; operation: WriteReceiptEntry["operation"]; id: string; revision?: string | number}
    | {type: "output_available" | "output_selected" | "output_placed"; ref: string; value: boolean};

export interface FinalReviewClaim {
    start: number;
    end: number;
    text: string;
    /** Model judgment only, never certified prose truth. */
    assessment: "consistent" | "contradicted" | "unknown";
    refs: string[];
    predicate?: FinalReviewPredicate;
    predicateResult?: "verified" | "contradicted" | "unknown";
}

export type FinalReviewReason = "budget" | "ineligible" | "content_limit" | "context_limit" | "invalid" | "timeout" | "stopped" | "interrupted" | "stale" | "transport";

export interface AgentFinalReview {
    version: 1;
    status: "pending" | "checked" | "unverified";
    candidateFingerprint: string;
    candidateStep: number;
    step?: number;
    createdAt: string;
    endedAt?: string;
    reason?: FinalReviewReason;
    snapshot: FinalReviewSnapshot;
    claims?: FinalReviewClaim[];
}
