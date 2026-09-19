# Trellis-style creative workflow and durable memory

Status: planning roadmap; task creation approved 2026-09-19. Each child is reviewed and implemented separately, in sequence.

## Goal
Make creative work reproducible across tasks: clarify the outcome, plan, execute, verify actual results, reflect, archive, retain useful experience and retrieve it at the next relevant moment. The user explicitly prioritizes the essence of Trellis, long-term memory and excellent visual/interaction quality.

## Confirmed foundations
Existing task/chat identity, manual lifecycle, checklists, 40 creative tools, reviewed image/video generation, persisted execution and 32-request continuation are available. Context compaction exists but is working context, not a memory store. See research/trellis-mapping.md and docs/agent-workflow-direction.md.

## Requirements
- R0: Task mode begins a requirements conversation; sending alone never creates a task. AI creates/links the task once requirements are sufficiently clear, then manages Todo and durable research, approach, progress and verification records. Ordinary Agent mode does not auto-create tasks. The task workspace must be usable end to end.
- R1: Persist goals and acceptance expectations; report evidence, unresolved work and user-reviewed completion, not merely successful model responses.
- R2: Preserve separate layers: original records, task handoff/retrospective, reusable experience and durable scoped creative conventions. Avoid copying entire transcripts into every future prompt.
- R3: Memories have provenance, scope, revision and lifecycle; users can correct, disable and remove them. Claims without evidence remain suggestions or unverified observations.
- R4: Relevant, bounded context is assembled before work. Show which memories were used; current explicit user intent and current business data take precedence over old recollections. Memory never grants tool permissions.
- R5: Every child delivers a usable end-to-end flow, verification and a retrospective. Capture reusable implementation lessons into repository specs separately from the product's own user memory.
- R6: Preserve pure-frontend operation, durable checkpoints, no automatic resubmission and explicit missing/stale-source states. Archive, deletion and memory removal are distinct operations.
- R7: Flat, restrained interfaces; no nested cards or permanent toolbar clutter. Keyboard and mobile access, clear progress and failure recovery are acceptance requirements.

## Ordered children
| Order | Child | Deliverable | Prerequisite |
| --- | --- | --- | --- |
| 1 | 09-19-agent-task-orchestration | AI task creation/linking, Todo and research/design/progress records | Existing task/runtime foundation |
| 2 | 09-19-agent-task-wrapup | Acceptance evidence, reviewed task summary, completion/archive handoff | 1 |
| 3 | 09-19-agent-memory-management | Promote, edit, scope, supersede and remove creative memory | 2 for verified sources |
| 4 | 09-19-agent-memory-retrieval | Retrieve relevant memory and inject bounded, inspectable context | 3; uses 1-2 records |
| 5 | 09-19-agent-reference-intake | User reference images/documents with traceable extraction | After core loop 1-4 |
| 6 | 09-19-agent-batch-generation | Reviewed queue, result comparison and scoped application | After 5; existing durable generation |

Parent-child links are organizational; ordering is enforced by child planning and validation. Parent has no direct implementation work. Later children are scoped backlog, not implementation-ready designs.

## Cross-child acceptance
- AC0: A supported creative request results in an owned task with goal, Todo, research/proposal/progress records. The user can inspect and correct these records; resuming reconstructs pending work without duplicate tasks or actions (R0,R1).
- AC1: Complete task A, inspect its evidence-backed summary, promote a reviewed lesson, open related task B and see the relevant source-linked memory actually used (R1-R4).
- AC2: A newer correction supersedes earlier advice; unrelated projects do not inherit project-only conventions; disabled/deleted memory is absent from newly prepared requests (R2-R4).
- AC3: Unknown paid-generation outcomes and incomplete work cannot be described as verified completion; reload never duplicates business writes or network submissions (R1,R6).
- AC4: A source can be located or explicitly reported missing. Archive retains useful history; deletion policy is designed and tested before memory release (R3,R6).
- AC5: Each child passes appropriate tests, browser review, specification updates and archival before the next child implementation (R5,R7).

## Non-goals
No background server, cloud synchronization, autonomous multi-agent orchestration, scheduled jobs or direct execution of Trellis CLI in the browser product. No claim that long-term memory is identical to context compression or that a vector database alone supplies memory quality.

## Planning gates
Child1 has a final planning proposal: Task-mode intake first, AI creation only after sufficient requirements clarification, then Todo and working records. Child2 has a wrap-up proposal that must be rechecked against child1. Children3-6 are scoped backlog and require detailed design when reached.
