# Research: agent code defect and over-design audit

- **Query**: read-only audit of agent code (src/lib/agent, src/db/agent*, domain/agent, components/agent main files, tests)
- **Scope**: internal
- **Date**: 2026-10-13

(Written incrementally; sections appended as reading proceeds.)

## Section 1: runChat.ts / AgentChatPage.tsx / chatExecutionFlows.ts / useChatExecutionSession.ts (read)

Line numbers are for the files as of this audit.

Candidate findings (status in final table below):
- AgentChatPage.tsx:277-283 `commitRename` has no try/catch; called as `void commitRename()` (L655, L663). updateChatThread rejection = unhandled rejection, dialog stays open, no toast.
- AgentChatPage.tsx:224-251 discoverConnectorChatModels(...).then(...) has no .catch; if it rejects (not resolves with ok:false) catalog stays status "loading" forever (probingModels stays true). Needs check of discoverConnectorChatModels.
- AgentChatPage.tsx:258-270 handleNewTopic aborts abortRef unconditionally, then openThread aborts again (L123) -> duplicate; createChatThread failure after abort leaves the running run aborted with no new topic.
- AgentChatPage.tsx:290-318 commitDelete: for the current thread sets deleteTarget undefined then re-sets in remove(); if the task departure guard is declined, the delete dialog is silently dismissed (state lost); flicker.
- chatExecutionFlows.ts:48-60 executeNewChatMessage creates a thread before lock; if aborted right after (L58 `if aborted return`) an empty thread is left behind (no cleanup).
- AgentChatPage.tsx:470 vs :422 two independent "latest run" computations (`runs.filter(...).at(-1)` vs `runs.at(-1)`), plus showRunStatus status list (L471) duplicates statuses elsewhere (AgentComposerAttention, taskState).
- AgentChatPage.tsx:61-63 `boardRuns = db.agentRuns.toArray()` loads every run (with requestMessages etc.) for the board.
- AgentChatPage.tsx:130-163 routedThread query duplicates the threads list query (3 sources for activeThread), routedThreadPending logic L434-438 has redundant clause `routedThread.forId===activeThreadId &&`.
- AgentChatPage.tsx:165-171,613-614,636 messages/runs queried by threadId then filtered by threadId again in 4 places (defensive duplication).
- AgentChatPage.tsx:325-381 handleSend / handleRetry / handleRunAction share the same acquire/try/toast/release scaffold x3 (L325-417).
- chatExecutionFlows.ts:166-176 resolveChatRunAction: approve/reject decision persisted, then `outstanding` count; if sendLock is held handleRunAction returns early (AgentChatPage.tsx:402) so approvals clicked during a running send are silently dropped (no toast).
- runChat.ts:99-229 executePendingTools is 130 lines, 2 loops that each re-validate the same call (validateToolCall + toolMetadataMatches + requiresToolApproval twice, L125-135 and L175-182).
- runChat.ts:239-353 executeChatRun: writer created twice (L260, L279); ordering of refreshRun* x5 each re-reading the run from DB per loop (L269-274); toolSchemas(getOfferedToolNames(run)) computed 3x per iteration (L272,275,300).
- runChat.ts:343-351 catch block: `controller.abort()` then finishAgentRun; markRunningToolsUnknown/finishAgentRun themselves can throw inside catch -> original error lost, executeChatRun rejects with storage error; AgentChatPage toast shows that message.
- runChat.ts:350 error message redacts apiKey via split/join but only for message text; if apiKey is "" (empty) split("") explodes message into characters joined with "[已隐藏]". Confirm connectors require key.
- runChat.ts:316-322 final reply: saveAgentFinishingCheck -> `continue` loop with no separate cap other than MAX_MODEL_STEPS (startModelStep).
- runChat.ts:308: `controller.signal.aborted || (!result.ok && result.aborted)` finishes as "interrupted" if run.hasToolCalls else "cancelled"; catch-block at L350 uses `latest?.hasToolCalls` (fresh read) while L309 uses `run.hasToolCalls` (possibly stale until saveToolRound refresh) -> two different sources for same decision.

## Section 2: runOwnership.ts / db/agentRuns.ts (read)

