# Research: execution phases, Stop acknowledgement and private response timing

- Query: Which real lifecycle boundaries can drive honest preparation/model-wait/output/approval/stopping feedback, and how can click-to-display timing be measured without another provider request or storage schema?
- Scope: mixed; local Agent presentation/runtime/diagnostics and one primary User Timing API reference
- Date: 2026-10-15

## Findings

### Recommended bounded E03 scope

After E02 is accepted, add a small **invocation-owned** feedback controller and optional private timing observer. Keep the durable run/message status and sole terminal writer authoritative. Reuse core's existing public events through the Studio host; do not change the loop, checkpoint cadence, transport protocol, paid request count or product schema. This investigation found no measurement that justifies a live-text overlay, so E03 should measure the current receipt → checkpoint → display path and leave that optimization unselected.

E02 is being implemented while this research is written. Line references below describe the files read during investigation, before its UI/flow implementation is frozen. Rebase the integration points against E02's final attempt/claim/reconciliation APIs; do not recreate a second submission state machine.

### Files found / actual ownership

| File | Responsibility and useful anchor |
| --- | --- |
| `packages/studio/src/features/agent/ui/AgentChatPage.tsx` | Existing `handleSend` synchronously captures the draft/selection and acquires the execution token (381–405); `finally` releases it only after the whole flow (443–445). Current Stop only aborts and pauses the audio queue (376–379). |
| `packages/studio/src/features/agent/ui/chatExecutionFlows.ts` | Compatibility before mutation (73), home creation/bind (76–89), held thread ownership and guarded draft/navigation transfer (93–112), begin/acknowledge/execute (123–134). These are natural E02 preparation/admission hooks. |
| `packages/studio/src/features/agent/ui/useChatExecutionSession.ts` | Ref-backed duplicate lock and epoch/token identity (22–36); route effect and unmount abort the owned controller (10–21). There is no Stop-pending state today. |
| `packages/studio/src/features/agent/runtime/runChat.ts` | Studio's actual `RuntimeHost` binding (33–105). `prepareContext` refreshes loading/project/memory and may compact (54–62). `request` resolves current credentials then invokes the chosen protocol (65–71). `executeChatRun`/`resumeChatRun` preserve held ownership (116–128). |
| `packages/agent-core/src/runtime.ts` | Optional `RuntimeHost.observe` already exists (21–42). Core emits invocation-local public output/checkpoint/approval/settled events (186–195); the actual loop is 198–235. Studio currently does not supply observe. |
| `packages/agent-core/src/checkpoint.ts` | Writes serialize and coalesce while preserving the newest accumulated output (10–31); `flush` waits and propagates failure (35–37). |
| `packages/studio/src/features/agent/commands/agentRunTerminalState.ts` | One conditional run/message terminal writer (19–59). An already terminal run ignores a late settlement request (31–32); visible earlier content is retained (36–49). |
| `packages/studio/src/features/agent/providers/chatStream.ts` | Studio supplies runtime transport, reasoning validation and current reference materialization (20–29). |
| `packages/studio/src/features/agent/providers/responsesStream.ts` | Same actual boundary for Responses and provenance-preserving conversion/materialization (17–24). |
| `packages/agent-providers/src/chatCompletions.ts` | Current metrics start before request materialization (260–285). Content/reasoning callbacks are actual parsed public output (228–242); JSON uses the same callbacks (293–305), SSE 314–337. |
| `packages/agent-providers/src/responses.ts` | Actual parsed public callbacks (156–171), terminal output reconciliation (173–200), materialization before application fetch invocation (208–229). |
| `packages/agent-providers/src/http/requestBoundary.ts` | `requestOnce` checks cancellation, then invokes the selected fetch exactly once with the existing options (12–19). |
| `packages/studio/src/platform/runtime/runtimeFetch.ts` | The native selected fetch may still await upload admission, authorization and origin grant (277–296). Actual native-plugin invocation is 150–166; browser fetch is 280. |
| `packages/studio/src/platform/product/queries.ts` | Store observations publish React state asynchronously (24–40), retaining the previous result while dependencies reload; this is a separate interval after checkpoint completion. |
| `packages/studio/src/features/agent/ui/MessageList.tsx` | Actual user bubble (182–190), public assistant/process ownership (161–177, 194–200), memo comparator (228–252). A run-backed running answer is rendered inside AgentRunDetails. |
| `packages/studio/src/features/agent/ui/AgentRunDetails.tsx` | Actual running current content/reasoning (227–235, 280–292), disclosure transitions (241–246), folded process and separately retained generation review (279–306). |
| `packages/studio/src/features/agent/ui/ThinkingPanel.tsx` | Reasoning body mounts only when its disclosure is open (57–63); receiving reasoning does not itself prove it was displayed. |
| `packages/studio/src/features/agent/ui/ModelSelectTrigger.tsx` | SendCircleButton shows a repeatedly clickable Stop whenever `sending` is true (332–359); there is no separate pending label. |
| `packages/studio/src/platform/diagnostics/breadcrumbs.ts` | Existing memory-only ring of 30 route/fixed-action labels, explicitly excluding user/creative content (3–17). This is an error operation trail, not a precision timing store. |
| `packages/studio/src/platform/diagnostics/errorReport.ts` | Current report reads sanitized error/context and existing breadcrumbs (71–90); it has no Agent performance payload. |
| `packages/studio/src/platform/diagnostics/reportError.ts` | Current latest-error subscription and one-second dedupe (9–21, 40–55); ordinary cancellation is excluded (24–30, 45). |
| `tooling/e06-root-browser.mjs` | Existing one-off fixture tooling reads standard `performance.getEntriesByType` navigation/resource/paint entries (47); no production timing getter/global hook is established. |

