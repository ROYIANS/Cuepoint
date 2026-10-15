# E06: 可扩展能力接口与资源权限

## Goal

Define reusable typed capability registration and concrete resource grants before opening local and external tools.

## Planning state

Backlog/planning under [Agent experience and desktop evolution](../10-15-agent-experience-desktop-evolution/prd.md). The owner authorized task organization and sequential delivery. This record is not an approved implementation or architecture. Complete this task's decision inventory, technical design and validation plan before its own final review and activation.

## Evidence

- [Research: capability-comparison.md](../10-15-desktop-agent-capability-research/research/capability-comparison.md)
- [Research: host-integration-review.md](../10-15-desktop-agent-capability-research/research/host-integration-review.md)

## Dependencies and order

- No prerequisite delivery. Coordinate shared Agent/UI files with sibling work; sequential delivery is preferred.

Tree position does not enforce these dependencies. If a dependency is deliberately narrowed or removed, update this PRD and the parent roadmap with the corresponding lifecycle/acceptance consequence before review.

## Requirements

- E06-R1: Preserve one neutral core/providers loop and keep Studio entities, UI, concrete storage and credentials policy in their owners.
- E06-R2: Specify capability registration/disposal, versioned tool identity, effect/concurrency metadata, scope inheritance and resource requirements.
- E06-R3: Define filesystem/process/network/server resource grants, revocation and approval facts checked by the actual host; tool approval and OS confinement remain distinct.
- E06-R4: Keep discovery budgets, pending-call pinning, exact mandatory generation confirmation and unknown-result semantics.

## Acceptance criteria

- [ ] E06-AC1: An independent consumer can bind a selected capability without importing Studio or browser/native packages into the core.
- [ ] E06-AC2: Removing/replacing/revoking a capability cannot silently retarget a pending approval or expand a child scope.
- [ ] E06-AC3: Preview and execution use the same concrete resource facts; denied operations never reach effects.

## Boundaries

- Preserve one reusable Agent loop, sole product transaction owner, exact approval, current credentials, scoped references and explicit unknown outcomes.
- Keep browser and desktop behavior shared where supported. No second product store, unreviewed core replacement, automatic external-effect replay or arbitrary renderer IPC.
- Future features listed in sibling tasks do not enter this task merely because they share files. Test actual observable behavior with bounded deterministic fixtures before live/paid checks.

## Decisions to converge before implementation

- First concrete capability contract and package ownership.
- Resource-grant UX, policy defaults, supported platforms and real confinement backend.
