# Child 2 Review and Commit Plan

This is a proposed local work-commit batch. It does not record a commit, completed task or authorization to begin child 3. The user authorized the preceding child-1 checkpoint and this implementation; workflow Phase 3.4 requires one confirmation of this concrete child-2 batch before execution.

The user confirmed this exact two-commit batch and continuing to child 3 with
“ok 继续” on 2026-10-15. Execute the local work commits below, followed by the
authorized child-2 archive/journal closeout and child-3 activation. This does not
authorize a remote push, publication or release. Final pre-staging inspection
found 1612 frozen inputs unchanged and no unrecognized dirty paths.

The first full staged whitespace check additionally covered previously
untracked destinations and found six formatting-only defects. The assigned
writer removed trailing/EOF whitespace; independent AST and emitted-output
comparison confirms no token, body or assertion changes. The main session
added the staged/untracked check rule to the feature contract. This is within
the same approved batch; affected quality/native receipts are refreshed before
committing, and final `git diff --cached --check` passes after restaging.
Child-3 extraction research prepared during this wait is outside these two
child-2 work commits and stays with the subsequent task.

Current branch is `codex/studio-feature-organization`, based on the clean child-1 closeout `03b8625f`. The accepted predecessor source checkpoint is `bb3a9580`. Final acceptance is recorded separately in `../verification.md` and the independent review; this plan cannot substitute for unfinished verification.

## 1. `refactor: 按业务功能组织 Studio 代码`

Commit the complete source move and the checks/specs required to validate it together:

- `packages/studio/`: replace the former bootstrap/components/domain/db/lib/hooks/routes layout with `src/app`, nine named `src/features` owners, `src/platform` and `src/ui`; include focused feature tests, package exports and component generation configuration.
- `apps/desktop/`: update fixture provenance/current source owner hashes, contract and fixture producers, native regression consumers, the Rust schema include, TypeScript declaration inputs and acceptance-print imports. Immutable portable contract corpus and release policy are unchanged.
- `apps/web/`: update route generation and the canonical environment declaration input. `apps/site/`: update source-evidence references, the stylesheet source comment and its own canonical environment declaration input.
- `tests/`: update actual source owners and retain integration/immutable comparator seams. Focused tests move beside their feature; new supplied-store, subscription and late-failure transaction coverage is included with its actual implementation. Immutable source snapshots are unchanged.
- `tooling/`: update current source discovery and historical-body delivery, add the production feature architecture gate and real CLI negatives, preserve scoped immutable-only snapshot resolution, and verify emitted feature CSS after the relative stylesheet move.
- Root `package.json`, `eslint.config.mjs`, `knip.json`, `vitest.config.ts`, `quality/studio-ownership.json`, `quality/debt.json` and `quality/unused-contracts.json`. Exact diagnostic/source owner evidence changes belonging to the relocation are included without broad allowances or package upgrades.
- All changed `.trellis/spec/` canonical source/owner contracts, plus new `frontend/feature-organization.md`. These land with the implementation because quality evidence binds current canonical spec content.

Only dirty paths owned by this implementation are included. Builds, profiles, generated evidence and raw logs remain ignored or outside the repository. Old source paths must be staged as deletions along with their new owners.

## 2. `docs(task): 记录 Studio 重组与验收`

- `.trellis/tasks/10-15-studio-feature-organization/`: current PRD/design/execution, context manifests, source owner map, Audio pilot, normal browser acceptance, independent review, authored final verification and this commit plan.
- `.trellis/tasks/10-15-monorepo-agent-extraction/implement.md`: preceding checkpoint identifiers and current child-2 progress. Parent integration and child 3 remain unfinished.

Archive and journal bookkeeping follow separately after approved work commits exist. Child 3 is activated only after the child-2 checkpoint is accepted and continuing is authorized.

## Other dirty work

The implementation started from the clean committed child-1 closeout. Current inspection found no unrecognized dirty paths. The existing `10-12-desktop-release-pipeline` task remains unchanged and is excluded. Reinspect immediately before staging and report any newly appearing foreign edit separately.

No commit, amend, remote push, tag, hosted dispatch or release is authorized by this document alone. Present this coherent two-commit batch once after final verification and execute it only on the user's confirmation under workflow Phase 3.4.

## Execution record

Approved source/spec work commit completed: `6a2927f0`. Final post-format
quality and complete one-worker native ALL receipts match these source bytes.
Task-document work commit is `7ddeed11`. This task is archived under
`archive/2026-10`; journal closeout follows. Child 3 continuation was authorized
by the same user confirmation.
