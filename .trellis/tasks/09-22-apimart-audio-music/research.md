# APIMart Audio Research

Verified against the provider documentation on 2026-09-22. Read-only documentation retrieval; no paid API requests were made.

## TTS

Source: https://docs.apimart.ai/en/api-reference/audios/tts.md

- `POST /v1/audio/speech` returns binary audio, not an asynchronous music task.
- The documented model is `gpt-4o-mini-tts`; input limit is 4096 characters.
- Voices: alloy, echo, fable, onyx, nova, shimmer. Speed: 0.25–4.
- Documented formats: wav, opus, aac, flac, pcm. Do not assume MP3 support from other OpenAI-compatible services. WAV is a practical initial browser-preview choice; raw PCM is not a standalone playable container.

## Flow Music

Sources:
- https://docs.apimart.ai/en/api-reference/audios/flow-music/music.md
- https://docs.apimart.ai/en/api-reference/audios/flow-music/query.md

- Submit `POST /v1/music/generations`, model `flowmusic`. At least one of `sound_prompt` and `lyrics` is required.
- Optional title, BPM as a string (at least 1), length 1–240 seconds, seed as a string. One track per generation request.
- Submission returns task IDs in `data[]`. Query `GET /v1/music/tasks/{task_id}` and read `data.result.music[]`.
- Keep `clip_id`, original result position, returned URLs, lyrics and optional timing metadata. Example duration is a decimal string in `duration_seconds`; normalize deliberately.
- Do not invent a provider-native instrumental boolean; the documented Flow Music request does not contain one.

## Suno

Sources:
- https://docs.apimart.ai/en/api-reference/audios/suno/generation.md
- https://docs.apimart.ai/en/api-reference/audios/suno/overview.md

- Model `suno`; documented public versions are v6, v6-wild, v6-mini. Public version and custom model ID are mutually exclusive.
- Inspiration mode interprets prompt as a description; custom mode interprets it as lyrics. Title/style/negative tags belong to custom mode. Instrumental generation is explicitly supported.
- Description limit: 3000 Unicode characters; lyrics: 5000; title: 80; style: 1000. Target duration 10–360 seconds is custom-mode-only and is not a guarantee of actual duration.
- Max mode has a documented billing multiplier; it should not be silently enabled.
- Query `GET /v1/music/tasks/{task_id}`; process all returned `music[]` items without hard-coding a count of two.
- Future source-track operations require original `task_id` plus one-based `audio_index`; display reordering must not change that index. A downloaded audio URL alone is insufficient.
- Unknown task status preserves the task ID and permits explicit refresh. Local abort does not cancel a remote Suno task. Never automatically retry a paid POST after an ambiguous timeout.

## Design implications to carry forward

- Store local playable audio plus provider provenance and generation parameters; an expiring/remote URL alone is not durable project content.
- Separate a remote generation job from its output tracks and saved assets. This supports multiple results now and derived versions later without implementing a multitrack editor.
- Reuse shared request/error/credential handling while keeping speech binary parsing and music task parsing distinct from existing image/video endpoints.
- Preserve the current explicit material-adoption and project ownership contracts when choosing how results enter the material library.
- Browser CORS for generation/result downloads, account model availability, and real output MIME types still need implementation-time verification; documentation review does not establish live account support.

## Interaction references after the user's scope clarification

Reference products inform proposed interactions only. Their features do not establish APIMart capability or authorize expanding the implementation scope.

- ElevenCreative Studio: https://elevenlabs.io/docs/eleven-creative/products/studio
  - Documents chapters, editable narration, contextual voice and playback settings, generation history, timelines, imported media, and export.
  - Useful proposed pattern: script/section organization plus selectable clips/takes and contextual controls. Manual editing and optional assistant operation share a project.
  - Do not copy vendor-specific free regeneration, voice isolation/changing, automatic word alignment, or voice-direction features into APIMart promises.
- Suno Workspaces: https://help.suno.com/en/articles/4326849
  - Workspaces organize songs during creation and permit moving works between collections.
  - Useful proposed pattern: a project's creation inputs and result history remain together; the player is independent of the currently edited draft.
- Suno custom lyrics: https://help.suno.com/en/articles/2415873
  - Distinguishes a description-based simple flow from a custom flow with user-supplied lyrics.
  - Render APIMart-supported engine-specific options; do not assume every Suno website operation is in scope or identically exposed through APIMart.

## Manual audio production implications

- Current source/package inspection found no MediaRecorder/getUserMedia, Web Audio rendering, waveform-editor or audio-editing engine implementation.
- Store source recordings/imports independently from clip placement and trim settings so edits can remain nondestructive.
- Recording/imported audio need no TTS credentials. Project creation, editing and export must not gate on an AI connection.
- A transcript is optional for imported/recorded clips. Script editing cannot imply that actual audio changed or that word timing is known.
- Audio production can include background music without expanding the separate music workspace into arrangement; the user must still decide the first-release timeline depth.
- Follow-up decision: the user approved lightweight multitrack audio and separately selected first-release Agent integration. The previous open timeline question is resolved.

## Browser audio references

- https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder — recorded chunks, stop/dataavailable lifecycle and runtime MIME support checks.
- https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia — user permission and secure-context requirements; capture begins only through explicit UI action.
- https://developer.mozilla.org/en-US/docs/Web/API/BaseAudioContext/decodeAudioData — decoding complete encoded files into sample buffers and resampling to the context rate.
- https://developer.mozilla.org/en-US/docs/Web/API/OfflineAudioContext — offline graph rendering to an AudioBuffer for local mix export.

The planned Web Audio/MediaRecorder approach is an engineering choice based on these APIs, not a completed browser compatibility or performance test. Actual supported MIME types, resource budget and sample-level preview/export agreement require implementation validation.
