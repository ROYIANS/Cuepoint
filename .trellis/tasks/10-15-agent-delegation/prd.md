# E12: 子 Agent 委派与并发治理

## Goal

Delegate bounded research/creative/review work with controlled concurrency, grants, budgets and write ownership.

## Planning state

Backlog/planning under [Agent experience and desktop evolution](../10-15-agent-experience-desktop-evolution/prd.md). The owner authorized task organization and sequential delivery. This record is not an approved implementation or architecture. Complete this task's decision inventory, technical design and validation plan before its own final review and activation.

## Evidence

- [Research: capability-comparison.md](../10-15-desktop-agent-capability-research/research/capability-comparison.md)
- [Research: host-integration-review.md](../10-15-desktop-agent-capability-research/research/host-integration-review.md)

## Dependencies and order

- E06: [E06 delivered contracts](../archive/2026-10/10-15-agent-resource-capabilities/prd.md) — use its reviewed contracts/results before this task is activated.
- E07: `../10-15-agent-jobs-results/` — use its reviewed contracts/results before this task is activated.
- E11: `../archive/2026-10/10-15-agent-background-host/` — use its reviewed contracts/results before this task is activated.

Tree position does not enforce these dependencies. If a dependency is deliberately narrowed or removed, update this PRD and the parent roadmap with the corresponding lifecycle/acceptance consequence before review.

## Requirements

- E12-R1: Define spawn/fork context, child identity, model routing, depth, messaging, completion and cancellation.
- E12-R2: Classify safe concurrent reads and exclusive effects; inherited grants cannot be widened by descendants.
- E12-R3: Coordinate creative writes through current revisions and product commands; a child result does not directly declare product completion.

## Acceptance criteria

- [ ] E12-AC1: Two bounded read tasks can complete with traceable lineage and budgets; exclusive effects remain serialized as designed.
- [ ] E12-AC2: Cancellation/parent teardown cleans owned children and preserves uncertain external effects.
- [ ] E12-AC3: Concurrent manual/Agent writes cannot silently overwrite a newer business revision.

## Boundaries

- Preserve one reusable Agent loop, sole product transaction owner, exact approval, current credentials, scoped references and explicit unknown outcomes.
- Keep browser and desktop behavior shared where supported. No second product store, unreviewed core replacement, automatic external-effect replay or arbitrary renderer IPC.
- Future features listed in sibling tasks do not enter this task merely because they share files. Test actual observable behavior with bounded deterministic fixtures before live/paid checks.

## Decisions to converge before implementation

- First delegated workflow and whether background-host lifetime is required or deliberately narrowed.
- Model/budget controls, maximum concurrency and child write policy.
