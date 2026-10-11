# Independent source review

Date: 2026-10-11. Reviewer: `full_product_check` (`trellis-check`). Active task: `10-11-native-world-shot-relations`.

This is an independent source/control-flow review with focused deterministic regressions, updated after the final-source freeze and build `1791705463268-isolated-product`. It is not a completed packaged, supplier, microphone, print or full-parity acceptance report. Root is separately collecting actual normal-product evidence. Earlier intermediate builds predate repairs and are not substituted for this final app.

## Reviewed scope and governing contracts

Read the task PRD/design/implementation plan and check context, including the saved hook output, shared desktop UI, native/video workspace, Agent execution/tools/atomic-write evidence/batches, provider contracts, audio batch arrangement, IP/material/reference/export and quality contracts. Directly read relevant state-management and audio/music ownership, transaction, generation and export sections. The explicitly approved temporary desktop IndexedDB design supersedes older unconditional native-SQLite selection rules; native caller/file/integrity contracts remain in force.

Inspected changed tracked source and new source: storage/runtime selectors, database construction, route/component/repository/media gates, native fetch/policy and provider/default/download/probe integrations, save/external-link helpers and all common export callers, Rust system/file-transfer services and desktop setup/ACL/build/profile/dependency changes, official HTTP JS boundary and vendored response lifecycle patch/provenance, fixtures and new focused tests. Historical SQLite owners/coverage were checked for preservation rather than treated as the normal product.

## Findings identified and fixed by owners

### F1 — Null-body native HTTP responses retained resources

- Files: `desktop/tauri/src-tauri/vendor/tauri-plugin-http/src/commands.rs`, `src/cuepoint_cancel_tests.rs` in that vendor directory.
- Original defect: official JS HTTP 2.8.2 deliberately creates a null body for statuses 101/103/204/205/304 and therefore never reads or cancels the response resource. Rust `fetch_send` originally registered that resource unconditionally. The wrapper correctly disposed its controller for a null body, leaving no later cleanup path until WebView teardown.
- Raised promptly to root/native owner. The native owner added private `register_response`, immediately closing exactly the bodyless statuses while preserving the public numeric reply shape and all other responses. Source review confirms `fetch_send` now uses this helper.
- Owner regression: actual reqwest responses and a Tauri ResourceTable, ten cycles with an independently retained readable 200 response plus 204/205/304 responses; bodyless IDs are absent without closing the unrelated body. Interim 101/103 are explicitly predicate-only coverage. Independently read the retained final log: 18 vendor tests passed. The subsequent final app build includes the patched dependency.
- Independently verified the exact patch and all patched/retained upstream source hashes against provenance, including this null-body follow-up.

### F2 — Valid product titles can prevent native export before the Save dialog

- Files: `src/lib/nativeSystemServices.ts:36`, `desktop/tauri/src-tauri/src/file_transfer.rs` (`validate_begin`); caller examples `ProjectGalleryPage.tsx:295`, `WorkspaceChrome.tsx:328`, `lib/audio/exportMix.ts:21`, `lib/audioGeneration/runtime.ts:115`.
- Verified source path: existing product/project/chapter/provider titles remain unrestricted. Common saves pass their derived filename unchanged, while native begin rejects `/`, `\\`, `:`, controls and filenames exceeding 240 UTF-8 bytes. A title such as `第1集：开场/预告` or a long Chinese title therefore cannot be exported at all. Browser anchor downloading previously supplied the browser's filename sanitization.
- Recommendation sent to root: normalize only the suggested basename centrally at the shared native-save boundary, preserving a useful suffix and the byte bound. Retain the backend's closed metadata/path checks; do not change business titles, codecs, stored records or imported filenames. Add focused punctuation/long-Unicode/suffix regressions.
- Fixed by the product owner after root coordination: `runtimeSave.nativeSaveFilename` repairs only the native dialog suggestion, handling invalid filesystem punctuation, Unicode controls/lone surrogates, NFC, useful format suffix and a 240-byte UTF-8 prefix without splitting code points. Browser anchor naming and Rust validation remain unchanged. Independent source inspection and the follow-up suite passed **3 files / 44 cases** (`independent-check-save-followup.log`).

