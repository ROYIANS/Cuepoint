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
- `inspectAudioGenerationOutputs(job, {resultKey?, offset?, limit?} = {}): Promise<AudioOutputEvidence>` reads current local
  output ownership, media metadata and speech selection/placement. Caller supplies a
  current job within a consistent transaction.
- `readAudioJobSummary(projectId, jobId)` reloads job and outputs together in a read-only
  audio transaction, returning original summary fields plus `outputs` and `inspectedAt`.
- `taskGenerationSource(task, jobId, resultKey?)` accepts owned sound jobs in addition to existing
  image/video batch sources. `listTaskGenerationSourceInventory(task, {offset?, limit?})` feeds task tools and the
  records source picker with explicit coverage; `listTaskGenerationSources` is the compatibility array view.
- `TaskRecordSource` carries an optional exact sound `resultKey`; `taskRecordSourceIdentity`
  is the tuple `[type,id,resultKey ?? null]`. `taskGenerationEvidenceId` hashes that exact key
  for bounded catalog IDs while retaining legacy aggregate IDs.

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
Aggregate-result eligibility requires all known outputs locally available
and a saved/target-conflict lifecycle. An exact nonempty unique sound result key (at most
512 characters) can separately support its one currently owned available output, even
when siblings remain unresolved. It never certifies the aggregate generation as complete.
Media/output provenance must match provider/model/job/task/clip/audio index; generated
speech additionally requires an actual TTS take. A later read does not acquire submission ownership.
Agent voice batches use the shared confirmed origin and actual retry-chain proof in
[audio-batch-arrangement.md](./audio-batch-arrangement.md).

Task `result` writes and wrap-up tool sources resolve current job evidence rather than
trusting historical saved JSON. Selection and timeline placement are distinct fields.
Wrap-up fingerprints include full current output rows and placement facts, so deletion,
output metadata/provenance edits, selection changes and clip/track edits invalidate previous review.
Every individual output identity contributes, including outputs beyond the 100-row display page.
Source inventories report total/included/omitted/offset/nextOffset and retain aggregate plus
individual identities; a 101st output cannot be silently omitted from freshness checks. Active/uncertain sound jobs block
completion; an abandoned unpaid prepared intent remains observation-only and is not a
permanent blocker once its execution has settled. Source inventories use consistent read
transactions, and storage failures propagate instead of being treated as missing placements. AI prose and plan status remain
separate from this structural verification. The separately approved bounded final-reply review
in [agent-write-evidence.md](./agent-write-evidence.md) uses exact spans and listed observations;
it does not certify arbitrary prose, entire batch completion or acoustic quality.

### 4. Validation & Error Matrix
| Condition | Outcome |
| --- | --- |
| Downloaded raw speech response with no take | Missing output; not deliverable |
| Remote completion without local work/media | Observation only |
| Tombstone or missing work/take/file | Historical save loses current eligibility |
| Foreign media, wrong output-media/job link | Unverified |
| Empty/non-audio blob or invalid decoder metadata | Invalid media |
| Saved take without selection/clip | Available; neither selected nor placed |
| Partial healthy results | Exact eligible result may support one file; aggregate remains unresolved |
| Blank/duplicate/missing/foreign result key or key on image/video source | Reject source |
| More than 100 source/output entries | Page with coverage; fingerprint all eligible identities |
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
`audioTaskEvidence.test.ts` covers source ownership, per-result identity, paginated inventory,
aggregate result rejection, 101st-output freshness, output provenance/metadata changes, stale
summaries and completion. `audioBatchFinalReview.test.ts` covers confirmed batch provenance and retry chains. `audioGenerationAgent.test.ts` verifies actual
ledger results include inspected output evidence. Preserve existing task/film batch tests.
Native browser transactions and live provider/acoustic tests are separate acceptance.

### 7. Wrong vs Correct
Wrong: mark a result complete because historical `status === "saved"` contains a media ID.
Correct: read current owned output and media, preserve original submission provenance,
and report independently whether it is saved, selected, placed, or still unverified.


## Picture/video current output and tool provenance (C01; 2026-09-30)

## 1. Scope / Trigger
Apply to picture/video current generation sources in task records, source inventories and task wrap-up. Historical ledgers establish original effects; current deliverability requires current local evidence.

## 2. Signatures
`inspectTaskGenerationOutput(job)` reads current media and legal target slot without network/decoding. `ownedTaskGenerationJob(task,job)` verifies task/run/batch ownership. `taskGenerationToolSource(task,call)` combines original call success/provenance with current output. Their native promises are adopted with `Promise.resolve` by Dexie transaction callers.

