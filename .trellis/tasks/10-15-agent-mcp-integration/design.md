# E10 technical design

State: planning for final review on 2026-10-16. This is a prospective design,
not implemented compatibility or installed-platform evidence. Scope is governed
by [prd.md](./prd.md); source anchors and SDK citations live in
[product integration research](./research/product-integration-design.md) and
[SDK/OAuth research](./research/sdk-and-oauth-design.md).

## Architecture and ownership

Desktop macOS/Windows is required. Embed the official Rust MCP client in the
existing Tauri runtime; do not add a Node sidecar, Cordis container or another
Agent loop. A finite Studio host port serves both native transports and, where
practical, a browser remote adapter. Reuse the current shared product UI and
ProductStore; the OS secret vault is credential infrastructure, not another
business-data store. Core keeps neutral registry, grant, approval and execution
algorithms; providers keep model protocols. Neither acquires Tauri/MCP SDK or
product dependencies.

| Owner / proposed location | Responsibility |
| --- | --- |
| Agent feature: features/agent/mcp/ | Typed device catalogue, strict commands/queries, run snapshots, manifest normalization, group composition, tool adapters and management UI. Public named entry for Settings; no broad feature barrel. |
| platform/runtime/mcp.ts and native/browser adapters | Finite validated host-service installation and envelopes, capability detection and teardown; no product eligibility policy in a generic IPC dictionary. |
| Desktop Rust mcp modules | Transport, bounded protocol IO, OAuth, secret vault, exact native authorities, invocation status, process drainage and host-session ownership. |
| Existing Agent runtime/commands | Admission, preview, claims, approval, one loop, E07 retention and scoped readback. |
| Existing Settings/ContextPanel | Named MCP connection entry, guarded edits and retained chat. No new application-only page tree. |

Install/clear the port with the current runtime/store owner. Native commands
validate the trusted window, current store session and runtime generation.
Register the normal and isolated-acceptance handler/ACL closure together.
Never expose an arbitrary command name, shell string, filesystem read or
unauthenticated renderer-supplied invocation capability.

## Connection and credential records

Proposed explicit names, to become typed contracts in Stage 1:

- **McpServerConfig**: stable opaque serverId, safe label, configRevision,
  enabled, transport/auth kind, safe endpoint display, and opaque private
  configuration/credential reference. Keep the authoritative catalogue in
  deviceSettings using strict versioned reads, bounded serialization and an
  operation-ID/CAS receipt, not the generic helper which converts read failure
  into missing. No project/sync export involvement.
- **McpPrivateConfig**: actual executable/argument vector/cwd/environment or
  remote endpoint/manual headers/OAuth registration and credentials. Native
  private payloads belong to the vault owner. No model/context/trace projection
  may contain this payload. Token-bearing URL userinfo is rejected; header
  values, environment secrets and tokens never become catalogue display text.
- **McpConnectedGeneration**: serverId/configRevision, immutable normalized
  manifest revision, fresh never-reused registrationId, host session and
  optional authenticated-principal revision. Capability version identifies the
  manifest; registrationId identifies this concrete connection/discovery owner.
- **McpRunSnapshot**: bounded secret-free generation references, exact tool
  wire-name mapping, normalized schemas, safe display text and deterministic
  groups. No secret, raw launch configuration or bearer invocation authority.
- **McpPreparedAuthority**: native/host-issued opaque grant tied to run/call/scope,
  exact binding, operation/target, arguments digest, enabled configuration and
  principal revision. A renderer ID or saved reference alone is not authority.
- **McpInvocationEnvelope**: original operation ID plus current host identity,
  exact binding and prepared authority. Closed outcome states distinguish
  not_started, completed, protocol_error and unknown; status readback by that
  operation ID never reissues a tool call.

Saving configuration does not connect/start a server. Connect is explicit;
startup restores configuration and disconnected status only. Each operation
uses current enabled configuration. Change/disable/disconnect/remove first
retires dispatch authority, then cancels/drains that owner. Reconnect or changed
catalogue/account issues a new generation; old approval/run data cannot attach
to it. A same-principal token refresh can retain the generation only if issuer,
resource, client registration and granted scopes do not change.

