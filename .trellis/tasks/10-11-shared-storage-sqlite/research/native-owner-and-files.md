# Research: Native SQLite owner, managed binaries and full-product bridge

- Query: Which existing Rust workspace components can own the complete shared product, and what must change to retain transaction, file recovery, Blob, restart and missing-media behavior?
- Scope: mixed; repository source inspection plus primary Tauri/SQLite documentation. No application profile, database, credentials or provider requests were read.
- Date: 2026-10-11

## Findings

### 1. Existing implementation is a sound infrastructure reference, not a full-product database adapter

The normal product still uses the shared React/business/Agent tree with a fixed app-internal IndexedDB owner. The SQLite lane is explicitly selected and supports a video spine plus generic managed asset summaries. Its Rust commands independently implement video business mutations. Reusing those domain commands as the normal persistence port would require reproducing the rest of the existing TypeScript business rules in Rust and would preserve the reduced-feature guards that the user rejected.

Keep the tested native infrastructure, replace the fresh full-product schema and command surface, and retain one shared TypeScript business command implementation. Do not implement 95 Agent tools again as native domain commands.

| File found | Existing responsibility / reuse boundary |
| --- | --- |
| `desktop/tauri/src-tauri/src/worker.rs` | Dedicated SQLite/file-owner thread, request queue, out-of-queue cancellation and completed close barrier. Reuse for new storage jobs. |
| `desktop/tauri/src-tauri/src/workspace.rs` | Workspace initialization, exclusive writer connection, ready marker, opened-inode boundary and prototype video commands. Reuse lifecycle/boundary infrastructure; replace normal-product domain dispatch. |
| `desktop/tauri/src-tauri/src/database.rs` | Fresh schema 4, strict schema/integrity/closure validation and video row codecs. Replace the schema/row codecs for full product; retain connection and open-validation patterns. |
| `desktop/tauri/src-tauri/src/import.rs` | Source-to-managed-file copy, persistent intent journal, no-overwrite publication and identity-based rollback recovery. Generalize to binary staging plus a multi-row final commit. |
| `desktop/tauri/src-tauri/src/paths.rs` | ASCII identity-derived relative paths, canonical-root/ancestor checks, ordinary-file/inode checks, chunked hash/copy and directory sync. Reuse with all binary owner classes. |
| `desktop/tauri/src-tauri/src/desktop.rs` | Trusted packaged-caller validation, closed request envelopes, workspace generations, native picker, cancellation binding and fixture-only read/generated-byte sessions. Reuse caller/lifecycle patterns; replace fixture materialization. |
| `desktop/tauri/src-tauri/src/file_transfer.rs` | Independent OS Save, ordered 256 KiB chunks, incremental hash, two-transfer capacity, expiry and truthful post-publication receipts. Reuse protocol patterns, not the external-save ownership semantics. |
| `desktop/tauri/src-tauri/src/runtime_services.rs` | Fixed native product profile, native Save/print/external/HTTP seams. Keep system services independent of persistence and add narrowly allowed native storage commands. |
| `desktop/tauri/src-tauri/src/backup.rs` | Consistent SQLite backup plus verified managed assets and completion marker. Generalize only if full-workspace backup/restore is in the implementation scope; current video backup is not a full-product export. |
| `src/lib/nativeWorkspace.ts` | Serial TS schema-4 video adapter with shared opening and generation validation. Infrastructure example; not the full-product storage interface. |
| `src/lib/nativeWorkspaceContract.ts` | Closed schema-4 video DTOs. Do not treat these narrowed domain shapes as complete shared records. |
| `desktop/tauri/ui/bridge.ts` | Historical acceptance fixture reads/generated exports with whole-file 32 MiB limits. Test reference only. |
| `src/lib/productStorage.ts` | Validated fixed startup owner and isolated DB identity. Keep owner immutable; choose native SQLite once before product modules initialize. |
| `src/lib/workspace.ts` | Shared IDs, relative references and ephemeral browser copy stage. Preserve path/identity semantics; its Blob stage is not crash-safe. |
| `src/domain/types.ts`, `src/domain/materials.ts` | All declared durable Blob carrier types. They require native file references and a shared byte-access boundary. |
| `tests/helpers/workspaceBinaryFixture.ts` | Read-only executable inventory of binary carriers and current/history references. Useful coverage oracle, not a production codec or migration. |

