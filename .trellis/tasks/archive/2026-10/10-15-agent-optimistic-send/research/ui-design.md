# Research: Optimistic send presentation and compose ownership

- Query: Find the smallest UI change that immediately displays submitted text and exact references before asynchronous preparation, preserves the first home send's execution owner, reconciles durable acceptance without duplicate rows, and recovers failures without replacing newer drafts.
- Scope: internal; shared Studio Agent UI, compose state, actual router and existing focused tests. No product code or task state changed by this research.
- Date: 2026-10-15

## Design review resolutions

The owning design strengthens two recommendations below: the attempt is registered before yielding a bounded browser rendering opportunity, because a queued React update alone does not prove it appeared before request dispatch. Also an absent read after unknown commit never establishes rollback in this delivery; only positive matching acceptance resolves uncertainty. These decisions in `../design.md` take precedence over preliminary scheduling or negative-reconciliation suggestions below.

## Findings

### Current owners and source anchors

| File | Existing responsibility / relevant location |
| --- | --- |
| `packages/studio/src/app/routes/_studio.agent.tsx:9` | The `/agent` parent route renders one `AgentChatPage`; route parameters change its props. Home/detail navigation need not remount the execution owner. |
| `packages/studio/src/features/agent/ui/AgentChatPage.tsx:60` | Stable outer shot-detail and activity providers contain `AgentChatInner`. Keep these owners above all provisional presentation. |
| `packages/studio/src/features/agent/ui/AgentChatPage.tsx:163` | Messages are observed for the routed thread; the final renderer filters stale retained results to that exact ID at line 726. |
| `packages/studio/src/features/agent/ui/AgentChatPage.tsx:233` | One `useReferenceDraft` owns text and references under JSON `[threadId ?? 'home', projectId]`. |
| `packages/studio/src/features/agent/ui/AgentChatPage.tsx:381` | Send captures a reference/text snapshot and synchronous guards, then acquires execution before the first awaited flow at line 407. Currently only the send state changes before preparation. |
| `packages/studio/src/features/agent/ui/AgentChatPage.tsx:525` | `routedThreadPending` returns a whole-workspace loading screen. It can hide the provisional first send during home-to-thread observation lag. |
| `packages/studio/src/features/agent/ui/AgentChatPage.tsx:585` | Composer attachment callbacks already use the synchronous send lock; text remains editable at line 672. |
| `packages/studio/src/features/agent/ui/AgentChatPage.tsx:700` | Home/detail branching and `ChatWorkspace key={activeThreadId}` belong to presentation, below all runtime and draft hooks. |
| `packages/studio/src/features/agent/ui/useChatExecutionSession.ts:19` | Thread changes abort when the execution-thread ref differs. `acquire` establishes the duplicate-gesture lock synchronously at lines 22–30; `release` guards controller plus epoch at lines 32–37. |
| `packages/studio/src/features/agent/ui/chatExecutionFlows.ts:73` | Compatibility wraps creation, thread lock, navigation, atomic begin and execution. Preserve this order and ownership. |
| `packages/studio/src/features/agent/ui/chatExecutionFlows.ts:89` | Bind the created execution thread before navigation. Existing `moveTo` places submitted contents back into the destination composer at line 101; acknowledgement currently waits for begin at line 133. |
| `packages/studio/src/features/agent/ui/useReferenceDraft.ts:23` | Mounted-page map, synchronous `currentDrafts`, text revision and import controllers. No text/reference draft persistence across reload. |
| `packages/studio/src/features/agent/ui/useReferenceDraft.ts:55` | `capture` copies text and arrays before waiting; `acknowledge` at line 144 retires only matching text revision and exact reference revisions. |
| `packages/studio/src/features/agent/ui/useReferenceDraft.ts:152` | `moveTo` preserves newer home edits and refuses an existing destination compose session, including a session edited back to empty. Restoration checks both owners' versions. |
| `packages/studio/src/features/agent/ui/ChatWorkspace.tsx:18` | Rich `MessageList` is lazy. Lines 119–128 show a generic loading fallback, which alone cannot satisfy immediate submitted-payload visibility. |
| `packages/studio/src/features/agent/ui/HomeWelcome.tsx:46` | Entry hero, composer and recent work; no transcript. A home pending submission needs a conversation presentation before a durable thread exists. |
| `packages/studio/src/features/agent/ui/MessageList.tsx:61` | Scroll/turn identities derive from durable user IDs; new user identity resumes bottom-following at line 75. Rows are keyed by `message.id` at line 128. |
| `packages/studio/src/features/agent/ui/MessageList.tsx:182` | User bubble uses `ReferenceMessageSources` and rich Markdown. It does not currently carry provisional failure/retry controls. |
| `packages/studio/src/features/agent/ui/ReferenceAttachments.tsx:105` | Existing compact reference chips can display the exact captured `referenceId/revision` without fabricating selected-reference coverage. |
| `packages/studio/src/features/agent/ui/FloatingComposer.tsx:190` | `sending` disables another send; textarea remains writable at lines 358–367. Do not turn next-draft editing into a message queue. |
| `packages/studio/src/features/agent/commands/agentRuns.ts:112` | Durable user ID is allocated only inside atomic begin today. Lines 187–207 create the user, assistant and run together. Caller-preallocated identity is a command-contract change, not a new message schema. |
| `packages/studio/src/features/settings/models/connectors.ts:73` | `runWithCompatibleChatModel` performs compatibility and frozen-selection checks before invoking any mutation/transport. |
| `packages/studio/src/app/details/ShotDetails.tsx:10` | E01 shot provider retains the active detail target independently of transcript presentation. Preserve its position and identity. |

