# Generation correctness review

Reviewed 2026-09-19 against task PRD/design, generation runtime/profiles/tool definitions, durable job repository, shared recovery, adapter request shapes and cleanup paths. Review was read-only for product files. The generation and business owners implemented the fixes below while review progressed.

## Concrete findings and disposition

| Finding | Evidence and consequence | Disposition |
| --- | --- | --- |
| G1: Deleted threads left durable jobs and permitted late media writes | The original `deleteChatThread` omitted generation jobs; update/store only checked project existence. A different tab could remove the thread during a download and leave inaccessible retained media/job records. | Fixed by owners: thread deletion now includes generation jobs and orphan-media cleanup in the transaction; job lookup/update/storage require live thread/run ownership. Fixture covers deletion during download. |
| G2: Unexpected multi-task paid success was labeled failed | APIMart n=1 returning several tasks initially produced `failed`, which the fingerprint deduplicator excluded. A new identical call could submit paid work again. | Closed: persist all received IDs, mark unknown, block automatic selection/query/resubmission. Shared recovery now rejects every unknown job despite any first `providerTaskId`; the regression passes. |
| G3: Synchronous Hub completion escaped the submission catch | `return acceptHubTask(...)` without `await` bypassed the surrounding catch on asynchronous decoding/download/storage failures, producing a generic uncertain tool error despite a saved provider identity. | Fixed with `return await`; fixture covers malformed synchronous completion and retained known identity. |
| G4: Known pre-submit failures became unknown network outcomes | Upload/target validation failures before the generation POST saved `failed` but threw pending; recovery had no provider identity and blocked the run as unknown. | Fixed: pre-POST failures use the known rollback error path, and a persisted same-call failed job can be recovered/replayed without POST. Recovery regression verifies this proof independently. |
| G5: New profiles lacked nearby source evidence | Wire fixtures alone cannot prove supported provider parameter combinations. | Fixed with `research/generation-profiles.md`, recording official documentation and native schema URLs, observed versions, verification date and deliberate supported subsets. |

## Verified contracts

- Submission intent is saved before the paid POST. Call-ID uniqueness prevents duplicate submission; unresolved equivalent fingerprints block fresh calls. Replay of a known job queries its saved identity; no automatic provider/model fallback is introduced.
- Generation pending errors share the runtime's `ToolPendingError` contract. Polling is bounded inside the tool controller, parks the run and does not spend model rounds on repeated status requests. Unknown acceptance without proof remains blocked.
- Approval freezes target revision, parameters and SHA-256 input-byte revisions. Reference ownership, kind, nonempty bytes and adapter limits are checked before upload/submit. The target is checked again after uploads before the paid operation.
- Remote completion, local download and target application remain separate states. Local result storage is atomic with its job result; target application is atomic with the successful tool ledger. Changed/missing targets preserve output with a visible conflict instead of recreating targets or overwriting edits.
- Public result downloads do not receive connector Authorization/cookies. Protected AIHubMix downloads reuse the existing scoped downloader. Durable summaries omit credentials, source Blob bytes, inline base64 and transient signed URLs.
- Provider destination changes block recovery. Project/thread deletion cannot recreate removed jobs or accept late output; referenced result media survives while owned by a slot or another retained domain reference.
- The H3 request mapping is valid: `image_with_roles` accepts explicit first/last/reference image roles, and frame/reference modes must stay separate. Verified against the [official APIMart MiniMax H3 contract](https://docs.apimart.ai/en/api-reference/videos/minimax-h3/generation). No mapping defect found.

## Regression additions owned by this review

`tests/agentGenerationRecovery.test.ts` now adds two cases to its existing proof matrix: persisted known failure without a task ID can resume; unknown multi-task acceptance cannot resume even when the first task ID is present. The latter exposed a shared recovery gap which parent corrected. Reviewer reran the complete generation (30), recovery (14) and atomic-tool (14) files together: **58/58 passed**. G1–G5 are closed. Final integrated checks remain with the main session.

## Remaining limits

No live paid generation was used. Fixtures validate native request transformation, durable state changes, local media bytes, recovery and cleanup. Provider acceptance after a browser/network loss before task-ID persistence remains fundamentally uncertain without provider-side idempotency/reconciliation, and the UI must keep this outcome explicit. Local monitoring cancellation does not prove remote cancellation or refund. Long-term memory remains a later Trellis workflow capability, outside this batch.
