# Research: Models.dev migration (replace LobeHub model-bank)

- **Query**: Evaluate migrating Cuepoint model metadata from vendored LobeHub model-bank to Models.dev
- **Scope**: mixed (external measured via curl on 2026-10-13; internal via repo reads)
- **Date**: 2026-10-13

Legend: [MEASURED] = observed directly this session with curl/npm registry/tarball; [INFERRED] = my deduction.
(Note: no WebFetch tool was available; I used curl against the live endpoints and downloaded files only under /tmp, not the repo.)

## 1. Models.dev measured facts

### 1.1 Endpoints [MEASURED]

| URL (`?type=all`) | Size | Top-level shape |
|---|---|---|
| `/api.json?type=all` | 5.62 MB (5,618,558 B) raw; default (no param) 5.60 MB | `{ [providerId]: Provider }`, 228 providers, 8,820 provider-model rows |
| `/models.json?type=all` | 469 KB | `{ ["lab/model-id"]: ModelMetadata }`, 550 canonical models (provider-agnostic) |
| `/catalog.json?type=all` | 6.09 MB | `{ providers: <same as api.json>, models: <same as models.json> }` |

Response headers (all three): HTTP/2 200, `content-type: application/json`, `access-control-allow-origin: *`, `cache-control: public, max-age=0, must-revalidate`, `etag` present (so conditional GET / If-None-Match is possible), served via Cloudflare (cf-cache-status HIT). No content-encoding shown in the -D dump of curl without --compressed (sizes above are uncompressed transfer as curl requested no gzip; Cloudflare normally compresses for browsers - [INFERRED], not measured).

### 1.2 `?type=all` meaning [MEASURED + SDK typing]
- Rows carry optional `type` field: counts in `type=all` api.json: absent 8,775 / `decision` 39 / `embedding` 4 / `reranking` 2.
- Default response (no param) has 8,781 rows = 8,820 - 39. So the default omits ONLY `type: "decision"` models here; embedding/reranking rows are present in default too (in this snapshot). `type=all` adds the 39 `decision` rows.
- SDK doc comment (`RequestOptions.modelTypes`): "Specialized model types to include. Omit for standard models; use "all" for the complete catalog." i.e. default = "standard models" (chat/LLM); specialized types are opt-in; `modelTypes` can be "all" or an array of `ModelType`. [INFERRED: in other snapshots image/embedding/etc. might also be omitted by default; only `decision` was seen omitted today.]
- models.json `type` appears on 9 of 550 canonical records.

### 1.3 Provider object (api.json) [MEASURED]
Keys: `id`, `env[]` (API-key env names), `npm` (AI SDK package, e.g. `@ai-sdk/openai`), `name`, `doc`, `api` (base URL, present on 203/228 providers; absent for first-party SDK providers such as openai/anthropic), `models` (map keyed by provider-local model id).
Example: `openai` -> npm `@ai-sdk/openai`, 53 models; `openrouter.api = https://openrouter.ai/api/v1`; `deepseek.api = https://api.deepseek.com`.

### 1.4 Model object fields (api.json rows; counts out of 8,820) [MEASURED]
Always present: `id`, `name`, `description` (new, short text), `attachment`, `reasoning` (bool), `tool_call` (bool), `release_date`, `last_updated` (YYYY-MM-DD), `modalities {input[], output[]}`, `open_weights`, `limit {context, output, input?}`.
Optional: `cost` 8,365 (USD per 1M tokens: `input`, `output`, `cache_read`, `cache_write`?, `reasoning`?, `tiers[]` {input,output,cache_read,tier:{type:"context",size}}, `context_over_200k`), `temperature` 8,280, `family` 8,079, `reasoning_options` 6,483 (e.g. `[{type:"effort", values:["none","low","medium","high","xhigh"]}]`), `structured_output` 6,230, `canonical_model_id` 5,926 (link to models.json key, e.g. `anthropic/claude-haiku-4-5`), `knowledge` 4,612 (YYYY-MM-DD), `interleaved` 1,347, `provider` 399 (per-model override of npm/api/body), `status` 362 (`deprecated` 284 / `beta` 77 / `alpha` 1), `experimental` 101 (e.g. `modes.fast` with cost+provider body), `type` 45.
Modalities values seen: `text`, `image`, `pdf` (also audio/video in other rows; [INFERRED] from spec, not enumerated).
Real sample (openai/gpt-5.4): context 1,050,000; input 922,000; output 128,000; modalities in text/image/pdf; reasoning true; tool_call true; cost input 2.5 / output 15 / cache_read 0.25; `reasoning_options` effort none..xhigh; knowledge 2025-08-31; release 2026-03-05.

