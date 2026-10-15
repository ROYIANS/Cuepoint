# Epic design and integration boundaries

Status: planning. This epic organizes delivery; child-specific technical design and final review are still required. No host language, sidecar, framework migration, permission default or optional automation is selected here.

## Ownership

- Parent: source requirements, complete finding coverage, ordered child map, integration constraints and final acceptance/disposition.
- Child: one verifiable user result, its precise decisions, implementation and quality evidence. Activate only the child owning the selected work.
- Evidence child: retain the four original authored research reports with pinned source revisions; do not copy the reference repository or raw logs.
- Shared app/layout: working-surface geometry, detail host presentation, focus and same-tree responsive behavior.
- Features: owned detail content, entity loading, business edits, draft lifetime, conflicts and execution sessions. App layout does not own shot schemas or database mutations.
- Agent core/providers: neutral algorithm and protocol behavior. Actual product transactions, reference materialization, current credentials and grants remain host/product responsibilities.

## Detail navigation direction

The owner explicitly separates opening business detail from leaving the conversation. A supported detail action should resolve an explicit owned target and display it in the persistent right-side working-surface host. It must not execute a main-route navigation and then suppress the resulting departure confirmation; the Agent route, controllers, drafts and run subscriptions must stay mounted.

The existing host supports a single stable portal and an outgoing panel guard. Reuse these lifetime mechanisms, but replace the narrow modal-drawer fallback for detail surfaces. On 2026-10-15 the owner selected **full-width detail inside the same working surface when side-by-side layout does not fit**, while keeping conversation mounted/running and exposing Return to conversation. Hide/inert the inactive surface for user input and focus; do not cancel its runtime or remount its owner. Resizing must not duplicate editor trees.

The existing shot page is an episode table, so the detail must be composed by the video feature around a single owned shot. Reuse its field/media primitives, commands and revision guards; do not embed an episode-wide table or duplicate business logic. The owner confirmed first-delivery viewing and editing of a single shot. Reuse applicable existing fields, relationship controls and media-session machinery; legitimate media-operation Dialogs may remain. E16 owns further entity editors and the retained modal-review detail/return handoff. Existing task/material/memory/audio/music detail panels should be inventoried for the same presentation policy; unrelated left navigation and confirmation dialogs keep their separate purposes.

Panel replacement, selecting another entity in an already open panel, closing and a genuine route departure must each respect the outgoing editor's unsaved/failed writes. Registration replacement guards alone do not prove entity-selection changes are guarded. Agent/manual concurrent writes still use the original revision/conflict contract.

## Early UX contracts

Provisional sending state represents captured intent, durable admission represents accepted input, and committed receipts represent real business effects. Those states may become visible at different times. Preserve existing synchronous duplicate guards and current checkpoints while adding immediate content feedback and recovery.

Query values retained while dependencies reload need explicit scope identity, including empty arrays. Reading intent remains user-controlled; live output does not force an older reading position to the end. Execution/stop feedback derives from actual boundaries rather than a single generic busy label or fabricated percentages.

## Capability direction

Keep the current shared loop/providers and sole product command/store owner. Capabilities, resources, results and jobs are typed seams with explicit host lifecycle. Media tools can be native without moving the model loop. Background Agent execution requires a separate owner/lifetime design. Skills are instructions, MCP is a selected connection, and either may request resources without granting them.

External file/process/browser effects cannot participate in local database rollback. Retain durable intent, remote identity and unknown outcomes, with no implicit replay. The reference's live jobs, scheduling, SDK and experimental providers have different limits; evaluate the actual selected profile/protocol, not its combined package catalog.

## Integration and rollback

Deliver sequentially, checkpoint each independently accepted slice, and avoid wide changes to unrelated owners. Prefer reversible changes in the existing shared app rather than parallel products or duplicate editors/stores. Each child records its own rollout/rollback and validation commands once scope is concrete. A rollback must not discard confirmed user drafts, business writes or remote job identities.

Before completing the parent, exercise running-chat details together with send/retry/stop, delayed query transitions, approvals, concurrent detail edits and real native storage. Optional later capabilities may be explicitly deferred rather than falsely marked delivered.
