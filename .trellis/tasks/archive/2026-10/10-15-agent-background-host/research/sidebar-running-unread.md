# Research: Sidebar running state and durable unread acknowledgement

- Query: Trace the actual topic navigation, transcript reading and Agent ledger, then propose the smallest truthful running/unread projection for E11 without token-driven sidebar/root rendering or unsafe read acknowledgements.
- Scope: internal; source and existing executable specifications only. This is planning research, not an implementation or platform acceptance report.
- Date: 2026-10-16
- Task: `.trellis/tasks/10-15-agent-background-host/`.
- Confirmed product requirements: trailing loading indicator like the supplied screenshot; unread indicator; different conversations may execute concurrently; leaving a conversation does not require stopping it; desktop application remains resident after closing its sole product window; macOS and Windows; browser support where practical.

## Findings

### 1. Current source owners and the actual gaps

| File | Responsibility / finding |
| --- | --- |
| `packages/studio/src/features/agent/ui/AgentChatPage.tsx:73` | Queries all `chatThreads` ordered by `updatedAt` in the active page. This is currently title/order metadata, not a run/unread projection. |
| `packages/studio/src/features/agent/ui/TopicSidebar.tsx:53` | The sidebar accepts `ChatThread[]`, projects and action callbacks. It has no running/read-state input or subscription. |
| `packages/studio/src/features/agent/ui/TopicSidebar.tsx:290` | `TopicRow` is a noninteractive row with sibling title, rename and delete buttons. The right side is currently relative time, replaced by actions on hover/focus. |
| `packages/studio/src/features/agent/ui/AgentTopicNavigation.tsx:8` | Thin bridge constructing the same `TopicSidebar` used in the workspace. |
| `packages/studio/src/features/agent/ui/ChatWorkspace.tsx:87` | Supplies sidebar metadata/actions and lazily mounts only the requested transcript. Composer expansion makes the transcript hidden/inert at lines 118–119. |
| `packages/studio/src/features/agent/models/chat.ts:11` | `ChatThread` has title, connector/model, ownership and timestamps. No read marker or public-output revision. |
| `packages/studio/src/features/agent/models/chat.ts:31` | `ChatMessage` has content/status/reasoning and optional run ID. No revision tying the rendered snapshot to a read acknowledgement. |
| `packages/studio/src/features/agent/models/agent.ts:108` | `AgentRun` is the frozen input, checkpoint, activity and status ledger, with substantial context. Loading every run body into the sidebar is unnecessarily expensive. |
| `packages/studio/src/features/agent/ui/MessageList.tsx:59` | Owns local synchronous following refs, manual navigation intent, scroll element and return-to-latest UI. This is the correct owner of “reader is following the latest output.” |
| `packages/studio/src/features/agent/ui/ExecutionFeedback.tsx:12` | Existing visibility probe checks connected DOM, document visibility, inert/aria-hidden/hidden ancestors, computed visibility and actual text rectangles. It acknowledges only the first public output of an invocation for feedback timing; it is not a durable read receipt. |
| `packages/studio/src/platform/product/queries.ts:7` | Observations retain the previous successful result while dependencies change, and publish each observation through React state. There is no semantic equality suppression. |
| `packages/studio/src/platform/storage/native.ts:65` | Native invalidation is row/key/predicate based, not changed-field based. Reading a whole run row and selecting just its status in JavaScript still re-queries on its checkpoint changes. |
| `packages/studio/src/platform/storage/browser.ts:124` | Browser observation uses a real Dexie live query; a new shared `subscribe` implementation must not replace this with local-only notifications and lose other-tab changes. |
| `packages/studio/src/platform/storage/schema.json:191` | Current thread indexes are `projectId`/`updatedAt`; messages index `threadId`/`createdAt`. All non-index metadata remains in the row value. |

There is no existing Agent unread/last-read model to extend. Searching the source/specs found no durable `lastRead`, `readRevision` or conversation unread contract. User messages, title changes, model changes and catalog/metrics updates must therefore be excluded explicitly instead of repurposing timestamps.

### 2. Why the existing timestamps/checkpoint cannot be unread state

