# Research: persistence-domain 全量只读审查

- Query：逐文件核验数据一致性、事务、删除/恢复/迁移、所属范围、运行状态、schema/类型、重复规则、repository 职责与 db/lib 反向依赖。
- Scope：internal；仅 `source-manifest.json.groups.persistence-domain` 的 50 文件（src/db 27、src/domain 23），8,865 行。其他组代码和 tests 仅用作调用/行为证据，不登记覆盖。
- Date：2026-09-30。
- 基准：`2fc0e9523e62a5258a488cc3d0274d24c8967c6f`；50 文件完成阅读，最终 SHA-256 与 manifest 全部一致。无生成文件、无 blocked 文件。
- 角色/上下文：已读取 `.codex/agents/trellis-research.toml`、workflow、任务 PRD/design/implement。任务没有 research.jsonl，使用注入的 research 上下文和相关规范。单仓库，无 packages 配置。只写本报告和覆盖 JSON，不改产品、不提交、不派代理。

## 发现概览

| ID | 级别 | 分类 | 结论 |
| --- | --- | --- | --- |
| PD-01 | P2 | confirmed-bug | 资产创建与媒体入库接受已删除的项目 ID，能产生孤儿数据 |
| PD-02 | P1 | confirmed-bug | 镜头删除快照不在删除事务中获取，撤销可丢失删除前已经提交的编辑与素材 |
| PD-03 | P2 | risk | 泛型 patch/封面入口能绕过所属范围、媒体校验和清理；API 已复现，正常交互的利用链未证实 |
| PD-04 | P2 | structural-debt | db 与 lib 的值依赖形成 8 文件强连通分量，纯规则、持久化和远端执行混在同一导入图 |
| PD-05 | P2 | structural-debt | repo 的跨域职责通过事务表集合和清理引用策略实际耦合，拆文件需先梳理原子契约 |
| PD-06 | P2 | structural-debt | 简单记忆写入等使用全部 46 张表的写事务，扩大锁冲突范围和后续维护成本 |
| PD-07 | P2 | structural-debt | 每个待回收媒体都会重复全库引用扫描，批量删除出现可确定的扫描倍增 |
| PD-08 | P3 | structural-debt | 若干未使用导出保留了第二套读取/写入入口，可收窄维护面 |

严重度按具体影响判定，不按文件行数、复杂度阈值或规范措辞判定。P1 是可触发的数据丢失；风险不等于当前线上故障或权限漏洞。

## PD-01 — 项目已删除后仍能创建资产和媒体

- 位置：`src/db/repo.ts:848`（addCharacter）、`:936`（addScene）、`:1004`（addProp）、`:1059`（addStyle）、`:695`（putMedia）、`:75`（touchProject）。
- 机制：四个 add* 先独立提交子表，再调用 touchProject；没有事务内父项目存在性校验。touchProject 用 update，父项目缺失时不会抛错，因此整个 API 正常返回。putMedia 虽包含 media/projects 写事务，也没有确认 record.projectId 的父记录存在，迟到上传可以写入已删除项目。
- 调用证据：`src/components/assets/AssetLibraryPage.tsx:138` 的 createLocal 直接调用这些 add*；工作室 `src/components/studio/AssetLibraryPages.tsx:130` 也使用同一入口。项目页与另一标签页删除之间存在竞态，媒体上传的异步完成同样可能迟于 deleteProject。Agent 普通写入另有 executeAtomicTool/projectScope 保护，不能把 UI 与 Agent 所有路径都说成缺失校验。
- 影响：项目不存在却保留 characters/scenes/props/styles/media；用户看不到对应项目内数据，媒体可能占用存储，父子关系不再成立。资产 add 与触碰项目分开提交还可能出现“创建已提交但更新时间写入失败”的部分成功。
- 隔离证据：createProject → deleteProject → 分别 addCharacter/addScene/addProp/addStyle，四次均成功；每个表该 projectId 的记录数均为 1，父记录均不存在。deleteProject → putMedia('late-upload') 也成功，media 存在、project 不存在（附录复现）。
- 建议：给非 studio owner 在同一写事务内检查父项目，再创建子记录并 touch；保留 studio 特例。是否禁止 archived/projectKind 应单独依据业务确定，不能顺带改变音频项目素材使用行为。
- 验证：缺失 owner 拒绝且无子表写入；创建与项目删除并发，最终只能保留合法父子关系或全部删除；studio 创建继续成功；注入 touch 写入失败应整体回滚；异步上传在父项目删除后不可复活媒体。

