# D01 cycle-break plan — AR-04 / PD-04

Research only, 2026-09-30; active task `09-30-src-remediation-b`, concurrent B02 implementation. This is a proposal for later D01, not implementation ahead of the ordered batches. Only this artifact was written. No tests/build, installs, broad audit/map, product/spec/ledger/task-status/tool changes, commits, pushes or spawned agents.

## Decision and evidence boundary

**Four value-import cuts are sufficient and minimal for the reported eight-file SCC.** Extract two pure selectors, a DB target reader, transaction-external generation preparation and a DB task guard. Keep cross-table commands and their transactions in place.

Read AR-04 (`../09-30-src-quality-architecture-audit/research/agent-runtime.md:70–85`), PD-04 (`research/persistence-domain.md:55–62`), the existing `research/tools/ast-results.json.staticValueCycles`, and current imports/calls in the eight files. The original audit base is `2fc0e9523e62a5258a488cc3d0274d24c8967c6f`. Current membership and all 13 internal value edges still match the report; no eight-file membership change was found after A04/B01. Current source controls implementation, including existing sound-evidence helpers and native-Promise adoption. All eight paths were clean at the scoped status read; latest scoped commit was `805044a` (formatting).

The aliases below refer to `src/db/{agentGenerationBatches,agentTaskRecords,agentTaskWrapups,agentTasks,agentTools}.ts` as **B/R/W/A/T**, and `src/lib/agent/{generationRuntime,toolLoading,wrapupEvidence}.ts` as **G/L/E**. No unrelated non-SCC dependencies were audited. Searches outside these files were limited to existing contracts, direct symbol callers and later test names.

## Exact before/after edges

These are value imports, not type edges or direct table access.

| Before | Values used by caller | Proposed after |
| --- | --- | --- |
| B → G (`B:14`) | `prepareGenerationSnapshot`, `loadGenerationInputs`, `readGenerationTarget` | **Cut 1:** B → new `lib/agent/generationPreparation`; B → new `db/agentGenerationTarget` |
| R → G (`R:1`) | `readGenerationTarget` | **Cut 2:** R → `db/agentGenerationTarget` |
| R → A (`R:3`) | `editableAgentTask` | **Cut 3:** R → new `db/agentTaskGuards`; A → same guard |
| T → L (`T:2`) | `getOfferedToolNames`, `toolNamesForCall` | **Cut 4:** T → new `domain/agentToolSelection`; L → same leaf |
| B → T | `AtomicToolRollbackError`, `executeAtomicTool` | Keep: batch/items/result atomicity |
| G → B | `ownedGenerationBatch` | Keep: runtime checks durable batch ownership |
| G → T | `AtomicToolRollbackError`, `executeAtomicTool` | Keep: local mutation/ledger command |
| L → T | `executeAtomicTool` | Keep: discovery executes a persisted operation |
| T → R | `writeTaskRecord` | Keep: plan, record/history, run and ledger commit together |
| A → R | `writeTaskRecord` | Keep: requirements history and task revision commit together |
| A → W | `assertTaskWrapupCompletion` | Keep: completion validation inside lifecycle transaction |
| W → E | `collectWrapupSnapshot` | Keep: fresh evidence under caller's transaction |
| E → R | `provesCompletedEffect` | Keep for minimum; optional fifth cut to existing `domain/agentTaskRecords.ts` |

Four edge-disjoint cycles prove a lower bound of four cuts: B→G→B, T→L→T, A→R→A, R→G→T→R. A bounded in-memory check of only these eight nodes confirmed minimum cardinality four and acyclicity after the selected cuts. Remaining edges are `G→B/T`, `B→T`, `L→T`, `T→R`, `A→R/W`, `W→E`, `E→R`; no path returns to its caller. This is a planning check, not post-implementation acceptance.

## Function ownership and actual callers

Line anchors are current-source coordinates. Extract unchanged behavior; preserve existing return shapes.