- `commands/chat.ts:42–67` updates `thread.updatedAt` for title/model/interaction changes. Such changes are not new assistant output.
- `commands/agentRuns.ts:231–235` advances the thread timestamp at admission. It does not advance it for every public output or completion.
- `commands/agentRuns.ts:243–253` writes message output plus `run.checkpoint` and `run.updatedAt` together. This is a useful publication boundary, but the checkpoint is per run and excludes approval/terminal changes.
- `commands/agentRuns.ts:298–325` updates `run.updatedAt` for metrics alone; this must not create unread output.
- `commands/agentTools.ts:122–180` persists publicly rendered activity-step content in the run, rather than necessarily the message body. `pauseForApproval` changes the run and message at lines 200–206. Looking only at assistant text misses actionable changes.
- `commands/agentRunTerminalState.ts:19–59` is the sole terminal writer. This is the right boundary to publish completion/error/interruption visibility, including a failed run that produced no answer text.
- `packages/agent-core/src/checkpoint.ts:4–31` coalesces pending writes while a write is in flight, but has no fixed timer. Do not assume checkpoints are low frequency; a fast local store can commit at token frequency.

Keep running, attention and unread independent. A thread can have both ongoing generation and unread output. A parked approval is waiting for a decision, not proof that model/tool work is still progressing. A ledger row marked running after a crash is not proof of a live owner. The E11 host handshake/reconciliation must establish ownership before the row is presented as actively executing.

The main design has selected an application-level service in the retained sole main WebView, with close hiding that window and explicit Quit stopping the service. Under that choice, `hostSessionId` is the retained application service session, not a second store or a Node/worker process. No changes to public agent-core/provider APIs are needed for this projection. A WebView reload still retires its live execution authority and must use existing conservative recovery; hiding the window must not simulate page unload or dispose the service.

### 3. Recommended minimal data model

Use one typed, per-thread, device-local activity/read record in the existing `deviceSettings` table. This follows the existing storage contract that new device-local state adds a key, not a table. Do not put a map of all threads into one ever-growing setting.

Illustrative shape; final names belong in E11's design:

```ts
type ThreadActivityRecord = Readonly<{
  version: 1;
  threadId: string;
  publicRevision: number; // monotonic across all runs/resumes in this thread
  readRevision: number;   // monotonic; never exceeds publicRevision
  // Bounded by the existing 128 jobs/thread quota; independent original-result reads.
  reports?: readonly Readonly<{
    jobId: string;
    assistantMessageId: string;
    publicRevision: number;
    readRevision: number;
  }>[];
  latestPublication?: Readonly<{
    runId: string;
    assistantMessageId: string;
    kind: 'output' | 'activity' | 'approval' | 'terminal';
  }>;
  execution?: Readonly<{
    runId: string;
    hostSessionId: string;
    state: 'running' | 'stopping' | 'waiting_approval';
  }>;
}>;

type ThreadNavigationActivity = Readonly<{
  threadId: string;
  busy: boolean; // validated current owner executing or draining
  waitingApproval: boolean;
  unread: boolean;
}>;
```

`execution` is a projection of the real E11 owner/ledger, never an independent execution authority. The sidebar consumes only a semantic projection after host reconciliation; it does not acquire a run, start recovery or recreate transport. Persisted host identity cannot prove a currently live process by itself.

Publish meaningful assistant updates in the same existing product transaction as their source rows: increment the thread's public revision and stamp the corresponding assistant public snapshot with that revision. A small `publicRevision` on the assistant `ChatMessage` is sufficient for message snapshots; run/activity-only publications must stamp the same assistant snapshot revision as well. This lets a delivered snapshot prove which revision was actually rendered. It cannot be reconstructed later by looking up the newest activity row.

Publication policy should be finite and explicit:

- New assistant content/reasoning or newly readable activity: advances public revision. Ignore identical checkpoint output and timing-only/metrics-only updates.
- New approval/required decision and terminal completion/failure/interruption: advance a revision once for the accepted transition.
- User admission, empty assistant placeholder, title/model setting changes, internal preview/credential/catalog operations and repeated no-op settlement: do not create unread.
- Read watermarks and ordering timestamps are separate. A read acknowledgement must not reorder the sidebar.

Exact additional E07/E10 report publication paths:

