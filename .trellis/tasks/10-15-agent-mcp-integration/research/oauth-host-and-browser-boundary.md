# E10 OAuth host and browser-edition boundary

Date: 2026-10-16. The owner selected OAuth browser login together with manual
Token/request-header connections for the first remote delivery. This document
records inspected seams and candidate design constraints, not implemented or
tested authentication behavior.

## Inspected product seams

- `apps/web/src/main.tsx:1` imports the shared Studio bootstrap. Browser product
  behavior and routes therefore belong in Studio; do not create another MCP
  page tree in the web entry.
- `packages/studio/src/platform/runtime/runtimeExternalLinks.ts:5` routes native
  external HTTP(S) anchors through `nativeSystemServices.ts` and the system
  browser, preserving the trusted product WebView.
- `nativeSystemServices.ts:104` invokes `product_open_external`.
  `apps/desktop/src-tauri/src/runtime_services.rs:275` checks the trusted window
  and validates the URL before using the native opener. This is an opening seam,
  not an OAuth authorization-result receiver, token store or refresh handler.
- `product_media/server.rs:43` demonstrates an existing loopback-bound native
  service. It owns media tokens/requests; its listener and authority must not be
  reused as an OAuth callback merely because both use loopback HTTP.
- `platform/runtime/runtimeFetch.ts:33` tears down in-flight native fetches with
  page lifecycle. Its product HTTP policy has finite purposes. A general MCP
  SDK transport must have an explicit approved HTTP owner and deadlines; it
  cannot silently bypass existing URL/credential/redirect policy.
- The existing model-connector record stores supplied API keys through
  ProductStore. Neither that record nor the opener establishes native secure
  credential-vault storage. MCP credential storage remains a separate design
  obligation; no new plaintext/encryption claim is inferred from this source.

## Primary-source constraints

Checked on 2026-10-16:

- [MCP authorization](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization)
  defines HTTP authorization, metadata discovery, client registration and
  resource-bound tokens. Callback handling must retain the issuer and PKCE
  attempt identity; token renewal cannot be treated as permission to replay an
  external tool effect.
- [RFC 8252](https://www.rfc-editor.org/rfc/rfc8252.html) describes native OAuth
  with an external user-agent, public-client PKCE and loopback redirect options.
  A loopback receiver opens for the authorization attempt and closes afterward.
  Its Windows and macOS sections describe platform-specific redirect choices.
  This supports investigating a native-owned short-lived callback receiver; it
  does not establish actual packaged behavior on either OS.
- [Browser CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS)
  requires server cooperation for JavaScript cross-origin requests. A browser
  client cannot bypass that requirement through its own fetch options. Remote
  MCP, discovery and token endpoints may each need compatible browser access.

## Candidate desktop authorization ownership

An explicit user login action captures server ID/configuration revision and
connection generation. The native owner creates a bounded PKCE/state attempt,
opens the authorization URL in the system browser, and receives only its exact
callback. Cancellation, timeout, configuration replacement, removal and window
teardown retire that attempt. Old, duplicate or foreign callbacks cannot update
the replacement connection. Credentials remain outside model/tool-result and
routine diagnostic projections. A login result is distinct from an external
tool-call success.

Prefer an existing maintained protocol/OAuth SDK after checking its exact
version and callback/refresh seams. Do not hand-roll protocol framing or assume
a successful login provides filesystem/network sandboxing. The pending browser
scope determines whether a browser SDK/client port is also required alongside
the native host. No SDK or credential dependency has been installed or selected.

## Product scope still to select

Opening the system browser to authorize Cuepoint desktop is already in scope.
Providing MCP inside Cuepoint's browser edition is a separate compatibility
decision:

| Option | Result | Additional work / limit |
| --- | --- | --- |
| Browser remote MCP + OAuth alongside desktop | Browser users can connect compatible remote services; local stdio remains desktop-only | Web callback/deployment routes, browser credential lifecycle and cross-origin endpoint compatibility need their own checks |
| Desktop MCP first | Both desktop transports and OAuth ship for macOS/Windows; browser users continue existing Agent features | Browser remote MCP remains a later feature, even though the desktop login itself opens a browser |

Recommendation: include browser remote MCP and OAuth with explicit supported-
endpoint/CORS behavior, while keeping stdio on desktop. This preserves the
shared product experience where technically supported, at the cost of the
extra web callback/transport validation. Owner selection is pending; do not
silently include a proxy/backend, claim universal endpoint compatibility or
narrow the already confirmed desktop scope.

## Candidate stage partition after scope convergence

1. Connection records/credential references and portable server/tool identities;
   exact host capabilities and frozen registry contracts, including schema and
   output bounds.
2. Native stdio/Streamable HTTP lifecycle and remote manual/OAuth authentication;
   browser remote adapter/callback only if that compatibility scope is selected.
3. Shared connection management and explicit enablement, Agent discovery/
   approval/dispatch, attributed tools/resources and retained results; verify
   replacement/disconnect/Stop/no-replay end to end with deterministic servers.

These are planning candidates, not committed implementation stages. Final
design must establish dependencies and verifiable outcomes before activation.
Per-stage checks remain necessary affected checks only; full application build,
packaging and installed cross-platform acceptance remain at the epic end.
