# Bug Analysis: task inspector transaction committed too early

## 1. Root Cause Category

- **D / E — browser coverage gap and implicit async-zone assumption.** Opening the task
  inspector mounts the wrap-up view even when its tab is hidden. `getTaskWrapupState`
  collects a consistent evidence snapshot in an IndexedDB read transaction. Repeated
  entity locators hit `entityIds` and return from the native async function without any
  new DB operation; malformed locators also settle locally. A long sequence of bare
  native awaits loses Dexie's transaction-zone tracking and produces PrematureCommit.
- Initial hypotheses: evidence traversal (50%), concurrent memory reads (30%), other
  non-IDB waits in the open path (20%). Source inspection found no network/timer awaits
  there. Disposable Edge reproduced the exact error with both repeated and malformed
  locators at 150/500 calls; 1/10/50 worked. Distinct IDs doing real DB reads worked up
  to 500. This discriminates the await shape from the new memory query and data volume.
- Official guidance: https://dexie.org/docs/DexieErrors/Dexie.PrematureCommitError
  requires transaction-compatible Promise adoption and avoiding bare locally settled
  awaits in loops. `Promise.resolve(entity(...))` adopts through Dexie's patched global
  Promise while preserving the existing read transaction and missing-source semantics.

## 2. Why Previous Verification Missed It

Prior browser fixtures used few tool records; fake-indexeddb unit tests do not reproduce
this native browser Promise/IndexedDB lifetime behavior. Passing the complete suite was
insufficient evidence for long, repeated, already-settled async paths.

## 3. Prevention Mechanisms

| Priority | Mechanism | Action | Status |
| --- | --- | --- | --- |
| P0 | Transaction contract | Adopt both evidence entity awaits with the current Promise | Done |
| P0 | Real browser regression | 15 traversal cases, counts 1–500, repeated/invalid/distinct locators | Done |
| P0 | UI isolation | Catch query errors locally; retain last snapshot and unsaved draft; disable writes until successful reread | Done |
| P1 | Correctness test | 181 source calls, one entity projection, unavailable source and full stale fingerprint | Done |
| P1 | Knowledge | Add contract and native-browser test requirement to task-wrapup spec | Done |

## 4. Systematic Expansion

The entity helper is shared by ordinary tool-result traversal and generation target
traversal, so both call sites require the fix. Snapshot collection is also used by
manual/AI summary save, confirm and completion: fix the shared boundary rather than
catching PrematureCommit and returning incomplete evidence or weakening atomicity.
No source-count reduction, timer-based keepalive, database reset or execution replay.
TaskWrapup query failures must not escape through React's error boundary and unmount
its editor. Recovery is user-triggered reread, not a hidden model retry.

## 5. Knowledge Capture

- Updated `.trellis/spec/frontend/agent-task-wrapup.md`.
- Preserved `validation/task-transaction-regression.cjs` as reproducible Edge regression.
- This application has no `src/templates/markdown/spec` mirror to synchronize.
- Spec/code changes remain in the pending grouped work batch; no commit was made without
  the outstanding commit approval. User requested this bug fix while reviewing the batch.
