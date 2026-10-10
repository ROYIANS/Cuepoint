# Local workspaces, database authority and plugin boundaries

Date: 2026-10-10. Planning research, not an approved schema, plugin SDK or implementation plan.

## Confirmed product direction

- Cuepoint remains an independent application and owns its extension entry point.
- Synchronization is one plugin category; the architecture must allow other extensions later.
- Projects should have recognizable folders for source assets and finished outputs.
- SQLite, JSON files and a hybrid are acceptable candidates for research. The user requires coherent database/file/sync behavior, not an immediate choice to replace IndexedDB.
- Notion, cloud drives, Git and SVN are additional candidates to compare. Different plugins may offer different synchronization or version-management capabilities.
- Single-person multi-device use is confirmed. Devices are normally used one at a time; multi-person collaboration and intentional simultaneous editing are outside the current product scope.
- Application-owned content is authoritative. External project JSON edits are ignored as live input and are regenerated from app content on the next relevant save. Missing externally deleted media retains its identity/reference mapping and is reported as missing.
- Import always copies files into the Cuepoint-managed workspace. The software is the content container; external original files are not live project dependencies after import.

## Repository constraints

The inventory in `data-inventory.md` lists 49 durable tables and multiple Blob locations. Current owners validate scope and revisions before writes. Examples include `src/db/productionShared.ts:32`, `src/db/projectMemories.ts:34`, `src/db/audioShared.ts:29` and `src/db/media.ts:56`.

Current agent skills are a bundled code-owned allowlist (`src/lib/agent/skills.ts:12`); the tool dispatcher accepts an in-process registry (`src/lib/agent/tools.ts:137`). These are relevant internal extension patterns, not an existing externally distributed desktop plugin loader. A plugin lifecycle, compatibility contract, installation flow and native permission model require separate design.

Current project export/import is copy-oriented. Production handoff exports selected current-episode results and is explicitly not a restorable project backup (`src/lib/productionHandoff.ts:94`). Future `outputs/` files must not be confused with complete workspace recovery data.

## Compare canonical storage models

| Model | Canonical write authority | Strengths | Costs / caveats |
| --- | --- | --- | --- |
| Database-first hybrid | SQLite transaction owners manage live business rows; files hold immutable binary assets and core-produced portable revisions/snapshots | Closest to current atomic owners/CAS; efficient querying and validation; inspectable project/assets/output folders | Must transactionally capture pending export/sync work and recover it after crashes. Files and SQL cannot be two freely writable copies of the same record |
| File-first hybrid (comparison, outside the selected authority model) | Validated project records/revision files are canonical; SQLite is a rebuildable query/index projection | Naturally inspectable/portable when external editing is central | User chose application-only editing with regenerated files. Writable external files are not canonical input for the first release |
| Per-project SQLite plus global database | Each project owns structured records in its own DB; studio/library/identity/config data has a separate owner | Project-level export/move is more self-contained | Global chats, library adoption, cross-project searches and references span stores; current single-transaction assumptions need audit. Media still lives in files; each DB file remains a runtime store, not a concurrent merge format |

Confirmed authority: application-only editing with generated structured files. Database-first hybrid is the recommended implementation candidate for that contract, with portable transport data. The database engine and count/location of database files remain separate technical choices. External JSON ingestion is excluded from the first release.

## Logical layout candidate

This illustrates responsibilities rather than final physical paths:

```text
Cuepoint-managed workspace container (standard local storage)/
  workspace.json                 # identity and format information
  .local/                        # local runtime, excluded from transport/versioning
    workspace.sqlite             # DB-first implementation candidate
    device-state/                # credentials, claims and device-only preferences
    cache/                       # rebuildable indexes/waveforms/decoded data
  studio/                        # global library/IP/history exchange records
  projects/<stable-project-id>/
    project.json                 # core-produced checkpoint/manifest
    records/                     # versioned structured content when needed
    assets/                      # source/generated media, stable binary identity
    outputs/                     # rendered audio/video and delivery packages
    revisions/                   # committed portable changes/checkpoints
  exchange/                      # core-produced transport staging when required
```

All content stays within Cuepoint ownership. Provider plugins transfer a declared subset of committed portable records/assets; an existing cloud-folder provider can use a separate carrier directory populated by the core. Do not put the whole live container, including active SQLite/runtime files, under a third-party folder synchronizer. The `.local` spelling is illustrative and is not itself an exclusion guarantee.

