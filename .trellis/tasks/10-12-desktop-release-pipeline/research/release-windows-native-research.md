# Research: Windows native-check failure ownership

- Query: Investigate the owner-supplied Windows release matrix failure in `native-3.log`, without speculative implementation or weakening native contracts.
- Scope: mixed; actual hosted diagnostic log, internal source ownership and current Microsoft primary documentation.
- Date: 2026-10-12

## Findings

### Observed facts and diagnostic boundary

The supplied run is `38208372156` at source `946664ab`; its actual diagnostic artifact has now been downloaded and inspected (details below). Root reports Windows passed normal frontend, fmt, and both strict Clippy feature lanes before the wrapper failed at `native-3.log`. The wrapper maps that log to `cargo test --manifest-path src-tauri/Cargo.toml --locked --all-targets --features test-hooks` (`desktop/tauri/scripts/release-native-checks.mjs:24-34`). The wrapper message identifies the failed child, not the actual failing assertion/API. The real `native-3.log` must determine the correction. The initial source hypotheses preceded the artifact download. The later observed result and official access-mask finding below supersede that initial uncertainty; the original log still contains no individual panic text.

The first Rust lane includes library unit tests plus no-GUI `workspace_probe` / `product_store_probe` test-hook targets and native integration tests. The GUI `cuepoint-prototype` binary requires `desktop`, which this lane does not enable (`desktop/tauri/src-tauri/Cargo.toml:11-35`). No packaged GUI startup or installer result can be inferred from this lane.

### Files found and owners

| File | Description / ownership |
| --- | --- |
| `desktop/tauri/scripts/release-native-checks.mjs` | Sequential native gate, log naming and fail-closed status. |
| `desktop/tauri/src-tauri/src/paths/windows.rs` | Stable Win32 handle snapshot, fixed local NTFS policy, ordinary directory guards, process-only namespace checkpoint, writable final-file flush. |
| `desktop/tauri/src-tauri/src/paths.rs` | Shared stat/path/checkpoint helpers and actual filesystem unit tests, including Windows-only junction and guard release checks. |
| `desktop/tauri/src-tauri/src/product_binary/tests.rs` | Full-product managed-byte unit fixture and seal/claim/read/playback/recovery tests. |
| `desktop/tauri/src-tauri/src/product_media/tests.rs` | Real HTTP media-server unit fixture, SQLite disk holder and retained preview authorities. |
| `desktop/tauri/src-tauri/src/workspace.rs` | Retained reference workspace and active Boundary Windows ancestor guards. |
| `desktop/tauri/src-tauri/src/full_product_store/tests.rs` | Actual full SQLite row/transaction unit tests with explicit close/drop-before-cleanup pattern. |
| `desktop/tauri/src-tauri/tests/full_product_process.rs` | Real test-hook subprocess death, reopen, writer exclusion and unsupported-root tests. |
| `desktop/tauri/src-tauri/tests/native_workspace.rs` | Reference-lane imports, backup, cancellation and genuine process death/recovery cases. |
| `desktop/tauri/src-tauri/tests/storage_review.rs` | Changed-stage/backup/sidecar/close race regressions. |
| `desktop/tauri/src-tauri/tests/support/mod.rs` | Test-only temporary fixture owner; recursively removes its directory in Drop. |

### Patterns worth checking against actual diagnostics

