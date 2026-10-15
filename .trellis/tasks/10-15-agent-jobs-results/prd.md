# E07: 长任务、工具结果回读与产物索引

## Goal

Represent local work and large tool outputs as observable owned jobs/results without claiming persistence means continued execution.

## Planning state

Backlog/planning under [Agent experience and desktop evolution](../10-15-agent-experience-desktop-evolution/prd.md). The owner authorized task organization and sequential delivery. This record is not an approved implementation or architecture. Complete this task's decision inventory, technical design and validation plan before its own final review and activation.

## Evidence

- [Research: capability-comparison.md](../10-15-desktop-agent-capability-research/research/capability-comparison.md)
- [Research: host-integration-review.md](../10-15-desktop-agent-capability-research/research/host-integration-review.md)

## Dependencies and order

- E06: `../10-15-agent-resource-capabilities/` — use its reviewed contracts/results before this task is activated.

Tree position does not enforce these dependencies. If a dependency is deliberately narrowed or removed, update this PRD and the parent roadmap with the corresponding lifecycle/acceptance consequence before review.

## Requirements

- E07-R1: Define queued/accepted/running/stopping/stopped/completed/failed/unknown outcomes and owned progress/cancel/output subscriptions.
- E07-R2: Store bounded inline previews with recoverable references, pagination/range reads and artifact ownership rather than increasing all context limits.
- E07-R3: Separate local process, model turn and remote generation job identities; preserve the current paid-generation state machine.
- E07-R4: Specify teardown, restart history and supported execution lifetime explicitly; do not imply universal cross-restart job resumption.

## Acceptance criteria

- [ ] E07-AC1: Large search/log output stays bounded in model context and the full retained result is readable by a valid owner.
- [ ] E07-AC2: Cancellation distinguishes stopped waiting, stopped owned process and irreversible external effects.
- [ ] E07-AC3: UI reattachment shows authoritative job state; restart marks uncertain work accurately instead of replaying it.

## Boundaries

- Preserve one reusable Agent loop, sole product transaction owner, exact approval, current credentials, scoped references and explicit unknown outcomes.
- Keep browser and desktop behavior shared where supported. No second product store, unreviewed core replacement, automatic external-effect replay or arbitrary renderer IPC.
- Future features listed in sibling tasks do not enter this task merely because they share files. Test actual observable behavior with bounded deterministic fixtures before live/paid checks.

## Decisions to converge before implementation

- Result retention/storage limits and first job backend.
- Which local jobs continue across view/window changes and which outcomes are recoverable.
