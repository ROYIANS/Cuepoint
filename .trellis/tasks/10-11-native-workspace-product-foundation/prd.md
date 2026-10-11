# 原生工作区产品化与 SQLite 基础

## Goal

在真实产品代码中建立全新的 Tauri 原生工作区与 SQLite 数据基础；不迁移现有开发期 IndexedDB 数据，先实现当前产品所需的全新 schema、工作区文件所有权、桥接读写和重启恢复。

## Requirements

- The desktop build must load the real Cuepoint React application and its production route tree. The acceptance UI must no longer be a standalone fixture-only screen.
- Tauri mode must initialize a fresh, application-owned workspace under the native app data directory. The workspace contains a SQLite database and managed asset/output files.
- The first native product slice must own workspace identity, project summaries, asset records, relative file references, hashes and missing-file state. The schema may start fresh and does not import the developer's existing IndexedDB data.
- Project creation and asset import in the desktop slice must use a typed native bridge and write through one native workspace owner. Imported bytes are copied into the managed workspace before a record becomes ready.
- Reopening the packaged application must restore the same native workspace state. A missing managed file keeps its record and reference metadata while exposing an explicit missing state.
- Browser mode remains a separate runtime during this slice and keeps its current IndexedDB behavior. No automatic browser-to-native data transfer is required.
- The native boundary must reject unknown actions, extra fields, unsafe relative paths, stale generations and writes that would overwrite an existing managed file.
- The task must leave a clear extension point for later domain tables and provider plugins without adding a marketplace, arbitrary native code loading or a sync provider in this slice.

## Acceptance Criteria

- [ ] A normal Tauri build loads the real Cuepoint app shell and real project/assets routes from bundled assets without a development server.
- [ ] A fresh native workspace is created with SQLite state and managed directories; its identity and schema reopen successfully after application restart.
- [ ] The desktop project create flow persists a project summary and the desktop asset import flow copies bytes, records a stable asset ID/hash/relative path, and reports ready only after verification.
- [ ] Deleting the original source after import does not affect the managed copy; deleting the managed copy leaves the record and shows missing state.
- [ ] Native bridge tests cover envelope/action validation, path containment, generation checks, duplicate target rejection and idempotent reopen/close.
- [ ] Native and renderer tests cover project/asset round trips, hash equality, interrupted or canceled copy cleanup, and missing-file reporting.
- [ ] Root typecheck/lint/tests and desktop TypeScript/Rust quality gates pass with the explicit local pnpm and project Cargo wrapper.
- [ ] No code or test claims to migrate, preserve or read historical IndexedDB data; fresh fixtures are the only initial data source.

## Notes

- Keep `prd.md` focused on requirements, constraints, and acceptance criteria.
- Lightweight tasks can remain PRD-only.
- For complex tasks, add `design.md` for technical design and `implement.md` for execution planning before `task.py start`.
