# Child 1 Review and Commit Plan

This is a proposed local work-commit batch, not evidence that a commit, child closure or publication has occurred. Baseline is `d0efb823`; branch is `codex/monorepo-app-boundaries`. Implementation approval was already granted. Workflow Phase 3.4 requires one confirmation of the concrete commit batch before execution.

The user confirmed this batch with “ok，我们提交checkpoint，然后开始下一阶段” on 2026-10-15. Execute the two local work commits below, then the authorized Trellis archive/journal closeout, before activating child 2. This confirmation does not authorize a remote push or release.

## 1. `refactor: 建立多应用 monorepo 边界`

Commit the coherent relocation and all checks/specs needed to validate it together:

- New `apps/` and `packages/` owners, plus removal of their former `desktop/`, `src/`, `public/`, `index.html`, `landing.html` and `components.json` locations.
- New `tooling/` and removal of old `scripts/`; all retained current and historical/reference harness ownership/path changes.
- Root `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `eslint.config.mjs`, `knip.json`, `tsconfig.app.json`, `tsconfig.node.json`, `vite.config.ts` and `vitest.config.ts`.
- `quality/` inventories/exact evidence, changed `tests/` integration/type-check/discovery seams and new boundary/assembly negative checks.
- `.dockerignore`, `Dockerfile`, `.github/workflows/desktop-release.yml`, `.github/workflows/ghcr.yml`, changed `docs/`, `README.md` and `README.en.md`.
- `.trellis/config.yaml` and `.trellis/spec/` package indexes, canonical source-anchor updates and executable monorepo/discovery/freshness contracts. Include these with the code because exact quality evidence binds current spec content.

Only dirty paths belonging to this slice are included; generated builds, caches, browser profiles and raw receipts remain ignored/outside the repository.

## 2. `docs(task): 记录 monorepo 拆分计划与第一阶段验收`

Commit these four new task directories, including their PRDs/designs/execution/context manifests and authored research/verification:

- `.trellis/tasks/10-15-monorepo-agent-extraction/`
- `.trellis/tasks/10-15-monorepo-app-boundaries/`
- `.trellis/tasks/10-15-studio-feature-organization/`
- `.trellis/tasks/10-15-reusable-agent-runtime/`

The parent and later children remain unfinished. Archive/journal bookkeeping is separate from this work batch. Source checkpoints and completed-task metadata can be finalized after the work commits exist.

## Other dirty work

Baseline ownership and final status inspection found no unrecognized dirty files. The pre-existing `10-12-desktop-release-pipeline` task has no changes in this batch and must remain untouched. Reinspect immediately before staging; any newly appearing foreign edit is excluded and reported.

No commit, amend, push, tag, dispatch or release is authorized by this document alone. Execute the proposed local commits only after the user's one-shot batch confirmation under workflow Phase 3.4.

## Execution record

User-authorized work commits completed: `bb3a9580` (source/specs) and `4a149e55` (task plans and verification). This task is archived under `archive/2026-10`; child 2 context manifests now resolve the archived verification. Archive/journal bookkeeping follows as separate local commits.
