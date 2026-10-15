# E04: 话题加载身份与阅读导航

## Goal

Keep loading, empty results and owned navigation decisions accurate across topic switches and let readers return to current output.

## Planning state

Active delivery under [Agent experience and desktop evolution](../10-15-agent-experience-desktop-evolution/prd.md), using the owner's standing authorization to continue sequential stages and commit each one. E03 committed as 9e3b8dcb and archived. Source investigation, minimal design and necessary validation plan are complete; see design.md, implement.md and research/query-reading-design.md. Full regression/build/package/native acceptance remains at batch completion.

## Evidence

- [Research: interaction-audit.md](../10-15-desktop-agent-capability-research/research/interaction-audit.md)

## Dependencies and order

- No prerequisite delivery. Coordinate shared Agent/UI files with sibling work; sequential delivery is preferred.

Tree position does not enforce these dependencies. If a dependency is deliberately narrowed or removed, update this PRD and the parent roadmap with the corresponding lifecycle/acceptance consequence before review.

## Requirements

- E04-R1: Return requested-thread identity with message/run queries, including empty results; retain old cached values only under a matching scope.
- E04-R2: Use matching-thread runs in departure predicates and preserve genuine active-execution confirmation.
- E04-R3: Provide an accessible back-to-latest action when following is paused; preserve user reading intent and existing instant stream scrolling.

## Acceptance criteria

- [x] E04-AC1: When B reads are held after A to B navigation, B displays loading rather than a false empty conversation and departure checks do not use A runs.
- [x] E04-AC2: Current filtering/keyed-workspace protection against old transcript display remains intact; parent execution/draft ownership is not remounted as a workaround.
- [x] E04-AC3: Reading older content remains stable while output grows; keyboard/touch activation returns to latest and resumes following.

## Boundaries

- Preserve one reusable Agent loop, sole product transaction owner, exact approval, current credentials, scoped references and explicit unknown outcomes.
- Keep browser and desktop behavior shared where supported. No second product store, unreviewed core replacement, automatic external-effect replay or arbitrary renderer IPC.
- Future features listed in sibling tasks do not enter this task merely because they share files. Test actual observable behavior with bounded deterministic fixtures before live/paid checks.

## Decisions to converge before implementation

- Resolved: per-topic reading-position persistence is excluded. Preserve existing thread-entry reset, threshold and instant scrolling; add one local actionable return control.
- Resolved: inline requested-identity envelopes for messages/runs/compactions plus local departure ownership; preserve parent execution/composer and generic query retention.
- No extra user decision is needed for this bounded scope under standing sequential authorization.

## Delivery evidence

See [implementation results](./research/implementation-results.md) and the independent full changed-scope [review](./research/review.md). Controlled actual observer/hook/DOM checks are distinct from real browser layout, native and batch build acceptance.
