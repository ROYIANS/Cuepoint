# E07 source-backed design investigation

Date: 2026-10-15. Preparatory research while E06 is closing; E07 remains planning. This document proposes a bounded Studio delivery, not an activated implementation or an assertion that native/background acceptance has passed. Only this document was written; no checks, builds, native processes, installs, paid requests or Git commands were run.

## Recommended product slice

Deliver two actual consumers of one owned job/result implementation:

1. **Project video availability check**: inspect a frozen selection of videos already owned by the bound project, show actual checked/selected counts and per-item findings, retain a report, and read it in pages. This is useful before selecting media for further work and gives E08 a real media-task owner/UI/result path.
2. **Existing `web_read` retained extraction**: retain the complete sanitized extraction accepted within the existing response limit, return a bounded preview/reference, and let the model and user read additional pages without another Tavily request. This fixes a current loss of information rather than demonstrating the mechanism only in Todo.

Keep both inside the existing foreground tool invocation and actual thread lock. Do not add detached dispatch, a background Agent host, directory access, ffmpeg, a generic shell, a plugin runtime, a new package or another Agent loop. E08 supplies the actual directory/process backend; E11 decides any changed Agent lifetime. The E08 input workflow remains **directory scan → video thumbnails → project import**, not the E07 check.

## Observed data flow and gaps

| Actual source | Finding and consequence |
| --- | --- |
| `packages/agent-core/src/runtime.ts:143-190` | Tools execute serially. A non-atomic tool result is `JSON.stringify(value)` and must fit **65,536 JS string units**, not bytes/tokens. Atomic tools must already have committed their original completed result. Raising this limit would not establish retained-result ownership or safe context size. |
| `packages/studio/src/features/agent/commands/agentTools.ts:251-288,378-405` | Settled `call.result` is appended once into Chat/Responses continuation. Atomic business callbacks commit the original result and business rows together; serialization failure rolls back that transaction. HTTP/byte inspection must remain outside it. |
| `features/agent/providers/referenceWire.ts:61-105`; `features/agent/runtime/contextCompaction.ts:39-75,80-96` | Wire materialization applies the existing reference-history sanitizer and image revalidation; it does not generically spill arbitrary results. Compaction budgets saved continuation, preserves the opaque suffix, and only replaces a verified historical base. Persist the new bounded result envelope at original completion; do not retroactively shorten ledger records or rebuild Responses history. |
| `features/agent/runtime/businessStore.ts:278-303`; `features/video/agent/businessTools.ts:436-505` | Business results explicitly clip fields; text/relations/search already support scoped live pagination. A new result reader should read an immutable retained output, not replace these domain readers or imply their changing live pages are one snapshot. |
| `features/references/providers/tavily.ts:19,27-29,37-79,135-154`; `features/references/agent/webTools.ts:18-42,64-79` | Tavily response JSON is capped at 2 MiB. `web_read` then discards text after 24,000 characters, with further serialized-size shrinking. `availableLength` does not make discarded text recoverable. Existing cancellation means local waiting stopped and preserves `serviceMayHaveRun`; there is no automatic retry. Connection revision/current key and owned postflight checks already exist. |
| `features/agent/runtime/taskTools.ts:115-155`; `features/agent/commands/agentTaskRecords.ts:35-80,138-167` | `task_read` pages saved completed tool results and genuine generation evidence. It cannot recover already discarded web text. A completed network/read call is not proof of a completed creative write; retain that evidence rule for the new reports. |
| `features/agent/models/agent.ts:163-176`; `features/agent/commands/agentTasks.ts:120-150`; `features/agent/ui/TaskInspector.tsx:325-356` | `AgentTask.artifacts` pins completed assistant messages. It is not a file store or general output index. Do not insert temporary paths or huge report bodies into this array. |
| `features/agent/ui/AgentRunDetails.tsx:75-95,145-163,308-315`; `features/agent/ui/WebResearchSources.tsx` | Existing call rows have collapsible technical JSON and source UI. Add the actual job/report presentation here; do not require Task mode or add another drawer. Current success is quiet, and one completed call can legitimately describe a stopped/failed job. |
| `features/library/models/media.ts`; `features/library/commands/media.ts:63-71,75-119`; `features/library/commands/materials.ts:186-189,309-383` | Media IDs are immutable, project-owned records. Orphan deletion protects real proposal/generation/batch/material owners. Material adoption copies an immutable version to actual project media and records `MaterialUse` atomically. These remain the E08 import owners; a new job's success flag cannot substitute for their receipts. |