Native vault write and ProductStore commit are separate boundaries. Prepare a
new bounded vault revision, CAS-publish only its reference, and reconcile the
original receipt before deleting either revision. A confirmed failed CAS can
collect its own unreferenced candidate; an unknown acknowledgement remains
quarantined and cannot restore old enablement or delete a possibly current
secret. Removal retires live authority even if vault cleanup fails; report
actionable cleanup failure at the connection surface. Do not claim a cross-store
transaction or fall back to plaintext.

Use maintained native secure storage through the researched published target
providers: keyring-core 1.0.1, apple-native-keyring-store 1.0.2 with classic
Keychain, and windows-native-keyring-store 1.1.0 with explicit Local persistence.
Do not use obsolete keyring 3.x feature recipes. Windows credential
size limits require bounded chunked credential groups with an opaque revision
manifest, per-connection serialization, staged replacement and readback. Do not
store an entire arbitrary OAuth token JSON in one Windows entry. Bound private
payloads to 32 KiB and each actually stored blob (including encoding) to at most
2 KiB, with a small bounded manifest and at most 32 chunks per revision.
Retire/delete only keys belonging to that connection/credential revision.
Namespace vault keys by app/runtime profile, store identity and server ID so
normal and isolated acceptance apps cannot share credentials accidentally.
Stage 1 must verify exact published provider APIs and failure semantics before
production UI claims remembered credentials work. Vault unavailable means a
typed failure; no silent plaintext alternative.

Web private configuration/tokens are memory-only for the tab session. Persistent
catalogue rows can retain safe labels/remote addresses but never session tokens.
After reload show reconnect/login-required; do not promise desktop secret-store
semantics. The browser cannot start stdio.

## SDK and transport policy

Use the published Rust SDK line established in research (rmcp =3.5.1),
with explicit feature selection and lockfile. Stage 1 is a bounded executable
compatibility spike before UI integration: prove the chosen lifecycle,
cancellation, output limits and no-replay switches against real fixture servers.
Do not assume README examples or transitive Tokio/HTTP features are sufficient.

- Negotiate only verified SDK protocol versions, including current discover and
  compatible initialize lifecycle where supported. Do not advertise universal
  MCP-version compatibility. Record the exact tested versions in delivery notes.
- Explicitly disable HTTP expired-session reinitialization/repost
  (reinit_on_expired_session(false) in the researched release). Do not wrap
  tools/call in generic retry, auth-refresh retry, reconnect or resume replay.
- Reconnection/discovery can be retried as an explicit connection operation;
  retrying an external effect requires a new user-authorized call after the
  original uncertain outcome has been handled through existing recovery policy.
- Configure URL/redirect policy and deadlines before the SDK sends requests.
  Remote MCP, metadata, registration, token and revocation endpoints use named
  scoped purposes. Reject URL credentials/control characters and unsafe scheme
  downgrade; bind bearer tokens to their resource/audience and do not forward
  them across arbitrary redirects. HTTPS is normal; loopback HTTP is available
  for fixtures and explicitly configured local services.
- Enforce bounds while reading framing/HTTP bodies before full allocation,
  including decompression and SSE event sizes. A post-deserialization size check
  alone is insufficient. Use bounded SDK IO adapters/client traits if necessary;
  avoid a second handwritten protocol implementation.
- Unsupported server-initiated sampling/elicitation/subscriptions receive a
  bounded protocol rejection. Do not expose model, filesystem or paid-operation
  authority because a server requests it.

For stdio spawn a configured executable with an argument array, never a shell.
No implicit npx/download/install. Scrub inherited environment and add explicit
user-selected variables; environment scrubbing is not an OS sandbox. Own stdout,
stderr, child lifetime and platform process tree separately. Use process-group
ownership on macOS and a Windows Job Object/kill-on-close equivalent; observe
actual child exit/drain. A Stop request cancels its operation and waits truthfully;
disconnect/teardown retires the whole connection and drains the process tree.
If process termination becomes necessary, invalidate the generation first.
Do not claim cancellation reversed external work.

