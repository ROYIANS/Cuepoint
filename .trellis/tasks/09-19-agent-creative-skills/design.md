# Design: business tools and generation

## Boundaries
- Keep skills as instructions plus code-owned allowlists. Split read, write, deletion and network tools so the existing single-effect approval contract stays truthful. Do not add one arbitrary operation dispatcher whose read label can hide writes.
- Use strict per-entity schemas and explicit field allowlists. Separate studio ownership from ordinary projects; the reserved studio library is not a deletable project. Never include secrets, Blob contents, internal approval records or credentials in model-visible results.
- Search/list returns bounded summaries and pagination; detail includes allowed fields, relationships and a revision. Name matches select candidates, not automatic mutation targets.
- Domain repository services remain authoritative. Extend missing validation at that layer and reuse it from both UI and tools rather than bypassing it with table.put.

## Local writes
Tool ledger → validated arguments → concrete change/impact snapshot → existing approval policy → revalidate current state → domain mutation and durable success result in one Dexie transaction → model continuation.

Flush relevant editor drafts before revision capture/check. Include all nested repository transaction tables and tool ledger in the outer transaction. Freeze generated IDs or save them atomically with the result. Approval after a target/cascade change must not authorize new unseen effects. Delete operations are high risk under existing assist semantics. Large work is bounded and chunked; each committed chunk reports exact progress.

Relationships are operations, not untyped field patches: copy studio asset, associate shot assets, reorder within an episode, clear slot result. Do not promise universal undo: use existing restore/proposal undo only where its conflict and reference contracts hold.

## Generation jobs
Add versioned durable generation records linked to run/tool, connector identity, immutable target/parameters/input revisions and eventual media/proposal identifiers. Migrate additively. Use existing adapters for verified capabilities; current production intent/profile limits are a real compatibility constraint, not permission to assume every catalog model works.

Separate submission, remote monitoring, downloading and applying states. Save submission intent before POST. Persist a received task ID as soon as possible. A crash between remote acceptance and local task-ID persistence is an unknown outcome; use provider reconciliation only when supported, otherwise surface uncertainty and never blind-retry. Local idempotency cannot guarantee remote exactly-once without provider support.

Polling uses a controller with bounded backoff and cancellation, not repeated model calls consuming the model-request allowance. Persist each meaningful transition. Explicit continuation queries a known job; completed local writes/results reuse their ledger outcome. Keep the model/tool continuation parked until its actual contract is satisfied and avoid false completion.

Download results through existing validated provider paths into owned media records. Check target/source revisions before applying. Reuse production proposals where supported, extending common domain contracts for missing targets. Result storage and target association are separate recoverable stages; an application conflict must not force a second generation. Preserve available output with an actionable unassigned/conflict state. On target deletion, no late operation may resurrect the entity. Cancelling monitoring does not claim remote cancellation/refund.

## UI
Skills remain inside the existing searchable plus menu. Existing tool-step/approval components gain concise target/change summaries, affected-record links and relevant image/video preview. Use flat rows and spacing; reserve expanded details for parameters/logs. Unknown outcomes, conflicts and approval buttons stay discoverable. No permanent toolbar additions.

## Compatibility and limits
- No connector/Agent/chat settings writes; capability reads are sanitized and credentials resolved only in the adapter boundary.
- Existing permission snapshots, ordinary chat mode, stateless Responses continuation and context compaction contracts remain unchanged.
- Durable jobs need handling in project deletion and run/thread cleanup: detach/terminate local coordination without resubmitting or reviving deleted ownership. Preserve only necessary recovery information; avoid orphan media.
- Prices/progress display only provider-backed data. Real paid API calls are not required for automated verification.

## Generation review boundary
Add a flat inline generation form within AgentRunDetails. AI original arguments and preview remain immutable; separately store generationOverride arguments and a newly calculated preview when the user confirms. Compare-and-set awaiting approval, owner/latest run, original preview and absence of a job. Actual execution validates the override fingerprint; results disclose actual provider/model/parameters. No generation upload or paid request occurs in form preparation. Explicit confirmation applies to paid generation regardless of normal tool permission mode.

Global per-kind preferences store connector identity/model/parameters, never prompt/credentials. Existing project defaults remain available as recommendations. Explicit user intent > project > global > automatic suggestions is described to the model; UI never silently replaces a complete AI proposal and offers one-click default application. The new UI owns only generation review, not a second generic approval system.

## Execution segment change boundary
The gap lives in the durable run budget and runtime loop, not provider adapters. Keep cumulative modelStep for tool ordering/usage, add optional modelStepSegmentStart (legacy default zero) and pauseReason=model_step_limit. Pause run/message atomically before context preparation or another model request. Only validated explicit resume from this pause advances the segment start; unknown effects and pending approvals still block. Update run details, transcript and composer to show paused state and the bounded continuation action. Tests cover repeated segments, reload, ordinary interruption/approval, ownership, cancellation and preservation of tool results. No automatic background continuation or paid-job retry is added.
