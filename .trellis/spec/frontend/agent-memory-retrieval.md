# Project Memory Retrieval

## 1. Scope / Trigger

Use when changing automatic project memory, per-thread exclusions, request audit,
read-only memory/history tools or context preview. Management and source promotion
contracts remain in `project-memory.md`; current project facts take precedence.
Retrieval is local and lexical, with no embeddings or model call for ranking.

## 2. Signatures (API / DB)

- `domain/memoryRetrieval.ts`: `MemoryQueryOptions`, `MemorySelection`,
  `MemorySelectionEntry`, `MemoryDispatchAudit`.
- `lib/memory/retrieval.ts`: `buildMemoryQuery`, `rankMemoryCandidates`,
  `planMemorySelection`, `serializeMemoryEntries`, `withMemoryContext`.
- `db/memoryRetrieval.ts`: `getMemorySelection(options)`,
  `getEligibleProjectMemories(projectId, threadId?)`,
  `getThreadMemoryExclusions(threadId, projectId)`,
  `setThreadMemoryExcluded(threadId, projectId, memoryId, excluded)`.
- Optional `ChatThread.excludedMemoryIds`; `AgentRun.memorySelection` and
  `memoryAudit[{step, preparedAt, selection}]`; `ContextSnapshot.memoryEnvelope`.
- `refreshRunMemoryContext(runId)` updates only the effective upcoming base.
  `startModelStep` persists the exact selected snapshot in the dispatch checkpoint.
- `filterProjectMemoryTools(names, projectId?, mode?)`; registered tools:
  `memory_search`, `memory_read`, `project_history_search`, `project_history_read`.

## 3. Contracts

- Only active, user-reviewed, same-project and non-excluded entries qualify. Explicit
  `inclusion: 'project'` has priority; missing or `relevant` requires lexical relevance.
  Category does not imply universal inclusion. Normalization is shared with management.
- Query includes bounded draft, last two selected user turns and current task title/goal.
  Chinese bigrams and Latin words match title/topic/tags with stronger weight, then
  applicability and body. Tie-break by ID. No unrelated recent-entry fallback.
- At most eight complete entries and 4096 estimated tokens, further capped to 10% of
  known safe input budget. Budget includes serialized envelope overhead. Never truncate
  conditions/body to squeeze an entry in. Omitted count refers to eligible unselected
  rows, not disabled, unreviewed or thread-excluded entries.
- Keep an independent, marked user-data envelope immediately after initial instructions.
  Code-owned guidance prioritizes current intent/facts and forbids treating memory as
  permission or current execution evidence. Envelope source is lightweight; audit keeps
  exact source snapshots. Tool results remain a separate context category.
- Both smart and conversation modes receive automatic memory. Only project-bound smart
  mode offers read tools, respecting the frozen enabled skill set. New configuration
  defaults enable the skill; do not override existing explicit user switches.
- At settled request boundaries validate project/run/thread and reread current memory.
  Replace only the known base segment; preserve tool pairs, original `requestMessages`,
  prior audit and opaque Responses reasoning. Prefix mismatch fails closed. Recheck after
  awaited compaction and before dispatch, including the complete tool input budget.
- Compression preserves the separate memory envelope. Retry retains config/history and
  revalidates memory; it does not replay effects. Audit records dispatch intent before
  transport, not proof of network receipt or model adherence. Persistence failure blocks
  transport. Changes after that boundary affect later requests.
- Exclusion changes only this thread; restoring a deleted row's exclusion is permitted.
  Previously sent history/provider context is not erased. Deleting memory leaves existing
  conversation audits intact; deleting the conversation deletes its runs/audits.
- Read tools validate actual call/run, frozen tool set, smart mode and project ownership
  in consistent transactions. Strict arguments, max eight search hits and 6000-character
  slices. Memory stale revisions do not return current body as the requested old version.
- History search uses other same-project tasks, confirmed summaries and working-record
  indexes. Read verifies task/thread/run ownership for each discriminated source. Assistant
  messages need a task-owned run; tool results must be settled. Public result projection
  omits args, connector/run state, encrypted reasoning and raw errors. Nested history or
  memory retrieval tool results are not sources for bypassing thread exclusions.
- Preview and execution share planner/envelope assembly. Live queries carry an identity
  derived from scope and selection inputs; consume results only if identity still matches.
  Also filter threads, messages, runs and compaction details by the current thread, because
  Dexie retains the prior query value while new dependencies resolve.
- The compact context popover opens a separate flat details sheet. Closing the popover
  must not unmount the sheet. Preview and historical request versions have distinct titles;
  live row availability is separate from frozen historical content. Exclusion writes are
  awaited, locked against duplicates and recoverable on errors.
- Project ZIP includes memory inclusion/version data only; thread exclusions and run audits
  remain outside project export. Imported memories still require review before retrieval.

## 4. Validation & Error Matrix

| Condition | Result |
| --- | --- |
| Unbound, deleted or mismatched owner | No tools / reject owned read or request |
| Inactive, unreviewed or excluded memory | Never automatically selected or returned by memory tools |
| Whole entry exceeds budget | Omit; report eligible omission count |
| Unknown capacity | 4096 cap, no invented total-context percentage |
| Edit/exclusion during stream or tool work | Apply at next settled model request |
| Effective base / Responses prefix mismatch | Fail before transport, preserve original state |
| Audit persistence failure | No model POST and no fictitious dispatched step |
| Memory/source stale or missing | Explicit availability result; do not invent evidence |
| Rapid project/thread change | Prior query result hidden until matching scope resolves |
| Thread-local exclusion restored | Future selection can include it, global row unchanged |

## 5. Good / Base / Bad Cases

- Good: confirmed task A lesson is reviewed into project memory; relevant new thread B
  supplies it with exact revision/source, while unrelated project C stays excluded.
- Base: explicit project-wide rule is included without keyword matching if budget permits;
  a disabled or pending-review copy is never automatically included.
- Bad: all convention entries are universal, an excluded entry reappears after compaction,
  or current live text is shown as what an old model request received.

## 6. Tests Required

- `memoryRetrieval.test.ts`: ranking/language/isolation, exact whole-entry budget, deterministic
  ordering, reversible exclusions, Chat/Responses immutable audit, actual two-step transport,
  checkpoint failure, retry and compaction with corrected independent memory.
- `agentMemoryTools.test.ts`: frozen mode/owner/tool validation, reviewed lifecycle, exclusions,
  stale slices, cross-task source proof and private/recursive tool-result exclusions.
- `memoryInclusion.test.ts`: explicit opt-in revisions, strict enum and ZIP pending review.
- Existing execution/context/tool/settings suite. Browser fixture: confirmed A-to-B request,
  foreign control, preview vs history, exclude/restore, edited version/reload/source link,
  inclusion editor, keyboard and narrow viewport. No paid generation for these checks.

## 7. Wrong vs Correct

Wrong: mutate `agentSnapshot.instructions` with newly retrieved body and rewrite old audit.
Correct: replace the validated independent effective-base segment, preserve original request
and old per-step snapshots, then record the next snapshot at its dispatch checkpoint.

Wrong: render `useLiveQuery(..., [projectId])` result immediately as the new project's preview.
Correct: return a query identity with the result, compare it to the current input identity,
and hide retained results while the new query resolves; scope compaction details too.