| Existing function | Actual callers | Proposed owner and contract |
| --- | --- | --- |
| L:37 `getOfferedToolNames` | T:`startModelStep` (:82); external `runChat`, `ContextUsagePanel` | `domain/agentToolSelection`: pure frozen-run selection; same conversation/legacy behavior, enabled ceiling, ordering/dedup |
| L:45 `toolNamesForCall` | T:`saveToolRound` (:109), L:discovery handler (:87); external `runChat`, `agentProjectCreation`, `agentFinishingCheck` | Same pure leaf: historical step offers cannot be broadened by later loading |
| G:56 `readGenerationTarget` | B:`recheck`, `readGenerationBatch`, `assertBatchDispatch`, `applyBatchSelections`; R:`taskGenerationSource`; G:prepare, submission preflight callback, prepare/apply | `db/agentGenerationTarget`: same project/entity/shot-episode/slot checks, `{entity, slot, revision, label}`; joins caller transaction, opens none |
| G:110 `prepareGenerationSnapshot` | B:prepare (:104), confirm (:244), retry (:450); G:preview (:155), submit (:238) | `lib/agent/generationPreparation`: same `{args, config, provider, request, inputs, fingerprint, current, records}`; called before write phase |
| G:172 `loadGenerationInputs` | B:apply (:375); G:`nativeRequest` (:190), `submitClaimedGeneration` (:294), apply (:574) | Same preparation module: existing `Promise<MediaRecord[]>`, project and input-hash revision checks outside write phase |
| G:83 private `connector` | G:prepare (:114), `checkAgentGeneration` (:459) | Preparation module; export as `resolveGenerationConnector` with unchanged validation for both callers |
| A:34 `editableAgentTask` | R:manual save (:119); A:update, lifecycle, pin, unpin | `db/agentTaskGuards`: same task/thread/project/preparing/busy checks; no writes/new transaction |
| R:26 `provesCompletedEffect` | R:`validateTaskSources` (:61), E:collector (:92) | Keep R for minimum; optional exact move into existing domain record contract |
| R:73 `writeTaskRecord` | A:update (:98), T:`saveRunPlan` (:270), R:manual save | Keep R: transaction-internal source/CAS/dedup/history write |
| W:92 `assertTaskWrapupCompletion` | A:lifecycle (:114) | Keep W: current confirmed identity/revision/fingerprint gate |
| E:28 `collectWrapupSnapshot` | W:state (:42), completion (:99), start (:105), save (:151), confirm (:173), publish (:191) | Keep E: consistent durable projection inside W/A transaction |
| B:52 `ownedGenerationBatch` | G:`jobForContext` (:167), B read/write/dispatch commands | Keep B: original call, run/thread/project/task/lifecycle checks |
| T:343 `executeAtomicTool` / :323 rollback error | B:prepare; L:discovery; G:local apply/failure classification | Keep T: local mutation and ledger result commit/rollback together |

No external production callers were found for the extracted generation helpers, editability guard or effect predicate beyond these eight files. Existing tests import selectors through L.

### Smallest useful leaves

- **Selector leaf:** move only the two pure functions with type-only Agent imports. `DISCOVERY_TOOL_NAME` and `MAX_LOADED_TOOLS` may join them as capability constants. Keep skill catalogue wiring, `createToolLoading`, instructions, discovery schema/registry/handler and envelope refresh in L. Do not introduce DB, provider, registry or transport dependencies into the leaf.
- **Target reader:** a DB query, not a pure domain helper. Preserve studio/project and shot-episode ownership, missing-slot error, existing empty-slot fallback and `targetRevision`. Keep `generationTargetHref` and the existing `domain/production` target type in their owners; neither needs moving for these cuts.
- **Preparation:** move private `inputRevision` and preparation-only `targetTables` with the snapshot/input functions and shared connector resolver. Preserve draft flush, local connector/schema checks, short target/media read transaction, then Blob hashing/image decoding after that transaction resolves. This module does local IO, so belongs in application preparation, not domain or a DB transaction helper. It must not import G, batch/ledger commands or task repositories. Keep upload/base64 encoding, provider submit/poll/download, cancellation/recovery, redaction and apply orchestration in G.
- **Prepared versus durable types:** B's `Prepared = Awaited<ReturnType<typeof prepareGenerationSnapshot>>` can refer to the new preparation export. Do not store that transient credential/Blob-bearing object in domain persistence types. B's `frozenGeneration` continues to persist only existing `GenerationSnapshot` fields.
- **Guard:** reuse `taskState.isTaskBusy`; move the existing guard without new lifecycle restrictions. W's `owned`/`ready(taskId, except?)` have different preparing/lifecycle rules and remain separate. A's reopen/archive behavior must remain possible.

