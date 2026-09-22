# Audio and Music Production Workspaces

## Goal

Deliver usable audio and music projects with professional control and approachable interfaces. Audio must support a complete manual recording/import/edit/export workflow without Agent chat or API credentials. APIMart generation and the creative assistant are optional ways to produce or organize content within the same projects.

## Confirmed product decisions

- Initial generation provider: APIMart only; integrate TTS, Flow Music and Suno.
- Replace the Podcast placeholder with a broader Audio project entry; retain Music as a separate project type. Image and Copy stay placeholders.
- Audio follows professional voiceover workflows; user recordings and uploaded files are first-class sources.
- The user approved lightweight multitrack audio: voice, background music and effects; positioning, edge trimming, volume, fades and mixed export.
- Music follows Suno-like creation and workspace organization; music arrangement is deferred.
- The user explicitly selected first-release Agent integration. Manual and Agent operations share the same project.

## Repository evidence

- `src/components/studio/projectKinds.tsx:4` contains video/image/copy/podcast/music presentation categories, with video alone enabled.
- `src/domain/types.ts:235` defines video-oriented Project records; `src/routes/p.$projectId.index.tsx` currently repairs/redirects film episodes.
- `src/db/materials.ts:13` and `src/components/studio/materials/MaterialPreview.tsx:26` support audio materials and playback.
- `src/lib/ai/apimart.ts` contains credentials, discovery and image/video transport, but no speech/music contract.
- `src/lib/projectPackage.ts:657`, `src/lib/projectPackage.ts:771` and `src/db/repo.ts:591` own package transfer and media collection. Their video assumptions need extending for durable audio works.
- `src/lib/agent/toolLoading.ts:11` caps offered tools at 36. New capabilities must use the existing on-demand groups and permission system.
- `src/lib/media.ts` and current dependencies do not provide recording, waveform editing or a multitrack audio engine.

## Requirements

### R1. Project integration

Audio and Music are real project types with dedicated workspaces, rename/archive/delete, optional IP association, persistent drafts and project backup/import. Existing video records/packages retain their behavior. Opening an audio/music project must not create a video episode or expose video-only controls.

### R2. Script, voices and takes

Audio projects organize chapters, script segments and speakers. A new project starts with one chapter, without requiring the user to manage chapters. Each segment may have recorded, imported and generated takes with an explicit selected take. Retain alternatives and source provenance. Imported clips do not require a transcript. Editing a script does not alter existing sound or trigger TTS; changed text marks affected generated takes as outdated.

### R3. Recording and import

Users can choose a microphone, inspect input level, start/stop recording, audition, retain/discard, and record another take. Request microphone access only from a user action. Release capture when finished or leaving. Permission/device failure leaves import available. Users can import their own audio or adopt library audio; preserve the original. Supported input requires actual browser decode success, not just an extension check.

### R4. Lightweight multitrack editing

Provide voice/music/effects tracks with waveform display, seeking, zoom, clip positioning, edge trimming, splitting, per-clip/track volume, mute/solo, fades, and undo/redo for editing actions. Preserve original media. Provide numeric controls as alternatives to precision dragging. Script order changes must not silently rearrange an edited timeline.

### R5. Playback and delivery

Multitrack preview and export use the same timing, selection, gain and fade semantics. Export a chapter or the complete audio project as WAV; allow downloading original individual takes. The complete project concatenates chapters in their explicit order. Export a stable revision and show whether later edits are absent from that result. Guard unavailable media and memory limits before rendering, with actionable errors instead of producing incomplete output. Saving and reopening restores actual sources, takes and edits.

### R6. APIMart TTS

Generate speech directly from a selected segment using documented voices/speed. Validate the 4096-character limit without silent truncation. Preserve input/voice/settings with the take. Binary audio responses and JSON errors are handled separately. An explicit generation action submits the request; editing, auditioning, and exporting never implicitly spend generation credits. First-release export does not auto-generate missing narration.

### R7. Music creation workspace

Keep a creation draft, project works list, selected-work details/lyrics and persistent player together. Integrate Flow Music and Suno with only documented engine-specific controls. Support descriptions and supplied lyrics; Suno additionally exposes its explicit instrumental mode. Flow Music must not promise an undocumented instrumental switch. Preserve every returned work and its original result position. Users can compare, rename, favorite, annotate, download, reuse input settings as a new draft, and explicitly save a work to the material library.

Lyric text may be authored manually or drafted through the existing assistant; a separate provider-specific lyric-generation endpoint is deferred from this release. Reusing settings never submits a request automatically.

### R8. Durable generation and assets

Persist intent and known task identifiers, then recover music queries after refresh. Never automatically retry a paid submission after an ambiguous timeout. Distinguish submission uncertainty, remote completion, download failure and locally saved success. Retrying a failed download reuses the existing task/result. Preserve Flow Music clip IDs and Suno task IDs plus original one-based audio indexes for future operations. Save actual audio locally; a provider URL alone is not a finished durable asset.

