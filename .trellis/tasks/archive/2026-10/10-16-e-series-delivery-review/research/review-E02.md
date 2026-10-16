# Review E02 – agent-optimistic-send (447a9fb7)

Code reviewed at HEAD (`codex/agent-background-host`). Note: since E02 the send flow moved from `ui/chatExecutionFlows.ts` (deleted) into `runtime/agentExecutionService.ts` (E03/E11); the E02 semantics were carried across, so findings are against the current owner.
Targeted tests run: `agentAdmission, e02SubmissionPresentation, b07ComposeSessions` → 3 files / 71 tests pass [test].

## Verdict
Strong delivery. Identity preallocation, create-only admission, positive-only reconciliation, whole-draft-revision restore and "never replay a paid request" are implemented and covered by real-store tests. No P0/P1. One concrete P2 regression-class bug (retry drops model metadata), one P2 dead-end for `uncertain`, and a few P3.

## AC map
| AC | Status | Evidence |
| --- | --- | --- |
| AC1 exact payload next render while creation/compat/begin held; no transient text beside bubble | Met | `AgentChatPage.tsx:330-345` consumes composer then `agentExecution.submit` (service publishes attempt synchronously in `claim`, `agentExecutionService.ts:121-130` area); `SubmissionStatus` returns null for preparing/accepted (`SubmissionMessage.tsx:30`); tests `b07ComposeSessions.test.ts:536,236`, `e02SubmissionPresentation.test.ts:85,114` (ReactDOM) [test]. Paint is only "two rAF + 80 ms fallback" (`chatSubmissionAttempts.ts:1-11`), i.e. DOM commit not compositor paint — E02's own doc says so. |
| AC2 new-topic transfer without remount/abort/duplicate | Met | Same `entry.controller` across `createChatThread` → navigate → begin (`chatExecutionFlows` at 447a9fb7:71-128; now service `send`), `destinationReserved`; tests `b07…:236,256,294,339,348` [test]. |
| AC3 pre-admission failure recoverable; restore never overwrites newer draft; same-tick duplicates one intent | Met | Restore by whole-draft revision `AgentChatPage.tsx:356-358`; tests `b07…:551,559,566,536,381` [test]. |
| AC4 lost ack → reconcile; no auto duplicate/paid request | Met | `readAgentAdmission` only `accepted` is positive (`agentAdmission.ts:56-83`); `recordSubmissionFailure` (`agentExecutionService.ts:~200-210`) only reads; retry requires `failed` and re-checks first (`:~215-224`); tests `b07…:573,585,636`, `agentAdmission.test.ts` (18 real-store cases), `agentExecutionService.test.ts:238` [test]. |
| AC5 cold rich transcript / home→thread hydration keep provisional content | Met | `SubmissionTranscriptFallback` (`SubmissionMessage.tsx:43-54`), `visibleSubmissionAttempts` identity de-dup (`chatSubmissionAttempt.ts:34-37`); `e02SubmissionPresentation.test.ts:61,69,85` [test]. |
| AC6 retry/restore don't change later drafts; Stop pre-admission recoverable | Met | `b07…:438,650,551`; `agentExecutionService.ts:166-170` Stop before dispatch → failed [test]. |
| AC7 focused tests/type/lint/independent review | Partly met | Test counts reproduced; lint reported 19 warnings; independent review claim-only (no artefact besides the results doc). |

## Findings

### P2-1 Explicit retry drops `modelMetadata` – retried run is sent with different capacity/vision rules
`AgentChatPage.tsx:361` calls `agentExecution.retrySubmission(identity)` without `modelMetadata`, and `ChatSubmissionAttempt` (`models/chatSubmissionAttempt.ts:9-27`) does not store it (only `submit` receives `catalogMatches ? modelCatalog?.metadata?.[modelValue] : undefined`, `AgentChatPage.tsx:344`). `beginAgentRun` uses it for `resolveVisionCapability` (`commands/agentRuns.ts:91`) and `resolveContextCapacity` (`:151`). Result: the first send and an explicit retry of the *same frozen attempt* can freeze different context capacity / image capability, and image attachments may be refused or truncated differently on retry. The service signature accepts `modelMetadata` for retry (`agentExecutionService.ts:255`) but no caller supplies it; no test covers it (`rg retrySubmission tests` shows only throw-paths). Fix: freeze metadata on the attempt (like connector identity) or recompute with the same catalog check.

### P2-2 `uncertain` is a dead end with no user-level exit
When creation/begin ack is unknown and the admission read returns `absent`, phase stays `uncertain` forever (`agentAdmission.ts:56-58` doc, `checkAdmission` `agentExecutionService.ts:~326-332`). Restore and retry are only offered for `failed` (`SubmissionMessage.tsx:34-37`, `handleSubmissionAction` `AgentChatPage.tsx:355`), and `dismissAttempt` refuses `uncertain/checking` (`agentExecutionService.ts:~371-373`). The user can only copy text from the bubble and keep clicking 核对发送状态. This is the PRD's conservative choice ("only positively matching accepted records resolve"), and the results doc discloses it, but there is no "I confirm it wasn't sent / discard" path and no test of the UX endpoint. Also, lost attempts are local-only, so a reload clears the attempt and the user's text (acknowledged out of scope).

### P2-3 Orphan empty thread on failure-then-restore
For a new topic, `createChatThread` commits before `beginAgentRun` (`chatExecutionFlows` 447a9fb7:74-86; `onThreadReady` stores `createdThread`). If begin fails and the user chooses 恢复到首页草稿 (`SubmissionMessage.tsx:36`), the attempt is removed (`AgentChatPage.tsx:357`) but the created `chatThreads` row remains with title derived from the text. No cleanup/test references this [code]. Low data risk, but pollutes the topic list.

### P3-1 `createChatThread` preallocated id + `add`: a duplicated create returns ConstraintError rather than idempotent success (`commands/chat.ts:37`). Retry avoids it via `createdThread`, but a lost creation ack with an *actually created* thread leaves attempt `uncertain` (see P2-2) rather than adopting the thread.
### P3-2 Frozen attempt keeps `ReferenceAttachment` array and `createdThread` via `structuredClone` each patch (`agentExecutionService.ts:57-76`): O(patches × attachments) work and a `Object.freeze` deep-clone on every `patchAttempt`; fine at current sizes.
### P3-3 `yieldSubmissionPaint` adds up to 2 frames (≈32 ms) / 80 ms fallback latency to every send before any model/IO work; intentional, but undocumented in the spec as a UX budget.
### P3-4 Lint: reported 19 complexity warnings in changed files; `AgentChatPage.tsx` grew by 229 lines in this delivery and is now the main coordination hub (handleSend/handleSubmissionAction inline).

## Claims vs code
- "No schema/shared-core/provider protocol change": diff stat shows only studio agent files + tests + `quality/studio-ownership.json` [code].
- "Attempts are local presentation, not ProductStore messages": true (`chatSubmissionAttempt.ts:8` doc; no persistence) [code].
- "Zero replay": `retrySubmission` requires `failed` + positive absent read (`:~215-224`); b07 test `:573,585` [test].
