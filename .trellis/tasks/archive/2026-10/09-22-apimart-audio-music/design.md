# Audio/Music Workspace Design

Status: final planning review; implementation has not started.
Requirements: [PRD](./prd.md). Source/API notes: [research](./research.md).

## 1. Architecture and ownership

Preserve Dexie as the durable source of truth, repository mutations, useLiveQuery reads, and current studio/project/IP boundaries. Avoid a new backend or a second global store. UI and Agent adapters call the same repositories and generation coordinator.

Add a project kind discriminator with legacy missing kind interpreted as video. Retain legacy video fields in the first additive migration to avoid a wholesale refactor of existing consumers; non-video creation uses inert legacy defaults but creates no episodes/shots. Audit all video-only mutations/routes and reject wrong kinds before automatic repairs or writes. Do not normalize an explicitly unsupported new kind into video.

The project gallery enables Audio and Music and filters real saved kinds. The parent workspace shell selects the appropriate chrome and content; video child routes retain their URLs and gain kind guards. Common identity, IP, archive, backup and Agent launch remain shared.

Proposed module ownership:
- src/domain/audio.ts, music.ts, audioGeneration.ts: records and discriminated contracts.
- src/db/audio.ts, music.ts, audioGeneration.ts: checked project-scoped mutations.
- src/lib/audio/: import/decode, recording lifecycle, waveform peaks, edit commands, playback schedule and WAV export.
- src/lib/ai/apimartAudio.ts: speech/music wire contracts; reuse or extract existing APIMart transport primitives without changing image/video envelopes.
- src/lib/audioGeneration/: shared manual/Agent preparation, submit claim, monitoring and local result capture.
- src/components/audio/, music/: feature pages and workspace panels.
- src/lib/agent/audioTools.ts, musicTools.ts: bounded adapters over the same contracts.

Names are implementation guidance; reuse existing helpers when inspection shows a suitable boundary.

## 2. Durable model

Keep original source media distinct from selected takes, placed clips and generated works.

| Record | Key ownership and content |
| --- | --- |
| AudioChapter | projectId, title, order, revision; a new project has one |
| AudioSpeaker | projectId, name, optional APIMart voice defaults; no cloned identity |
| AudioSegment | projectId/chapterId, speakerId?, ordered text/notes, selectedTakeId?, revision |
| AudioTake | projectId, segmentId?, immutable mediaId, source type, decoded metadata, generation/settings/text snapshot, createdAt |
| AudioTrack | projectId/chapterId, voice/music/effects role, name/order, gain, mute/solo |
| AudioClip | projectId/chapterId/trackId, takeId, timeline start, source trim bounds, gain, fades, revision |
| MusicDraft | projectId, engine, supported settings, lyrics/description/title, revision |
| MusicWork | projectId, local source media, title/notes/favorite, lyrics, jobId?, original provider provenance, revision |
| AudioGenerationJob | projectId, tagged speech/Flow/Suno operation, input snapshot, connector identity, manual or Agent source, state, known task IDs, result records |
| AudioExport | projectId, chapter/project scope, revision fingerprint, format, mediaId, createdAt |

Use new Dexie tables/indexes in the next additive schema version (currently highest is 22; recompute before editing). Jobs belong to the project regardless of initiating chat. Deleting chat history must not delete manually usable project recordings or completed works. Do not widen the legacy image/video MediaKind union blindly: use audio-specific source access with the existing generic MediaRecord Blob storage.

Editing commands verify project/chapter/track/source ownership and expected revision in one transaction. Reject duplicate IDs, nonfinite times/gains, negative placement, reversed/out-of-source trims and invalid fade lengths. Adding a new take does not change a selected take. Explicit replacement of placed takes shows affected clips, validates new duration and does not ripple later clips silently. Revision-safe undo stores inverse edits, not copied media Blobs; stale undo reports a conflict instead of overwriting newer Agent/other-tab work.

Script and timeline are related but independently editable. Segment ordering is not an implicit timeline reorder. Provide an explicit insert/append action for a take; prevent accidental repeated placements during retries.

## 3. Recording and import

Use getUserMedia + MediaRecorder after a user gesture; choose MIME with isTypeSupported and save the actual recorder MIME. Never label browser-compressed recordings WAV merely by changing an extension. Select a microphone and show level/elapsed time, with capture state separate from saved takes.