### Current lifecycle and why existing status is insufficient

The present `sending` flag covers compatibility lookup, thread creation, ownership, navigation, atomic admission, context preparation, every main model request/tool round, checkpoint flushing, metrics persistence and terminal settlement. `run.status === 'running'` begins at atomic admission, before model dispatch. Therefore neither flag means “the model is generating.” The current composer strip says only “正在执行” (or an active compaction notice), while the process summary says “进行中”. A delayed first response has no specific honest model-wait label.

Core already exposes meaningful facts:

- `output` is provisional and emitted only after a non-aborted public callback is accumulated and handed to the writer (`runtime.ts:207–210`).
- `checkpoint` is confirmed only when the actual guarded checkpoint applies (`runtime.ts:195`); stale/no-op writes do not emit it.
- `approval` follows durable `tools.park` (`runtime.ts:125`). Approval controls stay at their existing tool owner.
- `settled` follows the host's durable settlement and reports the **actual retained status** (`runtime.ts:190–193`), including a prior terminal result.
- Observers cannot control execution: exceptions are caught (`runtime.ts:186–189`). Events carry run ID, invocation execution ID and an invocation-local increasing sequence; they are not a cross-restart revision.

Use these existing semantics. Do not infer phase from prose, last updated time, a spinner timeout or a timer that guesses a model has started.

### Minimal phase projection and Chinese copy

The shared controller can keep one compact union plus the independent E02 accepted/failed/unknown outcome:

| Phase | True entry boundary | Suggested copy and presentation |
| --- | --- | --- |
| `preparing` | Captured attempt acquired; and each actual `prepareContext`/reference materialization interval | “正在准备…”; when an actual compaction row is running keep existing “正在整理较早的对话…” |
| `waiting_model` | The selected application fetch is actually invoked for this main model step, before first public delta | “正在等待回复…” |
| `receiving` | First nonempty public content or public reasoning callback for that step | “正在接收回复…”; quiet while visible text is advancing, with no second full statement in the process header |
| `working` | Durable tool round and actual tool work, or another confirmed runtime operation after model return | Existing “正在执行” plus existing tool rows; this generic fallback prevents tool-only answers being mislabeled as model wait/output |
| `waiting_approval` | Confirmed approval event / current owned durable waiting-approval state | Preserve existing “待批准 · 查看” attention card; approval/rejection remains beside the call |
| `stopping` | The current invocation's explicit user Stop handler **before** abort or any await | “正在停止…”; disable duplicate Stop while locks/final persistence remain owned |

Terminal success should remove transient strip feedback. Existing message error/stop/interruption lines remain the sole completed outcome statement. E02's preparation failure, accepted record and uncertain commit UI remain authoritative; do not invent E03 “failed” records.

Phase priority: current invocation's explicit stopping > owned approval > current step's actual work. Reject callbacks for an older token, another run/thread or previous resume execution ID. A tool round may go preparing → waiting → receiving → working → preparing repeatedly; phases are not a one-way global progress percentage. `receiving` alone must not survive into an unrelated tool/context operation.

