# E10 Stage 2 desktop service and authentication results

Status: independently reviewed and source-frozen on 2026-10-16. This checkpoint
completes the desktop connection/authentication owner, before Agent/UI integration.
Stage 3 follows under the existing sequential stage-commit authorization.

## Delivered boundaries

The fixed native ProductStore installs one finite MCP service port. Its exact
mcp_service_request handler, normal and isolated registrations, generated command
permissions and trusted-window checks move together. Native independently reads
the current SQLite catalogue and validates the genuine store session; renderer
IDs or enabled flags cannot authorize a different configuration.

Explicit connection owns bounded stdio/Streamable HTTP discovery and original
prepare/invoke/status/stop receipts. Saving never launches a process. Configuration
coordinates retirement, native private revision preparation, public ProductStore
CAS and original confirmation without vault/network IO inside a transaction.
Uncertain original acknowledgements reconcile rather than repeat effects or
infer rollback. Failed connection attempts retain already-spawned process owners
until actual drain, including unpublished child/descendant cleanup.

Native OAuth uses the production SDK, real loopback PKCE/state callback and a
system-browser opener, with exact issuer/resource/client/attempt binding. It
supports pre-registered public clients and advertised DCR. Token acquisition is
before the single MCP dispatch; no reactive authentication/session retry repeats
an effect. Same-identity refresh may retain a connection; changed granted scopes
retire the original principal before dispatch. Secure credential revisions use
bounded chunks and original pointer readback, including rotation/removal cleanup.

## Review corrections

- Canceling beforeunload keeps the surviving page's port usable. Permanent
  teardown belongs to pagehide/actual close. Both adapter and connection owners
  can observe draining followed by drained from the same native owner.
- Disposal waits for an already-issued initialization and cleans its returned
  original host/session. Pending connects/logins are fenced before replacement.
  OAuth reserves before the first await and retires the old local generation.
- Connect/invoke check cancellation again immediately before IPC after async
  initialization/session lookup. A stopped request which never dispatched is
  not_started; it cannot slip through after a prior Stop found no invocation.
- Original invocation reservation and generation retirement are serialized at
  the actual dispatch boundary. Retired/failed connection cleanup cannot vanish
  merely because a registration or pending row was removed.
- Native catalogue parsing distinguishes missing from present-null records and
  matches finite receipt/revision constraints. Resource handles share the exact
  frozen server/URI identity across languages, including Unicode and escaping.
- Forged OAuth error callbacks cannot consume a legitimate attempt. Final
  credential publication uses the retirement fence; refresh identity changes
  cannot reuse an old approval, and obsolete token revisions are safely collected.
- Principal resource identity is the actual SDK-accepted PRM identifier, including
  parent-path/query changes at the same endpoint. Login uses the same successful
  metadata resolution. Teardown closes admission before capturing owners, and
  canceled listeners remain draining until their original task finishes.
- Public errors contain closed safe codes/identity only; raw IPC/SDK credentials,
  configuration, response payloads and diagnostic causes do not escape.

The SDK closes the response channel when cancellation wins for the exercised
transports. A lost delayed reply therefore remains unknown, with no automatic
replay. Separately, a verified original completion remains readable after
retirement even when renderer acknowledgement/retrieval is delayed; no stale
generation postflight check discards established evidence.

## Necessary executed evidence

- Independent Studio source check: 4 suites / 45 tests passed through the finite
  MCP source profile; finite noEmit passed; 9 affected source ESLint checks passed
  with 0 errors / 0 warnings. The affected ownership check covered 657 files with
  no ledger failures; this is not the complete architecture/formal gate.
- Native production OAuth fixtures: final 13 tests passed, including actual Service
  login/connect/prepare/refresh/invoke with effect counters. Ordinary refresh
  dispatches once; changed scope dispatches zero times. Memory SecretStore and
  injected browser opener are explicit fixture seams.
- Native combined MCP check after resource/admission fixes: 39 passed, 1 actual
  Keychain opt-in ignored, 121 filtered. After the final listener-drain correction,
  affected OAuth (13 passed / 149 filtered) and Service (12 passed / 150 filtered)
  modules passed independently; no new combined count is inferred. Earlier normal
  desktop/test-hooks and acceptance --lib profile compilation passed. Scoped Rust
  formatting and final tracked whitespace checks passed. Final staged whitespace
  validation includes every new source before commit.
- Actual ProductStore actor tests covered missing row, present-null and stale
  sessions. Real service fixtures covered both transports, original receipts,
  no replay after reply loss/401/session expiry, failed/pending process drainage,
  final admission closure and canceled callback listener completion.

## Evidence limits

Real TCP/stdio/SDK/ProductStore source checks do not establish installed desktop
behavior. Actual Keychain authorization, Windows vault/Job Object execution,
system browser/firewall/loopback and signed/installed launch paths remain pending.
Agent offers, approval and retained E07 execution are Stage 3; management and
practical browser remote support are Stage 4. Whole formal quality/regression,
application builds, packaging and installed macOS/Windows acceptance remain at
the parent epic's final batch. E08/E09 deferred gates remain independent.