Relevant anchors:

- Worker ownership is explicit at `worker.rs:35`; initialization and synchronous readiness are `worker.rs:70–142`; queue/cancel admission is `worker.rs:144–190`; all successful close callers wait for release at `worker.rs:192–228`.
- `Workspace::open` takes `BEGIN EXCLUSIVE` on a separate `writer.sqlite`, opens `metadata.sqlite`, validates identity/schema and recovers before exposing state (`workspace.rs:790–850`). This lock is for exclusive workspace-process ownership, distinct from short metadata write transactions.
- Schema 4 has `workspace`, `projects`, `assets`, `refs`, `intents`, `video_projects`, `episodes`, `beats`, `shots` and `video_undo` only (`database.rs:19–60`). Prototype projects store only `id,title`; shots omit shared media slots/extra bags (`contracts.rs:27–33`, `contracts.rs:114–138`, compare `src/domain/types.ts:333–370`). This cannot preserve full product records by serialization through the old DTOs.
- Connection setup is rusqlite, foreign keys ON, DELETE journal, FULL synchronous and a 150 ms busy timeout (`database.rs:73–90`). No SQL plugin or new database server is necessary.
- Fixed startup owner validation and immutability are `src/lib/productStorage.ts:19–50`; native profile and WK storage identity are `runtime_services.rs:276–296`. Normal setup currently selects SQLite only for the acceptance feature (`desktop.rs:1328–1343`).

### 2. Recommended workspace and storage-owner shape

Use one application-managed full-product workspace and one SQLite metadata owner, with project/studio/library binary directories beneath it. Cross-project Studio Agent/chat/library and project transactions should not be split into separately synchronized live SQLite files. Shared domain table shapes and command validators stay in TypeScript; Rust owns durable row commits, workspace identity, binary manifests and file lifecycle.

Suggested fresh root: `<app_data_dir>/product-workspace-v1`. This prevents an existing schema-4 `workspace` directory from being opened or overwritten accidentally. This is a fresh-development identity, not a migration/compatibility reader. The renderer receives the portable workspace UUID, generation and opaque binary/session IDs; it does not choose an absolute root.

The existing automatic-root precedent is `desktop.rs:668–684`; it opens/creates `<app_data_dir>/workspace` without an initial folder-selection UX. Incomplete or corrupt existing roots must still reject rather than initialize over them (`tests/storage_review.rs:315–336`). Choosing a new fresh root also avoids requiring an old IndexedDB/profile read. Keep native credentials/configuration in explicitly **device-local table/field scope inside the same private SQLite metadata owner**, excluded from portable projections. Existing commands such as `saveSearchConnection` atomically span a device connection and Agent configuration (`src/db/searchConnections.ts:11–30`); splitting those records into a separate physical store would require a proven transaction-coordination design rather than an assumed two-store commit. Logical portable/device separation does not require physical database separation. Neither the raw SQLite file nor its credentials may be synchronized.

Retain one process lock for the full-product workspace and one dedicated storage worker. Distinguish these identities:

1. **Workspace identity:** persistent portable UUID.
2. **Open generation:** device-local lifecycle epoch; stale renderer replies/session capabilities fail after reload/close/reopen.
3. **Committed data revision:** monotonic counter(s) advanced with the successful metadata transaction, used for CAS/read-set validation and reactive invalidation. The current generation advances only for lifecycle transitions, not row writes (`desktop.rs:433–522`), so it is not sufficient as a data revision.

The native bridge must use allowlisted table names/typed query operations and a closed versioned envelope, never authored SQL, absolute paths, plugin command names or arbitrary file URLs. Reuse the exact bundled-main-window validation (`desktop.rs:323–343`). Retain hash-fragment routes rather than weakening this origin/path ACL.

### 3. Full-product transaction bridge needs a deliberate protocol

