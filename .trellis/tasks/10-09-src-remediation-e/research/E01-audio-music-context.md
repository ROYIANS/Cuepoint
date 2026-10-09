# E01 scoped canonical context: audio-music.md

Source: `.trellis/spec/frontend/audio-music.md`; SHA-256 `c455ca133451fa0f00e6264438ad7fcd0c670000d23f6f571369c9ce63196e93`. Extracted 2026-10-09 without changing canonical contracts. Planning context only; read additional canonical sections when expanding write scope.

## Canonical lines 1–162

# Audio and Music Workspaces

## 1. Scope / Trigger

Read this spec before changing project kinds, audio editing, music creation, audio generation,
Agent sound tools, or media retention and project ZIP transfer. The application remains a
local-first React/Dexie client: manual controls and Agent tools use the same repositories.
Audio production must work through recording/upload without a connector or Agent.

The first release supports multitrack voice/music/effects editing, PCM WAV mixing, APIMart
TTS, Flow Music and Suno music generation. Arrangement, continuation, covers, stems, MIDI,
professional signal processing are not implemented contracts. MiMo voice design and cloning follow the additive contract below. Agent tools
do not start a microphone/file picker or claim to have listened to audio. Export is currently
a workbench action, not an Agent export tool.

## 2. Signatures (API / DB)

Domain records live in `src/domain/audio.ts`, `music.ts`, `audioGeneration.ts` and `types.ts`.

```ts
type ProjectKind = "video" | "audio" | "music";
getProjectKind(project: Pick<Project, "kind">): ProjectKind;
createAudioMusicProject(name: string, kind: "audio" | "music", ipId?: Id | null): Promise<Project>;
getAudioProjectSnapshot(projectId: string): Promise<AudioProjectSnapshot>;

// X = Chapter, Speaker, Segment, Track, Clip; takes are immutable sources.
addAudioX(projectId, input);
patchAudioX(projectId, id, expectedRevision, patch);
deleteAudioX(projectId, id, expectedRevision);
addAudioTake(projectId, input, media?: MediaRecord): Promise<AudioTake>;
addAudioExport(projectId, input, media?: MediaRecord): Promise<AudioExport>;
replaceAudioClips(projectId, chapterId, expected: AudioClip[], next: AudioClip[]): Promise<AudioClip[]>;
adoptMusicWorkAsAudioTake(audioProjectId, workId, segmentId?): Promise<AudioTake>;

addMusicDraft(projectId, { settings });
patchMusicDraft(projectId, id, expectedRevision, { settings });
addMusicWork(projectId, input, media?: MediaRecord);
patchMusicWork(projectId, id, expectedRevision, { title?, notes?, favorite? });
deleteMusicWork(projectId, id, expectedRevision);
```

`AudioRow` provides `id/projectId/revision/createdAt/updatedAt`. Dexie v23 adds:

| Table | Additional indexes / ownership |
| --- | --- |
| `audioChapters` | `projectId`, `order` |
| `audioSpeakers` | `projectId` |
| `audioSegments` | `projectId`, `chapterId`, `speakerId`, `order` |
| `audioTakes` | `projectId`, `segmentId`, `mediaId` |
| `audioTracks` | `projectId`, `chapterId`, `order` |
| `audioClips` | `projectId`, `chapterId`, `trackId`, `takeId` |
| `audioExports` | `projectId`, `mediaId` |
| `musicDrafts` / `musicWorks` | `projectId`; works also index `mediaId` |
| `audioGenerationJobs` | `projectId`, unique `intentId`, `status`, `updatedAt` |

Generation entry points in `src/lib/audioGeneration/runtime.ts`:

```ts
prepareAudioGeneration({ projectId, connectorId, input, intentId?, source? });
submitAudioGeneration(projectId, jobId, options?);
refreshAudioGeneration(projectId, jobId, options?); // bounded GET/download pass; never paid POST
```

The repository (`src/db/audioGeneration.ts`) provides
`prepareAudioGenerationJob(projectId, input)`,
`claimAudioGenerationJob(projectId, id, expectedRevision, owner)` and
`patchAudioGenerationJob(projectId, id, expectedRevision, patch)`.

Transport in `src/lib/ai/apimartAudio.ts` uses the configured `/v1` base URL:
`POST /audio/speech`, `POST /music/generations`, and
`GET /music/tasks/{encodedTaskId}?language=zh`. CDN downloads use
`downloadApimartAudio`; they never receive connector authorization headers.

## 3. Contracts

**Kinds and routes.** Missing `Project.kind` is legacy video; an explicit unsupported value
must not normalize into video. Audio creation seeds one chapter and voice track; music
creation seeds one draft. Neither creates episodes. `/p/$projectId/` dispatches to the audio
or music workspace; video preserves film/series navigation. Workspace chrome prevents
non-video child paths from mounting video pages. Video repair and mutations must reject
non-video projects. The gallery filters actual persisted kinds, and project settings hide
video output/style controls for audio and music.

