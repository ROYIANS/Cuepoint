# Final quality gate

Date: 2026-09-19. Implementation approved by user. Source changes reviewed independently by `trellis-check`; final report in `../research/review.md`. All package commands use `/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm`; no installation or paid calls.

## Automated gate

| Check | Result |
| --- | --- |
| `pnpm lint` (TypeScript project build) | PASS |
| `pnpm test` | PASS: 69 files, 839 tests |
| `pnpm build` | PASS: 12,717 modules transformed |
| `git diff --check` | PASS |

Existing large-chunk build warnings remain; bundling was not changed. All single-generation, task, memory, reference, business and migration suites remain green. The two new batch suites contribute 21 tests. Independent review injected storage faults and fixed both continued paid dispatch after pause persistence failure and early lock release while a sibling was still running. Final gates were run after those fixes.

## Native browser gate

Use isolated Edge/IndexedDB with Vite at `http://127.0.0.1:5185`. Execute `batch-browser.cjs` and `parent-integration.cjs` with local Node. Scripts use the installed Edge and Playwright paths; HTTP is mocked and all fixture data lives in disposable browser contexts. No user data, real credentials or live account services are touched.

`batch-browser.cjs`: PASS, no page errors.

- Real `executeChatRun` invokes batch preparation through both Chat and Responses; immutable original envelopes and zero paid draft traffic verified.
- Five-request scenario (four intentional identical first-frame candidates plus one sibling tail frame): exactly five POSTs, max two active; saved prompts survive reopen; direct repository confirmation issues no HTTP.
- Actual 20-item batch across five targets: exactly twenty more POSTs, max two active, all local downloads saved.
- Sibling-slot application, A→B→A switching, repeated application, manual-edit conflicts and candidate media retention pass.
- Known rejection: three POSTs, one failed/two downloaded; retry yields a fresh unsubmitted one-item draft.
- Unknown acceptance: only the initial two POSTs, remaining queue paused; reopen does not resubmit, cancellation preserves unknown and cancels unsent items.
- Actual controls: edit prompt and ratio to 9:16, save/reload, clone, explicitly confirm two requests; both real routed payloads match reviewed values. Select/apply A, then B; A visibly becomes replaced.
- Nested preview Escape keeps the outer dialog open; outer Escape closes it. 1440px desktop and 390px mobile have no horizontal overflow. Reopening/reloading sends no extra POSTs. Screenshots: `desktop.png`, `mobile.png` (generated fixture illustrations, not provider output).

`parent-integration.cjs`: PASS, no page errors. See `parent-integration.md` for full source-linked sequence.

- Actual task A business tool → reviewed evidence-backed summary → promoted lesson → actual task B creation and request audit.
- Browser-recorded VP8 WebM returned through the real batch download/persistence path. Native video decoder reads 320×180 from saved Blob. Two candidate requests, explicit A→B application and current generation-source evidence verified.
- Open drafts block completion; bookkeeping cannot prove media. Saved generation verification record, completed Todo and confirmed current summary allow task B completion.
- Archived source remains historical/locatable; corrected memory supersedes old text; foreign project, disabled and deleted memory do not enter new requests.

## Acceptance mapping

AC1–AC4: repository/runtime tests plus real controls/Chat/Responses/native candidate flow. AC5: strict schema/transaction tests plus real 20-item queue and measured max concurrency. AC6: fault/cancel/unknown/recovery/lock suites and native exact-POST checks. AC7: switching, trusted revision, manual conflict and current source checks. AC8: deletion/retention/single-job suites, task blocking/evidence and desktop/mobile native fixtures.

No unresolved correctness finding remains in independent source review. Live provider account authorization, billing amounts and real generated content quality were deliberately not exercised. This gate verifies application contracts against mocked services and real browser media/storage behavior.

## Finish state

Executable batch spec and cross-links updated; retrospective recorded. All session edits are owned by this task, including the parent roadmap progress update. No commits or push have been made. Work commits require the one-shot concrete plan approval in workflow Phase 3.4; then archive the child and record the journal. Parent AC5 remains open until that archival gate completes.

## Finish update

User approved commits on 2026-09-19. Feature commit: `e6e3f94`; documentation commit: `2903466`. Child archived after work commits; parent AC5 closes with that archive. Earlier pending-finish statements describe the pre-commit validation snapshot. Session journal records final commit/acceptance state.
