# src 审查覆盖清单

基准：`2fc0e9523e62a5258a488cc3d0274d24c8967c6f`。392 个跟踪文件；状态统计：`{'reviewed': 389, 'generated-verified': 3}`。普通文件逐文件阅读；生成文件验证来源/生成链。工具覆盖与阅读覆盖分别登记，CSS/JSON没有ESLint结果不表示阅读遗漏。

## Agent 执行与工具机制

| 文件 | 阅读状态 | 结论 / 发现 |
|---|---|---|
| `src/lib/agent/activityAttention.ts` | reviewed | 已完整阅读。汇总任务活动提示、注意力和显示优先级；核验终态与等待确认分支，不以展示函数代替持久化状态约束。；未登记独立发现 |
| `src/lib/agent/audioGenerationTools.ts` | reviewed | 已完整阅读。音频生成工具的参数、预览、确认及执行适配；核验收费确认、当前草稿校验及项目归属。AR-03 的生成侧整数约束是下游契约证据。；AR-03 |
| `src/lib/agent/audioMusicToolNames.ts` | reviewed | 已完整阅读。音乐工具名常量；与音乐工具实现、技能目录及加载注册表核对。；未登记独立发现 |
| `src/lib/agent/audioProjectContext.ts` | reviewed | 已完整阅读。音频项目和音乐草稿的模型上下文投影；核验范围及缺失信息展示，不承担执行授权。；未登记独立发现 |
| `src/lib/agent/audioTools.ts` | reviewed | 已完整阅读。语音、音效等音频业务写工具；核验预览、任务写权限、事务写入及回执。；未登记独立发现 |
| `src/lib/agent/businessSchemas.ts` | reviewed | 已完整阅读。业务工具参数 schema 与枚举约束；核验整数、可选项、更新字段及模型 schema 对应关系。；未登记独立发现 |
| `src/lib/agent/businessStore.ts` | reviewed | 已完整阅读。按实体类别定位、读取、写入业务对象并核验项目；动态 BusinessRow 边界导致字段类型关系擦除，见 AR-05。；AR-05 |
| `src/lib/agent/businessToolNames.ts` | reviewed | 已完整阅读。业务工具名清单；与实现注册、技能组和发现目录逐项核对。；未登记独立发现 |
| `src/lib/agent/businessTools.ts` | reviewed | 已完整阅读。业务 CRUD、关联与资源写工具；核验跨项目检查、执行事务、预览和结果回执。动态 patch 与多层参数断言见 AR-05。；AR-05 |
| `src/lib/agent/businessWriteReceipt.ts` | reviewed | 已完整阅读。业务写回执构造及前后状态变化投影；核验创建、更新、删除和非变更分支。；未登记独立发现 |
| `src/lib/agent/chatTurns.ts` | reviewed | 已完整阅读。消息轮次归组和有效上下文选择；核验工具结果与模型消息配对。；未登记独立发现 |
| `src/lib/agent/contextCompaction.ts` | reviewed | 已完整阅读。历史上下文压缩、边界及摘要消息组织；核验保留当前轮次和工具调用关联。；未登记独立发现 |
| `src/lib/agent/contextPlanner.ts` | reviewed | 已完整阅读。上下文预算和选取顺序；核验可裁剪部分及最低保留量。；未登记独立发现 |
| `src/lib/agent/contextPolicy.ts` | reviewed | 已完整阅读。上下文策略常量及预算边界；未把固定阈值本身作为缺陷。；未登记独立发现 |
| `src/lib/agent/contextUsage.ts` | reviewed | 已完整阅读。上下文使用量估算与展示统计；区分估算预算和供应商实际 token 用量。；未登记独立发现 |
| `src/lib/agent/executionSummary.ts` | reviewed | 已完整阅读。工具/运行执行结果的摘要和状态汇总；核验成功、失败、等待确认等语义。；未登记独立发现 |
| `src/lib/agent/finishingCheck.ts` | reviewed | 已完整阅读。完成前检查及未解决工作提示；核验其与独立总结/持久化完成门禁的职责边界。；未登记独立发现 |
| `src/lib/agent/generationBatchRuntime.ts` | reviewed | 已完整阅读。生成批次同步、恢复和目标应用协调；核验批次状态来源与必要事务约束。；未登记独立发现 |
| `src/lib/agent/generationMedia.ts` | reviewed | 已完整阅读。生成媒体元信息与格式识别辅助；区分头部识别与完整解码，不声称已验证实际可播放性。；未登记独立发现 |
| `src/lib/agent/generationProfiles.ts` | reviewed | 已完整阅读。生成模型配置、能力及参数规格；核验模型选取和参数限制映射。；未登记独立发现 |
| `src/lib/agent/generationReview.ts` | reviewed | 已完整阅读。生成审核结果和确认信息的类型/辅助契约；与持久化审核和执行侧核对。；未登记独立发现 |
| `src/lib/agent/generationReviewDraft.ts` | reviewed | 已完整阅读。生成审核草稿转换与当前审核数据组织；核验可选字段和未确认状态。；未登记独立发现 |
| `src/lib/agent/generationRuntime.ts` | reviewed | 已完整阅读。生成提交、恢复、下载、应用、收费门禁和终态持久化；核验取消/失联不推断远端退款或回滚，值循环见 AR-04。；AR-04 |
| `src/lib/agent/generationSelection.ts` | reviewed | 已完整阅读。图片/视频生成目标选择及项目边界；核验角色、镜头等实体解析和缺失目标处理。；未登记独立发现 |
| `src/lib/agent/generationTools.ts` | reviewed | 已完整阅读。图片/视频生成工具 schema、预览和执行适配；核验任务权限、付费确认与可恢复 job 契约；类型擦除适配见 AR-05。；AR-05 |
| `src/lib/agent/imageDiscovery.ts` | reviewed | 已完整阅读。可用图片来源发现与当前目标匹配；核验归属、选择和证据展示，未假设发现即授权应用。；未登记独立发现 |
| `src/lib/agent/imageQueue.ts` | reviewed | 已完整阅读。图片操作排队和串行协调；核验任务失败后的队列继续语义。；未登记独立发现 |
| `src/lib/agent/ipToolNames.ts` | reviewed | 已完整阅读。IP 工具名常量；核对技能组、注册和加载目录。；未登记独立发现 |
| `src/lib/agent/ipTools.ts` | reviewed | 已完整阅读。IP 资源工具参数、预览和读写操作；核验资源归属、复用和任务写门禁。；未登记独立发现 |
| `src/lib/agent/libraryToolHelpers.ts` | reviewed | 已完整阅读。共享库工具定位、权限和辅助读取；核验项目范围与复用边界。；未登记独立发现 |
| `src/lib/agent/materialContent.ts` | reviewed | 已完整阅读。素材内容组织、读取及安全投影；核验文本/媒体种类和缺失内容处理。；未登记独立发现 |
| `src/lib/agent/materialImageInput.ts` | reviewed | 已完整阅读。素材图片输入解析和转换；核验类型、媒体归属及有效输入边界。；未登记独立发现 |
| `src/lib/agent/materialToolNames.ts` | reviewed | 已完整阅读。素材工具名常量；与素材实现、共享技能和加载表核对。；未登记独立发现 |
| `src/lib/agent/materialTools.ts` | reviewed | 已完整阅读。素材库搜索、读取、保存和应用工具；核验预览与执行两次检查、项目归属及事务回执。；未登记独立发现 |
| `src/lib/agent/memoryContext.ts` | reviewed | 已完整阅读。记忆读取和模型上下文组织；核验当前项目/任务范围及事务内读取限制。；未登记独立发现 |
| `src/lib/agent/memoryToolNames.ts` | reviewed | 已完整阅读。记忆工具名目录；与实现、技能范围及运行时注册核对。；未登记独立发现 |
| `src/lib/agent/memoryTools.ts` | reviewed | 已完整阅读。记忆查询、创建、修改和清理工具；核验范围、验证、写门禁及回执，未以内部导出告警认定死代码。；未登记独立发现 |
| `src/lib/agent/mimoSpeechSpec.ts` | reviewed | 已完整阅读。语音模型参数约束；核验范围和调用侧使用契约。；未登记独立发现 |
| `src/lib/agent/musicGenerationReview.ts` | reviewed | 已完整阅读。音乐生成审核、草稿快照及提交前校验；核验付费确认绑定当前输入。；未登记独立发现 |
| `src/lib/agent/musicGenerationReviewSnapshot.ts` | reviewed | 已完整阅读。音乐审核输入快照构造；核验序列化字段和比较契约。；未登记独立发现 |
| `src/lib/agent/musicReviewPresentation.ts` | reviewed | 已完整阅读。音乐审核的人类可读展示；区分显示字段与执行校验字段。；未登记独立发现 |
| `src/lib/agent/musicTools.ts` | reviewed | 已完整阅读。音乐草稿保存和读取工具；实际执行可完成保存 30.5 秒但后续生成拒绝，见 AR-03。；AR-03 |
| `src/lib/agent/projectContext.ts` | reviewed | 已完整阅读。项目故事、角色和镜头等模型上下文；核验数据范围与上下文职责，不将模型可见内容视作写授权。；未登记独立发现 |
| `src/lib/agent/projectScope.ts` | reviewed | 已完整阅读。任务与当前项目的一致性检查；核验缺失任务和跨项目拒绝。；未登记独立发现 |
| `src/lib/agent/referenceContext.ts` | reviewed | 已完整阅读。参考资料的模型上下文组织；核验选择、来源标记及缺失引用。；未登记独立发现 |
| `src/lib/agent/referenceEvidence.ts` | reviewed | 已完整阅读。参考资料来源、定位及可引用证据；核验引用资格和不可用来源处理。；未登记独立发现 |
| `src/lib/agent/referenceToolNames.ts` | reviewed | 已完整阅读。参考工具名常量；核对技能、发现和运行时实现。；未登记独立发现 |
| `src/lib/agent/referenceTools.ts` | reviewed | 已完整阅读。参考资料查询和读取工具；核验输入解析、范围、结果与证据回执。；未登记独立发现 |
| `src/lib/agent/runChat.ts` | reviewed | 已完整阅读。模型流、工具调度、加载、停止和运行归属协调；核验快照两次校验及停止后的持久化门禁，未把 AbortSignal 当作远端任务撤销。；未登记独立发现 |
| `src/lib/agent/runOwnership.ts` | reviewed | 已完整阅读。运行所有权与任务当前 run 核验；与数据库 CAS 写门禁及异步恢复调用关系核对。；未登记独立发现 |
| `src/lib/agent/runPresentation.ts` | reviewed | 已完整阅读。运行状态和工具结果展示；核验中断、等待确认、失败和终态语义。；未登记独立发现 |
| `src/lib/agent/runWriteOutcomes.ts` | reviewed | 已完整阅读。任务写结果和实体回执解析；核验成功/失败和部分结果处理，不替代执行授权。；未登记独立发现 |
| `src/lib/agent/skills.ts` | reviewed | 已完整阅读。技能目录、工具组和提示配置；与全部 89 个内建工具和任务/发现目录集合核对，无缺失或重复。；未登记独立发现 |
| `src/lib/agent/soundWriteReceipt.ts` | reviewed | 已完整阅读。声音业务写回执；核验资源标识、变更及上下文反馈。；未登记独立发现 |
| `src/lib/agent/taskContext.ts` | reviewed | 已完整阅读。任务计划、记录和当前状态上下文；核验读取与摘要边界。；未登记独立发现 |
| `src/lib/agent/taskState.ts` | reviewed | 已完整阅读。任务状态、计划转换和步骤标识处理；空白 ID 与更新规范化差异单列待核验，完整记录关联复现未成立。；未登记独立发现 |
| `src/lib/agent/taskTools.ts` | reviewed | 已完整阅读。任务创建、计划/记录/总结工具；核验当前任务权限和事务；步骤 ID 空白差异仅作待核验，未登记确认缺陷。；未登记独立发现 |
| `src/lib/agent/taskWrapup.ts` | reviewed | 已完整阅读。总结提示、来源快照和模型结果验证编排；作为 AR-01/AR-02 的外部消费链核验，根因在证据投影。；未登记独立发现 |
| `src/lib/agent/toolErrors.ts` | reviewed | 已完整阅读。工具错误分类、提示和重试语义；核验可重试标识不自动授权重复付费执行。；未登记独立发现 |
| `src/lib/agent/toolLoading.ts` | reviewed | 已完整阅读。内建工具注册、按技能发现/加载、限制和持久化加载协同；实际 89/89 对齐，单组未超过 36，值循环见 AR-04。；AR-04 |
| `src/lib/agent/tools.ts` | reviewed | 已完整阅读。公共工具参数接口、默认预览和执行调度辅助；核验写权限及参数解析，unknown 与 prepare/execute 的关系擦除见 AR-05。；AR-05 |
| `src/lib/agent/webToolNames.ts` | reviewed | 已完整阅读。网络搜索工具名常量；与技能和加载注册核对。；未登记独立发现 |
| `src/lib/agent/webTools.ts` | reviewed | 已完整阅读。网络工具输入、请求和响应适配；核验项目配置及错误反馈，未进行真实联网调用。；未登记独立发现 |
| `src/lib/agent/wrapupEvidence.ts` | reviewed | 已完整阅读。任务一致性快照、工具/生成/音频/记录证据投影；当前媒体资格风险 AR-01、拒绝调用被升级 AR-02 和 DB 值循环 AR-04。；AR-01, AR-02, AR-04 |
| `src/lib/agent/wrapupSchema.ts` | reviewed | 已完整阅读。总结结构校验和来源资格检查；AR-01/AR-02 中信任上游 supportsResult 字段的消费证据。；AR-01, AR-02 |
| `src/lib/agent/writeReceipt.ts` | reviewed | 已完整阅读。通用写回执和变更信息转换；核验返回结构、状态和调用侧消费。；未登记独立发现 |

