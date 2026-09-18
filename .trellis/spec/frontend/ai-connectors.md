# AI connector and generation boundaries

## Complete Model Bank snapshot
`vendor/lobehub/model-bank` is the full unmodified upstream package, with its root
license and a per-file SHA-256 manifest. Never hand-edit upstream data. The full
runtime model dataset and a compact limit index are derived outside that directory.
`loadModelBank` lazily returns every raw provider/model record, including prices and
media schemas. `getModelBankEntry` selects exact provider+ID before original-vendor
fallback; conflicting fallback limits stay unknown. No guessed aliases or invented
records. `resolveModelMetadata` overlays valid live provider limits per field and
returns source provenance. Copied date is not independent factual verification.
Model data does not authorize new gateway wire parameters; transport policy remains
in reasoningPolicy. Manual `model-bank:sync` copies from a trusted local checkout;
`model-bank:verify` checks every source hash and re-derives exact outputs. No scheduled
sync. Upstream tests remain unmodified vendor source, excluded from our Vitest roots.

## 1. Scope / Trigger

Read before changing provider discovery/probes or adding consumers of the APIMart/AIHubMix image/video clients. Catalog capabilities are separate from chat wire protocol. Keys belong to the existing studio-global Dexie connector table and never to project ZIPs.

## 2. Signatures

Provider dispatch in `src/lib/ai/connectors.ts`:

```ts
listConnectorModels(connector, usage: "all" | "chat", fetchImpl?)
testConnectorConnection(connector, fetchImpl?)
discoverConnectorChatModels(connector, options?)
runWithCompatibleChatModel(connector, model, action, options?)
```

`src/lib/ai/chatModelPolicy.ts` owns connector-scoped compatibility, warning copy and the shared `buildChatModelOptions` filter. `runWithCompatibleChatModel` invokes the mutation/transport action only after compatibility succeeds; abort or a changed selection prevents action execution.

Provider client in `src/lib/ai/apimart.ts`:

```ts
listApimartModels(credentials, query?, options?)
testApimartConnection(credentials, options?)
uploadApimartImage(credentials, file: Blob, options?)
submitApimartImageGeneration(credentials, input, options?)
submitApimartVideoGeneration(credentials, input, options?)
getApimartTask(credentials, taskId, options?)
// credentials: {baseUrl, apiKey}; options: {signal?, fetchImpl?}
```

## 3. Contracts

- `baseUrl` includes `/v1`. Only fixed relative routes are executed; metadata endpoint/schema URLs are never followed with credentials.
- APIMart probes are read-only model queries, including when the key only permits media models.
- Discovery preserves category/capability tags and exposes parameter schema availability. Only `category === "chat"` populates automatic chat suggestions; unknown categories remain available through manual entry. Connection-page discovery retains all categories.
- Chat compatibility applies to every selection source: discovered suggestions, manual search and the current/saved model. Known `image`, `video` and `audio` categories cannot be reinserted by manual input. Use provider metadata rather than guessing from model names. A saved incompatible selection warns the user without changing historical messages.
- The send boundary checks the actual connector/model before creating a thread, appending messages, clearing the draft or calling chat transport. APIMart/AIHubMix metadata lookup failure cannot authorize an unchecked send; show the error and preserve the draft. Unknown custom models remain manually usable after successful discovery. Connector switching must not reuse another connector's classifications.
- Submit responses use a `data` array with task IDs. Query responses use a `data` object. Never copy the conflicting final upload-guide example instead of dedicated generation/query contracts.
- Model-native fields (`size` vs `aspect_ratio`, audio flags, frame roles) survive unchanged. Server validation handles model-specific restrictions.
- Upload uses FormData without manually setting Content-Type; supported types are JPEG/PNG/WebP/GIF, up to 20 MB. Provider URLs are temporary, not durable media IDs.
- These adapters do not poll, persist jobs, automatically download results or mutate slots. AIHubMix offers an explicit protected Blob download. Multiple results and expiry must remain available to future callers.
- Requests are abortable; local abort does not cancel the remote task. Never automatically retry generation submissions after timeout or ambiguous network failure.

## 4. Validation & Error Matrix

| Condition | Required outcome |
| --- | --- |
| Missing credentials / invalid upload | Validation error without network traffic |
| APIMart model probe fails | Surface failure; never fall back to a POST |
| HTTP failure / provider error in HTTP 200 | Explicit failure, with credentials redacted |
| Invalid JSON/envelope or missing submitted task IDs | Protocol error, not empty success |
| Missing/unknown category or invalid parameter metadata | Preserve explicit metadata status; no name-based category guessing |
| Known media model entered manually or stored on a thread | Exclude from selectable chat options; warn and reject send without message writes or chat POST |
| APIMart metadata loading/failure during send | Finish validation or show error; never infer compatibility from an empty list |
| Unknown custom model after successful discovery | Allow manual chat selection/send |
| Unknown task state | Preserve provider state and normalize to unknown, never completed |
| Abort | Distinct aborted result; no claim of provider cancellation |

## 5. Good/Base/Bad Cases

- Good: connection page can discover a video-only key while chat suggestions remain empty.
- Base: existing OpenAI-compatible/DeepSeek discovery and fallback behavior stays unchanged.
- Bad: submit retries create multiple paid tasks after a lost response.
- Bad: an expiring result URL is stored as if it were permanent local media.

## 6. Tests Required

