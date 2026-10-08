# D06 / AU07 implementation — PASS; PRODUCTFROZEN

Writer implementation and applicable serial gates are **PASS**. Product/source/test/native/compiler inputs are frozen; no heavy gate remains running. Independent whole-unit acceptance, spec synchronization and ledger closure belong to main/checker. No finding, future unit or whole-D/E/QG01 status is closed here. No child agents, staging, commits, archive, spec, ledger, status or context-manifest edits were performed.

## Entry and exact scope

Pre-first-edit current-worktree capture: `tools/d06/entry.json`, 621 source/test/script/config paths, with full Git status also in `tools/d06/entry-git-status.txt`. Actual HEAD is `abb7a91d255666fc8f772cddecd66676b9f2848c`; product baseline remains separately `f062d694e61da6bcb574f7fb548803b9e54197eb`. Every original copied byte under `tools/d06/before/` is checked against that entry. In particular, generationProfiles is the then-current **accepted D05** source, not reconstructed C code. Entry imports and consumer ownership were refreshed after D03/D05.

Frozen artifacts: `reviews/D06-product-freeze.json` and `tools/d06/PRODUCTFROZEN.json` have identical bytes. They contain 436 source files and **632 actual source/test/script/config/native/compiler inputs**, independent of unfinished reports/evidence. Source-set SHA256: `1e60bec646cc68bc1655e75fe66ee2233d675b3b7aa94ebc7c32ab8c07606180`; input-set SHA256: `c432e9b4d55de22c592dd3523c7ec783d13663018a7082bab7b24f579478ea6f`. Current hash mismatches are zero. Main independently verified those inputs before and after static/AST. Final implementation snapshot contains current before/after maps, prior overlaps, per-file coverage, complete owned artifacts and coordinator evidence separately attributed.

Five product source paths:

| Path | Actual change and consumers |
| --- | --- |
| `src/domain/generationCapabilities.ts` (new) | Dependency-free pure leaf owning exact ordered APIMart arrays/predicates and seven supported capability records, scalar defaults, projection, explicit Veo resolution transition and scalar issues. Concrete consumers are output defaults/validator, profileRequest, GenerationConfigurationFields and ProjectOutputSettings. No registry/service/form factory, credentials, React, Zod, DB, transport or async IO. |
| `src/domain/output.ts` | Existing public arrays/predicates/type exports delegate to leaf. Project interfaces/profile version/permissive parser and common native-key builder stay owned here. Defaults and strict scalar legality reuse leaf; unknown video profiles still accumulate H3 scalar diagnostics. |
| `src/lib/agent/generationProfiles.ts` | Reuses scalar facts/issues/defaults with existing first-error sequencing and native lowering; compatibility advertisement reexports actual leaf records. Entire D05 Spec/schema/Args declarations are byte-identical. Target, input roles/duplicates/counts, prompt limits, forbidden-field checks and provider request lowering remain here. |
| `src/components/agent/GenerationReview.tsx` | Existing shared single/batch GenerationConfigurationFields consumes leaf controls/defaults and explicit resolution transition. Ant controls, labels, popup container, draft patches/model changes and provider-specific notes remain. Both complete GenerationReview and GenerationReviewForm orchestration bodies are unchanged. |
| `src/components/workspace/ProjectSettingsPanel.tsx` | Existing Radix selects use the same facts/projection. Known-model/version gates, retained invalid values, labels, numeric-duration input, explicit mode changes and all Save/rebase/dirty/CAS/retry/adopt-latest behavior remain. No paid side effect. |

Three new test/fixture paths: `tests/d06Capabilities.test.ts`, `tests/fixtures/d06/harness.tsx`, `tests/fixtures/d06/index.html`. Batch's actual consumer remains unchanged in AgentGenerationBatches.tsx and continues rendering the same GenerationConfigurationFields; no second batch form was introduced.

## Original/current matrix and representations

The six new tests compare actual pre-entry owners against current schema/request/default/validation behavior, including returned object keys and exact rejection messages. They are not self-oracles built solely from new projector arrays. Seven advertisement rows compare ordered JSON bytes. The immutable D05 catalog additionally compares **all 89 registered tool advertisements byte for byte**, parser/schema branch equivalence and metadata remain covered by existing tests.

