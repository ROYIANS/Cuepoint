# D01 implementation handoff — 2026-10-08

D01 implements the three remaining value-edge cuts from committed C, baseline `f062d694e61da6bcb574f7fb548803b9e54197eb`. Implementation is ready for main's final static/AST refresh and independent review. This report does not close AR-04/PD-04. The original findings concern structural debt; neither the audit nor this change establishes an initialization/TDZ crash.

## Scope and current behavior

Twelve source paths changed: the six planned owners (`db/agentGenerationBatches`, `agentTaskRecords`, `agentTasks`, `agentTools`, `lib/agent/generationRuntime`, `toolLoading`), four new leaves, and two proven immediate DB callers (`db/agentProjectCreation`, `agentFinishingCheck`). The latter two changes are import-only. Two new test paths are `tests/d01DependencyBoundaries.test.ts` and `tests/fixtures/d01/harness.ts`. The snapshot covers all 14 product paths plus the new task-owned native runner (15 changed paths total), and separately records unchanged C01 runner/fixture/helper hashes. All exact before/after SHA-256 maps, command arguments, logs and attribution are in [D01-implement-snapshot.json](../reviews/D01-implement-snapshot.json). Existing before hashes match baseline Git content; new paths are null. Comparison with the complete entry map found no other product changes.

| Remaining value edge | Actual new owner |
| --- | --- |
| `agentGenerationBatches -> generationRuntime` | `lib/agent/generationPreparation` for snapshot/input preparation and connector validation; `db/agentGenerationTarget` for current target reads |
| `agentTaskRecords -> agentTasks` | `db/agentTaskGuards`; task commands also import this guard directly |
| `agentTools -> toolLoading` | `domain/agentToolSelection`; project creation and finishing-check DB consumers also import this leaf directly |

`agentToolSelection` retains the exact selector functions and discovery/limit constants with only type imports. `toolLoading` keeps catalogue/schema/discovery execution/envelope refresh and re-exports selectors/constants for actual `runChat`, UI and existing test consumers. The moved generation helpers and edit guard had no remaining external callers needing old-entry compatibility exports; their command/runtime owners import the leaves for local use.

`agentGenerationTarget` preserves project/studio, entity-owner, shot/episode, required-slot, empty asset-slot fallback, revision and label behavior. Its small entity-kind dispatch and episode guard replace inherited nested ternaries; indexing narrows without the old cast/non-null assertion. Explicit `case "style"` shares the original default fallback for unknown runtime kinds. It opens no transaction. `generationPreparation` retains draft flush, connector/profile/schema validation, short read-only target/media snapshot, then Blob hashing and model-specific image dimension checks outside that snapshot and all writes. Generic owned-media validation and APIMart reference validation are small semantic helpers; original error messages, output shape, fingerprint, input-byte limits and check order remain.

Paid submit/poll/download, same-call recovery, ownership and application orchestration stay in `generationRuntime`. Batch ownership, atomic command/ledger writes, confirmation rechecks, sibling application/revision/history and two-worker coordination remain in existing owners. The task guard's original read-only behavior is unchanged. C evidence/media/provenance, bounded-response, draft and history contracts are retained. No schema migration, registry, dynamic import, transport-policy change or paid call was introduced.

## Final verification

The final command is the exact 25-file argument list in the snapshot, invoked with explicit local pnpm and `--maxWorkers 1`. It passed **25 files / 490 tests**, with unchanged assertions and default timeouts. These are disjoint counts from the one final run, not a sum of repeated attempts:

| Coverage | Files | Tests |
| --- | ---: | ---: |
| Tools/loading/offers/approvals, project creation, finishing check and audio loading | 8 | 150 |
| Generation/review/recovery/batch/safety/preparation recovery | 7 | 90 |
| Tasks/orchestration/wrap-up/audit and audio evidence/recovery | 8 | 166 |
| Existing C01 picture/video generation evidence | 1 | 81 |
| New D01 boundary regressions | 1 | 3 |
| **Total** | **25** | **490** |

