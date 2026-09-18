# Implementation Plan — 分镜效率 P1

1. Land `09-18-shot-dnd-reorder` (DnD + tests; arrows remain).
2. Land `09-18-shot-status-filter` (schema, UI, filters, package/CSV).
3. Land `09-18-shot-keyboard-bulk` (shortcuts + bulk fields).
4. Parent integration: film + series, design/media views, filter+drag+bulk together, undo, keyboard-in-input smoke.
5. Update `.trellis/spec/frontend/state-management.md` with status/filter contracts.
6. Final `pnpm test` / `pnpm lint` / `pnpm build` and archive children then parent.

## Validation

- Unit: normalize status, filter predicates, bulk replace characters, reorder via drag drop simulation if practical.
- Manual: drag beat and shot; filter combinations; shortcuts outside/inside inputs; bulk undo.
