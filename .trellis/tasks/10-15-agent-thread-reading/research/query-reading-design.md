# Research: Owned topic reads and return to latest

- Query: Identify the smallest E04 change that distinguishes requested-topic loading from an observed empty result, scopes departure decisions, and exposes an accessible return-to-latest action without disturbing execution, optimistic send or retained detail views.
- Scope: internal; upcoming E04 preparation only. The active task remains E03. No source, task metadata or spec changes; no tests, browser, network or builds run.
- Date: 2026-10-15

## Findings

### Files found and relevant contracts

| File | Responsibility / evidence |
| --- | --- |
| `packages/studio/src/platform/product/queries.ts:5–48` | ProductStore observation intentionally retains its previous successful value during dependency reload; retired observers cannot publish after cleanup. |
| `packages/studio/src/features/agent/ui/AgentChatPage.tsx:147–205` | Routed-thread lookup already returns an ownership envelope; messages and runs still return bare arrays; departure receives the unowned run result. |
| `packages/studio/src/features/agent/ui/AgentChatPage.tsx:617–620` | Retry eligibility currently reads the latest bare run and all bare messages/runs before child filtering. |
| `packages/studio/src/features/agent/ui/AgentChatPage.tsx:709–742` | Project lock, composer attention, task display and run status consume these query values. |
| `packages/studio/src/features/agent/ui/AgentChatPage.tsx:823–859` | Keyed workspace and row-level filters already protect transcript/inspector rendering; E02 owns a stable provisional presentation key. |
| `packages/studio/src/features/agent/ui/useThreadDeparture.tsx:25–82` | Both blocking and executing predicates currently inspect every supplied run; confirmation and its single-use navigation bypass already have one owner. |
| `packages/studio/src/features/agent/models/agentToolSelection.ts:11–13` | `runBlocksThread` deliberately includes running, approval, and resumable interrupted/failed tool work. Preserve this policy. |
| `packages/studio/src/features/agent/ui/ChatWorkspace.tsx:18–20,91–134` | Rich transcript remains lazy; eager submission fallback distinguishes `undefined` from `[]`, with a real task-empty view only for observed emptiness. |
| `packages/studio/src/features/agent/ui/MessageList.tsx:58–108,115–157` | Refs own following intent; resize snaps only when pinned; user turn resumes; rail/activity/disclosure navigation pauses. No return action yet. |
| `packages/studio/src/features/agent/presentation/chatScroll.ts:1–20` | Existing 300px threshold and direct `scrollTop = scrollHeight` policy. |
| `packages/studio/src/features/agent/ui/TurnNavigation.tsx:31–55,129–138` | Rail measures DOM, owns its own active state, pauses following before an instant scroll. |
| `packages/studio/src/features/agent/ui/agentChat.css:756–813` | Message viewport already reserves composer space; the bottom composer/mask has its own stacking order. |
| `packages/studio/src/features/agent/ui/turnNavigation.css:1–20` | Positioned navigation shell is the appropriate local owner for a small reading control. |

Related specs read: `.trellis/workflow.md`, `.trellis/spec/studio/frontend/index.md`, `.trellis/spec/frontend/hook-guidelines.md`, `chat-performance.md`, `agent-activity-ui.md`, `agent-business-details.md`, `agent-send-recovery.md`, and `interaction-feedback.md`. The E04 PRD requires read identity, owned departure and return-to-latest; the parent's explicit scope excludes per-topic reading-position persistence. The feedback spec reflects the owner's 2026-10-15 correction: ordinary successful messages have no additional send/hydration captions. This change needs only the existing transcript loading fallback and one actionable reading control.

### 1. Requested identity must survive an empty read

`useProductQueryState` retains state between subscriptions (`queries.ts:17–41`). Its cleanup prevents a retired A observer from publishing, but the last successful A value is still returned during B's pending read. That is deliberate adapter behavior, not a generic query-hook defect.

At `AgentChatPage.tsx:187–199`, both messages and runs are bare arrays. The workspace's current `filter(row.threadId === activeThreadId)` removes A's rows, but converts B's still-pending result into `[]` (`:832,836`). Empty A results are inherently indistinguishable from an empty B result. `ChatWorkspace.tsx:120–134` consequently can show an empty/task-start view while B has not been read.

Keep the queries inline and give each success an explicit request identity, including the home/null request and a successful empty result. A concrete minimal shape is:

```ts
const messageRead = useProductQuery(async tx => {
    const forThreadId = activeThreadId ?? null;
    return {
        forThreadId,
        messages: forThreadId
            ? await tx.chatMessages.where("threadId").equals(forThreadId).sortBy("createdAt")
            : [],
    };
}, [activeThreadId]);

const messages = messageRead?.forThreadId === (activeThreadId ?? null)
    ? messageRead.messages.filter(message => message.threadId === activeThreadId)
    : undefined;
```

