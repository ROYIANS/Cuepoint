# E03 PU09 implementation — frozen handoff

Implementation is complete within the delegated scope; main static/AST/scope gate and independent check remain required before PU09 closure. Actual baseline is the accepted post-E02 working tree recorded in E03-entry.json, not Git HEAD.

## Removal and preservation

Reviewed all **276 rule records / 296 selector branches**, the 442-input manifest, current JSX/import closure, class forwarding, conditional/interpolated classes and portal/responsive consumers. Removed **115 whole obsolete rules and only 2 obsolete branches in mixed lists**, totaling 128 branches backed by 47 absent class names. Preserved `.aw-muted`, `.as-script-input`, both structural caveats, shared controls/player/recorder/jobs, portals and responsive rules. All **161 retained rules / 168 branches** retain exact raw declaration bodies, order and at-rule context. Detailed original IDs, line ranges, hashes and verified offsets are in `e03/complete-selector-review.json`.

| CSS | Original bytes | Final bytes | Original SHA-256 | Final SHA-256 |
| --- | ---: | ---: | --- | --- |
| audioMusic/workspace.css | 15458 | 6016 | ea0d1dddecc60a1f47f494c4e0e46b04a536fde3666beb02c4b2a79ddac7878c | 8f7488ef9aa6dfec644c490481908f89ec401681f6a1bc3b9aa26cc2d5567a19 |
| audio/story-workspace.css | 12955 | 10054 | 2144425bbc19a08d3826ecb4c9243e6de6452ec8951feaaaf585041991dcc90a | cd81cd3e25b56b06ef0db930fafd64a9254375a2ed54d9161624f85c79682dd5 |

Initial verified offsets left whitespace-only indentation in deleted responsive-rule slots and exposed EOF blank lines. The initial attempt CSS and map are preserved under `e03/css-attempt-01/`. The corrected producer extends only deleted whole-rule spans to their own line slots and removes newly exposed trailing EOF blanks. Final scoped `git diff --check` passes. The final declaration supplement is `e03/actual-retained-equivalence-and-scope-final.json`.

## Authoritative native result

`e03/final-paired-corrected/observations.json`: **114 original/current pairs, all exact PNG SHA-256 matches and zero decoded RGBA pixel differences**. Every pair also has exact equality of all 588 computed properties, geometry, `::before`/`::after`, DOM/SVG attributes, leaf text, form values, focus and hover. Audio widths: 1440/1099/800/799/390; music widths: 1440/1280/1279/1000/800/760/390; height 900. Actual AudioWorkspacePage/MusicWorkspacePage, seeded native Dexie, local generated PCM WAV, actual portal menus/sheets/dialogs/selects, script/timeline/inspector/voices/sources/export/recorder idle and music compose/library/details/player. Visual inspection paths and native seed counts are recorded in the JSON report. Page errors 0; external requests 0; one initial main document; source changes during run empty.

Original/current CSS substitutes only the two immutable test-owned snapshots or current files. Actual Vite CSS-module delivery string literals equal their raw CSS source bytes for both variants (`e03/vite-style-byte-equivalence.json`), so no extra transform semantics are bypassed by the node swaps. Permanent fixture/runner imports no mutable task/archive files.

## Preserved failures and bounded raster control

Initial startup duplicated a globally unique audioGenerationJobs.intentId across two projects. The fixture now uses unique IDs. `startup-duplicate-intent-reproduction` preserves the actual ConstraintError name/message, failing seed phase and thrown seed-await wrapper stack; Dexie itself supplied no original stack. Earlier startup failure reports remain intact. The first fixture typecheck also failed on an insufficiently discriminated Flow seed, then was fixed with explicit engine `flowmusic`.

Historical initial-CSS `after-attempt-01` / `after-diagnostic-02` cross-process comparisons failed at audio-800-timeline: 8 rounded selected at-clip outline pixels, maximum channel delta 2. Historical first same-page `final-paired` failed at audio-1440-select-portal: 17 pixels on that same timeline outline, not in the portal; properties/geometry matched. These are **preserved failed evidence**, not acceptance passes. Two independent original/software 800px runs matched the current image hash. `portal-same-css-control` then reproduced **17 pixels / max delta 2 in original→original**, with identical full property/pseudo/attribute/SVG/focus/hover/value/geometry SHA. Subsequent identical-original repetitions and original/current swaps were exact PNG matches. The underlying Chromium cache implementation was not instrumented; this is controlled evidence of source-independent raster state, not a hardware GPU claim.

The final bounded stabilizer applies the exact original CSS once more before the original/current comparison. All cold-original PNGs and same-source controls are retained per scenario; no tolerance, image mask or product style override is used. Five cold controls differ (47 total pixels, maximum channel delta 2), while **all 114 actual CSS pairs remain zero pixels**. Rendering is headless Chromium 151.0.7922.34 with --disable-gpu/--force-device-scale-factor=1 and deviceScaleFactor 1; physical GPUs/Safari/iOS are outside this proof. Same font/media/reduced-motion/animation controls are applied on both sides. Only idle recorder and paused offline media are exercised; no paid generation, new voice preview or recording permission. Dormant job/history affordance is seeded, and active compose captures are Suno; this is representative coverage rather than every generation/engine state. At 390px the baseline chapter title overlaps toolbar actions; native keyboard Enter opens that portal and the existing layout is preserved.

The initial retained-equivalence path was inadvertently reused during whitespace verification; original attempt hashes/map were restored from preserved attempt CSS/map with explicit reconstruction provenance in `e03/equivalence-report-provenance.json`. Current proof is a separate final supplement. Earlier startup runs 01–03 predate automatic producer snapshots, which is explicitly recorded; later and final runs preserve exact producer snapshots. No browser observations/screenshots or immutable snapshots were overwritten.

## Current validation and freeze

Machine Node v24.11.0; machine pnpm 10.15.0 at the explicitly authorized path (outside Codex runtime); Vite 7.3.6, Playwright 1.62.1, TypeScript 5.9.3, PostCSS 8.5.28. Final application typecheck and fixture typecheck pass. Three focused files / **46 tests pass**. Final retained-declaration/context proof and scoped whitespace check pass. Exact commands and separate final logs are in E03-implementation.json.

The nine changed product/test/runner/snapshot paths, their before/after hashes, all 442 current source hashes, 711-root baseline comparison, source producers and complete evidence hashes are frozen in `e03/final-freeze.json`. Only the two owned CSS paths differ among the 711 existing entry paths; the other seven owned root paths are new. Implementer is finished and will not mutate these inputs after this handoff. Main performs the remaining current static/AST/source gate and independent checker; no spec/status/ledger closure, commit or next-unit work was performed.
