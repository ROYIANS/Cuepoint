# Independent Shell Check — 2026-10-13

## Scope and result

Reviewed the authored shell/native changes on `codex/desktop-shell-ui` against the user-approved PRD/design/plan and the frontend desktop/component/quality contracts. The base is `643ec6f2`; this review concerns the uncommitted task changes, not the entire repository or a release artifact.

The review traced AppFrame's navigation, stable header target and scroll ownership; selected silhouettes; Agent header theme/popup/drag exclusions, topic state, composer/transcript/turn offsets; workspace query guards and callbacks; print ancestor overflow; genuine runtime/chrome-marker selection; the actual Rust window builder and its narrowly scoped capabilities. Existing B01 and shared-video harnesses continue to traverse header children and exercise actual query identities, guards, settings and Outlet ownership. No business/storage/provider owner or dependency changed in the reviewed implementation.

The dedicated Agent header popup host is outside working-surface clipping and carries an explicit native-drag exclusion. Its theme scope remains distinct from the body's `.agent-chat-root`. Installed Tauri 2.12.2 `drag.js` was read directly: deep-region traversal rejects native buttons/links/inputs, interactive roles and explicit `false` descendants. AppFrame only marks genuine macOS Overlay chrome draggable. Actual native behavior still requires the root's app inspection.

## Findings fixed by this reviewer

- `src/components/workspace/WorkspaceChrome.tsx`: the portalled project `<header>` became a descendant of AppFrame's outer `<header>`. Changed only the inner presentation wrapper to `<div>`, preserving class, hidden/style, children and every callback/guard. This avoids nested header content and duplicate banner semantics.
- `tests/sharedVideoPageParity.test.ts`: two existing adapter-parity assertions expected the old inner `header` tag. Updated them for the actual `div` presentation and added an assertion that the real `AppHeaderPortal` boundary exists. Retained all business, capability, query and nested-Outlet assertions and timeouts.
- `quality/unused-contracts.json`: refreshed only the existing evidence hashes for the two CSS dependency contracts and the optional E02 runtime contract after reviewing their changed sources. No allowance, reason, owner, issue count or quality policy changed. Final evidence is `src/styles.css` SHA-256 `239ccf7023017b24b12ba1b2dcfc9be58e60e4dffc43d4e12001ab9f3a8bf648` and `scripts/e02-browser-regression.mjs` SHA-256 `9569ddbf428a81c631d485d2d291da9f0a2efe5f7a728e6db179f072f4a82f14`.

No remaining confirmed code/spec defect was found within this review scope. The root owns the synchronized specs and task acceptance state.

## Executed verification

Used the explicit machine pnpm at `/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm`, with its Node 24 directory first in PATH. Checks ran sequentially; raw logs remain under `/tmp/cuepoint-shell-check-*` and are not permanent task artifacts.

| Check | Outcome |
| --- | --- |
| Root `lint` / TypeScript | Passed, including after the header wrapper repair |
| Root formal `quality` | Passed, including after the repair: 12 existing reviewed allowances, 584 visible review warnings, zero failures; 484 graph files, 1999 static value edges, zero static cycles; seven exact unused contracts |
| Root `quality:self-test` | Passed, 88 cases |
| Root `model-bank:verify` | Passed, 197 files / 85 providers / 1855 models |
| Full root `test` | Passed after implementation freeze: 229 files passed / one skipped; 3972 tests passed / seven skipped; 39.20 seconds |
| Final B01 + shared-video suites | Passed after the wrapper/assertion repair: two files / 38 tests |
| Desktop `types`, `lint`, `quality` | All passed |
| Desktop `test:release` | Passed, 99 tests |
| `git diff --check` | Passed |

