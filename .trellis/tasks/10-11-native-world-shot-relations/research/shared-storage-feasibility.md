# Research: Shared TypeScript storage and native SQLite feasibility

- Query: Can existing TypeScript Agent/business commands run over a shared typed storage abstraction with native SQLite, avoiding per-feature Rust business reimplementation?
- Scope: internal feasibility research; source inspection only, no implementation, test/build, dependency or network work.
- Date: 2026-10-11
- Status: planning; user direction is reuse existing Web logic, rapid desktop parity, Agent/AI first. No architecture choice or implementation is silently authorized by this report.

## Findings

### Source evidence

| File / anchor | Observed behavior |
| --- | --- |
| `src/db/database.ts:53` | `AifenjingDB extends Dexie`; typed table properties, versioned schema and structured IndexedDB values. Existing schema/history code is not an engine-neutral database abstraction. |
| `src/db/agentTools.ts:342` | `executeAtomicTool` opens one `rw` transaction over `db.tables`, validates run/project/call, executes callback, checks cancellation/result size, and marks call completed with serialized result before commit. |
| `src/db/agentTools.ts:353` | Completed calls replay their exact saved result without invoking the mutation callback. |
| `src/db/projects.ts:19` | Project creation owns a nested domain transaction with initial child creation; it is callable inside an outer tool transaction. |
| `src/db/shots.ts:72` | Multi-add reads project/episode/beats/shots, computes ordering/numbering, writes moved/created rows and touches parent within its transaction. |
| `src/lib/agent/businessTools.ts:307` | Atomic tool callback repeats scope/revision validation, captures deletion evidence, invokes existing business command and constructs its committed write receipt. |
| `src/lib/agent/businessWriteReceipt.ts:95` | Receipt construction rereads committed domain rows inside the outer transaction; result/receipt size failure must roll back both rows and ledger. |
| `tests/agentToolTransactions.test.ts:51` | Actual nested command + ledger commit, durable reopen replay, ledger-write-failure rollback, cancellation rollback and oversized-result rollback are existing product guarantees. |
| `src/db/agentRuns.ts:68` | Agent start uses all tables and a coherent history/task/run/project snapshot, not only one chat table. |
| `src/db/agentGenerationBatches.ts:108` | Batch preparation runs through the same atomic tool owner; later claim/apply/retry commands have independent transaction boundaries. |
| `src/db/connectors.ts:7`, `:44` | `orderBy(...).reverse()` and predicate callback `modify` are real Dexie constructs used in business code. |
| `src/db/projectMemories.ts:107` | Compound-index `[id+revision]` query supports revision-specific retrieval. |
| `src/lib/agent/audioGenerationTools.ts:268` | `anyOf` queries two connector definitions. |
| `src/db/assets.ts:226`, `:286` | JS callback `modify` performs relation cascades, including deleting/clearing nullable fields. |
| `src/lib/agent/musicGenerationReview.ts:63` | Explicit `Dexie.waitFor` retains a consistent transaction during local asynchronous review/revalidation; nested approval transaction at line 68. |
| `src/domain/types.ts:369` | `MediaRecord.blob` is a real Blob. Native managed files currently use a different byte owner, not JSON Blob serialization. |
| `src/db/agentTools.ts:62`, `src/db/projects.ts:156` | Explicit `undefined` updates and property deletion clear saved fields. JSON stringify omission is not equivalent to patch unset. |
| `src/components/agent/AgentGenerationResults.tsx:20` | Dexie `useLiveQuery` query includes owner filter + callback filter + sort, so changing writes alone does not connect UI reactivity. |
| `src/lib/videoWorkspaceRepository.tsx:860` | Existing runtime-specific query hook retains browser live queries and native invalidation separately. |
| `src/lib/nativeWorkspace.ts:292` | Native bridge queues **individual** closed actions, validates reply/result kind then accepts generation. It has no composable outer cross-domain transaction. |
| `desktop/tauri/src-tauri/src/workspace.rs:855` | Existing native video operations implement domain ordering, validation, cascades and undo separately from TypeScript `src/db/*` business commands. |

### Verdict

**Feasible, with a deliberate refactor.** The React UI and most Agent orchestration/model/permission behavior can remain shared. To reuse existing command bodies rather than rewrite their business rules in Rust, storage operations and transaction composition must become explicit engine-neutral dependencies. Existing `db` imports, Dexie query chains, nested transaction behavior, live queries and Blobs prevent a literal “change database constructor and everything works” claim.

The important reuse boundary is below business decisions: TypeScript computes valid domain changes, guards, revisions, tool results and write receipts once; Rust remains the local SQLite/file owner, validates a closed table/action codec and atomic commit preconditions, and enforces structural ownership/security. Some validation intentionally exists in both layers because renderer input is not the native authority; that is different from duplicating every feature’s numbering/cascade/workflow logic.

### Approach comparison

