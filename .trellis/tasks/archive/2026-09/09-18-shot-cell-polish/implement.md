# Implement — Shot grid cell polish

Primary file: `src/components/shots/ShotEditorPage.tsx` (+ `Still` reuse).

## Already done (keep)

- Flush `PlainCell`, `columnPlaceholder`, duration `Input`, flush scene/status, empty characters hint.

## Remaining

1. **Row activate (R7)**  
   On shot row root: keep `onMouseDown={onActivate}`; add `onFocusCapture={onActivate}` so focusing inputs/selects activates the row.

2. **Cover helper**  
   `coverMediaId(slots, preferredKeys: string[])` → first `slots[key].result?.mediaId`.

3. **Characters (R8)**  
   Replace plain checkbox rows with a scrollable grid of compact tiles: `Still` (~40–48px) + truncated name; selected = ring/brand or checked affordance; click toggles id in `characterIds`. Empty list keeps「先在世界里添加角色」.

4. **Scene (R9)**  
   Flush trigger content: selected scene Still + name (or「未选择」). `SelectItem`s: Still + name. Keep `sceneId` patch behavior.

5. Optionally widen `characters` / `scene` column widths slightly in `src/domain/columns.ts` if tiles feel cramped.

6. `pnpm lint` (+ `pnpm test`).
