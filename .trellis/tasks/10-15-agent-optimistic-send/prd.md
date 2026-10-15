# E02: 消息即时回显与失败恢复

## Goal

Make a valid Send gesture immediately visible and recoverable before model discovery or durable admission completes.

## Planning state

Backlog/planning under [Agent experience and desktop evolution](../10-15-agent-experience-desktop-evolution/prd.md). The owner authorized task organization and sequential delivery. This record is not an approved implementation or architecture. Complete this task's decision inventory, technical design and validation plan before its own final review and activation.

## Evidence

- [Research: interaction-audit.md](../10-15-desktop-agent-capability-research/research/interaction-audit.md)

## Dependencies and order

- No prerequisite delivery. Coordinate shared Agent/UI files with sibling work; sequential delivery is preferred.

Tree position does not enforce these dependencies. If a dependency is deliberately narrowed or removed, update this PRD and the parent roadmap with the corresponding lifecycle/acceptance consequence before review.

## Requirements

- E02-R1: Capture immutable attempt identity, intended thread/home scope, submitted text, attachment revisions and draft revision before the first awaited operation.
- E02-R2: Show a provisional user message and separate the submitted payload from a newer editable draft; reconcile with the accepted user/run by identity without duplicate bubbles.
- E02-R3: Make preparation/admission failure recoverable near the attempted message; retry/edit must preserve later draft edits and reconcile uncertain acceptance before re-admission.
- E02-R4: Keep compatibility checks, thread ownership, exact references, model dispatch and original atomic begin semantics.

## Acceptance criteria

- [ ] E02-AC1: With thread creation, compatibility and native begin held, the next render shows the exact submitted payload and pending feedback.
- [ ] E02-AC2: New-topic admission transfers the visible submission to its durable thread without remounting/aborting its own execution or creating a duplicate.
- [ ] E02-AC3: Pre-admission failure retains recoverable text/attachments; restoring it never overwrites a newer draft; same-tick duplicate gestures produce one accepted intent.
- [ ] E02-AC4: Lost commit acknowledgement leads to status reconciliation; no automatic duplicate model or paid request starts.

## Boundaries

- Preserve one reusable Agent loop, sole product transaction owner, exact approval, current credentials, scoped references and explicit unknown outcomes.
- Keep browser and desktop behavior shared where supported. No second product store, unreviewed core replacement, automatic external-effect replay or arbitrary renderer IPC.
- Future features listed in sibling tasks do not enter this task merely because they share files. Test actual observable behavior with bounded deterministic fixtures before live/paid checks.

## Decisions to converge before implementation

- Whether and which unsent textual drafts persist across reload.
- The concrete accepted-intent identity contract and attachment recovery policy.
