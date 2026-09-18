# Design — context management

Default policy and implementation were approved by the user. This document records
the implemented design and evidence-based refinements.

## Settings and UI
Defaults: autoCompress=true, limitHistory=false, historyMessageCount=20.
Shared validated ContextPolicy: autoCompress, limitHistory, historyMessageCount,
optional locally declared context budget for unknown models. General Agent stores
new-thread defaults; thread stores a resolved snapshot plus explicit overrides; run
freezes the effective policy and capacity/source used. Existing threads resolve
missing fields deterministically rather than silently following future default edits.
Parameters live in + → parameters on both composer surfaces. Home edits defaults;
detail edits this thread. Flat labeled rows, switches, accessible numeric input,
responsive fixed-width popover, outside-click/Escape dismissal and clear scope copy.
Only expose controls supported by actual runtime behavior.

## One context planner
Create a pure function taking scoped messages, finished summary records, immutable
run/task settings, model metadata, tool schemas and current draft. Output includes
selected groups/source IDs, protected tail, active summary, allocations, capacity
source, reserved budget and an actionable plan: ready / compress / blocked.
UI calls it for preview; dispatch recomputes from persisted data under thread lock.
Do not use lifetime total token usage as the size of the next request.

History count means previous user/assistant message units, not hidden tool messages.
Current draft and required instruction envelope are excluded. Keep complete groups;
if a boundary would strand an assistant reply, omit that incomplete oldest group.
Zero means no historical messages or historical summary. Tool rounds remain intact.
Selection applies before compression. A summary is reusable only when all covered
sources remain eligible; a stricter history window must not leak excluded content.
Exact ordered source copies (ID, role and content) detect stale summaries without hash
collision ambiguity. New sends resolve the newly selected model capacity; factual
source-valid summaries are model-independent.

Threshold policy should be named/tested centrally. Proposed reference starting point:
50% initial, 65% subsequent threshold with conservative estimation and explicit output
reserve; never exceed the usable input budget. Actual ratios and retention sizes are
implementation constants validated with fixtures, not an advertised provider guarantee.
When capacity is unknown, use only an explicitly labeled user budget; do not display
128K as model metadata. Indivisible large messages or oversized instructions require
an actionable explanation rather than repeated ineffective compression.

## Durable compaction
Add a studio-global IndexedDB table for compaction operations/versions, scoped to
thread and run. Record exact covered display messages, previous summary,
connector identity (no key), model, policy, status, output, usage, before/after estimates
and timestamps. Status: running/completed/failed/interrupted; a separate
activated checkpoint ensures incomplete text never becomes the working summary.
Thread deletion cascades compactions; project exports exclude these records.

Run preparation snapshots the selected context and pending compaction plan atomically.
Summarization then happens outside the DB transaction, under the existing Web Lock
and abort controller, with the current connector/model and no tools. Summarization
has its own instructions and accounting rather than reusing the answer's streaming
writer or token speed. It is an auxiliary model call authorized by the enabled setting
and Send; UI discloses the additional model usage, without per-pass confirmation.

Activate output and the new request checkpoint in one transaction after validating
source ownership/revision and successful terminal protocol completion. Reject empty,
truncated or unusable summaries. Merge prior summary only with newly covered sources;
retain recent dialogue verbatim. Chunk unusually large eligible prefixes with bounded
work and checkpoints so summarization itself does not overflow. Avoid recursive
compaction loops and reusing the same failed source span automatically.

Check again between model steps after all tool outputs are durably settled. Preserve
the entire live tool-call/output chain, task goal/plan and provider-required reasoning
continuation items. Responses and Chat Completions must derive consistent checkpoints;
never edit raw tool ledger records to shrink context. Prototype opaque Responses item
retention first: if an indivisible provider group cannot fit, block explicitly.

## Failure and recovery
No replacement until summary success. Stop propagates to both summary and answer
stages. Reload marks abandoned compactions interrupted under the thread Web Lock;
no automatic HTTP resubmission. Explicit resume uses saved source plan/checkpoints,
retains tool results and never repeats completed actions. If summary fails, offer
retry or a deliberate settings change; do not silently discard history and continue.
Frozen old retries remain frozen even if UI settings have since changed.

## Summary contents and future memory boundary
Goal, explicit constraints/corrections, decisions, completed actions with evidence,
unfinished actions/questions, entity/result IDs. Explicitly retain which goals were
completed, cancelled or superseded; the latest user correction takes precedence.
Preserve uncertainty, source and
scope. Summarize historical instructions as quoted data; they cannot grant permission.
This record is working context. Future Trellis wrap-up and long-term memory may
reference it but must not automatically promote it to verified reusable knowledge.


## Implementation refinements and limits
- No existing tool ledger or opaque continuation is summarized. The base history is
  the only replaceable prefix. This follows the runtime's all-call ledger equality
  contract and makes approval/recovery safe; an oversized live chain fails explicitly.
- Chunking selects complete old turns that fit the summarizer input budget; eight
  passes maximum. Each completed version is activated before starting the next one.
- Summary jobs are created immediately before HTTP, not while waiting for approval.
- User-facing progress uses the existing composer status; summary/source inspection
  lives in the context popover. Retry/stop reuse existing reply/runtime controls.
- No real provider keys/paid requests used for verification. HTTP fixtures exercise
  Chat Completions and Responses, browser tests exercise full stop/regenerate/reload.