## PD-02 — 镜头删除/撤销快照可落后于真实删除时刻

- 位置：`src/db/repo.ts:1631`（deleteEpisodeShots）、`:1607`（deleteShots）、`:1559`（restoreShots）。跨组调用证据：`src/components/shots/ShotEditorPage.tsx:589`–`:602`。
- 机制：UI 从渲染时 shots 取得 snapshot，随后异步读取 media，最后调用 deleteEpisodeShots。repository 事务重新读取当前 shots，但不把这些当前记录/媒体返回给调用者。撤销 restoreShots 使用 UI 先前保存的旧记录、旧媒体，并 bulkPut 恢复。snapshot 与实际删除之间没有 revision/CAS 或同一事务快照。
- 具体触发：取得旧镜头快照后，另一标签页、Agent 或待完成的保存写入新 content 与新 firstFrame；删除事务删除最新镜头并回收新素材；撤销恢复旧 snapshot。即使所有独立写入都是原子且已成功，最新成果仍被撤销流程丢失。
- 影响：撤销不能返回“删除之前”的最新状态，实际丢失已提交文本/槽位成果。最新素材若无其他引用，被 deleteMediaIfOrphan 删除，而且旧 undo 快照没有保存它。由于有可丢失内容的触发路径，定为 P1，不把仅有并发可能性当成无证据性能风险。
- 隔离证据：删除前实际记录是 `content='new committed text', firstFrame.result.mediaId='new-image'`；在 restoreShots 后变为 `content='old text', mediaId='old-image'`，`new-image` 已不存在。旧 snapshot 和旧媒体都是在最新写入之前取得，准确模拟上述调用顺序。
- 对照合理设计：`src/db/repo.ts:542` 的 deleteEpisode 已在删除事务内保存 episode/shots/media 后返回 snapshot，避免这个窗口。restoreShots 对父子范围、已有 ID 和排序做了校验；这些校验无法弥补错误的快照时间。
- 建议：由 scoped 镜头删除 API 在同一事务内读取最新 shots/媒体并返回 DeletedShotsSnapshot；UI 直接登记该返回值。若 UX 需要确保删除用户刚看的版本，则 CAS 拒绝并提示重新确认，不应 silently delete 最新版后 restore 旧版。
- 验证：在 snapshot/点击与实际删除之间提交文本和槽位更新，撤销需恢复删除事务取得的最新版及 Blob；并发删除/恢复不重复 ID；失败事务不登记 undo；共享媒体仍保留。新增测试应把“取得快照 → 并发更新 → 删除 → 撤销”完整跑完，现有普通 undo 测试不足。

## PD-03 — 宽 patch 与严格槽位 API 的契约不同，存在绕过风险