### 1.5 models.json (canonical) fields [MEASURED]
Keys (550 records): id, name, description, attachment, reasoning, tool_call, release_date, last_updated, modalities, open_weights, limit (all 550); temperature 530, family 491, knowledge 277, structured_output 257, `weights` 197, `benchmarks` 160, `license` 82, `links` 27, `type` 9. NO `cost`, NO `reasoning_options` (price/effort are provider-specific). `limit` still present.
Sample: `anthropic/claude-haiku-4-5` limit context 200,000 / output 64,000; includes `benchmarks[]` (SWE-Bench Pro etc.).

### 1.6 ID naming vs provider [MEASURED]
- api.json: model key = provider-local id (`openai` -> `gpt-5.4`; `anthropic` -> `claude-haiku-4-5`; `openrouter` -> `sao10k/l3-lunaris-8b`; `deepseek` -> `deepseek-v4-pro`, `deepseek-flash`...). Same model id may appear under many providers with different limits/prices.
- models.json / catalog.models: key = `<lab>/<model>` (`openai/gpt-5.4`, `anthropic/claude-sonnet-4-5`); api.json rows link via `canonical_model_id` (65% of rows have it).
- Provider ids are Models.dev's own (228), not LobeHub's (85).

### 1.7 Logos [MEASURED]
`https://models.dev/logos/openai.svg` -> HTTP 200; `https://models.dev/logos/labs/anthropic.svg` -> HTTP 200, image/svg+xml.

### 1.8 `@opencode-ai/models` (npm registry + tarball) [MEASURED]
- Latest 0.0.103 (published 2026-10-13T05:40Z); 103 versions since first publish 2026-07-03 (~daily automated releases: 0.0.100..103 on Oct 10, 11, 12, 13). 0.0.x versioning, i.e. no semver stability promise. [INFERRED]
- License MIT. `type: "module"` (ESM only), `sideEffects: false`, types shipped (`dist/*.d.ts`).
- exports: `.` (client: `Models.make({baseUrl, fetch, headers})` -> `providers()`, `models()`, `catalog()`; options `modelTypes`, `signal`; errors `ModelsDevError` reason Transport|UnexpectedStatus|MalformedResponse; no caching, stateless), `./snapshot` (default `{providers, models}` + named `providers`, `models`, `generatedAt`), `./effect` (needs optional peer `effect@4.0.0-beta.83`).
- No runtime `dependencies`. Optional peer effect (only for ./effect).
- Size: tarball 635 KB gzip; unpacked 6.9 MB; `dist/snapshot.js` alone 6.85 MB (one `JSON.parse("<escaped json>")` string, annotated `/* @__PURE__ */`, tree-shakable by entrypoint). Snapshot README: "at most ~24h behind the live API".
- Is the snapshot `type=all` or default? Not verified (6.85 MB JS-escaped vs 5.6 MB raw JSON +models 0.47 MB is consistent with both). Check before relying on `decision`/other types.
- Repo: github.com/anomalyco/models.dev, packages/sdk. Data in repo is TOML (per task brief; not re-verified here).

## 2. Current-state mapping (LobeHub model-bank usage)

### 2.1 Files and data layout
| File | Role |
|---|---|
| `scripts/model-bank-snapshot.mjs` | `verify` / `generate` / `sync <local lobehub checkout>`; transpiles TS data modules from `vendor/lobehub/model-bank/src/aiModels/*.ts` in a node:vm sandbox; writes the two JSON files; verifies per-file SHA-256 against `vendor/lobehub/manifest.json` (197 files) |
| `vendor/lobehub/` (2.1 MB; `model-bank/`, `LICENSE`, `manifest.json`, `README.md`) | Unmodified upstream snapshot (copiedAt 2026-09-19, rev ebe5862...) |
| `src/lib/ai/modelBank/lookup.generated.json` (193 KB) | `{sources, providers:{[provider]:[{id, contextWindowTokens?, maxOutput?}]}}` - 85 providers, 1,855 models; eagerly imported |
| `src/lib/ai/modelBank/models.generated.json` (1.78 MB) | Complete raw records per provider; lazy `import()` only |
| `src/lib/ai/modelBank/index.ts` | `getModelBankEntry`, `getModelBankVision`, `loadModelBank`, `MODEL_BANK_COPIED_AT` |
| `src/lib/ai/modelBank/README.md`, `.trellis/spec/frontend/ai-connectors.md` (section "Complete Model Bank snapshot"), `agent-context.md:35`, `agent-references.md:60`, `agent-tools.md:99`, `desktop-ui.md:88` | Specs that describe the contract |

