# E02 implementation — AU04 / AU05

Implementation and owned validation are complete. Source is frozen at revision 3 (2026-10-09T02:55:08.473333+00:00); cumulative typed static/AST and independent acceptance belong to the main coordinator. No findings/status/spec/ledger were closed or advanced.

## Product changes

`TopicSidebar.tsx` now renders a noninteractive row container with sibling native selection, rename and delete buttons. There is no parent activation handler to receive child keyboard events. Actions remain mounted, retain their 24px geometry, and become visible on hover, active selection or `:focus-within`. An inactive, nonhovered row reached by Tab exposes both actions. Native Enter/Space activates exactly the intended control. Focus outlines use the existing 3px treatment; title truncation still reserves action space only while actions show.

`agentChat.css` moves the existing max-width767 block after the base message/content/dock declarations it must override. Desktop 16px horizontal gutters and 800px content cap, 52+16px header clearance, specific 24px turn rail gutter and expanded composer overrides remain.

One cross-unit script adaptation was explicitly authorized after the unchanged E01 runner failed: `scripts/e01-drafts-browser-regression.mjs:283` now locates `.agent-topic-row-title` before its existing programmatic click. All old row targets were inspected; line348 already targets the native delete child and remains unchanged. Every assertion and timeout is byte-identical after reversing the single locator edit. Accepted E01 reports/hashes/outputs remain untouched. Exact diff and hashes: `research/e02/e01-selector-adaptation.json`.

## Source freeze and exact changed files

Baseline is the actual accepted-E01 working tree captured by `E02-entry.json`, not a Git-only diff. New files use null before hashes. The two durable original modules are byte-exact, minimal module inputs with provenance; permanent fixtures never import `.trellis`. Final freeze: `research/e02/source-freeze.json` (SHA256 `0a4b42ca9451ad18080205a9e9edbb6111f192fedd40a05a5e0c84f08ea3f573`). All ten final hashes were reverified, and every entry-tracked nonowned file matches its E02-entry hash.

| Path | Before SHA256 | Final SHA256 |
| --- | --- | --- |
| `src/components/agent/TopicSidebar.tsx` | `03eb777c98984d75300c9dcfd1533739e3c7308d561d6d72a6bf20be55bc2dc9` | `121d77f9f9b0b094caef74b52c2574837250e9d92366d33a6056eb6204c3f0b7` |
| `src/components/agent/agentChat.css` | `b1e1bd7da07ea2efe595cef9b5c6a8291563abf93dedae4bd90cc2877348fb1e` | `e8d456f0a635f79ad163705d8b0504247b95618526fcff97eb0ab371b7b117eb` |
| `scripts/e02-browser-regression.mjs` | `null (new)` | `215aa6f27c5122322af029da3665ad958d8ff74b2629e37751604f9614b10260` |
| `tests/fixtures/e02/harness.tsx` | `null (new)` | `d5f37323e1ba40a524fe266209ed31c958c9e898466d2bc970971e45f859d869` |
| `tests/fixtures/e02/index.html` | `null (new)` | `e6ca6c03e82fa7b0a5d854c4fc9c3b727dfc3441cc34a3822a66055d0771c73c` |
| `tests/fixtures/e02/tsconfig.json` | `null (new)` | `cbf2e9e64c5fca6bc1e940e98515e943c495a4128a03630d977c5636f404b04a` |
| `tests/fixtures/sourceSnapshots/e02/TopicSidebar.tsx` | `null (new)` | `03eb777c98984d75300c9dcfd1533739e3c7308d561d6d72a6bf20be55bc2dc9` |
| `tests/fixtures/sourceSnapshots/e02/agentChat.css` | `null (new)` | `b1e1bd7da07ea2efe595cef9b5c6a8291563abf93dedae4bd90cc2877348fb1e` |
| `tests/fixtures/sourceSnapshots/e02/provenance.json` | `null (new)` | `e46e095db1ead5e14fc9b5687589d04a211ac08298e4bd5ac412fd497f7491c7` |
| `scripts/e01-drafts-browser-regression.mjs` | `4511dc6bb5340f9a366bec6ec5ac90dcb14e38502d0232f9917f65862d26b3b7` | `2f2ac3abe91a3fba6f626662046d5cb5cbd0f6bc03f8147ed1f3e01fc00d8d5d` |

## Validation

