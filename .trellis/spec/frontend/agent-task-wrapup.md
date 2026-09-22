# Task verification and wrap-up

## 1. Scope / Trigger
Read when changing task review, completion, summary generation, evidence assembly,
source availability, recovery or wrap-up persistence. Working records remain in
`agent-tasks.md`; this is not context compaction or cross-task long-term memory.

Batch queue, selection and genuine generation-source evidence extend these contracts; read [Batch Generation](./agent-batch-generation.md) when touching those paths.

## 2. Signatures (DB / API)
- Dexie v14 adds `agentTaskWrapups` and `agentTaskWrapupVersions`; existing data is
  preserved. Both are task/thread-owned studio data, excluded from project ZIPs.
- `WrapupContent`: overview, results, acceptance findings, decisions, lessons,
  unresolved items. References use catalog IDs; findings bind criterion index and
  exact text to the captured task revision.
- `getTaskWrapupState(taskId)` returns latest, confirmed, version history, stale
  flag, current evidence status and completion blockers.
- `createManualWrapup(taskId)`, `saveWrapup(taskId,id,content,expectedRevision)`,
  `confirmWrapup(taskId,id,expectedRevision)` are separate durable operations.
- `prepareTaskWrapup(taskId,connector,model,controller,fetchImpl?,effort?,metadata?)`
  prepares one read-only AI draft; cancel/recovery never replay a model request.
- `setAgentTaskLifecycle(id,"completed",{id,revision})` requires the displayed
  confirmed summary identity. Archive can retain partial work; reopen invalidates
  previous review via task revision.

## 3. Contracts
### Persistence and ownership
Preparation writes a durable preparing row while holding the existing thread Web
Lock. Normal execution and manual task mutation cannot race preparing summaries.
Network waits occur outside database transactions. Publishing rechecks ownership,
status, source fingerprint and cancellation. Deletion cascades all summary versions;
late results cannot recreate the task. Saved revisions remain immutable history;
confirmed content requires a new draft family for later changes.

Evidence loops must adopt possibly cached/locally rejected native promises through
`await Promise.resolve(entity(...))` inside the Dexie transaction. Long chains of bare
native awaits without a new IndexedDB operation can lose Dexie's transaction zone in a
real browser and raise PrematureCommit even though small fake-indexeddb tests pass.
Do not hide this by returning partial evidence, dropping transactions or adding timers.
Wrap-up live-query failures stay local to the inspector: retain its last successful
snapshot and unsaved editor, show an explicit retry, and block mutations until a current
read succeeds. A failed hidden wrap-up tab must not crash the conversation page.

Manual draft saves use revision and current-family checks. Conflicts preserve editor
content. New manual families preserve prior decisions/lessons/unresolved text and
reset acceptance to review. They never silently discard outstanding issues merely
because their sources are unavailable. Confirm and complete are distinct actions.

### Evidence and AI boundaries
Sources are owned user messages, task run outputs, working records, tool ledger,
generation jobs and code-resolved current entities. A successful bookkeeping call,
assistant assertion or checked Todo does not prove an actual business result.
Generation must distinguish downloaded media from an output currently applied to its
intended slot. Deletion or changed slots invalidate that current outcome, including
historical tool-call evidence referring to the job. Historical create/update success also loses delivery eligibility when its referenced
entity disappears; genuine deletion remains a valid completed effect. Navigation
targets are resolved in code, never accepted as model-generated URLs.

Snapshot fingerprints include full source history and task requirements, not only
visible excerpts. Model input is bounded to 48 sources with 1,800-character excerpts,
with quotas for unresolved work, business evidence, records and recent conversation.
Coverage discloses omitted and truncated records. Metadata/context policy supplies
input budgeting; an oversized request fails before HTTP with a manual/larger-model
path. No automatic staged model calls or implicit retry.

Model output is strict structured JSON with bounded fields and catalog-only source
IDs. AI result claims require actual effect evidence; decisions, lessons and
unresolved claims require sources. AI acceptance cannot independently certify met:
findings remain review until a human edits/checks them. No business tools are exposed
and preparation cannot dispatch generation or alter creative entities.

### Completion and interface
The flat inspector adds an acceptance summary tab. AI preparation, manual editing,
saving partial work, confirming a summary and completing a task are separate. Manual
review works without a model connector. Unsaved edits block accidental sheet closing;
source/row conflicts retain the local text. Historical source bodies remain snapshots,
while links and availability reflect current state.

Completion requires current confirmed identity/revision, unchanged evidence, all
criteria met, all Todo completed, no unresolved summary items and no active/unknown
execution outcomes. Past resolved failures remain evidence/lessons, not permanent
completion blockers. No automatic completion on an AI response or summary save.

On route mount/window focus, lock-aware recovery changes abandoned preparation to
interrupted even if the inspector is closed. A live owner in another tab is not
interrupted. Failed/stopped preparation preserves prior confirmed/manual history;
retry is an explicit user action. Reopening requires a fresh acceptance review.

## 4. Validation & Error Matrix
| State | Behavior |
| --- | --- |
| No connector | Manual draft/edit/confirm/complete available |
| AI returns tool calls, foreign IDs, invalid criteria | Reject; retain previous summary |
| AI marks acceptance met | Downgrade to review |
| Changed goal/criteria/record/entity/media/slot | Old review stale; cannot complete |
| Stale row or newer draft family | Reject mutation; preserve local edit |
| Model failure/stop/reload | Durable failed/interrupted; no auto HTTP retry |
| Active tool/unknown remote outcome | Completion blocked |
| Resolved historical failure | Can retain lesson without permanent completion block |
| Archive/reopen | History retained; reopened task needs fresh review |
| Thread deletion during request | No late resurrection |

