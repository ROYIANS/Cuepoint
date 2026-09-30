# A02 implementation — PU-01 / SS-05

日期：2026-09-30。状态：实现与本角色针对验证完成，待主会话独立 check。仅实施 A02；未开展 A03/A04，未更新台账/规范、提交、推送或派生其他角色。共享工作区其他会话修改均保留。

## 文件与行为

- `src/db/repo.ts`：只修改 `EpisodeShotBulkPatch` 周围的批量协议。新增 `EpisodeShotBulkUndo`、`undoEpisodeShotBulkPatch` 和两个局部 snapshot/equality helpers。正向写入在同一 `PRODUCTION_TABLES` 事务中读取实际最新行、校验、生成受影响字段 before 与规范化 after、写入并返回 inverse。旧调用方可忽略返回值。8 字段均覆盖：beatId / durationSec / status / characterIds / sceneId / propIds / styleId / notes。
- `src/components/shots/ShotEditorPage.tsx`：仅替换 `applyBulkPatch`，另加对应 repository import。传入选择 ID，使用事务返回的 inverse 注册一个 undo；不再使用渲染快照或多个独立 `patchShot` 事务。
- `src/lib/undo.tsx`：action 带 `pending` / `error`，按 action 身份共享 pending Promise；成功才清除，失败继续向程序调用方 reject，同时在原始 expiresAt 前保留当前动作。旧 Promise 完成/失败仅可更新原 action，不能修改后来注册的 action。clear/expiry 不会被异步完成撤销。Provider 显示错误与“重试撤销”，pending 时显示“正在撤销…”并禁用按钮；click 显式 catch，避免 UI 事件未处理的 rejection。
- `tests/undo.test.ts`：保留基础行为测试，增加失败重试、原始过期时间、并发重复调用、旧 pending 与新 action、新 pending、clear/expiry 的成功和失败竞态，以及订阅状态通知。
- `tests/shotBulkUndo.test.ts`：新增真实 Dexie + fake-indexeddb 针对数据库回归。
- 本文件：实现证据与交接说明。

## 具体协议选择

Inverse 包含 projectId / episodeId / 每行 id + before/after，仅保存实际补丁拥有的白名单字段。可选引用以前缺省时显式记录 undefined，使恢复能清空正向新增的引用；styleId 的 undefined 与 null 保持区分。数组按长度和有序内容比较，snapshot 深复制以避免调用方/兄弟行数组别名。

撤销在单一 `PRODUCTION_TABLES` rw 事务内校验 episode/project scope、重复 ID、全部 target/owner、before/after 白名单与相同字段集合、受影响字段当前值以及当前行/恢复后行的所有关系。全部检查通过后才 bulkPut 与 touchProject；写入或 touch 故障一起回滚。

字段当前值等于 after 可撤销；等于 before 可合流。逐字段合流允许整行或部分字段已经恢复，但整组恢复后仍须满足关系检查。任何字段出现第三个值，整组拒绝。恢复通过当前行合并受影响 before 字段，因此独立字段、槽、媒体引用、排序等保留。

无选择、空 inverse 均无操作；空受影响补丁也不产生写入或 undo。非空非法目标仍拒绝。重试不会延长原始撤销窗口。

## 原行为 red 证据

先写针对断言并运行，之后才修改产品源码；未回退共享 checkout，未创建破坏性 worktree。

1. `/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm exec vitest run tests/undo.test.ts --reporter=dot`
   - 修复前：exit 1，8 failed / 7 passed。
   - 核心证据：失败后 `getCurrent()` 为 undefined，预期保留 action/error；第二次重试返回 false；pending 时原动作已被清除。
2. `/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm exec vitest run tests/shotBulkUndo.test.ts --reporter=dot`
   - 当时文件仅含两个 forward snapshot 断言；修复前：exit 1，2 failed。
   - 核心证据：最新 committed before / normalized after 应作为返回 payload，但旧 `patchEpisodeShots` 返回 undefined。
3. 核心实现后两个文件先通过 17 个测试，随后补齐下列约定数据库回归。

## 最终验证

```text
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm exec vitest run tests/undo.test.ts tests/shotBulkUndo.test.ts tests/repo.test.ts tests/repoReliability.test.ts --reporter=dot
exit 0
Test Files 4 passed (4)
Tests 75 passed (75)
Duration 530ms

/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm lint
exit 0
> tsc -b --pretty false

git diff --check
exit 0

git diff --no-index --check /dev/null tests/shotBulkUndo.test.ts
exit 1（--no-index 的新增文件差异状态；无 whitespace 诊断）
```

关键 DB 证据：全部 8 字段（含 propIds/styleId）恢复；正向事务捕获最新 committed before 而非 stale view；两行中一行受影响字段冲突时另一行不恢复，并用 updating hook 证明验证阶段零写入；missing / foreign episode / foreign project / duplicate / wrong scope 拒绝；独立 content / shotNumber / cameraAngle / firstFrame 和媒体记录保留；数组结构相等允许恢复、重排后第三值拒绝；undefined/null 引用恢复；已 before 的整行/部分字段和重复恢复合流；各恢复关系失效在首写前拒绝；非法 inverse 字段拒绝；第二行写入及 project touch 存储故障均回滚整个 inverse，移除故障后同一 payload 可重试；正向存储故障同样回滚。

现有 repo / repoReliability 回归同时通过，覆盖原 owner、事务、媒体回收、排序等相关约束。

## 限度 / 交接

未跑全 suite/build（主会话明确不要求）；未挂载浏览器或做交互视觉测试。Provider 的 pending/error/retry 和 click catch 已源码核验，controller 状态/订阅及生命周期通过纯逻辑测试；DB 用例执行真实 repository 与 Dexie 事务，不是 mock 事务。

本角色未独立派生 check（原生 implement 角色自豁免）；请主会话按既定流程完成独立 check 后再关闭 A02。工作区已有 A01、规范和任务元数据变化由其他会话拥有，本角色未回退或纳入本单元修改。