**Audio studio interaction.** The manuscript is continuous editable text: each explicit line is a voice unit, while visual wrapping does not split it. Do not render per-line cards, numbering, metadata headers, saved-status footers, or large selection backgrounds. Keep actions in a left gutter revealed on hover/focus (touch selects a line); voice settings and versions belong to the contextual inspector. Enter splits at the caret, and multiline import preserves logical line order. The manuscript is the primary document, not a column of always-expanded forms. Keep chapter navigation compact, contextual voice/take history in a collapsible inspector (Sheet on small screens), and a persistent timeline transport. Script selection may locate an already placed clip; clip selection may reveal its linked script/take, but neither selection mutates audio or causes generation. Mobile uses explicit script/edit modes instead of stacking desktop columns. Timeline may scroll horizontally inside its own viewport; the page must not. Use existing shadcn defaults and meaningful track accents, never decorative left border strips.

Editable components using `useDebouncedDraft` must be keyed by the entity/field when their target changes (especially contextual notes or speaker editor). Otherwise a pending draft with the same empty baseline can be saved to the newly selected record. Asynchronous decode/play work must verify its initiating chapter/composition is still current before starting playback.

**Music creation interaction.** Keep the primary description/lyrics and generation action visible; engine/mode/draft selection should be compact, and less common parameters progressive. Works own search, favorite filtering, ordering and generation activity; contextual details appear only when requested, using a Sheet below desktop width. Keep creation mounted when mobile switches to works, and keep playback independent of detail selection. Never relabel a saved Simple description as Custom lyrics. Distinct mode/engine variants retain real repository drafts; optional localStorage links contain IDs only, are validated against project and variant, and never become a second store for text. Lost links may create a new draft but must retain existing content. Shared player queue controls are optional, use real media events, and do not auto-submit or generate.

**Sources and timeline.** `AudioTake` owns immutable `mediaId`, source type, decoded
`durationSec/sampleRate/channels`, optional `segmentId`, text snapshot and provider
provenance. `AudioSegment.selectedTakeId` is an explicit selection, independent of placement.
Adding/generating another take never changes it. A placed clip owns `chapterId/trackId/takeId`,
`startSec`, original-source `trimStartSec/trimEndSec`, `gain`, `fadeInSec/fadeOutSec`.
Tracks own `role: voice|music|effects`, order, gain, muted and solo. Segment order does not
reorder the timeline. Only unbound sources can be freely placed in another chapter;
segment-bound sources must match the destination chapter.

Writes run inside `AUDIO_TRANSACTION_TABLES`, verifying project ownership, references and
expected revisions. `replaceAudioClips` compares the entire chapter's current clip IDs and
revisions before replacing that document. `AudioClipHistory` stores inverse document edits,
not media Blobs; stale undo rejects rather than overwriting concurrent manual/Agent work.
Script deletion detaches and retains takes. Removing an in-use take rejects. Deleting a
chapter preserves completed exports with `scope: "chapter"` and `chapterTitle` while
clearing the deleted local chapter reference.

**Media and editing engine.** `src/lib/audio/` owns decode/cache, waveform reduction,
scheduling, synchronized Web Audio preview, OfflineAudioContext rendering, PCM WAV encoding,
recording lifecycle and edit commands. Recording waits for final `dataavailable`/`stop` and
cleans tracks/nodes; actual recorder MIME is retained. `detectAudioMime(blob)` recognizes
container bytes (WAV/FLAC/Ogg/MP3/AAC/MP4/WebM), then permits supported declared audio MIME as
a fallback. Callers must also decode. Never infer MP3 from an extensionless octet-stream
response, label WebM as WAV, or silently omit an undecodable clip from export. Preview and
export share a schedule; export checks resources and provides safety attenuation for peaks.
Use the implementation's budget constants rather than promising unrestricted duration.

**Generation state and recovery.** Input is tagged speech or music. Speech stores
`text/voice/speed/segmentId?/segmentRevision?`; music stores complete engine-discriminated
`settings/draftId?/draftRevision?`. Flow has sound prompt/lyrics/title, optional BPM string,
length and seed; it has no instrumental flag. Suno uses version, custom/instrumental flags
and mode-specific prompt/style fields. `musicWireInput` drops outgoing controls unsupported
by the selected mode. The UI uses WAV TTS. Connector records store credentials; jobs store
only connector ID/provider/base URL and a manual source or Agent call/run identity.

`intentId` is unique. Submission claims are durable, revision-checked and locally at-most-once;
there is no invented provider idempotency guarantee. Known task IDs persist immediately.
Network/abort/protocol uncertainty never automatically replays POST. Interrupted TTS bytes
already received are stored before decoding so local processing can retry without paying
again. An interrupted `submitting` job becomes `uncertain`.

