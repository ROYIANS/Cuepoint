# E05: 创作操作反馈、去重与导入体验

## Goal

Apply consistent pending, failure and duplicate-submit behavior to the sampled asset/project/import operations.

## Planning state

Backlog/planning under [Agent experience and desktop evolution](../10-15-agent-experience-desktop-evolution/prd.md). The owner authorized task organization and sequential delivery. This record is not an approved implementation or architecture. Complete this task's decision inventory, technical design and validation plan before its own final review and activation.

## Evidence

- [Research: interaction-spotchecks.md](../10-15-desktop-agent-capability-research/research/interaction-spotchecks.md)

## Dependencies and order

- No prerequisite delivery. Coordinate shared Agent/UI files with sibling work; sequential delivery is preferred.

Tree position does not enforce these dependencies. If a dependency is deliberately narrowed or removed, update this PRD and the parent roadmap with the corresponding lifecycle/acceptance consequence before review.

## Requirements

- E05-R1: Bring character/scene/prop/style creation up to the existing project-create pending/error/deduplication standard.
- E05-R2: Give asset deletion an operation-scoped pending and failure/result path without treating dialog dismissal as durable success.
- E05-R3: Resolve the archive filter label/predicate mismatch.
- E05-R4: Show completed/total and current stage for batch import; define stop-remaining behavior while preserving confirmed saved items.

## Acceptance criteria

- [ ] E05-AC1: Under delayed storage, rapid asset-create clicks represent one creation intent; failure is recoverable without page reload.
- [ ] E05-AC2: Deletion failure remains associated with the target; known failure and unknown commit are handled differently and no blind destructive replay occurs.
- [ ] E05-AC3: A fixture with one active and one archived project matches the selected filter label in each state.
- [ ] E05-AC4: Batch import failure retains uncompleted items; any selected stop-remaining action stops admitting later files while current outcome is settled.

## Boundaries

- Preserve one reusable Agent loop, sole product transaction owner, exact approval, current credentials, scoped references and explicit unknown outcomes.
- Keep browser and desktop behavior shared where supported. No second product store, unreviewed core replacement, automatic external-effect replay or arbitrary renderer IPC.
- Future features listed in sibling tasks do not enter this task merely because they share files. Test actual observable behavior with bounded deterministic fixtures before live/paid checks.

## Decisions to converge before implementation

- Archive filter means only archived or include archived.
- Exact import cancellation boundary and whether progress delivery includes stop-remaining in the same slice.
