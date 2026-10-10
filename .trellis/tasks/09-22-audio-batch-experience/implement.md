# R3 execution plan

## Current completion — 2026-10-10

The approved implementation and child acceptance are complete; R3 is ready for the parent-controlled archive workflow. [Final acceptance](validation/2026-10-10-final-acceptance.md) maps AC4/6/7/8/9 to independent review, focused regressions, current full gates, native mixed outcomes/reload/retry and real-model/MiMo evidence. [Native acceptance](acceptance/2026-10-10-native-acceptance.md) preserves all four explicit requests for the tenth fixture line and both HMR interruptions instead of describing them as a single lifetime POST. The original nine saved outputs stay unchanged; unknown submissions are not automatically replayed.

Independent review closed the lock-acquisition control window, strict bounded retry provenance, listening-verification wording and complete frozen clone/settings disclosure. The dedicated [audio batch/arrangement spec](../../../../spec/frontend/audio-batch-arrangement.md) now states the bounded existing clone-reference hashing exception, resolving the earlier generic image/video specification discrepancy. v24 migration and reference-scan regressions were repaired without rewriting immutable historical controls.

Final main-session gates: quality PASS with reviewed allowances/warnings retained; 180 test files / 3221 passed + 1 skipped; quality self-test 88 cases; final TypeScript PASS; production build PASS in 24.25 seconds; model-bank snapshot verification 197 files / 85 providers / 1855 models. Detailed logs, limits and source evidence are linked from final acceptance. No new implementation or gate run is performed by this completion documentation update.

## Original approved execution sequence

Steps 1–8 below record the implementation/validation plan that has been carried out. Commit/task-state/archive actions are coordinated separately by the parent; this document does not perform them. Earlier implementation handoffs remain historical checkpoint records.

1. Re-read PRD/design/research/specs and current R1/R2 contracts. Confirm next available Dexie version and file ownership; record a source change boundary.
2. Implement audio batch/item domain, tables, scoped repository, frozen review/CAS, stable intents, cancellation and failed-only draft derivation.
3. Extend typed job source and submit guard while preserving individual Agent/manual behavior. Implement two-worker dispatcher, exclusive lock, pause latch, all-settled drain, reload reconciliation and explicit resume/local recovery.
4. Add atomic nonpaid preparation/read tools, schema/skill/offer registration and source evidence integration. Confirmation remains an actual user-controlled review action.
5. Add shared compact batch review/progress UI in the chapter workspace and Agent, keyboard/focus/error handling and 390 px layout.
6. Integrate cascade, media retention, historical ZIP remapping/dormancy and late-result guards.
7. Run meaningful repository/runtime tests: limits and snapshots; exact 9 saved/1 failed/1 pending; two-worker bound; replay/reload zero POST; stale configuration; pause-write failure and sibling draining; uncertain no retry; failed-only new approval; source/selection/placement distinctions; deletion and ZIP.
8. Independent Trellis review, spec sync, root full quality/test/model/build gates and native desktop/narrow scenarios. Controlled real-model and supplier sample acceptance must be recorded separately from deterministic fixtures.
9. Parent-controlled closeout: preserve original evidence, update integrated progress, and perform the accepted increment's commit/task-state/archive workflow. Development and acceptance are complete; this final workflow action is not performed by this reviewer.

Commands use `/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm`: targeted `exec vitest run ... --maxWorkers=4`, `lint`, then `quality`, `quality:self-test`, full `exec vitest run --maxWorkers=4`, `model-bank:verify`, `build`. Avoid overlapping full gates with other workers. Review current source hashes and generated route-only changes before committing.

Planning approval: 2026-10-10 — user replied “批准，按这套设计实现” to the latest R3/R4 summary.