State: idle -> requesting -> recording -> stopping -> audition -> kept/discarded, with explicit errors and recovery. Wait for the final dataavailable/stop sequence before constructing/validating the source. Stop all MediaStream tracks, analysis nodes and preview URLs on completion, discard, device failure and unmount. Guard late permission results after navigation. Do not enable live microphone monitoring by default, avoiding speaker feedback.

Checkpoint chunks into a temporary recording draft if needed for safe navigation; only promote a complete, decodable Blob to AudioTake. Do not promise crash-perfect recovery of an unfinished codec container. Offer keep/discard before intentional navigation with an active capture and preserve the latest completed take.

Imported files and assembled recordings must decode successfully before entering the editable timeline. Preserve original bytes/MIME/filename. Reuse material snapshot adoption when selecting library content; project clips never depend on mutable studio originals. Compute reusable waveform peaks from decoded audio and keep bounded caches; never serialize AudioBuffer objects into project records.

## 4. Multitrack engine and export

Use Web Audio for synchronized preview, with one shared pure schedule derived from durable clips. Use OfflineAudioContext for mix rendering and a small tested PCM WAV encoder; first mixed output is 48 kHz stereo PCM16. Individual takes and music works can download their original/provider formats.

Each scheduled clip has source offset, duration, project start, effective track/clip gain and fade envelope. Handle seek into an existing clip/fade, pauses/resume, overlaps, mute/solo, chapter boundaries, and mono/stereo conversion consistently. Do not start multiple HTML audio elements and treat that as a synchronized multitrack engine.

Playback uses the AudioContext clock; visual playhead updates are display-only. Seeking cancels old scheduled nodes. Waveform drawing uses reduced peaks and visible-range rendering, not full decoded arrays on every pointer event. Drag preview is local; commit a single validated mutation on drop, with equivalent numeric controls. Existing form-focus shortcut guards apply.

Export flushes scoped drafts, captures an immutable document/media snapshot and fingerprints it. Later changes leave the render valid for that snapshot, visibly older than the latest edit. Preflight all required media and decoded PCM/output memory estimates. Establish and test a conservative resource budget during the audio child; show the estimate and recovery path (chapter export/shorter input) before allocating unsafe buffers. Do not silently omit unavailable clips or claim unlimited duration.

Render and encode away from interactive updates where possible. OfflineAudioContext does not provide a universal abort API: cancellation discards pending output, releases references and stops supported work without claiming immediate native renderer termination. Detect output peaks before PCM conversion and prevent silent clipping by applying a disclosed uniform safety attenuation when required; do not market this as mastering. Verify this rule with sample fixtures.

Export does not call TTS for unvoiced segments. A project with script segments lacking placed audio shows that gap before export. Whole-project output concatenates chapter timelines in chapter order; chapter duration comes from audible placed clips, including intentional initial silence.

## 5. APIMart generation lifecycle

Keep separate binary speech parsing and music JSON parsing. TTS uses /audio/speech. Flow Music and Suno submit to /music/generations, then query /music/tasks/{id}; existing /tasks image/video parsing is not sufficient.

Common flow:
1. Validate a tagged request and current project/connector/target; persist a prepared input snapshot.
2. User action or approved Agent call atomically claims that intent once.
3. Recheck destination, credentials and revisions immediately before the paid POST.
4. Persist known task IDs immediately; unknown response/network outcomes remain uncertain without automatic resubmit.
5. Query known music tasks under a single-tab ownership mechanism; release ownership safely and recover after reload.
6. Persist remote result metadata before downloads. Fetch result URLs without forwarding the API key to an arbitrary CDN.
7. Validate actual audio and atomically create deduplicated takes/works/local media.
8. Apply only an explicitly reviewed target action; stale or deleted targets retain safe results when the project exists, rather than replacing newer edits.

Use a tagged job source: manual intent ID or immutable Agent call/run identity. A unique local submission identity plus a durable claim blocks duplicate clicks, reload and cross-tab races. This guarantees local at-most-once submission per intent, not provider-wide idempotency: do not invent an Idempotency-Key contract for audio. State distinctions include prepared, submitting, uncertain, submitted/running, remote-completed, downloading, saved, failed and target-conflict. A failed download never resets to submitting.

TTS cannot resume a lost binary response via a music task ID. Preserve an uncertain interrupted job and require an explicit new action to regenerate. Local abort/poll pause never claims remote cancellation. Music results retain their original array indexes even when a malformed/missing result requires diagnostics.

Credentials remain in connector storage. Persist connector ID/provider/base URL identity, never keys. Connector destination changes block recovery to a different service; key refresh on the same service can authorize later polling through the established connection rules.