### F3 — About-page image download bypassed the native Save service

- File: `src/components/studio/AboutPage.tsx`; regression: `tests/aboutPageSponsorSave.test.ts`.
- The original same-origin `<a download>` did not reach shared Save and root confirmed no actual native result. The owner now fetches the bundled image through same-origin WebView fetch, rejects missing/empty/nonimage fallback content, and awaits the real common save boundary. Native pending state plus a synchronous ref prevent duplicate clicks; success/cancel/unpublished error/published warning remain distinct. Browser anchor and external links retain their behavior. Device-local privacy wording matches both hosts.
- Independently reviewed the actual callback and regression assertions. The test executes the component handler plus real runtimeSave, mocking only the final native service. Final focused caller/service suite: **5 files / 58 cases passed**. Actual final sponsor Save-panel acceptance remains root's pending gate; source/tests do not close it.

### F4 — Trailing blank line failed whitespace verification

- File: `src/lib/projectPackage.ts`.
- `git diff --check` detected a new blank line at EOF after the old helper was moved. After explicit file-ownership coordination with root, reviewer removed only that blank line. No runtime behavior changed. `git diff --check` then passed; final TypeCheck rerun passed.

### F5 — Material original-file download bypassed native Save

- File: `src/components/studio/materials/MaterialPreview.tsx`; regression: `tests/materialPreviewSave.test.ts`.
- Root's packaged check found the remaining direct Blob-anchor download. The owner now awaits common Save using the original internally stored Blob and filename, with the same synchronous duplicate guard, disabled/pending control and truthful success/cancel/published-warning/error handling. Ordinary preview URL cleanup/text/document behavior and the browser anchor remain intact; setting/collection preview does not gain an unrelated export.
- Independently reviewed all actual callback branches and the caller assertions; the final 58-case suite above passes. These caller tests mock runtimeSave, while the accompanying service/filename tests exercise its real boundary; the scopes are explicit.
- Read root's final material-save/cancel AX records and byte oracle. Independently hashed the actual saved `roundtrip-image.png`: **310 bytes**, SHA-256 `7dabaf0fb9a110732227780dd0d911a9636bd78cca748407d72d9c1ad5dc5c3a`, equal to the moved original and recorded oracle. The cancel AX includes `已取消保存原文件`. This does not settle every subsequent Save-panel interaction.

## Findings not fixed / pending investigation

No additional verified source defect remains after the coordinated repairs above. Root/native owner are investigating an actual Save-panel interaction observed after cancellation; its cause and repeatability are not yet established by this reviewer. Treat it as pending system evidence, not a passing outcome or an invented code diagnosis. Remaining native HTTP/media/system/route-family acceptance belongs to root. No task-completion or archival approval is given here.

## Positive source findings

