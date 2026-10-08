# D04 / AU-06 implementation handoff — implementation gates PASS

2026-10-08 · native `trellis-implement` writer. This reports D04 only. Independent whole-unit acceptance and finding closure remain with the coordinator/checker; no ledger, specifications, task status, manifests, staging, commit, push, child dispatch or archive was changed by this writer.

The authoritative final product freeze is `research/D04-evidence/product-freeze.json`, captured **2026-10-08 12:25:14 +08:00**. It freezes all ten implementation paths (five product files, two functional test files, two native fixture files and the task-local native runner), all 434 current source files including 411 TypeScript files, verification inputs, exact final gate commands and log hashes. The initial 12:20:33 freeze is preserved as `product-freeze-superseded.json`; it was explicitly invalidated for the saved-summary regression below. No product/test/fixture/runner edit follows the final freeze. `reviews/D04-implement-snapshot.json` supplies before/after hashes, path coverage, direct references, read ownership and evidence ownership.

## Result and actual consumers

`src/db/agentContextPreview.ts` now owns one complete read-only context-preview fact snapshot. Its actual production consumer is the single `useContextUsage` invocation in `ContextUsageTrigger`. Private `readScopedRows` reads scoped durable facts, `currentSavedRun` applies the existing active/recoverable predicate, `selectPreviewMaterials` distinguishes frozen requests from next-send material selection, and `readFacts` validates the binding and owns the outer read transaction. These functions are used directly; there is no forwarding repository, registry, global store, cache or query framework.

The trigger performs **one** preview live subscription and one display assembly. The ring, tooltip, `ContextUsagePanel`, and preview memory selection consume that result. The panel receives the trigger's snapshot; it performs no query or second planner/budget assembly. Its loading, missing, unavailable and error branches do not expose an old percentage, usage, project coverage or enabled memory actions. A loaded empty history/memory/reference selection is a valid ready result. Unknown capacity remains unknown. Draft estimation now uses the current normalized draft directly, without a deferred draft being labeled current.

`AgentChatPage` is the sole production trigger caller. Its only D04 edits remove the obsolete task/messages/runs preview props. Current D03 session, selection, execution flows, reference drafts, transcript queries, rendering and ProjectHome owners remain intact. Parent messages/runs queries retain their actual transcript/status consumers; the preview reads its own coherent durable facts instead of treating retained/temporarily empty parent props as complete.

`AgentControls` remains the production caller of `ContextParameters`. That editor retains an independent lightweight agent/thread policy query and all existing field-intent/reset/default-copy write APIs. Its query returns a scope envelope, loaded missing/null and explicit errors. Controls are disabled while identity is pending/mismatched/missing/error. A local session and synchronous lock reject callbacks from a prior thread; toast/error/finally publication belongs to the initiating live session. Actual B03 stale-render callbacks still submit only the changed field, including explicit `undefined` for token clearing. The DB merger/reset/copy implementations are unchanged; no new policy revision/CAS protocol is claimed.

`MemoryContextDetails` receives the same preview memory selection from the trigger; it does not compute another budget/selection. Its separate management query still reads row availability, current memories and thread exclusions. The content key includes **thread + run/preview + selection project**; its management envelope includes thread/project identity. Local pending/error publication is scoped to the active content/session, including scope changes between historical audit steps. Current preview availability propagates readOnly. `MemoryRunHistory` remains its other production caller, supplying the saved request selection/run and its existing readOnly contract. Historical selection text remains frozen while current availability controls writes. Exclusions still use the original transaction-guarded `setThreadMemoryExcluded`.

## Complete preview read ownership

The outer transaction is `db.transaction("r", contextPreviewTables(), ...)`, with **30 explicitly enumerated/deduplicated stores**, rather than `db.tables`: agents, chatThreads, chatMessages, agentRuns, contextCompactions, agentTasks, agentTaskRecords, projectMemories, projectReferences, referenceChunks, media, and the existing `projectContextTables()` stores. The latter contributes projects, episodes, characters, scenes, props, styles, shots, ipProfiles, projectIpLinks and the existing AUDIO_TABLES: audioChapters, audioSpeakers, audioSegments, audioTakes, audioTracks, audioClips, audioExports, musicDrafts, musicWorks and audioGenerationJobs.

Every nested read was inspected:

| Existing owner | Reads used by preview | Preserved selection/assembly responsibility |
| --- | --- | --- |
| `agent/taskContext.ts` | chatThreads, projects, agentTasks; `listTaskRecords` from the direct D02 record owner | Task instructions/tool eligibility; latest eight record excerpts, each body at most 1,200 chars |
| `db/agentTaskRecords.ts::listTaskRecords` | agentTaskRecords by taskId | Existing sorted current records, no version/history widening |
| `agent/projectContext.ts::getProjectContext` | Existing projectContextTables nested r scope | Project binding/kind, bounded video facts, styles/defaults, IP and coverage |
| `agent/audioProjectContext.ts` | project-owned chapters/speakers/segments/tracks/takes/clips/music drafts/works/jobs, IP link/profile | Existing audio/music projection and bounded coverage; no audio/media encoding |
| `db/memoryRetrieval.ts` | projects/chatThreads/projectMemories in nested r scopes | Current owner, active/reviewed/non-excluded eligibility, shared lexical planner/envelope/budget |
| `agent/referenceContext.ts` → `db/references.ts::getReferenceSource` | projects/projectReferences/referenceChunks/media in nested r scope | Source status/revision/owner, media owner, chunk owner/revision, whole-chunk character budget and image identity |

`resolveVisionCapability` can dynamically import the local model bank. It completes **before** the final outer fact transaction; requireVision runs only if that final selection contains images. There is no Blob encoding/hash, worker, network wait, paid provider request or waitFor in this new transaction. The text path remains valid with unknown/unsupported vision. Error envelopes cover capability preparation and final DB/selector failures without inventing empty/default facts.

The thread is authoritative when supplied. Missing threads do not fall back to the home project. An explicitly conflicting requested project, foreign task binding or foreign active-run binding returns unavailable before foreign material assembly. Home alone uses the selected home project. Required agent/project rows are explicit missing states for next-send previews. Ordinary projectless home/thread and task intake without a task remain ready. Matching saved requests can remain readable after project deletion, with current availability=false and exclusions disabled.

A saved run uses its saved agent instructions, policy/capacity/history, enabled/offered tools/loading, skill instructions, continuation/request messages, continuation overhead, project/memory/reference snapshots, model label and matching saved summary detail. Missing optional frozen project/memory/reference fields do not acquire new live fallbacks. The final regression also proves that a **later applicable live summary cannot change the saved run's threshold** when its frozen summaryId is absent: an 8,192-token saved context remains at 4,096, rather than adopting the later live summary's 65% threshold. This was an inherited fallback exposed during final D04 review, fixed within the authorized historical-preview distinction, and explicitly announced before refreezing.

## Before and predecessor compatibility

`D04-evidence/before.json`, `git-status-before.txt`, and byte-exact copies under `before/` were captured **before the first product edit**, including null for all proposed new paths. The complete D03 accepted `sourceFreeze` map (410 TypeScript paths) matches the D04 entry source exactly. In particular D03's accepted `AgentChatPage` after hash is D04's before hash: `06286fb7d97aa25894e1b1b750aa236a50aa1396abd666d55c45a70b33383b78`.

The earlier D02 AgentChatPage hash legitimately differs because accepted D03 subsequently extracted its owners; it is not asserted to equal the D04 entry. D02's accepted B03 test after hash **does** equal the D04 before hash: `66a2530e40a2048eb61a9cf2645ad541fa38b9040d9bc038b8ae03360cfb16ad`. B03 host results were adapted to the production query envelope while retaining all prior per-field/same-field/clear/reset/copy/rollback assertions and adding a stale-owner negative control. D01 has no directly edited path overlap. Every existing source outside these five D04 product paths remains entry-hash compatible; direct D02 task/project/memory/reference/settings/run readers and all accepted D03 session/selection/flow/ProjectHome sources remain unchanged.

## Final implementation gates

Commands use the explicit machine pnpm `/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm`. Heavy gates ran serially. `gates.json`, `gates-summary.json`, product-freeze and the handoff snapshot preserve command arrays, environment overrides, exit codes and SHA-256 log hashes.