- 位置：`src/db/repo.ts:855`–`:869`（patchCharacter）；同型入口 `:943`（patchScene）、`:1011`（patchProp）、`:1066`（patchStyle）；`:1452`–`:1462`（patchShot）；`:382`–`:412`（patchProjectOutput）。严格校验入口 `:873`（assertSlotMedia）、`:887`（setCharacterSlot）、`:1591`（setShotSlot）。
- 机制：资产 patch 的白名单允许 slots，但其事务只有 projects/资产表，不查 media、不做 recycle；patchShot 白名单允许 firstFrame/lastFrame/clip，assertShotReferences 只检查项目/集/场次/设定引用，不检查这些 slot 的媒体。patchProjectOutput 直接存 coverMediaId，也没有检查媒体存在、owner、图片类型。类型层合法的 payload 即可触发，无须 as any。
- 隔离证据：setCharacterSlot(A角色, 引用B项目图片) 正常拒绝；patchCharacter 同样 slots 则成功。patchShot(A镜头, firstFrame=同样B图片) 也成功；patchProjectOutput(A,{coverMediaId:'missing-media'}) 成功。这里确认的是 API 契约缺口，分类仍是 risk：没有证明正常 UI/工具能利用它造成跨项目数据暴露。
- 调用边界：当前资产 detail 编辑器只 patch 文本并传 baseline，正常媒体编辑走 set*Slot；businessTools 的 shotPatch/媒体 preflight 也有上层校验。测试 `tests/productionContext.test.ts:54`、`tests/projectPackage.test.ts:78` 确实直接 patchShot(slot)，说明入口不是类型意义上的死代码。WorkspaceChrome 正常封面来自已上传图片，Agent cover 另有校验；不能仅凭 API 调用就宣称权限漏洞。
- 影响：新的调用方或导入/恢复重构容易形成外国 owner、失效媒体、类型错误或旧素材未回收；project delete 依赖同 owner 删除策略，错误引用还可能随后失效。已有严格入口的安全性取决于所有调用方记住区别。
- 建议：将文本 patch 类型/运行时白名单收窄，槽位写入统一经严格入口。封面用专用校验。若兼容旧调用需要保留 slots，必须在同一 PRODUCTION_TABLES 事务内校验全部媒体并按差异清理，不能偷偷新增清理导致历史结果被删。恢复/import 单独提供有验证契约的 bulk API。
- 验证：同 owner 正常图片成功；foreign/missing/empty/wrong MIME 拒绝；拒绝不改变任何记录；patch/专用 set 在接受范围与回收结果上保持一致。用调用图核验全部现有调用后再删宽字段。

## PD-04 — db/lib 值循环与混合职责

- 位置/值边：`src/db/agentGenerationBatches.ts:14` ↔ `src/lib/agent/generationRuntime.ts:2`；`src/db/agentTools.ts:2` ↔ `src/lib/agent/toolLoading.ts:3`；`src/db/agentTasks.ts:2` ↔ `src/db/agentTaskRecords.ts:3`。更长环路：`agentTasks.ts:1` → `agentTaskWrapups.ts:3` → `wrapupEvidence.ts:2` → `agentTaskRecords.ts:3` → agentTasks。
- 证据：主会话 AST staticValueCycles 列出 8 文件 SCC：db/agentGenerationBatches、agentTaskRecords、agentTaskWrapups、agentTasks、agentTools，lib/agent/generationRuntime、toolLoading、wrapupEvidence。逐条复核 import，均为运行时值，不是纯类型循环。上面各导入均可在源码和 tools/ast-results.json.edges 对照。
- 机制与影响：generationRuntime 同时提供目标读取、快照准备、provider 执行；批次 repository 为调用目标/准备函数引入整个 runtime，runtime 又调用批次所有权和 executeAtomicTool。toolLoading 同时放纯选工具规则与持久化工具执行。因此 db 引入规则函数时也引入数据库执行/远端适配/其他业务，mock、模块独立测试、加载与迁移都受双向依赖影响。
- 结论限制：未证明启动异常、TDZ 或热更新错误；现有函数延迟执行且测试可运行，因此是 structural-debt，不是“有循环所以应用必崩”。domain/agent/context/types 的 type-only 循环另看，不混入值 SCC。
- 建议：先把纯工具选择函数、目标 revision/类型、无 db 的 effect 判定抽到领域/纯规则模块。目标读取与批次所有权归持久化模块；网络提交/下载编排归应用执行模块，由其向下调用 repository。`provesCompletedEffect` 可从 record repository 中移出，wrapupEvidence 不必反向引用 records。任务可编辑性/owned guards 也应避免 records ↔ tasks 相互取用整个模块。
- 验证：AST 值 SCC 清零或明显缩小；db 不导入网络执行入口；保留原工具 ledger 原子性、批次准备/回放、审批、task record/wrapup 的失败回滚；分别单独加载纯选择规则与 repository。不要通过 dynamic import 隐藏同一循环。

## PD-05 — repository 职责实际耦合，不能只按表拆文件