1. Windows handles are authoritative and explicit. `inspect_handle` requests `FILE_READ_ATTRIBUTES`, read/write sharing, `FILE_FLAG_OPEN_REPARSE_POINT | FILE_FLAG_BACKUP_SEMANTICS`; pinned ordinary directories omit `FILE_SHARE_DELETE` (`paths/windows.rs:29-39,157-171`). `pin_ancestors` retains outer-first directory handles (`paths.rs:180-191`). Active managed reads, stages, verified claims/playback authorities and workspace Boundary objects retain guards, so deleting/renaming the private test tree before those owners are dropped is not a portable test cleanup sequence. Preserve the guards rather than relaxing them to satisfy cleanup.
2. `product_binary/tests.rs:112-116` calls `self.store.close(&self.db)` and then `remove_dir_all(&self.root)` inside Fixture::drop. Its `db: Connection` field is still live until after the Drop body, and any retained fixture-local external handle/authority must also be accounted for. This is a candidate teardown issue only until actual failing diagnostics show it. `full_product_store/tests.rs:90-94` is the established stronger pattern: close the store, drop the object, then recursively delete the private root.
3. `product_media/tests.rs:172-177` stops the server, waits for zero active connections, then deletes the root while `disk: Arc<Mutex<Disk>>` still contains a live SQLite connection. It also retains `previews: Arc<MediaPreviews>`: `MediaServer::stop` stops/join-listener only (`product_media/server.rs:118-123`); it does not clear the preview map. `MediaPreviews::clear` is available and revokes/drops the retained `PlaybackAuthority` leases (`product_media.rs:69-75`). These actual retained directory guards must be reviewed against the failing assertion. Socket/server lifetime completion alone does not demonstrate that SQLite or preview authority handles have closed.
4. Many destructive root/ancestor-swap tests are already Unix-only: `product_binary/tests.rs:816-1040` exercises successful directory renaming plus symlink replacement. Windows-specific tests assert rename fails while the guard exists, then succeeds after its drop (`paths.rs:841-858`, `workspace.rs:1873-1887`, `file_transfer.rs:509-521`). Do not mechanically replace protected swaps with success expectations or skip existing Windows cases.
5. Windows canonical paths use verbatim prefixes; exact wire references stay slash-separated and opaque. Existing final Save flush tests compare a canonicalized actual destination (`file_transfer.rs:703`), avoiding an authored pathname/canonical-name mismatch. If an assertion fails, compare canonicalization and generated paths without widening path authority.
6. `FullProductStore::open` pins startup ancestors until initialization completes (`full_product_store/mod.rs:164-165`), while actual close/dispose and subprocess kill/drop helpers are available. Root/DB teardown failures need owner ordering analysis before deciding whether the product lifecycle or only the fixture is wrong.

### Related specs and approved invariants

Read `.trellis/spec/frontend/native-workspace.md`, `.trellis/spec/frontend/desktop-distribution.md`, task `prd.md`, `design.md`, `implement.md`, and `research/native-files-implementation.md` / `windows-native-feasibility.md`. Research role isolation prevents loading implementation/check JSONL manifests. Windows first-test guarantee is the owner-approved ordinary-file byte/metadata flushing, fixed local NTFS hard-link no-overwrite publication and intent/SQLite recovery after process termination. Namespace survival after sudden power loss/OS crash remains unpromised. Actual NTFS host proof remains mandatory; macOS cfg/build/test success cannot establish Windows correctness.

The fix must preserve no-follow/reparse rejection, real volume/index/link identity, active directory guards, exact row/byte assertions, required targets, existing default deadlines and both Rust feature lanes. No silent success, skipped failure test, smaller fixture or permission relaxation is justified from the wrapper error alone.

### External references and versions

Current Microsoft MS-FSA sharing algorithms and Rust 1.99 Windows implementation were inspected during the actual-failure follow-up; exact primary URLs are recorded below. Existing reviewed primary references are captured in the two native-files research documents: Microsoft GetFileInformationByHandle, GetVolumeInformationByHandleW, CreateFileW and FlushFileBuffers; Rust stable handle APIs. Current manifest pins Rust 1.99 and windows-sys 0.61.2; the owner log used Node 24.11.0. Existing files, not memory, are authoritative.


## Actual hosted artifact follow-up

