# Desktop storage and synchronization implementation plan

Status: approved for staged implementation. The final planning summary was approved on 2026-10-10. The parent is in progress and tracks independently validated children; live service integration and production migration remain separately gated.

The work is intentionally staged so the core can be verified without a real account or user data. Each phase produces a reviewable artifact and can be tested with disposable fixtures.

## Child map and dependencies

- `10-10-storage-workspace-foundation`: first child, workspace-relative identity, managed copy and read-only binary-owner fixture. It preserves the browser/Dexie adapter; native SQLite migration is later work.
- `10-10-storage-checkpoint-plugin-foundation`: depends on accepted workspace copy/identity primitives. Its protocol-only fixture does not require complete per-table codecs; actual full-workspace export/application remains gated on those codecs and reference closure.
- Official managed transport and handoff: depends on the checkpoint/plugin contract and approved concrete service choices.
- History/conflict/restore: depends on core checkpoint application and handoff evidence.
- Optional adapters/native packaging: depend on stable core contracts and per-adapter/runtime decisions.

The child acceptance deliberately distinguishes implemented browser primitives from future durable desktop filesystem storage. No child may claim that an ephemeral Blob stage proves crash-safe native migration or remote synchronization.

## Phase 1 — workspace and migration foundation

**Depends on:** current IndexedDB inventory and the managed-copy contract in `research/file-authority-and-media-availability.md`.

1. Define an app-owned workspace abstraction that resolves stable IDs to device-local relative paths and keeps `.local` runtime data outside transport staging.
2. Enumerate every current Blob owner, localStorage/sessionStorage draft and global/device-only record; map each to canonical, transport, local-only or excluded status.
3. Implement staged managed-copy import and integrity verification. Cover media, nested material payloads, recordings and outputs. Do not create ready references before the copy is complete.
4. Build a disposable migration fixture from the current Dexie schema, including duplicate display names, nested Blobs, historical references and missing files. Verify row/reference closure and rollback on failure.

**Exit evidence:** workspace layout and ownership map, import failure/retry tests, migration report, and a preserved pre-migration backup. No production migration is run in this phase.

## Phase 2 — core checkpoint and plugin contract

**Depends on:** Phase 1 stable identities, owned paths and migration fixture.

The explicitly partial protocol-fixture child may verify transport contracts before the native migration exit is met. Actual full-workspace export/application still requires the Phase 1 durable native workspace, complete reviewed codecs and recovery evidence; the fixture does not waive those dependencies.

1. Define immutable checkpoint schema, manifest entries, revision ancestry, schema compatibility and capability/error types.
2. Implement a frozen export boundary that includes required records, assets and outputs while excluding secrets, caches, device claims and active execution handles.
   Production chat/tool history follows the 2026-10-11 retention decision: review original argument/result fields individually and preserve their historical content and references, rather than replacing raw history with summaries. Require explicit exclusion/completeness evidence and dormant incoming execution semantics before real application.
3. Implement validated, idempotent staging/application with hash checks, path traversal protection, duplicate-delivery handling and crash recovery.
4. Define the internally registered provider interface: lifecycle, authentication handles, capability advertisement, progress, cancellation, conditional publication, listing and unlink behavior.

**Exit evidence:** fixture round-trip between two isolated workspace roots, reordered/duplicated/corrupted delivery tests, and a contract document that a provider can implement without direct database access.

## Phase 3 — official managed provider and handoff UI

**Depends on:** Phase 2 checkpoint/application contract. Service account, quota and billing details must be approved separately before live integration.

1. Implement the first-party managed-provider adapter behind the provider contract, using disposable test endpoints before any production service.
2. Add distinct local-save, publication-pending, provider-acknowledged, download-pending, applied and conflict statuses.
3. Add automatic full delivery of committed project data, required assets and outputs; materialize files in the receiving workspace before marking the handoff ready.
4. Keep credentials in the device-local secret store and require local configuration before connector use or paid execution.

**Exit evidence:** source device can close after publication, destination resumes after automatic delivery, offline continuation works, and provider outage/quota failure preserves local work.

## Phase 4 — divergence, history and restore

