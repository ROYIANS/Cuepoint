# E06: 可扩展能力接口与资源权限

## Goal

Define reusable typed capability registration and concrete resource grants before opening local and external tools.

## Delivery state

Implemented the reviewed bounded foundation under [Agent experience and desktop evolution](../10-15-agent-experience-desktop-evolution/prd.md). Standing owner authorization covers sequential implementation and commits. Necessary source tests/types/scoped lint/architecture and independent changed-scope review passed. Actual OS/external workflows remain unsupported; emitted/packed/full/native/package acceptance remains deferred to the batch end.

## Evidence

- [Research: capability-comparison.md](../10-15-desktop-agent-capability-research/research/capability-comparison.md)
- [Research: host-integration-review.md](../10-15-desktop-agent-capability-research/research/host-integration-review.md)
- [Concrete source-backed foundation design](research/extension-grant-design.md)

## Dependencies and order

- No capability prerequisite delivery. Execute after E16 in the owner-selected sequential order; that is a delivery order, not a fabricated runtime dependency. Preserve existing Studio static bindings while proving the reusable foundation through the independent Todo consumer.

Tree position does not enforce these dependencies. If a dependency is deliberately narrowed or removed, update this PRD and the parent roadmap with the corresponding lifecycle/acceptance consequence before review.

## Requirements

- E06-R1: Preserve one neutral core/providers loop and keep Studio entities, UI, concrete storage and credentials policy in their owners.
- E06-R2: Specify capability registration/disposal, versioned tool identity, effect/concurrency metadata, scope inheritance and resource requirements.
- E06-R3: Implement exact host-issued list/create resource authority in the existing independent Todo consumer, including revocation, revisions and subset-derived scope. Define filesystem/process/network/server enforcement obligations and deny unsupported families before effects; do not claim those backends or OS confinement exist.
- E06-R4: Keep discovery budgets, pending-call pinning, exact mandatory generation confirmation and unknown-result semantics.

## Acceptance criteria

- [x] E06-AC1: The existing independent Todo consumer binds its selected create capability through public core APIs and executes the shared loop with real SQLite, without importing Studio or browser/native packages into the core.
- [x] E06-AC2: Removing/replacing/revoking a capability cannot silently retarget a pending approval or expand a child scope.
- [x] E06-AC3: Todo preview/approval/claim/atomic execution use the same concrete list/create facts; missing/foreign/revoked/stale/widened authority denies with zero mutation/effect dispatch. Unsupported OS/external family fixtures deny explicitly, without a confinement claim.

## Boundaries

- Preserve one reusable Agent loop, sole product transaction owner, exact approval, current credentials, scoped references and explicit unknown outcomes.
- Keep browser and desktop behavior shared where supported. No second product store, unreviewed core replacement, automatic external-effect replay or arbitrary renderer IPC.
- Future features listed in sibling tasks do not enter this task merely because they share files. Test actual observable behavior with bounded deterministic fixtures before live/paid checks.

## Selected scope and remaining product decisions

- Public neutral registration/binding/grant contracts live in agent-core; the existing independent create_todo operation is the first concrete host slice. Reuse one loop and serial scheduling; Studio static creative bindings remain intact.
- Todo authority defaults deny and is issued explicitly by its trusted host. Prepare does not mint permission; actual approval, claim and atomic effect boundaries recheck exact identity/facts and live ancestry.
- Production grant-settings UX, first native workflow/platform and real filesystem/process/network/server backend remain decisions for E08/E10 before enabling those effects. They do not block the no-OS-effect foundation and are not silently decided here.
- Necessary source suites/types/scoped lint/architecture run per stage; emitted/packed independent-consumer, full/native/package/live gates remain deferred to batch end.


## Delivered evidence and limits

- Public core registration, generation-owned disposal, immutable offered definitions and exact persisted binding are consumed by the actual independent Todo host through the existing shared execution loop. Concrete list/create authority remains host-owned.
- Core: 4 source suites / 36 tests passed, neutral `types: []` noEmit passed. Todo: 1 source suite / 31 tests passed using actual temporary file SQLite and the real host/core loop. These are separate scopes, not repeated-run totals.
- Final combined source and Node-config noEmit passed. The independent check linted 10 changed production sources (excluding tests/config): 0 errors / 15 visible complexity/nesting warnings. Architecture: 655 source files / 2561 static value edges / 12 literal dynamic edges, zero cycles/failures/forbidden/computed imports. No suppression, budget relaxation or automatic build.
- Revocation/replacement at approval, claim and actual atomic boundary performs zero unauthorized Todo effects. New explicit authority may authorize a new call; old preview references remain invalid. Completion/unknown/no-replay and mandatory confirmation remain intact.
- Same-process file reopening proves retained data/identity and no startup dispatch; it does not prove actual CLI/SIGKILL/lease recovery. Unsupported filesystem/process/network/server cases are policy denials, not OS confinement evidence. Emitted declarations, outside-workspace packed consumption, broad/native/package and live-service gates were not executed.
- [Independent review](research/review.md), [frozen scope](research/review-scope.md), [core implementation](research/implementation-core.md), [actual Todo implementation](research/implementation-todo.md), [source profile](research/implementation-validation.md).