Paths beginning `features/` above are relative to `packages/studio/src/`.

## The actual local backend and cancellation boundary

The existing safe backend is `platform/storage/binary.ts:92-101`: browser `Blob` is immediately `ready`; native refs use the installed binary owner. `nativeBinary.ts:434-440` verifies the current session and checks the supplied signal **before and after** `transport.request(session, {type:'availability', reference})`. It does **not** pass a cancel signal/operation handle into that request. Rust `product_binary.rs:827-843` validates committed ownership and uses `verified_file` to distinguish ready/missing/corrupt.

Therefore this backend can provide a real availability report without accepting filesystem paths, but:

- Browser ready means retained Blob availability, not hash/codec/video-content verification. Native ready means the supported managed-file validation; neither means that the video was watched or decoded.
- Stop during a native availability await **cannot currently interrupt that actual IPC/file verification**. Keep `stopping`, retain the thread lock, await that item, then schedule no next item. Only after owned work drains and the terminal checkpoint is acknowledged may the UI show `stopped`.
- A late ready response does not become overall completion after Stop. Retain the observed current item if publication is valid, mark remaining items unexamined, and expose checked/selected counts. If final completion committed before Stop, keep completed.
- Missing/corrupt/changed/deleted input is a report finding, not an ambiguous external write. A known rejected read or proven local transaction rollback can fail explicitly. Lost/malformed final commit acknowledgement is **unknown publication** until durable lookup; do not manufacture a clean failure or start a replacement job.
- Native verification runs on the existing serialized storage worker. `apps/desktop/src-tauri/src/worker.rs:15-31,100-210,292-350` only dispatches ProductStore/validate/binary requests; it is not a general job service. A long file can delay store operations. Do one bounded item at a time outside all ProductStore transactions; promise no byte-level progress or instant cancellation. Review packaged responsiveness later.

`worker.rs:352-400` has private operation cancellation and a close barrier, while `desktop.rs:1639-1657` exposes cancellation for its separately owned workspace bridge request. Neither is automatically a cancel handle for the normal binary transport. Do not connect them by guessed IDs or advertise a process kill operation.

### Frozen selection

Suggested first tool: one schema-linked `project_media_check` using the existing bound-project guard, with optional explicit `mediaIds`. Omitted selection means all current `video/*` media in that one project, within the admission bound. Explicit IDs must all be unique, existing, video-typed and owned by that project. No Studio/IP/global material traversal, arbitrary directory, inferred project or implicit inclusion of later imports.

Admit under one short read snapshot: exact project/thread/run/call, ordered media IDs, filename/mime/length and actual record/binary identity. Do not persist a managed binary token in a new unregistered carrier. Proposed tunable bounds: 64 selected items, 512 MiB each, 2 GiB total; exceeding a bound refuses the selection before work and explains selecting a subset, rather than silently reporting partial coverage as a complete project check. Freeze `selectedCount` and preserve an explicit empty-selection result. Recheck source/owner before each read and before publishing its finding; changed/deleted records remain identified in the report. Missing/corrupt are distinct from reader errors and unexamined items.

The original bound project is fixed. Changing/deleting it, deleting the thread, or losing the actual held execution owner denies subsequent reads/publication. Reading a historical report revalidates its retained owner; a media link separately revalidates the current media record and can show unavailable. Historical observation does not need to pin the original video against orphan cleanup.

