# Independent D05 / AR05 + ancillary EX01 acceptance

**PASS — independent whole-unit acceptance, 2026-10-08.** All 21 product source changes, all 30 test/fixture changes, and the native/compiler/evidence-producing helper logic are accepted. No concrete D05 product defect remains. Checker made no product/test/writer-runner changes. EX01 is explicitly accepted as ancillary; the 51-finding count is unchanged. This is D05 acceptance, not whole-D integration or E/QG01 completion.

## Exact boundary and provenance

The writer scope is **346 paths = 21 source + 30 tests/fixtures + 295 evidence/runner/helper paths**, including 237 original source/test copies. Checker entry was persisted before substantive review. Every writer after hash matched at entry and matches again at finalization. The snapshot retains separate exact `before`, `writerAfter`, `checkEntry`, `after` maps, plus individual per-file status/note/findings. Null before values represent newly created paths; null after values are supported for deletion, but this unit deletes none. The implementation snapshot is indexed as evidence outside its own recursive writer-after set.

All 237 original copies match their corresponding SHA-256 in **original pre-first-edit `tools/d05/entry.json` (623 paths)**. All 51 product/test before values match that capture. Copies are evidence; this review does not claim to re-review 237 copied tests as new implementation. All 435 source-freeze paths, 414 unchanged source paths, 627 finalized tested inputs, 294 finalized writer evidence entries and eight coordinator dependencies were independently hash-checked. Each of the nine recorded serial gate logs matches its recorded hash. All other writer artifacts are separately hashed in coverage/evidence maps.

The original broad tested checkpoint included still-finalizing report/map indexes (916 inputs). Acceptance uses the corrected final split: **627 actual tested source/test/config/runner/helper inputs** versus completed evidence maps. Finalizer code alone does not retrospectively prove that a runner was unchanged: checker independently compared native/compiler/run-gate/freeze helpers across first freeze, tested checkpoint, final freeze and current bytes; all four match. The finalizer itself is a later evidence-producing helper, with no claim of having been an earlier test input. It verifies product hashes, original copies, logs, current scans and unchanged sources and keeps coordinator scans separately attributed. No finalizer/inventory/migration helper was rerun by checker.

Baseline product tip is `f062d694e61da6bcb574f7fb548803b9e54197eb`; actual writer entry/current HEAD remains `abb7a91d255666fc8f772cddecd66676b9f2848c`. Direct reads of predecessor acceptance snapshots confirm one D01 overlap and 26 D02 source/test overlaps. Their accepted after hashes exactly equal D05 before hashes. Four D02 product overlaps are audioGenerationTools/businessStore/businessTools/materialTools. D03/D04 have no direct source overlap; their accepted command/session/query owners remain covered by unchanged source hashes. No child agents, commits, staging, spec/ledger/status/manifests/archive edits or later-unit work were performed.

## Type and dispatch acceptance

`toolDefinition.ts` has only type imports of domain Agent types and Spec. `TypedToolDefinition` uses function properties, preserving strict parameter variance. `defineTool` infers parsed output from Spec and uses NoInfer on body arguments, so callback types cannot widen schema inference. Parser and advertised parameters are supplied by the owner and are absent from the body contract. Results may remain unknown. Actual project TS5.9.3 positively compiles these definitions and rejects all 16 negative witnesses, including parser/advertisement override, incorrect prepare/execute/risk, actual audio union fields, nullable native patch, slot membership and source exhaustiveness.

All 13 registered families retain actual output Args and literal names through helpers and heterogeneous arrays. Audio union maps each actual schema tuple position without ANY. Spec output has unknown input; required defaults remain required output. The object key assertion is limited to constructing the same schema keys from Object.entries; it does not assert raw input or domain patches. Generation runtime recipes retain explicit intentional legacy advertisement projections and public native schema methods. The only existential Args erasure is the documented central registry projection in tools.ts, after unique-name validation. Typed music review consumes named musicGenerateTool directly; injection tests choose the already-erased registry through registeredTools and introduce no family cast.

Dispatcher JSON is unknown, parsed by the selected tool's own parser, and the same owner/parsed pair reaches risk/prepare/execute. It checks all five metadata fields (effect, computed highRisk, normalized atomic, exact recovery, normalized confirmation) **before prepare/approval and again before claim**, retaining original timing. Reviewed tests cover every drift at initial preflight, approved resume and after a later awaited prepare, plus legacy absent/false normalization and foreign/duplicate ledger identities. Invalid-argument risk fallback is presentation only: strict rejection precedes any prepare, approval or execution. Actual Chat Completions and Responses correction tests preserve the invalid original call, return actionable bounded diagnostics, and execute exactly one corrected new call.

