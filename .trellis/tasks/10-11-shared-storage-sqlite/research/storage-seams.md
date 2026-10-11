# Research: complete-product shared persistence seams

- Query: Which storage operations, nested transactions and reactive queries must be abstracted to run the entire existing product on desktop SQLite without duplicating business logic?
- Scope: internal; current source, existing tests and installed dependency implementation only.
- Date: 2026-10-11

## Findings

### 1. Inventory and its limits

The current source defines **49 tables** in `src/db/database.ts:57-110`; cumulative schema declarations end at version 24 (`:311`). All table schemas, primary/secondary/unique index strings and declaration anchors are in `storage-callsite-inventory.json`.

A current-`src` scan found **1,811 `db` property references across 147 files, 219 `db.transaction` calls across 56 files, 96 `useLiveQuery` call sites across 49 files, and 57 files importing Dexie or its React hooks**. Seven additional hook files have no direct `db` property access; the inventory's unified file map therefore has 154 entries. These are source blast-radius counts, not runtime operation counts or evidence that every table is exercised by a test. Transaction counts are textual call sites. Operation/index inventory uses the installed TypeScript 5.9.3 parser and includes only chains rooted at `db.<knownTable>`; generic/delegated table helpers are explicitly listed below.

| Current domain | Tables |
| --- | --- |
| Video/project/common binary/proposals (9) | projects, episodes, characters, scenes, props, styles, shots, media, productionProposals |
| Audio/music (13) | audioChapters, audioSpeakers, audioSegments, audioTakes, audioTracks, audioClips, audioExports, musicDrafts, musicWorks, audioGenerationJobs, audioGenerationBatches, audioGenerationBatchItems, audioArrangementProposals |
| IP/material library (6) | ipProfiles, projectIpLinks, libraryMaterials, materialVersions, materialUses, materialEvents |
| Agent/chat/task/history/context/references/memory (18) | agents, agentRuns, agentTasks, agentToolCalls, chatThreads, chatMessages, contextCompactions, agentGenerationJobs, agentGenerationBatches, agentGenerationBatchItems, agentTaskRecords, agentTaskRecordVersions, agentTaskWrapups, agentTaskWrapupVersions, projectMemories, projectMemoryVersions, projectReferences, referenceChunks |
| Connection configuration (3) | connectors, connectorAliases, searchConnections |

`projectIpLinks` uses **projectId** as its primary key (`database.ts:292`). `agentTaskRecordVersions`, `agentTaskWrapupVersions`, and `projectMemoryVersions` use **versionId** (`:248`, `:252`, `:261`). A generic implementation assuming every table is keyed by `id` will corrupt these. Compound unique constraints and optional unique index values must also remain registered: tool-call identity, generation call/item/job/intent identity, record/material/memory revisions, reference revision+index, connector definition and task-thread identity. Native storage starts fresh; cumulative Dexie upgrade callbacks must not become a SQLite migration backlog.

### 2. Smallest reusable boundary

Keep **all existing `src/db` business command owners, Agent registry/loop/tool definitions, React routes and component structure**. Replace dependence on the concrete Dexie singleton with a narrow typed storage/session boundary. Implement persistence mechanisms once in browser and native adapters. This is a medium mechanical refactor across the inventory, not 49 native business repositories or a second Agent implementation.

Recommended shared interfaces:

- A typed table registry supplies row type, actual primary key and closed index definitions for all 49 current tables.
- A product store opens a read/write unit of work and passes an **explicit `StoreTx`/session** to its callback.
- Transaction-bound table/query handles expose only the operations currently needed. Prefer retaining a small familiar query grammar rather than implementing all of Dexie.
- Business helpers receive that explicit session. Nested commands join the same unit of work and cannot commit independently, expand scope silently, or promote a read-only scope to readwrite.
- Top-level named command exports remain UI entry points. They select the fixed product store once and invoke the one business recipe; Agent callers pass their already-bound session to the same recipe.
- A shared query hook observes adapter commit notifications and retains existing loading/missing/error/scope behavior.
- Binary persistence and typed storage errors are separate shared contracts; raw SQL, renderer-selected paths and credentials are not query API arguments.

For example, `executeAtomicTool(..., (tx) => createProject(..., tx))` must pass `tx` through preview revalidation, ownership helpers, project/thread binding, receipts and final tool-ledger update. A global mutable `currentTx` variable in the renderer is unsafe across interleaved async commands; importing Dexie's ambient zone into the native adapter would keep the old mechanism instead of establishing a reusable contract.

