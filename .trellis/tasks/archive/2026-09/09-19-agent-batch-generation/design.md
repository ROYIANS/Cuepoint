# Batch generation design

Status: approved and implemented on 2026-09-19; final verification and work commits tracked in implement.md.

## 1. Change boundary and entry point

Add a persistent, explicitly confirmed queue of target-bound candidates and user selection. The owning layers are generation domain/repositories/runtime and Agent feature components. Keep existing single-generation behavior; do not globally parallelize tool calls or multiply a provider's `n` parameter.

Add `prepare_generation_batch` to the existing media-generation skill. It accepts a title and 1–20 configurations using the existing strict generation schema. Repeated target slots represent up to four candidates; target groups share one project or studio owner. One configuration means one candidate; the user can explicitly clone it in review. No new provider fields are supported.

The tool is local atomic bookkeeping, with no network effect. Validate/read/hash outside transactions, then recheck local revisions and atomically save draft plus tool result. Return bounded `{batchId,status:"draft",targetCount,candidateCount,submitted:false}`. Replaying the call returns its saved batch. Draft success does not prove a business output. Preserve original Chat/Responses tool envelopes.

User actions on batch IDs do not require a fresh model request or revive the source run. Origin run/task/thread are immutable provenance. Add read-only `read_generation_batch` for bounded current outcomes in later conversation. Frozen skills still govern proposal tools; conversation mode exposes none.

Actions verify thread/project existence, origin integrity, task lifecycle where applicable and batch revision. Closed tasks remain read-only until reopened. Existing thread Web Locks prevent competing tabs/model execution/queue workers from operating the conversation concurrently. No heartbeat-based stale-owner inference.

## 2. Persistence and identity

Use the next additive Dexie version (currently v18):

| Record | Data and indexes |
| --- | --- |
| Batch | id/version, projectId/threadId/runId, unique sourceCallId, optional taskId, title/revision, queue control state, confirmation time and item IDs, per-entity baseline/application chain, timestamps; indexes by owner/thread/run |
| Batch item | id, batchId, stable order/target key, original proposal, saved review draft, included flag, immutable confirmed snapshot/fingerprint, queued/cancelled state, optional unique jobId, timestamps; indexes by batch/project/thread |
| Job extension | Typed union of existing single-call ownership or batchId/batchItemId ownership; keep sparse unique callId and add sparse unique batchItemId plus batchId index |

Batch jobs omit `callId`; never manufacture ledger IDs or drop uniqueness for single-tool jobs. Run/thread fields retain original provenance. Narrow the ownership union in all consumers of callId, especially recovery, evidence and single-job tools. Existing rows need no rewrite.

One candidate gets one immutable paid attempt. Known failed candidates can seed a new reviewed batch with retry-source provenance. Never reset a paid job to queued or silently replace its identity. This keeps attempts auditable without another attempt table.

Confirmation freezes connector destination, normalized verified parameters (`n=1` where required), input-byte revisions, baseline and item identity. No secrets, Blob/Base64 or transient result URLs in batch/job records. Draft updates use CAS and pending saves must flush before confirmation.

## 3. Review and confirmation

Users edit configuration, duplicate/remove/deselect candidates. Each candidate's target/input identity remains visible and fixed. Reuse existing profile/default helpers and shared configuration controls; preserve explicit > project > global > AI priority and invalid-selection disclosure.

Preparation validates included candidates outside transactions, without network requests. Present exact request count, target groups, per-item provider/model/settings/references and fee notice. A short transaction rechecks editor/batch revisions, target/input metadata, connector destinations and ownership, then freezes every selected snapshot or none. A failed confirmation preserves the draft. Excluded rows never dispatch.

The explicit confirm action may start that exact committed queue under the owned thread lock. A crash between confirmation and execution leaves a ready queue requiring explicit continuation. Repository confirmation itself does not implicitly POST. After confirmation, configuration changes require a new proposal.

## 4. Provider reuse and queue

Factor narrow shared operations from `generationRuntime.ts`: validated preparation, owner-aware claim, one paid submission, query/download, input validation and result persistence. Existing single-job wrappers retain approval, wire format and same-call recovery behavior.

Typed execution ownership selects guards:

- Single-call execution requires the existing running run/call, approval and preview.
- Batch-item execution requires confirmed membership/snapshot, owned batch/thread, dispatch permission and unique item claim. A completed source run is provenance, never a fabricated running call.

Claim item plus job atomically before uploads/POST. Revalidate target/inputs/configuration and dispatch permission after uploads and immediately before paid POST. Persist submission intent first. An abandoned submitting marker without a remote ID is ambiguous, never proof that a request was unsent.

Use two bounded workers per batch. A worker covers preparation/upload, submission, polling and download until terminal or parked. Queue order follows confirmed item order. No unbounded Promise.all or fail-fast loss of sibling outcomes. Waiting stays outside model-step budgets and reuses existing backoff/bounded polling.

Known failure frees a slot and permits independent queued work. Unknown acceptance sets a local pause latch before attempting a durable pause-for-reconciliation flag. Storage failure must not allow further dispatch; drain all workers before releasing ownership. Already in-flight work may settle; known jobs may still query/download. Every claim and pre-POST check reads that flag. Do not claim instantaneous cancellation of an already-sent request.

Polling exhaustion or recoverable connector/download/storage interruption parks new dispatch, settles other workers and exposes explicit continuation. Distinguish these cases from a definitive failed job.

