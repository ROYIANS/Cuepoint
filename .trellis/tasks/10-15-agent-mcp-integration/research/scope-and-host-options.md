# E10 initial scope and host investigation

Date: 2026-10-16. Cuepoint inspected after `96bdeaf3`; local DeepSeek Harness
baseline remains `571902028a75c64c1d767f4ae5fd099485f0ddf0`.
This is planning evidence, not implementation approval or an executed MCP test.

## Current integration seams

- There is no production MCP client/registration/transport in the inspected
  Studio Agent or desktop handler owners. E09's installed instruction packages
  explicitly grant no MCP/process authority. Do not treat installing a skill as
  installing or enabling an external server.
- `packages/agent-core/src/tools.ts:3` defines exact capability/version/
  registration identity. Its metadata comparison checks that binding before
  dispatch; the argument parser, effect and confirmation contracts are reusable.
  `resourceGrants.ts:24` requires the real effect owner to check current authority.
  MCP needs a real host implementation of these contracts, not a second loop.
- `packages/agent-core/src/capabilities.ts:3` caps loaded definitions at 36 and
  selected business groups at two. Studio's `runtime/toolLoading.ts:24` currently
  assembles those groups from builtin `AGENT_SKILLS`. External tools must fit
  discovery, frozen admission/preview and exact offered-definition identities;
  simply appending every discovered tool would violate that budget and snapshot.
- `packages/studio/src/features/agent/runtime/toolDefinition.ts:18` narrows
  Studio recovery to generation/repeatable. Generic external side effects need
  explicit no-replay/unknown handling, not a false atomic ProductStore callback
  or blanket repeatable designation. Existing `runChat.ts` and `toolErrors.ts`
  own ledger/error publication and remain the integration targets.
- `apps/desktop/src-tauri/src/desktop.rs:1830` has closed normal/acceptance
  handler lists with media/import/storage/workspace owners, no general MCP or
  arbitrary command entry. `Cargo.toml` contains no protocol client or Node
  sidecar. Choosing a protocol client does not choose E11 background lifetime.

## Reference mechanisms worth retaining

DeepSeek Harness `packages/mcp/mcp-client/src/transport.ts:28` separates stdio
child processes from Streamable HTTP URLs. The SDK owns process spawn there;
scrubbing parent environment is not filesystem/network confinement.
`src/tools.ts:80` derives bounded, collision-resistant public names from stable
server/raw-name identities without parsing the public name to recover wire names.
Tool synchronization fetches/validates a complete generation before replacement.
`src/index.ts:16` depends on Cordis service/scope ownership. Adopt the mechanisms
through Cuepoint's own ports; importing the whole plugin would also require its
framework/runtime graph. No Harness code or dependency was copied or installed.

## Official protocol/SDK check

Checked primary sources on 2026-10-16:

- [MCP standard transports](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports)
  distinguishes stdio subprocess streams from Streamable HTTP endpoints. They
  can share protocol semantics while requiring different process/network owners.
- [MCP tools](https://modelcontextprotocol.io/specification/2026-07-28/server/tools)
  defines discovery/call schemas and server-scoped tool identities; server
  annotations are not authority. Names can collide between servers, so the local
  configured server identity must participate in the binding.
- [MCP resources](https://modelcontextprotocol.io/specification/2026-07-28/server/resources)
  is a separate surface from tool invocation. Reading an MCP URI must stay with
  its exact server binding, not become an arbitrary local path or fetch.
- [Official Rust SDK](https://github.com/modelcontextprotocol/rust-sdk) and its
  [transport feature documentation](https://rust.sdk.modelcontextprotocol.io/)
  provide client child-process and Streamable HTTP options. Rust is therefore a
  candidate within the existing desktop host; Node is not a protocol necessity.
  No version was selected, downloaded, compiled or compatibility-tested. Check
  exact SDK/protocol versions, cancellation/reconnect defaults and output bounds
  before locking a dependency; do not infer them from the latest README alone.

## Scope options for the owner

| First delivery | User value | Cost / limit |
| --- | --- | --- |
| Desktop local stdio + remote Streamable HTTP | Connect both locally installed creative applications/tools and network services; keep macOS/Windows in scope | Two transport owners, process cleanup plus endpoint/credential handling; split delivery into reviewed stages |
| Remote Streamable HTTP first | Connect external API/tool services without starting a local server process | Local installed-app MCP servers wait for another stage; authentication/URL policy still required |
| Desktop local stdio first | Prioritize installed applications and local tooling | Remote services wait; requires explicit process configuration and termination behavior |

Owner decision on 2026-10-16: **support both desktop transport types across
macOS/Windows**, delivered in stages under one task. The owner answered “都支持”
to the explicit local-plus-remote scope question. This confirms the first row,
without choosing a Node sidecar or a new background runtime. The owner's later
platform decision prioritizes desktop and allows practical Web reuse: browser
stdio is unavailable, and remote compatibility depends on endpoint/auth/CORS
behavior. No additional proxy/backend or universal browser parity is required.

## Authentication investigation after the transport decision

`packages/studio/src/features/settings/models/connector.ts:3` describes global
BYOK model connectors excluded from project ZIPs; `commands/connectors.ts:29`
saves user-supplied API keys through the existing ProductStore. These inspected
owners do not provide an OAuth browser-return or token-refresh flow. Do not
describe them as an OS keychain or infer encrypted secret storage from their
local-only product scope. MCP credentials require an explicitly designed owner
and must never enter model context, routine diagnostics or project exports.

Checked [official MCP authorization](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization)
on 2026-10-16: authorization is optional; its HTTP authorization specification
uses OAuth, while stdio credentials come from the process environment instead.
Supporting HTTP transport alone therefore does not establish OAuth login
support. A manual token/header connection and a browser-login connection are
different user workflows. OAuth also requires discovery/registration, guarded
browser return and token lifecycle design; no such implementation was tested.

Owner decision on 2026-10-16: **include OAuth browser login together with manual
Token/request-header connections** in the first remote delivery. The owner
answered “那就一起做了吧。” to that explicit scope question. OAuth is therefore
in scope, not a post-MVP promise. Specific auth extensions and credential storage
remain to be designed against the selected SDK and actual server acceptance
target. Browser-based desktop authorization does not itself establish support
in Cuepoint's separately deployed browser edition.

## Resolved scope and necessary validation shape

Transport, authentication and desktop priority are confirmed. Complete the
technical connection/credential/lifecycle design and explicit enablement UX
using deterministic fixture servers as the acceptance baseline. No specific
third-party account or deployment is required. Preserve the existing quiet UI,
shared right-side workspace and unsaved-edit guards. Web support is conditional
on actual browser/endpoint capabilities and must not delay desktop delivery.

Technical design must bind pending approvals to exact server configuration,
connection generation and schema revision; retire old ownership on disconnect/
edit/remove, reject late replies, stop/drain local children, and never reissue an
unknown effect after lost acknowledgement. Large results use E07's bounded
projection/owned readback where applicable. External execution remains outside
the product transaction, and remote content remains attributed untrusted data.

After scope convergence, use deterministic fixture servers for discovery/call,
resource reads, duplicate names, invalid schemas, held approvals, reconnect,
cancellation, missing replies and output limits. Live/paid providers are not
needed to establish these boundaries. Keep only necessary affected checks per
stage; full build/packaging/installed-platform acceptance stays at the epic end.