## 数据与领域规则

| 文件 | 阅读状态 | 结论 / 发现 |
|---|---|---|
| `src/db/agentFinishingCheck.ts` | reviewed | 收尾 checkpoint 的 step/plan/ledger/响应信封与权限校验；unknown JSON try-catch 已核验，不直接采用 unsafe warning。；未登记独立发现 |
| `src/db/agentGeneration.ts` | reviewed | 付费请求 claim、防重复 fingerprint、迟到状态/媒体发布与项目删除守卫；与 runtime 调用对照。；未登记独立发现 |
| `src/db/agentGenerationBatches.ts` | reviewed | 逐个核验准备、草稿 CAS、确认、claim/dispatch、暂停/取消、选择/应用 revision 链、重试和恢复；值循环与宽事务归入结构债务。；PD-04, PD-05 |
| `src/db/agentProjectCreation.ts` | reviewed | 普通无项目对话创建例外、工具批准、参考输入/写入/生成历史阻断与一次绑定；类型依赖不按值循环误报。；未登记独立发现 |
| `src/db/agentRuns.ts` | reviewed | begin 冻结请求/历史、retry、checkpoint、finish、Web Lock 前提恢复、metrics；项目删后历史保留为合理契约。；PD-06 |
| `src/db/agentSettings.ts` | reviewed | 稳定单例/skillDefaultsVersion 迁移、空技能选择保留、权限更新与嵌套事务。；未登记独立发现 |
| `src/db/agentTaskRecords.ts` | reviewed | 记录来源/实际 effect、revision/history/去重、工具结果和任务 generation 当前事实；与 tasks/runtime 值循环。；PD-04 |
| `src/db/agentTaskWrapups.ts` | reviewed | 准备/发布/停止/确认 revision、最新 family、证据 fingerprint 与完成阻断；保留历史及 native Promise 浏览器限度。；PD-04, PD-06 |
| `src/db/agentTasks.ts` | reviewed | 线程唯一任务、项目绑定、editable/busy、计划/记录原子变更、lifecycle/wrapup 验收与 pin 归属。；PD-04 |
| `src/db/agentToolRecovery.ts` | reviewed | 仅特定 atomic preparation/legacy plan 恢复；generation 未知不重发；所属及完整证据核验。；未登记独立发现 |
| `src/db/agentTools.ts` | reviewed | 工具步骤/审批/恢复/结果信封、计划/ledger 原子写、取消、preview、生成 override CAS；纯选择规则反向依赖。；PD-04 |
| `src/db/audio.ts` | reviewed | 全部 validate/add/patch/delete、章节级联保留、snapshot、批量 clip CAS、音乐跨项目独立复制；音频不强行与视频归一。；未登记独立发现 |
| `src/db/audioGeneration.ts` | reviewed | intent 唯一/claim revision、引用 fingerprint、转换 NEXT、结果所属、dormant 历史禁止执行。；未登记独立发现 |
| `src/db/audioShared.ts` | reviewed | 表范围、project kind、metadata、owned/revision、共享 patch、历史结果 detach；add 新 ID CAS 合理。；未登记独立发现 |
| `src/db/contextSettings.ts` | reviewed | thread/default/reset/saved context policy 的规范化与原子事务；嵌套 get config scope 完整。；未登记独立发现 |
| `src/db/database.ts` | reviewed | 46 表、v1–23 index/upgrade；legacy episode/slot/filter、v20 alias/v21 unique connector 升级与实际迁移测试。；PD-05, PD-06 |
| `src/db/generationPreferences.ts` | reviewed | 只读未初始化、失效选项显式 issue、save/clear 单 modality 保留另一侧，config 默认事务。；未登记独立发现 |
| `src/db/ipProfiles.ts` | reviewed | 文本边界、revision CAS、归档、关联项目 scope，IP 归档保留关联为现有契约。；未登记独立发现 |
| `src/db/materials.ts` | reviewed | 文件类型/大小、scope、snapshot/version、archive/delete、adopt remap、旧副本/指纹 guard、use 幂等；unused usage export 仅维护项。；PD-05, PD-08 |
| `src/db/memoryRetrieval.ts` | reviewed | project/thread scope、active+reviewed+exclude 选择、thread exclusion 类型与归属检查；readonly 嵌套完整。；未登记独立发现 |
| `src/db/music.ts` | reviewed | settings discriminant/参数、media owner、draft/work add/patch/CAS/delete、detach job output；引用媒体保留策略核验。；未登记独立发现 |
| `src/db/productionProposals.ts` | reviewed | target/source/change 验证、创建/应用/撤销 full entity revision、旧/新 result 保留；宽 repo 耦合关联。；PD-05 |
| `src/db/projectMemories.ts` | reviewed | 全文件 create/promote/update/disable/replace/delete、sameContent/source 去重、topic conflicts、revision/history/source summary 归属；宽事务。；PD-06 |
| `src/db/references.ts` | reviewed | 原始文件与 chunk 同 snapshot、revision/scope/status、whole chunk budget、search/remove/媒体回收；级联策略。；PD-05 |
| `src/db/repo.ts` | reviewed | 全 1887 行所有函数；父子、delete/restore/order、slots/media、studio copy、材料释放、connector aliases、chat cascade、audio seed；两个隔离确认缺陷与 API 风险；clone 按契约核验。；PD-01, PD-02, PD-03, PD-05, PD-07, PD-08 |
| `src/db/searchConnections.ts` | reviewed | Tavily key/revision local-only、启用技能原子更新、移除/读取状态；无凭据输出。；未登记独立发现 |
| `src/db/taskAudioGenerationEvidence.ts` | reviewed | 原提交 task/run/call/project 归属、批准快照、当前可用结果/采用证据、check 不转移归属。；未登记独立发现 |
| `src/domain/agent.ts` | reviewed | run/tool/permission/continuation/metrics/task 全类型、冻结凭据与输入边界，type-only 互依不等于运行时环。；未登记独立发现 |
| `src/domain/agentGeneration.ts` | reviewed | single call vs batch/item 判别联合、provider identity、no key、状态与结果字段。；未登记独立发现 |
| `src/domain/agentGenerationBatch.ts` | reviewed | batch/item/snapshot/request 类型、target/entity key、20/4/同 owner 限制；lib 参数依赖为 type-only，迁移有序建议。；PD-04 |
| `src/domain/agentTaskRecords.ts` | reviewed | kind/claim/source union、record/version 身份与 revision；持久化 schema 对照。；未登记独立发现 |
| `src/domain/agentTaskWrapup.ts` | reviewed | content/evidence/snapshot/status/current-family/history 类型与 repository/证据流程对照。；未登记独立发现 |
| `src/domain/audio.ts` | reviewed | AudioRow revision、segment selection 与 timeline placement 分离、不可变 take/metadata、export scope、input/patch 类型。；未登记独立发现 |
| `src/domain/audioGeneration.ts` | reviewed | speech/music 判别输入、独立状态机、provider observation、result deleted、origin/dormant/claim 类型。；未登记独立发现 |
| `src/domain/columns.ts` | reviewed | 列定义/可见列兼容归一；合法 UI 列状态，不以少量重复字面量报错。；未登记独立发现 |
| `src/domain/context.ts` | reviewed | policy/snapshot/source/compaction、reference memory 分层与 frozen request type 对照。；未登记独立发现 |
| `src/domain/generationPreferences.ts` | reviewed | selection vs preference（mode 不落默认值）、失效 issue 模型；与读取/更新入口核验。；未登记独立发现 |
| `src/domain/imageDiscovery.ts` | reviewed | locator/provenance/result 类型及 persisted source UI decoder，有限展示与 /p/ 链接限制；无利用证据不报漏洞。；未登记独立发现 |
| `src/domain/materials.ts` | reviewed | scope/setting/file discriminant、immutable version snapshot、pinned MaterialUse/supersededBy 与 event。；未登记独立发现 |
| `src/domain/memoryRetrieval.ts` | reviewed | 选中 memory entry/revision/source、审计、预算/遗漏统计与 query option 类型。；未登记独立发现 |
| `src/domain/music.ts` | reviewed | Flow/Suno 判别 settings、独立 draft/work、source metadata/provenance 与默认字段。；未登记独立发现 |
| `src/domain/output.ts` | reviewed | provider profile/constants、shape 保留未知/extra 与可用参数 validate 分层；未做最新远端模型规格查询。；未登记独立发现 |
| `src/domain/production.ts` | reviewed | typed target slot/change/source/revision/proposal/generationIntent 的不同生命周期语义；不强行合并 generation job。；未登记独立发现 |
| `src/domain/projectContext.ts` | reviewed | project snapshot/fingerprint/content 与 video/audio coverage 类型，无运行依赖。；未登记独立发现 |
| `src/domain/projectMemory.ts` | reviewed | memory status/source/imported history/replacement/options/schema 对照；topic/content 去重是明确不同业务契约。；未登记独立发现 |
| `src/domain/referenceInput.ts` | reviewed | wire identity/coverage/vision/audit/material/discovery 类型、referenceInputOf 去 envelope，媒体字节不持久化在身份字段。；未登记独立发现 |
| `src/domain/references.ts` | reviewed | source attachment/revision/status/chunk/locator/coverage limits 及标签 helper；与 db source readonly 事务对照。；未登记独立发现 |
| `src/domain/search.ts` | reviewed | public URL canonicalization/IP 范围和 persisted source bounded decoder；仅本地规则审查，无 DNS/proxy 端到端安全结论。；未登记独立发现 |
| `src/domain/slot.ts` | reviewed | empty/parse/collect/remap/legacy merge/shot slots 全函数；与 migration/import/retention 对照，兼容 parse 不冒充严格输入校验。；未登记独立发现 |
| `src/domain/types.ts` | reviewed | 全 571 行实体/状态/filter/setting/story/aspect/kind/connector/chat 类型和 normalizers；legacy 宽容解析与严格 owner/输入边界分开。；未登记独立发现 |