A generic **storage record table with registered table/key/index metadata** can preserve structured row payloads and offer query-oriented SQLite indexes while the TypeScript business code remains authoritative. Whether physical tables are per-domain or one registered record table is secondary to the closed table/index protocol and its tests. SQL query predicates may only come from registered grammar; arbitrary JS `filter`/`modify` callbacks stay in TypeScript over a transaction-local result/overlay, not serialized as code to Rust.

### 3. Required operation grammar

Current AST-rooted chains require the following. The JSON inventory records counts and example locations, including 97 table/index expressions.

| Area | Operations that must be supported |
| --- | --- |
| Point and bulk reads | get, bulkGet, toArray, count |
| Indexed selection | where(index), equals(scalar/compound), anyOf, orderBy |
| Collection behavior | filter, and, reverse, first, limit, sortBy, each |
| Point and bulk mutation | add, put, update, delete, bulkAdd, bulkPut, bulkDelete |
| Collection mutation | modify(object or mutating callback), selected collection delete |
| Owner/session metadata | table.name, registered db.tables equivalent, table(name) for closed table names |

Promise `then`/`catch` occurrences in the AST report are not storage grammar. There is no current requirement to implement every Dexie cursor/range API. A future unsupported method/index must fail explicitly, rather than fetching or mirroring the entire database.

Important semantics:

- `add` rejects duplicates; `put` can replace/upsert; `update` merges only supplied fields, returns the actual affected count, and does not create an absent row.
- `bulkGet` preserves input order and missing positions, including duplicate keys. Bulk mutation and collection mutation remain atomic inside their owner.
- `where` excludes records with invalid/missing index values, supports registered dotted paths (`scope.kind`, `owner.runId`) and compound keys. Optional unique values must not acquire an artificial unique empty string/null identity.
- Indexed traversal uses index order and primary-key tie ordering. `studioLibraryQueries.ts:13-15` deliberately retains the first primary-key row when shot order ties; plain unordered SQL changes project cover selection.
- `reverse().sortBy(...)` reverses the comparator as well as initial traversal. Installed Dexie implements this at `node_modules/dexie/dist/dexie.js:2137-2150`; implement and test the same contract, including stable ties and nested sort paths.
- Return fresh structured row values, not mutable aliases to the unit-of-work cache. Mutating a fetched nested object must not persist without a write operation.
- Preserve explicit clear versus omission. `projects.ts:94` stores an own property with value undefined. `productionRevision.ts:7-12` **hashes own undefined differently from an absent field**. Plain JSON.stringify loses that distinction, so a live row codec must preserve it (or apply one proven shared normalization before overlay/receipt/storage). A portable checkpoint JSON codec is not automatically a live persistence codec. Roundtrip/hash/receipt acceptance is required.

Delegated table dependencies missed by a naive `db.<table>.<method>` search include `audioShared.ts:29-61`, `audio.ts:110-147`, `materials.ts:140-141`, `AssetLibraryPages.tsx:69-70`, `agent/audioTools.ts:51-52`, `agent/imageDiscovery.ts:72/103/166`, `audioProjectPackage.ts:24`, `media.ts:20`, `productionShared.ts:51-58`, and `businessWriteReceipt.ts:114-119`. Convert their `Table<T,string>` annotations/arguments to the shared typed bound table port.

### 4. Transaction owners and the actual Agent nesting contract

The inventory lists exact transaction lines for all 56 owner files. Dominant owner groups are project/episode/shot/asset/cascade commands; all audio/music/generation/arrangement commands; IP/material/version/use commands; chat/runs/tools/task/records/wrapups/context/memory/reference commands; Agent preview/application/runtime helpers; ZIP/reference import/export/context snapshots; and studio cover snapshots. A component-level transaction also exists at `AudioWorkspacePage.tsx:191-206`: chapter creation and initial track creation are one command even though they call two existing helpers.

**The decisive Agent path:**

