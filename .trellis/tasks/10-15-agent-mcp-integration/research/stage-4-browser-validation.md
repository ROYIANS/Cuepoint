# Stage 4 practical browser validation

Status: actual SDK/browser implementation and necessary fixture execution on
2026-10-16. Final lifecycle review corrections are tracked in stage-4-results.md.
These results do not establish installed desktop or production-build acceptance.

## Exact SDK dependency closure preparation

The dispatcher resolved the exact published client 2.3.1 with the explicit
machine pnpm executable in an isolated temporary package outside the workspace.
Install scripts were disabled. No workspace manifest, lockfile or node_modules
was changed by this preparation.

The workspace's existing esbuild 0.28.2 resolved the actual root exports Client,
StreamableHTTPClientTransport, discoverOAuthServerInfo, startAuthorization,
exchangeAuthorization and refreshAuthorization under platform browser, ESM,
es2022 and the browser condition. The no-output in-memory graph contained 155
resolved modules and produced 677,566 bytes. The graph had no reachable Node
builtin, stdio, cross-spawn, Node shim or Ajv entry. This is the external
dependency-closure check missing from the preceding source-only investigation.

After admission, the actual workspace-resolved graph was checked with the same
six public root exports: 155 modules, 676,415 bytes, without reachable Node stdio,
cross-spawn, Node shim or Ajv entry. Both checks use an in-memory output and are
scoped SDK resolver checks, not application production builds. The exact client
is 2.3.1; the normalized lock change adds only the new importer and six package/
snapshot pairs. Existing SDK-external Zod 3 remains unchanged.

## Browser execution seams available on the current host

The existing Playwright runtime is available outside the workspace at
`/Users/xiaomengdao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs`.
Available Chromium headless executable is
`/Users/xiaomengdao/Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell`.
The fixture uses machine Node 24.11.0 and the actual installed Chromium
151.0.7922.34. Using the browser runtime does not authorize bundled runtime pnpm.
Actual shared UI/port/SDK behavior, Node fetch behavior and installed desktop
evidence remain separate.

## Actual no-replay discovery and correction

The production SDK was exercised through the real feature configuration owner,
ProductStore, browser port and cross-origin network. With a string body and all
SDK retry controls disabled, one JavaScript fetch produced three HTTP/1 POSTs,
or two HTTP/2 POSTs, after the fixture counted the effect and dropped the
connection before returning response headers. A mocked fetch counter missed this
browser network behavior. These failing runs were not treated as successful proof.

All MCP POSTs and OAuth token/DCR POSTs now use a single-use ReadableStream with
duplex=half and explicit capability detection. There is no string fallback.
Modern request streaming, HTTP/2 or HTTP/3, CORS and compatible public-client
registration/callback deployment are therefore required for practical Web use.
HTTP/1 is explicitly rejected before a protocol request reaches the peer.
The desktop transport commitments are unchanged.

This restriction follows [Chrome's request-streaming documentation](https://developer.chrome.com/docs/capabilities/web-apis/fetch-streaming-requests),
which describes duplex, CORS, redirect and HTTP/1 limitations. Chromium's
[HTTP network transaction implementation](https://chromium.googlesource.com/chromium/src.git/+/2fcd0208b3f849c13d52a89ec357eb25793032cc/net/http/http_network_transaction.cc)
also explains resend after an ambiguous reused-connection failure. The concrete
effect counters above, and their corrected single-use-body results, are actual
fixture observations rather than an inference from those documents alone.

## Executed browser boundaries

tooling/mcp-browser-regression.mjs serves an actual cross-origin TLS HTTP/2 peer
and the narrow Vite harness. The test certificate is generated in an owned
temporary directory and trusted only by this fixture browser context, then removed.
It does not alter production TLS validation. The legacy HTTP/1 peer is used only
to verify explicit incompatibility; no proxy is introduced.

The executed cases cover modern discovery, legacy initialize/session handling,
manual headers, dropped response headers, REFUSED_STREAM, HTTP 401/403/404/408,
input_required, header mismatch, oversized JSON/SSE, a stalled response body,
CORS rejection, unexposed session headers and repeated pagination cursors. Each
possible-effect failure leaves the actual peer counter at one after original
status/stop/disconnect. The fixture also performs real popup authorization with
preregistered public clients and advertised DCR, verifies PKCE/resource binding,
and rejects wrong message source/origin/state/issuer without consuming the valid
pending attempt. Stable refresh rotates once for two distinct queued calls;
changed granted scopes reject the old authority before any effect. Reload keeps
the public catalogue and loses private session credentials.

The runner records source hashes and requires them to stay unchanged. Its final
strict receipt is recorded in stage-4-results.md after lifecycle corrections.
No raw code, verifier, access/refresh token or callback query is saved in the
repository evidence. The public bytes checked include actual DB/local/session
storage projections. Broader actual model/context/ZIP/diagnostic exclusion is
covered by mcpPrivacy.test.ts and the retained UI fixture.

## Actual application import smoke

After the lock change, tooling/build-agent-packages.mjs explicitly regenerated the
runtime libraries. assertAgentPackageFreshness passed; actual emitted core/provider
roots imported with 34/9 exports, and formatSkillCatalogue/createCapabilityRegistry
were functions. A fresh Chromium context then loaded /agent through the actual
apps/web/vite.config.ts, showed the expected missing-model-connection screen,
opened Settings and its MCP manager, and opened the remote configuration editor.
There were zero page errors and zero failed local module imports. External font/
math assets were deliberately blocked by the smoke fixture. This is development
entry/runtime evidence, not full application or isolated packed-consumer acceptance.
