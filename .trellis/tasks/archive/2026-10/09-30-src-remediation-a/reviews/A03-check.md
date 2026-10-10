# A03 independent check — PD-02

日期：2026-09-30。结论：**PASS**，本次限定检查未发现阻断项，无需机械修正。

范围仅 A03；原生 trellis-check 角色直接执行，未派生角色。读取 check.jsonl 中与本单元相关的 type-safety、quality-guidelines、state-management 以及 persistence-domain 的 PD-02，随后对照 prd/design/implement、reviews/A03-implementation.md 和实际源码/测试。未将实现报告的验证视作本角色独立执行结果。

## 核验结果

- `src/db/repo.ts:1703`：deleteEpisodeShots 返回原 PRODUCTION_TABLES 写事务的 Promise。事务先检查 episode、video project、重复 ID，bulkGet 最新 selected rows；全部 target 的 episode/project 归属校验完成后，才读取媒体和执行删除。空选择返回 undefined；缺失或越界目标拒绝，无部分删除。
- 三个 SHOT_PICTURE_FIELDS 经既有 slotMediaIds 收集 referenceImageIds、referenceVideoIds、result.mediaId；去重后 bulkGet 完整 MediaRecord（含 Blob）。snapshot 的 shots 保留 selection 顺序及实际删除前内容，media 包含仍被其他镜头引用的记录；不存在的媒体按既有快照模式过滤。
- `src/db/repo.ts:1672`：嵌套 deleteShots 使用相同写事务表集合，shot 删除、reindexShots、touchProject 和 deleteMediaIfOrphan 均处于外层事务之内。外层 Promise 只在提交成功后交付 snapshot。测试的 reading/deleting hooks 比较根事务身份及 readwrite/storeNames，证实媒体读取和删除共享事务；四种存储故障均使 Promise reject 且数据库回滚。
- `src/components/shots/ShotEditorPage.tsx:590`：实际 removeSelectedShots 只传 [...selected]，await deletion 后检查 snapshot.shots.length，成功非空才 registerUndo；恢复严格调用 restoreShots(snapshot.shots, snapshot.media)。旧渲染行及 UI 异步媒体预取已经移除；删除失败或空选择不能走到注册动作，selection 在成功注册后清除。
- `restoreShots`、deleteShots、全局引用回收及 slotMediaIds 未被 A03 修改。既有恢复的父项目/集归属、资产/场次关系、已存在 ID 拒绝、按 captured order 恢复及事务回滚路径保持。新测试直接验证乱序选择后的原排序，以及 ID 被重新占用时媒体恢复也回滚。Blob 内容、owner、MIME 和 filename 的恢复由实际 DB 断言覆盖。未把本次检查表述为新增所有媒体或 legacy 校验。
- A02 的 patchEpisodeShots/undoEpisodeShotBulkPatch、applyBulkPatch 和 UndoController 保持已有实现；对应 focused tests 覆盖八字段逆补丁、后续同字段冲突整组拒绝、独立编辑保留、写入回滚、失败保留/重试、过期及动作替换。本次未发现 A03 对这些契约的回归。

## 独立执行证据

仅执行一次指定的五文件测试：

```sh
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm exec vitest run tests/shotDeleteUndo.test.ts tests/repo.test.ts tests/repoReliability.test.ts tests/undo.test.ts tests/shotBulkUndo.test.ts
```

退出状态 0；原始核心输出：

```text
RUN v5.0.1 /Users/xiaomengdao/WebstormProjects/aifenjing
Test Files 5 passed (5)
Tests 91 passed (91)
Start at 11:56:51
Duration 546ms (tests 44%, transform 34%, setup 17%, import 4%, worker 1%)
```

新 shotDeleteUndo 文件的 16 个用例覆盖旧视图之后已提交的新文字/三槽/五个 Blob、同事务身份、共享媒体/去重、排序、空选择、六类非法目标、四类故障回滚及恢复 ID 冲突；其余四文件提供既有 repo、可靠性、UndoController 和 A02 回归。运行实际 repository/Dexie，tests/setup.ts 每个用例删除并重新打开隔离 fake-indexeddb。

另执行 `git diff --check`，退出状态 0，无诊断。

## 限度与文件变更

UI 按实际 callback 源码核验，未挂载 React 或启动浏览器；没有额外 mutation harness、全 suite 或 build。因无修正，遵照请求未运行 lint/typecheck；实现报告记录的 lint 成功仅属交接证据，不宣称本角色重跑。未独立重跑 legacy 全矩阵，相关解析/删除/恢复 helpers 没有本单元变更。

本角色仅新增 `.trellis/tasks/09-30-src-remediation-a/reviews/A03-check.md`。产品源码与测试未修正；共享工作区已有更改均保留。未修改台账、规范、任务状态、执行计划，未提交或推送。PASS 限于 A03 的上述检查范围，A04 与 A 批集成检查仍由主会话安排。