- One product owner is selected before Dexie construction. Browser keeps `aifenjing`; normal Tauri has an explicit fixed IndexedDB profile/namespace. Genuine Tauri detection still selects trusted IPC/hash navigation/system services. Normal IndexedDB repository methods do not call SQLite ensure/request, mirror data or fall back after failed writes.
- Shared pages and actual existing TypeScript commands remain reused. Agent registry/schema/permissions/business execution were not replaced or platform-forked. All 95 registered names remain in the same registry; reachability/behavior tests are separate from actual packaged family evidence.
- The six additional registered-tool tests use real frozen approval/run/resume/commands/ledger, both protocols, real effects/source bytes, rejection/stale/foreign-scope cases, completed-call replay and late ledger fault rollback. Their documented lack of direct receipts for IP archive/audio split and whole-chapter split revision semantics are existing behavior, accurately disclosed rather than manufactured coverage.
- Native HTTP has one selected remote transport and no WebView fallback, retries or global fetch replacement. Eager chat/connector/probe defaults and the former direct generated-result download are covered. Local packaged PDF/worker/assets still use Web fetch. JSON text is exempt from the 20 MiB binary/multipart cap, preserving existing image-input policies.
- Current configured origins are rechecked per ordinary call; draft connector probes and no-auth result downloads have distinct operation scopes. Origin grants are exact, deduplicated/bounded and explicitly additive until restart. Redirects are manual/bounded, authorization is removed cross-origin, method/body rewrites follow current policy, and discarded bodies are canceled.
- Native Save is independent of SQLite: bounded ordered chunks, at most two transfers, idle reap after dialog selection, incremental size/hash verification, stage cleanup, no overwrite and truthful post-publication warning. Common UI exports await native completion/cancel/error; an internally retained audio mix remains retained when external saving is canceled.
- Native profile initialization is immutable and precedes frontend database construction. WK store identity depends on bundle identifier and declared owner; isolated normal-product builds retain the same root frontend/backend/services. Both normal and historical acceptance command manifests have been updated. Main-document navigation, remote-script CSP and main-window command trust remain restricted.
- External HTTP(S) links use the validated system opener. Product microphone wording is updated while baseline audio constraints and existing recording implementation remain intact.

## Verification performed independently

Explicit machine pnpm: `/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm`.

- Lint / TypeCheck: **PASS** — `pnpm lint` (`tsc -b --pretty false`), original log `independent-check-types.log`.
- Focused tests: **PASS**, **10 files / 106 cases**, `--maxWorkers=2`; original log `independent-check-focused-tests.log`. Files: productStorage, productStorageQueries, runtimeFetch, runtimeFetchIntegration, runtimeFetchLifecycle, runtimeSave, runtimeExternalLinks, nativeSystemServices, nativeRegisteredToolParity and agentToolTransactions.
- Follow-up Save regressions: **PASS**, **3 files / 44 cases**, including the new filename normalization cases and prior renderer publication/cancellation lifecycle; original log `independent-check-save-followup.log`.
- TypeCheck after filename follow-up: **PASS**, original log `independent-check-final-types.log`.
- Final About/Material caller and common-save regressions: **PASS**, **5 files / 58 cases**, original log `independent-check-final-caller-tests.log`.
- Final source TypeCheck after both caller repairs: **PASS**, original log `independent-check-final-source-types.log`.
- Focused ESLint: exit zero / **0 errors**, six MaterialPreview complexity/ternary review warnings; tests have no matching ESLint configuration and produce two explicit ignored-file warnings. Original log `independent-check-final-callers-eslint.log`. Test files are executed by Vitest; an ignored-file notice is not asserted to be test lint coverage.
- Final whitespace check: `git diff --check` **PASS**.
- Read all six updated frontend specifications (`index`, `native-product-runtime`, `native-workspace`, `state-management`, `video-workspace`, `workspace-storage`). The fixed owner, fresh-development policy, conservative native probe gate, HTTP lifecycle/vendor provenance and independent Save/publication contracts align with current source.
- Independently recomputed vendor patch/file hashes: exact patch and all three patched files match recorded provenance; 22 retained unchanged upstream files match original hashes. Registry-only `.cargo-ok` and `.cargo_vcs_info.json` are not copied, and library-local Cargo.lock is not treated as the application's lock. Reviewed owner `http-null-body-final-tests.log`: 18 vendor cases pass; `native-null-body-clippy.log` exits zero with the two explicitly disclosed upstream cookie-disabled warnings.
- Independently read root final aggregate/quality raw logs: **208 files, 3550 passed / 1 skipped** in `vitest-final.log`; quality **PASS**, 13 reviewed error allowances and 567 review warnings in `quality-final.log`. They are root-run evidence, not duplicated independent runs. Earlier `inputs-changed-during-run` remains a failed attempt.
- Final archived app receipt identifies `1791705463268-isolated-product`, `dev.cuepoint.review.full-20261011`, IndexedDB and WK store `442b6cc90f14bef33aa4fdc2e54d2d8a`. Raw native build log succeeds at **28.60 MiB**, with the two disclosed upstream cookie-disabled warnings and local signing/notarization limitation. No full aggregate, quality, native compilation or bundle was duplicated.
- No provider calls, credential access, actual UI, commits, specification edits or task metadata edits were performed by this reviewer.
- Reviewer product edits: only F4's trailing blank line, after root coordination. Functional findings were sent to the owning implementers/root for safe coordinated repair.

