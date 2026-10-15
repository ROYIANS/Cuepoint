# E15: 浏览器与电脑操作专项评估

## Goal

Evaluate one justified browser or desktop-control workflow before committing an experimental capability to the product.

## Planning state

Backlog/planning under [Agent experience and desktop evolution](../10-15-agent-experience-desktop-evolution/prd.md). The owner authorized task organization and sequential delivery. This record is not an approved implementation or architecture. Complete this task's decision inventory, technical design and validation plan before its own final review and activation.

## Evidence

- [Research: capability-comparison.md](../10-15-desktop-agent-capability-research/research/capability-comparison.md)
- [Research: host-integration-review.md](../10-15-desktop-agent-capability-research/research/host-integration-review.md)

## Dependencies and order

- E06: [E06 delivered contracts](../archive/2026-10/10-15-agent-resource-capabilities/prd.md) — use its reviewed contracts/results before this task is activated.
- E07: `../10-15-agent-jobs-results/` — use its reviewed contracts/results before this task is activated.
- E11: `../10-15-agent-background-host/` — use its reviewed contracts/results before this task is activated.

Tree position does not enforce these dependencies. If a dependency is deliberately narrowed or removed, update this PRD and the parent roadmap with the corresponding lifecycle/acceptance consequence before review.

## Requirements

- E15-R1: Choose a concrete workflow lacking an adequate existing API/tool route and compare browser automation with full desktop input.
- E15-R2: Document platform/user grants, session/resource ownership, verification after actions, cancellation and shared-desktop interference.
- E15-R3: Treat reference experimental providers as evidence to evaluate, not shipped stable defaults.

## Acceptance criteria

- [ ] E15-AC1: A decision report and bounded prototype plan state actual permissions, verified completion evidence, limitations and rollback.
- [ ] E15-AC2: If a prototype is later separately approved, it verifies resulting state rather than declaring success from input dispatch.
- [ ] E15-AC3: No browser/CUA capability is enabled merely because this planning task exists.

## Boundaries

- Preserve one reusable Agent loop, sole product transaction owner, exact approval, current credentials, scoped references and explicit unknown outcomes.
- Keep browser and desktop behavior shared where supported. No second product store, unreviewed core replacement, automatic external-effect replay or arbitrary renderer IPC.
- Future features listed in sibling tasks do not enter this task merely because they share files. Test actual observable behavior with bounded deterministic fixtures before live/paid checks.

## Decisions to converge before implementation

- Whether a first use case justifies implementation, initial platform and chosen provider.
