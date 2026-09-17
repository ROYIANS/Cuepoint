# Design — 爱分镜核心管理

## Architecture

单页静态应用。UI 读写 Dexie/IndexedDB。导入导出是唯一跨会话/跨机器边界。

```
src/
  routes/           TanStack file routes
  db/               Dexie schema + media blobs
  domain/           types, column defs, package version
  lib/              import/export, ids
  components/       projects / workspace / assets / shots
```

不引入组件库。视觉跟用户截图：白底、浅灰表头、金黄「新建」、大图单元格、虚线参考空态。

## Data model

IndexedDB (`aifenjing`, v1) tables:

- `projects` — id, name, timestamps, `columnSettings.visible[]`, `shotSettings`
- `characters` — projectId, name, bio, appearance, notes, `images` slot map
- `scenes` — projectId, name, location, timeOfDay, atmosphere, notes, `images` slot map
- `shots` — projectId, order, shotNumber, frame/reference media ids, text columns, durationSec, characterIds[], sceneId?
- `media` — id, projectId, mimeType, filename, blob

Unknown import fields live on records as `extra: Record<string, unknown>` so round-trip does not drop future skill keys (`prompt`, `generationMeta`, …).

## Project package `aifenjing-project-v1`

Zip layout:

- `manifest.json` — `{ format: "aifenjing-project-v1", exportedAt }`
- `project.json`
- `characters.json` / `scenes.json` / `shots.json`
- `media/<id>.<ext>`

Import: Zod parses known fields; extra keys go to `extra`. Media files become blobs. New project id is generated on import so it never collides with an existing local id; internal media/asset/shot ids are remapped consistently.

## Routing

| Path | Page |
|------|------|
| `/` | 项目列表 |
| `/p/$projectId/` | 分镜制作（默认） |
| `/p/$projectId/assets` | 资产库列表 |
| `/p/$projectId/assets/characters/$id` | 角色详情 |
| `/p/$projectId/assets/scenes/$id` | 场景详情 |
| `/p/$projectId/storyboard` | 占位 |
| `/p/$projectId/plan` | 占位 |
| `/p/$projectId/report` | 占位 |

资产入口在工作区工具区（例如「资产」按钮），不进入顶部分步 Tab。

## Generation slots

Any image/video cell is a `GenerationSlot`:

- `prompt`
- `referenceImageIds[]`
- `referenceVideoIds[]`
- `result?: { mediaId, kind: image|video }` — the thumbnail only

Shots store `frame` and `reference` as slots. Characters/scenes store named `slots`.


Always visible: `order`, `shotNumber`, `frame`, `reference`.

Togglable (default on: 类别/时长/内容/备注/场景特写): `category`, `durationSec`, `content`, `notes`, `sceneCloseup`, `sound`, `emotion`, `cameraAngle`, `cameraGear`, `focalLength`.

## Compatibility / rollout

Greenfield. No migration. IndexedDB version bump later if schema changes.

## Trade-offs

- IndexedDB + zip 而不是 File System Access：符合「部署后每人浏览器本地运行 + 导入导出」；代价是单浏览器配额。
- 导入重新生成项目 id：避免覆盖用户现有项目；用户用导出做备份即可。
- 故事板不做第二模型：避免双写。

## Rollback

静态应用，清站点数据或删除 `dist/` 即可。导入失败必须整包拒绝，不得半写入。
