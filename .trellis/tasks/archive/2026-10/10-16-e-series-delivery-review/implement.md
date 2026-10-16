# Execution plan

Review-only task. Run the batches in this order. Each batch can use a read-only `explore` or `generalPurpose` sub-agent that writes `research/review-<id>.md`.

1. **UI/Agent chat batch (E01-E05, E16)**: PRD, then `git show <commit> --stat`, then the code, then the tests.
2. **Core contracts batch (E06, E07)**: compare with dsh `packages/{jobs,spill,guard,credentials}`.
3. **Native/extension batch (E08, E09, E10)**: compare with dsh `packages/{fs,sandbox,skill,mcp,subprocess}`. Pay particular attention to grants, OAuth and credential handling, and process teardown.
4. **Host batch (E11)**: compare with dsh `packages/{host,session}` and `apps/desktop-host`.
5. **Synthesis**: cross-delivery seams, then `research/review-summary.md`.

Validation: `git diff --stat` shows only `.trellis/` changes. Any test run is targeted and read-only.
