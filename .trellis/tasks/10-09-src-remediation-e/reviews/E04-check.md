# E04 independent check — PASS

Finalized: 2026-10-09T13:33:35.000905+08:00. Role: already-dispatched trellis-check; direct review. Scope: PD06, PD07, SS09. **Blockers: none. Product self-fixes: none.** Main owns formal acceptance after this completed handoff.

## Review boundary and exact provenance

All43 owned root files were inspected in full, including every runner/test/fixture/config/provenance/original snapshot. The comparison baseline is the accepted post-E03 E04 entry, not HEAD alone. Exact before, reviewEntry and after maps are in the JSON and E04-check-snapshot.json; all43 review-entry/after hashes match the frozen writer roots. The11 preserved E04-before copies match entry hashes. Accepted E01–E03 behavior was retained.

The full three writer Markdown/JSON reports and manual retention matrix were read, with all18 retention-table semantics,25 production stores,17 caller rows, injected DraftMediaSession, scalar cover/reference callers, backup projection, protected memory owners, and receipt/undo closure examined. Compact injected indices were navigation aids only.641 unique writer artifacts were content-hash verified: memory34, media36, library571. The original library371-artifact manifest still resolves exactly; three changed metadata/producers use saved query-n-revision copies while the other368 artifacts remain at their original paths. Historical reports/failures were preserved.

## Source and critical native conclusions

**PD06 — PASS.** The five manual memory APIs and all owned-read/CAS/conflict/create/persist/delete helpers require only projects, projectMemories and projectMemoryVersions. The declaration and five transaction arguments are the bounded change; existing semantic helpers are unchanged. Actual native roots decrease46→3 stores. Faults occur after a real history insertion and later replacement writes, restoring current/history. A same-store competitor waits, then fails stale CAS; unrelated media commits while the manual transaction is held. This proves store-scope scheduling, not per-project locks or timing. Promotion sourceSummary/wrapup, dynamic evidence, generic atomic tools and agent-run config/context initialization retain broad owner scopes. No claim is made that every broad table is individually minimal.

**PD07 — PASS.** collectMediaIds stays unchanged for global current and owner-scoped backup use. Batch cleanup filters/deduplicates candidates, bulk-reads media, uses fresh global current references and four indexed history sets for each actual MediaRecord owner, then awaits individual deletes in the original25-store production transaction. All changed callers mutate/touch/reindex/remove current/history state before cleanup. Current cross-owner refs remain global; cancelled/deleted-target owner histories retain candidates; foreign-owner-only histories preserve original exclusion parity. No ambient set is reused.

Material release removes the use, validates remaining uses, clears all copied flags before its snapshot, verifies survivors and emits the event last. Native evidence restores earlier actual Blob deletes after later deletion/survivor/event faults. The actual shot_delete path creates its business receipt after three real media deletes; a later ledger fault restores receipt/current/history/media, and retry/replay succeeds. Orphan-only tools carry durable deleted IDs without a business receipt. The original scalar/DraftMediaSession/backup interfaces remain compatible, including failed-cleanup retry ownership; this does not make all uploads and save one transaction.

**PD07 count boundary.** The matched work fixture has30 unique existing library-retained candidates,3 actual owners and60 original scalar invocations. The final call receives the same duplicated IDs plus undefined/missing, deduplicating31 lookup keys for30 records.1080→26 are DBCore logical retention query/cursor requests;1800→30 is the sum of returned query rows and cursor steps. Candidate primary-key reads and writes are excluded and reported separately:60 get calls versus1 bulkGet. These numbers are not exclusive physical disk IO, IDBCursor-only visits or latency.

**SS09 — PASS.** Exact projectId.equals ranges remain independently precise while N requests share one readonly shots transaction. Three selected owners measured3 requests/3 transactions before and3 requests/1 transaction after, with45 complete rows in each selected-owner comparison. The reducer returns2 cover IDs/53 JSON bytes excluding Blobs; it does not project IndexedDB columns. Strict-order comparison preserves equal-order primary-key tie order across episodes. Explicit-cover nullish behavior, missing-media fallback, authored search, stable sort, IP/archive/loading/error behavior and E01 locks/handlers remain intact. Current-kind asset branches stay typed and query only their matching table/actual cover function; scope/kind identity prevents held old results entering a new owner.

