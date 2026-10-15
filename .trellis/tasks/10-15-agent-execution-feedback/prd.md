# E03: 执行阶段、停止反馈与响应测量

## Goal

Track actual execution phases, keep preparation quiet, acknowledge Stop immediately and measure receipt-to-display latency before changing streaming publication.

## Planning state

Planning under [Agent experience and desktop evolution](../10-15-agent-experience-desktop-evolution/prd.md), using the owner’s subsequent authorization to continue sequential stages and commit each one. Source investigation and minimal design are prepared while E02 is finishing; activate only after its final contracts are committed. Necessary checks only; full regression/build/packaging at batch completion.

## Evidence

- [Research: interaction-audit.md](../10-15-desktop-agent-capability-research/research/interaction-audit.md)

## Dependencies and order

- E02: `../archive/2026-10/10-15-agent-optimistic-send/` — use its reviewed contracts/results before this task is activated.

Tree position does not enforce these dependencies. If a dependency is deliberately narrowed or removed, update this PRD and the parent roadmap with the corresponding lifecycle/acceptance consequence before review.

## Requirements

- E03-R1: Derive a small set of internal phases from real preparation/dispatch/output/approval/settlement boundaries. Only actual waiting, explicit Stop and actionable conditions need existing UI feedback; preparation/model probing and advancing replies stay quiet.
- E03-R2: Acknowledge Stop immediately and idempotently while preserving locks until authoritative settlement and retaining partial output and completed effects.
- E03-R3: Measure click, provisional display, durable admission, dispatch, first received delta, first displayed delta and final persistence separately.
- E03-R4: Evaluate a scoped live-text overlay only if measurements justify it; committed checkpoints remain the recovery floor and persistence failure remains visible.

## Acceptance criteria

- [x] E03-AC1: Delayed preparation keeps submitted content visible without preparation/model-confirmation copy; no-first-token waiting after actual request invocation uses accurate existing feedback.
- [x] E03-AC2: Stop during preflight, begin, streaming and final flush immediately shows pending cancellation and never implies already committed effects were undone.
- [x] E03-AC3: Measured first-received and first-displayed deltas are distinct; no latency claim is inferred from bundle size or source order.
- [x] E03-AC4: Conditional disposition: no overlay selected without latency evidence; existing confirmed storage publication and save-failure behavior remain. No unimplemented overlay is claimed.

## Boundaries

- Preserve one reusable Agent loop, sole product transaction owner, exact approval, current credentials, scoped references and explicit unknown outcomes.
- Keep browser and desktop behavior shared where supported. No second product store, unreviewed core replacement, automatic external-effect replay or arbitrary renderer IPC.
- Future features listed in sibling tasks do not enter this task merely because they share files. Test actual observable behavior with bounded deterministic fixtures before live/paid checks.

## Decisions to converge before implementation

- Resolved: actual-boundary phases and invocation-owned, content-free memory timing with standard User Timing retrieval, bounded to eight invocations/256 owned entries and disposed with the owner. Follow the owner's explicit rejection of preparation and automatic model-confirmation captions.
- Resolved: no live-text overlay is selected because no measurements currently justify changing publication. AC4 is conditional and is satisfied by recording this disposition, not by implementing an unselected path.
- No extra product clarification is required for this bounded scope. See [design](./design.md), [plan](./implement.md) and [source investigation](./research/phase-timing-design.md).

## Delivery evidence

Necessary implementation evidence is in [results](./research/implementation-results.md), with final full changed-scope independent [review](./research/review.md). Controlled runtime/DOM checks establish boundary and ownership behavior; no live latency or native/package acceptance is claimed.
