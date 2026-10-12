# Independent native/runtime review

Reviewer: release_native_runtime_check, Trellis check role. Date: 2026-10-12.
Base: 92bb6d4120053453036fbdb1b3b8f23fb9c56385. This is changed-code and reached
callsite review, not a full unchanged-codebase audit or corresponding-host proof.

## Findings fixed

### Revalidate publication-stage cleanup authority

Files: `file_transfer.rs`, `product_binary.rs`, `paths.rs`, `import.rs`, plus
meaningful Rust regressions in those modules and `tests/storage_review.rs`.

Trigger: a stage name is replaced or receives an unowned hard link after
publication and final-file flushing, before cleanup. Earlier stage verification
and directory/ancestor verification do not bind the current stage name.
Normal Save directly unlinked it and could return `saved`; binary sealing
unlinked it and returned a claim. The two deterministic regressions failed on
those actual pre-fix paths. The recovery retain-published branch likewise
flushed the final file, deleted a replaced stage and returned `true`; its
separate deterministic regression failed before the recovery correction.

Fix: immediately before unlink, verify current stage/final names, exact owned
link count and byte length against the original open descriptor/recorded object.
Normal Save returns its existing `publishedWithError(stageCleanup)` and preserves
unproven bytes. Binary seal and intent recovery reject, retain the intent, and
never manufacture a ready claim. Manifest publication and retained import use
the same narrow check; intent cleanup rechecks current names and modification
state before each unlink, including the remaining single final name after
stage removal. No public DTO or recovery policy was redesigned. Private test
seams invoke the same production flush/namespace functions before injecting the
name change.

Five reached-boundary regressions cover replacement and extra-link variants:

- `changed_stage_after_publication_is_preserved_as_a_saved_file_warning`
- `changed_stage_after_final_flush_is_not_unlinked_or_claimed`
- `manifest_cleanup_preserves_changed_stage_after_real_namespace_checkpoint`
- `retained_import_preserves_changed_stage_after_publication`
- `recovery_flush_cannot_authorize_deleting_a_changed_stage`

The retained desktop `publish_bytes` branch already verifies cleanup names and
its original descriptor and needed no additional correction. The explicit
publication-stage unlink audit also covered Save Drop, manifest unlink, seal,
retain/discard recovery, retained import/recovery and reference export. The
separate pre-existing reference generated-import temporary-source bookkeeping
was read as context and not redesigned; it is not normal product publication.

## Reviewed contracts

- Win32 snapshots use pinned `windows-sys 0.61.2` real borrowed File handles,
  volume/index/link identity, no-follow final-entry inspection and reparse
  rejection, local fixed NTFS/hard-link checks, and held ordinary ancestor
  handles omitting delete sharing. Windows final flush opens a writable
  no-follow descriptor and preserves identity/length/modification checks.
- `NamespaceCheckpoint` explicitly distinguishes Unix directory fsync and the
  owner-approved Windows process-recovery validation. Windows does not promise
  sudden OS/power-loss namespace persistence. Actual Windows API/SQLite/guard
  interoperability is not established by local macOS cfg.
- Platform origin is shared by navigation, trusted main-window IPC, microphone
  and media. Mac keeps WK identity; Windows/Linux receive Rust-chosen separate
  ordinary app-private profile directories. There is no UI/storage fallback.
- Normal `fileSync`/`directorySync`/`stageCleanup` receipts stay closed, retain
  `published:true`, propagate safe warnings through real common Save and
  reference bridge owners, and do not authorize cancellation or automatic
  retry. Existing caller tests preserve owned media and task rows.
- External smoke runs only on fresh hosted-owned state, binds installed/extracted
  executable and frontend hashes to the receipt, uses existing UI to create and
  import, observes real process exit, removes the original fixture and reopens.
  The read-only verifier checks current product tables, committed binary
  operation and exact owned file bytes. Actual UI selectors were compared with
  ProjectGallery/MaterialLibrary/MaterialImport/preview source. AppImage and DEB
  have separate state/proofs; Mac bounded launch does not claim UI/store proof.
- Driver acquisition verifies actual cached pinned crate bytes and observed
  WebView2 compatibility. Packages/drivers, symlink/reparse handling and GUI
  protocol behavior still need their corresponding hosted execution.

