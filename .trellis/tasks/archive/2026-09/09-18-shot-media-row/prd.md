# Media view row chrome parity

## Goal

素材（media）分镜表与设计视图共用同一套行高与单元格对齐：限高、内容居中、左侧按钮留白、行高亮可用。

## Confirmed facts

- Design view already uses `DESIGN_ROW_H` / `DESIGN_CELL_CHROME` (`min-h-[124px] max-h-[160px]`, center, `py-3`/`py-4`).
- Media branch in `ShotRow` still uses uncapped wrappers (`flex items-center py-3`) around `EditableGenerationSlot`.
- `GenerationSlotTile` (non-asset) is fixed `h-[124px] w-[220px]` and top-biased inside tall rows.
- Left control padding / hover insert Plus currently gated largely on design view.

## Requirements

- **R1** Media shot grid rows use the same max height band as design (`max-h-[160px]` on the row grid).
- **R2** Media cells (镜号、状态、首帧、尾帧、成片、内容) use the same center chrome (`items-center justify-center` + vertical padding) so slots and content don’t sit top-left in a tall empty cell.
- **R3** Frame/clip tiles scale to fit the capped cell (shrink within cell; keep usable hit target), centered.
- **R4** Left reorder column in media view matches design: centered stack, `py-4`, no duplicate order index, hover-only insert Plus.
- **R5** Row brand ring + focus activation keep working in media view.

## Out of scope

- Changing generation dialog / upload behavior
- Redesigning design-view columns again
- Bulk toolbar

## Decisions (locked)

| Topic | Choice |
| --- | --- |
| Height | Same constants as design (`124` / `160`) |
| Alignment | Center H+V like design |
| Slots | Fit inside cell; do not force row taller than max |

## Acceptance criteria

- [ ] Switching to 素材, rows are not dramatically taller than 设计 rows.
- [ ] First/last/clip tiles and 镜头内容 are centered in their cells.
- [ ] Left controls show top/bottom padding and don’t look glued to row borders.
- [ ] `pnpm lint` and `pnpm test` pass.
