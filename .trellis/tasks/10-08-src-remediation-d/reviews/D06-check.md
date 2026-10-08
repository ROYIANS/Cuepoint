# Independent whole D06 / AU07 acceptance

**PASS — 2026-10-08.** All five actual product sources, three actual test/fixture paths, and the owned native/compiler/helper/evidence scope are accepted. No concrete product blocker remains. Checker changed only the two D06 runner report destinations by adding optional environment overrides. Main owns specs, ledger, integration tooling and the next ordered units.

## 1. Boundary, entry and exact provenance

The writer scope is **711 paths = 5 source + 3 test/fixture + 621 original copies + 82 other runner/helper/log/evidence paths**. `D06-check-entry.json` captured every writer after hash before substantive review; all 711 matched. Final coverage retains original writer `before`, immutable `writerAfter`, separate `checkEntry`, and current `after` maps. The only two writer-after differences are the explicitly authorized runner fixes below; all other 709 writer paths retain their exact final writer bytes. New checker artifacts have null original-before/check-entry values; deletion support is retained and no file is deleted. The snapshot excludes recursive self hashing and names its own path separately.

All **621 copies** were independently hashed against **actual pre-first-edit `tools/d06/entry.json`**, not just their copy metadata. These receive hash/provenance coverage only; this review does not claim manual review of 621 old sources/tests as new implementation. All eight actual source/test before values match that entry, including null before for new paths. GenerationProfiles is the actual accepted D05 working-tree version. Canonical product baseline is `f062d694e61da6bcb574f7fb548803b9e54197eb`; actual entry/current HEAD is `abb7a91d255666fc8f772cddecd66676b9f2848c`.

Final verification covers **632 tested inputs** (explicitly accounting for the two checker runner after hashes), all **436 source inputs**, all **108 static current source hashes**, the **seven coordinator static/AST evidence hashes**, and all **12 corrected-source gate logs**. The complete 436-path captured original metrics program also matches actual entry hashes, original copies and its separate cache source root. Three direct predecessor overlap records and 104 latest accepted owner records were checked against original D01–D05 snapshots; ProjectSettingsPanel and generationProfiles are intentionally re-reviewed D06 overlaps, while the other 102 owners retain accepted bytes. No writer finalizer or historical proof writer was rerun.

## 2. Product and linked consumer acceptance

| Actual path | Independent contract coverage |
| --- | --- |
| `src/domain/generationCapabilities.ts` | Zero imports; eight exact ordered constant initializers; seven exact ordered original/current catalog JSON records; precise identity, defaults, scalar issues, request/project projections and explicit Veo resolution transition. No framework, registry, provider client, persistence or proposal repair. |
| `src/domain/output.ts` | Public const/type/model-guard compatibility; same profile version; project defaults and accumulated strict diagnostics; permissive import parser and common native-key builder preserved byte for byte. Unknown imported video profiles retain H3 scalar diagnostics. |
| `src/lib/agent/generationProfiles.ts` | Entire accepted D05 Spec/schema/Args/JSON advertisement span preserved byte for byte. Original target/input duplicate/role/count/prompt/hidden-field checks, first-error order and native lowering remain. `GENERATION_PROFILES` aliases the concrete ordered leaf. |
| `src/components/agent/GenerationReview.tsx` | Actual shared single/batch fields consume the projector. Connector/model fallback options preserve original valid control choices with paid confirmation blocked; missing identity remains explicit. Render retains hidden invalid fields, invalid frame ratios and missing mode. Explicit user selection owns replacement/clearing. Complete GenerationReview and GenerationReviewForm bodies remain byte-identical. |
| `src/components/workspace/ProjectSettingsPanel.tsx` | Actual Radix selects consume shared choices; imported unknown/invalid values remain visible and strict Save stays blocked. Save/CAS/rebase/dirty navigation guard, busy lock, failure/retry, latest-value adoption and field ownership remain. Complete host/SettingSelect declarations remain byte-identical. |

