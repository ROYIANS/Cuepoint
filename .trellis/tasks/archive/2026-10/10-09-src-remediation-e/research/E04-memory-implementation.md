# E04 PD06 memory implementation handoff

Implementation and scoped verification are ready for the coordinator's integrated independent review. This writer does not accept E04 or update specs, status or the remediation ledger. The only changed product file is `src/db/projectMemories.ts`; the assigned product, tests, fixture, runner and original snapshot are frozen. Other E04 source owners were not edited or reverted.

## Product result and complete manual closure

Declare `MANUAL_MEMORY_TABLES = [db.projects, db.projectMemories, db.projectMemoryVersions]` once and use it in exactly five manual public commands. There is no transaction factory, registry, schema migration or helper relocation. The entire module comparison proves that the new declaration/comments and five transaction table arguments are the only product changes. Fifteen existing helper/export declarations are byte-identical; each changed command becomes byte-identical to its original after normalizing that single argument.

| Command | Complete helper/read closure | Writes in the same transaction |
| --- | --- | --- |
| `createProjectMemory` | Pure `parseMemoryInput` precedes transaction; `create` calls `project` → `projects.get`; `duplicateOrConflicts` → project-indexed `projectMemories.toArray`; optional `owned` → `projects.get` + `projectMemories.get`; `revision` and ID/time/input/content/source helpers are pure | Optional replaced row then new row, each through `persist` → `projectMemories.put` + `projectMemoryVersions.add` |
| `updateProjectMemory` | Pure input parse precedes transaction; `owned` → project + current memory; pure revision/status guards; `duplicateOrConflicts` → owner-indexed current memories | Revised current row and its full immutable version through `persist` |
| `setProjectMemoryStatus` | Pure status guard; `owned` → project + current memory; pure revision/superseded guards; activation reads owner-indexed current memories and compares normalized content/topic | Changed status/revision/current row and version through `persist`; no-op status still checks CAS |
| `replaceProjectMemory` | Pure self-replacement guard; both `owned` reads include projects and memories; both revisions checked; conflict scan excludes destination and only permits the replaced conflicting source | Superseded old row + old history, then active destination + destination history, both through `persist` |
| `deleteProjectMemory` | `owned` → project + current memory; pure revision check | Current-row deletion; memory-indexed history deletion filtered again by project owner |

`project`, `owned`, `revision`, `persist`, `duplicateOrConflicts`, `sourceIdentity`, `sameContent`, and `create` were inspected in full. `parseMemoryInput`/`normalizeMemoryText` are pure schema/normalization helpers and `createId`/`nowIso` are pure with respect to IndexedDB. No helper in these five closures reads another store. Project ownership, current-row ownership, normalized duplicate/conflict, CAS and history writes remain within the original single transaction. The create duplicate early return still deliberately preserves reviewed disabled/superseded rows without reactivation or unnecessary replacement validation.

## Protected broader owners retained as part of the PD06 resolution

These owners cannot inherit the manual three-store list. Their broader transactions are deliberately retained; this is a justified scope decision, not a claim that every `db.tables` use has been minimized.

- `promoteProjectMemory` → `sourceSummary`: besides projects/memories/history, reads `agentTasks`, `chatThreads`, current/historical `agentTaskWrapups`/`agentTaskWrapupVersions`, confirms exact source item and constructs bounded evidence. It then invokes `getTaskWrapupState`, whose existing readonly child transaction requests `db.tables`. A three-store promotion parent would be incompatible with that child and omit the protected summary/evidence closure.
- `getTaskWrapupState` → `owned`, `collectWrapupSnapshot`, `completionBlockers`: task/thread ownership; runs/messages/tool calls/task records/generation jobs/batches/items; live business entity locators through `businessStore.getRow` (project/episode/beat/shot/character/scene/prop/style/media); current generation owner/output checks; project references/media; audio job ownership/output evidence; summary history and busy/completion checks. Evidence fingerprints and availability must share a coherent transaction. This dynamic business/evidence owner was not replaced with a guessed nominal list.
- Generic `executeAtomicTool`: validates run/thread/message/project/call, executes a callback that can mutate different business domains, and commits its result receipt/call transition only after that callback succeeds. The callback's full read/write closure determines the stores. Narrowing from a memory command name would lose atomic business writes or receipts. A meaningful memory test proves nested manual commands still join a broad outer transaction and roll back on a later outer evidence failure.
- `agentRuns.beginAgentRun`: reads task/thread/project/run/message/wrapup state, agent configuration, task context, context compactions, project memory selection and reference/vision materialization; may create task/agent data and writes messages/run/task/thread together. The child configuration transaction can write `agents`. This initialization owner has no separately complete narrowed closure in this assignment.
- Complex wrapup prepare/save/confirm/fail owners use task readiness, source/evidence fingerprints, content validation and current/history writes. Those evidence transactions remain unchanged. Existing deliberately narrower unrelated wrapup methods also remain unchanged.
- The other memory read/source/candidate APIs retain their current scopes because this assignment covers five manual writes only. No assertion is made that those simple read APIs inherently require every table.