## 5. Recovery and cancellation

Batch control states: draft, ready, running, paused, settled, cancelled. Items track inclusion/queued/cancelled-before-submission; existing job status becomes authoritative once a job exists. Derive counts from item/job records. Settled means no queued/active work, not total success/application.

| Event | Behavior |
| --- | --- |
| Reload or mount | Local reads only; never automatically contact a provider |
| Abandoned batch | Acquire available thread lock, park queue, classify ambiguous submission; leave live owner untouched |
| Explicit continuation | Query/download saved jobs first; eligible queued items follow only if guards permit |
| Pause, navigation or Stop | Stop local workers, preserve queue, save settling results; do not claim remote cancellation |
| Cancel remaining | Atomically cancel unclaimed queued items; claimed jobs stay truthful/recoverable |
| Unknown acceptance | Block new batch POSTs; allow known-job retrieval and saved output selection |
| Known failed item | Copy to fresh draft requiring new confirmation; preserve original failure |
| Project/thread deletion | Reject all late publication; no resurrection |

Cancellation never erases unknown outcomes. Unknown items cannot enter the retry UI. No generic account reconciliation API is introduced.

Keep equivalence protection across independent batches and single jobs. Only separately approved sibling candidates within the same confirmed batch may bypass same-fingerprint blocking. Unique item claim still enforces one submission per candidate. Unknown acceptance blocks subsequent siblings even when intentionally duplicated.

## 6. Selection and application

Persist selected item per target slot separately from application. Require real owned/type-valid local output. An explicit application transaction records candidate/job IDs, original baseline, expected current revision, previous result, new result and resulting entity revision alongside the slot write. Preserve all text/duration/reference/manual-status fields.

Maintain a per-entity trusted revision chain starting at the confirmed full-entity revision. After this batch's own user-approved result write, store the resulting revision as the next expected value. Sibling-slot application and candidate switching may use it only when actual state equals that exact value. Never rebase onto arbitrary current state; never rewrite original generation source revisions.

Batch submission guards also honor that proven chain, so an authorized sibling result write does not invalidate already-reviewed candidates. Input IDs/bytes stay frozen: applying a new first frame does not retarget a queued video request to that frame. External changes still fail the exact comparison.

Repeated application of the currently applied selection is idempotent. A→B→A candidate switches require explicit actions and chain validation; prior output/media remains available. Missing/changed entities block replacement and expose target links, without a force-overwrite button. Actual target media determines current application evidence.

Apply chosen slots grouped by entity in a transaction so sibling slots share one validated baseline. Different entity groups report independent success/conflict; a storage failure rolls back its group and audit. Selecting thumbnails never writes. Batch-owned jobs must not bypass selection via `apply_generation` or generic Agent slot-result writes; reject such bypasses and point to user selection. Existing manual slot editors remain explicit user actions and can cause normal conflicts.

## 7. Interface

Use existing Agent theme/fonts, 4px spacing and 12/14/16px text. No new global toolbar/route. A compact persistent batch strip shows title/counts/status/Open even when technical tool details collapse. Detailed review/comparison uses one focused expanded Dialog surface with flat rows/separators.

```text
批量生成                       5 个目标 · 12 次生成
目标 / 槽位       候选        模型与参数          选中
镜头 01 · 首帧    A / B       [逐项展开编辑]      ✓
镜头 02 · 视频    A           [逐项展开编辑]      ✓
所选供应商可能收费 · 同时处理 2 项   确认生成 12 份
```

Comparison uses a target selector and 1–4 candidate previews with configuration/status. Desktop uses side-by-side previews; mobile wraps two image columns or one wide video column with full-media inspection. Clearly distinguish selected, applied, replaced and conflicted. Failed/queued candidates show useful status/actions, not empty decorative panels. Apply action names the selected target count.

Reuse media inspection, avoid video controls nested in clickable buttons, restore focus and handle nested Escape correctly. Portal controls inside Agent theme root. Cooperative pause/cancel signals the owned worker and settles it before durable control changes; do not deadlock by reacquiring its held lock. Read/write errors retain draft and last valid view while disabling unsafe mutations.

## 8. Lifecycle, evidence and rollout

Update deletion cascades and all affected transaction table lists. GC/approval usage must retain draft/confirmed inputs, unselected candidates and any prior result needed by the application audit. Clear only this batch's references; never delete shared media. Committed media survives source-thread deletion through target ownership.

Execution history stays outside project ZIP/handoff. Read tools return bounded real outcomes; avoid adding all prompts to every model request. Wrap-up reads queue/items/jobs, distinguishes draft/downloaded/current application and includes state/selection changes in fingerprints. Open draft work must be explicitly discarded or reviewed; queued/active/unknown are blockers, cancelled-unsent rows are resolved history. Add genuine batch output provenance without treating bookkeeping as business success.

No new dependency, provider profile or legacy data backfill. Rollback disables new submission entry points but retains known/unknown remote identities and result retrieval. Never drop databases or accepted jobs as rollback. Verify the common-executor refactor with unchanged single-job tests, then native-browser fixtures using disposable data and mocked providers. See implement.md for gates.

## Verified retention detail

Cancelling or discarding a batch resolves unsent work but retains its history and input references. Removing a draft item or deleting the owning conversation releases that record's references through existing cleanup; shared and selected business media remain protected. Cancellation is not history deletion.