### Recommended minimal state ownership

Keep optimistic attempt state inside the existing mounted `AgentChatInner`, optionally extracted into one local hook/controller for testable transitions. Do not put presentation attempts into ProductStore, create a second durable store, add a global state library or introduce a submission queue.

An attempt needs an immutable payload and explicit acceptance state. Suggested shape, with naming adaptable to the admission research:

```ts
type SendAttempt = {
  id: string;                    // also the stable client admission identity
  userMessageId: string;         // allocated before awaiting; canonical join key
  originScope: string;
  projectId?: string;
  threadId?: string;
  createdThread?: ChatThread;    // exact create receipt, only for bootstrap handoff
  submitted: SubmittedDraft;    // raw text, exact reference revisions, draft revision
  content: string;               // existing canonical trimmed request content
  createdAt: string;
  phase: 'preparing' | 'admitting' | 'failed' | 'uncertain' | 'accepted';
  recoveryRevision: number;      // revision immediately after consuming the draft
  runId?: string;
  assistantMessageId?: string;
  message?: string;              // friendly, sanitized local failure explanation
};
```

Keep credentials out of the presentation record. The already-captured connector closure can serve the existing execution flow; the UI needs connector/model identity for scope checks, not an API key snapshot.

One in-flight admission is enough: keep `useChatExecutionSession`'s synchronous lock, controller and epoch. Retained failed records are recovery candidates, not queued work; nothing retries from an effect, reload, focus event or arrival of a newer draft. If multiple failed candidates can coexist, retain them by attempt identity until explicitly retried, restored or dismissed instead of silently replacing one with the next send. An unresolved uncertain attempt blocks re-admission of that same intent until authoritative reconciliation completes.

### Send sequence before the first await

1. Capture immutable text/references/import state and the current intended scope/selection before waiting.
2. Keep the current synchronous empty/import/project/connector/ownership guards. Invalid gestures do not manufacture provisional messages.
3. Acquire the existing execution token. A second gesture in the same tick must return because the ref lock is already held.
4. Allocate admission/user-message identity and publish the attempt synchronously.
5. Consume only this submitted compose revision and exact attachment revisions, leaving an independent editable next draft.
6. Enter the existing compatible-model → create thread if needed → thread ownership → atomic begin flow. Public preparation labels can remain minimal, such as `正在发送…`; E03's broader status design is outside this task.

React batching the state changes is sufficient; `flushSync` and timeout-based scheduling are not required. The next render must contain both the captured submission and the cleared/next composer even when the first awaited operation never resolves.

