# Conversation parameters and automatic context compaction

## Goal
Enable long creative conversations and task execution with understandable controls
for retained history and automatic summarization. Reduce context pressure while
preserving user goals, decisions and unfinished work. User requested task creation
on 2026-09-19, with LobeHub as a local implementation reference and Codex/Cursor as
interaction references. Implementation was approved by the user with “ok”.

## Confirmed background
- Current code sends every complete/legacy historical message. Context token counts
  are estimates. Run request snapshots and tool ledgers already support interruption.
- Model capacity can be resolved from provider metadata and the local Model Bank.
- Task goals/checklists are stored independently and already included in instructions.
- User wants Trellis-style work: goal, plan, execute, verify, summarize, archive and
  reusable memory. Context compaction serves continuity; task retrospectives and
  cross-task memory remain separate future work.
- Reference findings and source paths are in research/lobehub-context.md.

## Requirements
R1. A compact parameters surface exposes automatic compression and history limiting,
with a validated message-count input when limiting is enabled. Reuse the composer
menu hierarchy: + → parameters; no extra permanently visible toolbar button or
nested cards. Home configures new-conversation defaults; detail configures this
conversation, with an explicit action to save as defaults and reset overrides.
R2. Clarify that history selection affects what the model receives, not local storage.
Current user input, assistant instructions, task goal/plan and enabled tool schemas
are outside the historical message count. Select valid complete dialogue boundaries;
never leave orphan tool results. Show selected message count in context details.
R3. Automatic compression creates a real model-generated summary of an eligible older
prefix, preserving a recent verbatim tail. Summary includes goal, constraints, user
corrections, key decisions, completed work, pending work and references. Preserve raw
messages and provenance; do not label guessed details as verified facts.
R4. Check the full request budget before the first model call and between settled tool
rounds. Include system/task/skills/tools/summary/recent messages, output reservation
and an estimation margin. Derive thresholds from known capacity; 64K is not universal.
Unknown model capacity must be shown as unknown and needs an explicit local budget
before automatic compression can claim to protect against overflow.
R5. Both Chat Completions and Responses preserve valid continuation groups. Never
compact pending approvals, unresolved tool calls or uncertain results. Do not rerun
completed tools as a side effect of compression or recovery.
R6. Persist compression jobs, source coverage, prior summary reference, output and
activation separately. Incomplete/failed summaries never replace working context.
Stop/reload preserves the prior context and offers explicit resumption. Do not
silently issue another summarization request on reload or ignore compaction failures.
R7. Display compact progress, failure/retry and a readable completed summary, with
estimated before/after usage. Context details and dispatch share one planner.
Compression usage is separately identifiable; reply speed excludes compression time.
R8. Raw history and results remain inspectable. History-limit changes must not silently
reintroduce excluded messages via an older summary. Run retries keep frozen inputs.

## Acceptance
- Preferences persist/reload, are isolated per conversation, and new threads snapshot
  explicit defaults. Existing data receives safe missing-field behavior.
- Zero, odd, default and large counts have deterministic documented semantics; recent
  failed/partial output and orphan tool results cannot enter normal historical context.
- Two settings together have a tested selection order: history policy first, budget
  and compaction second; valid summaries only cover sources inside the selected scope.
- Overflow checks are provider-neutral, account for model changes, and do not rely on
  a hard-coded capacity presented as a fact. Oversized indivisible input is reported.
- Successful compaction is used in the next payload; source history is unchanged.
- Cancellation, failed summary, storage failure, reload, duplicate resume and two-tab
  races do not create active partial summaries or duplicate business actions.
- Browser tests cover home/detail settings, narrow menus, outside click/Escape,
  progress/stop/retry, summary inspection and normal subsequent conversation.
- Existing run/task/provider tests pass; add meaningful context-policy and transaction
  tests plus fixture HTTP integration. No live paid requests needed for acceptance.

## Out of scope
Temperature/top-p expansion, new providers, attachments, business CRUD/media tools,
semantic retrieval/vector storage, cross-task long-term memory, automatic final task
retrospectives, subagents and true server-side background execution.

## Confirmed defaults
User selected the inspected LobeHub defaults: automatic compression ON, history limit
OFF, and a preset of 20 prior message units when limiting is explicitly enabled.
No product preference questions remain. The final planning summary was approved. A 20-message limit is optional, not the automatic-compression trigger.
