# Agent topic reads and reading navigation

## 1. Scope / Trigger

Read before changing Agent topic query loading, departure eligibility, following scroll or return-to-latest controls. Follow [Hook Guidelines](./hook-guidelines.md), [Chat Performance](./chat-performance.md), [Interaction Feedback](./interaction-feedback.md), [Agent Send Recovery](./agent-send-recovery.md) and [Agent Execution Feedback](./agent-execution-feedback.md). Preserve the mounted Agent/composer and in-workspace business details.

## 2. Signatures and owners

AgentChatPage keeps inline readonly ProductStore queries with explicit requested identity: message reads return `{forThreadId: string | null, messages: ChatMessage[]}`, run reads `{forThreadId: string | null, runs: AgentRun[]}` and current-topic compaction reads the corresponding `{forThreadId, compactions}` envelope. The querier captures the requested ID in the same invocation as its actual read. No generic query-hook retention policy changes.

`useThreadDeparture(threadId, runs)` filters exact current-thread rows before both blocking and executing predicates. `MessageList` receives explicit topic identity through ChatWorkspace and owns its viewport/following refs plus a local paused boolean. Reading does not acquire or release runtime ownership.

## 3. Contracts

Treat an unmatched retained result as undefined/loading, including a retained empty array. Only a matching successful empty result means an empty topic. Match requested identity and then filter returned rows by thread. Use those owned values for all parent consumers: departure, retry, current run, project locks, attention/task state, transcript and inspector. A matching messages result may render while runs are pending. Never attach today's active ID to yesterday's result after the query, turn errors into empty success or remount the execution owner to clear data.

Keep real current running/approval/resumable-tool departure confirmation and its existing cancel/confirm/single-use bypass. Foreign rows do not produce a current-thread block or reset its leaving state. Returning from an in-workspace detail or to the latest output is local reading and never requests departure or abort.

A confirmation's armed bypass belongs to that topic and the work it covered. Clear it on actual topic change so a previously confirmed A departure cannot silently approve the first B departure. When an owned topic starts executing again after the confirmed work stopped, reset both old leaving and armed state; a failed navigation/create/delete cannot leave permission for the new execution. A repeated router callback for the same confirmed navigation must still avoid asking twice; test these cases through the real hook.

Keep the existing 300px bottom threshold, instant `scrollTop = scrollHeight`, content ResizeObserver and bounded initial animation frame. Refs decide following synchronously. React stores only a transition boolean local to the transcript; no root scroll offsets or per-token effects. Manual rail/activity/disclosure pauses following, streaming/resize while paused does not move the reader, and returning within the existing threshold can resume. New user message identity resumes following; observation replacing an optimistic user row with the same reserved ID does not.

The deferred thread-entry animation-frame snap also checks current following intent. If the user pauses before that frame executes, the old scheduled snap cannot move the reader afterward.

Explicit topic identity stays stable across E02's provisional/durable handoff and does not derive from whether the first message has loaded. A genuine topic change resets following as before. Do not alter workspace/composer keys to implement scrolling or add per-topic reading-position persistence in this scope.

Show one native icon button only while paused, horizontally centered within the current conversation navigation shell and immediately above the measured composer-safe area. Use a compact circular surface with a decorative downward arrow and accessible name `返回最新`; keep the label available to assistive technology without a visible text pill. Center within the chat column when a business detail is open, and preserve the same center on narrow screens. The owner selected this placement from the second reference image on 2026-10-15; do not anchor the action to the page’s right edge. Activation restores following, instantly snaps and moves keyboard focus to the viewport with `focus({preventScroll: true})` before removing the focused button. Native Enter/Space and touch behavior suffice. Ordinary resize/streaming must not steal focus. No toast, unread counter or status narration is needed.

## 4. Validation & Error Matrix

| Situation | Required behavior |
| --- | --- |
| A nonempty or empty result retained while B read is held | B stays loading; no A transcript/run action or false B empty state |
| B empty read successfully observed | Real empty B presentation |
| Retired A observer publishes late | Existing query cleanup and envelope keep B unchanged |
| Foreign running row supplied to departure for B | No fabricated B confirmation |
| Actual B running/approval/resumable tool work | Existing explicit departure confirmation and bypass preserved |
| Reader scrolls outside bottom threshold / uses rail | Pause, show one return action, preserve position during content growth |
| Return action activated | Immediate snap, renewed follow and deliberate viewport focus |
| Same reserved user ID becomes durable | No new-turn scroll reset or duplicate bubble |
| A genuinely new user ID or topic arrives | Existing intended follow/reset behavior |
| Read fails | Existing error boundary/recovery; never an invented empty result |

## 5. Good / Base / Bad Cases

Good: switching from empty A to held B shows B loading, while the still-mounted execution/composer retains its correct owner. Base: a paused reader uses a native return button to snap and continue following. Bad: filter a cached array into empty B, block B departure because A was running, or reset the reader whenever the array length changes during canonical acknowledgement.

## 6. Necessary verification

Use actual supplied ProductStore observer queries with controlled delivery outside transactions. Cover A-to-B held, empty A-to-pending B, observed empty B and stale A completion. Exercise parent action consumers and the real departure hook, including genuine confirmation/cancel/bypass and resumable work.

Use actual MessageList ReactDOM with controlled geometry and ResizeObserver for paused growth, rail/activity pause, return activation/focus/renewed following, same-ID acknowledgement and explicit topic changes. Preserve E01 mounted detail, E02 quiet fallback/canonical IDs and E03 Stop/DOM probes. Controlled DOM geometry is not a browser layout claim. Run only necessary affected tests/types/lint/architecture under the owner's batch cadence; broad/native/build acceptance stays distinct.

## 7. Wrong vs Correct

Wrong: infer requested identity from the first result row, or pass cached A arrays into B action guards and rely on child filtering. Reset reading from every message-array or assistant-text update.

Correct: capture requested identity inside each query, derive owned data once before all consumers, enforce thread ownership again at departure, and keep reading intent in local synchronous refs with a single actionable return control.