- 位置：`src/db/repo.ts:61`（PRODUCTION_TABLES）、`:307`（deleteProject）、`:617`（collectMediaIds）、`:658`（releaseMaterialUse）、`:704`（deleteMediaIfOrphan）、`:728`（copyStudioSnapshot）、`:1677`（upsertConnector）、`:1725`（createChatThread）、`:1779`（deleteChatThread）、`:1862`（createAudioMusicProject）。
- 机制证据：同一模块维护创作实体/集/镜头、媒体生存期、素材副本释放、connector 别名、聊天级联与音频/音乐项目种子。deleteChatThread 为释放生成结果必须调用 production 清理；production media 清理又知道 audio、material、references、proposals、single jobs、batches 的引用格式。音频增加后 repo 顶层依赖 AUDIO_TABLES，所有 PRODUCTION_TABLES 使用者随之扩展。
- 影响：改一个域的持久化格式/删除规则需要核对多域 API 和共享锁集；容易遗漏新表、新媒体引用和 cascade，例如 PD-01/PD-03 所示入口契约不统一。文件大只是表现，证据是跨域调用、表范围和原子边界。
- 建议职责：project/episode/shot/asset CRUD、connector 配置/别名、chat/任务历史、media 引用保留、material adoption、audio/music seed 分成明确模块。跨域删除作为少量显式用例保持一个事务，不能拆成多个各自提交的 delete 函数。中央 media 保留策略仍应统一，以有类型的引用采集函数表达各域的 ownership/retention 契约，不要求引入复杂注册框架。
- 验证：项目删除仍一次提交；connector 迁移冻结 ID/别名规则不变；线程删除不移除仍被业务槽位引用的结果；material 历史与媒体存续保持；拆前拆后运行 repoReliability/agentToolTransactions/materialIntegration/audioFoundation/connectorMigration。

## PD-06 — 全表写事务扩大耦合与锁竞争

- 位置：`src/db/projectMemories.ts:340`（manual create）、`:365`（update）、`:399`（status）、`:437`（replace）、`:482`（delete）；`src/db/agentRuns.ts:68`、`src/db/agentTaskWrapups.ts:104` 等也是 db.tables。
- 机制：数据库当前定义 46 张表；手工 createProjectMemory 的内部调用只需 projectMemories/projectMemoryVersions/projects，却申请 rw db.tables；update/status/replace/delete 同样遍历 projectMemories、写版本，不需要锁 connector/chat/audio 等所有 stores。锁集合会随 schema 新表隐式扩张。
- 影响：不相关编辑、媒体导入、连接设置、任务执行共享写事务 store 范围，扩大串行化条件；跨标签页更容易互等，后续 schema 扩展也改变每个用例的锁集合。未测量浏览器负载/延迟，因此不宣称当前界面已卡死。
- 合理边界：executeAtomicTool 全表锁为任意已注册本地工具提供原子 ledger；begin/wrapup 确实聚合很多域数据，不应机械要求统一只锁一张表。本项首选简单的手工记忆操作，promotion 的 sourceSummary/getTaskWrapupState 才需要更多表。
- 建议：按用例声明最小但完整的表集合：手工 memory 的窄事务、summary promotion 的证据事务、generic atomic tool 的受控宽事务分别保留。只在已列清的 read/write 集合上收窄，不能删掉证据表后用非事务读取“补齐”。
- 验证：全套 CAS/原子 rollback/source promotion 测试；手工记忆写入与不相干 connector/audio 操作并发，检查 scope 不重叠；真实浏览器对事务/未完成 native Promise 的回归单独做，fake-indexeddb 不能证明所有 IndexedDB 调度行为。

## PD-07 — 媒体逐条回收重复全库扫描

