# Native HTTP fixture: shortest existing-product UI acceptance

This is a synthetic loopback provider with no CORS headers. Node self-checks establish fixture behavior only. Native acceptance requires the normal packaged product, real UI configuration/requests/approval, visible local results, and matching server events. No provider account, real model quality, actual supplier acceptance or real billing is proven by this fixture. Browser CORS failure is expected; do not use this server as a browser-parity oracle.

Source extension: `scripts/native-product-fixture.mjs` and `scripts/native-product-fixture-check.mjs`. The root session owns restarting the existing fixture at port 56368. No running `fixture-ready.json` or `fixture-events.json` was changed by the worker. Restart clears the fixture's in-memory task directory; complete existing accepted tasks before restarting, then use fresh UI test requests.

## Setup once in actual UI

In **连接与模型**, use isolated synthetic connections:

| Connection definition | Base URL | Purpose |
| --- | --- | --- |
| OpenAI 兼容 | `http://127.0.0.1:56368/v1` | Agent Chat Completions / Responses / errors / redirects |
| APIMart | `http://127.0.0.1:56368/v1` | Image/video upload, generation and music/speech |
| MiMo | `http://127.0.0.1:56368/v1` | Default/created voice and audio batches |
| DeepSeek, added only for the redirect pass | `http://localhost:56368/v1` | Explicitly authorize the second loopback origin; keep Agent on OpenAI 兼容 |

Use only the public synthetic key `synthetic-local-only`; do not read or replace real supplier keys. The fixture's `/v1/models` now contains 13 synthetic model IDs. It exposes model-shaped names, not real model access. Existing name `fixture-responses` is retained for old receipts but does **not** select Responses in product code.

## Minimal direct UI checks

1. **Responses:** select OpenAI 兼容 in the Agent, use **模型设置 → 更换模型 → 搜索模型**, enter `gpt-5.6-luna` and click that exact row. Select intelligent mode with tools and model-default reasoning (not `none`). Send `[fixture:overview]`. The actual product chooses `/v1/responses` only for that exact model and a supported connection with tools. Verify streamed Chinese/🌹, reasoning and real overview tool result. Fixture events must show POST `/v1/responses`; a model named `fixture-responses` hitting Chat Completions is not this proof.
2. **429:** switch to `fixture-http-error`, send one ordinary message, verify visible HTTP 429 / synthetic rejection, no unexpected fallback endpoint, and a terminal recoverable UI state. Switch back to `fixture-chat` or `gpt-5.6-luna` for further work.
3. **Music:** 项目 → 新建项目 → 音乐 → create. Select **Flow Music**, fill **音乐描述**, optionally **更多设置 → 期望时长** = 1, select the synthetic APIMart connection, click **生成音乐** once. Wait for the 7-second existing polling interval or use **刷新任务或重试下载**. Verify one work with playable local WAV, task history and ordinary **下载原始音频**. Expected POST `/v1/music/generations`, GET `/v1/music/tasks/<id>?language=zh`, GET `/media/audio` without Authorization/Cookie. Suno can be tested by changing engine, but is redundant for native transport coverage.
4. **Default MiMo / batch:** create an audio project. **写下第一段** or **粘贴完整稿件**, save one/two short lines. For a single segment select **MiMo 默认音色**, **生成这段配音**, then check a saved take and play it. Or use **批量配音 → 核对并确认 → 确认并开始 N 段** for two lines; preparation must send no speech POST. Expected MiMo POST `/v1/chat/completions` with `model=mimo-v2.5-tts`, `stream=false`, `audio.format=wav`; returned JSON base64 decodes to a real WAV. This path does not exercise APIMart `/audio/speech`.

## Actual Agent tool proposals, not hidden task creation

The synthetic provider understands a user message consisting of `[fixture:tool]` followed by `{ "name": "…", "arguments": {…} }`. It emits only a short allowlist of real existing tools. If a tool is deferred it requests the real `load_tool_groups` once. It checks arguments against the actual schema offered in that UI request; the product's own parser, scope, revision, approval and business commands remain authoritative. It does not create IDs, write the database, grant approval, auto-apply results or assume that a tool succeeded. The marker is fixture behavior, not a product feature.

Use a project-bound intelligent Agent conversation. Read IDs through visible real tool results; do not query hidden DB state. Examples:

```text
[fixture:tool] {"name":"generation_capabilities","arguments":{}}
[fixture:tool] {"name":"business_search","arguments":{"kind":"shot"}}
[fixture:tool] {"name":"business_detail","arguments":{"kind":"shot","id":"REAL_SHOT_ID"}}
```

Capabilities returns the real synthetic APIMart connector ID. Search/detail returns the real project, episode, shot and slot media IDs. If there is no shot, add one through the existing shot UI first. Add `desktop/tauri/fixtures/media/image.png` as a shot **参考图** and save; detail then exposes its actual `referenceImageIds`. Global material IDs cannot substitute for a project-owned media ID.

The shortest image + video + multipart path is one real batch with two candidates, using those IDs:

```text
[fixture:tool] {"name":"prepare_generation_batch","arguments":{"title":"合成网络验收","candidates":[{"connectorId":"REAL_APIMART_CONNECTOR_ID","model":"gpt-image-2.5-flare","target":{"kind":"shot","projectId":"REAL_PROJECT_ID","episodeId":"REAL_EPISODE_ID","entityId":"REAL_SHOT_ID","slot":"firstFrame"},"prompt":"合成图片 [fixture:cross-origin-media]","parameters":{},"inputs":[{"mediaId":"REAL_REFERENCE_IMAGE_ID","role":"reference-image"}]},{"connectorId":"REAL_APIMART_CONNECTOR_ID","model":"MiniMax-H3","target":{"kind":"shot","projectId":"REAL_PROJECT_ID","episodeId":"REAL_EPISODE_ID","entityId":"REAL_SHOT_ID","slot":"clip"},"prompt":"合成视频","parameters":{"mode":"text","duration":4,"resolution":"768P","aspectRatio":"16:9"},"inputs":[]}]}}
```

Open the real batch card, inspect/edit both candidates, and use its actual **确认生成 2 份** action. Verify generated image/video saved as local candidates, preview both, and choose/apply only through the existing user actions if needed. For the optional cross-origin image marker first configure the localhost connection above; otherwise remove the marker to keep the download on 127.0.0.1. Use text-only video here: the tiny fixture PNG does not satisfy MiniMax reference-image dimensions (minimum 256px), so using it for video would test a legitimate validation rejection instead of transport.

Expected image sequence: real multipart POST `/v1/uploads/images`, POST `/v1/images/generations`, GET `/v1/tasks/<id>`, GET `/media/image`. The `multipart-file` event has actual file byte count/hash and filename; compare its hash to the selected PNG, not to the whole multipart envelope. Expected video sequence: POST `/v1/videos/generations`, GET `/v1/tasks/<id>`, GET `/media/video`. Upload/submit/poll may carry the synthetic connector Authorization; every downstream media GET must have Authorization=false and Cookie=false. Provider listing's historical `gpt-image-2.5` spelling was not a legal product profile; use exact `gpt-image-2.5-flare`.

For single-request approval rather than batch approval, issue `submit_generation` with either one of the candidate objects above and use the real **确认并生成图片/视频** card. This is an optional separate approval UI check; repeating it is unnecessary for endpoint coverage.

To cover APIMart direct speech bytes using the real Agent confirmation UI, open an audio-bound intelligent conversation:

```text
[fixture:tool] {"name":"audio_generation_capabilities","arguments":{}}
[fixture:tool] {"name":"audio_generate_speech","arguments":{"connectorId":"REAL_APIMART_CONNECTOR_ID","text":"合成配音验收。","voice":"alloy","speed":1}}
```

Confirm the existing paid speech card, then inspect/play the saved take. Expected POST `/v1/audio/speech`, `model=gpt-4o-mini-tts`, input/voice, default WAV, followed by local audio decode/storage. No CDN GET is required because this endpoint directly returns the WAV body. Omitting `segmentId` intentionally makes a project take; assigning it to a segment needs the real current segment ID/revision. If Agent batch preparation is also wanted, real `audio_read` results supply chapter/segment IDs for `prepare_audio_generation_batch`; the direct batch UI above covers the same native speech execution with fewer chat requests.

## Redirect/header oracle

Select OpenAI 兼容 + `fixture-redirect`; send a new ordinary message. The fixture answers the first POST `/v1/chat/completions` with 307 to `http://localhost:56368/v1/chat/completions?redirected=1`.

- Before the localhost connection exists, expect the product to reject the unconfigured redirect and no target request event. An additive native grant from an earlier run is insufficient: the wrapper rechecks current configuration.
- After configuring the localhost DeepSeek connection, resend as a new message. Verify a successful visible response reporting `method=POST, authorization=false, cookie=false` and inspect the matching event pair. Source and target body hashes must match, source Authorization=true, target Authorization=false/Cookie=false, and no OPTIONS/CORS substitution. Both hosts resolve to the same local fixture but are different origins. Node self-check explicitly follows a location without auth; only the actual packaged event pair proves the product strips credentials.
- Image prompt `[fixture:cross-origin-media]` returns its downstream media URL on localhost. This separately tests a configured HTTP result origin and no-auth GET. Existing APIMart submit/poll/download callers use `redirect:error`; do not treat their rejection of a supplier 3xx as a failed follow implementation.

## Reopen / no automatic paid replay

Record paid-shaped request counts, leave the completed project/Agent view, close/reopen the app/profile, return to project and generation history, and compare counts. Count POST image/video/music generations and `/audio/speech`, plus `/chat/completions` body events whose model starts `mimo-v2.5-tts`; ordinary chat/final review POSTs are distinct. Existing pending-task GET polling and media GET retry do not count as a second submit. A prepared batch should also survive reopen with zero generation POSTs until its actual confirmation. Wait for terminal local save before the completed-state reopen check; do not restart the fixture during an outstanding remote task.

## Fixture self-check

`node scripts/native-product-fixture-check.mjs` starts and closes its own ephemeral fixture only; it does not affect the fixed 56368 server. Fourteen checks pass: no-CORS models, media hash, real multipart bytes and rejection, task submission, chat tool loading, Responses final envelope, 429, offered-schema tool/loading/once behavior, Responses tool arguments, image/video/music downstream, APIMart/MiMo speech, cross-origin redirect header oracle, stalled-body abort. These are Node/server checks and never replace actual native UI screenshots/AX and persisted server event receipts.
