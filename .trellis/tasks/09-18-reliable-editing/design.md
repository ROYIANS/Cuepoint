# Design — 编辑可靠性与测试基线

## Persistence

Create a reusable debounced draft hook with `saved | saving | error`, revision tracking, `flush()`, retry, and unmount/visibility flush. Persist field patches rather than stale aggregate objects where editors share a record.

`StoryPage` owns local title/logline/script drafts. Beat CRUD remains repository-first and is merged into the latest stored episode. Shot editor uses the same beat patch API.

## Undo

Provide a small in-memory undo controller/context. An action contains a label, expiry, and async restore callback. It supports one latest destructive/reorder operation and clears after execution/expiry.

## Tests

Use Vitest with fake-indexeddb. Reset Dexie between tests. Cover owner/episode validation, package atomicity and round-trip, and draft utility behavior.

## Failure Behavior

Save errors remain visible; drafts stay editable and retry uses the latest revision. Unmount performs best-effort persistence without claiming success after the component is gone.