The actual batch consumer is unchanged `AgentGenerationBatches`, which still renders GenerationConfigurationFields. Request/DB/CAS/preparation/transport/runtime/preferences retain **13 complete owner hashes**. No audio/music rewrite, new model, default-policy change or transport change is introduced. All meaningful changed source bodies and their original counterparts were reviewed; unchanged orchestration bodies and downstream owners were independently verified by declaration/span/body hashes.

Critical distinctions remain: APIMart Image 2 rejects quality/version; standard 2.5 owns quality and rejects version; Ext owns version, rejects quality and uppercases native resolution. MiniMax H3 frame requests accept omitted/adaptive ratio and omit native `aspect_ratio`; project frame defaults require explicit `adaptive`. Missing request mode remains inputs→reference or empty→text, never implicit frame inference. Veo preserves case-sensitive resolution, duration, reference-video 720p and reference/high-resolution eight-second constraints. Render does not repair proposals into executable inputs, and mode changes do not silently change project ratios.

## 3. Tests, fixtures and native proof limits

`tests/d06Capabilities.test.ts` has six meaningful original/current compatibility and projection cases, including exhaustive nested video/input/scalar comparisons, ordered image/project errors, hidden fields, strict schema versus permissive imports, exact native fields and explicit frame selection. Its originals are captured D05 sources; the new checker additionally verifies original constant/catalog expressions independently so shared imports cannot mask catalog drift.

The two fixture files render actual Ant Design single/batch and Radix project forms over real native IndexedDB, on an isolated local origin. The valid approval is prepared by actual executeChatRun with a local model response; illegal proposals are explicitly synthetic. Actions record continuation without invoking paid generation. The production command wrappers only defer/inject local storage boundaries and then invoke the original commands.

Both original UI comparator and current native proof contain the same ten scenarios. Original UI mode is a comparator only, never integration acceptance. The checker rerun passed all ten with `baselineUI:false`, zero external/paid requests and no page errors; its report is byte-identical to accepted current evidence. Coverage includes model/connector options, retained incompatible hidden fields, Veo explicit transitions, invalid/missing H3 frame mode, batch candidate isolation, strict project Save/reopen, busy/failure/retry, dirty-default CAS conflict/adopt-latest, zero-submit defaults apply/clear, and immutable synchronous-busy approval despite preference-storage failure.

The first five native setup/selector failures and the later failing fallback regression retain their original logs/artifacts. Unique connector.definitionId fixture setup and exact popup/control identity were corrected without weakened production assertions or inflated timeouts. Native proof does not establish live provider support, entitlement, output quality, media decoding or full product E2E behavior. Pure ambiguity tests and impossible duplicate-active-connector fixtures remain distinct.

## 4. Bounded checker fix and integration contract

Both D06 runners previously wrote accepted historical reports unconditionally. Optional destination overrides now make future integration reruns safe while retaining original defaults:

| Runner | Main-controlled environment key | Checker output |
| --- | --- | --- |
| `reviews/D06-native.mjs` | `D06_NATIVE_REPORT_PATH` | `.trellis/tasks/10-08-src-remediation-d/reviews/D06-check-native.json` |
| `reviews/D06-compiler-negatives.mjs` | `D06_COMPILER_REPORT_PATH` | `.trellis/tasks/10-08-src-remediation-d/reviews/D06-check-compiler-negatives.json` |

Native before/check-entry SHA256 `5d1d23ffd39469a846c4bdf82af21f4b02b3280960d673f22d020a79a80595a6` → accepted after `45a8c007bc8e34680ee5b17d67d4db6176b31886ef862439c4bdfeb998a6e879`.

Compiler before/check-entry SHA256 `627eded1f30a81da79a44be025550a09baa877d44447820993901708cff34298` → accepted after `b7cff8eeffb254c9ea964cfbef118ae3088bca5e7d5300eb44e67622663914e8`.

Independent reverse-substitution proves these are destination-only edits. Unset overrides retain both original normal report paths and `D06_BASELINE_UI=1` comparator output. Compiler body remains the accepted D05 runner with only its destination changed and the optional override added. Both affected runners were executed serially into new reports; native 10/10 and actual project TS5.9.3 negative compiler 16/16 passed, and both outputs are byte-identical to their accepted reports. D05 compiler/catalog evidence and all three historical D06 reports remain unchanged.

