# Natural-language project image discovery design

Status: ready for integrated review; no product edits.

## Change boundary
Complete discovery→image selection→pixels using a dedicated read tool and the existing native image transport. A tool-proven unbound read scope extends image validation; general project ownership and mutation rules stay intact. Do not relax `validateReferenceInput` to accept arbitrary input.projectId when run.projectId is absent.

## Discovery contract
Add `discover_project_images` to the reference skill allowlist with strict fields: optional `projectQuery`, `projectId`, `episodeQuery`, `entityKind` (shot/character/scene/prop/style), `query`, `slot`, `source` (current/reference/candidate, default current), offset/limit (default 10, max 20). At least a project name or resolved project identity is needed in unbound runs. Bound runs resolve only their frozen project and reject a different one. The model interprets user language, then supplies structured filters; no second model or semantic index is introduced.

Resolve exact project names first, then bounded name candidates. Multiple matching projects return labeled choices and no image grant. Within a project, use entity names/content and shot number, explicit episode names/IDs, existing slot catalogs and stable ordering. Ambiguous episodes/slots remain separate labeled results, never a hidden first match. Report counts and pagination truthfully. No pixels during discovery.

Each candidate has a stable result-local ID, project/episode/entity/slot label and IDs, source category, media ID/type, current availability, and a source locator/revision. Current means current applied slot; reference means the requested input association; candidate means an owned saved generation output. Do not replace absent current media with a reference or historic result. Include registered image references where explicitly requested, and preserve reference withdrawal rules. Separate unavailable targets from readable candidates.

## Reading and provenance
Keep existing bound `read_project_image({mediaId})` behavior. Add a mutually exclusive discovered read shape `{discoveryCallId,candidateId}`. Validate that discoveryCallId is a completed `discover_project_images` call in this run/thread; derive project/media/locator from its saved result, never trust model-supplied extra owner IDs. Re-read the locator and compare media identity/revision before queueing; stale results require rediscovery. New discovery/read instructions explicitly show the sequence and explain `queued` is preparation, not completed analysis.

Extend `AgentReferenceInput` with an optional typed discovery provenance descriptor containing discovery/read ledger IDs and candidate identity. For a bound run, enforce the bound project as before. For an unbound run, validate matching completed tool provenance in the same run/thread, selected project existence, candidate ownership and current locator. Only the code-owned discovered image path obtains this exception; arbitrary references, documents and raw mediaId reads do not. No conversation rebinding, new write access or cross-project memory injection follows.

At request materialization, validate before and after Blob encoding, check live run/thread/model, provenance and source identity, then emit Chat `image_url` or Responses `input_image`. Reuse the current limits and capability resolution. Pair each completed image-read call once through appendToolResults; update explicit name handling if necessary. Preserve opaque Responses items and never save data URLs or raw pixels in the ledger.

## History, replacement and evidence
Source labels identify the project/episode/shot/slot and current/reference/candidate role. Selecting the source opens its existing project location/preview where possible. Image comparison may read multiple explicitly selected candidates within the existing ten-image context limit. Unsupported model has an actionable switch-model message; missing/changed images are not replaced silently.

Read provenance is run-scoped; later turns rediscover/re-read as needed. Existing context compaction retains lightweight source identity and removes old pixels. It cannot use an old unrelated tool result to grant access in a new run. Ordinary historical prose remains history. Retry/continuation of the same run revalidates original tool provenance and current source. Update reference evidence/UI to handle unbound source labels without treating a read as a generated business outcome.

## Expected files
New scoped image-discovery repository/helper/tool, referenceTools/referenceToolNames/skills, domain/referenceInput, referenceContext and ai/referenceWire. Review db/agentTools append pairing, run request replay, referenceEvidence and source presentation. Add tests in focused discovery/reference transport files, preserve existing business and reference tests. No global projectScope bypass and no new binary storage/copy.

## Verification and rollback
Start tests from a user-language request in a real tool loop rather than calling reader with a known mediaId. Deterministic mocked model fixtures prove discover→read→correct pixels protocol; they do not prove every live model follows instructions. Native browser repeats both protocols with real image bytes and no attachments, bound/unbound scenarios, duplicate names, deletion/replacement/withdrawal during encoding, unsupported vision and evidence display. Document separately any live-model behavior evaluation. If necessary disable discovered reads while preserving old bound attachment behavior; never weaken scope guards.
