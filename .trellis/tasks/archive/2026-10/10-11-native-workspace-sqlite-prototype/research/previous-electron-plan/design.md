# Disposable native storage slice

> Runtime reconsideration (2026-10-11): the user questioned Electron weight and requested SiYuan research. Electron-specific implementation has stopped, with unaccepted code/probes preserved. This Electron candidate plan is historical pending a runtime decision and updated planning; it does not authorize further Electron-specific work. Storage acceptance requirements and parent decisions remain in force. See `research/runtime-reconsideration.md`.

## Boundary and runtime

An isolated `desktop/` package pins Electron 44.7.0. Existing root Vite/TypeScript/ESLint tools build and check it without changing root dependencies or lockfile. Native modules bundle the accepted workspace and incremental SHA-256 helpers through the existing `@/` alias. The renderer is a minimal local fixture window; the main process owns all paths, SQLite, staging and dialogs. Sandbox preload is bundled as a single CommonJS file; main is bundled ESM. `node:sqlite` must execute in the pinned Electron process before acceptance.

Electron is a reversible prototype choice. This slice neither ports all application workflows nor establishes installer, platform or runtime production support.

## Data model and authority

One SQLite metadata database per workspace stores a format/schema marker, a UUID workspace identity, prototype projects, assets (including an explicit output kind) and project-owned reference fixtures. Asset metadata contains stable ID, owner, canonical `WorkspaceRef`, display name, MIME, size and checksum. Outputs use the same canonical managed-byte path with an explicit record kind; no second competing path codec. Imports and references use small typed prototype schemas, not arbitrary production JSON envelopes.

The DB is authoritative. Opening validates format/schema/identity and record closure. It must not repair a corrupt/unsupported existing DB by assigning a fresh identity. Device-local absolute root, runtime writer DB, Electron profile and import source path are excluded from backups. An asset's availability is read/verified from managed bytes independently of its logical record; missing/corrupt bytes never remove references.

## Native containment and single writer

Canonicalize legitimate OS parent aliases (such as macOS `/var`), then reject a symlink as the app-owned root or any managed component. Existing DB, journal, stage and asset entries must be ordinary files/directories with expected link count, checked before access. Reuse lexical path validation and exact derived refs before native access. Reject excessive encoded components/path lengths with actionable errors; do not normalize IDs to fit.

A separate device-local `writer.sqlite` connection holds `BEGIN EXCLUSIVE` for the lifetime of an opened workspace. A small busy timeout makes a second writer fail; actual process exit releases SQLite's OS lock, avoiding PID-reuse/stale-lock deletion. Metadata uses independent short transactions. An in-process queue serializes import, writes, backup, close and recovery. SQLite locks assume a supported local filesystem. This prototype does not claim protection against a hostile process replacing ancestor directories during a Node filesystem call, network filesystem locking or physical power loss.

## Import commit and recovery

1. Snapshot/validate metadata and source selection. Generate a stable new asset ID and exact canonical ref; insert a durable import intent before copying.
2. Create a unique ordinary stage file inside the same workspace. Read/copy/hash in bounded chunks with actual event-loop/cancellation opportunities. Reject empty/truncated/changed-read failures before ready metadata. Flush complete bytes; persist verified size/hash in the intent.
3. Recheck owner, lifecycle, cancellation, containment and target absence. Publish with an atomic no-overwrite operation (hard-link stage to final on the same filesystem, or an equivalent exclusive operation); remove stage, check the ordinary final file and flush its parent directory.
4. In one short SQLite transaction insert the ready asset/reference and remove the import intent. The actual transaction outcome is authoritative once it begins; later cancellation cannot describe committed work as canceled.
5. On reopen, reconcile only explicitly recorded import intents and app-owned stages. Remove incomplete owned stages/uncommitted published files under verified paths; never scan-delete unknown files or source selections. A committed row without an intent survives recovery. Recovery is idempotent. Ambiguous/corrupt cleanup state rejects or reports a focused recovery error rather than deleting unrelated content.

Failpoints are internal test hooks at meaningful boundaries; renderer IPC cannot invoke them. Permanent tests terminate actual Electron child processes before/after file publication and DB commit and reopen the same root.

## Backup and restore

Backup holds the storage operation queue, so native metadata/file mutations cannot change during the snapshot. `sqlite.backup` creates a standalone DB snapshot; enumerate required records from that snapshot, copy each ordinary managed file and compare size/hash using bounded work. A missing/corrupt required asset fails the complete backup. Reserve a new destination exclusively, stage content there and publish a strict final completion manifest only after DB integrity/record closure and every byte check pass. A destination may exist while incomplete, but it cannot be recognized as a complete backup. Final manifest publication, not directory existence, is the backup acceptance boundary. Existing destinations are never overwritten.

Restore validates strict format/schema/manifest and checks DB integrity, workspace identity, exact records/derived refs and all listed bytes, then creates a separately reserved new root. Copy and verify the restored DB/files and publish completion only after closure is complete. `open` rejects an incomplete restore. Preserve snapshot identity and refs; exclude device-local writer/profile/credentials. Existing empty or populated destination directories reject. Retrying a failed operation must never silently reuse an incomplete destination.

This DB-and-file backup is separate from checkpoint publication/provider acknowledgement. No remote service or production codec enters this slice.

## Renderer and native boundary

Trusted custom local app protocol serves only bundled fixture assets. Window: `nodeIntegration: false`, `contextIsolation: true`, `sandbox: true`, maintained web security, restrictive CSP. Deny unexpected navigation, remote resources, window opening and unnecessary permissions. Validate main-frame IPC sender and exact small command payloads. Preload exposes typed `getState`, fixture project save, native file import selection, backup/restore dialogs and reopen/refresh operations; no filesystem/SQL/shell objects or generic channels. Native dialog paths are not renderer-controlled file authority. Error handling preserves failures and shows focused messages.

Internal test mode can drive the actual bridge from the trusted renderer and capture a screenshot; it is a separate explicit test entry, not an exposed production IPC bypass. Tests also verify renderer Node absence, bridge boundaries and blocked navigation.

## Verification and limits

Add a desktop-specific strict type/lint/build/test entry. No broad root quality/debt allowance and no replacement of existing root gates. Native permanent tests run in the pinned Electron runtime with disposable roots/profiles and actual SQLite, ordinary files, multi-process writer contention and SIGKILL interruption. Record exact versions, commands, exits, assertion results and final source hashes. Independent review adds adversarial probes after implementation freezes. Run relevant existing path/hash regressions and final root types/quality/build (full tests if shared product/runtime code changes or justified by unresolved concerns).

Acceptance on this macOS host proves this slice here only. Windows/Linux, installers, microphone/audio/image/PDF/print parity, credential vault, full 49-table migration/original-history review and actual managed sync remain parent gates.