The worker currently runs one complete Rust `Job` to completion. It has no scoped TS-callback transaction, generic table repository, row-query protocol or full-product change event. Extending only the constructor or `NativeWorkspaceAdapter` does not bridge the existing transaction owners.

Recommended low-level native capabilities:

- Initialize/close an immutable workspace session.
- Read allowlisted domain rows and their versions under a consistent transaction/snapshot boundary.
- Commit an allowlisted insert/update/delete write set with read/absence/query-version preconditions in one short SQLite transaction.
- Claim already verified binary stages in that same final transaction.
- Return a durable commit receipt plus changed table/key revision metadata only after commit; publish reactive invalidations from this receipt.
- Inspect an operation receipt after an uncertain IPC result. Never repeat the original mutation automatically.

The shared adapter can expose transaction-scoped tables to the existing business commands, with an ephemeral write overlay and native atomic commit. It must validate the complete read set, including absence and collection membership, so a concurrently inserted/deleted row cannot evade CAS. A coarse per-table counter is a correct first implementation if it is explicitly accepted as conservative conflict behavior; entity/query scope optimization can follow. Snapshot transport must be paged or leased consistently, not successive unversioned reads. The overlay is transient computation, never a durable IndexedDB mirror or alternative authority.

Alternative scoped native transaction leases can preserve read-your-writes with fewer optimistic conflicts, but they require strict exclusive request admission, timeout/abandon cleanup and explicit context propagation through nested/parallel TS calls. A global ambient `currentTransaction` and a worker transaction spanning unrelated requests are unsafe. Decide the shared transaction contract before implementation; this report does not assert that either alternative already exists.

Keep provider requests, Blob copying/hashing, audio decoding/mixing and external OS Save outside metadata write transactions. Never auto-rerun a transaction callback containing an external effect. Existing paid-result/local-stage semantics must survive:

- Returned speech bytes and `remote-completed` job state are stored together **before audio decoding**, allowing local recovery without another paid request (`src/lib/audioGeneration/runtime.ts:229–246`).
- Image/video result media and job `downloaded` state commit together (`src/db/agentGeneration.ts:53–68`).
- A recording take and its new media commit together (`src/db/audio.ts:110–134`).
- Music work/media commit together (`src/db/music.ts:81–93`).
- A rendered WAV and AudioExport record commit together (`src/lib/audio/exportMix.ts:13–31`, `src/db/audio.ts:110–134`). Canceling external Save must leave this owned output available.

These are storage-level atomicity requirements, not invitations to duplicate their business rules in Rust. The companion query/transaction inventory owns the complete table/operator list.

### 4. Every declared durable binary carrier

Searching domain types finds two Blob declarations, with three concrete owned locations:

| Durable carrier | Logical identity / required native mapping | Source anchors |
| --- | --- | --- |
| `media.blob` | Independent immutable media identity, project or `studio` owner; bytes referenced by images/video/audio/documents/recordings/results/outputs | `src/domain/types.ts:362–370`; fixture `workspaceBinaryFixture.ts:93–97` |
| `materialVersions.payload.blob` when payload type is `file` | Immutable library material-version file; owner may be global/IP/project and is independent of a live media row | `src/domain/materials.ts:28–55`; fixture `workspaceBinaryFixture.ts:98–108` |
| `materialVersions.payload.media[].blob` when payload type is `setting` | Immutable snapshot media per material-version and embedded media ID; current project media deletion must not erase this version | `src/domain/materials.ts:47–55`; fixture `workspaceBinaryFixture.ts:110–122` |

Use an explicit binary manifest with a new immutable binary ID, workspace ID, owner class/key, generated relative path, byte length, MIME and SHA-256. Preserve authored media IDs and material-version identities separately. A material snapshot cannot point only to `media:<id>` if that live row can be deleted. A native generated file path must also be derived for global/IP/material-version owners, beyond the current project/studio-only `derive_ref`. Global/IP path layout is an implementation design choice; it must have strict deterministic owner validation and preserve case/Unicode identity distinctions.

Do not scan arbitrary JSON/`extra` values for any object with a `blob` property. Explicit codecs should externalize these known binary fields, and reject unsupported non-JSON values at the storage boundary. Arbitrary author-controlled extension bags are not a path/Blob capability grant.