- `commands/agentJobs.ts:208–265`, `publishAgentJob`: accepted result publication writes result chunks, job and the original tool-call result in one transaction. Publish one public report revision there after the existing no-op/duplicate guards at line 233 and after the original owner/revision checks. Do not emit from the React report query or on every job progress count.
- Its `tables()` at line 27 currently lacks `deviceSettings`; add the table to the initiating scopes for this publication and any nested caller. Write the matching report cursor in the same transaction, using the accepted job/result revision and original assistant identity. A late known report may belong to an older run after the user already started a later one; the reader must not acknowledge it solely because the newest message happens to be visible at the bottom. Count that report as read only when its public report/summary is actually presented; otherwise retain its unread revision conservatively.
- `commands/agentJobs.ts:330–357`, `recoverAgentJobs`: the direct unknown transition at lines 347–348 also creates a new public required-attention state and needs the same publication helper. The stopped branches already call `publishAgentJob`; do not double-increment those.
- `mcp/runtime/executionOwner.ts:38–51` funnels original/late MCP results through `publishAgentJob`; the readback-only reconciliation at lines 54–67 reaches the same writer. No separate UI-side unread emission or invocation retry is necessary.
- Cleared/deleted report ownership continues to win. The new public cursor cannot recreate the deleted job/thread, restore a cleared result, authorize a model continuation or acquire a new MCP bearer.

Chosen recommendation for the late-report exception: keep original-result report cursors separate from the ordinary ordered assistant-output watermark, within the same small typed record (`reports` above). The existing E07 quota is 128 jobs per thread (`commands/agentJobs.ts:14–16`), so the set has a real bound. `publishAgentJob` advances only the matching report cursor; its actual visible public report summary acknowledges `{jobId, observedRevision}` for that original job. A normal tail acknowledgement must not consume an older report that updated outside the viewport. Derive sidebar unread as `readRevision < publicRevision || reports.some(report => report.readRevision < report.publicRevision)`. Drop a report cursor on the corresponding explicit clear/delete, and never duplicate its whole text/result. This closes the late historical-output gap without retaining an unbounded receipt/event log or changing public core/provider APIs. A newly visible approval/ordinary activity still uses the regular thread-output cursor, while E07's report result uses its exact original-result cursor.

Use the existing accepted `job.revision` as a report revision, not an unrelated clock. Normal progress changes alone do not publish unread; only accepted terminal/unknown result publication installs the matching revision in this small cursor. The report acknowledgement command takes `{threadId, jobId, observedRevision}`, validates the exact surviving original owner, and applies the same max/cap rule to that one report. The snapshot shown by `AgentJobReport` carries the observed job/result revision; opening a report with stale body/query data cannot acknowledge a newer result.

Use the existing exact owner and transaction predicates. A deleted thread cannot be recreated by late output or acknowledgement. Existing checkpoint and settle wrapper scopes currently contain only run/message tables in some lanes; expanding those calls to include `deviceSettings` is essential. Calling an ambient global setting helper from inside a narrower transaction would violate the explicit `StoreTx` contract.

For the setting key, use a bounded deterministic encoding of the exact ID. Normal `createId()` IDs are safe ASCII, but `assertChatSubmissionId` currently accepts IDs up to 256 characters with a broader alphabet (`models/chatSubmission.ts:10`). `deviceSettings` keys accept only `[A-Za-z0-9._:-]` and at most 128 characters (`features/settings/commands/deviceSettings.ts:5–9`). A naïve `prefix + arbitraryThreadId` is not a valid general contract. Use a namespaced SHA-256 over the UTF-8 encoding of **`JSON.stringify(threadId)`**, and validate the exact original `threadId` inside the value. JSON escapes isolated UTF-16 surrogates, whereas encoding a raw ID with TextEncoder can collapse them to U+FFFD. Prepare/cache the key before entering write transactions; do not introduce an awaited `crypto.subtle` operation inside a live Dexie transaction.

If the host design instead chooses small public metadata fields on `ChatThread`, it must provide a real field-filtered subscription outside the page and prove no token invalidation. The current query adapter cannot supply that optimization merely by returning `{status}`. The per-thread setting approach avoids that root dependency and changes fewer storage mechanisms.

### 4. Revision acknowledgement and the race it must close

Recommended command boundary:

```ts
acknowledgeThreadRead(input: Readonly<{
  threadId: string;
  observedRevision: number;
}>, store?: ProductStore): Promise<void>;
```

Inside one transaction, read the current thread and activity record; reject invalid/foreign IDs and invalid revision values; ensure `observedRevision <= current.publicRevision`; update only `readRevision = max(current.readRevision, observedRevision)`. A deleted/missing owner is a no-op or typed unavailable result, never permission to create it. A no-op acknowledgement performs no write.

