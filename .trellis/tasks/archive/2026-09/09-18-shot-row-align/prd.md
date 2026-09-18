# Shot row align and pickers

## Goal

Make design-view shot rows feel aligned; row brand highlight always follows focus; character/scene cells show **only selected** assets, with a picker to change them.

## Confirmed facts

- Character cell currently maps **all** project characters as selectable tiles (selected get `ring-brand`), which crowds the grid and competes with row highlight.
- Scene uses a flush Select; trigger already shows selected/unset, but character UX should match “selected only + open to pick”.
- Row root already has `onMouseDown` + `onFocusCapture` → `onActivate`; odd-row highlight failures likely come from child rings/z-index/overflow clipping or controls not receiving focus activation reliably.
- Grid uses `items-stretch` with mixed control heights (`h-8` status vs `min-h-[124px]` text).

## Requirements

- **R1 Alignment**: Content cells must **fill the full row height** driven by the tallest column (today: left reorder controls). Do not lock content cells to a shorter fixed height that leaves empty bands under status/content. Prefer `h-full min-h-*` stretch, and/or compact the left control stack so rows are not excessively tall.
- **R2 Row highlight**: Brand highlight must remain visible when any cell control is focused. Do **not** put `ring-inset` only on an outer wrapper whose child grid paints opaque backgrounds over the ring. Apply the active ring/outline on the same surface that has the row background (the grid), or use a non-covered outline.
- **R3 Characters**: Selected-only; **thumbnail-first** (large Still, name secondary/tooltip). Empty hint. Popover to toggle full roster. No `ring-brand` on chips.
- **R4 Scene**: Selected-only; **thumbnail-first** in the trigger; picker for options. Unset hint.

## Out of scope

- Bulk toolbar redesign
- Media-view slot layout
- Autocomplete for text columns
- Changing persistence shape of `characterIds` / `sceneId`

## Decisions (locked)

| Topic | Choice |
| --- | --- |
| Character UX | Selected chips in cell + Popover checklist/tiles to edit |
| Scene UX | Selected-only trigger + dropdown/popover of options |
| Selected chip chrome | Neutral/muted selected style — not `ring-brand` (reserved for active row) |
| Highlight fix | Ensure focus activation + row ring not clipped; remove competing brand rings on chips |
| Cell align | Center H+V with py breathing room; design row `max-h-[160px]` |
| Left controls | Vertical stack, vertically centered in capped row |

## Acceptance criteria

- [ ] Empty character/scene cells do not list the full roster; they show unset copy or only current selection.
- [ ] Opening the character picker can add/remove; closing leaves only selected chips visible.
- [ ] Focusing 内容/时长/备注 (etc.) on odd and even rows both shows the row brand ring.
- [ ] Columns look level across a row (no crooked mid-cell stacks).
- [ ] Design-view cells share one alignment rule: top + start (no mix of center/top/left per column).
- [ ] Left reorder controls are a single readable column (not a cramped 2×2 lump).
- [ ] `pnpm lint` and `pnpm test` pass.

## Follow-up (alignment polish)

- **R5 Unified cell alignment**: Every design-view data cell uses the same vertical/horizontal rule — **top + start** with shared padding (`px-2 py-2`). Status, duration, text, character, and scene must not mix `items-center` / `justify-center` with top-aligned textareas.
- **R6 Left controls**: Replace the cramped 2×2 icon grid with a **single vertical stack** (上移 → 拖拽 → 下移 → 复制), comfortable gap, top-aligned with the row; order index under or beside without fighting the stack.
