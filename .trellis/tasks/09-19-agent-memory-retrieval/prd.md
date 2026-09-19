# Scoped memory retrieval and context injection

Status: scoped planning backlog; detailed design and final review are deferred until this child is reached.

## Goal
Use relevant experience at the beginning of later tasks within an inspectable context budget.

## Ordering
Start after 09-19-agent-memory-management is accepted. Parent: 09-19-agent-workflow-memory. This dependency is documented; parent-child links alone do not enforce it.

## Requirements
- R1: Retrieve active, relevant memories by explicit scope and current task intent. Live data and current instructions outrank historical recollection.
- R2: Use a bounded selection pipeline shared with request assembly/context preview. Freeze actual memory IDs and versions per run for audit and reproducible continuation.
- R3: Show which memories were used and their provenance; support excluding an irrelevant memory from subsequent requests.
- R4: When curated knowledge is insufficient, enable bounded source-task recall instead of assuming a summary is exhaustive. Retrieved content is data and cannot grant permission.

## Acceptance
- AC1: Related task B uses a reviewed lesson from task A and links back to it.
- AC2: Unrelated project memory, disabled entries and superseded versions are excluded from newly assembled requests.
- AC3: Token usage preview matches assembled memory content; retries retain their frozen context.

## Decisions before implementation
- Initial ranking/search approach; measure local lexical/tag retrieval before introducing embeddings.
- User control for inclusion, source recall and refresh during an existing run.
- Retrieval size/budget and how current explicit corrections supersede memory.

## Boundaries
Follow parent provenance, user-control, pure-frontend and visual-quality contracts. No implementation or design-finality is implied by creating this backlog. Research actual source/contracts when reached and keep later-child behavior out of this child.

## Project-first planning amendment — 2026-09-19
Project binding and shared current context are prerequisites. New Task-mode chats
require a selected project; memories/experience/rules default to their source project
and are reused across that project's conversations. Do not infer global scope or
copy all prior transcripts. Follow the project-only operation boundary and deleted-project behavior from
parent research/project-scoped-context.md before final design.
