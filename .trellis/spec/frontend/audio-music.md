# Audio and Music Workspaces

## 1. Scope / Trigger

Read this spec before changing project kinds, audio editing, music creation, audio generation,
Agent sound tools, or media retention and project ZIP transfer. The application remains a
local-first React/Dexie client: manual controls and Agent tools use the same repositories.
Audio production must work through recording/upload without a connector or Agent.

The first release supports multitrack voice/music/effects editing, PCM WAV mixing, APIMart
TTS, Flow Music and Suno music generation. Arrangement, continuation, covers, stems, MIDI,
voice cloning and professional signal processing are not implemented contracts. Agent tools
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
`audio_generate_speech` and `music_generate` set `requiresConfirmation: true`, including in
full permission mode. `audioGenerationTools.ts` binds every operation to `frozenProjectScope`,
checks durable run/call identity and approved running status, and compares the saved preview
revision with current arguments, target and connector identity/credential revision immediately
before submission. Manual Generate is its own direct intent; it does not enter Agent approval.
Recovery of an existing call reads/polls its existing job without another POST. Project
context and read tools provide bounded text and metadata, not raw audio or secret keys.

**ZIP and retention.** `audioProject.json` is an explicit version-1 allowlist, included with
the existing project package. `audioProjectPackage.ts` validates shape, duplicates, owner,
references and timeline bounds; project import inserts and validates in one rollback-capable
transaction. All local entity/media IDs remap together; provider task/clip/index values stay
as provenance. Alternative/unplaced takes, works, exports, saved raw response media and
result tombstones remain in media collection. Missing audio source bytes reject backup.
Codec MIME parameters survive metadata transfer. Export excludes live claims/Agent
permissions/keys; import replaces connector identity with `imported`, clears the live base
URL, assigns a new intent, sets `dormant: true` and never resumes paid work. Old ZIPs still
synthesize legacy video episodes. There are no new environment keys or server credentials.

## 4. Validation & Error Matrix

| Condition | Required behavior |
| --- | --- |
| Missing kind / unsupported explicit kind | Legacy video / supported error respectively |
| Audio/music routed through film repair | Reject before episode creation |
| Foreign project/chapter/track/take/media reference | Reject transaction without partial writes |
| Stale revision or concurrent clip addition during undo | Conflict; retain latest content |
| NaN/infinite/negative time, reversed trim, out-of-source trim | Reject |
| Gain outside 0–4; fades individually or together exceed clip duration | Reject |
| Noninteger decoded sample rate/channel count or nonpositive duration | Reject source |
| New generated version | Keep previous selection and placed clips |
| Agent full mode without approved paid call | No generation network request |
| Target/connector changes after preview | Fail preflight; require fresh review |
| Ambiguous POST outcome | `uncertain`; no automatic resubmission |
| Known task failure, malformed sibling or download failure | Preserve valid siblings and truthful diagnostics |
| Reload during partial music download | Recheck unfinished task IDs; never prematurely mark saved |
| User-deleted generated result | Keep media tombstone; do not recreate work |
| Wrong MIME/unknown bytes | Detect and decode; reject unsupported data instead of relabeling |
| Invalid ZIP or missing required media | Reject and roll back imported project |
| Imported generation job | Dormant history; no claim, automatic POST or polling |

## 5. Good/Base/Bad Cases

- Good: Record twice, choose take A, place it, generate take C later; A remains selected and
  its existing trim remains unchanged. C is independently auditionable.
- Base: A user uploads audio, edits voice/music/effects clips, exports WAV, backs up and
  reopens the project without any API credentials.
- Good: A submission returns tasks A/B; A completes, B fails. Save A, report B's error and
  retain their original provider identifiers. Retrying download performs no paid POST.
- Good: Remove an already saved generated song while its sibling is still downloading;
  retry saves the sibling and preserves the removed song's tombstone.
- Bad: Read a stale live-query row, overwrite the entire segment, then repair by silently
  assigning a newer revision.
- Bad: Treat `downloading` as proof all provider tasks are complete, or treat a waveform as
  evidence that the Agent has heard the recording.

## 6. Tests Required (Assertion Points)

| Test entry | Assertions to retain |
| --- | --- |
| `tests/audioFoundation.test.ts` | Legacy kinds, non-video episode guard, ownership/CAS, source retention, clip undo, ZIP round trip, deleted take history, one submit claim |
| `tests/audioGenerationRuntime.test.ts` | One paid POST under concurrency, uncertain submission, TTS raw-response recovery, download recovery, stale-target preflight |
| `tests/audioGenerationRecoveryAudit.test.ts` | Partial multi-task success, healthy download siblings, extensionless WAV, unknown statuses, partial-download reload, malformed original indexes, deleted-work tombstone/ZIP |
| `tests/audioGenerationAgent.test.ts` | Approval in ask/assist/full, rejection, changed draft, submitted-call GET recovery and bounded context |
| `tests/audioMusicAgentTools.test.ts` | Strict schemas, bound scope, atomic ledger/domain writes, replay deduplication, stale previews and text pagination |
| `tests/apimartAudio.test.ts` | Endpoint envelopes, Unicode limits, mode parameters, errors, identity/index preservation, CDN credential isolation |
| `tests/audioEngine.test.ts`, `audioEngineCommands.test.ts`, `audioEngineRecorder.test.ts` | Schedule/seek/fades/mute/solo, encoding/resource limits, split/CAS undo and recording cleanup |
| Existing `projectPackage`, `repo`, `materialLibrary`, `materialIntegration`, `productionProposals` tests | Old video/ZIP compatibility, independent material snapshots and additive DB upgrade |

Use `/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm` for checks, following AGENTS.md.
Run the affected Vitest files, `pnpm lint` (TypeScript), and the integrated suite/build at the
release gate. Automated provider tests use mocked transport and decoder seams. They do not
prove APIMart account balance, live endpoint CORS, provider audio quality, CDN reachability,
or every browser microphone/codec combination. Record real browser and paid-provider
verification separately; do not describe live calls as passed unless they were actually run.

## 7. Wrong vs Correct

```ts
// Wrong: discards successful earlier tasks when one later task fails.
for (const taskId of job.taskIds) {
  const task = await query(taskId);
  if (task.failed) return failJob(job);
  results.push(...task.tracks);
}
```

```ts
// Correct: use the shared recovery coordinator, which persists diagnostics,
// preserves original result indexes, saves valid siblings and never repeats POST.
await refreshAudioGeneration(projectId, job.id);
```

```ts
// Wrong: bypasses ownership, field validation and concurrent edit protection.
await db.audioClips.put({ ...staleClip, startSec: nextPosition });

// Correct: pass the observed revision through the shared mutation boundary.
await patchAudioClip(projectId, clip.id, clip.revision, { startSec: nextPosition });
// For split/delete/undo: replaceAudioClips(projectId, chapterId, expected, next).
```
