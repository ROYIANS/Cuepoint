# Design — 分镜工作区重构

## View Model

Add a project-level `shotSettings.workspaceView: "design" | "media"` preference with backward-compatible default `design`.

Both views consume the same episode shots and beat grouping:

- Design grid: order, shot number, content-first configurable columns.
- Media grid: order, shot number, first frame, last frame, clip, compact context.

## Components

Split the current monolithic editor into shared toolbar/group/row helpers and view-specific cells. Keep `GenerationSlot` and `Shot` unchanged.

## Bulk Actions

Selection is shared across views. P0 actions: delete, assign beat, set duration. Operations validate all selected shots belong to the current episode.

## Accessibility

View switching and move actions are keyboard reachable. Horizontal scrolling remains acceptable in media view; design view must fit common desktop widths more effectively.
