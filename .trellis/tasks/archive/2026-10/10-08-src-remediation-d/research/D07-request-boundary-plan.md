# D07 / PM-07 — minimal provider request boundary proposal

Date: 2026-10-08. Role: trellis-research; no children. **Proposal only**, based on current local source. D01–D06 remain outside this research and subject to the coordinator's implementation/acceptance sequence. This document does not complete D07/PM-07, change task/ledger/spec status, or authorize implementation now.

The only write in this research is this file. No product/spec/test changes, installs, test execution, commits, archives, live provider calls or external research. Existing concurrent work, including current generation-runtime edits, is preserved. Re-read relevant callers after D01–D06 before implementing this proposal.

## 1. Authoritative requirements and current evidence

Original finding discovered by filename search: `.trellis/tasks/09-30-src-quality-architecture-audit/research/providers-media.md`, **exact section `### PM-07 — P2 / structural-debt：请求基础边界被复制并发生策略漂移`**. It names APIMart, APIMart audio, AIHubMix, MiMo, generic OpenAI-compatible and Tavily, and asks for small shared guards/readers with explicit policies; it explicitly excludes a Provider factory, generic generation service and complexity-driven splits. PM-01/02/04/06 concrete fixes must survive; their historic defects are not current-source findings.

Current task `prd.md`, `design.md`, `implement.md` and both context jsonl files were read. Their currently curated implementation/check context is D01; it is not permission to implement D07. Relevant current contract: `.trellis/spec/frontend/ai-connectors.md`, especially provider contracts, B04 generic fallback and C06 inbound reading.

Accepted C06 context is under `.trellis/tasks/archive/2026-10/09-30-src-remediation-c/`: `research/C06-bounded-input-contract.md`, `research/C06-implement-handoff.md`; current `boundedResponse.ts`, `boundedSse.ts`, `safeError.ts`, and neutral `resource/limits.ts` are authoritative for actual mechanics and constants. C06 **explicitly leaves generic image JSON / inline base64 request bodies untouched**. Its ordinary-JSON 4 MiB policy is not authority to cap those successful responses.

Current shared leaves already exist:

- `safeError.ts:2` redacts the full configured key and Bearer token before caller-specific truncation. APIMart uses 300 characters, AIHubMix 500, MiMo provider detail 300 / network detail 200; generic HTTP detail is 200 / failure 300. Tavily additionally handles URL-encoded keys and rejects key-bearing result URLs.
- `boundedResponse.ts:8` owns `isReadAbort`; bytes/text/JSON/Blob readers enforce actual bytes, cancel and release locks. `readErrorText` keeps observed HTTP failures authoritative except AbortError. Do not duplicate these implementations.
- `boundedSse.ts:72` owns physical event parsing, fatal UTF-8 and cleanup. Chat/Responses retain their separate output/tool budgets and callback ordering.
- `normalizeBaseUrl` currently belongs to `openaiCompatible.ts:4`, although APIMart/audio/MiMo and other callers need only trimming/trailing-slash removal. There is no separate current base-URL leaf.

The remaining actual duplication is once-only fetch assembly (injected fetch, signal and browser policy), repeated JSON consumption that suppresses non-abort diagnostic read errors only after a non-2xx response, and local copies of abort detection. No schema/result/provider-status decoder is proposed for sharing.

## 2. Smallest proposed owners and interface

Introduce **two small leaves**, retaining existing bounded-reader and redaction owners:

| Owner | Proposed responsibility | Actual consumers |
| --- | --- | --- |
| `src/lib/ai/baseUrl.ts` (new) | Move only `normalizeBaseUrl` unchanged; trim and strip trailing `/` | `openaiCompatible`, `apimart`, `apimartAudio`, `mimoSpeech`, `chatStream`, `responsesStream`; compatibility export serves existing repo/audio-runtime callers |
| `src/lib/ai/requestBoundary.ts` (new) | Execute one injected fetch with required explicit browser policy; consume JSON according to explicit native/bounded policies, distinguishing optional non-2xx diagnostic failures | Transport callers below; JSON helper genuinely shared by APIMart request, APIMart audio error/music reads, AIHubMix request/download diagnostics and generic successful protocol reads |
| `boundedResponse.ts` (existing) | Actual-byte reading, original read/abort errors, cleanup, `ResponseLimitError`, `isReadAbort`, `readErrorText` | Existing consumers plus request boundary; no new reader/limit algorithm |
| `boundedSse.ts` / `safeError.ts` / `resource/limits.ts` (existing) | SSE framing / redaction / neutral numeric budgets | Remain authoritative; no copy into the new boundary |
| Existing adapters | URL/key/route guards; headers/body; timeout controller if any; HTTP/provider error formatting; envelope/schema/task/status/results | Keep all provider-specific exports and durable-runtime relationships |