| Approach | What is shared | Work and limitations | Assessment |
| --- | --- | --- | --- |
| 1. Feature repositories plus shared TS transformations and typed atomic native plans | Pure field/order/cascade calculations, command schemas, UI and Agent orchestration | Each feature needs its read/write repository and a way to compose all domain writes + tool ledger into one plan. Current per-feature actions do not compose; simply extracting pure helpers leaves transaction/flow duplication. Useful for a few features, costly for rapid whole-product parity. | Viable incremental bridge, but not the minimum long-term abstraction for the user’s new goal. |
| 2. Minimal typed app-storage facade with explicit transaction-scoped context | Existing TS commands and Agent atomic owner after changing storage dependencies/query forms | Introduce table registry + bounded typed operations + transaction context; refactor nested commands to accept/share it. Browser adapter wraps Dexie, native adapter owns SQLite read/commit. Query hooks need a shared invalidation owner. Full parity still requires inventory/codec/media work. | Recommended candidate. Lowest honest complexity that can avoid separate domain implementations while preserving existing atomic behavior. |
| 3. Pretend full Dexie API over IPC | Superficially unchanged call sites | Would need emulate collections/index chains, compound/multi-entry indexes, JS filter/modify callbacks, nested ambient transactions, transaction-scoped promises, `waitFor`, liveQuery tracking and structured clone. JS callbacks cannot be sent to Rust. Per-call IPC loses outer atomicity, and a singleton ambient transaction is unsafe under concurrent async work. | Reject as a promise or shortcut. A intentionally limited API may look familiar, but it must not claim Dexie compatibility. |
| Temporary all-Web-in-Tauri IndexedDB | Existing Web data owner, complete TS commands/UI/Agent with least code change | Keeps WebKit IndexedDB rather than selected SQLite+managed-file ownership. Browser API/package/media/network/secret behavior still needs native verification. Existing native SQLite route becomes a competing owner unless deliberately removed/gated. | Honest alternative requiring user choice, not silently adopted and not called SQLite. |

### Candidate minimum shared-storage shape

Use a small explicit contract rather than expose Dexie collection objects:

- `Storage.read/transaction(scope, callback)` provides a **transaction-scoped** context containing only declared typed table handles. Nested business helpers receive this context and join the existing outer transaction; they must not acquire a new native commit or read from global browser `db`.
- Typed store operations start with actual needed operations: primary-key get, owner/index equality query, explicit sort/limit, insert, replace, delete and patch with explicit unset semantics. Replace callback `modify` with local typed transformations + writes inside the same context. Arbitrary user/model predicates, table names, SQL and executable JS are not accepted by IPC.
- Domain functions keep exported convenience wrappers for UI use and expose a context-taking core for Agent composition. Inject dependencies explicitly; do not depend on a global mutable “current transaction” variable across awaited calls.
- Browser adapter uses the existing Dexie engine/transactions; native adapter stores durable data in SQLite only. A short-lived native read snapshot/change set in renderer memory is allowed as computation, **not** a persistent mirror or authoritative in-memory database. Committed source must be native SQLite, and fresh reopen must read it.
- Rust uses a finite typed table/record registry with exact codecs and bounded patches/plans. This can retain a generic transaction engine while avoiding opaque arbitrary-object storage claims. Table registration/structural validators are new work; full Agent records cannot be assumed to fit current schema 4.
- Query UI uses one shared hook owner: browser can retain Dexie liveQuery internally; native invalidates/requeries after committed revision changes. Owner/request identity guards prevent stale responses replacing another thread/project’s view. It need not emulate Dexie dependency tracking to be useful.

Two possible native transaction implementations need an explicit design choice:

1. **One atomic plan:** obtain a coherent bounded read snapshot, run local TS command logic in a transaction context that stages writes, then send one typed plan containing observed revisions/predicate dependencies and all writes. Rust revalidates and commits in one SQLite transaction. This avoids holding a writer across multiple WebView calls and survives renderer death before commit without partial writes. It must detect changed query membership (phantoms), not only changed read rows: order lists, uniqueness, owner existence and “latest run” queries need scoped revision/predicate guards. Broad `db.tables` transactions may initially use a coarse workspace revision, then narrow later. Stale plans reject/recompute only safe local work; never automatically reissue paid provider calls.
2. **Native transaction session:** begin/read/write/commit IPC with opaque transaction token and declared scope. It resembles imperative commands more closely, but introduces writer lock lifetime, timeout/abandonment/renderer-crash rollback, read-your-writes, token ownership and interleaving rules. All nested commands must share one token; current one-job worker and frontend action queue cannot just be reused unchanged without assessing deadlock/serialization. This is more machinery than one-shot commits.

Recommend initially assessing option 1 for the minimum supported command set; if its snapshot/predicate coverage exceeds a reasonable bounded implementation, choose explicit session transactions with tests rather than pretend atomicity. Do not claim either is already implemented.

### Atomic business change plus tool history is mandatory

`executeAtomicTool` provides a decisive acceptance oracle. For an Agent “create project” call, native success must atomically contain project, initial episode/children, any task/project-binding changes, business write receipt and `agentToolCalls.status="completed"/result`. If result serialization/receipt budget fails, cancellation arrives before commit, owner disappears, scope/revision changes or the ledger disk write fails, **none** of those changes commit.

