# E10: MCP 外部工具与资源接入

## Goal

Let users explicitly connect external tool servers to Cuepoint Agent, discover
their tools/resources on demand, approve calls and retain readable results
without leaving or interrupting the current conversation. Desktop macOS and
Windows are the required delivery; share remote support with Web where practical.

## Background and confirmed decisions

- This child belongs to [Agent experience and desktop evolution](../10-15-agent-experience-desktop-evolution/prd.md).
  The owner authorized sequential delivery, a commit after each reviewed stage,
  and only necessary affected checks during development. Full regression,
  application builds, packaging and installed-host acceptance stay at epic end.
- On 2026-10-16 the owner selected **both local stdio and remote Streamable HTTP**,
  **macOS and Windows**, and **OAuth browser login together with manual
  Token/request headers**, plus unauthenticated connections where applicable.
- The owner then confirmed **desktop priority, Web where practical**. Browser
  support must not require a new proxy/backend, weaken desktop policy or delay
  desktop delivery. Browser stdio is unavailable; browser remote/OAuth depends
  on compatible endpoints, public-client registration and callback deployment.
- Production currently has one reusable Agent loop and one ProductStore. E06
  supplies binding/grant contracts; E07 owns jobs/retained reports. Studio still
  composes static groups and must wire dynamic registration into actual admission,
  preview and the model's offered definitions. E09 skills grant no server authority.
- The local Harness is reference evidence for lifecycle/namespacing, not a
  framework adoption decision. No product MCP implementation or installed-host
  compatibility has been verified by this planning work.

## Requirements

- **E10-R1 — SDK and reuse boundaries.** Adopt maintained protocol clients through
  Cuepoint host ports, after checking their actual released APIs/defaults.
  Evaluate SDK use separately from Cordis or a complete Harness worker. Preserve
  the reusable core, one execution loop and one product transaction owner.
- **E10-R2 — Both desktop transports.** Support configured stdio executables with
  argument arrays and remote Streamable HTTP on macOS/Windows. Define connection
  configuration, credential references, bounded discovery, stable namespaces,
  validated schemas and exact connection generations. Disconnect, edit, remove
  and teardown retire the old owner and drain local processes.
- **E10-R3 — Unified execution and certainty.** Route external calls through the
  actual offered-definition, approval, resource-check, cancellation and result
  pipeline. Bind approval to exact server/configuration/generation/schema and
  arguments. A lost acknowledgement, session expiration or cancellation after
  dispatch must not automatically repeat an external effect or imply rollback.
- **E10-R4 — Honest local authority.** Distinguish environment scrubbing from OS
  filesystem/network confinement. Users explicitly enable starting a configured
  local server; skill installation, model output, links and server annotations
  cannot enable it or grant extra authority.
- **E10-R5 — Remote authentication.** Include no-auth, manual Token/headers and
  OAuth browser authorization as applicable. Bind login/callback/refresh to exact
  issuer, resource, configuration and connection attempt; handle cancellation,
  expiry and disconnect. Keep credentials outside model context, ordinary
  diagnostics and project exports; use native secure credential ownership for
  remembered desktop secrets, with no plaintext fallback on vault failure.
- **E10-R6 — Desktop priority and practical Web.** Keep shared remote discovery,
  approval and result behavior where browser/endpoint capabilities permit it.
  Web may use session-only credentials. Surface an actionable unsupported state
  when CORS, callback deployment or host capabilities prevent connection; no
  browser parity prerequisite is added to desktop acceptance.
- **E10-R7 — Explicit connection management.** Provide device-local connection
  management and an Agent entry for connect, inspect, enable/disable, reconnect,
  disconnect and remove. Saving a configuration does not silently start a
  process. Follow existing guarded ContextPanel wide/narrow behavior and keep
  chat mounted/running. Preserve acknowledged/unknown write outcomes and avoid
  duplicate actions. Credentials/configuration are not project ZIP content.
- **E10-R8 — Bounded tools and resources.** Fit dynamic discovery into the existing
  36-tool/two-selected-group budget; reject invalid or oversized generations
  without partially replacing a working generation. MCP resource URIs remain
  server-bound, and remote content remains attributed untrusted data. Retain
  bounded large textual/structured results through E07's publication/readback
  owners; never inline unbounded binary output or fetch arbitrary resource links.
- **E10-R9 — Quiet, truthful feedback.** Show connection/authentication errors and
  real approval/unknown-result recovery at their owning surfaces. Do not add
  preparation/model-check captions, user-bubble status, redundant success copy,
  automatic navigation or a drawer that stops the conversation.

