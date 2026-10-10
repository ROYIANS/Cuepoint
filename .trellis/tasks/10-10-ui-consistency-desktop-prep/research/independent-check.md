# Independent implementation review

Reviewer: `ui_independent_check` (the dispatched `trellis-check` agent). Date: 2026-10-10.

Latest review revision: the late acceptance and Tabs addenda at the end of this document supersede the earlier intermediate status notes. The Agent keyboard issue and B01 presentation-harness issue are resolved. Seven previously missing safe Cancel registrations are fixed, including the shared manual-draft guard. The latest three-file Tabs refinement has no additional source finding. Final complete quality/build/test and the remaining native acceptance evidence remain owned by the main session; no earlier pending statement should be read as reopening a resolved source issue.

## Scope and method

Read `check.jsonl`, the PRD, approved design, implementation plan, change boundary, protection contracts, coverage matrix, and the applicable frontend specifications before reviewing. The approved whole-window desktop design takes precedence over the older Studio inset-frame and global ClickSpark layout examples. Specification synchronization and task lifecycle changes belong to the main session.

The source review covers every changed product diff and the surrounding code needed to check its actual owners, mounting, state transitions, scrollports, and actions. It is not a claim that every unchanged line in the repository was manually audited. After the approved focus registration addendum there are 72 tracked source changes and five new source/test paths. The generated `src/routeTree.gen.ts` formatting change is assigned to the main session for semantic verification and restoration; it is excluded from manual product-edit approval here.

Reviewed groups:

- Shared frame and presentation: `layout/AppFrame.tsx`, `layout/PageLayout.tsx`, `styles.css`, `StudioShell.tsx`, `WorkspaceChrome.tsx`, and the Dialog, AlertDialog, and Sheet primitives.
- Studio: LibraryHeader, CoverCard, ProjectGalleryPage, MaterialLibraryPage and its CSS, AssetLibraryPages, IpProfilesPage, IpProfileEditor and IP CSS, ConnectorsPage, SearchConnection, and AboutPage.
- Video and asset owners: AssetLibraryPage; Character, Scene, Prop, and Style detail pages; WorldSettingPanel; EpisodeListPage; StoryPage; ShotEditorPage, ShotRow, DurationInput; ProducePage, ProductionProposalsPanel, and StoryboardPrintPage.
- Audio and music: AudioWorkspacePage, ScriptDocument, AudioTimeline, AudioGenerationBatches, AudioArrangementActions, audio CSS; audioMusic shared controls and CSS; MusicWorkspacePage and music CSS.
- Memory: ProjectMemoryPage, MemoryEditor, the new MemorySelect, and memory CSS.
- Agent: ChatWorkspace, HomeWelcome, TaskBoard, LobeChatTheme, agentTheme, all changed Agent stylesheets, and the later additive accessibility changes in FloatingComposer, ModelSelectTrigger, and TopicSidebar. Deletion of Grainient and homeGrainient CSS was checked against consumers. Deleted Card exports have no remaining production consumers. CreateTile still has real source-snapshot fixture consumers.
- Focus behavior: the new `lib/overlayFocusReturn.ts`, its actual Dialog/Sheet/AlertDialog integration, installed Radix modal-close behavior, and all seven helper tests.

## Findings fixed by this reviewer

### Preserve existing main landmarks

Files: `src/components/studio/MaterialLibraryPage.tsx` and `src/components/studio/IpProfilesPage.tsx`.

Replacing the original `<main>` roots with the shared div-based PageContent removed their existing main landmarks. AppFrame does not supply a replacement main landmark. Added `role="main"` to MaterialLibraryPage, IpProfilesPage, and all IpProfilePage loading/missing/loaded root branches. This preserves the previous accessibility semantics without adding a wrapper or changing ownership, drafts, or the public PageContent API. The main session agreed with this local fix.

No implementation-mirroring test was added for these presentation-only attributes. Type checking, lint, and direct branch inspection verify this small change.

### Correct native fixture reachability and remove an unused token

Files: `knip.json` and `src/components/agent/agentTheme.ts`.

