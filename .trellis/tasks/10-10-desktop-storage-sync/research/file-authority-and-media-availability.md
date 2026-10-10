# Generated files and asset availability

Date: 2026-10-10. Requirements checkpoint and technical candidates only; no file-backed storage or synchronization is implemented.

## Confirmed user behavior

1. First-release editing is managed through Cuepoint. Manually edited generated project JSON is not ingested into live application content. On the next relevant save, Cuepoint regenerates its own file from canonical content.
2. Externally deleted image/video assets are reported as missing, analogous to a media-editing application. Keep the file-to-record mapping and project use; failure to locate the file does not erase the authored project.
3. Single-person sequential device use remains the sync scope. Missing-file reporting must coexist with asynchronous delivery and different device-local paths.
4. Every imported file is copied into Cuepoint's managed workspace. Successful imports are independent of the source location; moving/deleting an original or disconnecting its drive must not break the copied asset. External-original links are excluded.

This approval concerns app-owned structured output, not a blanket permission to overwrite unrelated files. Deleting a managed asset and editing generated JSON are different operations. The selected authority and managed-copy rules align with a container-owned content model.

## Repository evidence

| Anchor | Current behavior | Implication |
| --- | --- | --- |
| src/lib/media.ts:53 | uploadMediaFile stores the selected File as Blob bytes under a new media ID | Browser imports do not retain an OS source-path dependency |
| src/db/materials.ts:64 | filePayload copies Blob bytes into material payloads | Library binary migration must cover nested material-version content |
| src/domain/types.ts:362 | MediaRecord has ID, project owner, filename, MIME and Blob | Stable identity exists; desktop logical/physical resolution must be added through an explicit storage contract |
| src/db/media.ts:56 | Replacing media creates a new record; ownership is checked | Preserve immutable content identity when choosing a different source; relinking to the same content differs from replacement |
| src/db/media.ts:92 | Orphan cleanup checks current uses and historical references | Missing files cannot bypass retention rules or become automatic orphan deletion |
| src/components/media/MediaThumb.tsx:28 | Preview combines loading and unavailable text | Desktop UI should distinguish loading, pending download, known absence and read errors |
| src/lib/audio/buffers.ts:19 | A missing audio record prevents complete playback/export | An unavailable physical file also requires explicit failure; do not silently produce a complete-looking result |
| src/lib/productionHandoff.ts:54 | Delivery export classifies a referenced missing record | Extend availability checks to file-backed media while preserving expected references and actionable warnings |

## Authority and publication rules

- Core mutations write canonical application records. Generated project JSON is derived output, not a second writable record owner.
- A relevant save/checkpoint republishes derived files even if external edits changed their contents without changing the application row. Detect or replace generated outputs as part of publication rather than skipping solely because the DB revision is unchanged.
- Publish revisions from frozen core records/outbox data, not by reading manually modified export files back into the app. Git/history publication follows the same rule.
- Sync ingress is an explicit, validated protocol boundary. A filesystem change to a readable project export is not an application edit or a remote business mutation. Transport records require version/identity/reference/integrity checks before application; corrupt or incomplete data must not overwrite the local canonical state.
- A next save can regenerate structured output; it cannot recreate missing binary bytes from metadata. Missing media should remain visible until valid bytes return or the user performs an explicit future recovery/replacement action.
- Raw OS edits to the active database are not a supported editing path. This planning approval does not establish isolation from arbitrary direct database corruption.

## Candidate media mapping

Split portable identity from device availability:

| Portable record / reference | Device-local resolution |
| --- | --- |
| workspace/entity/media IDs and owner | Current device's Cuepoint-managed workspace root |
| Binary identity/content digest, byte length and MIME | Readable local file path/handle and verification outcome |
| Original/display filename and an app-managed relative object location when applicable | Available, checking/loading, pending transfer, missing, unreadable or changed |
| Shot/slot/clip/library-history references | Provider download/pending state; local diagnostics |