## 6. Music workspace and input contracts

Suno-style interaction adapted to the current restrained application theme:
- Creation rail: engine choice; description/custom lyrics as supported; main options first; advanced provider-specific controls folded.
- Works list: dense readable rows with title, cover when supplied, duration, status and favorite; all actual generated results remain visible.
- Detail panel: lyrics, notes, source and reusable parameters, download/material actions.
- Docked player: current work remains active when the draft or selected row changes; only one audition plays at a time.

Flow Music uses sound_prompt/lyrics, BPM string and optional length/seed. Suno uses its public version, custom/instrumental flags and mode-specific prompt/style controls. Changing engine/mode discards incompatible outgoing fields while preserving user text in local drafts where useful. Unsupported controls are absent, not silently ignored. Initial public Suno version is v6; Max billing mode is not enabled automatically.

Retain provider-native provenance beside normalized duration/URLs. Never equate a generation request with exactly two songs. MusicWork referencing a completed source can be explicitly adopted into an audio project as project-owned media without creating shared mutable clip state.

A standalone lyric-generation endpoint is deferred; manual lyrics and assistant drafting already satisfy supplied-lyrics creation.

## 7. Agent integration

Add compact audio-production/music-creation groups to the existing skills/tool registry and on-demand catalog, maintaining the 36-tool budget. Preserve permission snapshots and current Chat/Responses envelopes. Follow frozenProjectScope and assertProjectToolScope for each read/write/preview/claim/apply step.

Core operations:
- Read bounded chapter/segment/track/take/work indexes and details.
- Create/patch script sections, speaker assignments and music drafts.
- Prepare/review/submit TTS or music with tagged input profiles.
- Inspect known generation jobs; add/select generated or imported sources.
- Apply bounded clip operations through revision-checked edit commands.
- Prepare an export artifact from an explicit project snapshot, exposing it for user download.

Extend project context with kind-specific bounded facts and truncation coverage; do not expose entire audio files/raw provider JSON or arbitrary extra metadata. Existing video creation/editing tools must reject non-video targets. Manual UI updates refresh future Agent context; previews and commits revalidate revisions to protect edits made while the Agent was thinking.

Paid speech/music proposals keep the existing explicit review surface, including selected connector/model/settings; full-access mode does not bypass it. Manual Generate clicks are the direct submission intent and need not open a second Agent approval flow. Agent-triggered capture or file picker operations are not offered. No audio-understanding capability is implied by possessing a waveform or filename.

## 8. Portability, deletion and retention

Extend collectMediaIds, project cleanup, material adoption and projectPackage contracts together. Include alternative takes, unattached retained sources, works, completed exports and chapter references, not only clips currently on the timeline.

Export owned content and provenance with explicit audio/music schema versioning; exclude connectors/keys/chat authorization/live request claims. Import validates references and finite time bounds before a single transaction, remaps local project/chapter/segment/speaker/take/track/clip/work/media IDs, preserves provider IDs only as provenance, and leaves remote monitoring dormant. Older packages default to video. Missing audio MIME must use audio mappings rather than the current JPG fallback.

Project deletion removes new project-owned records/media in the same lifecycle, preserves existing historical Agent read-only behavior and prevents late job completion from recreating a deleted project. Material adoption makes independent snapshots; deleting a project must not delete an explicitly retained library copy.

## 9. UI design contract

Keep existing tokens/typefaces, Chinese terminology, focus treatment and theme behavior. Use a precise studio-tool visual language: restrained panels, strong text hierarchy, compact useful controls, tabular time displays and a small number of track accents. Do not add decorative fake waveforms, stock cover art or fabricated progress.

Desktop Audio: collapsible chapter/speaker/material rail; central script rows with takes; contextual inspector; resizable lower timeline/transport.
Desktop Music: creation rail; works list; optional detail panel; persistent bottom player.
Narrow: tabs/sheets for content/timeline/properties, reachable transport, numeric clip edits and no page-level horizontal overflow. Timeline itself may scroll horizontally with an explicit ruler.
Agent opens through existing project-bound chat/task patterns, with links back to affected segments/works.

Respect keyboard editing, reduced motion, empty/loading/missing/error states and explicit permission feedback. Save status distinguishes local persistence from remote generation and completed downloads.

## 10. Risks and deferred verification

