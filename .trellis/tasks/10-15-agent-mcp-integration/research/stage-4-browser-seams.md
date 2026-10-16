# Stage 4 practical Web: released browser SDK seams

Date: 2026-10-16. Preparation only; Stage 3 remains owned by the other workers.
This note adds no production implementation, dependency, proxy or app build.

## Recommendation and evidence boundary

Attempt a remote-only implementation of the existing `McpHostServices` port with
the released `@modelcontextprotocol/client@2.3.1`. Keep private configuration and
OAuth state in session memory. Compatible remote servers can work without a
backend; stdio and incompatible CORS/registration/deployment combinations must
produce bounded unsupported/reconnect-required outcomes.

The SDK is not currently installed in this repository. Repository dependencies,
lockfile and the inspected local npm cache did not contain the client package.
I fetched the official registry metadata and tarball into memory without an
install or retained SDK files:

- [Registry metadata for client 2.3.1](https://registry.npmjs.org/@modelcontextprotocol/client/2.3.1).
- [Published client 2.3.1 tarball](https://registry.npmjs.org/@modelcontextprotocol/client/-/client-2.3.1.tgz):
  1,650,068 bytes; SHA-256
  `0febe399e355b703d4e9fa6eb1453c5fa06b06c78e2421d797dcb145fb9bb68f`.
- Calculated SHA-512 matched the registry integrity value. Published source-map
  contents for `client.ts`, `streamableHttp.ts` and `auth.ts` each matched the
  corresponding official `v2.3.1` tag source byte for byte.

This establishes the released API/source being examined. It does **not** establish
a resolved transitive browser bundle, actual browser execution, working CORS or
an operational third-party OAuth registration. Those require Stage 4 fixtures.

## Actual package exports and browser closure

The published root export contains `Client`, `StreamableHTTPClientTransport`,
`UnauthorizedError`, `InsufficientScopeError`, the OAuth functions below, and
their public types. Import remote transport and OAuth symbols from
`@modelcontextprotocol/client`; this release does not export `./streamableHttp`
or `./auth` package subpaths. `./stdio` is a separate export and must never enter
the browser graph. Internal helpers such as `adaptOAuthProvider` are not public
root exports.

The `./_shims` export has `node`, `browser`, `default` and `workerd` conditions.
`default` selects the Node shim. The browser resolver must select `browser`
without also enabling `node`; its validator is the cf-worker implementation.
Do not relax Studio's CSP or import the Node/Ajv shim to make resolution pass.

A literal emitted-JavaScript import traversal from the published root, resolving
the package self-reference `/_shims` to its browser target, reached six local
modules: `index.mjs`, `shimsBrowser.mjs`, `chunk-Br0eD_fh.mjs`,
`cfWorkerProvider-BylNJ1R5.mjs`, `dialects-BOhdv1Fc.mjs` and
`src-WCy6ifGf.mjs`. Their external imports were only
`@modelcontextprotocol/core/internal`, `eventsource`, `eventsource-parser/stream`,
`jose`, `pkce-challenge` and `zod/v4`. No actual `node:*`, stdio or `cross-spawn`
import occurred within that inspected local graph. A type-only
`node:stream/web` source import is erased in the published JavaScript.

The manifest still declares `cross-spawn` for the separate stdio entry. Manifest
presence alone is not browser reachability. Conversely, the six-module scan is
not full closure proof: external dependencies were not installed, pinned by this
workspace or traversed under its actual browser resolver. Before dependency
admission, run a scoped, no-output browser resolver/bundler graph check using the
proposed exact package set and actual browser conditions. Reject reachable Node
builtins, stdio, spawn, Node shims and accidental server entries; then import the
selected entry in a real browser fixture. This is a future validation step, not
a check performed by this research.

## Transport settings needed for one effect send

The released [HTTP transport source](https://github.com/modelcontextprotocol/typescript-sdk/blob/v2.3.1/packages/client/src/client/streamableHttp.ts)
exposes `fetch`, `requestInit`, `authProvider`, `redirectPolicy`,
`reconnectionOptions`, `onInsufficientScope` and `maxStepUpRetries` options.
Its default OAuth provider adaptation retries the same POST after 401; its
default 403 handling can reauthorize and resend. A business call must therefore
use a token-only `AuthProvider` with no `onUnauthorized` callback. Complete any
serialized refresh before dispatch, validate the principal again, and freeze the
token for that attempt. Set `onInsufficientScope: 'throw'` and
`maxStepUpRetries: 0`. Keep auth-flow helpers separate from effect transport.

Set the full `reconnectionOptions` object with `maxRetries: 0` and finite delay
values. Do not supply resumable request tokens. The inspected TypeScript
transport has no `reinit_on_expired_session` option corresponding to native
rmcp; ordinary 404 handling does not automatically initialize and replay a call.
Classify expiry through the bounded host fetch/error boundary, retire that
generation and require a new connection. Once dispatch may have happened, retain
`unknown` instead of treating a reconnect as permission to repeat the effect.

The transport reads JSON/error text and parses SSE without this task's byte
quota. Inject a bounded fetch wrapper that caps actual response-stream bytes
before SDK parsing, cancels the underlying body and aborts on overflow or a
finite deadline. Cover body consumption as well as receipt of response headers;
`Content-Length` alone is insufficient. Reuse the native conservative 1 MiB
whole-response cap for SSE rather than adding streaming resumption. OAuth
metadata/token bodies also need an explicit smaller cap; 64 KiB is a proposed
starting limit to validate, not an already established task contract.

Force `credentials: 'omit'` and reject redirects at the host fetch boundary for
credential-bearing requests. The SDK's default same-origin redirect policy is
not a complete no-replay boundary. Do not use `no-cors`, opaque responses or
unbounded response cloning as fallbacks. Local stop/close first removes dispatch
eligibility and aborts transport; it cannot prove a remote effect was undone.

## Client settings that otherwise create hidden extra work

The released [Client source](https://github.com/modelcontextprotocol/typescript-sdk/blob/v2.3.1/packages/client/src/client/client.ts)
defaults to legacy version negotiation and automatic `input_required`
fulfilment. Use explicit version negotiation with finite probe timeout/retries,
and `inputRequired: { autoFulfill: false }`. Do not advertise sampling,
elicitation, roots or other unsupported authority.

For a tool effect, inherited public `client.request({ method: 'tools/call',
params: { name, arguments } }, options)` avoids the `callTool()` header-mismatch
repair path. If using `callTool`, supply the frozen `toolDefinition` to disable
its definition-refresh retry as well. Set explicit request timeout,
`maxTotalTimeout`, cancellation signal and no progress-based timeout extension.
Do not opt into input-required continuation. Browser header mirroring is
currently disabled by the SDK, so a strict modern server requiring parameter
header mirroring may remain incompatible; do not silently alter the arguments.

List helpers can auto-aggregate up to 64 pages. Fetch individual list pages
through the public SDK request surface so the host can reject repeated cursors,
the 17th page and the 129th descriptor before accumulating them. Preserve
existing generation limits and exact raw-name/resource-handle bindings. Use a
separate client per connection/principal generation and retire frozen manifests
on relevant list-change events rather than silently upgrading an approved run.

These settings still use the maintained SDK protocol implementation; they do
not require a second JSON-RPC implementation.

## OAuth/public client without a backend

The public root API includes `discoverOAuthServerInfo`,
`discoverOAuthProtectedResourceMetadata`, `discoverAuthorizationServerMetadata`,
`selectResourceURL`, `registerClient`, `startAuthorization`,
`exchangeAuthorization`, `refreshAuthorization`,
`validateAuthorizationResponseIssuer`, `auth`, and types `OAuthClientProvider`,
`OAuthDiscoveryState`, `StoredOAuthTokens`, `AuthProvider` and `FetchLike`.
The released [OAuth source](https://github.com/modelcontextprotocol/typescript-sdk/blob/v2.3.1/packages/client/src/client/auth.ts)
supports the required discovery, PKCE exchange and refresh building blocks.

Use a pre-registered public client or advertised DCR. Require the actual web
callback URI to be accepted by that registration, and require discovery,
registration, token/refresh and MCP endpoints to permit the browser's requests.
No client secret belongs in this adapter. No public CIMD support should be
claimed without an actual hosted metadata URL and a fixture for that path.

Prefer the explicit lower-level SDK functions in an owned login attempt:
discovery/resource validation, registration, `startAuthorization`, then
`exchangeAuthorization` after host callback validation. `startAuthorization`
returns the authorization URL and verifier. Keep issuer, resource, client,
redirect, state, verifier, discovery snapshot and config/generation ownership
attached to the attempt. The SDK does not own validation of the callback's
state/window/route. Its convenience `auth()` has recovery paths that may retry
or initiate another authorization; do not run that orchestrator during effect
dispatch or forward its raw exception text into diagnostics.

Serialize refresh per credential generation with `refreshAuthorization` before
sending. The host must preserve the previous scope set when the refresh response
omits `scope`, account for token expiry, and compare the normalized granted scope
set plus issuer/client/resource identity. Changed identity retires old prepared
authority before any effect. A stale owner cannot publish tokens into a newer
revision. Normal same-identity token rotation must remain usable.

## Popup and same-origin callback ownership

Reserve the popup synchronously in the user's login click, before awaiting
discovery; the current asynchronous `oauthBegin` port alone cannot guarantee a
later `window.open` will avoid popup blocking. The UI can hand a finite reserved
popup capability to the browser login owner. Do not navigate the parent chat to
the identity provider.

Use a dedicated same-origin callback route handled before normal product route
diagnostics. Read only the finite callback fields, reject duplicate query keys,
and immediately remove sensitive callback query data with `history.replaceState`.
The callback can send a bounded code/state/issuer/error envelope to the parent
using the exact app origin. The parent must check both `event.origin` and
`event.source === ownedPopup`, validate the envelope and recorded redirect,
state, issuer, attempt and generation, then consume the attempt exactly once.
Bad state/issuer/error callbacks must not consume the pending legitimate attempt.
Never post tokens, verifiers or raw `error_description` to product UI.
These source/origin checks follow the browser's
[postMessage contract](https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage).

Popup cancellation, timeout, missing opener and duplicate callbacks are finite
outcomes. The identity provider's or app's
[COOP policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cross-Origin-Opener-Policy)
can separate the popup from its opener; do not weaken global headers to force
compatibility. Full-page redirects lose the in-memory attempt and chat runtime,
so they are not a transparent fallback for this session-only design.

## Minimal adapter placement and session ownership

Implement the finite port beside `platform/runtime/nativeMcp.ts`, for example
`browserMcp.ts` with bounded fetch/OAuth helpers as needed. Install it next to the
browser ProductStore owner and dispose through the existing MCP service owner.
Inject a safe catalogue snapshot/owner seam; platform code must not import Agent
feature policy. Keep the existing private-operation status/readback, candidate
confirmation, CAS revision and teardown semantics instead of substituting a
generic `fetch(url)` bridge.

Use `session_memory` private refs with an opaque owner/revision and in-memory
maps for private configuration, tokens, verifier and discovery state. Public
catalogue metadata may persist, but not private endpoint/query/header/auth data.
No private config in localStorage, sessionStorage, IndexedDB, model messages,
project export or logs. Report `host: 'browser'`, `stdio: false`,
`rememberedCredentials: false`; reload creates reconnect-required records.
Clear the owned maps/listeners on teardown/pagehide and fence publication before
draining, following the current service lifecycle.

Apply existing bounds: 16 configured servers, 8 live generations, 128 tools and
resources, 16 pages, 512 KiB normalized generation, 32 KiB private configuration,
16 KiB arguments/schema and 1 MiB decoded response. Invocation intent/authority
and retained outcomes remain keyed by original operation; status, stop,
disconnect or reconnect must never dispatch that operation again.

For CORS, endpoints must allow the actual methods and request headers and expose
headers the SDK needs to read, particularly session and authentication metadata.
Start with POST/GET/DELETE/OPTIONS; Content-Type, Authorization,
MCP-Protocol-Version, MCP-Method, MCP-Name, MCP-Session-Id and selected manual
headers. Validate the negotiated protocol's actual set in a real browser fixture.
Hidden response headers can break a session even when the HTTP request succeeds.
Browser-forbidden headers, mixed-content/private-network rules and missing CORS
cooperation produce an actionable unsupported connection outcome. Browser access
cannot be repaired with Node fetch, `no-cors` or a new proxy.
See the browser's [CORS behavior](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS).

## Necessary deterministic fixtures for implementation

1. Browser-condition export graph plus a real browser module import. Assert no
   reachable Node/stdin/process imports; check transitive resolved dependencies.
2. Cross-origin local HTTP fixture in an actual browser: success, denied
   preflight, missing exposed session/auth headers, custom headers and expired
   session. Node fetch is not a CORS test.
3. Modern discovery and legacy initialize, repeated cursors, descriptor/page
   bounds, oversize JSON/error/SSE and stalled-body cancellation before parsing.
4. A remote effect counter with lost reply, 401, 403, 404, `input_required` and
   header-mismatch responses. Every original effect sends once; unknown stays
   retained and reconnect/status/stop never increments the counter again.
5. Actual popup/callback fixtures for public preregistration and advertised DCR:
   PKCE, resource, exact redirect/issuer/state, wrong source/origin, bad callback
   followed by valid callback, duplicate/stale/cancel/timeout, blocked popup and
   lost opener. Do not claim third-party compatibility from an injected opener.
6. Serialized refresh, stable rotation, narrowed-grant retirement before dispatch
   and stale-owner publication fence; validate server-side effect counts.
7. Capture real final model/context, diagnostics and exported project bytes to
   prove private config/auth/callback absence; reload leaves public metadata and
   requires reconnect. Chat must stay mounted during login and detail handling.

Only authored research and source/registry inspection were performed here.
There was no package install, application build, SDK browser execution, real
OAuth-provider login or installed desktop/Windows acceptance in this preparation.
