# Implement — 分集工作流与分镜表

## Checklist

1. Domain：`Episode`、收缩 `Project.story`、扩展 `StoryBeat`、镜头 `episodeId` + `firstFrame`/`lastFrame`/`clip`、新默认列。
2. Dexie v3：`episodes` 表；`shots` 索引；upgrade 把现有项目合成第 1 集。
3. Repo：集 CRUD（禁删最后一集）、场次挂在集上、镜头按 `episodeId` 增删改；`collectMediaIds` / `deleteProject` 含集。
4. Zip：写读 `episodes.json`；旧包合成第 1 集；槽位 remap 含三个画面槽。
5. 系列壳 + `/p/$projectId` 集列表（整部戏一句话、新建集、打开集）。世界路由仍在系列壳下。
6. 集壳 + `/p/$projectId/e/$episodeId` 故事页：本集一句话、剧本拖入 txt/md、场次卡片（角色/场景/时段）。
7. 分镜页改挂当前集；表头换成首帧/尾帧/成片；默认列按 PRD；旧 `/shots` 重定向到第 1 集。
8. 制作占位跟集走。旧 `p.$projectId.shots` 等路由改完。

## Order

集数据与迁移 → zip → 系列列表 → 集内故事 → 分镜表。故事场次和分镜场是同一 `beats` 实体，不要做两套。

## Validation

```
pnpm run lint
pnpm run build
```

浏览器：

- 新项目 → 见第 1 集 → 再建第 2 集 → 只在第 2 集加镜头，第 1 集表仍空
- 世界在系列层，两集名册相同
- 拖 txt 进剧本
- 场次选角色后分镜同场可见
- 旧数据（升级前项目）打开落在第 1 集，画面在首帧
- 不能删除仅剩的一集

## Risky files

- `src/db/database.ts` — v3 upgrade 写错会丢镜头归属
- `src/lib/projectPackage.ts` — 旧 zip 槽位漏映射会丢图
- `src/components/workspace/WorkspaceChrome.tsx` — 系列/集两套顶栏
- `src/components/shots/ShotEditorPage.tsx` — 列和槽位

## Rollback

不要降 Dexie version。发现问题修 upgrade 或清站点数据。不要在未迁移完成时改 `Shot.frame` 读取路径。