Critical example: UI has painted revision 41; publication 42 commits before the ack transaction. Ack 41 may only produce `readRevision = 41`; revision 42 remains unread. Never implement “mark current thread read” by reading the latest revision inside the command and assigning that value. Duplicate and out-of-order acknowledgements cannot move the watermark backward or consume later publications.

Attach the observed revision to the immutable requested-topic snapshot delivered by the source query/host subscription. Do not obtain it from a separate latest query after render. If run/activity and message reads are separate snapshots, acknowledgement must be conservative and capped to the public snapshot actually represented by the visible transcript. Do not acknowledge a newly stamped approval revision before its corresponding current-run/action presentation has actually loaded. A combined small read envelope or matching publication cursor can establish that boundary without changing the generic query hook.

Keep monotonic producer/read state durable in the sole ProductStore. A renderer reload or sidebar unmount restores the same unread state. Reconnect first supplies an authoritative current snapshot and revision; event sequence gaps trigger a new snapshot, not replay of external calls. A missing/corrupt/unavailable read record is not evidence of “all read”; parsing/read failure must preserve an explicit unavailable/conservative state. The forgiving setting getter that returns `undefined` for every error is unsuitable for conflating corruption with a fresh zero watermark.

### 5. What is eligible to acknowledge

The active route alone is insufficient. The reading probe should require all of:

1. Matching current requested thread and current observer/attachment generation.
2. Successful current public snapshot, with its exact revision represented by committed DOM.
3. Visible, focused application/window and visible document. Native window hide/focus must participate; a retained Tauri WebView may remain mounted, and browser document visibility by itself is not a sufficient desktop hidden-window contract.
4. A visible, non-inert transcript with actual layout. Narrow full-width business details, expanded composer, narrow navigation overlay and modal isolation must not consume output behind them.
5. Current transcript following the latest output and latest public item actually within the readable viewport. The 300px scroll threshold is the existing auto-follow policy, not by itself proof that the latest item is in view.

`MessageList` already owns the relevant following refs (`MessageList.tsx:62–78`) and interaction pauses (`:105–145`). Add a small local reading probe/callback there, not a root scroll-state store. Its acknowledgement is for what was already visible; a valid queued ack may finish after navigation, but may not substitute a newer revision. A stale queued frame that has never sampled visibility must recheck route/thread/window/following intent before acknowledging.

Do not reuse `usePublicOutputCommit` unchanged: it intentionally samples at most once per invocation (`ExecutionFeedback.tsx:27,32,38–40`) and has no unread watermark or viewport/following check. Its DOM eligibility logic is useful to reuse without changing E03 first-output timing semantics.

For bounded write/render work, retain only the maximum **already-observed** eligible revision in a local pending ack, coalesce within the reading probe, and keep one ack in flight. Flush on meaningful settle/visibility transitions when a revision was already observed. This permits conservative temporary unread after an unacknowledged crash, but never falsely clears unseen updates. Do not buffer a revision merely because it was produced in the selected thread. Exact latency/quiet presentation should be documented and exercised in the retained UI fixture.

### 6. Sidebar subscription and layout

- Put an isolated small activity component/store subscription at the topic row boundary. It observes only that thread's small metadata and the host's semantic execution snapshot.
- Cache/equality-compare `busy`, `waitingApproval`, `unread` and relevant session/thread identity before notifying React. Internal revision changes that leave these booleans unchanged must not emit a new navigation snapshot.
- Do not make `AgentChatPage`, `AppFrame` or the full sidebar subscribe to all `agentRuns`, all messages, public stream text, token counters or read progress. Do not move the active transcript's normal stream rendering into a root provider state update.
- Preserve the title/project grouping/search inputs. Memoize the navigation/row boundaries as required so active transcript updates do not re-render every title; the current TopicSidebar/TopicRow are not memoized and callbacks are reconstructed in its map. Merely adding an isolated badge does not prove the existing sidebar itself stops re-rendering with its parent.
- CSS animates a small hollow trailing loading indicator. No interval/timer-driven React state is needed. Reserve a trailing status slot next to a separate unread dot so both can coexist. Respect reduced motion and supply concise accessible names/status descriptions without live narration for each token.
- Existing time/actions use an absolute right-side overlay (`agentChat.css:602–649`). Reserve a non-overlapping status/action region on hover, keyboard focus and touch; do not let rename/delete cover the spinner/unread or make a decorative indicator a nested interactive button.
- Keep real sibling title/rename/delete buttons and keyboard contracts (`TopicSidebar.tsx:308–330`). Do not turn the entire row into a button containing action buttons.
- Preserve the same status behavior in workspace, loading/unavailable sidebar and task board entry paths. `AgentChatPage.tsx:663` directly constructs a second sidebar path; changing only `useAgentTopicNavigation` would miss it.
- No preparation copy, temporary user-bubble labels, success toasts or repeated screen-reader announcements. The screenshot calls for a compact row indicator, not an extra message status line.

