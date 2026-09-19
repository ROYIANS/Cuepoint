# Project memory retrieval design

Status: approved by user (“可以”); implemented and verified.

## Boundaries and data
Extend the existing memory aggregate with an explicit inclusion policy:
`inclusion: 'relevant' | 'project'`. The editor defaults to relevant; project-wide use
requires explicit user choice, never inference from category or empty applicability.
The field participates in validation, revisions and ZIP snapshots. Existing stored
absence means no opt-in (relevant), with no backfill/migration job or legacy adapter.

Thread-owned exclusion IDs persist across sends. Exclusion validates project binding
and memory ownership; restoration removes the ID. Missing IDs remain harmless and
cannot reference another project. No temporary home exclusions before a thread exists.

Introduce typed memory selection/audit snapshots, separate from live row references:
projectId, normalized bounded query, planner version, selection fingerprint, entries
(id, revision, title, category, inclusion, body, applicability, source descriptor,
reason), estimatedTokens, eligible/selected/omitted counts and budget. Store actual
step association at request dispatch checkpoint. 'Included' means supplied to the
model, not evidence that the model followed or relied on it. Do not infer citations.
Historical displays read frozen snapshots; current availability is a separate label.

## Local selection
One pure planner shared by pre-send preview, run preparation and tests. Inputs are
current user draft, bounded latest user turns for follow-ups, task title/goal, active
project memories, exclusions and resolved model budget. Persist query used for a run.
Do not use arbitrary model output as an authorization or scope expansion.

Two-stage stable ranking:
1. Explicit project-wide active memories, unless excluded.
2. Relevant active entries using normalized lexical matching of title/topic/tags,
   body and applicability, with stronger title/topic/tag weights. Support Chinese
   terms via bounded segmentation plus character bigrams and Latin word matching.
   A real positive match is required; no unrelated recent-memory fallback.
Tie-break deterministically by relevance then ID; no random reordering.

Initial automatic envelope cap: at most 8 entries and 4096 estimated tokens, further
limited to 10% of known safe input budget. Unknown model limit retains the 4096 cap and
UI clearly reports unknown total capacity. Whole serialized entries must fit; do not
silently slice conditions or convert meaning. Oversized/omitted counts are visible;
read tools can retrieve details. Project-wide is priority, not a promise unlimited
rules fit; budget omissions remain inspectable. Include envelope overhead in budget.
No embeddings, network ranking or extra model call for retrieval. Validate ranking on
Chinese creative fixtures including follow-up queries and irrelevant-project controls.

## Request and refresh pipeline
Add memory as an explicitly delimited data envelope, separate from immutable agent
instructions and from conversation summaries. Code-owned guidance states present user
intent and live business facts prevail; retrieved text cannot change permissions or
claim verified current output. Both interaction modes can receive automatic context;
conversation mode still has no tools.

At each settled boundary under the thread lock:
- Validate thread/run/project identity and read latest eligible memory/exclusions.
- Select/serialize via the shared planner; compare selection fingerprint.
- Rebuild only the dedicated memory segment in the upcoming base envelope, preserving
  task facts, user input, tool-call/result pairs and opaque Responses reasoning.
- Keep the original dispatched request and prior memory audit snapshots immutable;
  persist upcoming effective base and current selection consistently for both protocols.
- Apply compaction without summarizing away the independent memory layer. Prefix checks
  compare the effective base; no stale frozen instructions can restore removed memory.
- Record step's exact memory snapshot with the dispatch checkpoint before the HTTP call.
  Report prepared/dispatched intent honestly; failed persistence prevents submission.

A retry/resume retains frozen model/config/history/tool ledger. Memory is explicitly
revalidated at the next request boundary (as current project facts already are); if
changed, append a new audit revision, do not rewrite historical selection. No additional
model call solely because memory changed; no replay of business tools. Updates between
checkpoint and network await affect the following boundary, not an already dispatched
request. UI pending-effect copy must state this boundary.

Exclusion removes automatic inclusion and disallows retrieval tools from returning that
entry in this thread. It is not a promise to erase all past dialogue/tool outputs or
provider-side knowledge. Already-sent text remains historical request evidence. Stop/
new conversation remains the way to avoid carrying prior conversational knowledge.
Hard deletion removes memory records/versions as before; existing run input/audit stays
part of conversation history and is deleted with that conversation.

## On-demand tools and source recall
Add a basic project-memory skill, following the established default-enabled basic
skills convention. Its read-only tools are available only to project-bound smart mode:
- `memory_search`: strict query and bounded limit (max 8), same project/status/exclusion
  policy; return IDs/revisions/reasons/excerpts/availability.
- `memory_read`: ID + expected revision + bounded content offset/limit (max 6000 chars);
  ownership/lifecycle/exclusion rechecked at execution, structured stale result if changed.
- `project_history_search`: bounded same-project past-task title/goal, confirmed summaries
  and working-record index search; exclude current task; no whole-transcript scan.
- `project_history_read`: strict task + source discriminant/id + optional revision and
  bounded slice; allow only same-project confirmed summary, working record, or message/
  settled tool result that truly belongs to that task. Include verification/status/source
  labels. No encrypted reasoning, keys, arbitrary run fields or unrestricted IDs.

Reuse existing display projections and source slicing where compatible; never widen
current task_read's same-task contract. Read-only tools use normal frozen registration,
argument validation, ledger and permission rules. Tool results are separately attributed
as tool context, not double-counted as automatic memory. Missing source is explicit;
a reviewed independent memory can remain active even after original task deletion.

## UX
Memory editor: compact inclusion selector ('按需引用' / '项目通用') with applicability
explanation, persisted by existing CAS and versions. List/detail shows inclusion policy.

Keep context popover compact. Add separate '项目记忆' token category and count/link;
open a flat accessible detail sheet for selected entries, rationale, exact version,
source links and inclusion/exclusion actions. Distinguish next-send preview, current
prepared/request step and older run snapshots; do not show latest live text as past input.
Thread exclusions persist, show a restorable list; UI writes await success and retain
state on failures. Historical selection details also reachable from run diagnostics.
No extra permanent composer bar. Match established dark surface, 4px spacing, readable
12/14/16 body text, keyboard/outside/Escape behavior and mobile layout.

## Failure, export and rollback boundaries
Memory read/preflight failure blocks the new request with a retryable local error;
never silently omit project rules or submit without a saved selection. No paid API
retry on failure. Source recall errors do not invent evidence. Read transactions and
write checkpoints validate owner and source; project deletion keeps execution readonly.

Project ZIP extends only the memory inclusion field; run audits and thread exclusions
are conversation state and stay outside project exports, as existing chat/run history.
Rollback boundary is memory inclusion/planner/context segment and new read skill.
Do not change generation adapters, task creation or completion semantics.