## Job/result storage and completion

Keep Studio-specific persistent ownership in Studio. E06's actual `capabilityRegistry.ts`/`resourceGrants.ts` expose immutable capability generations/binding and a host `prepare/assertCurrent` seam; Todo implements issuance/revocation and atomic checks. At research time E06 implementation/checking is still closing. Consume the reviewed final contracts, not an assumed new core scheduler or a token-shaped grant treated as authority. The selected project/binary owner remains an actual host check.

Proposed minimum persistent owners, with names subject to the final design:

- `agentJobs`: one code-produced job ID, unique original call ID, exact thread/run/project owner, concrete kind (`project_media_check` or `web_read`), revision, selected scope/progress, status, timestamps, and bounded output descriptor. Keep model run ID, local job ID, future native process handle and existing remote generation ID distinct.
- `agentJobResultChunks`: plain text/report chunks keyed by job+ordinal, with stored offsets/length; owned through the parent job. Both actual consumers use them. No generic filesystem locator, Blob field, separate database or Node temporary directory is required.

Actual sequence:

1. After existing tool validation/approval/claim, atomically admit a call-unique job and reserve its output quota. `queued` means waiting for local admission, `accepted` means the owned record is acknowledged, and `running` means the actual producer started. With serial execution there need not be an artificial visible queue or every intermediate state painted. No network/read begins before acknowledged admission.
2. Execute the selected producer under the already held thread owner, outside writes. Commit real per-item observations/progress in short transactions. The UI subscribes to those durable facts, scoped to the exact job/call/thread; no elapsed-time percentage or synthetic stage labels.
3. Retain output as staged chunks; staged rows are not advertised as a complete readable result. Final publication validates coverage/quota/owner/version and commits the job's terminal snapshot, published output descriptor and **original bounded `call.result` in one ProductStore transaction**. Partial stopped reports explicitly publish only the examined coverage.
4. A completed ledger replay returns that exact saved descriptor without executing the producer. Same-call admission reuses/reconciles its record; unresolved admission/publication returns unknown without redispatch. A deliberately requested new check is a new invocation with a new selection, not replay of the old job.

Implement step 3 at the existing Studio completion/transition owner for these concrete jobs, or an equivalently explicit local publication command integrated with it. Preserve original metadata and existing generic completion logic. **Do not set every network tool `atomic:true`, put HTTP in `executeAtomicTool`, or wrap an entire Tavily operation as a proven atomic rollback.** If staging fails after the service ran, retain the external-outcome truth and block automatic service retry. No result reference may claim recoverable content until its rows and original descriptor are acknowledged. A core-wide post-execute hook is unnecessary for these two consumers.

Statuses: `completed` = producer's declared coverage is finished and published; `failed` = known failed local work/publication with a proven boundary; `stopping` = owned operation draining; `stopped` = no further owned work will be scheduled and partial output is published; `unknown` = unresolved authority/commit/external outcome, not guessed from a timeout. Keep external `serviceMayHaveRun` orthogonal to whether the local web wait stopped. An acknowledged stopped web failure can be a completed tool result without claiming that the service was canceled or a creative effect succeeded.

## Full result, bounded context and authorized readback

For `web_read`, move the 24,000-character loss boundary: retain the complete **sanitized provider extraction accepted within the existing 2 MiB response ceiling**, not an assertion of the complete original webpage. Preserve requested/final public URL, retrieval time, provider-extraction coverage and service request ID. Sanitize current API-key/plain and URL-encoded occurrences before retention as today; do not store the service response envelope, credentials or headers. An over-limit response is still an explicit failure; do not fetch again to complete it.