The main session's complete quality run reported ClickSpark and CreateTile as unused after their global/product consumers were removed. They still have real retained native regression consumers: `tests/fixtures/e05/harness.tsx` mounts ClickSpark, and the E04 library harness imports historical AssetLibraryPages, whose unchanged alias import calls current CreateTile. The intended native harness entry pattern admitted only `.ts`, although the actual fixture HTML scripts use `.tsx`. Expanded that existing pattern to `harness.{ts,tsx}` and added the single real E04 historical AssetLibraryPages consumer as an explicit fixture entry to make its imported closure visible. This does not mark product sources or all historical fixtures as entries, ignore findings, or change historical source bytes.

Removed the genuinely unused SURFACE_HOVER export after searching all source and fixture consumers. The bounded unused gate first confirmed ClickSpark and SURFACE_HOVER were resolved, then confirmed the narrow E04 entry resolves CreateTile. At that intermediate run, only the unused `ogl` dependency remained for the main session's dependency-removal command; this is historical run evidence rather than a current unresolved finding. The four E04 snapshot hashes and E05 ClickSpark snapshot hash match their recorded provenance.

### Give existing confirmation overlays a safe initial focus

Files: `IpProfilesPage.tsx`, `IpProfileEditor.tsx`, `materials/MaterialDetailPanel.tsx`, `materials/MaterialControls.tsx`, and `agent/AgentGenerationBatches.tsx`.

The main session's native IP archive check showed focus staying on the opener when the confirmation opened. Installed Radix AlertDialog always prevents default initial-focus traversal and focuses its registered Cancel. Six existing confirmation instances across these five files used plain safe-action Buttons without a registered Cancel; no safe target was available to Radix.

With the main session's explicit scope approval, wrapped each existing Cancel/continue-editing Button in `AlertDialogCancel asChild`. The wrapper prevents the click's default action so the primitive does not also invoke its automatic close path. The original child handlers, disabled flags, dirty/pending guards, and blocker reset behavior remain unchanged and own closure. This registers only the known safe action; it does not choose the first destructive button or impose a global autofocus fallback.

Installed Radix Slot invokes the child click handler before the slot handler; DialogClose's composed handler observes `defaultPrevented` and skips its own `onOpenChange(false)`. This avoids a second close/reset/cancel callback. Existing business guard and mutation tests were inspected and rerun, while native initial-focus/cancellation acceptance remains with the main session.

## Findings coordinated with the foundation owner

### Focus return for controlled confirmation overlays

Files: `src/components/ui/alert-dialog.tsx`, plus the already updated Dialog/Sheet wrappers and shared focus helper.

The main session reproduced closing a controlled project-create Dialog with Escape leaving focus on body. The foundation owner added the shared opener fallback for Dialog/Sheet. Review of the installed Radix implementation confirms why this happens: modal close prevents FocusScope's default previous-focus restoration and attempts to focus its Trigger even when a controlled overlay has no Trigger.

The helper captures the focused opener before the consumer's open handler, respects consumer `preventDefault`, runs after Radix close work, restores only when focus is still absent/body, and preserves Trigger or custom focus. It checks target connectivity and cancels stale restoration after rapid reopening. Its seven tests exercise the actual helper initializer.

The independent review identified that AlertDialog uses Radix Dialog.Content internally and therefore has the same controlled-without-Trigger close behavior. Its local wrapper had not yet adopted the fallback. Reported this to the main session and foundation owner instead of editing a concurrently owned primitive. The foundation owner added the fallback to AlertDialogContent, and this reviewer inspected the final wrapper and reran all seven helper tests. The open callback runs before Radix's initial Cancel focus without preventing it; both consumer autofocus/close handlers remain delegated. **The source finding is resolved; native confirmation-focus verification remains with the main session.**

## Behavioral review conclusions

