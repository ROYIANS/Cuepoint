# Research: E11 product execution and lifetime boundaries

- Query: Find the smallest real Studio boundary that supports concurrent conversations, navigation without Stop, retained desktop execution after window close, one product window/app instance, explicit Quit, and conservative restart reconciliation.
- Scope: internal source research; host runtime/OS scheduling selection is covered separately by the native researcher.
- Date: 2026-10-16

## Findings

### Decision input

The existing reusable loop is already in `@cuepoint/agent-core`; extracting that loop again will not change application lifetime. The smallest coherent product change is an application-lifetime Studio execution service in the retained main JavaScript realm, installed after the one ProductStore opens and before routes mount. React pages become subscribers and scoped command callers. This preserves the current native storage session, native HTTP path, reference materialization, business tool implementations, E07 publication, and E10 MCP authority.

This option requires actual native evidence that the sole retained hidden WebView continues execution on macOS and Windows. It does not establish survival of WebView destruction, application Quit, operating-system suspension, or browser tab close. Those outcomes are different from closing/hiding the product window. A Node sidecar cannot import the current complete Studio binding unchanged; it needs several new explicit ports and a new trusted native invocation path, described below.

### Files found and current ownership

| File | Responsibility / anchor |
| --- | --- |
| `packages/studio/src/app/bootstrap.tsx:58` | Initializes the fixed store and MCP runtime before rendering StrictMode/router. Suitable app composition point for service startup and lifecycle installation. |
| `packages/studio/src/features/agent/ui/AgentChatPage.tsx:99` | Current page owns selected-thread ref, submission attempts and recovery callbacks. |
| `packages/studio/src/features/agent/ui/useChatExecutionSession.ts:5` | One page-local send lock, AbortController, feedback invocation and epoch. |
| `packages/studio/src/features/agent/ui/chatExecutionFlows.ts:53` | New send mixes model compatibility, thread creation/navigation, durable begin and the actual loop. |
| `packages/studio/src/features/agent/ui/chatSubmissionAttempts.ts:8` | Frozen local submission intent/recovery descriptor; currently page-local and non-durable. |
| `packages/studio/src/features/agent/ui/useReferenceDraft.ts:25` | React-owned scoped composer/import state with exact consume/restore revisions. |
| `packages/studio/src/features/agent/runtime/runChat.ts:36` | Actual typed ProductStore/core/provider/tool/credential host binding. |
| `packages/studio/src/features/agent/runtime/runOwnership.ts:20` | Branded live lock capability and single-entry loop exclusion. |
| `packages/studio/src/features/agent/commands/agentRuns.ts:61` | Atomic admission and immutable run snapshot; checkpoints/recovery are in the same module. |
| `packages/studio/src/features/agent/commands/agentJobs.ts:133` | E07 admission, acknowledged running transition, retained publication and conservative recovery. |
| `packages/studio/src/features/video/agent/generationBatchRuntime.ts:45` | Process-local per-thread video workers, explicit start/Stop and actual done promise. |
| `packages/studio/src/features/audio/generation/batchRuntime.ts:25` | Process-local audio batch workers, Agent-thread/batch lock nesting, explicit start/Stop. |
| `packages/studio/src/platform/product/store.ts:16` | One fixed ProductStore and native service installation beside its actual driver. |
| `packages/studio/src/platform/storage/native.ts:314` | Native driver session, transaction admission, observation and commit uncertainty handling. |
| `packages/studio/src/platform/runtime/runtimeFetch.ts:18` | Actual native HTTP ownership and document teardown cancellation. |
| `packages/studio/src/features/agent/providers/referenceWire.ts:20` | Fresh scoped reference/pixel validation and binary reads before each provider dispatch. |
| `packages/studio/src/features/agent/mcp/runtime/owner.ts:8` | One live feature connection owner beside the installed MCP host. |
| `packages/studio/src/features/agent/mcp/runtime/executionOwner.ts:9` | Ephemeral original-call readback authority retained by the live MCP host. |
| `apps/desktop/src-tauri/src/desktop.rs:24` | App-managed native ProductBridge; current commands trust only bundled main WebView. |
| `apps/desktop/src-tauri/src/full_product_store/mod.rs:325` | Opening a product session resets generation and existing transaction/binary contexts. |

### 1. Multiple independent cancellation paths must move together

