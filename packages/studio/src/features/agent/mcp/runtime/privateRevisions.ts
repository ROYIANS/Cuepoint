import type {McpPrivateRevisionRef} from "../../../../platform/runtime/mcp";
import {mcpMutationFingerprint} from "./mutation";
import type {McpCatalogue, McpCatalogueMutation, McpMutationReconciliation} from "../models/connection";

export type McpPrivateCleanupDecision = {readonly status: "quarantined"}
    | {readonly status: "acknowledged"; readonly collect: readonly McpPrivateRevisionRef[]};

/** Pure ownership decision, not a cross-vault/store transaction or deletion command.
 * The native owner must serialize collection with publication and refuse current refs.
 * A conflicting/missing receipt cannot establish that a late native COMMIT rolled back.
 */
export function mcpPrivateCleanupDecision(
    mutation: McpCatalogueMutation,
    outcome: McpMutationReconciliation | {readonly status: "confirmed_rollback"},
    current: McpCatalogue,
): McpPrivateCleanupDecision {
    if (outcome.status === "unresolved" || outcome.status === "conflict") return {status: "quarantined"};
    if (outcome.status === "committed" && outcome.receipt.fingerprint !== mcpMutationFingerprint(mutation)) return {status: "quarantined"};
    let reference = outcome.status === "committed" ? outcome.receipt.retiredPrivateRevision : undefined;
    if (outcome.status === "confirmed_rollback" && mutation.kind === "save") reference = mutation.config.privateRevision;
    const referenced = (ref: McpPrivateRevisionRef) => current.entries.some(({privateRevision}) => privateRevision.kind === ref.kind
        && privateRevision.ownerId === ref.ownerId && privateRevision.revisionId === ref.revisionId);
    return {status: "acknowledged", collect: reference && !referenced(reference) ? [reference] : []};
}
