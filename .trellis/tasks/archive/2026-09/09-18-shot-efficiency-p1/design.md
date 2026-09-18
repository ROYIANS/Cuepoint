# Design — 分镜效率 P1

## Architecture

Extend the existing shot workspace. No second shot model. Cross-cutting pieces:

```text
Shot.status (manual enum)
Project.shotSettings.filters (UI preference)
reorderBeats / reorderShots (existing repo APIs)
@dnd-kit pointer + keyboard sensors (new dependency)
UndoController (existing short-lived undo)
```

## Data

```ts
type ShotStatus = "draft" | "ready" | "framed" | "clipped" | "approved";

interface Shot {
  // ...existing
  status: ShotStatus; // default "draft"
}

interface ShotSettings {
  // ...existing
  filters?: {
    status?: ShotStatus | "all";
    beatId?: Id | "all" | "none";
    gap?: "none" | "missingFirstFrame" | "missingClip";
  };
}
```

Normalize missing `status` → `draft`. Filters default to show all. Package v1 keeps optional fields.

## Child boundaries

| Child | Owns | Must not |
| --- | --- | --- |
| dnd-reorder | DnD UI, beat/shot drag handles, reuse reorder APIs | Change status schema |
| status-filter | status field, per-row control, toolbar filters, CSV status column | Invent auto status |
| keyboard-bulk | shortcut map, bulk character/scene/notes/status | Replace drag reorder |

## DnD

Use `@dnd-kit/core` + `@dnd-kit/sortable`. Pointer for mouse; KeyboardSensor for a11y. Keep existing ArrowUp/ArrowDown. Dragging a beat moves its shot group as one unit (already true for reorderBeats). Shot drag stays within visible beat group unless dropped onto another beat header (optional stretch — MVP: within-list reorder only; cross-beat via bulk assign).

## Keyboard (MVP)

When focus is not in an editable field:

- `j` / `k` or arrows: move selection highlight
- `x` / `Space`: toggle select
- `Cmd/Ctrl+A`: select visible
- `n`: new shot in current beat/context
- `Backspace`: delete selected (confirm)
- `Alt+↑/↓`: move selected shot(s)

## Bulk edit

Panel extends current toolbar: status, characters (checkbox set → replace), scene (select), notes (text), existing beat/duration/delete. One undo snapshot per bulk action.

## Compatibility

No Dexie version bump required (JSON fields on existing tables). Old ZIPs without status import as draft.
