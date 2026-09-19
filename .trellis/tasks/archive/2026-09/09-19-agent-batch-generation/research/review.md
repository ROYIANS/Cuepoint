# Independent batch-generation review

Date: 2026-09-19. Reviewer: dispatched `trellis-check` agent. Reviewed the active PRD, design, implementation plan, check manifest, changed product source and tests. No nested agents, paid provider calls, dependency installation or commits.

## Findings (fixed)

### Stop dispatch when persistence itself fails

- File: `src/lib/agent/generationBatchRuntime.ts:34`.
- Reproduction: confirm four candidates; allow provider acceptance; inject failures in job submitted/unknown writes and batch pause writes. Before the fix, all four paid requests were sent because the durable pause was the only stop condition and its failure was swallowed.
- Fix: retain an in-process dispatch pause flag, check it before claims and the paid transport guard, fail closed when error-classification storage fails, and surface pause/settlement storage errors. Durable submitting intent remains ambiguous and explicit recovery never resubmits it.
- Regression: `tests/agentGenerationBatchSafety.test.ts`, “stops new paid dispatch even when both acceptance and pause persistence fail.” It observes at most the initial two requests and no additional POST on continuation.

### Keep ownership until every started worker settles

- File: `src/lib/agent/generationBatchRuntime.ts:41`.
- Issue: `Promise.all` could reject after one worker's storage failure and release the thread lock while its sibling transport was still in flight.
- Fix: wait for both worker promises with `Promise.allSettled`, then propagate a rejection. The thread lock also remains held through pending user actions and final settlement.
- Regression: hold the second accepted transport, fail pause persistence for the first worker, and verify a competing lock request receives no lock until the held transport resolves.

### Task generation evidence transaction scope

- File: `src/db/agentTaskRecords.ts`, `saveTaskRecord`.
- Issue found during concurrent evidence integration: the old explicit transaction table list excluded generation jobs/batches/media/target tables now read by generation source validation.
- Fix coordinated with the implementation owner: use the complete transaction table scope and test actual saving of a generation-backed task record, current application after switching, foreign task rejection and unavailable media rejection. The implementer made this correction before final gates.

### Additional meaningful regression coverage

The new safety suite also exercises cancellation during accepted polling (unsent candidates cancel, accepted jobs recover by query/download without more POSTs), generic Agent slot-write rejection for batch-owned output, and both APIMart and AIHubMix video candidate paths with exact native duration parameters, local MP4 bytes and explicit clip application. These are mocked provider calls; they do not certify live account availability or full video codec decoding.

## Findings (not fixed)

No unresolved product correctness issue was found within the reviewed source scope after these changes.

- Browser interaction and parent integration acceptance are owned by the main session. The UI owner handled nested Escape; this reviewer did not edit the batch UI or run native browser fixtures. Their evidence must accompany this source/test review before overall acceptance.
- Production build succeeds but retains Vite's large-chunk warning, including the Agent bundle. Bundle splitting is outside this feature's approved scope and was not changed.

## Verified contracts and retention semantics

- Sparse call identity remains distinct from unique batch item identity. Only explicitly confirmed sibling candidates bypass fingerprint deduplication; unknown results block new batch submissions.
- Startup recovery is local and lock-aware. Known remote identities are queried/downloaded on explicit continuation. Missing acceptance identities remain unknown. Provider and storage exceptions never imply authorization for another paid attempt.
- Candidate selection is separate from application. Per-entity transactions validate trusted revisions and the current selection, preserve unrelated fields, update the audit/revision chain, and roll back the entire entity group on storage failure. Generic Agent slot writes and single-job apply cannot bypass batch selection.
- Deletion cascades include batches/items/jobs. Late results cannot resurrect removed records. Inputs, unselected candidate outputs and previous application media are retained while their history records exist. Applied business media survives conversation deletion through normal target ownership.
- Cancelling/discarding a batch resolves its unsent work but retains its historical items and their draft input references. It does not eagerly garbage-collect those inputs. Conversation deletion removes the history references and performs ordinary orphan cleanup. This conservative behavior follows existing proposal-history retention and should be stated explicitly in the specs.
- Batch bookkeeping never proves a business output. Task evidence has a dedicated, ownership-checked generation source. Actual media/slot state distinguishes downloaded output from current application, and active/queued/unknown work blocks completion.
- Project ZIPs keep execution history out. Existing single-generation, task, recovery, business and package suites pass alongside the new batch suites.

## Verification executed by this reviewer

All commands used `/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm`.

- Lint/type-check: **PASS**, `pnpm lint` (`tsc -b --pretty false`), final run begun 2026-09-19 14:57 local command timestamp.
- Full tests: **PASS**, `pnpm test`: **69 files, 839 tests**. Final test run began at 14:57:42 and completed in 7.55 seconds.
- Production build: **PASS**, `pnpm build`; 12,717 modules transformed, completed in 23.31 seconds. Large-chunk warning noted above.
- Whitespace: **PASS**, `git diff --check` after source changes.
- Added safety suite: **6 tests**, all included in the final full-suite count. The existing batch suite adds 15 tests, also included.

Earlier intermediate failures were resolved: stale tool/retention/schema-version expectations, pending UI export and type inference fixes, and the deliberately reproduced queue persistence fault. Final counts above supersede those snapshots.