**SS09 anyOf counterexample.** The preserved anyOf attempt FAILs on an excluded owner whose projectId index key falls between selected owner keys. It reads47 complete cursor rows but makes45 matched reducer visits and reruns the fallback subscription. The gap is an owner-index gap, not a shot-primary-key gap. Final exact ranges show0 fallback reads/0 reducer visits for the same committed insertion within the200ms bounded wait; its observed write transaction is not a query transaction. Broad project/IP metadata queries and MediaThumb are outside that no-rerun claim.

## Current gates and source alignment

The coordinator current frozen application gates passed tsc and163 test files/2744 tests. All759 actual inputs match gate pre/post/current, including every owned root. No fullsuite rerun was warranted. Current E01 native writes passed20 with actual450 matching inputs/447 source-parser inputs, identical final helper88ee8d... and unchanged E01 producer/fixture. No E01 rerun was warranted.

Fresh independent critical native proof: memory4 scenarios, library7 scenarios; media8 isolated sources,7 freshness cases,2 matched30-candidate work runs,3 changed-caller actual late faults,6 caller-work cases,2 retained releases, plus duplicate/missing release, final-event rollback, outer transaction, real orphan/shot receipt roots, mixed-owner/backup parity and overlapping-writer commit visibility. Original selected assertion bodies are retained. Each run uses one main document/local synthetic rows and no paid providers. Fresh focused checks passed47 memory/library tests plus7 selected media tests (143 deliberately skipped), application tsc and all3 fixture tsc checks.

Final writer and fresh loaded closures align: memory46, library73, media155. Media adds vendor/lobehub/manifest.json beyond the759 gate list; its loaded/current/after hash matches and is explicitly supplemental. The media load tracker records the raw main input before transformation; the effective subset main bytes and producer are separately retained/hashes recorded. Older original/native/anyOf inputs remain historical evidence, not current-source claims.

## Typed static / actual-value AST

Full typed raw static diagnostics were read and their source SHA verified across18 changed TS files. Baseline and current use separate complete TypeScript programs, the same rules/versions, and a baseline cache verified against all442 HEAD source files. Recomputed diagnostic counts are4 errors/44 warnings before,3/41 current,0 added noncomplexity,0 new-helper diagnostics. Gallery complexity rises31→32 from accepted post-E03 due to the E04 scoped-query guard; its HEAD27 value includes earlier E01 changes. AgentChat101/58 versus HEAD100/57 are the two inherited E01 metrics, and its source is unchanged since E03. **This temporary per-file diagnostic analysis is not formal QG01 debt or identity acceptance.**

Fresh AST parsing reproduces the complete raw420-TS/2502-edge data on current source hashes,0 parse errors,0 static actual-value SCCs and0 actual-value SCCs including literal dynamic imports/self-edges. Three type-inclusive SCCs are reported separately. Computed runtime import resolution is outside this graph.

## Commands, preservation and limits

Commands are fully recorded in JSON. Package invocations use the explicit machine pnpm path and Node24 PATH. Fresh native derivatives use the installed Playwright and Chromium paths, isolated entry/cache and original assertions. AST/provenance work is read-only outside reviewer-owned evidence. An initial focused-launch Python path typo and initial provenance-audit path/supplemental-input interpretation are preserved with original producers/results; their corrections did not change product source or require repeated native/full gates.

| Evidence | Result |
| --- | --- |
| Existing current application/full gate; actual759 inputs verified | PASS;163 files/2744 tests |
| Existing current E01 write proof; actual450 inputs verified | PASS;20 native cases |
| Fresh independent native memory/library/media critical subset | PASS; raw assertions/closures preserved |
| Fresh focused tests / application and3 fixture typechecks | PASS;54 tests +4 type commands |
| Full typed static raw/source/manual attribution |0 added noncomplexity; helper0; no formal QG acceptance |
| Fresh raw AST reproduction / independent value SCC reconstruction |420 files/2502 edges/0 parse/0 actual-value cycles |
|641 writer hashes + historical371 + before/entry/after/closure alignment | PASS; no root drift |

Practical limits:

