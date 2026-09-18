# Implement — Shot row align and pickers

Primary: `src/components/shots/ShotEditorPage.tsx` (Popover from `@/components/ui/popover` if present).

1. **Characters cell** — Render only `characters.filter(c => shot.characterIds.includes(c.id))` as compact chips (Still + name). Empty: muted「未选择角色」. Whole cell (or “+” control) opens `Popover` with full list to toggle ids. Chip selected style: `bg-muted` / subtle border — **not** `ring-brand`.
2. **Scene cell** — Keep selected-only display; ensure unset copy is「未选择场景」or existing unset; picker lists options with Still. Align trigger to same `min-h` as text cells.
3. **Alignment** — Unify cell wrappers: e.g. `h-[124px] min-h-[124px] flex` + consistent padding; status column vertically centered in same height; duration input centered in cell.
4. **Highlight** — Keep `onFocusCapture`/`onMouseDown`; set active row `overflow-visible` / avoid clipping inset ring; verify odd striped rows (`bg-muted/40`) still show ring. If Popover focus steals activation, re-activate on open.
5. `pnpm lint` + `pnpm test`.