### 7. Navigation removal must not weaken same-thread admission or drafts

The existing cancellation paths are real, not just explanatory UI:

- `useThreadDeparture.tsx:25–107` installs the run-based router blocker and “停止并离开” dialog.
- `AgentChatPage.tsx:226–239` explicitly aborts the previous execution when selecting another thread.
- `AgentChatPage.tsx:337–357` aborts when creating a topic.
- `useChatExecutionSession.ts:20–33` aborts on unmount and thread changes; one `sendLockRef` represents the whole page.
- `AgentChatPage.tsx:138–149` pauses video/audio batches on thread effect cleanup and pagehide.
- Send/retry/approval actions close over the selected route, local attempt state and `isCurrent` selection checks (`AgentChatPage.tsx:428–497`, `:576–638`). Merely moving the AbortController or deleting the dialog leaves these hidden dependencies.

E11 should remove run-only departure blocking and all implicit navigation/unmount cancellation after the host actually owns execution. Keep explicit Stop, thread deletion and application Quit as distinct commands with their real drain/unknown semantics. Move action ownership and submission/recovery records to the correct thread session so A can continue while B sends; late A completion cannot navigate the user back from B or consume B's draft.

`runBlocksThread` (`models/agentToolSelection.ts:10–14`) is also the admission predicate in `beginAgentRun` (`commands/agentRuns.ts:99–100`). **Keep its same-thread admission meaning**: one thread cannot accept a competing execution while its current run/approval/unresolved tool work owns it. Remove its use as a general navigation prohibition. Different thread IDs already have independent Web Locks (`runtime/runOwnership.ts:46–64`), so the new host must preserve that separation rather than replacing it with one global send lock.

Manual editor guards are independent. `leaveTask`/task-inspector ownership (`AgentChatPage.tsx:78–85`), business detail edits, rename dialogs and pending mutation guards must remain. `useReferenceDraft.ts:25–40` already stores multiple scopes while its owner remains mounted, but aborts imports and loses the map when the page unmounts. E11 must explicitly choose a retained draft owner when route changes unmount the chat; it must not claim conversation continuity by silently discarding the unsent draft/reference import. The research does not authorize widening old manual-draft contracts or suppressing their guards.

### 8. Smallest likely file/schema touch set

New feature-owned modules should separate pure types/projection, transactional publication/read commands, cached subscriptions and the local reading probe. Names are illustrative:

- `features/agent/models/threadActivity.ts`: strict activity value and read/public revision types, pure navigation projection.
- `features/agent/commands/threadActivity.ts`: publication and exact observed-revision ack with explicit StoreTx; bounded key preparation and deletion.
- `features/agent/queries/threadActivity.ts` or host-owned subscription module: current snapshot, errors and semantic equality/cache, browser/native observation lifecycle.
- `features/agent/ui/ThreadActivityIndicator.tsx` and a local transcript reading probe: small row UI and sampled read acknowledgement.
- Source writers: `commands/agentRuns.ts`, `commands/agentRunTerminalState.ts`, `commands/agentTools.ts`, `runtime/runChat.ts` transaction scopes, `models/chat.ts`; include recovery/direct approval restoration as accepted phase/publication paths, not just happy-path completion.
- Lifecycle: `commands/lifecycle.ts` already includes `deviceSettings` in the deletion transaction (`:11`), so delete its activity key atomically with thread deletion. Review reset/clear paths as part of the host lifecycle; do not leave an orphaned key able to resurrect a deleted row.
- Wiring/render isolation: `TopicSidebar.tsx`, `AgentTopicNavigation.tsx`, `ChatWorkspace.tsx`, both direct sidebar paths in `AgentChatPage.tsx`, `MessageList.tsx`, `agentChat.css`; app/host visibility signals through a deliberate typed boundary. `AppFrame` need not own per-thread state.
- Host work separately replaces page-owned execution and run-only departure behavior; it is not supplied by the sidebar projection.