For final persistence that is slow **without Stop**, preserve a quiet “正在保存…” only if a real settle/flush boundary is instrumented; do not add it speculatively from elapsed time. If reducing the union is preferred, keep `working` until confirmed settle rather than falsely claim completion. Never show “思考中” based solely on a request being pending: models may return no reasoning at all.

### Truthful memory-only timing hooks

Use one injectable monotonic clock (production `performance.now`, deterministic test clock) for relative durations. Do not subtract provider `Date.now` metrics from this clock. Keep a bounded private trace owned by the mounted Agent execution controller, containing IDs, event names, numeric timestamps, step and outcome only; no text, reference contents, raw errors, keys, URLs or opaque continuation. Clear it on dispose; keep only a small explicitly bounded number of recent completed invocations if diagnostic retrieval is needed. No localStorage/DB, telemetry upload, console payload dump or permanent user-facing speed dashboard is required.

#### Diagnostic retrieval recommendation

Current error diagnostics already have a consumer (`ErrorDetailsDialog` → report builder → breadcrumb ring); they are intentionally not a general trace dashboard. Do not append precision phase events to that 30-action ring, expand the error report/settings UI, add a production getter used only by tests, or publish a new `window` API just to inspect timing. There is no existing production performance trace export to reuse.

Prefer standard **User Timing entries** as the diagnostic sink, with names such as `cuepoint.agent.<localTraceId>.<mark>` and optional fixed-type numeric/ID metadata. Use an invocation-local generated trace ID rather than putting a project/title/URL into entry names. Keep lifecycle ownership in the private controller; User Timing is a content-free observability sink, not execution state or authorization. Built-in DevTools Performance tooling or a developer's explicit `performance.getEntriesByType('mark')` inspection can retrieve the prefixed marks, so no unused exported getter or application global is needed. Bounded test/fixture code can subscribe to this standard API or inject the same sink directly.

Record each critical first/final mark once per invocation (rather than every token). Retain at most eight completed/active traces and at most 256 owned mark/measure entries; evict exact recorded names with `clearMarks(name)`/`clearMeasures(name)` and clean this controller's names on dispose. Never call the parameterless clear APIs, which would erase other owners' diagnostics. If a trace is evicted, do not manufacture missing durations. Derived measures such as submitted→provisional DOM, request→first public receipt and receipt→first public DOM can be emitted only when both actual marks exist.

The W3C User Timing draft defines monotonic mark/measure timestamps, optional mark metadata, named cleanup and standard Performance Timeline retrieval. This supports the proposed sink, but does not prove this application's actual WebKit/native compatibility or paint timing; feature-detect the required methods, catch optional diagnostic failures and keep execution/phase UI working when the sink is unavailable. [W3C User Timing, 11 March 2026 draft](https://www.w3.org/TR/2026/CRD-user-timing-20260311/).

The standard timeline can be inspected by same-context developer code; “private memory-only” here means no application content, persistence, automatic transmission or newly exposed application control surface. It is not a new security boundary.

| Mark | Actual hook | What the mark proves / limits |
| --- | --- | --- |
| `submitted` | Valid send gesture synchronously captures/acquires the E02 attempt | Accepted local user intent, not successful persistence |
| `provisionalCommitted` | Layout effect on the actual E02 attempted-message DOM once the bubble exists for this attempt | React DOM commit, **not proof of physical pixel paint**; a queued state update does not qualify |
| `admitted` | Normal begin returns successfully, or read-only reconciliation positively finds the exact admission | Durable admission was known at that moment; an uncertain late reconciliation is an upper bound, not the original native COMMIT timestamp |
| `requestInvoked` | A wrapper around the exact selected `fetchImpl` passed into the main protocol adapter, immediately before delegating | Application transport invocation after validation/materialization. Native authorization/upload scheduling can still follow; do not name this “server received” or “wire sent” |
| `firstPublicReceived` | First nonempty content/reasoning callback in Studio host `request`, before forwarding unchanged to core | Parsed public output reached Studio; not a network packet timestamp and not proof of committed/displayed text |
| `firstCheckpointConfirmed` (optional useful diagnostic) | Existing `observe` receives confirmed checkpoint containing the first public output | The accumulated snapshot was durably accepted; distinguish no-op/failed checkpoints |
| `firstPublicCommitted` | Layout effect at the actual visible assistant/current-process Markdown or reasoning body owner, associated with current invocation and output lineage | First public output is in the visible DOM subtree. Folded/inert/unmounted text must not count. React parent render alone does not qualify |
| `stopRequested` | Explicit current-token user Stop handler before abort | Immediate local acknowledgement; not remote cancellation or rollback |
| `settled` | Existing confirmed settled event from actual retained status | Authoritative terminal persistence known to have completed; not just the flow promise finishing |
| `released` | Current token's final release | UI/execution lock no longer held. Keep separate because rejected/unknown persistence can release without a confirmed terminal event |

