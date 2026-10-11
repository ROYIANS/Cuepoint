# Shared storage interfaces and native SQLite integration

Status: approved for implementation on 2026-10-11. After task creation/research and the concrete artifacts were prepared, the user explicitly granted full responsibility and automatic approval: “我睡了，你v全权负责吧，自动批准”. The final scope was displayed for review; this authorization applies to the reviewed existing scope without a redundant approval request.

## Goal and user value

Make the complete existing desktop product persist through SQLite and application-owned workspace files, retaining one shared React UI, business-command and Agent implementation. Users can keep working with all existing functions and reopen durable content without a browser database dependency. Browser remains usable through its IndexedDB adapter. This creates the local persistence boundary required by later synchronization.

## Background and evidence

The preceding full-product child is accepted and archived; normal Tauri currently runs the entire shared product through an isolated internal IndexedDB store. The older schema-4 SQLite lane supports only a video reference catalog and cannot substitute for full-product persistence. See `src/lib/productStorage.ts:19`, `src/db/database.ts:57`, and the archived `10-11-native-world-shot-relations` artifacts.

The complete source inventory identifies **49 durable tables, 219 transaction call sites, and 96 reactive query call sites**. These are planning blast-radius counts, not executed coverage. The registry has `projectId` and `versionId` primary keys as well as `id`, compound/optional unique indexes and primary-key ordering ties. See `research/storage-seams.md` and `research/storage-callsite-inventory.json`.

Binary storage has three declared carrier locations: media Blob, material-version file Blob and setting-version nested media Blobs (`src/domain/types.ts:362`, `src/domain/materials.ts:28`, `tests/helpers/workspaceBinaryFixture.ts:93`). Native infrastructure already provides a worker, exclusive workspace lock, containment checks, verified file publication and intent recovery; its full-product row/query/binary bridge still needs implementation. See `research/native-owner-and-files.md`.

Agent business mutations and completed execution evidence share a nested transaction today (`src/db/agentTools.ts:343`, `src/lib/agent/businessWriteReceipt.ts:95`). Local continuation fields are required for explicit same-device resume, and connector/settings changes have cross-table atomicity (`src/domain/agent.ts:202`, `src/db/searchConnections.ts:12`). Those current contracts differ from the future portable-history exclusions; see `research/agent-state-and-device-boundaries.md`.

## Requirements

| ID | Required behavior |
| --- | --- |
| R1 | Preserve all existing pages and functionality: projects/video, four world entities, global IP/material/version/use history, references/memory, audio/music, generation and batches, settings/connections, chat/Agent/tasks/approvals/tool execution/history. UI and business rules remain shared; no reduced native domain list or second Agent. |
| R2 | Desktop uses SQLite as its sole durable record owner, with internal workspace files for binaries. Browser retains IndexedDB through the same application storage boundary. A failure cannot switch owner, mirror writes or create another catalog. Startup remains automatic inside application data. |
| R3 | Preserve transaction/CAS/uniqueness/ordering behavior, nested read-your-writes, atomic business-plus-receipt/ledger and media-plus-job records. Failed writes create no partial success state. Uncertain commit acknowledgement is reconciled truthfully and does not imply rollback or authorize replay. |
| R4 | Persist and reopen complete current local records losslessly, including explicit cleared fields, original tool argument/result strings, chat, approvals, errors, task versions and same-device continuation state. Current revisions/receipts remain identical after reopen. Relaunch/refresh alone cannot approve, claim, submit or retry paid work. |
| R5 | Copy imported/generated/recorded/retained bytes into the workspace and cover all three Blob carriers and their historical references. Removing an original source is harmless. Missing/corrupt managed bytes keep logical rows, references/timing/history and show unavailable material; metadata listings stay readable. Availability evidence uses actual byte checks, not placeholders. |
| R6 | Preserve live page updates, drafts, loading/missing/error distinction, cancellation, existing system Save and native runtime behavior. Native IPC, file reads/writes and metadata queries remain bounded and cannot require full-library binary hydration or full integrity scanning for each query. |
| R7 | Start fresh without reading, migrating, upgrading, backfilling, mirroring or deleting existing IndexedDB/schema-4 prototype data. Existing browser compatibility internals are not a mandate to build native compatibility. No secret/profile import is implicit. |
| R8 | Classify content versus device-only secrets/preferences and mixed execution fields. Keep current local atomicity and configuration behavior; future sync must consume reviewed projections, never the live database. Preserve music variant/draft associations as product data while session-only UI preferences remain local. |

