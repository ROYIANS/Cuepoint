# E1-E11/E16 delivery code review

## Goal

Independently review the delivered E01-E11 and E16 tasks. Start from each archived PRD, then judge from code and tests whether the delivery actually meets it. The reference project is `/Users/xiaomengdao/WebstormProjects/deepseek-harness` (dsh). Output is a report only; no product code is changed.

## Scope

Seven reviewed deliveries are archived under `.trellis/tasks/archive/2026-10/`:

| ID | Task dir | Commit |
| --- | --- | --- |
| E01 | 10-15-agent-parallel-details | 5f8b6ab0 |
| E02 | 10-15-agent-optimistic-send | 447a9fb7 |
| E03 | 10-15-agent-execution-feedback | 9e3b8dcb |
| E04 | 10-15-agent-thread-reading | 982dece3, 8220faf5 |
| E05 | 10-15-creative-operation-feedback | 04d47969 |
| E06 | 10-15-agent-resource-capabilities | d4c2c877 |
| E07 | 10-15-agent-jobs-results | c9fd6706 |
| E08 | 10-15-desktop-workspace-media | 52e584c7, 2b00d8e5, ca2da1a5 |
| E09 | 10-15-agent-installable-skills | 0c7b8b10, e7a5c8ff, 0449ed6f, 1e74e0c8 |
| E10 | 10-15-agent-mcp-integration | 45bffe3c, 9d2d2de6, 80513428 + stage 4 |
| E11 | 10-15-agent-background-host | 7fb1b3c0 and earlier stages |
| E16 | 10-15-business-detail-link-rollout | 8ac73652 |

Code is reviewed on the current stacked branch `codex/agent-background-host`, which contains all of them.

## Requirements

1. Per delivery, map each PRD acceptance criterion to evidence: implementing code, tests, and the claimed manual/UI checks. Mark each as Met, Partly met, Not met, or Unverifiable.
2. Check the claims in each task's `task.json` and journal against the code (for example "no overlay selected", "no proxy fallback", "zero replay").
3. Review code quality: correctness, races and lifecycle, error handling, security (grants, OAuth, credentials, path confinement), spec compliance in `.trellis/spec/`, and test adequacy.
4. For E06-E11, compare against the matching dsh package (`jobs`, `skill`, `mcp`, `fs`, `sandbox`, `spill`, `credentials`, `host`, `session`) and record where the design is weaker, divergent or deliberately different.
5. Cross-delivery: check integration seams (E02/E03 send lifecycle, E06 contracts consumed by E07-E10, E10/E11 session authority) and anything dropped by the cancelled E12-E15.
6. Run only read-only commands and targeted existing tests, if needed to confirm a finding. Do not run full builds or packaging, which the owner took over.

## Out of scope

- Code changes or fixes.
- Full regression, packaging, installed macOS/Windows acceptance (owner's handoff).
- E12-E15 (cancelled).

## Deliverable

- `research/review-<id>.md` per delivery with findings ranked by severity (P0-P3) and file:line evidence.
- `research/review-summary.md`: overall quality verdict, a PRD coverage matrix, top risks, dsh comparison, and recommended follow-ups.

## Acceptance Criteria

- [ ] All 12 deliveries have a per-delivery review file.
- [ ] Every finding cites code or test evidence; unverified claims are labelled.
- [ ] Summary covers cross-delivery risks and the dsh comparison.
- [ ] No product source file modified (`git diff --stat` shows only `.trellis/`).