Track first public reasoning and first answer content separately where useful, or keep a `kind` field. Empty frames, SSE keepalives, private/encrypted reasoning and tool-argument fragments must not count as visible text. Tool-only steps and early aborts may legitimately lack `firstPublicReceived/Committed`.

Current provider `metrics.startedAt` includes validation/materialization; Chat `firstTokenAt` can be set by tool fragments (`chatCompletions.ts:263–265`), while JSON callbacks do not establish the streaming metric and Responses terminal synthesis intentionally does not fabricate streaming timing. These metrics should retain their original token-speed semantics rather than being renamed to E03 first display.

The existing public core event port can be passed as an optional typed observer through the Studio execution functions (for example a final options parameter), with E02 flow callbacks for preparation/admission. Bind it to the execution token, not a global mutable “current run”. Keep the actual main-request fetch wrapper separate from auxiliary compaction requests so a context summary request does not masquerade as the user's main reply dispatch. A wrapper around runtimeFetch preserves all arguments and selected native/web policy; it must not switch to global fetch.

Renderer correlation needs explicit care: resumed runs already have old text, separate live queries can publish old/new run and message snapshots at different times, and running text is inside `AgentRunDetails`, not always the flat assistant node. Mark display only for a current-invocation confirmed output lineage and the matching visible text subtree. Do not stamp first display merely because `message.content` was already nonempty at mount. If folded/full-width detail hides the chat, leave display absent until the matching public text becomes visible. In bounded fixtures, instrument DOM mutations/visibility or probe the actual rendered text node to independently validate these hooks.

An effect timestamp or even requestAnimationFrame callback is not a compositor paint timestamp. Report these measurements as DOM commit/display eligibility unless actual browser instrumentation supplies a stronger paint measure. Source order and synthetic clock tests prove event semantics, not a real latency reduction.

### Stop behavior and settlement constraints

Current `handleStop` aborts immediately but leaves `sending=true` until the flow's `finally` releases the token. This already preserves the duplicate-send barrier. E03 should add a synchronous ref-backed `stopRequested` flag and immediate local state, then call the existing abort/pause operations **once**. Do not release early, create a replacement controller, mark run cancelled directly or clear partial output.

| Stop point | Required result |
| --- | --- |
| Compatibility / home creation before admission | Immediate stopping feedback; awaited operation may finish, but no begin/model POST afterwards; preserve E02 attempted payload and new draft |
| Begin is in flight | Do not pretend the atomic transaction was cancelled. Await known outcome; accepted run follows existing cleanup/settlement without a model request, unknown commit stays E02 “待核对” |
| Provider pending headers/read or streaming | Abort the same signal, keep partial accumulated output, let serialized flush finish; current core settles text-only as cancelled and tool-bearing as interrupted (runtime.ts:211–214, 237–246) |
| Tool execution / paid external operation | Stop further local work; existing durable completed/unknown effects remain. No claim that provider work was cancelled or money refunded |
| Final checkpoint/metrics/settle pending | Immediate stopping feedback, keep ownership and await authoritative persistence. If completed already committed, actual completed wins; do not relabel it cancelled |
| Save/read fails or outcome stays unknown | Show existing explicit failure/uncertainty. Do not stamp confirmed settled or change to “已停止” solely because `AbortController` is aborted |
| Repeated Stop / stale completion after another invocation | At most one stop side-effect per token; older callbacks cannot clear the new phase/lock |

The shared core currently flushes at request return before metrics and terminal state (`runtime.ts:211–217`), and error cleanup flushes before rereading/marking unknown/settling (`237–246`). `createRunWriter` aborts transport on persistence failure. Therefore `signal.aborted` alone cannot distinguish a user Stop from storage failure; keep explicit user stop intent separate.