Use the same shape for `runRead: {forThreadId: string | null; runs: AgentRun[]}` and derive `runs` only after matching. Capture the identity in the same query invocation as the read; do not attach the currently selected ID later in a render/effect or read it through a mutable ref. `undefined` means no successful result for the requested identity, matching `[]` means an observed empty topic, and matching nonempty results retain the existing row-level ownership filter. There is no need for a new generic adapter, a separately exported query helper, an imperative effect fetch, or a remount.

Replace the raw-array variables with these owned derivatives before **all** consumers: departure (`:205`), retry (`:617–620`), current run (`:671`), task goal (`:683`), project lock (`:713`), composer attention (`:720`), task state (`:735`), workspace (`:832,836`) and inspector (`:858–859`). Gating only the transcript would leave stale run eligibility and navigation decisions in the parent. Matching messages may render while runs are still pending; do not invent an all-queries-loaded page gate.

The existing routed-thread envelope and positively created E02 hydration bridge remain as-is (`:147–185,629–635`). Preserve `ChatWorkspace`'s current key expression (`:824`), eager fallback, reserved-ID canonical join and the retained execution owner. No changing of the parent `AgentChatPage` key or keying it by query readiness.

Adjacent narrow boundary: the bare `contextCompactions` result at `:195` can also carry A's running compaction into B's running label (`:742`). If the final E03 implementation still consumes it for a topic-specific label, apply the same envelope locally to that query. Coordinate this with the completed E03 code; do not redesign its execution controller or expand E04 into diagnostics.

### 2. Departure needs a local ownership check as well

`useThreadDeparture.tsx:29` assigns `activeRef` from every supplied run. Its `executing` value at `:38` also ignores `threadId`, so a foreign run can both cause confirmation and reset confirmed-leaving state. The parent envelope removes the observed route-switch case; the hook should still enforce its own explicit thread contract:

```ts
const ownedRuns = threadId ? (runs ?? []).filter(run => run.threadId === threadId) : [];
activeRef.current = ownedRuns.some(runBlocksThread);
const executing = ownedRuns.some(run =>
    run.status === "running" || run.status === "waiting_approval");
```

Keep the `runBlocksThread` policy, confirm/cancel callbacks, task-draft guard ordering and one-use bypass. `openThread` already asks for confirmation before the task inspector's draft guard and only then aborts/navigates (`AgentChatPage.tsx:207–220`). A real owned running/approval/resumable tool run must continue to require the existing confirmation. A pending B read is not evidence of an A run in B; do not borrow cached A data to manufacture a guard. This scope does not add a new route-loading blocker or a second execution owner.

Returning to latest or returning from E01's right-hand/full-width detail view is reading inside the current workspace. Neither action calls departure, abort or `armOnce`.

### 3. One local following hook and one small action are sufficient

Current following behavior is already suitable: `MessageList.tsx:60–65` uses immediate refs; resize only snaps when pinned (`:99–108`); wheel/touch/scroll distinguish manual reading (`:115–132`); rail/activity/disclosure calls pause following (`:95–97,117,121,157`). Preserve the 300px threshold, direct scroll assignment, content ResizeObserver and one bounded RAF on thread entry. Do not add smooth scrolling, per-token effects, timers, a root scroll-position state or per-topic reading-position storage.

The smallest change is a private `useChatFollowing` hook (or same-file local extraction) owning these existing refs/effects and a boolean `followingPaused`. Its interface can expose `listRef`, `contentRef`, `pauseFollowing`, `resumeFollowing`, and the existing viewport event handlers. Refs remain authoritative inside callbacks. Update React state only when the paused/following value actually changes, rather than storing every scroll offset or publishing it to `AgentChatPage`. The existing memoized message rows remain intact; a separate global state system is unnecessary.

`MessageList.tsx:67` currently infers `threadKey` from the first returned message. Use an explicit requested conversation identity instead of deriving ownership from row presence: pass a private `threadId` prop from `ChatWorkspace` to `MessageList`, using `activeThreadId` and, during the E02 provisional handoff, the owned submission's reserved `threadId`. This identity remains the same when the local user bubble joins its durable counterpart. The normal thread-change reset still applies; it is not reading-position persistence. Do not alter the workspace/execution owner key.

Preserve `lastUserId` derived from `submissionTranscript` (`:69–93`): a new user turn intentionally resumes following, while acknowledgement/canonical replacement of the same reserved user ID must not resume a reader who paused. Do not change that dependency to array length, run state or the latest assistant text. Resize while paused must leave `scrollTop` unchanged, including while E01 details are open.