## 3. Contracts
Available files require matching job/target/result kind and owner, downloaded/applied/conflict lifecycle, nonempty Blob and image/video MIME subtype. Applied additionally requires current project, owned entity, valid asset slot or shot/episode/media-kind slot, and matching result ID/kind. Legitimate downloaded files survive target deletion/replacement as independent file facts, never fabricated current application. Preserve source inventory batch-only behavior and immutable call/job history.

Tool sources require completed supported generation tool, successful original result, exact saved job/output IDs and original submit/query/apply provenance; submit requires both its original call ID and original run ID, while later owned runs may query the existing job. Failed/rejected/unknown/pending calls, arbitrary tools mentioning jobId, failed remote results and conflicts cannot become successful tool effects because an older independent file exists. AI result writes and wrap-up publication validate current sources; ordinary completed non-generation writes remain historical business facts. Fingerprints include eligibility changes.

## 4. Validation / Error Matrix
| Input | Required outcome |
| --- | --- |
| Missing/empty/foreign/wrong-MIME/wrong-kind media or illegal job lifecycle | No current deliverable support; AI result rejected |
| Valid file with deleted/replaced/invalid target | Downloaded file fact; applied=false |
| Failed/rejected/unknown/non-generation tool associated with valid old file | Tool not upgraded; independent generation may remain |
| Completed successful generation with mismatched job/output/provenance | Reject tool source |
| Media/owner/application changes after review | Wrap-up stale |
| Historical ordinary committed write | Preserve original fact |

## 5. Good / Base / Bad Cases
Good: a valid file is offered as downloaded while current application is independently reported. Base: rejected later queries remain rejected without hiding a valid independent file. Bad: existence of a media row or historical success JSON proves a current result.

## 6. Tests Required
Actual record-write, source inventory, wrap-up schema/publication and freshness regressions cover image/video owner/Blob/MIME/lifecycle/slot failures and call states, assert ledger history unchanged. Native Chromium/IndexedDB regression uses many repeated/missing locators and actual publication. Structured fake media proves metadata/ownership eligibility, not decoding, playback or creative quality.

## 7. Wrong vs Correct
Wrong: overwrite every call mentioning jobId with the job's current downloaded outcome. Correct: independently validate original successful tool provenance and current owned output, keeping generation evidence separate.

## E01 wrapup and nested promotion departure (2026-10-09)

### 1. Scope / Trigger
Manual wrapup content/sources and nested memory promotion inside TaskInspector; close/route/owner replacement must not lose edits or create overlapping confirmations.

### 2. Signatures
TaskWrapup accepts optional `onDraftStateChange(ManualDraftState)` and shared `requestDeparture`. Inspector consumes routeDirty/routePending separately from local dirty/pending where a nested MemoryEditor already owns routing.

### 3. Contracts
Freeze wrapup family/revision/content, task/thread/project and opening baseline; sources participate in real dirty equality. Synchronous lock/draft refs and mounted epoch protect immediate actions and old completions. Promotion keeps its B02 epoch/key/frozen source. Publish preparation from the synchronous promotion phase before awaiting candidates. Parent local state conservatively owns an open candidate; route flags delegate the candidate to MemoryEditor's existing blocker while retaining actual wrapup dirty/pending. An explicit local discard resets only its initiating editor and does not remount an unrelated pending operation. No source/fingerprint/CAS or confirmation evidence rule is relaxed.

### 4. Validation / Error Matrix
| Trigger | Outcome |
| --- | --- |
| Rejected manual save | Preserve content/sources/frozen revision and retryable error |
| Candidate preparation starts | Parent sees pending immediately |
| Dirty candidate route cancel/discard | Exactly one candidate route confirmation; cancel retains source/body, discard creates no memory |
| Local close plus browser POP | Resolve one initiating local request; no stuck parent prompt |
| Retired wrapup/candidate completion | No publication into a later editor/session |

### 5. Good / Base / Bad Cases
Good: edit a candidate -> route -> continue -> frozen title/body/source remain. Base: unchanged manual wrapup leaves cleanly. Bad: using candidate object identity as a remount instruction or allowing parent and candidate route guards to each require another discard.

### 6. Tests Required
Keep `tests/b02MemoryPromotion.test.ts` source/epoch/CAS assertions; its host only adds necessary guard callback mocks. E01 browser runner and independent supplements exercise actual manual wrapup, nested MemoryEditor, native persistence and overlapping departure. Fake hook-host proof is distinct from browser scheduling proof.

### 7. Wrong vs Correct
Wrong: effect-only pending publication after candidate read begins, or parent treating a nested candidate as an extra route-blocking owner. Correct: synchronous promotion phase publication plus explicit local/route ownership delegation. Existing conservative candidate ownership is retained; no automatic saving or source reconciliation is added.
