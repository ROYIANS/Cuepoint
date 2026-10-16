# E08 technical design: granted media import on macOS and Windows

Status: approved for staged implementation on 2026-10-16. This document is the
implementation contract for the existing E08 task; it does not claim packaged or
other-host acceptance until those checks are run.

## Ownership and flow

```text
Agent/tool entry or media-library action
        |
Studio desktop-media service (scope, selection, preview, receipts)
        |
closed native media bridge (grant / scan / prepare / cancel / status)
        |
native media operation owner (decoder child, bounded logs, owned artifacts)
        |
existing managed BinaryStore + one FullProductStore transaction
```

The browser continues to use the shared library command but reports native media
availability as unsupported. Human selection is a real native directory-picker
interaction. An Agent may request the same picker affordance, but text, tool JSON or
model output can never mint a grant or supply an absolute path. The existing Agent
run, approval and result ownership remain in place for Agent calls; the human path
does not fabricate a run/call.

The native operation executor is separate from `StorageWorker` so a decoder cannot
hold the only storage thread. It owns an operation ID, cancellation flag, child
handle, private input/output directory and bounded diagnostics. Product binary reads,
claims and the final commit still use the existing `StorageWorker` and product
session. Teardown, grant revocation and page/window close all call the same stop,
wait, reap and cleanup path.

## Closed native protocol

Add a finite `desktop_media_request` family with strict camel-case DTOs. The exact
Rust enum names may follow existing conventions, but the observable contract is:

```ts
pickDirectory({operationId, projectId}): Promise<Canceled | DirectoryGrantSummary>
scan({grantId, operationId, limits}): Promise<ScanManifestSummary>
readScanPage({grantId, scanId, offset, limit}): Promise<ScanPage>
prepareVideo({grantId, scanId, entryId, expectedRevision, operationId,
              thumbnail: FixedThumbnailPreset}): Promise<PreparedVideoSummary>
readOperation({operationId}): Promise<Pending | Prepared | Stopped | Failed | Unknown>
cancelOperation({operationId}): Promise<Stopping | Stopped | AlreadyTerminal>
discardPrepared({operationId}): Promise<Discarded | AlreadyAdopted | CleanupPending>
revokeDirectory({grantId}): Promise<void>
```

Only opaque UUID-like IDs, bounded labels, MIME, byte sizes, dimensions, hashes,
revisions and finite status/error codes cross IPC. Native state binds every grant and
entry to the current product session/generation, project scope, canonical directory
identity and revocation state. Scans reject or skip aliases/reparse points instead
of following them, sort by a deterministic normalized display key and return explicit
partial/limit outcomes. The initial Windows source baseline is local fixed NTFS;
the existing `require_local_ntfs` guard must not be weakened for external sources.

The operation copies a selected source into an application-owned staging directory,
rechecks the grant and source identity after copying, and decodes only that frozen
copy. The decoder receives a fixed argument vector and a private current directory;
there is no shell, PATH lookup, URL/protocol input, user executable, raw flag or
renderer output path. Stdout/stderr are concurrently drained and capped. The output
must be a verified ordinary PNG with bounded dimensions/bytes and a content hash.

## Managed binary adoption and product records

The existing `BinaryStore` prepares and seals the original and thumbnail. A sealed
reference is not durable until its original `BinaryClaim` is collected by the same
native transaction that writes its carrier. Extend the narrow storage seam so a
trusted prepared-reference token carries its claim into `WireBatchEntry::Claim`;
arbitrary objects or hand-authored references must still be rejected. Foreign,
stale, duplicated or already-consumed claims fail before commit. Unknown commit
status retains the operation and stages for reconciliation, never automatic replay or
cleanup.

Use a separate derivative `media` row to keep the current `media.blob` carrier. The
source video record gains bounded provenance and `thumbnailMediaId`; the derivative
image is marked with a closed derivative relation and is hidden from ordinary media
pickers. The final transaction writes source row, derivative row, provenance, stable
operation/item receipt and project touch atomically. Stable item IDs make a confirmed
retry idempotent; an unresolved native/store acknowledgement remains unknown.

Close the derivative relation over `collectMediaIds`, orphan deletion, media picker,
preview, project copy/reuse, package export/import and any material snapshot that
claims to preserve video thumbnails. Do not add an optional field without updating
each carrier/registry and round-trip owner.

## Agent and UI integration

The first implementation reuses the existing Agent tool discovery/confirmation
surface and adds a small `desktop-media` group rather than changing the generic tool
loop. The write tool freezes project, grant, scan revision, selected entry IDs and
source identities in `AgentToolPreview`; preparation and decoder work stay outside
`executeAtomicTool`, while the final import command performs the one local atomic
write. Reports expose actual counts, current item, stop state, committed receipts and
unknown status. Success is quiet; no transient “preparing/model type” captions or
invented percentages are added.

The Studio media library uses one controller for human and Agent callers. It keeps
selection and the conversation mounted, prevents duplicate starts, permits one stop,
and distinguishes `pending`, `running`, `stopping`, `completed`, `failed` and
`unknown`. A late stop after a committed receipt displays the committed result.
Unsupported browser runtime returns a stable unavailable result without opening a
native-looking fake dialog.

## Platform/process and distribution decisions

macOS uses the pinned stable Rust process-group setup and explicit signal adapter;
the worker waits for exit before reporting stopped. Windows initially owns the fixed
decoder child and promises direct child kill-and-wait. It does not claim descendant
tree termination from a post-spawn Job Object assignment; a future tree guarantee
would require assignment before execution and corresponding-host evidence.

The decoder binary is a reviewed, per-target resource with a digest/source manifest.
Research currently favors Atlas `ffmpeg-8.0.3-build4` as a candidate because its
three target archives document FFmpeg and ffprobe, but large binaries, unpacked
hashes, actual execution and license/source materials remain unverified. Shaka
`n8.1.2-1` is the fallback candidate pending macOS 14 verification. No candidate is
claimed as shipped until the manifest and startup verification are implemented. The
existing Linux release matrix stays intact; adding only macOS/Windows resources must
not make Linux packaging fail.

## Compatibility and rollback

This is a fresh capability on the current product schema. No old-data migration or
reference-lane fallback is introduced. Before commit, failed/canceled operations
discard owned unclaimed stages after reaping. After a confirmed commit, cleanup only
removes temporary inputs and preserves managed rows. If commit certainty is lost,
retain the operation/stages and expose reconciliation; never retry the decoder or
write automatically.

## Required evidence before E08 completion

Necessary source tests cover closed DTOs, grant/revision/revoke checks, bounded scan,
staged claim adoption, atomic source+thumbnail+receipt writes, idempotent receipt,
derivative lifecycle and UI stop/unknown states. Targeted native tests cover macOS
and Windows path/process branches and deterministic decoder fixtures where the host
can run them. Full build, packaged installers, emitted artifacts, live desktop
acceptance and Windows runtime execution remain batch-end gates; source tests do not
stand in for them.