Concrete interface sketch (design, not an implementation):

```ts
type RequestWire = Omit<RequestInit, "signal" | "credentials" | "redirect">;
type RequestBoundaryOptions = {
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
  credentials: RequestCredentials; // required, no global default
  redirect: RequestRedirect;       // required, no global default
};

function requestOnce(
  url: string,
  init: RequestWire,
  options: RequestBoundaryOptions,
): Promise<Response>;

type JsonReadPolicy =
  | {kind: "native-json"} // Response.json semantics; no finite byte cap
  | {kind: "bounded-json"; maxBytes: number; fatalUtf8: boolean};

type HttpJsonReadPolicy = {
  success: JsonReadPolicy;
  failure: JsonReadPolicy; // diagnostic policy, selected by observed response.ok
};

function readHttpJson(
  response: Response,
  policy: HttpJsonReadPolicy,
  signal?: AbortSignal,
): Promise<unknown>;
```

`requestOnce` performs a pre-fetch signal check at the transport boundary and calls `(fetchImpl ?? fetch)` **once**, forwarding already prepared URL/init and the required policy. It never reads the response body, catches/rewrites transport exceptions, retries, probes, discovers, authenticates automatically, follows metadata URLs, or creates a timeout/controller. Preserve the original thrown fetch exception object so generic probes can distinguish actual GET fetch TypeError. Adapters still perform their own validation/pre-abort result conversion in their existing order, and keep existing post-fetch checks.

`readHttpJson` selects the supplied policy by HTTP success/failure. Bounded mode delegates directly to `readResponseJson`; native mode uses `response.json()` without introducing a cap or changing replacement UTF-8 decoding to fatal. Successful read/parse failures throw the original error. For **non-2xx diagnostic** read/parse failures only, return `undefined` after excluding `isReadAbort(error, signal)`; AbortError/signal cancellation must propagate unchanged. The caller retains the Response and formats its own authoritative status plus optional provider fields. A helper result never claims that HTTP 200 is provider success. Successful bodies stay `unknown` until adapter validation; a returned primitive/null/array is not normalized into an empty successful object.

Signal checks around consumption must not wrap AbortError as a syntax/protocol error. Native mode is deliberately not an actual-byte bounded reader and cannot promise early resource rejection or cancellation of a mock reader that ignores fetch's signal. Retain this limitation rather than inventing an `Infinity` budget or silently rewriting native reads. Blocked-read cleanup tests apply to bounded paths; original reader AbortError applies to both.

**Do not add** a universal failure type, provider registry, callback-based schema/error factory, generic retry/backoff framework, shared generation runtime, credential cache, global timeout, or a fetch+JSON combined call. Fetch and body phases must remain separately awaitable. The helper should be this small even if adapters still exceed old complexity thresholds.

## 3. Explicit adapter policies: preserve current budgets and semantics

The initial extraction is behavior-preserving for browser policy and finite byte limits. `same-origin` / `follow` below make the current generic browser defaults explicit; changing them to media's `omit` / `error` would be separate behavior hardening, not an incidental refactor. In particular, helper-level one attempt means one application fetch invocation; it is not proof of one wire exchange when a legacy generic fetch follows redirects.

