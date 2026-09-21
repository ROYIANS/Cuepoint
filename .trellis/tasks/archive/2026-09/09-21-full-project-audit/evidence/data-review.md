# 数据完整性审查证据

审查日期：2026-09-21。只审查与添加证据，没有修改产品实现。遵循任务 PRD、设计、执行计划，以及 state-management、asset-output-foundation、production-contracts、delivery-export、project-memory、quality-guidelines、type-safety 和共享思考指南。报告语言依用户要求为中文。

## 结论

确认 3 项 P2 问题，均有断言正确期望的最小复现。没有在本分工中确认 P0/P1。首次连接并发保存、特殊扩展名媒体备份恢复和跨标签页场次删除撤销存在缺口。现有 14 个相关测试文件 / 131 项测试通过，新增复现 4 项中 3 项失败、1 项通过；原始日志分别为 `data-existing-tests.log`、`data-repro.log`。

这不是“所有数据路径均无问题”的证明。真实浏览器 IndexedDB 配额、进程强制终止、Safari 行为、千级媒体删除性能未在本分工运行；界面与 Agent 集成由其他审查分工验证。

## DATA-01：备份未保存媒体元信息，使合法 JPEG 在还原后失去可用状态（P2，已复现）

- 位置：`src/lib/projectPackage.ts:95` 的扩展名选择、`:109` 的 MIME 推断表、`:757` 的媒体写包、`:838` 的导入。相关判定：`src/lib/shotMedia.ts:14`。
- 入口与链路：`GenerationSlotCard` / 项目封面上传 → `uploadMediaFile` 接受 `image/*` / `video/*` MIME → `putMedia` 持久化原始 MIME 和文件名 → 项目 ZIP → 导入后 `validShotMediaId`、媒体复用列表和交付包依 MIME 判断素材是否可用。
- 复现：创建项目和镜头，保存一个 MIME 为 `image/jpeg`、文件名 `reference.jfif` 的非空媒体，设为首帧，调用 `exportProjectZip` 再 `importProjectZip`。这是合法 JPEG MIME，可通过当前上传校验；复现只需最小非空 JPEG 标志字节，不声称测试了解码器。
- 预期：还原后 MIME 仍为 `image/jpeg`，媒体仍满足首帧就绪条件。
- 实际：ZIP 仅保存 `media/<id>.jfif`，没有保存 MediaRecord 元数据；JSZip 读取 Blob 没有原始 MIME，推断表不认识 jfif，生成 `application/octet-stream`；就绪判定由 true 变 false。之后槽位保存也可能因 MIME 不符拒绝。
- 同根因附带影响：普通媒体原始 filename 在导入时统一变成 `<old-id>.<ext>`，媒体选择器按用户原文件名检索会失效。参考资料因另有 references 元信息修正原名/MIME，不受这一元信息缺失路径同等影响。
- 范围：已复现 `.jfif`；上传入口接受其他 image/video MIME，但本条不据此宣称所有格式都损坏。PNG/JPG/JPEG/WebP/GIF/MP4/WebM/MOV 的常规后缀有推断映射。
- 修复边界：为备份添加版本兼容的媒体元数据索引，优先恢复 MIME/filename；旧包继续走合理后缀推断。仅补 jfif 可处理该实例，但无法保留其他有效 MIME 和原文件名。
- 验收：不同图片/视频 MIME、文件名大小写、无扩展名、jfif、旧格式包、参考资料共同引用媒体均可往返；不要破坏媒体 ID 重映射和原始字节。

## DATA-02：首次并发保存同一供应商产生重复连接，后续编辑不能更新界面所显示的配置（P2，已复现）