With DB-first storage, copying a portable subset is only as current as the last completed checkpoint. A user-visible export/move operation must flush pending changes and verify completeness. Do not promise that arbitrary copying during active writes is always a complete recovery package.

Asset deduplication can use hashes separately from business IDs. Renaming a project must not change its identity. Export/import of a copy still creates new IDs; joining an existing synchronized workspace must preserve IDs. Whether project media are stored per project or in an app-owned shared content store is a technical layout choice; neither may depend on external original-file locations.

## SQLite and synchronization

[SQLite's session extension](https://www.sqlite.org/sessionintro.html) can capture/apply table changesets and report conflicts. It needs compatible schema/starting data and declared primary keys; virtual-table changes are not captured and the extension must be enabled in the runtime build. It is a candidate lower-level mechanism, not a complete Cuepoint sync protocol.

An application-level portable revision format is an alternative. It can share semantics across current browser Dexie and desktop SQLite, avoid coupling transports to table layout, and retain business ownership/history. It needs reliable capture of all core writes. Compare both using disposable fixtures before selecting either.

Neither option grants distributed paid-execution authority or defines clip-selection/ordering conflict policy. Keep source ancestry, device/change IDs and applied-change receipts separate from the current local numeric revisions. Never derive cross-device ordering solely from wall-clock timestamps.

[SQLite backup documentation](https://sqlite.org/backup.html) supports consistent snapshots. Backup restores a complete point-in-time copy; changeset exchange reconciles edits. A periodic upload of the entire DB is a backup candidate but does not merge two devices' independent changes.

## Candidate DB-first consistency sequence

1. Binary import prepares a complete immutable file before making it usable in business records. Record size/hash/type and owner. A crash before row commit leaves a recoverable/unreferenced file, not a committed reference to a partially written asset.
2. A core mutation transaction updates business rows and captures a durable revision/outbox entry together. Commit is the boundary for local acknowledgement.
3. A publisher turns the frozen outbox revision into portable files through staged writes and completion markers. On restart it retries publication idempotently; this is derived output, not a second independent record owner.
4. A provider plugin transfers permitted records and binaries. It reports remote revision/transport evidence and pending/failure status; a successful upload is not proof that every device has applied it.
5. Receiving core stages, validates and deduplicates incoming changes; checks owner/reference closure and binary availability; then applies through a controlled transaction and records an ingestion receipt. Distinguish received changes from new local edits to avoid echo loops.
6. Concurrent branches preserve intent and enter domain-specific merge/review. Delete records, history and offline-device retention govern garbage collection; a missing/late file or remote listing error is not permission to delete content.

Partial SQL/filesystem atomicity, cross-project adoption and schema upgrades require failure tests. An operation involving multiple stores cannot be claimed atomic until its rollback/recovery contract is validated.

## Plugin boundary candidate

| Core responsibility | Extension responsibility |
| --- | --- |
| Stable data identities, business ownership, transactions, version ancestry, merge policy, retention and recovery | Provider authentication and transport; mapping between portable records and remote IDs/files/pages |
| Credential storage service and explicit handles | Request only the provider credentials needed; no shared developer secret embedded in a distributed desktop plugin |
| Workspace permissions, progress model, cancellation, installation compatibility and versioned extension API | Advertise capabilities, limits and supported API/runtime versions; clean up resources on disable/uninstall |
| Controlled mutation/import commands and paid-execution authority | Submit proposed content changes through the core; receiving remote content must not submit paid jobs or import execution approval |
| Common statuses such as pending, incomplete, unsupported, conflict and disconnected | Preserve provider error/limit facts and retry rules; do not report full sync after an unsupported subset export |

Proposed first step is a narrow internally registered provider contract that can grow into the future plugin system. A third-party marketplace, arbitrary native code or unrestricted SQL/filesystem access is not implicitly included. Enforcement and sandboxing depend on the future desktop runtime and need an explicit design; a permission list alone is not isolation.

A sync provider, backup provider, publishing/export provider and version-history provider can share lifecycle/settings UI while publishing different capabilities. Initially selecting one primary bidirectional route per workspace is a candidate to simplify consistency; multiple simultaneous writable providers need a separate convergence/loop policy.

## Version-history behavior candidate

Git can version stable portable text records/checkpoints or revision manifests and run local commits offline; remote Git and binary storage are optional additional services. Never perform checkout over an active DB. A restore should stage and validate a checkpoint, retain a pre-restore recovery point and pass through core restore/import semantics. Decide whether a restore creates a new revision in the shared history or intentionally replaces the workspace; do not silently rewind a live sync stream.

Large media can stay in a managed binary store while versioned metadata refers to immutable identities. Git LFS is an alternative with a separate binary service and quotas. Garbage collection must retain binaries referenced by recoverable history.

SVN remains an advanced-provider candidate, especially for existing repositories. It does not remove central repository operation. Neither Git nor SVN commands need to appear in ordinary users' workflow.

## Scope decomposition to consider after convergence

The requested research now covers several independently verifiable deliverables. A future parent with child tasks can separate:

1. Storage/portable workspace and IndexedDB migration contracts.
2. Extension/provider foundation, depending on those contracts.
3. Sync/reconciliation engine and the first verified provider, depending on storage and provider interfaces.
4. Optional version history/restore, depending on checkpoints and conflict/recovery behavior.
5. Additional provider connectors, each depending on declared capabilities and its own compatibility tests.

This is a candidate decomposition, not newly created development tasks. Child acceptance and dependencies must be explicit before dispatch. Current work stays in research/planning.

## Personal device handoff

The normal workflow is save on device A, publish a committed version, close A, then continue on device B. The source device should not have to remain online while the destination is used. A default transport therefore needs durable remote delivery or an explicitly completed handoff, not only peer availability when both applications run.

Sequential use simplifies the product scope, but does not establish that offline branches can never exist. A user may close A before upload completes, open B with an older local version, or later return to a long-offline device. Preserve divergence before any automatic reconciliation; wall-clock last-write-wins is not a safe universal policy.

Proposed behavior for planning:

| Situation | Candidate behavior / observable evidence |
| --- | --- |
| Device A saves | Core flushes pending editor changes and durably commits the local mutation plus pending publication; local save can complete without a network |
| Publication is pending or interrupted | Show pending state and retain a restart-safe queue; do not equate saved locally with available on another device |
| Device B resumes online | Check the latest available remote version, download/stage required content and apply through the core; distinguish checking, content pending, ready and conflict |
| Device B resumes offline | Keep local editing available and make the last known sync state clear; do not claim knowledge of unsent changes on another device |
| B has stale data and a local edit | Retain both branches, then automatically reconcile proven disjoint changes or request a focused resolution for overlapping changes |
| A provider reports upload completion | Record provider acknowledgement for that version; this does not prove another device has downloaded/applied it |
| A device receives generation history | Retain historical results; provider arrival grants no local claim, paid retry or execution approval |
| App closes before transport completes | Preserve committed pending work for restart; shutdown is not the only trigger for publishing data |

Existing code already provides a local draft barrier at `src/lib/debouncedDraft.ts:22`. Its page lifecycle handlers initiate flush at `src/lib/debouncedDraft.ts:295`, but those handlers do not establish a remote publication receipt. `src/components/agent/AgentChatPage.tsx:104` pauses generation when leaving. A future desktop handoff must preserve these distinctions rather than reinterpret page close as successful synchronization.

Multi-person membership, roles, invitations, shared-session UI and collaboration-specific real-time machinery are outside scope. A hard cross-device lock is not assumed: offline availability and provider capabilities require explicit treatment. Stable identities, revision ancestry and idempotent application remain necessary for ordinary personal recovery.

## Next product decision

Managed asset copies, automatic full delivery of synchronized project data plus required assets/outputs, device-local credentials and managed-service-first onboarding are confirmed. Every downloaded file is materialized inside the receiving device's managed workspace so the handoff can continue offline. On-demand delivery is reserved for a later large-library optimization. Non-sensitive connector metadata may travel with the project, but credentials, cache and device-local execution state remain local; synchronized history cannot authorize or replay a paid operation. Ordinary users may use a Cuepoint-managed service, while advanced users may configure self-hosted provider plugins. See `file-authority-and-media-availability.md` for the confirmed ownership and mapping contract.
