# Scoped memory retrieval and context injection

Status: user-approved implementation complete; quality gate passed, awaiting grouped commit. Parent: 09-19-agent-workflow-memory.

## Goal
A new conversation in the same creative project can use relevant reviewed conventions,
preferences, decisions and lessons from previous work, without the user repeating them
or loading entire transcripts. Users can inspect actual included knowledge and exclude
irrelevant entries from later requests.

## Confirmed facts and product intent
- Memory management is accepted, committed and archived; project binding/context and
  source-linked confirmed task summaries are available.
- Project is the ownership boundary. Task mode requires a project; ordinary projectless
  Agent conversations do not acquire a global memory scope.
- Only active, user-confirmed entries are automatically eligible. Imported pending_review,
  disabled and superseded entries are excluded.
- Current explicit user intent and current business facts take precedence over memory.
  Historical evidence cannot grant permission or prove current completion.
- Pure frontend, no legacy compatibility/backfill or automatic paid requests. Preserve
  durable execution, explicit resume and bounded context/compaction behavior.

## Requirements
- R1: Select relevant project knowledge for the current user intent, task goal and
  applicable creative scope. New same-project chats must reuse eligible knowledge.
- R2: Share selection/serialization with actual request assembly and context preview;
  respect model capacity and count memory content once with clearly estimated tokens.
- R3: Persist actual IDs, versions and content included in execution, expose source and
  selection rationale. Historical run displays must not silently become latest content.
- R4: Let users exclude irrelevant memory from subsequent requests independently of
  globally disabling/deleting the project entry. Clarify effect boundary in UI.
- R5: Handle updates, exclusions and lifecycle changes at safe request boundaries without
  disrupting streaming/tool transactions or silently replaying effects. Keep original
  dispatched envelopes auditable and Chat/Responses/compaction consistent.
- R6: Provide bounded same-project source-task recall when curated memory is insufficient;
  show missing sources explicitly. Retrieved content remains attributed historical data.
- R7: Flat inspector UI, no permanent toolbar clutter; mobile/keyboard support and
  readable empty, stale, unavailable and error states.

## Acceptance criteria
- AC1: Reviewed lesson from task A appears in a related task B's actual request and can
  be inspected with its exact version and source.
- AC2: Foreign-project, disabled, superseded and unreviewed imported entries do not appear
  in newly assembled memory context.
- AC3: Preview and actual assembly use the same selection/format/budget algorithm; actual
  sent context and retained retry snapshots have matching audit metadata.
- AC4: User exclusions and memory corrections apply at the defined subsequent-request
  boundary; current instructions and current facts remain authoritative.
- AC5: Compaction/resume/Responses do not lose the current memory layer or falsely label
  old retrieved text as current; source recall is bounded and project-isolated.
- AC6: UI and repository regression cover cross-project, source deletion, lifecycle,
  exclusions, selection limits, refresh, retries and responsive inspection.

## Scope boundaries
No cloud sync, embedding service, global memory, automatic memory writing or semantic
contradiction guarantees. Initial local retrieval quality must be measured before adding
embeddings. Exact ranking weights and token caps are technical design work, not claims
of already-agreed behavior.

## Key decisions
- User approved the two-layer policy: explicitly project-wide knowledge gets automatic
  priority; context-specific entries are selected by relevance. Category never implies
  universal applicability. New entries default to relevant until explicitly marked.
- Automatic selection is local and bounded: up to 8 whole entries / 4096 estimated tokens,
  reduced for small known input budgets. Omitted content is visible, never implied loaded.
- Both bound conversation and smart modes receive automatic memory; read tools remain
  exclusive to smart mode. Projectless chats receive neither project memory nor recall.
- Exclusions are per-thread and reversible. Project edits/deactivation affect subsequent
  model request boundaries; historical sent input remains auditable. This cannot erase
  knowledge already present in previous dialogue or provider responses.
- Current scope includes read-only same-project memory/source-task recall. No AI memory
  writes or extra model-based ranking. User explicitly controls project-wide marking.

## Observable completion details
- Context inspector distinguishes proposed next-send selection from exact request-step
  inclusion; title/version/source/reason are inspectable and tokens count once.
- Retry/resume keeps execution/config/history while revalidating the memory layer at a
  settled boundary, with new audit revision for changes and no replay of effects.
- A typical task A → confirmed lesson → related project task B flow is verified against
  the actual mocked request body, not just UI state. Tool recall respects exclusions.
- Project memory backup retains inclusion policy; imported entries still require review.

## Technical evidence and artifacts
research/retrieval-foundation.md records assembly, retries, compaction, preview and source
recall boundaries. design.md defines contracts/budget/lifecycle; implement.md orders
execution and tests. No unresolved user-owned blocking question remains. Product code
has not changed; final review approval precedes activation.