With an existing device setting and ordinary payload fields, **no new ProductStore table, index, browser version, registry hash, native SQL schema or historical migration is inherently required**. Recheck the final host design independently; it may have other persistence needs. If it adds a table, update all actual closed registries/adapters/conformance owners together, and still do not invent old-data upgrade code.

### 9. Necessary verification cases

Keep tests at real contract boundaries; do not add tests for decorative copy alone.

1. Real ProductStore publication/ack: same-thread monotonic revisions across two runs/resume; identical/timing-only output and renamed/model-changed thread do not create unread; approval and terminal publication are once-only; duplicate/stale ack cannot regress; ack 41 racing publication 42 leaves 42 unread; failed/unknown read is not all-read; deletion wins late publication/ack. Exercise atomic row+activity rollback, not separate mocked setter assertions.
2. Cached sidebar projection: actual producer checkpoints/metrics do not re-render sidebar/root or notify unchanged booleans; a different thread update does not re-render unrelated row indicators. Busy/unread coexist; approval is distinct from active progress; new host generation does not trust stale stored execution. Browser observation must still see committed changes from its supported ownership lane.
3. Actual transcript/controlled observation: A-to-B held reads, empty A-to-pending B and retired A delivery stay covered. Stale requested-topic data never generates a B ack. Current output observed before later revision cannot acknowledge later output.
4. Actual MessageList DOM/geometry: following latest can acknowledge its rendered revision; scroll-up, rail/activity/manual disclosure, hidden document/window, narrow full-width details, expanded composer and overlay/inert transcript cannot. Return-to-latest or returning to visible conversation may acknowledge only the now-rendered current snapshot. Same-ID optimistic-to-durable user handoff does not reset following or create unread.
5. Retained real Agent UI: keep A's controlled stream alive, switch to B, send B and receive both independently; run/sidebar indicators remain accurate; no stop-before-leaving dialog; explicit Stop A does not stop B; pending approval stays attached to its original run; no late completion steals route/draft. Preserve dirty/pending detail/task editor guard behavior during the same route actions.
6. Actual browser layout/focus: screenshot-like trailing indicator at wide/narrow sizes, truncated title, grouped/search rows, simultaneous unread dot, hover/focus/touch rename/delete, reduced-motion presentation, accessible keyboard controls. DOM-only tests cannot prove non-overlapping pixels.
7. Reload/reconnect: durable unread survives; a live owner snapshot reconnects without a second request; a lost owner reconciles to interrupted/waiting/unknown truthfully; revision gaps request snapshot rather than clearing unread or replaying side effects. Native hidden/restored single-window behavior requires actual macOS and Windows acceptance; jsdom and source compilation cannot establish it.

Existing test owners worth extending or deliberately updating: `tests/topicSidebar.test.ts` (current grouping/row semantics), `tests/e04AgentQueryDeparture.test.ts` (requested identity, stale observation and old departure expectations), `tests/e01ManualDraftDeparture.test.ts`, the E01/E16 actual business-detail browser fixture, E02 submitted-message identity/recovery tests, E03 feedback/Stop tests and MessageList scroll tests. Update superseded run-departure assertions; retain query ownership and manual-draft coverage instead of deleting the old suite wholesale.

## Related specs