### R9. Creative assistant

Provide project-scoped tools for reading project structure, editing scripts/speakers, organizing existing takes/clips and music drafts, proposing generation, monitoring results and adding usable results to the current project. Use the same repositories and edit contracts as the manual UI. Context refresh reflects manual changes; stale tool previews cannot overwrite later edits.

Paid Agent generation keeps the existing user-review contract in all permission modes. The assistant does not independently activate a microphone, select a local file, or claim to have heard audio when only metadata/text was available. These user-device interactions remain explicit UI actions. Editing an audio project's track layout is included; arranging music inside the Music workspace remains deferred.

### R10. Interaction quality

Use the existing restrained theme and shadcn component primitives, including their default rounded corners, borders and focus treatment. The user explicitly rejected native browser controls, decorative left borders and excessive nested/oversized rounded cards, then clarified that this must not turn controls into sharp rectangles. Reduce redundant wrappers rather than overriding shadcn styling. Audio emphasizes scripts, takes and timeline precision; Music emphasizes creation and listening. Keep selected-item details contextual, unavailable actions honest, save states clear, and keyboard focus visible. Desktop supports the full workspace; narrow layouts provide reachable panel modes and numeric edits, without horizontal page overflow or hiding playback/export.

## Acceptance Criteria

- AC1 (R1): Legacy video fixtures and ZIPs open as before; new audio/music projects route correctly, preserve IP association behavior and never create incidental video episodes.
- AC2 (R2,R3,R5): With no API key and without Agent chat, create an audio project, record or import narration, select a take, save/reopen, and export playable audio.
- AC3 (R2,R4): Re-record or regenerate a segment, compare alternatives, select a version and undo an edit without losing source media. Script edits do not silently change sound.
- AC4 (R4,R5): Arrange overlapping voice/music/effect clips; trim/split, mute/solo, adjust gains and fades; rendered samples and browser preview respect the same schedule. Export both a chapter and ordered whole-project audio.
- AC5 (R3,R5): Permission denial, missing microphone, unsupported/corrupt input, empty media, missing referenced media, and resource exhaustion give truthful recoverable outcomes.
- AC6 (R6): Boundary-length TTS inputs and valid parameters produce a saved playable take; provider errors never become audio. No export or editing operation triggers a paid POST.
- AC7 (R7,R8): Both music engines expose their supported flows, persist all returned works, and recover known tasks after reload with zero duplicate submission POSTs.
- AC8 (R8): A failed result download can be retried without regenerating. Original source identifiers remain correct after sorting/favoriting/renaming.
- AC9 (R1,R8): ZIP round-trip preserves scripts, chapters, speakers, takes, works, clips, fades, media MIME and provenance while remapping local IDs and omitting credentials. Import does not resume a remote job automatically.
- AC10 (R9): Agent changes are visible in the manual workspace; fresh context reflects manual edits. Wrong-project access, stale revision writes, duplicate approvals, deleted targets and changed connector destinations are rejected before their effects.
- AC11 (R9): A reviewed Agent TTS/music request produces one logical local job and the same usable asset representation as a manual request. Microphone access always requires an explicit user gesture.
- AC12 (R10): Verify desktop and narrow layouts, keyboard/numeric alternatives, recording cleanup, save indicators, generation recovery and long-list navigation.
- AC13 (all): Typecheck, meaningful domain/repository/provider tests, production build and existing video/Agent regression suites pass. Live paid API testing is separate from deterministic fixture coverage and must be reported honestly.

## Out of scope

Other audio/music providers; music arrangement/DAW; AI continuation, covers and section replacement; stem separation; MIDI; voice cloning; word-aligned transcription editing; automatic noise removal, EQ/compression/mastering; video-synchronized dubbing; remote collaborative recording; a separate lyrics API workflow; MP3 encoding of local mixes. Provider-supplied downloadable formats remain usable.

## Delivery map

| Child | Responsibility | Dependency |
| --- | --- | --- |
| `09-22-audio-music-foundation` | Project kinds, ownership, durable records and portable media | None |
| `09-22-audio-production-workspace` | Manual audio, timeline/rendering, TTS and workspace UI | Foundation |
| `09-22-music-creation-workspace` | Flow Music/Suno, task recovery, works and player | Foundation; shared generation contract from audio implementation |
| `09-22-audio-music-agent-integration` | Agent tools/context/reviews and cross-workspace acceptance | Audio and Music |

The parent owns these source requirements and final integrated acceptance. The children are implementation checkpoints in one release, not a reduced promise to deliver only one workspace.

## Review status

Product-direction questions are resolved. The defaults and deferrals above are presented together in the final planning review. Research, design and implementation plans exist. The user approved the complete final summary with “开始吧” on 2026-09-22. Implementation is authorized across all four children.
