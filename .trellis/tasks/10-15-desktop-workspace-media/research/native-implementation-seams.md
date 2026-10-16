# Research: E08 native implementation seams

- Query: Where should the real Windows/macOS directory scan → video thumbnail → project import workflow attach, preserving one full-product store and actual cancellation?
- Scope: mixed; read-only source/toolchain inspection plus official process API references
- Date: 2026-10-16
- Authority: existing E08 task; user changed the first release from macOS only to Windows + macOS and authorized development. This note is evidence for root-owned design, not a standalone implementation approval or platform acceptance.

## Findings

### Actual full-product entry points

| File | Observed purpose / useful seam |
| --- | --- |
| `apps/desktop/src-tauri/src/desktop.rs` | `ProductBridge`, trusted-window commands, exactly one lazy full-product worker, product media transport, page/window lifecycle. |
| `apps/desktop/src-tauri/src/worker.rs` | One dedicated SQLite/file owner; `ProductJob::{Store,Validate,Binary}`, queued calls and external atomic cancellation flags. |
| `apps/desktop/src-tauri/src/full_product_store/mod.rs` | Current session validation; original prepare/seal/commit/status protocol; atomic binary claim + rows + operation receipt. |
| `apps/desktop/src-tauri/src/product_binary.rs` | Managed-file staging, hash, no-overwrite publication, sealed `BinaryClaim`, transactional adoption, read leases and intent recovery. |
| `apps/desktop/src-tauri/src/paths.rs` | Actual file identity, ordinary-file/directory classification, managed names, chunked hashing/copy and namespace checkpoint. |
| `apps/desktop/src-tauri/src/paths/windows.rs` | Stable Win32 no-follow handle identity; reparse rejection; fixed local NTFS baseline; directory pinning. |
| `apps/desktop/src-tauri/src/runtime_services.rs` | Native-dialog invocation pattern, reserved operation before dialog, trust checks and safe cancellation/lifecycle. |
| `packages/studio/src/platform/storage/native.ts` | Sole TS native transaction owner; prepares only Blob claims today; durable acknowledgement reconciliation and discard rules. |
| `packages/studio/src/platform/storage/nativeBinary.ts` | Closed session/reference/claim schemas, current transport and bounded native transfer service. |
| `packages/studio/src/platform/storage/codec.ts` | Registered opaque managed refs; ordinary authored objects cannot reserve binary syntax. |
| `packages/studio/src/features/library/commands/media.ts` | `putMedia`, retained-library and orphan reference collection; project write ownership. |
| `packages/studio/src/features/library/models/media.ts` | Existing media record has only id/project/mime/filename/blob plus retained flag; no current thumbnail relationship/provenance. |
| `apps/desktop/scripts/tool-resolver.mjs` | Approved local/hosted Cargo toolchain resolution; local `.tools` rather than a global Cargo assumption. |
| `apps/desktop/scripts/release-policy.mjs` | Existing macOS arm64/x64 and Windows x64 target identities (plus Linux outside selected E08 systems). |

`desktop.rs:24-29,49-78` establishes `ProductBridge` and its single `StorageWorker::product` under application-owned `product-workspace-v1`. `product_store_request` at line 92 and `product_binary_request` at line 130 both reach that same worker. No renderer-selected workspace root is accepted here.

`desktop.rs:344-479` is a different `Action` enum for retained schema-4 workspace/reference behavior. Its `Action::Import` native file dialog at lines 1370-1394 ends in `Job::Import`, not `ProductJob::Store` and not the full Studio media command. Do not adapt it into the normal product import route or call workspace `Ensure/Create/Import` from E08.

Every new command must use `desktop::trusted` (`desktop.rs:601-615`): actual main window + exact packaged entry origin. Closed DTOs use `deny_unknown_fields`. Register commands in both normal/acceptance handler arrays (`desktop.rs:1742-1788`), both `build.rs` ACL arrays (`build.rs:11-46`), and `capabilities/main.json`. No broad filesystem/shell plugin permission is needed by this bounded flow.

### Existing native binary adoption is strong, but TS has one missing seam

`product_binary.rs:56-90` exposes native Prepare / Write / Seal / Abort with no external path. `BinaryReply::Sealed` at lines 108-110 returns `BinaryClaim {reference,stageId}`. `BinaryStore::seal` verifies written length/hash, publishes by no-overwrite hard link and saves published intent (`product_binary.rs:675-746`).

