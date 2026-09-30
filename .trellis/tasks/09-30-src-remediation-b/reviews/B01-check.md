# B01 independent check — PASS after two local fixes

Date: 2026-09-30, Asia/Shanghai. Findings in scope: SS-01 / PU-05 only. Role: the already dispatched trellis-check; no child agents.

**Decision:** PASS for the scoped B01 identity/manual-session correction on the recorded source snapshot. Two concrete introduced lifecycle defects were reproduced and fixed below. No unresolved assigned query/draft regression was found in the checked paths. This is a unit check, not the B01 ledger closure or the B01–B07 full-batch gate; those remain with the coordinator.

## Reviewed snapshot and authority

Read `check.jsonl`, PRD, design, execution plan, the prior A/B01 scope preparation, parent B-unit contracts, and `research/B01-implementation.md`. Read the applicable hook/type/component/quality/reuse guidelines and the A04/manual-baseline and newly appended B01 sections directly from `state-management.md`, rather than relying on truncated injected context.

Base HEAD: `20b0204c9fab43e1265b94761ee880649be2fca9`. The source review comprises **15 source files: 13 existing files and two new helpers**, plus assigned tests and the isolated browser fixture/runner. Per-file SHA-256 values for 25 source/test/tool deliverables are in `B01-check-snapshot.json`. Product aggregate SHA-256: `75cbd5734afd96c1f4e6b440bfd71e59350af251cc611af0ed6243eeeda8374f`, recorded at 2026-09-30 14:19:08 +08:00, after final validation. No subsequent product/test edits were made by this check.

Check-owned mutations were limited to `src/components/slots/GenerationSlotCard.tsx`, `tests/manualDraftWiring.test.ts`, this report, and check evidence files under `reviews/B01-check-*`. Existing coordinator/worker changes were preserved. No spec, metadata, status, ledger, integration comparator, or runner edits; no dependency installs, commits, pushes, archives, or other-unit implementation.

## Concrete defects reproduced and fixed

1. **Navigation-discard cleanup failure left a closed media session looking editable.** `DraftMediaSession.cancel()` sets its private closed flag before asynchronous orphan deletion. The new navigation callback set React's canceled state only after successful cleanup. A deletion failure therefore kept media and blocked departure, but left Save/Upload enabled for a session whose actual save/upload APIs already reject operations. Continuing dismissed the navigation error without making that state clear.

   Fixed at `src/components/slots/GenerationSlotCard.tsx:214`: mark the session canceled before cancellation, copy cleanup failure into the editor's existing error state, and rethrow to the route guard. The draft stays readable, ownership stays with the session, save/upload stay disabled, and Cancel or another explicit route discard can retry cleanup. The guard proceeds only after that cleanup resolves. No repository ownership/CAS API change.

   New regression at `tests/manualDraftWiring.test.ts:135` invokes the actual editor's upload and route-discard callbacks, uses real fake-IndexedDB media and the real `DraftMediaSession`, fails the actual cleanup dependency, then defers a successful cleanup retry. It asserts retained owned media/no departure, disabled closed-session save, visible cleanup-retry instruction after Continue, no departure while retry is pending, and deletion/proceed only after completion. Neither persistence nor editor close is falsely called.

2. **Open-editor counts were never balanced on component unmount.** The new notifications were called only by tile-open and explicit editor-close handlers. If an open slot component disappeared, its parent retained a positive count even though that manual editor no longer existed. The retained-row/deletion gates could consequently treat a nonexistent session as still active.

   Fixed at `src/components/slots/GenerationSlotCard.tsx:514`: derive notifications from the mounted `open` lifecycle, with a matched effect cleanup on close or unmount. Capture the notification callback for each open effect; ordinary callback replacement does not generate spurious open/close cycles. Existing slot/session keys and frozen save callbacks stay intact. This balances bookkeeping; it does not add universal survival when a filter/layout intentionally removes an editor.

   New regression at `tests/manualDraftWiring.test.ts:114` executes the real wrapper's open/close handlers and real effect cleanup and checks the complete `[true, false, true, false]` notification sequence across close, reopen and unmount. The hook host now records effect cleanup callbacks so this test executes source lifecycle logic rather than copying it.

**Red/green evidence:** before the product fixes, the actual-component file reported 2 new failures / 12 existing passes: missing unmount notification, and an enabled Save after failed cancellation. After the local fixes, 14/14 passed. Both regressions then passed in the final seven-file run.

## Actual reader/write/lifecycle coherence

