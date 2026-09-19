# Batch media generation and result selection

Status: scoped planning backlog; detailed design and final review are deferred until this child is reached.

## Goal
Review a set of generation proposals, track results and choose what is applied.

## Ordering
Start after 09-19-agent-reference-intake is accepted. Parent: 09-19-agent-workflow-memory. This dependency is documented; parent-child links alone do not enforce it.

## Requirements
- R1: AI drafts multiple target-bound configurations; user can adjust selected items before submission.
- R2: Reuse durable per-job identity, explicit paid confirmation and unknown-outcome guards; preserve partial success.
- R3: Show per-item status and compare actual results before applying to target slots.
- R4: Queued-work cancellation must distinguish unsent requests from remotely accepted jobs.

## Acceptance
- AC1: A multi-target batch allows item-level edits, confirmation, partial completion and result application.
- AC2: Reload/stop/retry never duplicates accepted paid jobs or overwrites changed targets.
- AC3: Comparison and selection remain usable on desktop/mobile without nested card clutter.

## Decisions before implementation
- Batch/concurrency limits, spending information availability and grouped confirmation UX.
- Number of candidates per target and safe retry behavior for partial failures.

## Boundaries
Follow parent provenance, user-control, pure-frontend and visual-quality contracts. No implementation or design-finality is implied by creating this backlog. Research actual source/contracts when reached and keep later-child behavior out of this child.