- PASS covers bounded E04 PD06/PD07/SS09 implementation review. Main owns formal acceptance, canonical spec edits, quality-debt acceptance and later units. No product self-fixes, writer-report overwrites, package installs, commits or canonical spec writes.
- Current application type/full-test proof is reused after all759 actual inputs match pre/post/current. Independent focused/type/native subsets are fresh; fullsuite and full native matrices were not repeated.
- PD07 measurements are DBCore logical query/openCursor request counts and sum of returned query rows/cursor steps. Candidate primary-key get/getMany and writes excluded. 30 unique existing retained candidates,3 actual owners,60 original scalar calls; final dedup31 keys includes missing plus undefined filtered out. Not exclusive physical disk IO/IDBCursor visits, allocations or latency.
- SS09 complete records reach the cursor callback. Map JSON bytes exclude Blob bytes. One readonly transaction still issues N exact projectId-equals cursor requests. Warm Dexie cache can eliminate native reads while derivation runs; callbacks/rows/reducer work remain separate.
- Negative native subscription observations use bounded200ms post-commit waits. Native Chromium151.0.7922.34 on this macOS fixture/device with synthetic local rows/Blobs is not cross-browser/full-product UI/provider acceptance.
- Memory3-store readwrite roots serialize at store level, not per-project locks. Broad promotion/wrapup/generic atomic/agent-run owners retain their established closures; broad does not mean every declared table is individually proven minimal.
- DraftMediaSession retains injected scalar cleanup with separate per-ID transactions and pre-save unkept cleanup. No atomic all-uploads-and-save claim.
- Typed static scan has3 current errors/41 warnings in18 changedTS against HEAD4/44; zero added noncomplexity and helper0. Gallery31->32 is E04 scoped-key guard; AgentChat101/58 inherited E01. Temporary diagnostic delta is not formal QG01 identity/debt acceptance.
- AST reproduces420TS/2502edges/0parse errors/0 static or literal-dynamic actual-value SCCs including self edges. Three type-inclusive SCCs remain distinct; computed runtime import resolution is outside this graph.
- Native media closure155 includes vendor/lobehub/manifest.json supplemental to759 gate inputs. Its loaded/current/after hash matches; the gate alone did not fingerprint it. Effective media subset main is saved separately from raw tracked entry SHA.
- Historical unsuccessful native/type/anyOf evidence and original library371-artifact report remain preserved. Initial checker audit misresolved historical paths and treated supplemental vendor as missing gate input; original failed audit/program retained, resolved content-hash mapping now passes. No source risk or new native rerun resulted.

## Coordinator draft amendments

- SS09 Tests Required: Draft says a shot whose ID lies between selected IDs. Actual gap concerns the excluded owner projectId index key between selected owner keys. Shot primary key is not the gap axis. Recommended: Insert a shot for an excluded owner whose projectId index key lies between selected owner projectId keys.
- SS09 Validation / Error Matrix: Different owner/kind no-rerun applies to cover fallback/current-kind asset subscriptions. Gallery project/IP metadata and MediaThumb subscriptions remain broader. Recommended: Limit irrelevant-write silence to the fallback shot subscription/current-kind asset query, and list the excluded broad metadata/media queries.
- PD06 Validation / Error Matrix: Do not unify duplicate early return with status no-op/CAS validation. Disabled duplicate remains disabled under its established early-return behavior. Recommended: Keep duplicate-return and no-op/CAS contracts separately described; do not infer that every duplicate path validates replacement CAS.

## Complete per-file coverage