## Meaningful deterministic verification

Final focused command: machine `pnpm test tests/e04MemoryTransactions.test.ts tests/projectMemories.test.ts --maxWorkers=4` → **2 files, 39 tests passed**, comprising 30 new transaction regressions and 9 existing memory contract tests. Existing test source was not edited.

The new regressions inspect `Dexie.currentTransaction.idbtrans.objectStoreNames` through actual project reads for every public manual command. All five use exactly `projectMemories`, `projectMemoryVersions`, `projects`. Success cases also assert status/revision/history transitions or owned deletion and preservation of another memory's history.

All five command forms reject stale CAS, foreign owner and missing/studio owners without changing project/current/history snapshots. Create/update/status faults occur **after a real version insertion** and compare the actual current row with that version before throwing. Both create-with-replacement and existing-row replacement faults occur at the **later destination put**, after observing the old superseded row and its new immutable history. Delete fails at history deletion after observing that the current row was actually deleted. Each entire snapshot is restored. Further tests exercise concurrent normalized duplicates without reactivation, normalized topic conflicts, activation conflicts, both replacement revisions/owners, a third active conflict, self-replacement and nested outer atomic rollback. These fake-indexeddb tests prove contracts/store scopes/rollback, not native scheduling or speed.

Final fixture/owned-test type command: machine `pnpm exec tsc -p tests/fixtures/e04-memory/tsconfig.json --pretty false` → exit **0**. This explicit fixture config also includes the new unit test, so fault callbacks are checked against Dexie's extended promise signature rather than left unchecked. Machine application `pnpm lint` was run once after own source stabilization → exit **0**. It is an observed whole-application compiler run during parallel work, not a frozen whole-repository integration acceptance.

## Native IndexedDB observations

Use `scripts/e04-memory-browser-regression.mjs`, the single explicit fixture HTML/main, an isolated temporary Vite cache, installed Playwright and the authorized headless Chromium. Both modes execute the **actual existing repository functions**. Before mode replaces only the memory module with the byte-identical entry snapshot at its original module path, preserving relative/alias imports. Shared dependencies remain current and are explicitly recorded; no transaction/command replicas or task-folder runtime inputs exist.

Final before attempt 3 and after attempt 1 each passed **4 scenarios**, with one main-frame document, no browser errors and zero loaded-dependency hash drift during each individual run. Installed versions were Node **24.11.0**, Vite **7.3.6**, Dexie **4.4.6**, Chromium **151.0.7922.34**. Version ranges in package.json are not treated as the installed runtime versions.

| Observation | Original module | Current module |
| --- | --- | --- |
| Actual stores for all five commands | 46 stores | Exactly the same 3-store complete manual closure |
| Actual project-read store observations | 6 (replacement validates both owners) | 6 |
| Fault after real history insertion | 1 reached; full rollback | 1 reached; full rollback |
| Later replacement faults | 2 reached; both full rollbacks | 2 reached; both full rollbacks |
| Post-fault retry | Succeeds at revision 2 | Succeeds at revision 2 |
| Competing same-owner update while first history is inserted and held | No competing history, then stale CAS rejection after release | Same behavior |
| Unrelated `media` store write before release | Not completed at the native request checkpoint; completes after release | Completes while memory transaction remains held |
| Final first memory and history | First edit, revision 2; versions [1,2] | Same |
| Loaded source paths observed | 46 | 46 |

