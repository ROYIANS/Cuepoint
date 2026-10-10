# R3/R4 independent review — 2026-10-10

This review covers the combined audio batch/arrangement implementation, shared repositories, runtime ownership, Agent adapters, evidence readers, dormant package codecs, cascade/retention and UI integration. It does not mark either task accepted or archived. The parent owns the final full suite/build/spec/native/live-provider gates.

## Findings fixed

1. `src/lib/audioGeneration/batchRuntime.ts`: registering a worker before asynchronous Web Lock acquisition did not grant ownership, but `audioBatchUserAction` treated every registered non-closing worker as an authorized mutation host. Added an `ownsLock` latch set only inside the acquired ownership callback. Control actions arriving during acquisition wait for the dispatcher outcome rather than bypassing the lock. A delayed lock refusal regression asserts no control mutation, no cancelled item and no paid request.
2. `src/lib/audioGeneration/batchEvidence.ts`: a missing `sourceCallId` plus any nonempty retry marker previously counted as preparation provenance. The shared task/final-review reader now follows actual retry records, requires the same owner/project/chapter, rejects missing/dormant/cyclic history, and matches the original completed preparation result's batch/project/chapter IDs. Traversal is bounded to 100 records; a longer history is unverified rather than invented evidence. Seven negative cases failed before the fix. Actual approved failed-only retry remains valid, and a separate acyclic excessive-depth case is rejected.
3. `src/lib/agent/audioBatchTools.ts`: replaced the stronger `auditioned: false` claim with `auditionVerification: "not_checked"`, explaining that this operation did not verify listening and cannot establish whether the user listened. Actual prepare/read results are exercised without adding generation requests.
4. `src/components/audio/AudioGenerationBatches.tsx`: the paid confirmation details now show the actual adapter model, preset/design/clone mode, full delivery instructions, text-optimization permission, frozen speaker/connector identities and revisions, clone `referenceMediaId`/byte fingerprint, and complete `snapshot.input.mimo`. These are snapshot facts; no key or raw audio is displayed. The parent explicitly authorized these two interface/UI refinements before edits.

The first reader implementation added a resolved native async hop and exposed `TransactionInactiveError` on the no-task direct-origin path. The corrected implementation performs direct-origin validation synchronously and returns the actual Dexie promise chain for retry reads. Existing assertions were retained; both task and no-task consistent read transactions pass.

Changed product files: `src/lib/audioGeneration/batchRuntime.ts`, `src/lib/audioGeneration/batchEvidence.ts`, `src/lib/agent/audioBatchTools.ts`, `src/components/audio/AudioGenerationBatches.tsx`. Changed regression files: `tests/audioGenerationBatch.test.ts`, `tests/audioBatchFinalReview.test.ts`.

## Findings not changed by this reviewer

- Audio clone snapshot validation currently reuses `validateSpeechReference` with `Dexie.waitFor` during batch preparation/confirmation/link transactions. This differs from the generic image/video batch spec's no-Blob-hashing-inside-writes wording. Existing audio reference behavior intentionally preserves the transaction, and no failure was observed. Moving byte preparation outside the write transaction requires an implementation-boundary decision; the parent should explicitly reconcile the audio contract during spec synchronization.

## Verified paths and limits

- One reviewed batch owns 1–20 exact segment identities; concurrency is two; unknown/preflight/local recovery are excluded from definite-provider paid retry. Pause latches before persistence and drains siblings/control writes before releasing ownership. Reload reconciliation does not enter the paid dispatcher.
- The existing seven-second workspace polling uses the same per-job Web Lock as submission. A queued refresh rereads the job after submission settles; source inspection does not support attributing the parent's recorded HMR interruptions to polling.
- The common provenance reader is consumed by task output sources and final reply review. Current output verification keeps saved/selected/valid placement separate. All durable batch/item progress enters task wrap-up freshness.
- Arrangement selection and placement use distinct previews/approvals; whole-chapter CAS rejects stale state; membership writes preserve untouched rows and revisions; replay does not resurrect deleted/undone additions. Group undo/redo preserves stable IDs and rejects subsequent conflicting edits. Agent receipts cover actual selected-segment or created/deleted-clip effects.
- v24, transaction scopes, cascade, media retention and explicit dormant ZIP remapping include the new tables. Imported history cannot approve or dispatch.
- The parent's loopback HTTP log records a maximum of two active requests and its ZIP comparison records exact retained-row preservation and stable redo IDs. These are controlled native fixtures, not paid-vendor, acoustic quality or live-model proof.

## Verification

Commands used the explicit machine pnpm path `/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm`, with no install, paid request, commit, archive or browser action by this reviewer.

- TypeScript: `pnpm lint` (`tsc -b --pretty false`) passed.
- Formal lint: `pnpm quality --only lint --report /tmp/aifenjing-r3-r4-independent-lint.json` passed, zero unallowed failures, 13 existing reviewed allowances and 541 visible review warnings. An earlier run correctly failed its concurrent-input guard while `tests/agentFilmScriptImpact.test.ts` was edited; the stable rerun passed.
- Batch/evidence/final review/catalog: five files / 151 tests passed (`audioGenerationBatch`, `audioBatchFinalReview`, `audioTaskEvidence`, `agentFinalReview`, `d05ToolCatalog`), after the final acyclic depth-case and result-interface refinements.
- Arrangement/history/evidence/foundation: seven files / 69 tests passed (`audioArrangement`, `audioArrangementAgent`, `audioArrangementPackage`, `audioEngineCommands`, `audioFoundation`, `runWriteOutcomes`, `d03AudioCommands`).
- `git diff --check` passed.

Full quality CLI, dependency/cycle/unused evidence, full tests, model-bank, build, spec synchronization, remaining native conflict/Stop/device checks and controlled real-model/vendor acceptance remain with the parent session.

## Final unused-export follow-up

The parent's final quality gate found one new unused exported type, `AudioSelectionItem` in `src/domain/audioArrangement.ts`. Searching `src` and `tests` found only its declaration and the local `AudioArrangementProposal.selections` reference. Removed only the `export` keyword; the type body, exported proposal shape and runtime behavior are unchanged. No unused-export allowance was added.

- TypeScript: the explicit machine pnpm `lint` command passed.
- Focused arrangement regressions: `audioArrangement`, `audioArrangementAgent` and `audioArrangementPackage`, three files / 25 tests passed.
- `git diff --check` passed.
- The parent owns the final unused/whole-quality gate rerun; this follow-up did not repeat the full suite or build.