| Exact profile | Preserved scalar/input boundaries |
| --- | --- |
| APIMart `gpt-image-2` | Ordered 15 ratios + auto, lower-case 1k/2k/4k, auto/1k request defaults, 15 reference images, no quality/version/video-only fields. Project target ratio has 16:9 fallback. |
| APIMart `gpt-image-2.5-flare` | Same ratios/resolution; low/medium/high/xhigh/max/auto, default auto; no version; 16 reference images. |
| APIMart `gpt-image-2.5-sunburst` | Same 2.5 facts with distinct exact model identity. |
| APIMart `gpt-image-2.5-ext` | Ordered ten Ext ratios + auto, no quality, flare/sunburst version default flare; stored lower-case resolution, upper-cased only by profileRequest; 16 reference images. |
| APIMart `MiniMax-H3` | 768P/2K, default 2K; 4–15 integer at strict schema/project entry, default5; text fixed ratio/default16:9, reference adaptive permitted/default; frame request accepts omitted/adaptive and omits native aspect_ratio, project frame defaults require explicit adaptive. Up to9 reference images; no reference video; prompt<=7000. |
| AIHubMix `gpt-image-2` | auto/1024x1024/1536x1024/1024x1536, quality omitted or low/medium/high; no resolution/version; strict submit shape max16. Native n1/png/async stays. |
| AIHubMix `veo-3.1-fast-generate-preview` | 720p/1080p/4K, 4/6/8, ratios16:9/9:16, defaults720p/8/16:9. Non720p/reference requires8; reference video requires720p; max3 reference images/1 reference video. |

Request matrix explicitly exercises missing mode, each text/frames/reference mode, missing/illegal scalar values, decimal duration rejection by schema, role combinations/last-frame-only, duplicated roles, hidden stale parameters and reference counts. Default/import matrix exercises every APIMart model, unsupported fields, known/unknown model/version/value/extra, mode transitions and accumulated issue order. `parseGenerationDefaults` remains permissive while strict execution is still blocked.

`profileRequest` still derives absent mode as inputs.length ? reference : text; it does not infer frames. Explicit applyGenerationSelection still derives frames from input roles and removes APIMart frame ratio only on user application. Projection never rewrites draft values or authorizes execution. Target ID, ordered media IDs/roles, prompt bytes, original call envelope/revision and connector ID remain with original owners.

Direct-call versus strict-schema distinctions are preserved: AIHubMix direct image count behavior is not tightened, Ext enum enforcement remains schema-owned, and H3 fractional duration remains blocked at strict schema/project entry without opportunistically changing permissive direct profileRequest semantics. No new model/profile version/default policy/import repair or audio/music policy was added.

## Native UI and storage proof

`reviews/D06-native.mjs` mounts the actual GenerationReview, actual AgentGenerationBatches dialog/shared fields, and actual ProjectSettingsPanel through Vite/React. Chromium **151.0.7922.34**, isolated native IndexedDB. All ten groups pass against current UI and against the captured original presentation owners; external requests0, paid submits0, page errors0. The real pending approval fixture is produced through actual executeChatRun with a single controlled local model response. onAction records one resume without executing transport.

1. Actual connector/model/options preserve draft prompt and original envelope; selected connector emptied/deleted blocks confirmation and is not replaced automatically.
2. Ext's hidden quality/unsupported size remain invalid until explicit model replacement.
3. Veo illegal high-resolution duration remains shown/blocked; explicit720p→1080p edit sets8, reference-video offers only720p/8.
4. H3 fixed frame ratio and missing mode stay invalid with hidden ratio controls; explicit connection reselection derives valid frames.
5. Actual batch candidate A edit/save leaves candidate B untouched; target/inputs stay identical; save creates no generation job.
6. Unknown imported profile/extra and frames→text invalid ratio stay retained; explicit profile/mode/ratio correction allows Save/reopen with lower-case image/upper-case H3 values.
7. Held Save disables duplicate save and controls; injected storage failure retains dirty value, retry persists it, shot stays byte-equal.
8. Genuine later project default change triggers actual CAS conflict, dirty local choice survives; explicit adopt-latest reconciles authoritative value.
9. Explicit global defaults apply/clear makes no approval/submit, preserves prompt, and leaves original target/input context unmodified.
10. Held real approval disables editing/duplicate action; switching call while held creates a new independent draft. Old completion preserves original arguments, writes one approved override and cannot replace new prompt. Preference save fails after approval, produces existing warning, and still records exactly one resume/no second approval.