`tests/apimart.test.ts` owns provider envelope, upload, task-state and error contracts. `tests/connectors.test.ts` covers provider dispatch, filtering, read-only probes and configuration persistence. `tests/projectPackage.test.ts` checks key exclusion for each provider. Assert HTTP paths/bodies and call counts, not only parser output.

Chat-policy regression coverage must exercise manual-search and saved-selection reinsertion, metadata scope/loading/failure, unknown custom models, and the send gate with a downstream operation spy proving rejection causes no side effects.

## 7. Wrong vs Correct

```ts
// Wrong: provider model names alone include image/video models in chat.
await listModels(apimartConnector);

// Correct: the provider-aware layer filters documented categories.
await listConnectorModels(apimartConnector, "chat");
```

```ts
// Wrong: re-submit generation when a network response is lost.
// Correct: return the ambiguous failure to the caller without retrying.
// A future job runtime must reconcile provider identity before another submission.
```


## AIHubMix contracts

### 1. Scope / Trigger
Use for AIHubMix discovery, credential tests, native media requests and protected content reads. The approved task adds a provider client, not a generation runtime or UI.

### 2. Signatures
`src/lib/ai/aihubmix.ts`: `listAIHubMixModels`, `testAIHubMixConnection`, `getAIHubMixModelSchema`, `submitAIHubMixImageGeneration`, `submitAIHubMixVideoGeneration`, `getAIHubMixImageTask`, `getAIHubMixVideoTask`, `downloadAIHubMixResult`. Requests accept passed credentials plus optional `signal`/`fetchImpl`; explicit downloads return Blob without repository mutation. Provider dispatch returns `via: "authenticated-read"` for a successful AIHubMix connection probe.

### 3. Contracts
- Chat Base URL ends in `/v1`. Media/catalog/schema routes derive from the same configured root, preserving proxy prefixes. Reject credentials/query/fragment in base URLs and unsupported path shapes. No hardcoded-host fallback.
- `/api/v1/models` is public; never send the key or claim discovery authenticates it. `/v1/models` was also readable without a key. Test access via authenticated `GET /ai/v1/images?limit=1`; never a POST or public-directory fallback.
- Metadata tokens: `types`, `endpoints`, `input_modalities`, `output_modalities`; missing annotations differ from explicit incompatibility. `t2t/t2i/t2v/reranking` map to documented current types. Preserve duplicates for conservative conflict resolution.
- Suggest known text LLMs supporting Chat Completions or with unannotated protocols. Known non-chat types, media outputs and explicitly incompatible protocol sets block all selection sources and send. Image/video INPUT alone never blocks chat. Unknown/malformed metadata is manual-only after successful directory lookup; no name guessing.
- Schema lookup is optional public data. Select native POST endpoint by path, never first array element; surface missing/invalid metadata and network/CORS failure distinctly. Do not execute returned routes.
- Native image submit `/ai/v1/images/generations` defaults synchronous; preserve explicit boolean `async`. Native video `/ai/v1/videos` is always async, with numeric `duration` and native reference structures. Do not translate legacy `seconds`.
- Task reads use `/ai/v1/images/{id}` or `/ai/v1/videos/{id}`; unified `/ai/v1/tasks/{id}` is only a snapshot. Top-level task object has id/object/model/status/output/error/timestamps. Validate id/kind, preserve original status, map unknown states to unknown, preserve all indexed outputs and nullable Unix-second expiry.
- Protected content is not a public preview URL. Explicit binary reads verify origin AND exact configured-root task content route before Bearer auth. Reject redirects/cross-origin/task mismatch. Base64 is retained without automatic persistence.
- Task failure in HTTP 200 is a valid task read containing failed state. Request failure and failed remote task are distinct. Redact key-bearing provider errors, never retry generation, and never describe local abort as remote cancellation.

### 4. Validation & Error Matrix
| Input/result | Required behavior |
| --- | --- |
| Public model directory success | Metadata only; does not authenticate key |
| Authenticated probe rejected | Explicit error, no fallback POST |
| Vision input + text output | Eligible text model if protocol compatible |
| Known media or incompatible protocol, manual/saved | Exclude and block before all chat mutations |
| Metadata unavailable / changed connector | Unverified; preserve draft and history |
| Failed task in HTTP 200 | Return failed task and sanitized error |
| Completed task without usable output | Protocol failure |
| Unknown task state | Preserve provider state, never completed |
| Protected content foreign URL / wrong task / redirect | Do not forward key |
| Schema CORS / unavailable endpoint | Explicit failure/missing status; no fake schema |

### 5. Good/Base/Bad Cases
Good: a metadata-only catalog can load while testing an invalid key still fails. Base: APIMart categories and generic provider probe fallback remain unchanged. Bad: embed a protected result URL as a public image, or resend a paid POST after losing the response.

### 6. Tests Required
`tests/aihubmix.test.ts`: fixed paths, auth separation, native payloads, schema path selection, task states/identity/output/expiry, malformed envelopes, abort/redaction/no retry, protected Blob retrieval and path/origin rejection. `tests/connectors.test.ts` and `tests/chatModelPolicy.test.ts`: provider dispatch, text vs media classification, unknown/manual and saved selection behavior, stale catalog, aborted/switched sends with no downstream writes, and persistence. ZIP export covers all providers.

### 7. Wrong vs Correct
Wrong: use successful public model discovery as proof that the configured API key is valid.
Correct: expose public discovery separately and test the authenticated task-list GET, describing that permission precisely.

Wrong: pass `content_url` directly to `<img>` or fetch any provider-returned URL with a Bearer header.
Correct: call the explicit guarded content reader, then let the future media runtime persist or display the Blob.