The complete suite used the just-built real `desktop/tauri/.tools/target/debug/product_store_probe` through `CUEPOINT_NATIVE_STORE_PROBE`. It retained the ordinary browser test owner and did not set SQLite-owner or native-acceptance flags. The seven skips remain explicit; no skipped runtime acceptance is claimed as execution. The earlier bounded Agent-tool timeout did not reproduce in this full run. Following the small HTML wrapper repair, only its two affected suites were rerun, as directed by the root; the full-suite counts above precede that final mechanical repair.

Failed/interrupted attempts were not counted as passes: the first exact-evidence check raced an implementation update to E02 and was rerun after freeze; the final quality/focused process was interrupted and rerun; the first post-repair focused run correctly failed its two obsolete tag assertions before the assertions were synchronized. Existing failed implementation attempts (missing native probe and obsolete E02 fixture transaction) remain documented in the implementer's conclusion.

## Acceptance boundaries

The native implementer separately recorded Rust formatting, normal `product-sqlite` Clippy and seven chrome-helper tests; those are collaborator evidence, not checks executed by this reviewer. The root owns final frontend/app builds, browser CUA interactions, real macOS traffic-light/drag/control/double-click/fullscreen/minimum-size checks and printed output. This code/quality conclusion does not close unperformed visual or native acceptance. Windows/Linux runtime checks remain pending unless matching-host evidence is supplied; preserving their native title bars does not establish runtime validation. No commit, push or publication was performed by this reviewer.

## Approved Remix follow-up: independent review

The user subsequently expanded the same task to unify all application-owned general icons with official Remix. Reviewed the amended task artifacts, research inventory, exact package/lock delta, the shared semantic mapping, all consumer diffs beyond import replacement, paired AppFrame destinations, CSS and affected historical runners. This section supersedes the earlier dependency/quality counts for the final expanded scope.

- `@remixicon/react` is pinned to 4.9.0 with the corresponding React 19 lock entry. Lucide 0.544.0 moved to an exact development dependency for unchanged historical comparisons; no other package/lock changes were introduced.
- The shared module has 116 semantic exports backed by 103 named official glyphs. AppFrame directly imports seven matching official Line/Fill families. The previous hand-built selected SVG owner is removed. Final source scanning found zero `lucide-react` imports in `src`; model/provider owner diffs are empty.
- Installed LobeUI Icon forwards default `fill="transparent"`, stroke width and size/dimensions. The adapter discards its fill/stroke geometry and redundant dimensions while forwarding semantic size/color, class/accessibility/event props and the SVG ref. The installed Remix React 19 function forwards remaining props, including ref, to its actual SVG. The two permanent regressions render the real base-ui ActionIcon under the actual published MotionProvider and check native button/accessibility, visible official fill and explicit size/color without mocking the icon renderer.
- Reviewed the implementer's emitted single-Search esbuild probe at `/tmp/cuepoint-remix-tree-shaking.mjs`: one official SVG path, 1,027 bytes, with no unrelated glyph. Named imports, package `sideEffects:false` and pure wrapper calls permit unused mapping exports to be removed. This is finite tree-shaking evidence, not a whole-product chunk-size claim.
- Semantic exceptions preserve their original commands and labels: explicit music Heart/HeartFill favorite states; directional undo/redo; labeled snapping through Focus2; ResetLeft for restoring defaults/suggestions; Restart for retry/reopen; mirrored right-inspector fold/unfold. Waveform and usage-meter SVGs retain actual data geometry. The root owns visual confirmation of symbol appearance and panel direction.

### Additional findings fixed

