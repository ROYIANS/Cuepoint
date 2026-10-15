# Research: Windows managed-file identity and persistence feasibility

- Query: Which Unix-shaped native storage assumptions prevent Windows x64 release, and what stable Rust/Win32 contracts can preserve managed-file containment, identity, publication and recovery?
- Scope: mixed; narrow native filesystem boundary, not installer implementation or public release.
- Date: 2026-10-12

## Findings

### Existing files and contracts

| File | Responsibility and relevant evidence |
| --- | --- |
| `desktop/tauri/src-tauri/src/paths.rs` | `inode` supports Unix only (70–82); ordinary-file/link checks (85–103), canonical root (105–121), ancestor checks (143–178), directory sync (181–183), copied-byte checks (193–274), no-overwrite completion marker (311–337). |
| `desktop/tauri/src-tauri/src/workspace.rs` | `Boundary` captures and rechecks root, SQLite database and writer identities through `paths::inode` (701–760); also used by the full-product owner. |
| `desktop/tauri/src-tauri/src/product_binary.rs` | `FileIdentity` (142–168), root-authorized `ManagedLocation` (175–200), current named/open-file checks (245–257,393–445), initial root identity (465–476), staged provenance (543–555), hard-link publication and barriers (675–684), interrupted-intent recovery (1031–1141). Identity is currently two `u64` values stored as text and parsed back as `u64`. |
| `desktop/tauri/src-tauri/src/full_product_store/mod.rs` | A fresh store calls root/SQLite directory sync (182,213), captures `Boundary`, recovers binaries and creates `BinaryStore` (242–246), and publishes the completion marker (265 onward). These are normal-product startup requirements. |
| `desktop/tauri/src-tauri/src/database.rs` | Validates ordinary SQLite database and optional `-journal`, `-wal`, `-shm` files before opening/mutating (62–70). |
| `desktop/tauri/src-tauri/src/file_transfer.rs` | Export completion syncs written bytes, hard-links to a fresh destination, then syncs parent and unlinks stage (253–271). Once linked, errors produce `PublishedWithError`, never a false rollback. |
| `desktop/tauri/src-tauri/src/import.rs` | Retained reference lane also compares named/opened source, staged file and recovery provenance through `paths::inode` (78,123,153,173,205,276). Shared boundary changes must not strand this lane. |
| `desktop/tauri/src-tauri/tests/native_workspace.rs` | Existing symlink/hard-link/root/database rejection test is Unix-only (522 onward); Windows needs actual counterparts. |
| `desktop/tauri/src-tauri/tests/storage_review.rs` | Existing external SQLite journal hard-link protection is Unix-only (78–106); it must also exercise Windows NTFS. |
| `desktop/tauri/src-tauri/src/file_transfer.rs` tests | Injectable post-publication sync failure already verifies truthful completion receipts (around497). |
| `desktop/tauri/src-tauri/Cargo.toml` and `rust-toolchain.toml` | Stable Rust1.99; no direct Win32 binding dependency today. Lockfile already contains transitive `windows-sys` versions; that does not make their APIs directly available to this crate. |

Related specs: `.trellis/spec/frontend/shared-product-storage.md:173–195` requires managed references, bounded sessions, root/file identity and truthful external Save; `.trellis/spec/frontend/native-workspace.md` requires containment, exclusive fresh targets, no silent fallback, fresh-development schemas, and real packaged evidence. Some prototype-era owner/origin wording in the latter is stale; use the newer shared storage spec for the normal owner and update those clauses during implementation.

### Stable Windows identity requires a different internal seam

