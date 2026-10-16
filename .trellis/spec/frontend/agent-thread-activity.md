# Agent sidebar activity and observed read revisions

## 1. Scope / Trigger

Read when changing Agent sidebar running/unread indicators, assistant publication,
report completion, thread read acknowledgement or conversation deletion. Execution
ownership remains in [Agent Execution](./agent-execution.md); local viewport
behavior remains in [Agent Topic Reading](./agent-thread-reading.md). Neither a
sidebar projection nor a read receipt grants execution, retry or tool authority.

## 2. Signatures and owners

`features/agent/models/threadActivity.ts` owns strict device-local activity data.
`commands/threadActivity.ts` owns prepared setting identity, transactional reads,
publication and exact observed acknowledgements. The commands are:

```ts
prepareThreadActivityKey(threadId: string): {threadId: string; key: string};
acknowledgeThreadRead({threadId, observedRevision}, store?);
acknowledgeAgentReportRead({threadId, jobId, observedRevision}, store?);
```

The existing `deviceSettings` table stores one bounded record per thread. Ordinary
output uses monotonic `publicRevision`/`readRevision`; `ChatMessage.publicRevision`
stamps the assistant snapshot actually presented. Separate report cursors contain
`jobId`, `assistantMessageId`, `publicRevision` and `readRevision`, bounded by the
existing 128-jobs-per-thread quota. Their publication revision is the accepted
`job.revision`; `job.output.revision` identifies the retained body and is a
different comparison. No table/index/schema version or historical backfill is
introduced.

## 3. Contracts

Prepare a namespaced SHA-256 key from UTF-8 `JSON.stringify(threadId)` before
entering any live transaction, using the existing synchronous hash implementation
and bounded cache. Pass the prepared immutable identity explicitly through nested
writers and settlement. Cache membership is an optimization, never proof that a
caller prepared its identity: unrelated threads may evict it during an await.
Validate the exact original thread ID in the stored value.
Do not encode broad IDs directly in a setting key or await Web Crypto inside
Dexie. Strict reads distinguish genuine missing state from corrupt/unreadable
state; errors cannot silently become an all-read watermark.

Advance ordinary publication only with meaningful assistant content/reasoning,
public activity, actionable approval or the sole accepted terminal/error change.
Write the source row, message stamp and activity revision in the same actual
ProductStore transaction. Expand every initiating and nested transaction scope;
passing a scoped StoreTx cannot grant tables absent from its original scope.
Empty placeholders, user admission, identical checkpoints, timing/metrics,
internal phases and thread title/model changes do not create unread content.

Publish retained-report cursors from the actual accepted `publishAgentJob` and
direct unknown-recovery writers after their original ownership/revision checks.
Progress alone creates no report unread. A later known result for an older
message remains independently unread even when the latest ordinary tail is read.
Explicit clear/delete removes the matching cursor with its source. Late
publication or acknowledgement cannot recreate a missing thread/job/result.
Project deletion retains conversation history but removes project-owned jobs;
remove exactly those report cursors in the original deletion transaction. Prepare
the owned report snapshot before entering the actual atomic tool transaction,
including completed-replay paths, and verify that snapshot against surviving
job ownership before applying deletion.

An ordinary acknowledgement captures the revision represented by the rendered
immutable requested-thread envelope. In one transaction, validate surviving
ownership and safe bounds, then update only
`readRevision = max(readRevision, observedRevision)` when changed. Do not replace
the captured revision with the newest stored one. Report acknowledgement applies
the same rule to its exact surviving original job cursor, leaving ordinary and
other report cursors unchanged. No-op acknowledgements perform no writes or
topic timestamp changes.

Full streaming message/run/tool-call observations belong below the page/composer
boundary. The reader uses one readonly transaction for the exact requested
thread, matching source rows and observed revision. A separately queried latest
revision cannot certify stale message or approval content. The page/composer and
topic rows consume cached semantic state; output/metrics revisions must not
invalidate those boundaries when their relevant semantics are unchanged.

