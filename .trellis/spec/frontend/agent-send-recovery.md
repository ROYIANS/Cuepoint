# Immediate Agent send and recovery

## 1. Scope / Trigger

Apply [Interaction Feedback](./interaction-feedback.md) to user-facing labels and recovery actions. Read before changing Send, compose consumption/restoration, first-message home navigation, local submission presentation or admission reconciliation. E02 changes the submitted draft into a local attempt before asynchronous preparation. Attempts have the mounted Agent page's lifetime; they are neither durable messages nor a reload-safe outbox.

## 2. Signatures

- `ChatAdmissionIdentity = Readonly<{ runId: string; userMessageId: string; assistantMessageId: string }>` in `features/agent/models/chatSubmission.ts`.
- `createChatThread(options?: { id?: string; /* existing options */ }, store?)` accepts a caller-reserved thread ID and preserves legacy callers.
- `beginAgentRun({ threadId, connector, model, content?, attachments?, admission?, expectedOwner?: Readonly<{projectId?: string}>, retryOfRunId?, ... }, store?)` accepts optional fresh-turn identities. `admission` cannot accompany `retryOfRunId`.
- `readAgentAdmission({ threadId, admission, connector, model, content, attachments?, projectId? }, store?)` in `features/agent/queries/agentAdmission.ts` returns `{ status: 'absent' }`, `{ status: 'mismatch' }` or `{ status: 'accepted', run, userMessage, assistantMessage }`.

These are feature-private contracts. They add no schema, provider protocol, environment key or shared-core dependency.

## 3. Contracts

Before the first await, validate the gesture, claim the existing synchronous send lock, capture exact text/reference revisions, reserve identities, register the local attempt and consume only the submitted snapshot. Give the browser a bounded rendering opportunity before compatibility discovery or storage preparation. Preserve synchronous capture of imports started before rerender.

Normal preparing/accepted user bubbles show submitted content without transient side text such as 正在发送 or 已发送正在载入. Keep user-facing copy tied to a visible result or necessary action, rather than naming storage/hydration/state-recovery internals. Normal progress belongs to the composer/owned execution strip; only actionable failure, uncertainty/checking and explicit state-recovery controls appear beside a user message (owner correction 2026-10-15).

Show exact submitted text and attachment descriptors through an eager lightweight view, including while the rich transcript is loading. Home immediately presents the conversation workspace. Bind the created thread before navigation; only the exact owned creation receipt may bridge its query hydration. Ordinary missing or foreign routed threads keep their existing gates. Do not remount the execution owner when the provisional workspace becomes a real thread.

A new draft is independently editable. Later text typed on home remains in that home/project scope. Recovery compares the consumed whole-draft generation, including text edits back to empty and reference/import mutations, rather than text equality. A failed restoration keeps the attempt available and never replaces a newer draft. Retain earlier failed payloads when another submission starts.

Join local and durable messages by the reserved `userMessageId`. Command acknowledgement alone does not remove an echo before observation; durable observation suppresses a stale local echo immediately. Model execution failure after known admission belongs to the durable run UI and cannot restore an already-sent draft.

Fresh IDs are nonempty strings of at most 256 characters, contain no whitespace or Unicode control characters, and are distinct. Writes remain create-only inside the original atomic transaction. E02 supplies `expectedOwner: {projectId}` even when unbound, and begin checks it against the actual thread inside the same transaction. Capture that optional object before preparation; omission preserves legacy callers. An existing ID cannot be treated as successful idempotent admission, because callers could dispatch that existing run again. Durable regeneration continues to use its separate `retryOfRunId` contract.

Reconciliation reads the owning thread and all three records inside one read-only transaction. Validate thread/project ownership, role and run/message pointers, frozen normalized connector/model, normalized effective user content and ordered reference ID/revision pairs. `projectId: undefined` intentionally means an unbound thread. All three rows absent means `absent` if the thread is missing or its owner matches; an existing foreign-owner thread, partial records or foreign records mean `mismatch`. A separate read does not replace begin’s atomic expected-owner check.

Unknown storage certainty is not rollback. Preserve an uncertain attempt and allow read-only status checking. A positive matching read establishes admission and preserves an explicit local recovery control alongside the canonical user row; it never dispatches the run. An admitted `running` row may have no live owner because its acknowledgement failed before dispatch. Do not retire that control merely when MessageList observes the user. An explicit 查看恢复选项 action acquires the existing thread ownership/recovery path without a model request, then exposes normal interrupted regeneration/tool resume controls. It must refuse a competing live owner and cannot automatically run from observation or a status read. An absent read cannot resolve unknown certainty or authorize another write, deletion, restoration or paid request. Only an explicit retry of a proved rollback may re-admit, after a fresh read and under the original execution/compatibility guards. Never persist credentials in an attempt's display model or reconciliation payload.

## 4. Validation & Error Matrix

| Boundary | Required result |
| --- | --- |
| Compatibility, creation or begin delayed | Exact lightweight submission visible; newer compose draft editable |
| Known preparation/rollback failure | Recoverable failed attempt with explicit retry/restoration |
| Whole draft changed after consumption | Restoration refuses overwrite and retains failed payload |
| Stop before known admission | Recoverable unsent payload; no model dispatch |
| Stop after known admission | Existing authoritative run settlement and final flush |
| Lost acknowledgement / unknown commit | Uncertain attempt; read-only check; no implicit resend or cleanup |
| Unknown followed by absent/failed read | Remains uncertain |
| Positive matching admission read | Join existing durable records; no automatic execution |
| Duplicate/reserved/partial/foreign identity | Atomic refusal or mismatch; no second turn |
| Late observation or acknowledgement | Exactly one bubble by canonical user ID |
| Scope changed during async work | Old completion cannot replace the current draft or conversation |

## 5. Good / Base / Bad Cases

Good: send A from home, type B while creation waits, see A throughout handoff, and find B in the original home draft. Base: the submitted snapshot clears immediately, the durable counterpart later replaces its echo once, and the provider receives one request. Bad: wait for discovery before showing the message, erase newer text on a late begin callback, or resend after an absent read of an uncertain commit.

## 6. Tests Required

Use held compatibility/creation/begin boundaries through actual compose/page callbacks. Assert the exact submitted payload and available composer before resolving them; cover same-tick duplicate sends and cold transcript fallback. Exercise home handoff without abort/remount, original home draft retention, failed recovery with text/reference/import changes, edit-back-to-empty and stale callbacks. Test canonical deduplication both before and after acknowledgement.

Real ProductStore tests cover caller-reserved IDs, unchanged legacy admission, atomic duplicate failure, rollback, complete matching acceptance, partial/foreign records and exact attachment revisions. Unknown-outcome flow tests assert zero automatic admission, transport or deletion after status reads, including absent. Keep necessary affected B07 and execution/reference regressions. Distinguish mocked timing/transport evidence from browser paint, native delivery or a live paid service; broad integration/package gates follow the owner's batch cadence.

## 7. Wrong vs Correct

Wrong: clear whichever composer currently equals the submitted string after `beginAgentRun`, or call begin again when an uncertain read returns absent.

Correct: consume the captured scoped revision immediately, retain its local immutable payload, join against the reserved durable user ID, and restore only through an unchanged whole-draft generation. Preserve unknown certainty until a positive owned receipt establishes admission; a retry remains an explicit separate action after proved rollback.
