# R3 native acceptance — 2026-10-10

The main session exercised the ordinary visible UI in the Codex in-app Chromium at `http://127.0.0.1:5173`. This reviewer checked the saved screenshots, loopback request log and ordinary project-export JSON. The observations below distinguish local transport fixtures from the separately authorized real MiMo request. This document records evidence; it does not archive the task or replace the final integrated quality gate.

Project: `10-10 存量清理验收 · 音频`, `prj_b2594f6c-5988-4acb-bdea-186e95766ab1`; chapter `ach_42fd3cb6-0d84-4abe-b7f4-d033ca1b50f7`. Preparation is recorded in [the native browser preparation note](../../09-22-audio-arrangement-experience/acceptance/2026-10-10-browser-preparation.md). Its earlier statement that vendor generation was unperformed describes that earlier preparation stage; the real-provider result below occurred later.

## Evidence map

| Observed behavior | Evidence and interpretation |
| --- | --- |
| One review covers the original eleven frozen items | [Confirmation screenshot](local-batch-confirmation.jpg) shows eleven items, at most eleven paid requests and concurrency two, with text/voice/connection details. The provider connection in this test is the local loopback fixture. |
| Partial progress survives an interrupted execution | [Partial-progress screenshot](local-batch-partial.jpg) shows nine saved, one failed and one awaiting resolution, with an interruption notice and no automatic send. `audioProject.json` in the normal local export resolves these to nine `saved`, one `failed`, one `uncertain` job. |
| Failed-only retry is a separate reviewed draft | [First retry screenshot](local-batch-after-retry.jpg) and JSON metadata in `local-batch-after-retry.zip` preserve the failed original job and show the new one-item retry job as `uncertain` after the second HMR interruption. This screenshot is not evidence of a successful retry. |
| Stable ordinary one-item generation succeeds | `audioProject.json` in `local-stable-success.zip` contains settled batch `audiobatch_53967d87-903f-4999-83bf-4a8cda523fa6`, saved job `agj_7ec62232-5209-46f6-a486-bb8fcb76e2fc`, and take `atk_9206104c-a347-499c-9dee-85b578b84852`, duration 1.25 seconds. |
| Stable failed-only retry succeeds after a fresh whole-batch confirmation | The final local-artifacts backup contains settled retry batch `audiobatch_be416680-76a9-48bc-ae15-ea7c195292e7`, saved job `agj_b2965346-a30b-4925-b3c8-41f9b1e1a590`, and take `atk_179712c4-1ee8-43e4-960d-ef310dfdb681`. These are the fourth request's separate output, not a rewrite of the original failed or uncertain jobs. |
| First-nine saved outputs remain intact | Complete saved job and take records for original items 1–9 are equal between `local-batch-after-retry.zip`, `local-stable-success.zip` and the final local-artifacts backup. No media Blob was read for this comparison. |
| Real MiMo generation requires an explicit UI confirmation | [Real-provider confirmation screenshot](2026-10-10-live-mimo-confirmation.jpg) shows one item, the frozen text, model, preset settings, connector and `https://api.xiaomimimo.com/v1` before the confirm-and-start action. |
| Real MiMo output is saved and playback starts | [Saved-output screenshot](2026-10-10-live-mimo-saved.jpg), final backup JSON and the main session's native media-element observation agree on the saved take and actual duration. The observation establishes playback startup, not a subjective listening verdict. |

## Exact loopback request accounting

The [local-only fixture](local-provider-fixture.mjs) serves the ordinary speech adapter at `http://127.0.0.1:5181/v1`; it does not contact MiMo. It returns the synthetic 1.25-second WAV fixture, rejects the first request for the tenth manuscript line with HTTP 400, and holds the first request for the eleventh line. Its [request log](local-provider-requests.jsonl) records fourteen `received` events in total and maximum active concurrency **2**.

All eleven manuscript lines have exactly one initial POST, starting at `2026-10-10T06:52:19.395Z`. Items 1–9 save successfully. Item 10 ends in a definite HTTP 400 provider rejection. Item 11 has one held request, interrupted by the main session's recorded development HMR reload, and remains `uncertain`. The original batch is `audiobatch_685bb8b9-0237-4a9e-aa6e-1744e5240152`; its stored outcomes remain nine saved, one failed and one uncertain after the later tests.

The tenth manuscript line has **four POSTs across the complete local acceptance sequence**:

| Attempt | Received at UTC | Explicit operation and result |
| --- | --- | --- |
| 1 | `06:52:21.019` | Initial eleven-item batch. Definite HTTP 400 rejection; no output saved. |
| 2 | `06:53:48.244` | Explicit failed-only retry in a new one-item draft, then a new whole-batch confirmation. HMR interrupted the connection; the log closes it at `06:53:48.367`, approximately 0.123 seconds after receipt, before the fixture's 0.250-second response delay. Persisted job `agj_a60daa9f-3575-4f59-9702-a0bb27c83eb6` is `uncertain`, with no result. |
| 3 | `06:56:43.933` | With HMR disabled, an ordinary new one-item batch receives its own explicit confirmation and saves the 1.25-second output. This verifies the stable adapter/dispatcher path. |
| 4 | `06:57:19.170` | With HMR disabled, failed-only retry of the original definite failure creates another new draft, followed by another whole-batch confirmation. It saves successfully. The uncertain attempt 2 is not automatically replayed. |

