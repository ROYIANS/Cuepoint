# AIHubMix connector and media adapters

## Goal
Add AIHubMix as a first-class provider so users can configure one connection for existing text chat and future image/video generation. Continue the foundation-only scope established for APIMart; generation UI comes later.

## Background and evidence
- APIMart integration and chat compatibility guard shipped in `e908475` (187 tests, lint and build passed).
- Existing chat transport uses OpenAI-compatible `/v1/chat/completions`; connector credentials are studio-global and excluded from project exports.
- AIHubMix has public model metadata, native image/video tasks, and authenticated result downloads. See `research/aihubmix.md` for verified sources and read-only observations.

## Requirements
- R1: Add `aihubmix` to catalog/domain/provider presentation, with chat/image/video capabilities and default Base URL `https://aihubmix.com/v1`. Reuse connector CRUD and local key persistence without database migration.
- R2: Separate public model discovery from authenticated connection testing. Discover types, output modalities, supported protocols and schema availability. A successful public directory response must never claim the key is valid. Connection testing performs only a documented authenticated GET, without generation or chat fallback.
- R3: Extend existing connector-scoped chat selection and send guard to AIHubMix. Recommend documented text chat models; block known non-chat models and models explicitly incompatible with Chat Completions across suggestions, manual entry and saved selections. Do not infer generation from image input support. Unknown/custom aliases remain manual-only after successful metadata discovery. Preserve draft/history on metadata errors, rejection, abort or changed selection. Use provider-neutral warning copy.
- R4: Provide a typed, abortable native media client for image submit (explicit synchronous/asynchronous choice), video submit, separate image/video detail queries and optional per-model request-schema lookup. Preserve native input parameters, image/mask references, video reference/frame roles, and `extra`. Query schemas by endpoint path, never array position. Schema lookup failure is explicit and does not silently mean an empty valid schema; it must not block unrelated chat.
- R5: Normalize task status, task identity, multiple indexed outputs, Base64 outputs, authenticated content URLs, nullable expiry/timestamps and provider errors. Provide explicit result retrieval to Blob using same-provider authenticated routes, with no automatic download or persistence. Do not treat content URLs as public preview URLs.
- R6: Distinguish validation, HTTP/provider, malformed protocol, network and abort failures. Redact keys. Never retry generation automatically or switch endpoints/domains after ambiguous submission. Missing/unknown states are not completion. Query identity/object must match the requested task kind/id.
- R7: Document installation, read-only test semantics, async-account prerequisite, browser CORS limits and deferred entrypoints; cover integration and malformed/provider failure boundaries with meaningful tests.

## Acceptance criteria
1. AIHubMix installs/edits/deletes through the existing connector page, persists across reload and its key never appears in project ZIPs (R1).
2. Public discovery supports known metadata and explicit unknowns; empty/error/malformed responses cannot falsely validate a key; connection test issues only authenticated GET requests (R2).
3. A normal text/chat model is selectable; known image/video/audio/embedding/rerank or incompatible-protocol models cannot be reinserted through saved/manual selections. Vision input on a text model is allowed. Unknown aliases can be manually selected only after a successful catalog load. Rejected sends perform no thread/message writes or chat POST (R3).
4. Request tests verify native paths and exact payload preservation, image async true/false, video duration/reference fields and schema selection. Defaults do not force a paid submission or schema fetch (R4).
5. Tests cover pending/in-progress/completed/failed/cancelled/unknown tasks, all output items, Base64, protected Blob retrieval, expired/not-ready results, task id/type mismatch and empty completed output. Arbitrary remote URLs/redirects never receive a key (R5–R6).
6. Existing APIMart and generic provider behaviors remain covered; lint, tests, build and diff whitespace checks pass. Connector UI gets a browser smoke test where feasible. Real authenticated/paid behavior remains explicitly unverified without a live authorized test (R7).

## Out of scope
Generation pages or chat image rendering, material/shot slot wiring, automatic polling/job scheduler, task persistence or recovery UI, webhook server, uploads/hosting service, backend proxy, pricing/billing UI, Responses/Anthropic/Gemini chat transports, automatic alternate-domain failover, and a shared multi-provider generation abstraction.

## Planning status
PRD convergence pass complete. No unresolved product questions beyond approval of this final scope. The user approved the final plan on 2026-09-18; implementation is in progress.