- `.trellis/spec/frontend/agent-thread-reading.md:9–27`: retain requested-topic identity, local synchronous following and centered return action; intentionally replace the run-only departure requirements at lines 17–19 and their old validation rows. Its “no unread counter” sentence is scoped to the return-to-latest control; E11 adds a sidebar unread indicator, not a badge on that control.
- `.trellis/spec/frontend/chat-performance.md`: preserve memoized history, local scroll/ResizeObserver, lazy rich transcript, no root scroll/tick state. Amend ownership statements only where E11 intentionally moves execution out of the page.
- `.trellis/spec/frontend/component-guidelines.md:224–248`: retain manual-draft/pending mutation guards and synchronous current-state checks.
- `.trellis/spec/frontend/component-guidelines.md:256–282`: retain sibling topic controls/grouping/search/project actions; revise the old run-departure chain explicitly for E11.
- `.trellis/spec/frontend/agent-business-details.md:91–118`: retain editor target/revision/pending/conflict guards, mounted details and hidden-chat runtime; revise only the old execution-cancellation reference at line 98.
- `.trellis/spec/frontend/interaction-feedback.md:11–21`: normal successful sends/preparation stay quiet; meaningful failures/decisions remain actionable.
- `.trellis/spec/frontend/hook-guidelines.md:57–61`: explicit requested envelopes, stale reads and draft-aware owner identity.
- `.trellis/spec/frontend/shared-product-storage.md:49–75`: device-local setting key rather than new table; one fixed owner; transaction scope is explicit.
- `.trellis/spec/frontend/native-product-runtime.md:13` and `.trellis/spec/guides/development-change-policy.md`: fresh fixtures by default, no requested legacy migration/backfill.
- `.trellis/spec/frontend/agent-jobs-results.md` and `.trellis/spec/frontend/agent-mcp.md`: reporting/unknown/Stop ownership remains original-call scoped. A sidebar projection cannot grant replay or revive expired host authority.

## External references

None used. This topic is grounded in the checked-in application and local specifications. Native window visibility/residency/platform lifecycle API choices belong to the separate E11 host research and should be checked against the actual installed Tauri versions and official API documentation there.

## Caveats / Not Found

- This report does not implement a host, schema, read receipt or indicator, and runs no tests/build/install/Git operation.
- The final host attachment protocol must provide real current-owner/session and native window foreground signals; their concrete implementation is deliberately not guessed by this sidebar research.
- First-version unread policy should be confirmed in the design as assistant-publication based, including approval/error visibility. Tool-body expansion is not required to count an already-visible public summary as read, but unseen hidden output must never count.
- New setting keys and `ChatMessage` payload metadata can avoid schema/index changes; a different final host persistence design may introduce separate schema work. The development policy still does not authorize historical upgrade code.
- Existing reference drafts live only in the current page's in-memory scope map. Navigation cancellation removal must preserve an intentional draft owner or explicitly guarded handoff; background execution alone does not solve draft retention.

## Final planning consistency review — 2026-10-16

Reviewed the authored `design.md:93–115` and `implement.md:59–73` against this report. The chosen per-thread settings, separate bounded report cursors, JSON-string ID hashing outside transactions, combined immutable source snapshot, exact observed acknowledgements and semantic row subscriptions are represented. No implementation or activation was performed.

Three remaining implementation-contract clarifications are material:

1. **Historical report visibility must not require following the transcript tail.** `design.md:109` currently combines MessageList/report eligibility with “latest public item while following,” and Stage 4 line 67 similarly groups the two. This prevents acknowledging the exact historical report when the user intentionally scrolls up to read it. Keep following/latest eligibility for the ordinary tail watermark; for a report, require its own exact original-result snapshot and actual visible summary/body under the shared window/focus/non-inert guards, regardless of tail-following state. Add one paused-reader/historical-report test: reading that report clears only its cursor while ordinary newer tail unread remains.
2. **The existing closed MCP/web report is not necessarily a new-result summary.** `ui/AgentJobReport.tsx:40–45` renders no `JobProgress` for successful web/MCP results; lines 163–169 show only an unchanged “查看报告” toggle while closed. Do not acknowledge a changed result just because that generic section/button is in view. Either display an actual revision-matched public result/terminal summary that the local probe samples, or acknowledge only after the existing body is displayed. A query revision attached to a generic unchanged button is not evidence that the updated public result was presented. This needs no full-body reading requirement when a real visible summary exists.
3. **Place the full combined source subscription below the broad Agent page boundary.** The design promises no token-driven root/sidebar rendering, but `AgentChatPage.tsx:195–218` currently owns message/run observations. A new combined full-body envelope in that same component would still re-render it on every checkpoint, even with memoized sidebar rows. Stage 4 should explicitly locate the full envelope subscription at the transcript/workspace reader boundary and give the page/composer only stable semantic selections needed for admission/actions. Measure the actual Agent page/app/sidebar render counts, not only that a new badge suppresses its own notifications. If retaining the existing page render behavior is intentional, narrow the promise to “no new root invalidation from sidebar metadata” instead of claiming removal of existing token-root rendering.