| Root | Complete checks |
| --- | --- |
| `scripts/e04-library-browser-regression.mjs` | Complete native producer and all assertions; original/anyOf/final evidence separation, counters, exact owner cursors, explicit transaction IDs, loaded closure, held filters/kinds and finite waits. |
| `scripts/e04-media-browser-regression.mjs` | Complete native producer, isolation, source capture before transformation, original media substitution, bounded deletion/ledger/event faults, receipt replay, request attribution and scheduling. |
| `scripts/e04-memory-browser-regression.mjs` | Complete native producer, original memory substitution, all five storeName assertions, actual history/replacement faults, waitFor/ignoreTransaction competitors and loaded closure. |
| `src/components/studio/AssetLibraryPages.tsx` | Full component/current-original comparison: typed current-kind helper, authored search inputs, stable sort, actual cover functions, keyed kind query identity, loading/empty/errors and unchanged E01 mutations. |
| `src/components/studio/ProjectGalleryPage.tsx` | Full component/current-original comparison: visible fallback owner set, explicit covers, scope-key result guard, stable ties/fallback, IP/search/archive/sort/loading and retained E01 locks/errors/captured-target ownership. |
| `src/db/assetReuse.ts` | Full source and before diff: release removes use, checks all other uses, clears every copied flag before one snapshot, tests survivor after actual deletes, writes event last; production root rollback retained. |
| `src/db/assets.ts` | Full source and before diff: all four slot owners preserve owner/CAS/assert/write/touch ordering; recycleSlotMedia is batch after mutation, history/current retention evaluated in existing transaction. |
| `src/db/cascadeCommands.ts` | Full source and before diff: deleteChatThread/deleteEpisodeShots batch after all mutations/reindex/touch, durable deletion candidates and nested receipt/undo owner remain in the production transaction. |
| `src/db/episodes.ts` | Full source and before diff: deleteEpisode removes current/history owners, touches/reindexes before single fresh cleanup; set/order/ownership and unrelated behavior preserved. |
| `src/db/media.ts` | Full source and original snapshot comparison: unchanged collectMediaIds global/backup semantics, 14 current sources, 4 actual MediaRecord-owner history sets, dedup/bulkGet, sequential deletes and scalar compatibility. |
| `src/db/projectMemories.ts` | Full source and before comparison: all five manual commands and complete owned/get/CAS/conflict/current/version/delete helper closures use projects/projectMemories/projectMemoryVersions; promotion/wrapup remain broad. |
| `src/db/shots.ts` | Full source and before diff: deleteShots/deleteShotMedia clear and touch before one batch cleanup; slot replacement/history retained; late actual deletes and nested business receipt rollback audited. |
| `src/lib/studioLibraryQueries.ts` | Full helper including every typed switch branch/cover function: distinct IDs, one explicit readonly shots transaction with N equals cursors, strict-order reducer stable ties, no ambient/persisted cache or broad asset assertion. |
| `tests/e04LibraryQueries.test.ts` | Complete tests/assertions: owner dedup/empty/explicit/ties/missing/fallback and exact typed queries/cover functions; source-only model claims kept separate from native subscriptions. |
| `tests/e04MediaRetention.test.ts` | Complete tests and assertion matrix: 150 tests, 18 retention tables, original parity, fresh batch/no stale cache, all changed callers, actual late deletes, flags/other use/event, receipt/undo and owner boundary. |
| `tests/e04MemoryTransactions.test.ts` | Complete tests/assertions: all five 3-store roots, owner/CAS/conflict/duplicate/no-op/current+history semantics, faults after real writes, protected broader owners and imported helper closure. |
| `tests/fixtures/e04-library/harness.tsx` | Complete fixture: actual original/current pages, matched synthetic inputs, genuine native transaction/read counters, typed-kind covers, held-query publication hooks and original behavior instrumentation. |
| `tests/fixtures/e04-library/index.html` | Complete isolated one-document fixture entry: local main/harness import and root mount; no paid providers, production navigation or duplicate document entry. |
| `tests/fixtures/e04-library/tsconfig.json` | Complete fixture TypeScript config: real current dependencies/aliases and source snapshot inputs; fresh fixture tsc passes without package/config changes. |
| `tests/fixtures/e04-media/commands.ts` | Complete fixture: changed-caller seeds/work counts and faults only after actual deletes, retained release/other use/event behavior, outer transaction and queued overlapping writer. |
| `tests/fixtures/e04-media/index.html` | Complete isolated one-document fixture entry: local main/harness import and root mount; no paid providers, production navigation or duplicate document entry. |
| `tests/fixtures/e04-media/instrumentation.ts` | Complete DBCore observer: original Dexie Promise chains preserve transaction context; logical requests and returned/cursor rows, primary reads/writes separated; no physical IO claim. |
| `tests/fixtures/e04-media/main.ts` | Complete native matrix entry and derivative selection; original full entry raw SHA separated from saved effective subset entry, all retained assertions unchanged. |
| `tests/fixtures/e04-media/receipt.ts` | Complete actual tool/atomic root fixture: orphan has no business receipt, shot_delete creates receipt after real deletes; late ledger fault, retry/replay, current/media/history/Blob atomicity. |
| `tests/fixtures/e04-media/retention.ts` | Complete isolated/current/history freshness matrix, original scalar parity, denominator 30 unique/3 owners/60 scalar calls and request/row counters. |
| `tests/fixtures/e04-media/seeds.ts` | Complete 42-source case definitions, same/foreign owners, cancelled/deleted-target histories, duplicates/missing IDs, true library flags, audio/current/global cases and synthetic Blob identity. |
| `tests/fixtures/e04-media/tsconfig.json` | Complete fixture TypeScript config: real current dependencies/aliases and source snapshot inputs; fresh fixture tsc passes without package/config changes. |
| `tests/fixtures/e04-memory/index.html` | Complete isolated one-document fixture entry: local main/harness import and root mount; no paid providers, production navigation or duplicate document entry. |
| `tests/fixtures/e04-memory/main.ts` | Complete native fixture: six observations for five APIs, true history and later replacement writes, same-store CAS competitor vs media scheduling, original/current replacement outcomes. |
| `tests/fixtures/e04-memory/tsconfig.json` | Complete fixture TypeScript config: real current dependencies/aliases and source snapshot inputs; fresh fixture tsc passes without package/config changes. |
| `tests/fixtures/sourceSnapshots/e04-library/independent-transactions/provenance.json` | Complete provenance JSON: original byte source/reference/revision facts, SHA inputs and intentional shared dependencies verified; historical task paths are provenance only, no runtime imports. |
| `tests/fixtures/sourceSnapshots/e04-library/independent-transactions/studioLibraryQueries.ts` | Complete preserved initial per-owner equals helper; exact source hash5cb355... proves N implicit transactions baseline, distinct from final shared-tx helper88ee8d.... |
| `tests/fixtures/sourceSnapshots/e04-library/provenance.json` | Complete provenance JSON: original byte source/reference/revision facts, SHA inputs and intentional shared dependencies verified; historical task paths are provenance only, no runtime imports. |
| `tests/fixtures/sourceSnapshots/e04-library/src/components/studio/AssetLibraryPages.tsx` | Complete accepted pre-E04 actual page; all-table baseline/search/sort/cover and preserved E01 handlers independently compared to current. |
| `tests/fixtures/sourceSnapshots/e04-library/src/components/studio/ProjectGalleryPage.tsx` | Complete accepted pre-E04 actual page; global shots baseline and fallback semantics compared, accepted E01 mutation behavior retained. |
| `tests/fixtures/sourceSnapshots/e04-library/src/components/studio/ProjectIpPicker.tsx` | Complete unchanged original dependency snapshot: IP selection/owner mapping remains comparable; snapshot bytes/provenance verified. |
| `tests/fixtures/sourceSnapshots/e04-library/src/components/studio/projectKinds.tsx` | Complete unchanged original kind definitions/render icons snapshot; source hash/provenance and original imports verified. |
| `tests/fixtures/sourceSnapshots/e04-media/provenance.json` | Complete provenance JSON: original byte source/reference/revision facts, SHA inputs and intentional shared dependencies verified; historical task paths are provenance only, no runtime imports. |
| `tests/fixtures/sourceSnapshots/e04-media/src/db/database.ts` | Complete intentional current database reexport: original algorithm uses current schema/shared DB, separate from immutable original media algorithm. |
| `tests/fixtures/sourceSnapshots/e04-media/src/db/media.ts` | Complete original scalar retention implementation, 18 source semantics and original work denominator independently compared to current batch helper. |
| `tests/fixtures/sourceSnapshots/e04-media/src/db/productionShared.ts` | Complete intentional current shared-owner reexport: original/current compare identical 25 production stores and owner assertions. |
| `tests/fixtures/sourceSnapshots/e04-memory/projectMemories.ts` | Complete original memory implementation: only manual transaction store args changed; helper/owner/CAS/conflict/history/promote/wrapup behavior remains byte-compatible. |
| `tests/fixtures/sourceSnapshots/e04-memory/provenance.json` | Complete provenance JSON: original byte source/reference/revision facts, SHA inputs and intentional shared dependencies verified; historical task paths are provenance only, no runtime imports. |