1. `businessTools.ts:285-293` flushes pending drafts before creating the preview read snapshot.
2. Its execution wrapper enters `executeAtomicTool` at `:307`, then re-resolves ownership and recomputes preview revision (`:309-311`).
3. `agentTools.ts:343-365` owns a root readwrite transaction over all current tables. It validates live run/thread/call, replays an already completed saved result, invokes the business command, checks Stop/result budget, and finally writes the completed tool result at `:363`.
4. Existing domain commands such as `projects.ts:35` open nested transactions. Dexie ambient joining makes their changes uncommitted members of the outer root.
5. `businessWriteReceipt.ts:95-133` re-reads newly inserted/updated rows (including initial project content) and creates the durable direct-target receipt. Failure here, or at the final tool-ledger write, must roll back the entire root.
6. Project creation can also bind the current run/thread and then return identifiers queried from freshly created episode/chapter/track/draft rows (`businessTools.ts:527-548`). This is not merely a table insert.

The shared session must preserve **read-your-writes across point reads, indexed reads, count/first/filters, deletes, cascades and receipt reads**, plus the exact saved-result replay boundary. A nested operation returning does not mean it committed.

Additional representative owner contracts:

- `PRODUCTION_TABLES` in `productionShared.ts:7-10` includes audio and historical/reference owners because recycling must share the same root as every slot/cover writer.
- `media.ts:95-107` freshly collects current and historical references after mutations, then removes actual orphans. It cannot use an earlier cached snapshot across commands.
- `audioShared.ts:51-61` checks the persisted revision, validates relationships, writes the next row and touches the project together.
- `musicGenerationReview.ts:63-71` keeps inspection and durable approval CAS together. Inspection nests tool preparation and eventually `resolveAgentToolApproval`; all participants need the same explicit session.
- `projectContext.ts:122-145` reads current project facts and writes the new Agent context in one consistent owner.
- Root scope is often broad (`db.tables`) but actual reads/mutations are specific. Broad declared scope must not force a whole-database preload.

### 5. Practical native unit-of-work implementation

An explicit session with a **lazy transaction-local read cache and write overlay, followed by one checked SQLite commit** is practical for this code. It avoids holding a Rust writer while JavaScript awaits and keeps existing business predicates in TypeScript. It is **optimistic application serializability**, not a continuously open SQLite snapshot.

Required steps and boundaries:

1. Each short native read returns registered row/query results plus storage revision guards in the same SQLite read snapshot.
2. The session tracks point row revisions, including absent keys. It tracks a table/index epoch for every predicate/range/scan, including empty matches, count and first. Row guards alone miss newly added references, siblings and blockers.
3. Subsequent reads are merged with staged additions/updates/deletes using the registered key/index semantics. Cache only this session's accessed rows; never persist a shadow IndexedDB database or preload all tables.
4. A final native command validates every guard and unique constraint and applies the complete prepared change set in a short actual SQLite transaction. The same commit contains Agent business data, changed run/thread binding, receipt/tool result, internal revisions and notifications.
5. A stale guard rejects the whole change set as a known local conflict; **do not automatically re-execute a write callback or reuse approval for changed preview content**. Preserve the local draft and let existing explicit retry/new-preview flows act.
6. A readonly unit of work validates its accumulated guards before publishing its result. Otherwise successive lazy reads can expose a torn snapshot. Any bounded restart must be restricted to explicitly pure reads; no generic retry of arbitrary callbacks, paid dispatch guards or mutations.
7. Guards must detect deletion/recreation of the same key (ABA), not reset storage version on replacement. They are internal storage revisions separate from authored domain revision fields and targetRevision tokens.
8. Session state closes on success/error; a escaped table/session handle cannot issue late writes. Concurrent root commands cannot share overlays. Read-only mode and declared table scope reject illegal accesses.
9. Distinguish actual commit success with a lost IPC reply from confirmed rollback. An operation ID/outcome receipt must permit recovery after ambiguous response; a renderer promise rejection alone is not proof that SQLite rolled back. Blindly wrapping every native rejection in existing `AtomicToolRollbackError` would grant unsafe retry semantics.

The alternative of retaining an open Rust transaction across each renderer callback would create await-held locks and abandoned transaction cleanup. Reimplementing every business command in Rust would duplicate the currently complete product and its Agent receipts. A global full-DB mirror would introduce a second owner. None is necessary for this shared boundary.

### 6. Dexie-specific ambient promises and errors

Only three non-schema runtime modules import Dexie behavior directly:

- `audioGeneration/reference.ts:30` selects `Dexie.waitFor` when hashing/validating a Blob inside an existing transaction.
- `agent/musicGenerationReview.ts:63/69` uses waitFor for local inspection.
- `audioGeneration/outputEvidence.ts:129` distinguishes database read errors from invalid media/trim relationships.