| Adapter / operation | URL/key and request policy | Success body policy | Non-2xx diagnostic policy / owner |
| --- | --- | --- | --- |
| APIMart `request` (`apimart.ts:141`) | Trim base/key; reject non-HTTP(S), userinfo, base query/hash; retain fixed `base + path`; `omit` / `error`, caller signal, no new timeout; auth added only locally; JSON Content-Type only for string body | **native-json**, currently no finite byte cap; code 200/202 and error/success-false interpretation remain local; upload uses FormData | **native-json**, currently no finite cap; optional JSON failure preserves `httpStatus`, prefix, code/type; AbortError wins |
| APIMart audio `audioRequest:98`, `jsonEnvelope:136` | Same transport family with its own validation wording; `omit` / `error`; schema is checked before submission; no new timeout | Music JSON **4 MiB**; speech `application/json` body **4 MiB**, otherwise raw audio **32 MiB**; speech retains Blob/MIME processing | JSON **64 KiB**; status retained even if body is unreadable; detail/error wording remains audio-specific |
| AIHubMix `transport:153`, `request:178` | `providerRoot` must preserve proxy prefix and require `/v1`; reject encoded slash/backslash etc.; public catalog/schema omit Bearer, protected paths require key; `omit` / `error`; caller signal, no new timeout | **native-json**, currently no finite cap, including synchronous image `output[].b64_json`; do not impose ordinary JSON/audio ceilings | **native-json**, currently no finite cap; keep `responseFailure` with `httpStatus`, provider fields, redacted `taskId`; failed task object is a successful read |
| AIHubMix `downloadAIHubMixResult:362` | Keep selected output/task/origin/exact content-route checks before Bearer; `omit` / `error` | Content-type JSON diagnostic **4 MiB**; binary image/video **256 MiB**; valid video above 32 MiB remains accepted | JSON **64 KiB**; preserve known HTTP failure even after diagnostic overflow/parse error; provider task/result error handling remains local |
| MiMo `request:61`, `readMimoResponse:39` | `connection` requires HTTP(S) base ending `/v1`, no userinfo/query/hash; `omit` / `error`; caller signal, no new timeout | `/models` text/JSON **4 MiB**; speech envelope **48,933,548 bytes**, then exact padded base64 decoded size **32 MiB** before atob and Blob check | Text **64 KiB** via existing `readErrorText`; keep raw text fallback after JSON parse failure; provider-vs-http formatting remains local |
| Generic `listModels:126`, `testConnection:155` | Preserve existing nonempty trimmed base/key validation, URL construction, authHeaders; explicitly `same-origin` / `follow`; optional caller signal added compatibly; no new timeout | **native-json**, currently no finite cap; `decodeModelDirectory` / `validateChatProbe` remain distinct | Native `response.text()` with current optional-error-body fallback and `formatHttpError`; no finite cap introduced by extraction |
| Tavily `request:36` | Fixed `https://api.tavily.com/{search,extract,usage}`; `omit` / `error`; local controller merges caller abort and existing default **30,000 ms** timeout, active through body reading | JSON **2 MiB**, **nonfatal UTF-8** (`fatal=false`); local result schemas/serialized 31K/60K budgets untouched | No diagnostic-body consumption; existing cancel/status mapping stays in Tavily; no JSON helper or key-bearing response text returned |
| Chat `streamChatCompletions:331` / Responses `streamResponses:137` | Existing materialization, model/protocol/reasoning validation; explicitly `same-origin` / `follow`; handlers signal, no new timeout | Nonstream JSON **4 MiB**; SSE **4 MiB per physical event**, no lifetime cap; retained text/reasoning/tool budget **4 MiB** plus existing field/count/envelope constraints | Text **64 KiB**, existing `readErrorText`; status/redacted finishReason/metrics behavior stays local |
| APIMart public audio CDN `downloadApimartAudio:249` | Safe HTTP(S) URL; no bearer/headers; `omit` / `error` | Blob **32 MiB** | No diagnostic parsing; preserve local HTTP/abort/network wording |

Budget values above come from current source, not supplier documentation. In particular, **native-json is a deliberate explicit policy, not an omitted option**. Do not retrospectively claim C06 bounded APIMart's generic media request or AIHubMix's inline image JSON. Adding even an error-only cap to currently native diagnostic branches may drop existing provider details and therefore is not included silently in this proposal.

No universal base guard: APIMart's source does not require `/v1` suffix at runtime, MiMo does, AIHubMix derives a different root and has stricter encoded-path validation, and generic helpers currently only trim. Keep those predicates local. `safeUrl` for APIMart signed media/output URLs permits query strings; never reuse a strict base-URL predicate there. URL/task-ID dot segments and percent/slash rules remain operation-specific.

## 4. Exact migration sites and external callers