Existing B01 (19) and B07 (5) retain editor/output dirty navigation, pending save, target/thread history/epoch/payload preservation. Original D05 native runner retains nested single/batch slot/job/ledger rollback, hash/flush outside transactions, guard recovery, 89 registrations, late receipt rollback and approved success with immutable receipt. These scopes do not prove live-provider entitlement, paid reliability, video decode, full acoustic quality or full-product E2E.

## Concrete implementation correction and preserved attempts

A final source reread found a real D06 **display-only extraction regression** before final freeze: when an Ext connection disappeared, the first extraction used the draft model's Ext sizes instead of original generic fallback order. New current-native assertion failed with Ext subset; actual original UI passed the same ten groups. The scoped correction uses only an actually matched profile, otherwise the original fallback profile; role-derived display mode is applied with original valid-provider conditions. Raw draft/executable validation/paid restrictions never changed. Corrected final gates all pass. Evidence: `native-fallback-negative.log`, `native-original-ui.log`, `D06-native-original.json`, corrected native log/report and final hashes. This is not a claim of a prior product defect.

Initial native failures are preserved under `tools/d06/failures/` and exact logs: missing connector/setup wait; unique definitionId BulkError; querying an old animating model popup instead of the active ratio popup; shortened confirmation button label; duplicate live-region/visible missing-connector text. Runner fixes target actual ID-scoped listbox and complete original labels/visible content, without weakening option/error assertions or raising timeouts. The original confirmation button exists and is disabled under missing key; the original complete form body is byte-identical.

Actual DB schema has unique definitionId. Initial two-APIMart fixture was invalid and failed BulkError. Native uses valid one-instance-per-provider storage and delete/empty/restore. Existing pure preference/recommendation tests retain multiple-instance ambiguity behavior without claiming the current DB can persist such rows. No schema/policy change was made.

Type02 failure (two unconverted JSX arrays and one narrow includes argument) and initial new-leaf complexity/nested-ternary diagnostics are retained. Small pure policy functions eliminated all new-leaf diagnostics. No assertion/timeout/ignore was weakened.

## Serial gates and immutable compiler evidence

Commands use explicit `/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm`; no bundled/bare pnpm, installation or live provider. Exact command argv, exit code, log SHA256 and timestamps are in `tools/d06/gates.jsonl`, selected corrected final records copied into frozen artifacts and implementation snapshot.

| Corrected-source final gate | Result |
| --- | --- |
| pnpm lint / actual project tsc | PASS |
| New capability leaf restored static rules | Zero diagnostics |
| Focused exec vitest run | 18 files /284 tests PASS |
| Actual compiler positive witnesses | PASS, TS5.9.3 |
| D06 cloned compiler negative runner |16 expected/16 rejected,0 missing/0 unrelated |
| pnpm test --reporter=dot --maxWorkers=4 |155 files /2480 tests PASS |
| pnpm build |PASS; inherited large-chunk warning retained |
| pnpm model-bank:verify |197 files/85 providers/1855 models verified |
| B01 native |19 PASS |
| B07 native |5 PASS,0 external/provider requests |
| Accepted D05 native runner |PASS,0 external/page errors |
| D06 current native |10 groups PASS,0 paid/external/page errors |

Entry focused gate passed5 files/67 tests; two initially requested filenames did not exist, so that entry result is explicitly five actual files, not seven. Final focused command names actual output/preferences/draft/schema/catalog/recovery/CAS suites. Full gate preserves existing MemoryEditor key warning. No green-first-attempt claim is made.

D06-compiler-negatives.mjs is an exact clone of accepted D05 runner with **only output JSON destination changed**. Accepted D05 runner/report and generated runtime catalog match accepted hashes unchanged. Current compiler config/witness inputs are frozen; semantic proof names clone hashes and destination-only equality. Positive compiler is actual tsc with tests/typecheck/tsconfig.agent-tools.json.