Important reference classes are already enumerated at `workspaceBinaryFixture.ts:124–211`: covers; setting/shot slots; reference documents; material uses; recording takes; audio exports; music works; speaker/reference audio; generation jobs and batch input/result snapshots; arrangement embedded take snapshots, before/receipt membership; production proposals; generation job/batch before/result histories. Embedded material snapshots are separately resolved at `workspaceBinaryFixture.ts:213–221`.

The current live-media orphan logic additionally preserves production/generation history (`src/db/media.ts:66–109`). It is not a complete physical-file garbage collector. Native file reclamation must include immutable material versions and every current/history/snapshot link before deletion. The safe first version is logical row deletion plus retained unreferenced bytes, matching the already declared native project-delete behavior; this does not promise disk reclamation. Cleanup of known failed stages is distinct and may be recoverable immediately.

### 5. Generalize import recovery to staged binaries and multi-row commit

The existing import journal establishes the useful order:

1. Validate owner/new immutable ID and source; insert a durable `intents` row before stage creation (`import.rs:55–117`).
2. Create a fresh stage, fsync stage/directory and record device/inode provenance (`import.rs:120–127`).
3. Copy/hash in 256 KiB chunks with cancellation outside the final metadata transaction; check source identity/size/mtime (`import.rs:128–168`).
4. Recheck owner/boundary/verified stage; no-overwrite hard-link to the owned final path, fsync destination directory, remove the stage and fsync stage directory (`import.rs:170–190`).
5. Verify final file; atomically insert asset/reference rows and delete the intent, rechecking owner and file identity before actual SQLite commit (`import.rs:193–220`). A late cancellation cannot relabel a committed result.

Generalize this mechanism to:

- Native-picked source imports and renderer-originating Blob streams (generated images/video/audio, recording, ZIP-import contents, immutable library copies).
- Stage preparation without a ready domain record, then a final shared business write set that atomically claims one or several verified binaries and commits the relevant media/library/result/job/ledger rows.
- A versioned intent state and binary manifest sufficient to distinguish staged, published-but-unclaimed and committed bytes after process death. Claims and intent transition/removal belong in the same SQLite transaction as rows.
- Already-committed binary references can be reused by immutable material/version cloning without rereading or republishing bytes; independent ownership manifests prevent accidental deletion.
- Stop before final commit discards/reconciles only proven uncommitted bytes; Stop after commit returns committed receipt. Unknown result must be reconciled, not silently retried.

Current recovery refuses ambiguous committed/pending identities and removes only stage/final paths proven by canonical intent, owner/path and recorded device/inode/link count (`import.rs:223–295`). Preserve that refusal policy; never sweep an entire staging directory or unlink files based solely on a pathname. The real-kill tests retain an unknown file across recovery and prove idempotence (`tests/native_workspace.rs:868–910`).

SQLite cannot make a normal filesystem unlink rollback with row changes. File publication-before-row commit plus intent recovery gives an all-or-no-ready-row contract, not an OS-level atomic combined file/SQLite transaction. State this accurately. Crash injection must cover multi-binary commits at every point, including receipt publication and acknowledgement loss.

### 6. Reading/playback must not inherit fixture materialization or limits

The schema-4 native storage import limit is **16 GiB**, the prototype per-table bound is **10,000 rows**, the manifest bound is **16 MiB**, and the chunk size is **256 KiB** (`contracts.rs:13–17`). Separately:

- `desktop.rs:21–22` limits fixture UI bytes to 32 MiB and read sessions to four.
- Fixture `ReadStart` reads/validates the whole file before returning a session and retains it in `Arc<[u8]>` (`desktop.rs:43–47`, `desktop.rs:525–551`, `desktop.rs:1069–1092`). Chunking this cached array is not streaming from disk.
- The fixture TS reader then allocates another whole-file `Uint8Array` and creates a Blob (`desktop/tauri/ui/bridge.ts:193–230`). Generated bytes are sent as one JSON number array (`bridge.ts:222–243`; `desktop.rs:1137–1204`).
- `readChunk` rereads full workspace state for each chunk (`desktop.rs:1099–1107`). `database::validate` runs SQLite integrity/schema/row materialization (`database.rs:103–178`) each time `Workspace::state` is called. Retain full checks at open/diagnostic/backup boundaries, not normal query/chunk paths.
- Independent product Save already avoids the 32 MiB blanket cap and streams ordered chunks with two concurrent transfers (`file_transfer.rs:17–20`, `file_transfer.rs:185–281`). Borrow its bounded transport/checksum/lifecycle patterns.

