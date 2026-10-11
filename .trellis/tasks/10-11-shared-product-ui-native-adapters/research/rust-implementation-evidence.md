# Rust native shared-video implementation evidence

Date: 2026-10-11. Author: shared_native_backend implementer. This evidence covers the Rust source and storage contract tests. Packaged product UI verification is recorded separately by the main task.

Resumption reviewer independently repeated the combined-feature tests, format check and all-target Clippy on the unchanged final Rust source. Raw outputs are `full-check-logs/rust-tests-combined.log`, `rust-fmt.log` and `rust-clippy.log`; `rust-final-receipt.json` records exact command arrays, exit codes, log hashes and identical before/after Rust source hashes. All 51 tests passed again. This supplements the original implementer command record below.

## Final commands and results

Commands ran from the repository root with the repository's pinned-toolchain wrapper:

```sh
node desktop/tauri/scripts/tools.mjs cargo fmt --manifest-path src-tauri/Cargo.toml
node desktop/tauri/scripts/tools.mjs cargo test --locked --manifest-path src-tauri/Cargo.toml --features acceptance,test-hooks
node desktop/tauri/scripts/tools.mjs cargo clippy --locked --manifest-path src-tauri/Cargo.toml --all-targets --features acceptance,test-hooks -- -D warnings
node desktop/tauri/scripts/tools.mjs cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
git diff --check -- desktop/tauri/src-tauri/src/contracts.rs desktop/tauri/src-tauri/src/database.rs desktop/tauri/src-tauri/src/workspace.rs desktop/tauri/src-tauri/src/desktop.rs desktop/tauri/src-tauri/tests/native_workspace.rs desktop/tauri/src-tauri/tests/shared_video_contract.rs
```

Final results: all commands passed. Clippy had no warnings. Final test totals:

| Target | Passed | Failed / ignored |
| --- | ---: | ---: |
| `src/lib.rs`, with desktop acceptance and test hooks enabled | 9 | 0 / 0 |
| `tests/native_workspace.rs` | 22 | 0 / 0 |
| `tests/portable_contract.rs` | 2 | 0 / 0 |
| `tests/shared_video_contract.rs` | 10 | 0 / 0 |
| `tests/storage_review.rs` | 8 | 0 / 0 |
| **Total** | **51** | **0 / 0** |

The main binary, workspace probe binary and doc-test targets had zero tests. The shared-video integration suite was authored by the independent checker and executed with the final implementation. Earlier acceptance-only and test-hooks-only runs also passed; the combined feature run above is the final authoritative gate and includes the bridge close/admission test.

## Implemented boundaries

- Fresh native schema revision **4**, without migration or a compatibility reader. Previous development workspace revisions are rejected explicitly. The ready marker and stored schema must match.
- Closed typed project, episode, beat and shot DTOs include persisted timestamps, project brief/genre/audience/tone, aspect and dimensions, typed settings/columns/filters, canonical string shot numbers and canonical UTF-16 `scriptRange`. `scriptStart` and `scriptEnd` are not wire DTO fields.
- Closed camelCase desktop actions cover atomic project creation, typed metadata patches, episode/beat/shot creation and field patches, delete, duplicate, reorder, multi-shot insertion, bulk patches and receipt-based inverse operations. Unsupported world relationships return an explicit capability error.
- Typed patches apply only supplied fields. Omitted fields remain unchanged; explicit JSON null clears the declared nullable fields. Duplicate, unknown and out-of-patch baseline fields are rejected.
- Baselines compare numeric values semantically (`0` equals `0.0`), including nested settings. Nullable string baselines remain strings when the current value has been cleared. Current equal to requested converges; a different current value conflicts.
- The desktop boundary converts baseline conflicts into a typed `ConflictOutcome` containing resource, identity and current/expected/requested field values. It reads the latest worker state only for diagnostics and does not replay the rejected write. Worker and inverse rejection continue to use the `conflict` error code.
- Inverse receipts and the mutation share one SQLite transaction. Native-owned snapshots are parsed as closed typed state and validated on reopen. Receipt identifiers are stored as JSON arrays internally to avoid delimiter ambiguity. The renderer cannot supply snapshot state.
- Inverse operations restore only fields changed by that command, preserve later unrelated changes and reject modified copied records or reused deleted identities. Automatic update timestamps are ignored by field inversion and the owning project is touched again.
- Direct child writes and compound operations update the owning project's ISO UTC modification time. Episode timestamps are also generated as ISO UTC values, suitable for shared display and sorting.
- Script ranges require an exact UTF-16 substring with valid surrogate boundaries. Editing the script clears stale beat associations in the same transaction and keeps the scene prose.
- Multi-shot insertion respects scene ordering, explicit insertion order, default duration and automatic shot numbering settings. Numeric-prefix numbering handles large text labels without integer overflow. Record order validation checks the contiguous order values independently of a prospective vector's temporary insertion order.
- Project deletion removes logical asset references, asset metadata and video children in one transaction. Already copied managed bytes remain in the workspace; deletion does not unlink files or perform garbage collection.
- Existing generation checks, owner/closure checks, cancellation, filesystem containment, managed asset verification and narrow packaged-entry URL checks remain enforced.

## Concrete regression coverage

- Real serde null-versus-omitted patches, scalar and nested numeric baselines, nullable string conflict/convergence, unknown/duplicate/out-of-patch baseline rejection.
- Different-field merge, same-field conflict, converged writes and preservation of the current draft's stored counterpart.
- Missing-scene multi-add and invalid bulk patches leave every row unchanged.
- Scene duplication returns its actual copied rows and committed inverse; later source edits survive inverse.
- A committed bulk inverse survives reopen, preserves later unrelated edits and retains a usable receipt after a conflicting inverse rejection.
- Child changes and inverse touch ISO project timestamps while preserving later project metadata.
- Nonfinal-row edits in a multi-shot episode, scene-based insertion, duration/numbering settings, very large numeric shot labels and successful reopen.
- Partial-surrogate range rejection and script editing that clears stale ranges while preserving scene text.
- Project deletion after managed import, logical asset/reference removal, successful reopen and preservation of the owned bytes.
- A desktop unit verifies the typed conflict diagnostic's exact field values and absence of writes. Existing desktop tests retain closed payload, narrow URL, generation and close/admission coverage.

## Scope remaining outside this Rust gate

The main task owns final packaged-app UI checks and icons. World entities, generation/media slots, full-project import, memory/produce domains, physical managed-file garbage collection and other operating systems are not claimed by this native video-core implementation. No commit or push was performed by this implementer.
