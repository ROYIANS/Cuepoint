# E07 UI implementation

## Boundary before implementation

The actual `AgentRunDetails` call row currently exposes previews and collapsed raw JSON, but has no committed job progress or owner-checked retained-output reader. The smallest change is an Agent-owned inline report component on the corresponding call row, using the existing ProductStore query hooks and the concrete shared job reader/clear command once those exports exist.

Owned files: new `features/agent/ui/AgentJobReport.tsx`, minimal `AgentRunDetails.tsx` and `executionActivity.css` integration, and `tests/agentJobsUi.test.ts`. The storage, lifecycle, producer, source-runner, ownership/spec/discovery and Git owners remain with the other assigned agents/main. No new tool scheduler, Stop control, provider request, drawer, modal navigation, bubble caption or success toast.

Read state must carry the complete requested thread/run/call/project/job/page identity, reject retained foreign values, and keep missing/error/unpublished/cleared distinct. Clear uses the same shared authorization command, respects readOnly and a synchronous pending guard. Progress reflects committed counts only. Report content renders as plain text with bounded pages and safe existing source links; technical JSON remains collapsed.

## Final implementation / FREEZE

The concrete storage exports existed before consumer imports were connected. `AgentJobReport` queries the unique call candidate, then calls `readAgentJob({threadId, projectId, original: {runId, callId}}, jobId, tx)` inside the same readonly ProductStore snapshot. Every result captures its requested identity; the presentation checks both that envelope and the returned row's thread/run/call/project/kind. Scope keys reset only this local reader, preserving the execution/composer owner. The historical `original` identity is never confused with the model read tool's `caller`, and `call.result` display JSON grants no access.

The real `AgentRunDetails` call row mounts the report outside its own folded details and technical JSON. Media progress shows only committed completed/selected counts and the latest three acknowledged observations. Stopping waits for the producer's real status; stopped/failed/unknown retain checked coverage and explicit unexamined count. The existing invocation Stop remains the only Stop action.

Normal web accepted/running/completed states add no 0/1 count or preparation caption; retained output supplies the useful report entry. Web exceptions preserve truthful local-stop/service-may-have-run wording. Existing `WebResearchSources` remains the source-link owner; its producer-owned bounded decoder is outside this UI slice. No second source decoder or arbitrary report HTML/link renderer was added.

Opening the report mounts an authorized local page reader with the shared 6,000-unit bound. Its envelope includes original owner, job, output revision and offset, and a matching page must also carry the expected job/revision/offset. Previous/next use only acknowledged page offsets. Collapse releases that reader; reopening reads the first saved page without dispatch. Plain `<pre>` text preserves content and does not execute HTML/images. Empty, unavailable, unpublished unknown and cleared are distinct.

Clear calls `clearAgentJobResult` with the same historical reader and the fixed store. A synchronous ref excludes two clicks before React commits disabled DOM; readOnly omits the mutation control. The original call result is not rewritten by the UI. Pending completion is scoped to its mounted owner, with StrictMode setup restoring its lifetime. Unknown clear acknowledgement keeps the synchronous quarantine and exposes read-only reconciliation, while known failure makes no assertion that storage/content is still readable. Both failure forms offer a fresh read. There is no success toast or new modal/drawer/navigation.

Minimal styles use the existing theme, 12px type, wrapping controls/text, bounded vertical report scrolling and a 390px fixture host. Native buttons keep keyboard semantics, expanded/control IDs and existing focus styles; the text viewport is focusable. This is source/DOM evidence, not actual pixel-layout or native-keyboard acceptance.

## Necessary verification

All commands used `/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/node` directly. No default/freshness runner, wrapper, build, packaging, install, native executable, live provider or Git mutation was used.

```sh
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/node node_modules/vitest/vitest.mjs --config vitest.studio-source.config.ts run tests/agentJobsUi.test.ts
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/node node_modules/typescript/bin/tsc -p tests/typecheck/tsconfig.studio-agent-source.json --noEmit --pretty false
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/node node_modules/eslint/bin/eslint.js packages/studio/src/features/agent/ui/AgentJobReport.tsx packages/studio/src/features/agent/ui/AgentRunDetails.tsx --parser-options '{"project":["./tests/typecheck/tsconfig.studio-agent-source.json"]}' --no-inline-config
```