The new binary access seam should provide metadata/availability separately from bytes, scoped read sessions with bounded chunks and cancellation, and reusable playback URLs where needed. Native chunks should use raw IPC `Response`/raw request bodies where supported, reducing JSON byte-array overhead. A complete Blob may still be required by audio decode, PDF/image processing and current supplier upload contracts; that operation remains proportional to requested media size and existing domain budgets. Metadata lists, timeline rows and unplayed video must not eagerly reconstruct every Blob.

Video/audio HTML playback should use a workspace-scoped opaque URL backed by a managed file reader with byte-range support, or an equivalently bounded loader selected during implementation. A custom protocol is a new surface requiring exact opaque-token/session validation, containment, correct MIME/length/range responses, revocation and narrow CSP changes; do not replace it with unrestricted `file://` or renderer absolute paths. Range protocol is a recommended implementation design, **not an existing tested capability**.

Existing consumers demonstrate why a genuine shared binary accessor is necessary:

- `src/lib/media.ts:20–42` directly makes object URLs from `record.blob`; it currently skips all SQLite media queries. `media.ts:45–64` rejects SQLite uploads. Remove those reference-lane shortcuts when full SQLite becomes the normal owner.
- `src/lib/audio/buffers.ts:19–27` decodes `record.blob` and caches by media ID.
- `src/db/media.ts:116–129` validates Blob size inside slot ownership checks.
- `src/db/materials.ts:64–72`, `src/db/materials.ts:304–335` access file/snapshot Blobs and use a 512 MB library-domain cap, which is independent of the native prototype limit.
- `src/lib/projectPackage.ts:190` adds media Blobs to ZIP exports.

A search on this source checkpoint finds 107 `.blob` references across `src/lib`, `src/components`, and `src/db` (text count, not 107 unique modules). Replacing Blob storage entails a mechanical byte/URL consumer adaptation while retaining shared feature behavior. Do not create fake `Blob` subclasses that return file metadata but cannot satisfy `URL.createObjectURL`'s actual bytes.

### 7. Missing/corrupt media and external file edits

The native worker already retains exact logical state while reporting `present`, `missing` or `corrupt` based on hash/length (`workspace.rs:1695–1724`; regression `tests/native_workspace.rs:378–407`). Keep this distinction in the complete product:

- An absent file retains domain row, media mapping, timing, owner/history and original filename; only its availability/read operation fails.
- A mismatched or changed file is corrupt/unavailable; never incorporate externally edited binary bytes as authoritative record changes.
- A metadata query remains readable even if one of its referenced files is missing. Do not make eager Blob hydration reject the entire project/library/history query.
- Playback, export, provider inputs and audio rendering report missing/corrupt media clearly and retain the rows. They do not silently invent empty Blob contents, remove clips or resubmit a paid generation request.
- Cache identity must include immutable binary identity and workspace/open generation. Availability changes must invalidate playable URLs/decode cache; otherwise deleting a managed source while an old decoded buffer is cached may incorrectly keep export looking successful. Declared MIME, size, hash and a cached Blob/buffer are insufficient evidence of current file availability: perform an actual native existence/identity/integrity check before claiming a current result playable, exportable or ready as provider input, and revalidate at the actual byte-read/publication boundary. A stale cache may be a UI preview convenience, but it must not silently pass a missing/corrupt source through current-result evidence or durable output validation.

Software-authored metadata is SQLite authority. Future JSON manifests/projections can be regenerated from it. No external project-file watcher/import is required by this task. The user explicitly permits overwriting external manual metadata edits on next save, but that does not authorize overwriting arbitrary changed binary files or broad destructive cleanup.

### 8. Locks, reopen, path limits and platform caveats