- `useChatExecutionSession.ts:25-33` aborts on both hook teardown and selected-thread change. The same hook has one global-to-that-page `sendLockRef` (`:18`, `:34-47`), so merely keeping the page mounted cannot make A and B independent. Token release already checks exact epoch/controller (`:49-59`); retain that discipline for every thread entry.
- `AgentChatPage.tsx:138-149` pauses both Agent video and audio generation on selected-thread effect cleanup, in addition to `pagehide`. Removing the hook abort alone still pauses accepted batch work when navigating.
- `AgentChatPage.tsx:226-239` confirms departure and explicitly aborts when opening another conversation. New conversation separately aborts at `:337-357`. Deletion has its own target-specific abort at `:388-421`, and explicit Stop at `:423-426`.
- `useThreadDeparture.tsx:52-62` installs the router blocker; `:90-105` renders the stop-to-leave dialog. Ordinary navigation can remove this execution-only blocker after ownership moves. Keep TaskInspector/manual business-draft protection (`AgentChatPage.tsx:78-85`) and actual deletion confirmation independently.
- `AudioWorkspacePage.tsx:40-49` pauses all project audio batches on route teardown. This can stop an Agent-owned audio batch even after leaving Agent was fixed. Restrict teardown to genuine host/document shutdown or preserve the Agent-owned batch under the app lifetime; do not accidentally broaden promises for every unrelated foreground audio operation.
- `runtimeFetch.ts:18-39` aborts native requests on actual `pagehide`/`beforeunload`; `mcpServices.ts:7-26` clears the MCP host on `pagehide`. A retained native window hide must not synthesize these document-destruction events. Actual unload/reload remains a shutdown/recovery boundary.

Hiding the dialog, suppressing all aborts, keeping a React page mounted, or starting an extra core loop each fix only part of this graph.

### 2. The service must own pre-admission work, not only the durable running loop

Current Send synchronously captures and consumes the exact draft, reserves run/user/assistant/thread IDs, publishes an optimistic attempt, and then invokes the asynchronous flow (`AgentChatPage.tsx:499-515`; `chatSubmissionAttempts.ts:29-31`). It claims the execution token before its first await and yields for paint (`AgentChatPage.tsx:428-438`; `chatSubmissionAttempts.ts:50-58`). Preserve that order.

The owner must be established from the initial gesture. If ownership starts only after `beginAgentRun`, switching during model verification or thread creation will still lose the attempt or invalidate it. In particular:

- `chatExecutionFlows.ts:73-101` performs compatibility and may create a thread, call React reference-draft methods, and navigate before admission. `references.reserveDestination` throws after page unmount (`useReferenceDraft.ts:170-173`). Split UI handoff from the actual submitted intent.
- `runWithCompatibleChatModel` checks `isCurrent` before/after verification (`features/settings/models/connectors.ts:72-100`). The current caller defines currentness through the selected UI revision/model/thread (`AgentChatPage.tsx:469-471`). Navigation must no longer invalidate an accepted submission intent. Host currentness should mean the captured operation remains owned/admitted for that thread and its actual durable identities still match; it must not mean A is still the selected route.
- A first-send creation receipt belongs to the attempt, not to the route (`AgentChatPage.tsx:187-193`). A late A receipt must not force navigation away from B. A view can navigate to the reserved destination only if its original scope/attachment generation is still current. Service code itself must not import `useNavigate`, React setters, a DOM node, or a reference-draft hook instance.
- Attempts currently import `SubmittedDraft`/`DraftRecovery` types from the UI hook (`chatSubmissionAttempts.ts:4`). Move only the concrete non-React DTO contract to a model/service module as needed; do not let runtime depend on private UI modules.
- `useReferenceDraft.ts:154-167` compares the entire consumed draft revision, not text equality. Keep that restore guard after a view detaches. Options are a small app-lifetime scoped draft model with the hook as its adapter, or a service-owned submitted/recovery payload restored only to a reattached composer with an explicitly matching generation. Do not retain a stale `references.restore` closure whose `mounted` ref permanently rejects.
- Normal preparation remains visually quiet: the optimistic content exists immediately without model-validation text or side labels. The service snapshot may contain internal phases without presenting their names in the transcript.

The app-lifetime attempt is still a local in-memory attempt, not a durable outbox. Restart must not replay it. Known admitted output stays in ProductStore; unknown admission keeps the original reserved identity and read-only reconciliation semantics.

### 3. Preserve exact per-thread lock and transaction ownership

`withExecutionOwnership` uses the existing `cuepoint:agent:<threadId>` Web Lock and creates a privately branded capability (`runOwnership.ts:45-64`). `withOwnedExecution` rejects forged/released/foreign/concurrent reuse (`:29-42`), and the outer callback awaits the actual loop completion before dropping the held state. The service's process-local map is a synchronous admission guard; it does not replace this cross-tab lock or authorize a tool.

