# E04 / PD07 media implementation handoff

Implementation is ready for coordinator integration and independent E04 review. This writer does not close PD07/E04, edit specifications/ledger/status, or claim a stable entire source tree while other writers work. The machine pnpm executable was used explicitly with machine Node24 PATH; its observed version is **10.15.0**, rather than the older version mentioned in the global instruction. No installation occurred.

## Product change and unchanged boundaries

Six product files changed: `src/db/media.ts`, `assets.ts`, `shots.ts`, `episodes.ts`, `assetReuse.ts`, and `cascadeCommands.ts`. The authoritative changed-file/before-entry/after hashes are in `E04-media-implementation.json`. `projects.ts` and `references.ts` remain unchanged scalar callers.

`deleteMediaIfOrphans(mediaIds)` deduplicates nonempty IDs, bulk-reads candidate records once, takes one fresh current-global retention snapshot, and builds historical retained-ID sets with four indexed queries for each distinct candidate **MediaRecord.projectId**. Deletions remain individual awaited `media.delete` operations within the original compatible transaction. Individual deletes preserve existing D02 fault hooks without changing its immutable producer/harness. No transaction-wide retention cache exists. Each explicit cleanup after later writes takes a new snapshot.

`collectMediaIds(projectId)` is byte-unchanged; scoped backup content remains separate from proposal/image-generation histories. All 18 retention tables and the complete 25-table production transaction closure remain. Other current owners can retain a candidate, while foreign-owner-only histories retain nothing under the existing scalar contract. Studio media is a valid owner. Proposal before/change, job input/result, batch before/result and item draft inputs retain across persisted historical states without joining to live targets or threads.

Existing multi-candidate callers now submit one batch after their owner/history/order/relationship/touch changes. Material release deduplicates copies, checks other-use conflicts, clears **all** intended `libraryRetained` flags, then invokes one cleanup and bulk-checks survivors before adding its release event. Any retained copy or late storage/event fault aborts the whole operation, including prior actual Blob deletions. Missing copies remain compatible no-ops.

The public scalar `deleteMediaIfOrphan(id)` remains the injected DraftMediaSession callback. Its cleanup ownership and failure behavior are intentionally unchanged: discard removes an owned ID only after successful cleanup; each callback has its own production transaction; save cleans unkept uploads before persistence and releases kept ownership only after success. This change does not claim atomic cleanup of all draft uploads plus save.

## Verification on final owned inputs

- Focused suite: **14 files / 380 tests passed**, including **150 new E04 cases** and existing draft/CAS/undo/proposal/generation/audio/reference/material/D02 coverage. Permanent tests and native fixtures read only repository/test-owned modules and immutable test-owned source snapshots.
- Fixture TypeScript and application `pnpm lint`: passed. Final command metadata records actual zero exit codes and matching owned-input hashes before/after. Application lint ran the then-current root; final whole-root/static/value-AST/integration checks remain coordinator-owned.
- Final native Chromium **151.0.7922.34**, Node **v24.11.0**, Dexie **4.4.6**, Vite **7.3.6**, TypeScript **5.9.3**, Vitest **5.0.1**: passed. The runner used one initial fixture document, a fresh isolated Vite cache/HTML entry, native IndexedDB and real repository commands. External requests and page errors were zero.
- Native executed 42 isolated retention cases (unavailable references excluded), 41 later-write addition/removal freshness cases in the same outer transaction, mixed-owner original/current parity, 16 caller late-mutation rollback/retry cases, 30 caller work-count observations, 12 retained-copy release rollback cases, final event failure/retry, duplicate/missing copies, nested outer failure, real orphan-tool result ledger and shot receipt ledger rollback/replay, and overlapping native writer scheduling.
- The native source closure contains **155 actually served repository modules**, individually hashed on first read and after the run. It and the 20 owned product/test/runner files had zero run-time drift. This is evidence for that concrete served closure, not an all-src stability assertion. Source modules belonging to other writers are dependencies only, never attributed to this writer's changed scope.
- Actual stores: production callers 25; thread deletion 35; material release 26. Scalar orphan tool persists `deletedId` without a business write receipt, matching its existing contract. Shot deletion constructed a real business receipt after three actual media deletions; final ledger failure rolled everything back under the same native root, and retry/replay passed.

