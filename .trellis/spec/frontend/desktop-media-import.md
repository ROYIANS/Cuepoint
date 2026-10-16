# Granted desktop video import

## 1. Scope / Trigger

Read when changing directory authorization, native scanning/decoding, prepared
binary adoption, desktop media import records or video-thumbnail relationships.
The shared Studio product and sole ProductStore remain authoritative. The retained
schema-4 `workspace_request` import is a reference lane and cannot import into the
normal full product. This contract describes source behavior; actual Windows,
Intel/macOS14 and installed/signing acceptance remain separate gates.

## 2. Signatures and owners

`desktop_media.rs` owns `DesktopMedia` and the closed `desktop_media_request`
envelope `{version, session, workspaceId, generation, projectId, action}`. Actions
are `pickDirectory`, `scan`, `readScanPage`, `prepareVideo`, `readOperation`,
`cancelOperation`, `discardPrepared`, `releaseOperation`, `revokeDirectory`.
Every ID resolves under the actual current native session and project. The trusted
main-window/origin check and ProductJob session validation precede dispatch.

`desktop_media_process.rs` owns the actual fixed decoder child, bounded pipes,
deadline and wait/reap. `media_decoder.rs::verified_decoder(resource_root)` chooses
the compiled target and verifies the bundled manifest and both executable hashes
against `apps/desktop/media/decoder-lock.json`; there is no PATH fallback or runtime
download. `scripts/media-resources.mjs` prepares only the requested target and adds
the exact source/notices inventory to release identity. Linux has no decoder and
keeps `payload.mediaResources: null`.

Pinned upstream license/configure files keep their exact bytes through scoped
`.gitattributes` rules (`-text`, with their original line endings and final blank
lines). Formatting these files or letting Windows checkout normalize them would
invalidate the source inventory hashes. Verify staged blobs against the pins.

Studio's `registerNativePreparedBinary(claimDto, actualSession)` is the only media
transport registration seam. Native transaction encoding reserves the original
claim when an actual registered carrier references it, then emits the existing
`WireBatchEntry::Claim` in the same commit. Arbitrary object syntax is no authority.

The library command owner is `features/library/commands/desktopMediaImport.ts`:

```ts
admitDesktopMediaImport({id, projectId, actor, selection}, store?)
// -> {import, admitted}; only admitted:true authorizes new native work
readDesktopMediaImport(id, projectId, store?)
transitionDesktopMediaImport(id, projectId, expectedRevision, status, error?, store?)
publishDesktopMediaImportItem({importId, projectId, itemId, expectedRevision,
  source, thumbnail, provenance}, store?) // -> {import, receipt, published}
```

`desktopMediaImports` is a project-owned intent/receipt table in the same store.
Its actor is a human or a real Agent run/thread/call; no synthetic Agent identity
may be created for a file picker. A selected item freezes entry revision, name,
MIME, length and reserved source/thumbnail IDs. Agent admission additionally checks
the real running/offered call, assistant message, bound project and frozen approval
envelope. Project deletion removes its intents and blocks late publication.

`platform/runtime/desktopMedia.ts` is installed beside the actual native store
driver. It validates closed responses and registers claims against that driver's
current session. `features/library/services/desktopMediaImport.ts` coordinates
native work outside transactions. Stable operation IDs derive from import/item
IDs; only a newly admitted intent starts the producer. Picker and scan operations
have separate IDs and are released after their actual results are observed.

The finite `desktop-media` Agent group exposes `desktop_media_scan`,
`desktop_media_read`, `desktop_media_import` and `desktop_media_status`. Scan opens
the actual system picker after confirmation; import freezes the selected entry
IDs and preview revision before confirmation. Browser/unavailable native sessions
return an explicit unavailable outcome. Neither argument schema accepts paths.

## 3. Contracts

The OS picker creates a grant; tool/model strings never supply source paths.
Native state keeps canonical directory identity and entries. Scan uses fixed caps:
depth8, 4,096 directory entries, 256 videos, 512MiB/video, 2GiB total, pages100,
eight grants and two active operations. Grants expire after30minutes of scoped
inactivity. Ordinary source files require one link. Discovered aliases/reparse
points are skipped; Windows sources use the existing local fixed NTFS baseline.
Directory identity excludes link count, which normal member changes can alter.

Scan freezes file identity, length, mtime and SHA-256. Preparation rechecks ancestors
and source identity, copies into a private owned directory and verifies the frozen
hash before decoding. The decoder only reads that copy with fixed argv and restricted
formats/protocols. The renderer supplies no executable, arguments, shell, output
path or URL. Decoder stdout is at most8MiB, stderr64KiB and elapsed execution120s;
the operation also has a ten-minute overall boundary. PNG validation checks bounded
dimensions (640×640), complete chunk framing, CRC, IDAT and IEND.

macOS creates and terminates an owned process group. Windows promises direct fixed
decoder child kill-and-wait; this is not Job Object descendant confinement. A failed
wait is unknown, retains the actual child owner/private input and cannot be called
stopped or released. Stop observes the actual in-flight await before the next item.

Native preparation returns source and PNG `BinaryClaim`s from the existing binary
owner in262,144-byte chunks. A prepared ref is not committed media. Trusted clones
share one claim reservation; a second transaction cannot reserve it concurrently.
Confirmed rollback discards and invalidates the capability; uncertain commit keeps
it quarantined. Re-registering the same raw claim cannot bypass that shared state.
Consumed/unknown stage identities have strong session-bound retention, so garbage
collection of renderer references cannot erase them. The 4,096-entry registration
cap rejects new claims when full instead of evicting unresolved identities.