The new map should hold exact thread-keyed invocation entries: opaque invocation token/epoch, reserved admission IDs, controller, original completion promise, submitted intent, feedback controller/invocation, and finite public state. Reserve the entry before the first await. The finally block removes/releases only that exact entry after transport/tool/writer work settles. Stopping A signals A's owner and leaves B's entry, lock and output alone.

`runChat.ts:47-58` guards each transaction against live capability, current run/message/thread pointers and model step. Tool transition additionally revalidates metadata, permission, frozen project scope and current MCP binding (`:126-133`). Keep these checks. Native driver transaction admission serializes short writes (`native.ts:492-549`); that is compatible with simultaneous external requests, and does not require multiple database owners.

`beginAgentRun` checks blocking work inside its actual transaction (`agentRuns.ts:92-100`), and input/output/run writes remain create-only (`:209-238`). `runBlocksThread` includes running, waiting approval, and resumable tool failure/interruption (`models/agentToolSelection.ts:11-13`). Keep this admission predicate for one conversation. It should stop deciding whether navigation is permitted; it also should not be reused as a spinner predicate, because a parked approval/interrupted run is not active network execution.

### 4. Approval, rejection, resume, retry and unknown admission are service commands

Current real flows are `retryFrozenChatRun` (`chatExecutionFlows.ts:149-169`) and `resolveChatRunAction` (`:173-210`). They resolve current connectors, verify frozen identity, acquire the existing thread lock, and invoke the same `executeChatRun`/`resumeChatRun`; no second core loop is required.

Preserve these points when lifting them:

- Target commands by explicit thread/run/call IDs and exact invocation generation, not today's active selection. Validate actual run→thread association before changing decisions.
- Persist reject/approve independently of connector availability (`chatExecutionFlows.ts:189-198`). A refusal must not need a valid API key. Resume only after every outstanding approval is resolved and actual current credentials validate.
- Existing `waiting_approval` returns from the loop; do not hold a fictitious running controller forever. A later explicit decision creates a new owned invocation for the same saved run, with a fresh token. Another thread can continue throughout.
- `AgentChatPage.tsx:439-451, 480-488` uses positive admission readback after uncertainty without dispatch. `:523-535` performs explicit state recovery under the original lock, never a model request. Lift these semantics along with attempts. An absent read after unknown commit still cannot authorize re-admission.
- Explicit retry creates its separate new run from the frozen predecessor; reconnecting/reattaching a UI only subscribes and reads existing state. It must never call retry/resume merely because it sees `running`.
- A run-level Cancel is not the same operation as signal Stop. Existing `cancelAgentRun` is dispatched under a thread lock (`chatExecutionFlows.ts:183-187`). Preserve the existing terminal writer and decision ledger.

### 5. Recovery must distinguish a live app owner from abandoned saved state

Current Agent page mount/focus invokes `recoverAbandonedRuns` (`AgentChatPage.tsx:243-250`). That function probes each relevant thread lock with `ifAvailable`, recovers jobs/batches, then interrupts orphaned running records (`runOwnership.ts:76-95`). It never uses wall time as proof of abandonment.

Move startup reconciliation to the application service initialization after ProductStore is ready. Serialize/memoize initialization and refuse/rendezvous new service submissions until that initial local reconciliation is complete, while still allowing immediate optimistic UI publication. An optional later focus scan must retain `ifAvailable` semantics and cannot acquire/re-enter/interrupt a lock held by the same live service. Reopening the retained hidden window is attachment, not startup, so it cannot reset sessions or run eager interruption against its continuing owner.

`interruptThreadRuns` preserves partial content and updates claimed tools conservatively, restoring an actionable waiting-approval state for a crash between approval persistence and parking (`agentRuns.ts:264-293`). E07 recovery marks dispatched MCP/web-read work unknown and never invokes producers (`agentJobs.ts:327-357`). Preserve both. Restart does not reconstruct a JavaScript invocation token, HTTP stream, paid request, or MCP bearer authority from persisted IDs.

### 6. E07, generation and native resources need real Stop/drain registration

E07 work remains part of its original loop/controller. A saved job alone is not an execution host. Admission requires acknowledged original claimed call and frozen selection (`agentJobs.ts:133-163`); running is acknowledged before producer IO (`:171-177`). Original retained output/call completion publish together (`:229-264`). Keep the actual done promise through these writes after the view detaches.