Expose a bounded local-promise/inspection helper on the session, implemented with Dexie's keepalive only by the browser adapter. Native inspection awaits have no held SQLite writer and must still retain valid read guards and immutable file identity. Paid provider/network work stays outside sessions. Existing generation preparation already hashes outside writes (`generationPreparation.ts:45-65`), and paid dispatch revalidates local ownership/material/connection state before provider POST (`generationRuntime.ts:204-223`). Preserve these seams.

Replace concrete DexieError classification with shared storage failure categories. Otherwise native failures in `outputEvidence.ts:125-130` are silently treated as invalid clips and falsely produce successful inventories. Shared categories should distinguish conflict, invalid/constraint, unavailable/IO, canceled, and confirmed rollback versus unknown commit outcome without exposing raw SQL or secrets.

### 7. Reactive queries and startup selection

Normal browser/native complete product currently constructs the same Dexie database singleton using a frozen startup profile (`database.ts:113`, `productStorage.ts:20-49`). The native SQLite reference lane is deliberately incomplete and has a separate video repository.

**Do not merely change the startup storage flag to sqlite:** `routes/_studio.tsx:16/31` then blocks the Agent/task/IP routes; `_studio.index.tsx:6` redirects away from Agent; `ProjectGalleryPage.tsx:73` blocks audio/music creation; `MaterialLibraryPage.tsx:28` switches to the limited native page; `media.ts:22/49` stops media reads/uploads; `useShotMedia.ts:14` returns no records. `videoWorkspaceRepository.tsx:30-51` declares world/generation/relations/media unavailable and selects separate native commands at `:843-846`.

The complete shared store must replace these historical reference-lane branches for the normal product. Retaining explicit prototype tests is separate; the normal product cannot accidentally select the reduced SQLite video implementation. Route availability depends on supported product functionality, not the database engine.

Implement one `useStorageQuery` boundary for the 96 direct calls and the existing video wrapper. Browser can retain Dexie liveQuery internally; native uses committed table/key notifications and dependency tracking, or conservative table invalidation initially. No durable-state global UI store is required.

Preserve: undefined loading versus null missing; previous-result retention rules; owner/dependency-key validation; stale async suppression; unsubscribe on unmount; explicit storage errors; commit-only publication. Existing video hook already demonstrates keyed result gating and request revision suppression (`videoWorkspaceRepository.tsx:852-898`), but its one custom video event cannot cover direct Agent/material/audio/settings reads. Browser's installed hook retains a previous result while resubscribing (`dexie-react-hooks/dist/dexie-react-hooks.js:38-90`). Read/write notifications must work for every adapter command, not only button callbacks; native background recovery and reopen also need appropriate invalidation.

### 8. Verification plan and blast radius

Do not write implementation during planning. Required future checks:

1. Shared adapter contract suite on real fake-indexeddb and real isolated SQLite bridge: all 49 registered primary/index definitions; point/bulk semantics; nested scope/read-only behavior; explicit undefined/null/absence roundtrip; hash stability; stable index/sort ties; clones; unique optional/compound constraints.
2. Actual shared command parity on both stores. Start with project+episode creation, initial audio chapter+track, world/slot/cover CAS, material version/use/event, memory revision, reference import, audio arrangement/undo, task record/wrapup and cascade/retention; broaden using full table/tool inventories.
3. Agent transaction proof using actual wrappers and receipts: business+ledger+binding all commit once, nested read-your-writes, failure after receipt generation rolls back everything, Stop before commit, over-budget/nonserializable result, completed replay after reopen never repeats business or paid work. Existing anchors: `tests/agentToolTransactions.test.ts:54-102`, `tests/e04MediaRetention.test.ts:13-21`, `tests/nativeRegisteredToolParity.test.ts:262`.
4. Controlled competing writers: point update/delete/recreate; insertion into an empty scan; new sibling/retaining history between read and commit; competing Stop/approval/thread deletion. No automatic mutation retry and no partial overlay publication.
5. Readonly torn-snapshot rejection/requery, dependency switch/unmount/out-of-order result, commit notification after every storage owner and error propagation. Existing scope tests include `tests/useShotMedia.test.ts`; actual WebView subscription behavior is separate evidence.
6. File integration is separately researched but must be part of the commit proof: transaction-stage binaries, no ready row before verified bytes, rollback/crash orphan cleanup, immutable mapping and missing-file behavior. Do not eagerly hydrate every Blob in gallery/Agent list scans.
7. Actual packaged normal React product restart and SQLite/file verification with disposable data, complete routes and existing Agent registry. A Rust CRUD unit test or explicit old reference frontend is insufficient full-product acceptance.
8. Keep the existing browser full-suite/configuration and tests source ownership intact. `tests/setup.ts:5-12` currently hardcodes Dexie reset/open/close; many fixtures spy on Dexie table objects/currentTransaction and should remain browser-specific evidence. Add/parameterize shared semantic harnesses for native proof instead of pretending existing fake-IDB tests also ran SQLite. Frozen source snapshots remain baseline references, not new storage owners.

