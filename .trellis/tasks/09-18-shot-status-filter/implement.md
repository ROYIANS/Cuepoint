# Implementation Plan — 镜头状态与筛选

1. Add `ShotStatus`, normalize, emptyShot default, package parse.
2. Row status control in both views.
3. Toolbar filters + empty state; persist via `updateShotSettings`.
4. Wire CSV/print delivery status column.
5. Unit tests for normalize and filter predicates.
6. `pnpm test` / `pnpm lint` / `pnpm build`.