- runOwnership.ts:24-31 withThreadRunLock runs recoverAbandonedGenerationBatches + interruptThreadRuns on EVERY lock acquisition (send, retry, approve/reject, cancel, resume), so approving a call runs a whole-thread recovery pass each time. interruptThreadRuns (agentRuns.ts:209-235) only touches status==="running" runs; safe because lock is held, but cost + coupling: recovery logic lives in the lock helper.
- runOwnership.ts:35-51 recoverAbandonedRuns: scans ALL running runs, ALL running batches, and ALL toolCalls with a filter() full-scan (`repairableCalls`, L39) on every window focus and every AgentChatInner mount (AgentChatPage.tsx:179-186). Full-table scan of agentToolCalls per focus.
- runOwnership.ts:46 `ifAvailable:true` with `if (lock)`: when another tab holds the lock the thread is skipped silently (intended).
- agentRuns.ts:41-47 canRetryRun: sorts runs and messages per call (O(n log n)); is called in useMemo (AgentChatPage.tsx:422) AND again inside beginAgentRun (L81) -> two sources of truth for "retryable" (UI + DB), OK but duplicated sort logic.
- agentRuns.ts:166-168 DEAD BRANCH: `protocol: previous?.protocol ?? (previous?.hasToolCalls ? "chat-completions" : selectAgentProtocol(...))`. canRetryRun returns false when run.hasToolCalls, so `previous.hasToolCalls` is always false when previous exists; and previous.protocol is always set on stored runs. Only the selectAgentProtocol path is reachable for new runs.
- agentRuns.ts:104-111,139-142 retry path carries ~12 `previous ? previous.X : ...` forks inside one 150-line function (beginAgentRun L56-202), mixing new-send and retry. `input.createTask` (L95) - check callers (see tool section).
- agentRuns.ts:75 transaction over `db.tables` (all tables) and, inside it, awaits getMemorySelection / selectReferenceContext / getTaskContext; if any of them awaits a non-Dexie promise (fetch/crypto/timers) the IDB transaction auto-commits and subsequent writes throw TransactionInactive. NEEDS RUNTIME VERIFY (suspicious).
- agentRuns.ts:222-243 recordAgentModelMetrics: silently returns if run.status!=="running" (L224) so metrics of a step finished after cancel are dropped silently; and in runChat.ts:307 the call happens BEFORE the aborted check, so throw "模型用量所属步骤无效" inside try -> run marked failed (catch L342) rather than cancelled if step numbering mismatches. Edge only.
- agentRuns.ts:178-200 finishAgentRun overwrites assistant message with `{...output, status, error}`. executeChatRun resets `accum = createReasoningAccum()` at the start of each model step (runChat.ts:278). If step N>=2 aborts/fails before its first delta, finishAgentRun writes output() = empty content/reasoning over the visible text of step N-1 (saved by saveToolRound with output()). Result: assistant message text disappears on abort/failure at step 2+ before first token. SUSPICIOUS (verify by test: tool round then stop before the next delta).
- agentRuns.ts:192-199 finishAgentRun returns silently for runs not running/waiting (idempotent) but the caller (runChat.ts:350) then `throw`s only if saveFailed; no signal to the caller that the final state was not written.
- agentRuns.ts:188 `messageStatus` map has 4 entries; message statuses ("pending","streaming","complete","error","aborted","interrupted") are set in 3 places (beginAgentRun L193 "streaming", finishAgentRun, interruptThreadRuns L225 "pending") -> run status vs message status is maintained by hand in each writer, no single transition function. Pending vs running mapping: waiting_approval run <-> message "pending"? (check agentTools.pauseForApproval).

## Section 3: db/agentTools.ts (read)