Changes are concentrated in storage imports, transaction callback/session plumbing, table type helpers, direct query hooks and owner-selection gates. Business validation algorithms, UI layout and Agent tool definitions should remain shared. Storage refactoring may legitimately touch more than the 147 direct database files because session arguments travel through called helpers; this is one cross-cutting persistence change, not recreated features.

### Files found

- `src/db/database.ts` — current concrete Dexie singleton, all table types/indexes and historical upgrade declarations.
- `src/db/productionShared.ts`, `audioShared.ts` — shared transaction scopes, parent/revision/media checks.
- `src/db/projects.ts`, `media.ts`, `materials.ts` — representative nested business owners and binary/version retention.
- `src/db/agentTools.ts` — root atomic tool business/result owner, approval/replay/recovery boundaries.
- `src/lib/agent/businessTools.ts`, `businessWriteReceipt.ts` — preview revalidation and transaction-local receipts.
- `src/lib/agent/musicGenerationReview.ts`, `audioGeneration/reference.ts`, `audioGeneration/outputEvidence.ts` — keepalive/error dependence.
- `src/lib/productStorage.ts`, `videoWorkspaceRepository.tsx`, routes/components/media gates — fixed identity and retained reduced reference lane.
- `src/lib/productionRevision.ts` — revision hashing with explicit undefined and own-property identity.
- `src/lib/studioLibraryQueries.ts` — indexed cursor order and consistent cover snapshot.
- `tests/setup.ts`, `agentToolTransactions.test.ts`, `e04MediaRetention.test.ts`, `d01DependencyBoundaries.test.ts`, `d02CascadeTransactions.test.ts`, `nativeRegisteredToolParity.test.ts` — actual command, rollback, dependency and registry evidence seams.

### Related specs

Read `.trellis/workflow.md`, current task PRD, `frontend/workspace-storage.md`, `frontend/native-product-runtime.md`, `frontend/state-management.md`, `frontend/agent-write-evidence.md`, `frontend/quality-guidelines.md`, and `guides/development-change-policy.md`. Fresh development excludes old-data migration, while current business/CAS/approval/receipt/retention contracts still apply. Use frontend native-workspace/checkpoint specs together with the separate Rust/binary research when finalizing native protocol design.

### Dependency references and versions

Local package metadata reports Dexie **4.4.6**, dexie-react-hooks **4.4.0**, TypeScript **5.9.3**. Installed definitions/source were read for currentTransaction/waitFor, sortBy and reactive previous-result semantics. Official entry points for later verification: <https://dexie.org/docs/Dexie/Dexie.transaction()>, <https://dexie.org/docs/Dexie/Dexie.waitFor()>, <https://dexie.org/docs/dexie-react-hooks/useLiveQuery()>. No external technical recommendation depends on an unverified webpage in this internal-only investigation.

## Caveats / Not Found

- No product code, specs, task metadata, git state, user databases or credentials were modified/read by this research. Only this task's research artifacts were written; no tests were run or providers called.
- The inventory is a current-source audit and omits historical/frozen fixture sources. Generic aliases and code reached through passed table handles need the explicit manual list; counts do not prove semantic closure by themselves.
- A full adapter contract/codec does not yet exist. Current storage profile selection and video query wrapper are seams, not a full SQLite adapter.
- Native short-read/overlay design requires explicit concurrency and unknown-commit-outcome tests before its serializability claim is accepted. Filesystem commit durability and credentials/portable history separation are separate research topics; a SQLite row transaction alone is insufficient for those.
- Existing reduced reference-lane gates must be retired or isolated in the normal product; unchanged flags would silently remove the user's highest-priority Agent functionality.