## Agent 与记忆 UI

| 文件 | 阅读状态 | 结论 / 发现 |
|---|---|---|
| `src/components/agent/AgentActivityNavigation.tsx` | reviewed | 按thread重置的活动定位Context；不承担执行授权或运行状态机。；未登记独立发现 |
| `src/components/agent/AgentChatPage.tsx` | reviewed | 入口查询、选择镜像与发送/重试/审批编排；复核取消、Web Lock、线程身份、草稿作用域及回调依赖。；AU-02, AU-08, AU-10 |
| `src/components/agent/AgentComposerAttention.tsx` | reviewed | 按线程聚合待处理工具/批次/任务提示；仅导航提醒，实际动作仍在执行层校验。；未登记独立发现 |
| `src/components/agent/AgentControls.tsx` | reviewed | 助手配置与权限说明、技能开关及菜单焦点；说明针对新运行，实际权限使用冻结快照。；未登记独立发现 |
| `src/components/agent/AgentGenerationBatches.tsx` | reviewed | 逐段核对批次读取身份、revision、同步pending锁、SPA blocker、预览与队列动作；共享生成字段承载规则矩阵。；AU-07 |
| `src/components/agent/AgentGenerationResults.tsx` | reviewed | 单次结果与持久批次组合；批次子树稳定，不因单次job列表出现而重挂。；未登记独立发现 |
| `src/components/agent/AgentRunDetails.tsx` | reviewed | 工具/运行过程展示、审批和恢复入口、按归属过滤工具；RunAction为类型边，富Markdown进入懒加载消息图。；AU-09 |
| `src/components/agent/AgentWriteOutcomes.tsx` | reviewed | 消费已规范化写入回执；区分历史写入结果与当前对象可用性。；未登记独立发现 |
| `src/components/agent/ChatWorkspace.tsx` | reviewed | 布局、composer安全留白、侧栏及MessageList lazy；工作区key不能重置父层文本草稿。；AU-05, AU-09, AU-10 |
| `src/components/agent/ContextCompactionDetails.tsx` | reviewed | 压缩记录展示与详情展开；不发起压缩或改写历史消息。；未登记独立发现 |
| `src/components/agent/ContextParameters.tsx` | reviewed | 参数控件局部互斥有效，但局部patch展开为旧快照整对象再持久化。；AU-03 |
| `src/components/agent/ContextUsagePanel.tsx` | reviewed | 核对范围身份、冻结运行与下次请求预览、预算和工具组装；触发器及弹层各自调用整套查询Hook。；AU-06, AU-09 |
| `src/components/agent/CreatedEntityLinks.tsx` | reviewed | 工具结果链接规范化与项目续聊；只接受站内路径并检查关联项目/线程。；未登记独立发现 |
| `src/components/agent/FloatingComposer.tsx` | reviewed | 输入、发送快捷键、语音和扩展面板；Effect清理与IME判断已读，文本由父层供给。；AU-10 |
| `src/components/agent/GenerationReview.tsx` | reviewed | 单次提案编辑、批准前校验和保存默认值；共享字段中仍内嵌供应商能力/时长等规则。；AU-07 |
| `src/components/agent/Grainient.tsx` | reviewed | 完整读取shader及WebGL生命周期；资源释放、不可用回退、可见性/降动效逻辑均已核对。；未登记独立发现 |
| `src/components/agent/HomeWelcome.tsx` | reviewed | 欢迎页、近期线程与任务入口；复用composer，不负责运行持久化。；未登记独立发现 |
| `src/components/agent/LobeChatTheme.tsx` | reviewed | 聊天范围的Lobe/antd主题与CSS入口；未导入全局antd reset。；未登记独立发现 |
| `src/components/agent/MemoryContextDetails.tsx` | reviewed | 当前预览和历史冻结记忆/参考来源、排除操作及可用性；观察显示与真实历史请求分开。；未登记独立发现 |
| `src/components/agent/MessageList.tsx` | reviewed | 逐行读消息memo、滚动意图、ResizeObserver、工具归属过滤及稳定批次子树；富渲染包体风险。；AU-09 |
| `src/components/agent/ModelIconCatalog.ts` | reviewed | 普通手写的三行命名重导出；不是生成文件，动态边界仍连接完整模型/供应商匹配图。；AU-09 |
| `src/components/agent/ModelIcons.tsx` | reviewed | 两个named lazy共享Catalog模块，Suspense占位固定尺寸；lazy不等于缩小目录模块。；AU-09 |
| `src/components/agent/ModelSelectTrigger.tsx` | reviewed | 连接/模型菜单、能力说明、搜索及图标；已选模型的常驻chip就会触发Catalog加载。；AU-09 |
| `src/components/agent/ModelSettingsMenu.tsx` | reviewed | 模型/推理设置菜单；只提交选择，不负责权限或执行调度。；未登记独立发现 |
| `src/components/agent/MusicGenerationReview.tsx` | reviewed | 音乐提案快照、准备状态、批准前复核和费用提示；RunAction为import type。；未登记独立发现 |
| `src/components/agent/ProjectImageSources.tsx` | reviewed | 消费规范化项目图片来源并展示原始依据；不将URL标签当图片真实性证据。；未登记独立发现 |
| `src/components/agent/ProjectPicker.tsx` | reviewed | 项目选择/创建、同步互斥和错误反馈；页面级repository调用符合现有规范。；未登记独立发现 |
| `src/components/agent/ReferenceAttachments.tsx` | reviewed | 附件、来源预览与消息引用；blob URL清理依赖资源身份，未把整对象缺失告警直接判为失效。；未登记独立发现 |
| `src/components/agent/ReferenceLibrary.tsx` | reviewed | 作用域内来源读取、导入重试和选择；异步选择闭包仍携带旧scope，未证实跨线程误附。；未登记独立发现 |
| `src/components/agent/TaskBoard.tsx` | reviewed | 任务分组、筛选和创建；纯UI分组与repository事务分离。；未登记独立发现 |
| `src/components/agent/TaskInspector.tsx` | reviewed | 任务概览编辑、状态动作与总结锁联动；记录编辑状态未上报，route key变化仍会卸载编辑器。；AU-02 |
| `src/components/agent/TaskRecords.tsx` | reviewed | 记录/工具/生成依据聚合和手动记录表单；关闭直接丢弃，未提供SPA或unload草稿保护。；AU-02 |
| `src/components/agent/TaskWrapup.tsx` | reviewed | 总结读取保留最后有效值、CAS、取消/恢复和记忆提升；路由离开草稿保护及候选身份存在缺口。；AU-01, AU-02 |
| `src/components/agent/ThinkingMatrix.tsx` | reviewed | 空流动画、计时器和卸载清理；动画行数/复杂度没有直接作为缺陷。；未登记独立发现 |
| `src/components/agent/ThinkingPanel.tsx` | reviewed | 思考文本、展开状态与完成状态联动；展示组件不改变运行判断。；未登记独立发现 |
| `src/components/agent/TopicSidebar.tsx` | reviewed | 标题筛选、时间组与主题动作；子动作键盘事件被行级Enter/Space处理截获。；AU-04 |
| `src/components/agent/TurnNavigation.tsx` | reviewed | 回合定位、滚动/resize监听和清理；导航能力不进入执行状态机。；未登记独立发现 |
| `src/components/agent/WebResearchSources.tsx` | reviewed | 消费规范化网络检索来源和摘要；未直接信任未解析工具结果。；未登记独立发现 |
| `src/components/agent/agentChat.css` | reviewed | 全文读取全部1623行，含全部media规则；窄屏规则随后被同优先级基础规则及shorthand覆盖。；AU-05 |
| `src/components/agent/agentTheme.ts` | reviewed | 布局常量与预留tokens；CHAT_SAFE_X=16支持CSS覆盖证据，未用导出/行数告警推断运行故障。；AU-05 |
| `src/components/agent/composerAttention.css` | reviewed | 全文读取提示条、动作与窄屏样式；未确认独立缺陷。；未登记独立发现 |
| `src/components/agent/composerControls.css` | reviewed | 全文读取模型/权限/plus面板和扩展编辑器样式、响应式与交互态；未确认独立缺陷。；未登记独立发现 |
| `src/components/agent/composerTypes.ts` | reviewed | composer输入/回调契约；类型导入不产生运行时依赖边。；未登记独立发现 |
| `src/components/agent/contextParameters.css` | reviewed | 全文读取参数表单、开关、高级预算及反馈样式；数据覆盖问题不归因于CSS。；未登记独立发现 |
| `src/components/agent/executionActivity.css` | reviewed | 全文读取时间线、审批控件、结果面板与响应式状态；未确认独立缺陷。；未登记独立发现 |
| `src/components/agent/filterThreadsByTitle.ts` | reviewed | 纯标题筛选；归一化输入与原数组顺序逻辑已读。；未登记独立发现 |
| `src/components/agent/generationBatch.css` | reviewed | 全文读取批次配置/候选/状态/预览与移动布局；未以选择器或行数告警判为业务故障。；未登记独立发现 |
| `src/components/agent/homeGrainient.css` | reviewed | 全文读取装饰画布定位、遮罩与交互隔离；未确认独立缺陷。；未登记独立发现 |
| `src/components/agent/memoryContext.css` | reviewed | 全文读取记忆详情sheet、来源和预算状态布局；未确认独立缺陷。；未登记独立发现 |
| `src/components/agent/references.css` | reviewed | 全文读取参考来源库、附件、媒体与文本预览规则；未确认独立缺陷。；未登记独立发现 |
| `src/components/agent/taskWorkspace.css` | reviewed | 全文读取任务board/inspector/dialog及窄屏布局；草稿损失根因在状态/卸载边界。；未登记独立发现 |
| `src/components/agent/taskWrapup.css` | reviewed | 全文读取总结编辑、依据、历史和冲突反馈样式；未确认独立CSS缺陷。；未登记独立发现 |
| `src/components/agent/timeGroups.ts` | reviewed | 纯时间分组及标签，逐函数核对；不拥有任务生命周期。；未登记独立发现 |
| `src/components/agent/turnNavigation.css` | reviewed | 全文读取回合导航、hover/focus和移动留白；该样式的左侧额外留白不修复composer底部safe-area覆盖。；未登记独立发现 |
| `src/components/agent/useReferenceDraft.ts` | reviewed | 按scope保存附件/导入草稿，异步返回作用域捕获和卸载abort；与父层单字符串文本作用域不同。；AU-10 |
| `src/components/memory/MemoryEditor.tsx` | reviewed | 记忆CAS、冲突读取、dirty blocker均已读；初始化draft固定但来源props可被候选并发更新替换。；AU-01 |
| `src/components/memory/MemoryPromotion.tsx` | reviewed | 逐条异步读取确认总结候选；每条独立pending，不协调父层候选请求身份。；AU-01 |
| `src/components/memory/ProjectMemoryPage.tsx` | reviewed | 记忆列表/详情/历史及编辑流程完整阅读；路由key正确覆盖project与memory深链身份。；未登记独立发现 |
| `src/components/memory/memory.css` | reviewed | 全文读取记忆页/编辑/冲突/来源及全部media规则；未确认独立样式缺陷。；未登记独立发现 |
| `src/components/memory/memoryLabels.ts` | reviewed | 纯分类/来源标签映射；未把presentation helper提升为业务层。；未登记独立发现 |
| `src/components/memory/readMemory.ts` | reviewed | 将读取失败显式包装data/error；未当作缺失数据悄然继续写。；未登记独立发现 |