- 位置：`src/db/repo.ts:617`–`:654`（collectMediaIds）、`:704`–`:718`（deleteMediaIfOrphan）、`:560`（deleteEpisode 内循环）、`:932`（deleteCharacter 内循环）及 `:1627`（deleteShots 内循环）。
- 机制：每次 deleteMediaIfOrphan 都 collectMediaIds()（无 projectId），读取所有项目、所有设定/镜头、references/materialUses、retainedMedia、takes/works/exports/audioJobs/speakers；另读取该媒体 owner 的 proposal/job/batch/item。删除 N 个镜头时先收集三个 slot 的所有媒体 ID（还可能重复），再逐 ID 重做完整采集。
- 影响：设全库被扫描记录 R、待清理媒体 M，引用采集至少呈 M×R 的访问/遍历放大；整个过程持有 PRODUCTION_TABLES 写事务，阻塞其他引用写入。这里是源码可确定的重复工作，未做容量基准，不能把复杂度推导当成已有性能 SLA 违规。
- 建议：事务内去重候选 ID，一次构造当前全域保留集合，批量删除未保留候选；保留 proposals/jobs/batches 的历史引用并纳入同一集合。跨 owner 是否共享引用仍需守住现有规则，不能只按 projectId 优化后漏删保护。
- 验证：统计批量删除时引用扫描调用数从候选数降为一次/固定次数；共享媒体/生成历史/material use/audio reference retention、失败 rollback 均保持。真实浏览器做固定数据量的时延和内存对照；未完成这个性能验证前仅认结构债务。

## PD-08 — 无调用的导出收窄（可选）

- 位置：`src/db/repo.ts:208`（listProjects）、`:1717`（listChatThreads）、`:1721`（getChatThread）、`:1804`（listChatMessages）、`:1832`（updateChatMessage）；`src/db/materials.ts:389`（listMaterialUsage）。
- 证据：有效全量 Knip（tests 也是 entry）提示这些 exports；`rg` 对 src/tests 核验仅定义出现。`src/components/agent/AgentChatPage.tsx:59`、`:162` 直接 useLiveQuery scoped 表读取，没有调用旧包装；这是使用方式差异，直接 live reads 本身合理。
- 机制/影响：保留未消费的 API 会增加目录/边界维护面；updateChatMessage 还是一条单独写入口，与 run-owned checkpoint 分流，后续维护容易误接。没有当前行为错误。
- 建议：确认无外部扩展入口后删除不再需要的包装或取消 export；有明确兼容用途则说明用途。不可把 emptyCharacter/内部调用的辅助函数或仅测试消费的 API 一概按 Knip 删除。
- 验证：源码+tests 调用检索、typecheck/test/build；若有动态扩展调用需要人工检索配置后保留。首次 production Knip 输出失效未用；本项无自动清理。

## 业务规则归属与渐进迁移

| 规则/职责 | 建议归属 | 当前需守住的契约 |
| --- | --- | --- |
| 所属范围、实体外键、CAS、完整排序、删除/恢复快照 | 持久化用例，事务内读当前记录 | studio owner 特例、最后一集、音频最后一章、revision/字段 baseline |
| ID/type、normalizers、slots remap、batch limits、纯状态/工具选择 | domain 或纯 rules | legacy slot 和 kind 缺失读为 video；未知 profile/extra 可 round-trip |
| provider profile 参数、模型能力、music/speech wire 校验 | provider/domain capability 纯契约；由 repository 和 runtime 调用 | 项目默认值与每次生成输入不同，不能把默认配置等同完整生成请求 |
| 请求、Blob 哈希/解码、网络提交/查询、Web Lock、草稿 flush | 应用/执行层 | 网络与 Blob 异步工作在 IndexedDB 事务外，付费未知结果不重发 |
| 工具 ledger 原子提交、批准 CAS、冻结请求 | 持久化执行协议 | result 和业务写入一起提交；工具 effect 与业务完成证据分开 |
| 项目/线程跨域删除、媒体保留集合 | 显式持久化跨域用例 | snapshot/素材 adoption/history 跨多表仍一次提交 |
| UI 导航、链接、标签、字段表单草稿 | 展示层；纯字段辅助可复用 | live reads 合理，直接调用 repository 合理，不强制添服务层 |

迁移顺序：

