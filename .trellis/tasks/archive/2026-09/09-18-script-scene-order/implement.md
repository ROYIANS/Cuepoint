# Implementation Plan — 剧本场次与排序工作流

1. Add and normalize `StoryBeat.scriptRange`.
2. Add validated transactional reorder APIs for episodes, beats, and shots.
3. Add duplicate beat/shot APIs with independent IDs and media references retained.
4. Add selection-to-beat UI and invalidate stale text ranges safely.
5. Add accessible move/copy actions to episode, beat, and shot interfaces.
6. Register undo snapshots for destructive and reorder operations.
7. Test invalid ownership, duplicate IDs, stable ordering, range invalidation, and undo.
8. Run test, lint, build, and manual workflow checks.
