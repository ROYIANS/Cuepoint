# Review E03 – agent-execution-feedback (9e3b8dcb)

Targeted tests run: `e03ExecutionFeedback, e03ExecutionPresentation, e03RuntimeFeedback, agentExecutionService` → 4 files / 35 tests pass [test]. (B07 stop/held-compat cases from E02 run are cited as E03 evidence: `b07ComposeSessions.test.ts:438,458,476,492,510,521`.)

## Verdict
Careful, conservative implementation. The disposition for AC4 ("no overlay") is verified against code: no live-text overlay exists (`rg overlay features/agent` only hits dialogs/topic navigation) [code]. Phases are fed from real runtime boundaries (`runChat.ts:74,91,95,98,111`), controller is bounded and failure-isolated. No P0/P1. The main weaknesses are that AC3 "measurement" is produce-only with no reading/export path, and a per-delta DOM sampling cost before the first confirmed checkpoint.

## AC map
| AC | Status | Evidence |
| --- | --- | --- |
| AC1 quiet preparation; accurate waiting after actual request | Met | Phases `ExecutionFeedbackPhase` `executionFeedback.ts:4`; `waiting_model` only on `requestInvoked`, emitted from the wrapped fetch (`runChat.ts:89-92`), not on prepare; `SubmissionStatus` shows nothing for preparing (`SubmissionMessage.tsx:30`); tests `b07…:429,476`, `e03RuntimeFeedback.test.ts` [test]. |
| AC2 Stop immediate, idempotent, lock kept until settlement | Met | `requestStop` guard `executionFeedback.ts:235-242`; service `requestStop` `agentExecutionService.ts:~348-356` (sets `stopping`, aborts, publishes before settlement) and `finally` releases only after operation `done` (`:~158-163`); tests `b07…:438,458,521`, `agentExecutionService.test.ts:41,106,199` [test]. Copy: single "正在停止…" (review.md finding 3). |
| AC3 distinct first-received vs first-displayed | Partly met | Marks `firstPublicReceived` vs `firstPublicCommitted` separate with signature gating (`executionFeedback.ts:251-259`), `e03ExecutionFeedback.test.ts`, `e03ExecutionPresentation.test.ts` [test]. But measurements go only to private `performance.mark/measure` (`:112-135`); nothing reads them, no harness collects, and `submitted` is stamped at `feedbackOwner.begin` (`:221`, in `claim`), not at the click handler; the PRD's "click" boundary is therefore "invocation start". No latency number was ever recorded (results doc admits it). |
| AC4 conditional disposition | Met | No overlay code; checkpoints/persistence behaviour untouched; `output` events deliberately ignored (`:208-210`). |

## Findings

### P2-1 Public-commit sampling does DOM/CSS work on every delta until the first confirmed checkpoint
`usePublicOutputCommit` (`ExecutionFeedback.tsx:39-70`) lists `text` in its effect deps (`:67-68`). Once `invocation`, `snapshot.runId` and `assistantMessageId` match (`:47-48`) – i.e. from the first delta – each text change re-runs the layout effect, which calls `check()` (walks all ancestors with `getComputedStyle`, `visible()` `:28-37`) and, when not yet satisfied, creates a new `MutationObserver` and attaches it to the element **and every ancestor up to `html`** (`:61-64`). `publicCommitted` returns false until `received` + a *checkpoint* confirmation exist (`executionFeedback.ts:251-256`), so for the whole pre-checkpoint window every streamed token pays ancestor-chain style reads + observer churn. The results doc says "no computed-style sampling after first commit" (true) but not before. Impact depends on checkpoint cadence; not measured [claim-only]. Suggest gating on `snapshot.outputRevision > 0` (a confirmed checkpoint exists) before sampling.

### P2-2 AC3 has no collection path; "measure" is unobservable by tests or users
`timing` is `performance` User Timing only (`executionFeedback.ts:86`); there is no export, dev panel, or test-time reader other than the unit tests injecting a sink. R3/AC3 says measured deltas are "recorded"; the delivery records *capability*, not data. Acceptable under owner's "no latency claim", but the roadmap premise for E03-R4 ("evaluate overlay only if measurements justify") can never fire without a follow-up that collects. Also clearing: traces are capped at 8 (`:217`), so a user measuring a long session loses earlier traces.

### P3-1 `preparing` re-emitted every model step (`runChat.ts:74` in `prepareContext`) and `setPhase` ignores same-phase only; after each tool round the phase briefly flips to `preparing` before `waiting_model`. Quiet by design, but the state machine docs call `preparing` a first-turn notion.
### P3-2 `visible()` treats `opacity === "0"` on an ancestor as hidden (`ExecutionFeedback.tsx:33`) – this deliberately cooperates with E01's narrow-mode hiding (ancestor opacity), good seam; but it also means any CSS fade-in animation starting at opacity 0 delays the "displayed" mark (benign, sparse marks are by design). No test crosses E01's hidden-conversation fixture with E03 sampling [code].
### P3-3 `observedFetch` is installed only when `feedback` exists (`runChat.ts:89-92,~106`). When feedback is present and `fetchImpl` is undefined, `selectedFetch = runtimeFetchFor()` is passed explicitly, so the transport no longer uses its own default fetch path; results doc/review say policy preserved; transport tests cover both protocols [test], but I could not confirm the desktop native-fetch path with this wrapper (native acceptance deferred) [claim-only].
### P3-4 Signatures are a 32-bit FNV hash + length (`:62-65`); collision only mis-times a diagnostic, acknowledged in the code comment. Fine.

## Claims vs code
- "At most eight traces / 136 entries": 8 × (10 marks + 7 measures) = 136, matches `MarkName` (10) and `intervals` (7) [code].
- "Zero content/ID in timing names": names are `cuepoint.agent.<owner>-<n>.<mark>` (`:215`) [code].
- "Historical activity steps excluded": historical steps rendered without identity per review.md finding 4; tested in `e03ExecutionPresentation.test.ts` [test].
- "Stop does not release lock/rewrite status": controller only mutates presentation; lock is the service `finally` [code].
- Local-Vite "HTTP 200, no overlay" claim in results is not meaningful evidence of behaviour (module resolution only) — correctly labelled by the doc.