- agentTools.ts:300-322 cancelAgentRun writes run/message terminal state by hand and does NOT go through finishAgentRun, so it skips the `finalReview pending -> unverified` fix-up (agentRuns.ts:199) and doesn't touch "running"/"unknown" calls or compaction records. Second hand-written terminal-state writer (3 total: finishAgentRun, cancelAgentRun, pauseAtModelStepLimit + interruptThreadRuns). Low severity (finalReview is only pending near completion).
- agentTools.ts:300-302 cancelAgentRun throws "请先停止正在运行的执行" for status=running; UI (AgentChatPage handleRunAction) returns early if sendLock held (L402) with no toast -> clicking "结束执行" while a send is in flight silently does nothing.
- agentTools.ts:28-30 canResumeAgentRun includes status "failed" (when hasToolCalls) while canRetryRun (agentRuns.ts:41) excludes hasToolCalls: two predicates that partition the same status space; beginAgentRun refuses new sends in that state (agentRuns.ts:79) -> user must resume or cancel. Confirmed design, but 3 predicate sites (canRetryRun, canResumeAgentRun, beginAgentRun inline `runs.some(...)`) encode the same "run is blocking the thread" rule.
- agentTools.ts:88-94 getOfferedToolNames imported from domain/agentToolSelection, while runChat imports it via lib/agent/toolLoading re-export (toolLoading.ts:12-14) -> pointless re-export layer.
- agentTools.ts:40-54 / :68 requireLatestRun loads ALL runs and ALL messages of the thread (toArray) for each approve/resume/review action; O(thread size).
- Status literal `["completed","failed","rejected"].includes(call.status)` is re-inlined: runChat.ts:110,170,172; agentTools.ts:57(pauseAtModelStepLimit),:262(appendToolResults); toolLoading.ts:`settled`. No shared `isSettledToolCall`.
- agentTools.ts:318 cancelAgentRun leaves status "unknown" calls untouched, OK by design (documented elsewhere).
- agentTools.ts:353-358 executeAtomicTool: wraps EVERY error (including AbortError from signal.throwIfAborted L355/L363) into AtomicToolRollbackError with certainty "rolled_back"; runChat.ts:211-213 then writes the call as "failed" with a failed result the model will see on resume ("rolled_back"), so a user Stop during an atomic tool becomes a model-visible tool failure instead of an interrupted/pending state. Plausibly intended; flagged suspicious.

## Section 4: ChatWorkspace.tsx / MessageList.tsx (read)

