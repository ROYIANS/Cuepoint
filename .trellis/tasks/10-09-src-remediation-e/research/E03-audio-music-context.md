# E03 scoped canonical audio/music context

Source: `.trellis/spec/frontend/audio-music.md`; SHA-256 `43d32887a065d675fff855bc466550b63fbc971a1dd0be98ac92a4418fa21c1f`. Read-only exact excerpts relevant to CSS consumers/fixture ownership; other provider/protocol contracts remain unchanged. Read additional canonical sections if a concrete test setup needs them; no product scope expansion.

## Canonical lines 1–100

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

## Canonical lines 294–325

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


## Timeline direct actions

Clip right-click and keyboard context-menu key/Shift+F10 open the same shadcn DropdownMenu as the visible More button. Capture clip/track records on open; mutating actions use their observed revisions. Menu supports playback from clip start, duplicate after source, split at playhead, move to another existing track, properties and remove. Track context menu exposes mute/solo; existing track controls remain available to touch users. No native browser context menu. A fixed pointer-position trigger lets Radix own focus, dismissal, collision handling and submenus.

`AudioClipHistory.duplicate` appends a new ID at the source end, retaining take/trim/fades/gain/track and using chapter CAS; all clip edits including remove remain undoable. Removal never deletes the source take or media. No ripple deletion or implicit overlap rearrangement.

`resolveTimelineShortcut` requires timeline focus and yields to inputs, controls, menus, dialogs, composition, repeat, busy state and drag. Delete/Backspace removes, Cmd/Ctrl+D duplicates, S splits, Space plays, Cmd/Ctrl+Z undoes, Cmd/Ctrl+Shift+Z or Ctrl+Y redoes. Availability gates prevent consuming unsupported operations. Ctrl-click does not start dragging so macOS secondary click can open context actions.

Regression coverage: audioTimelineShortcuts.test.ts guard matrix and audioEngineCommands.test.ts duplicate/source retention/undo-redo/stale and concurrent edits.



## Canonical lines 453–490

## C06 inbound audio resource boundary

See [the seven-section bounded inbound reading contract](ai-connectors.md#c06-bounded-inbound-reading-contract-2026-09-30). The shared 32 MiB raw/decoded-audio policy is enforced during provider reads, before raw media checkpointing. MiMo base64 envelope allowance and exact decoded-size guard are separate. Over-limit paid-submit responses retain uncertain intent without resubmission; existing music task/result checkpoints recover through GET/download. Binary image/video downloads use the independent 256 MiB local policy.


## Workspace orchestration owners

The D03 [feature responsibility contract](./component-guidelines.md#d03-feature-responsibility-contract-2026-10-08) defines asymmetric audio selection, the shared playback/waveform/export buffer owner, `exportAudioMix` and `switchMusicVariant`. Export scope uses `NonNullable<AudioExport["scope"]>`; decode/render stays outside writes and repository fingerprint validation precedes UI download. Page-owned player epochs, pointer/history lifetimes, synchronous music action/submission locks and best-effort variant-link storage remain distinct from these commands. D03 does not change the music capability/provider policy or text-draft protocol.

## E01 voice form draft ownership (2026-10-09)

### 1. Scope / Trigger
VoiceLibrary/SpeakerEditor manual preset/design/clone configuration, reference import, audition/save and project/dialog replacement.

### 2. Signatures / Owners
VoiceLibrary retains the displayed project/editor before a requested replacement. SpeakerEditor publishes synchronous `ManualDraftState`; the shared departure API and local arbiter live in useManualDraftGuard and component-guidelines.

### 3. Contracts
Freeze speaker ID/project/revision and initial name/voice/mode/instruction/reference/sample fields. Real changes dirty the form; reverting returns clean. Local close/choice/project replacement and route history resolve current owner departure first. Reference import, audition and save publish pending synchronously and cannot dismiss/discard. Retired completion is mounted-gated. Rejected speaker CAS retains input/original revision for retry. Audition still uses durable prepare/submit/result/media code with explicit generation intent; preview/reference media remains project-owned after local discard. No media deletion is attached to draft cleanup.

### 4. Validation / Error Matrix
| Trigger | Outcome |
| --- | --- |
| Unchanged opening or reverted fields | Clean departure |
| Dirty Escape/close/project switch/SPA/POP | Continue keeps exact configuration and owner |
| Pending import/audition/save | Keep editor and reject duplicate/dismissal |
| Reference/save failure | Keep input with actionable error and retry |
| Old completion after owner replacement | Original validated persistence only; no new-owner state/navigation |
| Preview discarded with local form | Retain actual owned media; do not replay paid generation |

### 5. Good / Base / Bad Cases
Good: failed voice save -> same input/revision retry; audition preview remains after discard. Base: unchanged preset can close. Bad: treating busy=false as proof that no unsaved voice settings exist, or saving edited settings to a newly selected speaker.

### 6. Tests Required
E01 native fixture runs actual reference validation/decode/storage and durable audition with offline HTTP interception, plus project replacement, delayed/rejected save, back/forward, clean/revert and stale completion. Existing MiMo/audioFoundation and B02 regressions remain meaningful. Offline transport does not prove a real paid provider or full mobile playback.

### 7. Wrong vs Correct
Wrong: close clears editing whenever !busy. Correct: query synchronous dirty/pending, explicitly resolve dirty departure and retire only the authorized owner. Preserve existing captured-revision CAS, provider/profile/defaults and media-retention contracts.

