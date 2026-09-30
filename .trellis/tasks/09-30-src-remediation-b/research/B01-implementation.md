# B01 implementation checkpoint — SS-01 / PU-05

Date: 2026-09-30. Role: the existing B01 implement agent, resumed directly. This is an implementation handoff, not independent review or closure. Parent/child status, specifications and ledger were not edited by this agent. No commits, pushes, installs, archive operations or agent dispatches.

## Implemented boundaries

- Project route keys WorkspaceChrome by projectId. Home has its own project key and tagged project/first-episode query envelopes; repair and Navigate cannot consume an earlier project's retained null/episode.
- Chrome tags project, project+episode and first-project-episode results. A same-project episode query delay hides the previous episode's navigation without removing settings or Outlet. No router-wide remount setting was added.
- ShotEditorPage and StoryboardPrintPage wrappers key by project+episode before their query/state hooks. Tagged project, episode, shot-list, character/scene-list and relation-asset results gate all consumers; empty lists and null rows retain query identity. Focus/search is not a key change.
- Four asset detail wrappers key by owner+entity before hooks. Queries tag requested owner+entity, preserve null/missing distinction, and still validate returned owner.
- MaterialDetailPanel tags the active requested material ID and keys MaterialEditor by the matched material.id. Parent selection is separate from route navigation: keep the active editor until its existing guard resolves, discard uses the latest request (B→C), and continue restores the parent ID so B can be requested again. Existing promotion operations remain disabled while dirty/pending; promotion's own selection occurs after its operation resolves.
- Shared useManualDraftGuard follows the existing material resolver/dialog conventions for three real callers: slot, output and relations. It blocks pathname departure plus unload while dirty/pending, permits same-path search changes, gives continue/discard, suppresses discard during pending work, and awaits discard cleanup before proceeding. Cleanup failure keeps the session mounted and displays an error.
- SlotEditSession and repository CAS were not redesigned. Opening still freezes target, owner, title, callback and baseline. Route guard also covers retained error/failed File even when the slot value is unchanged. DraftMediaSession cleanup remains owner/orphan aware; save failure retains draft/media, and successful discard waits for cancellation.
- Output keeps A04 partial-save/rebase/acknowledgement behavior; route blocker replaces its separate unload-only listener. Relations saving/error now block route departure, with explicit error discard.

## Narrow deletion handling added for the coordinator's lifecycle concern

A null result must not destroy a still-open manual editor before its guard can resolve:

- Asset records are retained only while slot editors are open. A missing record shows a warning; slots are read-only, save/upload are disabled, and draft text remains available for copy/cancel.
- Material metadata retains its last matched record only while editing/pending; unavailable metadata cannot save or start further actions.
- Shots retain missing affected rows only while slot editors or unresolved relations need them; collection derivation is memoized. Parent project/episode snapshot is retained only for those manual sessions. Relations and keyboard writes are disabled when unavailable.
- Chrome cannot discover arbitrary descendant local state without adding a registry. It therefore uses the explicit-unavailable-shell alternative requested by the coordinator: matched same-project layout snapshot preserves Outlet position; a missing warning replaces normal project affordances, header/project controls are hidden, and Outlet is inert. WorkspaceUnavailableContext disables B01 slot actions even through portals. Output is retained only if dirty/saving, with save disabled and continue/explicit close/discard available. A clean deletion shows not-found immediately, closes clean settings, exposes no normal project controls, and permits departure. Revisiting the deleted project gives the ordinary not-found branch.

This is not undelete data: cached layout does not authorize saves or hide deletion. The shell remains unavailable until navigation or live recovery, preserving unknown descendant mounts. Cross-child limitations below remain explicit.

## Changed deliverables

Product (15 files):