Typed owned-record branches preserve all nine row kinds, owner/episode checks and read-only media metadata; dynamic getRow/listRows remain compatibility projections. Native patch objects preserve own-field absence, null normalization and JSON insertion order. Concrete assets call existing command owners; no arbitrary CRUD framework or new service was introduced. Project creation hooks retain replay, draft flushing, binding and transaction positions. Slot update retains five supported writes, candidate-selection rules and unsupported rejection; the four explicit late switch cases preserve the existing default rejection.

## Original runtime and EX01 proof

Checker's read-only Vite SSR probe loads the **actual retained original modules** and current modules. Original advertisement, current advertisement and generated fixture have identical ordered JSON bytes and SHA-256 `e65fd7347d3f0f4f7558d0ce013a388085e026fa4c7528896391358b190a3f21`. All 89 parser outputs/diagnostic issue bytes match across **3,212 finite boundary cases** (minimal/full optional recipes, wrong envelopes/types, whitespace/bounds, enum alternatives, arrays and nonfinite numbers). Complementary source review covers the unchanged refinements/transforms and shared recipe differences. Finite tests are not a universal proof of all possible input values.

**EX01 accepted.** The small typed source helper exhaustively handles manual/summary/imported, while retaining the unknown runtime-kind fallback to manual. Early empty return, prefix/guidance/newline, JSON bytes, entry spread and source field position are unchanged. Source-only private fields remain excluded by the original whitelist; entry-level extension fields are deliberately retained. Undefined optional source fields are omitted; zero values remain; missing/null source still throws TypeError. Compiler witness checks typed exhaustiveness; tests and checker probe check malformed runtime fallback separately. The checker independently compared ten serializer/token/error cases against the actual original serializer. The original planner proves the reason string is `用户标记为项目通用`; the early wrong golden `项目固定知识` was corrected in tests without a product wording change. Existing exact envelope-budget boundary, eight-entry deterministic order and frozen audit-source tests remain meaningful.

## Gates, applicability and limits

| Evidence | Accepted result / applicability |
| --- | --- |
| Writer affected focus | 39 files / 647 tests PASS at first freeze |
| Writer full suite | 153 files / 2465 tests PASS at first freeze; not relabeled as current rerun |
| Writer final case-fix focus | 7 files / 110 tests PASS, including four unsupported owned-row rollback controls and five supported slot writes |
| Writer current app/dedicated types | PASS on corrected source |
| Checker current positive compiler | Actual project config and TS5.9.3, exit 0 |
| Checker current negative compiler | 16/16 rejected, missing zero, unrelated zero; report bytes exactly reproduce the accepted writer report |
| Checker actual-original runtime probe | 89 ordered advertisements; 3,212 parser cases and ten EX01 cases matched |
| Writer native local IndexedDB | Real D05 character_update approval/preview, reached actual write + receipt before late ledger fault, rollback and approved success; reused actual D01 single/batch nested slot/job/history rollback; zero external requests/page errors |

Checker reran the compiler program with **only its evidence output destination substituted in stdin**, preserving writer artifacts and all compiler/assertion logic. `D05-compiler-negatives.mjs` itself is unchanged. The resulting JSON is byte-identical (no timestamp), so main can retain the original runner for whole-D witness execution without an output-destination product/script fix. Hardcoded current-project TS path is a task-local limitation; portable QG01 remains E07.

Native and broad passes preceded the final four explicit unsupported switch cases and new test. Current affected type/compiler/focus proof covers that delta. Native harness/config/character_update and D01 owners are unchanged and exact applicability is recorded. Native source explicitly verifies the injected late faults were reached after actual nested writes/receipt construction, restores methods in finally, checks state rollback/success and throws on external requests/page errors. Local synthetic media does not prove provider behavior, product UI, decoding or audio quality. No redundant broad/native gate was run by checker. Whole-D current full suite/build/model-bank/native/browser integration remains main-owned.

Cumulative static evidence uses the same restored tool versions and separate complete baseline/current TS programs (static TS5.9.2 distinct from project TS5.9.3). Checker independently compared every one of **105 baseline hashes to actual git baseline bytes and 105 current hashes to checkout bytes**: no mismatch. Counts are 134 errors/233 warnings → **121 errors/222 warnings**, zero added noncomplexity diagnostics. Protocol leaf has no diagnostics. Inherited D03/D04 metric signatures remain debt. Music review complexity 38→39 is the explicit missing-prepare guard; executePendingTools 59→51 with cognitive 81 unchanged; slot switch final complexity22 includes four explicit rejecting branches. These are not clean-lint or all-metrics-improved claims.