Render one native `<button type="button">返回最新</button>` when following is paused. Put it inside the existing positioned navigation shell, above the composer-safe area, without covering the rail, last readable line or composer. Reuse local theme/focus-visible conventions; no toast, status row, unread counter, popup or live-region announcement is required. Its text supplies its accessible name; an additional `aria-label="返回最新消息"` is acceptable if consistently tested.

Activation performs one synchronous intent change, then an instant snap: clear manual-navigation intent, set pinned/following true, clear `followingPaused`, and call `snapChatToBottom(list)`. The next content resize continues following. A native button handles touch and keyboard Enter/Space. If activation removes the focused control, place focus on the message viewport with `tabIndex={-1}` and `focus({preventScroll: true})` before hiding it, so keyboard focus is not dropped to the document body. Do not steal focus on ordinary resize, streaming or pause/resume caused by scrolling.

Manual rail/activity navigation remains a stronger pause until new scroll intent or explicit return; ordinary scrolling back within the existing 300px threshold can resume as today. Button visibility follows this same local pause state. There is no reading control needed in the small eager-only fallback while the rich transcript is loading; keep lazy loading intact.

### 4. Necessary tests and useful existing seams

| Targeted check | Existing seam / meaningful assertions |
| --- | --- |
| Actual query ownership across A → B | Follow `tests/shotDetailQueryLifecycle.test.ts:20–41,55–89`: capture `db.observe`, execute its supplied query in a real readonly `StoreTx`, and control observer delivery. Hold B, assert existing loading fallback rather than task/empty state, no A transcript/run actions, then deliver an empty B envelope and assert the real empty result. Include A-empty → B-pending; row filtering alone cannot pass that case. Retired A delivery remains ignored. |
| Parent callback regressions | `tests/b07ComposeSessions.test.ts:49–56,128–148` supplies indexed query results; update message/run mocks to envelopes and retain real callback tests. `:397` already verifies pending routed ownership; add the requested message/run read case rather than weakening that gate. Retry/project lock/composer attention must not inspect a foreign retained run. |
| Departure owner | Add a small actual hook harness with controlled `useBlocker` to exercise both `request` and `shouldBlockFn`: A running supplied while thread B does not block; B running/approval still blocks; cancel stays; confirm invokes departure once and consumes only the existing bypass. `tests/agentRunDefects.test.ts:59–75` already covers the shared status predicate, but cannot by itself prove hook ownership. Include interrupted tool work to preserve its current policy. |
| Actual reading behavior | Extend the actual `MessageList` DOM setup in `tests/agentMessagePresentation.test.ts:66` with controlled scroll geometry and a captured ResizeObserver callback. Scroll outside 300px, assert return button and unchanged position on assistant-content growth; activate the native control, assert instant snap, focus and renewed following on the next resize. Cover rail/activity pause and one keyboard/touch path through native activation. |
| Optimistic join / cold fallback | Retain `tests/e02SubmissionPresentation.test.ts:80–105`: exact eager echo, lazy load held, canonical observation once, same composer DOM owner, no ordinary success captions. Add only the pause → same-ID acknowledgement case if touched by the following extraction. |
| Existing pure geometry | Keep `tests/chatScroll.test.ts` boundary/snap checks. They support threshold math but do not replace DOM ownership/following checks. |

Use deterministic held observation delivery, not a promise held inside a database transaction. This prevents a test from depending on transaction idleness. Run only affected focused suites and necessary type/lint checks under the parent's stage cadence; no broad integration/build/native/paid validation is needed for this research scope. The existing E01 retained-scroll assertions in `tests/contextPanelDom.test.ts:89–105` are available if the reading-shell implementation changes that layout path, rather than justification for unrelated full regression runs.

## External references

None needed. This recommendation is derived from the current source and project contracts; no external library/API changes are proposed.

## Caveats / Not Found

- Line evidence is from the E02-committed tree with E03 workers active on 2026-10-15; inspect their final completed source before applying adjacent composer/phase edits. Do not overwrite the E03 controller or revisit phase-timing design in E04.
- No browser, test, build or native measurements were performed. The geometry/focus plan above is a concrete implementation recommendation, not a claim of verified pixels or measured performance.
- No new owner-level product decision is required within the dispatched scope. Existing following threshold/new-turn behavior stays; topic-position persistence is explicitly excluded; the native return control uses existing UI conventions.
- Existing source alone does not prove a durable current B run is present before its query resolves. E04 fixes attribution of observed values; it does not invent a replacement execution/admission authority or asynchronous navigation framework.
