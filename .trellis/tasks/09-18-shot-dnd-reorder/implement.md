# Implementation Plan — 分镜拖拽排序

1. Add `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`.
2. Wrap beat list and shot lists with sortable contexts in `ShotEditorPage`.
3. Wire drag-end to `reorderBeats` / `reorderShots` + undo.
4. Keep GripVertical as drag handle activator; preserve arrows.
5. Tests for ordered ID computation if extracted; manual drag smoke.
6. `pnpm test` / `pnpm lint` / `pnpm build`.