- E02 original-source comparison: **11/11** cases, `research/e02/native-before-freeze-2/observations.json`.
- E02 current native behavior: **17/17** cases, `research/e02/native-after-freeze-2/observations.json`.
- Labelled 32px safe-area CSS surrogate: **9/9** cases, `research/e02/native-safe-area-surrogate-freeze-2/observations.json`.
- Authorized E01 runner adaptation: **19/19 original cases**, `research/e02/e01-drafts-adapted-final-observations.json`.
- Focused Vitest: **3 files / 8 tests**, `research/e02/focused-freeze-2.log`.
- Application typecheck and fixture typecheck both exit0, `research/e02/typecheck-freeze-2.log` and `fixture-typecheck-freeze-2.log`.

Real native Tab reaches inactive rows with the pointer outside them; focus reveals actions and both native buttons show the existing focus ring. Enter and Space rename B or delete C through actual Radix dialogs and real IndexedDB, with A still selected. Own row Enter/Space and pointer select B. Hover/active actions and actual Ant Design header context actions preserve target routing. Each final runner records one initial main document, zero unexpected reloads and zero page errors. Explicit HTML optimize entry and fresh temporary Vite cache are used on each invocation.

| Width | Before message/dock horizontal padding | Current padding | Current content max / inline margins | Native dock bottom | 32px surrogate dock bottom |
| --- | --- | --- | --- | --- | --- |
| 390 | 16px | 8px | none / 0px | 12px | 32px |
| 767 | 16px | 8px | none / 0px | 12px | 32px |
| 768 | 16px | 16px | 800px / 0px available margin | 16px | 16px |
| 1440 | 16px | 16px | 800px / 174px each | 16px | 16px |

Native env-bottom measures **0px** at all four widths. Header left padding stays44px below768 and16px on desktop; transcript top padding stays68px. Actual wheel scroll reaches the bottom; the terminal message paragraph is visibly below the header and above the dock at every width. Expanded composer has zero outer padding, no content cap and exact column bounds; transcript becomes inert. The more-specific turn rail retains24px left padding at390 and1440.

Versions: machine Node24.11.0, explicit machine pnpm10.15.0, TypeScript5.9.3, Vitest5.0.1, Vite7.3.6, Playwright1.62.1, Chromium151.0.7922.34. Exact raw commands, observations, styles, bounds and versions are in `E02-implementation.json`. Every package operation used the explicit user-provided machine pnpm path; no install was performed.

## Preserved failures and final input authority

The unadapted E01 runner failed after12 passing cases: line283 clicked the newly noninteractive wrapper, so no departure was requested; line284 then timed out awaiting the guard. The log remains at `research/e02/e01-drafts-final.log`, with copied HTML/screenshot/observations under `research/e02/e01-unchanged-runner-failure/`. After the authorized one-line target correction, all19 cases pass. Product semantics were not reverted to satisfy the obsolete selector.

The existing safe-area capability probe and its method-missing failures are untouched. Chromium151 lacks `Emulation.setSafeAreaInsets`; the 32px test replaces only the CSS `env()` operand with a named custom property and evaluates the same `max()`/cascade. It does not prove real iOS/OS/device safe-area behavior.

Freeze1 observations/styles remain. Its initial scroll marker was the message heading, which can be above the viewport in a long message. Freeze2 adds a terminal marker and strengthens visibility bounds; all11/17/9 cases were rerun with those exact inputs. Freeze3 changes only the separately authorized E01 runner locator. All nine E02 input hashes are identical between freezes2 and3; the adapted19-case E01 run executes after freeze3. There are no subsequent source edits.

## Coordinator static / AST receipt

The main coordinator completed the cumulative same-version typed analysis for10TS files:3errors/35warnings before,2errors/34warnings current, no added noncomplexity diagnostics. Attribution confirms all3 cumulative complexity changes are inherited from accepted E01; E02 adds zero complexity diagnostics. Current input hash mismatches are empty. Read-only receipts: `reviews/E02-static-summary.json` and `reviews/E02-static-attribution.json`; exact hashes and pipeline versions are recorded in `E02-implementation.json`. Coordinator-reported current AST is419nodes/2498edges,0parse errors and0value-edge SCCs. This role did not rerun that pipeline or treat existing metrics as QG01 debt acceptance.

## Handoff limits

Native evidence is installed headless Chromium on this machine; no physical device/OS or paid-provider proof is claimed. No full repository test/build/static rerun is claimed. Main coordinator supplied cumulative typed static/AST results; independent check remains main-owned. There are no E03+, package/CI, spec/ledger/status, commit or push changes. Source and artifact hashes are available in the final freeze, structured implementation report and `research/e02/artifact-manifest.json` (manifest excludes itself).