- 位置：`src/db/repo.ts:1549` 的事务外查询、`:1552` 的随机新 ID、`:1560` 的单独 put；`src/db/database.ts:148` / `:159` 的 definitionId 索引不是唯一索引。消费端：`src/components/studio/ConnectorsPage.tsx:40`–`:47`、`:135`–`:151`。
- 入口：两个标签页在未配置该供应商时打开连接编辑并近同时保存。页面内 saving 状态只能阻止当前实例重复点击，不能互斥另一个标签页。
- 复现：并行调用两次同 definitionId 的 `upsertConnector`，结果为 2 条记录；随后再次保存新 Base URL，按 ConnectorsPage 的真实 `toArray → Map.set(definitionId)` 投影读取界面值。
- 预期：每个 definitionId 只有一条配置，保存后界面显示最新 Base URL。
- 实际：两个调用先读到不存在，然后分别生成 ID 写入。repository `where(definitionId).first()` 更新的是第一个主键记录；界面遍历主键顺序的 toArray，Map 保留最后一个记录，因此“已保存连接”后仍显示旧 URL。复现对数量和实际投影均有失败断言。
- 用户影响：配置看似无法修改；断开只删除当前显示 ID，另一条仍存在，连接会再次显示。隐藏的旧密钥也继续存在本地，不能把一次断开解释为完整删除这个供应商配置。
- 修复边界：查询与 upsert 放入同一写事务，并增加唯一性约束或以供应商为稳定主键；历史重复记录迁移需明确保留哪条，以及如何修复 chat/generation preference 等 connectorId 引用，不能只删重复行。
- 验收：并发首次保存结果唯一；编辑后界面与 repository 返回同一条；断开后无同供应商残留；已有引用不悬空。

## DATA-03：撤销删除场次覆盖镜头后来选择的新场次（P2，已复现）

- 位置：`src/db/repo.ts:1196`–`:1198`。界面调用：`src/components/story/StoryPage.tsx:128`–`:139`、`src/components/shots/ShotEditorPage.tsx:690`–`:700`。
- 复现：镜头归属 A；删除场次 A 后镜头成为未分场；第二标签页把镜头移到仍存在的 B；第一标签页在 8 秒内点击删除 A 的“撤销”。
- 预期：恢复 A 时只恢复仍处于删除后状态的关联，或提示发生并发变更；保留后来选择 B 的修改。
- 实际：恢复函数仅确认 shot.episodeId 相等，然后无条件写回 beatId=A；B 归属被静默覆盖。该操作不检查当前 beatId 是否为空，也不比较删除后版本。
- 规范说明：短期 Undo 规范明确单条、8 秒、先清除再 restore，但没有像 production proposal 一样显式要求 revision CAS。本条“保留并发后续修改”是根据数据完整性审查目标提出的合理安全期望，不伪称已有明确 CAS 规范。仅涉及近期场次归属、可再次手动修改，定为 P2，不升级为 P1。
- 修复边界：删除快照记录受影响关联及删除后的期望状态，恢复时条件写入或报告冲突；补充手动 Undo 并发契约。不能将整个旧 Shot 覆盖回去。
- 验收：正常删除/撤销恢复关联；新归属保持；镜头已删除时跳过；多集不越界；已被其他窗口恢复的场次具有明确幂等行为。

## 已排除的疑点与通过证据