LobeHub raw fields present (counts of 1,855 rows): displayName, id, type (chat 1630/image 114/video 88/embedding 12/realtime 5/tts 3/asr 3), description 1750, contextWindowTokens 1620, family 1587, pricing 1400, abilities 1300, generation 1279, maxOutput 902, releasedAt 788, knowledgeCutoff 601, enabled 600, settings 513, organization 227, parameters 202, config 93, maxDimension 12. `abilities` keys: functionCall 1044, reasoning 763, vision 633, search 287, structuredOutput 156, video 110, audio 30, imageOutput 19, files 16.

### 2.2 Consumers and fields actually read
| Consumer | Calls | LobeHub fields read | Semantics / matching |
|---|---|---|---|
| `modelBank/index.ts#getModelBankEntry(model, providerId?)` | lookup.generated.json | `id`, `contextWindowTokens`, `maxOutput` (+ `sources[provider]` path + manifest repo/revision for `sourceUrl`) | `model.trim()`, exact case-sensitive id. (1) if providerId given and that provider has the id -> use it. (2) else gather same-id rows across ALL providers; if any come from the `originalVendors` allowlist (openai, anthropic, google, deepseek, qwen, moonshot, minimax, xai, meta, mistral, cohere, ai21, baichuan, hunyuan, internlm, jina, longcat, sensenova, spark, stepfun, wenxin, xiaomimimo, zeroone, zhipu, bfl) keep only those; (3) if candidates' context+maxOutput disagree -> `undefined`. No alias/prefix/case folding ("never infer from string prefixes"). Miss -> `undefined`. |
| `modelBank/index.ts#getModelBankVision` | models.generated.json (lazy) | `abilities.vision === true` | Same selection as above; each candidate must have an `abilities` object, otherwise `undefined`; any disagreement -> `undefined`. Returns `{supported, source:"model-bank", sourceUrl}`. |
| `modelMetadata.ts#resolveModelMetadata` | `getModelBankEntry` | contextWindow, maxOutputTokens (+ sourceUrl, `MODEL_BANK_COPIED_AT`) | Per field: valid positive-integer provider-supplied value wins (`source:"provider"`), else bank value (`source:"model-bank"`, sourceUrl, copiedAt), else undefined. Note: LobeHub `maxOutput` is used as `maxOutputTokens`. |
| `reasoningPolicy.ts#getReasoningPolicy` | `getModelBankEntry(id, connector.definitionId)?.contextWindow` | contextWindow only | The effort levels come from the app's own hand-written `WIRE_POLICIES` allowlist (gpt-5, gpt-5-2025-08-07, gpt-5.1, gpt-5.2, gpt-5.6-luna, o3), gated by connector definitionId (`openai-compatible` full, `aihubmix` minus `max`, others undefined). LobeHub abilities.reasoning is NOT read. Models.dev `reasoning_options[]` (effort values) is a candidate source but is not equivalent to wire-allowlist semantics. |
| `visionCapability.ts#resolveVisionCapability` | `getModelBankVision` | abilities.vision | Order: provider-reported `metadata.vision` (source "provider") > model-bank > `{supported:false, source:"unknown"}`. `requireVision` throws different messages for unknown vs unsupported. Callers: `db/agentRuns.ts:71`, `lib/agent/imageQueue.ts:27`, `lib/ai/referenceWire.ts:33`, `db/agentContextPreview.ts` (`readAgentContextPreview`, async, resolved BEFORE the Dexie read transaction), `components/agent/ModelSelectTrigger.tsx:33`. |
| `lib/agent/contextPolicy.ts#resolveContextCapacity` | `resolveModelMetadata` | contextWindow | `capacitySource` label "Model Bank" shown in UI (hard-coded string) |
| `src/domain/referenceInput.ts` | type only | `AgentVisionCapability.source: "provider" \| "model-bank" \| "unknown"` + `sourceUrl?` | Type literal `"model-bank"` persisted in run/audit records (stored via `run.visionCapability`) - renaming affects stored data compatibility ([INFERRED] from `run.visionCapability ?? ...` use in imageQueue/referenceWire). |
| `ModelSelectTrigger.tsx` | `resolveModelMetadata`, `resolveVisionCapability` | context window, vision | Tool/reasoning chips use name heuristics `inferModelHints` in `lib/ai/modelVendors.ts` (regex on model id, e.g. `/gpt-5|claude|gemini.../` for vision) - NOT model-bank. Vendor/icon grouping uses `lookupVendor` (name based). |
| `ModelSettingsMenu.tsx`, `useChatSelection.ts` | `getReasoningPolicy` | (indirect) | UI effort picker. |

