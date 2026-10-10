# Final B07 spec readback

Read at 2026-09-30T10:39:28.942257+00:00

Source SHA-256: `27658a7a42120b64838874aa17c23424bae2109aaaa880ed8af88e04aa36570a`

## B07: one compose scope for text and references (2026-09-30)

### 1. Scope / trigger

Within the mounted Agent page, unsent text and attachments belong to the same thread/project session. Changing topics or home project selection must not pair one topic's text with another topic's references. This is in-page retention, not persistence across reload or page unmount.

### 2. Signatures

`useReferenceDraft(scope, projectId?)` owns text, textRevision, attachments and imports. `setText(text)` advances revision on every edit; `capture()` freezes the submitted scope/text/revision/attachments and active import list before any await; send checks that captured list, including imports started before rerender. `moveTo(targetScope, submitted)` transfers captured contents before new-thread navigation and returns the moved submission plus guarded restoration. `acknowledge(submitted)` retires only the submitted owner/version after `beginAgentRun` succeeds. Existing attach/import/retry/cancel/clearSent operations retain their origin scope.

### 3. Contracts

The scope is the existing JSON pair `[threadId ?? 'home', projectId]`. Switching A/B/back restores each session's text and attachments. New topic never clears the old unsent draft merely because creation starts or fails. Preserve the current loaded/routedThreadPending ownership gate.

Capture a send synchronously. If home creation awaits while the user edits, transfer only captured text/references; newer home text remains there. Never overwrite an existing target session, even one edited back to empty. On navigation failure restore only if origin was still the submitted version at transfer and both origin and target text versions remain unchanged afterward; otherwise retain the payload in the created thread and identify its retry location. After navigation, failed begin leaves the payload visible in that thread. Successful begin clears only the submitted text revision and captured reference revisions; it cannot clear later edits or equal text in another thread. Execution transport failure after successful begin follows existing durable-run behavior, not restoration of a sent draft.

Every import success updater preserves compose text/revision and other state fields. Import progress/failure stays in its initiating scope with original File/error/reference resources. Sending blocks all attachment mutations (including removal/cancel), duplicate send and active imports, while text editing remains supported. Existing Web Lock, compatibility check, one-POST execution and route cancellation remain unchanged; assign new execution thread before navigation so the first send does not cancel itself.

### 4. Validation / error matrix

| Scenario | Expected outcome |
| --- | --- |
| A text/reference → B → A | A restored; B has independent draft |
| Home project A → B | Separate text/reference sessions |
| New-topic creation fails | Original unsent draft unchanged |
| First-send creation fails before transfer | Origin retains payload |
| First-send navigation fails | Guarded restore or explicit retained-thread location; no overwrite |
| Begin fails after navigation | Created thread retains exact unsent payload for retry |
| Begin succeeds after text edit/revert | Edited version retained, even if string equals submitted |
| A begin succeeds while B has equal text | Only A's captured version may clear |
| Import completes after scope change | Updates origin references only; preserves compose text/revision |
| Existing target session | Transfer rejects instead of replacing it |

### 5. Good / base / bad cases

Good: sending home text A, typing B during thread creation, then beginning A leaves B in the home session. Base: unchanged text is cleared only when begin commits. Bad: one global text state, unconditional new-topic clearing, transferring the entire latest home draft or clearing current text by string equality.

### 6. Required tests

Execute actual page and compose-hook callbacks with deferred creation/begin/navigation: A/B/back, home project change, same-render edits/send, equal-string different owners, edit/revert, successful acknowledgement and each failure boundary. Assert actual persisted message/run contents where feasible. Exercise asynchronous reference import success/failure/cancel/unmount and retained resources; attachment lock and existing loading gates must hold. Simulated route props/callbacks do not establish actual browser history event delivery; browser coverage and mocked transport limits must be explicit.

### 7. Wrong vs correct

Wrong: `setDraft(current => current === capturedText ? '' : current)` against the currently displayed global draft. Correct: acknowledge the frozen compose scope and text revision after the original begin succeeds, retaining all newer or unrelated sessions.
