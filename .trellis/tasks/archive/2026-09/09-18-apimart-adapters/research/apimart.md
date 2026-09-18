# APIMart research — 2026-09-18

## Official sources inspected

- https://docs.apimart.ai/llms.txt
- https://docs.apimart.ai/_llms/en/api-manual.md
- https://docs.apimart.ai/en/api-reference/texts/models/list.md
- https://docs.apimart.ai/en/api-reference/uploads/images.md
- https://docs.apimart.ai/en/api-reference/tasks/status.md
- https://docs.apimart.ai/en/api-reference/images/gemini-3.1-flash/generation.md
- https://docs.apimart.ai/en/api-reference/images/gpt-image-1/generation.md
- https://docs.apimart.ai/en/api-reference/videos/seedance-2-0/generation.md
- https://docs.apimart.ai/en/api-reference/videos/sora-2/generation.md
- https://docs.apimart.ai/en/api-reference/account/token-balance.md

## Findings

- Base URL `https://api.apimart.ai/v1`, Bearer auth.
- Model metadata supports `expand=category|parameters`, category filtering, capability tags and optional draft-2020-12 JSON Schema. Catalog visibility depends on key/group; unknown category and missing schema are legitimate.
- Generic generation paths are `/images/generations` and `/videos/generations`. Both return `code` and a `data` array of submitted task IDs.
- Query `/tasks/{task_id}` returns a data object with pending/processing/completed/failed/cancelled status, progress, costs, result images/videos and error. Image example uses `result.images[].url` arrays and Unix-second `expires_at`.
- Upload `/uploads/images`: multipart `file`, root-level `url`, `filename`, `content_type`, `bytes`, `created_at`. JPEG/PNG/WebP/GIF, 20 MB max, URL valid 72 hours; models can impose stricter reference limits.
- Upload guide rejects base64 generation input, but Nano Banana 2 still lists it. Upload guide's final workflow also conflicts with dedicated submit/query envelopes. Prefer upload + public URL and dedicated generation/task pages.
- Seedance 2.0 uses `size`, `generate_audio`, and optional `image_with_roles`; Sora 2 uses `aspect_ratio`. Do not coerce native fields. Seedance first/last-frame mode excludes video/audio references. Duration limits differ between sections of its page; avoid inventing a harmonized constraint.
- `/balance` is read-only with documented CORS but a different success envelope. Model discovery suffices for the proposed probe; balance UI is unnecessary.

## Repository fit and verification limits

Existing `listModels` discards metadata and generic probing can fall back to chat POST; APIMart needs specialized discovery/read-only probing. Local media are Dexie Blobs; upload client should accept Blob/File independently of database ownership. Slots have one selected result, so multi-result selection and job runtime belong to later UI work.

Only public documentation was accessed. No credentials were read, no paid tasks submitted, and live browser CORS remains unverified.