Use one bounded preview/descriptor in the saved tool result, continuation and technical UI. Proposed preview: at most 8,000 JS units and a stricter **serialized envelope budget** (e.g. 16,000), shrinking only the new preview until it fits. JSON escaping, Chinese/emoji/control characters and metadata count toward that budget. Declare omitted length/coverage and a code-produced `jobId`/output reference. Keep the core 65,536 check and compaction unchanged.

Add one actual read tool such as `read_job_result({jobId, offset, limit})`; offset is documented UTF-16 units, matching current text readers, limit <=6,000, with total length/nextOffset and retention/partial-coverage state. Chunk on Unicode boundaries and return bounded serialized pages. The user report UI calls the same owner-checked reader. Reads make **zero model/provider/network requests** and do not append the full result into future context automatically. A retained web reference is untrusted source data, never a higher-priority instruction.

Authorization requires the current durable caller, same thread and valid original project relation, original owned call/job and published output revision. Opaque ID possession alone authorizes nothing. Ordinary conversations work without an `AgentTask`. Foreign/missing/deleted/cleared/unknown-unpublished output returns an explicit unavailable state. Do not recover scope from display JSON or trust an arbitrary path embedded in model text. A future task source reader may resolve this owned output deliberately; the first delivery need not add a new task-evidence type or expand result claims.

### Retention proposal

Recommended policy to confirm with the owner: keep full text until explicit clear or owning thread/project deletion, subject to hard quotas, **without silent time-based eviction**. Suggested tunable limits: 2 MiB per retained output, 16 MiB per thread and 128 MiB total. Reserve before actual work, so a full quota does not charge another web extraction. Enforce concurrency/quota in the same ProductStore owner, not a React counter. Count actual retained payload bytes and bound metadata/selected lists too.

Expose a useful “clear retained result” action for terminal jobs. It removes their chunks transactionally and keeps a small explicit cleared descriptor/status; immutable original tool history is not rewritten or silently redirected. Existing model/UI references then explain that content was cleared. Protect live/staged jobs and active publication from cleanup. A hard retention failure returns no fake full-content reference; preserve any already incurred service effect and prohibit an automatic retry.

`features/agent/commands/lifecycle.ts:8-48` must cascade jobs/chunks with thread deletion. `features/projects/commands/lifecycle.ts:30-85` must remove project-owned job output when the project is deleted, even though Agent conversation records can remain. Late callbacks recheck owner existence inside publication and cannot resurrect deleted rows. No new media GC roots are needed for text-only reports. E08-generated thumbnails will be different: persist verified bytes through `media`/material carriers, add their actual job references to `collectHistoryMediaIds` and the shared deletion transaction scope, then atomically publish result media/import receipts. Physical file GC remains with its existing managed-file owner.

## UI lifetime and recovery

`useChatExecutionSession.ts:19-33,60-69` aborts on component disposal or a different thread. `runOwnership.ts` holds the actual Web Lock through awaited execution/final flush; recovery uses `ifAvailable`, never a stale-time lease. Thus:

- Expanding/collapsing a report, hiding the process, and E01/E16 side-by-side/full-width business details can leave the execution owner mounted; inspection does not stop work.
- Actual topic/route departure follows the existing confirmation and then stops the foreground invocation. Closing/reloading a window does not promise continuation. Persisting a job is not moving the loop or producer into Rust.
- Put the first read-only progress/report view in the actual call row, keyed by exact job/call identity, plus bounded expandable pages. Keep reader state owned independently of process folding where needed. Reopening reads persisted facts; it does not recreate a producer. Keep technical JSON collapsed, successful messages quiet, and use the existing Stop action/acknowledgement rather than duplicate approvals or transient status text in user bubbles.
- Stop through the existing invocation abort can publish a stopped report after the current native read drains. It must not release the lock early or mark the original call failed merely because Stop was requested after publication won. A separate per-job stop control is unnecessary while there is exactly one serial foreground producer.
- On restart, obtain actual exclusive recovery ownership. A known read-only check has no outstanding external modification, so mark unfinished local execution interrupted/stopped with its last acknowledged partial coverage; do not continue checking automatically. An unresolved publication requires durable outcome lookup and can remain unknown. A web request dispatched before losing its reply remains service-may-have-run/unknown, never automatically reissued. Existing remote generation keeps its saved identity and current recovery rules.