The final product transaction writes original video, derivative image, reciprocal
IDs, bounded provenance, item receipt and project touch atomically. The source is
`libraryRetained`; its image is a derivative and hidden from normal pickers. Retain
and orphan cleanup resolve dependencies from actual roots. Project copies, immutable
material snapshots and ZIP round trips remap both IDs and retain both binaries using
the existing `media.blob` / material snapshot carriers. Provenance is historical;
grant/scan IDs from an imported package do not restore live authority.

Grant revocation fences future source reads and native preparation. Adoption of a
previously prepared authorized copy is governed by current durable import intent,
project and Stop guards; generic ProductStore commit has no OS-grant field. Keep
Stop/revoke/publication ordered in the producer. A confirmed commit wins a late Stop.
Lost admission returns no new start permission; unknown publication is reconciled
through original receipts/status and is never rerun automatically.

The project media library uses an inline `DesktopMediaImportPanel`; Agent results
use an Agent-owned `AgentDesktopMediaReport`. Selection locks immediately, actual
scanning/import has a Stop action, and asynchronous results retain project ownership.
No drawer or chat navigation is introduced. Progress counts only saved receipts,
preserves imported items after Stop and keeps ordinary completion quiet. Skipped
entries and the bounded scan are disclosed with the selection list.

Inspection reads the original durable record and stable native operation status.
A provable stopped/failed/discarded result can settle its existing intent. It never
starts a new copy/decoder or republishes media. Missing/foreign sessions and a
prepared result without a receipt remain unknown; they do not prove termination.
Such an unresolved intent continues to quarantine additional project imports.
Do not reset it to running or manufacture a stopped result to unblock the UI.

Normal callers release picker/scan/terminal item operations and revoke their grant.
Prepared operations release only after both binary availability checks confirm
committed product identity; uncommitted stages must first be discarded. Unknown
results stay retained. Native operation retention is bounded and does not replace
durable Studio admission. Reopen/page-load/destroy revoke authority and signal
active owners; they do not fabricate terminal results.

The current schema has53 tables, including `desktopMediaImports`. Fresh-development
registry identity rules apply. Do not widen the historical named49→50 migration
target to the current registry or invent a migration just for a local old workspace.

## 4. Validation and error matrix

| Condition | Required behavior |
| --- | --- |
| Unknown DTO field, source path, executable or argv | Reject before native work |
| Foreign session/project/grant or expired/revoked source authority | Reject; no source copy or product media |
| Unsupported Windows source volume | Explain local fixed NTFS scope before effects |
| Replaced/changed source or ancestor; hash mismatch | Reject frozen selection; rescan required |
| Scan entry/video/total-byte caps, decoder time or pipe overflow | Explicit failure; never report a silently truncated complete scan |
| Scan depth overflow, aliases, unsupported names or oversized individual files | Skip and return an explicit skipped count; the UI explains the bounded scan |
| Stop during decoder | Kill/wait, drain, then stopped; wait failure remains unknown |
| Same claim registered/cloned twice | Shared reservation; no concurrent adoption or uncertainty bypass |
| Receipt write fails | Source, derivative and receipt all roll back |
| Lost admission/publication acknowledgement | Read original record/status; no producer replay |
| Project deleted during native await | Cascade intent; deny late rows/resurrection |
| Late Stop after confirmed commit | Show committed receipt and count |
| Derivative copy/package | Remap reciprocal IDs; preserve both binaries; do not expose image as independent upload |

## 5. Good, base and bad cases

Good: select a directory, freeze a bounded list, confirm a selection, decode from
owned copies and commit each verified source/thumbnail with its exact receipt.
Base: an empty scan returns an explicit zero-video list and starts no decoder.
Bad: treat an extension as codec verification, hand a renderer path to FFmpeg,
describe cancel dispatch as process exit, save a sealed ref without its claim,
or rerun an uncertain import because the UI did not receive its acknowledgement.

## 6. Tests required

Native focused tests exercise closed requests, project/session scope, deterministic
scan/hash, source/ancestor replacement, aliases, caps, actual child cancellation and
deadline, unknown wait, replacement-safe cleanup, prepared release/discard and real
synthetic fixture→two claims. Decoder source tests reject traversal/links/duplicates,
wrong target/hash/length, interruption and incomplete resources without replacing a
ready directory. Release identity includes ignored payloads and source/notices.

Shared source tests use actual ProductStore and transaction encoding for stable
admission, real Agent ownership, rollback, unknown isolation, exact receipts,
concurrent edits and project deletion; relation tests cover retain/delete/copy,
materials, ZIP and actual poster failure lifecycle. UI/tool tests exercise strict
selection, frozen confirmation, duplicate guards, Stop/drain and read-only unknown
reconciliation. Do not substitute a source test or successful archive download for
actual Windows/Intel/macOS14, installed tool identity, signing or system dialog proof.

## 7. Wrong versus correct

Wrong: return a new managed ref and call `putMedia` without its original claim.
Correct: register the trusted current-session claim, then adopt it with its carrier
and durable receipt in the same native transaction.

Wrong: cleanup prepared files after an uncertain commit or blindly start another
operation to reconcile. Correct: retain the original operation, read its durable
receipt/status and preserve unknown certainty until verified.