| Proposed internal migration | Existing exports / exact downstream consumers to preserve |
| --- | --- |
| `apimart.ts request` → `requestOnce` and `readHttpJson`; replace local abort predicate with `isReadAbort` | `listApimartModels` → `connectors.ts` discovery/listing; `testApimartConnection` → connector probe; `submitApimartImageGeneration`, `submitApimartVideoGeneration`, `getApimartTask` → `lib/agent/generationRuntime.ts:221,377`; `uploadApimartImage` stays same API/wire (existing regression covers File multipart) |
| `apimartAudio.ts audioRequest` fetch + non-2xx JSON, `jsonEnvelope` success JSON → boundary; `downloadApimartAudio` fetch → once-only transport; abort predicate → existing shared one | `generateApimartSpeech`, `submitApimartMusic`, `getApimartMusicTask`, `downloadApimartAudio` → `audioGeneration/runtime.ts:200–206,236,299,149`; local schemas/types/constants stay exported for `audioGeneration/input/defaults`, Agent audio tools |
| `aihubmix.ts transport` fetch → boundary; `request` native JSON and protected-download JSON diagnostics → `readHttpJson`; abort detection → `isReadAbort` | Catalog/schema/probe exports retain their existing types; connectors uses catalog/probe; generation runtime uses submit at `:247`, task query `:370`, protected download `:338`; `taskResponse` exception and parseTask outputs remain local |
| `mimoSpeech.ts request` fetch → boundary; keep `readMimoResponse` (text fallback), original `readErrorText`, base64/MIME checks | `listMimoModels` → connector discovery/probe; `generateMimoSpeech` → audio runtime; `validateMimoReference` → `audioGeneration/reference.ts`; all MIMO constants and settings contracts unchanged |
| `openaiCompatible.ts` three separate fetch sites (list GET, probe GET, fallback POST) → boundary; successful `readProtocolBody` may delegate native JSON consumption while retaining protocol prefix for non-abort errors | Keep `listModels(input, fetchImpl?)` and `testConnection(input, fetchImpl?)` valid; see signal addition below. Keep `authHeaders`, `modelsUrl`, `chatCompletionsUrl`, `maskApiKey`, types and compatibility normalization export |
| `tavily.ts request` fetch → boundary only, passing `controller.signal`; keep timer/controller lifecycle and HTTP/body result mapping | `executeWebRequest` → `lib/agent/webTools.ts:57`; `testSearchConnection` → `components/studio/SearchConnection.tsx:31`; DB config/revision check stays `executeWebRequest`; no service extraction |
| `chatStream.ts` fetch `:365`, `responsesStream.ts` fetch `:205` → boundary only | `StreamChatHandlers` (`onDelta`, `onReasoning`, `signal`, `fetchImpl`), all input/result shapes and `responseOutput` unchanged. `lib/agent/runChat.ts:261`, `contextCompaction.ts:129`, `taskWrapup.ts:53` choose transports; no call-site callback rewrites |
| Move normalization into `baseUrl.ts`, re-export from `openaiCompatible.ts` | Existing `db/repo.ts:56`, `audioGeneration/runtime.ts:25` imports continue working; no broad repo/runtime import churn. Direct adapters use the neutral leaf; AIHubMix retains `providerRoot` |

The generic discover signal is still dropped **today** at `connectors.ts:53`: `listModels(connector, options.fetchImpl)`. Small compatible repair: add a third optional `options: {signal?: AbortSignal} = {}` argument to the two generic APIs, retaining the first two arguments and the fetch injection exactly. Call `listModels(connector, options.fetchImpl, {signal: options.signal})` from `discoverConnectorChatModels`. Existing `listConnectorModels(connector, usage?, fetchImpl?)` and `testConnectorConnection(connector, fetchImpl?)` remain callable unchanged; no mandatory UI argument changes. `AgentChatPage.tsx:238` already supplies a controller signal to discovery; `runWithCompatibleChatModel` retains its `isCurrent` callback and checks around discovery before executing its external `action` callback. The new boundary must not execute those callbacks.

Generic fallback must retain a fetch-only try/catch. Test `isReadAbort(error, options.signal)` **before** the `error instanceof TypeError` fallback gate, because an abort reason can itself be a TypeError. HTTP 404/405 or actual non-aborted GET fetch TypeError permits exactly the existing one chat POST; parse/read/decoder errors never authorize it. Preserve custom/default model, ping, max_tokens=1 and legitimate empty one-token output. Specialized probes never POST.

APIMart Ext headers remain owned by `submitGeneration:298`: only `/images/generations` + `gpt-image-2.5-ext` attach response version `2026-07-27` and optional stable `Idempotency-Key`. Standard image/video remain unchanged. The helper never sets Content-Type itself, so upload FormData retains the browser multipart boundary. AIHubMix public catalog/schema remain unauthenticated despite a configured nonempty key.

**Read-only linked runtime sites, not migration targets:** `agent/generationRuntime.ts:405` directly downloads APIMart public signed image/video media with omitted credentials/no bearer and `MAX_MEDIA_DOWNLOAD_BYTES` (256 MiB). Leave its current implementation and all runtime/database edits out of this small adapter extraction. `audioGeneration/runtime.ts` owns uncertain speech/music state, intent fingerprints, task/results checkpoints and GET recovery. They are acceptance consumers, not generic-service candidates.

## 5. Error-order and paid-recovery matrix

Shared read ordering: existing caller validation/pre-abort order → one fetch → observed HTTP status → body policy chosen from status → AbortError precedence over optional diagnostic read failure → provider-specific envelope/status/schema interpretation → redaction of each diagnostic field before its own truncation → caller's durable-state decision. The helper cannot infer whether a remote operation succeeded.

