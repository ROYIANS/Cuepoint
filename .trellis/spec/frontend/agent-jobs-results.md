# Agent jobs and retained reports

## 1. Scope / Trigger

Read when changing foreground work, retained tool text, report paging/cleanup or
their parent lifecycles. Studio owns these product bindings; the reusable core
keeps its existing serial loop, result guard and compaction. Actual first
producers are `web_read` and `project_media_check`. A saved job does not create its own execution owner. E11 retains the actual
application-service invocation across view navigation, including its original tool/report completion. Native directory,
process and thumbnail work and any changed background lifetime require their
own implementation and runtime acceptance.

## 2. Signatures and owners

`features/agent/models/agentJob.ts` defines `AgentJob`, `AgentJobResult`,
`AgentJobResultChunk`, `AgentJobReader` and `AgentJobPage`. The singular
ProductStore registers text-only `agentJobs` and `agentJobResultChunks`; jobs
are unique by original `callId`. Chunks carry `jobId`, ordinal, UTF-16 offset,
text and actual UTF-8 byte length. No native token, path or Blob carrier is
introduced. Keep the current TS/JSON registry, browser declarations, Rust
registry/counts and native assertion discovery synchronized.

`features/agent/commands/agentJobs.ts` owns the actual commands:

```ts
interface AgentJobContext {
  runId: string; threadId: string; callId: string;
  projectId?: string; store?: ProductStore;
}
interface AgentJobReader {
  threadId: string; projectId?: string;
  original?: {runId: string; callId: string}; // exact historical UI row
  caller?: {runId: string; callId: string};   // current read-tool invocation
}
// Actual commands return promises. Expected revision is a saved job revision.
admitAgentJob(context, selection) // {job, admitted, result?}
markAgentJobRunning(context, jobId, expectedRevision, options?)
stopAgentJob(context, jobId)
checkpointAgentJob(context, jobId, expectedRevision, progress)
publishAgentJob(context, jobId, expectedRevision, publication)
readAgentJob(reader, jobId, store?)
readAgentJobPage(reader, jobId, offset = 0, limit = 6000, store?)
clearAgentJobResult(reader, jobId, store?)
recoverAgentJobs(threadId, actualThreadOwnership, store?)
```

Its `AgentJobAdmissionError.kind` distinguishes the actual `byte_quota` and
`job_limit` guards. A web refusal before producer admission can return the
bounded `retention_unavailable` failure with `serviceMayHaveRun: false`; it must
use the guard's fixed public guidance, not echo arbitrary store error text.
Unknown admission remains unresolved and permits no HTTP. With no admitted job,
the UI shows this acknowledged ledger failure inline instead of inventing a
missing saved report.

The video feature owns `MEDIA_CHECK_TOOLS`; Agent owns `JOB_TOOLS` and
`read_job_result({jobId, offset?, limit?})`. Existing web tools remain in
References. Register exact consumed symbols/types in Studio ownership policy;
do not add a generic facade or another store/loop.

## 3. Contracts

Admission validates the durable running run, claimed/offered call, assistant
message, thread and fixed project relation. It freezes the call envelope and
selection, reserves capacity and acknowledges before any provider/file work.
Only `admitted: true` authorizes a producer start. Existing unresolved admission
does not authorize another attempt. Reads and IO happen outside short ProductStore
writes. Progress comes from committed observations, never timers or guessed
percentages.

Statuses are `accepted | running | stopping | stopped | completed | failed |
unknown`. Terminal job status is separate from original call completion: a
completed call can return an honestly stopped/failed report. Publication commits
chunks, descriptor, coverage and original bounded `call.result` together. Keep
network tools non-atomic for external effects; do not put HTTP inside
`executeAtomicTool` or call an uncertain acknowledgement a proven rollback.
Reconcile durable completion before returning unknown, and return its original
saved result even after a later clear. Never dispatch a producer to reconcile.
The saved output descriptor and the descriptor serialized in `call.result` must
share the same JSON representation, including absent optional metadata. An own
`undefined` property is not preserved by JSON serialization and can make exact
revision comparison reject a valid report. Normalize at the publication owner;
do not weaken readback integrity checks or add fake metadata in consumers.

Limits are 2 MiB per output, 16 MiB per thread, 128 MiB total, 128 job records
per thread and 1,024 globally. Reserve 2 MiB before work and release excess on
publication. Count UTF-8 payload bytes; bound selection/metadata too. A byte
quota can be relieved by clearing terminal results. A record-count limit needs
deleting an unneeded owning conversation/project where applicable; clearing
text preserves its small record and cannot falsely promise to release that
count. No silent expiry or automatic eviction.

The original serialized result is at most 16,000 UTF-16 units; its preview is
at most 8,000. JSON escaping and metadata count toward the serialized budget.
Only the new preview shrinks. Core's 65,536 guard, existing continuation and
compaction remain unchanged. Published text is immutable until explicit clear.
Clear drops chunks and large selection/observations, retains a small cleared
descriptor and preserves original tool history. Active jobs cannot be cleared.

Page offsets and lengths use UTF-16 units, with at most 6,000 per requested page
and a bounded serialized envelope. Never split surrogate pairs. A nonfinal page
must advance `nextOffset`; reject a limit too small for the current code point.
Current model reads validate `reader.caller` against the current durable
execution and offered tool. Historical UI uses `reader.original` for its exact
row. These are different identities: a later read call need not equal the
original producer call. Both validate the original job/run/call and current
thread/project relationship. A job ID or bare thread ID is insufficient.
Missing/foreign/unpublished/deleted output is unavailable; cleared output says
cleared. Readback makes zero provider requests and is untrusted source data.

