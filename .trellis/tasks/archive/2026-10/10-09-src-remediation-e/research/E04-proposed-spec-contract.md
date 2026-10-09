# Proposed E04 spec synchronization — awaiting independent PASS

Preparation only; refresh after final returned checker outcome/self-fixes. Do not append canonical specs before acceptance. Three standalone seven-section additions to project-memory.md, state-management.md and hook-guidelines.md respectively.

## E04 manual memory transaction closure (2026-10-09)

### 1. Scope / Trigger
Read before changing create/update/status/replace/deleteProjectMemory or protected memory history/CAS helpers.

### 2. Signatures / Owners
projectMemories.ts declares MANUAL_MEMORY_TABLES containing projects, projectMemories and projectMemoryVersions for the five simple manual commands. Source promotion remains a separate evidence owner; broader wrapup/agent-run/generic atomic transaction owners are not inferred from this list.

### 3. Contracts
Project and current-row ownership, normalized duplicates/conflicts, expected revisions and full immutable history writes remain inside the same write transaction. Replacement compares both rows and persists both current versions and histories atomically. Deletion removes current and owned history together. Pure input parsing may precede the transaction. Nested manual commands join compatible broader atomic owners. Never move protected reads outside to obtain a smaller store list or reuse this list for promotion/source readiness/dynamic generic callbacks without a complete separate closure.

### 4. Validation / Error Matrix
Missing/studio/foreign project or row → reject without rows/history. Duplicate/no-op → retain established CAS/status contracts. Stale revision/topic conflict → reject without partial writes. Later history/replacement/delete failure after real mutations → rollback current and every affected history. Native objectStoreNames → exact declared three-store closure for each manual command. Promotion/wrapup/generic atomic callbacks → retain their required evidence stores.

### 5. Good / Base / Bad Cases
Good: one explicit three-table declaration reused by five traced commands. Base: broader outer atomic owner calls a manual command safely. Bad: infer all-table transactions are equally removable or let CAS/source ownership reads occur before the transaction.

### 6. Tests Required
Meaningful actual commands test ownership/duplicates/CAS/conflicts and faults after current/history writes, including later replacement persistence and hard-delete history failure. Native tests assert actual IDBTransaction.objectStoreNames and controlled unrelated-store progress while a memory transaction is held after a real history write; a competing memory edit waits then rejects stale CAS. Independent invocations use Dexie.ignoreTransaction to avoid accidentally joining the held promise zone. Fake-indexeddb does not prove native scheduling.

### 7. Wrong vs Correct
Wrong: call a three-store list proof of per-project parallelism or measured speed. Correct: report observed store scheduling separately; IndexedDB readwrite locks shared stores across owners. Read helpers and protected broader owners require their own closure, not automatic narrowing.

## E04 per-operation batched media retention (2026-10-09)

### 1. Scope / Trigger
Read before changing media orphan cleanup, multi-media owner deletion, slot recycling, material-use release or surrounding rollback/undo receipts.

### 2. Signatures / Owners
media.ts owns deleteMediaIfOrphans(readonly (Id | undefined)[]): Promise<void>, scalar deleteMediaIfOrphan compatibility and existing collectMediaIds(projectId?) backup projection. Existing caller owners mutate/delete their rows/history/flags first, then submit one candidate batch in the original compatible PRODUCTION_TABLES transaction. DraftMediaSession retains its explicitly injected scalar failure boundary.

### 3. Contracts
Deduplicate nonempty candidates and bulk-read existing media records. Collect current durable references globally once per explicit operation. Collect all historical retention statuses with four indexed history queries per distinct candidate MediaRecord.projectId; do not key history by deletion caller/project target or union every owner's history. Retain all eighteen current/history reference tables, including audio results/reference samples/material uses/library flags/proposal before/change/job inputs-results/batch applications/item draft inputs. Keep the twenty-five-store production scope where required. Await actual eligible deletes in the same transaction. Never cache a retention snapshot ambiently across later mutations. releaseMaterialUse removes its use, verifies other uses, clears all intended copied libraryRetained flags before one snapshot, checks survivors and adds its release event; a survivor or late failure rolls everything back. collectMediaIds(projectId) remains the separate backup contract.