| Trigger / stage | Required boundary behavior | Required adapter/runtime result |
| --- | --- | --- |
| Invalid schema, URL/key, task/content route or unsupported model | No fetch; preserve caller's validation order and messages | Zero paid calls; no helper-owned validation result. AIHubMix download's existing early abort ordering also stays local |
| Pre-aborted signal; abort reason may be TypeError | No fetch once request boundary reached; preserve thrown reason; generic fallback checks cancellation first | Media `kind:aborted`; chat `{ok:false, aborted:true}`; generic remains `{ok:false,message}` (no new failure discriminant); no fallback POST |
| Fetch Error/TypeError, no Response | Throw original transport exception, never read/retry | Media network/aborted classification and sanitized wording stay local; generic GET fetch TypeError is the narrow exception permitting its old single probe POST |
| Successful HTTP, reader AbortError (Error or DOMException), even with no signal | Throw original error; never turn into parse/protocol or absent body | Existing media aborted result; raw AbortError preserved at shared layer; generic public failure remains its existing shape, with no POST authorized by read failure |
| Non-2xx JSON/text diagnostic abort | Existing shared error readers / JSON helper propagate AbortError | Media/chat cancellation remains exception to HTTP priority; do not convert to optional empty diagnostics |
| Non-2xx malformed, oversized **bounded**, invalid UTF-8 or ordinary read-failed diagnostic | JSON helper returns no body; `readErrorText` returns empty text; bounded reader cancels/releases | Keep observed HTTP status, HTTP kind, adapter-specific prefix/fallback; no paid replay |
| HTTP 200 with `error` / `success:false` / unacceptable provider code | Only consume unknown body; no generic ok result | Local provider failure; APIMart accepted-code distinction retained; AIHubMix taskResponse with failed remote task remains successful task read |
| Successful JSON parse/read/limit failure after paid POST | Throw original read error; adapter owns protocol vs abort classification | Audio runtime `uncertain` with original intent; image/video runtime generally `unknown` absent reliable task ID. Do not claim definite remote failure or submit again |
| AIHubMix failure with a trustworthy redacted `taskId` | Keep Response/envelope available to `responseFailure` | Image/video runtime can preserve identity as `submitted` and query; do not discard ID through a generic error union |
| Success binary overflow | Existing Blob reader rejects before return/persistence | Audio protocol + 32 MiB diagnostic; protected media protocol + 256 MiB diagnostic; no hidden network/CORS substitution |
| GET/CDN failure after music task/results checkpoint | One GET/download attempt, retain current error/identity | Explicit recovery queries/downloads from checkpoint; no second paid submission; preserve healthy siblings/original indexes |
| Responses failed/incomplete/unknown status | Local decoder validates known states and redacts message/finishReason | Retain B03 protection against unknown key-bearing status entering persistence; no raw status copied by shared boundary |
| Tavily timeout / caller stop | Local controller remains active until body/result is finished; cleanup removes timer/listener | Preserve timeout vs cancelled vs transport codes and `serviceMayHaveRun`; usage read vs search/extract distinction retained |
| SSE oversize / retained-output overflow / partial terminal | Existing bounded event/aggregate checks run before overflowing callback | Keep previously delivered partial output, tool finish validation and actual usage; no lifetime traffic budget and no JSON-helper/SSE merge |

Two exact-source qualifications prevent overstating a refactor:

1. Generic non-2xx `res.text().catch(() => "")` currently suppresses body AbortError into an HTTP result, unlike C06's `readErrorText`. This plan leaves that native text branch's public HTTP behavior intact; shared JSON consumption must never inherit that catch-all. Optional third-argument signal forwarding and successful-body cancellation get explicit tests. Changing this specific generic diagnostic result is a separately identified policy change, not a claim of identical behavior.
2. Tavily directly awaits `response.body?.cancel()` on non-2xx; a cleanup rejection currently reaches its outer timeout/cancel/transport catch. Do not silently replace that with best-effort `cancelBody` while claiming unchanged Tavily error codes. Its no-diagnostic branch stays local. A future cleanup-hardening change can separately assert known-status priority. Shared bounded cleanup already preserves original errors and must retain that property.

## 6. Meaningful existing regressions (exact tests to retain)

These are discovered local test cases, **not results from this research**. They exercise real consumer behavior; keep them in the implementation handoff.

