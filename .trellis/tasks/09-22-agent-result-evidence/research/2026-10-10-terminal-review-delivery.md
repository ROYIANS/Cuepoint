# Bounded terminal review delivery — 2026-10-10

## Implemented boundary

The explicitly approved smart-mode execution finishing checkpoint now covers no-plan and inherited-plan final replies once, preserving existing current-plan call validation when such a call exists. It still rejects failed/rejected/unsettled/foreign calls, respects the current 32-request segment allowance, retains public candidate activity and the complete validated Responses envelope, and offers no forced tool choice or replay.

A separate durable final-review record reserves at most one remaining model request atomically. It uses the frozen model/connector/protocol/effort with zero tools and a fresh bounded data-only input. The record is saved before dispatch; reload and explicit continuation never repeat it. The original text/reasoning and tool/approval records are preserved. Budget/content/context skips, invalid source/span/schema/transport, Stop, timeout, interruption and evidence changes remain explicitly unverified. Successful final Responses envelopes have their own idempotent checkpoint even after the review marker was already consumed.

The model extracts exact UTF-16 original spans and references drawn only from the provided set. General consistency remains a model judgment. Code can verify only narrow explicit historical-write/current-output predicates; this does not certify the meaning of the surrounding sentence. Missing observations stay unknown. Invalid/unavailable output rows do not become negative selected/placement proof.

Evidence input contains a whitelist of committed direct-write receipts and verified current single image/video or individual sound outputs. No raw parameters, result JSON, titles, job errors, credentials or secret reasoning enter the evidence input. Sound source ownership preserves the original approved submitting call and run, including an omitted contextual projectId. R3 batch sounds require original atomic preparation identity plus separately durable batch confirmation and exact item/job/input/connector/intent linkage; preparing a draft alone proves no generated output. Picture batch sources remain explicitly outside the stated coverage.

Compact process-adjacent disclosure shows checking/checked with bounded observations/unverified. Original prose remains intact. Claims link back to actual activity calls. Copy identifies observations as snapshots at check time, distinguishes model assessment and code predicate results, and disclaims unobserved audition/batch completion.

## Checks performed

- Explicit local pnpm `exec vitest run tests/agentFinalReview.test.ts tests/agentFinishingCheck.test.ts tests/agentFinishingCheckPrompt.test.ts tests/e07TypedBoundariesFinishing.test.ts --maxWorkers=4`: **4 files / 102 tests passed**.
- Local pnpm `lint`: passed repeatedly before concurrent R3 additions. Latest integrated run found only the R3 `rows` inference error and a batch-owner callback narrowing error in terminal code; the latter was fixed. The R3 owner was notified. Independent integrated TypeScript gate remains required.
- Initial broad intermediate suite and old fixture inventory are recorded in `2026-10-10-terminal-fixture-followup.md`; not acceptance. No second full run has been performed.
- No live provider, paid generation, microphone, desktop/narrow browser check, install, commit or archive was performed by this implementer.

## Independent check handoff

Review `db/agentFinalReview.ts`, `lib/agent/{finalReview,finalReviewEvidence,runFinalReview}.ts`, `domain/agentFinalReview.ts`, `AgentFinalReviewStatus.tsx` and the small existing runtime/domain/recovery changes. Update legacy runtime fixtures against actual new finishing/review behavior; do not bypass the approved rules. Add batch-source observation negative/positive integration tests once R3 stabilizes. Inspect narrow UI and lifecycle disclosure with real local provider fixtures.

`runChat.ts` tool execution/preparation/validation catches were intentionally left unchanged. Root/check should integrate R1 `serializeToolFailure(cause, certainty)` and preserved `AtomicToolRollbackError.cause`; the terminal branch currently only adds `reviewFinalReply(...)` followed by the existing controller Stop guard before normal completion.

Remaining limitations are explicit: model claim extraction may omit claims or misinterpret prose; only bounded structural predicates receive code checks; file metadata is not decoded/listened to; observations are historical snapshots once published; picture batch output evidence is not in this increment; real-model and full browser acceptance remain separate gates.