| 疑点 | 判定与依据 |
| --- | --- |
| v17/v18/v19 在构造器中不是递增书写会丢表 | 排除。新增真实 v1 store 升级到当前版本的测试通过，包含 references、memories、batches、search 表；Dexie 版本声明书写顺序不能直接作为缺陷。 |
| 原 v1 角色/场景使用 images，而当前读取 slots，缺少迁移 | 排除。查阅最初提交 `cddd4e9` 的 types/database，原生 v1 已是 slots；images 是 ZIP 兼容输入，不能推断 IndexedDB 也必然存在该旧字段。 |
| v1 镜头 frame/reference 升级丢结果或参考图 | 新增正向升级测试通过：frame.result 保留为 firstFrame.result，reference.result 进入首帧 refs，旧剧本进入首集。 |
| 备份函数本身没 flush 就一定备份旧草稿 | 不是当前 UI 缺陷。两个实际备份入口 ProjectGalleryPage 与 WorkspaceChrome 都先调用 flushPendingDrafts；handoff 和 proposal 自己也有 barrier。可考虑统一 helper 减少未来新入口漏调用。 |
| 共享素材取消上传/删除槽位会被误回收 | 当前实现有 DraftMediaSession 上传所有权和全局 committed refs 扫描，额外保留 proposal/job/batch 引用；现有相关测试通过。未验证高负载真实浏览器时延。 |
| 同时删除两集可删光最后一集 | count 与 delete 在同一个包含 episodes 的写事务中，已有并发回归测试通过。 |
| 从工作室复制会共享原 media ID | copyStudioSnapshot 在事务中创建新 asset/media IDs，重复来源检查也在事务内；现有各资产类型、独立性及 rollback 测试通过。 |
| ZIP 读 JSON 与 Blob 的时点不同 | 当前在一个只读事务内取完整快照，压缩在事务外；已有并发写测试通过。 |
| 跨集相同旧 beat ID 在导入时串联 | beatMaps 按旧 episode ID 分层；已有两个同名旧 beat 的导入测试通过。 |
| proposal/history 没随项目备份导出就是丢数据 | 根据 production-contracts 是明确边界：本地提案 revision/ID 不可直接迁移；备份只含 committed 内容，handoff 也不是还原包。 |
| 删除项目必须删除绑定的对话 | 不能直接判定。项目上下文规范允许已删除项目对话保留并阻止旧作用域操作；repo 删除项目只清理项目数据是有意边界。 |
| 被替代记忆的目标永久删除后，ZIP 应拒绝悬空 supersededBy | 排除。project-memory 规范显式允许导入解除已永久删除的替代链接并加说明。 |
| imported memory 的全部状态改为 pending_review 是覆盖已审核状态 | 明确设计，历史链保留，当前版本新增待复核；不是误报。 |

## 逐文件覆盖与审查深度

以下为本分工实际已读的主责任文件；这里的“精读”是静态代码与必要调用追踪，不等于每一分支均注入过故障。

| 文件 | 审查内容 / 状态 |
| --- | --- |
| src/db/repo.ts | 全文件精读：项目/集/资产/镜头 CRUD、归属、copy、delete/restore、媒体回收、连接和聊天 CRUD。DATA-02/03。 |
| src/db/database.ts | 全版本和表定义、索引、v3/v6/v8 迁移精读；新增真实 v1 升级测试。 |
| src/db/productionProposals.ts | 全文件精读：创建/应用/取消/撤销、source/target/media 校验、revision 冲突、同事务写。 |
| src/db/projectMemories.ts | 全文件精读：归属、revision CAS、版本快照、源总结、去重、替换、删除、来源不可用。 |
| src/db/contextSettings.ts | 全文件精读：线程/default 事务、缺失线程、normalizer。 |
| src/db/generationPreferences.ts | 全文件精读：只读状态、不覆盖另一模态无效偏好、显式保存校验。 |
| src/db/searchConnections.ts | 全文件精读：密钥验证、保留旧键、启用技能/连接同事务、移除。 |
| src/domain/types.ts | 全文件精读：owner、episode、status/filter、脚本范围、setting、media 与默认值。 |
| src/domain/slot.ts | 全文件精读：legacy normalize、媒体收集/映射、result kind、首帧合并。 |
| src/lib/projectPackage.ts | 全文件精读：输入解析、extra、ID/关系映射、全部事务和 memory package 校验。DATA-01。 |
| src/lib/productionHandoff.ts | 全文件精读：draft barrier、快照、scope、路径清理、缺失项、同字节导出。 |
| src/lib/episodeDelivery.ts | 全文件精读：项目/集过滤、排序、CSV 引号/中文、派生状态、文件名。 |
| src/lib/debouncedDraft.ts | 全文件精读：序列化、revision、detach/resume、失败保留、backup barrier、卸载保护；mounted 初始值同步问题已转交 UI 分工。 |
| src/lib/draftMedia.ts | 全文件精读：pending/save/cancel、owned 与复用媒体区分，已有测试验证。 |
| src/lib/media.ts | 全文件精读：上传 MIME、object URL 建立/释放、文件选择取消。 |
| src/lib/mediaPicker.ts | 全文件精读：同 owner、非空、kind、文件名查询。 |
| src/lib/shotMedia.ts | 全文件精读：同项目、非空、声明 kind 与存储 MIME 一致性。 |
| src/lib/useShotMedia.ts | 全文件精读：referenced IDs query、依赖更新时的 retained value 防护、已有测试。 |
| src/lib/shotRelations.ts | 全文件精读：prop 同 owner、style undefined/null/explicit 语义。 |
| src/lib/undo.tsx | 全文件精读：过期、单条、重复执行、restore 异常路径；失败后 UI 错误与恢复另由 UI 评审。 |