1. 先补 PD-01、PD-02 的父子/撤销契约与回归测试；收窄 PD-03 前先查清现有 slots/cover 调用，建立行为对照。
2. 抽出 PD-04 的纯选择/effect/guard 规则，分离 generation target read 与网络 runtime；保留公开 API 适配层，验证工具原子事务未改变。
3. 拆 connector、chat、创作 CRUD、audio seed 与中央 media retention；跨域 delete 继续由单一事务编排，不能以文件移动为由降低原子性。
4. 在清晰 read/write 集合上逐步收窄 memory 等事务；实现一次性 media 保留扫描，跑并发/回收测试后再做性能对照。
5. 最后清理未使用导出与类型方向。`src/domain/agentGenerationBatch.ts:2` 对 lib GenerationSubmitArgs 的依赖目前是 type-only，无运行时环；可把请求契约移到独立领域/能力文件后同时从 schema 推导，避免人为创建第二份漂移类型。
6. schema 版本和 Blob 存储格式保持独立兼容边界。纯重组不必迁移数据；只有确实变更记录/index 时新增版本，先做旧库 fixture 回归，再切读写，最后移除旧路径。

## 合理设计与已排除的误报

- `database.ts:264`–`:278` 先将 connector 重复 ID 保存到 aliases，再建立 definitionId unique 索引；repo.upsert/delete 包含 aliases 事务，冻结历史 ID 可解析且显式密钥修改同步。connectorMigration 测试验证了整个升级/别名/撤销链。`version(19)/18/17` 声明顺序不是直接的迁移 bug；未仅因文本顺序记录故障。
- `domain/types.ts:242` getProjectKind 对 legacy undefined 使用 video，但对未知非空值拒绝；并非把所有项目默认为视频。audioShared revision CAS、readonly 音频快照、replaceAudioClips 全章 CAS 是合适设计。
- `repo.ts:542` deleteEpisode 的最后一集 count 与删除共用事务；`restoreStoryBeat:1299` 仅对原归属且仍未分配的 shot 恢复，不覆盖较新 beat assignment。
- `deleteProject:307` 保留任务/线程/运行历史是明确需求；agentProjectContext.test 验证所有新请求/refresh/model step/tool 被阻断，不登记“悬空聊天项目 ID”为 bug。
- `materials.ts:331` 采用新 ID 并 remap；更新素材使用记录是在项目内“加入新版副本”，不自动改旧实体/slot。`updateMaterialUse:362` 保留旧 use 与 fingerprint guard 符合交互，不认定未 repoint 为失败。
- `projectMemories.ts:55`–`:85` exact content/source 去重和 topic 冲突是不同业务规则；disabled/superseded 不自动复活属于正确行为。category/body/applicability 定义 sameContent，title/tags/inclusion 不参与匹配，是否应更改属于产品规则讨论，未制造 bug。
- generation jobs 区分 submitting/unknown/remote_completed/downloaded/applied/conflict，音频 jobs 独立状态机；两组格式服务不同结果保存/采用方式，不能仅因命名不同强行合并。批次全实体 revision 链、unknown 不重发、source task 所属证据、可用媒体与当前 applied 的区分均合理。
- `agentFinishingCheck` 对 unknown JSON 的 any 由 Array.isArray 引出，随后 validateTaskPlan/try-catch 和结构 revision 相等约束；ESLint unsafe 警告不是已确认工具越权。legacy normalizers 的 String(raw) 是宽容兼容策略，严格导入/schema 边界另有校验。
- jscpd 唯一 owned clone：repo :1634–:1647 对 :1477–:1490。两个用例共享“有效集、唯一 ID、同 project/episode”前置校验，后续分别删除和编辑，事务范围同为 PRODUCTION_TABLES；未发现契约漂移。小 private scoped selection guard 是可选提取，不单列重复 bug，不把整个用例合并。
- domain 的小类型文件没有发现必须拆分/合并理由；类型循环与值循环分别分析。文件大小和复杂度警告未单独列问题。

## 待核实事项（不计入 confirmed-bug）

