# E05 asset collection implementation

## Delivered scope

The existing project World and Studio collections now share one feature-private `ui/useAssetOperations.ts`. Existing asset commands, generated identities, transactions, project touch, reference cleanup and orphan-media behavior are unchanged.

- Creation acquires a synchronous owner/kind ref lock before calling the command. The existing button immediately becomes pending. Same-tick duplicate gestures admit one command.
- Command acknowledgement is separated from navigation. The exact returned ID survives failed or skipped opening; the existing action then opens that ID without calling add again. A completion from a departed project/kind cannot navigate the new owner.
- Known failures remain local and retryable. Typed unknown creation quarantines the original owner/kind intent with inspection guidance; no filename/name/time/list-count inference or reserved-ID API was added.
- The actual destructive Radix action prevents default dismissal and retains the target through pending acknowledgement and known failure. Unknown deletion is quarantined by owner/kind/ID even after cancelling and reopening its recovery surface.
- `queries/assetLibrary.ts` adds `AssetKind` and `readAssetPresence({kind, ownerId, id}, store = productDb): Promise<"missing" | "present" | "foreign">`. It uses one exact-table readonly transaction and preserves a supplied transaction. Present/foreign/read failure never authorizes destructive replay. Missing may dismiss the absent target; the local quarantine remains even if a stale card is still rendered.
- Project asset collections filter retained rows by current `projectId` before exposing cards/actions, preventing a held previous-project result from supplying a destructive target.

## Files owned by this worker

- `packages/studio/src/features/library/ui/useAssetOperations.ts` (new private source)
- `packages/studio/src/features/library/ui/AssetLibraryPage.tsx`
- `packages/studio/src/features/library/ui/AssetLibraryPages.tsx`
- `packages/studio/src/features/library/queries/assetLibrary.ts`
- `tests/e05AssetOperations.test.ts` (new actual page/ReactDOM/Radix regression)
- `tests/e05AssetPresence.test.ts` (new actual ProductStore regression)
- This implementation record.

Main owns source ownership registration, native business suite discovery, canonical spec, task state and Git. No worker Git writes. The new hook was created before updating consumers in the running Vite tree.

## Verification

All commands used `/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm`.

1. `exec vitest run tests/e05AssetOperations.test.ts tests/e05AssetPresence.test.ts`: 2 files / 20 tests passed initially.
2. After exact route assertions and the non-nested presence table map, `exec vitest run tests/e05AssetOperations.test.ts tests/e05AssetPresence.test.ts packages/studio/src/features/library/tests/assetLibrary.test.ts`: 3 files / 22 tests passed (2026-10-15 19:03 local).
3. After adding the actual backend read-failure case required by the final spec, `exec vitest run tests/e05AssetPresence.test.ts`: final 5 presence tests passed (19:04). The 16 interaction and 2 existing helper tests were unchanged from step 2.
4. Direct `exec tsc -p tsconfig.app.json --pretty false --incremental false`: passed after final production edits.
5. Scoped ESLint on the four changed production files: zero errors, 13 reviewed warnings. The new hook and presence query have zero diagnostics. Remaining warnings concern existing collection-page complexity and nested JSX conditional presentation; pending/error branches add some local page conditions without changing their ownership.
6. Scoped `git diff --check`: passed.

The actual page harness holds command promises, activates the same button twice in one React tick, and retains the real shared AlertDialog/Radix controls. Studio CoverCard's menu trigger is substituted to invoke its real page callback; project card and destructive confirmation remain actual UI. It covers all four create kinds on both route families, immediate pending, known failure, receipt-only navigation recovery, stale/unmounted completions, foreign retained project rows, both collection deletion lifecycles, and unknown exact-target inspection/dismissal/reopen with no second mutation.

The real-store suite executes four table families, current/foreign/missing identities, actual readonly backend scope, supplied nested transaction context and failed actual backend reads. No native execution was claimed. Existing durable create/delete command bodies were not modified, so their independent cleanup/rollback suites were retained rather than rerunning broad native gates.

## Limits and freeze

Recovery state belongs to the mounted collection; it is not a durable outbox or reload-safe reconciliation protocol. Unknown creation remains deliberately conservative because command IDs are generated internally. Presence establishes only current row existence/ownership, never the original mutation's actor or cascade receipt. No browser pixel/layout, native packaging, paid service, full-suite/build or latency evidence is claimed. Canonical `creative-operation-feedback.md` was read and the final read-failure case synchronized with it. All listed source/test files are frozen for independent review.