### Draft APIs and failure restoration

`acknowledge(submitted)` already has the right exact-reference removal and text-revision guard for consumption. Adapt or wrap that operation with a deliberate name such as `consumeSubmitted(submitted)` and return a restoration token. Do not acknowledge again after begin: the attempt already owns the submitted payload, and a second delayed clear can affect later draft state.

Add an internal whole-draft mutation revision for restoration. Current `textRevision` changes only in `setText`; attach/remove/import updates do not advance it. A recovery check based solely on text or `text === ''` can overwrite an edited-then-cleared draft or restore stale references over newer reference selection.

Suggested narrow APIs:

```ts
consumeSubmitted(submitted): { scope: string; revision: number };
restoreSubmitted(submitted, expectedDraft): 'restored' | 'draft-changed';
reserveDestination(scope): void; // if needed; preserves existing no-overwrite policy
```

`restoreSubmitted` performs one synchronous compare-and-swap against the targeted scope and the post-consumption whole-draft revision. It restores raw submitted text plus exact references only when that destination is still the same empty compose version. On `draft-changed`, keep the recovery candidate intact and explain that current draft text must be handled first. Do not append automatically, merge two different revisions of one reference, clear newer text, or change the currently displayed owner to force restoration. A later explicit invocation may capture a new empty destination revision after the user chooses what to do with the newer draft.

Retry of a definitely unaccepted submission uses the retained immutable payload and same client admission identity, not the current composer capture. It must reconcile first, preserve newer compose edits and acquire the same synchronous execution lock. Once acceptance exists, offer the existing durable run's recovery controls rather than admitting another user turn.

For aborted preparation or a selection change, retain a canceled/recoverable candidate or perform only a successful revision-checked restore. Never silently clear it. The existing abort semantics of genuine route departure remain authoritative.

### Home first-send handoff

The actual route already has a stable runtime owner: `_studio.agent.tsx` renders `AgentChatPage` in the parent route, while `threadId` changes as a prop. Keep `AgentChatPage`, `AgentChatInner`, `ShotDetailsProvider`, `useReferenceDraft` and `useChatExecutionSession` unkeyed and mounted throughout the handoff.

When home has a visible attempt, render conversation presentation immediately instead of waiting in `HomeWelcome` for creation. That workspace can display the provisional row with no durable thread ID; it must not create a fake ProductStore thread. After successful creation, bind `executionThreadRef.current` to the returned thread ID before route navigation, and update the same attempt's thread association synchronously.

Do not reuse the current `moveTo` unchanged: its destination text/reference payload would reappear in the composer after it has already been submitted. Transfer the attempt's ownership/display location, while the immutable payload stays in the recovery candidate. Preserve the existing B07 decision that a newer home draft typed during creation remains in the home compose scope; returning home restores it. Destination composer starts empty and remains independent. Refuse to overwrite a previously existing destination compose session, including an empty session with an edit history.

During known first-send route hydration, use the exact `createChatThread` receipt only to retain the matching provisional workspace until the current-thread query catches up. Narrow this exception to the current attempt's exact created thread and project. Keep the normal `loaded` and unrelated `routedThreadPending` gates; a matching loaded `null` or confirmed deletion is not permission to resurrect the retained thread. A generic `|| pendingAttempt` bypass would be too broad.

`ChatWorkspace key={activeThreadId}` currently resets presentation at the handoff. Runtime safety does not depend on that key, but preserving a stable presentation session across the synthetic-to-durable transition avoids needless composer/transcript churn. Either retain one attempt-derived presentation key until that conversation is actually left, or remove the key and explicitly reset presentation-only state on genuine topic changes. Do not change it a second time merely because the provisional record is retired after observation. Avoid reparenting or keying E01's shot detail provider as part of this optimization.

If navigation fails, keep the attempt associated with its exact created thread and visibly recoverable from the origin, without putting its old payload over newer origin text. If creation/lock fails before handoff, retain the attempt in the origin scope. Existing cleanup may remove only a thread this call created and only when no durable run exists; uncertain acceptance must be reconciled before cleanup.

### Transcript and lazy loading