## Acceptance criteria

| ID | Observable result and minimum meaningful evidence | Requirements |
| --- | --- | --- |
| **E10-AC1** | A deterministic server exposes tools and resources; the model receives exactly the advertised definitions, a selected call reaches the unified approval/result flow, and attributed retained content can be read beside the running chat. | R1, R3, R8 |
| **E10-AC2** | Holding an approval or reply while editing/reconnecting/removing cannot retarget it to a new server generation. Old callbacks/replies cannot publish into the replacement. Local teardown records actual process drainage, rather than only hiding UI. | R2, R3, R4 |
| **E10-AC3** | A server performs an effect but loses its reply; HTTP session expiry and Stop produce truthful unknown/stop outcomes with no automatic effect replay. Duplicate Stop/Disconnect does not duplicate effects or result publication. | R3 |
| **E10-AC4** | Stdio and Streamable HTTP both discover/call/read through the same policy pipeline. macOS/Windows source checks and actual installed acceptance are recorded separately; missing real-host evidence remains pending at epic end. | R2, R4 |
| **E10-AC5** | A deterministic OAuth service completes system-browser/PKCE authorization and authenticated discovery/calls. Wrong, duplicate, cancelled, expired or stale callbacks cannot authenticate a replacement; guarded refresh and disconnect retain exact binding. Manual/no-auth flows and native secret failure paths also pass without secret leakage. | R5 |
| **E10-AC6** | Compatible Web remote fixtures use the shared flow where practical. Unsupported browser/server combinations present actionable connection feedback and do not block desktop delivery or introduce a proxy/backend. Web cannot start local stdio processes. | R6 |
| **E10-AC7** | Actual connection UI preserves chat execution and guarded edits in wide/narrow layouts. Enablement is explicit, pending actions cannot duplicate writes/connections, and unknown save outcomes reconcile before retry. No extra send-time/preparation text appears. | R7, R9 |
| **E10-AC8** | Duplicate raw names, malformed schemas, excessive pages/tool counts, oversized output and forged resource links cannot bypass bounds or identity. Failed discovery retains the prior valid generation or leaves an explicit disconnected state. Credentials and local launch details do not enter model/context preview, exports or routine diagnostics. | R2, R5, R8 |

Deterministic fixture servers are the acceptance baseline. This task does not
require a third-party account, paid invocation, specific vendor or new deployment.

## Dependencies and boundaries

- [E06 delivered contracts](../archive/2026-10/10-15-agent-resource-capabilities/prd.md)
  and [E07 delivered contracts](../archive/2026-10/10-15-agent-jobs-results/prd.md)
  are prerequisites. Their deferred full/emitted/packed/native acceptance remains
  with the parent epic. E08's separate pending installed acceptance is preserved.
- No second product store or Agent loop, arbitrary renderer command execution,
  automatic unknown-effect replay, Node sidecar, background daemon, app-exit
  continuation, E11 scheduler/delegation or general browser automation.
- No guarantee of OS sandboxing for user-configured local servers; no automatic
  server installation, command download, skill-to-MCP authority transfer or
  universal compatibility with server-specific authorization extensions.
- First delivery covers tools and bounded resource listing/reading. Server
  prompts, server-initiated sampling/elicitation, resource subscriptions and
  arbitrary executable/binary result import remain outside scope. Unsupported
  requests are rejected explicitly, without broadening grants.
- Follow current fresh-development-data policy: no legacy migration/backfill
  requirement or destructive data reset is introduced by this task.

## Technical evidence and artifacts

- [Initial source/protocol/host investigation](./research/scope-and-host-options.md)
- [OAuth host and Web boundary](./research/oauth-host-and-browser-boundary.md)
- [SDK and OAuth design evidence](./research/sdk-and-oauth-design.md)
- [Current product integration seams](./research/product-integration-design.md)
- [Planning consistency review](./research/planning-review.md); its two certainty/
  late-reply clarifications are incorporated into the design and Stage 3.
- Original [capability comparison](../10-15-desktop-agent-capability-research/research/capability-comparison.md)
  and [host integration review](../10-15-desktop-agent-capability-research/research/host-integration-review.md)
- [Technical design](./design.md), [staged implementation and validation](./implement.md),
  curated implement.jsonl and check.jsonl.

Product scope decisions are resolved. This PRD has been converged against the
confirmed decisions; the owner approved the final planning summary with “开始吧”
on 2026-10-16. Task activation and staged implementation follow that approval.
Planning/source checks do not establish packaged-host acceptance.
