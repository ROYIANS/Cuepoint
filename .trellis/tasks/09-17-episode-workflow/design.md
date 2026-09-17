# Design — 分集工作流与分镜表

## Architecture

集是一等实体。系列（项目）拥有世界和集列表；集拥有故事和镜头。UI 分两层壳，不把世界塞进集内顶栏。

```
Project (一部戏)
  setting + seriesLogline + 名册
  episodes[]
    Episode
      story (logline, script, beats)
      shots[]  (episodeId)
```

## Routing

| Path | Shell | Page |
| --- | --- | --- |
| `/p/$projectId` | 系列：集 / 世界 | 集列表 + 整部戏一句话 |
| `/p/$projectId/world` | 系列 | 世界（现有设定+名册） |
| `/p/$projectId/e/$episodeId` | 集：故事 / 分镜 / 制作 | 本集故事 |
| `/p/$projectId/e/$episodeId/shots` | 集 | 本集分镜 |
| `/p/$projectId/e/$episodeId/produce` | 集 | 制作占位 |

旧书签 `/p/$projectId/shots` → 第 1 集 `/e/$id/shots`。

系列壳：返回工作室、项目名、**集 / 世界**、导出。  
集壳：返回集列表、`第N集`+标题、**故事 / 分镜 / 制作**、导出。

## Data

Dexie v3 增 `episodes`: `id, projectId, order, updatedAt`。`shots` 索引加 `episodeId`。

```ts
interface Episode {
  id: Id;
  projectId: Id;
  order: number;          // 0-based → 「第N集」
  title: string;          // 默认可空，显示「第N集」
  story: {
    logline: string;
    script: string;
    beats: StoryBeat[];
  };
  createdAt: string;
  updatedAt: string;
}

interface StoryBeat {
  id: Id;
  title: string;
  content: string;
  characterIds: Id[];
  sceneId?: Id;
  timeOfDay: string;
}

interface Shot {
  // existing text columns stay
  episodeId: Id;
  firstFrame: GenerationSlot; // was frame
  lastFrame: GenerationSlot;
  clip: GenerationSlot;       // 成片，结果偏向 video
  beatId?: Id;
}
```

`Project.story` 收缩为系列一句话：`{ logline: string }`。剧本和场次只活在 `Episode.story`。`touchProject` 仍在改集/镜头时更新项目 `updatedAt`。

新建项目：`emptyProject` + `addEpisode` 第 1 集同一事务。最后一集禁止删除。

## Shot columns

Fixed (always on, not in `columnSettings`): `order`, `shotNumber`, `firstFrame`, `lastFrame`, `clip`.

Default visible: `durationSec`, `content`, `characters`, `scene`, `notes`.

Optional: `category`, `sound`, `emotion`, `cameraAngle`, `cameraGear`, `focalLength`, `sceneCloseup`.

`GenerationSlot` 不变。首帧/尾帧/成片点进同一套提示词+参考；成片空态按视频槽提示，仍可先挂图。

## Zip

保持 `format: aifenjing-project-v1`。新包多 `episodes.json`；`shots.json` 含 `episodeId`、`firstFrame`/`lastFrame`/`clip`。

无 `episodes.json` 的旧包：建第 1 集，把 `project.story.script/beats` 和全部 shots 迁进去；`frame` → `firstFrame`；`reference.referenceImageIds` 并入 `firstFrame`（若 `frame` 已有参考则追加，不覆盖 result）。

## IndexedDB migration

v3 upgrade：已有项目若无 episode，插入第 1 集，把 `project.story` 的 script/beats 拷过去，shots 写上 `episodeId`，`frame` 拷到 `firstFrame`。在 Dexie `upgrade` 里做，打开即迁移，不靠用户点按钮。

## Trade-offs

- 两层壳而不是四步顶栏加集下拉：集是地点，不是过滤器。代价是多一层返回。
- 不升 package format 字符串：旧 zip 仍能进；新字段靠缺省合成第 1 集。
- 场次选人/地只用本戏名册，不引用工作室库（避免和未做的 reference-join 缠在一起）。

## Rollback

Dexie v3 一旦跑过，旧代码读不到 `episodeId`。回滚代码前需清站点数据或保留正向兼容读取。Zip 仍可用旧解析合成第 1 集。
