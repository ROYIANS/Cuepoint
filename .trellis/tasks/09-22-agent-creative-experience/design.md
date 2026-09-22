# Design direction

## Boundaries
Reuse durable AgentRun/AgentToolCall records, existing task evidence sources, project repositories, generation jobs and versioned clip history. Do not introduce a second business-state store or infer current-run authorship from aggregate before/after counts, since manual edits may occur concurrently.

## Outcome data flow
Persisted tool result + job state + entity identity/revision -> typed bounded evidence projection -> compact outcome UI and model-facing result summary. A completed call that returns a pending/failed job is not a completed deliverable. History and recovery preserve source links without fabricating a new effect. Older records without sufficient proof must remain unverified.

The evidence child must specify how ungrounded model claims are handled, including streamed text, rather than promising that a final keyword scan proves correctness. Any semantic follow-up request needs a bounded cost/latency strategy and may not grant new execution authority.

## Execution
First verify offered schemas, model envelopes, finish reasons and ledger transitions. Build on the pending matching-group preload and clarified instructions. Do not presume the screenshot proves a transport bug. Stop and approval remain explicit; advice-only replies must not trigger unwanted writes. Any later continuation mechanism needs durable limits, no replay, both protocols and clear user visibility.

## Audio batch
Compose existing per-item generation contracts into a reviewable batch. Freeze segment revisions, voice/connection settings, target list and version policy. Review once for that concrete batch; persisted per-item identities and attempts provide progress, partial success and recovery. Reuse the existing image batch code as a reference only after verifying its contracts fit sound jobs. Do not assert a provider supports a bulk endpoint.

## Timeline
Separate selectedTake changes from clip arrangement. Compute expected positions from real source duration and trim metadata. Preview changes; reject stale chapter state. Reconciliation must preserve user edits, avoid duplicate identity-based placement, and expose ambiguous/multiple placements for a decision. Define append/replace semantics only when their user need and conflict behavior are specified.

## UX and compatibility
One compact progress/result surface with expandable details, contextual actions and accessible small-screen layout. Share manual and Agent repository actions. Retain existing projects, saved outputs and approvals; any schema addition requires a migration/import/retention audit. Never auto-start old jobs after refresh or import. Rollback feature availability without deleting source data.

## Design checkpoints
Children must settle detailed behavior before editing code. R1/R2 first; R3/R4 depend on their evidence contract. Live model evaluation is distinct from scripted runtime tests. The initiative does not authorize hidden repeated model requests or paid generation during testing.