## Measured work, separate from latency

The same retained-candidate vector includes each existing ID twice plus a missing/undefined candidate in the batch. Current-global retention requires 14 passes per operation; histories require 4 passes per distinct record owner. The missing candidate is bulk-read and adds no history owner.

| Existing candidates / owners | Original scalar retention passes | Batch retention passes | Original media cursor rows | Batch media cursor rows |
| --- | ---: | ---: | ---: | ---: |
| 1 / 1 | 36 | 18 | 2 | 1 |
| 30 / 3 | 1080 | 26 | 1800 | 30 |

The batch made one candidate `getMany` request with 31 deduplicated keys for 30 records plus one missing ID. Unrelated-owner history rows were excluded by indexed reads. Each real multi-candidate command was observed at 1 and 12 candidates; current retention passes and owner history passes stayed fixed. Release has one additional, explicitly separate material-use conflict read plus linear primary-key flag updates and the post-cleanup bulk existence check. Individual physical deletions and candidate reads remain linear. There is no measured latency improvement claim, no fake-IndexedDB scheduling claim, and no provider/UI/codec benchmark.

Native scheduling enqueued an overlapping production writer after the first actual deletion. Every remaining deletion used the same native transaction, and the competing writer saw all candidates deleted together after commit. The competing callback may run before the cleanup promise's caller receives resolution; callback order is reported without interpreting it as latency.

## Preserved failures and observer correction

Every attempt is retained under `research/e04-media/`. Initial work assertions incorrectly included primary-key update cursors as global passes; the final observer distinguishes Dexie's full-range queries from key updates. Initial fixture typing errors involved widened literals, PromiseExtended interception signatures and subsequently annotated result arrays. Native attempt01 and the first ledger diagnostic failed because the fixture incorrectly assumed orphan media creates a business receipt.

A later shot receipt diagnostic found that **the test observer's native async Promise wrappers around DB-core methods lost Dexie transaction context**. Forwarding the original Promise chains with `.then` corrected the observer, without product changes. The final native shot receipt case asserts media deletion and ledger mutation share the same native transaction before failing the ledger and comparing every durable row/Blob byte. Earlier diagnostic failures are not product-regression evidence. Native attempt02 passed runtime before a fixture-only type correction; `native-final` is the final frozen input proof. Early shell wrappers did not separately persist underlying exit codes; their raw logs and failure diagnostics remain, while final validations record exact codes.

## English specification suggestions for coordinator

1. Document `deleteMediaIfOrphans(readonly (Id | undefined)[])` as one fresh per-operation snapshot after all owner/history/flag changes, with global current references and histories keyed only by candidate record owner. Keep scalar compatibility and `collectMediaIds(projectId)` backup projection explicit.
2. Keep the full 18-table read closure and 25-table production transaction scope. Compatible nested operations share the original root; no independent commit or stale ambient cache is permitted.
3. Specify release ordering: other-use validation, all intended retention flags cleared, one cleanup, survivor rejection, final event; any failure restores bindings, flags, rows and actual Blob bytes.
4. Require meaningful late-fault tests at the mutation method actually used, transaction-returned undo snapshots, real tool ledger/receipt rollback, isolated retention sources and per-owner query counts.
5. Measurement fixtures must preserve Dexie Promise chains and native transaction identity. Report full scans, cursor rows, indexed history reads, candidate reads and owner mutation reads separately; fake IndexedDB and byte/work counts do not prove latency.
6. Freeze actual native served dependencies and own files separately from concurrent writers' source. Permanent comparison inputs belong under `tests/fixtures/sourceSnapshots/`; historical task/native producers remain immutable.

Full integration, cumulative static/value-edge analysis, independent review and specification/ledger acceptance remain with the coordinator. No commit, install, task status change or unrelated writer edit was performed.