The exact script freeze was announced before final acceptance; product/source/static/AST input bytes did not change. Main's explicit integration plan validates relative report paths beneath `reviews/integration/`, rejects inherited or per-entry baseline overrides, and records each command's environment. The runner trusts only main-controlled environment; path confinement belongs to main tooling. Main should supersede its historical D05 compiler plan entry with this accepted D06 compiler clone, preserving historical evidence. Checker did not edit that plan/tool.

## 5. Frozen gates and independent current evidence

The twelve serial corrected-source writer gates are accepted against verified hashes: TypeScript; clean capability-leaf restored lint; focused **18 files / 284 tests**; positive actual project compiler; **16 negative TS5.9.3 witnesses**; full **155 files / 2,480 tests**; production build; model bank; B01 **19** scenarios; B07 **5** scenarios; accepted D05 native ledger rollback/success; D06 native **10** scenarios. Exact commands, local pnpm path, exit status and log hashes are in the snapshot. Existing build chunk and MemoryEditor key warnings remain explicitly limited. Passing broad gates were not rerun by checker.

Checker ran only the two affected runners and lightweight read-only preservation/provenance verifiers. `D06-check-preservation.json` proves four complete declarations, three spans, thirteen owners, eight constant initializers, exact seven-profile ordered JSON and **3,995 route tokens**. New proof outputs do not overwrite writer semantic/native/compiler/static/AST reports. The preservation helper first assumed initializer text equality before recognizing intentional verified-constant reuse; its initial diagnostic is retained. Provenance helper development also accounted explicitly for two intentional prior-owner overlaps and normalized diagnostic embedded line numbers, matching the recorded static signature policy. These were checker-helper assumptions, not product failures or weakened runtime assertions.

## 6. Static, graph and measured debt

Main's same-restored-version, separate-complete-program comparison covers **108 sources**, baseline **135 errors / 240 warnings** → current **121 errors / 227 warnings**, with **zero new non-complexity diagnostics**. Checker independently recounted severities, normalized embedded `line N` references in rule/severity/message signatures, confirmed the zero non-complexity differential and verified the clean new leaf. Static tools use TS **5.9.2**; actual project compiler witnesses use TS **5.9.3**. They are separate evidence.

Actual D06 entry/current function metrics remain precise: unchanged GenerationReviewForm cyclomatic **42→42**; shared fields cyclomatic **49→74**, cognitive **47→29**; ProjectOutputSettings cyclomatic **42→60**, cognitive **24→23**; profileRequest cyclomatic **78→68**, cognitive **107→96**. UI cyclomatic growth is a measured tradeoff within AU07, not clean-lint or overall complexity improvement. Unchanged audioGeneration/runtime and generationIntent have identical actual-entry/current bytes and complete metric messages; cumulative signature matching can label relocated signatures as added without a changed function.

Frozen global AST has **413 TS files / 2,454 edges**, zero parse errors and zero static value SCCs. Checker independently traversed frozen internal static value edges and recomputed any **46**, casts **437**, non-null **198**, nested ternaries **442**, empty catches **16**, dynamic imports **8**. Source hashes prove the graph still applies. Type-including cycles are a separate category. Generated route build formatting differs in raw bytes but all 3,995 scanner token kinds/decoded values match; entry bytes are current, and built formatting is retained as evidence. No source restoration was performed by checker.

## 7. Closure and remaining ownership

`D06-check-snapshot.json` is the independent complete acceptance map; `D06-check-verification.json` contains detailed original-copy, freeze, overlap, gate, static and graph checks. Every writer path plus every new checker artifact has individual classification/coverage and exact hashes. Historical copies, logs and screenshots receive explicit generated/hash coverage rather than invented manual runtime coverage.

No source/test product correction, child agent, commit, staging, spec/ledger/status/manifests/archive mutation or D07 work occurred. This PASS accepts whole actual **D06/AU07 only**. Main may perform its English seven-section spec/ledger synchronization and explicit compiler-plan update, then continue D07 and D08 sequentially. Whole-D integration, E/QG01 and commit approval remain open. Later overlapping product edits require current-source review and new current integration reports, with accepted historical reports preserved.