| Existing file / exact case | Contract protected |
| --- | --- |
| `tests/apimart.test.ts:107` — `attaches Ext response-version and idempotency headers only for Ext image submits`; `:157` — `uploads File as multipart without a manual content-type and preserves provider metadata` | Header/body boundary, no global JSON Content-Type |
| `tests/apimart.test.ts:89` — `accepts Ext 202 object task ids without treating them as multiple tasks`; `:97` — `keeps Image 2 and video success on code 200 task-id arrays`; `:139` — `does not retry an ambiguous paid submission failure or expose raw transport errors`; `:255` — `recognizes abort during response body consumption` | Provider schemas, one paid attempt, redaction, body abort |
| `tests/aihubmix.test.ts:21` — `uses a public catalog without credentials and preserves classification metadata and duplicates`; `:141` — `keeps a failed task as a successful read with redacted error details`; `:174` — `supports proxy prefixes and the video's fixed content route`; `:208` — `preserves result HTTP %s` | Public/protected auth separation, task-vs-request failure, route and HTTP status |
| `tests/aihubmix.test.ts:227` — `does not retry a lost paid response or expose the transport error`; `:249` — `recognizes abort during JSON and binary consumption` | No paid replay; both native and bounded body cancellation |
| `tests/apimartAudio.test.ts:64` — `downloads without credentials and rejects non-audio responses`; `:112` — `classifies %s JSON cancellation independently of signal state`; `:131` — `keeps malformed HTTP error bodies as HTTP failures and classifies cancelled bodies as aborted` | CDN policy, AbortError precedence and observed HTTP priority |
| `tests/mimoSpeech.test.ts:14` — `uses a fixed proxy-preserving endpoint, Bearer auth and separate instruction/target roles`; `:91` — `redacts boundary-position and repeated credentials before truncating provider errors`; `:99` — `reports HTTP-200 provider errors, network uncertainty and abort without replay` | MiMo wire, redaction and paid ambiguity |
| `tests/openaiCompatible.test.ts:158` — `rejects %s with one GET and no POST`; `:244` — `sends one original minimal POST with model %j`; `:268` — `rejects POST %s without a second POST`; `:294` — `%s redacts complete diagnostics before truncating` | Fetch-only fallback, preserved body/default model, result redaction; bad-directory/bad-chat fixtures include body TypeError/SyntaxError/AbortError |
| `tests/connectors.test.ts:166` — `does not mutate or POST if %s happens while discovery is pending`; `:221` — `tests key access via authenticated task-list GET, not the public model directory` | `isCurrent`/external action guard and readonly probe |
| `tests/boundedInput.test.ts:45,68,77,95,111` — actual/missing/false Content-Length, original reader AbortError, blocked-read Stop/release, split CRLF accounting, many small events in one chunk | Existing reader mechanics; do not create another implementation |
| `tests/boundedInput.test.ts:124,152,172,183,193` — exact 32 MiB audio/CDN, authoritative error overflow, exact base64 padding +1/+2 before atob, valid MiMo envelope above 4 MiB, protected video above 32 MiB / above media limit | Distinct numeric policies and read-before-allocation ordering |
| `tests/boundedChatInput.test.ts:41,49,80,102,131,138` — pre-handler aggregate guard, tool accounting, split-surrogate exact boundary, nonstream Responses one POST, bounded HTTP error and independent reader AbortError | Callback/API and SSE/retained-output contract |
| `tests/responsesStream.test.ts:74` — `does not expose or persist a %s unknown JSON status containing credentials`; `:127` — `preserves known JSON status %s and redacts its error` | B03/PM-01 redaction across result and persisted status |
| `tests/webResearch.test.ts:65,81,87,93` — HTTP normalization without bodies/retry, truthful timeout, stop without remote-cancellation claim, streamed size/invalid JSON | Tavily fixed route, local timeout, 2 MiB and error codes |
| `tests/boundedAudioRuntime.test.ts:30` — `keeps %s submit uncertain with original intent and no replay or media writes`; `:46` — `checkpoints music task/results and retries only GET after an oversized CDN response` | One POST through later submit/refresh, durable intent and no decode/persistence after overflow, GET-only recovery |
| `tests/mimoRuntime.test.ts:47` — `never replays ambiguous preset POSTs`; `tests/agentGenerationRecovery.test.ts:85` — `allows code-declared repeatable queries to recover without a generation submission` | Different audio/image runtime recovery owners remain intact |

Read-only observation about `tests/audioGenerationRecoveryAudit.test.ts:269`, `retains uncertain paid JSON %s failure with exactly one POST`: the fixture spies on `Response.json`, whereas current C06 music consumption uses `readResponseJson`/stream bytes. Its `{}` response can still reach uncertain protocol failure without exercising the mocked independent AbortError. Retain the request-count/uncertain assertions, but do not cite it alone as proof of body-abort propagation. Add real stream-reader fixtures below; do not modify this test during research.

## 7. New gap cases proposed for implementation

Add adapter-level assertions to the existing files where possible; a small `tests/providerRequestBoundary.test.ts` may cover the new primitives' original-error and explicit-policy contracts. Avoid tests which merely restate implementation or assert that adapters call a particular helper. Each case needs result **and** actual URL/method/header/signal/request-count evidence.