Calling the existing native `createVideoProject` first and writing Agent history in a second call does not meet that invariant. Compensating deletion afterward is not the same guarantee: a crash between calls leaves an orphan success or missing evidence. Existing Rust `video_undo` is not an Agent ledger transaction and does not repair this issue.

A minimal parity verification should reuse the behavioral cases in `tests/agentToolTransactions.test.ts:51` against both adapters, with real SQLite for the native side:

- nested domain creation plus completed tool result commit together;
- injected final ledger failure, oversized/unserializable result and precommit cancellation leave domain and ledger unchanged;
- close/reopen then repeat the completed call returns the saved historical result without redoing the mutation;
- changed project/thread/run ownership and stale preview reject atomically;
- same transaction reads its staged writes, while another operation cannot observe partial writes;
- crash/abandoned plan/session does not expose partial state, and native validation rejects unknown tables/fields/paths;
- committed native SQLite rows are visible after restart with IndexedDB absent/unopened.

Network/model requests remain outside this transaction. Existing callback contract at `agentTools.ts:340` explicitly prohibits fetch/external effects; batch/provider claim/unknown-outcome handling is retained rather than reclassified as a local atomic write.

### Serialization and binary boundaries

- **Undefined vs missing vs null:** normal JSON drops undefined object properties. Existing patch clear operations require explicit `unset`/nullable field codecs, while omitted patch keys mean unchanged. Whole-row codecs can omit optional fields, but patch codecs must preserve clear intent. Three-state shot style remains inherit/none/ID as in the earlier candidate research. Do not generic stringify every current object and assert exact parity.
- **Blobs:** IndexedDB stores Blob values; SQLite/file implementation must stage/copy bytes into managed files and replace record payload with typed immutable binary reference. Shared media access returns a Blob/stream resolved from that reference when the consumer needs it. File staging/hash/publication is outside ordinary SQL write loops; metadata readiness and crash recovery must follow the accepted native file contract. Neither base64-all-media-in-JSON nor a hidden IndexedDB Blob mirror meets the selected storage model.
- **Agent history:** local complete raw tool arguments/results have to survive restart and retain associations. This does not authorize putting API keys/provider continuation tokens/active approvals into portable checkpoints. Current connectors hold `apiKey` (`connectors.ts:36`); native device-local secret ownership and future reviewed history/sync codecs need separate declared contracts. Keep executable runtime authority distinct from dormant received history.
- **Fresh development:** the new storage model can reject the old schema and use an isolated fresh workspace. There is no need to build old IndexedDB/native migration readers. Avoid mixing old typed native video tables and new generic Agent tables with two competing project owners: choose one native ownership model for project/business/Agent transactions or explicitly limit unsupported tool scope until converged.

### Scope implications for rapid desktop parity

Agent/AI priority is useful for a vertical slice, but Agent tools reference video/world/media/audio/material/task/memory tables and nested guards. A chat-only facade cannot honestly claim all tools work. The plan should inventory the approved Agent tool groups, wire their dependencies to the shared storage owner and expose unsupported capabilities explicitly. Broad “all existing business commands” and a minimal transaction adapter are different deliverables; do not conceal that with an empty table or native-to-Dexie fallback.

The recommended next review is therefore a shared-storage/Agent integration design with an explicit complete table/query/field/binary inventory and atomic tool-ledger slice. This report does not select native world-only Rust CRUD as the next task.

### Related specs / references

- `.trellis/spec/frontend/video-workspace.md`: exactly one storage owner, committed operation receipts, shared UI and atomic field-baseline behavior.
- `.trellis/spec/frontend/native-workspace.md`: closed native IPC, fresh native schema, managed files, no Dexie mirror/fallback, actual packaged acceptance.
- `.trellis/spec/frontend/agent-project-context.md:138`: coherent explicit context-preview transactions and nested table ownership.
- `.trellis/spec/frontend/agent-write-evidence.md`: bounded receipts/replayed history and atomic evidence.
- `.trellis/spec/frontend/agent-batch-generation.md:19`: no network/Blob hashing inside IndexedDB transactions; owned/dormant history and paid execution boundaries.
- `.trellis/tasks/10-10-desktop-storage-sync/design.md:21`: complete reviewed raw tool history; secrets/continuation authority remain device-local/excluded from sync.
- External references: none fetched; conclusions are from primary repository source and executable test contracts, not a claim of general Dexie/SQLite drop-in compatibility.

## Caveats / Not Found

- No implementation/prototype benchmarks or tests were run; exact facade API, all-table codec coverage and snapshot/session cost remain to be designed.
- Current tests establish intended nested transaction semantics; this research does not independently verify every Dexie edge case or recommend reproducing its full API.
- Current native video action engine is already durable and isolated, but does not have shared transaction composition with Agent tables. Reusing its file/IPC/security infrastructure is feasible; treating its domain actions as a composable generic transaction is not.
- All-Web-in-Tauri IndexedDB is the fastest code-reuse alternative and conflicts with the selected native SQLite ownership unless the user deliberately changes that requirement.