Video workers are already outside React in a per-thread map (`generationBatchRuntime.ts:45-63`). They own the same thread lock, drain their two workers and UI mutation promises, settle the batch, then release (`:76-79, 140-149`). Audio has a per-batch map and Agent-thread plus batch lock (`audio/generation/batchRuntime.ts:25-37`); it reserves synchronously before lock acquisition (`:75-84`) and drains before settlement (`:91-95, 138-147`). Preserve their explicit start/review approval; don't automatically start queued batches from a subscription.

The app execution lifetime must register these named existing work owners for status, scoped Stop and Quit, without acquiring a second copy of the already-held thread lock. Possible narrow owner APIs expose exact identity, `requestStop` and original `done`; these are internal lifecycle handles, not permission from a caller to execute arbitrary closures. Admission remains with each current runtime. Before implementing, settle the representation for a model invocation versus an Agent-owned generation worker so one conversation cannot silently admit both and a selected Stop cannot target the wrong generation.

Current pause helpers only issue abort (`video/...:162-165`, `audio/...:174-179`). They do not expose proof of drain to a Quit coordinator. Add finite lifecycle APIs that await the existing exact `worker.done`, and keep repeat Stop attached to that original owner. A timeout can report still-draining; it cannot declare remote cancellation or release a live owner early. Native E08/MCP process cleanup remains native-owned and must be awaited/reported using its own existing receipts.

`AudioWorkspacePage` teardown is a second owner of pauses as noted above. Scope its removal so a project page cannot interrupt an Agent-owned background batch. Hidden-window validation should include at least one actual generation polling/publication path, not only model tokens.

### 7. Feedback, errors and subscriptions become detach-safe

`createExecutionFeedbackController` currently keeps a single `current` invocation (`executionFeedback.ts:75-84`). Use one controller per thread or exact retained invocation; a single application-wide instance would make B retire A's events. Preserve runtime event execution/run identity and monotonic sequence checks (`:149-168`), optional observer isolation, bounded timing entries and content-free timing metadata.

Expose stable immutable snapshots and `subscribe`/unsubscribe at service boundaries; a React adapter can use `useSyncExternalStore` or equivalent. Unsubscribe only detaches an observer. It must not abort, release locks, dispose feedback or delete attempts. Keep per-thread subscriptions so every token in A does not rerender all sidebar rows or unrelated B.

Public DOM acknowledgement remains a view action: `ExecutionFeedbackInvocation.publicCommitted` explicitly requires a real visible public-text DOM owner (`executionFeedback.ts:26-34`). Do not fabricate a DOM-commit or mark-read event when a background checkpoint arrives. Durable checkpoints provide the saved answer; feedback is optional presentation/diagnostics, not permission or the only answer store.

Current pre-admission errors call page `showError` after catches (`AgentChatPage.tsx:474-492`), while attempt updates drop after unmount (`:105-114`). Store actionable failure/uncertainty in the owning attempt snapshot independently of its current subscriber. Route admitted failures through the current durable run writer. If the app emits an error surface, attach it to explicit thread/invocation identity and acknowledge it once; remounting must neither lose failures nor replay global toasts. Do not retain React callbacks as the sole failure sink.

Sidebar running derives from the current actual owner/durable execution phase, independently from unread/read cursors. A parked approval or unknown external result should not spin as though making progress. Unread advances for committed/public assistant content or retained result, not internal feedback phase, generic thread updatedAt, title change, or subscription delivery. Detailed read-cursor/UI policy belongs to the accompanying lifecycle/sidebar inventory and design.

### 8. Sole native ProductStore/session and MCP authority prohibit a naive second host

`platform/product/store.ts:16-40` constructs exactly one adapter. On SQLite, binary, media, skill and MCP services close over that actual driver's `getSession` (`:21-28`). The driver memoizes `bridge.open()` (`native.ts:326-336`). That is essential ownership, not a cheap independent client factory.

Rust ProductBridge keeps one worker and one MCP service (`desktop.rs:24-32`); `full_product_worker` returns the same current worker (`:52-81`). `product_store_request(Open)` invalidates MCP, skill import, previews and local media (`:260-280`), then `Request::Open` calls `reset_session` (`full_product_store/mod.rs:325-344`), clears contexts/claims and rotates session/generation. Therefore opening a second renderer/Node ProductStore is destructive to the existing host even if both point at the same SQLite file. It is not an independent harmless query client.

The native command trusts only the bundled main WebView (`desktop.rs:772-785`) and actual store session. Destroying that window closes the product worker and services (`:1887-1891`); a document page load invalidates media/skill/MCP authority (`:1893-1905`). Retaining the same sole WebView/session preserves this established boundary. Explicit application Quit needs a real app-level shutdown path; don't infer drain from a renderer unload promise.