Owned evidence: `research/logs/release-windows-native-research/native-3-original.log` (7,003 bytes, SHA-256 `44e6a26834323bf1fcad15bc5ceca62269609080792d75c0543d543de33fc442`) and `observed-failures.json`. Root verified the parent artifact SHA-256 against GitHub. This is an exact finite copy of `_temp/native-checks/native-3.log`, not a synthetic rerun.

The library announces 64 tests. The log prints 36 passes and 22 failures, leaving six test results unprinted before abnormal executable exit `0xc0000409` / `STATUS_STACK_BUFFER_OVERRUN`. The failures are one empty-directory guard test, all 17 printed product-binary tests and four media tests that construct the disk fixture. `product_media::tests::exact_ranges_keep_full_selected_response_not_a_transport_chunk` passes; it is a pure range-selection test without the disk fixture. Passed real boundary tests include Windows junction rejection, ordinary-file flush, exact managed links, both root-store persistence/query paths and active Save transfer directory protection. These facts narrow ownership; they do not certify the unprinted tests, later integration lanes or packaged product.

The harness states that `--no-capture` is needed to see the full output. No underlying assertion or panic message is printed. Do not call the terminal Windows status proof of actual memory corruption, stack overwrite, an exact Win32 code32 or confirmed panic-in-Drop: a Rust panic during destructor unwinding can also abort the executable. Double-panic teardown is an informed source/distribution inference, not printed evidence.

### Verified directory-guard access-mask defect

`pin_directory` currently reuses `inspect_handle` with `FILE_READ_ATTRIBUTES` only (`paths/windows.rs:29-39,157-171`). Omitting `FILE_SHARE_DELETE` from such a metadata-only open does not establish the intended deletion/rename-sharing lock.

Microsoft's [MS-FSA 2.1.5.1.2.2 sharing algorithm](https://learn.microsoft.com/en-us/openspecs/windows_protocols/ms-fsa/8c0e3f4f-0729-49f4-a14d-7f7add593819) checks conflicting existing opens only when desired access includes a data/read, execute, data/write, append or delete bit. The same relevant access set must exist on the existing open; `FILE_READ_ATTRIBUTES` alone is excluded. The [2.1.5.1.2.1 delete-access algorithm](https://learn.microsoft.com/en-us/openspecs/windows_protocols/ms-fsa/82b364ce-6d7b-422f-8d88-4db32eea809a) applies the matching rule to deletion sharing.

Microsoft's [File Access Rights Constants](https://learn.microsoft.com/en-us/windows/win32/fileio/file-access-rights-constants) defines `FILE_LIST_DIRECTORY` as directory access bit1, the same numerical bit as file `FILE_READ_DATA`. Consequently, the minimal guard correction is to make **only the pinned-directory open** request `FILE_LIST_DIRECTORY | FILE_READ_ATTRIBUTES`; retain read/write sharing without delete sharing, the existing no-follow/backup flags, actual NTFS/reparse/type checks and deterministic File ownership. Ordinary stat inspection can continue requesting metadata-only access with delete sharing. No need to grant write/delete permission or change the shared identity/namespace/persistence contract.

This explains the independent empty-directory test failure from source semantics; the log does not identify which assertion failed. The passing active-export test is not a counterexample: the stage has a real open data-file handle under that directory, unlike the empty-directory fixture.

