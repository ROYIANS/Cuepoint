# Batch media generation and result selection

Status: implementation and verification complete, 2026-09-19. Task remains in progress pending approved work commits and archival. See validation/quality.md.

## Goal
Review and edit multiple target-bound image/video requests together, track real results, compare candidates and choose what is applied. Preserve partial success and recover after interruption without duplicate paid submissions or overwriting manual work.

## Ordering
Start after 09-19-agent-reference-intake is accepted. Parent: 09-19-agent-workflow-memory. This dependency is documented; parent-child links alone do not enforce it.

The reference-intake prerequisite is complete and archived. Reuse this existing child. The parent still owns the final cross-child integration acceptance.

## Confirmed implementation foundations
- Individual requests already support editable configuration review, explicit paid confirmation, durable job identity, local result storage and guarded application.
- The Agent executes approved tool calls sequentially, and a generation call waits for its own monitoring/download cycle. Multiple calls are not yet a concurrent batch queue.
- Each existing image request explicitly uses one output. Active identical fingerprints are blocked, and target conflict checks cover the complete entity. Multiple intentional candidates and multiple slots on one entity therefore require explicit batch contracts.
- The inspected Agent review/runtime exposes a fee warning, not an account balance or executable price quote. Batch planning cannot assume an exact spending estimate.
- Source evidence and technical implications are recorded in `research/existing-generation.md`.

## Requirements
- R1: AI drafts multiple target-bound configurations; user can adjust selected items before submission.
- R2: Reuse durable per-job identity, explicit paid confirmation and unknown-outcome guards; preserve partial success.
- R3: Show per-item status and compare actual results before applying to target slots.
- R4: Queued-work cancellation must distinguish unsent requests from remotely accepted jobs.
- R5: Confirmed by the user on 2026-09-19: support multiple targets, default to one candidate per target slot and allow an explicit increase to at most four. Candidates are compared within their target group and selected before application. Each candidate counts as an independent paid generation request, including candidates with identical parameters.
- R6: Confirmed by the user on 2026-09-19: at most 20 candidate requests per batch, with at most two active items simultaneously. Count candidates, not targets; five targets with four candidates fill one batch. These are local limits, not provider account-capacity claims.
- R7: Drafts share one project or studio owner. Users may edit per-candidate connector/model/prompt/supported parameters, duplicate up to the candidate cap, remove/deselect items and save edits across reload. Target/input identities remain fixed. One explicit confirmation freezes the selected requests and shows the exact request count, providers/models and fee notice; no exact monetary quote is available. No upload or generation POST happens while drafting, including in full-access mode.
- R8: Known failure permits independent queued work to continue. Unknown acceptance pauses new batch dispatch while known jobs can still be queried/downloaded and saved outputs remain usable. Reload/navigation/close never triggers automatic network resubmission. Pause retains unsent items; cancel remaining prevents their dispatch and never claims remote cancellation/refund. Definitively failed items can seed a fresh draft requiring new paid confirmation; unknown items cannot be retried.
- R9: Selection is separate from application and remains available after later conversation turns. Explicitly apply a downloaded candidate to its original slot, preserving all unrelated content. Keep unselected outputs. Permit switching among downloaded candidates only while the target is unchanged except for this batch's recorded user-approved result writes; external edits/deletion block overwrite. Same-entity sibling slots must not conflict with their own proven writes. Show individual outcomes for partially conflicting targets.
- R10: Batch provenance, ownership locks, deletion guards, media retention and task evidence cover all new records. Draft creation is not generation success; downloaded media differs from current application. Queued/active/unknown work blocks task completion; discarded drafts/cancelled-unsent items can be reviewed as resolved. Execution history stays outside project ZIPs; selected business outputs follow existing export behavior.
- R11: Use the existing dark, flat Agent interface: persistent compact progress plus an expanded review/comparison surface, labelled keyboard controls, touch-visible actions, full-media inspection and 390px layout. Retain edits on save/read errors. No empty placeholder strips or nested bordered containers.

## Acceptance
- AC1: A multi-target batch allows item-level edits, confirmation, partial completion and result application.
- AC2: Reload/stop/retry never duplicates accepted paid jobs or overwrites changed targets.
- AC3: Comparison and selection remain usable on desktop/mobile without nested card clutter.
- AC4: A target with four explicitly requested candidates produces four separately tracked requests, with at most one submission per authorized candidate attempt. Reload/recovery does not create additional candidates; unselected downloaded outputs remain available.
- AC5: A 20-item batch is accepted; 21 selected items or five candidates for one target are rejected. Holding provider responses demonstrates no more than two active items. Draft edits survive database reopen and group confirmation commits all selected snapshots or none (R5–R7).
- AC6: Partial success/known failure preserves results and permits independent queued work; unknown acceptance stops new dispatch. Pause/cancel/refresh/competing tabs do not duplicate POSTs. Existing accepted jobs recover by query/download; a fresh paid retry requires a fresh reviewed draft (R2,R4,R8).
- AC7: Apply sibling slots, switch A→B→A and repeat an already completed apply without unwanted changes. Manual edits/deletion cause visible conflicts; all candidate media remains retained. Actual slot state controls current application evidence (R3,R9,R10).
- AC8: Deletion during upload/download causes no resurrection; selected media survives conversation deletion. Queue state blocks task completion honestly. Both existing single-job behavior and Chat/Responses protocol envelopes remain valid. Desktop/mobile native-browser fixtures exercise the actual controls with mocked providers (R10,R11).

## Planning state
Source inspection covers submission/recovery, review, selection, media retention and task evidence. User-approved numeric limits are in R5/R6; the integrated behavior in R7–R11 is presented together in the final planning summary. `design.md`, `implement.md` and both curated context manifests accompany this PRD. No product code, task activation or provider requests occurred during planning. Final review is approved; implementation is now authorized.

## Boundaries
Follow parent provenance, user-control, pure-frontend and visual-quality contracts. No new provider/model capabilities, automatic paid retries, price/balance integration, remote cancellation promises, server/background scheduler, cross-project batches, automatic generation dependency graph, AI auto-selection/application, general editor redesign or hypothetical legacy backfill. Unknown acceptance remains a manual provider-reconciliation boundary; do not invent an account-history API or erase uncertainty by dismissal. Parent cross-child acceptance is separately verified before declaring the overall roadmap complete.

## Acceptance evidence

AC1–AC8 passed the final source/tests/native-browser gates recorded in `validation/quality.md`. Independent review found and fixed storage-fault dispatch and lock-drain defects. No paid service calls were made. Final work commits and archival are pending the workflow commit-plan approval.