## Findings not fixed

No remaining observed source defect in this review requires a product decision
or a module/interface redesign. Actual Windows/Linux/Intel compile, filesystem,
installer/driver/UI execution and macOS installer execution are pending H1a;
real tag/draft mutation/retry is pending H1b. Those are acceptance gaps, not
passing source checks. No target or gate was waived.

The existing native HTTP vendor emits upstream unused app/event warnings;
reviewer did not modify vendor source. Shared native Save retains existing
complexity review warnings. Root ESLint intentionally has no test-file matching
configuration, so the narrow mixed renderer/test lint reports ignored-test
warnings; this is not a claim of lint coverage for those ignored test files.
Desktop script/UI lint and TypeScript both pass.

## Verification

Final frozen native receipt:
`logs/native-runtime-check/final-frozen/receipt.json`. All Rust src/tests/Cargo
hashes match before/after the final batch. Exact raw commands/output remain
beside the receipt. Local observed versions: Node24.11.0, approved explicit
pnpm10.15.0, Cargo/Rust1.99.0. All Cargo operations used the existing workspace
cache serially; no extra target cache or release build was created.

| Gate | Actual result |
| --- | --- |
| Cargo fmt --all --check | Pass; no baseline format churn |
| Locked all-target clippy, test-hooks, warnings denied | Pass |
| Locked full no-GUI test-hooks suite | 114 passed: 67 library, 4 full-product process, 22 workspace, 2 portable, 10 shared-video, 9 storage-review |
| Locked all-target clippy, product-sqlite/test-hooks, warnings denied | Pass |
| Locked full product-sqlite/test-hooks suite | 131 passed: 84 library plus the same 47 integration cases |
| Explicit approved pnpm desktop types | Pass |
| Explicit approved pnpm desktop lint | Pass, maximum warnings0 |
| Explicit approved pnpm desktop quality | Pass |
| External smoke Node failure-contract suite | 11 passed |
| Read-only SQLite/file verifier Python suite | 13 passed |
| Native renderer scoped lint | 0 errors, existing complexity and ignored-test warnings reported |
| Git diff --check | Pass |

Feature-lane test counts overlap and must not be summed. Earlier worker and
incremental reviewer checks are historical, not additional distinct cases.
JavaScript exact commands/raw logs are in
`logs/native-runtime-check/final/javascript-receipt.json`; those files were not
changed by the Rust cleanup correction. Reviewed changed-path hashes are in
`logs/native-runtime-check/review-ledger.json`.

Failed/superseded attempts are preserved: an initial tools-wrapper command used
a doubled relative manifest path (the wrapper sets desktop cwd); the first new
regression mistakenly called `.as_str()` on an already borrowed string and
failed compilation; behavioral pre-fix Save/seal and recovery regressions then
failed as intended. `regression-before-fix.log` and `recovery-before-fix.log`
contain the actual bad outcomes. `regression-after-fix.log` and
`recovery-after-fix.log` contain the reached fixes. The first full final batch
under `final/` was superseded by the additional recovery correction; the final
immutable batch is `final-frozen/`. Root's concurrent shared-storage batch also
must be treated as superseded and rerun on this source.

Root retains full browser/shared-storage/candidate-bundle and hosted activation
ownership. This reviewer performed no GUI interaction, profile/user-data edit,
paid request, recording, app/installer build, commit/push/tag, remote dispatch,
Release mutation or publication. Actual hosted/package gates remain pending.

## Reached external verifier follow-up

The subsequent actual isolated Mac UI/Save/source-removal/reopen check exposed
an external verifier key-codec mismatch. SQL `row_key` is canonical WireText,
not plaintext; the synthetic fixtures had not followed that production format.
Only the external Python verifier and its fixtures changed. The corrected
16-case suite and actual read-only QA disk proof pass, with all QA workspace
files unchanged. This supersedes the earlier 13-case Python result and verifier
hashes above, while the final frozen Rust evidence remains valid. Exact red/green
logs, source hashes and immutability proof are in
logs/native-runtime-check/verifier-reached-fix/report.md and receipt.json.
Root's current source validation records 995 unchanged inputs in the earlier
997-input shared-suite snapshot and the two independently checked Python inputs.