The [pinned Rust 1.99 Windows source](https://raw.githubusercontent.com/rust-lang/rust/1.99.0/library/std/src/sys/fs/windows.rs) shows `fs::rename` using MoveFileExW with an access-denied fallback to a DELETE-access open and FileRenameInfoEx. A real no-delete-share data/list directory handle must also reject that DELETE open. This is a source explanation, not an executed runner observation.

### Minimal teardown structures and ownership order

The bundled SQLite Windows VFS provides concrete supporting source: `desktop/tauri/.tools/cargo/registry/src/index.crates.io-1949cf8c6b5b557f/libsqlite3-sys-0.38.2/sqlite3/sqlite3.c:54176-54225` opens the database for generic read/write with `FILE_SHARE_READ | FILE_SHARE_WRITE`, omitting delete sharing. The crate/version is the pinned manifest's bundled actual SQLite source. A fixture cannot delete that database while its Connection field is still alive.

- **Binary fixture:** preserve `store.close(&db)` and all body assertions; then actually drop/close the Connection before recursive root removal. A minimal explicit-owned structure is an `Option<Disk>`/inner fixture owner with `Deref`/`DerefMut` to keep existing fixture field access. Drop takes the owned inner value, closes stages/reads while the connection is valid, destroys the store and connection, then removes the private root. An equivalent explicit Connection take/close works. Do not set SQLite delete-sharing, suppress cleanup errors or skip the tests to make cleanup pass.
- **Media fixture:** stop the listener and wait until active connections reach zero; revoke/clear `MediaPreviews` so retained private `PlaybackAuthority` directory guards close; close binary stages/read leases while its DB remains usable; actually destroy the disk/Connection before recursive root removal. An `Arc<Mutex<Option<Disk>>>` or a small owned takeable disk holder makes the release point explicit. Keep any outside Arc/lease ownership assertions visible instead of silently removing data with live owners. `MediaServer::stop` alone does not drop the server state's preview Arc; calling `previews.clear()` is therefore necessary for retained leases, not merely dropping the fixture's Arc.
- Panic-safe fixture cleanup should preserve the original failure rather than panic a second time during unwinding. A result-returning teardown or explicit close assertion in ordinary completion plus best-effort diagnostic Drop during unwinding can accomplish that, but never turn a normal cleanup failure into a passing test. Normal-path close/cleanup still has to be asserted; diagnostic output should identify which owner failed.

### Corresponding-host validation that can distinguish the causes

1. Keep the original empty-directory rename-block/release test. Add an actual DELETE-access directory open probe: while a pinned guard is live, the open fails with a sharing error; after dropping it, open and rename succeed. Include a nested empty directory with its ancestor pinned, preserved volume/index pair and exact child bytes. Metadata-only guard negative control should demonstrate the old access-mask weakness on the same native Windows host. No larger timeout, ignored test or permission change.
2. Retain every binary/media test body and real fixture sizes. Add explicit fixture lifecycle checks: DB data and binary bytes still readable while live, cleanup rejected with deliberately retained authority where relevant, then close/take/drop all actual owners and require the private root to disappear. Assert server readers are zero and preview capabilities are revoked before removal. Local Unix tests validate drop ordering and preserved behavior, but only native Windows confirms share semantics.
3. Run the focused Windows directory-guard, binary and media library tests with `--no-capture`/backtrace retained as finite diagnostics, then both complete unchanged locked all-targets Rust feature lanes. Do not run concurrently with unrelated heavy lanes during investigation; leave the final release lane's normal concurrency unchanged once corrected. If any body still fails, investigate its printed panic rather than attributing all failures to fixture cleanup.
4. Preserve real process-kill/reopen, junction, no-overwrite, final file flush, source removal and full shared SQLite acceptance on Windows. A macOS pass or cross-compile cannot replace those gates. The Linux run currently has only start/cancellation without actual test detail, and no diagnostic artifact; **no Linux root cause is inferred from this Windows evidence**.

## Caveats / Not Found

- Actual Windows artifact `11728572100` / job `114678095365` was inspected after root retrieval. Its wrapper/test progress is genuine hosted evidence; individual panic diagnostics are absent because the executable ended abnormally.
- No cargo tests, product edits, spec/config changes, Git operations, remote mutation, local credential/profile reads or paid requests were performed.
- Retained live SQLite connections and metadata-only rename guards are verified source defects with a failure distribution consistent with them. The exact per-test failure location remains an inference until a corresponding-host run prints full panic details or proves corrected tests.
- This topic is intentionally limited to the Windows first Rust test-hooks lane; macOS frontend failures and the still-running Linux job are separate owners.
