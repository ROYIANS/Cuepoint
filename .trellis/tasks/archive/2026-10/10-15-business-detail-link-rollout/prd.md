# E16: Business-detail coverage and modal-review handoff

## Goal

After E01 establishes the shared no-drawer host and single-shot editor, expand recognized business-entity detail links and make targets from batch review reachable without discarding review drafts or stopping the Agent.

## Evidence

- [Focused navigation research](../../../10-15-agent-experience-desktop-evolution/research/parallel-detail-navigation.md), especially link coverage and modal-source integration.
- [Parent roadmap](../../../10-15-agent-experience-desktop-evolution/roadmap.md).

## Dependencies and order

Requires [E01](../10-15-agent-parallel-details/prd.md)'s reviewed presentation/activation/draft contracts. Recommended after the early E02-E05 UX deliveries, before expanding tool capability. This dependency is explicit and is not inferred from task-tree order.

## Requirements

- E16-R1: Inventory recognized project/episode/asset/material/audio/music/task/memory destinations against actual existing detail owners; define the supported coverage and rollout without turning arbitrary hrefs into privileged entity reads.
- E16-R2: Reuse existing feature-owned viewing/editing components and commands in the shared parallel/full-width surface. Keep current schema, transaction, revision, focus, scroll and unsaved-session behavior.
- E16-R3: Cover batch-review modal target links with an intentional detail transition/return. The batch draft, pending save, approval identity and review session remain retained; a portal behind a modal's inert/focus boundary is not an accepted result.
- E16-R4: Preserve meaningful destinations such as continue-in-project, open settings, reveal originating call and external web links; not every navigation action is passive detail inspection.

## Acceptance criteria

- [x] E16-AC1: A coverage table names every supported target shape and entry point; unsupported destinations have an explicit behavior instead of a blank/fake detail.
- [x] E16-AC2: Each supported entity opens its correctly owned detail while chat continues; invalid/late/foreign/missing reads cannot show or edit another target.
- [x] E16-AC3: Opening a target from a dirty batch review makes details visible/keyboard reachable and can return to the exact retained review, with no accidental approval/generation or draft loss.
- [x] E16-AC4: Cross-panel replacement and wide/full-width transitions preserve the appropriate feature guard and do not cause conversation-stop confirmation.

## Boundaries and decisions before implementation

The bounded design is reviewed under standing sequential authorization: exact shots plus all four asset kinds in project/Studio ownership, and retained batch-review handoff. The complete family inventory in research/detail-rollout-design.md names intentional navigation and concrete later work for material/IP/memory/project/episode/audio/music/task destinations. This stage does not claim all business entities have an inline editor. Preserve every supported owner/guard and meaningful fallback; no new business workflow, Agent runtime or arbitrary URL routing. See design.md, implement.md and the concrete composition proposal for dependency ordering and necessary validation.

## Planning state

E05 committed as `04d47969` and archived. E16 enters implementation using the owner’s standing sequential-stage authorization; no unresolved product preference is required for this finite supported target set.

## Delivery evidence

The supported finite slice is implemented and independently checked. See research/implementation-composition.md, implementation-assets.md, implementation-batch.md, browser-asset-layout.md and review.md for exact executed scopes and limits. Necessary source tests, direct Studio types, scoped lint and architecture passed; build/packaged/native/live-provider and broad batch integration remain deferred. Intentional navigation and future entity-family work remain explicit in the coverage inventory.