| Gate | Final result and evidence |
| --- | --- |
| TypeScript | PASS: `pnpm lint`, `type-summary.log` |
| Focused actual callbacks/selectors | **9 files / 126 tests PASS**: `exec vitest run` with contextPreviewSnapshot, contextUsage, contextManagement, agentProjectContext, agentTaskOrchestration, memoryRetrieval, agentReferences, b03IntentBoundaries and b01QueryIdentity; `--maxWorkers=4`, `focused-summary.log` |
| Full suite | **150 files / 2,439 tests PASS**: `test --reporter=dot --maxWorkers=4`, `full-summary.log` |
| B01 core native | **19 checks PASS**, `native-b01.log`; actual consumed inputs unchanged since that pass |
| B07 core native | **5 scenarios PASS / 0 external requests**, `native-b07.log`; actual consumed inputs unchanged since that pass |
| D04 final targeted native | **6 scenarios PASS / 0 external provider requests**, `native-summary.log` |
| Narrow static | Exit 0, **0 errors**; new preview owner and policy editor have **0 diagnostics**, `static-summary.json`. Existing UI functions retain 14 warning diagnostics; the coordinator cumulative result is recorded below; independent acceptance remains pending. |

The six D04 native scenarios execute real ReactDOM/Radix/Dexie and controlled timing through task-local Vite transformations:

1. Opening/closing/reopening the real popover adds no preview subscription/read; the trigger and panel share the same producer.
2. Delayed A/B project/model/draft/attachment reads show loading; late completions do not publish foreign facts. Deliberate real agent-table reading-hook failure exposes error without budget/ring, and recovery returns ready. Initial image capability uses actual cold local model-bank loading before the readonly transaction.
3. The memory sheet remains mounted after the popover closes. Same-project A→B resets thread management identity; a delayed exclusion commits only to A while B stays enabled and unexcluded.
4. Policy pending/mismatched/missing/error disables controls; a delayed B field mutation commits to B and does not block or alter A on switch. Read errors remain visible.
5. A real concurrent readwrite project+memory transaction is submitted from a project reading hook after the outer preview transaction starts. It remains blocked until the preview completes. The first result contains **OLD PROJECT + OLD MEMORY**, the next contains **NEW PROJECT + NEW MEMORY**; image selection remains included. Observations capture project, memory, reference and media nested scopes, readonly mode, the complete outer 30-store scope and **one native IDBTransaction object** for all reads. `writerStarted=true`, `finishedAtRead=false`, `writerFinished=true` are asserted. Nested store subsets are checked against the complete parent scope instead of mistaking a valid nested subset for a new transaction.
6. Missing thread and conflicting project show explicit errors and no loaded budget.

Vitest additionally exercises actual trigger/panel functions and verifies that rendering the panel does not call another querier, that the memory props and snapshot share the selected object, and that retained ready/error/missing results stay hidden across each identity input. Actual production selectors cover video/audio/music nesting, empty home/intake, agent/thread/project missing, foreign task/run/project, reference withdrawn/revised/parsing/foreign-source/foreign-media, complete chunks, unsupported vision vs text, request policy/project/memory equivalence to beginAgentRun, DB rejection, frozen optional fields and saved-summary threshold. Deterministic hosts do not establish ReactDOM lifecycle; the native scenarios provide that separate evidence.

B07's established runner intentionally substitutes the context leaf and its network transport; it proves the existing compose/execution boundaries, not D04 UI. B01 covers its existing workspace/editor routes. Their actual fixture/script/consumed-owner hashes are unchanged after the final saved-summary-only correction; those results are reused with that explicit boundary. D04's real context UI/native run was repeated on the final source. D03's extracted session/selection/flow and native fixture sources are unchanged, so no additional broad D03/C gates were added by reflex.

## Preserved failed attempts and truthful limits

All first-four native logs and their screenshots/HTML are preserved under `D04-evidence/native-failures/`; no timeout or assertion was weakened:

- native-first: fixture waited for a nonexistent `agent-context-categories` class; actual ready DOM used `agent-context-breakdown`. Corrected selector, no product defect claim.
- native-second: new narrow outer transaction around the separate existing memory-management reader failed with **Table characters not included in parent transaction**. Its existing list reader uses `db.tables`; restored its original independent management boundary, rather than broadening the preview or changing that repository.
- native-third: the previous exclusion scenario had deliberately excluded A's memory. Concurrent proof setup now explicitly restores exclusions before OLD/NEW snapshot comparison; no product selection rule changed.
- native-fourth: observer ignored valid nested transactions because their local store subset omitted agentRuns. The observer now traverses the actual parent, checks every nested local subset and compares actual native transaction identity; the OLD/NEW/writer blocking assertions remain.
- focused-second: the deterministic Node host lacked document for the existing browser-only Portal container access. Only the host now stubs querySelector; the product Portal code is unchanged.
- type-first and initial static diagnostics are retained. The new owner's orchestration was separated into directly consumed scope/fact/selection functions; the policy reader/status functions own actual query/state responsibilities. Final new owner/policy editor have no lint diagnostics or unbound-method/suppression/any/non-null/unchecked-cast additions.

