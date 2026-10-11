# Native prototype audio compatibility context

Exact excerpts from `.trellis/spec/frontend/audio-music.md`; source SHA-256: ea8be073462c392309dcc290dcd09b3c245f7c5de2f1962eb8b13fdde0413f67.

The full source is authoritative. These task-scoped excerpts avoid context injection truncation and cover actual engine/recording/timing/export/ZIP and finite evidence boundaries. If implementation expands beyond the listed prototype helpers, read the full source directly before editing; the excerpt does not authorize broader changes.

## Source lines 1–14

# Audio and Music Workspaces

## 1. Scope / Trigger

Read this spec before changing project kinds, audio editing, music creation, audio generation,
Agent sound tools, or media retention and project ZIP transfer. The application remains a
local-first React/Dexie client: manual controls and Agent tools use the same repositories.
Audio production must work through recording/upload without a connector or Agent.

The first release supports multitrack voice/music/effects editing, PCM WAV mixing, APIMart
TTS, Flow Music and Suno music generation. Music arrangement, continuation, covers, stems, MIDI,
professional signal processing are not implemented contracts. MiMo voice design and cloning follow the additive contract below. Agent tools
do not start a microphone/file picker or claim to have listened to audio. Export is currently
a workbench action, not an Agent export tool.

## Source lines 74–115

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

## Source lines 210–293

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



## Source lines 422–460

## C04 audio export fingerprint and import freshness contract (2026-09-30)

### 1. Scope / Trigger
Audio project ZIP ID remapping and historical export freshness in AudioTimeline/AudioExports.

### 2. Signatures
`createAudioExportFingerprint`, `getAudioExportFreshness`, `preserveAudioExportFreshness`, and `remapAudioExportFingerprint` share the scheduling contract in `src/lib/audio/fingerprint.ts`. All three consumers must use the accepted contract, including recognizable legacy JSON schedule fingerprints.

### 3. Contracts
An export fingerprint describes the schedule when the export was produced. An import cannot replace it with the current schedule unconditionally. Fresh exports stay fresh after entity/media/project ID remapping; stale exports remain stale. Version 1 uses a schedule envelope with an optional sticky stale marker when lossy optional reference repair could otherwise upgrade history. Legacy buildAudioSchedule spreads full AudioTake rows, so project/segment/provenance IDs, metadata/revision and object key ordering need explicit compatibility handling. Canonical object keys may fix serialization order drift without discarding meaningful metadata or array order. Capture recognized stale status against full original rows before either ZIP snapshot allowlisting or import parsing strips unknown source metadata; comparing only the already-filtered package can erase the reason the export became stale. Unknown or malformed historical strings are retained and never reported current. Missing historical entities must not abort an otherwise valid package or disappear from a comparison to fabricate freshness. Deleted chapter exports retain chapter scope/title as historical outputs.

### 4. Validation / Error Matrix
| Historical export | Required result |
| --- | --- |
| Recognized current project/chapter fingerprint | Current after two roundtrips |
| Clip trim/gain or source metadata changed | Remains stale after two roundtrips |
| Fingerprint references deleted entities | Preserve historical stale state |
| Original chapter deleted | Preserve chapter history; do not reclassify as project |
| Malformed/unrecognized string | Retain; conservatively stale/unknown |
| Valid remapped media | Original bytes remain retrievable |

### 5. Good / Base / Bad Cases
Good: compatible ID mapping and key canonicalization keep an unchanged export current. Base: an old raw JSON fingerprint is still understood. Bad: comparing only selected acoustic fields drops a prior metadata change and falsely upgrades stale history, or import recomputes all fingerprints as current.

### 6. Required Tests
Real repository full AudioTake rows and actual export/import ZIP paths for project/chapter, current/stale, metadata-only changes, deleted chapter, unknown strings, two roundtrips and retained media bytes. These tests demonstrate persistence and comparison behavior, not decoded playback or acoustic render equivalence.

### 7. Wrong vs Correct
Wrong: blindly refresh fingerprints after import or only remap clipId/mediaId. Correct: preserve historical comparison semantics, remap every recognized identity deliberately, and keep unrecognized or already-stale evidence conservative.


## C06 inbound audio resource boundary

See [the seven-section bounded inbound reading contract](ai-connectors.md#c06-bounded-inbound-reading-contract-2026-09-30). The shared 32 MiB raw/decoded-audio policy is enforced during provider reads, before raw media checkpointing. MiMo base64 envelope allowance and exact decoded-size guard are separate. Over-limit paid-submit responses retain uncertain intent without resubmission; existing music task/result checkpoints recover through GET/download. Binary image/video downloads use the independent 256 MiB local policy.


## Workspace orchestration owners

The D03 [feature responsibility contract](./component-guidelines.md#d03-feature-responsibility-contract-2026-10-08) defines asymmetric audio selection, the shared playback/waveform/export buffer owner, `exportAudioMix` and `switchMusicVariant`. Export scope uses `NonNullable<AudioExport["scope"]>`; decode/render stays outside writes and repository fingerprint validation precedes UI download. Page-owned player epochs, pointer/history lifetimes, synchronous music action/submission locks and best-effort variant-link storage remain distinct from these commands. D03 does not change the music capability/provider policy or text-draft protocol.