The sole product writer first verifies claims outside its short SQL transaction (`full_product_store/mod.rs:963-1017`), then calls `claim_prepared` inside the row/receipt transaction (`mod.rs:1035-1037`). It rechecks exact files just before COMMIT (`mod.rs:1167-1175`). Existing binary carrier refs without a submitted claim must already exist in `product_binaries` (`mod.rs:1002-1014`); merely sealing a file does not satisfy that condition. `product_binary.rs:781-807` explicitly rejects an uncommitted ref.

Current TS `NativeTransaction.prepareBatch` sends all row mutations then `this.claims` through existing `WireBatchEntry::Claim` (`native.ts:239-266`). However, the only way this list is filled is `prepareBlob` (`native.ts:296-303`). A registered managed ref bypasses the Blob callback (`codec.ts:48-57`). Consequently, **returning a sealed native ref to TS and passing it directly to `putMedia` currently fails adoption**; registering the ref is not enough.

Smallest recommended integration:

1. Keep expensive external copying/decoder work outside a ProductStore transaction.
2. Use the existing binary owner to prepare/write/seal source and thumbnail files in bounded chunks, returning closed, current-session-bound prepared claims. Internal Rust ingestion may add a `ProductJob` with an owned open-file/internal artifact input; it must not expose a renderer path parameter or construct another `FullProductStore`.
3. Add a narrowly scoped prepared-reference registration/claim lookup in the storage layer. When an actual native transaction encodes a prepared ref, collect its original claim and emit the existing `Claim` batch entry. Validate workspace, session/generation, duplicate claim use and metadata. Do not allow arbitrary domain objects to act as prepared refs.
4. Commit both source and thumbnail media rows, source/thumbnail relation/provenance, parent touch and original tool result in one existing shared transaction. New command uses explicit media/project/Agent scopes and fresh parent check.
5. A confirmed rollback discards unclaimed owned stages; uncertain COMMIT retains claims/intents and resolves original operation status. Existing `native.ts:495-539` already distinguishes that boundary; do not clean/delete or automatically replay after `UnknownCommitError`.

An alternative that copies entire videos into renderer Blobs would reuse the existing Blob path, but unnecessarily adds IPC/memory copies and duplicates the native preparation work. It is not the recommended desktop implementation.

### File grants need actual native ownership, not resource-ID text

The directory dialog should mint a random native grant bound to current native session/workspace/generation and the actual user-facing thread/project context. Native state holds canonical directory, actual directory identity/handles, discovered opaque entry IDs and frozen per-entry versions. Renderer/model DTOs carry IDs and bounded display names, never authoritative absolute source/output/executable paths. Grant selection is an explicit user action; model-supplied strings cannot create grants.

The grant owner can be a state member next to `ProductBridge` / runtime services; it does not own another SQLite store. Extend lifecycle cleanup alongside current window destruction and page-load hooks (`desktop.rs:1716-1728`): mark operations canceled/revoked, stop/reap processes, and release grant handles and owned artifacts. The existing product session/generation validation is the authoritative workspace fence (`full_product_store/mod.rs:299`, worker `ProductJob::Validate`).

Useful existing primitives:

- `NativeStat` carries actual device/volume, inode/index and link count, size, mtime and file/directory/alias classification (`paths.rs:73-110`).
- `ordinary(path,1)` rejects symlink/multiple-link source files (`paths.rs:152-160`); `ordinary_directory` rejects aliases (`paths.rs:162-170`). Hard-linked user sources therefore need an intentional accept/reject policy instead of silently using the managed-files helper.
- `canonical_root` deliberately canonicalizes OS parent aliases such as `/var` to `/private/var` (`paths.rs:214-231`). This is different from allowing discovered child symlinks to escape a grant.
- Windows pins ancestor names by holding directory handles without delete sharing (`paths.rs:172-191`, `paths/windows.rs:155-174`). Unix currently uses repeated stat identity checks; specs explicitly do not claim hostile-OS-user race confinement.
- Existing chunked hash/copy checks size, opened-file identity, final named identity, mtime and SHA-256 (`paths.rs:417-501`). Their source API is path-based; E08 must validate grant/ancestors at every boundary and should freeze an owned copied input before passing it to a decoder. Decoder output then corresponds to those copied bytes.

