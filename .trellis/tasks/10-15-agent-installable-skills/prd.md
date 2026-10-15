# E09: 可安装创作技能与按需加载

## Goal

Load reusable creative workflow instructions on demand independently from tool execution authority.

## Planning state

Backlog/planning under [Agent experience and desktop evolution](../10-15-agent-experience-desktop-evolution/prd.md). The owner authorized task organization and sequential delivery. This record is not an approved implementation or architecture. Complete this task's decision inventory, technical design and validation plan before its own final review and activation.

## Evidence

- [Research: capability-comparison.md](../10-15-desktop-agent-capability-research/research/capability-comparison.md)

## Dependencies and order

- E06: [E06 delivered contracts](../archive/2026-10/10-15-agent-resource-capabilities/prd.md) — use its reviewed contracts/results before this task is activated.

Tree position does not enforce these dependencies. If a dependency is deliberately narrowed or removed, update this PRD and the parent roadmap with the corresponding lifecycle/acceptance consequence before review.

## Requirements

- E09-R1: Separate skill metadata discovery, body loading and resource access; retain current built-in creative groups.
- E09-R2: Define configured roots/install sources, identity, precedence, updates, uninstall and bounded parsing.
- E09-R3: Loading a skill never implicitly authorizes scripts, processes, files or external servers.

## Acceptance criteria

- [ ] E09-AC1: A selected skill is discovered by metadata and its body/resources load only when requested.
- [ ] E09-AC2: Changes/uninstall affect future availability predictably without rewriting an in-flight accepted tool identity.
- [ ] E09-AC3: An instruction attempting broader access cannot bypass the host resource policy.

## Boundaries

- Preserve one reusable Agent loop, sole product transaction owner, exact approval, current credentials, scoped references and explicit unknown outcomes.
- Keep browser and desktop behavior shared where supported. No second product store, unreviewed core replacement, automatic external-effect replay or arbitrary renderer IPC.
- Future features listed in sibling tasks do not enter this task merely because they share files. Test actual observable behavior with bounded deterministic fixtures before live/paid checks.

## Decisions to converge before implementation

- Supported skill format, installation sources, trust and update UX.