- `Boundary` captures root, metadata DB and writer DB device/inode and validates before native operations (`workspace.rs:701–744`, `workspace.rs:855–859`). Managed ancestors reject symlinks (`paths.rs:141–178`); managed ordinary files reject foreign hard links (`paths.rs:85–104`).
- Lowercase UTF-8 hex identity components preserve exact IDs on case-insensitive/Unicode-normalizing filesystems (`paths.rs:14–40`, shared `workspace.ts:46–90`). Rust rejects path components over 240 bytes or total paths over 1024 bytes (`paths.rs:51–67`). Shared TS refs currently lack those filesystem-length limits; new native codecs must validate the actual bound before publication rather than promise all 4096-byte domain IDs become filenames.
- The code explicitly admits hostile replacement between checks and OS open as outside proven prototype protection (`workspace.rs:855–859`). It does not implement directory-handle/openat race-proof containment. Preserve ordinary local fault/symlink protection and do not overstate hostile concurrent filesystem security.
- `paths::inode` is currently Unix-only. On non-Unix it returns `platform` (`paths.rs:70–83`). File directory fsync and hard-link publication also need actual Windows validation. This task can prove macOS, keep contracts portable and record Windows/Linux acceptance separately; it cannot claim production cross-platform readiness from macOS checks.
- Real second-process contention/death recovery exists at `tests/native_workspace.rs:968–984`. Close races are covered at `tests/storage_review.rs:108–161`, `tests/storage_review.rs:203–239`. Keep and extend these for transactions, stages, read URLs and normal app restart.
- Current Save sessions are released on window destruction and new page-load start (`desktop.rs:1355–1365`); product storage sessions need equivalent generation-bound cleanup without falsely canceling a commit that already won. Native worker ownership must be released on actual application shutdown, not simply on a successful UI promise.

### 9. Backup and synchronization boundaries

The existing backup uses rusqlite's consistent online backup API, verifies copied assets against frozen manifests, and publishes `backup.complete.json` last (`backup.rs:13–82`). Restore reserves a fresh destination, verifies schema/database/assets and publishes `workspace.ready.json` only after copied files pass (`backup.rs:130–171`). These patterns are worth preserving for a future full-product backup; their exact current schema/asset list is prototype-only.

Future sync must consume a reviewed portable snapshot/checkpoint, never copy a live SQLite file and sidecars into a cloud-sync folder. Native device-only execution authority/credentials cannot be made portable by backing up the raw local database. Actual provider/plugins/cloud sync are outside this task. Do not claim that adding SQLite files itself delivers synchronization.

### 10. Necessary implementation acceptance points

1. Fresh normal packaged product selects SQLite, opens one native root and never instantiates/queries a product IndexedDB mirror; browser remains on its own IndexedDB adapter. All current full-product routes/tools retain shared implementations.
2. Real native SQLite fixtures exercise multi-table business mutations, approval/ledger/result atomicity, nested/read-your-writes semantics, missing/absence/query conflicts and rollback without partial reactive events.
3. Real disk file stages cover the three declared Blob carriers, renderer Blob import, native picker import, generated result, recording, mixed WAV and ZIP import; verify bytes/hash after application exit/reopen, source deletion and same-name independent imports.
4. Kill the process before stage creation, after partial copy, before/after publication, during final multi-row transaction, immediately after commit and before renderer receipt. Reopen twice; no ready partial record, no lost committed result, no paid replay, no deletion of unknown files.
5. Multiple-stage final claims, abandoned stage expiry, cancel, closing/reloading renderer and live second-process lock contention all preserve correct committed outcome and release capabilities.
6. At least one media/export above 32 MiB proves that prototype fixture limits do not constrain normal product; metadata lists/timeline/media URLs do not eagerly hydrate unrelated files. Existing domain-specific limits remain meaningful.
7. Delete or corrupt a managed binary and reload. Logical media/material-version/history/timing survives, correct missing/corrupt feedback appears, and blocked playback/render/provider/export does not auto-regenerate paid work.
8. Exercise independent external Save cancel, saved receipt and post-publication warning after a durable owned mix/result. Those outcomes must not alter internal persistence authority.
9. Preserve existing open integrity/schema ready marker, actual writer lock, source independence and path/hard-link protections; new fresh schema rejects schema4 without opening/importing it or deleting old data.
10. Product source/spec/test inventory is authoritative. Actual macOS packaged persistence/read/playback evidence is required in addition to Rust/unit mocks; other OS acceptance remains explicitly unverified.

