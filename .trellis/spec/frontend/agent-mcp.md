# MCP connection and execution contracts

## 1. Scope / Trigger

E10 adds desktop-first MCP support to the existing Agent and ProductStore.
Stage 1 establishes strict device configuration, immutable discovery and bounded
native SDK adapters. Stage 2 adds the finite desktop port, connection/configuration
owners and native OAuth/service lifecycle. Stage 3 connects the actual Agent
surface and E07 retention. Stage 4 adds shared retained management and compatible
browser remote connections. Review each stage against
actual executed evidence. Keep macOS/Windows
evidence separate; practical browser remote support must not require a proxy
or block desktop delivery.

## 2. Signatures / Owners

- Agent mcp/commands/catalogue.ts: mutateMcpCatalogue(input, store?) returns
  McpMutationReceipt; reconcileMcpMutation(input, store?) returns committed,
  unresolved or conflict. Both use explicit deviceSettings transactions.
- Agent mcp/queries/catalogue.ts: getMcpCatalogue(store?) uses strict reads.
  runtime/records.ts owns the agentMcp.catalog.v1 record and typed parsing.
- McpCatalogueMutation carries operationId, catalogueRevision, serverId and
  expectedConfigRevision, plus one finite save/set_enabled/remove operation.
- platform/runtime/mcp.ts owns McpHostServices and its private-revision
  prepare/status/discard, connect/disconnect, prepare/invoke/status/stop/dispose
  operations, plus initialize, private confirmation, retirement and finite OAuth
  begin/status/cancel. Saved IDs do not grant native authority.
- Agent mcp/runtime owns normalizeMcpManifest, compileMcpInputSchema,
  composeMcpRunSnapshot, resolveMcpSnapshotTool and mcpPrivateCleanupDecision.
- platform/runtime/{nativeMcp,mcpWire,mcpErrors,mcpServices}.ts owns the exact
  mcp_service_request adapter, bounded decoded replies, closed safe errors and
  install/read/clear lifecycle. platform/product/store.ts installs it only beside
  the actual fixed SQLite driver, for both normal and isolated apps.
- Agent mcp/runtime/configuration.ts owns createMcpConfigurationOwner and original
  multi-boundary save/mutate/reconcile intents. runtime/connections.ts owns
  createMcpConnectionOwner, explicit connect/login, current frozen generations and
  local retirement. These feature owners do not become another store or Agent loop.
- Rust mcp/{bounded,transport,process,vault,protocol,catalogue,service,oauth} owns
  SDK IO, exact endpoints, owned processes, CredentialVault over SecretStore and
  native connection/login/invocation authority. The SDK is rmcp 3.5.1. The trusted
  desktop handler and normal/isolated ACL closure must move together.

## 3. Contracts / Invariants

**One store and two commit boundaries.** The public device catalogue contains
safe labels/origins/kinds, revision/enablement and opaque private references.
Actual executable/arguments/environment, endpoint query, headers and tokens
are host-private. No network or vault IO occurs inside the catalogue transaction.
A prepared native revision and the ProductStore pointer are not one transaction.

Catalogue mutation uses CAS against both catalogue/config revisions and records
a positive receipt for the exact intent. The bounded receipt ring retains 64
entries; absence or eviction does not establish rollback. Same operation ID and
different fingerprint conflicts; identical acknowledged intent returns its
original receipt. An absent catalogue is the legitimate initial empty state;
corrupt/read-failed records reject explicitly. Unknown/conflicting outcomes
quarantine private cleanup.
Only acknowledged retirement or established rollback can propose collection;
the native owner must independently refuse current references.
Compare private-reference identity by kind/ownerId/revisionId fields, never
JSON serialization/key order, including confirmed-rollback cleanup proposals.

**Installed host and operation certainty.** The finite wire carries version,
original operationId, real NativeSession and native-issued hostSessionId. Native
validates the trusted window and actual current store/session/catalogue itself;
renderer configuration assertions do not establish enablement or credential
ownership. IndexedDB reference storage cannot fabricate the native session.
Only explicit connect starts IO/processes; configuration restoration does not.

Retire local generation eligibility before edit/disable/remove/disconnect. Clear
or dispose closes local calls immediately, then awaits the original in-flight
initialization before disposing that returned host. A missing handshake reply is
not proof that native did nothing. Store/window teardown retains actual cleanup
ownership; a renderer unload promise cannot establish process drainage.

