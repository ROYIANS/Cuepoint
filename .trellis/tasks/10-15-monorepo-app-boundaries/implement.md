# Application Boundary Execution

## Before activation

- [x] Follow parent `research/context-loading.md`; read required canonical specs through EOF in chunks when injection truncates or omits them.
- [x] Confirm parent implementation approval and current task/working-tree ownership. User replied “批准”; child 1 is active on `codex/monorepo-app-boundaries`.
- [x] Load parent design/research and curated context; record required gate baselines and tool versions before edits in `research/baseline.md`.
- [x] Inventory source/generated/deployment path consumers; inspect native runner arguments and real-probe prerequisites.

## Ordered implementation

1. Add workspace manifests, dependencies, explicit exports and root orchestration, retaining existing versions and reviewing necessary lockfile changes.
2. Move shared product to studio and browser entry to web; update all quality/type/test discovery with the move, retaining product-internal organization.
3. Move desktop entry/Rust/tooling; repair schema/probe/worker/assets/integrity paths and verify shared-studio startup/storage selection.
4. Move site and extract only current shared distribution definitions; retain deliberate output assembly, routes and dependency isolation.
5. Update Docker/CI/package/generated/release-input paths while preserving existing CI policy/reference lanes.
6. Add boundary/discovery self-tests; remove bridges and update actual architecture/package/spec discovery documentation.

## Required verification

Use `/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm` for every pnpm invocation. Parent `implement.md` defines shared gate policy and handling of native prerequisites.

- [x] Root `lint`, `quality`, `quality:self-test`, `test`, `models-dev:verify`, `build` and `landing:budget` retain complete coverage. Full root tests: 4655 passed; formal/workspace self-tests: 88 + 2 passed; final quality receipt: zero failures and 1173 unchanged inputs.
- [x] New `--filter @cuepoint/web build`, `--filter @cuepoint/site build` and `--filter @cuepoint/desktop build:frontend` pass; root output retains checked deployment assembly. Actual Nginx/container routing remains unavailable on this host, separately recorded below.
- [x] Existing desktop `types`, `lint`, `quality`, `test:parity`, `test:native`, `build:frontend`, `test:release` and native all-suite acceptance run through documented owners and the actual Rust bridge. Final native: 107 suites / 1833 tests + 6 self-hosted + 5 browser-only cases; 1217 unchanged inputs, complete coverage, overall exit zero.
- [ ] Available browser/normal desktop startup, route refresh, workers and store reopen are checked; unavailable host/manual cases remain pending. **Partial:** actual browser four-route startup/refresh and isolated normal native launch/storage creation passed. Manual WebView/worker/media/Save, user-data reopen and actual Nginx/container deployment are not established; see `verification.md`. This remains open at the stated finite scope.
- [x] Forbidden edges and omitted source roots fail; source/dependency inventories contain no missing coverage or unrelated upgrades. Independent lock comparison proves unchanged package resolution records; immutable source snapshots/schema/native icons remain unchanged.
- [x] Independent final-scope review and authored `verification.md` map WA1-WA5 to results and material limits. Review found no remaining relocation blocker. Existing E03 strict visual comparison and B01 historical read-gate comparison remain explicitly failed, outside claimed passing lanes; no assertion/snapshot was weakened. Raw logs/receipts stay outside retained artifacts.

## Review checkpoint

Implementation and independent structural review are complete. The user confirmed the Phase 3.4 batch and continuing to child 2 on 2026-10-15; source/spec checkpoint is `bb3a9580`. Complete the approved task-doc commit and archive/journal closeout before activating child 2. The parent remains unfinished, and the finite checks above remain open at their stated scope.

## Completion boundary

Do not advance to child 2 with temporary aliases, weakened coverage or unexplained native failures. Record a rollback checkpoint and preserve others' edits. Do not initiate remote release/publication.
