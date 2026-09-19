# Conversation context selection and compaction

## 1. Scope / Trigger
Read before changing composer parameters, history selection, token budgeting, summaries,
run retry/recovery, or model continuation. This is working conversation context, not
Trellis task retrospectives or verified cross-task memory. IndexedDB v11 adds
`contextCompactions` with `id, threadId, runId, status, createdAt` indexes.

## 2. Signatures
- `normalizeContextPolicy(value?): ContextPolicy` — shared LobeHub defaults.
- `updateContextPolicy(threadId | undefined, policy)` — thread or new-thread defaults.
- `resetThreadContextPolicy(threadId)` / `saveContextPolicyAsDefault(threadId)`.
- `selectContextHistory(messages, policy): ContextSource[]`.
- `findApplicableSummary(history, versions): ContextCompaction | undefined`.
- `buildContextMessages(instructions, skills, history, draft, summary?)`.
- `budgetContext(messages, tools, capacity?, hasSummary?, extraTokens?)`.
- `prepareRunContext(runId, tools, apiKey, signal, fetchImpl?): Promise<AgentRun>`.
- `beginAgentRun` accepts provider `modelMetadata?` and freezes effective context policy,
  capacity/source, exact source history, draft, active summary ID and base envelope.

## 3. Contracts
Defaults: auto compression enabled, history cap disabled, preset count 20. New threads
snapshot global defaults, including manually created tasks. Existing missing policies
resolve to constants, not future global edits. Counts are safe integers 0–10000; optional
local budget is 2048–10000000 tokens. Local budget may reduce a known capacity, never
inflate it. Unknown capacity remains unknown without an explicit local budget.

Select complete/legacy display messages first; group each user turn with its replies.
Cap counts display messages, rounds down at the oldest group boundary, excludes current
draft/system envelope/tools. Zero drops history AND summaries. Errors/partial replies
are excluded. Source originals are never edited. A reusable completed/activated summary
must cover an exact ordered prefix (ID, role AND content equality) of selected history.
Disabling auto compression uses raw selected history instead of saved summaries.

Capacity uses provider metadata, then local Model Bank, with explicit local ceiling.
Budget uses serialized messages/tool definitions plus opaque reasoning continuation;
apply 25% estimation drift. Reserve min(8192, max(256, floor(capacity × 15%))) output
and ceil(capacity × 5%) safety margin. Trigger at min(input budget, 50% capacity), or
65% with an active summary. This is a heuristic, not a tokenizer/billing guarantee.

Preflight before each model step under the existing thread Web Lock. All tool calls
must be settled. Compact only historical base messages. Preserve the current question,
system/task/skill instructions, entire live tool chain, and Responses reasoning items.
Validate exact base prefix before replacing either protocol envelope. Do not edit ledger
records. Large indivisible turns or protected tool chains block explicitly when unsafe.

Summary requests use current connector/model/protocol, no tools, own instructions, own
usage, and an output cap (up to 4096, within reserved output budget). Serialize prior
summary and new source prefix as user data. Summaries are injected as assistant data,
not elevated system instructions. Chunk at complete turn boundaries so the summarizer
request also fits. At most eight passes per preflight. Preserve recent turn where possible.
No automatic failed-request retry or protocol fallback. Main reply metrics exclude these
auxiliary requests. Enabling auto compression plus Send authorizes auxiliary model usage;
parameter UI discloses this cost.

Persist job before HTTP; atomically activate terminal, nonempty, shorter summary AND
new continuation in one transaction after checking run/thread/version ownership.
Never activate partial output. Stop marks interrupted; restart recovery under the lock
marks abandoned jobs interrupted without network. Explicit retry keeps frozen policy and
successful base checkpoint; tool runs use existing explicit resume without replaying tools.
Changed settings apply to new sends, not old retries. Thread deletion cascades jobs and
late writes cannot resurrect data. Jobs and source copies are outside project exports.

## 4. Validation / Error Matrix
| Condition | Behavior |
| --- | --- |
| Cap 0 / odd count | No history or summary / complete newest groups only |
| Edited or excluded coverage | Ignore stale summary, rebuild from eligible source |
| Unknown capacity, no local budget | Display unknown; no automatic compression |
| Compression disabled and over budget | Fail before HTTP; suggest change then new send |
| Summary failure, empty, truncated, larger | Preserve prior checkpoint; explicit retry |
| Storage failure during activation | Atomic rollback; original request survives |
| Stop or reload | Interrupted summary, no automatic resubmission |
| Pending/unknown tool result | Refuse compaction until resolved |
| Base/Responses prefix mismatch | Refuse activation; retain provider continuation |
| New model/new send | Resolve new capacity; source-valid factual summary may be reused |
| Retry after successful summary then failure | Reuse saved working base, do not pay for it again |

## 5. Good / Base / Bad
Good: compress older discussion, retain recent dialogue/current tools, continue, and
inspect both summary and source text in context details.
Base: short chat uses the shared planner without additional HTTP.
Bad: truncate display records, call old summaries long-term memory, infer 128K for an
unknown model, drop tool results/opaque state, or auto-retry after losing a response.

## 6. Tests Required
`tests/contextManagement.test.ts`: scopes/defaults; 0/odd/large limits; exact source
applicability; output reservation; real request ordering; separate metrics; multichunk
summaries; failure/abort/delete; activation rollback; reload and explicit retry; Responses
opaque/pair retention; recheck after actual tool execution without replay; unknown/disabled
capacity and oversized current input. Existing run ownership, approval and task tests apply.
Browser fixtures: home/detail persistence, desktop/narrow layout, keyboard and outside
close, stop during summary, explicit regenerate, summary/source inspection, reload no HTTP.

## 7. Wrong vs Correct
Wrong: rebuild Responses history from display text after compression.
Correct: replace only the verified base envelope and retain the exact provider suffix.

Wrong: reuse any last summary after narrowing history to 20 messages.
Correct: require its entire exact ordered coverage to be a prefix of the selected history.

Wrong: store new defaults only globally so old conversations change silently.
Correct: snapshot when creating a thread and use deterministic defaults for legacy records.

## Task work records
New task runs and ContextUsagePanel both use getTaskContext from agent/taskContext.ts.
It assembles current goal/acceptance/Todo and up to eight current record excerpts
(1,200 body characters each), plus task tool definitions. These count in the shared
request budget. Current running/continuing requests retain their frozen snapshots;
new records arrive as tool results. Record history is neither compression nor cross-task
long-term memory. See agent-tasks.md for provenance and paged-read contracts.

## Project facts
See [Project Context](./agent-project-context.md). Project snapshots share the initial
instruction envelope; settled continuations append only visible fact differences.
Compaction must validate the frozen project before every request and activation.

## Project reference integration

See [Project References](./agent-references.md) for shared source ownership,
request materialization, withdrawal, source evidence and ZIP lifecycle contracts.