1. PD-03 证明 repository 接受错误媒体，但没有正常 UI/工具输入的跨所属数据利用链；跨项目泄露、备份污染等后果需要针对各入口 end-to-end 验证。
2. 全表事务、native Promise 与 wrapup source evidence 的真实浏览器调度：规范已有 PrematureCommit 历史说明；本轮 fake-indexeddb 测试通过，未新证实 PrematureCommit，不重复登记未知浏览器故障。
3. restoreEpisode/restoreShots 会 bulkPut 捕获的 MediaRecord。正常媒体 API 用 add/new ID，Blob 本身不可变，因此不把“bulkPut 必然覆盖较新媒体”当成已证实 bug；若未来提供同 ID 更新 retention/metadata，需审查恢复合并策略。
4. 移除未提交批次候选后 media retention 是否及时释放、线程删除与音频 source 历史的保留/隐藏行为需要产品确认和额外资源占用测量；当前证据不足，不认定为丢数据。
5. 未调用远端 provider、未核验最新服务限制；报告评估本仓库既有契约及本地代码，不声称当前模型规格已独立核验。没有外部资料引用。

## 工具与验证记录

本组逐文件阅读使用 shell `sed`/`nl`/`cat`，检索用 rg；`python3 ./.trellis/scripts/get_context.py --mode packages` exit 0，结果 single-repo。研究没有安装任何依赖。

运行时实际版本：Node v24.11.0；显式本地路径 `/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm` 实际返回 **10.15.0**（与用户说明的历史 9.12.0 有差异；未使用 Runtime pnpm，未 install）；Vitest v5.0.1。Vite SSR + fake-indexeddb 的隔离脚本使用现有依赖，configFile:false、防止启动路由生成插件，IndexedDB 仅 Node 进程内存，不接触浏览器用户数据。

| 执行 | 退出 | 结果 |
| --- | --- | --- |
| 首轮选定 vitest（见下方命令） | 0 | 9 files / 87 tests passed；传入不存在的 taskWrapup.test.ts 不会成为测试文件，正确名已第二轮补测 |
| 第二轮 vitest | 0 | 4 files / 48 tests passed |
| 隔离复现：orphan + stale undo | 0 | 4 资产孤儿；新文本/素材撤销丢失 |
| 隔离复现：patch boundary + late media | 0 | 严格入口拒绝、宽入口接受 foreign；缺失 cover 被存；已删父项目 late media 写入成功 |
| SHA-256 核验 | 0 | owned 50 / mismatches 0 |
| tools/persistence-domain-signals.json 复核 | 读取成功 | ESLint warning 按调用/校验复核；Knip 仅有效全量结果 |
| tools/persistence-domain-clones.json 复核 | 读取成功 | 唯一 clone 不是自动违规 |

实际测试命令：

```sh
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm exec vitest run tests/repo.test.ts tests/repoReliability.test.ts tests/connectorMigration.test.ts tests/agentToolTransactions.test.ts tests/agentGenerationBatchSafety.test.ts tests/projectMemories.test.ts tests/materialIntegration.test.ts tests/audioFoundation.test.ts tests/agentProjectContext.test.ts tests/taskWrapup.test.ts
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm exec vitest run tests/agentTaskWrapup.test.ts tests/agentBatchPreparationRecovery.test.ts tests/auditDataIntegrity.test.ts tests/materialLibrary.test.ts
```

原始输出（本组只允许两个输出文件，因此直接记在报告，无新增日志文件）：

```text
首轮: Test Files 9 passed (9); Tests 87 passed (87); Duration 1.01s
第二轮: Test Files 4 passed (4); Tests 48 passed (48); Duration 820ms
ORPHAN_CREATE [{name:addCharacter,parentExists:false,orphanCount:1},{name:addScene,parentExists:false,orphanCount:1},{name:addProp,parentExists:false,orphanCount:1},{name:addStyle,parentExists:false,orphanCount:1}]
UNDO_BEFORE_DELETE {content:"new committed text",current:"new-image"}
UNDO_AFTER_RESTORE {content:"old text",current:"old-image",newMediaExists:false}
PATCH_BOUNDARY {strict:"素材已失效、类型不符或不属于当前项目，请重新选择",characterOwner:"A",referencedMediaOwner:"B",shotForeignAccepted:"foreign",cover:"missing-media"}
ORPHAN_MEDIA {projectExists:false,mediaExists:true}
OWNED_HASH_CHECK 50 []
```