The public Rust Windows `MetadataExt` methods for volume serial, file index and number of links are still marked experimental in the checked stable and beta documentation. Do not implement Windows by directly calling those methods on stable1.99 or by inventing an identity from path/length/mtime. Stable `OpenOptionsExt` and `AsRawHandle` are available. [Rust MetadataExt](https://doc.rust-lang.org/std/os/windows/fs/trait.MetadataExt.html), [beta MetadataExt](https://doc.rust-lang.org/beta/std/os/windows/fs/trait.MetadataExt.html), [OpenOptionsExt](https://doc.rust-lang.org/std/os/windows/fs/trait.OpenOptionsExt.html), [AsRawHandle](https://doc.rust-lang.org/std/os/windows/io/trait.AsRawHandle.html).

Recommended design direction, to be reviewed and implemented rather than treated as current code:

1. Replace the metadata-only identity seam with an internal native-stat snapshot acquired **from a no-follow path handle** or **from the actual open `File`**. Include type/reparse attributes, volume/file identity, link count, byte length and modified time. Unix can fill the same abstraction from its metadata. A `Metadata` value contains no public stable Windows handle; a lookup keyed by metadata is not a sound substitute.
2. Use a small audited `cfg(windows)` wrapper with a pinned direct Windows binding dependency and borrowed handles. `GetFileInformationByHandle` supplies volume serial, 64-bit file index and current link count; Microsoft documents volume+index comparisons for identity. Propagate query errors; never return zero/dummy identity. [GetFileInformationByHandle](https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-getfileinformationbyhandle).
3. **Propose local NTFS as the first Windows storage baseline**, preserving the current `u64` identity shape and hard-link publication. This is a recommendation, not an accepted new product constraint. Supporting ReFS requires full128-bit `FILE_ID_INFO` and adjusted identity/provenance parsing; its64-bit ID is explicitly not guaranteed unique. FAT/exFAT/network shares cannot be silently advertised with the same hard-link contract. [BY_HANDLE_FILE_INFORMATION](https://learn.microsoft.com/en-us/windows/win32/api/fileapi/ns-fileapi-by_handle_file_information), [FILE_ID_INFO](https://learn.microsoft.com/en-us/windows/win32/api/winbase/ns-winbase-file_id_info), [CreateHardLinkW](https://learn.microsoft.com/en-us/windows/win32/api/winbase/nf-winbase-createhardlinkw).
4. If broader filesystems are deliberately supported, use `GetFileInformationByHandleEx(FileIdInfo,FileStandardInfo,FileAttributeTagInfo)` and a full-width typed identity, without truncating/hashing the128-bit ID into a64-bit surrogate. Link counts must still distinguish one owned name from exactly two names during interrupted link publication. [GetFileInformationByHandleEx](https://learn.microsoft.com/en-us/windows/win32/api/winbase/nf-winbase-getfileinformationbyhandleex), [FILE_STANDARD_INFO](https://learn.microsoft.com/en-us/windows/win32/api/winbase/ns-winbase-file_standard_info).

### Reject all reparse points and bind checks to handles

Windows junctions, mount points and cloud placeholders are not exhausted by `file_type().is_symlink()`. Add an ordinary-entry predicate rejecting `FILE_ATTRIBUTE_REPARSE_POINT` for the managed root, each managed ancestor, binary files and SQLite/sidecar names. Open inspected entries with `FILE_FLAG_OPEN_REPARSE_POINT`; directory handles require `FILE_FLAG_BACKUP_SEMANTICS`. Query attributes/tag on the opened handle and reject instead of resolving the referral. These checks preserve the current no-alias model; they intentionally do not support putting the live private workspace into a cloud-placeholder directory. [Reparse point operations](https://learn.microsoft.com/en-us/windows/win32/fileio/reparse-point-operations), [FILE_ATTRIBUTE_TAG_INFO](https://learn.microsoft.com/en-us/windows/win32/api/winbase/ns-winbase-file_attribute_tag_info), [directory handles](https://learn.microsoft.com/en-us/windows/win32/fileio/obtaining-a-handle-to-a-directory).

`OPEN_REPARSE_POINT` protects the object being opened; it is not evidence that arbitrary intermediate path components cannot be followed or swapped. Preserve per-ancestor validation, current root identity and repeated named-entry/open-descriptor comparisons at actual read/write/recovery boundaries. Retained ordinary-directory handles with `FILE_SHARE_DELETE` omitted can prevent directory rename/delete while an operation uses them; release them deterministically and test compatibility with SQLite and the worker close lifecycle. That alone is not proof against every in-place reparse/filter mutation. Do not claim a newly race-proof filesystem sandbox merely from preflight canonicalization. Path components must remain generated/canonical; do not widen the renderer to accept paths. [CreateFileW](https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-createfilew), [reparse points and file operations](https://learn.microsoft.com/en-us/windows/win32/fileio/reparse-points-and-file-operations).

### Directory persistence is a required design/host verification gate

`File::open(directory)?.sync_all()` is Unix-shaped. Adding `BACKUP_SEMANTICS` solves opening a directory handle, **not a documented Windows directory-fsync guarantee**. Microsoft lists supported uses of directory handles without `FlushFileBuffers`; the flush API documents a writable file handle and an administrative volume flush. A metadata-query handle opened with access0 cannot be assumed flushable. [Directory handles](https://learn.microsoft.com/en-us/windows/win32/fileio/obtaining-a-handle-to-a-directory), [FlushFileBuffers](https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-flushfilebuffers).

Microsoft documents flushing file metadata through `FlushFileBuffers` or write-through file opens. This supports keeping ordinary file-byte/metadata flushes, but does not by itself establish that every parent-directory creation, hard-link insertion, stage unlink and completion-marker name survives sudden power loss in the current protocol. `MoveFileExW(MOVEFILE_WRITE_THROUGH)` is a candidate publication operation, with documented write-through behavior; it is **not** a drop-in proof for the existing hard-link+unlink sequence, and its strongest explicit flush wording concerns copy/delete. [File caching](https://learn.microsoft.com/en-us/windows/win32/fileio/file-caching), [MoveFileExW](https://learn.microsoft.com/en-us/windows/win32/api/winbase/nf-winbase-movefileexw).

Required first execution spike on the corresponding Windows runner:

- Exercise ordinary directory opens/access modes and actual flush results on the selected filesystem, without elevation; record raw errors and requested flags. API success is an exercised host fact, not a universal namespace-durability proof.
- Design a Windows persistence/publication adapter around real supported operations: flush staged file bytes, perform fresh-target/no-overwrite publication, preserve write-ahead intent/provenance, flush the appropriate writable final-file handle where applicable, and verify identities before marking a claim ready. Any replacement of link publication by move requires adapting recovery for source-present/final-present states and atomic no-overwrite proof.
- Explicitly distinguish file-flush success, process-interruption/reopen recovery and power-loss namespace durability. Keep known directory/barrier failure typed. Never replace Windows `sync_dir` with unconditional `Ok(())` while leaving callers' durability comments/receipts unchanged.
- If the selected protocol cannot provide the existing claimed namespace guarantee, this remains a design decision/gate: document and review a narrower test-package persistence guarantee, or withhold that target. Do not disguise it as complete platform acceptance. A foreground restart or killing the application cannot simulate power loss.

### Meaningful corresponding-host regressions

| Windows case | Required evidence |
| --- | --- |
| Fresh full-product SQLite owner, managed binary prepare/write/seal/claim/read, close and reopen | Exact row equality and file hashes on Windows NTFS; no IndexedDB fallback. |
| Two ordinary files with same length/mtime but different IDs; root/database/writer replacement | Reject changed authority, even when path and superficial metadata match. |
| Alias created for ready file, staged intent or SQLite journal | Exact link-count rejection; external bytes unchanged; no cleanup of unproven names. Exercise interrupted two-owned-link states separately. |
| File symlink, directory junction, managed root/ancestor reparse, final-entry reparse | Reject before foreign read/write/publication; test junctions even where creating symlinks needs privileges. Record any unexercised case rather than silently passing a skipped suite. |
| Root/ancestor replacement while a lease/session is active | Reject next chunk/publication/recovery, or prove held ordinary-directory handles block the replacement. Preserve original external bytes. |
| Normal stage/link/unlink/commit interruptions | Reopen uses durable intent and identity, preserves ambiguous bytes, never manufactures ready rows or paid retries. Cover each boundary with deterministic hooks and a separate process termination test. |
| Existing export target, cancel before publication, barrier failure after publication | Existing bytes unchanged; cancel creates no destination; once destination exists return published/error status instead of rollback. |
| Path with spaces/non-ASCII, verbatim canonical Windows root, long generated components | Native paths remain exact; renderer still receives opaque references only. |
| Unsupported filesystem, identity/query/flush failure | Actionable typed failure with retained evidence; no dummy identity, path-only fallback or unconditional success. |

Run these on native Windows x64 CI together with the existing Rust suites and packaged normal-product startup/save/reopen check. macOS test results and cross-compilation cannot establish this contract. The tests should exercise the maintained full-product owner, not only the retained prototype lane.

## Caveats / Not Found

- Planning-only inspection; no Rust build, Windows process, filesystem experiment or release workflow was run. No product files changed.
- No official primary source found establishing that `FlushFileBuffers` on an ordinary, non-elevated directory handle provides the Unix parent-directory persistence contract required by current comments/callers. This is explicitly unresolved, not an assertion that every Windows directory flush necessarily fails.
- The explicit versioned Rust1.99 MetadataExt URL was inaccessible through the browsing tool; current stable/beta docs still mark the required metadata identity methods unstable. Verify the pinned toolchain APIs during the Windows spike; stable handle-based Win32 APIs avoid depending on their stabilization.
- Local NTFS-only startup/storage is a proposed baseline and must be visible in the final design/release documentation if adopted. Current broad user platform scope does not itself establish removable-drive, network-share or cloud-folder filesystem support.
- This file owns only Windows managed-file research. Trusted Windows application origin, installer/WebView2 policy, runner versions and complete release orchestration belong to the other task research/design artifacts.

## Subsequent reviewed execution decision

On 2026-10-12 the owner reviewed native-files-implementation.md and approved the
first Windows test contract: regular-file bytes/metadata flush, local NTFS
no-overwrite hard-link publication and intent/SQLite process-termination recovery.
Sudden OS/power-loss persistence of new directory/file names, unlink operations
and completion-marker names is unpromised. Unix fsync remains unchanged. This
resolves the design choice above, not the actual Windows corresponding-host gate.
The implementation names NamespaceCheckpoint::ProcessRecoveryOnly explicitly.