- AppFrame adoption shares navigation and presentation while retaining the Studio/project route owners and project availability guards. Page primitives do not acquire data, provider, draft, or runtime responsibilities.
- Shared asset editors keep their owner-scoped live-query barriers and keyed draft boundaries. Story, shots, export, and memory retain their existing owner and revision checks. Display-state replacements preserve loading versus missing/empty distinctions in the changed branches.
- Shot-row keys, deferred controls, table/canvas scrolling, duration inputs, drag geometry, and shortcut gates remain in their feature owner. Audio timeline coordinates, transport, history, selection/arrangement snapshots, and undo are retained.
- Audio/music queue preparation and explicit confirmation remain separate; this review introduces no supplier call, retry, or paid replay. Creator modes and retained drafts keep their existing owners.
- Agent runtime mounting and route transitions are retained. LobeHub/antd theme changes remain in the Agent scope; shared app CSS does not install an Agent-wide provider. The later ARIA attributes reflect existing state and keep action handlers unchanged.
- New MemorySelect retains the existing value callbacks and explicit pending-disabled behavior. Labels reach the SelectTrigger and the all-values sentinel maps back to the existing empty filter value.
- Dialog/Sheet height limits and local scroll bodies were reviewed. The main session's fresh native geometry is required for short-height footer reachability; max-height or overflow classes alone are not accepted as visual proof.
- Print CSS preserves A4 landscape, 10 mm margins, white paper, chrome hiding, and card break avoidance. The outer AppFrame and workspace fixed heights are released for print. The video outlet retains overflow:auto, but its parent switches to natural block height; source inspection does not establish a clipping defect. A populated, long native print preview remains necessary to verify pagination.

No further definite functional regression was found in the reviewed product changes. Confirmed landmark, confirmation focus wiring, quality reachability, B01 harness, and Agent keyboard findings are fixed; native acceptance evidence remains tracked separately.

## Finding referred to the Agent owner

The native topic-sheet close initially returned focus to its opening ActionIcon. The installed deprecated `@lobehub/ui` ActionIcon rendered a div with `role="button"` and `tabIndex=0`, and forwarded `onClick`; it did not supply an Enter/Space keyboard handler. The DOM tag being DIV was therefore not itself an invalid focus return, but keyboard focus alone did not prove keyboard activation. Reported the exact installed source behavior to the main session for its owner to use a real-button adapter and perform native key opening/closing. This reviewer did not change a concurrently owned Agent control interface. **Resolved:** current controls import `ActionIcon` from `@lobehub/ui/base-ui`; the main session reported native Space opening the right topic Sheet, Enter opening task detail, and Escape restoring the native BUTTON after its close animation. See the late acceptance addendum for attribution and limits.

## Verification

All package-manager commands use `/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm` with the matching Node directory first in PATH.

- `pnpm lint` (`tsc -b --pretty false`): **pass**, exit 0, rerun after the landmark fix and final Dialog/Sheet/AlertDialog focus integration.
- Scoped ESLint on changed existing/new TypeScript sources, excluding generated routeTree: **pass**, 48 files, 0 errors, 93 warnings, exit 0. Repeat on the ten late-edited primitive/helper/test/Agent/landmark files also passes: 0 errors, 27 warnings, exit 0. Final repeat on the six safe-cancel registration/token files passes: 0 errors, 22 warnings, exit 0. The repository's final quality/debt gate belongs to the main session; these warning counts alone do not assert baseline equivalence.
- Targeted Vitest: **pass**, five files / 36 cases, exit 0: `e01ManualDraftDeparture.test.ts`, `b02MemoryPromotion.test.ts`, `materialIntegration.test.ts`, `episodeDelivery.test.ts`, `overlayFocusReturn.test.ts`. After adding the seventh AlertDialog case, the focus file was rerun independently and all seven cases pass. This is 37 distinct verified cases across those five files, not an additional full-suite claim.
- After the six Cancel registrations, the focused guard/business suite passes again: six files / 58 cases (`e01ManualDraftDeparture`, `materialLibrary`, `materialIntegration`, `agentGenerationBatch`, `agentGenerationBatchSafety`, and `overlayFocusReturn`). The actual production callbacks and repositories execute; this run is not presented as native portal verification.
- `git diff --check`: **pass**, exit 0 after final AlertDialog integration and landmark fixes.
- Bounded unused gate evidence is in `ui-independent-unused.json` and `ui-independent-unused-closure.json` under the main session's local-artifact directory. The first run had two remaining candidates (ogl/CreateTile); the final narrow-closure run has only ogl. Both failures are retained as evidence, and a stable final complete quality run is still required after dependency removal.
- The main session owns the full quality/build/test run. This reviewer does not substitute the targeted run for the required repository gate.

