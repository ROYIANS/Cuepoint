# Execution plan

Approved to execute by user on 2026-09-18 (“提交然后做下一批”).

1. Add additive optional entity fields, relation validation/delete cleanup/creation inheritance and package remapping with repo tests.
2. Add typed verified output capability profiles, validators/payload mapping and test coverage. Add project information/default-style/output UI with explicit validation and saved-state feedback.
3. Extend asset detail optional sections, owner-scoped library search/tab return, and shared same-owner media reuse picker.
4. Wire shot prop/style controls and named delivery data; preserve explicit inherit vs none and status/manual workflow. Improve touched film/mobile language and layout.
5. Integrate, update applicable executable specs, independent full-scope trellis-check; run local pnpm lint/test/build and browser manual workflow.
6. Record verification and next-batch boundaries. Commit only with applicable user authorization, excluding pre-existing .tanstack.

Ownership: repo/types/package worker; assets/library/media worker; shot/delivery worker; main owns domain/output.ts and project settings/workspace UI plus docs. All workers coordinate shared API names before writes and do not revert other work.

## Completion
Implementation and independent checks complete; see verification.md. Commit plan prepared, third batch remains queued.