## Static, AST and generated route handling

Main's same-restored-rule separate-program cumulative v2 static scan: **108 sources**, baseline135 errors/240 warnings → current121 errors/227 warnings; **zero new non-complexity diagnostics**. These are cumulative D01–D06 comparisons to C, not D06 clean-lint or complete debt closure. New capability leaf is clean. Five-file actual-entry metric evidence provides precise D06 before/current deltas; see `reviews/D06-entry-metrics.json` and accompanying paragraph below. Remaining UI/request-owner complexity is inherited/measured debt; scalar policy extraction does not claim a generic form refactor.

Actual entry → current metrics, using a complete hash-verified captured entry TypeScript program and the identical restored rules/tools (only tsconfigRootDir changes), are:

| Actual owner | Cyclomatic entry → current | Cognitive entry → current |
| --- | --- | --- |
| GenerationReviewForm (unchanged complete body) |42→42 | below diagnostic threshold both |
| GenerationConfigurationFields |49→74 (+25) |47→29 (-18) |
| ProjectOutputSettings |42→60 (+18) |24→23 (-1) |
| profileRequest |78→68 (-10) |107→96 (-11) |

The UI cyclomatic growth includes new optional projection/default accesses and retained fallback branches; policy tables/conditional legal transitions now belong to the clean leaf, but presentation orchestration is still complex. These are recorded structural tradeoffs within the bounded AU07 scope, not evidence of decreased cyclomatic complexity or clean UI lint.

Type-aware diagnostics may change in unchanged consumers when imported inferred literal unions become more precise; a transitive type-program difference is not proof of a changed function body. Here the requested two unchanged consumers were checked against the complete actual entry: audioGeneration/runtime.ts and generationIntent.ts retain identical bytes **and identical full rule/message signatures**. Audio runtime cognitive values23/29/46 and cyclomatic31/37, generationIntent cognitive53/21 and cyclomatic60/22 are unchanged. The cumulative addedComplexity list uses repository-wide signature counts, so relocation/removal of an equal signature elsewhere can label an unchanged function as added; it must not be presented as a D06 body/type-caused metric change. Full entry/current diagnostic evidence contains no new non-complexity diagnostics for these five bounded files.

Main global AST:413 TS files/2454 edges,0 parse errors,0 static value SCC; any46/casts437/non-null198/nested ternaries442. Main source/test/native scan entry and final current checks are separately attributed; no main product edit occurred.

Build reformatted generated routeTree. Actual TS5.9.3 scanner proves all **3995 token kinds/decoded values match** before versus built output, permitting restoration of entry bytes only for this file. Original entry SHA256 `f1572df02731d204a1ef38e4b744a39aa5b2c9dc7a3d85d1d6d3d3b6b6b09d65` is current; built formatting bytes are preserved as evidence. No other source was reset. This route restoration is the only tested-input raw-byte difference from pre-correction gate capture and has a specific token-equivalence proof.

## Preservation, integration and report side effects

`D06-semantic-proof.json` verifies unchanged complete single approval/session declarations, project host/select declarations, entire D05 Spec/schema/Args span, permissive parser and common native builder. Thirteen request/DB/CAS/batch/runtime/preference owners are byte-identical to entry. Before maps compare direct prior-unit overlaps: D02 AgentGenerationBatches/ProjectSettingsPanel and D05 generationProfiles match accepted after hashes; earlier accepted owners use latest succeeding acceptance when they overlap. No original D03 lifecycle owner is modified.

The native runner writes `reviews/D06-native.json` (or original-UI proof destination under D06_BASELINE_UI=1). Compiler clone writes `reviews/D06-compiler-negatives.json`. These output side effects are evidence, not product. Future whole-unit/current-only gate must reject inherited baseline env, use default current source, and preserve accepted historical reports before rerun or clone only the report output destination; do not silently overwrite accepted proof. No runner was changed after final corrected gate capture. The original-UI mode is solely an implementation comparator; it is not appropriate for final integration acceptance. Static/helper metadata has no claim of having been tested product input.

Next action: independent whole-unit review of all five current product sources and three test/fixture paths plus evidence/runner integration. This report grants no commit/push authority and advances no later unit.
