# Design — 创作工作流 P0

## Architecture

保留本地 SPA + Dexie 架构。父任务不直接改代码；六个子任务按依赖落地，共享 `domain → repo → UI → package/export` 数据链路。

```text
Project(mode, world)
  └─ Episode(story, ordered beats)
       └─ Shot(order, beatId, generation slots)

Studio asset --copy snapshot--> Project asset
Episode + Shots --> CSV / print storyboard
Project graph --> backup zip
```

## Boundaries

- Durable records remain in IndexedDB; no global record store.
- `Project.mode` controls navigation only; film still owns one episode.
- Undo is short-lived UI recovery for destructive/reorder operations, not a persistent event log.
- Project assets are copies, never live joins to studio rows.
- CSV/print are delivery outputs; ZIP is the lossless backup contract.

## Compatibility

Optional fields are normalized on read. Existing projects without `mode` resolve to `series`; old packages remain accepted. Package additions stay optional under `aifenjing-project-v1`.

## Rollback

Each child task is independently committed and can be reverted without reverting later task data. Schema additions must remain forward-readable; destructive migrations are prohibited.
