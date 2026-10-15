# E05 serial import and gallery implementation

## Scope and final behavior

Owned production edits:

- `features/library/ui/materials/MaterialImportDialog.tsx`: one serial queue with a synchronous admission lock; captured target/files; stable acknowledged completed/total and current filename; immediate stop-remaining ref checked before each next command. Stop awaits the current result. Acknowledged predecessors leave the queue exactly once; known failure keeps the current head and later files for explicit continuation. The selected target and file set remain locked after admission; completing or explicitly discarding the ordinary batch starts a fresh session. Canceling an empty file-picker selection does not erase a candidate queue.
- Unknown `StorageError.certainty` (including `UnknownCommitError`) freezes the current head and later queue, selection and ordinary continuation. Fixed product guidance offers inspection; it does not reveal operation IDs, claim rollback or resolve by matching filenames. Hiding the dialog preserves its unknown state and denominator. Real route/unload protection remains in the original `useMaterialDraftGuard`.
- `features/library/ui/MaterialLibraryPage.tsx`: keeps the importer mounted and supplies `open={importing}`. Existing import entries change presentation only. This is the parent seam needed to prevent dismissal/reopening from resetting uncertain admission. `MaterialImportDialog.open?: boolean` defaults to true for compatible callers; an empty newly opened session refreshes `initialScope`, while a retained queue cannot be retargeted by a parent filter change. Unknown hiding is reversible and does not discard, so it bypasses the *ordinary dirty-form close prompt* while retaining the same real departure guard. Ordinary dismissal still requires its existing discard confirmation before resetting the queue.
- `features/projects/ui/ProjectGalleryPage.tsx`: changes only the exclusive archive button label from `含已归档项目` to `已归档`; the actual predicate/search/sort/cover ownership is unchanged.

Only all-file acknowledged completion selects the last returned material and closes once. Opening/close callback failures are caught separately from file-command failure, so saved files do not become a retryable import. Current-page destruction suppresses later UI callbacks and stops admitting more files after the current acknowledgement. No new production module, storage schema, command protocol, generic job owner, per-file toast or invented sub-file percentage was introduced. `MaterialControls.tsx` has no final diff.

## Necessary evidence

All commands use `/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm`.

- `exec vitest run tests/e05MaterialImport.test.ts tests/sharedVideoPageParity.test.ts`: **2 files, 37 tests passed** (seven actual import DOM cases plus thirty existing/extended page-parity cases).
- Import tests use actual `MaterialImportDialog`, shared Button/Dialog/Select and Radix DOM, with held mocked *command acknowledgements*. Cases cover same-tick duplicate import; pending close protection; Stop held A, acknowledgement at1/3 with B/C retained and explicit continuation; immutable original scope through parent prop changes; known B rollback retrying only B; both typed unknown variants retaining B/C and1/3 through controlled hide/reopen with the original route/unload guard still dirty; no admission from disabled continuation or a synthetic file-selection event; ordinary discard cancel/confirm and fresh-scope reopening; and opening/closing callback errors after successful import with no replay.
- The gallery extension executes actual ProjectGalleryPage/filter callbacks using the existing deterministic hook host. One active and one archived fixture yields the corresponding actual CoverCard keys and exclusive `aria-pressed` labels in both directions. This is page-callback evidence, not only a source-string assertion or native repository claim.
- `exec tsc -p packages/studio/tsconfig.json --noEmit --pretty false`: passed with no diagnostics after the production behavior and callback-error cases were complete. A subsequent equivalent `selectionLocked` expression hoist reduced repeated UI predicates; root owns the final changed-scope type gate.
- `exec eslint packages/studio/src/features/library/ui/materials/MaterialImportDialog.tsx packages/studio/src/features/library/ui/MaterialLibraryPage.tsx packages/studio/src/features/projects/ui/ProjectGalleryPage.tsx`: final **0 errors**, eight existing gallery/material-library warnings; importer has no warnings. Tests are outside the current source ESLint configuration and are not claimed as linted.

## Limits and handoff

These deterministic DOM/callback tests hold command outcomes and do not establish real native unknown-commit behavior, physical paint, actual filesystem parsing performance or packaging. Existing `createFileMaterial` and per-file atomic ProductStore commands were not changed. There is no automatic reconciliation for internally allocated unknown material/version IDs, no skip-forward, reload-safe queue or background continuation. Explicitly leaving the mounted owning page can discard remaining local File references under the existing guard; confirmed saves remain durable under the command's own contract.

No full suite, build/package/native/live-provider command, dependency install, Git write or architecture pass was run by this worker. Root owns specs/task/discovery, independent changed-scope review and commit. Scope is frozen for review.