- src/routes/p.$projectId.tsx
- src/routes/p.$projectId.index.tsx
- src/components/workspace/WorkspaceChrome.tsx
- src/components/workspace/ProjectSettingsPanel.tsx
- src/components/shots/ShotEditorPage.tsx
- src/components/produce/StoryboardPrintPage.tsx
- src/components/assets/CharacterDetailPage.tsx
- src/components/assets/SceneDetailPage.tsx
- src/components/assets/PropDetailPage.tsx
- src/components/assets/StyleDetailPage.tsx
- src/components/slots/GenerationSlotCard.tsx
- src/components/studio/materials/MaterialDetailPanel.tsx
- src/components/studio/materials/MaterialControls.tsx
- src/lib/useManualDraftGuard.tsx (new)
- src/lib/workspaceAvailability.ts (new)

Tests/tooling:

- tests/manualDraftWiring.test.ts: traverses the new real content wrappers, supplies envelopes, and adds idle blocker/context seams to the existing lightweight A04 host.
- tests/b01QueryIdentity.test.ts (new): actual consumer/hook fixture; executes captured real queriers against fake IndexedDB. Explicit stale row/null/empty, missing ID, returned foreign owner, Chrome same-project episode/navigation, home repair and route key evidence. Does not claim ReactDOM.
- tests/fixtures/b01/index.html and harness.tsx (new): isolated ReactDOM component/router fixture with real browser history and IndexedDB.
- scripts/b01-browser-regression.mjs (new): current 19-case browser matrix. Portable defaults: import B01_PLAYWRIGHT_PATH or `playwright`, use Chromium's installed discovery unless B01_CHROMIUM_PATH is supplied. No new product dependency.

`git check-ignore` found none of these new test/script paths ignored; `git ls-files --others --exclude-standard` listed them. They are reviewable untracked deliverables, not staged/committed files. Existing task metadata/ledger edits belong to the coordinator and were not reverted.

## Commands and exact evidence

Final focused command, on the current product snapshot:

```sh
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm exec vitest run tests/b01QueryIdentity.test.ts tests/manualDraftWiring.test.ts tests/manualDraftBaseline.test.ts tests/draftMedia.test.ts tests/debouncedDraft.test.ts tests/useShotMedia.test.ts tests/episodeDelivery.test.ts
```

Result at 13:56:22 local: **7 files / 64 tests passed**, exit 0. Correct existing file is manualDraftBaseline.test.ts; no nonexistent manualDraftCas test is claimed.

Final typecheck/lint command, same product snapshot:

```sh
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm lint
```

Result: **passed**, `tsc -b --pretty false`, exit 0. `git diff --check` also passed. No product changes followed these checks; subsequent changes only adjusted browser-fixture animation waits/diagnostics and this report.

Final browser command (explicit machine-local installed tooling; no installs):

```sh
B01_PLAYWRIGHT_PATH='/Users/xiaomengdao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs' B01_CHROMIUM_PATH='/Users/xiaomengdao/Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell' /Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/node scripts/b01-browser-regression.mjs
```

Final resumed run/session 37826 finished **19 scenarios passed**, exit 0. It uses installed Vite React/Tailwind plugins, real Radix UI, ReactDOM, TanStack browser history/blocker hooks and isolated origin IndexedDB. Full final pass list:

1. Project route key and same-project episode envelope keep settings mounted.
2. Home waits for matching null episode before repair.
3. Character dirty switch: blocked → continue retains → discard remounts.
4. Scene equivalent.
5. Prop equivalent.
6. Style equivalent.
7. Upload pending forbids discard; failed upload retries identical retained File; owned media survives CAS conflict and is cleaned only after discard.
8. Output SPA guard retains draft and forbids pending discard.
9. Material parent selection guarded; latest C wins; continue permits reselect B; route navigation also guarded.
10. Shots and print wait for matching empty lists across two episodes; missing episode does not print.
11. Shot locate/search keeps its dirty slot, while episode departure is blocked.
12. Relations pending/error departure requires resolve/discard.
13. Deleted asset/material preserves dirty session and blocks unavailable saves/departure.
14. Deleted episode preserves shot slot/guard, readonly prompt and disabled save.
15. Clean deleted project shows not-found with project controls hidden and clean settings closed.
16. Dirty output deletion retains readable draft, disabled save, continue and explicit close/discard.
17. Missing and foreign-owner asset/episode identities do not expose editors.
18. Browser history back honors dirty guard; actual registered beforeunload listener cancels synthetic cancelable unload only while protected.
19. Pending slot save forbids discard/navigation and persists only the opening target after completion.

