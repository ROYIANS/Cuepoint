# APIMart GPT Image 2.5 — verified request contracts

Fetched 2026-09-20 from APIMart docs. Not a substitute for `generationProfiles.ts`.

## Standard 2.5 — `POST /v1/images/generations`

Source: https://docs.apimart.ai/cn/api-reference/images/gpt-image-2.5/generation

- Models: `gpt-image-2.5-flare`, `gpt-image-2.5-sunburst` (not aliases of `gpt-image-2`).
- Same async envelope as current Image 2: `{ code: 200, data: [{ status, task_id }] }`.
- `size`: `auto` or the 15 ratios already in `IMAGE_RATIOS`. Exact pixels are out of product scope.
- `resolution`: `1k` | `2k` | `4k` (lowercase). Ignored only for exact-pixel size, which we do not send.
- `quality`: `low` | `medium` | `high` | `xhigh` | `max` | `auto`. Product default is `auto`. Docs: `auto` pre-authorizes `max` then settles actual tokens. `xhigh`/`max` on `gpt-image-2` return 400 with no downgrade.
- `n`: 1–4. Product keeps `1`.
- `image_urls`: max 16. Product uploads via existing `/v1/uploads/images` then passes URLs.

## Ext — same path, different profile

Source: https://docs.apimart.ai/cn/api-reference/images/gpt-image-2.5-ext/generation

- `model` is always `gpt-image-2.5-ext`. Variant is `version`: `flare` (default) | `sunburst`.
- `size`: `auto` plus 10 ratios: `1:1`, `16:9`, `9:16`, `4:3`, `3:4`, `3:2`, `2:3`, `5:4`, `4:5`, `21:9`. Not `2:1`, `1:2`, `3:1`, `1:3`, `9:21`.
- `resolution`: `1K` | `2K` | `4K` (uppercase). Store lowercase in UI/drafts; map at `profileRequest`.
- No `quality` field in Ext docs. Do not send it.
- Recommended headers: `X-APIMart-Response-Version: 2026-07-27`, `Idempotency-Key`. Use the stable local job id as the idempotency key so a true retry of the same job does not mint a second paid task. Attach these headers only for Ext submits.
- Success examples include both `{ code: 200, data: [{ task_id }] }` and `{ code: 202, data: { id, poll_url, status } }`. Task query remains `GET /v1/tasks/{id}` and existing image URL extraction.

## Shared product constraints

- Do not send `background`, `output_format`, `output_compression`, `moderation`, or exact-pixel `size`.
- Polling, download, and apply stay on the existing generation runtime.
- Image 2 profile is unchanged: no `quality`, max 15 references, lowercase resolution.