## Native connection-probe diagnostic distinction

The official plugin serializes IPC failures as string rejections. The wrapper conservatively maps non-TypeError native failures to Error, while preserving actual TypeError from browser/injected transports. Therefore the existing generic probe's GET-fetch-TypeError POST fallback is unavailable for a native IPC network string error; HTTP404/405 fallback remains. This does not add a paid retry and is not reported as a blocking defect. Root was asked to document the diagnostic difference rather than broadly reclassify arbitrary plugin strings and accidentally authorize a POST after a non-network failure. Shared provider protocols and explicit fetch injection remain unchanged.

## Final-source and byte provenance capture

`independent-check-postbuild-source-manifest.json` records 999 current source/config/test/spec files, four actual archived app files and 697 current frontend-dist files. It explicitly states **post-build capture**, not a pre-build manifest or cryptographic proof that the source generated the app. Root reports the product-source freeze preceded this build; the supplementary mtime comparison found no captured product input modified after the build-directory start. Specification/test timestamps are separately identified and are not runtime inputs. Current dist files are not misrepresented as extracted embedded app bytes.

The archived executable is 29,238,672 bytes, SHA-256 `52421e29fa183184b0bc9bf20dc1de7ec8cc013b5b3e39ce87197a16b1b26e48`. The capture independently rechecks vendor patch/patched/retained upstream hashes, synthetic generator hashes, all seven moved import originals and the actual saved material-file oracle; all checks pass. Original-source paths are absent and originals remain in the explicit comparison folder. This is byte provenance and source-independence support, not a claim that every media UI/decoder was exercised.

## Remaining completion checks

1. Root resolves or accurately records the observed post-cancel Save-panel interaction, completes the final About Save-panel check and retains actual system outcomes. Any source repair requires affected regressions, typecheck and updated final source/build identities.
2. Actual final normal packaged app gates remain distinct: profile/WK store/database isolation and reopen; real Web Lock exclusivity/release/recovery; incremental HTTP/SSE, partial/error/overflow, abort before headers and while stalled, disconnect/late-event suppression/reload cleanup; real multipart/no-auth result reads. Root reports current real Stop/disconnect progress, but this source review does not certify the full matrix.
3. Complete route/tool-family matrix must distinguish shared behavioral tests, actual packaged observations and genuine supplier evidence. User-configured real suppliers, media/documents/audio, clipboard/external opener, microphone and white A4-landscape print remain actual acceptance gates; no fixture or this report substitutes for them.
4. Preserve final raw aggregate/quality/Rust/desktop logs and current source/build hashes. Failed/intermediate attempts remain accurately labeled. Runtime Windows/Linux acceptance remains deferred, with no pass claim.

Disposition: **final source review passes with no remaining verified source defect at this checkpoint**; all six updated frontend specs are reviewed. **Task completion/archival is not approved by this report while actual evidence and the native Save-panel investigation remain pending.**

## Exact 95-name owner and regression-source map

Generated independently from the actual current `BUILTIN_TOOLS` and its imported family arrays using Vite SSR and fake IndexedDB. All 95 names have exactly one family owner; the registry/family definitions are unchanged by this platform task. Counts: foundation=2, IP_TOOLS=6, AUDIO_TOOLS=7, MUSIC_TOOLS=4, AUDIO_GENERATION_TOOLS=4, AUDIO_BATCH_TOOLS=2, AUDIO_ARRANGEMENT_TOOLS=4, MATERIAL_TOOLS=10, DISCOVERY_TOOLS=1, TASK_TOOLS=5, BUSINESS_TOOLS=33, GENERATION_TOOLS=7, MEMORY_TOOLS=4, REFERENCE_TOOLS=4, WEB_TOOLS=2.