1. **Large successful inline image JSON remains accepted.** In `aihubmix.test.ts`, build valid completed native image task envelopes with `output[].b64_json` above 4 MiB and above 32 MiB, preserving index/task ID/base64 content and exactly one POST. Avoid a giant full bitmap; the adapter retains encoded data and does not decode it. This catches both accidental ordinary-JSON and audio caps. Also use a legal >4 MiB APIMart native model/schema or accepted media envelope to protect its current native JSON mode. No success cap is approved here.
2. **JSON diagnostic precedence across actual migrated consumers.** APIMart/AIHubMix native error streams with status 403 and SyntaxError/TypeError must retain http/status without raw body; independent DOMException and Error-name AbortError must become aborted. APIMart audio and AIHubMix protected download use 64 KiB+1 streams with absent/fake Content-Length: verify authoritative status and bounded cancellation/release. Their successful counterparts remain protocol/abort as appropriate, exactly one request.
3. **Generic discover forwards Stop instead of merely ignoring a stale result.** Call `discoverConnectorChatModels` for openai-compatible and DeepSeek, record exact signal identity at `/models`, cancel pending transport and assert no fallback POST. Continue to assert `runWithCompatibleChatModel` never invokes external `action` after Stop/selection change. Existing APIMart/AIHubMix cancellation cases do not prove this currently dropped signal path.
4. **Abort reason TypeError cannot authorize probe POST.** Exercise pre-aborted signal and abort during GET with `controller.abort(new TypeError(...))`; provide a valid fallback frame if accidentally POSTed. Expect zero/pre-abort or one/in-flight GET, zero POST. Separately retain plain non-aborted GET fetch TypeError → one permitted POST, and TypeError from successful/error body → no POST. The boundary must not conflate its own precheck with fetch failure.
5. **Request-policy cross-adapter matrix with real exported APIs.** Check media/authenticated vs public catalog/schema/CDN, multipart vs string JSON, and generic same-origin/follow vs media omit/error. Assert raw signal and injected-fetch identity, no fabricated Bearer on public paths, no default Content-Type on FormData/CDN, exact proxy prefixes and fixed task/content routes. Do not force every adapter into media policy or accept returned schema URLs as transport URLs.
6. **Once-only paid read failure reaches durable recovery.** Through actual audio/image runtime exports, make successful POST body fail using a real stream after fetch resolves (not a Response.json spy): SyntaxError/TypeError/independent AbortError. For audio, assert uncertain + unchanged intent/fingerprint + no decode/media/take/work/clip writes + repeated submit/refresh does not POST. For image/video, assert unknown when no identity, preserve valid taskId when supplied by provider failure, and later explicit task/content GET recovery never submits again. Existing bounded-runtime overflow tests should remain, not be duplicated wholesale.
7. **Tavily timeout still covers body reading.** Return headers immediately, then block the body until the controller aborts. Assert timeout vs explicit caller cancel, truthful `serviceMayHaveRun`, exactly one request, reader cleanup and cleared listener/timer. Successful malformed UTF-8 should retain Tavily's nonfatal decode behavior while MiMo/chat bounded decoding remains fatal. No shared timeout restricted to fetch headers.
8. **Error fields and caller callbacks cannot leak or move.** Put repeated and boundary-crossing fake keys in APIMart code/type/message, AIHubMix taskId/upstream_detail keys and values, MiMo raw-text HTTP fallback, and Responses known/unknown statuses; compare whole returned/persisted result. Preserve Tavily URL-encoded-key filtering. Verify chat/Responses valid onDelta/onReasoning order and retained bytes before an overflowing callback after transport migration; use existing C06 cases rather than a new SSE parser suite.

Native JSON paths remain intentionally without a finite incoming size cap, and generic/Tavily no-diagnostic HTTP quirks above remain explicit limitations. These are not proof of complete ingress hardening or a request to broaden D07. No live paid/network/memory/OOM measurement is implied by mocked streams.

## 8. Migration/acceptance sequence and risks

