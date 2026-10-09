# E07 typed boundaries slice B — COMPLETED

The concrete implementation is complete in the 16 assigned source owners and four new focused test files. All 91 assigned typed/Hooks errors are repaired. The final scoped ESLint result has zero errors and the same 58 review warnings as the actual E07 entry. This closes this implementation slice only; it does not accept E07/QG01, debt, independent review, CI, Node22 reproducibility or whole-batch integration.

## Entry and freeze

All 18 implement.jsonl context entries, PRD, design and implementation plan were read. The actual before bytes for all 16 owners match both the coordinator's `research/E07-before` copies and `research/E07-entry.json` hashes. The preceding accepted E06 snapshot is `2ff2d72efa3a42f42b33ca5ca128fb3918e050f9289ee36dcf1f076a739487da`. These are working-tree entry bytes, not HEAD. The owned source patch, before copies, command inputs and final per-path hashes are preserved under `e07-typed-boundaries-implementation/` and in the companion completion JSON.

No package, lock, config, existing test, canonical spec, task status, ledger, generated route or outside product owner was edited by this worker. No installation, full suite, build, models, native browser, commit, push or recursive agent ran. Main/C product caller changes are external and preserved.

## Concrete repairs and behavior

- `CreatedEntityLinks`: array elements enter an `unknown[]` boundary; target objects, hrefs and labels retain their existing runtime checks. Local path validation, first-20 bound, deduplication, preview exclusion, completed/write status and project continuation behavior remain.
- `Grainient`: a concrete number/Float32Array uniform map is held by the component and passed directly to OGL. The same map supplies resize, animation and prop updates. Shader bytes and uniform initialization tokens are identical to entry; installed OGL retains that exact object by reference. Visibility ternaries became equivalent if/else calls. Renderer/observer/RAF/motion/unmount sequence is preserved. This is static/library contract proof, not native GPU measurement.
- `agentFinishingCheck`: unknown saved result/argument envelopes are checked before plan lookup. Each plan member's id/title/status is narrowed before the shared typed validator. Raw-vs-validated revision equality still rejects added/unvalidated fields or normalization drift. Invalid shapes return false without consuming the checkpoint or mutating the saved run/call.
- `agentProjectCreation`: same-envelope reference detection reads a parsed unknown object property after narrowing. Existing reference-bound rebinding rejection and create-only recovery remain.
- `agentTools`, `tools`, `wrapupEvidence`: parsed replay/results enter unknown boundaries; D05 schema-linked definition, central dispatch, original success/replay and atomic ledger contracts remain. Redundant assertions were removed only where compiler contracts already establish the type.
- `materials`, `materialTools`: ordinary adoption functions use business names. DB public export is `adoptMaterialInProject`; internal helpers are `readMaterialUseState` and `materialUseResult`. Transaction, owner/IP/archive/revision/idempotence/copy/retention logic is unchanged.
- `businessStore`, `businessTools`, `businessWriteReceipt`: the existing business row owner now exposes a field-restricted presentation selector. True scalar values retain string/number/boolean and empty-string behavior; malformed compounds fall through to the next owned scalar/id or empty excerpt. Summary/navigation/receipt caps stay 200/300/120/160. Actual IDs, hrefs, full raw revisions, approval state and stored result replay remain independent of display recovery. Malformed/empty batch result targets fail inside the original atomic wrapper rather than producing a receipt. Preview/reorder/delete labels use owned fields with precise numeric size guards.
- `imageDiscovery`: the local label function accepts its actual string/undefined input domain. Source identity, current/reference distinction, digests and final materialization checks are unchanged.
- `audioProjectPackage`: heterogeneous table snapshots are stored as typed key/unknown-value tuples and an unknown-valued record, then validated by the existing explicit package schema. No assertion treats unknown job input as a desired interface. Existing schema/property/discriminant checks, association validation and dormant/manual imported history remain authoritative.
- `episodeDelivery`: column selection explicitly admits the seven actual extra text fields (category, sound, emotion, cameraAngle, cameraGear, focalLength, sceneCloseup). It never indexes structured Shot fields through keyof Shot. Base columns, full column ordering, authored strings, BOM/CRLF/quote escaping, numeric order/duration and native delivery payload remain. CSV cell type matches actual string/number/nullish inputs.

## New meaningful regressions

`tests/e07TypedBoundaries.test.ts` verifies malformed link/reference envelopes, owned local link bounds/deduplication, corrupt persisted display fields through real reviewed write/revision/receipt/replay, unchanged empty/legacy scalar labels and distinct caps, and rollback of actual shot creation when batch targets cannot produce a valid receipt.

`tests/e07TypedBoundariesFinishing.test.ts` covers corrupt saved results/arguments/stored plan members, no checkpoint consumption, unchanged run/call state and successful recovery with valid arguments.

`tests/e07TypedBoundariesAudio.test.ts` invokes the original root parse/remap compatibility APIs, checks source/claim sanitization without mutating originals, remapped entity/connector/dormant history with zero provider calls, malformed persisted job shapes and foreign-media association rollback.

`tests/e07TypedBoundariesDelivery.test.ts` asserts all seven exact authored extra fields, unchanged base content/notes, numeric duration, quote/comma/newline/CRLF/BOM and nullish/number cell serialization.

