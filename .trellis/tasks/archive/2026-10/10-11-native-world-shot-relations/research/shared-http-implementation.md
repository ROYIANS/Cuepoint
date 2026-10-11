# Shared HTTP implementation evidence

Date: 2026-10-11. Worker: `shared_http`. Scope: approved complete-product reuse stage; no supplier calls, credential extraction, commit, push, merge or archival performed by this worker.

## Change boundary and ownership

The existing provider/Agent protocols already return standard `Response` objects and accept injected fetch implementations. The behavior gap was their default WebView fetch path, which fails under normal packaged CSP/CORS. This work adds the native transport selection at the existing request boundary and the one direct generated-result download. Provider decoding, SSE/Responses framing, tools, approvals, business commands and durable job/history semantics remain their existing implementations.

Owned product paths:

- `src/lib/runtimeFetch.ts`: official HTTP plugin default, shared upload capacity, wire forwarding, redirect policy, cancellation and page lifecycle.
- `src/lib/runtimeHttpPolicy.ts`: current-config exact origin checks and explicit no-auth result / operation-local connector draft / search-test scopes.
- `src/lib/ai/requestBoundary.ts`: runtime fallback with explicit injected `fetchImpl` precedence.
- `src/lib/ai/chatStream.ts`, `connectors.ts`, `openaiCompatible.ts`: remove eager browser-fetch defaults and preserve unsaved connector discovery/test behavior.
- `src/lib/ai/apimartAudio.ts`, `tavily.ts`: explicit result-download or fixed search-test purpose at their existing boundary.
- `src/lib/agent/generationRuntime.ts`: replace its formerly direct signed-CDN default fetch only.
- `tests/runtimeFetch.test.ts`, `runtimeFetchIntegration.test.ts`, `runtimeFetchLifecycle.test.ts`: focused finite transport/policy, actual existing-provider default-path and lifecycle regressions.

The `native_services` worker owns official plugin 2.8.2 / API 2.12.2 installation and lockfiles, Rust plugin setup, `scopeRedirects`, exact dynamic ACL command, patched pending-read cancellation, and backend tests. The agreed origin IPC is `authorize_http_origin({origin, allowHttp}) -> {origin}`. These root TS services use the storage-independent `isTauriRuntime` leaf added by the product-owner worker. No desktop backend, storage selector, UI, export, tool schema or spec file was edited by this worker.

## Implemented behavior

- Browser calls and packaged relative/non-HTTP bundled/blob requests preserve their Web fetch path and original init. Native absolute HTTP(S) calls use official `@tauri-apps/plugin-http` without a WebView fallback or transport retry. Existing explicit injected fetch functions still receive the original boundary wire and preserve their original exceptions.
- Normal native calls read current connector/search configuration for every request. Exact scheme/host/effective port is checked, including IPv6 and explicitly configured HTTP. Removing a connection blocks new ordinary wrapper calls despite native ACL grants remaining additive until restart.
- Unsaved connection editing is retained through an operation-local captured draft origin used only by discovery/test helpers. Normal Chat/generation execution still requires a current saved origin. The fixed Tavily `/usage` test can test a draft key; normal search/extract requires the current enabled saved configuration.
- Supplier-result downloads separately require no-auth GET and no body. HTTPS supplier CDN origins can be granted; HTTP result origins must be explicitly configured. Existing signed query values are left opaque. No connector auth or cookies are attached to public result reads.
- Each native invocation receives a fresh init and Headers, preserving caller credentials/redirect/body/signal semantics. The plugin has `maxRedirections:0` and 30-second connect timeout; existing caller total/read/idle deadlines remain unchanged. No generic short overall timeout is added.
- Follow redirects are inspected and authorized individually, at most five followed hops. Cross-origin Authorization/proxy auth/cookie/API-key headers are removed; POST 301/302 and non-GET/HEAD 303 follow the Fetch method/body rewrite. Discarded bodies are canceled. `error` rejects a redirect, `manual` returns the original status/body, and follow with no Location returns the original response.
- Plugin serialization buffers uploads. Two shared slots bound concurrent uploads across configured and probe wrappers; queued cancellation removes its waiter. Binary/multipart payloads retain the 20 MiB reference-file bound. JSON/text retains its existing domain budgets: shared vision permits up to ten 10 MiB images, so applying 20 MiB to its encoded request would break existing functionality. This was found and corrected before source freeze, with a >20 MiB text regression.
- Caller Stop retains the exact AbortSignal reason during headers and all response readers. Body cancellation/error/EOF removes lifecycle listeners and cancels the native body as needed; late chunks cannot appear after Stop. Native transport errors retain safe Error/TypeError classification while dropping raw plugin diagnostics which could contain signed URLs. Shared HTTP status/body/error parsers remain authoritative.
- All in-flight native controllers are tracked centrally. `pagehide` aborts pending headers/bodies and blocks late new requests; `beforeunload` aborts without permanently closing the page, since the existing dirty-draft guard can cancel a close; `pageshow` restores explicit future requests. Completed/error/canceled requests leave the registry. This complements the backend cancellation patch because clearing the Rust resource table alone does not call Resource.close on a pending retained Arc.

## Validation

All pnpm commands use `/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm`. Final command results are recorded in:

- `shared-http-tests.log`: focused new transport tests plus existing D07, Chat/Responses, connector, APIMart/AIHubMix/MiMo/audio and Agent generation behavioral suites.
- `shared-http-types.log`: root `pnpm lint` / `tsc -b --pretty false`.
- `shared-http-lint.log`: root-config ESLint on the two new product service modules, with inline configuration disabled.

New integration tests mock only the official plugin boundary. They execute the existing Chat and Responses default paths/parsers, unsaved connector discovery, audio result download, search connection test, and the existing `submitAgentGeneration -> poll -> signed download -> durable media` chain without providing a provider `fetchImpl`. They also prove explicit injection precedence, exact origins/current revocation, redirect method/auth/body/count rules, HTTP status/reader failures, queued upload cancellation/concurrency/boundaries, native-request error single invocation, exact Stop reason, late-chunk suppression and page-close cleanup.

During development, the first redirect test fixture violated the existing unique connector-definition index; its second definition was corrected. An initial Responses integration fixture omitted `connectorDefinitionId`, so the unchanged protocol gate correctly refused it; the fixture now supplies its existing supported connection definition. The generation integration expected task URL omitted the existing `?language=zh`; its assertion was corrected to the actual unchanged provider contract. Root types initially failed another worker's in-progress `nativeSystemServices.ts` UUID-template annotation and passed after that owner corrected it. New-module ESLint initially rejected directly throwing/rejecting untyped AbortSignal.reason; the implementation now uses `throwIfAborted()` and a cancellation wakeup while preserving exact reason identity, without allowances. These were finite development failures, not relaxed product assertions or skipped acceptance cases.

## Limits and required main-session follow-up

Finite tests and root types do not establish actual packaged native HTTP delivery, Rust resource release, supplier availability, audio acoustics or complete feature parity. Main session must use the final source bundle for its no-CORS local fixture: incremental Chat/Responses, partial/error/overflow, abort before headers and while a body read is stalled, server disconnect/resource release, multipart and no-auth binary reads, and close/reload cleanup. The backend worker's patch test and source provenance remain separately required. Genuine supplier checks use user-configured fresh-isolated connections and remain distinct from this mocked boundary evidence. Browser regression, complete quality gates/builds and final feature/tool matrix are main-session owners. Other OS runtime acceptance remains deferred.