Items 1–9 and item 11 each remain at one POST in this log. The main session reloaded and used recovery controls without increasing those counts. Every later `received` entry belongs to an explicitly confirmed operation for item 10. Therefore this trace supports no automatic resubmission on reload/recovery; it does **not** support a claim of one POST for each text throughout its lifetime. The two interruption outcomes are retained, not recategorized as successes.

Request-log SHA-256: `d9ac3150662ae6f2c22afa25c0e9a359a32e5f78c54c3b2378d9019239b5a69f`. Fixture-source SHA-256: `e3d963b209d49a818fde9c940ffd59f226190d0554ef76c524f403463b02fa3e`.

## Authorized real MiMo path

The main session used the real Agent-prepared draft in conversation `cth_893162dc-39b9-467b-9b00-b416d69267c7`, then explicitly confirmed generation in the native review dialog. The text is `验收完成，感谢聆听。`, segment `asg_148110dd-bff3-48c7-a717-883d045eea74` at revision 2. Review details show `mimo-v2.5-tts`, `mimo_default`, speed 1, preset mode and empty delivery instruction, preserving the saved text.

The resulting metadata connects:

- Batch: `audiobatch_2c99a52b-1cd1-45f2-b95a-4442300502c4`, title `第12段批量配音草稿`, settled.
- Item: `audioitem_24eeb1d9-08e2-4a3a-881d-518b2457bb4d`, linked to the actual job.
- Job: `agj_d136ec1c-77bc-4991-b8a0-67410a94a405`, saved, real MiMo connector `https://api.xiaomimimo.com/v1`.
- Take: `atk_cada7392-8bae-4a2a-a19f-71108213b99e`, `source: "tts"`, exact text snapshot and provenance referencing that job/model.
- Media: `med_d8f08823-8b2f-4c1f-ace1-c2b6f1575671`, `audio/wav` metadata. Decoded take metadata is **1.92 seconds, 48,000 Hz, mono**.

The main session observed the ordinary player at `currentTime = 0.042667`, `readyState = 4`, `error = null` after starting playback. The screenshot shows the player active and one saved version. This establishes successful saved-output decoding and playback startup. No claim is made about full listening, pronunciation, timbre, acoustic quality or suitability, and saving did not automatically select or place the new take.

The normal export deliberately scrubs Agent ownership/preparation IDs, confirmation and snapshot connector/fingerprint into dormant history (`owner.kind: "manual"`, empty `confirmedItemIds`, `fingerprint: "historical"`). Those exported values do not negate the UI approval, but they also cannot independently prove the original owned Agent run/call chain. Agent preparation is evidenced by the native main-session flow and confirmation screenshot; exported output identity is evidenced by the JSON linkage above. No origin IDs were reconstructed or invented from the export.

## Local backup and reproducible metadata proof

The final normal backup remains outside the repository at `/Users/xiaomengdao/.codex/local-artifacts/aifenjing/2026-10-10/live-audio-final.zip`, file size 2,706,886 bytes. Its manifest says `aifenjing-project-v1`, project `10-10 存量清理验收 · 音频`, exported at `2026-10-10T07:19:44.351Z`.

Only JSON entries were read; no recording, generated-audio or other media Blob entry was opened, hashed, copied or added to the repository. SHA-256 of the exact uncompressed metadata entries:

| ZIP entry | SHA-256 |
| --- | --- |
| `manifest.json` | `0b984fe8c51e58a3d32e8d860dafd87a41e5d88dfee0a868c749050490068181` |
| `audioProject.json` | `d823741751c3192ce5ad68e006a351b0ee59816e512f08b87779d13e89825fef` |
| `mediaMetadata.json` | `20a303180333212bd21a1d4e0b618d63be1a460e5e4abaf844b14cf88286fdf6` |

The real-provider confirmation screenshot hashes to `54a1b69770c11d2553b56deff0b82ddf405439653ff511c0a967f044aa407e39`; the saved-output screenshot hashes to `8e6c6f5a93e863d5d148ef4b073a99093deaae104e1bdd22d252bdcf5e6a3d75`.

## Scope and limitations

This native trace covers the eleven-item review, concurrency two, mixed saved/definite-failure/uncertain progress, refresh/recovery without automatic POST, explicit new-draft retry and one real MiMo saved/playback path. HMR interrupted two local requests and was disabled for the stable success checks; this is recorded environmental interference, not evidence of normal-production request loss. Native eleven-item coverage does not itself prove every 1–20 boundary, absent-Web-Locks rejection, all pause/Stop races, every connector or clone-reference behavior; those remain backed by the implementation regression evidence in [independent review](../validation/2026-10-10-independent-review.md) and the main session's integrated gates. This document creates no subjective acoustic acceptance and performs no commit or archive.