The first host lifetime remains the current foreground app/window session.
No continuation after app exit, independent daemon or E11 reattachment promise.

## OAuth ownership

Native login creates a bounded single-use PKCE/state attempt tied to server,
configRevision, connection attempt, issuer/resource and exact redirect. Open the
system browser through the existing trusted opener. Use a dedicated ephemeral
loopback callback listener bound to loopback; do not reuse the media listener.
Validate state, exact callback path/authority, issuer where supplied and the
original attempt before exchanging the code. Wrong/stale/duplicate callback,
timeout, cancellation, disconnect, configuration edit and window teardown cannot
publish credentials into a replacement. Close listeners and retire verifier/state
on every exit. Native client secrets cannot be treated as confidential identity.

Use SDK discovery/PKCE/refresh machinery where its released seams fit, with the
current MCP metadata/client-registration methods that were actually verified.
Support public client registration/preregistered client IDs; unsupported provider-
specific extensions produce a clear connection error rather than custom browser
automation. Do not assume all servers offer dynamic registration or refresh tokens.
Refresh is serialized per credential identity, updates the vault before publishing
a usable receipt, and never replays a potentially sent tools/call. Expired/rejected
credentials require login when refresh is unavailable.

Browser remote support can use the official @modelcontextprotocol/client 2.3.1
release verified by research through the same port. Compatible endpoint/CORS/public-client registration
is required for MCP, discovery and token exchange. Attempt a same-origin callback
route plus bounded in-memory PKCE attempt and exact-origin popup messaging. If
deployment, popup return or endpoint support is absent, show desktop-required/
unsupported guidance at the connection entry. Do not add a proxy/backend or
persist browser refresh credentials to make parity appear complete. This optional
adapter follows desktop integration and does not block its delivery.

## Discovery, schema validation and tools budget

Fetch a complete bounded generation before replacing registration. On an invalid
refresh keep the prior valid generation if the same owner is still usable;
otherwise publish disconnected/unsupported. Never partially swap a tool list.
Coalesce list-change notifications and issue a fresh generation after validated
replacement; saved runs remain bound to the old generation and may be rejected,
not silently upgraded.

Initial engineering bounds (lower limits may be imposed by existing context/
result quotas; changing these requires corresponding tests, not user scope):

| Surface | Limit / disposition |
| --- | --- |
| Device catalogue | 16 configured servers; 8 connected generations; 2 MiB serialized public catalogue maximum |
| One discovery generation | 128 tools, 128 resource descriptors, 16 pages per list; repeated cursors fail |
| Tool/schema data | 32 KiB per tool, 16 KiB input schema, depth 32, 512 KiB normalized generation total |
| Names/text | Raw names bounded before normalization; model tool name <=64 ASCII chars; description <=2 KiB; use safe bounded labels |
| Resource read / tool reply | 1 MiB decoded protocol message before retention; binary payloads not imported; smaller existing E07 quotas still apply |
| Operation / OAuth | Finite request, connect and drain timeouts; OAuth attempt 5 minutes, one active attempt per connection |
| Diagnostics | Closed safe fields and bounded stderr counters; no raw headers, URLs with private data, tokens, stderr dumps or protocol payloads |

Compile server JSON schemas through a maintained validator with remote reference
fetching disabled. Reject unsupported dialect/features and unresolved external
references explicitly, bound complexity before compilation, and validate arguments
again at prepare/dispatch. Server risk/idempotency annotations are informational.
Initial external tools use host-owned network-effect/high-risk, non-atomic policy
with no atomic/repeatable/generation recovery marker. Existing ask/assist/full
permission rules apply; a server cannot lower them through annotations.

Stable public names include opaque server identity plus a collision-resistant
digest of raw server tool identity. Freeze the raw-name mapping; never parse a
public name to recover a current target. Count all actual foundation/task/installed-
skill/resource helpers. Partition sorted external tools into deterministic groups
which each fit 36 minus that foundation. Preserve at-most-two requested groups,
pending-call pins and total 36 cap. No generic mcp_call(name,args) bypass.
load_tool_groups reads only the run's captured catalogue, with no hidden network IO.

