# Stage 2 integration review notes

Status: reviewed and resolved on 2026-10-16 after Stage 1 checkpoint 45bffe3c.
These source-backed findings were assigned to and fixed by their actual owners.
Executed evidence is recorded in [Stage 2 results](./stage-2-results.md); this
file preserves the rationale, rather than duplicating execution receipts.

## Native / Studio boundary

The agreed command is mcp_service_request with a closed action union, actual
SQLite Session and native-issued hostSessionId. The fixed native ProductStore
installation point serves normal and isolated apps. IndexedDB reference storage
cannot fabricate a native session. Native reads current deviceSettings itself;
renderer-provided enabled/configuration/reference fields are not authority.

- Distinguish an absent catalogue record from a present record whose value is
  null. Only the former is the initial empty catalogue. Keep the same 64 positive
  receipts and strict identity/revision invariants as the Studio parser.
- Resource handles must match the frozen server+URI mapping consumed by Studio,
  including escaped/unicode URI data; do not accidentally substitute a native
  opaque handle which normalization drops. No arbitrary URI dereference.
- Bound prepared authorities, invocation receipts and pending connects/logins.
  Capacity exhaustion rejects; unresolved originals cannot be evicted then issued
  again as fresh work.
- Configured loopback address policy must agree across Studio origin validation,
  native OAuth metadata and actual MCP HTTP. The current localhost mismatch was
  assigned to the native owner; either support exact localhost consistently or
  reject it at the configuration boundary.

## Configuration and lifecycle

- Preserve the actual issued boundary for retirement, private prepare and store
  CAS. A known not-started retirement failure must not strand an intent forever
  waiting for a private revision which was never requested. An uncertain
  retirement is reconciled through its idempotent owner before the same original
  prepare is issued once. Unknown private/store acknowledgements preserve their
  original intent and candidate.
- dispose closes local eligibility immediately, but initialization already in
  flight may still return its host. Await that original handshake and clean that
  host rather than acknowledge an unproved drain. Native window/store teardown
  remains the final actual owner.
- Compare authority binding/scope/target by identity fields or owned canonical
  parsing; original caller property order is not an identity component.
- IPC/raw SDK failures cannot enter diagnostic causes or public messages. Keep
  closed safe code, certainty and original operation identity only.
- A dirty draft can cancel beforeunload. Clearing and permanently disposing the
  installed port there strands the surviving page; pagehide/final teardown owns
  permanent disposal. Repeated disposal must observe the original drain after
  an initial draining reply, not cache that intermediate result forever.
- Processes spawned by a connect which fails before registration remain owned
  through handshake/discovery/publication errors until actual drainage. A removed
  pending-connect record cannot stand in for a process-drain receipt.
- Reserve pending OAuth before the first await and retire the local generation
  before beginning login; duplicate controls cannot create two browser attempts
  or leave an old principal eligible while native has retired it.

## OAuth

- SDK AuthorizationCallback::from_redirect_url requires code and does not validate
  error callbacks. The native wrapper must validate state, callback host/path,
  recorded issuer/resource and attempt/configuration identity before consuming
  either success or error callbacks. Wrong issuer/state cannot consume the real
  pending attempt. Test duplicate/error/stale/canceled paths with actual loopback.
- A current() check followed by a separate vault pointer write leaves a stale
  publication gap. Use the same owner serialization/epoch fence at final write,
  plus per-generation slots/CAS so a retired attempt cannot overwrite replacement
  account credentials. Load/save must not recursively acquire the refresh guard.
- SDK debug logging includes authorization code/token-result details. Do not add
  a subscriber that exposes raw SDK secrets. Production host currently has no
  such subscriber; changing that is a separate secret-log review obligation.
- Acquire/refresh credentials before one effect dispatch. SDK reactive AuthClient
  repost and expired-session reinitialization stay disabled.
- SDK refresh can return different granted scopes. Preserve a principal only if
  issuer/resource/client/scopes remain identical; otherwise reject old authority
  before dispatch. Rotation/removal must safely collect obsolete OAuth revisions
  without deleting an uncertain or current credential pointer.
- The released SDK accepts same-origin parent paths as the discovered resource.
  Its private discovered resource can therefore differ while the configured MCP
  endpoint is unchanged. Principal identity must capture the actual accepted
  resource, not hash the endpoint as a stand-in for audience identity.

## Review closure

Finite adapter/coordinator, real native dispatch/readback/drain and deterministic
OAuth fixtures passed independent scoped review. Final review also fixed the
pre-dispatch abort window and closed admission atomically before teardown; callback
listeners remain draining until their actual task finishes. Actual Keychain authorization, Windows execution,
installed browser/firewall/launch behavior and epic full/packaged checks remain
deferred, not inferred from fixtures.