- MessageList.tsx:172 every AgentChatMessageItem runs its own `useProductQuery(agentToolCalls where runId)` (one live query per assistant message, including long-finished history runs) -> N live queries per thread; plus L138 `runs.find(...)` per message (O(n*m)). Performance, not correctness.
- MessageList.tsx:239-264 hand-written memo comparator with ~25 fields. Omits `message.referenceContext`, `run.activitySteps`, `run.plan`, `run.finalReview`, `run.memoryAudit/modelMetrics`; correctness relies on every run writer bumping `run.updatedAt`. recordAgentModelMetrics (agentRuns.ts:249-253) updates modelMetrics/usage/outputTokensPerSecond WITHOUT bumping updatedAt (comparator compensates for usage fields explicitly, but modelMetrics-only changes would be missed). Fragile; SUSPICIOUS.
- MessageList.tsx:74-89 two layout effects (threadKey, lastUserId) both snap-to-bottom and reset follow flags; on first mount both run (duplicate).
- MessageList.tsx:174 `processOwnsContent = run.status==="running" || isPersistedToolRound(...)` + L187 showCopy + L188-191 text: a second, independent derivation of "what does the message display" from (run.status, message.status, content); AgentRunDetails (AgentRunDetails.tsx) separately interprets run.status again. Three status-interpretation sites in the UI (AgentChatPage.tsx:471-541 showRunStatus, MessageList statusLabel L193, AgentRunDetails, AgentComposerAttention).
- MessageList.tsx:193 statusLabel only maps error/interrupted/aborted; message status "pending" (waiting_approval) has no label here (handled in AgentRunDetails). OK.
- ChatWorkspace.tsx:114-115 "与助手一起开始" calls composer.onChange(...) which REPLACES any text the user already typed in the draft.
- ChatWorkspace.tsx:109 uses `messages?.length === 0` to show task-empty state; AgentChatPage passes `messages.filter(...)` (a new array every render -> MessageList props churn; AgentChatPage.tsx:613-614 `runs.filter` too), defeating memoization of upstream props (children are memo'd per item so impact is low).
- ChatWorkspace.tsx:66-68, 70-80: ResizeObserver mutates parent's style imperatively (column.style.setProperty); `dock.classList.contains("is-expanded")` reads DOM class that React owns -> coupling; low.

## Section 5: FloatingComposer.tsx (read, 493 lines)

- FloatingComposer.tsx:142-493 single component with ~25 props destructured, owns: send shortcut persistence (localStorage), speech recognition lifecycle, drag/drop/paste handlers, project-gate dialog state machine (`projectAction`: "import" | "library" | File[], effect L186-193), expanded-mode keyboard rules. ESLint complexity 48 / cognitive 35. ModeSwitch (L56-101) and InteractionModeSwitch (L103-143) are two near-identical Dropdown wrappers (duplicate code).
- FloatingComposer.tsx:261-274 `canSend` uses the `sending` PROP (React state set after acquire); real re-entrancy guard is `sendLockRef` in AgentChatPage.handleSend (L329). Between click and re-render a second Enter can call onSend again but is rejected by sendLockRef -> OK (no defect), but two layers encode the guard.
- FloatingComposer.tsx:359-367 voice button is `disabled={sending}` but not `blocked`; `trySend` refuses while `listening` -> if user dictates and presses Send nothing happens, no feedback (silent no-op). Minor UX defect.
- FloatingComposer.tsx:~395 modelWarning uses hard-coded inline color "#e0b878" (not themed).
- Speech `onresult` (L236-239) rebuilds `speechBaseRef + transcript` and overwrites draft via onChange; safe because textarea is readOnly while listening.
- Props are forwarded as `{...composer}` from AgentChatPage's 50-field `composerProps` object built inline every render (AgentChatPage.tsx:490-586) with ~12 inline arrow handlers -> FloatingComposer is never memoizable; every keystroke re-renders the whole AgentChatInner (99 complexity) including re-filtering messages/runs.

## ESLint/vitest data (secondary evidence)

- `pnpm exec eslint src/lib/agent src/components/agent`: rule counts: no-nested-ternary 142, complexity 55, sonarjs/cognitive-complexity 38, preserve-caught-error 3, only-throw-error 2, max-depth 2.
- Top complexity (cyclomatic / cognitive): wrapupEvidence.collectWrapupSnapshot 95/148; runChat.executePendingTools 61/101; AgentChatInner 99/58; generationProfiles.profileRequest 68/96; TaskWrapup 75/51; imageDiscovery.discoverProjectImages 43/66, sourceState 48/45; GenerationConfigurationFields 74/29; contextCompaction.prepareRunContext 41/45; generationRuntime.submitClaimedGeneration 29/49; executeChatRun 40/51; memoryTools handler 49/41; ContextUsagePanel arrow 61; MessageList item 59 / memo comparator 57; executionSummary.describeRunExecution 44/45.
- `pnpm exec vitest run tests/agent` (35 files matching tests/agent*): 628 passed, 0 failed. So every finding below is NOT contradicted by an existing test.

## Section 6: AgentControls.tsx, tools.ts, contextCompaction.ts, finishing/final review, dead code scan (read)

- AgentControls.tsx:33-60 `useAgentSettings` is instantiated twice per composer (AgentControls L63 and ComposerPlusMenu L111), each with its own mount effect calling getGeneralAgentConfig() (a read-write transaction, L37-39) and its own `saveLock`. Writes are transactional in agentSettings.ts (updateGeneralAgentConfig), so no lost update; but double init + two independent "saving" states.
- AgentControls.tsx:196-234 search-result panel is a hand-written regex router (`/导入|上传|.../`, `/资料|项目|.../`) duplicated in the "no match" fallback condition (L230-231); adding an entry requires editing 3 places.
- AgentControls.tsx:41 `catch {` in save() discards the real error (toast generic "保存助手设置失败"); no logging.
- tools.ts:96-122 `toolSchemas` and `validateToolCall` call `assertUniqueToolNames(registry)` and then `registry.find` (linear) on EVERY call; runChat invokes toolSchemas 3 times per model step (runChat.ts:272,275,300) and validateToolCall twice per call.
- Dual schema definitions: `defineTool({schema: zod, json: {...hand-written JSON schema}}, ...)` used in tools.ts:43-76 (planSchema + JSON twin), and in generationTools(4), referenceTools(4), audioGenerationTools(4), webTools(2), materialTools(2), audioTools(1). Two sources of truth that can drift (no test asserts equivalence found in this audit).
- contextCompaction.ts:151-158 catch block rethrows `new Error(errorText)` without `cause` (eslint preserve-caught-error), so the original error class is lost; runChat.ts:351 and taskWrapup.ts:73 same pattern.
- runChat.ts:323-337 / agentTools.ts saveToolRound L119: a model-requested tool name that is not registered (`throw new Error("未知工具")`, runChat.ts:325) or not offered this round (agentTools.ts `模型请求了本轮未提供的工具`) throws before any tool row is saved -> the whole run ends as "failed" instead of returning a tool error to the model (invalid ARGUMENTS, by contrast, are recorded and fed back, runChat.ts:126-133). No test for these strings found in tests/ (grep).
- runChat.ts:81 `throw failure` of unknown type (eslint only-throw-error); runChat.ts:351 `throw new Error("执行或本地保存失败...")` drops the original storage error (no cause).
- Final review (runFinalReview.ts) adds a second model request of up to 30 s (REVIEW_TIMEOUT_MS) before `finishAgentRun("completed")` (runChat.ts:318-320): the run stays "running" with the answer already streamed; users perceive hang; not a bug (Stop works via signal), but latency/cost on every completed run. Metrics for it are recorded under a separate step (tests agentUsage/agentFinalReview assert 3 metrics) -> my initial suspicion that dedupe by `step` drops them is REFUTED.
- Test-only exports (no src importer; only tests): AUDIO_GENERATION_TOOL_NAMES (audioGenerationTools.ts:243), generationJobSchema (generationProfiles.ts), listTaskGenerationSources (db/agentTaskRecords.ts), MAX_VISIBLE_TURNS (chatTurns.ts), planSchema (tools.ts:36 re-used only in-file + tests), isCharacterSlot (businessTools.ts:957), createRunWriter (runChat.ts:48, in-file use + tests), frozenGeneration (db/agentGenerationBatches.ts). Unused type exports: ToolEffectCertainty, ToolRecoveryCode, RunActivityItem, RunExecutionSummary, ChatTurn, ContextPreviewRead, TaskInput, etc.
- Pass-through / single-importer layers: tiny name-list modules ipToolNames.ts (1 line), webToolNames.ts (1), audioMusicToolNames.ts (2), materialToolNames.ts (6) each exist only for skills.ts; toolLoading.ts:12-14 re-export of domain/agentToolSelection used by runChat only; paired lib+db files with one importer: finalReviewEvidence.ts<-db/agentFinalReview.ts, finishingCheck.ts<-db/agentFinishingCheck.ts, wrapupEvidence.ts + wrapupSchema.ts<-db/agentTaskWrappups.ts, memoryContext.ts / runFinalReview.ts <- runChat.ts only.
- runWriteOutcomes.ts:14-27 permitsEntry hard-codes a tool-name -> receipt-kind table (~16 `if (name === ...)`), a third registry of tool names parallel to skills.ts and *ToolNames.ts.
- businessTools.ts (1075 lines) natural cut lines already present as const arrays: helpers L1-440 (readTool/writeTool/previews), reads L441, projectTools L538, episodeTools L649, beatTools L707, shotTools L731, assetTools L785, reuseTools L880, mediaTools L983, plus a slot-guard block L953-981. Single importer (tools.ts).

## FINAL: Severity-ordered findings

"Confirmed" = established by reading the code path (not executed). Existing agent tests: 35 files / 628 tests pass, so none of these is currently caught. No test file covers AgentChatPage, chatExecutionFlows, useChatExecutionSession, MessageList, FloatingComposer or AgentControls (grep of tests/ found only source-scanning checks). "Test cov" below refers to that.

### A. Confirmed defects

| id | sev | file:line | symptom | trigger | suggested fix | test cov |
|---|---|---|---|---|---|---|
| D1 | High | runChat.ts:323-337; db/agentTools.ts saveToolRound (~L119) | Whole run fails ("未知工具"/"本轮未提供的工具") instead of the model receiving a tool error | Model emits an unregistered or not-yet-loaded tool name (common with load_tool_groups flow) | Record the call as failed with a structured error and continue, as already done for bad arguments (runChat.ts:126-133) | none |
| D2 | Medium | AgentChatPage.tsx:119-127, 258-270, 301; useChatExecutionSession.ts:17,19-21 | Switching topic, new topic, unmounting the page, or deleting aborts the in-flight run with no confirmation; run becomes interrupted/cancelled (tool runs then block new sends until resumed or ended, agentRuns.ts:79) | Click any other topic while a reply streams | Confirm before leaving, or let the run continue in background (lock is per thread already) | none |
| D3 | Medium | AgentChatPage.tsx:277-283, 655, 663 | Rename failure is an unhandled rejection; dialog neither closes nor toasts | updateChatThread rejects (storage error) | try/catch + toast like other handlers | none |
| D4 | Medium | AgentChatPage.tsx:241-251 | `discoverConnectorChatModels().then` has no catch; a rejection (not `ok:false`) leaves catalog "loading" forever (probingModels true, send disabled warnings) | Network layer throws instead of returning a result (verify in connectors.ts transports) | add .catch -> status "error" | none |
| D5 | Medium | AgentChatPage.tsx:290-318 | Delete dialog state is cleared then re-set; if the task departure guard is declined, the confirmation is silently dropped | Delete current thread while TaskInspector has unsaved draft guard | Keep deleteTarget until remove() runs or is cancelled | none |
| D6 | Low | AgentChatPage.tsx:401-404, 383-385 | Approve/reject/cancel clicks silently ignored while sendLock held (no toast) | Click during any in-flight execution | toast or disable buttons via `busy` | none |
| D7 | Low | chatExecutionFlows.ts:48-60 | Empty orphan thread left behind when aborted right after createChatThread; beginAgentRun failure after navigate leaves new empty thread holding the draft | Stop/topic switch within the first ms of sending from home; "此对话已有执行" error | Delete the thread on abort before first run, or create lazily inside beginAgentRun transaction | none |
| D8 | Low | agentRuns.ts:166-168 | Dead branch `previous?.hasToolCalls ? "chat-completions"` (canRetryRun forbids hasToolCalls) | n/a | remove | n/a |
| D9 | Low | agentTools.ts:300-322 vs agentRuns.ts:178-200 | cancelAgentRun bypasses finishAgentRun, so pending finalReview not set to unverified; message/run terminal state written by 4 separate code paths | Cancel a run whose finalReview is pending (rare) | route through one `settleRun()` | partial (agentRuns/agentTools tests) |
| D10 | Low | FloatingComposer.tsx:~326 trySend; ChatWorkspace.tsx:114-115 | Send silently does nothing while dictating; "与助手一起开始" overwrites user's typed draft | Click send during speech input; click start button with text in the box | feedback toast / append instead of replace | none |
| D11 | Low | runChat.ts:350 vs 309 | Interrupted vs cancelled decided from two sources (`latest?.hasToolCalls` fresh read vs `run.hasToolCalls` possibly stale after saveToolRound refresh) | Abort during first tool round persistence | single helper reading fresh run | partial |

### B. Suspicious / need runtime verification

| id | sev | file:line | concern | how to verify |
|---|---|---|---|---|
| S1 | Medium | agentRuns.ts:75 (+ getMemorySelection / selectReferenceContext / getTaskContext inside) | One all-tables rw transaction wraps helpers that may await non-Dexie promises (TransactionInactive) and blocks every other writer while it runs | Test beginAgentRun with a large reference set / slow memory retrieval; check for TransactionInactiveError |
| S2 | Medium | agentRuns.ts:178-186 + runChat.ts:278 | After a tool round, a failure/abort in model step N>=2 before first delta calls finishAgentRun with empty output, overwriting message.content/reasoning of step N-1 (UI hides content via processOwnsContent for tool runs, so may not be user-visible) | Unit test: tool round -> abort before next delta -> inspect chatMessages row |
| S3 | Low | MessageList.tsx:239-264; agentRuns.ts:249-253 | memo comparator depends on run.updatedAt; recordAgentModelMetrics, activity writers that skip updatedAt may not re-render rows | Render test with a modelMetrics-only update |
| S4 | Low | executeAtomicTool agentTools.ts:353-358 | AbortError turned into AtomicToolRollbackError -> call stored as "failed" with a model-visible failure result on user Stop | Stop during an atomic tool; inspect call status/result after resume |
| S5 | Low | runChat.ts:350, contextCompaction.ts:159 | apiKey redaction via split/join is a character explosion if apiKey is "" (beginAgentRun rejects empty keys, so only theoretical) | n/a |
| S6 | Low | runOwnership.ts:39 | recoverAbandonedRuns scans all agentToolCalls with filter() on every window focus and mount | Measure with 10k+ tool calls |

### C. Concurrency walkthrough (re-entrancy / cancel / retry)

- Re-entrancy guard is sound: `sendLockRef` + epoch token in useChatExecutionSession.acquire/release (L22-36), plus thread Web Lock (runOwnership.ts:24) plus DB-level check in beginAgentRun (agentRuns.ts:79). Three layers encode the same invariant; none was found to be broken. Release is token-checked so a late finally cannot unlock a newer execution.
- Cancel: Stop = AbortController.abort -> executeChatRun catch (runChat.ts:342-351) -> finishAgentRun; writer failure path aborts via onWriteFailure. Ordering `writer.flush()` before finishing is correct.
- Retry: canRetryRun (UI) and beginAgentRun re-check (DB) agree; retry blocked for tool-bearing runs by design (resume path instead).

### D. Duplicate / contradictory state predicates

1. "Run blocks the thread": agentRuns.ts:79 inline, canRetryRun (L41), canResumeAgentRun (agentTools.ts:28), AgentChatPage.showRunStatus (L471), AgentComposerAttention, taskState.getTaskDisplayState.
2. "Tool call settled": `["completed","failed","rejected"].includes` inlined in runChat.ts:110,170,172; agentTools.ts (pauseAtModelStepLimit, appendToolResults); contextCompaction.ts:~84; toolLoading.ts `settled`.
3. "Latest run": AgentChatPage.tsx:422-425 vs :470 vs agentTools.requireLatestRun (loads all runs+messages).
4. Run vs message status mapped by hand in beginAgentRun, finishAgentRun, pauseForApproval, pauseAtModelStepLimit, resumeAgentRun, cancelAgentRun, interruptThreadRuns (7 writers, no single transition table).
5. getOfferedToolNames reachable via two import paths (domain/agentToolSelection and lib/agent/toolLoading re-export).

### E. Top 5 complexity hotspots to clean first

1. runChat.ts executePendingTools L99-229 (cyclomatic 61, cognitive 101): two passes re-validating the same call; split into classify/preview/approve phase and claim/execute/settle phase, extract a shared "settle tool outcome" helper (L198-224).
2. AgentChatPage.tsx AgentChatInner L59-698 (cyclomatic 99): extract useThreadActions (new/rename/delete), useModelCatalog (L219-256), useSendFlow (handleSend/Retry/RunAction share one acquire/try/toast/release scaffold L325-417), composerProps builder (L490-586), RunStatusStrip (L539-545), and the dialogs (L640-695). Also drop the triple thread sources (threads list, routedThread, messages/runs re-filtered 4x).
3. wrapupEvidence.ts collectWrapupSnapshot L36 (cyclomatic 95, cognitive 148) + generationProfiles.ts profileRequest L91 (68/96): per-kind tables instead of nested if/ternary chains (no-nested-ternary count: wrapupEvidence 11).
4. businessTools.ts (1075 lines): split by the existing arrays (reads / project / episode / beat / shot / asset / reuse / media + helpers) into a businessTools/ folder; single importer tools.ts so blast radius is small. Also collapse hand-written JSON-schema twins (zod + json in 7 tool files) to generated schemas.
5. runChat.ts executeChatRun L239-353 (40/51) together with agentRuns.beginAgentRun L56-202 (~150 lines, ~12 `previous ? previous.X :` forks mixing new-send and retry) and the run/message terminal-state writers (D-4): introduce one `settleRun(status)` and split beginAgentRun into buildNewRun / buildRetryRun.

Honourable mentions: TaskWrapup.tsx (cyclomatic 75), GenerationConfigurationFields (74), ContextUsagePanel (61), MessageList item+comparator (59/57), imageDiscovery.discoverProjectImages (43/66), generationRuntime.submitClaimedGeneration (29/49), memoryTools handler (49/41).