A canceled beforeunload is not owner termination: the draft guard may keep the
same page alive. Permanent service clearing belongs to pagehide/final teardown;
an early unload hook must remain recoverable. When dispose reports draining,
later disposal/status must await the same original cleanup owner and observe
its eventual drained receipt, rather than cache draining forever. Failed or
canceled connection attempts own every already-spawned process until actual
drain, including handshake/discovery/publication failures before registration.
Close admission and capture existing owners under the same state lock before
retirement starts, so teardown cannot miss a newly admitted server. Canceled
OAuth listeners remain draining until their original task has actually finished;
issuing a cancellation token alone is not a listener-close receipt.

The configuration owner records whether retirement, private prepare and catalogue
CAS were actually issued. A proven pre-write rejection can settle without waiting
for a nonexistent private candidate. An uncertain retirement uses its idempotent
native owner; unknown private/store acknowledgements reconcile the exact original
intent, never prepare a fresh revision or repeat a store mutation. Preserve
unresolved intent capacity; do not evict uncertain originals to make room.

IPC/SDK failures expose only closed safe codes, certainty and original identity.
Do not chain raw SDK errors, response bodies or private launch/header data into
public diagnostics. Own bounded request data before the first await so callers
cannot change a queued target. Compare parsed identity fields, not caller object
property order.

**Two manifest identities.** McpHostBinding.manifestRevision is the host's
opaque frozen raw-catalogue revision. Studio's normalized manifest revision is
a separate digest used for local snapshot/core version identity. Capture both;
never require Rust to reproduce JavaScript serialization or equate their hashes.
Raw names map through frozen collision-resistant public names, never through a
current label/name lookup. Binding includes server/configuration/registration/
host-session/principal identity. Reconnection does not revive old authority.

**Bounded discovery and schemas.** Initial limits are 16 configured/8 connected
servers, 128 tools/128 resources, 16 pages per list, 2 MiB public catalogue,
512 KiB normalized generation, 32 KiB per tool and 16 KiB input schema/arguments.
Repeated cursors, oversized generations and invalid schemas fail explicitly.
Schema admission bounds depth/nodes and accepts a defined 2020-12 subset.
@cfworker/json-schema 4.1.1 supplies eval-free argument validation; do not relax
CSP or replace it with handwritten schema semantics. Unsupported regex/format,
contains/multipleOf/dependencies/unevaluated/dynamic or remote references,
recursive references and prototype-special keys reject rather than disappear.
Supported local definitions are bounded and resolved before validation.

Groups count actual foundation and resource helper names against the existing
36-tool/two-requested-group limit. Partition frozen tools deterministically;
one arbitrary large server cannot bypass the budget through a generic call tool.
Saved snapshots are secret-free evidence, not current invocation authority.

**Native IO and no replay.** Bound stdio lines and HTTP JSON/SSE/OAuth metadata
before unbounded allocation/deserialization; enforce finite deadlines. The first
SSE adapter conservatively caps the whole response at 1 MiB and never resumes
through generic retry. Explicitly disable expired-session reinitialize/repost.
Do not wrap tools/call in rmcp AuthClient's reactive AuthRequired refresh/repost:
obtain/refresh a token before the one fresh dispatch, then fix its header to that
attempt. A lost response, 401 or expired session cannot authorize replay.
Diagnostics use closed safe errors and bounded stderr counters, never raw data.

**Processes and credentials.** Spawn explicit executable/argument vectors with
scrubbed inherited environment, Unix process groups/Windows Job Object ownership,
and bounded stderr drainage. Observe actual exit on Stop; closing UI/streams or
dropping a handle is not a completed drain receipt. Environment filtering and
process groups are not an OS sandbox.
Keep the same managed process-tree drain task across Stop timeouts. Rebuilding
process-wrap wait() after cancellation can observe cached parent exit before
descendant drainage; repeated Stop must await the original drain, not report
drained from that cached intermediate state.

Private vault payload is <=32 KiB, each actually stored encoded blob <=2 KiB,
and at most 32 chunks per revision. Write original intent and immutable chunks,
then a small manifest last; reconcile original versions after lost write/delete
acknowledgement. Serialize credential mutation and refresh by connection; do not
reacquire the same refresh lock in load/save. Namespace by app/profile/store/
server, use Windows Local persistence, and fail closed without plaintext fallback.
Normal and isolated acceptance apps cannot share credential namespaces.

