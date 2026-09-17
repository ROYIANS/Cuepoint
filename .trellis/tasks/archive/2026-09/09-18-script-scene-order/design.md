# Design — 剧本场次与排序工作流

## Data

Extend `StoryBeat` with optional `scriptRange: { start: number; end: number; excerpt: string }`. Offsets use JavaScript UTF-16 indices from the textarea selection API. `excerpt` validates that the range still points to the same text.

## Mutations

Repository operations accept complete ordered ID lists scoped to an owner:

- `reorderEpisodes(projectId, ids)`
- `reorderBeats(episodeId, ids)`
- `reorderShots(episodeId, ids)`
- `duplicateBeat(...)`
- `duplicateShot(...)`

Validate membership and uniqueness before transactional writes. Beat order is array position; shot/episode order is normalized to contiguous values.

## UI

Use accessible move up/down actions as the reliable baseline. Drag-and-drop may enhance them but cannot be the only input. Script selection exposes “从选中内容建场”.

## Undo

Capture pre-operation snapshots and register one restore action through the shared undo controller.
