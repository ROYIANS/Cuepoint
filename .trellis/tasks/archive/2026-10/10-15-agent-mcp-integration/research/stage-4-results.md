# Stage 4 shared management and practical Web

Status: source implementation and independent integrated check passed on
2026-10-16. Parent checkpoint: 80513428. Installed and full batch gates remain
with the parent epic.

## Delivered behavior

Agent's More menu and Settings' named MCP entry open the same retained management
surface, backed by one state owner per actual connection owner. List, capability
inspection, full private-configuration replacement, save, explicit enable/connect,
OAuth login/cancel, reconnect, disconnect and removal use the production owners.
New configuration defaults disabled and saving alone never launches a process.
Private fields cannot be reread from the host; replacement is explicit.

Pending operations are locked before the first await. Known failure keeps the
input; unknown private/store acknowledgement or incomplete publication/cleanup
retains the original operation and offers its status/reconciliation. Reopening
either entry cannot create another save intent. Failed or retired login status/
cancellation has a recovery route through its original server; draining keeps the
guard and actual drained confirmation releases it. Successful actions are quiet.

The existing ContextPanel keeps a live chat mounted beside details on wide
windows and behind the full-width detail surface on narrow windows. All departure
and replacement paths share draft protection. Focus restoration observes actual
dialog removal and inert release. Settings locks both search and navigation
synchronously while either model or MCP credentials are being edited.

The browser port uses the exact public SDK 2.3.1 root and real catalogue authority.
It supports compatible remote services, no-auth/manual headers and public-client
OAuth with session-only secrets. It exposes no stdio or persistent-credential
fallback. Its optional synchronous popup port does not change native IPC.
Detailed actual SDK/CORS/popup evidence and the discovered network-replay correction
are in [stage-4-browser-validation.md](./stage-4-browser-validation.md).

## Review corrections

- Chromium itself can replay string-body fetch POSTs after an ambiguous network
  failure. All MCP/OAuth POSTs now use single-use streamed bodies without string
  fallback. Web requires request-stream support plus HTTP/2 or HTTP/3/CORS; the
  actual HTTP/1 fixture receives no protocol request.
- The manager initially retained an unqueryable pending login after cancel/status
  failure. It now preserves the original server/attempt as unresolved, exposes
  acknowledged retirement/drain recovery, and keeps editing guarded until drained.
- Browser teardown now retains original pending-connect, call, response-body and
  OAuth request cleanup tasks until they actually finish. Repeated teardown keeps
  the same cleanup owner, reports draining after its finite deadline and reports
  drained only on established completion. Old failure/list-change/principal
  callbacks retire only their captured current connection, preserving replacements.
  Five held/interleaved regressions exercise those corrections.
- The retained frame wrapper follows the existing top-level Agent ui app bridge;
  nested mcp/ui remains the management/form owner. The actual management CLI has
  an exact Knip entry, rather than weakening root source discovery.

## Necessary executed evidence

Implementation owners executed management/privacy/Settings: five files / 74 tests
before the two review regressions; the final management suite has 10 tests. These
counts overlap and must not be added. The actual ReactDOM cases include held and
lost save acknowledgements, original readback without repeat prepare, private
replacement, shared state, synchronous Settings guards, and failed-login recovery.

The retained Chromium runner passed 12 strict scenarios against frozen production
source. It uses actual emitted packages, AgentChatPage/core, AppFrame/ContextPanel,
ProductStore and the native renderer adapter; only finite IPC replies and the
model stream are controlled. It verifies one ongoing stream, same editor/composer
DOM and draft, no route transition/abort/new model call, wide/narrow layout, dirty
close/replacement, actual focus return, held duplicate controls, known/unknown save
recovery, explicit connection, no private replacement readback and locked Settings.
The final source hashes include the login-recovery correction; no source changed
during or after the strict run. Wide/editor/narrow screenshots were actually viewed.

tests/mcpPrivacy.test.ts passed through the actual configuration owner/native
renderer port and captures public catalogue/device settings, context preview, final
model body, actual project ZIP entries and diagnostics. Private executable/cwd/
argv/environment, endpoint query, headers, OAuth fields and authority markers were
present at private prepare but absent from all those public bytes. This test is
part of the integrated source profile, not extra independent coverage to sum.

The browser host has 18 passing tests across its ordinary and lifecycle suites.
They include held catalogue/fetch, repeated disconnect/dispose, real SDK token
refresh and code exchange, and old failure/notification versus new connection.
Controlled SDK/fetch tests remain distinct from actual Chromium network evidence.

The actual Chromium SDK runner passed 24 strict cases, including the final
unchanged-source-hash check. It covers legal modern and legacy wire results;
input_required uses the actual modern string requestState variant. Every possible
effect-failure case stays at one actual HTTP invocation. Stable refresh rotates
once before two separately authorized calls; changed scopes produce zero effects.
Preregistration/DCR, popup callback and memory-only reload boundaries are real
browser/network exercises against a controlled peer.

After the final lifecycle correction, independent integrated verification passed:

- Finite MCP profile: 19 files / 232 tests, including all selected earlier MCP/
  Agent/E07 and new management/privacy/browser/Settings suites. The subset counts
  above overlap this run and are not extra tests.
- MCP source TypeScript noEmit: exit 0. Both browser fixture type projects also
  passed their necessary noEmit checks.
- Stage 4 changed Studio TS/TSX lint: 19 files, zero errors and two reviewed
  pre-existing AgentControls nested-ternary warnings. New MCP modules have zero
  warnings; no suppression was added.
- Actual architecture graph: 725 owned TS files, including 678 Studio files;
  4,538 import edges, zero ownership/boundary failures, cycles or computed imports.
- Source/staged whitespace validation includes newly added files before commit.

The actual workspace SDK-only browser graph contains 155 modules / 676,415 output
bytes without Node/stdio/cross-spawn/shim/Ajv reachability. Required Agent libraries
were explicitly regenerated; exact freshness and actual emitted exports passed.
The actual Web Vite config loaded /agent, Settings MCP management and its remote
editor with zero page errors or failed local module imports. This is a runtime
import smoke, not an application production build.

Review reasoning is in [stage-4-review-notes.md](./stage-4-review-notes.md).
No native code changed after the independently reviewed Stage 2 native fixtures.

## Evidence limits and batch handoff

One separate retained-fixture startup attempt exposed Dexie's Transaction committed
too early before interaction. That attempt failed immediately and was reported;
no retry/exception swallowing was added. The final frozen-source run passed with
zero page errors. Preserve this observation for the parent's broader integration
acceptance instead of inventing an unrelated storage repair in E10.

Full formal lint/unused/architecture/regression, whole application builds, isolated
emitted/declaration/packed-consumer tests, release resources/installers and actual
installed macOS/Windows remain parent batch gates. Necessary library regeneration
and development /agent import smoke do not clear them. Actual Keychain permission,
Windows vault/Job Object, installed system-browser callback/firewall/loopback and
launch/teardown paths remain unexecuted. Browser fixtures use a controlled public
OAuth peer, not third-party IdP, CIMD or production TLS/deployment acceptance.
