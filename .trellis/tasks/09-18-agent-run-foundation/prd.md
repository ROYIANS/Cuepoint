# Agent execution and message foundation

## Outcome
Existing text chat uses one persisted general Agent and a traceable execution per attempt. It preserves partial content, accurately reports failures/stops/interruption, and permits explicit retry after reload.

## Acceptance
- Every new send atomically links user message, assistant message and execution with actual model/config and request context; API keys are never copied to execution snapshots.
- Ordered checkpoint writes cannot overwrite terminal content with an older delta. Persistence failures are surfaced.
- Complete, failed, cancelled and interrupted are distinct. Error notices are not model answer content.
- Reload recovers abandoned execution; another live tab's execution is not marked interrupted. At most one active execution per conversation.
- Explicit retry preserves the old attempt and its partial answer, references the original request context and creates a new assistant/run. No silent network retry or automatic resubmission on startup.
- Follow-up context includes accepted complete answers, not failed/partial output or duplicate retry messages. Thread switching/deletion cannot cross-write/resurrect records.
- Stream parser recognizes protocol completion and errors, rejects malformed/empty/truncated responses and preserves reasoning display. Existing model compatibility gate still runs before send mutations.
- Existing data upgrades safely, including abandoned legacy streaming messages. Project ZIP scope remains unchanged.

## Out of scope
Tool execution/approval UI, task board, media generation, business entity writes, reasoning parameter UI, hidden model-state restoration.
