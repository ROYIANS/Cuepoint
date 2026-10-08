# D04 / AU-06 independent whole-unit acceptance — PASS

2026-10-08 · native trellis-check. **No blockers; no checker product fixes.** This accepts the complete D04 unit at the exact hashes in D04-check-snapshot.json. The check covers all **62 writer paths: ten implementation paths (five src, two tests, two fixture files and the research native runner) plus 52 evidence paths**. Evidence is classified as evidence, not additional product code. This is technical whole-unit acceptance; main owns spec/ledger synchronization and any subsequent unit. No staging, commits, task/status/ledger/spec edits, child dispatch or archive occurred.

The authoritative product freeze remains **October 8, 2026, 12:25:14.577483 +08:00**. All ten implementation hashes, all 434 source hashes, all 26 verification inputs, the 62 writer after-hashes and coordinator static/AST evidence hashes match current. No source changed during this check. The original 12:20:33 freeze remains preserved and explicitly superseded: the final panel and actual regression test correct the saved-summary threshold. No refresh of static/AST is required for this check because there were no product changes. Heavy gates finished before check entry; the checker reused verified frozen results and performed bounded hash/AST/token/graph/log inspections instead of repeating the full suite.

## Actual ownership, read graph and binding

AgentChatPage is the sole production ContextUsageTrigger caller. Trigger calls useContextUsage once, with one readAgentContextPreview live subscription. That helper owns durable preview facts; one display memo assembles the view. Ring, tooltip and ContextUsagePanel consume the same derived snapshot; the memory sheet receives the identical memory selection object. The panel has no query or second planner. AgentControls remains the separate lightweight ContextParameters caller; MessageList remains the historical MemoryRunHistory caller.

The complete read path was checked against current source, not just reader-search output:

| Actual owner | Stores / responsibility |
| --- | --- |
| agentContextPreview readFacts/readScopedRows | agents, thread-scoped chatMessages/agentRuns/contextCompactions, agentTasks, projects; reads required thread first and owns one outer readonly transaction |
| getTaskContext / listTaskRecords | authoritative thread binding, current task and taskId-scoped records; shared bounded instructions/tool assembly, latest eight records and 1,200 characters per body |
| getProjectContext / projectContextTables | projects, episodes, characters, scenes, props, styles, shots, ipProfiles, projectIpLinks and AUDIO_TABLES; existing bounded whitelist/fingerprint/coverage |
| getAudioMusicProjectContext | project-scoped chapters/speakers/segments/tracks/takes/clips/drafts/works/jobs; linked IP; existing metadata-only projections |
| getMemorySelection / getEligibleProjectMemories | projects/chatThreads/projectMemories nested readonly scopes; owner checks, reviewed/active/non-excluded eligibility and original lexical planner/budget |
| selectReferenceContext / getReferenceSource | projects/projectReferences/referenceChunks/media nested readonly scope; source owner/status/revision, media owner and chunk project/revision; existing whole-chunk budget and image identity |

contextPreviewTables explicitly deduplicates **30 stores**. It includes audioExports even though this current projection does not read export rows, through the existing AUDIO_TABLES set. It does not use db.tables. Nested compatible Dexie scopes reuse the outer native IDBTransaction. The model-bank/vision asynchronous preparation completes before entering readFacts; requireVision runs only when selected images exist. There is no Blob encoding/hash, worker, provider request or waitFor inside the new fact transaction. Text remains valid with unknown/non-vision capability.

A supplied thread is authoritative. Missing thread never falls back to a home project. Conflicting supplied project, task project or active/recoverable run project returns unavailable before material assembly. Query-indexed messages/runs/compactions/tasks belong to that thread, and task records are selected by the actual task ID. The general-agent key is code-owned; production task/run creation uses that same owner. Home alone uses its selected project. Required agent/project missing is explicit for next-send preview; studio is unavailable. Ordinary projectless home/thread and task intake without a task are legitimate ready states. Loaded empty history/memory/reference selections are ready; failed reads never become empty/default ready facts. Unknown capacity stays unknown.

The separate memory management reader intentionally retains its original independent transactions. listProjectMemories uses db.tables; wrapping it in a new narrow parent was a real failed intermediate change and was removed. This management read is not the coherent preview transaction or another selection planner. getThreadMemoryExclusions validates thread/project ownership before controls become mutable; writes retain setThreadMemoryExcluded's original atomic owner checks.

## UI identity, frozen execution and policy semantics

