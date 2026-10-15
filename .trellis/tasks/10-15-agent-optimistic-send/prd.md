# E02: 消息即时回显与失败恢复

## Goal

Make a valid Send gesture immediately visible and recoverable before model discovery or durable admission completes.

## Planning state

The owner authorized sequential continuation and automatic stage commits on 2026-10-15: “ok，继续，每个阶段完了就提交代码，然后再继续”. E02 implements the previously requested immediate Send/failed recovery outcome after E01. Per-task validation is limited to necessary affected checks; full regression/build/packaging is deferred to batch completion.

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

- [x] E02-AC1: With thread creation, compatibility and native begin held, the next render shows the exact submitted payload; sending feedback remains in the composer, without transient text beside the user bubble.
- [x] E02-AC2: New-topic admission transfers the visible submission to its durable thread without remounting/aborting its own execution or creating a duplicate.
- [x] E02-AC3: Pre-admission failure retains recoverable text/attachments; restoring it never overwrites a newer draft; same-tick duplicate gestures produce one accepted intent.
- [x] E02-AC4: Lost commit acknowledgement leads to status reconciliation; no automatic duplicate model or paid request starts.

## Boundaries

- Preserve one reusable Agent loop, sole product transaction owner, exact approval, current credentials, scoped references and explicit unknown outcomes.
- Keep browser and desktop behavior shared where supported. No second product store, unreviewed core replacement, automatic external-effect replay or arbitrary renderer IPC.
- Future features listed in sibling tasks do not enter this task merely because they share files. Test actual observable behavior with bounded deterministic fixtures before live/paid checks.

## Confirmed scope and decisions

- Preserve the current mounted-page lifetime and original home/thread draft scopes. Reload persistence, queued/steer input and background execution are out of scope.
- Capture exact text/reference revisions and preallocate durable thread/user/run/assistant identities before waiting. Attempts are local presentation, not ProductStore messages or execution authorization.
- Immediately consume the submitted composer snapshot, keep newer edits independently, and restore a failed payload only by whole-draft revision comparison. A refusal to overwrite retains the recoverable attempt.
- Keep one execution owner/controller across provisional home presentation and actual thread navigation; both route hydration and lazy transcript fallback must preserve submitted content.
- Unknown commit remains uncertain even after an absent read; only positively matching accepted records resolve it in this delivery. Provide read-only status checking and block resend/delete/restore while uncertain; never replay a paid request.
- Other execution feedback and live-token publication are E03; general thread loading/reading improvements are E04. Preserve E01 shot details.

- Owner correction during review: “发送后会在用户气泡那里右边出现一个短暂的小字，我不要这个”. Remove ordinary preparing/accepted status text from user bubbles; retain actionable failure, uncertainty and explicit recovery controls.

## Acceptance additions

- [x] E02-AC5: Cold rich transcript and home→thread query hydration do not hide provisional content. Normal matching-null/foreign routes retain their existing missing/loading behavior.
- [x] E02-AC6: Retry/restoration never changes later drafts or reference revisions; Stop before admission remains recoverable, and accepted execution failures use existing run recovery.
- [x] E02-AC7: Focused tests/type/scoped lint and independent review pass; full build/package/native integration is explicitly deferred.

## Planning artifacts

[Design](./design.md), [execution plan](./implement.md), and source-backed research define the current scope. The owner's standing sequential authorization covers this scoped delivery and routine implementation choices; no unresolved product decision is being introduced.