## 创作 UI

| 文件 | 阅读状态 | 结论 / 发现 |
|---|---|---|
| `src/components/assets/AssetLibraryPage.tsx` | reviewed | 完整阅读1–483；四类资产查询、创建/删除、studio snapshot批量复制、搜索；copySelection与busy close保留失败选择。；未登记独立发现 |
| `src/components/assets/AssetTextField.tsx` | reviewed | 完整阅读1–32；字段级draftKey、project scope、baseline persist、错误/重试/采用最新；合理保留。；未登记独立发现 |
| `src/components/assets/CharacterDetailPage.tsx` | reviewed | 完整阅读1–160；owner/missing、字段CAS、slot接线、return tab；槽target和同owner ID切换需隔离。；PU-02, PU-05 |
| `src/components/assets/PropDetailPage.tsx` | reviewed | 完整阅读1–171；studio默认back、owner、可选文本字段CAS、slot接线、return tab。；PU-02, PU-05 |
| `src/components/assets/SceneDetailPage.tsx` | reviewed | 完整阅读1–157；owner/missing、文本字段CAS、lighting/geography、slot与return tab。；PU-02, PU-05 |
| `src/components/assets/StyleDetailPage.tsx` | reviewed | 完整阅读1–163；owner/missing、palette/lens/negativePrompt字段CAS、slot接线。；PU-02, PU-05 |
| `src/components/assets/WorldSettingPanel.tsx` | reviewed | 完整阅读1–94；project keyed editor、setting normalize、changedDraftFields/baseline草稿与错误恢复；合理保留。；未登记独立发现 |
| `src/components/audio/AudioExports.tsx` | reviewed | 完整阅读1–45；export history、schedule fingerprint、旧章节标签、预览/下载错误；现场播放未测。；未登记独立发现 |
| `src/components/audio/AudioInspector.tsx` | reviewed | 完整阅读1–138；voice/source/export、版本选择/adoption、track append/pause校验、take删除保护、keyed notes；仓库再校验关系。；PU-08 |
| `src/components/audio/AudioSources.tsx` | reviewed | 完整阅读1–257；upload段落冻结、decode/MIME、录音生命周期/关闭保护/URL清理、library adopt；useMaterialInProject为plain async，Hook告警排除。；未登记独立发现 |
| `src/components/audio/AudioTimeline.tsx` | reviewed | 完整阅读1–754；buffer、playEpoch/composition/chapter生命周期、history、drag/snap/scrub/shortcuts、export snapshot、Waveform cancel、属性；engine有resume后generation校验。；PU-08 |
| `src/components/audio/AudioWorkspacePage.tsx` | reviewed | 完整阅读1–275；snapshot identity、三种选择联动、chapter事务、Voices/source/Sheet/timeline；外部route已按projectId加key。；PU-08 |
| `src/components/audio/MimoConnection.tsx` | reviewed | 完整阅读1–41；显式保存连接、URL校验、busy/error、凭据仅入connector repository；合理保留。；未登记独立发现 |
| `src/components/audio/ScriptDocument.tsx` | reviewed | 完整阅读1–255；段落草稿CAS、resize清理、split/paste基线、空行backspace、ordering/role/试听；未全面验证IME。；未登记独立发现 |
| `src/components/audio/SpeechControls.tsx` | reviewed | 完整阅读1–103；默认profile/connector、flush后段落/speaker重验、显式生成/voice修改、mimo direction/optimize；合理保留。；未登记独立发现 |
| `src/components/audio/VoiceLibrary.tsx` | reviewed | 完整阅读1–205；音色编辑/试音/保存分离、revision CAS、referenceBusy、MiMo迁移；未保存配置dirty退出风险。；PU-10 |
| `src/components/audio/VoiceReferencePicker.tsx` | reviewed | 完整阅读1–81；媒体owner、容器/大小校验、必要WAV副本、busy传播/试听；显式参考上传持久化合理。；未登记独立发现 |
| `src/components/audio/story-workspace.css` | reviewed | 完整阅读1–758全部CSS规则/声明与media/cascade；连续稿件后段覆盖、inspector/Sheet/窄屏；旧heading/reading规则无当前消费者。；PU-09 |
| `src/components/audio/timeline.css` | reviewed | 完整阅读1–718全部CSS规则/声明与media/cascade；at transport/track/clip/trim/focus及移动编辑模式；功能性音轨颜色合理，未视觉回归。；未登记独立发现 |
| `src/components/audioMusic/controls.tsx` | reviewed | 完整阅读1–189；empty select sentinel、scalar slider adapter、SourcePlayer事件/互斥/src变化、Disclosure；当前契约合理，避免泛化工厂。；未登记独立发现 |
| `src/components/audioMusic/shared.tsx` | reviewed | 完整阅读1–185；SavedText、connector filtering、AudioPlayer、project job轮询/paused集合/manual refresh/activity；不因useX命名判Hook错误。；未登记独立发现 |
| `src/components/audioMusic/workspace.css` | reviewed | 完整阅读1–919全部CSS规则/声明与响应式；真实aw共享控件及无消费者旧aw timeline/music整页规则；未视觉回归。；PU-09 |
| `src/components/media/MediaPicker.tsx` | reviewed | 完整阅读1–51；same-owner query、reusableMedia kind/nonempty、复用ID不获upload所有权；提交校验合理保留。；未登记独立发现 |
| `src/components/media/MediaThumb.tsx` | reviewed | 完整阅读1–39；useMedia、image/video tile与inspect controls、placeholder/object fit；合理保留。；未登记独立发现 |
| `src/components/music/MusicCreation.tsx` | reviewed | 完整阅读1–153；settings草稿CAS、flush后准备/显式生成、分模式字段/disabled；Partial union断言仅局部类型改进，未确认非法组合。；PU-08 |
| `src/components/music/MusicWorkspacePage.tsx` | reviewed | 完整阅读1–299；keyed project、variant links/真实draft、action/submission mutex、works/queue/详情、audio独立副本；无文本第二存储。；PU-08 |
| `src/components/music/draftVariants.ts` | reviewed | 完整阅读1–57；simple/custom/Flow独立draft、description不作为lyrics、ID-only links parse/link；丢链接新增draft是已接受降级。；未登记独立发现 |
| `src/components/music/music-workspace.css` | reviewed | 完整阅读1–421全部CSS规则/声明与响应式；mw布局/控件/作品/详情/移动播放器、断点/shared cascade；无确认独立缺陷，未视觉回归。；未登记独立发现 |
| `src/components/produce/ProducePage.tsx` | reviewed | 完整阅读1–258；project+episode keyed inner、media等待、shared deriveDelivery、handoff/CSV/print/proposals；重复查询接线可按契约收敛，不用倒置clone坐标作证。；PU-08 |
| `src/components/produce/ProductionProposalsPanel.tsx` | reviewed | 完整阅读1–256；revision冻结/preview/apply/undo/cancel、dirty close/target/mode切换、busy/media picker；guarded仓库与合理UI边界。；未登记独立发现 |
| `src/components/produce/StoryboardPrintPage.tsx` | reviewed | 完整阅读1–169；query门、shared deriveDelivery、素材fallback/full prose/print；同项目换集风险；有效clone仅为scope query与relation query接线。；PU-05, PU-08 |
| `src/components/shots/DurationInput.tsx` | reviewed | 完整阅读1–44；raw decimal/parse/稳定key/序列化/error恢复正确；persist忽略baseline已隔离复现。；PU-03 |
| `src/components/shots/ShotEditorPage.tsx` | reviewed | 完整阅读1–2034含bulk/undo/keyboard/DnD/BeatBlock/ShotRow/relations全部内容；逆补丁、同快照角色、scope、直写草稿/职责；default switch非bug。；PU-01, PU-02, PU-04, PU-05, PU-06, PU-08 |
| `src/components/shots/ShotRowViewport.tsx` | reviewed | 完整阅读1–40；共享IntersectionObserver/rootMargin/listener cleanup与row anchor；合理保留完整排序/深链/Tab，未浏览器验证。；未登记独立发现 |
| `src/components/slots/GenerationSlotCard.tsx` | reviewed | 完整阅读1–495；tile/ref/editor/upload/save/close/cleanup/retry、owned uploads与复用正确；整槽CAS与target/session隔离缺口。；PU-02, PU-05 |
| `src/components/story/StoryPage.tsx` | reviewed | 完整阅读1–354；episode keyed story草稿CAS、file.text、scriptRange、beat reorder/duplicate/delete undo、直写场次/角色；外部repo仅核实。；PU-04, PU-05, PU-06, PU-07 |

