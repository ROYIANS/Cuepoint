# Reusable Agent Design

## Boundaries and packaging

Core owns runtime-neutral execution and semantic host contracts. Providers implement normalized chat operations and depend on core. Studio supplies product adapters/UI/policy; the todo consumer supplies its own tools/persistence. Follow the parent's detailed port and failure semantics.

Emit ESM JavaScript/declarations, explicit exports and valid `.js` imports without unresolved aliases. Core imports safely without browser/Node globals or concrete storage. Node >=24.11 and `node:sqlite` are example-only runtime choices.

## Typed contracts

Use the minimum model/persistence/tool-transaction/coordination/context/policy interfaces needed by both hosts. Tool definitions bind argument validation to callbacks and typed preview/result extensions. Core carries execution/call identity, AbortSignal and typed host services. Project bindings, generation settings, product receipts and approval previews remain validated product payloads.

Do not hide product types behind `any`, extension bags, universal service locators or a renamed ProductStore. Generic capability loading belongs in core; creative content, paid-generation/finishing policy and memory/connector selection remain in studio. Retain existing step/request budgets without hidden extra model calls.

## Durable effects and events

Persistence expresses begin/claim/checkpoint/settle semantics with revision/owner checks, not table CRUD. Cuepoint implements ports on its existing ProductStore; a local tool shares one transaction for business writes/evidence/completion. The example uses independent SQLite tables.

Preserve committed/rolled_back/unknown certainty. Receipt/serialization failure rolls back a local transaction; acknowledgement/read failure cannot prove rollback. Preserve already committed results after later failures. Competing/recovered owners must be excluded without treating timeout as proof of death.

Persist external intent/operation identity before dispatch and reconcile existing supplier work; never replay uncertain submission automatically. Cancellation stops local execution/waiting without claiming supplier cancellation. Startup recovery acquires ownership and submits no network work; explicit resume uses frozen inputs/permissions and confirmed results.

Maintain sole terminal writer, monotonic checkpoints and output flush before final settlement. Ordered events distinguish provisional deltas from confirmed state and never replace persistence or expose encrypted continuation in chat activity.

## Providers and independent proof

Move current protocol transport/parsing behind core contracts. Studio resolves connector/reference/media/runtime HTTP/credential access through typed adapters. Resolve keys at request time without persisting snapshots; retain bounded reads/SSE completion/tool IDs/abort/redaction/errors/request counts and exact continuation across checkpoints/compaction.

The todo CLI owns read/create/update tools, approvals and SQLite run/call records. A deterministic model drives checks without paid requests. Build/locally pack packages and install in a temporary outside-workspace consumer; compile emitted types and execute with no studio/root source access.

Terminate/reopen/resume the actual process. Verify approve/reject, cancellation, duplicate/stale claims, rollback, confirmed-result reuse and unknown-effect refusal. Shared semantic conformance cases complement real host transaction tests.

## Production switch and rollback

Extract checked slices and switch the real Cuepoint composition; do not retain a second loop or leave only the example using the packages. Preserve product schema/wire formats/reference adapters. Remove transient bridges and record actual APIs/host limits before parent integration review; publication/API stability remains deferred.