Passing a synthetic `ChatMessage` into `MessageList` alone does not satisfy immediate visibility: on a cold home send, rich Markdown code may still be loading. Preserve the lazy import and provide a small eager provisional row that draws captured text as plain pre-wrapped text plus existing reference chips and one status/recovery line. It must not import `AgentRunDetails`, `AgentMarkdown`, syntax/diagram renderers or the complete MessageList graph.

Use the same lightweight provisional row in the rich transcript and in its Suspense fallback. Keep it inside the existing `.agent-message-list` / `.agent-content` geometry, so composer safe area, scrolling and the 800px content width remain correct. Do not draw a second copy outside the transcript while the rich list already contains the canonical matching row. Only the pending/failed row needs this eager rendering; ordinary historical messages remain behind their existing rich boundary.

The source snapshot preserves raw submitted text for recovery. Visible text can use the same canonical trimmed content that `beginAgentRun` currently writes. Attachment-only submissions show their exact chips while preparing; do not fabricate a selected-reference coverage record or claim the model already received/read them. Canonical attachment-only fallback wording is owned by admission at `agentRuns.ts:101`.

Do not render provisional records as completed durable history or feed them into context preparation. Prefer separate `attempts` props plus a pure projection over actual `ChatMessage` records. This keeps presentation-only statuses outside the persisted `ChatMessageStatus` union and avoids a schema change.

### Durable reconciliation without duplicate/flicker

Preallocate a canonical `userMessageId` before waiting and supply it to the atomic admission command. Reconcile by exact identity, thread and project ownership; never match equal text, adjacent timestamps or the newest user bubble. All durable messages remain created by the existing transaction.

Expose admission callbacks from `executeNewChatMessage`, such as `onThreadReady(thread)` and `onAdmitted({run, userMessage})`, at the actual boundaries. The function currently resolves only after `executeChatRun` completes, so its final return cannot be used as the acceptance signal. Call `onAdmitted` immediately after successful begin and before dispatch, independently of whether the next live query has arrived.

Projection rules:

- Before acceptance, render one provisional row keyed by the canonical user ID.
- If the durable message observation wins the race with the command acknowledgement, its exact ID suppresses the provisional copy immediately. Keep admission reconciliation separate from its display.
- If the acknowledgement wins the race with observation, retain the captured/returned accepted user row until the same durable user record is actually present in the rendered list. Do not remove the provisional row merely on Promise resolution and reveal a blank gap.
- A run observation without its corresponding user-message observation is insufficient to remove the only visible user row. Observation streams can arrive in different turns.
- Once the canonical row is present, retire the presentation candidate without changing its user identity or creating a second turn-navigation anchor. New-user scrolling happens once; later accepted status updates must not repeatedly force scroll-following while the user reads older turns.
- Never restore a sent draft or offer another admission retry after acceptance, even if subsequent model execution fails. Reuse existing run/assistant failure and recovery UI.
- An admission rejection with an indeterminate store outcome shows `正在确认发送状态…` / an explicit local failure to check; disable re-admission until an authoritative query distinguishes an existing run from confirmed absence. Do not turn a failed read into absence.

The exact query/receipt/idempotency API is shared with the admission research; this UI proposal assumes it can distinguish accepted, confirmed absent and unknown. A plain `catch` around begin cannot safely choose between those outcomes.

### Necessary verification only

Use the existing B07 deterministic production-callback host as the main fast seam and update expectations that intentionally change from composer retention to a separate failure candidate. Do not delete existing owner/revision/import assertions to obtain a pass.