Current AST evidence is **412 TS files / 2450 edges / zero parse errors / zero value SCCs**. Checker independently excludes type-only edges and checks the captured internal value graph (including literal dynamic edges) for cycles; none. Source freeze binds the graph to current bytes. Any46/casts444/non-null198/nested443 are cumulative signals, not all D05 gains. First type/focus/metadata/golden/native evidence and the finalizer's initial failed hash-object comparison remain retained; no assertion or timeout was weakened.

## Per-file product coverage

| Source path | Reviewed contract |
| --- | --- |
| `src/lib/agent/audioGenerationTools.ts` | Schema-linked family/helper migration reviewed against actual original bytes; parser/metadata/command behavior retained. |
| `src/lib/agent/audioTools.ts` | Mapped actual schema tuple (no ANY), branch-correlated native create args, same speaker defaults. |
| `src/lib/agent/businessSchemas.ts` | Schema-linked family/helper migration reviewed against actual original bytes; parser/metadata/command behavior retained. |
| `src/lib/agent/businessStore.ts` | All nine owned row cases retain owner/episode checks; media metadata projection stays read-only; getRow/listRows preserve envelopes. |
| `src/lib/agent/businessTools.ts` | Read/write helper inference and creation hooks; native patch own-key/order preservation; four concrete asset recipes; five catalog-guarded slot writes and unchanged unsupported rejection. |
| `src/lib/agent/generationProfiles.ts` | Shared runtime recipe and explicit legacy advertisement projections; trimming/defaults/strictness/order and native shape methods retained. |
| `src/lib/agent/generationTools.ts` | Schema-linked family/helper migration reviewed against actual original bytes; parser/metadata/command behavior retained. |
| `src/lib/agent/ipTools.ts` | Schema-linked family/helper migration reviewed against actual original bytes; parser/metadata/command behavior retained. |
| `src/lib/agent/libraryToolHelpers.ts` | Schema-linked family/helper migration reviewed against actual original bytes; parser/metadata/command behavior retained. |
| `src/lib/agent/materialTools.ts` | Schema-linked family/helper migration reviewed against actual original bytes; parser/metadata/command behavior retained. |
| `src/lib/agent/memoryTools.ts` | Schema-linked family/helper migration reviewed against actual original bytes; parser/metadata/command behavior retained. |
| `src/lib/agent/musicGenerationReview.ts` | Named concrete musicGenerateTool supplies own parsed Args and prepare; explicit missing-prepare guard. |
| `src/lib/agent/musicTools.ts` | Schema-linked family/helper migration reviewed against actual original bytes; parser/metadata/command behavior retained. |
| `src/lib/agent/referenceTools.ts` | Schema-linked family/helper migration reviewed against actual original bytes; parser/metadata/command behavior retained. |
| `src/lib/agent/runChat.ts` | Both metadata gates in original temporal positions; own parser-to-risk/prepare/execute pair; fallback presentation and permissions unchanged. |
| `src/lib/agent/taskTools.ts` | Schema-linked family/helper migration reviewed against actual original bytes; parser/metadata/command behavior retained. |
| `src/lib/agent/toolDefinition.ts` | Type-only leaf; function properties; NoInfer schema output; parser/parameters ownership; exact five-field normalized metadata comparison. |
| `src/lib/agent/toolLoading.ts` | Schema-linked family/helper migration reviewed against actual original bytes; parser/metadata/command behavior retained. |
| `src/lib/agent/tools.ts` | Unique complete 89 registrations; only existential Args erasure; raw unknown parsed by selected owner; compatibility exports. |
| `src/lib/agent/webTools.ts` | Schema-linked family/helper migration reviewed against actual original bytes; parser/metadata/command behavior retained. |
| `src/lib/memory/retrieval.ts` | EX01 exhaustive source projection; unknown kind manual fallback, missing/null source error, entry spread/source insertion order and envelope bytes retained. |

## Per-file test/fixture coverage

