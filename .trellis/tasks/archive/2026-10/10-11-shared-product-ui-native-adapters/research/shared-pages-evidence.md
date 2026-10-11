# Shared product page implementation evidence

Date: 2026-10-11

## Changes

- The existing `ProjectGalleryPage`, `WorkspaceChrome`/`AppFrame`/`Outlet`, `ProjectHomePage`, `EpisodeListPage`, `StoryPage`/`BeatTextField`, and `ShotEditorPage`/`ShotRow`/`ShotTextField`/`DurationInput`/`ShotRelationsEditor` now consume the selected video repository and reactive query boundary. The two simplified native project/gallery components were deleted after all imports were removed.
- Existing browser views keep their draft keys, baseline callbacks, retained text/session rows, file import revision handling, keyboard owner, virtualization, DnD, bulk settings/columns/filters, and undo owner. Native reorder/beat deletion uses the committed receipt callback. Browser command result/undo behavior is preserved by repository delegation.
- Root native navigation defaults to `/projects`. Native unsupported Studio routes and non-core workspace routes render a capability state under the same shell, preventing the unsupported route's data owner from mounting. Native relation/media/generation controls expose capability states rather than calling browser storage.
- Initial read errors expose retry; later failures retain the existing editor tree and show a read notice. Rejected story/shot commands keep selection/form state and provide visible error feedback.

## Targeted tests

`/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm exec vitest run tests/sharedVideoPageParity.test.ts tests/b01QueryIdentity.test.ts tests/b03IntentBoundaries.test.ts tests/b06EditorSessions.test.ts tests/manualDraftWiring.test.ts`

Result: 5 test files, 109 tests passed. Includes 7 new native/shared consumer assertions: same AppFrame/header/Outlet; unsupported native owner does not mount; native captured query callbacks use repository without Dexie; scalar draft baselines; native media columns retain shared row and text field but do not mount generation slot data owner; error/recovery and retained workbench.

An initial targeted run found the existing manual draft harness could no longer inspect `EditableGenerationSlot` behind an added wrapper. The capability choice was moved into the existing `ShotRow`, preserving browser slot callback identity and the same view tree. The rerun above passed.

## Browser smoke

Reproducible script: `research/browser-product-smoke.mjs`.

Command: `node .trellis/tasks/10-11-shared-product-ui-native-adapters/research/browser-product-smoke.mjs`

Uses bundled Playwright Chromium and a fresh isolated context at `http://127.0.0.1:5174`; no existing user IndexedDB is used. 1440x900 and 1024x640 viewports. Checks durable rows by importing the app's actual database module in that isolated browser context after real UI actions. Native runtime remains absent (`__TAURI_INTERNALS__.invoke` is not available).

Final result: 12 checks passed, zero page runtime errors. Actual project creation with series mode and 9:16 aspect; series logline; episode creation; story title/logline/script; beat title/content/time-of-day; shared shot text/duration/status; duplicate/undo; episode-owned status filter; reload persistence; missing-owner state; unavailable project kind; compact internal horizontal scroll.

Screenshots and complete trace/report are under `research/browser-product-smoke/`: `01-empty-projects.png` through `07-compact-shared-workbench.png`, `trace.zip`, and `report.json` (status passed). Screenshots for story/workbench were visually inspected for shared desktop styling. Browser smoke is genuine browser UI coverage; packaged native product smoke remains the coordinator's separate acceptance.

Earlier failed smoke attempts are retained as `failed-*.json` / `failed-before-stable-run.json`. These were acceptance-script selector mismatches (`第1集`, `图片创作`) and animated/HMR menu target stability. The script was corrected to actual accessible names, reduced motion, and explicit menu-choice clicking; product writes were not bypassed.

## Other checks

- Root `pnpm build`: passed (Vite reports pre-existing large bundle warnings).
- `git diff --check`: passed.
- `pnpm lint`: passed before the concurrent repository metadata/duplicateShot edits; coordinator should rerun after backend/adapter stabilizes. A subsequent in-flight run reported only repository-owned duplicateShot wire errors and was sent to the owner, with no page TypeScript errors.

No commits, archive operations, pushes, or merges were performed by this page worker. Final complete gates and packaged native evidence are owned by the coordinator.