## 模型、媒体、音频与参考接入

| 文件 | 阅读状态 | 结论 / 发现 |
|---|---|---|
| `src/lib/ai/aihubmix.ts` | reviewed | 原文件完整阅读；public discovery/鉴权分离、native task identity、输出索引与 protected content 路径校验；入站 blob 上限风险。 jscpd clone 源码已核对：record/nonempty/finite 同语义；jsonValue 函数体不相同（plain prototype guard），隔离行为比较见报告，未机械合并。；PM-05, PM-07 |
| `src/lib/ai/apimart.ts` | reviewed | 原文件完整阅读；200/202 envelope、Ext header/idempotency、native payload、upload/query、key 脱敏与不重试；基础请求 guard 复制。 jscpd clone 源码已核对：record/nonempty/finite 同语义；jsonValue 函数体不相同（plain prototype guard），隔离行为比较见报告，未机械合并。；PM-07 |
| `src/lib/ai/apimartAudio.ts` | reviewed | 原文件完整阅读；speech/music schema、task 数组与原始 audioIndex、body/下载边界；已复现重复 ID、点段路由与取消分类。；PM-03, PM-04, PM-05, PM-06, PM-07 |
| `src/lib/ai/catalog.ts` | reviewed | 完整阅读能力目录、默认连接与 provider key 映射；未确认独立缺陷。；未登记独立发现 |
| `src/lib/ai/chatModelPolicy.ts` | reviewed | 完整阅读 connector 身份/credential 内存比较、兼容检查与所有 options 来源；MiMo 常量耦合见职责建议，无独立已证行为 bug。；未登记独立发现 |
| `src/lib/ai/chatStream.ts` | reviewed | 完整阅读 reasoning 状态、strict tool accumulator、SSE CRLF/EOF/结束、取消与 metrics；回答/event 无总量上限风险。；PM-05 |
| `src/lib/ai/connectors.ts` | reviewed | 完整阅读 provider dispatch、known media block、catalog freshness/isCurrent 与发送前检查；通用探测缺陷及 signal 丢失已核验。；PM-02, PM-07 |
| `src/lib/ai/mimoSpeech.ts` | reviewed | 完整阅读 preset/design/clone、10 MiB encoded reference、固定 /models 与 /chat/completions、base64 WAV 和 preview；入站完整 text/base64 分配风险。；PM-05, PM-07 |
| `src/lib/ai/modelBank/README.md` | reviewed | 完整阅读 provenance、full/lazy dataset、exact provider-ID fallback、生成/verify 与 upstream 不改契约。；未登记独立发现 |
| `src/lib/ai/modelBank/index.ts` | reviewed | 完整阅读 limit lookup 与 full lazy 数据接入、original vendor/conflict fallback、vision derive；模型 ID 结构检查与现有 tests 通过。；未登记独立发现 |
| `src/lib/ai/modelBank/lookup.generated.json` | generated-verified | 生成文件未人工逐行审核；已全量 JSON 解析、结构/provider/ID 检查、源 manifest 与 license SHA-256 核验，读取 README/adapter/生成脚本，独立 node scripts/model-bank-snapshot.mjs verify 精确再生成比对通过（197 files/85 providers/1855 models）；modelBank 接入 tests 通过。本文件为全部 source path 与每 provider 模型 token limit 索引。；未登记独立发现 |
| `src/lib/ai/modelBank/models.generated.json` | generated-verified | 生成文件未人工逐行审核；已全量 JSON 解析、结构/provider/ID 检查、源 manifest 与 license SHA-256 核验，读取 README/adapter/生成脚本，独立 node scripts/model-bank-snapshot.mjs verify 精确再生成比对通过（197 files/85 providers/1855 models）；modelBank 接入 tests 通过。本文件为完整字段/provider records 的 lazy dataset。；未登记独立发现 |
| `src/lib/ai/modelMetadata.ts` | reviewed | 完整阅读显式正整数、field-by-field provider 优先与 provenance、duplicate 最小 limit；未确认独立缺陷。；未登记独立发现 |
| `src/lib/ai/modelVendors.ts` | reviewed | 完整阅读展示分组/name/hints heuristic；与 authoritative vision/wire policy 区分，未发现此处授权付费能力。；未登记独立发现 |
| `src/lib/ai/openaiCompatible.ts` | reviewed | 完整阅读 URL/auth/mask、listModels/probe/fallback、错误脱敏；已复现 HTTP 200 HTML/error 被误判成功。；PM-02, PM-07 |
| `src/lib/ai/reasoningPolicy.ts` | reviewed | 完整阅读 explicit wire allowlist、provider effort 策略与 Chat/Responses dispatch；没有把 model-bank 作为 wire 授权。；未登记独立发现 |
| `src/lib/ai/referenceWire.ts` | reviewed | 完整阅读真实像素、project/run/reference 归属、编码后重验、历史 tool 输出投影、两种 wire；目录 orchestration 建议见报告，无独立缺陷。；未登记独立发现 |
| `src/lib/ai/responsesStream.ts` | reviewed | 完整阅读 stateless input/output、strict final tool、opaque reasoning、SSE 4 MiB/terminal/cancel；已复现 finishReason 绕过脱敏。；PM-01 |
| `src/lib/ai/safeError.ts` | reviewed | 完整阅读 exact key/Bearer 脱敏，确认截断前处理；无独立已确认缺陷。；未登记独立发现 |
| `src/lib/ai/tavily.ts` | reviewed | 完整阅读 fixed URL、key/revision、30s abort、2 MiB stream cap、source/redaction/total budgets；基础请求 guard 与其他 adapter 策略差异。；PM-07 |
| `src/lib/ai/visionCapability.ts` | reviewed | 完整阅读 explicit provider metadata 优先、exact bank fallback 与 fail-closed requireVision。；未登记独立发现 |
| `src/lib/audio/commands.ts` | reviewed | 完整阅读 split fade 限制、immutable source、chapter-document CAS undo/redo/duplicate/remove 和 50-entry history。；未登记独立发现 |
| `src/lib/audio/engine.ts` | reviewed | 完整阅读 decode/32 MiB/64 MiB、LRU、schedule shared graph、player epoch/dispose、offline preflight/取消丢弃；限制晚于入站读取。；PM-05 |
| `src/lib/audio/mime.ts` | reviewed | 完整阅读 container signature、declared codec fallback、extension；所有相关调用者需 decode，未将 fallback 当作 signature proof。；未登记独立发现 |
| `src/lib/audio/recorder.ts` | reviewed | 完整阅读 getUserMedia epoch、final chunks/stop、32 MiB 限制、错误/舍弃/dispose、track/node/context 清理；已有 recorder tests 通过。；未登记独立发现 |
| `src/lib/audio/schedule.ts` | reviewed | 完整阅读 ownership inputs、gain/fades、audible chapter 拼接、trim 与 seek envelope；mute 改 duration 为已有显式测试契约，排除误报。；未登记独立发现 |
| `src/lib/audio/scriptImport.ts` | reviewed | 完整阅读最多 200 逻辑行、原子 append、baseline/selection 检查、fractional order 插入与 repository ownership/CAS。；未登记独立发现 |
| `src/lib/audio/shortcuts.ts` | reviewed | 完整阅读焦点/blocked/composition/repeat/modifier 与 availability gating；未确认独立缺陷。；未登记独立发现 |
| `src/lib/audio/timeline.ts` | reviewed | 完整阅读 geometry、bounded ticks、snap、label 与 formatter；依赖 UI 传入有限有效几何值，未证明用户路径异常。；未登记独立发现 |
| `src/lib/audio/wav.ts` | reviewed | 完整阅读 stereo PCM16 headers、sample 校验、全局 attenuation、输出字节/解码工作副本预算；现有回归通过。；未登记独立发现 |
| `src/lib/audio/waveform.ts` | reviewed | 完整阅读多通道 extrema 与 count 上限/末样本；无需新的策略抽象。；未登记独立发现 |
| `src/lib/audio/workspaceRoute.ts` | reviewed | 完整阅读 audio/music child 路由与离开过程 pathname guard；未确认独立缺陷。；未登记独立发现 |
| `src/lib/audioGeneration/defaults.ts` | reviewed | 完整阅读已配置 MiMo 默认与旧 APIMart speaker profile 保留；无静默 provider fallback。；未登记独立发现 |
| `src/lib/audioGeneration/input.ts` | reviewed | 完整阅读 strict tagged domain schema、MiMo 模式、music/speech native mapping 与 limits；中立常量/schema 归属建议见报告。；未登记独立发现 |
| `src/lib/audioGeneration/observations.ts` | reviewed | 完整阅读 unique owned task ID、timestamp/lastVerified whitelist 与 observed 状态；反证提交重复 ID 不符合 checkpoint 契约。；PM-03 |
| `src/lib/audioGeneration/outputEvidence.ts` | reviewed | 完整阅读 100-result cap、current owned media/output、metadata、selected/timeline placement 与 honest 未试听说明；已有 evidence tests 通过。；未登记独立发现 |
| `src/lib/audioGeneration/presentation.ts` | reviewed | 完整阅读 provider observations 与 local lifecycle 分离、unobserved/partial/legacy、deleted saved 显示；未确认独立缺陷。；未登记独立发现 |
| `src/lib/audioGeneration/reference.ts` | reviewed | 完整阅读 owned clone Blob、encoded MIME/limit、SHA-256 fingerprint 与 Dexie.waitFor；未宣称持久化 base64。；未登记独立发现 |
| `src/lib/audioGeneration/runtime.ts` | reviewed | 完整阅读 prepare/claim、Web/local locks、no replay、raw speech checkpoint、GET siblings/downloading/recovery、output summary；复现重复 ID checkpoint 失败，入站限制晚于 raw checkpoint。；PM-03, PM-05, PM-07 |
| `src/lib/memory/retrieval.ts` | reviewed | 完整阅读 lexical rank、reviewed/project/exclusion、whole-entry <=4096/8预算、source envelope/fingerprint；已有 tests 验证过大整条 omission。；未登记独立发现 |
| `src/lib/memory/schema.ts` | reviewed | 完整阅读 strict inputs/source/version、NFKC topic/tag 去重与文本上限；未确认独立缺陷。；未登记独立发现 |
| `src/lib/references/docx.ts` | reviewed | 完整阅读 central-directory preflight、actual streaming decompress 64 MiB、STORE repack、Mammoth rawtext 与 coverage；峰值 memory 仅疑似未实测。；未登记独立发现 |
| `src/lib/references/docx.worker.ts` | reviewed | 完整阅读 lazy worker 接入与 result/error message；与 import 的 timeout/terminate 配合。；未登记独立发现 |
| `src/lib/references/import.ts` | reviewed | 完整阅读 limits/hash、worker cancel、image close、短事务 operationId CAS、同项目 digest dedup、retry 与 generated image reuse。；未登记独立发现 |
| `src/lib/references/mammoth.d.ts` | reviewed | 完整阅读 ambient browser module 声明；TypeChecker 证实 docx import 使用，内存排除后 TS7016，Knip unused 为误报。；未登记独立发现 |
| `src/lib/references/package.ts` | reviewed | 完整阅读 source/chunk/coverage/status/owner/revision 一致性与 blob digest/remap；不重复登记 projectPackage 调用者。；未登记独立发现 |
| `src/lib/references/parse.ts` | reviewed | 完整阅读识别/limits/signature/UTF decoding、chunk coverage 与插入 separator计数；empty text 与 parse error 分开。；未登记独立发现 |
| `src/lib/references/pdf.ts` | reviewed | 完整阅读 local Worker/CMap/fonts、禁 eval/system fonts、page cap/cleanup/timeout/destroy、partial 页证据；单页内存峰值仅疑似。；未登记独立发现 |