## English spec recommendations — proposed, canonical untouched

### PD06 manual project-memory transaction ownership

Target: `.trellis/spec/frontend/project-memory.md`.

#### 1. Scope

Apply the three-store rule to createProjectMemory, updateProjectMemory, setProjectMemoryStatus, replaceProjectMemory and deleteProjectMemory. Keep read APIs, wrapup promotion, generic executeAtomicTool and beginAgentRun under their established owner scopes.

#### 2. Signatures / Owners

Manual APIs own one readwrite transaction over projects, projectMemories and projectMemoryVersions. Owner validation and optimistic revisions belong to repository functions. The UI preserves its draft/error state; it does not duplicate DB ownership checks.

#### 3. Contracts

Trace every awaited helper, not just lexical db calls. Require project ownership, owned memory reads, normalized duplicate/conflict checks and current/history writes inside the same transaction. Preserve current+version insertion/deletion and replacement ordering. Pure parsing/normalization does not need a DB store. Keep the existing duplicate early return separately from status no-op/CAS semantics; a duplicate case does not establish universal CAS validation or reactivate disabled memory.

#### 4. Validation / Error Matrix

Missing project/foreign memory -> existing rejection and no mutation. Stale revision -> CAS rejection with unchanged current/history. Same normalized topic with different content -> conflict until explicit replacement. Exact disabled duplicate -> same disabled ID, no reactivation. Fault after real version insertion or later replacement write -> current and all history roll back. Status no-op -> existing revision/status contract remains.