| Boundary | Source and behavior checked | Evidence and result |
| --- | --- | --- |
| Project route / home | Project key precedes Chrome's query/state hooks; home has its own project key. Tagged project/first-episode reads gate kind dispatch, repair and Navigate. Old null is not an instruction to repair the new project. | Actual consumer/querier tests plus actual root/home fixture scenarios passed. No stale project title or mixed project/episode links observed during controlled delays. |
| Persistent Chrome | Project, current episode (project+episode), and first episode identities are checked independently. Current episode additionally checks returned owner. A same-project episode delay hides the old episode links and keeps the settings/Outlet tree mounted. | Lightweight test explicitly supplies retained old rows and null; styled browser opens settings and switches between two episodes under a delayed read. Passed. |
| Four asset detail pages | Owner+entity key precedes queries and drafts. Row/null envelopes include the requested owner+ID; returned row ownership is checked before rendering slot editors. Callbacks target the matched row and pass the A04 baseline. | Four actual callbacks/queriers run against fake IndexedDB; four browser dirty switch/continue/discard cases passed. Missing and foreign-owner cases expose no editor. Same-target name updates retain draft. |
| Shot / print content | Project+episode wrapper keys precede hooks; project/episode/shots/assets/relation-assets envelopes gate consumers, including old empty collections. Episode owner and ID are checked. Print derives delivery only after those gates. | Both actual consumers execute captured real queriers, stale null/row/list envelopes and foreign/missing episode cases. Browser delayed shot collections across two episodes passed for editing and print. |
| Shot save / relations | Each slot freezes owner+shot+field callback and baseline; focus/search stays outside the key. Relation pending/error state blocks departure, prevents switching the relation editor, retains the failed patch for Retry, and has explicit discard. | Search/episode navigation, pending/failing relation patch, and A04 slot-baseline wiring tests passed. Retained deleted-row sessions disable assigned write controls and keyboard actions. |
| Output settings | Shared route resolver adds pathname/history/unload protection while same-project settings remain mounted. Save still uses changed fields, original baselines, and authoritative acknowledgement; missing target disables manual save. | A04 real callback/rebase/conflict tests and browser dirty/pending navigation and project-deletion cases passed. |
| Material detail | `activeId` protects the mounted editor from immediate parent-ID changes. Only a matched envelope supplies the editor; editor key is matched material ID. Latest-request ref resolves B→C; Continue restores the active parent selection. Pending and existing promotion restrictions remain. | Actual retained-null/matched-missing querier test and browser B→C discard, repeated B after Continue, route guard, and dirty deletion cases passed. No introduced material selection regression observed. |
| Slot async operations | Failed upload keeps the same File; successful owned upload remains after CAS failure; explicit discard invokes owner/orphan-aware cleanup. Deferred save remains bound to its opening callback and cannot close a different target. | Real session/repository A04 tests, controlled browser upload/save cases, and the new failed/deferred cleanup callback regression passed. |
| Explicit unavailable Chrome shell | Last matched same-project layout keeps Outlet position. Missing warning replaces normal header controls; inline Outlet is inert. Context disables assigned slot portal save/upload/picker actions. Output stays readable only when dirty/saving, and cannot save. | Clean and dirty project deletion, deleted episode slot, and deleted asset/material browser cases passed. Initial missing pages still show not-found. Retention is session/layout context, not authorization to write to a deleted row. |

The identity tests mock React hooks/router primitives, traverse the actual new content wrappers, and invoke captured actual Dexie queriers against fake IndexedDB. They are executable actual-consumer/callback evidence, **not ReactDOM scheduling evidence**. The browser fixture separately executes genuine ReactDOM, Radix styles, TanStack browser history/blockers, and isolated-origin IndexedDB.

## Final focused validation

All commands used the user-approved local pnpm/Node paths. No bare runtime pnpm or installs.

```sh
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm exec vitest run tests/b01QueryIdentity.test.ts tests/manualDraftWiring.test.ts tests/manualDraftBaseline.test.ts tests/draftMedia.test.ts tests/debouncedDraft.test.ts tests/useShotMedia.test.ts tests/episodeDelivery.test.ts
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm lint
git diff --check
B01_PLAYWRIGHT_PATH='/Users/xiaomengdao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs' B01_CHROMIUM_PATH='/Users/xiaomengdao/Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell' /Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/node scripts/b01-browser-regression.mjs
```