### 4. Validation / Error Matrix
Duplicates/missing/undefined → deduplicate or no-op. Current reference from any owner → retain. History from candidate's actual owner → retain; foreign-owner-only history → preserve original scope semantics. Later retention-affecting write in same outer transaction → next explicit cleanup reads fresh state. Late delete/event/receipt failure → owner/order/history/flags/media Blob and receipt/snapshot rollback. Incompatible nested stores → reject rather than escape to an independent commit. Draft cleanup failure → preserve existing injected scalar ownership semantics.

### 5. Good / Base / Bad Cases
Good: collect one fresh snapshot after all intended flag/owner mutations and batch within the original atomic owner. Base: scalar callers delegate one candidate to the batch. Bad: use a transaction-global Set or globally union histories to make fewer queries, miss audio/material sources, or count a fault hook that no longer hits the mutation method.

### 6. Tests Required
Isolate each retention source/status so overlapping refs cannot mask omissions. Cover mixed-owner histories, missing/duplicate/retained candidates, addition/removal freshness after later writes, actual later media deletion failure across changed callers, material flags/other-use/event rollback, undo-returned snapshots, real tool result/business receipt rollback/replay and overlapping native writers. Count logical query/cursor requests, returned-row/cursor steps, candidate gets, updates/deletes and owner work separately. Preserve original source comparator/failed producers. The current thirty-unique/three-owner duplicate benchmark invokes the old scalar sixty times; its request/result counts are not exclusively physical cursor or disk IO, nor measured latency.

### 7. Wrong vs Correct
Wrong: infer less elapsed time from fewer logical scans or broaden draft/provider atomicity without evidence. Correct: report exact finite native work and transaction identity, separately retain scalar/backup/draft compatibility and device/provider limitations.

## E04 scoped studio library subscriptions (2026-10-09)

### 1. Scope / Trigger
Read before changing gallery fallback covers or current-kind studio asset subscriptions/search/sort/loading identity.

### 2. Signatures / Owners
ProjectGalleryPage derives visible fallback owner IDs; readProjectCoverIds in studioLibraryQueries.ts returns Map<projectId, mediaId>. AssetLibraryPages' keyed kind owns its matching typed studio table and existing cover function. Query results carry an exact current scope key before use.

### 3. Contracts
Explicit project coverMediaId wins. Only visible projects without an explicit cover enter fallback reads. One readonly shots transaction executes exact per-owner projectId equals cursors; multiple requests remain observable and individually precise. Select the first eligible firstFrame result under existing project-wide order, preserving equal-order primary-key input order across episodes; no persisted cover cache. Project sort/search/IP/archive transitions preserve visible ownership and reject old held query results under a new key. Each current-kind asset page queries only its matching typed studio table and reuses its actual field-specific cover/search/sort rules. Preserve E01 mutation locks/errors/captured targets and navigation completion ownership.

### 4. Validation / Error Matrix
Explicit-cover-only visible set → no fallback shot work. Different owner/kind write → no irrelevant scoped query rerun. Relevant firstFrame removal/change or clearing explicit cover → refresh appropriate fallback. Same-order/multi-episode/missing-result → original selection semantics. Held previous filter/kind result → no old result under new scope. Missing media → existing render fallback. Query read failure/loading → preserve established UI behavior; do not invent false settled state.

### 5. Good / Base / Bad Cases
Good: exact equals ranges share one readonly snapshot. Base: retain complete IndexedDB records only within the cursor callback and return a narrow cover Map. Bad: call a Map physical column projection, query all four asset tables for one fixed kind, or switch to anyOf only for one-request counts without checking bounding-range observability.

### 6. Tests Required
Native actual pages and IndexedDB verify explicit/fallback/ties/multi-episode/missing media, search/sort/IP/archive, held owner/filter/kind transitions and all four typed asset kinds. Insert a filtered-out owner's shot whose ID lies between selected IDs: no cover callback/read/reducer work. Installed Dexie anyOf bounding ranges can track an unwanted gap; preserve its counterexample and final exact-range comparison. Measure read transactions, cursor requests, complete returned rows, callback derivation counts and projected JSON bytes separately, acknowledging warm Dexie cached queries and excluding Blob bytes from JSON. Current E01 write regressions run against final source and unchanged producer.

### 7. Wrong vs Correct
Wrong: infer latency or native disk-read savings from a narrow Map or ignore subscription behavior while minimizing query count. Correct: retain precise useful scope and one read transaction, label N cursor requests and actual rows honestly, and keep finite negative-wait/native/device limits visible.
