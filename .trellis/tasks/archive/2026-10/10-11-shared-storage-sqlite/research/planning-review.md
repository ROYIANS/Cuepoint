# Research: Independent review of the shared SQLite persistence plan

- Query: Can the proposed explicit unit of work, guarded short reads, overlay and checked commit preserve the complete existing product and Agent, and are the execution/acceptance gates concrete and internally consistent?
- Scope: internal planning review of the current PRD, design, execution plan, all four research reports and compact call-site inventory; focused verification of uncertain source facts. No implementation, tests, database/profile inspection or provider requests.
- Date: 2026-10-11

## Findings

### Overall assessment

The proposed shared-store boundary is consistent with the user's settled decisions: one UI/business/Agent implementation, browser IndexedDB, fresh desktop SQLite plus managed files, all existing domains, no migration, no paid replay and synchronization deferred. The lazy read-set/overlay approach can preserve application serializability if every point/absence/predicate read is guarded, read-only results are validated before publication, nested commands share one context, and the final native commit validates all guards and constraints atomically. This is a design that requires proof, not existing SQLite adapter behavior.

The inventory establishes a baseline of **49 tables, 219 textual transaction sites and 96 reactive query sites**. The **95 tools** are a previous registry baseline that the implementation plan correctly requires regenerating. Counts alone do not establish command, transaction or binary closure. There is no unresolved user-owned product decision identified by this review. Root owns recording the user's implementation authorization under the workflow.

### Required planning corrections

Severity means the effect if the implementer follows the reviewed wording literally. These are planning findings, not claims of defects in an implementation that does not yet exist.

| ID / severity | Finding and evidence | Recommended correction |
| --- | --- | --- |
| P1-ORDER | Phase 1's exit promises the **full browser product through the shared boundary**, but all owner/context adaptation is scheduled in Phase 4 and all hooks in Phase 5 (`implement.md:12–20`, `:44–64`). The same ordering calls for Dexie only inside the adapter before the current direct users have been converted. | Make Phase 1 a contract/browser-adapter conformance gate with existing startup unchanged. Finish full browser equivalence after the owner and reactive-query conversion. Do not introduce a second facade/ambient context solely to satisfy the earlier exit sentence. |
| P1-SWITCH | Phase 5 switches normal Tauri to SQLite before Phase 6's complete actual-product acceptance (`implement.md:56–76`), while `design.md:104` expressly requires the full coverage gate **before normal ownership activation**. | Run the full shared-product native acceptance through explicit isolated SQLite selection, including all domains/tools/binaries and restart, before changing the normal profile. Then build the normal SQLite bundle and perform a focused real normal-startup/reopen/no-fallback regression. An isolated full-product selection is not the historical reduced prototype frontend. |
| P1-OUTCOME | The design requires durable operation reconciliation after process death (`prd.md:39`, `design.md:51`), but the execution plan binds **status** alongside transaction commands to workspace/session generation (`implement.md:25`). An old generation must not revive a transaction handle, yet a committed operation must remain inspectable after reopening. Reused operation identity also needs an exact payload binding. | Specify durable operation identity/status separately from ephemeral transaction handles. A current trusted session in the same persistent workspace may inspect the original operation; old read/write handles remain invalid. Bind commit identity to a canonical write-set/binary-claim fingerprint, reject the same ID with different contents, and distinguish pending/not-yet-known from proven uncommitted. Retain sufficient durable outcome evidence for the required reopen horizon. |
| P1-CERTAINTY | Existing `executeAtomicTool` wraps **every transaction rejection** in `AtomicToolRollbackError` (`src/db/agentTools.ts:366–367`). `runChat` then treats that class as proven no effect (`src/lib/agent/runChat.ts:196–203`); its preceding saved-result read can also fail (`:188–191`). The plan states truthful uncertainty but its concrete failure-catch checklist only names output evidence. | Name this wrapper/caller boundary explicitly in Phase 4 and the failure matrix. Wrap only confirmed precommit/rollback outcomes. If commit/status/saved-result inspection remains unavailable, propagate unknown certainty, preserve blocked recovery, emit no fabricated rollback result and never repeat mutation/paid work. Test the actual Agent wrapper and loop, including failed reconciliation reads. |
| P2-BOUNDS | The plan requires bounded IPC and no inherited whole-table cap, but describes one closed mutation batch without defining how large atomic copy-imports or paged metadata queries cross the transport (`prd.md:28`, `design.md:29`, `:46`, `:84`). Current project copy-import atomically bulk-adds many tables (`src/lib/projectPackage.ts:302–334`), including references/chunks and audio package rows. | Define bounded page/chunk envelopes while retaining one logical sealed write set and one final SQLite commit. If transport bounds require it, prepare row-batch chunks without an open metadata writer, then finalize the verified sealed batch. Paged reads must retain/validate the same relevant epoch across pages. Prove a representative large metadata import/read and cancellation without splitting atomic business ownership or silently imposing a new product row cap. |