## External References

Locally pinned versions: `desktop/tauri/src-tauri/Cargo.toml:28–36` uses rusqlite `=0.40.2` with bundled SQLite/backup, Tauri `=2.12.2`, dialog `=2.8.1`, HTTP `=2.8.2`, opener `=2.5.4`; `desktop/tauri/rust-toolchain.toml:1–4` pins Rust `1.99.0`. Keep these dependencies; a storage port does not require switching to Tauri SQL plugin or installing a server.

- [Tauri: Calling Rust from the Frontend](https://v2.tauri.app/develop/calling-rust/) — checked 2026-10-11. Official command docs support raw request bodies, raw `ipc::Response` return buffers and chunk delivery through channels. These mechanisms improve bounded binary transport but do not supply application-specific cancellation, path authority, byte-range playback or transaction semantics.
- [SQLite: Atomic Commit](https://www.sqlite.org/atomiccommit.html) — checked 2026-10-11. SQLite's rollback-journal commit protects database page updates; the application still needs intent recovery for separately published normal files.
- [SQLite: Transaction](https://sqlite.org/lang_transaction.html) — checked 2026-10-11. Nested BEGIN transactions are unsupported; SAVEPOINT is the native nesting primitive. A TS storage facade must explicitly map its own nesting semantics.
- [SQLite: Online Backup API](https://sqlite.org/backup.html) — checked 2026-10-11. The backup API creates a consistent snapshot of a live source database; this does not by itself freeze external media files.

## Related Specs

- `.trellis/spec/frontend/native-workspace.md:5–61` — explicit reference lane, closed IPC, trusted roots, generation, fresh schema, managed copies and logical deletion.
- `.trellis/spec/frontend/workspace-storage.md:15–27` — exact identity/path semantics, prepare outside transactions, commit wins late abort and native recovery requirements.
- `.trellis/spec/frontend/native-product-runtime.md` — one shared full-product tree, fixed owner selection, native HTTP/Save/print and truthful publication feedback. The current IndexedDB wording must be updated only as part of approved implementation/spec work.
- `.trellis/spec/guides/development-change-policy.md` — fresh development by default; no old-data compatibility/migration unless explicitly requested.
- `.trellis/spec/frontend/checkpoint-protocol.md` — reviewed portable versus device authority; SQLite local files are not portable history permissions.
- Task PRD — full product, native priority, browser retained, managed copies, reviewed tool history, no legacy migration and no sync/provider implementation.

## Caveats / Not Found

- Planning research only. No code was implemented and no new tests or application acceptance were run. Existing test source assertions establish reusable patterns, not proof of a future full-product schema/adapter.
- The existing worker has no complete shared table/query/reactive adapter, full-product snapshot/commit protocol, multi-binary stage claim, durable operation receipt, or disk-streaming playback URL.
- The recommended query/read-set protocol and bounded binary access seam are new work. Their exact API must align with the companion full query/transaction inventory before implementation; do not promise a zero-change Dexie constructor swap.
- All declared binary fields were identified from domain types and the fixture helper. Arbitrary runtime `unknown` payloads or user-authored extension bags require an explicit storage-codec review rather than assuming the domain type search proves serialization completeness.
- The exact pinned Tauri `2.12.2` docs.rs Builder page could not be retrieved during this research. Raw IPC mechanisms are verified in current official Tauri v2 docs; any new custom-protocol signature must also be checked against locally pinned crate source before coding.
- The source is Unix-oriented for file identity and the retained prototype explicitly limits its demonstrated containment protection. Windows inode/locking/directory-sync/hard-link and actual media range behavior remain platform work unless added and verified in a separately approved scope.
- No old workspace/IndexedDB/profile was read. Native connection configuration and runtime-state separation are owned by the companion device/portable field audit.