- Final UI fixture at 21:20:22 local: **1 suite / 8 tests PASS, exit 0**, 1.29s; no unhandled errors. Actual ProductStore commands admit/start/checkpoint/stop/publish/clear and actual readonly StoreTx queries create the state. Observer delivery is held outside transactions to exercise loading and stale/drop boundaries; no query hook or job reader/clear command is mocked. StrictMode is used for the standalone reader cases. Only unrelated rich/review children are replaced for the actual `AgentRunDetails` integration assertion.
- Assertions cover committed progress before/after delivery, actual stopped partial/unexamined report; progress outside real folded call/technical detail; quiet web accepted/running/completed; exact multi-page Unicode/plain-HTML text, previous/next, held old page, collapse/reopen; old topic/call and foreign matching-envelope row rejection; actual project-relation loss; readOnly; two same-act pre-render clears, held write, original history/chunk preservation; actual transaction-bound read/page faults and retry; rollback after chunk removal, uncertain acknowledgement after actual commit, explicit read reconciliation; unknown/unpublished/cleared/deleted output and ignored display JSON. All UI/provider counters remain zero.
- Source `noEmit`: **PASS, exit 0** against the shared explicit Studio source project after final product source changes. The last fixture-only adjustment replaced two separately awaited clicks with two clicks inside one existing `act`; the final Vitest run above executes it. No production code changed after that type check.
- Both changed production TSX files scoped ESLint: **PASS, exit 0, 0 errors / 9 warnings**. Two warnings are visible in the new report (one nested ternary and OwnedJobReport complexity 31); seven are existing `AgentRunDetails` complexity/nested branches. No rule/debt suppression. Tests/root configuration are outside this source lint claim.
- Initial attempts were not acceptance: the first fixture used an invented media revision and jsdom Blob wrapper, causing the actual publication owner to correctly mark metadata changed; it now uses the actual `[filename,mime,size]` snapshot and native cloneable Blob. An attempted async interception of synchronous collection `where` produced one unhandled rejected promise; the fault was moved to the actual asynchronous transaction-bound `get`, preserving real failure reach without an invalid collection shape. Storage also owns the generated media report, so media assertions inspect its genuine per-item findings rather than expecting an arbitrary supplied report string. The first type check caught the parallel producer fixture's missing required connector protocol; that owner fixed it before final source types passed.

## Frozen UI inputs

| SHA256 | Path |
| --- | --- |
| `5d6e965c3e7803376efb6a835b5447baae789e09939b906a41a72b85e0314463` | `packages/studio/src/features/agent/ui/AgentJobReport.tsx` |
| `7cd9322caa70bf37537658417607f9a2edb4134747397bf63b50388b24967e7f` | `packages/studio/src/features/agent/ui/AgentRunDetails.tsx` |
| `972b8cb904d2641af9b3df33c1548a3912a227cd8b8a545af919793fd243e483` | `packages/studio/src/features/agent/ui/executionActivity.css` |
| `4b3f0544ae8bdf746bcbdbef0c833e93a5e028e84b72b018cefd4edca60c1d7b` | `tests/agentJobsUi.test.ts` |

Main owns the new private UI module's ownership/discovery registration, final combined source checks/architecture and canonical spec synchronization. This UI fixture does not establish the producer's held backend drain, real Web Locks/window teardown, native SQLite/process behavior, live Tavily, emitted/packed artifacts, actual browser 390px geometry, OS keyboard behavior or full application acceptance. Those remain with their actual owners/final batch gates. **Implementation-owner UI scope frozen at the checks above; the main follow-up below supersedes the two affected hashes.**

## Main integration follow-up

Main added a bounded, display-only decoder for the acknowledged `web_read`
`retention_unavailable` ledger failure when admission created no job. Its fixed
public cleanup guidance is shown inline instead of suggesting that a saved
report exists but is unavailable. It grants no report read/clear authority and
adds no successful preparation or progress label. A ninth actual-store DOM case
covers that seam with zero provider requests. The independent whole-scope
review records the final hashes and final nine-case result.

The first integrated nine-case run passed the new refusal case but exposed four
failures in actual retained page reads after storage's final descriptor update.
An absent `metadata` property remained an own `undefined` in the job descriptor,
while the original call's JSON omitted it, so exact integrity comparison rejected
valid output. This was assigned to the publication owner for canonicalization
and a real command regression; the UI fixtures and integrity guard were not
weakened. That failed run is not final acceptance evidence.
