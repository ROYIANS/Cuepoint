# E14: 定时跟进与可核实投递

## Goal

Schedule explicit follow-ups with honest host-availability, delivery and duplicate-admission semantics.

## Planning state

Backlog/planning under [Agent experience and desktop evolution](../10-15-agent-experience-desktop-evolution/prd.md). The owner authorized task organization and sequential delivery. This record is not an approved implementation or architecture. Complete this task's decision inventory, technical design and validation plan before its own final review and activation.

## Evidence

- [Research: capability-comparison.md](../10-15-desktop-agent-capability-research/research/capability-comparison.md)
- [Research: host-integration-review.md](../10-15-desktop-agent-capability-research/research/host-integration-review.md)

## Dependencies and order

- E07: `../10-15-agent-jobs-results/` — use its reviewed contracts/results before this task is activated.
- E11: `../archive/2026-10/10-15-agent-background-host/` — use its reviewed contracts/results before this task is activated.

Tree position does not enforce these dependencies. If a dependency is deliberately narrowed or removed, update this PRD and the parent roadmap with the corresponding lifecycle/acceptance consequence before review.

## Requirements

- E14-R1: Select supported one-off/recurring follow-up types, ownership and management UI.
- E14-R2: Specify missed-run, offline, failure/retry and duplicate-delivery behavior; durable reminder state is not exactly-once tool execution.
- E14-R3: Admission receipts, model outcome and business effects remain independently verifiable.

## Acceptance criteria

- [ ] E14-AC1: A due test reminder delivers while its required host is available and shows why it did not execute when unavailable.
- [ ] E14-AC2: Crash around delivery/acknowledgement does not silently repeat an irreversible business operation.
- [ ] E14-AC3: Disable/delete/revise prevents future admission according to an explicit race policy.

## Boundaries

- Preserve one reusable Agent loop, sole product transaction owner, exact approval, current credentials, scoped references and explicit unknown outcomes.
- Keep browser and desktop behavior shared where supported. No second product store, unreviewed core replacement, automatic external-effect replay or arbitrary renderer IPC.
- Future features listed in sibling tasks do not enter this task merely because they share files. Test actual observable behavior with bounded deterministic fixtures before live/paid checks.

## Decisions to converge before implementation

- First recurring workflow, supported lifetime/timezone policy and missed-run semantics.
