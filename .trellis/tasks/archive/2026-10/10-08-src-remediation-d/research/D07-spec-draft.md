# D07 provider request boundary contract draft

Coordinator preparation only. Reconcile exact accepted owners/signatures and original per-adapter policy matrix after D07 independent PASS. No live provider verification or new response limit is claimed.

## 1. Scope / Trigger

Maintain this contract when changing APIMart/image/audio, AIHubMix, MiMo, OpenAI-compatible/chat/Responses or Tavily request foundations. Share actual once-only fetch and response-reading mechanics without flattening provider status, payload, retry, timeout or browser policy.

## 2. Signatures / Owners

- `lib/ai/baseUrl.ts` owns `normalizeBaseUrl(baseUrl: string)` with the existing trim/trailing-slash behavior unchanged. Original OpenAI-compatible compatibility exports remain for actual old consumers; transport modules consume the small leaf directly.
- `lib/ai/requestBoundary.ts` owns `RequestBoundaryOptions`, `requestOnce(url, init, options)`, `JsonReadPolicy`, `HttpJsonReadPolicy` and `readHttpJson(response, policy, signal): Promise<unknown>`. Credentials/redirect and native/bounded success/failure policies are explicit caller inputs; bounded policy includes maxBytes and fatalUtf8. requestOnce checks an already-aborted signal and invokes the injected/native fetch once.
- Existing `boundedResponse`, `boundedSse`, `safeError` and neutral resource limits remain the actual byte-read, abort/cleanup, SSE framing, redaction and budget owners.
- Existing provider adapters retain URL/key/route validation, headers/body, timeout controllers, HTTP/provider error formatting, envelope/schema/status/result decoding and durable runtime APIs. Shared JSON returns unknown, preserving the real adapter parse/validation boundary; it discards only unreadable optional non-2xx diagnostics and propagates success/abort failures.

## 3. Contracts / Invariants

- Submit each paid POST once. A shared helper cannot introduce automatic retry, fallback, auth retry or replay after an unknown outcome. Existing GET recovery remains distinct from submission.
- Preserve each actual adapter's request method/body/headers/signal/credentials/redirect and guarded URL rules. Moving base normalization must not broaden URL/key permission or alter relative/absolute route construction.
- JSON consumption has explicit native or bounded policy. C06 ordinary JSON limits are not authority to cap successful generic image/inline-base64 JSON, which keeps native parsing. Existing 256 MiB media, 32 MiB audio and provider envelope budgets remain unchanged.
- On non-2xx responses, observed HTTP status remains authoritative when optional diagnostic reading fails, overflows or cannot decode; AbortError still propagates. Success parsing failures remain real failures. Do not turn an unsuccessful HTTP response into a success fallback.
- Reuse actual-byte readers and cancellation/release behavior. Keep the original abort object/semantics where preserved by current adapters; do not duplicate abort detectors or allocate guessed memory budgets.
- Redact the full configured key, Bearer token and provider-specific encoded-key forms before truncating to the original adapter-specific lengths. Key-bearing URLs remain rejected where currently guarded. Shared reading does not weaken existing provider error authority.
- Generic discovery forwards its existing caller signal into the adapter. Existing two-argument public calls remain valid; the additive signal preserves cancellation rather than converting AbortError into ordinary directory failure or probe fallback. Generic probe retains its already-authorized GET404/405 or GET-fetch TypeError fallback only; the shared once-only helper does not remove this existing two-attempt operation or introduce another attempt.
- SSE framing and output/tool budgets stay with their existing owners; preserve event/error ordering, retained partial output and callback behavior. Provider status/envelope decoders remain explicit local logic.

## 4. Validation / Error Matrix

| Condition | Required behavior |
| --- | --- |
| Guarded URL/key invalid | Reject before fetch; no request |
| Successful native inline-image JSON | Preserve native parsing and original payload semantics, not a blanket ordinary-JSON cap |
| Bounded success exceeds budget/invalid UTF-8 | Existing actual limit/read error and cleanup |
| Non-2xx diagnostic read fails/overflows | Preserve observed HTTP status and original safe fallback detail |
| Abort before/during fetch/read | Propagate original abort behavior; cancel/release resources |
| Key-bearing provider message | Redact before original truncation, no disclosure |
| Paid submission returns uncertain outcome | No second POST; preserve existing recovery path |
| SSE error after partial output | Existing ordering/retention/flush semantics remain |

## 5. Good / Base / Bad Cases

- Base: each adapter supplies its explicit browser and JSON policies to a once-only shared helper.
- Good: a huge successful inline-image JSON retains its accepted native policy, while a small-budget ordinary envelope stops on observed bytes.
- Good: a non-2xx body-read error keeps HTTP failure authoritative, while abort propagates distinctly and no paid POST repeats.
- Bad: one universal response cap, hidden credentials/redirect defaults, swallowing AbortError, truncating before redaction, a generic provider factory, or shared automatic paid retry.

## 6. Tests Required

Compare before/after per-adapter policies and actual request bytes/call counts. Cover status authority versus diagnostic read/decode/overflow, abort identity/cleanup, redaction before truncation, encoded/key-bearing URL guards, bounded and native successful reads, SSE ordering and once-only paid submission with existing GET recovery. Keep C06 resource tests and D05/current runtime catalog/type boundaries intact. Native probes are needed for a concrete changed browser/transaction risk; finite mocks prove exercised contracts rather than live availability or OOM behavior. Preserve failures; no assertion/timeout/limit weakening.

## 7. Migration / Limits

All shared leaves need multiple real consumers and dependency-light layering. Keep existing public adapter APIs and actual compatibility normalizer consumers. No provider factory/service framework, retry system, endpoint/model support or audio/music policy change. D08 local drafts and E/QG01 remain later work. Current local evidence does not establish live provider behavior, acoustic quality or full app E2E; whole-D final acceptance checks the final cumulative inputs.
