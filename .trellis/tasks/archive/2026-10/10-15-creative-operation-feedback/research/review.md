# E05 independent full-scope review

Reviewed the task `check.jsonl`, PRD/design/implementation plan, source investigation, both final implementation notes and the canonical [Creative Operation Feedback](../../../spec/frontend/creative-operation-feedback.md) contract, with the applicable storage, hooks, interaction, material and quality guidelines. The quality guide remainder was read beyond the injection-size boundary.

The frozen scope is all seven changed production sources, three new regression suites, the extended page-parity test, new private-hook ownership registration and native presence-suite discovery. Root owns specs/task/epic/Git; future E06/E16 research is excluded. Exact product/test/configuration hashes and architecture input identity are in [review-scope.md](./review-scope.md).

## Findings (fixed)

No scoped defects found; no product or test fix was needed during independent review.

## Findings (not fixed)

No unresolved scoped defect, missing discovery touch point or new design decision was found. The scoped linter reports 21 visible nonblocking complexity/cognitive-complexity/nested-ternary warnings in the collection pages. These were reviewed in context; some local recovery presentation adds conditions to existing pages. No blanket suppression, type bypass or unrelated warning refactor was introduced. The new hook, presence query and importer have no lint warnings.

## Actual-path conclusions

- **Both asset UI owners:** Project World and Studio collection callbacks enter the same feature-private hook. It acquires a synchronous owner/kind lock before the first await and sets the existing action pending immediately. Commands receive the captured owner/kind/target. The current-owner identity blocks old completion navigation, while per-owner state preserves an acknowledged receipt for later explicit opening. A second create gesture cannot call add while the command/navigation is pending.
- **Receipt versus opening:** Acknowledged create ID is retained separately from opening its editor. A failed/skipped open offers an action that navigates to the same returned ID without another add. Known failures remain locally retryable; typed unknown creation quarantines that owner/kind intent. There is no name/time/count inference or query-triggered replay.
- **Deletion and inspection:** Both actual Radix Actions prevent default dismissal, retain the target while pending, disable duplicate controls and close on command acknowledgement. Known failure retains the exact target. Unknown deletion stays quarantined by owner/kind/ID after recovery dismissal and reopening. `readAssetPresence` performs an exact-table readonly transaction, checks owner identity and preserves supplied transaction context. Missing may close the absent target surface, while the quarantine remains; present, foreign or failed reads never permit another destructive call. Old owner completion only changes its captured owner state.
- **Serial importer:** The existing mounted dialog session owns one synchronous admission lock and frozen batch scope/file queue. Completed count advances and the head is removed only after the file command acknowledges. Stop sets a synchronous ref and prevents the next admission after the current outcome settles. Stable total and confirmed predecessors survive stop, explicit continuation and known failure. Typed unknown head freezes it and the later queue, including controlled hide/reopen and attempted file replacement, without skip/retry or whole-batch success.
- **Visibility and departure:** MaterialLibraryPage retains the importer and changes its controlled visibility. Unknown inspection hides presentation while retaining queue/uncertainty and the original route/unload draft guard; ordinary discard/completion resets the session. `MaterialControls.tsx` has no diff, so there is no second guard owner. File command failures and synchronous opening/closing callback failures are separate; acknowledged imports do not become retryable after a callback error. Actual owning-page destruction prevents later UI callbacks and further admissions after the current acknowledgement.
- **Archive and normal presentation:** The gallery delta is exactly the archive label, preserving the exclusive predicate, search, sorting and cover ownership. Actual cards and pressed-state callbacks are covered. Ordinary successful create/delete uses its resulting navigation/collection/dialog state without a new success notice; import uses one meaningful count/stage/Stop surface. Existing routes and storage command bodies are unchanged.
- **Discovery:** `useAssetOperations.ts` is registered as private to `features/library` before architecture verification. `e05AssetPresence.test.ts` is in future native `business` discovery because it exercises the actual store/backend. This configuration does not claim native execution. The DOM suites mock command acknowledgements and need no additional native entry.

## Verification

All pnpm commands used `/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm` explicitly.

- **TypeCheck: pass.** Independent checker ran `exec tsc -p tsconfig.app.json --noEmit --pretty false` after final source freeze: exit0, no diagnostics.
- **Lint: pass.** Independent checker ran direct ESLint on all seven changed production sources: exit0, **0 errors / 21 visible warnings**. New `useAssetOperations.ts`, `queries/assetLibrary.ts` and `MaterialImportDialog.tsx` have no diagnostics. Tests are outside the current source ESLint scope and are not claimed as linted.
- **Tests: pass; unchanged final worker evidence reused.** Asset worker ran `e05AssetOperations`, `e05AssetPresence` and existing feature `assetLibrary` tests: **3 files / 22 tests passed** before its final added read-failure regression. The unchanged interaction suite contains 16 cases and helper suite 2; the final presence suite was rerun separately with **5/5 passed** after the read-failure addition. These are the actual run results, not an invented final aggregate. See [implementation-assets.md](./implementation-assets.md).
- **Import/gallery tests: pass; unchanged final worker evidence reused.** `e05MaterialImport` and `sharedVideoPageParity`: **2 files / 37 tests passed**, comprising 7 import DOM cases and 30 page-parity cases. See [implementation-import.md](./implementation-import.md). No test or production source changed during this review, so these suites were not repeated without a new failure or integration concern.
- **Architecture: pass, executed once after complete final source/test/discovery freeze.** `/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/node tooling/quality-check.mjs --only architecture --report /tmp/e05-review-architecture.json`: **645 source files, 2565 static value edges, 11 literal dynamic edges, 0 static cycles, 0 failures**; exit0. This is architecture-only verification, not a root quality wrapper or full acceptance run.
- **Whitespace: pass.** `git diff --check`: exit0.

## Limits and final freeze

The actual DOM/held-acknowledgement tests establish the exercised interaction callbacks, immediate pending state, retained Radix dialog and queue ownership. The presence suite establishes real readonly ProductStore/backend behavior. Neither is a claim about physical browser paint, native unknown-commit acceptance, filesystem parsing latency or paid providers. Mounted recovery is not a durable outbox: unknown internally allocated create/import IDs cannot be automatically reconciled or replayed; confirmed writes remain under the unchanged command transaction contracts.

No broad suite, root test/lint/quality wrapper, build, package, native/live-paid acceptance, install, commit, archive or push ran during this independent review. Broader acceptance stays at the user's batch boundary. All scoped product/test/ownership/discovery inputs are frozen and ready for root's final records and commit.