## 路由、壳与共享能力

| 文件 | 阅读状态 | 结论 / 发现 |
|---|---|---|
| `src/components/studio/AboutPage.tsx` | reviewed | 已读产品信息、外链、赞赏 Dialog 和隐私说明；产品包不含本机 connector 的现状与代码一致。；未登记独立发现 |
| `src/components/studio/AssetLibraryPages.tsx` | reviewed | 已读四库查询、studio 所有者、搜索/封面/导航/创建删除；四库共同订阅与 Promise 拒绝出口见报告。；SS-06, SS-09 |
| `src/components/studio/ConnectorsPage.tsx` | reviewed | 已读配置/测试/拉模型/保存/断开与共享弹窗；旧请求写回新会话风险，复杂度告警未直接登记。；SS-07 |
| `src/components/studio/CoverCard.tsx` | reviewed | 已读宽幅/海报、卡片打开、菜单、CreateTile/Grid；props 回调职责合理，不把相似卡片外观当业务重复。；未登记独立发现 |
| `src/components/studio/IpProfileEditor.tsx` | reviewed | 已读 frozen baseline、revision CAS、pendingRef、router blocker、保存失败及放弃表单；保留设计。；未登记独立发现 |
| `src/components/studio/IpProfilesPage.tsx` | reviewed | 已读列表/详情查询、ipId 身份、tabs/关联项目/素材入口、归档/恢复；错误出口和身份 guard 合理。；未登记独立发现 |
| `src/components/studio/LibraryHeader.tsx` | reviewed | 已读 title/sort/query 的展示与回调；保持简单受控 UI，不承担业务持久化。；未登记独立发现 |
| `src/components/studio/MaterialLibraryPage.tsx` | reviewed | 已读 scope/view/search/filter、版本与 legacy、导入/详情接入；默认共享范围不读取全部项目原始 Blob。；未登记独立发现 |
| `src/components/studio/ProjectGalleryPage.tsx` | reviewed | 已读创建/筛选/IP绑定/归档/备份/重命名/删除；341 async事件有catch，真正遗漏在rename/delete；全镜头订阅与cover派生。；SS-06, SS-09 |
| `src/components/studio/ProjectIpPicker.tsx` | reviewed | 已读选择与提交分离、加载/错误、归档IP保留原关联与无效owner占位。；未登记独立发现 |
| `src/components/studio/SearchConnection.tsx` | reviewed | 已读本机Tavily状态/测试/保存/移除；busy输入和close guard、catch/finally已存在。；未登记独立发现 |
| `src/components/studio/Still.tsx` | reviewed | 已读media预览委托与名称渐变占位；object URL生命周期由media hook承担。；未登记独立发现 |
| `src/components/studio/StudioShell.tsx` | reviewed | 已读desktop/mobile共用NAV、chat/tasks互斥、素材路径、Sheet与导入；长期挂载对话布局合理。；未登记独立发现 |
| `src/components/studio/ipProfiles.css` | reviewed | 746行按连续区间全部阅读；列表截断/详情全文、1100/640断点、弹窗滚动、focus与reduced-motion；无长度规则问题。；未登记独立发现 |
| `src/components/studio/materials/LegacyMaterialSources.tsx` | reviewed | 已读明确owner查询、setting/media快照、提升与原编辑链接；全量读取仅显式all，scope与归属由repo再校验。；未登记独立发现 |
| `src/components/studio/materials/MaterialControls.tsx` | reviewed | 已读类型标签、scope parse、Radix选择与draft guard；展示选择器留feature，pending/dirty离开保护。；未登记独立发现 |
| `src/components/studio/materials/MaterialDetailPanel.tsx` | reviewed | 已读版本预览、metadata CAS、提升/采用/更新/释放/归档删除；useMaterialInProject为普通async误报；依赖变更旧material需身份guard。；SS-01 |
| `src/components/studio/materials/MaterialDocumentPreview.tsx` | reviewed | 已读大小/signature/AbortController、动态PDF与DOCX Worker、timeout/terminate；仅展示plain text。；未登记独立发现 |
| `src/components/studio/materials/MaterialImportDialog.tsx` | reviewed | 已读文件选择/scope/逐文件提交/pendingRef/部分成功移除与retry/离开guard；不重复已提交文件。；未登记独立发现 |
| `src/components/studio/materials/MaterialPreview.tsx` | reviewed | 已读image/video/audio/document/setting分支、object URL cleanup、纯文本预览和原件下载；拒绝嵌入活跃文档HTML。；未登记独立发现 |
| `src/components/studio/materials/materialLibrary.css` | reviewed | 9627字符连续两段全部阅读（9行压缩CSS）；card block覆盖、tabs/select覆盖、640断点、scroll/focus/reduced-motion有实际接入。；未登记独立发现 |
| `src/components/studio/projectKinds.tsx` | reviewed | 已读presentation catalog，video/audio/music开放、image/copy占位；create handler同步校验available。；未登记独立发现 |
| `src/components/ui/alert-dialog.tsx` | reviewed | 已读Radix Root/Portal/Overlay/Content与Button variants；无Dexie；整套wrapper export不自动判冗余。；未登记独立发现 |
| `src/components/ui/badge.tsx` | reviewed | 已读CVA变体、Slot和props透传；展示职责清楚。；未登记独立发现 |
| `src/components/ui/button.tsx` | reviewed | 已读CVA variants/sizes、asChild、disabled和focus token；保持通用primitive。；未登记独立发现 |
| `src/components/ui/card.tsx` | reviewed | 已读header/title/action/content/footer；容器结构合理，未用整套API不直接判业务故障。；未登记独立发现 |
| `src/components/ui/checkbox.tsx` | reviewed | 已读Radix Indicator、checked/disabled/focus样式透传。；未登记独立发现 |
| `src/components/ui/click-spark.tsx` | reviewed | 154行全读；ResizeObserver与RAF cleanup、aria-hidden和click motion guard合理；空闲持续RAF可按需调度。；SS-11 |
| `src/components/ui/dialog.tsx` | reviewed | 已读Radix portal/focus overlay、Content/showCloseButton与header/footer；关闭保护由调用者承担。；未登记独立发现 |
| `src/components/ui/draft-status.tsx` | reviewed | 已读saved/saving/error与DraftConflictError重试/采用最新；与baseline调用契约一致。；未登记独立发现 |
| `src/components/ui/dropdown-menu.tsx` | reviewed | 226行全读并补读截断段；Radix group/item/check/radio/submenu、portal、data-slot/variant/inset。；未登记独立发现 |
| `src/components/ui/field.tsx` | reviewed | 已读useId、Label htmlFor与cloneElement关联id；无业务数据依赖。；未登记独立发现 |
| `src/components/ui/input.tsx` | reviewed | 已读input props/type透传、focus/invalid/disabled tokens。；未登记独立发现 |
| `src/components/ui/label.tsx` | reviewed | 已读Radix Label与disabled样式；保持语义关联。；未登记独立发现 |
| `src/components/ui/popover.tsx` | reviewed | 已读Radix Portal/Content位置参数与Anchor；无新增业务职责。；未登记独立发现 |
| `src/components/ui/select.tsx` | reviewed | 170行全读并补读Content函数开头；scroll按钮、item、portal、disabled/focus行为委托Radix。；未登记独立发现 |
| `src/components/ui/separator.tsx` | reviewed | 已读orientation/decorative的Radix包装；全src无消费者，生产Knip一致，可低优先级清理。；SS-10 |
| `src/components/ui/sheet.tsx` | reviewed | 144行全读；side variants、portal/overlay、close、header/footer/description；业务pending guard在调用者。；未登记独立发现 |
| `src/components/ui/skeleton.tsx` | reviewed | 已读简单animate-pulse容器；全src无消费者，低影响可清理。；SS-10 |
| `src/components/ui/slider.tsx` | reviewed | 已读受控/默认值、multiple thumbs、aria label和轨道/范围；不把嵌套ternary当缺陷。；未登记独立发现 |
| `src/components/ui/sonner.tsx` | reviewed | 已读theme与CSS变量到Sonner props透传；全局RootLayout挂载。；未登记独立发现 |
| `src/components/ui/tabs.tsx` | reviewed | 已读Radix Root/List/Trigger/Content与focus/active tokens；素材CSS有特定覆盖。；未登记独立发现 |
| `src/components/ui/textarea.tsx` | reviewed | 已读文本框属性、field-sizing、resize/focus/invalid/disabled；业务保存在调用者。；未登记独立发现 |
| `src/components/ui/tooltip.tsx` | reviewed | 已读Provider/Root/Trigger/Portal/Content/Arrow；不会把未用导出当生产故障。；未登记独立发现 |
| `src/components/workspace/EpisodeListPage.tsx` | reviewed | 已读项目/分集/镜头查询、创建/重排/删除/restore和logline baseline；重排缺catch、undo失败入口见报告。；SS-05, SS-06 |
| `src/components/workspace/ProjectSettingsPanel.tsx` | reviewed | 已读项目信息、风格/output配置、draft/dirty/save；自动保存忽略baseline，显式输出缺CAS的同类风险。；SS-02 |
| `src/components/workspace/WorkspaceChrome.tsx` | reviewed | 已读项目/集导航、非video child保护、film缺集、cover、backup barrier、settings close；复用查询旧身份SSR确认。；SS-01 |
| `src/lib/assetLibrary.ts` | reviewed | 已读WorldTab解析及authored string搜索；domain展示纯函数。；未登记独立发现 |
| `src/lib/audioProjectPackage.ts` | reviewed | 293行逐段全读；allowlist/owner/duplicate/观察校验、ID/media/provenance remap、dormant及insert事务验证；fingerprint失配已复现。；SS-03, SS-08 |
| `src/lib/brand.ts` | reviewed | 已读身份与资源常量；LOGO_FAVICON_SRC无产品消费者，低影响清理。；SS-10 |
| `src/lib/chatScroll.ts` | reviewed | 已读bottom distance/threshold/snap纯计算；保持scroll策略共享。；未登记独立发现 |
| `src/lib/chatTitle.ts` | reviewed | 已读空白折叠、空默认、24字符标题截断；局部纯函数。；未登记独立发现 |
| `src/lib/copySelection.ts` | reviewed | 已读逐个committed回报、alreadyCopied及partial retry；合理共享行为。；未登记独立发现 |
| `src/lib/debouncedDraft.ts` | reviewed | 313行全部阅读；serial writes/rebase/baseline、failed retained、scope barrier、unmount/reopen、visibility/unload；SS-02根因在调用者。；未登记独立发现 |
| `src/lib/draftConflict.ts` | reviewed | 已读changed字段和baseline CAS，空optional文本等价及同值幂等；项目设置未使用该契约。；未登记独立发现 |
| `src/lib/draftMedia.ts` | reviewed | 已读session owned uploads/pending/closed/saving、discard/commit/cancel；既有共享media不归session回收。；未登记独立发现 |
| `src/lib/durationInput.ts` | reviewed | 已读decimal string保留与finite/非负解析；不直接修改无效草稿。；未登记独立发现 |
| `src/lib/episodeDelivery.ts` | reviewed | 197行全读；project+episode scope/order、status/gaps/relations、visual fallback、全列CSV/BOM/quote/filename下载。；未登记独立发现 |
| `src/lib/formFieldFocus.ts` | reviewed | 已读原生/ARIA/overlay/contenteditable shortcut yield selector与closest gate。；未登记独立发现 |
| `src/lib/format.ts` | reviewed | 已读duration非负round及非法日期返回空；展示格式化。；未登记独立发现 |
| `src/lib/generationIntent.ts` | reviewed | 224行全读；参数/role/status/revision/media/preflight/proposal纯准备；当前只有tests消费，legacy契约应明确。；SS-08 |
| `src/lib/generationTargetDestination.ts` | reviewed | 已读统一shot精确deep link和asset路径encode；各生成入口目标导航可复用。；未登记独立发现 |
| `src/lib/ids.ts` | reviewed | 已读crypto UUID fallback与ISO时间；小型基础函数。；未登记独立发现 |
| `src/lib/library.ts` | reviewed | 已读filter/sort/pickZipFile/stillTone；package入口的file cancel行为不作未经浏览器验证的确认缺陷。；未登记独立发现 |
| `src/lib/media.ts` | reviewed | 已读live query record identity/object URL cleanup、image/video upload和file cancel；media实际保存在repo。；未登记独立发现 |
| `src/lib/mediaPicker.ts` | reviewed | 已读owner/MIME/nonempty/query过滤；不允许跨owner媒体复用。；未登记独立发现 |
| `src/lib/productionContext.ts` | reviewed | 239行全读；draft barrier、scoped snapshot、fields whitelist/media metadata/warnings/revisions/output；当前仅tests使用。；SS-08 |
| `src/lib/productionHandoff.ts` | reviewed | 253行全读；scoped read transaction、选中media检查/sanitize/unique folders/full text/warnings/STORE；仍有产品入口。；未登记独立发现 |
| `src/lib/productionRevision.ts` | reviewed | 77行全读；canonical编码与同步SHA256、合法target/slots；仍有产品调用，不能随legacy intent清理。；未登记独立发现 |
| `src/lib/projectPackage.ts` | reviewed | 1092行逐段全读；legacy parse/extra、memory/reference、事务snapshot、MIME metadata、remap/rollback；现代分集引用错误fallback复现。；SS-04, SS-08 |
| `src/lib/reorderIds.ts` | reviewed | 已读id移动、same order与局部分组在全序列重排；纯函数约定由repo验证作用域。；未登记独立发现 |
| `src/lib/shotFilters.ts` | reviewed | 已读status/beat/validmedia gap筛选；shotBeatFilterId只有内部调用，可收窄export。；SS-10 |
| `src/lib/shotKeyboard.ts` | reviewed | 已读active step、beat group、retain visible selection；保留纯helper与UI焦点策略分离。；未登记独立发现 |
| `src/lib/shotMedia.ts` | reviewed | 已读validShotMediaId owner/type/empty Blob检查；ID不是可交付证据。；未登记独立发现 |
| `src/lib/shotRelations.ts` | reviewed | 已读project-owned props/style、undefined继承/null无风格、unknown label；交付复用。；未登记独立发现 |
| `src/lib/thinkingTitle.ts` | reviewed | 已读active/finite duration标题格式；纯展示函数。；未登记独立发现 |
| `src/lib/umami.ts` | reviewed | 已读仅prod/双配置/合法http URL/idempotent async script；不添加重复router pageview。；未登记独立发现 |
| `src/lib/undo.tsx` | reviewed | 91行全读；listener/timer/expiry/provider；restore之前clear且UI void丢拒绝，隔离复现失去retry。；SS-05 |
| `src/lib/useShotMedia.ts` | reviewed | 已读去重排序idsKey、referenced-only bulkGet与result identity guard；可用于修正SS-01的同类查询。；未登记独立发现 |
| `src/lib/utils.ts` | reviewed | 已读clsx+twMerge cn；仅class组合基础职责。；未登记独立发现 |
| `src/main.tsx` | reviewed | 已读一次analytics初始化、routeTree/createRouter/Register/root/StrictMode；生成树真实接入。；未登记独立发现 |
| `src/routeTree.gen.ts` | generated-verified | 生成来源与接入核验：Vite TanStack plugin；47 source imports/46 child update身份及父子树、types/root；生成与基准非trivia token完全相同；主会话恢复格式基准后重新核验sha256与manifest一致，参见tools/route-regeneration.json。；未登记独立发现 |
| `src/routes/__root.tsx` | reviewed | 全读RootLayout的TooltipProvider/UndoProvider/Outlet/Toaster和全局CSS入口。；未登记独立发现 |
| `src/routes/_studio.about.tsx` | reviewed | 全读About薄路由，仅挂feature。；未登记独立发现 |
| `src/routes/_studio.agent.$threadId.tsx` | reviewed | 全读thread URL叶子返回null，对话runtime由parent持续挂载。；未登记独立发现 |
| `src/routes/_studio.agent.index.tsx` | reviewed | 全读agent URL索引叶子不remount对话UI。；未登记独立发现 |
| `src/routes/_studio.agent.tasks.tsx` | reviewed | 全读tasks URL叶子；parent决定任务视图。；未登记独立发现 |
| `src/routes/_studio.agent.tsx` | reviewed | 全读layout从location/params给AgentChatPage与Theme；保留长期runtime设计。；未登记独立发现 |
| `src/routes/_studio.assets.tsx` | reviewed | 全读scope/ip/project/view URL校验和MaterialLibraryPage接入。；未登记独立发现 |
| `src/routes/_studio.characters.$characterId.tsx` | reviewed | 全读characterId和studio back discriminant；所有权由shared详情再次校验。；未登记独立发现 |
| `src/routes/_studio.characters.index.tsx` | reviewed | 全读CharacterLibraryPage薄入口，创建保持studio。；未登记独立发现 |
| `src/routes/_studio.characters.tsx` | reviewed | 全读角色库Outlet布局，list/detail分离。；未登记独立发现 |
| `src/routes/_studio.connectors.tsx` | reviewed | 全读ConnectorsPage薄入口。；未登记独立发现 |
| `src/routes/_studio.index.tsx` | reviewed | 全读根路径redirect→agent；throw redirect为框架约定。；未登记独立发现 |
| `src/routes/_studio.ips.$ipId.tsx` | reviewed | 全读ipId keyed详情路由；防复用旧draft。；未登记独立发现 |
| `src/routes/_studio.ips.index.tsx` | reviewed | 全读IP列表薄入口。；未登记独立发现 |
| `src/routes/_studio.ips.tsx` | reviewed | 全读IP Outlet布局。；未登记独立发现 |
| `src/routes/_studio.projects.tsx` | reviewed | 全读ProjectGalleryPage薄入口。；未登记独立发现 |
| `src/routes/_studio.props.$propId.tsx` | reviewed | 全读propId传shared详情；默认studio back契约由详情处理。；未登记独立发现 |
| `src/routes/_studio.props.index.tsx` | reviewed | 全读PropLibraryPage薄入口。；未登记独立发现 |
| `src/routes/_studio.props.tsx` | reviewed | 全读道具Outlet布局。；未登记独立发现 |
| `src/routes/_studio.scenes.$sceneId.tsx` | reviewed | 全读sceneId+studio back传shared详情。；未登记独立发现 |
| `src/routes/_studio.scenes.index.tsx` | reviewed | 全读SceneLibraryPage薄入口。；未登记独立发现 |
| `src/routes/_studio.scenes.tsx` | reviewed | 全读场景Outlet布局。；未登记独立发现 |
| `src/routes/_studio.settings.tsx` | reviewed | 全读legacy settings redirect→about replace；无虚构设置。；未登记独立发现 |
| `src/routes/_studio.styles.$styleId.tsx` | reviewed | 全读styleId给shared详情；默认studio上下文。；未登记独立发现 |
| `src/routes/_studio.styles.index.tsx` | reviewed | 全读StyleLibraryPage薄入口。；未登记独立发现 |
| `src/routes/_studio.styles.tsx` | reviewed | 全读风格Outlet布局。；未登记独立发现 |
| `src/routes/_studio.tsx` | reviewed | 全读StudioShell/Outlet、pickZipFile/import/navigation；route依赖Gallery的导入编排可归位。；SS-08 |
| `src/routes/p.$projectId.assets.characters.$characterId.tsx` | reviewed | 全读project/character params和project back；shared editor校验owner。；未登记独立发现 |
| `src/routes/p.$projectId.assets.index.tsx` | reviewed | 全读legacy assets index redirect→world；保留链接兼容。；未登记独立发现 |
| `src/routes/p.$projectId.assets.props.$propId.tsx` | reviewed | 全读project/prop params与project back。；未登记独立发现 |
| `src/routes/p.$projectId.assets.scenes.$sceneId.tsx` | reviewed | 全读project/scene params与project back。；未登记独立发现 |
| `src/routes/p.$projectId.assets.styles.$styleId.tsx` | reviewed | 全读project/style params与project back。；未登记独立发现 |
| `src/routes/p.$projectId.assets.tsx` | reviewed | 全读项目assets Outlet布局。；未登记独立发现 |
| `src/routes/p.$projectId.e.$episodeId.index.tsx` | reviewed | 全读episode keyed StoryPage薄入口。；未登记独立发现 |
| `src/routes/p.$projectId.e.$episodeId.produce.tsx` | reviewed | 全读project/episode给ProducePage；feature负责scoped状态。；未登记独立发现 |
| `src/routes/p.$projectId.e.$episodeId.shots.tsx` | reviewed | 全读shot search窄化、project/episode/focusShotId接入。；未登记独立发现 |
| `src/routes/p.$projectId.e.$episodeId.storyboard.tsx` | reviewed | 全读project/episode传StoryboardPrintPage，print使用当集。；未登记独立发现 |
| `src/routes/p.$projectId.e.$episodeId.tsx` | reviewed | 全读episode Outlet布局。；未登记独立发现 |
| `src/routes/p.$projectId.index.tsx` | reviewed | 77行全读；kind dispatch/film修复/redirect；旧episode与新project参数混合SSR复现，landing编排可归feature。；SS-01, SS-08 |
| `src/routes/p.$projectId.memory.tsx` | reviewed | 全读memory search/params、project+memory key重置UI。；未登记独立发现 |
| `src/routes/p.$projectId.plan.tsx` | reviewed | 全读legacy firstEpisode redirect→produce与缺集home；与其他旧入口重复是兼容契约。；未登记独立发现 |
| `src/routes/p.$projectId.produce.tsx` | reviewed | 全读legacy produce firstEpisode redirect，保持历史路径。；未登记独立发现 |
| `src/routes/p.$projectId.report.tsx` | reviewed | 全读legacy report firstEpisode redirect→produce，保持兼容。；未登记独立发现 |
| `src/routes/p.$projectId.shots.tsx` | reviewed | 全读legacy firstEpisode redirect→shots、清focus shot search。；未登记独立发现 |
| `src/routes/p.$projectId.storyboard.tsx` | reviewed | 全读legacy storyboard redirect→project home。；未登记独立发现 |
| `src/routes/p.$projectId.tsx` | reviewed | 全读WorkspaceChrome params适配；缺projectId挂载key且查询未guard身份。；SS-01 |
| `src/routes/p.$projectId.world.tsx` | reviewed | 全读WorldTab search parse与受控tab URL回写；feature负责资产范围。；未登记独立发现 |
| `src/styles.css` | reviewed | 245行全读；tailwindcss/tw-animate-css真实@import、theme/base/studio断点、motion与A4 print chrome隐藏；CSS依赖非unused。；未登记独立发现 |
| `src/vite-env.d.ts` | reviewed | 已读Vite ambient env及公开Umami构建配置声明；没有秘密字段或runtime职责。；未登记独立发现 |