**Depends on:** Phase 2 core application and Phase 3 status model; does not require a live paid service for fixture tests.

1. Preserve revision ancestry and stale branches for sequential multi-device use.
2. Add narrow disjoint-merge rules only where entity ownership and invariants are proven; route overlap and edit/delete races to focused review.
3. Store immutable checkpoints with bounded retention and implement inspect, restore-to-new-checkpoint and pre-restore recovery.
4. Ensure incoming job history remains dormant and never replays, claims or approves paid execution.

**Exit evidence:** offline branch, reconnect, same-entity conflict, delete/edit race, restore and restart fixtures with no silent overwrite or duplicate paid request.

## Phase 5 — optional provider adapters and desktop packaging

**Depends on:** stable provider contract and recovery evidence. Each adapter is independently gated.

1. Add a self-hosted file/object adapter only after capability, authentication and quota tests for the selected S3/WebDAV/cloud-folder target.
2. Evaluate Obsidian, Anytype and Notion as optional connector/publication experiments with pinned versions, license review and disposable data.
3. Complete cross-platform packaging and OS acceptance for the native filesystem, SQLite and credential ports introduced in the local-workspace foundation, using the selected and pinned runtime. Initial native storage correctness belongs to Phase 1, not to a post-service packaging shortcut.
4. Consider on-demand large-library delivery, Git/SVN history and a plugin distribution model as later milestones.

**Exit evidence:** each adapter has its own compatibility matrix and can be disabled without weakening the core checkpoint/application rules.

## Cross-phase safeguards

- Never sync the active SQLite file or runtime journals through a third-party folder tool.
- Never treat an absolute OS path or an external original as the source of truth.
- Never mark a binary ready before its complete verified copy exists locally.
- Never let transport arrival authorize, claim or replay a paid operation.
- Keep provider acknowledgement distinct from device application.
- Preserve a recovery checkpoint before destructive restore or migration steps.
- Use disposable fixtures and simulated providers until service economics, accounts and quotas are approved.


## Execution checkpoint — 2026-10-10

`10-10-storage-workspace-foundation` is independently accepted on corrected source: browser Blob managed-copy/import, portable lexical paths, incremental SHA-256 compatibility and read-only binary/history reference inventory. Full Vitest passed 186 files / 3,284 tests with one existing skip; independent adjacent regression passed 17 files / 376 tests. Product work is committed; archive and journal follow the user-approved batch.

The parent Phase 1 native migration exit is not yet met: durable workspace identity, native file staging/recovery, SQLite schema/application, a complete per-table portable projection and pre-migration backup are still open. The next child may validate immutable manifest/provider protocol with declared partial codec coverage and isolated test transports; it must not label a fixture round-trip as full user-data synchronization.

`10-10-storage-checkpoint-plugin-foundation` is now independently accepted on quality-repaired frozen source. It implements only the explicit partial single-project/media protocol fixture, immutable content-addressed versions, trusted provider contracts, conditional head publication and verified/idempotent test-port application. Final evidence: 71 permanent protocol cases, 127 affected regressions, 27 independent probes; complete suite 188 files / 3,355 passing tests with one existing skip; strict types, build, serial quality, 88 quality self-tests and model-bank verification all passed. Product work is committed; archive and journal follow the user-approved batch. Earlier failed probes/quality results are preserved separately from final acceptance.

The parent remains in progress. The next local-storage deliverable must choose and pin a concrete native prototype/runtime before implementing durable filesystem/SQLite/credential ports and backup/reopen/recovery tests. Reviewed production codecs and the approved complete original tool-history retention policy remain prerequisites before real full-workspace application. No hosted service, actual user migration, native recovery or offline user handoff is implied by these two accepted foundations.

## Commit and archival authorization — 2026-10-11

The user approved three local work commits and archive/journal bookkeeping for the two accepted children only. Product commits are recorded in each child task.json; the documentation/evidence work commit follows. Keep this parent in progress and active after child archival. Full original tool-history retention after field-level review is approved as a follow-on codec requirement. No remote push or real-user migration is authorized by this closing sequence.
