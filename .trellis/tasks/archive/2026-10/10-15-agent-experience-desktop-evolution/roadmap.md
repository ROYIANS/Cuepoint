# Delivery roadmap and source coverage

State: closed for archival on 2026-10-16 at the owner’s request. E01–E11 and E16 have source deliveries; E12–E15 are cancelled and their unused planning records removed. Final checks belong to the owner (see Final verification handoff below). No further sequential implementation is scheduled.

## Delivery order

| Order / task | Observable result | Explicit prerequisites | Readiness |
| --- | --- | --- | --- |
| [E01: Parallel business details](../10-15-agent-parallel-details/prd.md) | Open and edit a shot beside the Agent; narrow windows switch the working surface to full-width detail without unmounting or stopping chat. | No delivery prerequisite. Reuse existing right host and business owners. | Committed as `5f8b6ab0` and archived; focused checks/review passed. Full batch integration deferred. |
| [E02: Immediate Send and recovery](../10-15-agent-optimistic-send/prd.md) | Submitted content is visible immediately, failed admission remains recoverable, late durable acceptance does not duplicate the message. | No delivery prerequisite; coordinate Agent files after E01. | Committed as `447a9fb7` and archived; necessary affected checks and full changed-scope review passed. Batch integration deferred. |
| [E03: Execution and stopping feedback](../10-15-agent-execution-feedback/prd.md) | Quiet preparation, accurate actual wait/stop feedback and distinct receipt/display timing. | E02 submission identity and lifecycle. | Committed as `9e3b8dcb` and archived; necessary affected checks and changed-scope review passed. No overlay selected without evidence. |
| [E04: Thread loading and reading](../10-15-agent-thread-reading/prd.md) | Correct loading/departure scope and an accessible return-to-latest action. | No delivery prerequisite; sequential UI coordination after E03. | Committed as `982dece3` plus owner screenshot correction `8220faf5` and archived; necessary checks and actual button layout passed. No per-topic position persistence. |
| [E05: Creative operation feedback](../10-15-creative-operation-feedback/prd.md) | Asset create/delete feedback and duplicate protection, coherent archive filtering, batch-import progress. | No delivery prerequisite; preserve same ProductStore outcomes. | Committed as `04d47969` and archived; necessary actual UI/store checks and independent review passed. |
| [E16: Remaining entity links/review handoff](../10-15-business-detail-link-rollout/prd.md) | Expand existing business editors and accessible detail/return from retained batch review. | E01; recommended after E02-E05 UX work. | Committed as `8ac73652` and archived: shots + four project/Studio asset kinds, real editor reuse and retained batch-review handoff. Necessary checks, actual scoped browser paths and independent review passed. Other families retain explicit navigation/follow-up scope. |
| [E06: Capabilities and resource grants](../10-15-agent-resource-capabilities/prd.md) | Explicit typed extension and resource-approval contracts reusable outside Studio. | No delivery prerequisite. | Committed as `d4c2c877` and archived: public core registration/binding/grant contracts with actual independent Todo SQLite authority; necessary source checks/review passed. OS/external backends unsupported; emitted/packed/native/full gates deferred. |
| [E07: Jobs, results and artifacts](../10-15-agent-jobs-results/prd.md) | Owned progress/cancel/output and recoverable large-result references. | E06. | Committed as `c9fd6706` and archived: foreground project video availability and retained web extraction with owned paged reports. Necessary source checks/review passed (11 suites/208 tests); native/emitted/packed/full gates deferred. Persistence does not extend lifetime; actual process termination remains with E08. |
| [E08: Native workspace/media](../10-15-desktop-workspace-media/prd.md) | Authorized input directory to verified media processing and project import. | E06, E07. | Source complete on `codex/desktop-workspace-media` in `52e584c7`, `2b00d8e5`, `ca2da1a5`: macOS + Windows source/native grants, decoder resources, atomic source+thumbnail import, inline library UI and Agent group. Necessary affected checks and independent reviews passed; archived at the owner’s request with actual Windows/installed and final batch checks handed to the owner. |
| [E09: Installable Skills](../10-15-agent-installable-skills/prd.md) | Discover and load reusable creative instructions on demand. | E06. | Three reviewed source stages (`0c7b8b10`, `e7a5c8ff`, `0449ed6f`) and runtime/uncertain-toggle repair (`1e74e0c8`) complete. Archived at the owner's request on 2026-10-16; deferred full/emitted/packed and actual installed macOS/Windows acceptance is retained by this epic below. |
| [E10: MCP integration](../10-15-agent-mcp-integration/prd.md) | Selected external server tools/resources share approval, lifecycle and result handling. | E06, E07. | Four source stages independently reviewed on codex/agent-mcp-integration: `45bffe3c` contracts/SDK, `9d2d2de6` desktop transports/OAuth, `80513428` Agent approval/E07, followed by shared retained management and compatible Web. Final 19 suites/232 tests, actual SDK Chromium24 and retained UI12 passed. Source delivery is archived after its final checkpoint; exact Stage 4 commit is in the archived task. Both desktop transports/OAuth implemented; Web requires request-stream + HTTP/2/3 + CORS, no proxy. Full/installed gates remain carried below. |
| [E11: Background Agent host](../10-15-agent-background-host/prd.md) | Independent concurrent conversations continue across in-app navigation, with per-conversation sidebar running/unread icons and no stop-before-leaving dialog. Reattach to authoritative state. | E06, E07; preserve delivered E10 session/authority integration. | Six owner outcomes and four-stage plan approved 2026-10-16 (进入开发吧). All four source stages independently reviewed on codex/agent-background-host: retained execution/drafts, native single-window lifetime and viewed-only sidebar activity. Chromium13, integrated40/524 plus finaldelta4/82 and actual macOS hidden370429ms passed. Final source stage committed as `7fb1b3c0` and source delivery archived; installed macOS/Windows and full/build acceptance stays in the final batch. |