## Boundaries still owned by the main session

- Final native acceptance: the 31-context matrix, twelve representative pages across five viewports, keyboard/dirty/pending/error states, short-height overlays, same Agent runtime transitions, and long print pagination. Source review and helper unit tests cannot establish these native outcomes.
- Final focus restoration checks for controlled Dialog, Sheet, and AlertDialog, including preserved consumer `preventDefault` behavior.
- Semantic verification/restoration of generated routeTree formatting and final full quality evidence. The existing stylesheet metadata hashes may change because of approved CSS edits; updating verified existing evidence is distinct from adding a suppression or exception.
- The main session has added `desktop-ui.md` and updated component/directory/index specs for the approved frame, typography, focus and Agent behavior. Final evidence and any planning-era task paragraphs should still be reconciled by the main session without overstating state coverage.

No commit, archive, task-lifecycle mutation, or spec change was made by this reviewer.

## Review boundary addendum

The main session approved the focus repairs because keyboard focus is an explicit acceptance contract of this UI task. This expands the initial presentation diff to the shared `lib/overlayFocusReturn` interaction helper and six safe-action registrations, including the previously unchanged MaterialControls, MaterialDetailPanel, and AgentGenerationBatches files. No durable mutation, provider request, route schema, draft decision, or runtime owner changed. The root-owned Ogl dependency removal and precise Knip fixture entries are cleanup of consumers removed by the approved visual implementation, not an expansion of quality allowances.

## Late acceptance addendum — resolved repairs

### B01 actual query consumer harness

Owned and changed only `tests/b01QueryIdentity.test.ts` during this follow-up. The original focused run reproduced seven failures and two passes. After presentation extraction, the harness's children-only traversal could not read PageState titles or PageHeader named slots; some assertions also retained the superseded literal loading copy. The actual query identity and owner barriers remained in the production code.

The harness now expands only the actual imported pure PageState/PageHeader functions, preserving hookful frame/business/slot boundaries so traversal does not consume extra mocked queries or change owner hook cells. Loading assertions require one actual `kind="loading"` PageState, the rendered `role="status"`, and its visible title. Loaded shot and print cases additionally require the expected h1. Retained entity/null, wrong owner, missing, actual IndexedDB queriers, key isolation, no stale slot, Outlet, and settings assertions remain intact. Focused B01 passes all nine cases; final app typecheck and diff-check pass. ESLint explicitly ignores that test path under the root source config; this is recorded as a scope limitation rather than an ESLint-clean claim.

### Shared manual-draft safe initial focus

Owned and changed only `src/lib/useManualDraftGuard.tsx` during the next follow-up. Native story editing followed immediately by the route link showed the leave-confirmation's initial focus staying on the outside link. This was the remaining safe-action Button without a registered Radix Cancel.

Wrapped its existing continue-editing Button in `AlertDialogCancel asChild` with the same wrapper `preventDefault` pattern. The child handler still owns clearing the local request and resetting the blocker once. Existing discarding/pending gates and onCloseAutoFocus capture/restore of the element, selection range, and ancestor/editor scroll remain unchanged. A complete current-src scan finds twenty AlertDialogContent consumer instances, all with a registered Cancel; the shared primitive is the only raw Radix AlertDialog package owner.

Final verification for this fix: scoped ESLint has zero diagnostics; app typecheck and diff-check pass. Five focused files pass with 31 executed cases and one existing opt-in native case skipped: manual-draft departure callbacks, overlay focus, D08 text-draft components, manual-draft wiring, and E07 draft rebase. The skipped case is not counted as executed native proof. The main session owns the actual story-route initial-focus and restoration retest.