- Final focused suite started 14:14:53 +08:00: **7 files / 66 tests passed**, exit 0; includes the two new regressions.
- Final local `pnpm lint` (`tsc -b --pretty false`): **passed**, exit 0. `git diff --check`: **passed**.
- Final styled browser run on the fixed snapshot: **19 scenarios passed**, exit 0. These are the same 19 enumerated in the implementation handoff, now independently executed. Browser `pageerror` collection remained empty.
- An earlier independent unchanged-snapshot browser run failed after 3 passes, at runner line 124 clicking Cancel after the scene switch: the locator became detached while Playwright waited for stability. Artifacts: `/var/folders/m6/x3vx_lld0kg8rcgth931pll40000gn/T/b01-browser-failure-S3cHNM/failure.png` and `failure.html`. An unchanged rerun passed 19/19 before the fixes, and the final post-fix run also passed 19/19. This observation is retained as fixture/scheduling reliability evidence; no product fix is claimed for that transient failure. The runner sometimes waits for URL rather than completion of route rendering, so it does not prove all scheduling interleavings.
- Final configured ESLint scan was independently rerun for all 15 source files using the coordinator's installed audit configuration. Raw diagnostics: `B01-check-eslint.json`; exact command/exit/timing: `B01-check-eslint-run.json`. **No new non-complexity diagnostic signatures relative to `reviews/integration/eslint-results.json`; no new hook dependency/order error from the fixes.** ESLint exits 1, not a clean pass: the remaining `react-hooks/rules-of-hooks` diagnostic names `useMaterialInProject` at `MaterialDetailPanel.tsx:245`. The same call exists at HEAD line 203, and its implementation at `src/db/materials.ts:348` is an ordinary async repository command, not a React hook. Complexity diagnostics remain for the later D unit; this check does not rename/restructure that API or close those findings.

The worker's earlier full 129-file / 1660-test result predates its latest changes and these fixes. It is historical only. No final full-suite/full-app/batch verification claim is made or needed for this focused unit check.

## Appended spec review and coordinator clarification

Read the newly added hook identity section and `state-management.md:727` onward directly from disk. Their tagged null/empty, key-before-hook, matched owner, same-path search, material selection, and explicit unavailable-shell boundaries agree with the checked source. Their explicit non-B01/filter/deletion and fixture limitations should remain.

One clarification is needed after the cleanup fix: the unconditional sentence that “Continue ... preserves draft, frozen baseline, owned media and retained failed-upload File” must not imply that Continue reopens a `DraftMediaSession` after a discard has begun and cleanup failed. The draft/failed File remain readable, but cancellation is irreversible at this layer; controls stay disabled until cleanup retry and closing/departure. Suggested coordinator wording:

> Before discard starts, Continue resets the navigation resolver and preserves the active draft/session. If slot discard cleanup fails, keep the draft readable, keep uncleaned owned media tracked, show the error, disable save/upload on the canceled session, and permit cleanup retry; do not proceed before cleanup succeeds.

The general same-target update claim should be read with the existing layout/filter caveat: normal updates that retain the mounted assigned editor keep its baseline/draft. This check does not certify survival of arbitrary external grouping/column/filter changes that remove that editor. Balancing open-editor bookkeeping fixes phantom retention; it is not a new universal draft registry.

These are coordinator spec wording follow-ups, not unresolved product fixes. This agent did not edit the spec.

## Remaining scoped limits

- Browser controlled reads wrap real Dexie reads; picker/upload and selected mutation delays/failures are Vite fixture transforms before real persistence. OS-native file picking, uncontrolled network/provider timing and paid-provider calls were not tested.
- Surrounding routes are simplified; world/story/asset/material seams are not the unmodified application route tree. This is **not full-app E2E**, although the assigned feature pages and root/home components are real.
- Synthetic cancelable `beforeunload` establishes registered listener cancellation, not native browser confirmation UI or forced shutdown/restart durability.
- The unavailable Chrome shell preserves unknown descendant mounts and blocks ordinary inline interaction. It does not cancel every already-running callback or disable every unrelated portal, and child-specific early returns may still remove their own non-B01 local state. Memory/IP/Story/Produce/audio/music deletion semantics were not expanded or certified.
- Arbitrary layout/filter/grouping removal and unsent bulk forms have no universal B01 draft registry. The new cleanup test is an actual-callback hook-host regression, not a browser simulation of every IndexedDB cleanup interleaving.

No remaining reason from this check requires a full-suite rerun or expansion outside B01. Coordinator can review the small fix delta and clarify the spec, then apply its own unit status/ledger decision before proceeding sequentially.