### Cancelled scope

| Former delivery | Disposition on 2026-10-16 |
| --- | --- |
| E12: Delegation/concurrency | Cancelled by the owner; not implemented. Unused task directory removed. |
| E13: Programmatic workflows | Cancelled by the owner; not implemented. Unused task directory removed. |
| E14: Scheduled follow-ups | Cancelled by the owner; not implemented. Unused task directory removed. |
| E15: Browser/computer study | Cancelled by the owner; not implemented. Unused task directory removed. |

The delivery order and dependencies above document the completed source work. Cancelled scope is excluded from the delivered count; earlier research proposals remain historical evidence.

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
| Owner request on 2026-10-16: sidebar loading/unread icons, concurrent conversations, no stop-before-leaving, desktop background and one application window | E11 | Two conversations progress independently; row icons/read cursors remain truthful, navigation does not cancel, and manual drafts remain protected. Window close retains the host; reopen/repeated launch reuses it; explicit Quit ends it without replay. macOS and Windows source plus actual platform acceptance are distinct. Child Agents were excluded when the owner cancelled E12. |
| Spawn/Fork, role contexts, messages, budgets and child scope | E12 (cancelled) | Not implemented; owner cancelled this scope on 2026-10-16. Historical proposed acceptance: Managed child lineage, cancellation, bounded read concurrency and exclusive effects. |
| PTC/programmatic batches and nested-tool concurrency | E13 (cancelled) | Not implemented; owner cancelled this scope on 2026-10-16. Historical proposed acceptance: Verified outputs and preserved nested policies, cancellation and ledger. |
| Timers, cold follow-up, missed runs and acknowledgement windows | E14 (cancelled) | Not implemented; owner cancelled this scope on 2026-10-16. Historical proposed acceptance: Host availability plus duplicate/crash admission tests. |
| Browser/CUA and experimental-provider boundaries | E15 (cancelled) | Not implemented; owner cancelled this scope on 2026-10-16. Historical proposed acceptance: Decision evidence before enabling capability; state verification after actions. |
| Framework adoption versus mechanisms/protocol SDK; SDK control limits | E06, E10, E11 (E15 cancelled) | Preserve reviewed option comparison; no global decision to replace Cuepoint core. |
| Business atomicity, exact paid confirmation, reviewed memory/current credentials | Every delivery; parent final integration | Existing guarantees stay executable; a dispatched request or external worker result cannot forge product completion. |
| Runtime evidence, not unexecuted reference assertions | Every delivery | Record source/static, deterministic tests, real UI, native/package and live-service evidence distinctly. |

## Research record

[Original investigation](../10-15-desktop-agent-capability-research/prd.md) remains a linked evidence child. Its source investigation and scope handoff are complete; it is archived with the parent. The investigation itself has no product implementation. Subsequent owner authorization covers sequential delivery commits and completed-child archive/journal bookkeeping; no remote push is included.

## Validation cadence

During implementation the owner requested only necessary affected tests and scoped review per task. On 2026-10-16 the owner explicitly took over final checks and requested task closure. No further AI-run regression, production build, packaging or installed acceptance is scheduled by this epic. The items below are retained for the owner; none is marked passed by archival.

## Final verification handoff

Owner: **user**. State: **handed off; not run as part of this closure**.
The 2026-10-16 request supersedes the earlier AI-run final-batch plan. Archive
status means the selected source deliveries and bookkeeping are closed. Existing
focused evidence stays valid; full regression, emitted/packed consumer, build,
packaging and installed macOS/Windows checks remain for the owner. The retained
acceptance below is a handoff reference, not an active Trellis development queue.

