# Implement — Media view row chrome parity

Primary: `src/components/shots/ShotEditorPage.tsx`; possibly compact props on `GenerationSlotCard.tsx` / tile.

1. Apply `max-h-[160px]` to media shot grid (same as design).
2. Wrap media cells (shot#, status, three slots, content) with `DESIGN_CELL_CHROME` (or shared rename `SHOT_CELL_CHROME`).
3. Left column: use the design control stack classes for media too.
4. Slot tiles: add a compact/media-row mode — e.g. `h-full max-h-[120px] w-full max-w-[200px]` centered in cell instead of fixed 124×220 forcing layout; keep `EditableGenerationSlot` API.
5. Media-view `PlainCell` for content: pass design chrome / capped center (already fixed not to force design chrome incorrectly — use explicit media center+cap).
6. `pnpm lint` && `pnpm test`.