1. When the coordinator reaches D07 after independently accepted prior units, refresh hashes/callers and per-file attribution. Read any updated D01–D06 boundaries; do not take ownership of their runtime/repository work.
2. Move unchanged normalization with compatibility re-export. Add the once-only transport and explicit JSON policies; reuse shared abort/bounded/readErrorText/safeError leaves. Keep dependencies downward: no request leaf imports an adapter, DB/runtime, model catalog or UI.
3. Migrate APIMart request + APIMart audio and AIHubMix transport/JSON, then MiMo/Tavily transport; keep separate provider decoding. Add the generic signal-forwarding/fetch-only fallback repair and migrate chat/Responses fetch only, retaining materialization and external callbacks. Public CDN audio can use the same transport without auth. Public image/video runtime downloader remains read-only integration evidence.
4. Run the relevant existing provider, connector, bounded, chat/Responses, Tavily and recovery tests plus the meaningful gaps above. All future commands use `/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm` explicitly, e.g. `.../pnpm test tests/apimart.test.ts tests/aihubmix.test.ts tests/apimartAudio.test.ts tests/mimoSpeech.test.ts tests/openaiCompatible.test.ts tests/connectors.test.ts tests/boundedInput.test.ts tests/boundedChatInput.test.ts tests/boundedAudioRuntime.test.ts tests/chatStream.test.ts tests/responsesStream.test.ts tests/webResearch.test.ts tests/mimoRuntime.test.ts tests/audioGenerationRecoveryAudit.test.ts tests/agentGenerationRecovery.test.ts tests/providerCacheUsage.test.ts`. No install/runtime pnpm needed for research. Future lint is the actual package `tsc -b` script, not an assumed ESLint gate; perform task-required differential/static/independent acceptance then.
5. Verify actual shared caller integration, unchanged API/result/callback/transaction ownership, one paid attempt and GET recovery before coordinator spec/ledger work. A drop in lines/complexity is not acceptance evidence. Do not mark D07 passed from this proposal or from unexecuted test names.

| Material risk | Mitigation / acceptance evidence |
| --- | --- |
| Blanket finite JSON limit rejects valid inline images | Required explicit native vs bounded policy; valid >4 / >32 MiB native image test; retain C06 exclusions |
| New helper becomes a generic service or merely moves complexity | Two small leaves; actual shared fetch/HTTP JSON consumers enumerated; keep schemas/status/results/runtimes in their owners |
| Browser-policy hardening silently changes generic proxies | Preserve explicit current-default same-origin/follow; separate future policy change from extraction |
| Optional diagnostic catch erases abort or known task ID | isReadAbort before optional fallback; preserve original Response/unknown body; assert status/providerCode/providerType/taskId and recovery |
| Generic transport TypeError triggers paid POST after body failure/Stop | Keep fetch-only gate; signal/TypeError abort reason matrix; valid accidental-POST trap fixture |
| Timeout cleanup ends at headers or changes Tavily codes | Keep local controller/timer through body and finally; preserve current no-diagnostic cancel branch |
| Schema/header/status callback drift | Ext-only headers, multipart wire, public auth, failed-task read and callback/output tests; no factory decoder |
| Research becomes stale after sequential implementation | Source hashes below describe this read only; refresh all modified adapters plus linked current runtimes before implementation |

## 9. Current-source read fingerprint

These hashes identify the request-boundary source inspected for this proposal. They are not an implementation snapshot or reviewed-files status. Concurrent runtime changes are deliberately not certified here.

| File | SHA-256 |
| --- | --- |
| `src/lib/ai/openaiCompatible.ts` | `58af82f28f70dbd361d9bfc43b4201186407060c67ad6fd3f342e20a65c29912` |
| `src/lib/ai/apimart.ts` | `0aaf9904b526ce8ca63cdc67535f7b245fbf182e5e4b93a6185633916118c65e` |
| `src/lib/ai/apimartAudio.ts` | `b039e073947defcfc5b69a1e33fd2b7a39779c33159ba4eb65cd632509362d9e` |
| `src/lib/ai/aihubmix.ts` | `c6a66b5fdb0904d1765b70f04b38769f55ec5a6c70feae757396adffbb4233c9` |
| `src/lib/ai/mimoSpeech.ts` | `0be180a9ed8767321126cc7b49ba3f16836e625466e3d43c105c46e9dcaf62c8` |
| `src/lib/ai/tavily.ts` | `b24c36e3ef77e85585b6d72ca684b40e2f7c7e5d758696abea5ea945a0c98ae4` |
| `src/lib/ai/chatStream.ts` | `ede7b8806f165128a864f948435defc700c226a4656041c6a485c0f3342cdf6d` |
| `src/lib/ai/responsesStream.ts` | `7a641a8da7404523939998ea6618989e9823bb1f63e24dec9aad5076e2eabee7` |
| `src/lib/ai/connectors.ts` | `2c1329cffd0b4fa7b1125d4a6f08b47044b26e9a8b6968472aed827e1e00f32d` |
| `src/lib/ai/safeError.ts` | `aaca8cbeafa33d6d2d7f12668f858827de788b1b3737bf9a909cdb255dca5d12` |
| `src/lib/ai/boundedResponse.ts` | `92cc47f78623f8c1c8e7d864a9f4af655c5b498077f8b0e93de25eefc9be8384` |
| `src/lib/ai/boundedSse.ts` | `8626015eebd251a1956992f6274d679f8e3cd6af556e2e4acb9acf72fe925894` |
| `src/lib/resource/limits.ts` | `aaed95b303a65539344a27c6fbee1670171248995a4e2da3fe4dc9cc4307bb17` |