| Test/fixture path | Reviewed change |
| --- | --- |
| `tests/agentAuditRemediation.test.ts` | Import/selection migration only; existing test bodies, assertions and timeouts unchanged |
| `tests/agentBusiness.test.ts` | Import/selection migration only; existing test bodies, assertions and timeouts unchanged |
| `tests/agentGeneration.test.ts` | Import/selection migration only; existing test bodies, assertions and timeouts unchanged |
| `tests/agentGenerationBatch.test.ts` | Import/selection migration only; existing test bodies, assertions and timeouts unchanged |
| `tests/agentGenerationBatchSafety.test.ts` | Import/selection migration only; existing test bodies, assertions and timeouts unchanged |
| `tests/agentGenerationReview.test.ts` | Import/selection migration only; existing test bodies, assertions and timeouts unchanged |
| `tests/agentIpTools.test.ts` | Import/selection migration only; existing test bodies, assertions and timeouts unchanged |
| `tests/agentMaterialTools.test.ts` | Import/selection migration only; existing test bodies, assertions and timeouts unchanged |
| `tests/agentMemoryTools.test.ts` | Import/selection migration only; existing test bodies, assertions and timeouts unchanged |
| `tests/agentProjectContext.test.ts` | Import/selection migration only; existing test bodies, assertions and timeouts unchanged |
| `tests/agentProjectCreation.test.ts` | Import/selection migration only; existing test bodies, assertions and timeouts unchanged |
| `tests/agentReferences.test.ts` | Import/selection migration only; existing test bodies, assertions and timeouts unchanged |
| `tests/agentTaskOrchestration.test.ts` | Import/selection migration only; existing test bodies, assertions and timeouts unchanged |
| `tests/agentTaskOrchestrationReview.test.ts` | Import/selection migration only; existing test bodies, assertions and timeouts unchanged |
| `tests/audioGenerationAgent.test.ts` | Import/selection migration only; existing test bodies, assertions and timeouts unchanged |
| `tests/audioMusicAgentTools.test.ts` | Import/selection migration only; existing test bodies, assertions and timeouts unchanged |
| `tests/audioTaskEvidence.test.ts` | Import/selection migration only; existing test bodies, assertions and timeouts unchanged |
| `tests/d05BusinessBranches.test.ts` | Four unsupported parser cases, four unexpected owned-row rollback cases and all five supported real slot writes |
| `tests/d05SchemaEquivalence.test.ts` | New schema-equivalence matrix against original modules |
| `tests/d05ToolCatalog.test.ts` | Import/selection migration only; existing test bodies, assertions and timeouts unchanged |
| `tests/d05ToolMetadata.test.ts` | Five metadata fields at preflight, approved resume and late preparation/claim gates; normalized flags and ledger guards |
| `tests/fixtures/d05/catalog.json` | Generated original/current catalog exact bytes |
| `tests/helpers/registeredTools.ts` | Already-erased registry family selection; no additional casts |
| `tests/imageDiscovery.test.ts` | Import/selection migration only; existing test bodies, assertions and timeouts unchanged |
| `tests/memoryRetrieval.test.ts` | Original EX01 golden bytes, planner reason, fallback/errors, field order and budget/audit controls |
| `tests/musicDurationContract.test.ts` | Import/selection migration only; existing test bodies, assertions and timeouts unchanged |
| `tests/musicGenerationReview.test.ts` | Import/selection migration only; existing test bodies, assertions and timeouts unchanged |
| `tests/referenceEvidence.test.ts` | Import/selection migration only; existing test bodies, assertions and timeouts unchanged |
| `tests/typecheck/agentToolDefinition.ts` | Actual project positive compiler and 16 negative schema/native/exhaustiveness witnesses |
| `tests/typecheck/tsconfig.agent-tools.json` | Actual project positive compiler and 16 negative schema/native/exhaustiveness witnesses |

All remaining writer paths, including both native/compiler runners, run-gate/freeze/inventory/finalizer and six migration helpers, are individually covered in D05-check-snapshot.json. Generated maps/logs/copies are marked generated-verified, with exact verification noted; generated JSON is not presented as manual line review.

`productFixesFrozen` and `heavyGatesFinished` were announced before finalization: no checker product fixes and no pending heavy gates. Final entry/current writer maps have zero drift. Main may apply its spec/ledger closure (35 fixed and EX01 verified) and continue sequentially; this checker starts no D06/E work. D06–D08, whole-D integration and E/QG01 remain pending under coordinator control.

Checker-added artifacts are separately indexed with before/check-entry null. Final acceptance maps contain all 346 writer paths plus seven checker-created report/runner/result/log paths (353 total); the checker snapshot itself is excluded from recursive hashes. The new D05-check-runtime.mjs is reviewed in per-file coverage and has its own actual source/original/config/fixture input map. Native/compiler runners were not changed and no integration output override was implemented.