1. `src/components/ui/remixIcons.tsx` declared `const Infinity`, which failed the formal `no-shadow-restricted-names` rule. Changed the local binding to `InfinityIcon` and re-exported it as `Infinity`; all existing consumer APIs and glyphs remain intact. No lint exception was added.
2. `scripts/e01-drafts-browser-regression.mjs` still selected the actual topic deletion control through `svg.lucide-trash-2`. Changed it to the active row's exact accessible button name `删除`, retaining the existing callback-behind-modal mechanism, mutation/departure assertions and waits. `node --check` passed. The browser runner was not executed by this reviewer, following the root's CUA-only interaction boundary. E02's old Lucide selector is only inside the immutable-baseline branch; E06 copy selectors target dependency-owned LobeUI controls and remain correct.
3. Formal Knip discovery does not establish the runtime-only original comparison imports, so moving Lucide to devDependencies produced a real retained-dependency finding. With the root's explicit approval, added one exact contract for `devDependencies/package.json/lucide-react`, count one, owner `Immutable source comparisons`. Its evidence covers the three untouched Lucide-importing snapshots, the actual E02 baseline loader and the actual E04 fixture caller. This changes the reviewed-contract count from seven to eight; it adds no dummy consumer, entry expansion, blanket suppression, test removal or immutable-source edit. Existing quality policy is unchanged.

The three snapshot sources were compared directly with HEAD and are byte-identical:

| Snapshot | SHA-256 |
| --- | --- |
| `tests/fixtures/sourceSnapshots/e02/TopicSidebar.tsx` | `03eb777c98984d75300c9dcfd1533739e3c7308d561d6d72a6bf20be55bc2dc9` |
| `tests/fixtures/sourceSnapshots/e04-library/src/components/studio/ProjectGalleryPage.tsx` | `c23024ec2c6eabb2b0e85da04c3108015026eadf5b35ff0e988b8db1eb641a3b` |
| `tests/fixtures/sourceSnapshots/e04-library/src/components/studio/projectKinds.tsx` | `97fef5bcd209e8dfff7b01a7c5ad6f2bf014690d6b869a0ac48c46680f4ee6db` |

The E02 loader's final hash remains `9569ddbf428a81c631d485d2d291da9f0a2efe5f7a728e6db179f072f4a82f14`. Every evidence hash across all eight contracts was independently checked against the actual source. Root owns the accompanying component/desktop/quality-spec synchronization.

### Final expanded-scope gates

All checks used the same explicit machine pnpm/Node 24 lane and ran sequentially, after source freeze and the fixes above. Logs are outside the repository under `/tmp/cuepoint-remix-check-*`.

| Check | Final outcome |
| --- | --- |
| Root `lint` / TypeScript | Passed after the Infinity alias repair |
| Root formal `quality` | Passed: 12 existing reviewed allowances, 584 review warnings, zero failures; 484 graph files, 2076 static value edges, zero static cycles; eight candidates / eight exact reviewed contracts |
| Root `quality:self-test` | Passed, 88 cases |
| Root `model-bank:verify` | Passed |
| Full root `test` | Passed: 230 files / one skipped; 3974 tests / seven skipped; 33.13 seconds |
| Desktop `types`, `lint`, `quality` | All passed |
| Desktop `test:release` | Passed, 99 tests |
| E01 runner syntax / `git diff --check` | Passed |

The full suite includes the final header wrapper/parity correction and the two new actual icon-rendering tests. It uses the real compiled native probe without changing ordinary owner/acceptance flags. The first Remix formal-quality attempt failed for the restricted Infinity binding and unresolved real historical dependency use; the passing final attempt follows the explicit fixes, with no relabeling of that failure.

No remaining confirmed code/spec issue was found in the expanded review scope. Final frontend/native builds and actual browser/macOS/print acceptance remain root-owned; this reviewer performed no browser automation, native UI interaction, commit or remote action during the follow-up.

## Approved compact-shell screenshot refinement

Reviewed the user's subsequent screenshot-scale correction after source freeze: `src/styles.css`, `src/components/agent/agentHeader.css`, AppFrame's three glyph-size classes and the native macOS traffic-light coordinate. The 44px shared row, 56px rail, 36px desktop buttons and 16px glyphs are internally consistent; mobile navigation/import retain 44px targets. Agent header shortcut selectors retain at least 36px hit areas and muted/default to foreground/enabled-hover colors. They target only topic/title-control/action groups, leaving the sibling popup host and its danger/menu colors outside these rules. Workspace selectors preserve disabled, focus, label and callback ownership. Topic list width, portal target, surface inset/radius, scroll owners, guard and runtime trees remain unchanged.