PATCH_BOUNDARY 的随机项目 ID 为可读性替换成 A/B，其他值保持原结果；两个 ID 不相等。原始隔离命令见会话 exec 输出，下方提供同等最小复现逻辑。

辅助工具由主会话运行，其版本来自 tools/tool-versions.json：ESLint 9.39.5、typescript-eslint 8.71.0、TS 5.9.2、Knip 5.88.1、dependency-cruiser 17.4.3、jscpd 4.3.0。tools/knip-run.json exit 1（诊断存在），tools/eslint-run.json exit 1；dependency-cruiser-values-run.json exit 0。不是本子会话重新执行，不把这些 exit 直接视为产品失败。首次 production Knip 失效输出未作结论依据。主会话的完整 lint/test/build 基线在 tools/baseline-*-run.json，本组只报告独立的上述测试，未重复全量 lint/build。

## 附录：隔离最小复现逻辑

通过下列方式取得实际 TypeScript 模块，不启动产品配置插件：

```js
// /Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/node --input-type=module
import 'fake-indexeddb/auto';
import {createServer} from 'vite';
const server = await createServer({
  configFile:false, root:process.cwd(),
  resolve:{alias:{'@':process.cwd()+'/src'}},
  server:{middlewareMode:true,watch:null},
  optimizeDeps:{noDiscovery:true,include:[]}
});
const {db} = await server.ssrLoadModule('/src/db/database.ts');
const repo = await server.ssrLoadModule('/src/db/repo.ts');
try {
  await db.delete(); await db.open();
  const p = await repo.createProject('audit');
  await repo.deleteProject(p.id);
  for (const fn of ['addCharacter','addScene','addProp','addStyle']) {
    const row = await repo[fn](p.id);
    console.log(fn, row.projectId, !!await db.projects.get(p.id));
  }
  const q = await repo.createProject('undo');
  const ep = await repo.firstEpisode(q.id);
  const shot = await repo.addShot(q.id, ep.id);
  const media = id => ({id,projectId:q.id,mimeType:'image/png',filename:id+'.png',blob:new Blob([id],{type:'image/png'})});
  const slot = id => ({prompt:'',referenceImageIds:[],referenceVideoIds:[],result:{mediaId:id,kind:'image'}});
  await repo.putMedia(media('old-image'));
  await repo.setShotSlot(shot.id,'firstFrame',slot('old-image'));
  await repo.patchShot(shot.id,{content:'old text'});
  const snapshot = [await db.shots.get(shot.id)];
  const savedMedia = await db.media.bulkGet(['old-image']);
  await repo.putMedia(media('new-image'));
  await repo.setShotSlot(shot.id,'firstFrame',slot('new-image'));
  await repo.patchShot(shot.id,{content:'new committed text'});
  await repo.deleteEpisodeShots(ep.id,[shot.id]);
  await repo.restoreShots(snapshot,savedMedia);
  console.log(await db.shots.get(shot.id), !!await db.media.get('new-image'));
  const b = await repo.createProject('B');
  const c = await repo.addCharacter(q.id);
  await repo.putMedia({...media('foreign'),projectId:b.id});
  try {await repo.setCharacterSlot(c.id,'front',slot('foreign'));}
  catch(error) {console.log('strict rejected',error.message);}
  await repo.patchCharacter(c.id,{slots:{front:slot('foreign')}});
  await repo.patchShot(shot.id,{firstFrame:slot('foreign')});
  await repo.patchProjectOutput(q.id,{coverMediaId:'missing-media'});
  await repo.putMedia({...media('late-upload'),projectId:p.id});
  console.log('wide accepted',await db.characters.get(c.id),await db.projects.get(q.id),!!await db.media.get('late-upload'));
} finally {
  await db.delete(); await server.close();
}
```

报告不等价于浏览器多标签端到端、所有历史 schema 版本 fixture、容量性能基准、远端付费任务验证或全 tests 逐文件审查；这些是关键限度。覆盖清单每项 note 描述实际核验范围，findings 仅关联本组发现，不覆盖别人文件。
