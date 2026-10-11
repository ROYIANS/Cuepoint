# Independent native grid admission review

Date: 2026-10-12. Reviewer: `grid_context_review`. Exact source, probe, command and evidence hashes are in [grid-context-review.json](grid-context-review.json).

The narrow repair passes independent source and real Rust verification. No additional product defect was found, and this reviewer changed neither production source nor permanent tests. This is not final full-task or packaged-host signoff.

## Findings (fixed)

None. The implementer's existing repair remained byte-identical throughout this review: `src/lib/storage/native.ts` SHA-256 `92f8a8126e2301a02fb4464f1c8921eff3d7317d315e89a636ad25cf0e677e64`; `tests/sharedNativeAdmission.test.ts` SHA-256 `42674ea66f2a1249c56996471d05862e453959e3f81fa70554a56668243d15d2`.

## Findings (not fixed)

- **GCR-DOC-01 — owning specification follow-up.** `.trellis/spec/frontend/shared-product-storage.md` already describes FIFO fairness and explicit nested contexts. The main session should add the new 32-reader per-driver ceiling, unchanged native 64-context guard, and cancellation of still-queued disposed observations before native begin. Already admitted work retains existing guarded settlement and late-publication suppression. This is documentation owned by the coordinating session, outside the assigned source/test delta; it is not an unresolved product defect.
- **GCR-HOST-01 — actual host gate remains.** The original actual packaged grid failure is recorded in `packaged-host-01/grid-mounted.json`. Repeat the 70-material grid → project save → grid route sequence on the rebuilt application containing the reviewed source. Inspect later thumbnails, subsequent writes and reopening. This reviewer has no UI/profile ownership. Real Rust tests establish storage admission behavior, but cannot establish the rebuilt WK application's result.

## Source and causal review

The old driver counted readonly roots but admitted all readers simultaneously. The implementer's preserved [counterexample](grid-context-repair-01/before.log) exercises the actual current Rust bridge: six of seventy compound material-version queries rejected at the unchanged native context guard, and disposed queued observations also consumed native contexts. That evidence reproduces saturation without claiming a persistent context leak or replacing the original host route sequence.

The replacement FIFO admits at most 32 root readers. A queued writer waits for prior readers and runs exclusively; later readers cannot bypass it. An explicit nested `StoreTx` still joins its existing backend in `store.ts`, so it does not acquire another root admission. Admission is released through `finally`, including failures before `begin` returns, callback failures, readonly validation failures, confirmed commit settlement and unknown commit outcomes. This does not replay callbacks or select another storage owner.

Observer disposal aborts its private queued waiter, removes that waiter from the FIFO, and suppresses late values/errors. Already admitted work settles through existing validation/abort paths. Commit notifications remain postcommit invalidation; subscriber-issued asynchronous reads/writes enqueue and do not block notification delivery while the root writer is held.

## Verification

- **TypeCheck: PASS.** Explicit machine `pnpm lint`, exit 0.
- **Lint/quality: PASS.** Formal `pnpm quality`, exit 0; 0 failures, 12 existing reviewed allowances and 584 visible existing warnings. No allowance or warning suppression was changed.
- **Permanent focused tests: PASS.** Four files / 15 tests covering native admission, native commit certainty, generation preparation uncertainty and shared query lifecycle. Includes the three 70-query bursts, canceled queued observations, reader/writer fairness, snapshot failure, original ledger outcomes, no paid dispatch after uncertain preparation, scope replacement and late-publication suppression.
- **Independent real Rust cases: PASS, 4/4.** [Executable harness and receipt](grid-context-review-01/acceptance.json) use the existing real probe and fresh disposable workspaces. A postcommit subscriber enqueues a read and write after a nested root operation without deadlock; a rejected begin releases admission without invoking its callback; a lost readonly validation acknowledgement releases the reader before the following writer; actual COMMIT plus unavailable status preserves `UnknownCommitError`, releases admission, invokes the original callback once and retains both separately committed rows after reopening.
- The production source, permanent admission test, store/bridge/helper and native probe hashes did not change during independent runtime verification. No Rust build, application profile access, user database access, UI automation, provider request or owner activation occurred.

Raw logs are under `grid-context-review-01/`. The complete browser suite was intentionally not repeated for this narrow check; the main session owns final frozen full gates, specification update, rebuilt host acceptance and normal-owner activation. Windows/Linux host success and task completion are not asserted.