`web_read` retains the complete sanitized accepted provider extraction within
the existing 2 MiB HTTP response ceiling. This is not the whole original web
page. Preserve safe requested/final URLs, retrieval time, provider coverage,
current connection revision, redaction and `serviceMayHaveRun`. A dispatched
request remains externally uncertain when its reply is lost. A known adapter
rejection before HTTP can explicitly record no request; an earlier conservative
running flag must not override that known fact. `web_search` keeps its bounded
path and neither operation automatically retries.

`project_media_check({mediaIds?})` reads only the currently bound video project.
Omitted selection means all current videos; explicit IDs must be unique,
existing, project-owned videos. Limits are 64 items, 512 MiB/item and 2 GiB total;
reject an over-limit selection instead of silently checking a subset. Freeze
IDs and metadata, keep binary refs only in invocation memory, and revalidate
before/after each actual serial availability read and before publication.
The publication command generates media
report text from its final transactional selection/observations, so a change in
the last publication gap cannot leave stale ready text in the retained body.
Changed/deleted sources are findings. Browser Blob availability is not hash,
codec or watched-content verification; metadata equality depends on the existing
immutable media-ID contract, not proof of equal bytes.

The current native availability request has no cancellation handle. Stop marks
stopping, starts no next item, drains the actual current await and saves an honest
partial report before releasing ownership. A committed completion wins a later
Stop. Reuse existing Stop and held thread ownership. Recovery runs under a real
branded held capability, never a timeout lease: read-only checks retain last
acknowledged findings; dispatched web work is conservatively unknown. Recovery
submits no work. Literal deferred loading of the recovery command avoids a
static cycle with the actual ownership capability owner.

E11 desktop window hide/reopen retains the original producer, session and report publication. Explicit application Quit closes fresh-effect admission, signals all original producers before waiting, and preserves their original completion, Stop/status/readback and final report transaction. Shared MCP disposal follows producer settlement; storage closes after final publication. The native coordinator owns the one bounded fallback deadline. Timeout or an unresponsive original read remains interrupted/unconfirmed; it is not proof of remote cancellation or permission to replay. Saved job rows alone never recreate background work on cold startup.

Thread/project lifecycle transactions delete both job tables. Publication
rechecks owner existence and scope within its write, so a late callback cannot
resurrect rows. Reports do not retain source media against ordinary cleanup.

`AgentJobReport` lives in actual tool rows, with committed progress outside
technical JSON folding, scoped reactive read envelopes, inline paged text and
terminal clear. Preserve readOnly, synchronous pending guards, quiet success,
keyboard access and narrow wrapping. No drawer, navigation or extra execution
owner is needed to inspect a report.

## 4. Validation and error matrix

| Condition | Required behavior |
| --- | --- |
| Duplicate original call / lost admission acknowledgement | Reconcile owned row; no second producer start |
| Byte capacity exhausted | Refuse before IO; explain terminal-result cleanup |
| Record count exhausted | Refuse before IO; explain actual parent cleanup |
| Changed original call, project, selection or expected revision | Deny retarget/publication |
| Failed publication transaction | No partial descriptor/original completion escapes |
| Publication with absent optional metadata | Same canonical descriptor in the job and original JSON; normal page reads work |
| Committed completion with lost acknowledgement / late Stop | Return exact original durable result |
| Completion lookup unreadable | Unknown; no producer replay |
| Foreign, deleted or unpublished output | Explicit unavailable, zero provider requests |
| Cleared output | Explicit cleared; original history unchanged |
| One-unit page cannot fit supplementary character | Explicit error; no empty advancing claim |
| Stop during held media availability | Stopping while held; await current result; no next item |
| Recovery cannot acquire actual thread lock | Do not touch active work |
| Parent deletion during producer await | Cascade rows; deny late publication |

## 5. Good, base and bad cases

Good: retain a large extraction, send only its bounded projection to the model,
then reconstruct it exactly through authorized pages without another request.
Base: an empty bound-project video selection publishes an explicit empty report.
Bad: silently clip retained content, replace original history after clear,
declare native work stopped while the actual read is pending, or replay HTTP
because publication acknowledgement was lost.

## 6. Tests required

Use actual ProductStore and production tool/loop owners. Cover quota admission,
duplicate/unknown acknowledgements, atomic publication rollback and durable
completion reconciliation; foreign/deleted/cleared reads, Unicode/escaped text
and strict page progress; serial media findings, held Stop/drain and parent
deletion; both Chat and Responses bounded next context plus exact readback and
opaque continuation. DOM cases exercise actual subscriptions, stale scope,
progress, partial text, paging/reopen/clear, readOnly and error/pending behavior.
Register actual new suites/table anchors in permanent native discovery without
claiming they were executed natively.

The owner-selected necessary-only source lane is described in
[Quality Guidelines](./quality-guidelines.md). Full, emitted/packed, real Rust,
native managed-file responsiveness, OS-process termination, packaged Web Locks
and live-service acceptance remain separate actual checks at the batch boundary.

## 7. Wrong versus correct

Wrong: `await fetch(); return fullText.slice(0, limit)` and invent a reference to
the discarded tail. Correct: acknowledge reservation, execute once, atomically
publish retained text and the original bounded reference, then read owned pages.

Wrong: use the currently reading model call as if it were the original producer
call. Correct: validate the current caller and original saved owner separately.

Wrong: wrap a network producer in an atomic product callback. Correct: preserve
external uncertainty while making only local publication atomic.