The request identity includes thread, project, interaction mode, normalized current draft, attachment IDs/revisions/order, model, provider definition and relevant model metadata. Credentials and parent-page loading arrays are excluded. Results of a previous identity—including late ready, error, missing and legitimately empty snapshots—are hidden until the current envelope matches. No old ring percentage, budget, coverage, reference details or mutable memory actions remain visible during mismatch/loading/error. The current trimmed draft is used directly; no deferred draft is labeled current.

Original before copies were read under research/D04-evidence/before/. The existing currentSavedRun predicate is preserved: latest running/waiting_approval, or failed/interrupted with tool calls. Completed/text-only failed runs do not become active previews. Saved execution display uses its frozen request/continuation, instructions, policy/capacity/history, offered/enabled tools/loading, skill instructions, project/memory/reference snapshots, model and continuation overhead. Missing optional legacy frozen fields stay absent rather than acquiring current live materials or capacity. Deleted current projects can leave a matching saved request readable with availability=false and mutation disabled.

The final saved-summary correction is justified by this existing frozen-request contract. An unsummarized frozen 8,192-token request remains at the **4,096-token threshold (50%)**, even if a later applicable live summary exists or current policy is edited. It cannot inherit the later 65% threshold. Active-run summary detail resolves only its frozen summaryId. The actual trigger/panel regression is retained; it checks the frozen request, history count, absent matching summary and threshold. This introduces no capability/policy feature and changes no execution request.

ContextParameters keeps an independent minimal policy read. Its scope envelope distinguishes loading/mismatch, loaded missing/null and read error; controls and save status cannot imply default policy has loaded successfully. Each local session has a synchronous write lock and owner guard. Old-thread callbacks cannot initiate after switch; toast/error/finally publication belongs to its initiating live session. The independent next-send policy editor remains separate from the frozen saved-run display. Every ordinary change is still a single-field intent, including explicit undefined to clear local tokens. Reset and default-copy retain their existing transaction-time full-source replacement. No new revision CAS is claimed for this API; existing field/slot/task/record CAS remains unchanged.

MemoryContextDetails receives shared current preview selection or a saved historical selection. Its content key includes thread, run/preview and selection project; management results/pending/error/session ownership include current shown project/thread. Switching same-project threads or historical shown project cannot adopt another scope's exclusions or late write result. Frozen text/version remains distinct from current row availability. Existing write guards and readOnly propagation protect mutations; exclusion does not rewrite historical request content. The sheet remains mounted after closing the popover.

## Per-file implementation review

| Path | Actual reviewed behavior and evidence |
| --- | --- |
| src/db/agentContextPreview.ts | Entire identity/type/store/scope/frozen-selection/error owner; original selectors reused, empty/missing/foreign/error controls and video/audio/music nested-store tests; real native concurrent snapshot |
| src/components/agent/ContextUsagePanel.tsx | Entire hook/memo/trigger/panel; one subscription, same selection identity, current draft, explicit nonready UI and frozen-summary regression; actual native Radix proof |
| src/components/agent/ContextParameters.tsx | Entire read/status/session and each field/reset/default callback; B03 actual intent/storage assertions plus native delayed read/write ownership |
| src/components/agent/MemoryContextDetails.tsx | Entire Sheet/content/history and management/exclusion lifetime; scope key/envelope, original independent reads and atomic write owner; native A/B pending exclusion |
| src/components/agent/AgentChatPage.tsx | Entire current source/original diff; independent TypeScript token probe proves only three preview JSX attributes removed. Transcript/status/task/retry consumers and D03 owners remain |
| tests/contextPreviewSnapshot.test.ts | All reader/trigger/panel cases, real production owners, negative/normal controls, frozen optional fields and saved-summary threshold; deterministic host limits explicit |
| tests/b03IntentBoundaries.test.ts | Whole actual callback/storage suite and original diff; prior assertions retained, envelope adaptation and stale-owner/error/missing control added; no copied merger |
| tests/fixtures/d04/harness.tsx | Complete real ReactDOM/Router/Radix/Dexie fixture, timing API, owned stored image identity and concurrent writer/native transaction observations |
| tests/fixtures/d04/index.html | Complete isolated local native entry |
| research/D04-native.mjs | Complete Vite seams/six scenarios, actual consumed exports, page/external-request failure, screenshot/HTML persistence and cleanup; valid research runner path retained |