## Durable evidence ownership

R owns persisted source validation, record/history and current available/applied generation evidence. Existing `taskAudioGenerationEvidence` owns current sound evidence. W owns fresh fingerprint/revision/family/confirmation/completion gates. T owns offered-tool history and ledger results. E reads durable rows and projects them under the caller's consistent transaction; its present `lib/agent` path does not turn it into a provider service.

G owns remote execution/reconciliation and uses repository commands for durable transitions. L owns discovery execution and protocol envelope refresh. Neither historical runtime success nor AI prose substitutes for current owned-media checks or task completion gates. Preparation validates transient inputs; it does not certify durable outcomes.

`provesCompletedEffect` is genuinely pure historical classification. An optional fifth cut can move that one function into **existing** `domain/agentTaskRecords.ts`, with a type-only `AgentToolCall` import, and have R/E share it. Callers still enforce completed status, ownership and current-media evidence. Do not move `validateTaskSources`/`taskGenerationSource` into domain or duplicate their business rules. Moving/decomposing the entire collector is unnecessary for the minimum cut and deferred.

## Later write scope and invariants

Required product scope: six existing modules **B/R/A/T/G/L**, plus four new files:

- `src/domain/agentToolSelection.ts`
- `src/db/agentGenerationTarget.ts`
- `src/db/agentTaskGuards.ts`
- `src/lib/agent/generationPreparation.ts`

W/E need no change for the minimum plan. Optional predicate move adds E and existing `src/domain/agentTaskRecords.ts` to scope. Optional import-only selector cleanup touches `src/db/agentProjectCreation.ts` and `src/db/agentFinishingCheck.ts`; these non-SCC callers need no logic changes or expanded audit.

Compatibility re-exports from L/G/A may preserve existing consumers. Original modules must also import moved helpers for their own use; re-exporting does not create a local binding. **B/R/T must import the leaves directly**, not those barrels, or the original edges remain.

Preserve these boundaries:

1. `executeAtomicTool` keeps one `rw db.tables` transaction, ownership/abort/result-size checks, completed-result replay and ledger rollback with local business writes; no transport callback enters it.
2. B prepares/hashes outside write transactions, then rechecks ownership, target revision, connector/media and selection inside them. Batch apply retains its existing per-entity transaction over slots, jobs, revision chain and application history; do not split by table or merge independent entity outcomes.
3. R keeps source/CAS/dedup/history writes within A/T/manual-save transactions. Manual save's editability check remains inside its transaction.
4. W's prepare/save/confirm/publish and A's completion continue reading fresh full fingerprints inside the owning transaction, including omitted history, latest family, current evidence, cancellation and deletion gates.
5. Preserve E/R's existing `Promise.resolve(...)` adoption for cached/invalid entity and audio-evidence branches. Hashing, decoding, draft flush and provider work remain outside write transactions. Keep existing validators (`generationSubmitSchema`, `profileRequest`, batch limits, project scope, busy guard, wrapup schema and source/audio ownership); do not copy rules to eliminate imports.

Reread current source after intervening B/C work before implementation. No DB schema/version, network contract, dependency install, dynamic import, directory-wide move or generic service registry is proposed.

## Later verification only

No commands below were executed. Use the explicit local pnpm path:

```sh
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm exec vitest run tests/toolLoading.test.ts tests/toolLoadingMeasurement.test.ts tests/agentFinishingCheck.test.ts tests/agentProjectCreation.test.ts tests/agentToolTransactions.test.ts
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm exec vitest run tests/agentGeneration.test.ts tests/agentGenerationReview.test.ts tests/agentGenerationReviewTransactions.test.ts tests/agentGenerationRecovery.test.ts tests/agentGenerationBatch.test.ts tests/agentGenerationBatchSafety.test.ts tests/agentBatchPreparationRecovery.test.ts
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm exec vitest run tests/agentTasks.test.ts tests/agentTaskOrchestration.test.ts tests/agentTaskOrchestrationReview.test.ts tests/agentTaskWrapup.test.ts tests/agentAuditRemediation.test.ts tests/audioGenerationAgent.test.ts tests/audioGenerationRecoveryAudit.test.ts
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm lint
```

- Both protocols: exact offered tools/frozen ceiling, approvals/reload/pinned tools, disabled groups and same-step rejection. Exercise the leaf directly and retain real entry-point/ledger integration so compatibility exports cannot mask unreachable extraction.
- Generation: preflight without paid requests/partial writes, changed target/input/connector rejection, two-worker stop/cancel, same-call/job recovery without resubmission, CAS/revision chains and result retention. Existing transaction/recovery suites cover failed ledger writes, cancellation, replay and failed preparation.
- Records/wrapups: manual guard/reopen/archive, source ownership, failed record-version rollback, stale revisions/dedup, missing/removed deliverables, omitted-history freshness, rejected/failed/unknown/bookkeeping exclusion, publication failure/abort/deletion and latest confirmed family completion.
- Native-browser gate already required by `agent-task-wrapup.md`: real IndexedDB with at least 150 repeated/invalid entity locators plus distinct-query controls; live inspector checkpoint continuity, transient read failure retaining draft/disabling save and explicit reread. Include Blob preparation/apply to verify hashing stays outside writes. fake-indexeddb alone cannot prove transaction lifetime correctness.
- Later structural gate: use the existing AST analysis mechanism, keep type-only edges distinct, confirm the eight-file value SCC disappears and no new value SCC is introduced. Save fresh review evidence separately; do not overwrite the audit baseline/tools. Verify direct imports and compatibility consumers. This is later implementation verification, not a broad-map request for this sidecar.

No function-direction uncertainty blocks this proposal. AR-04/PD-04 remain open pending later implementation and review.


## C01 refresh (2026-09-30; before independent C01 sign-off)

C01 current evidence no longer imports `readGenerationTarget` from generationRuntime into task records: the new evidence leaf reads current DB targets directly. Scoped current AST in C child `research/C-current-ast-results.json` (375 TS/TSX files, 2207 edges, zero parse errors) now reports three separate value SCCs: B/G, T/L and R/W/A/E. The original four-cut minimum is historical, not the current worktree plan. Refresh after C final review; current minimum is **three remaining cuts**: B→G (generationPreparation/DB target reader), R→A (task guard leaf), T→L (pure selector leaf). R→G is already absent as a necessary C01 evidence fix. Keep D01 full graph validation and atomic transaction contracts; do not reintroduce old runtime dependency or claim all cycles resolved now. Parent finding AR04/PD04 stays pending until D01 independent verification.

C05 checkpoint refresh (pre-C06): current AST376 TS/TSX files/2214edges/0parseerrors retains the same three value SCCs; the C04 fingerprint leaf adds no cycle. This is preparationonly, notD01closure. The C final snapshot must refresh again after bounded-reader imports.

C whole-gate checkpoint:379TS/TSX/2233edges/0parseerrors after C06 retains the same three SCCs, no new bounded-reader/resource cycle. Full C review still pending. Refresh D01 against committed C state when its turn starts; notD01findingclosure.

C whole-scope final independent review PASS confirms the same379files/2233edges/three SCCs with no new cycle. No C commit has landed yet; D01 remains pending and must reread committed C state when started.