#### 5. Good / Base / Bad Cases

Good: the complete manual closure justifies three stores and actual native storeNames match. Base: retain a broad promotion/wrapup/tool scope until its own closure is reviewed, including dynamic business evidence/config initialization. Bad: narrow promotion because it calls persistMemoryChange, or infer all operations can share the manual table list.

#### 6. Tests Required

Exercise all five APIs, all helper closures, owner/CAS/conflicts/disabled duplicate and history cleanup. Inject failures after actual history and later replacement writes. Hold a history write with Dexie.waitFor; submit competitors outside the root transaction. Observe same-store serialization and unrelated media progress separately. Compare original46-store and final3-store roots on identical synthetic state; preserve raw loaded-source hashes and assertion producers.

#### 7. Wrong vs Correct

Wrong: treat store count as a per-project lock or latency benchmark, or remove broad owners without transitive proof. Correct: bound the specific manual roots by complete data access, retain atomic current/history behavior and report the observed native scheduling checkpoint with its device/fixture limits.

### PD07 fresh media retention and batch transaction ownership

Target: `.trellis/spec/frontend/state-management.md`.

#### 1. Scope

Apply batching to media orphan cleanup and each changed production caller. Preserve collectMediaIds(projectId?) for global current retention and owner-scoped backup projection, plus scalar deleteMediaIfOrphan and injected DraftMediaSession compatibility. Keep PRODUCTION_TABLES at25.

#### 2. Signatures / Owners

deleteMediaIfOrphans accepts readonly (Id | undefined)[] and owns or joins a production readwrite root. Deduplicate truthy candidates, bulkGet media rows once, derive each actual MediaRecord.projectId, snapshot global current references once and indexed history sets once per actual owner. The scalar API delegates one ID. Caller mutation, retention snapshot, deletes and durable receipt/event remain under the original transaction owner.

#### 3. Contracts

Retain all18 source tables:14 current tables plus productionProposals, agentGenerationJobs, agentGenerationBatches and agentGenerationBatchItems. Current references are global, including archived/library/audio/reference/material-use cases. Historical references use the candidate record owner, including cancelled/deleted-target evidence; foreign-owner-only history retains original exclusion semantics. Do not persist/cache reference sets across calls. Await individual deletes to retain fault hooks. Release a material use only after other uses allow it, clear every copied libraryRetained flag before one snapshot, reject survivors, then emit the event. Roll back use/flags/real Blob deletes on any later failure.

#### 4. Validation / Error Matrix

Undefined/missing/duplicate candidates -> safe skip/dedup. A reference added between independent calls -> fresh retention. Same-owner history after target deletion/cancellation -> retained. Foreign-owner-only history -> original parity. Later actual media deletion failure -> all prior current/history/Blob changes restored. Retained copied media or final event fault -> full release rollback. Real shot_delete receipt followed by ledger fault -> receipt and deletion roll back together; successful retry/replay stays idempotent. Orphan-only tools do not gain a business receipt.

#### 5. Good / Base / Bad Cases

Good: mutate all relevant current rows first, snapshot once inside the existing production root, use per-candidate-owner history sets and sequential deletes. Base: DraftMediaSession continues per-ID scalar cleanup, retaining failed IDs for retry and releasing kept ownership only after persist succeeds. Bad: clear one flag, snapshot, then clear another; reuse an ambient retention cache; derive history ownership from the deleting caller; claim all uploads plus save are atomic.

#### 6. Tests Required