E10 feature owner identity is tied to the installed host object (`mcp/runtime/owner.ts:8-17`). Run registry materialization uses the saved immutable manifest but checks live connection generations on preview/claim (`runRegistry.ts:16-28, 43-52`). MCP tool preparation retains ephemeral exact scope/arguments authority (`mcp/runtime/tools.ts:24-49`); snapshots confer no authority. Original uncertain invocation readback is keyed by the actual live host and exact ProductStore/context (`executionOwner.ts:17-32, 53-67`). A retained app service naturally preserves these objects. A fresh process/host session cannot recreate them just from durable server/run/call IDs.

### 8a. Quit ordering, dependencies and an honest force-exit fallback

Use one native-issued finite quit intent bound to the current app/store generation and exact renderer host. Repeated Quit requests attach to that same intent, and duplicate acknowledgements are idempotent; a stale generation/window cannot authorize exit or reset another owner. Native must retain its cleanup ownership when JavaScript never acknowledges. This is a lifecycle handshake, not a new arbitrary renderer invoke proxy.

Required order:

1. **Close admission synchronously.** Gate Send/retry/resume/approval-then-resume, generation start, local import start and MCP connect/login/configuration actions at their actual shared owners. Capture the current exact invocation/work handles at that boundary. A React disabled prop alone has a same-tick race. Pending initialization/queued requests count as owned work too.
2. **Signal all captured owners before awaiting any one of them.** Abort exact model/core controllers, pause exact video/audio workers, cancel exact local media operations, and stop exact MCP invocation identities. Keep the original `done`/publication promises. Waiting for A before signaling B can delay indefinitely behind B's current native/network resource.
3. **Allow stop/status and ProductStore publication to finish.** Keep the actual store session/driver and necessary original MCP receipt paths usable until run/job/import settlement and writer flush have returned. Do not call `db.open`, close the worker, destroy the main WebView or invalidate the generation in this interval.
4. **Dispose shared transports/connections and obtain actual native drainage.** After work has had its original stop/readback/publication path, retire connections, OAuth listeners, processes, previews and binary staging via the actual owners. Repeat a draining read/dispose against the same owner rather than creating a new quit operation. Native closes the worker after publication/drain, then exits.

MCP has a concrete dependency hazard: `mcp/runtime/tools.ts:92-113` attaches an abort listener that calls `host.stop(original.identity)` and then publishes the original result/status. `nativeMcp.ts:181-193` also forwards abort to that exact stop operation. Rust `Action::Stop` cancels only the original invocation token and returns its retained receipt or unknown (`mcp/service.rs:770-784`); it does not promise the remote effect was undone. **Calling `clearMcpHostServices`/`dispose` first marks the host closed**, causing subsequent normal `stop`/`invocationStatus` calls to reject (`nativeMcp.ts:42-60, 197-212`). Therefore do not clear the installed host merely to stop an invocation while its original ledger publication still needs the host. App-wide admission may close while its original stop/status lanes remain usable. If design chooses concurrent global disposal to break a stalled native operation, explicitly add/support a stopping phase that permits only the exact retained status/stop receipts, or accept conservative unknown settlement; do not claim the existing closed API supports that ordering unchanged.

E08 uses the same original-operation discipline: `library/services/desktopMediaImport.ts:48-77` handles cancel-before-reservation by checking/canceling the exact operation while its original producer remains pending, then drains the current operation. Import preserves serialized state writes, stop request, original operation and staging cleanup (`:143-230`). `stopDesktopMediaImport` currently only signals its controller (`:274-277`); app Quit needs its actual owning completion, not that boolean. A canceled picker and a decoder child process also have actual native owners, so do not assume an AbortController proves the system dialog/process exited. E07 native availability has no cancel handle and must finish its current actual await before partial publication (`agent-jobs-results.md:132-139`).

If normal shutdown cannot obtain truthful drain within a finite user-facing wait, retain the same quit intent and expose a minimal actionable choice to continue waiting or explicitly force exit. Force exit is a real forced process termination: show that unfinished/external results may remain unconfirmed, preserve whatever checkpoints/unknown records are already durable, and rely on the existing cold-start local reconciliation without replay. Never translate elapsed time, a missing renderer acknowledgement or a force-exit click into `drained`, `completed`, remote cancellation or known rollback. Dirty manual business drafts keep their existing protection before normal irreversible exit; hiding the window is not Quit and should not run this drain sequence.