An absolute path on device A is not portable identity for device B. Resolve stable object IDs or workspace-relative locations against B's own root. Original locations, if retained for diagnostics/provenance, are not live dependencies. Treat filenames as display information rather than proof of matching content. Hash verification policy and its performance cost need technical evaluation; a renamed or replaced file must not silently bind unrelated bytes to an existing ID.

The exact schema is not selected. No relink UI or automatic recovery behavior has been approved by this checkpoint.

## Availability versus logical deletion

| Situation | Required/proposed handling |
| --- | --- |
| Previously local asset was removed externally | Report missing on that device; keep expected metadata, authored references and history |
| New device has metadata but binary download is pending | Report pending download, not a confirmed loss |
| File access fails because of permissions or an unavailable drive | Report unreadable/unavailable with the cause; do not infer intentional deletion |
| Expected path contains different bytes | Do not silently adopt them as a new application version; flag changed/unverified content pending explicit policy |
| User deletes an asset through the app | Apply the owning command's reference/history rules; propagate an intentional logical delete only under the approved sync contract |
| Provider listing is incomplete or a remote object is temporarily absent | Preserve local content and pending/error state; absence is not a deletion command |

Availability is device-local. A's missing-file observation must not delete B's healthy copy or erase the shared asset mapping. Replicated deletion requires explicit core intent. Automatic download/recovery of an externally removed asset is not selected; preserve the user's requested missing indication rather than claiming automatic repair.

Missing content must not block unrelated text/timeline editing. Operations requiring that content should fail clearly or follow an explicitly approved partial-export mode; they must not claim complete output. Refresh cached previews/audio when the resolver detects physical loss or changed identity.

## Acceptance scenarios for future validation

1. Edit generated project JSON externally, including invalid JSON: reopening or previewing it cannot change canonical app rows; the next relevant save restores generated content. The edited file cannot be published as a new app-authored change.
2. Delete a referenced asset outside the app: its slot/clip/name/metadata remain, availability becomes missing and a dependent complete export reports failure/incompleteness.
3. Download a project onto a second device before media arrives: distinguish pending delivery from missing; metadata stays usable without destructive cleanup.
4. Device A loses a local file while B has valid bytes: sync preserves B and the shared record; no implicit delete or paid regeneration occurs.
5. Change a filename/path or replace its bytes externally: do not silently create a new logical asset version or import another file with the same display name.
6. Restart during file/checkpoint publication: canonical data survives, derived files can be regenerated and incomplete transport objects are not ingested.
7. Import a file, then delete/move the external original or disconnect its drive: preview and dependent operations still use the managed copy.
8. Interrupt import through cancellation/crash/insufficient storage: do not report a completed import or expose a ready record referencing a partial asset. Preserve the external original.
9. Import different files with the same display filename: preserve separate stable identities and do not overwrite one managed asset with the other.

## Managed-copy import contract

The user selected managed copies. Prepare content under the workspace, verify completion, assign stable identity and commit the usable reference only after the complete file is available. On failure, retain a retryable/cleanup state instead of a phantom ready asset. Copying is not moving: import does not remove the original.

An external-original symlink or hardlink would not establish independent byte ownership. Internal deduplication within Cuepoint-owned storage is a separate technical option, subject to reference/history retention. Import filename collisions require safe internal naming independent of display filenames.

Generated media, recordings and rendered outputs follow the same container boundary. Migration must extract existing media and nested material payload Blobs into owned storage without losing IDs or references. After moving to a new device, resolve portable identities against its own managed root.

The user's requested missing state now applies to loss of the managed copy, not deletion of the original after completed import. The first-release delivery default is automatic full delivery: after a committed version is applied on another device, its project data and required assets/outputs should be downloaded and materialized inside that device's managed workspace so the handoff can continue offline. On-demand delivery remains a later optimization for unusually large libraries. Cache, secrets and device-local execution state are classified separately and are not implied by this file-delivery decision. Credentials remain local to each device; synchronized history and results never grant a new runtime claim or permission to replay a paid operation.