Evidence: [D01-final-regressions.log](../reviews/D01-final-regressions.log). Existing coverage includes both protocols, frozen offers, same-step rejection, approval/reload/rejection, atomic rollback, generation confirmation, no resubmission, batch workers/cancel, task records and wrap-up freshness. New tests execute real entry commands with locally seeded media/jobs and directly use the leaves: selector-to-ledger offers, task/record preparation guards, single and batch preparation/application hashing/flush boundaries, current target reads and rollback.

`/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm lint` passed TypeScript: [D01-typescript-final.log](../reviews/D01-typescript-final.log). The restored ESLint toolchain reports **zero diagnostics in all four new leaves**: [D01-new-leaves-eslint.json](../reviews/D01-new-leaves-eslint.json). Scoped diagnostics in existing owners remain 7 errors / 25 warnings: [D01-changed-source-eslint-final.json](../reviews/D01-changed-source-eslint-final.json). Their flagged logic was not changed; do not infer whole-project debt closure from the clean leaves. Main owns the final baseline/current comparison using separate complete source programs and the same restored tool versions. The invalid earlier same-program 101-to-8 comparison is not acceptance evidence and no reduction claim is based on it.

Main's AST checkpoint at [D01-current-ast-summary.json](D01-current-ast-summary.json) reports 383 source files / 2253 edges / zero parse errors / zero value SCCs, versus the committed entry's 379 files / 2233 edges / three value SCCs. This checkpoint precedes final reader/preparation cleanup. Main must refresh final AST/static results against the attached source hashes; implementation does not overwrite the audit tools or claim independent acceptance.

## Native IndexedDB evidence and async reader lifetime

Both native runners used the supplied installed Playwright and Chromium paths, explicit local pnpm, and no installs. Actual results:

- Existing `scripts/c01-browser-regression.mjs`: **6 checks, 160 generation records, 161 calls, rejected-provenance publication refused, zero external requests**. [D01-native-c01.log](../reviews/D01-native-c01.log).
- Supplementary [D01-native-regression.mjs](../reviews/D01-native-regression.mjs): single generation **3 Blob hashes / 3 draft flushes**, batch generation **4 hashes / 3 flushes**, each observed outside Dexie transactions; **2 blocked manual commands** and guard recovery; **zero external requests**. [D01-native-boundaries.log](../reviews/D01-native-boundaries.log).

The supplementary native run explicitly exercises the additional async `readTargetEntity` await inside actual write orchestration. `tests/fixtures/d01/harness.ts:100` calls `applyAgentGeneration`: its `executeAtomicTool` rw callback reads the target, invokes nested `setShotSlot`, updates the job and commits the result ledger. Lines 101–102 assert the stored slot and completed ledger. Lines 113–121 confirm a real batch, claim a local fixture job, select its downloaded result and call `applyBatchSelections`; its grouped rw transaction reads targets before nested slot writes, updates job status and records application history/entity revisions, then returns the successful outcome and matching current slot. A PrematureCommit or failed nested write would fail these native assertions. Lines 126–130 additionally read an uncommitted shot change through the leaf in an outer rw transaction and force rollback; the original pending draft is checked after execution. No copied algorithm or microtask mock stands in for these paths.

Fixture download results are seeded through real repository commands, rather than paid transport. Native evidence establishes these exercised transaction/ownership/application paths, not media decoding, playback, creative quality, external providers or full product UI/inspector scheduling. Existing C01 is the scoped native fixture, not an unmodified full-app E2E.

## Preserved attempts and handoff boundary

[D01-regressions-concurrent-timeout.log](../reviews/D01-regressions-concurrent-timeout.log) preserves a repeat with 489 passes and one existing 32-request `agentTools` test exceeding its unchanged 5000ms timeout while native/static work was also running. That timing observation does not establish causation. A four-worker repeat passed, then the final single-worker repeat passed all 490 against unchanged source; neither repeat adds unique tests. The initial unused-import typecheck failure, missing explicit style-case diagnostic and a supplementary browser invocation using an incorrect executable path are preserved in the snapshot's attempt list; all were corrected before final handoff without dependency installation, timeout change or lint suppression.

Only assigned product changes and this role's research/review artifacts were written. Other concurrent metadata edits were preserved. No specs, ledger, task statuses, commits or archives were changed by this role; D02–D08 and E remain pending. Main must match current hashes, refresh final static/AST evidence and obtain independent acceptance before closing the two D01 findings.