**OAuth ownership.** Use the native system-browser opener and a fresh short-lived
numeric-loopback callback listener, exact recorded path/Host/redirect URI, S256
PKCE, state and discovered issuer/resource/client identity. Pre-registered public
clients and advertised DCR are supported by the SDK seam; missing registration is
an actionable refusal. Do not invent a hosted client metadata document or backend.

Validate success and error callbacks before consuming an attempt. The SDK URL
parser requires code and does not validate an OAuth error callback for this host.
A forged state/issuer, duplicate parameter or wrong callback target rejects while
keeping the legitimate pending attempt available. Cancellation, timeout, retirement
and consumed callback close the listener; stale attempts cannot exchange/publish
for replacement configuration or account owners.

Serialize refresh and final credential publication under the same owner fence.
A current() check before a separate pointer write is insufficient; retirement must
not fit between the check and publication. Use immutable revisions and owned slots
so late writes cannot replace a current registration. Token refresh rejection
never starts interactive login or repeats an effect. Keep raw SDK debug token/code
logging out of installed diagnostics/subscribers.

Refreshing a token may retain principal identity only while issuer, resource,
client and granted scopes remain identical. A refresh which changes those facts
must retire the old principal before dispatch; existing approval cannot gain the
new identity. Resource means the actual SDK-accepted protected-resource metadata
identifier; the configured endpoint is not a substitute. The SDK also accepts
same-origin parent resource paths, so equal endpoints do not prove equal audience.
Collect retired OAuth revisions only after an acknowledged current
pointer or proven original rollback; uncertain writes remain quarantined.

## 4. Validation / Error Matrix

| Trigger | Required behavior |
| --- | --- |
| Corrupt or unreadable catalogue | Explicit read error, no silent missing/reset |
| Stale catalogue/config CAS | Conflict with zero new pointer publication |
| Reused operation ID, changed payload | Conflict, no second mutation |
| Unknown receipt or possible late commit | Retain intent/private candidates; read back original operation |
| Unsupported schema, repeated cursor or size overflow | Explicit rejection; no partially admitted generation |
| Binding replacement before dispatch | Reject old authority; never target the replacement |
| Reply loss/session expiry/401 after possible effect | One dispatch; retain truthful unknown/effect evidence |
| Vault chunk/manifest write loses acknowledgement | Reconcile original immutable revision, no overwrite/unsafe collection |
| Vault unavailable | Typed failure, no plaintext fallback |
| Stop/disconnect | Report actual pending/drained state; external effects are not reversed |

## 5. Good / Base / Bad Cases

Good: publish an opaque private revision through an acknowledged catalogue CAS,
then collect only an unreferenced retired revision through its native owner.
Base: an unknown CAS keeps the candidate quarantined while original receipt
readback resolves. Bad: missing receipt implies failed commit, so delete a
candidate or create another operation to repeat the same intent.

Good: a frozen public tool name resolves to its original raw tool and binding.
Bad: reconnect a same-label server and reuse its old approval.

## 6. Tests Required

- tests/mcpCatalogue.test.ts: real ProductStore strict reads, CAS conflicts,
  original receipts/unknown acknowledgement, bounded catalogue and safe projection.
- tests/mcpManifest.test.ts: schema/argument validation, invalid complexity/refs,
  public-name collision resistance, immutable snapshots, deterministic groups,
  helper accounting and exact binding refusal.
- Finite vitest.mcp-source.config.ts and matching noEmit profile must discover
  the actual selected tests; include .test.tsx explicitly when UI tests arrive.
- Rust mcp tests: real current discover/legacy initialize stdio+HTTP, effect
  counter stays one on reply loss/session expiry/401, pre-parse limits/deadlines,
  actual available-host child+ordinary-descendant stop, vault intent/chunk/manifest/
  delete acknowledgement loss and refresh serialization.
- A controllable process-wrapper regression must hold descendant drainage past
  the first Stop timeout and prove a second Stop does not report early completion.
- Stage 2 finite wire/coordinator tests must exercise actual ProductStore CAS,
  unknown prepare/store acknowledgements, original reconciliation, retired pending
  connect/login, duplicate controls, initialization/dispose, session replacement,
  bounded malformed replies and absence of secrets in public errors.
- Native service fixtures must exercise the actual prepared/invoke/status owner,
  atomic original-operation reservations, final retirement fences and truthful
  repeated disconnect/dispose drainage. Wrong/stale authorities cannot dispatch;
  known late replies settle only their original invocation receipts.
