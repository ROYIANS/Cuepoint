# Delivery plan

1. Define shared bounded receipt types/parser and tool/entity/operation compatibility; inspect existing result/projection and evidence helpers.
2. Implement business direct-write receipts plus bounded normalized record returns and transaction tests. Independently add supported audio/music receipts through an opt-in library write hook.
3. Project owned saved receipts into compact process-adjacent UI, retaining original call navigation and no receipt=no evidence semantics.
4. Test rollback, replay, stale/foreign scope, unsupported/read/network/failed calls, malicious or oversized metadata, repeated edits, truncation, and both protocol continuation receiving actual receipts.
5. Run focused tests, full Vitest, local pnpm lint/build and whitespace checks. Attempt browser desktop/narrow acceptance without paid calls; report unavailable evidence honestly.
6. Update contracts and validation. Keep task in progress until remaining R2 acceptance is met; do not commit without user request.

Ownership: root owns shared receipt contracts, audio/music adapter hook, pure UI projection/component/tests and task docs. Implement sub-agent owns businessTools.ts plus its helper/tests only. Independent review follows implementation.

## Second delivery execution
1. Add typed, validated provider-task observations and correct refresh aggregation while preserving locks, download recovery, ownership and no-POST replay.
2. Add shared truthful UI/Agent status projection, source and checked-time metadata; audit ZIP and polling compatibility.
3. Test pending/processing/unknown/query failures, last verified observation, partial sibling results, completed-with-download-failure, recovery and legacy records.
4. Review, run full tests/typecheck/build, document missing live/browser evidence, and commit this delivery separately (user authorized batched commits).

## Third delivery execution
1. Implement read-only bounded current audio output inspection and expose it in sound generation tool results.
2. Extend task generation source ownership/validation/listing and wrap-up fingerprints/completion checks to sound jobs; connect existing records source picker.
3. Verify missing/deleted/foreign/empty media, raw responses, valid speech selection/timeline, partial completion, stale summaries, bounded coverage and no network effects.
4. Independent review, focused/full tests, typecheck/build, document actual verification limits and commit this batch under existing user authorization.