## Reference-project mechanisms worth retaining

DSH source root: `/Users/xiaomengdao/WebstormProjects/deepseek-harness/packages/`.

| Source | Reusable lesson / limit |
| --- | --- |
| `jobs/jobs-local/src/index.ts:1-9,162,207-305,403-410,644-717` | Live jobs are a process-local Map, owned by an Agent scope and disposed with it. Registered/settled session events are best-effort (`444-462`), not an atomic product ledger or a restart executor. Producer startup precedes Map registration; do not copy that ordering across our “acknowledged admission before effect” boundary. |
| Same file `320-328,470-493,496-584,586-640` | Model reads and UI `readAt` have different cursor behavior; waiting abort/timeout does not kill the job; kill requests set stopping and only the actual outcome settles. Completion can win a cancel race. These are useful semantics without adding cursor consumption or a detached scheduler we do not need. |
| `jobs/jobs-local/src/ring.ts`; `pump.ts` | Absolute output offsets, explicit gaps and bounded rings; settled output is pruned and can be lossy. Polling multiple sources does not establish a total stdout/stderr order. A ring alone is not the complete retained output required by E07-AC1. |
| `spill/spill-policy/src/index.ts:90-154`; `notice.ts`; `retention.ts` | Save full output before projecting a bounded model preview; reserve reference-notice budget, disclose omissions and preserve Unicode. Its storage failure fallback returns original inline content, which is unsuitable for our hard result/context budget. An authored notice string is not output authority. |
| `spill/spill-local/src/store.ts:31-38,78-80,108-130`; `index.ts:30-48,83-101,149-160`; `cleanup.ts:210-260,274-360` | Private process temp root/session directory, exclusive 0600 file, path-safe naming and best-effort startup expiry (default 30 days). Retrieval is by local path/read/grep. Our shared browser/native product instead needs ProductStore-owned references and explicit parent cleanup; path persistence neither preserves a live job nor proves a durable product commit. |

## Storage integration and the fresh-development policy conflict

Text-only job tables require synchronized current owners: feature models/commands; `platform/storage/tableTypes.ts`; `schema.ts` + `schema.json`; `browserDatabase.ts` (currently version 25/declarations); actual command transaction lists; thread/project lifecycle; query subscriptions; registry/conformance fixtures and current hash/count assertions. Rust embeds the registry, so no renderer file IPC or native job service is needed for these text records. `rowCodec.ts:6-12` permits binary only in three registered carriers; leave it unchanged for this slice.

There is a real documentation conflict: `native-product-runtime.md:482-499` and `tests/storageRegistryHash.test.ts` comments prescribe migration when the hash changes, while **`guides/development-change-policy.md` and `shared-product-storage.md:15,49-60` explicitly default to fresh disposable data and no new migration without a named requirement**. The E07 PRD currently names no historical-data support. Therefore recommend current-schema/fresh-store implementation and tests; update the current hash/count fixture intentionally, preserve the existing 49→50 code's current semantic scope, and reconcile the conflicting docs in main's design/spec work. Do not silently expand E07 into 49/50→new-registry compatibility/backfill. Old-workspace preservation requires a separate explicit source-version/acceptance decision. No migration was implemented during this research.

## Necessary source validation and deferred evidence