## Unused export decisions

| Name | Decision | Contract reason |
| --- | --- | --- |
| isSceneSlot, isPropSlot, isStyleSlot, isShotSlot | Module-local functions | Internal slot_update guards remain; no external full/test/native/canonical consumers. D05 supported/unsupported owned-kind tests pass. |
| businessStore.metadata | Module-local function | Typed media reads and RowByKind use it internally; returned metadata shape is unchanged. |
| businessStore.AssetKind | Module-local type | Internal four-kind slot catalog selector only. |
| materials.listMaterialUsage | Delete unused wrapper | Scoped live reads already serve actual consumers; no public supported canonical/test/native/dynamic use found. |
| materialTools.MATERIAL_TOOL_NAMES | Remove redundant re-export | Actual canonical owner materialToolNames.ts and its skills/test consumers remain. |
| audioProjectPackage.parseAudioPackage / remapAudioPackage | Retain supported compatibility | D03 explicitly retained these original root compatibility exports (`D03-spec-draft.md:58`). New real root API consumer executes validation/remapping/dormant insertion and foreign association rollback. No fabricated production dependency or blanket ignore added. |
| EpisodeDeliveryColumn / EpisodeDeliveryRow | Module-local interfaces | Exported EpisodeDelivery still carries the exact structural columns/rows contract; no external direct type imports. |

Fresh scoped Knip input and per-name evidence/rationale are recorded in `unused-export-decisions.json`. Main owns final configured production/full Knip and gate policy. Historical D03 exports are not retired silently.

## Verification and limits

All machine package operations used the explicit `/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm` with machine Node24 PATH. Actual execution reports Node `v24.11.0` and pnpm `10.15.0` (project-manager dispatch), not a guessed runtime version. Installed tool versions are ESLint10.12.0, @eslint/js10.0.1, TS-ESLint8.71.1, Hooks7.1.1, SonarJS4.2.2 and Knip6.40.0. No clean installation or Node22 claim is made.

- Root final scoped run: 16-owner lint zero errors/58 unchanged review warnings, project tsc pass, 21 relevant existing/new test files 338/338 pass. Before/after input manifests show no owned or external drift during that run.
- Final bounded completion run after only fixture protocol typing and trailing-whitespace repair: 16-owner lint zero errors/58 warnings, all four new files 45/45 pass, scoped whitespace pass. Exact source/new-test hashes remained stable during execution.
- New four test files also pass strict TypeScript using the actual app compiler options and Vite ambient closure. Application tsc does not normally include tests; this additional proof is explicit.
- Three outside-slice existing tests still contained old adoption names at the observed root failing run. A complete source/test/config/metadata mirror with current dependencies changed only those import/call identifiers: 39/39 pass. A parsed TypeScript leaf-token proof confirms every assertion/value/statement token is unchanged. Adapted files/patches and input hashes are retained; temporary mirror was removed. This is pending caller integration proof, not root-worktree success. One unrelated concurrent `tests/e07CoercionContracts.test.ts` changed between the root scoped run and later mirror capture; exact distinct inputs are recorded and owned source stayed unchanged.
- Grainient producer proves exact shader bytes, uniform initializer tokens and installed OGL object-reference contract. Native regression belongs to final main integration.

The first root 24-file run had 355 passing and 17 failing tests; every failure was an outside-slice `useMaterialInProject is not a function` in agentMaterialTools/materialLibrary/materialIntegration. Main/C owns their adoption name update and native harness callers. No existing assertion was removed or rewritten by this worker. All failed outputs remain.

## Failures preserved

Initial large context output truncation was resolved by reading bounded segments. One guessed MaterialDetailPanel path and one guessed audioMusic test path did not exist; actual paths were found by rg. Parent message delivery was refused because Codex app cannot message a native ancestor; explicit early commentary and integration-notes preserve the exact rename. An early replacement script stopped on a mismatched imageDiscovery function name; the remaining actual label signature was fixed afterward. Initial scoped lint retained one redundant receipt assertion, then repaired it.

The first new audio rollback fixture returned an async helper directly from a synchronous Dexie transaction callback and observed an inserted draft after rejection; the callback was corrected to the actual async/await import-orchestrator pattern. Audio tests then passed; product transaction code was unchanged. A first scanner-only caller token proof mishandled template literals; its failure/log/producer are preserved and a parsed-AST leaf proof passes. Additional test tsc initially lacked Vite ambient context and fixture protocol fields; both were corrected explicitly with failed log/config retained. These failures are not credited as product fixes.

## Main integration handoff

Use `adoptMaterialInProject` in the two product callers, three existing test files and the live e04-media/d02 fixture harnesses; preserve immutable D05 historical source bytes. Product caller edits were observed from main/C. The remaining older root test identifiers are external integration work. `integration-notes.md` and exact adaptation patches give the complete list. Main must rerun applicable integrated material tests and final native/gates/independent review. No specs/status/ledger/commit are changed here.

Final exact source and evidence inventory is `E07-typed-boundaries-implementation.json`; this report and all owned evidence are frozen at slice completion. No late writes follow.