The macOS builder now uses `(16, 24)`. Read pinned Wry 0.57.0's `wkwebview/class/wry_web_view_parent.rs`: its titlebar frame height is the native close-button height plus the y inset; the native buttons preserve their own y origins while x positions use the original spacing. This supports the root's calibration method, but source inspection alone does not establish the final visual center. Root owns actual-photo comparison, final build and native acceptance.

No new source defect was confirmed. The root synchronized the shell-token sentence to 56px / 44px / 36px / 16px before finalization. The native calibration evidence is appended to `research/native-chrome-implementation.md`, rather than a separate calibration file; its pinned Tauri → runtime → Wry chain and inset formula were reviewed. No remaining documentation issue was found.

Refreshed only the two existing `src/styles.css` evidence hashes to `70976f4bcd3a67f7938fb982da52432ab62fba0a75642ebcdc7a4e894be3cf3b`. Contract counts, owners, reasons, allowances and quality policy remain unchanged. Sequential final root TypeScript and formal quality passed, with the same 12 reviewed allowances, 584 review warnings, eight exact contracts and zero failures. Focused B01 query identity, shared-video parity, real Remix/Lobe rendering, overlay focus return and window-chrome helpers all passed: five files / 54 tests. Logs remain under `/tmp/cuepoint-scale-check-*`; `git diff --check` passed.

The preceding final expanded-scope full run (3974 passed / seven skipped), 88 quality self-tests, model verification and desktop 99 tests remain recorded as earlier executed evidence. They were not rerun for this presentation/native-offset-only refinement, as directed by the root. No business, dependency, adapter or test-policy implementation changed in this refinement. Final visual/build/native acceptance remains separate and root-owned.

## Final expanded-composer native correction

After those gates, the root's actual macOS 760×520 inspection found that the expanded editor's textarea settled at approximately padding-only height. The implementer changed only the existing expanded textarea rule in `composerControls.css`: `flex: 1` became `flex: 1 1 auto`, and `height: 0 !important` became `height: 100% !important`. Independently read the actual composer tree and installed AntD/RC textarea renderers before approving this correction.

`FloatingComposer` renders AntD `Input.TextArea` directly, not LobeUI ChatInputArea. Expanded mode disables autoSize; RC Input's pure-textarea path preserves the actual textarea as the root flex item (BaseInput clones the root with the caller class/style, and ResizeObserver adds no layout element). The conversation dock/content/stack supply bounded expanded height; `.agent-composer` is the growing column with `min-height:0`, while footer/controlbar retain `flex:none`. An automatic flex basis with an explicit available-height basis permits the textarea to shrink around those fixed siblings and scroll its own content. The expanded selector has four class/type specificity components and its important height overrides the normal important `height:auto` rule. It applies only below `.agent-composer-stack.is-expanded`; leaving expanded mode restores the existing min/max-row autoSize path. Draft value, ref, composition/Enter handlers, attachment controls, state owners and callbacks are untouched.

Installed PostCSS parsed the final stylesheet successfully; `git diff --check` passed. Revalidated every evidence hash in all eight quality contracts: all still match. `composerControls.css` is not an exact-evidence file in those contracts, so no hash, allowance, policy or count update was necessary.

This is a source/layout-authority review of the last two-line correction. It does not claim that WebKit now renders the intended height. The 54 focused tests and static quality run above preceded this last correction; the 3974 full tests preceded the compact-shell refinement as already recorded. They remain historical executed gates, not reruns of this final CSS. Root is rebuilding and rechecking the actual short macOS window and owns any final native success claim. No full suite was repeated for the scoped CSS correction, as directed by the root.