## 5. Good / Base / Bad Cases
Good: owned effects → source-backed AI proposal → human findings → saved and
confirmed summary → explicit completion. Base: legacy task without criteria uses
manual review and ordinary Todo/busy guards. Bad: a model certifies its own work,
a past successful apply proves a now-deleted output, or retry regenerates assets.

## 6. Tests Required
Run a real-browser transaction test with at least 150 repeated entity locators and
locally invalid locators, plus distinct-query controls. Open a running task inspector,
verify live checkpoints continue, and inject a transient read failure to check draft
retention, disabled saves and successful explicit reread. fake-indexeddb alone cannot
establish native transaction lifetime correctness.

Use wrap-up repository/transport tests for migration, ownership, revisions/families,
current generation evidence, source quotas, capacity, cancellation, recovery,
completion, reopen, cleanup and failed publication. Run browser fixtures with a mock
provider for offline manual review, AI no-tools request, failure/reload, unsaved CAS
conflicts, history, keyboard and narrow-screen layout. Never require a paid request.

## 7. Wrong vs Correct
Wrong: reuse a confirmed record by editing its text. Correct: new draft family with
retained history and fresh acceptance.
Wrong: every failed historical tool blocks completion forever. Correct: distinguish
unresolved live outcomes from resolved historical failures and explicit review items.
Wrong: show snapshot links as available forever. Correct: preserve historical prose,
resolve current source status, and disable unavailable navigation.

## Project reference integration

See [Project References](./agent-references.md) for shared source ownership,
request materialization, withdrawal, source evidence and ZIP lifecycle contracts.

## Sound generation outcome evidence

### 1. Scope / Trigger
Use this contract for audio/music generation summaries, task sources, record validation,
wrap-up freshness and task completion. Provider query observations remain specified in
[audio-music.md](./audio-music.md).

### 2. Signatures
- `inspectAudioGenerationOutputs(job): Promise<AudioOutputEvidence>` reads current local
  output ownership, media metadata and speech selection/placement. Caller supplies a
  current job within a consistent transaction.
- `readAudioJobSummary(projectId, jobId)` reloads job and outputs together in a read-only
  audio transaction, returning original summary fields plus `outputs` and `inspectedAt`.
- `taskGenerationSource(task, jobId)` accepts owned sound jobs in addition to existing
  image/video batch sources. `listTaskGenerationSources(task)` feeds task tools and the
  existing records source picker.

### 3. Contracts
`outputs.results` includes up to 100 whitelisted entries: key/title/IDs, availability,
available, saved output revision, media size/MIME/decoded metadata, selected status,
valid timeline clip IDs/count and placement fingerprint. Total/included/omitted disclose
coverage; `allAvailable` covers known listed results only, not remote task completion.
No URLs, raw media, credentials, or fresh audio decoding enter evidence. File presence
and saved decoder metadata do not establish current playback or acoustic quality.

A sound generation source requires its original approved submission call and run to
belong to the current task, thread and project. A later query cannot adopt a foreign or
manual origin. Imported dormant jobs are historical project data, not task effects.
Complete-result eligibility additionally requires all known outputs locally available
and a saved/target-conflict lifecycle. Partial healthy outputs remain inspectable
observations and cannot certify the aggregate generation as complete.

Task `result` writes and wrap-up tool sources resolve current job evidence rather than
trusting historical saved JSON. Selection and timeline placement are distinct fields.
Wrap-up fingerprints include current output and placement facts, so deletion, selection
changes and clip/track edits invalidate previous review. Active/uncertain sound jobs block
completion; an abandoned unpaid prepared intent remains observation-only and is not a
permanent blocker once its execution has settled. Source inventories use consistent read
transactions, and storage failures propagate instead of being treated as missing placements. AI prose and plan status remain
separate from this structural verification; arbitrary final chat text is not classified.

### 4. Validation & Error Matrix
| Condition | Outcome |
| --- | --- |
| Downloaded raw speech response with no take | Missing output; not deliverable |
| Remote completion without local work/media | Observation only |
| Tombstone or missing work/take/file | Historical save loses current eligibility |
| Foreign media, wrong output-media/job link | Unverified |
| Empty/non-audio blob or invalid decoder metadata | Invalid media |
| Saved take without selection/clip | Available; neither selected nor placed |
| Partial healthy results | Inspectable; aggregate result remains unresolved |
| Manual/foreign/dormant/unapproved origin | Excluded from task result evidence |
| Output or placement edited after review | Summary stale |

### 5. Good / Base / Bad Cases
Good: a saved song has an owned work and nonempty local audio file; its source may support
local-delivery evidence while audition remains unverified. Base: a query fails but earlier
saved siblings remain inspectable. Bad: a remote completed status or stale media ID is
used as proof of a currently usable song.

### 6. Tests Required
`audioOutputEvidence.test.ts` covers raw-vs-saved media, missing/empty/foreign outputs,
selection/placement, deleted history, coverage and no extra network traffic.
`audioTaskEvidence.test.ts` covers source ownership, current task reads, aggregate result
rejection, stale summaries and completion. `audioGenerationAgent.test.ts` verifies actual
ledger results include inspected output evidence. Preserve existing task/film batch tests.
Native browser transactions and live provider/acoustic tests are separate acceptance.

### 7. Wrong vs Correct
Wrong: mark a result complete because historical `status === "saved"` contains a media ID.
Correct: read current owned output and media, preserve original submission provenance,
and report independently whether it is saved, selected, placed, or still unverified.
