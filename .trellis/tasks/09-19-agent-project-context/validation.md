# Project context validation — 2026-09-19

## Quality gate
- Local machine pnpm (v9 installation), not the Codex runtime pnpm.
- Type-check (`pnpm lint`) passed.
- Full suite: **59 files / 747 tests passed**, including 13 project-context cases.
- Production build passed; existing large agent/vendor chunk warning remains
  (agent chunk approximately 8.19 MB before gzip), outside this task's scope.
- `git diff --check` passed.

## Independent review and corrections
- Business scope verified at prepare/execution/transaction boundaries, generation
  submission/apply and explicit studio import. Durable run/thread owns authority.
- Automatic facts reuse the business field whitelist, omit provider extras and bound
  world/background/rules separately so a long worldview cannot displace rules.
- Invisible changes only refresh fingerprint; visible changes append field/index
  differences rather than repeated full snapshots. Frozen inputs remain intact.
- Every compression request and activation validates project existence/binding; a
  deletion while receiving summary output cannot activate it or launch another pass.
- Deleted-project chats propagate readOnly into memoized messages and tool details:
  saved previews remain inspectable, approval/generation/resume actions disappear.
- Picker handles lock changes while open and guards pending choices.

## Disposable browser evidence
`browser-check.cjs` runs Edge/Playwright with fresh, isolated IndexedDB and a fully
intercepted `https://chat.test` connector. Start local Vite on port 5185; no paid API or
real user data touched. Assertions verified:
1. Task-mode first send without project does not issue a request.
2. Search and ArrowDown/Enter choose a project. Flat popover supports Escape.
3. First real request already contains selected project facts and no unrelated facts.
4. Clarifying reply creates zero tasks. Later actual task tools inherit projectId.
5. Manual project update survives reload and reaches the next request.
6. Another conversation in the same project gets current facts.
7. Board filters by project; manual task creation requires and persists project choice.
8. Inline new-project creation selects the newly persisted project.
9. Desktop 1440x1000 and mobile 390x844: no horizontal overflow; mobile scope uses a
   separate row so the model/send controls retain space.
10. Project deletion preserves history; context error is readable; pending approval
    and end-execution actions disappear, no page errors.

A browser-discovered race was fixed: home Send now obtains the thread Web Lock before
navigating, so detail's abandoned-wrapup recovery cannot steal first-run ownership.
The fixture validates first-request completion, not just the newly-created chat URL.

Existing wrap-up browser fixture was adapted with an explicit project and passed:
manual draft, separate confirmation/completion, reopen staleness, competing-version
conflict preserving unsaved text, history and narrow layout.

## Deliberate boundaries
No legacy migration/backfill or automatic project guessing. Ordinary projectless
Agent chat remains a supported mode. Snapshot is current business facts; long scripts
and asset details are read on demand. Long-term rules/experience storage and retrieval
remain the next two roadmap tasks. Protected continuation differences still count
against the context budget; there is no claim of unlimited within-run history.

## Delivery state
Implementation complete and reviewable. Current project-context and preceding
wrap-up code committed as 6b6289b; user approved archival via “归档”.
