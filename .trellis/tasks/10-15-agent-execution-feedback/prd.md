# E03: 执行阶段、停止反馈与响应测量

## Goal

Show honest preparation, model-wait and stopping feedback and measure receipt-to-display latency before changing streaming publication.

## Planning state

Backlog/planning under [Agent experience and desktop evolution](../10-15-agent-experience-desktop-evolution/prd.md). The owner authorized task organization and sequential delivery. This record is not an approved implementation or architecture. Complete this task's decision inventory, technical design and validation plan before its own final review and activation.

## Evidence

- [Research: interaction-audit.md](../10-15-desktop-agent-capability-research/research/interaction-audit.md)

## Dependencies and order

- E02: `../10-15-agent-optimistic-send/` — use its reviewed contracts/results before this task is activated.

Tree position does not enforce these dependencies. If a dependency is deliberately narrowed or removed, update this PRD and the parent roadmap with the corresponding lifecycle/acceptance consequence before review.

## Requirements

- E03-R1: Derive a small set of user-facing phases from real preparation/dispatch/output/approval/settlement boundaries.
- E03-R2: Acknowledge Stop immediately and idempotently while preserving locks until authoritative settlement and retaining partial output and completed effects.
- E03-R3: Measure click, provisional display, durable admission, dispatch, first received delta, first displayed delta and final persistence separately.
- E03-R4: Evaluate a scoped live-text overlay only if measurements justify it; committed checkpoints remain the recovery floor and persistence failure remains visible.

## Acceptance criteria

- [ ] E03-AC1: Delayed preparation and no-first-token scenarios keep submitted content and an accurate waiting state visible.
- [ ] E03-AC2: Stop during preflight, begin, streaming and final flush immediately shows pending cancellation and never implies already committed effects were undone.
- [ ] E03-AC3: Measured first-received and first-displayed deltas are distinct; no latency claim is inferred from bundle size or source order.
- [ ] E03-AC4: Any selected overlay invalidates on ownership change, preserves confirmed text on reload and surfaces save failure.

## Boundaries

- Preserve one reusable Agent loop, sole product transaction owner, exact approval, current credentials, scoped references and explicit unknown outcomes.
- Keep browser and desktop behavior shared where supported. No second product store, unreviewed core replacement, automatic external-effect replay or arbitrary renderer IPC.
- Future features listed in sibling tasks do not enter this task merely because they share files. Test actual observable behavior with bounded deterministic fixtures before live/paid checks.

## Decisions to converge before implementation

- Exact phase copy and timing instrumentation retention.
- Whether measured cost warrants a provisional live-text path.