Keep the full18-table retention and complete caller matrix, protected scalar cover/reference/backup paths and actual receipt/undo closure. Native proof must include fresh references, mixed owners, late actual deletes, flags/other uses/events and overlapping-writer commit visibility. Work fixture:30 unique existing library-retained candidates,3 owners,60 original duplicate scalar calls; final receives same duplicates plus undefined/missing,31 lookup keys. Report1080->26 DBCore retention requests and1800->30 returned-row/cursor-step sum separately from candidate reads/writes; formula14 +4*actualOwners applies to this retention scan shape.

#### 7. Wrong vs Correct

Wrong: label these logical request/row totals exclusive physical disk IO, IDBCursor-only visits or latency savings. Correct: state the exact denominator, observers, excluded candidate reads/writes, mixed-owner/current-history semantics and finite isolated Chromium evidence limits. Preserve actual mutation fault producers, their failure history and raw source hashes.

### SS09 precise library query scope and held-result identity

Target: `.trellis/spec/frontend/hook-guidelines.md`.

#### 1. Scope

Apply scoped fallback reads to ProjectGalleryPage and typed current-kind asset reads to AssetLibraryPages. Keep existing project/IP/link metadata queries, MediaThumb reads, authored search/sort/loading behavior and accepted E01 navigation/mutation/error ownership.

#### 2. Signatures / Owners

The gallery owns the visible fallback project-ID set; readProjectCoverIds returns Map<projectId, mediaId>. Deduplicate IDs and return empty without DB reads when none remain. Execute one readonly db.shots transaction with N exact projectId.equals cursors. Each keyed asset kind queries its matching typed studio table and invokes its actual cover function. Query results carry the current owner/kind key before use.

#### 3. Contracts

Explicit coverMediaId wins through existing nullish semantics. Only visible projects needing fallback enter the owner set. Read complete rows, reduce first eligible firstFrame by strict order comparison so equal-order primary-key traversal stays stable across episodes, and return a narrow Map. A missing selected media record preserves existing render fallback rather than choosing a different later shot. Reject retained results under a changed filter/IP/search/archive/sort owner key. Preserve actual authored asset search fields and stable sort; wrapper IDs/provenance/cover fields do not become search data. Keep E01 locks/errors/captured targets untouched.

#### 4. Validation / Error Matrix

Explicit-cover-only set -> zero fallback reads. Unselected-owner shot write -> no fallback callback/read/reducer work. Other-kind table write -> no current-kind asset query rerun. These claims exclude broad gallery project/IP metadata queries and MediaThumb behavior. Relevant fallback mutation/cleared explicit cover -> refresh. Equal-order/multi-episode/no firstFrame/missing media -> existing selection semantics. Held old owner/kind result -> cannot populate the new scope. Query errors/loading retain established UI semantics; do not claim new error handling absent source.

#### 5. Good / Base / Bad Cases

Good: N precise owner cursors share one readonly snapshot. Base: complete DB records are transient inputs to a narrow Map, with no persisted cover cache. Bad: call Map JSON bytes physical column projection, query all four asset tables for a fixed kind, or minimize requests using anyOf without verifying installed Dexie observability.

#### 6. Tests Required

Use actual original/current pages and native IndexedDB for explicit/fallback/ties/multi-episode/missing media, search/sort/IP/archive and held filter/kind identity; retain full writer all-four-kind matrix plus independent critical subset. Insert a shot for an excluded owner whose projectId index key lies between selected owner keys. Preserve the anyOf counterexample:47 complete cursor rows versus45 matched reducer visits and an irrelevant rerun. Final exact ranges must show zero fallback read/reducer work for the same insertion within the bounded post-commit wait. Distinguish3 requests/3 transactions before from3 requests/1 transaction after. Verify current E01 writes against final helper/source and unchanged producer.

#### 7. Wrong vs Correct

Wrong: say final cleanup uses one query, call the gap a shot-primary-key gap, or infer disk/latency savings from projection/callback counters. Correct: label one readonly transaction with N cursor requests, distinguish complete returned rows, cached warm behavior, reducer work and Blob-excluding JSON bytes, and preserve finite negative-wait and device limits. Typed-static deltas remain independent from formal quality-debt acceptance.

## Completed handoff

All reviewer reports and snapshot are finalized before completion. The snapshot records exact product roots, current gate input hashes, evidence/report hashes and per-file coverage; its SHA256 is returned externally to avoid circular self-hashing. No required review work remains. No late writes are planned after handoff. Main may now perform acceptance and canonical spec integration.

