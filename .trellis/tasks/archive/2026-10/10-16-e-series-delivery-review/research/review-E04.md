# Review E04 – agent-thread-reading (982dece3 + 8220faf5)

Targeted tests run: `e04AgentQueryDeparture, e04ReadingNavigation, e11ThreadReadingUi` → 3 files / 22 tests pass [test].

## Verdict
The reading/return-to-latest half (R3) is intact and well tested. The query-identity half (R1) was *re-implemented* by E11 (`readThreadTranscript`/`ThreadTranscript.tsx`), and the departure half (R2) was **removed** by E11 (`useThreadDeparture.tsx` deleted in fe4fcb59, no remaining references). The archived E04 PRD still presents AC1's departure clause as delivered; at HEAD it is superseded rather than met. No P0/P1. One P2 PRD/code drift item (a deliberate product change that is not reconciled in the archive), one P2 scalability note, several P3.

## AC map (against HEAD, not just the commit)
| AC | Status at 982dece3 | Status at HEAD | Evidence |
| --- | --- | --- | --- |
| AC1 B held → loading not false empty; departure checks never use A runs | Met | Partly met (loading Met; departure N/A) | Loading: `ThreadTranscript.tsx:24-27` (`state.value?.threadId === threadId` else `undefined` → `provisional(messages === undefined)` `:44` shows "正在加载对话…"), `readThreadTranscript` stamps `threadId` in the same snapshot (`queries/threadReading.ts:18-30`); tests `e04AgentQueryDeparture.test.ts:112,128,147` [test]. Control snapshot: `createThreadControl` is rebuilt per `threadId` (`threadReading.ts:77-79`) so A's runs cannot leak. Departure: original change `useThreadDeparture.tsx` (ownedRuns filter) is gone; test `e04AgentQueryDeparture.test.ts:162` now asserts *no* execution-only blocker is installed. |
| AC2 keyed-workspace protection intact; no remount of execution owner | Met | Met | Identity filter at read (`threadReading.ts:20-23` per-thread `where("threadId")`); execution owner is the application service (`agentExecutionService.ts`), not remounted per thread. |
| AC3 reading stable, keyboard/touch return to latest | Met | Met | `MessageList.tsx:75-83,177-180` native `<button aria-label="返回最新">`, `resumeFollowing` + focus list; tests `e04ReadingNavigation.test.ts:101,116,128,135,150,157,173` [test]; centred circular control `turnNavigation.css:13-30` per 8220faf5. |

## Findings

### P2-1 PRD/AC drift: E04-R2/AC1 "genuine active-execution confirmation" no longer exists
E11 removed `useThreadDeparture` (`git log --diff-filter=D` → fe4fcb59) in favour of background retention; `tests/e04AgentQueryDeparture.test.ts:162` was rewritten to expect no blocker. That is probably the intended product direction, but E04's archived PRD/`task.json` still tick AC1 (departure) as satisfied and nothing in the E04 record points to its supersession. For a reader of the archive the claim "departure checks do not use A runs" is vacuous at HEAD. Remaining ownership logic lives in `threadReading.ts:44-75` (control) and `AgentChatPage.tsx:432` (`runBlocksThread` for status only). Recommendation: add a note in the archived PRD or the E11 record. (`commands/agentRuns.ts:103` still hard-blocks a second begin on an unfinished run, so execution safety itself is not weakened.)

### P2-2 Control snapshot stores a JSON key per publish (`threadReading.ts:51-53`)
`createThreadControl.publish` stringifies the entire snapshot (all runs for the thread) on every observed change to dedupe. With long threads (hundreds of runs) every message write during streaming re-runs 3 reads + stringify. The projection is finite and frozen, so correctness is fine; this is a scalability note only. [code]

### P3-1 Pause-by-scroll intent is a ref mutated across several handlers (`MessageList.tsx:65-66,133-150`): `manuallyNavigated` reset on wheel/touch/keys/scrollbar pointer, set by rail/activity navigation. Tests cover rail jump and disclosure (`e04ReadingNavigation.test.ts:157,173`), but there is no test for touch drag then *programmatic* growth (touchmove) — `onTouchStart` only resets, nothing observes `touchmove`; relies on the scroll event path. jsdom cannot show it [claim-only].
### P3-2 "No per-topic reading position" is intentional (PRD), so switching A→B→A always snaps to bottom (`MessageList.tsx:95-103`). Fine; listed so reviewers don't mistake it for a bug.
### P3-3 Button geometry (`turnNavigation.css:13-30`) depends on `--agent-chat-composer-safe` being set by `ChatWorkspace.tsx:73,94`; the 168 px fallback applies until the first dock measurement. No visual test (`8220faf5` review doc `button-placement-review.md` is the only evidence) [claim-only].
### P3-4 `onScroll` uses `isChatNearBottom` (300 px threshold, `presentation/chatScroll`); tests assert the threshold (`:128`) but not an unusually tall final message where the *tail* is off-screen though within 300 px — E11 already noted this (`e11ThreadReadingUi.test.ts:108`), so the E04 control can say "following" while the newest line is clipped. Interaction between E04's follow flag and E11's unread acknowledgement is correctly decoupled.

## Claims vs code
- "Inline requested-identity envelopes": implemented differently at HEAD (`readThreadTranscript` returns `{threadId,…}` and `ThreadTranscript` compares) – equivalent semantics, E04's inline `forThreadId` envelopes in `AgentChatPage.tsx` no longer exist (`rg forThreadId` empty).
- "Preserve parent execution/composer, no remount workaround": still true.
- "No per-topic position persistence": true.
