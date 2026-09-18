# Shot grid cell polish

## Problem

In the design-view shot table, editors look like inset cards inside each cell (extra padding, bordered selects, dark input wash). Most text cells share the generic placeholder「插入内容」, so empty cells give weak guidance. Clicking inside some rows (especially on inputs) does not activate the brand ring highlight. Character/scene pickers are text-only and hard to scan.

## Goals

- Controls visually fill the cell (edge-to-edge content area; no nested “card”).
- Empty / unset fields show **column-specific** placeholder hints.
- Clicking or focusing anywhere in a shot row activates that row’s highlight.
- Character and scene cells are **visual** (thumbnail + name), not text-only lists.
- Keep existing save behavior (`patchShot` on change); no new persistence.

## Non-goals

- Autocomplete / typeahead from project history (follow-up if needed).
- Redesigning media-view frame/clip slots.
- Changing bulk toolbar selects (may stay text).
- New global design-system primitives beyond local shot-grid helpers.

## Requirements

- **R1** Text cells (`PlainCell` / design columns): flush to cell — no visible inner border or `dark:bg-input/*` wash; full width/height of the cell content area; light padding only for readable text.
- **R2** `durationSec` uses a single-line numeric-friendly control that is flush like other cells (not a multi-line textarea look).
- **R3** Scene control is flush to the cell (no outer card framing; borderless / transparent chrome like status).
- **R4** Status select: clear `dark:bg-*` wash so it matches text cells.
- **R5** Placeholders are per column, e.g. 内容→「镜头内容」; 时长→「秒」; 备注→「备注」; optional columns use their labels; scene keeps「未选择」; characters empty state shows a short hint when the project has no characters.
- **R6** Media-view content `PlainCell` gets the same flush + content placeholder treatment.
- **R7** Row highlight (`activeShotId` brand ring): activating a row works when the user presses or focuses any interactive control inside the row (inputs, textareas, selects, checkboxes), not only empty chrome. Prefer `onMouseDown` + `onFocusCapture` (or equivalent) on the row.
- **R8** Characters cell: each project character shown as a compact visual chip/tile (cover from `slots.front` result when present, else Still fallback) + name; selected state clearly visible; toggle still writes `characterIds`.
- **R9** Scene cell: trigger and dropdown items show scene cover (`slots.wide` when present) + name; unset remains「未选择」.

## Decisions (locked)

| Topic | Choice |
| --- | --- |
| Hint style | Placeholder / empty-state copy only (no autocomplete) |
| Scope | Design-view grid cells + media-view content cell; not bulk bar |
| Duration UI | Single-line flush input |
| Row activate | Mouse down + focus capture inside row |
| Asset cover | Character `front`, scene `wide`; Still fallback by name |

## Acceptance criteria

- [ ] Empty design-view text/number cells show column-specific placeholders, not「插入内容」.
- [ ] Scene and status triggers do not read as a bordered box floating inside the cell.
- [ ] Text/duration controls have no visible nested border or input wash against the row background.
- [ ] Clicking into 内容/时长/备注 (or other cell controls) on any row shows that row’s brand ring.
- [ ] Characters and scenes are identifiable by thumbnail (or Still letter fallback), not name-only.
- [ ] Existing shot edits still persist; `pnpm lint` and `pnpm test` pass.
