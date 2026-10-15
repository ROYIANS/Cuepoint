# E08: 本地工作区与媒体自动化

## Goal

Deliver a complete authorized-directory-to-verified-media-import workflow through owned native tools.

## Planning state

Backlog/planning under [Agent experience and desktop evolution](../10-15-agent-experience-desktop-evolution/prd.md). The owner authorized task organization and sequential delivery. This record is not an approved implementation or architecture. Complete this task's decision inventory, technical design and validation plan before its own final review and activation.

## Evidence

- [Research: capability-comparison.md](../10-15-desktop-agent-capability-research/research/capability-comparison.md)
- [Research: host-integration-review.md](../10-15-desktop-agent-capability-research/research/host-integration-review.md)

## Dependencies and order

- E06: `../10-15-agent-resource-capabilities/` — use its reviewed contracts/results before this task is activated.
- E07: `../10-15-agent-jobs-results/` — use its reviewed contracts/results before this task is activated.

Tree position does not enforce these dependencies. If a dependency is deliberately narrowed or removed, update this PRD and the parent roadmap with the corresponding lifecycle/acceptance consequence before review.

## Requirements

- E08-R1: Select an initial media workflow: scoped directory scan and media probing followed by a useful transformation and verified project import.
- E08-R2: Use granted paths, file-version checks, owned process cancellation, bounded logs/results and explicit artifact cleanup.
- E08-R3: Keep final project changes through existing product commands and transactions, preserving concurrent edits.
- E08-R4: Evaluate whether a generic shell is necessary after the bounded media workflow; no arbitrary renderer filesystem/shell access is assumed.

## Acceptance criteria

- [ ] E08-AC1: Selected fixture inputs produce verified outputs and import into the intended project with provenance.
- [ ] E08-AC2: Out-of-grant access, changed files and revoked permissions fail before unauthorized effects.
- [ ] E08-AC3: Cancellation stops owned local work and leaves committed product effects/unknown external outcomes truthful.

## Boundaries

- Preserve one reusable Agent loop, sole product transaction owner, exact approval, current credentials, scoped references and explicit unknown outcomes.
- Keep browser and desktop behavior shared where supported. No second product store, unreviewed core replacement, automatic external-effect replay or arbitrary renderer IPC.
- Future features listed in sibling tasks do not enter this task merely because they share files. Test actual observable behavior with bounded deterministic fixtures before live/paid checks.

## Decisions to converge before implementation

- First concrete media operation and executable distribution strategy.
- First supported platforms, allowed paths and overwrite/cleanup semantics.