### 9. What shares between Web and desktop, and what Node cannot reuse unchanged

| Layer | Retained app realm | Independent JS/Node process |
| --- | --- | --- |
| Public core and providers | Reuse existing emitted exports unchanged. | Portable algorithms can run there; this does not supply product bindings. |
| App execution service / commands | Share per-thread intents, ownership, subscriptions and explicit actions in Web and desktop. Web lifetime ends with its document. | Service logic can be made portable, but needs an explicit non-browser lock manager, current credential/store ports and subscription protocol. |
| ProductStore / transactions | Reuse the sole existing db and same StoreTx graph. | No second open or direct SQLite mirror. Needs sole store/session owner plus an authenticated bounded IPC proxy and notifications preserving operation certainty. |
| Transport | Reuse `runtimeFetchFor`, HTTP authorization and current native plugin transport. | `runtimeIdentity.ts:2-6` sees no Tauri window and silently chooses browser/global fetch; `runtimeFetch.ts:307-317` requires window native invoke. Must implement an actual trusted transport port with the same authorization, abort/body cleanup and no replay. |
| Current credentials | `createRunCredentials` resolves actual current saved key on every dispatch (`runCredentials.ts:7-27`). | Cannot ship a frozen key in a start message and claim equivalence. Needs fresh resolution, changed connector checks and redaction over the original invocation lifetime. |
| Reference materialization | Reuses managed binary read leases and current project/run/attachment validation (`referenceWire.ts:20-58`). | Existing module imports ambient db (`:4`) and native binary services. Needs scoped binary/reference ports; sending persisted image IDs or broad filesystem paths is insufficient. |
| Business tools | Existing `BUILTIN_TOOLS` imports real vertical feature implementations (`runtime/tools.ts:3-21`). | These implementations transitively import current store, native platform services and media engines. They are not made Node-ready by moving `executeRun`. |
| Audio decoding/media | Existing actual DOM/Web Audio/native facilities remain available in the retained realm. | Audio generation imports actual decoder (`audio/generation/runtime.ts:31, 40-44`); any Node decoder replacement must preserve actual acceptance/evidence, not a fabricated decoder stub. |
| MCP | Same host, catalogue/private owner, connection generation and original receipt identity. | Native service port currently requires trusted main WebView/session. Need an independently authenticated host principal and lifecycle, never arbitrary renderer IPC or reconstruction from saved facts. |
| Composer / navigation | UI retains editing; submitted snapshots hand off to the service. | React/router/hooks do not belong in the process. A separate wire must not serialize closures, draft hook objects or resource authority. |

The independent example/portable core is useful evidence of algorithm reuse, not proof that this product's full creative tools, Tauri HTTP, SQLite session and E10 authority can be moved as one import. No external worker architecture is needed merely to run two conversations in the one retained application.

### Minimum proposed contracts (planning, not existing public API)

Keep the concrete feature names/types narrow; the following describe responsibilities rather than prescribing a generic service container:

1. App-owned execution service created with the fixed ProductStore and named runtime/lifecycle dependencies once, initialized before route work. It owns an admission-open/closing state and memoized recovery/shutdown promises.
2. `submit` consumes an already captured exact scoped intent and synchronously reserves its per-thread token/admission IDs and observable attempt. Duplicate same-thread gestures return/refuse before the first await; another conversation is independent.
3. Named `retry`, `resolveApproval`, `resume`, `cancelSavedRun`, `checkAdmission` and `recoverAdmissionState` commands validate explicit identities and call the current command/runtime semantics. Read/check/attachment never dispatches implicitly.
4. `snapshot(threadId)` and `subscribe(threadId, listener)` expose frozen state; optional lightweight aggregate execution-state subscription feeds the sidebar. UI selection/unsubscribe is not owner lifecycle.
5. `requestStop(threadId, invocationId)` is synchronous and repeat-safe for the exact owner. Its original completion/drain promise remains retained until final persistence. A late A Stop cannot cancel a newer A generation or B.
6. Existing named generation workers register exact lifecycle handles without changing their admission/approval policy or nesting another same-thread lock. Shutdown waits these original completions.
7. `shutdown(reason)` closes admission synchronously, signals all current owner kinds, waits their actual final flush/drain, then disposes shared host resources through their established contracts. Native explicit Quit coordinates this operation with bounded original identity/acknowledgement and still performs native cleanup if the JS owner is unavailable. Timed-out cleanup is not success and never authorizes replay.
8. Reopening the retained window only shows/focuses the same UI and reattaches subscriptions. Full reload/new app startup is a new host session with local reconciliation and zero automatic effect replay.