This is an exact source/evidence index, not 95 independently completed native executions. Rows labeled `source index` locate a literal tool reference in an existing behavior suite; a literal reference alone is not proof of that operation. The three parameterized world updates and six new registered-entry scenarios were reviewed explicitly in `tool-contract-coverage.md`. Root owns final passed-log links and actual packaged family observations; pending native outcomes are not promoted here.

| Registered name | Effect | Existing shared owner | Regression source / scope | Packaged result in this report |
| --- | --- | --- | --- | --- |
| `workspace_overview` | read | `src/lib/agent/tools.ts` | `tests/toolLoading.test.ts:53` — source index | not certified by source review |
| `update_run_plan` | bookkeeping | `src/lib/agent/tools.ts` | `tests/toolLoading.test.ts:53` — source index | not certified by source review |
| `ip_search` | read | `src/lib/agent/ipTools.ts` | `tests/agentIpTools.test.ts:80` — source index | not certified by source review |
| `ip_read` | read | `src/lib/agent/ipTools.ts` | `tests/agentIpTools.test.ts:77` — source index | not certified by source review |
| `ip_create` | write | `src/lib/agent/ipTools.ts` | `tests/agentIpTools.test.ts:44` — source index | not certified by source review |
| `ip_update` | write | `src/lib/agent/ipTools.ts` | `tests/agentIpTools.test.ts:65` — source index | not certified by source review |
| `ip_set_archived` | write | `src/lib/agent/ipTools.ts` | `tests/nativeRegisteredToolParity.test.ts:219` — actual registered approval/execute/resume; both protocols | not certified by source review |
| `project_bind_ip` | write | `src/lib/agent/ipTools.ts` | `tests/agentIpTools.test.ts:79` — source index | not certified by source review |
| `audio_read` | read | `src/lib/agent/audioTools.ts` | `tests/audioMusicAgentTools.test.ts:67` — source index | not certified by source review |
| `audio_create` | write | `src/lib/agent/audioTools.ts` | `tests/audioMusicAgentTools.test.ts:49` — source index | not certified by source review |
| `audio_update` | write | `src/lib/agent/audioTools.ts` | `tests/audioMusicAgentTools.test.ts:116` — source index | not certified by source review |
| `audio_place_take` | write | `src/lib/agent/audioTools.ts` | `tests/nativeRegisteredToolParity.test.ts:219` — actual registered approval/execute/resume; both protocols | not certified by source review |
| `audio_edit_clip` | write | `src/lib/agent/audioTools.ts` | `tests/nativeRegisteredToolParity.test.ts:219` — actual registered approval/execute/resume; both protocols | not certified by source review |
| `audio_split_clip` | write | `src/lib/agent/audioTools.ts` | `tests/nativeRegisteredToolParity.test.ts:219` — actual registered approval/execute/resume; both protocols | not certified by source review |
| `audio_remove_clip` | write | `src/lib/agent/audioTools.ts` | `tests/nativeRegisteredToolParity.test.ts:219` — actual registered approval/execute/resume; both protocols | not certified by source review |
| `music_read` | read | `src/lib/agent/musicTools.ts` | `tests/audioMusicAgentTools.test.ts:87` — source index | not certified by source review |
| `music_save_draft` | write | `src/lib/agent/musicTools.ts` | `tests/audioMusicAgentTools.test.ts:123` — source index | not certified by source review |
| `music_update_work` | write | `src/lib/agent/musicTools.ts` | `tests/musicDurationContract.test.ts:178` — source index | not certified by source review |
| `music_reuse_work` | write | `src/lib/agent/musicTools.ts` | `tests/musicDurationContract.test.ts:153` — source index | not certified by source review |
| `audio_generation_capabilities` | read | `src/lib/agent/audioGenerationTools.ts` | `tests/audioGenerationAgent.test.ts:97` — source index | not certified by source review |
| `audio_generate_speech` | network | `src/lib/agent/audioGenerationTools.ts` | `tests/audioGenerationAgent.test.ts:34` — source index | not certified by source review |
| `music_generate` | network | `src/lib/agent/audioGenerationTools.ts` | `tests/audioGenerationAgent.test.ts:34` — source index | not certified by source review |
| `audio_generation_check` | network | `src/lib/agent/audioGenerationTools.ts` | `tests/audioTaskEvidence.test.ts:55` — source index | not certified by source review |
| `prepare_audio_generation_batch` | write | `src/lib/agent/audioBatchTools.ts` | `tests/audioGenerationBatch.test.ts:58` — source index | not certified by source review |
| `audio_read_generation_batch` | read | `src/lib/agent/audioBatchTools.ts` | `tests/audioGenerationBatch.test.ts:58` — source index | not certified by source review |
| `audio_read_arrangement` | read | `src/lib/agent/audioArrangementTools.ts` | `tests/audioArrangementAgent.test.ts:62` — source index | not certified by source review |
| `audio_select_takes` | write | `src/lib/agent/audioArrangementTools.ts` | `tests/audioArrangementAgent.test.ts:41` — source index | not certified by source review |
| `audio_arrange_selected` | write | `src/lib/agent/audioArrangementTools.ts` | `tests/audioArrangementAgent.test.ts:46` — source index | not certified by source review |
| `audio_revert_arrangement` | write | `src/lib/agent/audioArrangementTools.ts` | `tests/nativeRegisteredToolParity.test.ts:219` — actual registered approval/execute/resume; both protocols | not certified by source review |
| `material_search` | read | `src/lib/agent/materialTools.ts` | `tests/agentMaterialTools.test.ts:59` — source index | not certified by source review |
| `material_read` | read | `src/lib/agent/materialTools.ts` | `tests/agentMaterialTools.test.ts:61` — source index | not certified by source review |
| `material_read_text` | read | `src/lib/agent/materialTools.ts` | `tests/agentMaterialTools.test.ts:41` — source index | not certified by source review |
| `material_read_image` | read | `src/lib/agent/materialTools.ts` | `tests/materialImageQueue.test.ts:39` — source index | not certified by source review |
| `material_update_metadata` | write | `src/lib/agent/materialTools.ts` | `tests/agentMaterialTools.test.ts:129` — source index | not certified by source review |
| `material_promote` | write | `src/lib/agent/materialTools.ts` | `tests/agentMaterialTools.test.ts:45` — source index | not certified by source review |
| `material_use` | write | `src/lib/agent/materialTools.ts` | `tests/agentMaterialTools.test.ts:150` — source index | not certified by source review |
| `material_update_use` | write | `src/lib/agent/materialTools.ts` | `tests/agentMaterialTools.test.ts:153` — source index | not certified by source review |
| `material_archive` | write | `src/lib/agent/materialTools.ts` | `tests/agentMaterialTools.test.ts:158` — source index | not certified by source review |
| `material_release` | write | `src/lib/agent/materialTools.ts` | `tests/agentMaterialTools.test.ts:166` — source index | not certified by source review |
| `load_tool_groups` | bookkeeping | `src/lib/agent/toolLoading.ts` | `tests/agentReferences.test.ts:98` — source index | not certified by source review |
| `task_read` | bookkeeping | `src/lib/agent/taskTools.ts` | `tests/agentReferences.test.ts:220` — source index | not certified by source review |
| `task_create` | bookkeeping | `src/lib/agent/taskTools.ts` | `tests/agentTaskOrchestration.test.ts:38` — source index | not certified by source review |
| `task_update` | bookkeeping | `src/lib/agent/taskTools.ts` | `tests/agentTaskOrchestration.test.ts:123` — source index | not certified by source review |
| `task_record_write` | bookkeeping | `src/lib/agent/taskTools.ts` | `tests/agentTaskOrchestration.test.ts:70` — source index | not certified by source review |
| `task_record_read` | bookkeeping | `src/lib/agent/taskTools.ts` | `tests/agentTaskOrchestration.test.ts:100` — source index | not certified by source review |
| `business_search` | read | `src/lib/agent/businessTools.ts` | `tests/agentBusiness.test.ts:188` — source index | not certified by source review |
| `business_detail` | read | `src/lib/agent/businessTools.ts` | `tests/agentBusiness.test.ts:188` — source index | not certified by source review |
| `business_read_relations` | read | `src/lib/agent/businessTools.ts` | `tests/agentBusiness.test.ts:188` — source index | not certified by source review |
| `business_read_text` | read | `src/lib/agent/businessTools.ts` | `tests/agentBusiness.test.ts:188` — source index | not certified by source review |
| `project_create` | write | `src/lib/agent/businessTools.ts` | `tests/agentBusiness.test.ts:44` — source index | not certified by source review |
| `project_update` | write | `src/lib/agent/businessTools.ts` | `tests/agentBusiness.test.ts:81` — source index | not certified by source review |
| `project_delete` | write | `src/lib/agent/businessTools.ts` | `tests/agentBusiness.test.ts:153` — source index | not certified by source review |
| `episode_create` | write | `src/lib/agent/businessTools.ts` | `tests/agentBusiness.test.ts:148` — source index | not certified by source review |
| `episode_update` | write | `src/lib/agent/businessTools.ts` | `tests/agentBusiness.test.ts:130` — source index | not certified by source review |
| `episode_delete` | write | `src/lib/agent/businessTools.ts` | `tests/agentBusiness.test.ts:150` — source index | not certified by source review |
| `beat_create` | write | `src/lib/agent/businessTools.ts` | `tests/agentBusiness.test.ts:82` — source index | not certified by source review |
| `beat_update` | write | `src/lib/agent/businessTools.ts` | `tests/agentBusiness.test.ts:139` — source index | not certified by source review |
| `beat_delete` | write | `src/lib/agent/businessTools.ts` | `tests/agentBusiness.test.ts:145` — source index | not certified by source review |
| `shot_create` | write | `src/lib/agent/businessTools.ts` | `tests/agentBusiness.test.ts:83` — source index | not certified by source review |
| `shot_update` | write | `src/lib/agent/businessTools.ts` | `tests/agentBusiness.test.ts:92` — source index | not certified by source review |
| `shot_delete` | write | `src/lib/agent/businessTools.ts` | `tests/agentBusiness.test.ts:328` — source index | not certified by source review |
| `character_create` | write | `src/lib/agent/businessTools.ts` | `tests/agentBusiness.test.ts:159` — source index | not certified by source review |
| `character_update` | write | `src/lib/agent/businessTools.ts` | `tests/agentBusiness.test.ts:169` — source index | not certified by source review |
| `character_delete` | write | `src/lib/agent/businessTools.ts` | `tests/agentBusiness.test.ts:318` — source index | not certified by source review |
| `scene_create` | write | `src/lib/agent/businessTools.ts` | `tests/agentBusiness.test.ts:294` — source index | not certified by source review |
| `scene_update` | write | `src/lib/agent/businessTools.ts` | `tests/agentBusiness.test.ts:103` — parameterized real command/receipt case | not certified by source review |
| `scene_delete` | write | `src/lib/agent/businessTools.ts` | `tests/agentBusiness.test.ts:319` — source index | not certified by source review |
| `prop_create` | write | `src/lib/agent/businessTools.ts` | `tests/agentBusiness.test.ts:295` — source index | not certified by source review |
| `prop_update` | write | `src/lib/agent/businessTools.ts` | `tests/agentBusiness.test.ts:103` — parameterized real command/receipt case | not certified by source review |
| `prop_delete` | write | `src/lib/agent/businessTools.ts` | `tests/agentBusiness.test.ts:320` — source index | not certified by source review |
| `style_create` | write | `src/lib/agent/businessTools.ts` | `tests/agentBusiness.test.ts:296` — source index | not certified by source review |
| `style_update` | write | `src/lib/agent/businessTools.ts` | `tests/agentBusiness.test.ts:103` — parameterized real command/receipt case | not certified by source review |
| `style_delete` | write | `src/lib/agent/businessTools.ts` | `tests/agentBusiness.test.ts:321` — source index | not certified by source review |
| `asset_copy_from_studio` | write | `src/lib/agent/businessTools.ts` | `tests/agentBusiness.test.ts:348` — source index | not certified by source review |
| `creative_duplicate` | write | `src/lib/agent/businessTools.ts` | `tests/agentBusiness.test.ts:308` — source index | not certified by source review |
| `creative_reorder` | write | `src/lib/agent/businessTools.ts` | `tests/agentBusiness.test.ts:143` — source index | not certified by source review |
| `slot_update` | write | `src/lib/agent/businessTools.ts` | `tests/agentBusiness.test.ts:347` — source index | not certified by source review |
| `media_delete_orphan` | write | `src/lib/agent/businessTools.ts` | `tests/agentBusiness.test.ts:190` — source index | not certified by source review |
| `prepare_generation_batch` | bookkeeping | `src/lib/agent/generationTools.ts` | `tests/agentGeneration.test.ts:202` — source index | not certified by source review |
| `read_generation_batch` | read | `src/lib/agent/generationTools.ts` | `tests/agentGeneration.test.ts:202` — source index | not certified by source review |
| `generation_capabilities` | read | `src/lib/agent/generationTools.ts` | `tests/agentGeneration.test.ts:202` — source index | not certified by source review |
| `submit_generation` | network | `src/lib/agent/generationTools.ts` | `tests/agentGeneration.test.ts:37` — source index | not certified by source review |
| `check_generation` | network | `src/lib/agent/generationTools.ts` | `tests/agentGeneration.test.ts:202` — source index | not certified by source review |
| `apply_generation` | write | `src/lib/agent/generationTools.ts` | `tests/agentGeneration.test.ts:42` — source index | not certified by source review |
| `list_generation_jobs` | read | `src/lib/agent/generationTools.ts` | `tests/agentGeneration.test.ts:202` — source index | not certified by source review |
| `memory_search` | read | `src/lib/agent/memoryTools.ts` | `tests/agentMemoryTools.test.ts:162` — source index | not certified by source review |
| `memory_read` | read | `src/lib/agent/memoryTools.ts` | `tests/agentMemoryTools.test.ts:128` — source index | not certified by source review |
| `project_history_search` | read | `src/lib/agent/memoryTools.ts` | `tests/agentMemoryTools.test.ts:298` — source index | not certified by source review |
| `project_history_read` | read | `src/lib/agent/memoryTools.ts` | `tests/agentMemoryTools.test.ts:331` — source index | not certified by source review |
| `discover_project_images` | read | `src/lib/agent/referenceTools.ts` | `tests/imageDiscovery.test.ts:54` — source index | not certified by source review |
| `project_reference_search` | read | `src/lib/agent/referenceTools.ts` | `tests/agentReferences.test.ts:201` — source index | not certified by source review |
| `project_reference_read` | read | `src/lib/agent/referenceTools.ts` | `tests/agentReferences.test.ts:204` — source index | not certified by source review |
| `read_project_image` | read | `src/lib/agent/referenceTools.ts` | `tests/agentReferences.test.ts:94` — source index | not certified by source review |
| `web_search` | network | `src/lib/agent/webTools.ts` | `tests/webResearchRuntime.test.ts:19` — source index | not certified by source review |
| `web_read` | network | `src/lib/agent/webTools.ts` | `tests/webResearchRuntime.test.ts:39` — source index | not certified by source review |
