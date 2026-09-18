# Executable generation profiles

Verified 2026-09-19 against official public documentation and unauthenticated native schemas. No credential or paid endpoint was used for research.

## APIMart
- GPT Image 2 standard: https://docs.apimart.ai/en/api-reference/images/gpt-image-2/generation
- MiniMax H3: https://docs.apimart.ai/en/api-reference/videos/minimax-h3/generation
- Existing upload adapter: `/v1/uploads/images`; selected result query `/v1/tasks/{id}?language=zh`.
- Reuse the existing ratio/resolution profiles. Image n=1, at most15 reference images. H3 integer4–15 seconds, 768P/2K, six ratios; frames follow input ratio, references may use adaptive. Explicit `image_with_roles` maps first-frame→first_frame, last-frame→last_frame, reference-image→reference_image. No role inference from array length.
- H3 image limits: 256–5760px per dimension, width/height0.4–2.5, model file limit30MB. Our upload adapter is narrower:20MiB JPEG/PNG/WebP/GIF. Runtime supports their intersection JPEG/PNG/WebP,20MiB and verifies image dimensions before upload. H3 allows HEIC/HEIF but the existing upload adapter does not; do not advertise these.
- Local APIMart reference-video is explicitly rejected before upload/submission because no verified local video upload adapter exists. Text/first+last-frame/reference-image video modes work.
- Task URLs are public result URLs; downloads omit cookies/Authorization and reject redirects. Signed result URLs remain ephemeral and do not enter durable job or tool results.

## AIHubMix
- Native image documentation: https://docs.aihubmix.com/cn/api/aihubmix-image-generation.md
- Native video documentation: https://docs.aihubmix.com/cn/api/aihubmix-video-generation.md
- GPT Image2 native model schema: https://aihubmix.com/call/schema/models/gpt-image-2/endpoints
- Veo3.1 Fast native model schema: https://aihubmix.com/call/schema/models/veo-3.1-fast-generate-preview/endpoints
- Each schema was retrieved as JSON and the native POST endpoint selected by path, not array position. Runtime does not dynamically execute schema-supplied endpoints or treat discovery as authentication.
- GPT Image2 schema1.2: native `/ai/v1/images/generations`; prompt, n1–10, async boolean, output png/jpeg, quality low/medium/high under `extra`. Image refs strings/URL objects accept data URI, up to16. Editing size enum auto/1024x1024/1536x1024/1024x1536; runtime deliberately supports this common subset for all image requests, n1, PNG, async=true. Do not map APIMart's ratio `size` or 1k/2k/4k resolution into this endpoint.
- Veo3.1 Fast schema1.4: native `/ai/v1/videos`; duration4/6/8, aspect16:9/9:16, resolution720p/1080p/4K. Above720p requires8sec. Reference-image input requires8sec, max3; reference-video max1 requires8sec/720p. First/last-frame inputs use `frame_images[{frame_type,image_url:{url}}]`; reference media use `input_references[{type,url}]`. Last frame requires first frame. Runtime separates frames/references rather than assuming unsupported mixed modes.
- Inline media body limit32MiB, including base64 expansion/text. Runtime uses safe headroom and rejects oversized requests locally. Account must enable async tasks; a403 is surfaced, never silently retried synchronously.
- Query native media task endpoints, not unified snapshots. Protected content goes through existing origin/path/task-scoped downloader; no credential forwarding to public/foreign URLs. Base64 returned directly is decoded locally. Only one expected output is accepted and bytes are checked for recognized image/video signatures before saving.

## Boundaries
Durable job state separates submitting/unknown/known remote work/downloading/downloaded/applied/conflict/failed. Local submission idempotency is call-ID backed, with equivalent unresolved requests also blocked. Unknown acceptance is never retried. Unexpected multiple task IDs remain unknown with all received IDs for manual reconciliation. Models absent from these verified profiles fail explicitly, without paid fallback. This is a verified subset of each connector's generic adapter capability.

Input byte revisions are SHA-256; target revision uses the existing deterministic revision helper. Default tool flow waits within a bounded controller (max40 checks, backoff to15s), independently of the model's step budget, and parks with an explicit recoverable pending error. Closing the browser does not run background polling or cancel paid tasks. Network/storage failures keep known identity for explicit continuation.