### Suggested implementation order and necessary validation

1. **Service/ownership extraction with actual flows.** Lift pure submitted/recovery DTOs and headless send/retry/decision flows out of UI. App-level service owns exact per-thread tokens and feedback, with the current core/db binding unchanged. Verify held compatibility/thread-create/begin boundaries, same-tick duplicate Send, A/B concurrent model/tool operations, exact per-thread Stop and final flush, and unknown-admission positive/absent readback with zero duplicate dispatch.
2. **Detach-safe view and batch integration.** Replace page execution refs with subscriptions and named actions, detach UI navigation/draft handoff, remove only execution-leave blocker/cancellation, adopt generation lifetime/drain. Verify A→B/new conversation/settings/project/back/forward, during preparation and actual streaming/approval; no second request or pulled-back route, no loss of optimistic payload/recovery, retained manual editor guards, deletion no resurrection, video/audio accepted work survives page departure.
3. **Native retained lifetime and explicit Quit.** Implement the selected native sole-window/single-instance/tray/reopen lifecycle and app-service shutdown bridge in the native researcher's scope. Verify one unchanged store/MCP session through close/reopen, B unaffected by A Stop, repeated launch has one host/window, zero paid replay on Quit/restart; actual hidden-duration scheduling acceptance on both OSes remains distinct from compile/fixtures. Keep cold-start recovery local and safe.
4. **Sidebar state and read cursors.** Implement trailing running icon plus independent unread marker against real service/durable publications, including inactive selected state/narrow picker. Verify A and B states independently, running+unread coexist, viewed acknowledgement cannot swallow a later unseen revision, title/internal phase changes don't create unread, keyboard/a11y/reduced motion and long titles/actions remain usable. Use actual rendered UI; controlled geometry is not installed-host evidence.

Each stage needs scoped affected source tests/types/lint/architecture review and its own commit per owner cadence. No broad test sweep, whole-app build, packaging or paid live service calls were run for this research. Full gate/installed macOS+Windows acceptance remains in the epic's final batch, and the source/fixture/native-installed claims must remain explicit.

## Related specs and required updates

- `.trellis/spec/studio/frontend/index.md:7-24`: read actual product/storage/native/Agent contracts before changing bindings; both current credential/reference/transport and transaction policy belong to Studio.
- `.trellis/spec/frontend/feature-organization.md:15-24, 55-68`: app composes; runtime/model/commands do not depend on UI; one fixed store and explicit transactions. Any new named cross-feature generation integration/export must update executable ownership policy alongside actual consumers.
- `.trellis/spec/agent-core/library/runtime.md:18-35, 65-87, 94-108`: one actual loop, opaque live ownership, frozen request offer, no product dependencies, no external replay and one conditional terminal writer.
- `.trellis/spec/frontend/agent-execution.md:24-36, 82-103`: current lock/checkpoint/key/deletion invariants remain; route-abort and confirmed-stop-on-departure clauses are intentionally superseded by E11's reviewed lifetime. Update both old sections and acceptance examples, rather than retaining contradictory instructions.
- `.trellis/spec/frontend/agent-thread-reading.md:9-25, 33-40`: keep requested-topic query envelopes and reading behavior; replace only execution-departure clauses. Reading/attachment never acquires/releases execution ownership.
- `.trellis/spec/frontend/agent-send-recovery.md:18-32`: synchronous echo/whole-draft revision, immutable reserved identities, unknown certainty and no automatic dispatch remain. Its page-lifetime statement (`:5`) must explicitly change to the new app/document lifetime.
- `.trellis/spec/frontend/agent-jobs-results.md:5-11, 62-82, 132+`: current foreground lifetime statement must be revised for E11; admission/publication/readback/actual Stop/drain remain.
- `.trellis/spec/frontend/shared-product-storage.md:94-108`: one fixed authoritative owner, private device/Agent tables and no automatic fallback/mirror.
- `.trellis/spec/frontend/agent-mcp.md:63-86, 101-107`: same trusted actual store/session and host/registration/principal identity, real drain, and no authority from snapshots. Update document-teardown assumptions only where the actual new native retained lifetime establishes them.

## External references

No new external API/version claims are used in this internal product-boundary note. The separate native-host research should record the actual pinned Tauri/Wry/WebKit/WebView2 APIs and OS scheduling limitations before choosing/claiming hidden-window lifetime. The code imports public workspace `@cuepoint/agent-core` and `@cuepoint/agent-providers`; no new runtime package or dependency was added.