### Agent and media ActionIcon keyboard acceptance

The relevant current Agent controls use the base-ui ActionIcon adapter rather than the deprecated root div adapter. The main session reported native Space/Enter activation and Escape returning to labeled BUTTON controls after animation; its owner also completed the media ActionIcon keyboard repair. This closes the earlier keyboard source finding. A stale/mixed Vite optimizer instance caused an intermediate invalid-hook diagnostic in the custom acceptance server; the main session restarted cold with `--force` before accepting current-code evidence. This reviewer inspected the current source imports, and attributes the browser interaction results to the main session rather than claiming a separate browser run.

## Late Tabs refinement — independent read-only review

The user reported an odd boxed appearance in the material-library tabs. Reviewed the owner's frozen changes in `src/components/ui/tabs.tsx`, `src/components/studio/MaterialLibraryPage.tsx`, and `src/components/studio/materials/materialLibrary.css`; no product edit was required by this reviewer.

- Shared TabsList is 36px (`h-9`) with 2px padding and a neutral panel surface; TabsTrigger is 32px (`h-8`). Selected-state selectors apply only elevated-surface background and foreground text. The former always-active border/ring/shadow selectors and transparent trigger border are removed. The 3px `focus-visible` ring remains, so keyboard focus can still be distinguished from the selected state.
- No `material-view-tabs` use or CSS selector remains, including its legacy bottom borders, button padding, active underline, or duplicated focus rule. MaterialLibraryPage uses the shared list, `h-auto flex-wrap` to retain natural 36px single-line height and allow wrapping, and an explicit root gap. Its state, scope/navigation callback, queries, loading distinction, and selection/import owners are unchanged.
- All six actual consumers were checked against current handlers and layout constraints:

| Consumer | Preserved behavior and layout |
| --- | --- |
| MaterialLibraryPage | Media/settings values, scope-preserving route replacement, reset of kind, dynamic content value, labeled tablist, wrapping |
| AssetLibraryPage | Five world values, search reset and owner `onTabChange`, loading/conditional content owners, wrapping toolbar |
| VoiceLibrary | Design/clone/preset values, publish plus setMode, blocked-state disabling, equal-width dialog list |
| MusicCreation | Existing musicVariant/changeVariant, switching/busy disabling, Suno-only conditional modes; scoped CSS only changes horizontal padding |
| MusicWorkspacePage | Create/works mobileMode callback, existing narrow navigation visibility and conditional pane CSS |
| ProjectPicker | Explicit video/audio/music value validation, pending disabling, full-width creation list; existing listbox keyboard handler remains outside this shared change |

Root/List/Trigger/Content still forward their props to the same installed Radix primitives. Inspection of installed Radix confirms roving focus, Arrow/Home/End navigation, Space/Enter activation, disabled skipping, tab/tablist/tabpanel roles, selected state, and IDs/labels remain owned by Radix. No primitive event handler, activation mode, orientation, route handler, or panel mounting was changed by this refinement. Existing consumers without TabsContent continue their prior conditional-render design; the styling change does not claim to redesign those semantics. Searches found no old material tab skin or new cross-feature border/ring override.

Scoped ESLint of the two TSX refinement files passes with zero errors and seven visible complexity/nested-ternary warnings in the existing MaterialLibraryPage body. `git diff --check` passes. No redundant full suite or full quality run was started: the main session is running native material/keyboard checks and the stable complete gate. This is source/style review, not a claim of independent native visual acceptance.

Frozen source hashes for this Tabs review:

```text
src/components/ui/tabs.tsx c568b47009ac3e85dcc767708eef2cf74ec898c4583656d755bc6b2eacda45bb
src/components/studio/MaterialLibraryPage.tsx 9bbc67c14c7da80d26f4dc7f95d89b5a31af5781c2ea94f30cccd9e44b8923c8
src/components/studio/materials/materialLibrary.css 8d0f09b679355a069548987cb0327c964b3f01f5a321a64033e39cbf67539b35
```