The corrections above are implementation mechanics and ordering. They do not require new product-scope questions or reopening settled user choices.

### Follow-up resolution check

Root updated the owned plan while this review was being written. A second read confirms:

- **P1-ORDER resolved:** Phase 1 now exits on conformance; full browser equivalence waits for owner/hook adaptation.
- **P1-SWITCH resolved:** Phase 5 uses isolated full-product SQLite selection; normal activation follows complete Phase 6 acceptance and requires its own actual-bundle regression.
- **P1-OUTCOME core wording resolved:** `design.md:53` and Phase 2 now separate current-session durable lookup from invalid old handles and require payload fingerprints. Implement the explicit pending/absence/retention cases in this report before claiming AC4 complete.
- **P1-CERTAINTY design corrected:** `design.md:53` names the catch-all rollback hazard and unknown outcome. Keep the actual wrapper/loop and failed-reconciliation cases as directed implementation acceptance, rather than only testing abstract error classes.
- **P2-BOUNDS remains an explicit implementation-contract recommendation:** bounded paged reads and a sealed prepared row-batch protocol should be recorded before transport coding; the high-level bounded-IPC requirement alone must not become a silent product cap.
- Root reports that the user subsequently granted autonomous/automatic implementation approval. There is no need to reopen settled product decisions or request redundant authorization from this research review. Root records and applies that human authorization; this agent remains research-only.

No new concrete planning blocker appeared in the follow-up read. Remaining protocol/test details above are required implementation gates, not optional future feature scope.

### Required uncertainty proof cases

Add explicit cases at the actual Rust bridge and shared `executeAtomicTool`/`runChat` boundary rather than only a mock storage rejection:

1. Native commit succeeds, reply is lost, same-process status returns committed: original business rows, receipt and saved completed result remain; no second business execution.
2. Commit succeeds, the renderer dies, and a current-generation caller after reopen resolves the original durable operation; old context handles are still rejected.
3. Status or the saved-completed-result read also fails: no `rolled_back` result, no false failed-with-no-effect state and zero retry/submission.
4. Status is requested while a queued/accepted commit may still settle: absence alone does not certify rollback.
5. An operation ID is submitted with altered row changes or binary claims: reject the mismatch rather than acknowledge the previous result as this mutation's success.
6. Stop/close competes with authoritative commit: a committed result wins; a proven precommit cancellation rolls back the entire root; unknown stays unknown.

Existing proof anchors are the documented actual result replay and completed-row check (`src/db/agentTools.ts:354–364`, `src/lib/agent/runChat.ts:188–203`). Durable operation receipts must not store provider secrets or arbitrary callback capabilities merely to recover an acknowledgement. Resolve domain/tool results from their owned durable evidence where appropriate; define what a general command caller can recover before promising exact callback-result reconstruction.

### Contracts already covered and to preserve during implementation

| Area | Reviewed coverage and narrow source evidence | Verification emphasis |
| --- | --- | --- |
| Nested transactions / receipts | `design.md:39–51` requires compatible scopes, read-your-writes, phantoms, ABA and final checked commit. `src/lib/agent/businessWriteReceipt.ts:95–133` actually rereads new rows and can reject after business writes. | Run real shared owners; inject late receipt/ledger failure, optional uniqueness, empty scans, delete-recreate, nested reads/count/first/filter and escaped handles. No detached nested commit or callback replay. |
| Codec / keys / indexes | `design.md:29–35`, AC1 and research cover primary keys other than `id`, explicit own-undefined, compound/optional uniqueness and primary-key ties. `src/lib/productionRevision.ts:6–14` distinguishes undefined, omission and null. | Test own properties and nested clear versus absent patch, reserved authored property names, clone isolation, reverse/sort ties, exact original argument/result strings and revision/receipt hashes before and after actual native reopen. Do not compare payloads only through lossy JSON stringify. |
| Paid result atomicity | `src/lib/audioGeneration/runtime.ts:229–245` writes raw speech bytes plus remote-completed job before decoding; `:98–142` promotes media/take-or-work/job together. The plan preserves these owners. | Verified staged bytes and job/results commit together; canceled/interrupted local decoding can recover original bytes without another POST. Fixture supplier counters must distinguish POST from GET/download recovery. |
| Secret scope / atomic configuration | The one private SQLite owner in `design.md:70` preserves `saveSearchConnection`'s connection-plus-Agent transaction (`src/db/searchConnections.ts:11–30`). Local same-device continuation is retained; portable projections remain separate future work. | Failure after key/config insertion but before Agent skill update leaves neither partial write. Diagnostic/operation error data excludes credentials. No native profile/key import, raw DB portability or claim that arbitrary original user/tool strings are universally secret-free. |
| Binary history / caches | All three declared carriers, immutable versions, intent recovery and logical deletion are present in the plan. Actual audio cache currently keys only by media ID and skips re-reading (`src/lib/audio/buffers.ts:19–27`), making the explicit cache requirement necessary. | Warm the actual cache/preview, then remove/corrupt the managed source. Current availability, export/render/provider input must fail truthfully; metadata/history/timing survives. Reopen generation and immutable binary identity invalidate capability caches. Read IO errors propagate distinctly from missing material. |
| Reactivity / full product | `design.md:88–90` covers read/subscribe races, commit-only events, disposal and generation reset; full-domain/registry coverage is explicit. | Exercise the existing 96-query baseline through actual shared hooks, not only a new video hook. Source counts are location aids, not proof. Rejected commits emit no success invalidation. No normal engine-dependent Agent/library/audio feature denial survives. |
| Local non-table association | The music variant association currently persists in `localStorage` (`src/components/music/MusicWorkspacePage.tsx:64–71`, `:111–118`), and PRD R8 correctly classifies it as product data. | Persist new associations through the shared product owner, test alternate draft reopen/navigation and deletion, regenerate the registry/table count if a new table is needed. No old localStorage import is required. |
| Lock and host limits | Native process locking, ready marker and ordinary containment are reused. Current `paths::inode` fails on non-Unix (`desktop/tauri/src-tauri/src/paths.rs:70–82`); research accurately records the limit. | Real packaged macOS reopen and second-process lock tests are required. Do not claim Windows/Linux functionality or hostile race-proof filesystem containment from macOS/ordinary inode checks. Missing host evidence is explicit future work, not a reason to add a new user decision in this child. |

