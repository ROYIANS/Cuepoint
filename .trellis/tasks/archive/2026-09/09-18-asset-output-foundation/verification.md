# Verification — asset/output foundation, 2026-09-18

## Status
Second batch implemented following user request to commit batch one and proceed. First-batch work commits: 08d04b7, 0020f07; archive 2c7ccf1; journal 8765e14. This second batch is not committed yet. No paid requests, credentials or real user project records touched.

## Acceptance coverage
- Optional project brief/genre/audience/tone; character personality/motivation/voice; scene geography/lighting; prop appearance/material/size/usage/continuity; style palette/lighting/lens/composition/negativePrompt. Existing authored fields retained. Optional disclosures and scoped draft saving/retry.
- Project style default and per-shot inherited/explicit/none style, multiple props; same-owner repo validation, delete cleanup and ZIP remapping; creation-only beat cast/scene seeding.
- Independent image/video project defaults with six creative target ratios; exact APIMart standard GPT Image 2 and MiniMax H3 profiles, strict validation and native common parameter mapping. Unknown imported profiles preserved but blocked from use until reviewed. Unconfigured projects stay manual. Settings do not submit generation or alter shot timing.
- Same-owner existing media picker; correct kind/nonempty file filters and commit-time revalidation; shared IDs remain protected by orphan checks.
- Authored-text library search, owner-scoped studio access, world tab restoration, film copy and responsive touched controls.
- Delivery CSV/storyboard includes prop/style names and source; film naming omits internal episode labels.

## Automated and independent review
- Local pnpm only: /Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm.
- Full tests: 30 files / 386 tests PASS.
- Lint / typecheck: PASS.
- Production build: PASS; initial review 12.90s, final CSS/spec follow-up 13.77s.
- git diff --check: PASS.
- Review fixes: reject zero-byte media at slot commit, reject blank project name instead of false saved feedback, guard relation dialog close/switch during pending/failed writes; follow-up min-width mobile layout fix.
- Model test matrix includes all supported ratios/resolutions, duration bounds, mode-switch incompatibility, unknown-profile roundtrip and native key case.
- Repo/package tests cover cross-owner/deleted references, explicit null vs inherited style, new/legacy package remapping, independent snapshots, beat creation-only inheritance and invalidated media selection.

## Browser checks (production preview 127.0.0.1:5175)
Only synthetic audit project was used.
1. Film story page uses story wording rather than episode wording.
2. Project settings: enable GPT Image 2 and MiniMax H3 separately; switch video text→frames while fixed ratio remains → error and Save disabled; choose follow input → valid.
3. Close dirty settings → return/discard confirmation; return→save→close→reopen preserves models and adaptive frame ratio.
4. Create style, fill optional palette, immediately return to world → correct style tab selected. Search by palette text matches the style.
5. Set project default style → shot relations shows effective style with inheritance source. Add prop → shot selection auto-saves.
6. Export CSV; read downloaded `/Users/xiaomengdao/Downloads/审查样例 · 生产预览-分镜.csv`: prop name, style name, inheritance source all present and existing shot duration remains5 seconds.
7. Upload generated synthetic `/tmp/cuepoint-batch2-fixture.png` as first frame → save. Tail-frame picker lists that same file under current-project images → select→save. Both tiles show image results without second upload.
8. At390×844, project settings remains scrollable vertically; after min-width fix dialog scrollWidth equals clientWidth341. Viewport override reset afterwards. Shot table intentionally remains horizontally scrollable.
9. Backup action displayed success; a new ZIP download was not exposed on disk during this run, so this run does not claim its downloaded bytes were manually inspected. Automated roundtrip and media-sharing tests cover package contents.

Not manually exercised: native video playback, real model generation, quota fault injection, full multi-page PDF printing. These do not block this configuration/data task; failures/validation are covered at pure helper and repo boundaries where applicable. Browser hard termination is not a durable unsaved-draft guarantee.

Synthetic project now named `审查样例 · 第二批验证`; fixture/style/prop remain in local preview data for inspection. Existing Agent chunk-size warning persists (~7.9MB before gzip); no AI bundle refactor in this scope.

## Next
Third task 09-18-handoff-ai-data-contracts: shot-organized handoff package and typed context/target/revision/provenance boundaries before wiring actual AI execution. New creation metadata and model defaults can feed that contract directly.
