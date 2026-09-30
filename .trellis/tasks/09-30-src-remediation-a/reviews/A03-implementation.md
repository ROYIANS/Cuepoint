# A03 implementation — PD-02

日期：2026-09-30。状态：实现与针对验证完成，待主会话独立 check。仅实施 A03；共享工作区已有 A01/A02、规范和任务元数据变化保留。本角色未实施 A04，未修改台账、规范、任务状态或执行计划，未提交、推送或派生其他角色。

## 文件与行为

- `src/db/repo.ts:1696`：仅新增 `DeletedShotsSnapshot` 类型并修改 `deleteEpisodeShots`。返回值为 `Promise<DeletedShotsSnapshot | undefined>`，含 `projectId` / `episodeId` / `shots` / `media`；空选择返回 undefined。原有 episode、video project、重复 ID、全部 target 的 project/episode 归属校验保留。
- `deleteEpisodeShots` 在原 `PRODUCTION_TABLES` 写事务中读取实际最新行，收集 firstFrame / lastFrame / clip 的全部 referenceImageIds、referenceVideoIds 和 result mediaId，去重后读取完整 MediaRecord（含 Blob），然后调用共享该事务的既有 `deleteShots`。删除、重排、touchProject 和 orphan cleanup 成功提交后才能向调用方返回快照；无额外预取读事务。
- `src/components/shots/ShotEditorPage.tsx:590`：仅替换 `removeSelectedShots` 并移除已无其他消费的 `slotMediaIds` import。直接传 `[...selected]`；await 返回的 snapshot 非空时才注册 undo，恢复调用 `restoreShots(snapshot.shots, snapshot.media)`。删除数量来自实际 snapshot，成功注册后清除 selection。已无渲染行快照或异步 media 预取。
- `tests/shotDeleteUndo.test.ts`：新增 16 个真实 repository / Dexie / fake-indexeddb 数据库回归。
- 本报告记录实现与验证。

`deleteShots`、`restoreShots` 及 A02 的 bulk patch/undo 协议均未修改。既有忽略返回值的 Agent 调用仍兼容；lint 同时验证该调用。恢复原有 owner、已存在 ID、关系检查和排序契约不变。

## Test-first red 证据

先写完整新测试文件，再执行，之后才修改产品源码：

```text
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm test -- tests/shotDeleteUndo.test.ts
exit 1
Test Files 1 failed | 126 passed (127)
Tests 9 failed | 1623 passed (1632)
Duration 11.19s
```

该命令的 `--` 分隔未让 Vitest 只筛选目标文件，实际执行了全部 suite；后续改用 `pnpm exec vitest run <files>` 明确筛选。新文件 16 个测试中 9 failed / 7 passed；失败均为旧实现没有返回快照，核心断言收到 undefined。现有 126 个测试文件在该 red run 中通过。不是修改源码后补写 red 记录。

## 回归证据

- 先读取 stale rendered row，再提交新 content / notes 和三个槽的新 prompt / reference / result；删除快照等于最新 committed row，不含旧结果；删除后的孤儿媒体全部回收，undo 恢复最新行与全部五个必要媒体 Blob 内容、owner、MIME 和文件名。
- 使用 Dexie reading / deleting hooks 记录事务根对象，证明媒体快照读与实际 shot 删除使用同一个 readwrite 事务，覆盖全部 `PRODUCTION_TABLES`，而非先行读事务。
- 两镜头共享媒体：删一个时快照仍包含该媒体，存储继续保留剩余引用；恢复后删除全部引用，快照去重、媒体回收，undo 恢复媒体与两行引用。
- 非顺序选择第 4 / 第 2 行，删除后存活行连续重排，undo 恢复全部五行及原顺序。
- 空选择（包括不存在 episode）返回 undefined，数据库不变；missing shot / foreign episode / foreign project / wrong owner / duplicate / missing episode 均拒绝，全部行、媒体、项目和集无部分修改。
- 注入第二次 shot delete、reindex write、project touch、media cleanup 四类故障：Promise reject、不返回成功 snapshot，删除/排序/项目/媒体全部回滚；移除故障后可正常返回快照。
- 使用已删除 ID 新建另一行后 undo：保留 `镜头已存在` 拒绝，媒体恢复也回滚，最新占用该 ID 的行不被覆盖。

## 最终验证

```text
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm exec vitest run tests/shotDeleteUndo.test.ts
exit 0
Test Files 1 passed (1)
Tests 16 passed (16)
Duration 345ms

/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm exec vitest run tests/shotDeleteUndo.test.ts tests/repo.test.ts tests/repoReliability.test.ts tests/undo.test.ts tests/shotBulkUndo.test.ts
exit 0
Test Files 5 passed (5)
Tests 91 passed (91)
Duration 632ms

/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm lint
exit 0
> tsc -b --pretty false

git diff --check
exit 0

git diff --no-index --check /dev/null tests/shotDeleteUndo.test.ts
git diff --no-index --check /dev/null .trellis/tasks/09-30-src-remediation-a/reviews/A03-implementation.md
两项 exit 1（--no-index 新文件差异状态）；均无 whitespace 诊断。
```

## 交接与限度

UI callback 按源码核验：只传选择 ID；await deletion 后检查返回 snapshot；仅非空成功结果注册 undo；restore 使用原 transaction snapshot。未挂载浏览器或做 UI 自动化。数据库回归执行实际事务与故障回滚，不是 mock repository。

最终 green 验证为上述五个针对文件及 TypeScript；未在修复后执行全 suite/build，留给主会话 A 批集成。原生 implement 角色不派生 check，由主会话独立验证本单元后更新台账。依赖未安装或更换；所有 pnpm 调用使用用户指定本机绝对路径。
