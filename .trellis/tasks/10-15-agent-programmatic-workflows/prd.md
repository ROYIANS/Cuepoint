# E13: 程序化工具编排与批量工作流

## Goal

Reduce model round trips for selected batches while routing every nested operation through existing effect and permission controls.

## Planning state

Backlog/planning under [Agent experience and desktop evolution](../10-15-agent-experience-desktop-evolution/prd.md). The owner authorized task organization and sequential delivery. This record is not an approved implementation or architecture. Complete this task's decision inventory, technical design and validation plan before its own final review and activation.

## Evidence

- [Research: capability-comparison.md](../10-15-desktop-agent-capability-research/research/capability-comparison.md)
- [Research: host-integration-review.md](../10-15-desktop-agent-capability-research/research/host-integration-review.md)

## Dependencies and order

- E06: [E06 delivered contracts](../archive/2026-10/10-15-agent-resource-capabilities/prd.md) — use its reviewed contracts/results before this task is activated.
- E07: `../10-15-agent-jobs-results/` — use its reviewed contracts/results before this task is activated.
- E12: `../10-15-agent-delegation/` — use its reviewed contracts/results before this task is activated.

Tree position does not enforce these dependencies. If a dependency is deliberately narrowed or removed, update this PRD and the parent roadmap with the corresponding lifecycle/acceptance consequence before review.

## Requirements

- E13-R1: Evaluate a typed workflow/batch facility before choosing arbitrary script/PTC execution.
- E13-R2: Nested calls preserve tool identity, scheduling, approval, budgets, result limits and cancellation.
- E13-R3: If code execution is selected, define the actual runtime/OS policy and do not call a normal Node process a restricted language sandbox.

## Acceptance criteria

- [ ] E13-AC1: A selected batch produces verified artifacts with fewer unnecessary model turns and a complete nested-call ledger.
- [ ] E13-AC2: Read concurrency stays within budget; mutation/approval barriers are enforced for nested calls.
- [ ] E13-AC3: Timeout/cancel tears down owned work and keeps actual effect outcomes inspectable.

## Boundaries

- Preserve one reusable Agent loop, sole product transaction owner, exact approval, current credentials, scoped references and explicit unknown outcomes.
- Keep browser and desktop behavior shared where supported. No second product store, unreviewed core replacement, automatic external-effect replay or arbitrary renderer IPC.
- Future features listed in sibling tasks do not enter this task merely because they share files. Test actual observable behavior with bounded deterministic fixtures before live/paid checks.

## Decisions to converge before implementation

- First batch workflow and typed orchestration versus script runtime.
- Runtime distribution and persistent-state expectations.