- Native OAuth fixtures use real TCP metadata/DCR/token servers and the production
  loopback receiver with an injected opener/SecretStore. Verify PKCE/resource,
  pre-registration, wrong/error/duplicate/stale callbacks, cancel/timeout, missing
  registration, serial refresh/rotation and stale publication fencing. Clearly
  label memory SecretStore as fixture evidence.
- Real Keychain test is explicit opt-in and cannot be counted when ignored.
  Unix fixtures/compilation do not prove Windows credential/Job Object execution.
  Full app, installed hosts and packed-library gates remain epic-end acceptance.

## 7. Wrong vs Correct

Wrong: persist token/argv in the product catalogue, equate normalized JS hash
with a native raw revision, or silently retry a tool after refreshing credentials.
Correct: safe catalogue plus host-private revision; preserve separate immutable
identities and obtain credentials before a single authorized dispatch.

Wrong: report a saved unknown-effect report as completed or discard an established
original reply after reconnect. Correct: Agent integration must retain the
unknown barrier, and verified late evidence may settle only surviving original
invocation/job/call owners. It cannot write into a replacement or resurrect deletion.

## 8. Agent surface and retained execution

New-send admission and next-context preview use one pure surface composer. Capture
already-connected generations before the ProductStore transaction; inside the
final transaction check the actual public catalogue and synchronous local owner
identity without host IO. Connection state is not a durable store mutation:
subscribe to the concrete connection owner's revision so an opened preview and
management surface update after connect, login retirement or disconnect.

Persist an optional secret-free AgentRun MCP snapshot. Conversation mode has none.
Retry/resume uses the saved capture; absent legacy snapshots cannot acquire live
connections. Materialize exact per-run tools with core createCapabilityRegistry
and its immutable/current-binding checks. Advertised schema construction remains
possible offline; prepare and execute require actual current host authority.
The model request uses core's supplied offeredDefinitions, including the matching
context budget, rather than reconstructing another registry view.

Count loader, task, installed-skill, read_job_result and per-server resource helpers
in the real foundation before partitioning server tools. Preserve 36 total tools,
two requested groups, pending-call pins and next-request group activation. A tool
named before that request offered it cannot execute in the same round.
If the final resource/helper foundation makes an existing business group too
large, partition it deterministically by that capacity as well. Preserve its
ordinary identifier when it fits; never advertise a permanently unloadable group.

Round records explicitly preserve binding; durable claim and E07 call revisions
include it. Safe preview facts capture exact binding, normalized manifest digest,
public name and finite target/operation. Ephemeral prepared bearer authority is
never a saved preview/run/export field. Approved continuation can prepare again
only against the same facts; it cannot retarget to a replacement generation.
External tools remain network/high-risk/non-atomic with no automatic recovery
marker, using existing ask/assist/full policy.

E07 owns the finite MCP tool/resource job variant, admission, local publication,
readback, paging and clear. Admit before producer IO and never repeat an already
admitted original to reconcile it. Retained unknown evidence leaves the original
call unknown and raises the typed pending/unresolved outcome, so core cannot
complete it or continue the model merely because text was saved. Readable evidence
is separate from established external effect certainty.

The foreground execution owner can retain a bounded original host receipt in
memory for a readback-only report action after the loop returns. It holds only
the original authority, job/revision and minimal owner context; no arguments,
factory, preview or AbortSignal. Query invocationStatus and use original E07
publication, never call execute/invoke to reconcile an unknown. Reload/host
release cannot recover authority from saved IDs. Repeated report queries must
share their pending operation and keep a still-unknown effect unresolved.

A verified original reply after Stop/disconnect may settle only surviving exact
job/call owners even if the run is now interrupted; do not require a currently
running replacement to publish that original evidence. Current reader authority
and historical original-row authority remain separate. Parent deletion wins and
late replies cannot recreate deleted rows. Resource reads accept only captured
opaque handles; binary/link payloads stay explicitly unsupported and never cause
an implicit fetch. Text/JSON is bounded attributed untrusted content retained
through E07, available for scoped offline readback.

## 9. Shared management and retained editing

Agent and Settings use one management owner keyed by the actual connection owner.
Keep the pending original operation, unresolved intent, login attempt and private
draft across panel unmount or entry changes. UI locking is synchronous before the
first await. A React state update alone cannot prevent duplicate events or a
same-event autofill/search/navigation mutation. Settings combines its model and
MCP editor locks through synchronous reads rather than overwriting either owner.

Saving configuration does not connect. New entries are disabled until explicitly
enabled. Existing private configuration is not readable by the renderer: editing
is a clearly labeled full replacement. Load only public labels/kinds/origins;
never manufacture an empty secret as an unchanged old value. Enable/disable and
remove use the existing configuration intent rather than requiring re-entry.

