# Project-owned tasks and shared context

Date: 2026-09-19. Product direction from the user's latest request. Planning only;
no project-binding implementation has been performed. The product is still in development, so legacy compatibility/migration is deliberately out of scope.

## Confirmed user intent
- Task mode requires selecting a creative project before starting the conversation.
- Place the searchable project picker near the lower-left composer controls.
- The project owns tasks, their conversations, durable context and accumulated
  experience/rules/conventions; new conversations in that project reuse them.
- Provide current project context before the first model request; avoid repeated
  model tool calls solely to rediscover basic project details.
- AI changes to project facts must become visible in subsequent context.
- Keep the earlier rule: selecting Task mode/sending does not create a task. AI
  creates the task after understanding the user's actual requirement.

## Repository evidence
- src/domain/types.ts: ChatThread currently has no projectId.
- src/domain/agent.ts: AgentTask and AgentRun currently have no project binding.
- src/lib/agent/taskContext.ts: shared assembly injects task instructions plus up to
  eight current working records, not an ambient project context.
- src/lib/agent/businessStore.ts: business entities already require real ownerId
  and episode ownership; studio assets have a separate studio owner. This verifies
  the supplied owner, but does not constrain calls to a conversation-bound project.
- src/db/agentRuns.ts: request inputs and continuation are persisted snapshots;
  retries must not rewrite completed tool calls or opaque Responses items.
- Memory management/retrieval children are still backlog. Their scope model must
  now follow project ownership before implementation.

## Proposed technical direction (not yet final)
- Bind thread, task and run to project identity; tool execution checks the frozen
  run scope, not mutable UI selection or model-provided owner IDs alone.
- Build a shared versioned project-context projection from current business data:
  core project facts, entity/episode index and active scoped conventions. Bound
  input size and load detailed scripts/shots/assets on demand.
- Basic facts remain in business tables (single source of truth). Persistent memory
  holds source-linked decisions, rules and experience, not duplicate project fields.
- At a new turn, assemble current local project context automatically. After a tool
  write, propagate fresh result/context at the next safe request boundary without
  rewriting the prior request or resubmitting effects. Include UI edits/other tabs.
- Cross-conversation continuity loads project context and relevant memories, not
  the whole transcript of every old conversation. Model requests still need the
  relevant input; this does not promise that one initial upload persists forever.
- Insert project binding/context foundation before memory management/retrieval.
  Preserve the already-built wrap-up layer and make its provenance project-aware.

## Confirmed scope decision — subsequent user OK
Restrict writes to the bound project; permit explicit reuse/import of studio assets;
work on another project in a separately bound conversation. Studio originals remain
unchanged when imported. Record scope on the run and enforce it beyond the prompt.

## Project deletion
If a project is deleted, its bound conversations/tasks remain inspectable as history but become unavailable for execution. They never fall back to another project.
