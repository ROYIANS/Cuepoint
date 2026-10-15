# Execution Plan

## Planning gate

- [x] Owner consent and previously agreed scope recorded in PRD.
- [x] Current source, specs, related task conclusions and toolchain constraints inspected.
- [x] Parent design and ordered child ownership defined.
- [x] Child PRD/design/implementation plans and real context manifests prepared (validate before final review).
- [x] Owner explicitly approved the latest final planning summary with “批准”.
- [x] Activate child 1 with `task.py start`; do not activate the parent for product implementation.

## Execution ownership

Use the current Codex Trellis implement/check sub-agent workflow after approval. Each dispatch begins with the actual active task path and declares concrete file/module ownership. Product implementation writers are serialized across structural slices. Check agents review the actual final scope independently; main coordinates, handles specs and records conclusions. Workers must not revert other contributors' edits. Native context injection is preferred, with the documented child-side pull fallback.

Follow `research/context-loading.md`: injection can truncate or omit long specs. Read required canonical specs in bounded chunks through EOF before editing or checking their owners; manifest validation alone does not establish full context delivery.

| Sequence | Child | Required output before advancing |
| --- | --- | --- |
| 1 | `../archive/2026-10/10-15-monorepo-app-boundaries` | Working workspace/app commands, one shared studio, site isolation, updated source discovery/CI/native paths and authored verification. |
| 2 | `../archive/2026-10/10-15-studio-feature-organization` | Complete owner map, feature-based sources/tests, preserved command/query/transaction contracts and no leftover relocation bridges. |
| 3 | `../10-15-reusable-agent-runtime` | Real core/provider packages consumed by Cuepoint plus isolated built-package durable example and conformance evidence. |

Each child owns its quality configuration changes and behavioral regression. Parent-only integration does not excuse an unchecked child. Do not run child 2/3 in parallel against the same moved paths.

Child 1 checkpoint (2026-10-15): implementation and independent structural review passed; final quality/native receipts match current inputs. Its archived `verification.md` records WA1-WA5 and finite E03/B01/manual/deployment limits. User confirmed the concrete Phase 3.4 checkpoint batch and continuing to child 2. Source/spec checkpoint is `bb3a9580`, task docs `4a149e55`, archive `bd0a9e89`, journal `03b8625f`. Child 2 completed on `codex/studio-feature-organization`; all Studio sources have feature/app/platform/UI owners, and final root/app/desktop checks passed. Complete native ALL acceptance passed using the installed `VITEST_MAX_WORKERS=1` override; independent whole-child review verified final receipts/current identities and accepted the explicit finite limits. See the child's authored verification for default two-worker timeouts, historical comparator failures and unperformed host/provider checks. The user confirmed the child-2 commit batch and continuing with “ok 继续”. Its accepted source/spec checkpoint is `6a2927f0`; task documents are `7ddeed11`, and its retained verification is archived under `archive/2026-10/10-15-studio-feature-organization`. Journal closeout follows before activating child 3. The overall parent remains incomplete.

## Baseline before child 1 edits

- [x] Record HEAD, git status, installed tool versions and current required gate outcomes without changing dependencies; child 1 `research/baseline.md` records the results and pre-existing failures.
- [x] Re-enumerate current apps/source/tests/generated outputs/fixture/probe/release path consumers.
- [x] Prepare a real Rust probe for suites that require it. Missing native prerequisites are a failure/precondition, not a reason to skip assertions.
- [x] Compare active `10-12-desktop-release-pipeline` working state; retain its release policy and other contributors' changes. That task remains outside this task's closure.

## Validation command policy

Always invoke local pnpm as `/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm`. The root scripts below must remain usable or delegate explicitly to moved owners. Package command names added by the children are recorded there; do not claim a future command was run during planning.

```sh
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm lint
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm quality
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm quality:self-test
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm test
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm models-dev:verify
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm build
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm landing:budget
```

The current native regression is `pnpm test:storage:native --suite all --evidence-dir <fresh-directory>` under the approved local pnpm path; verify the actual runner's argument contract after relocation. Use its complete `all` suite and actual Rust bridge. Native tool commands continue through the repository's pinned tool wrapper. The original desktop commands `types`, `lint`, `quality`, `test:parity`, `test:native`, `build:frontend` and `test:release` remain mapped to equivalent owners. Build/packaged UI checks and host availability are recorded distinctly.

New workspace commands required by child 1: `pnpm --filter @cuepoint/web build`, `--filter @cuepoint/site build`, `--filter @cuepoint/desktop build:frontend`, and a root build that assembles the existing web/site deployment. Required by child 3: package build/type/test scripts and root `agent:example:check` for isolated local-package consumption plus process restart. Exact resulting command documentation is part of each child's acceptance.

## Final parent integration review

- [ ] Reconcile R1-R7 and AC1-AC6 against all three child verification conclusions and current source.
- [ ] Verify every declared app/library source participates in type/lint/architecture/unused/test discovery; add a deliberate forbidden dependency to the gate self-test and verify failure.
- [ ] Run the final root gates, complete shared real-store acceptance and relevant Rust/desktop/release-tool checks after the last structural change.
- [ ] Verify browser video/audio/music/library/settings/Agent workflows and isolated normal desktop startup/reopen, approvals and Stop. Record unavailable platform/manual checks as pending rather than inferring them from compilation.
- [ ] Verify the site dependency closure and combined Nginx deployment, app route refreshes, worker/assets and desktop exclusion of the site/fixture frontend.
- [ ] Verify Agent ESM/types in the isolated consumer and durable process restart without studio access. Review the core/provider import graph and opaque continuation/privacy boundaries.
- [ ] Verify no temporary root-src aliases, second Agent loop, storage fallback, duplicate schemas, regenerated historical snapshots or broad diagnostic baselines remain.
- [ ] Update architecture/readme/spec/package-discovery documentation with actual file/command locations.
- [ ] Record checks and material limits in authored Markdown; retain task contracts/manifests and discard raw logs/copies per retention policy.
- [ ] Complete child closure and parent final review through Trellis; do not publish/tag/push or run hosted delivery as part of this preparation request.

## Rollback points

Record one accepted source checkpoint per child. Within a child, app moves, vertical feature moves and Agent port integration are separate reviewable slices. A failing check blocks further moves until fixed or the owned slice is reverted without discarding others' work. Never reset user data or re-submit network actions to validate a code rollback.
