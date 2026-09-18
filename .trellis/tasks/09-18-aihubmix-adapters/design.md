# Design

## Architecture
Add `src/lib/ai/aihubmix.ts` as an independent provider client. Reuse existing connector configuration, dispatch and Chat Completions transport; extend catalog and type union. Do not reuse APIMart envelope parsers: AIHubMix task responses are top-level objects, not `data` wrappers.

Proposed client operations:
- `listAIHubMixModels(credentials, options)` reads public `/api/v1/models` without a Bearer header and preserves classification metadata.
- `testAIHubMixConnection(credentials, options)` uses authenticated `GET /ai/v1/images?limit=1` (documented task list; never submits). Parse its list envelope; report permission/async-account errors truthfully. This proves access to that read-only endpoint, not all model entitlements.
- `getAIHubMixModelSchema(credentials, model, kind, options)` reads public `/call/schema/models/{encodedModel}/endpoints`, selects a fixed native POST path and exposes available/missing/invalid status or request failure.
- `submitAIHubMixImageGeneration`, `submitAIHubMixVideoGeneration`, `getAIHubMixImageTask`, `getAIHubMixVideoTask` use the native task protocol.
- `downloadAIHubMixResult(credentials, task, output, options)` explicitly retrieves protected content as Blob; inline Base64 may be exposed to callers without eager decoding. No media repository writes.

Names are implementation suggestions; retain the existing `{ok: true, ...} | {ok: false, kind, message, ...}` pattern, injectable fetch and AbortSignal.

## URLs and credentials
Keep configured base URL ending in `/v1` so existing chat transport works. Derive a provider root by stripping only the terminal `/v1` and retaining any proxy prefix. Validate absolute HTTP(S), no userinfo/query/fragment, and reject unsupported base-path shapes clearly. Build only fixed routes below that root. Do not hardcode official host for custom configured providers or read credentials from anywhere except the passed connector.

Public catalog/schema requests carry no key. Authenticated requests use Bearer and `redirect: error`. Result reads validate configured origin AND the expected provider-root image/video content path and task id before attaching credentials. Reject credential-bearing, cross-origin, mismatched-task and unexpected download paths. Never execute returned schema endpoints or follow provider URLs indiscriminately. No automatic redirects/failover/retries.

## Discovery and chat policy
Public model directory returns all matching rows without pagination and does not prove key permissions. Do not use the Manage Key CLI endpoint. Preserve `types`, `endpoints`, `input_modalities`, `output_modalities`, `schema_checked`; normalize comma-separated tokens and documented old type aliases (`t2t`, `t2i`, `t2v`, `reranking`).

Suggested chat set: known `llm` with text output or unspecified output, and Chat Completions support or unspecified endpoints. Explicitly non-Chat-Completions endpoint sets are incompatible with current transport. Known non-LLM/media-only types or output-only media are incompatible. Models with mixed image/text generation output should be excluded from current text-only chat. Image/video INPUT alone is never disqualifying. Ambiguous/missing metadata is manual-only after successful catalog parsing. Duplicate conflicts resolve conservatively. Unknown provider aliases cannot be guaranteed to target text models; preserve existing manual escape hatch without name heuristics.

Generalize the APIMart-specific policy switch to the two providers. Both discovery and send-time validation use the same classification. Keep connector identity/revision checks and pre-mutation validation already in AgentChatPage. Existing APIMart rules and generic/DeepSeek behavior remain unchanged.

## Media data flow
Image: POST root `/ai/v1/images/generations`; preserve boolean `async` when provided (omitted means provider synchronous default). Video: POST root `/ai/v1/videos`; integer `duration`, native references and `extra`. Do not translate legacy `seconds` or inject a model-specific field table. Validate generic JSON and obvious required fields; rely on provider for model-specific parameter constraints, with optional schema introspection.

Read image/video details at `/ai/v1/images/{id}` or `/ai/v1/videos/{id}`. Do not poll unified `/ai/v1/tasks/{id}` snapshots. Normalize pending=>queued, in_progress=>running, completed/failed/cancelled distinctly, others=>unknown while preserving original status. Keep id, kind, model, indexed outputs (content URL and/or Base64), nullable timestamps/expiry, and sanitized provider error. Query 200 with failed task is a successful task read containing failed state. Top-level HTTP errors are request failures. Completed with no usable output is a protocol failure. Preserve remote identity in meaningful errors when available; never resubmit to compensate.

Content URLs require credentials; output descriptors explicitly carry that fact. Explicit binary retrieval is stateless and optional. A local abort does not cancel the remote task. No polling, downloads, job records or slot changes happen as an automatic side effect of submit/query.

## Compatibility and limitations
No schema migration or dependencies expected. Provider catalog is public, thus not a promise of per-key entitlements. Async media needs activation in AIHubMix console. Read-only preflight currently allows local origin on main API paths, but authenticated real browser behavior is still unverified. Schema endpoint returned no CORS header in the observed unauthenticated response; surface lookup failure and defer a proxy solution. Preserve current bundle-size warning without unrelated restructuring.
