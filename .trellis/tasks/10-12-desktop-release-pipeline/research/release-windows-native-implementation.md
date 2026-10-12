# Windows hosted native-check correction

## Boundary recorded before edits

Source baseline: `946664ab235e0996da138796bd7d364381dab6ab`, hosted run
`38208372156`, Windows job `114678095365`. The original `native-3.log` names
directory-guard, managed-binary and HTTP-media test failures, followed by abnormal
process exit `0xc0000409`; it does not retain individual panic details. Treat
teardown attribution as a verified source gap, not a captured hosted panic.

The smallest production gap is that the actual Windows directory guard opens
with `FILE_READ_ATTRIBUTES` only. Attribute-only access does not enter the
documented share-access conflict checks. Request `FILE_LIST_DIRECTORY` plus
attributes for `pin_directory` only, preserving metadata inspection access,
read/write sharing, no delete sharing, no-follow/backup flags, real identity,
NTFS and reparse validation. The ordinary stat seam remains unchanged.

The smallest test-lifecycle gaps are removal of the binary fixture root before
its SQLite connection closes and removal of the media fixture root before its
retained playback authorities and disk owner close. Use a test-only
`OwnedConnection(Option<Connection>)` with `Deref`/`DerefMut` in the binary
fixture, preserving existing disjoint-field borrowing and test bodies. Take and
explicitly close the actual disk connection after `BinaryStore::close` and
before deleting the root. For media, use `Arc<Mutex<Option<Disk>>>`, stop the
listener, observe zero active readers, clear previews, assert exclusive disk
ownership, take/drop the binary owner and explicitly close its connection
before deleting the root. Cleanup failures remain assertions.

Root additionally requested panic-unwind-safe teardown: return cleanup errors
from a fixture-owned cleanup method. Normal Drop errors still fail the test;
when a body is already panicking, print the explicit cleanup error and retain
that original body panic rather than raising a second panic/aborting the
process. This prevents obscured future diagnostics; the original hosted log
does not prove that a double panic caused its abnormal exit. Preserve the
media reader-drain deadline and assert disk exclusivity through that Result.

Owned source files: `src-tauri/src/paths/windows.rs`, the Windows directory-guard
tests in `paths.rs`, `product_binary/tests.rs` and `product_media/tests.rs`.
Additional authored evidence is confined to this report and
`logs/release-windows-native-implementation/`. Root owns specs/task metadata/Git;
other agents own frontend build and research. No dependency, schema, persistence
guarantee, production media lifecycle, test timeout or existing body assertion
change is included. No remote workflow, release, staging or commit operation is
authorized to this worker.

## Meaningful verification plan

- Preserve the existing Windows ancestor-rename rejection/release test. Add an
  empty-directory test that attempts a real DELETE-access open while pinned,
  expects the Win32 sharing violation and then succeeds after release.
- Add binary/media fixture-drop regressions with live read/write or preview
  leases, checking their private directories have actually been removed.
- Run scoped formatting and narrow actual macOS library tests, then coordinate
  the complete Rust feature checks with root. Inspect installed cross-target
  availability and report its exact limit; macOS cfg cannot establish Windows
  execution or Win32 correctness.

## Primary references

[MS-FSA share-access algorithm](https://learn.microsoft.com/en-us/openspecs/windows_protocols/ms-fsa/8c0e3f4f-0729-49f4-a14d-7f7add593819)
specifies conflicts for existing opens with data/execute/write/append/delete
rights; attributes alone do not enter that iteration. The directory-read bit
`FILE_LIST_DIRECTORY` has the same value as file-read data, as documented by
[file access constants](https://learn.microsoft.com/en-us/windows/win32/fileio/file-access-rights-constants).
These sources support the narrow access-mask correction, not actual Windows
hosted acceptance. Resource ordering follows the established full-product
fixture close/drop-before-cleanup pattern.

## Implemented candidate and local outcomes

The candidate changes exactly four authored Rust files:

| File | Final change |
| --- | --- |
| `desktop/tauri/src-tauri/src/paths/windows.rs` | Actual `pin_directory` requests list-directory plus attributes while denying delete sharing; metadata inspector, NTFS/identity/reparse checks and every ordinary-file flush stay intact. |
| `desktop/tauri/src-tauri/src/paths.rs` | Additional Windows-only empty-directory DELETE-authority rejection, exact sharing-violation code, original identity retention and successful open/removal after release. Existing ancestor rename assertions remain. |
| `desktop/tauri/src-tauri/src/product_binary/tests.rs` | Test-only owned connection supports existing disjoint-field borrows, closes active stages/read leases then explicitly closes SQLite before private-root removal. Actual lease/drop and normal/unwind cleanup-error regressions added. |
| `desktop/tauri/src-tauri/src/product_media/tests.rs` | Stop/listener join and the existing eight-second reader-drain contract precede preview revocation, exclusive disk-owner assertion, binary cleanup and explicit SQLite close. Option access adds two bindings to original test bodies; existing body assertions are unchanged. Idle-preview/drop and shared-owner normal/unwind failures are exercised. |

Both fixture cleanup methods return errors. A normal teardown error fails the
test. During an existing panic, they print the cleanup error and retain the
original panic; the actual new catch-unwind controls confirm both outcomes.
Neither swallowed normal cleanup failure nor an extra database-open operation
is introduced. This is test-only cleanup, not a production lifecycle change.

Local macOS ARM64 checks on unchanged hashes of those four source files:

| Check | Outcome |
| --- | --- |
| Scoped Rust formatting check | Exit 0 |
| `cargo test --locked --lib --features test-hooks product_binary::tests` | 25 passed, including both new cleanup controls |
| Same actual library entry, `product_media::tests` | 11 passed, including retained-preview drop and shared-owner controls |
| Same actual library entry, `paths::tests` | 9 passed; Windows cfg cases are excluded on this host |
| `git diff --check` | Exit 0 |
| Installed target inventory | Only `aarch64-apple-darwin` |

There are **45 distinct executed local tests**, not 45 Windows tests. Exact
commands, durations, exit codes and four-file before/after SHA-256 equality are
retained in `logs/release-windows-native-implementation/verification.json`;
each check has a finite raw log beside it. The scoped formatting inventory is
recorded in that receipt too. The standard source/test compiler reached the
owned Option wrappers successfully; no warnings or compilation failures were
reported in these runs.

Windows typecheck/execution is unverified: no Windows target is installed and
this worker did not expand the toolchain. The Win32 constants exist in the
pinned `windows-sys` source, but that inspection is not corresponding-target
compilation. Root owns complete frozen two-feature Rust/final quality gates
and independent review. Actual Windows rerun must validate directory listing
rights for all pinned ancestors, sharing/rename protection, SQLite teardown
and the unmodified native suites. H1a/H1b remain pending. No source staging,
commit, remote dispatch, installer build, provider call or Release operation
was performed by this worker.