Current Stop pauses audio batch workers only; route/pagehide cleanup pauses both video and audio (`AgentChatPage.tsx:111–122, 376–379`). Video batches have their own controller and explicit pause entry (`features/video/agent/generationBatchRuntime.ts:45–53, 163+`). This is a scope fact, not permission to broaden Stop into remote job cancellation or redesign queue controls. Preserve existing batch-owner controls and accurately describe retained work.

### Targeted tests that fit E03

1. Extend E02's final actual-page/React-DOM tests after its APIs settle: delay compatibility, home creation and begin; Stop must paint “正在停止…” before the held promise resolves; same-tick repeated Stop and send remain excluded; newer draft and admission identity stay intact. No tests should merely search source strings for phase labels.
2. Add small pure controller tests with injected clock: token/thread/execution ownership, stop precedence, repeated tool/model steps, sparse marks, bounded retention, no secret/text retention and no observer exception escaping. Assert distinct received/checkpoint/render/settled marks, not synthetic performance targets.
3. Reuse `tests/agentRuns.test.ts:156–187` for serialized/coalesced writer, persistence failure, complete/error/pre-aborted zero-dispatch. Add only the missing held-flush/settle Stop race and actual retained-terminal assertion.
4. Reuse `tests/chatStream.test.ts` (pending read abort, no post-abort callbacks, one POST, empty/protocol failures) and `tests/responsesStream.test.ts` (JSON and terminal-only metrics) to protect the narrow new transport observer; both protocols must produce the same lifecycle semantics without changing existing throughput metrics.
5. `packages/agent-core/src/runtime.test.ts:165–226` already checks ordered provisional/confirmed events, no checkpoint confirmation on no-op, and deleted/unreadable cleanup. Studio observer binding should receive these semantics without adding new generic core events unless implementation finds an actual gap.
6. Reuse `tests/errorBoundaryChatUnmount.test.ts:20–57` plus execution ownership/credentials regressions if signatures change: unmount abort, locked owner untouched, zero startup network replay, current key at each dispatch. Add one retry/resume trace case to prove old saved text does not count as new first display.
7. Extend `tests/agentMessagePresentation.test.ts` and existing tool timeline/attention tests only for changed controls/copy: quiet completed transcript, approval in one place, stopped outcome once, disabled repeated pending Stop. A bounded local DOM/browser fixture with synthetic transport can independently measure actual callback → committed text marks; hidden/folded detail must not manufacture a displayed delta.

Do not run builds, packaging, full suites, native acceptance or live providers for this research/stage; the user explicitly defers those until the task batch is complete. Use only affected type checks, focused regressions and independent code review when E03 is implemented.

### Related specs and external references

- `.trellis/spec/frontend/agent-execution.md`: one POST, frozen requests/current credentials, held thread ownership, conditional terminal writer and route cancellation.
- `.trellis/spec/frontend/agent-activity-ui.md`: quiet transcript, one approval owner, generic running strip, no per-second timer or inferred business completion.
- `.trellis/spec/frontend/chat-performance.md`: preserved render isolation, pinned/manual scrolling and lazy MessageList boundary.
- `.trellis/spec/frontend/shared-product-storage.md:145–167`: no callback replay; unresolved native commit stays unknown, not rollback.
- `.trellis/spec/agent-core/library/runtime.md`: existing invocation-local observer events and confirmed/provisional semantics.
- `.trellis/spec/agent-providers/library/protocols.md`: preserve validation/materialization ordering, one selected transport, metrics and callbacks.
- [W3C User Timing, 11 March 2026 Candidate Recommendation Draft](https://www.w3.org/TR/2026/CRD-user-timing-20260311/): primary reference for monotonic User Timing entries, metadata, named cleanup and standard retrieval. It is a draft and is used for API semantics only, not a claim about the installed desktop engine.

## Caveats / Not Found

- This is a preparatory source investigation while E02 is still moving, not E03 activation or acceptance. Reconcile final E02 types/flow before writing E03 artifacts.
- No real response/DOM timing measurements were collected here. There is no evidence supporting a latency claim, polling/checkpoint tuning or provisional live-text overlay.
- Current runtime public events do not expose prepare/request start. Studio can observe its own host methods and fetch invocation without changing neutral core or persisted schema. A low-level native socket/server timestamp is not available from those hooks.
- The bounded scope has no genuine unresolved owner product decision that blocks planning: proposed Chinese copy and transient bounded memory retention are routine implementation choices. Persistent analytics, a user-visible diagnostics export, cross-restart timing or a live-text overlay would be separate scope decisions if later requested; do not ask for them merely to proceed.
