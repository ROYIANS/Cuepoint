# Desktop storage and synchronization design contract

Status: approved for staged implementation. The user approved the complete planning summary on 2026-10-10. Live service integration, deployment and production-data migration retain their later concrete gates.

## Decision update — fresh product development (2026-10-11)

The current application is still in development and the developer's existing local data is disposable. The Tauri prototype is an isolated feasibility demo, not a migration source. Future desktop product work starts with a new native workspace and current schema; it does not need to import or preserve existing IndexedDB data unless a later task explicitly requests that compatibility.

This supersedes the parent plan's previously proposed production migration as a default prerequisite. The durable workspace, SQLite schema, native file ownership and checkpoint projection are still required for the product, but they may be designed and initialized from fresh fixtures. Historical migration, old local database readers, backfills and compatibility branches remain out of scope by default.

## Product contract

Cuepoint remains an independent desktop application and owns its extension point. Synchronization is one plugin category. The first release targets one person moving between devices in sequence. The application is the authority for editable content; provider files and generated project files are transport artifacts, not an external editing surface.

The default handoff is a committed version published from device A, followed by automatic download of its project records, required assets and outputs on device B. Every received file is materialized inside B's Cuepoint-managed workspace before it becomes usable, so a completed handoff works offline. On-demand delivery may optimize unusually large libraries later.

Imports copy bytes into the managed workspace. A successful import never depends on Downloads, Desktop, removable media or another device's absolute path. Losing a managed copy produces a missing state while retaining its stable identity, references, timing and history. Losing the original source after import is harmless.

Credentials remain device-local. Non-sensitive connector metadata may synchronize. Historical results and approvals may synchronize, but incoming data cannot grant a runtime claim, authorize a paid request or retry execution. External edits to generated project JSON are ignored as input; the next relevant application save regenerates it from canonical records.

History refinement approved on 2026-10-11: preserve complete reviewed original tool arguments/results and their associations, rather than a summary-only projection. Review opaque fields individually; retain historical non-secret content separately from executable runtime authority. Device credentials and provider continuation tokens remain device-local/excluded. Codec completeness and any explicit exclusions must be inspectable; an unreviewed result bag cannot be silently dropped while claiming complete history. The current partial fixture has no production history codec.

## Authority and workspace

Use a database-first hybrid candidate: the embedded local database owns structured records and revisions; ordinary files own copied media and outputs; the core produces portable checkpoints and manifests for providers. SQLite is the preferred embedded-database candidate because it is in-process and serverless, but the exact desktop binding and one-database-per-workspace versus per-project layout remain technical decisions for a bounded prototype.

The live workspace has one application-owned root. A representative layout is:

```text
Cuepoint workspace/
  workspace.json
  .local/
    workspace.sqlite
    device-state/          # local credentials, device preferences and claims
    cache/
  studio/
  projects/<stable-project-id>/
    project.json           # generated portable projection, never canonical input
    records/
    assets/
    outputs/
    revisions/
  exchange/                # committed transport staging, when a provider needs it
```

The active database and runtime files never live in a third-party folder synchronizer. A provider receives a validated portable subset produced by the core. The core resolves stable IDs and relative owned paths against the current device's workspace root. Original OS paths are optional diagnostic provenance only.

## Import and media contract

An import is staged under the managed root, hashed or otherwise verified, and committed to the database only after the complete independent copy is available. Cancellation, interruption and insufficient space leave a retryable or cleanup state and never a ready reference to partial bytes. Import copies; it does not remove the source. Display filenames do not determine identity or storage names.

Media records, nested material payload Blobs, recordings and rendered outputs use the same ownership boundary. A migration must enumerate all current Blob owners, preserve IDs and references where identity matters, and verify reference closure before deleting old data. Internal deduplication is an optional storage optimization, never a link to an external original.

## Portable checkpoint and sync protocol

The core publishes an immutable checkpoint containing schema version, workspace/project identity, revision ancestry, structured records, a manifest of owned binaries with stable IDs, hashes and sizes, and non-secret connector metadata. It is assembled from a frozen read boundary, staged before publication and applied idempotently on receipt.

The receiver verifies schema compatibility, ownership, hashes, path safety, duplicate IDs and required references before committing. Binary files are staged and verified first; database references become ready only after their bytes are present. Reordered manifests, duplicate delivery, interruption and restart are normal cases. Orphaned staging data is reclaimable only after history/retention checks.

Transport acknowledgement means a provider stored the checkpoint. It does not mean another device has downloaded or applied it. Local save, remote publication and remote application have separate statuses and evidence.

## Personal divergence and recovery

The scope excludes intentional multi-person collaboration, but stale devices and offline branches remain possible. Keep revision ancestry and both branches when the receiver is behind. Automatically reconcile only changes with a proven disjoint merge rule. Overlapping edits, edit/delete races and schema incompatibility require a focused review or an explicit safe choice; wall-clock last-write-wins is not a universal policy.

Deletion of a managed file is a local availability observation, not a replicated logical deletion. A separate application command is required to delete an asset from the canonical project. Provider absence on one device must not remove a healthy copy on another device.

## Plugin boundary

The first implementation exposes a narrow, internally registered provider contract with declared capabilities: publication, bidirectional sync, backup, listing, conditional update, media limits, authentication, cancellation, progress and error classes. The core owns validation, conflict decisions, credential handles, paid-execution guards and workspace writes. A provider can transport data but cannot write arbitrary database tables or silently mutate business state.

The first release ships one official Cuepoint-managed provider. Self-hosted S3, WebDAV, cloud-folder and other connectors implement the same contract later. Obsidian, Anytype and Notion integrations are optional connector/publication experiments; they are not required runtimes, and their licenses, APIs and quotas remain individual gates. There is no first-release plugin marketplace, unrestricted native code loading or arbitrary SQL/filesystem access.

## Version history

Each published checkpoint is immutable and addressable by stable revision ID. The first release keeps a bounded local/remote checkpoint history and supports inspect, restore-to-new-checkpoint and pre-restore recovery. Restore is staged through the core and never replaces the active database by copying a live SQLite file. Git/SVN repositories, branching UI, semantic merge editors and arbitrary third-party history stores are later extensions.

## Security and service assumptions

Provider credentials are stored in the desktop's local credential facility or an equivalent device-local secret store. Portable checkpoints exclude secrets, caches, device claims, refresh tokens and active execution handles. A new device must configure credentials locally before using a connector or starting a paid operation. The eventual managed service needs its own account, quota, retention, billing and export policy; those economics are intentionally outside this planning checkpoint.

## Goal-backward acceptance

- Importing a file and deleting its original leaves the project usable from the managed copy.
- A canceled or interrupted import cannot appear as a ready asset.
- A committed checkpoint can be published while device A is closed and automatically materialized offline on device B.
- A missing managed file is visible without erasing its project references or another device's healthy copy.
- Reordered, duplicated, interrupted and corrupted delivery is recoverable without duplicate records or paid-request replay.
- Secrets never enter a portable checkpoint, and received history never authorizes execution.
- A provider failure leaves local work usable and exposes pending/error evidence.
- A restored revision is itself recorded and can be rolled back through a later checkpoint.
