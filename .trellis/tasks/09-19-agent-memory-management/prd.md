# Creative memory capture and management

Status: scoped planning backlog; detailed design and final review are deferred until this child is reached.

## Goal
Promote reviewed task experience into scoped, editable, source-linked memory.

## Ordering
Start after 09-19-agent-task-wrapup is accepted. Parent: 09-19-agent-workflow-memory. This dependency is documented; parent-child links alone do not enforce it.

## Requirements
- R1: Extract candidate decisions, creative preferences and repeatable lessons from reviewed task summaries; separate task-only facts from reusable knowledge.
- R2: Preserve source task/run/summary revision, scope and temporal applicability. Project conventions must not become global preferences implicitly.
- R3: Provide user review, manual entry, editing, disabling, deletion and supersession; detect duplicates and contradictions without silently overwriting earlier decisions.
- R4: Never promote context compaction text or an assistant claim merely because it exists. Missing sources and stale records remain visible.

## Acceptance
- AC1: A reviewed lesson can be promoted, reopened, corrected and disabled with its source accessible.
- AC2: Two conflicting versions remain auditable and only the chosen active version is eligible for later retrieval.
- AC3: Removing a memory is durable; scope ownership prevents cross-project disclosure.

## Decisions before implementation
- Initial memory categories and project/global scope selection UX.
- Approval policy for candidate promotion and updates; proposed default is user-reviewed promotion.
- Source deletion, export/backup and retention rules; settle before release.

## Boundaries
Follow parent provenance, user-control, pure-frontend and visual-quality contracts. No implementation or design-finality is implied by creating this backlog. Research actual source/contracts when reached and keep later-child behavior out of this child.