## Files Found

- `.trellis/tasks/10-11-shared-storage-sqlite/{prd,design,implement}.md` — reviewed requirements, authority/transaction/file design and ordered gates.
- `.trellis/tasks/10-11-shared-storage-sqlite/research/storage-seams.md` and `storage-callsite-inventory.json` — full current table, query, operator, nested-owner and source-scope inventory.
- `.trellis/tasks/10-11-shared-storage-sqlite/research/native-owner-and-files.md` — native worker/lock/file lifecycle, chunking, recovery and host limitations.
- `.trellis/tasks/10-11-shared-storage-sqlite/research/agent-state-and-device-boundaries.md` — complete local history, paid state, configuration atomicity and future portable exclusions.
- `.trellis/tasks/10-11-shared-storage-sqlite/research/architecture-decisions.md` — settled authority, fresh-data, full-reuse and optimistic-transaction tradeoffs.
- `src/db/agentTools.ts`, `src/lib/agent/runChat.ts` — actual atomic wrapper and effect-certainty classification.
- `src/lib/agent/businessWriteReceipt.ts`, `src/lib/productionRevision.ts` — late receipt validation and own-undefined revision identity.
- `src/lib/projectPackage.ts`, `src/lib/audioProjectPackage.ts` — cross-table atomic bulk copy-import and binary/history snapshots.
- `src/db/searchConnections.ts` — current cross-table device-secret/Agent atomic command.
- `src/lib/audioGeneration/runtime.ts`, `src/lib/audio/buffers.ts` — raw paid byte checkpoint, output promotion and current cache bypass risk.
- `src/components/music/MusicWorkspacePage.tsx`, `src/components/music/draftVariants.ts` — non-table product association ownership.
- `desktop/tauri/src-tauri/src/paths.rs` — Unix-only native file identity and ordinary-file protections.

## Related Specs

- `.trellis/workflow.md` — planning artifacts and explicit subsequent implementation approval; research-only write scope.
- `.trellis/spec/frontend/native-product-runtime.md` — one shared full product, immutable owner, no fallback/mirror, real packaged proof and paid replay boundaries.
- `.trellis/spec/frontend/workspace-storage.md` — internal copied bytes, exact identities, prepare outside writes and authoritative commit/cancellation outcome.
- `.trellis/spec/frontend/agent-execution.md` — lock-aware recovery, exact checkpoints, once-only provider submission and certainty from the actual boundary.
- `.trellis/spec/frontend/agent-tools.md` / `agent-write-evidence.md` — original ledger, nested atomicity, approval/claim contracts and truthful receipts/current evidence.

## External References / Versions

No new library behavior or external API is recommended by this review. All findings concern internal source and proposed protocol wording. The companion native research records the pinned Rust/Tauri/rusqlite versions and primary SQLite/Tauri references; this review does not establish additional version-specific capabilities.

## Caveats / Not Found

- This is a source/planning review, not a native implementation acceptance report. No test, build, actual SQLite query, user database, secret/profile inspection or paid provider request was performed.
- The initial finding table preserves the reviewed wording. The follow-up resolution section records corrections confirmed in a second read; root owns the final PRD/design/implementation artifacts.
- All 49 table and 95-tool contracts have not been executed here. The documented inventory and required evidence matrix must be regenerated and fulfilled in implementation.
- Short-read serializability, durable operation reconciliation, bounded metadata batches, full-product binary staging and native reactivity are new mechanisms. Their correctness must be established with actual native tests and packaged evidence.
- There are no identified unresolved product questions. This review does not implement code or independently change task status/authorization; root owns the next execution step.
