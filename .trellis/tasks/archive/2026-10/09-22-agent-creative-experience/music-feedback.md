# Music workflow feedback — 2026-09-22

## Source and evidence boundary
User supplied an AI retrospective in the conversation reporting unsupported draft revision/job/status claims, historical-summary confusion and a music concept mixing close raspy adult vocals with distant clear childlike vocals. Original tool envelopes and historical project rows were not supplied or independently verified. Treat claimed false statements as reported symptoms, not an audited trace. Source checks below concern current implementation, including uncommitted R1/R2 work.

## Disposition and source checks
| Feedback | Current implementation | Accepted scope |
| --- | --- | --- |
| 1, 2, 9: unsupported saved/submitted/status claims and stale history | Direct local write receipts now cover drafts; normal assistant prose has no semantic completion gate. Network calls deliberately do not count as direct writes | P0 R2: generation evidence projection, source-linked facts, exact identity/version/status checks and explicit historical/current attribution |
| 3: version-bound confirmation | music_generate requires draftId/draftRevision; inputState hashes the actual draft, parameters and connector identity/credential revision; runSubmission requires durable approved call and revalidates before POST. Stale-draft regression exists in audioGenerationAgent.test.ts | Preserve this foundation. P0 R8 confirmation UX: clear human-readable saved version review instead of truncated JSON; any changed inputs invalidate approval |
| 4: saving vs submission | music_save_draft is a local write; music_generate is a separately confirmed network operation. Durable jobs already model prepared/submitting/submitted/running/remote-completed/downloading/saved/failed/uncertain | Make actual stages visible; do not replace multiple lifecycles with a misleading single linear enum or count a saved draft as submitted |
| 5: structured vocal roles | MusicSettings has no vocalist/section-routing contract; current adapter exposes a bounded provider schema, not the proposed vocalists object | R8 follow-up: preserve creative intentions and inspect how they map into supported lyrics/style inputs. Do not advertise guaranteed stem/voice control, send unsupported fields, or silently add multi-track arranging |
| 6: synthetic voice identity | Creative music generation is separate from reference-based MiMo cloning | Treat fictional/synthetic vocal texture as ordinary creative intent. Do not silently rewrite the user's wording or introduce a confirmation wall based on childlike timbre. If actual personal reference cloning is requested, use its separate explicit source/authorization flow; no inferred singer identity |
| 7: generation status/query/output | audio_generation_check queries existing jobs; shared workspace jobs UI already refreshes boundedly and exposes manual refresh. audioJobSummary returns local job ID, provider task IDs, result work/take/media IDs | R2: distinguish provider observation, local download/save and playback availability; include observation freshness. No claim of audition from metadata. Background/server callbacks are not assumed |
| 8: task plan/record is not proof | validateTaskSources already rejects AI result records without a completed business source; bookkeeping is excluded. Existing generation source implementation covers image/video, not audio jobs. Generic successful write source does not prove the prose body's specific claim | Extend task evidence to sound jobs and granular result types. Keep plans as plans and permit non-result proposals/questions; do not ban legitimate unsourced planning |

## Confirmed priority defect: status conflation
`src/lib/audioGeneration/runtime.ts::refreshAudioGeneration` sets `allTerminal = false` for request failures, provider unknown status and non-completed states. It then assigns local `running` whenever not all terminal. Thus a failed status query or provider pending/unknown can be recorded as running. R2 must separate observation failure/unknown/queued/processing from local workflow progress, preserve last verified provider facts with timestamps, and aggregate multi-task partial states explicitly. Do not infer active remote generation from this legacy local enum.

## Generation evidence contract to design next (P0 R2)
- Provenance: source call/run/thread/project, local job ID vs provider task ID, originating draft ID/revision and frozen settings, job revision/observation time, result work/media identities and current availability.
- Distinguish the originating submission from a later read/refresh. A current query may verify an older job without making its original submission a current-run action.
- Read freshness is an observed-at/version fact, not a permanent isLatest boolean. Concurrent draft changes must not alter the frozen submitted settings; history remains history.
- Keep provider completion, local saved playable source and actual audition separate. A saved work/media must still exist and belong to the project. Partial downloads, removed outputs and unknown paid outcomes stay explicit.
- Reuse existing job identities and recovery; refresh/query never resubmits POST. Failure to query is not proof of generation failure or processing.
- The system-owned result surface may make deterministic factual claims only from those sources. Free-text checking must distinguish proposal, quotation, negation and historical narration. Keyword matching alone must not block ordinary replies or silently convert an actual ambiguous side effect into 'not submitted'. Design streaming visibility, correction behavior and false-positive handling explicitly; no promise of complete hallucination prevention.

## Confirmation and parameter UX (P0/P1 R8)
Present project/title, engine/model, saved draft revision and charge disclosure concisely; lyrics/style/duration/instrumental settings and complete submitted parameters are expandable before approval. Show intended vocal arrangement as creative intent when unsupported as a deterministic engine control. IDs remain in details. Unknown pricing is shown as unavailable/service-provider billing, never an invented estimate.

Retain durable approval tied to that concrete input. A natural-language 'submit' should initiate the real review when needed, not cause repeated prose confirmations. Supporting text-based approval later would require unambiguous pending-call/version resolution; this report does not authorize bypassing existing review controls or approving future revisions.

Do not add a large vocalist form now. If structured intent is later useful, keep it lightweight and preserve how it is mapped or omitted. Multi-track/stem production remains outside the currently generation-only music scope and requires its own future task and verified capabilities. No provider capability research was performed this turn; current local schema is evidence of integration coverage, not proof of every current external provider capability.

## Acceptance scenarios
1. Only history says draft revision 4/job submitted: no current write/submission claim; fresh read is attributed as observation of existing state.
2. Successful save yields actual new revision; approval binds that version. Lyric/voice-intent/settings or connector changes before POST reject stale approval with zero POSTs.
3. One confirmed POST returns local job/provider task identities; later checks retain original source and never create a second paid request.
4. Provider queued, processing, unknown, HTTP/query failure and stale observation remain distinguishable; none becomes processing by default. Mixed task outcomes preserve saved tracks and remaining failures/pending items.
5. Provider complete but download failed is not playable/saved; actual saved work/media belongs to the project; deleted output is unavailable. Metadata alone never proves adult/child vocal fidelity or audition.
6. A music-generation result can cite valid sound-job provenance in task records; a plan/source-less result or a draft receipt alone cannot prove audio generation.
7. Unsupported 'revision/job ID/submitted' claims are evaluated separately from quotations, plans and historical references, under both streaming protocols with measurable false-positive limits.
8. Confirmation has readable complete inputs on desktop/narrow layouts without form walls; unsupported vocal-role constraints and unknown cost remain clear.

## Status
The initial feedback review was planning only. Subsequent music-observation and sound-evidence deliveries implement truthful query observations and local output/task evidence. R8 readable confirmation is now implemented in `../09-22-music-generation-review`: full immutable snapshot, concise review, actual wire semantics, stale-state detection and atomic version-bound approval. Semantic final-reply verification, structured vocalist intent and multi-track production remain undelivered. See each child validation report for the scope and test evidence.