### E08 media acceptance handed to the owner

- Actual Windows fixed-NTFS, Unicode paths, picker and process workflow.
- Intel/macOS 14 and installed media preview/Stop.
- Packaged decoder resource identity and signing.
- Final full regression/build/emitted/packed/native integration.

Source/check details remain in the [E08 record](../10-15-desktop-workspace-media/task.json)
and [implementation validation](../10-15-desktop-workspace-media/research/implementation-validation.md).

## Cross-delivery acceptance (owner handoff)

### E09 acceptance carried forward from the archived source delivery

The owner authorized archiving E09 and moving on on 2026-10-16. Preserve these
unperformed checks in the epic's final batch; archival is source-delivery closure:

- Full regression and formal quality/application build, including checking that
  aggregate discovery includes the affected TSX UI suites (the default shared
  Vitest profile currently discovers `.test.ts` only).
- Isolated emitted-declaration and offline packed-consumer acceptance. The
  repair's explicit library regeneration, entry checks and actual Edge Agent
  smoke are narrower evidence, not completion of these isolation gates.
- Actual installed macOS picker and retained skill management flow.
- Windows cfg/native execution and installed picker/UI on fixed local NTFS.
- E08 native/installed media acceptance stays under E08; no E09 check clears it.

Source/check details remain in the [archived E09 record](../10-15-agent-installable-skills/task.json)
and [repair review](../10-15-agent-installable-skills/research/runtime-repair-review.md).

### E10 acceptance carried forward from the source delivery

E10 implements desktop stdio and Streamable HTTP, none/manual/OAuth, the actual
Agent approval/E07 result path, shared retained management and compatible browser
remote support. Source-stage receipts do not discharge this epic's final batch:

- Full formal lint/unused/architecture/model/regression, whole app production
  builds and isolated emitted/declaration/offline packed-consumer checks. The
  explicit Agent-library regeneration and development /agent import smoke are
  narrower evidence. Include the MCP TSX suites in aggregate test discovery.
- Actual signed/installed macOS Keychain authorization, vault unavailable/rotation,
  local executable and ordinary-descendant stop/drain, and both native transports
  through normal and isolated application entry points.
- Windows cfg/native execution, Credential Manager Local persistence and Job
  Object descendants, plus the installed configuration/connect/disconnect/teardown
  flows. macOS compilation and memory vault fixtures do not prove these.
- Installed system-browser PKCE callbacks, exact loopback/firewall behavior,
  preregistered public-client/DCR compatibility and app/window teardown. Controlled
  local TCP/HTTP/OAuth fixtures do not establish third-party IdP acceptance.
- Practical Web deployment requires request-stream support, HTTP/2 or HTTP/3,
  CORS and a matching public-client callback. The controlled TLS fixture is not
  production certificate, third-party registration or CIMD evidence. No proxy or
  persistent browser credential fallback was introduced.
- Preserve the one reported pre-interaction Dexie PrematureCommit observation for
  broader integration runs. The strict final retained-UI fixture passed without
  retry or error suppression; no unrelated store repair was invented in E10.

E08's pending installed media checks and archived E09 acceptance remain separate.

### E11 planned final-batch acceptance

The [E11 design](../10-15-agent-background-host/design.md) and
[four-stage plan](../10-15-agent-background-host/implement.md) separate necessary
source/native probes from final acceptance. E11 source implementation and independent
review are complete; none of these final-batch checks are claimed complete:

- Full formal quality/regression/whole-app builds and affected TSX aggregate
  discovery, plus isolated emitted/declaration/packed consumer if applicable.
- Actual installed macOS and Windows hidden progress with two conversations,
  tray/Dock/platform reopen, simultaneous launch, original session retention and
  idempotent Quit/cold restart with zero automatic effect replay.
- Windows WebView2/Job Object/native process cleanup and signed macOS native
  permission behavior, together with the actual final linked/installer footprint.

The available-host hidden-progress feasibility probe is necessary during E11,
not a replacement for these final installed checks. Earlier E08/E09/E10 residual
acceptance remains independent.

### Shared integration cases

1. E01/E16 details continue working after E02/E03/E04 change draft, status and query handling; opening or editing a detail never changes the conversation's execution owner.
2. Later native/external jobs use the same phase/cancellation truth introduced in early UX work rather than parallel success/approval systems.
3. Future background execution revises actual departure semantics deliberately; E01's in-place details already avoid departure without depending on a background host.
4. New package boundaries follow reusable consumers and platform ownership; keep a single neutral loop/providers plus the existing product transaction owner.
5. Closure disposition: selected source deliveries archived; E12–E15 cancelled; all unperformed final acceptance handed to the owner on 2026-10-16.