跨责任边界为验证调用链阅读了：`src/lib/references/package.ts`（仅备份恢复接口，资料完整审查归其他分工）、`src/lib/agent/businessTools.ts` 的 repo/draft 调用、`ConnectorsPage`、`StoryPage`、`ShotEditorPage`、`WorkspaceChrome`、`ProjectGalleryPage`、`AssetTextField` 的相关入口。不要把这些局部读取计成整个组件/Agent 模块精读。

## 重构建议与尚未确认问题

1. repo.ts 的四类资产 add/patch/setSlot/delete 部分结构重复。但删除角色/场景要改 beat，删除 prop 要改 shot.propIds，删除 style 要保留显式 none；不能机械合并全部级联。可以在单独维护任务中考虑共用 owner/slot 校验与 create touch 事务，保持各实体的业务级联独立。
2. `patchCharacter/Scene/Prop/Style` 也接受 slots，`patchShot` 也接受三个媒体槽，能够绕过专用 setSlot 的媒体校验/回收。但追踪到当前 UI 和 Agent 常用入口媒体写入通过专用 setter，泛 patch 中 slots 主要出现在测试 fixture；暂记内部契约弱点，不据此宣布当前用户能跨项目引用媒体。
3. `collectMediaIds` 扫描全局记录，并在每个候选回收时重做；大批删除可能有明显开销。这里未测量大项目真实延迟，属于性能候选，不作为已确认性能 Bug。
4. draft controller 不跟随 mounted 的 initialValue 更新，且 StoryPage 将 title/logline/script 整包持久化、WorldSettingPanel 整包 setting 持久化；可能覆盖其他窗口对独立字段的编辑，已向主会话移交要求 UI 复现。本分工不重复计数。
5. 被删除实体的失败 detached draft 没有移除或丢弃 API，可能持续阻止当前 scope 的 backup barrier；需要真实导航/删除顺序验证，未计为确认问题。

## 可复现执行方法

故意失败的审查测试已移至 `evidence/repro/auditDataIntegrity.test.ts`，不会被默认 `tests/**/*.test.ts` 收集。要重新执行，把该文件临时复制回 `tests/auditDataIntegrity.test.ts`（该临时路径应不存在），运行：

```sh
PATH=/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin:$PATH /Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm exec vitest run tests/auditDataIntegrity.test.ts
```

执行后将临时文件移回证据目录或删除本次临时副本。复现使用 fake-indexeddb，不触及浏览器用户数据；三个缺陷断言保持正确期望，不改成测试接受错误行为。修复后应把对应测试作为正式回归加入 tests。

本分工实际执行的现有回归命令：

```sh
PATH=/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin:$PATH /Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm exec vitest run tests/repo.test.ts tests/repoReliability.test.ts tests/projectPackage.test.ts tests/projectMemoryPackage.test.ts tests/projectMemories.test.ts tests/productionHandoff.test.ts tests/productionProposals.test.ts tests/episodeDelivery.test.ts tests/debouncedDraft.test.ts tests/draftMedia.test.ts tests/undo.test.ts tests/assetFoundation.test.ts tests/generationPreferences.test.ts tests/useShotMedia.test.ts
```

结果：退出码 0，14 文件 / 131 测试通过。完整项目的 lint/test/build/模型库验证由主会话基线记录负责，本分工未重复执行。
