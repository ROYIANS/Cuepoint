# E11: 后台 Agent 宿主与重连恢复

## Goal

Move execution ownership out of the chatting view for an explicitly chosen lifecycle while retaining the same public loop and product owner.

## Planning state

Backlog/planning under [Agent experience and desktop evolution](../10-15-agent-experience-desktop-evolution/prd.md). The owner authorized task organization and sequential delivery. This record is not an approved implementation or architecture. Complete this task's decision inventory, technical design and validation plan before its own final review and activation.

## Evidence

- [Research: host-integration-review.md](../10-15-desktop-agent-capability-research/research/host-integration-review.md)
- [Research: capability-comparison.md](../10-15-desktop-agent-capability-research/research/capability-comparison.md)

## Dependencies and order

- E06: `../10-15-agent-resource-capabilities/` — use its reviewed contracts/results before this task is activated.
- E07: `../10-15-agent-jobs-results/` — use its reviewed contracts/results before this task is activated.

Tree position does not enforce these dependencies. If a dependency is deliberately narrowed or removed, update this PRD and the parent roadmap with the corresponding lifecycle/acceptance consequence before review.

## Requirements

- E11-R1: Choose the supported lifetime among navigation, window close, app exit and restart; these are separate promises.
- E11-R2: Evaluate Rust tool bridge plus JS host, app-managed JS runtime/Node sidecar and bounded external-worker alternatives with packaging/IPC costs.
- E11-R3: Adapt actual ownership, product transactions, current credentials, references/materialization, transport and replayable subscriptions.
- E11-R4: Keep exactly one owner per run; persistence or an extra process is not sufficient proof of recovery or background progress.

## Acceptance criteria

- [ ] E11-AC1: For the chosen supported detach case, accepted execution continues once and the reattached UI shows real state without losing decisions.
- [ ] E11-AC2: Crash/restart reconciliation preserves confirmed results, stops stale owners and never blindly repeats unknown paid/external work.
- [ ] E11-AC3: Packaged acceptance verifies the chosen platforms and lifecycle; source compilation alone is not reported as runtime success.

## Boundaries

- Preserve one reusable Agent loop, sole product transaction owner, exact approval, current credentials, scoped references and explicit unknown outcomes.
- Keep browser and desktop behavior shared where supported. No second product store, unreviewed core replacement, automatic external-effect replay or arbitrary renderer IPC.
- Future features listed in sibling tasks do not enter this task merely because they share files. Test actual observable behavior with bounded deterministic fixtures before live/paid checks.

## Decisions to converge before implementation

- Lifecycle promise, host/runtime choice, platform rollout and package-size budget.