Native bytes exercise stored image MIME/Blob identity and selection/capability/transaction boundaries; the fixture does not claim image decoding, image quality or actual model interpretation. No paid providers, OOM, broad performance benchmarks, full-app E2E, all browsers or native audio providers were tested. Estimates remain heuristic, and in-flight unsaved output/tool results remain outside the displayed saved-request budget as before. Removing duplicate display work is structurally and functionally verified; no latency improvement is claimed.

The final source retains existing large UI-function complexity/nested-ternary warnings; this handoff does not claim that all static debt is resolved. The coordinator owns independent full-unit review, any specification/ledger synchronization and finding closure. D05–D08 and E remain pending. This implementation PASS authorizes no commit or task closure.


## Coordinator cumulative static/AST on the final freeze

The coordinator independently ran its final restored-runtime static v2 pipeline on **89 source paths**, using identical versions/configuration and separate complete baseline/current TypeScript programs. `reviews/D04-static-summary.json` and `D04-static-results.json` report **130 errors / 214 warnings → 119 errors / 204 warnings**, **0 added non-complexity diagnostics**. All 89 after hashes match the final source freeze. The new `db/agentContextPreview.ts` semantic owner is clean. These are cumulative D01–D04 results against f062d69, not reductions attributed entirely to D04 and not a claim that the current tree has zero static errors.

`research/D04-current-ast-summary.json` and `D04-current-ast-results.json` cover **411 TypeScript files / 2,429 edges / 0 parse errors / 0 value SCCs**. Any-keyword and non-null totals remain **46 / 200**. Type-assertion syntax totals are **470 at D03 → 477 now**. `D04-evidence/literal-assertions.json` compares actual accepted entry copies with final product AST: all seven additions are `as const`, with no unchecked payload/type cast:

- `agentContextPreview.ts:95`: literal ready status.
- `ContextUsagePanel.tsx:59`: the local nonready view-model object, preserving inferred status literals; `:74`: literal unknown capacity source for absent frozen capacity; `:150`: literal ready status.
- `ContextParameters.tsx:22`, `:23`, `:24`: literal status/alert roles for the local read-status view model.

The five new `satisfies Missing/Unavailable` expressions are checked return-envelope constraints, not type-assertion coercions. They are recorded separately in the assertion proof. No cast of database/provider data is added.

The three UI files are byte-identical between the immutable C baseline and the D04 entry, so these are the actual original-body comparisons, not comparisons against a different intermediate proposal:

| Existing function/body | Original accepted entry | Final D04 | Interpretation |
| --- | --- | --- | --- |
| `useContextUsage` outer hook | cyclomatic 40 | no over-threshold outer warning | Six phased readers moved into the actual clean fact owner; no whole-tree complexity claim |
| `useContextUsage` display memo | cyclomatic 84 / cognitive 24 | **61 / 31** | Cyclomatic decreases 23; cognitive **increases 7** due to explicit state/frozen-source branching, including the final saved-summary distinction |
| `ContextUsagePanel` | cyclomatic 41 / cognitive 33 | **46 / 36** | Increases **5 / 3** for explicit nonready and unavailable historical UI; still an inherited large presentational body |
| `MemoryContextContent` | cyclomatic 37 | **48** | Increases **11** for current envelope, live session/pending/error ownership and readOnly/availability gates; this is authorized identity correctness, not an asserted complexity improvement |
| Memory entry map callback | cyclomatic 22 | **22** | Unchanged existing warning |
| Policy editor and new private readers/status helpers | no diagnostics | no diagnostics | No new semantic helper warning |

The original warnings remain debt; the changed metric values are explicitly accounted for and are not described as unchanged/improved across the board. The coordinator's added-complexity list also contains earlier D03 extraction functions; their D04 source hashes are unchanged. Cumulative static/AST evidence is referenced with coordinator ownership in the implementation snapshot, rather than being mislabeled writer-owned or independent whole-unit closure. The final product freeze remains 12:25:14 and unchanged.