1. Hold compatibility, creation and begin separately; immediately after calling send, assert exact provisional text/reference revisions, empty independent composer and one locked intent before resolving any gate.
2. Call the same captured send callback twice in one tick; one attempt, one begin and at most one model dispatch result.
3. Type the next draft while each boundary is held, including edit/revert and edit/clear. Acceptance, failure, retry and restore preserve that newer revision. Exercise attachment mutation in the full-draft restoration comparison too.
4. Home creation handoff retains the same execution owner/controller; binding precedes navigation and its signal remains live. Destination composer never repopulates the already-submitted payload. Returning home retains newer home text.
5. Fail preparation/create/lock/navigation/begin independently; the recovery candidate keeps exact payload and origin/target. Successful guarded restore does not remove other scope data. Existing destination draft still refuses overwrite.
6. Resolve durable observation before receipt and receipt before observation; a pure projection test asserts one canonical user row and no blank gap. Include identical text from unrelated attempts/threads and out-of-order run/message observation.
7. Simulate committed begin plus lost acknowledgement and an unavailable reconciliation read; admission stays unknown, no second POST starts and no draft restore occurs. After accepted status is recovered, subsequent execution failure remains durable-run recovery.
8. A small actual ReactDOM/browser check is warranted for the cold lazy transcript and actual parent-route handoff, because B07 mocks both `HomeWelcome` and `ChatWorkspace`. Reuse the existing fixture approach with held rich import/creation; verify captured payload is visible while rich content is unavailable, one Agent owner survives navigation, and an E01 open detail remains mounted/running. This can be a bounded focused fixture rather than a full-app E2E project.

Existing `tests/b07ComposeSessions.test.ts:199` already covers home-to-created transfer; lines 333–360 cover attachment locks, same-render capture/import and empty-but-edited destination; lines 363–368 distinguish execution failure from admission failure. `tests/fixtures/b07/harness.tsx:30` retains one Agent owner across real browser history, but `surface.tsx:5` explicitly simplifies presentation, so it cannot establish rich lazy fallback rendering. Keep that limitation explicit.

Only run focused changed tests, relevant existing Agent/reference regressions, touched-source lint/type checks and the bounded browser case needed for these specific UI boundaries. Per the owner's 2026-10-15 direction, defer full suites, native acceptance, production builds and packaging until the whole epic is ready.

### Related specs and required follow-through

- `.trellis/spec/frontend/agent-references.md:153` is the active B07 ownership/revision contract. Update its consumption/clear-after-begin wording to the accepted E02 attempt-transfer contract while preserving scoped drafts, exact references and origin-bound imports.
- `.trellis/spec/frontend/agent-execution.md:19` preserves transaction ownership, current credentials, one-POST dispatch and no automatic uncertain replay.
- `.trellis/spec/frontend/chat-performance.md` preserves scroll intent, memoized history and the rich transcript lazy boundary; add the eager provisional fallback and stable canonical user identity behavior there or link one new E02 contract.
- `.trellis/spec/frontend/hook-guidelines.md` requires keyed dependency envelopes and explicit error handling where observation can fail; do not accept stale/null or failed reads as current ownership/absence.
- `.trellis/spec/frontend/agent-business-details.md` retains E01's provider/editor lifecycle through width changes and provisional conversation updates.
- `.trellis/spec/frontend/quality-guidelines.md` prefers real command/pure/callback tests, with bounded browser evidence when the actual lazy/router boundary cannot be established there. The owner's reduced per-phase validation scope overrides broad per-phase build/gate wording for this epic.

### External references / versions

No external research was required: the question is about the checked-out implementation and current local contracts. `packages/studio/package.json` declares React/ReactDOM `^19.1.1`, TanStack Router `^1.131.50`, and shared Studio version `0.1.3`; these are declared ranges, not a claim about resolved lockfile versions. No dependency or persistence-schema change is proposed.

## Caveats / Not Found

- The UI code currently has no stable client-admission identity or authoritative lost-ack receipt. That command/transaction contract must be supplied by the admission implementation; a UI-only catch-and-resend change cannot satisfy E02-AC4.
- `textRevision` alone is insufficient for whole-payload restore. The new revision should remain internal mounted-page state, not become an unsought durable draft schema.
- Existing draft retention explicitly ends on Agent-page unmount/reload; E02 can retain this lifetime. Do not promise crash-proof unsent/recovery drafts or add cross-reload text persistence without a separate decision.
- A stale or unresolved matching query is different from confirmed deletion. Limit the known-created-thread hydration handoff; preserve normal missing-thread routing.
- This research inspected sources and tests; it did not execute tests, a paid provider, native runtime or packaged acceptance.
