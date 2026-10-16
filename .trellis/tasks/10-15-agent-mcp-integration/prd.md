# E10: MCP 外部工具与资源接入

## Goal

Connect explicitly selected external tool servers through the same approval, lifecycle and result pipeline.

## Planning state

Backlog/planning under [Agent experience and desktop evolution](../10-15-agent-experience-desktop-evolution/prd.md). The owner authorized task organization and sequential delivery. This record is not an approved implementation or architecture. Complete this task's decision inventory, technical design and validation plan before its own final review and activation.

## Evidence

- [Research: capability-comparison.md](../10-15-desktop-agent-capability-research/research/capability-comparison.md)
- [Research: host-integration-review.md](../10-15-desktop-agent-capability-research/research/host-integration-review.md)
- [Initial E10 source/protocol and scope investigation](./research/scope-and-host-options.md) — 2026-10-16; current seams, local reference behavior, official SDK candidates and transport trade-offs. No implementation or actual MCP compatibility result is claimed.

## Confirmed background

- On 2026-10-16 the owner authorized archiving E09 and moving to the next delivery. E10 is the next roadmap item and is now in requirement/technical investigation.
- The owner subsequently selected both local stdio and remote Streamable HTTP for the first E10 delivery, with macOS and Windows desktop support. Deliver the two transports in reviewed stages within this task; neither transport is deferred to a later task.
- Current production has no general MCP connection/registration entry. Reuse E06 bindings/grants and E07 result/ledger owners, while retaining one Agent loop and product store.
- Local stdio and remote Streamable HTTP have distinct process/network lifecycles. Both are protocol/SDK options; a Node sidecar or E11 background runtime is not already selected.
- Dynamic external tools must fit the existing 36-tool/two-group discovery budget and exact offered-definition/approval identity. Installing an E09 skill does not enable external servers.
- The owner's stage-commit/necessary-check cadence remains the baseline. Browser capability, initial real-server acceptance and authentication coverage remain to converge.

## Dependencies and order

- E06: [E06 delivered contracts](../archive/2026-10/10-15-agent-resource-capabilities/prd.md) — use its reviewed contracts/results before this task is activated.
- E07: [E07 delivered contracts](../archive/2026-10/10-15-agent-jobs-results/prd.md) — use its reviewed contracts/results before this task is activated.

Tree position does not enforce these dependencies. If a dependency is deliberately narrowed or removed, update this PRD and the parent roadmap with the corresponding lifecycle/acceptance consequence before review.

## Requirements

- E10-R1: Evaluate protocol SDK adoption separately from importing Cordis plugins or a complete Harness worker.
- E10-R2: Support both desktop local stdio and remote Streamable HTTP on macOS/Windows. Define server configuration/credentials, namespaces, schema validation, generation identity and disconnect/reconnect cleanup for each transport.
- E10-R3: All external calls share resource checks, approval, cancellation, output limits and truthful unknown-effect handling.
- E10-R4: Keep process environment scrubbing distinct from actual filesystem/network confinement.

## Acceptance criteria

- [ ] E10-AC1: A selected test server exposes tools/resources and calls reach the unified policy/result flow.
- [ ] E10-AC2: Reconnect/uninstall drains old ownership and cannot retarget an outstanding approval or orphan a process.
- [ ] E10-AC3: Lost replies and cancellation never authorize automatic repetition of unknown external effects.
- [ ] E10-AC4: Both local stdio and remote Streamable HTTP expose selected tools/resources through the same policy/result pipeline. macOS/Windows source and actual installed acceptance are recorded distinctly; per-stage checks stay scoped and installed/full-build acceptance follows the epic-end cadence.

## Boundaries

- Preserve one reusable Agent loop, sole product transaction owner, exact approval, current credentials, scoped references and explicit unknown outcomes.
- Keep browser and desktop behavior shared where supported. No second product store, unreviewed core replacement, automatic external-effect replay or arbitrary renderer IPC.
- Future features listed in sibling tasks do not enter this task merely because they share files. Test actual observable behavior with bounded deterministic fixtures before live/paid checks.

## Decisions to converge before implementation

- Next: whether the initial remote authentication scope includes browser-based OAuth login as well as unauthenticated/manual-credential connections. Recommendation: include OAuth login for a more complete remote connection experience; owner selection pending. Current product has manually supplied API keys, not an existing OAuth client.
- Initial server/use-case acceptance and browser availability.
- Credential storage, installation trust and server/tool permission presentation.

Keep this task planning until product choices converge and concrete design,
implementation/validation plan and context manifests are reviewed. The initial
investigation is not the final planning summary or an activation request.