The snapshot gives every one of the **52 evidence paths** its own coverage status, artifact classification, concrete note and exact before/check-entry/writer-after/current-after hash. All five non-null before copies match the original capture. New before/deleted after values use null. All 410 accepted D03 TS source hashes match the D04 entry; source outside the five D04 product paths remains identical. D03 AgentChatPage is the correct predecessor, not its older D02 body. D02 B03-test hash matches D04 before. D01 has no directly edited overlap. Direct D02 project/task/memory/reference/settings/run owners and D03 session/selection/flow sources are unchanged. No global store, cache, factory, duplicated planner or execution-request boundary was introduced.

## Frozen gates and static evidence

| Gate | Accepted result |
| --- | --- |
| TypeScript, explicit local pnpm lint | PASS |
| Focused actual callbacks/selectors | 9 files / 126 tests PASS |
| Full Vitest | 150 files / 2,439 tests PASS |
| B01 native | 19 cases PASS |
| B07 native | 5 scenarios PASS; zero external/provider requests |
| Final D04 native | 6 scenarios PASS; zero external/provider requests |
| Coordinator cumulative same-version static | 89 src paths; 130 errors/214 warnings → 119 errors/204 warnings; zero added non-complexity diagnostics |
| Coordinator global AST, independently checked recorded graph | 411 TS files / 2,429 edges / zero parse errors; zero static or literal-dynamic value SCCs |

All seven writer command/log records were independently hash-verified. Exact commands, cwd, environment and outputs are retained in the snapshot. pnpm is always the explicit /Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm. The B01/B07 consumed fixture/script/owner inputs remain unchanged after the summary-only correction; B07 controls the context leaf and transport, so these passes supplement rather than prove D04 UI. The final D04 native run exercises that real UI. Broad suites were not rerun without a concrete uncovered defect.

Native coherence asserts a real concurrent writer is submitted after the first project read, remains blocked until preview completes, and then commits. The first snapshot has OLD PROJECT + OLD MEMORY, the next NEW PROJECT + NEW MEMORY. The log records writerStarted=true, finishedAtRead=false, writerFinished=true and oneNativeTransaction=true, with actual project/memory/reference/media observations, readonly nested subsets and complete outer store scope. Image selection is asserted separately; this is metadata/Blob identity evidence, not decoding quality.

Static tools use identical restored ESLint 9.39.5, typescript-eslint 8.71.1, Hooks 7.1.1, SonarJS 3.0.7 and TypeScript 5.9.2, with separate complete baseline/current programs. Raw totals and all 89 after hashes were independently checked. Remaining 119 errors/204 warnings are inherited current debt; reductions are cumulative D01–D04, not all D04. The new DB helper and policy editor have zero diagnostics. Exact inherited UI changes are accepted for the authorized state distinctions: display memo cyclomatic **84→61**, cognitive **24→31**; panel cyclomatic **41→46**, cognitive **33→36**; MemoryContextContent cyclomatic **37→48**, entry callback **22→22**. These are not all improvements. AgentChatPage's cumulative extraction metrics belong to D03; D04 removes only unused props.

Any/non-null totals remain 46/200. Assertions rise 470→477; the checker independently compared actual before/current AST and confirmed all seven additions are **as const** literal/object inference, not unchecked data casts. Five satisfies expressions are checked return-envelope constraints. The bounded checker probe also verifies zero parse errors/any/non-null growth in all five source paths and the exact three-attribute AgentChatPage token delta. An initial checker REPL module-loading attempt was inconclusive and produced no artifact; the successful explicit-node stdin probe used the restored TypeScript 5.9.2 and exited zero. This was an inspection tooling correction, not a product failure.

## Preserved failures and limits

The first four native failure logs, HTML and screenshots were inspected and remain unchanged: wrong ready class selector; actual missing characters parent-store failure in the separate management reader; earlier exclusion contaminating the concurrent test setup; and observer missing compatible nested scopes. Corrections retain real row/native-transaction assertions and the 10-second timeout. The Node document-undefined test-host failure, initial TypeScript/static errors, intermediate passes and superseded 12:20 freeze remain historical. No assertion or timeout was weakened and no accepted prior artifact was rewritten.

Deterministic hook hosts do not prove React memo/effect scheduling; targeted real ReactDOM/Radix/native IDB evidence supplements them. Native UI uses controlled timing seams and local fixtures, not an unmodified full-app E2E. No paid provider behavior, image interpretation/decoding quality, native audio quality, broad CPU/latency/OOM benchmark or all-browser coverage is claimed. Estimates retain their original heuristic and unsaved output/tool-result limits. Model snapshot/build/whole-D integration and D05–D08/E/QG01 remain outside this acceptance. No findings beyond AU-06 are closed here; main applies the accepted spec/ledger changes afterward.