## Acceptance criteria

| ID | Observable result | Requirements |
| --- | --- | --- |
| AC1 | Every registered table/key/index and current query/mutation operation passes the shared adapter contract suite on IndexedDB and the actual Rust SQLite bridge, including optional/compound uniqueness, ordering ties, clones, own-undefined/omitted/null and receipt-hash roundtrip. | R2–R4 |
| AC2 | The same existing shared command and registered-tool fixtures execute against both stores; all product domains and every registered tool contract have explicit coverage. The normal native product has no engine-dependent feature-denial guards or hidden IndexedDB reads. | R1–R2 |
| AC3 | Failure after nested business changes or receipt generation rolls back business, bindings and completed ledger together. Point/absence/phantom/delete-recreate/uniqueness races reject atomically. Read-only snapshots do not expose mixed versions. | R3 |
| AC4 | Native process death/renderer acknowledgement loss around commit is reconciled by durable operation evidence. Reopening preserves the committed result and never replays a mutation or paid request. Explicit continuation uses the saved completed result once. | R3–R4 |
| AC5 | Actual managed files for all three binary carriers, audio/music/generation outputs and copied package imports survive process exit/reopen and original-source deletion with matching bytes/hashes. Interrupted/canceled multi-file stages leave no ready partial row and recover idempotently without deleting unknown files. | R5–R6 |
| AC6 | Removing/corrupting a managed file preserves its metadata/history/slots/timings while playback/export/provider input and completion evidence report unavailable bytes. Storage read faults propagate distinctly. Cached previews/decoded audio cannot create false current availability. | R5 |
| AC7 | Commit notifications update existing shared pages and Agent views; rollback emits no success update. Subscription races, reopen generations and unmounts are covered. Lists do not reconstruct unrelated media, and at least one actual media read/export above the old 32 MiB fixture cap succeeds under current domain limits. | R1, R6 |
| AC8 | The actual packaged macOS product runs fresh project, global library/IP, video, audio/music, references/memory, settings and Agent/task/history flows and restores their state after relaunch. Shared UI/navigation/Save/Stop behaviors remain intact; fixture-provider and genuine-provider evidence are labeled separately. | R1–R6 |
| AC9 | Fresh native startup uses the explicit new workspace identity, rejects corrupt/unsupported roots without overwriting them, respects the exclusive process lock and containment checks, and does not access browser/previous native data. Device keys stay out of portable artifacts/logs. | R2, R7–R8 |
| AC10 | Required frontend/native quality, type, test and build gates pass; an independent complete-scope review and table/domain/tool/binary evidence matrix have no unexplained exclusions. macOS versus untested Windows/Linux evidence limits are explicit. | R1–R8 |

## Out of scope and deferred items

Cloud synchronization, full portable-history codec/application, provider deployment/accounts/quotas, plugin marketplace, arbitrary plugin/native code, concurrent collaboration, Git/SVN, production migration, historical schema compatibility and automatic external file ingestion are excluded. The future target remains one person switching devices sequentially.

OS keychain/encryption-at-rest and user-facing physical file GC are separate work. Logical deletion may retain unreferenced verified files. External Save is a copy operation; this task does not invent durable records for every temporary export. Cross-platform design is retained, but actual Windows/Linux filesystem/media/installer acceptance requires those hosts and is not represented by macOS evidence.

No new screen design or mandatory folder-picker flow is needed. Real model/provider acceptance, if a storage interaction requires it, uses a freshly configured isolated connection; previous secret profiles are not read or copied. Tests use disposable current fixtures rather than developer data.

## Planning readiness

Known user decisions are resolved in the existing conversation and parent contract. There are no blocking product questions. Technical contracts, ordered validation and execution gates are recorded in `design.md` and `implement.md`; independent planning findings are corrected and recorded in `research/planning-signoff.md`. The user explicitly authorized autonomous execution/automatic approval, and the final concrete scope was presented for review before activation.
