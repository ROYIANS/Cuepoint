# Child 1 baseline and preservation evidence

Baseline was taken before relocation on branch `codex/monorepo-app-boundaries`, starting at `d0efb823`. Commands used the approved machine pnpm at `/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm`; its actual version was 10.15.0, matching the pre-existing `packageManager` pin. Node was 24.11.0. No dependency or toolchain upgrade was made.

| Pre-edit check | Observed outcome |
| --- | --- |
| Root `lint` | Passed. |
| Root `quality` | Failed on stale exact evidence for retained audio delete APIs; the actual current command bodies and explicit retention spec were inspected before individually rebinding evidence. This was pre-existing baseline debt. |
| Formal quality self-tests | 88 passed. |
| Models.dev baseline verification | Passed against pinned `@opencode-ai/models` 0.0.104. |
| Browser production build / site budget | Passed; landing eager gzip JS 84.87 KB, CSS 3.79 KB. |
| Full root Vitest, with actual pinned Rust probe prepared | 4654 passed, one current icon-generation comparison failed, seven existing tests skipped. Generated ModelIconMapping formatting differed from the current locked generator output. The current generated file was regenerated with the same icon dependency version; snapshot comparators were preserved. |
| Desktop types / lint / unused | Passed. |
| Desktop release tooling tests | 99 passed. |

The first post-move native all-suite invocation found a stale suite-manifest reference to `tests/agentExecutionSummary.test.ts`. Commit `b7dac8c1` had already removed that test and its implementation in favor of the current message-presentation behavior. The manifest now selects the existing `tests/agentMessagePresentation.test.ts`; current permanent assertions were neither deleted nor weakened.

## Preserved bytes and provenance

A pre-edit SHA-256 inventory of tracked files was captured outside the repository. Comparison after relocation found all **85** files below `tests/fixtures/sourceSnapshots/` unchanged. The shared schema remains SHA-256 `3c897189ef6f71517c55c86b5d24b7f9cd0e1cfd88d1b916b46345662187eff0`; the original portable native contract remains SHA-256 `9368ed1b759240113b2f76e7a679f3c3cc169e121c443c3c0e623e1b6d709235`.

The portable-contract generator preserves the immutable fixture's original source identities. A separate closed `apps/desktop/fixtures/portable-contract-source-map.json` binds the original path/hash pairs to their current moved source path/hash pairs before comparison. Generation checks execute the current APIs against the original oracle; they do not rewrite the comparator to match a result.

## Installed-package handling

The root and nested native lock graphs were merged using their already pinned package/snapshot versions, with explicit importers for all five workspace packages. An offline lockfile-only attempt stopped on missing cached metadata. The subsequent frozen, script-disabled installation reused installed packages and fetched four already pinned missing packages; there was no node_modules purge or version re-resolution. Native `.tools` and existing desktop node_modules were moved on the same filesystem to preserve their caches. The retained historical Electron lane keeps its independent lock and explicit reference classification.

## Exact retained declaration evidence

Root unused discovery now includes the real `.mjs` implementation and `.d.mts` companion instead of leaving them outside its project scope. Eight exact projection declaration exports/types are retained because TypeScript resolves imports of `projection.mjs` to that companion. A direct TypeScript `resolveModuleName` check using the root compiler options resolved both `packages/studio/src/lib/ai/modelCatalog/sync.ts`'s `./projection.mjs` import and `tooling/models-dev-baseline.mjs`'s relative implementation import to `packages/studio/src/lib/ai/modelCatalog/projection.d.mts` with extension `.d.mts`. Contracts bind each diagnostic to the declaration, implementation and these real consumer hashes. There is no added dummy consumer. The previously exported unused `monthsBefore` helper became private without changing its implementation.

Temporary raw logs are local diagnostic material. The authored outcomes here, final verification and browser acceptance report are the durable task evidence.

## Independent browser harness drift

Real execution of the existing E04 library harness found two pre-existing locators out of date with the unchanged HEAD product: CoverCard's title/className attributes are separated by a newline, and archive selection already uses the explicit `含已归档项目` / `使用中` buttons rather than a checkbox. The observation transform now requires exactly one whitespace-tolerant match; the runner clicks the actual role/name controls. All original archive, sorting, source comparison, query and subscription assertions remain. Final execution passed all 16 scenarios with Playwright 1.62.1 and Chrome 151.

Native icon verification used the existing Python environment's Pillow and `--check` only. It passed original artwork pixels/framing, all icon containers and exact artifact/provenance hashes. `webMatchesGenerationEvidence` is false because the receipt records the historical original path keys; before the current brand README path-documentation edit, every mapped original web file's content hash still matched that receipt and pre-edit inventory. The receipt was not regenerated to conceal this distinction.

The E03 historical CSS paired comparator is **not passing**. Its producer now maps immutable original `sourcePath` values to the current Studio location and boots the actual Audio/Music fixture. Strict comparison then fails at `audio-1440-script same-page every computed property and geometry`: a sidebar element is 255px high in current CSS versus 235px with the historical CSS, with associated padding/border/font differences. Current workspace CSS SHA-256 `559020cf424babcd815afd06f1a943e17ca45b705ab127fa43d85721efbe8efa` and story-workspace CSS `1fd1f19dd0f9aec4665e2f588faed2275e3a2aaf2d1561a8c126446b41c26432` are each byte-identical to pre-edit HEAD; immutable comparator hashes remain `ea0d1dddecc60a1f47f494c4e0e46b04a536fde3666beb02c4b2a79ddac7878c` and `2144425bbc19a08d3826ecb4c9243e6de6452ec8951feaaaf585041991dcc90a`. Source drift and runtime exceptions were empty. Unchanged inputs support a pre-existing historical comparison divergence; E03 itself was not executed before edits, so there is no claimed pre-edit execution proof. Product CSS, equality assertions, thresholds and comparator bytes were preserved.