An earlier incorrect `pnpm test -- ...` invocation ran all installed tests: **129 files / 1660 passed**, before the latest product changes. It is historical evidence only, not a final full-suite claim. No final whole-batch integration check or independent check was performed by this implement agent.

## Failures observed and corrected, not hidden

- Relations fixture first opened the shot combobox and then looked for the style option. Rendered DOM confirmed only the shot option. Corrected to the real labeled `镜头风格` combobox. Relations errors render under role=status, not role=alert; selector corrected accordingly.
- Memory-history BACK does not exercise the installed browser POP blocker; fixture switched to actual createBrowserHistory, then back/continue/discard and unload-listener cases passed.
- The styled run exposed Radix exit-animation scheduling. A closing Select keeps hideOthers accessibility state until its listbox detaches; a closing settings Dialog retains its blocker until dialog-content detaches. Assertions/navigation now await these actual DOM removals instead of reading count/role immediately.
- Captured styled failure after **15 passed**, artifact directory `/var/folders/m6/x3vx_lld0kg8rcgth931pll40000gn/T/b01-browser-failure-0CXuKF`: failure.png and failure.html. Assertion `0 !== 1` at dirty-output dialog role count, while DOM/screenshot showed the dialog, 1:1 draft and dirty status still present behind the closing Select.
- Subsequent captured failure after **15 passed**, artifact directory `/var/folders/m6/x3vx_lld0kg8rcgth931pll40000gn/T/b01-browser-failure-jM3Tn3`: dialog/draft preservation assertions passed; navigation to /away timed out immediately after explicit discard while closing dialog content still had its blocker. The final bounded run waited for actual dialog-content detachment and passed all 19 cases. Artifacts are temporary local diagnostics, not committed attachments.

## Limits and remaining review work

- Browser query delays and mutation transport failures are controlled seams. The harness wraps real reads; its Vite transform controls OS file picking/upload transport and pending/failing patchShot, patchProjectDetails and setCharacterSlot timing before invoking the real repository. These are not unmodified production network/file-picker timing tests. Real CAS, writes, media ownership and cleanup still run.
- Browser fixture uses genuine browser history but simplified surrounding routes (world/story text, asset/material fixture routes); it executes actual assigned feature pages and actual project root/home components. It is not a full application's route tree or an assertion that every child page was covered. No model/provider requests or user database were used.
- Synthetic beforeunload verifies listener cancellation; no browser-native confirmation-dialog rendering, forced process shutdown/crash survival or OS unload race was asserted.
- Explicit stale retained null/empty values are deterministically injected in the lightweight actual-consumer test. Browser delayed reads cover real retained-query scheduling, but this does not establish every possible async interleaving.
- Unknown non-B01 descendant portals/global callbacks are not all wired to WorkspaceUnavailableContext. Inert blocks their ordinary inline interaction; the shell preserves mounts, but child-specific early query returns could still destroy their own local draft, and already-running work is not universally canceled. Memory/IP/Story/Produce/audio/music deletion behavior was not comprehensively revalidated or rewritten. This is the concrete cross-child lifecycle limitation; no registry/global remount policy was introduced.
- Same-target unrelated field/slot live updates are covered; arbitrary external layout/filter changes that remove a mounted slot are not fully covered. The memoized retained-shot mechanism covers missing rows needed by active manual sessions, not every possible filter/view/column removal lifecycle.
- General unsent bulk form inputs were not given a separate draft registry or universal navigation dialog. B01 explicit guards cover the assigned slot/output/relations sessions and existing material behavior.
- No repository ownership/CAS API change was made. Independent check should review fallback consumption, mounted session bookkeeping, hook dependencies and the unavailable-shell boundary against the scoped design. Coordinator's changed-source hook scan and whole-batch final gate remain coordinator work.

Implementation checkpoint is ready to hand to independent check with these limits. Findings are not closed, and task/ledger remains in_progress until coordinator review. At the user's checkpoint request the ongoing browser run was polled once to completion, this report was written, and no further product mutations/tests were initiated.