Sidebar busy comes from the live application owner, including real stopping;
saved `running` alone is insufficient. A parked approval is actionable, without
a fictitious running spinner. Unread is ordinary unread OR any unread report.
Cache per-row `busy`, `waitingApproval`, `unread`, availability and exact owner
identity while preserving actual browser/native database observation. Reserve a
fixed far-right hollow spinner and an independent unread dot immediately to its
left. The owner confirmed the far-right placement on 2026-10-16 after observing
the spinner between the title and timestamp. Keep title flexible, timestamp or
sibling rename/delete controls to the left of the reserved status area, and the
spinner at the same right edge during hover/focus/touch at wide and narrow
widths. Motion
preference and accessible state must remain usable without per-token narration.

Changing the requested thread replaces its transcript/read scope, not the
navigation DOM. Do not key the workspace that owns the sidebar by thread ID or
replace that workspace with a loading tree while an already listed thread's
separate detail read catches up. Keep genuine missing/error handling scoped to
the requested thread; retaining navigation cannot authorize stale thread actions.

## 4. Validation and error matrix

| Condition | Required behavior |
| --- | --- |
| Source publication transaction aborts | No public cursor or assistant stamp escapes the rollback |
| Rendered 41; publication 42 precedes ack 41 | Read becomes at most 41; 42 remains unread |
| Duplicate/out-of-order acknowledgement | Monotonic no-op; no extra write or topic reorder |
| Activity record is unreadable/corrupt | Explicit conservative unavailable state; never all-read |
| Deleted thread/job or cleared report | Late callback cannot restore it or its cursor |
| Latest ordinary tail is visible; older report changes | Older report remains unread |
| Exact historical report is visible while scrolled up | Clear only that report cursor; retain newer ordinary unread |
| Closed report shows only generic `查看报告` | No report acknowledgement |
| Hidden/unfocused native window, inert/covered transcript | No read acknowledgement |
| Metrics/token update leaves navigation semantics unchanged | No page/composer/all-topic-row rerender from that update |

## 5. Good / Base / Bad cases

Good: A and B execute independently; B's sidebar shows real busy/unread while A
is selected. Returning to B clears only its now-presented ordinary output. A
later report in an older B turn stays unread until its meaningful summary/body
is actually visible. Base: an old thread with no activity record begins at zero
without a migration. Bad: selecting a topic clears its newest stored revision,
or a surviving process and stale run row manufacture a busy indicator.

## 6. Necessary verification

Use actual ProductStore writers and rollback, not mocked setters. Cover multiple
runs/resumes, identical/timing-only checkpoints, approval and once-only terminal
publication, 41→42 acknowledgement races, strict read errors, separate historical
reports, direct unknown recovery and clear/delete winning late callbacks. Verify
actual initiating scopes and prepared-key behavior, including broad IDs.

Exercise the real transcript with controlled geometry and the actual browser:
painted matching content; native/document visibility and focus; following vs
scroll-up; composer-safe clipping; hidden/inert detail/composer/navigation
surfaces; historical report visibility and exact body/result revisions. Measure
actual component function renders at app/page/workspace/composer/list/row
boundaries while repeated output and metrics commits still change transcript
text. Verify long titles, hover/focus/touch actions, narrow layouts, sibling
keyboard controls and reduced motion. Source/browser checks do not establish
installed WKWebView/WebView2 acceptance.

During real routed A/B switches, hold the new detail read and assert the same
sidebar/list/row DOM nodes remain connected without a blank/loading replacement.
Keep history/query identity assertions as well as visual continuity.

## 7. Wrong vs Correct

Wrong: on topic selection, fetch the current activity row and assign
`readRevision = publicRevision`; put the full streaming query in AgentChatPage;
acknowledge a report because its unchanged button is in view.

Correct: publish source and cursor atomically, carry the exact observed revision
in the matching transcript snapshot, acknowledge only that visible observation,
and keep historical report cursors separate. Subscribe full streaming content
inside its reader while navigation and compose owners retain semantic snapshots.
