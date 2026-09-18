# Design — APIMart adapter foundation

## Boundaries and affected files

Extend `src/domain/types.ts` and `src/lib/ai/catalog.ts` with the definition and capabilities. Add an APIMart client under `src/lib/ai/`. Update `ConnectorsPage.tsx` for provider-specific probe/discovery and accurate descriptions, and Agent model discovery for category-aware filtering. Preserve existing compatible chat transport, slot structures, Dexie version and ZIP format. Add provider contract tests and update connector documentation/specs.

## API contracts

Base URL ends in `/v1`; append fixed routes only:
- `GET /models?expand=category` for discovery/probe.
- `GET /models?expand=parameters&category=image|video` for parameter metadata; single-model schema lookup may also be exposed.
- `POST /uploads/images` using FormData and Bearer auth; fetch supplies the multipart boundary.
- `POST /images/generations` and `POST /videos/generations` using model-native request bodies.
- `GET /tasks/{encodedTaskId}?language=zh` for one status query.

Export typed image/video requests with required model, common optional fields and JSON-compatible provider extension fields. Do not conflate model-specific parameter names or hardcode a model allowlist. Schemas are metadata for consumers, not executable endpoints: never send auth to arbitrary URLs supplied by metadata. Server validation is authoritative.

Decode untrusted JSON from `unknown` with explicit narrowing. Submit success uses `{code:200,data:[{status,task_id}]}` and requires non-empty task IDs; query success uses a `data` object. Normalize image/video URL collections without losing multiple outputs or expiry. Preserve unknown statuses as unknown. Malformed payloads are protocol errors.

Use discriminated results consistent with current AI clients, useful HTTP/provider error details and redacted Chinese display messages. Inject fetch and AbortSignal. Do not retry generation submission after network/timeout ambiguity; a paid task may already exist. No timers or persistence in this layer, and fetch abort does not cancel the provider task.

## Integration and compatibility

APIMart uses existing OpenAI-compatible chat transport plus image/video capabilities defined separately from protocol. Dispatch probes/discovery by connector definition. APIMart chat picker uses category metadata, retains manual model entry and treats metadata gaps explicitly; other providers keep current behavior. Keys remain in connector storage only. No media fetch, job storage or slot mutations are introduced.

## Risks and deferred work

Approved follow-up: retain a provider-scoped known-incompatible model set alongside chat suggestions, and apply one compatibility policy to suggested/manual/saved options plus the send boundary. A saved incompatible model is displayed as a warning, without deleting history. Discovery loading/failure must not silently erase known restrictions or bypass validation; validate metadata for the actual connector/model before any message mutation. Unknown custom IDs remain manually allowed after successful discovery. Keep original-provider behavior and use metadata rather than model-name guessing. No generation UI is introduced.

- Upload documentation rejects base64 generation input while some model pages describe it. Use upload + URL as the supported path.
- Model schema is best-effort; presence in the catalog does not promise support for every special operation or cross-field combination.
- Public docs do not prove CORS behavior for every API/media host. Live browser validation remains separate from fixture tests.
- Result URLs expire; future runtime must persist job IDs and archive selected results promptly.
- Local video/audio upload and provider cancellation contracts are unverified and excluded.

## Rollback

No data migration. Revert catalog/client/UI changes without deleting saved user keys. Preserve fallback display of unknown connector definitions. Project data and ZIP format remain unaffected.
