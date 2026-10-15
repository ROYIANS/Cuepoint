# Desktop Agent evolution — options, not an approved implementation

Status: planning. The owner authorized investigation and will choose development
scope afterward. This file records alternatives; no package, host language,
permission default or milestone has been approved.

## Proposed separation of responsibilities

```text
Studio UI: drafts, provisional messages, subscriptions, approval and user control
             |
Application commands / execution controller
             |
Reusable agent-core + agent-providers
             |
Typed host capabilities: tools, resources, jobs, lifecycle, result storage
             |
Desktop host adapters / Web-supported adapters
             |
Existing product commands + native services + explicitly selected external tools
```

This is an ownership proposal. It must not be implemented as a second loop, a
generic service dictionary, unrestricted renderer IPC or a second product store.
UI can show a pending local send immediately, while the execution controller
separately acknowledges durable acceptance and later confirms actual effects.

## Host alternatives to investigate before implementation

| Option | Strength | Cost / unresolved question |
| --- | --- | --- |
| Tauri native capability/jobs service, keep model loop in current JS consumer initially | Smallest initial integration; direct Rust media/process ownership; browser consumer can keep its current capabilities | Does not itself move the model loop out of the Webview. Full background Agent execution still needs an explicit later host/lifetime decision. |
| Tauri shell plus managed JS/Node sidecar running the same public core/providers | Reuses the actual TypeScript loop for background execution and permits existing JS MCP/provider ecosystems | Node/runtime packaging, RPC, startup/shutdown, updates, credentials and Studio service adapters need design; a sidecar cannot bypass the sole product transaction owner. |
| Another JS execution host compatible with the core, paired with native tools | Potential reuse without assuming Node for every deployment | Need actual built/packaged compatibility, transport and lifecycle evidence; no runtime is selected by this document. |
| External DSH worker through its SDK/CLI | Fast access to some general research/code workflows and a separate worker | Adds Cordis/session/profile/provider policy and resource ownership; loses simple same-transaction business effects unless every product change returns through Cuepoint commands. Better evaluated as a bounded worker than an unreviewed core replacement. |
| Replace our core with the Harness | Large existing ecosystem under one framework | Substantial product/storage/protocol/lifecycle migration, pre-stable APIs and different guarantees. No evidence currently justifies replacement. |

The research recommendation is to preserve `agent-core`/`agent-providers` and
add explicit capabilities. It is not approval for any host option above.

The external-worker option has additional documented SDK limits at the inspected
revision: no mid-turn wire cancellation, no prompt-specific final-response
attribution, and no implemented server-to-client approval requests. The separate
`sdk-minimal` profile omits Skills, jobs and subagents. Evaluate the selected
profile and actual control protocol, not the full Web product's package list.

## Extension boundaries to preserve

- Core: neutral execution, typed tools, ownership, confirmation, cancellation,
  continuation, context mechanisms and observable runtime facts.
- Capabilities: explicit typed request/result and resource requirements; register
  tools through the same validation, scope, approval and durable outcome flow.
- Host: actual filesystem/process/tool-server/OS authority and owned teardown.
- Studio: creative schemas, project scopes, user prompts/policies, provider
  materialization, local effect/evidence/result transactions and UI behavior.
- UI: provisional request identity and local draft echo; durable acceptance,
  execution progress and effects remain distinct observable states.

New package boundaries should follow independent consumers, lifecycle and
platform dependencies. The reference's 336-package layout is not a target.
Names such as `agent-capabilities`, `agent-mcp` or `agent-skills` remain examples,
not approved folders to create.

## Candidate sequence

These phases are recommendations, not selected requirements.

| Candidate | User-visible result | Enabling work | Example acceptance |
| --- | --- | --- | --- |
| A: interaction responsiveness | Send visibly accepts immediately, draft transitions predictably, slow preparation has a named state, errors retain/recover user content | Provisional send identity, durable acceptance reconciliation, focused rendering/state timing | Under delayed storage, the user's message and sending state appear before completion; failure remains visible and retry creates no duplicate accepted request. |
| B: native workspace and media tasks | Read selected source directories, inspect video/audio, generate thumbnails/transcodes/subtitles and import verified outputs | Native resource grants, process owner, bounded logs/results, progress/cancel, product import commands | Process selected fixtures in an owned directory; cancelling stops owned local work; conflicting product edits are preserved; restart never blindly repeats unknown external effects. |
| C: Skills and MCP | Reusable creative workflows and selected external applications/services | Catalog/load separation, namespaces, trust/configuration, connection lifecycle, approval and credential isolation | A selected skill/tool server appears on demand; uninstall/disconnect removes future availability; a pending approval does not silently target a changed tool. |
| D: background Agent and delegated roles | Switch views while work continues; spawn bounded research/storyboard/review subtasks and collect results | Explicit host lifetime, job ownership, subscriptions, concurrency/budget and write coordination | UI detach does not silently cancel accepted background work; reattach shows real state; children cannot expand the parent's grants or overwrite newer creative revisions. |
| E: advanced workflows and automation | Programmatic batches, scoped browser work, optional scheduled follow-up or desktop control | Mature task/resource model, tool composition, platform grants, recovery | Workflow verifies outputs rather than declaring success from dispatched input; inactive Host and uncertain external effects remain explicit. |

A can be designed as a small separate delivery after its findings are reviewed.
A should first couple provisional send presentation with recovery (I1/I3), then
add true preparation/wait/stop feedback and timing evidence (I2/I4), and fix
thread-query identity/loading (I5). The measured benefit and failure semantics
must justify any live-text overlay; it is not a prerequisite to improving Send.
Adjacent asset creation/deletion can follow the same interaction contracts as a
separate bounded UI delivery. The spot-check is not a whole-product redesign.
B should deliver a real creative workflow rather than only a generic terminal.
C and D can change order depending on the chosen first use case and host. A full
background model loop must be addressed explicitly before claiming D, even if
native B jobs already run independently.

## Decisions still owned by the user

1. First demonstrated workflow: immediate chat responsiveness, local media/file
   automation, selected external software integration, or delegated creation.
2. Whether background means switching views, closing the main window, or surviving
   application/process exit. These are different lifecycle promises.
3. Initial platform set and acceptable runtime/package-size implications.
4. Resource-grant UX, default modes, and when explicit confirmation is required.
5. Skills/MCP installation sources, trust, scope, credential handling and rollback.

Investigation should make these choices concrete. Implementation planning and
final PRD convergence happen only after the owner chooses a delivery scope.