Scheduling holds a real update **after its real history insertion**, using a fixture-only `Dexie.waitFor` gate. Independent invocations explicitly use `Dexie.ignoreTransaction`; they must not accidentally join the held writer's Dexie promise zone. The completion verifier also executes outside that writer's context. A second actual update uses the original revision 1. An independent transaction writes a real Blob-bearing fixture row in the unrelated `media` store. Five completed native transactions in a **separate probe database** provide a request-driven checkpoint with no sleep. Before mode shows the unrelated write remains blocked at that checkpoint; after mode awaits its actual completion while the memory gate is still unreleased. Releasing the gate yields the first commit, stale second CAS rejection, no second history writes and versions [1,2]. This demonstrates store scheduling, not a measured latency/speedup. IndexedDB locks object stores across owners; there is no claim of a per-project lock or parallelism for different projects sharing these stores.

## Failed attempts preserved

- `fixture-type-attempt-1.log` records six TS errors from returning native promises for Dexie methods requiring `PromiseExtended`. The exact three producer inputs/hashes were saved under `fixture-type-attempt-1/`. Corrections wrap the fault callbacks in `Dexie.Promise.resolve().then(...)`; attempt 2 and the final type run passed. Focused tests were rerun because these callback implementations changed.
- Native before attempt 1 passed three scenarios but failed the held scheduling assertion because the fixture launched the competitors in the held transaction context. Its original producers, observations/log and screenshot remain preserved. The original module was not changed in response.
- Native before attempt 2 established the correctly blocked unrelated checkpoint but the completion verifier surfaced `DexieError2` through Playwright. Its exact producers, observations/log and screenshot remain preserved. The diagnostic did not serialize a more specific error message, so none is inferred as observed evidence. Running that verifier in an independent Dexie context and serializing completion errors is the final fixture correction. Before attempt 3 and after attempt 1 pass with the same final producer hashes.

## Freeze, provenance and limits

`e04-memory/entry.json` records the 13 bounded entry input hashes. The accepted coordinator E04 entry manifest hash is `d7226d85662d5060d27e17f96142b1edc3709459ec9a8b630462d9c4638c7772`. Product before/immutable snapshot is `2385dcc806bd3a6e888e27dd281b704f75abb4acc77fb5a29859ae7409aea1b9`; product after is `33ea5784a01f3b30583416e01f09c83ce25cf071de2547c40713d6b3b9419cb3`.

`e04-memory/ownscope-freeze.json` and the companion implementation JSON enumerate all eight product/test/fixture/runner/snapshot paths and exact hashes. `e04-memory/handoff.json` contains report/evidence hashes and the complete owned output inventory. Native reports record the actually loaded current source hashes; in before mode the memory module's **effective** consumed hash is its separately verified `originalSHA256`, not the live after-source hash recorded before the Vite replacement. The implementation JSON reconstructs that exact effective closure for both successful runs.

Only PD06 owned bytes are frozen. The 46 loaded shared source paths were observed unchanged during each individual native run; this is neither a freeze of all src nor a guarantee about concurrent changes after those runs. No other writer's source change is attributed to this writer. The coordinator must run the final current integrated source closure, full/static/AST checks and independent review. No new install, paid request, commit, manifest/package/spec/status/ledger edit or other product-file mutation was performed. The original snapshot is test-owned and immutable; permanent tests/runners do not read active/archived task paths.

## English spec suggestions for the coordinator

1. Under project memory mutation contracts: “The five simple manual commands declare projects, projectMemories and projectMemoryVersions together. Project/current ownership, normalized duplicate/conflict checks, expected revisions and immutable history persistence occur in that same transaction; replacement includes both current rows and both histories.”
2. Under transactional owner boundaries: “Do not reuse the manual memory store list for source promotion, wrapup evidence, agent-run initialization or generic atomic-tool callbacks. Their dynamic evidence/receipt closures require separate complete analysis; nested manual commands remain compatible with broader outer atomic owners.”
3. Under evidence guidance: “Assert actual native IDBTransaction.objectStoreNames and observe faults after real current/history writes. A controlled independent unrelated-store completion and a serialized stale-CAS competitor establish scheduling; fake-indexeddb assertions and store counts alone do not establish speed or per-project parallelism.”