Provider id used for matching = app `ConnectorDefinitionId` (`src/domain/types.ts:522`): `openai-compatible | deepseek | apimart | aihubmix | mimo`. Direct hits in LobeHub provider ids only for `aihubmix` and `deepseek`; `openai-compatible`, `apimart`, `mimo` have no same-named LobeHub provider (mimo's LobeHub id would be `xiaomimimo`), so they fall through to the cross-provider exact-id + originalVendors path. In Models.dev provider ids: `aihubmix` and `deepseek` exist (and `xiaomi`, `xiaomi-token-plan-*`); no `apimart` or `openai-compatible`.

Pricing, releasedAt, displayName, description, knowledgeCutoff, family, abilities.functionCall/reasoning/search etc., `generation`/`parameters`/`settings` (media generation schemas) are exposed only through `loadModelBank()`; no non-test source consumer was found (grep of `src/` shows only `getModelBankVision` using `loadModelBank`). [MEASURED by grep; icons/mapping excluded.]

### 2.3 Miss behavior
- Limits unknown -> `contextWindow`/`maxOutputTokens` undefined -> `resolveContextCapacity` returns capacity undefined (no source label); no fallback guessing.
- Vision unknown -> `{supported:false, source:"unknown"}`; sending images is blocked with "尚未确认当前模型支持图片输入..." (tests/agentReferences.test.ts:60-62 assert this).
- Conflicting gateway data -> treated as unknown.

### 2.4 Field mapping LobeHub -> Models.dev
| Concept | LobeHub field | Models.dev field (api.json row / models.json) | Notes |
|---|---|---|---|
| model id | `id` | `id` (provider-local key); canonical `lab/model` in models.json via `canonical_model_id` | Models.dev ids differ per provider (`openai/gpt-5.6-luna` on gateways; `openai.gpt-5.6-luna` on Bedrock; `gpt-5-6-luna` on neon) |
| display name | `displayName` | `name` | |
| context | `contextWindowTokens` | `limit.context` | numbers differ in places: deepseek-v4-* LobeHub 1,048,576 vs Models.dev 1,000,000; aihubmix gemini-2.5-pro LobeHub 1,114,112 vs 1,048,576 |
| max output | `maxOutput` | `limit.output` | differs: claude-sonnet-4-6 LobeHub 64,000 vs Models.dev 128,000; gpt-3.5-turbo LobeHub (none) vs 4,096; Models.dev may include `output: 0` for non-chat |
| input cap | (none) | `limit.input` (optional) | new; Models.dev context = total window, `input` = max prompt (gpt-5.4: 1,050,000 / 922,000) |
| vision | `abilities.vision` | `modalities.input` includes `"image"` (and `attachment` flag = file attachments) | Measured agreement for openai (36/36), anthropic (11/11), aihubmix (20/20) rows where both exist. Semantics: Models.dev `attachment` is not the same as image input - use `modalities.input` |
| function call | `abilities.functionCall` | `tool_call` | |
| reasoning | `abilities.reasoning` | `reasoning` (+ `reasoning_options[]` for effort levels; `interleaved`) | |
| structured output | `abilities.structuredOutput` | `structured_output` | |
| audio/video/file/imageOutput | `abilities.audio/video/files/imageOutput` | `modalities.input/output` entries (`audio`, `video`, `pdf`, `image` in output) | |
| web search | `abilities.search` | none found in field list | no equivalent |
| pricing | `pricing` (units array, strategy tiered/fixed, upTo) | `cost` {input, output, cache_read, cache_write, reasoning, tiers[], context_over_200k}; USD per 1M tokens | different structure; only text token pricing; no per-image/video units seen in field list |
| release | `releasedAt` | `release_date` / `last_updated` (YYYY-MM-DD) | |
| knowledge | `knowledgeCutoff` | `knowledge` | present on only 4,612/8,820 rows |
| type | `type` chat/image/video/embedding/tts/asr/realtime | `type` (rare: decision/embedding/reranking) + `modalities.output`; absence = standard LLM | no explicit image/video/tts/asr type value observed; derive from modalities |
| organization | `organization` | `family`, and the `lab/` prefix of canonical id; logos at `/logos/labs/{lab}.svg` | |
| provider attribution | key of provider map (85) | provider key (228) with `npm`, `api`, `env`, `doc` | Models.dev provider ids differ (e.g. `qwen`, `zhipu`, `moonshot` absent as keys; coverage below) |
| enabled / settings / config / parameters / generation / maxDimension | media generation parameter schemas | none | cannot map (no consumer in src/ besides tests) |
| sourceUrl | manifest.repository + revision + path | no per-model file path in JSON; GitHub TOML path `providers/<id>/models/<model>.toml` [INFERRED from task brief that data is TOML in GitHub - not verified] | |

### 2.5 Coverage measurements (LobeHub 85 providers vs Models.dev 228) [MEASURED]
- Same-provider id exact hits (LobeHub provider id also exists in Models.dev): openai 42/62; anthropic 11/11; google 23/29; deepseek 3/3; aihubmix 21/60; openrouter 28/36. For `qwen`, `zhipu`, `moonshot` LobeHub provider ids do not exist as Models.dev provider ids (0 hits by same key) - provider-id crosswalk would be needed; this crosswalk also drives the originalVendors allowlist logic.
- Of aihubmix 21 same-id rows: 15 identical limits, 6 differ. Of openai 42: 39 same, 3 differ (embedding/legacy ids). deepseek: all 3 differ (1,048,576 vs 1,000,000). anthropic: 10 same, 1 differ.
- Models used by tests: `gpt-6-astra` exists under Models.dev `openai` and `aihubmix` with image input; `gpt-5.6-luna` exists under `openai` (context 1,050,000, output 128,000, reasoning_options effort none..max) - but `chatgpt` provider (272,000 context in LobeHub) has no Models.dev counterpart by that id; `gpt-5-2025-08-07` not in Models.dev `openai`.

## 3. Constraints

### 3.1 Desktop (Tauri) HTTP policy: would a runtime fetch of models.dev be rejected? [MEASURED from code]
- `src/lib/runtimeFetch.ts:222-250`: in native runtime every http(s) fetch goes `authorize` (`authorizeRuntimeHttp`) -> `authorize_http_origin` Tauri command (adds a runtime-scoped `http:default` capability for exactly that origin, `desktop/tauri/src-tauri/src/runtime_services.rs:107-135`, max 128 origins, canonical origin only) -> `@tauri-apps/plugin-http` fetch.
- `src/lib/runtimeHttpPolicy.ts:11-23, 27-44`: allowed origins = origins of rows in `db.connectors` + `https://api.tavily.com` (only when Tavily enabled with key). Purposes: `configured` (default) requires `origins.has(url.origin)` else throws "网络请求地址不属于当前连接配置，请在连接页检查设置"; `result-download` (GET, no auth headers; http requires configured origin; https to any host allowed); `search-probe` (only api.tavily.com).
- Therefore: a runtime `fetch("https://models.dev/...")` through `runtimeFetchFor("configured")` is REJECTED unless the user configured a connector with origin https://models.dev (not the case). `result-download` purpose would technically allow an HTTPS GET without credentials to any host (it is meant for generated-asset URLs), but using it for catalog data would be a semantic reuse of that purpose. Plain `window.fetch` in the Tauri webview is blocked by CSP: `connect-src ipc: http://ipc.localhost 'self'` (`desktop/tauri/src-tauri/tauri.conf.json:14`). A new purpose (e.g. "catalog") plus policy + Rust-side handling would be needed for native refresh. [INFERRED: the exact set of places to change; not implemented].
- Static/offline use needs none of this (data bundled in the app).

### 3.2 Browser runtime CORS [MEASURED]
`curl -sI` on api.json / models.json / catalog.json: `access-control-allow-origin: *` (also confirmed with an `Origin: http://localhost:5173` request header). No credentials flow needed. `etag` is returned and `cache-control: public, max-age=0, must-revalidate`, so revalidation by If-None-Match is supported by the server (ETag header present; 304 behavior not tested). Web build has no CSP found in repo (`index.html`/vite config grep: only the Tauri conf contains `connect-src`); the Docker/GHCR deployment may add one outside the repo - not checked.
- The SDK `Models.make({fetch})` accepts an injected fetch, so `runtimeFetchFor(...)` could be passed in (SDK doc: "proxies, polyfills, test doubles") - fact from SDK types.

### 3.3 Payload size [MEASURED]
api.json 5.6 MB; models.json 0.47 MB; catalog.json 6.1 MB (sizes before any HTTP compression; gzip/br ratio not measured). Compact projection needed by this app today (provider id, model id, context, output, vision, tools, reasoning, cost) would be far smaller than the raw file - the existing lookup index is 193 KB for 1,855 models; Models.dev has 8,820 rows across 228 providers (~4.7x rows) -> a comparable limits-only index is plausibly ~0.9 MB raw [INFERRED estimate, not built]. SDK snapshot module is 6.85 MB JS (one JSON.parse string) - importing it eagerly in the app bundle would add ~6.9 MB; must be a lazy chunk, or projected at build time.

### 3.4 Offline / local-first / BYOK
- Repo spec stance: lookup tables are bundled so UI is synchronous (`lookup.generated.json` eager) and vision resolution is async-lazy (`models.generated.json`). Local-first and no scheduled sync ("No scheduled sync", ai-connectors.md). Current behavior never calls a third party for model facts; the only non-connector origin ever allowed is Tavily (opt-in).
- Trade-offs (facts + inference):
  | Mode | Facts | Pros | Cons |
  |---|---|---|---|
  | Build-time snapshot only (SDK `/snapshot` or fetch+project at build) | SDK snapshot <= ~24h behind; npm releases ~daily (0.0.x) | Offline, deterministic, no policy changes, reproducible tests | Stale between app releases; needs scripted refresh; 0.0.x semver, snapshot is 6.85 MB source unless projected |
  | Runtime fetch only | CORS ok on web; blocked on native without policy change | Always fresh | Fails offline; 5.6 MB per fetch unless ETag; native ACL/CSP change; trust issue |
  | Hybrid: bundled baseline + optional runtime refresh cached locally | SDK README itself recommends `client.providers().catch(() => snapshot)` | Offline-safe, fresh when allowed | Most code: cache store, schema validation, two storage backends, policy plumbing, UI to explain source/age |

### 3.5 Cache / storage options for refreshed data
- Two runtimes: browser Dexie/IndexedDB vs native SQLite behind adapter `ProductStore` (`.trellis/spec/frontend/shared-product-storage.md`: "an adapter boundary: browser IndexedDB and the complete native SQLite/files"; "SQLite startup failure is visible and does not construct an IndexedDB catalog"; native facts must not be mirrored to Dexie). Connectors/keys live in studio-global Dexie `connectors` table (`ai-connectors.md:1` section 1). A cache of the model catalog would be studio-global derived data, not project data; a new table in both runtimes (schema + Rust SQLite migration + parity tests: spec lists native acceptance suites in `tests/fixtures/shared-storage/nativeAcceptanceSuites.json`) is the heavy path. Lighter alternatives (not in spec, [INFERRED]): browser Cache API/localStorage only for web; Tauri app-data JSON file for native.
- `readAgentContextPreview` deliberately resolves model-bank vision BEFORE its IndexedDB read transaction ("External model-bank preparation finishes before the final coherent IndexedDB read", `agentContextPreview.ts:118`); a runtime cache lookup must keep that ordering (do not await network inside the Dexie transaction).

### 3.6 Integrity and security (remote data is untrusted) [facts + inference]
- Models.dev data is community-maintained TOML -> JSON; no signature in HTTP response. npm tarball has registry signatures and attestations (`dist.signatures`, `attestations` present in registry metadata) [MEASURED]; the existing LobeHub flow pins file SHA-256 in manifest and a verify step.
- Existing app patterns to reuse (specs): `lib/ai/requestBoundary.ts` (`readHttpJson` with actual-byte caps, abort, redirect rejection) and `parseModelMetadata`-style validation (`positiveInteger`, safe integers, `Object.create(null)` for prototype keys; tests for `__proto__`, `constructor`).
- Data quality observations in live data [MEASURED]: rows with `status: deprecated/beta/alpha` (362); `limit.output: 0` exists (e.g. vercel `openai/gpt-6-luna-decisions` output 0); gateway rows with differing limits for the same model (`claude-opus-4-6` context 200,000 on `frogbot` vs 1,000,000 elsewhere; `gpt-5.6-luna` 1,000,000 on abacus/venice/opper vs 1,050,000 elsewhere) -> the existing "conflicting gateway = unknown" rule would trigger frequently with 228 providers.

## 4. Impact surface

### 4.1 Tests tied to LobeHub behavior (grep) 
| Test | Dependency |
|---|---|
| `tests/modelBank.test.ts` (70 lines) | imports `verifySnapshot`, `deriveDataset` from `scripts/model-bank-snapshot.mjs`; asserts manifest 197 files, 85 providers, 1,855 models, generated files byte-equal; `gpt-5.6-luna` openai 1,050,000 / chatgpt 272,000 / apimart 1,050,000 (apimart falls back via originalVendors), copiedAt "2026-09-19", revision hash substring in sourceUrl, pricing tier `upTo: 272000`, `gpt-image-2` parameters, type set chat/image/video/embedding/tts/asr/realtime; `gpt-5-2025-08-07` -> undefined; `claude-opus-4-6` anthropic |
| `tests/modelMetadata.test.ts`, `tests/reasoningPolicy.test.ts` (124 lines), `tests/aihubmixVisionMetadata.test.ts` (101) | `resolveModelMetadata`, `getReasoningPolicy` (contextWindow field), vision via bank |
| `tests/agentReferences.test.ts:60-62` | `resolveVisionCapability("gpt-6-astra","openai-compatible")` -> `{supported:true, source:"model-bank"}`; unknown id -> `unknown` |
| `tests/d07RequestWire.test.ts`, `responsesStream.test.ts`, `materialReferenceWire.test.ts`, `sharedRegisteredToolSuccess.test.ts`, `imageDiscovery.test.ts` | reference modelBank/visionCapability/reasoningPolicy indirectly (grep hits) |
| `tests/fixtures/sourceSnapshots/d07/src/lib/ai/{visionCapability,modelMetadata}.ts`, `d05/.../imageQueue.ts` | frozen source snapshot fixtures (copies of old source used as evidence; likely untouched) |
| `tests/fixtures/shared-storage/nativeAcceptanceSuites.json` | grep hit for reasoningPolicy/model-bank names (suite lists) - not inspected in detail |
| `tests/e06-icon-entries.test.ts`, `tests/icons.test.ts` | icon mapping from `@lobehub/icons`, not model-bank |

### 4.2 CI / scripts
- `package.json:9-11`: `model-bank:compare`, `model-bank:verify` (both `verify`), `model-bank:sync`.
- `.github/workflows/ghcr.yml:44-45`: step "Verify model snapshot" runs `pnpm model-bank:verify` after `pnpm test`.
- `knip.json:5`: `"scripts/model-bank-snapshot.mjs!"` listed as entry.
- `.trellis/spec/frontend/desktop-ui.md:88`: full frontend gate lists "model-bank verification".
- `scripts/quality/*` and `scripts/quality-check.mjs`: no model-bank reference found by grep.
- No scheduled sync workflow exists.

### 4.3 Repo weight
`vendor/lobehub` 2.1 MB (model-bank 2.1 MB source, 197 files); generated JSON 193 KB + 1.78 MB. Models.dev projection options unknown size (see 3.3).

### 4.4 `@lobehub/*` dependencies
`package.json` lists only `@lobehub/fluent-emoji`, `@lobehub/icons`, `@lobehub/ui` (lines 25-27). There is NO `@lobehub/model-bank` npm dependency: the model-bank part is purely the vendored folder + scripts. Removing the data part = delete `vendor/lobehub/`, `scripts/model-bank-snapshot.mjs`, generated JSON, `model-bank:*` scripts, CI step, knip entry, spec text, `tests/modelBank.test.ts`'s snapshot cases; no package removal. `@lobehub/icons`/`ui` are unaffected.
- Icons: `src/components/agent/ModelIconMapping.generated.ts` is generated by `scripts/e06-icon-data.mjs` from `@lobehub/icons@5.18.0` (modelMappings keyword -> brand icon; version pinned with render-contract hashes). It is independent of model-bank data and keyed by model-name keywords, not by model-bank provider ids. Models.dev logos (`/logos/{provider}.svg`, `/logos/labs/{lab}.svg`, both HTTP 200) are remote SVG URLs; the Tauri CSP `img-src 'self' blob: data:` would block remote images in native; they are keyed by Models.dev provider/lab ids. So the logo feature does not replace the current icon mapping without a download/bundle step. [measurements: URLs 200; CSP from conf; replacement effort is inference]

## 5. Candidate approaches (ranked by value / cost / risk)

### Option A - Build-time projection from the SDK snapshot (offline, no runtime network) [lowest risk]
- What: add `@opencode-ai/models` as a devDependency (MIT, ESM, typed); a script (replacing `model-bank-snapshot.mjs`) imports `@opencode-ai/models/snapshot`, projects only needed fields (provider id, model id, `limit.context/output/input`, `modalities.input`, `reasoning`, `tool_call`, optionally `cost`, `release_date`, `knowledge`, `name`, `canonical_model_id`) to `src/lib/ai/modelCatalog/*.generated.json`, records `generatedAt` + package version + integrity (replacing the manifest/vendor tree); `verify` re-derives from the pinned package version in the lockfile. Consumers keep the same API (`getModelBankEntry`, `getModelBankVision`).
- Value: facts updated by bumping a version (daily upstream), 4.7x more models/providers, optional price/knowledge/input-limit fields; deletes 2.1 MB vendor tree.
- Cost: moderate - crosswalk of connector ids (aihubmix, deepseek, mimo->xiaomi, apimart, openai-compatible) and `originalVendors` list to Models.dev provider/lab ids; rewrite `tests/modelBank.test.ts` expectations (counts, hashes, `chatgpt` 272,000, pricing tier shape); update specs and CI step.
- Risks: numeric differences vs today (deepseek 1,000,000 vs 1,048,576; claude-sonnet-4-6 output 128,000 vs 64,000); "conflicting gateways = unknown" rule triggers more with 228 providers; 0.0.x versioning; `sourceUrl` provenance changes.
- Decisions needed from user: keep LobeHub as fallback or drop entirely; whether to show prices; accept limit value changes; whether to keep the "never infer aliases" rule when Models.dev's canonical ids (`canonical_model_id`, `lab/model`) offer official aliasing; which Models.dev provider id represents `openai-compatible`/`apimart` (no same-named provider exists).

### Option B - Option A baseline + optional runtime refresh (hybrid)
- What: A plus a user-enabled "refresh model catalog" that fetches `models.dev/api.json?type=all` (or catalog.json) via an injected fetch, validates/projects with the same schema, caches locally (Dexie table + SQLite counterpart, or app-data file on native), and overlays the baseline (provider-supplied limits still win per field).
- Value: freshest data between app releases; follows SDK README's recommended pattern.
- Cost: high - new purpose in `runtimeHttpPolicy` + native `authorize_http_origin`/CSP considerations (currently rejects non-configured origins), storage migration in both runtimes with parity tests, byte-cap + schema validation, UI for status/age/failure, tests for offline/failure/ETag.
- Risks: widening the egress allowlist beyond configured connectors + Tavily (privacy posture of local-first/BYOK), remote data poisoning (needs validation), 5.6 MB transfers, cache coherence with the `readAgentContextPreview` ordering rule.
- Decisions: allow runtime network at all (web only vs also desktop); default on/off; cache TTL; where cache lives; show data source/age in UI (the UI string "Model Bank" and `AgentVisionCapability.source: "model-bank"` would need a new/renamed value).

### Option C - Minimal swap: keep LobeHub, add Models.dev only as supplementary fields (pricing/knowledge) or only logos
- What: leave `vendor/lobehub` and existing flow, derive an additional small `modelsDev.generated.json` for price and `input` limit (or skip data and only evaluate logos).
- Value: lowest; adds price display without touching limits/vision behavior.
- Cost: low; Risks: two sources of truth, conflicting values, doubled maintenance.
- Decisions: whether price display is in scope at all; whether two sources are acceptable.

Ranking (value/cost/risk): A first (best balance; also is the baseline B needs), B second (only if freshness between releases matters and network policy change is acceptable), C last.

## Caveats / Not Found
- WebFetch tool was unavailable; all remote facts came from curl on 2026-10-13. Live data changes daily; counts will drift.
- Models.dev TOML repo layout, field-level schema docs/CONTRIBUTING and `?type=` allowed values other than `all` were not fetched (only SDK types/README and live data inspected). Which `type` values are default-omitted beyond `decision` is not verified (today's diff showed only `decision`, 39 rows).
- Whether the SDK `snapshot` was generated with `type=all` was not verified.
- gzip/brotli transfer sizes not measured.
- `nativeAcceptanceSuites.json` hit and `run.visionCapability` persistence were inferred from grep, not read in detail.
- Probe files are in /tmp/md_probe and /tmp/md_sdk only; nothing downloaded into the repo.
