# Delivery roadmap and source coverage

State: planning. The owner authorized this epic and sequential task organization on 2026-10-15. Creating these records does not enable every capability or approve a host/runtime choice. The owner subsequently authorized sequential implementation and stage commits. Complete each child's concrete scope/design review before activation, using that standing authorization for established requirements and clarifying material new product choices.

## Delivery order

| Order / task | Observable result | Explicit prerequisites | Readiness |
| --- | --- | --- | --- |
| [E01: Parallel business details](../archive/2026-10/10-15-agent-parallel-details/prd.md) | Open and edit a shot beside the Agent; narrow windows switch the working surface to full-width detail without unmounting or stopping chat. | No delivery prerequisite. Reuse existing right host and business owners. | Committed as `5f8b6ab0` and archived; focused checks/review passed. Full batch integration deferred. |
| [E02: Immediate Send and recovery](../archive/2026-10/10-15-agent-optimistic-send/prd.md) | Submitted content is visible immediately, failed admission remains recoverable, late durable acceptance does not duplicate the message. | No delivery prerequisite; coordinate Agent files after E01. | Committed as `447a9fb7` and archived; necessary affected checks and full changed-scope review passed. Batch integration deferred. |
| [E03: Execution and stopping feedback](../archive/2026-10/10-15-agent-execution-feedback/prd.md) | Quiet preparation, accurate actual wait/stop feedback and distinct receipt/display timing. | E02 submission identity and lifecycle. | Committed as `9e3b8dcb` and archived; necessary affected checks and changed-scope review passed. No overlay selected without evidence. |
| [E04: Thread loading and reading](../archive/2026-10/10-15-agent-thread-reading/prd.md) | Correct loading/departure scope and an accessible return-to-latest action. | No delivery prerequisite; sequential UI coordination after E03. | Committed as `982dece3` plus owner screenshot correction `8220faf5` and archived; necessary checks and actual button layout passed. No per-topic position persistence. |
| [E05: Creative operation feedback](../10-15-creative-operation-feedback/prd.md) | Asset create/delete feedback and duplicate protection, coherent archive filtering, batch-import progress. | No delivery prerequisite; preserve same ProductStore outcomes. | Implemented and independently reviewed: guarded asset intents, receipt-aware recovery, archive-only label and confirmed import progress/stop remaining. Necessary checks passed; stage commit/archive next. |
| [E16: Remaining entity links/review handoff](../10-15-business-detail-link-rollout/prd.md) | Expand existing business editors and accessible detail/return from retained batch review. | E01; recommended after E02-E05 UX work. | Backlog; concrete entity coverage/handoff design required. |
| [E06: Capabilities and resource grants](../10-15-agent-resource-capabilities/prd.md) | Explicit typed extension and resource-approval contracts reusable outside Studio. | No delivery prerequisite. | Capability foundation; first concrete host scope undecided. |
| [E07: Jobs, results and artifacts](../10-15-agent-jobs-results/prd.md) | Owned progress/cancel/output and recoverable large-result references. | E06. | Backlog; persistence and live execution remain distinct. |
| [E08: Native workspace/media](../10-15-desktop-workspace-media/prd.md) | Authorized input directory to verified media processing and project import. | E06, E07. | Backlog; choose first workflow/platform before design. |
| [E09: Installable Skills](../10-15-agent-installable-skills/prd.md) | Discover and load reusable creative instructions on demand. | E06. | Backlog; format/source/trust to converge. |
| [E10: MCP integration](../10-15-agent-mcp-integration/prd.md) | Selected external server tools/resources share approval, lifecycle and result handling. | E06, E07. | Backlog; no implicit external server or Cordis adoption. |
| [E11: Background Agent host](../10-15-agent-background-host/prd.md) | Continue across a selected UI detach case and reattach to authoritative state. | E06, E07. | Backlog; choose lifetime and runtime separately. |
| [E12: Delegation/concurrency](../10-15-agent-delegation/prd.md) | Bounded child work, inherited grants, budgets and coordinated creative writes. | E06, E07, E11. | Backlog; may narrow E11 dependence only by explicit scoped design. |
| [E13: Programmatic workflows](../10-15-agent-programmatic-workflows/prd.md) | Verified batches with nested calls through the same policy and scheduler. | E06, E07, E12. | Backlog; typed orchestration before choosing code execution. |
| [E14: Scheduled follow-ups](../10-15-agent-scheduled-followups/prd.md) | Manage reminders with honest online/offline, delivery and duplicate semantics. | E07, E11. | Backlog; no app-exit/daemon promise. |
| [E15: Browser/computer study](../10-15-agent-browser-computer-study/prd.md) | Decide a justified bounded workflow, permissions and prototype acceptance. | E06, E07, E11. | Optional evaluation; prototype/product implementation requires its own approval. |

