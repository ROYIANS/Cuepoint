# Creative assistant workflow direction

User-confirmed direction, 2026-09-19. This document records product intent; it does
not claim that deferred capabilities are implemented.

## Core principle
The creative assistant should work through a Trellis-like task lifecycle:
clarify the goal → make a plan → execute → verify → summarize and reflect →
archive → retain reusable experience → retrieve relevant experience for the next task.
The project is the durable creative context and memory boundary; tasks organize
work within it, and chat is the interaction surface. A successful
model response alone is not task completion.

## Current foundation
A general assistant, durable runs, permission decisions, shared task goals, acceptance
criteria and checklists, linked conversations and explicitly saved response references.
Task mode now persists intake without creating a placeholder: the AI clarifies material
requirements, then explicitly creates the task through a current-run tool. Research,
approach, progress, verification and question records preserve source references and
versions. Users can inspect/edit safely; new runs load bounded current records.
A human can manage this foundation without a model connector.

## Next workflow layer
- Keep the intended deliverable and acceptance criteria visible during planning.
- Review outputs against the goal; capture verification evidence and unresolved work.
- At wrap-up, record a concise task summary: result, decisions, important constraints,
  failures and lessons, remaining questions, and links to source runs/artifacts.
- Distinguish task-specific conclusions from reusable experience. A transcript archive
  alone is not long-term memory.
- Promote useful experience to durable local memory with source task/run references;
  preserve user control over corrections and removal. Avoid treating unverified
  assistant statements as established facts.
- Retrieve relevant experience at the start of later tasks, with clear provenance and
  context budgeting. Future summaries must support resumption without replaying every
  message or repeating completed actions.
- Preserve the pure-frontend boundary: closing the page does not imply execution keeps
  running. Summary/memory writes need durable checkpoints and safe interruption recovery.

Detailed schemas, extraction rules, retrieval and approval behavior are to be designed
in the subsequent memory/context round. This direction does not expand the current
workspace batch into media generation, business CRUD, autonomous teams or scheduling.

## Project ownership clarification — 2026-09-19
Task mode will require a project selection before conversation intake. Current
project facts should be available to the first request, remain current after edits,
and be reused by new conversations in the same project. Task creation still follows
requirements clarification. Project-specific experience, rules and conventions stay
with that project. Basic facts come from business data; long-term memory preserves
source-linked experience rather than copies of mutable project fields.

This is newly confirmed product direction, not implemented behavior. Add project
binding/context foundation before the memory-management and retrieval deliveries.
See `.trellis/tasks/09-19-agent-workflow-memory/research/project-scoped-context.md`
for current gaps and outstanding scope decisions.