Offer bounded per-server resource list/read helpers under the same budget.
A resource handle is tied to the exact generation and discovered URI/template;
a returned link is not permission for HTTP/local file access. Text/JSON is
attributed untrusted data, not system instructions. Refuse unsupported binary/
image/audio import in this task. Resource metadata is not automatically injected
as content, and reading retained reports does not need the server online.

## Actual Agent integration and retained results

1. The shared admission/preview composer captures eligible already-connected
   generations before finalizing names, groups and token estimates. No discovery
   IO occurs inside a ProductStore transaction; recheck the capture before
   admission publication. Conversation mode has no MCP surface; a run without
   an MCP capture does not acquire today's connections on retry/resume.
2. Materialize a per-run registry from its saved snapshot and builtin definitions.
   Use core createCapabilityRegistry freezing/current-binding mechanisms; no
   mutable global tool array or display-name lookup at effect time.
3. Studio runChat.request must use the exact offeredDefinitions passed by core
   for the model request and matching budget. Save binding explicitly in tool
   rounds; include it in claimFingerprint and E07 call-revision/job envelopes.
4. Prepare parses arguments, acquires exact host authority and builds a bounded
   plain-text preview. Existing approval applies. Final ProductStore claim checks
   the saved call/approval/binding; host dispatch independently checks current
   configuration, generation, credential principal and grant immediately before IO.
5. Extend AgentJobSelection with a finite MCP tool/resource variant. E07 admission
   and local publication stay atomic; external IO stays outside transactions.
   Retained report completion is distinct from external effect certainty.
   Fix the existing publication assumption for the MCP variant: an unknown effect
   may retain a report but its original call stays unknown and the loop remains
   blocked. Do not mark it completed merely because report chunks were saved.
   The adapter must raise the reviewed typed unresolved/pending outcome after
   retaining unknown evidence; returning a normal descriptor would enter core's
   ordinary running-to-completed branch. Extend E07 savedResult/publication
   reconciliation to read retained unknown evidence without treating it as
   established completion or permission to repeat.
6. Bounded known replies publish once through the original E07 owner. Lost send/
   completion/publication acknowledgements reconcile by original operation/job/
   call IDs, never by another external invocation. Preserve an acknowledged
   completion even when Stop, disconnect or catalogue replacement arrives late.
   Retired generations cannot dispatch again or publish into a replacement,
   but a verified original reply may settle only its exact original invocation/
   job/call if those owners still exist. Do not discard success evidence through
   a blanket postflight current-generation check; deletion prevents resurrection.
   Historical report readers retain current scope, paging, explicit clear and
   deletion semantics.

No local database transaction can atomically roll back a remote effect. A host
restart retires ephemeral authorities; old snapshots remain evidence only.
Revocation after the final send boundary cancels/drains work but cannot undo it.

## Management UX and current-data compatibility

Use the Settings connections subsection plus Agent menu entry into the shared
retained ContextPanel for server list/detail. Provide explicit save, connect,
authorize, disconnect, enable/disable and remove controls, with ordinary success
quiet. Show transport/capability/auth errors here. Unknown write outcomes retain
the user's intent and disable duplicate mutation until receipt reconciliation.
Guard unsaved changes and keep the running chat mounted in wide and narrow views.
Keep credentials out of context preview and raw diagnostic panels. No temporary
preparation/model-check/user-bubble status text or drawer navigation.

Use fresh development fixtures and the existing source schema policy. Optional
run MCP metadata expresses actual feature absence in current records, not a
historical migration reader. Do not add compatibility aliases, backfill or reset
the user's store as an implementation shortcut.

## Rollback and evidence limits

Each reviewed stage is a separate commit. Disable the new connection entry/port
if a stage cannot pass its necessary checks; never delete product data or silently
replay an unresolved call to recover. Vault candidates/old generations remain
owned until explicit reconciliation and cleanup. Record source-native checks,
real protocol fixture execution, compiled OS coverage and installed acceptance
as different evidence. Full regression/build/packaging and actual installed
macOS/Windows gates remain at epic end; a macOS source test is not Windows proof.