The default root Vitest/Vite configs call `assertAgentPackageFreshness`; using them against changed public core before rebuilding would invalidate the no-build workflow. E06's `vitest.agent-source.config.ts` is deliberately neutral and finite, not a Studio profile. For actual E07 work, add a separate explicit finite Studio source profile only if needed: independent of default configs, exact three public core/providers/http source aliases through the existing helper, Studio alias and real required dependency resolution, appropriate IndexedDB/lock setup, and only new E07 plus necessary existing web/ownership/store suites. Do not turn neutral E06 into a broad Studio suite or remove normal freshness checks. Register actual config/type witnesses precisely with quality/Knip; no broad entry exemption. Type-check against an explicit noEmit source project rather than private imports or emitted-package assumptions.

Suggested required cases, with actual commands/owners and deterministic held promises:

1. Actual core/Studio Chat **and** Responses loop: a >65,536-character retained extraction/report, bounded original result/next request, exact paged reconstruction, opaque continuation preserved, zero extra Tavily request on read/reopen/resume; result-read permission/offer budget included.
2. Actual ProductStore transactions: job admission+quota, per-item progress, full publish+original ledger together; failures before/after staged writes and lost/malformed acknowledgement, same-call reconciliation, no duplicate effects; two competing quota/admission owners; current schema parity and text codec. Existing `webResearchRuntime.test.ts`, `webResearch.test.ts`, shared-store cases and hash fixture are relevant source entries.
3. Actual selected media backend seam: immutable exact selection; foreign/non-video/deleted/changed media; ready/missing/corrupt/read-error separation; browser ready limit; held native request showing Stop remains stopping/lock-held, drains one item and never starts the next; completion/Stop winner; no provider/paid-generation calls. Mocking a completed job object alone does not establish this boundary.
4. Actual DOM call/report: current job subscription, progress from committed observations, partial report, paging/read failure/cleared state, collapse/reopen, narrow layout, quiet successful transcript, no drawer; retained details do not remount execution. Real thread departure/reload ownership/recovery test makes zero producer/model/provider calls on reattachment. No fabricated process-kill claim.
5. Parent deletion/cleanup during pending read/publication; stale callbacks cannot recreate rows; references become unavailable; no deletion of existing owned project media. Keep focused atomic generation/unknown/no-resubmission regressions if their shared completion/transaction owners change.

Only read-only source investigation was performed here. Defer production builds/packaging, emitted/packed independent-consumer gates, actual Rust/native parity execution and process-death reopen, packaged binary-hash responsiveness/Stop, real Web Locks/window destruction, real media decoding and live Tavily/paid providers to the agreed final batch gates. Source fixtures can establish shared command boundaries; they cannot claim these deferred runtime results. E08 must close actual owned-process termination and thumbnail/import acceptance with its selected executable/platform.

## Decisions for main / owner

| Decision | Recommendation / who needs to decide |
| --- | --- |
| First useful job | Recommend the bounded project-video availability check plus real `web_read` retained extraction. This product scope is a new selection to confirm in the task review, not a claim that a directory scan already exists. |
| Retention | Owner-facing choice: retain until explicit clear/parent deletion within visible quotas, or deliberate expiry that makes old references unavailable. Recommend the former initially; exact small limits/chunk sizes are routine tunables documented/tested in implementation. |
| Lifetime | Recommend existing foreground lifetime and departure confirmation. Continuing across actual route/window departure is a different material choice belonging to E11; do not ask for an entire daemon architecture to ship this slice. |
| E07-AC2 | In the selected E07 scope prove local wait cancellation, drain/current-item stop, no next item, retained committed results and truthful external effects. Explicitly leave OS-process-stop verification to E08's actual process backend; update PRD/roadmap coverage before activation. All AC cannot honestly be claimed as generic process acceptance today. |
| Historical storage | No newly authorized compatibility requirement exists. Resolve conflicting spec wording using the fresh-development guide, with a separate explicit exception only if owner chooses old-workspace preservation. |
| Routine technical choices | Two concrete table owners/text chunks, scoped read tool, serial execution, call-unique admission/publication, no automatic replay, committed query UI, no additional core loop/package and exact finite source validation are normal implementation decisions once scope is reviewed. |