## Caveats / Not Found

- Research only: no product code changed, tests/builds run, Git operation performed, task activated or implementation architecture approved by this agent.
- The product has no general durable run-owner/epoch field today; current authority is the actual live Web Lock capability plus transactional run/call predicates. Do not introduce a timestamp-based takeover or claim persisted IDs are fencing.
- Browser multi-tab safety still requires Web Locks. Product single-window/single-instance is a desktop requirement; it cannot replace browser coordination or make other-origin tabs share an owner.
- Retained-window feasibility is contingent on real macOS/Windows hidden scheduling/native acceptance. This note deliberately does not equate app process existence or native compiler success with JavaScript progress.
- Quit must not silently convert draining/unknown external work into proven cancellation; E07/E10 original-result reconciliation and cascade deletion semantics survive the change.
- The task's sidebar/read cursor design is coordinated separately. Do not reuse generic `updatedAt`/feedback phases as answer-content read state.

## Planning consistency review (2026-10-16)

Reviewed current `design.md` and `implement.md` Stages 1–2 plus their Quit dependency. The selected service/draft/generation design preserves the important existing contracts. No request to change the selected retained-WebView architecture or 5-second cooperative Quit policy arises from this product review. Three implementation boundaries need explicit handling in the final artifacts/checklists:

1. **Existing manual-draft protection has no app-wide Quit entry.** `app/drafts/useManualDraftGuard.tsx:63-75` installs a router blocker and optional beforeunload; `:78-104` exposes only the individual local request callback. `platform/product/drafts.ts:11-30` aggregates scoped autosave flushes, not every manual dirty editor. “Preserve dirty-editor protection before Quit” therefore needs a finite app-owned registration/aggregate request boundary, including overlays and pending save/conflict state, instead of assuming `AppHandle::exit` will safely run browser beforeunload. The 5-second cooperative grace begins only after this pre-quit decision succeeds; it cannot expire while a legitimate unsaved editor confirmation is open. A canceled existing draft confirmation leaves admission/work running. This is the existing editor guard, not a new execution-leave dialog.
2. **New-effect quiescence is distinct from current MCP disposal/retirement.** Rust `mcp/service.rs:389-399`'s existing `close_admission` marks disposed and retires connections; JS `mcp/runtime/connections.ts:189-197` fences generations and disposes its host, and `nativeMcp.ts:197-212` marks the JS host closed. The planned 5-second grace must not use those termination APIs as a generic quiesce primitive. Add an outer finite action admission gate or a distinct quiescing state that rejects fresh prepare/invoke/connect/login/import work but keeps exact original Stop/status, readback and ProductStore publication available. After original work publishes or the one grace expires, bounded native cleanup can retire/force-exit honestly. Do not blanket-deny `product_store_request` writes while the same channel is needed for ledger/checkpoint/publication.
3. **One more Agent model owner exists: task wrap-up preparation.** `ui/TaskWrapup.tsx:250, 280, 342-350` owns a real controller and aborts it on unmount. Its manual-draft state treats AI `preparing`/operation lock as pending (`:255-264`), so it can still prevent leaving solely because an AI request is running. `runtime/taskWrapup.ts:24-76` issues a model request under the same thread lock and commits its original summary; `:79-87` performs zero-request lock-aware recovery. To satisfy the broad ordinary-navigation/non-abort promise, explicitly retain/register this narrowly named preparation owner too, preserving real manual editing/saving/conflict guards. This need not redesign task review or completion. If intentionally excluded, state the exact retained foreground limitation in PRD/design rather than implying all Agent requests are background-owned. Include its exact original done in Quit and prevent concurrent same-thread admission; avoid recursive thread locking. The sidebar's public-read policy need not invent unread chat messages for a summary that publishes only to a task record.

Additional checklist precision: the retained draft model also owns ongoing reference-import controllers and original async completions (`useReferenceDraft.ts:75-129`). Include them in shutdown capture so an attachment import cannot outlive the five-second grace bookkeeping or start new writes after storage closes. This is separate from E08 desktop-video imports, which already have their original native operation identity.

Necessary bounded review cases: native/menu Quit while a dirty manual editor or pending save is open (cancel preserves live A/B and no grace starts); clean Quit with an original MCP Stop/status/publication still pending (no closed-host regression); A and B while task-wrapup preparation owns A's actual lock (navigation does not stop A, same-thread Send excludes it, B continues); Quit during detached reference import (signal plus original completion or honest forced interruption). No tests/build/dependency/code changes were made during this consistency review.