- Browser codec support and microphone permissions vary; record actual MIME and validate decode.
- Large decoded audio requires meaningful memory budgets; no untested long-form guarantees.
- APIMart endpoint CORS/account support and CDN download access require live verification; no paid calls were made during planning.
- Shared record changes touch video routes, Agent context, backup and cleanup; the foundation regression gate precedes UI enablement.
- Cloud URLs may expire; local save failure is visible and retryable while the source remains available.

Database upgrades are additive. Keep legacy fields/routes; avoid destructive migration. During implementation unfinished project kinds remain unavailable in normal navigation until their repositories and lifecycle tests pass. On defects, disable new entry points while retaining user content; do not drop new tables or delete sources as rollback.


## 11. Audio interaction redesign — Fish Audio reference (2026-09-22)

The user rejected the first workspace as a set of disconnected forms with poor small-screen editing. Reference: user-provided Fish Audio Story Studio screenshot, plus official https://fish.audio/zh-CN/blog/text-to-speech-multiple-voices/ . Reference concerns interaction, not provider integration or copying its unsupported enhancement features.

Change boundary: AudioWorkspacePage/ScriptDocument/AudioInspector own document and contextual selection; AudioTimeline owns transport, seeking and editing; AudioSources gains a compact library-menu entry; isolated audio CSS handles responsive layout. Persisted schema, music workspace, provider contracts and render semantics stay intact. Preserve all existing source/take/clip/CAS protections and regressions.

- Center a continuous editable manuscript. Latest user correction: each explicit line is one voice unit; natural screen wrapping is not a new unit. Remove per-line cards, numbers, metadata headers, saved-status footers and selected backgrounds. Show left-gutter controls only on hover/focus/selected touch row; voice/version details stay in the inspector. Enter splits at the caret and multiline paste imports by non-empty line.
- Chapter navigation uses a compact popover. Versions, voice settings, sources and exports occupy a contextual inspector, not another always-visible navigation column.
- Selecting text locates existing timeline audio; selecting a clip selects its source segment/take. No implicit generation, replacement or rearrangement.
- Transport stays reachable. Timeline ruler supports pointer seeking, adaptive ticks/fit, and clear script-derived clip names. Precise parameters use a contextual inspector/popover.
- Small screens use explicit Script / Edit modes; contextual properties open a Sheet and the timeline remains mounted for playback. Do not stack desktop rails into a long page.
- Existing shadcn default control styling, theme tokens and focus rings remain. No decorative left border strips, no arbitrary sharp-corner conversion, no nested cards around every text block.
- Verification must include realistic multi-paragraph content, selected take→clip linkage, ruler seek/keyboard controls, retained edit/export behavior, 1440/1024/390 layouts, and no body overflow.


## Follow-up: Agent project creation and music UX (2026-09-22)

User requests filling Agent audio/music project creation and simplifying the music workspace against their Suno screenshot. Implementation authorized; preserve existing shadcn defaults and APIMart-only capabilities.

Behavior gaps: project_create is video-only and must create the requested kind with correct seeded records and no video-only arguments for audio/music. Preserve frozen project scope: creation must not silently rebind an existing conversation. Expose a concrete continuation path to the created project. Music currently stacks engine/mode/title/lyrics/settings/connection forms and permanently reserves empty details.

Change boundary: Agent business tool schema/creation repository call, its capability/preview/result and project-picker affordance if needed; MusicWorkspacePage and extracted creation/details/list CSS; existing shared player may gain queue navigation through optional callbacks. No provider/schema migration, new arrangement features, mock artwork or paid live calls. Root owns shared player and validation; workers own Agent and music UI separately.

UI contract: compact Simple/Custom switch and engine/model selection; Simple starts with one useful idea input. Custom exposes lyrics/style, optional controls collapsed. Draft selection compact; generation control remains reachable. Main area is works/search/filter with inline pending jobs, no permanent empty detail panel. Selecting details opens contextual aside/Sheet. Persistent player supports useful previous/next if available; independent active playback vs detail selection. Narrow switches creation/works and opens details Sheet without losing edits. Preserve engine/mode drafts and never reinterpret a description as lyrics on a mode switch. Only documented APIMart controls.

Sources: user screenshot; https://help.suno.com/en/articles/2462273 (Simple description), https://help.suno.com/en/articles/2415873 (Custom lyrics). Adopt information hierarchy, not every Suno parameter.

Validation: project_create legacy/new kinds/schema/atomic replay/scope tests; music mode/persistence tests; lint/full test/build; real desktop and 390px browser validation, no paid POSTs.