Music results are keyed by task ID plus the original one-based provider result index.
Malformed sibling entries retain diagnostics without renumbering valid tracks. Query every
known task and persist successful siblings even when others fail. Download failures are
per-result and must not block healthy siblings. Unknown statuses carry a diagnostic and
pause automatic UI polling; manual refresh remains available. On recovery from music
`downloading`, recheck known task IDs: a transient download checkpoint does not prove that
all submitted tasks completed. Web Locks serialize a job where supported; local locking and
repository CAS protect the remaining write boundary.

Deleting a generated take/work marks the matching job result `deleted: true`, clears the
local take/work ID, retains `mediaId` and provenance, and increments the job revision in the
same transaction. Download/persistence skips these tombstones: a refresh must not recreate a
work the user removed. Project deletion removes jobs and owned media and late completion
cannot recreate the project. Independent library snapshots and music-to-audio copies survive
source-project deletion.

**Agent approval.** `audio-production` and `music-creation` skills use compact catalogs.
`audio_read` and `music_read` may omit `projectId`; resolve it only from the validated
durable run/thread binding and include it in every read result, including text pages.
Explicit foreign IDs still reject. `requireBoundProjectScope` distinguishes a missing
binding from a mismatched argument: the latter supplies the current bound ID for a
corrected read and must not tell the user to reopen an already bound conversation.
Edits and paid generation retain explicit targets, frozen previews and all ownership
checks; never silently replace a foreign target with the current project.
`audio_generate_speech` and `music_generate` set `requiresConfirmation: true`, including in
full permission mode. `audioGenerationTools.ts` binds every operation to `frozenProjectScope`,
checks durable run/call identity and approved running status, and compares the saved preview
revision with current arguments, target and connector identity/credential revision immediately
before submission. Manual Generate is its own direct intent; it does not enter Agent approval.
Recovery of an existing call reads/polls its existing job without another POST. Project
context and read tools provide bounded text and metadata, not raw audio or secret keys.


## Canonical lines 294–314

## MiMo speech and reusable voices (2026-09-22)

Speech input optionally carries `mimo: {mode, instruction, referenceMediaId?, optimizeTextPreview?}`. Absence preserves APIMart legacy speech. The same configuration can be saved on a project speaker; no hosted voice ID is invented. MiMo numeric speed is 1; natural-language instructions control performance. Preset uses documented voice IDs; design requires instruction, omits voice on wire and only rewrites text after explicit optimize flag; clone requires an owned WAV/MP3 reference and omits optimization.

Reference files remain owned media, not base64 in jobs or tool arguments. Shared reference validation checks actual container, encoded size including prefix (10 MiB), ownership and SHA-256 bytes. Prepare freezes sample fingerprint; claim/preflight and Agent approval detect changes. Speakers and generation jobs retain reference files in media collection; ZIP remaps IDs and makes imported jobs dormant. Optional fields need no schema version bump.

Nonstreaming MiMo WAV output is checkpointed before decode like APIMart speech. `finalTextPreview` is stored on the result and becomes the take text snapshot; original manuscript is never rewritten. Recovery processes stored bytes without replaying a POST. A failed/unknown submission remains visible, never auto-retried.

UI uses the existing contextual voice panel with preset/design/clone tabs. Optional performance guidance and text optimization are disclosures. Users explicitly save profiles to speakers. Project takes, uploaded WAV/MP3 and decoded WAV copies of recordings can be clone references; selecting a reference does not send it. Actual send occurs on Generate or approved Agent tool. Design output can be selected as a clone reference for reuse.

Regression coverage: mimoSpeech.test.ts, mimoRuntime.test.ts, audioGenerationAgent.test.ts and audioMusicAgentTools.test.ts cover wire roles, scoped bytes, replay, text provenance, ZIP/GC and reviewed tools.


### MiMo-first voice workflow
New unassigned speech and new Agent-created speakers default to MiMo preset `mimo_default`. Shared `defaultMimoConnector` never silently selects APIMart if MiMo is missing. Explicit legacy APIMart speaker profiles remain valid without rewriting historical data.

Project toolbar exposes Voices and Dubbing directly; manuscript gutter only selects a role or opens the voice library, no nested role configuration forms. `VoiceLibrary` edits existing AudioSpeaker records with a captured revision and creates named preset/design/clone configurations shared with Agent. Audition uses the same durable speech runtime without a manuscript target; save is a separate local operation, and a design audition can explicitly become a clone reference. Normal paragraph controls show voice selection and Generate, plus optional delivery guidance. First-use MiMo setup is inline and saves only through the studio connector repository. The library is mounted once outside responsive inspectors so opening it from a Sheet does not duplicate modal state.

Voice dialog close/navigation are blocked during active audition/reference import/save. Named edits use captured revision CAS, and paragraph voice assignment verifies current owner/profile binding after draft flush. Credentials and raw sample bytes do not enter speaker/tool records. Browser visual verification remains separate from deterministic code checks.