Unknown private/store acknowledgement, committed-but-unconfirmed publication and
pending cleanup keep the original intent locked. Offer readback/reconciliation of
that operation, never a fresh save. A failed login cancellation or a retired login
check must have a recovery path for its original server/attempt; retain uncertainty
until acknowledged retirement/drain, then release the UI. Do not leave a permanently
pending login whose owner can no longer be queried, and do not call cancel failure
successful just to unlock controls.

Use the existing ContextPanel host: wide windows show details beside chat; narrow
windows switch to a full-width surface while chat, streaming, scroll and unsent
content remain mounted. The wrapper that imports app frame/draft APIs belongs in
the existing top-level Agent ui bridge; nested mcp/ui owns the form/body/controller.
All close, replacement and return paths use the same synchronous draft/pending
guard. Focus restoration must wait for the actual confirmation dialog removal and
inert release; a fixed animation-frame race does not prove keyboard focus returned.
Successful configuration/connection actions stay quiet. Errors and unresolved
actions belong in management, with no preparation/model-check/user-bubble text.

## 10. Practical browser remote host

The official client is pinned to @modelcontextprotocol/client 2.3.1. Admit only its
public browser-root closure: no Node stdio, cross-spawn, Node shim, Ajv entry or
feature-owned SDK types in reusable core. The named feature bootstrap injects the
real public ProductStore catalogue into the finite platform host; platform does
not import product feature owners. No backend/proxy is introduced.

Browser private configuration, headers, tokens, PKCE verifiers and prepared bearer
authority live only in the current host's memory. Public references use
session_memory and exact owner/revision identity. A fresh tab cannot restore them
from saved IDs. Confirm private preparation only against the actual positive CAS
receipt and current pointer. Before dispatch, check catalogue/config/reference,
enabled state, current registration, canonical arguments and granted identity.

String fetch bodies can be automatically retransmitted by Chromium after an
ambiguous network failure, even when JavaScript calls fetch once and SDK retries
are disabled. All browser MCP and OAuth POST bodies therefore use a single-use
ReadableStream with duplex=half, with explicit request-stream feature detection.
Never fall back to a replayable string. Supported Web endpoints need HTTP/2 or
HTTP/3, CORS and compatible public-client deployment; HTTP/1 rejection is an honest
limitation. Keep cookies omitted, redirects rejected and caching disabled.
Count actual HTTP effects in Chromium, including a lost header response and
REFUSED_STREAM; mocked fetch call count cannot establish no network replay.

Acquire/refresh tokens before dispatch. The fixed token provider has no reactive
onUnauthorized; insufficient-scope reauthorization and retries are disabled. Use
raw SDK request rather than callTool's repair loop. input_required is not fulfilled
automatically. Lost reply, 401/403/404/408, header mismatch, stream reset and result
overflow never authorize replay. Bound response bytes while reading actual JSON,
SSE and error bodies, and retain a deadline while the body is stalled.

Reserve a popup synchronously from the user click. Process /mcp/oauth/callback and
scrub its parameters before router breadcrumbs, analytics and diagnostics start.
The opener validates exact origin, source popup, redirect, state, issuer, bounded
finite fields and current epoch before consuming it. Wrong callbacks do not consume
a legitimate attempt. Consume the verifier before awaiting code exchange. Refresh
rotation is serialized, published under the current epoch, and changes to actual
issuer/resource/client/granted scopes retire prior invocation authority.

Local teardown retains original pending-connect, retired connection, queued call
and OAuth request owners until their tasks actually finish. Closing the SDK client
or issuing abort is not a drained receipt. Repeated disconnect/dispose must observe
the same cleanup owner. Late old-call failure, onclose or directory notifications
may retire only that exact current connection, never a newer same-server binding.
This is local IO cleanup; it does not promise to undo or stop a remote effect.

Necessary evidence includes real ReactDOM controls, retained Chromium wide/narrow
UI with one running stream, real SDK cross-origin HTTP/2 and popup OAuth, and actual
public DB/context/model/export/diagnostic bytes. Keep those distinct from installed
Keychain/Windows/system-browser/loopback and full build/packed-consumer acceptance.
List frozen resource descriptors in explicit four-entry pages, preserving a
continuation. Maximum JSON escaping must fit core's smaller result envelope;
the larger discovery-generation cap is not an inline result allowance.