Recommended scan boundary: explicit recursive policy; reject/skip discovered aliases/reparse points rather than follow; count both candidate and noncandidate entries; cap depth, entry count, chosen videos, bytes per file and total copied bytes; deterministic display ordering; each entry ID resolves only in its issuing grant. Before processing, compare the frozen version, acquire/open safely, independently copy/hash into an application-owned operation directory, then recheck source identity and version. If source changed during copy, do not publish/import that file. Avoid trusting mtime/size alone or renaming/replacing user files. Recheck grant/session/revocation immediately before native stages and final adoption.

**Windows filesystem scope is a design decision:** `paths/windows.rs:114-149` invokes `require_local_ntfs` for both file and directory snapshots; lines 37-112 require local fixed NTFS with hard-link support, rejecting SMB/network, removable/exFAT and unsupported referrals. Reusing `NativeStat` for external grants preserves the existing baseline but means not every Windows folder is supported. Broad external read-only source support would require separating source identity from managed-publication durability and corresponding real host tests; do not weaken managed NTFS checks to accomplish it. Explain any initial source filesystem restriction in the import UI. User approval of Windows + macOS does not prove all source volume types.

### Own the actual process; current cancellation is not sufficient by itself

`worker.rs:68-72` documents the single dedicated SQLite/file owner. `ProductJob` currently has Store/Validate/Binary only (`worker.rs:15-22`); no probe/decoder/child owner exists. Current `run_product` at lines 292-322 creates an internal random operation ID, waits synchronously and does not return that ID to a renderer. `StorageWorker::cancel` can flip an existing flag outside the queue (`worker.rs:352-363`), but a flag is only observed when native work calls its check function.

Do not queue a long blocking FFmpeg process on the sole storage thread: doing so would prevent progress/status/stop writes and regular reads from reaching SQLite while the decoder runs. A bounded native media-operation executor can own child processes separately, while all actual storage/binary requests still use the same `StorageWorker`. This is a process owner, not a second SQLite worker/store or Agent loop.

Recommended native operation contract: reserve a unique active operation in state **before** launching work; issue no duplicate active start; route Stop/revoke/page close to its actual cancellation flag/child; retain current session validation; bound concurrency; keep a total deadline; use literal argv with no shell, fixed executable identity, null stdin and a private current directory. Model args never become executable names, raw FFmpeg options, protocols or output paths. Disable network-capable inputs for this local-file workflow; decoder reads only the frozen owned local copy. Bound and concurrently drain stderr/stdout; retain bounded redacted diagnostics, not unlimited `Command::output()` buffering.

The process owner must await actual exit/reaping before declaring stopped or deleting its input/output directory. A timeout, output-budget overflow, revoked grant and page/window teardown use the same stop/reap path. Verify the output ordinary-file identity, byte limit, image format/dimensions and content hash before exposing an importable artifact. A late stop after a confirmed product COMMIT reports committed work rather than canceled rollback.

Platform process plan must be concrete:

- Rust `Child` drop does not kill or wait. `kill` forces termination, while `wait` / successful `try_wait` observes exit/reaps. These stable calls fit Rust 1.99; dropping a handle or rejecting JS IPC is insufficient proof. See [official Child docs](https://doc.rust-lang.org/std/process/struct.Child.html).
- macOS: stable `CommandExt::process_group(0)` establishes an owned group. If the chosen executable may spawn descendants, group termination needs an explicit stable OS signal adapter; the newer `ChildExt` group signal/kill helpers in current docs are nightly-only and cannot be used on the pinned stable toolchain. See [official Unix CommandExt docs](https://doc.rust-lang.org/std/os/unix/process/trait.CommandExt.html).
- Windows: use a kill-on-close Job Object / explicit termination if descendant ownership is promised, with assignment-before-execution race handled. Existing `windows-sys` features only cover file identity; Job Objects/Threading would need targeted features. If first implementation is limited to a pinned direct decoder child, say so and test actual child kill/reap; do not label direct-child kill proof as complete process-tree confinement. See [Microsoft Job Objects](https://learn.microsoft.com/en-us/windows/win32/procthread/job-objects).

### Product representation and cleanup

`MediaRecord` currently has `id,projectId,mimeType,filename,blob,libraryRetained` only (`features/library/models/media.ts:3-12`). There is no supported thumbnail carrier or existing media provenance field. `putMedia` creates an immutable new row and touches its existing project (`commands/media.ts:84-94`). `collectMediaIds` includes explicitly retained records (`commands/media.ts:14-69`), and orphan deletion separately protects current/history owners (`commands/media.ts:125-151`).

Minimal product representation can keep source video and generated JPEG as two normal media rows (both use the existing `media.blob` carrier), with a reviewed thumbnail-ID/provenance relation. The relationship must participate in reuse/orphan cleanup, project deletion, snapshots/export where relevant, validation and actual UI preview. Mark adopted library sources retained before attachment. Do not leave the thumbnail discoverable only in a transient native path or treat an unreferenced image row as safely retained. Store opaque source entry/grant display provenance + original byte hash/version and transformation metadata; avoid durable absolute source paths or live source authority.

Adding a Blob/managed ref under an arbitrary optional metadata property will not automatically register a fourth binary carrier: the current contract lists only media `blob`, file material-version payload `blob` and setting-snapshot media `blob` (shared-product-storage.md:183-190). A separate media row avoids expanding that storage protocol unnecessarily.

### Toolchain / targets actually inspected

- `apps/desktop/rust-toolchain.toml` pins `1.99.0`, minimal + rustfmt/clippy; Cargo.toml uses edition 2024 and rust-version 1.99.
- Global `cargo` is not on current PATH. Approved resolver points to `apps/desktop/.tools/cargo/bin`, uses project `.tools/rustup`, `.tools/cargo`, `.tools/target` and explicit `RUSTUP_TOOLCHAIN=1.99.0`.
- Read-only commands `node apps/desktop/scripts/tools.mjs rustc --version` and `... cargo --version` succeeded: `rustc 1.99.0 (b940084d7 2026-09-28)` and `cargo 1.99.0 (5f94df478 2026-08-27)`. No compile/install performed.
- Cargo currently has no FFmpeg crate, shell plugin or process ownership dependency. `windows-sys =0.61.2` is already present for file identity; current Win32 feature set does not include JobObjects/Threading.
- Tauri 2.12.2, dialog 2.8.1, vendored HTTP 2.8.2, no `externalBin` in current tauri.conf.json. macOS minimum 14.0. Chosen decoder and exact distribution/provenance are still root-owned design work.
- Release policy already names `aarch64-apple-darwin`, `x86_64-apple-darwin`, `x86_64-pc-windows-msvc` (`release-policy.mjs:8-10`). Preserve existing release targets instead of assuming only this development machine's arm64 decoder is enough. Do not change unrelated Linux delivery while enabling only selected macOS/Windows E08 capabilities.

## Related specs

- `.trellis/spec/frontend/native-product-runtime.md`: complete shared product/one owner, exact trusted IPC, actual platform authority, lifecycle, fresh registry policy; tail lines 433-512 was read explicitly.
- `.trellis/spec/frontend/shared-product-storage.md`: explicit transactions/scopes, binary claims/carriers, unknown COMMIT, normal-product SQLite acceptance; relevant lines 138-205 read.
- `.trellis/spec/frontend/native-workspace.md`: retained reference lane; does not authorize using it as normal product storage.
- `.trellis/spec/frontend/workspace-storage.md`: independent copy/hash, no source deletion/live authority, actual persistence outcome after cancellation.
- `.trellis/spec/frontend/agent-jobs-results.md`: E07 foreground lifetime, two existing producer kinds, no existing OS-process owner; E08 needs explicit new producer/schema/report/cleanup scopes.
- `.trellis/spec/guides/development-change-policy.md`: fresh-development baseline; preserve named 49→50 migration, do not invent a new transition for E08 schema changes.

## Caveats / Not Found

- No decoder is selected or shipped by the inspected product. No native directory grant, recursive scanner or thumbnail generator exists yet.
- No selected user directory was scanned. No source file, product row or Git state was changed by this research.
- No native tests, Windows cfg execution, compilation, build, package, emitted-package checks or installation were run. Only read-only compiler version queries succeeded.
- Official Rust docs currently identify 1.99.1; repository and inspected compiler pin 1.99.0. Recommendations use APIs stable before 1.99; nightly group APIs are explicitly excluded.
- Corresponding-host Windows cancellation/identity, real system dialogs, packaged executable resolution and media viewing remain separate actual acceptance. Mac helper/source tests do not establish them.
- Existing Windows namespace strength remains ProcessRecoveryOnly; no sudden OS/power-loss durability promise was added.

## Implemented native API and focused evidence (2026-10-16)

This section supersedes the research-only "not found" statements above for the
implemented source layer. It does not establish Windows runtime, packaged dialogs
or installed-application acceptance.

`desktop_media_request` is registered in both normal/acceptance handler arrays,
both build ACL arrays and the main capability. Its closed envelope is:

```ts
{version: 1, session: UUID, workspaceId: UUID, generation: number,
 projectId: string, action: MediaAction}
```

The command requires the actual trusted packaged main window and validates the
current session through the existing `StorageWorker::ProductJob::Validate` before
dispatch. No reference-workspace job, filesystem/shell plugin or renderer path is
accepted. Only macOS and Windows enable this command's workflow.

| Closed action `type` | Additional fields | Successful response |
| --- | --- | --- |
| `pickDirectory` | `operationId` | `{status:"granted",operationId,grantId,label,limits}` or `{status:"canceled",operationId}` |
| `scan` | `operationId,grantId` | `{status:"scanned",operationId,grantId,scanId,count,skipped,totalBytes,limits}` |
| `readScanPage` | `grantId,scanId,offset,limit` | `{status:"scanPage",grantId,scanId,offset,entries,total,nextOffset:number|null}` |
| `prepareVideo` | `operationId,grantId,scanId,entryId,expectedRevision` | Prepared response below |
| `readOperation` | `operationId` | Original retained running/terminal response |
| `cancelOperation` | `operationId` | `{status:"stopping",operationId}` while active, otherwise original terminal response |
| `discardPrepared` | `operationId` | `{status:"discarded",operationId}` or `{status:"alreadyAdopted",operationId}` for two committed claims |
| `releaseOperation` | `operationId` | `{status:"released",operationId}` after a releasable terminal outcome |
| `revokeDirectory` | `grantId` | `{status:"revoked",grantId}`; active operations are signaled and retained separately |

```ts
type Entry = {entryId: UUID, displayName: string, relativeName: string,
  mimeType: string, byteLength: number, revision: LowercaseSHA256};
type Prepared = {status: "prepared", operationId: UUID, grantId: UUID,
  scanId: UUID, entry: Entry, sourceClaim: BinaryClaim,
  thumbnailClaim: BinaryClaim, thumbnail: {width: number, height: number,
    preset: "thumbnail-v1", atSeconds: 0, decoder: "FFmpeg 8.0.3"}};
type Failure = {status: "failed" | "stopped" | "unknown", operationId: UUID,
  error: {code: string, message: string}};
```

The grant stores the actual canonical directory and `(device,inode)` identity;
directory link count is deliberately excluded because normal directory membership
can change it. Ordinary source files require one link and freeze identity, size,
mtime and a real SHA-256. Scan revisions include that hash. Discovered aliases are
skipped, directory ancestors are rechecked and selected source bytes are copied
with a second hash check before decoding. Windows retains the existing fixed NTFS
and ancestor-handle policy; other volumes have no claimed support.

Fixed limits are depth 8, 4,096 directory entries, 256 videos, 512 MiB per video,
2 GiB total scanned video bytes, page size 100, 8 grants and 2 concurrent native
operations. A boundary overflow returns a scoped failure rather than a fabricated
complete manifest. Directory grants expire after 30 minutes without a scoped
request. Operations have a ten-minute overall check; decoder execution has a
separate 120-second limit, 8 MiB stdout and 64 KiB stderr. Scan hashing is bounded by
the same selected directory/video byte limits. The supported extensions are
MP4/M4V, MOV, MKV/WebM and AVI; extension discovery is not a codec support promise.

`desktop_media_process.rs` launches one verified fixed decoder with a fixed
argument vector and restricted file/pipe protocols and mov/matroska/webm/avi
demuxers. It decodes only the privately owned `source.bin`, produces a first-frame
PNG on stdout, and checks dimensions (at most 640 by 640), complete bounded chunk
framing, chunk CRCs, IDAT and IEND. macOS/Unix creates a fresh process group and
signals that group; Windows promises direct decoder child kill-and-wait, not Job
Object descendant confinement. stdout/stderr are drained concurrently. A wait
failure is `unknown`, retains its private input and a background child owner, and
cannot be released or described as stopped. Ordinary cancellation waits for actual
exit before `stopped` and owned-source cleanup.

Original and PNG claims use only `ProductJob::Binary` Prepare/Write/Seal, in
262,144-byte chunks. No SQLite store or direct product row writer is added. Failed
preparation aborts its known unclaimed stages. A prepared result can be released
only after both existing Binary Availability checks establish committed identity;
uncommitted preparation must be discarded first, and unknown outcomes stay retained.
The committed-claim checks use actual product metadata, not file existence.

There are at most 256 retained operation payloads; normal callers must release
completed picker/scan/item operations and revoke their directory. Release leaves a
duplicate-start tombstone for 30 minutes, bounded to 4,096 IDs; reaching this bound
refuses admission until retention expires. No native operation automatically
restarts. Durable stable import admission remains Studio's responsibility after
native retention expires. Releasing a scan operation does not remove its grant's
current manifest. Product reopen, page load and window teardown revoke source
authority and signal active owners; they do not manufacture a terminal response.

Revocation is currently a source-read/process boundary. Final adoption of already
prepared claims still uses the existing ProductStore commit, which has no native
grant field. The Studio service must preserve its durable intent and Stop guards;
do not claim native grant revocation itself atomically fences generic binary claim
adoption without an additional reviewed commit gate.

Focused checks run with the explicit Node/tool resolver and actual pinned Rust:

- `cargo test --manifest-path <absolute Cargo.toml> --features desktop desktop_media -- --nocapture`:
  10 passed, 1 intentionally ignored decoder-resource fixture; actual Tauri handlers
  and ACLs compiled. Two pre-existing vendored HTTP unused-variable warnings remain.
- With `CUEPOINT_MEDIA_TEST_RESOURCES=<desktop>/.tools/media/native-fixture`, the
  explicit ignored `desktop_media::tests::real_fixture_prepares_two_native_claims_and_cleans_snapshot`
  passed against the real verified Atlas arm64 FFmpeg. It matched the fixture's
  exact 11,940 bytes/SHA-256, generated PNG, obtained two real BinaryStore claims,
  removed the frozen input, refused premature release and discarded/released the
  uncommitted claims.
- The focused tests also exercise unknown action/path/argv rejection, project
  scope, source replacement, alias skipping, deterministic order, bounds, actual
  sleeping child cancellation/deadline, retained manifest after release, repeated
  normal operation release and replacement-safe temporary cleanup.
- `rustfmt --edition 2024` ran on the changed owned Rust files. No full Rust suite,
  application build, package, install or Windows execution ran. The initial
  non-desktop focused run passed 8 tests with expected non-desktop dead-code
  warnings; the actual desktop profile is the relevant handler compilation proof.

### Native review follow-up

The first review found that scanning rechecked a discovered directory on entry but
only rechecked the root grant during each file hash. The scan now shares
`Grant::check_ancestors` with preparation: it checks the complete captured directory
chain during directory iteration, before file metadata access, before every hashed
chunk, after hashing and before publishing the manifest. The real replacement
regression renames an already entered child directory and moves the original file
back under a replacement directory, preserving the actual file identity/size/mtime.
It must fail with `changed` on the first hash check, before reading a content chunk.
File-only validation would not catch this case.

The process runner also has an internal wait seam for deterministic OS-failure
regressions. A real sleeping child is killed, an injected first wait failure returns
`decoderStopUnknown`, and the background owner performs an actual wait/reap. A
native preparation regression runs this path after creating the actual frozen
source, verifies the exact retained input bytes, retains `unknown` after Stop and
refuses release, including after lifecycle revocation. This tests the uncertainty
boundary without substituting a resolved/rejected promise for actual process work.

After these fixes, the same desktop-focused command passed **13 tests**, with the
one explicit-resource decode fixture still intentionally ignored in that command.
The real FFmpeg fixture was run separately again after the prepare-seam change and
passed. No full suite, package or other-host execution was added.
