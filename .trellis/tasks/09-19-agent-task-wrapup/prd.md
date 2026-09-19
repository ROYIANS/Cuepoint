# Task verification and wrap-up summaries

Status: second child planning proposal; revisit contracts after 09-19-agent-task-orchestration is accepted. Parent: 09-19-agent-workflow-memory.

## Goal
Let users understand what a creative task actually delivered, check it against the goal, and retain a useful handoff before completing or archiving it. Build the trustworthy source layer for subsequent long-term memory.

## Background
Task/plan/lifecycle and pinned replies exist; successful runs project to review, not completion. Current completion checks plan status but has no acceptance evidence or structured retrospective. Source: parent research/trellis-mapping.md; src/db/agentTasks.ts; src/components/agent/TaskInspector.tsx.

## Proposed requirements
- R1: Use the acceptance expectations established by the task-orchestration child; extend review findings without duplicating their ownership. Legacy tasks remain readable without invented expectations. Users can add expectations without a model connection.
- R2: Offer an explicit Prepare wrap-up action. Assemble owned task goals, plan, relevant messages, settled tool results and generation states; AI prepares an editable summary. This action cannot invoke business tools or redo generation.
- R3: Summary sections cover delivered results with links, acceptance findings, decisions/constraints, problems/lessons and unresolved next steps. Each AI evidence claim references a supplied source; unverifiable creative judgments remain user review items.
- R4: User reviews/edits and confirms the summary. Saving a draft is separate from marking the task complete. Preserve existing guards against unresolved execution and unfinished plans; unresolved acceptance cannot silently pass. Partial-work summaries can be saved without completing the task.
- R5: Keep task summary versions and source coverage so reopened/changed tasks do not silently overwrite prior conclusions. If sources or expectations change while preparing/reviewing, surface staleness and require refresh before completion.
- R6: Summary preparation can fail or be interrupted without changing task lifecycle or destroying the previous confirmed summary. Users can create/edit a manual summary without configured AI. Explicit retry is visible; no reload-driven network retry.
- R7: Task details present a concise review surface with expandable source details and direct artifact links. Flat hierarchy, accessible controls and mobile layout follow existing UI. Archived tasks retain their summary and can be reopened.

## Acceptance criteria
- AC1: A task producing a character and image lists actual target/output links; downloaded-only generation is not described as applied (R2,R3).
- AC2: Unsupported source IDs, mismatched tasks, stale source revisions and unknown tool outcomes cannot become verified evidence or confirmed completion (R3-R5).
- AC3: Summary generation/editing never changes business entities, plan statuses or paid job state; confirmation is idempotent and cannot bypass task completion guards (R2,R4).
- AC4: No connector, model failure, cancellation, refresh and competing review tabs preserve drafts/previous summaries and allow explicit recovery (R5,R6).
- AC5: Reopen, change task, regenerate, confirm, archive and reopen preserves distinguishable historical/current summaries (R5,R7).
- AC6: Desktop/mobile users can inspect evidence, edit, save a partial summary and explicitly complete eligible work (R1,R4,R7).

## Out of scope
Memory extraction/promotion, memory storage/retrieval, attachments, batch generation, background summarization, model-defined automatic completion, subjective visual quality scoring and a new task board.

## Key proposal for review
AI drafts and the user confirms, matching generation configuration review. Preparation is explicit; manual summaries remain available. Current goal/plan/evidence determine review, not assistant confidence. Pending implementation approval after this planning summary; no product code changed.