This is a proposed sequence, not a dependency scheduler. The same dependencies are written in the owning child PRDs and metadata. The owner may reorder independent deliveries; changes affecting acceptance or host lifetime must update both places.

## Full finding coverage

| Source finding / requirement | Owner | How coverage is evaluated |
| --- | --- | --- |
| New owner request: detail links must not stop chat; no drawers; right-side detail | E01 (single-shot/shared host), E16 (expanded targets/modal handoff) | Running-chat navigation/open/replace/close, unsaved drafts, owned entity reads and responsive acceptance. |
| Owner-selected narrow fallback: full-width working surface, chat retained/running | E01 | Resize without editor/run remount; return to conversation retains draft, scroll and run. |
| I1 optimistic content; I3 pre-accept failure/drafts/identity | E02 | Held discovery/storage, home-first-send, later edits, late observation, uncertain commit and retry. |
| I2 preparation/first-token publication; I4 stopping | E03 | Real boundary timestamps; stop acknowledgement and safe settlement. No claimed latency measurement from source alone. |
| I5 query identity/loading/departure; I6 reading affordance | E04 | Slow A-to-B reads, correct departure predicate and intentional return-to-latest. |
| Asset creation/deletion pending/error gaps and duplicate-creation window | E05 | Delayed/failing storage and repeated actions through actual UI. |
| Archive filter text versus actual collection; import progress/remaining queue | E05 | Active/archived fixtures; truthful completed/total and stop-remaining semantics if selected. |
| Registry, install/dispose, loaded-tool budget and stable pending identities | E06 | Typed ports and lifecycle evidence with one independent consumer. |
| Tool approval versus filesystem/process/network grants and confinement | E06 | Same resource facts at preview/dispatch, revocation and child inheritance. |
| General local jobs, cancellation, output; existing remote generation distinction | E07 | Authoritative states and explicit lifetime/restart limitations. |
| Spill/prune/large result recovery, attachments/artifacts and context pressure | E07 | Bounded inline projection with complete authorized readback; preserve existing compaction/continuation. |
| Directory/file read/search/edit and process/media tools | E08 | One selected creative workflow with scoped paths/version checks and verified import. |
| Filesystem Skills, metadata/body separation and distribution | E09 | On-demand instructions/resources; no implicit execution grants. |
| MCP tools/resources, transport/credentials, reconnect/process ownership | E10 | Test server and late-response/disconnect/approval identity cases. |
| Current UI-bound loop, actual host ownership, product bridge and packaged lifetime | E11 | Chosen lifecycle in actual package; one ProductStore and run owner. |
| Spawn/Fork, role contexts, messages, budgets and child scope | E12 | Managed child lineage, cancellation, bounded read concurrency and exclusive effects. |
| PTC/programmatic batches and nested-tool concurrency | E13 | Verified outputs and preserved nested policies, cancellation and ledger. |
| Timers, cold follow-up, missed runs and acknowledgement windows | E14 | Host availability plus duplicate/crash admission tests. |
| Browser/CUA and experimental-provider boundaries | E15 | Decision evidence before enabling capability; state verification after actions. |
| Framework adoption versus mechanisms/protocol SDK; SDK control limits | E06, E10, E11, E15 as applicable | Preserve reviewed option comparison; no global decision to replace Cuepoint core. |
| Business atomicity, exact paid confirmation, reviewed memory/current credentials | Every delivery; parent final integration | Existing guarantees stay executable; a dispatched request or external worker result cannot forge product completion. |
| Runtime evidence, not unexecuted reference assertions | Every delivery | Record source/static, deterministic tests, real UI, native/package and live-service evidence distinctly. |

## Research record

[Original investigation](../10-15-desktop-agent-capability-research/prd.md) remains a linked evidence child. Its source investigation is complete; it stays planning as recorded, and has no product implementation. Subsequent owner authorization covers sequential delivery commits and completed-child archive/journal bookkeeping; no remote push is included.

## Validation cadence

Owner instruction on 2026-10-15: each task runs only necessary affected tests and scoped review. Full regression, production builds, packaging and native integration acceptance run once after the selected task batch is complete. Do not repeat these broad gates for every child; distinguish deferred acceptance from already passed focused checks.

## Cross-delivery acceptance

1. E01/E16 details continue working after E02/E03/E04 change draft, status and query handling; opening or editing a detail never changes the conversation's execution owner.
2. Later native/external jobs use the same phase/cancellation truth introduced in early UX work rather than parallel success/approval systems.
3. Future background execution revises actual departure semantics deliberately; E01's in-place details already avoid departure without depending on a background host.
4. New package boundaries follow reusable consumers and platform ownership; keep a single neutral loop/providers plus the existing product transaction owner.
5. The parent does not finish until selected delivery acceptance and the residual optional/deferred backlog have an explicit recorded disposition.
