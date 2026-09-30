# Research: agent-runtime 源码质量与职责审查

- Query：逐文件核验执行状态、停止与恢复、付费确认与项目边界、重复业务规则、类型/控制流、值循环和职责归属。
- Scope：internal；唯一源码所有权为 source-manifest.json 的 groups.agent-runtime。
- Date：2026-09-30（Asia/Shanghai）。
- 基准：2fc0e9523e62a5258a488cc3d0274d24c8967c6f。
- 覆盖：src/lib/agent 全部 66 文件、清单计 9,394 行，逐文件完整阅读；0 blocked、0 generated-verified。路径、阅读结论及发现映射见 agent-runtime-coverage.json。
- 边界：产品源码只读；未提交、未另派代理、未覆盖其他研究者输出。数据库/测试/配置只作调用关系和复现依据，不登记其他组所有权。

## 结论与证据强度

本组没有已证明的 P1 问题。确认两处 P2 行为缺陷，另有一处经过异常数据夹具复现的 P2 防御风险、一处 P2 结构债务及一处 P3 类型边界债务。文件大小、认知复杂度告警、非空断言和未使用导出都未直接作为缺陷。

| ID | 严重性 | 分类 | 结论 |
| --- | --- | --- | --- |
| AR-01 | P2 | risk | 图片/视频总结把“媒体记录存在”当作“当前成果可用”；异常持久化状态已复现，但常规 UI 如何形成该状态未证明 |
| AR-02 | P2 | confirmed-bug | 已有生成输出会把被拒绝/失败的关联工具调用重新标记为可交付成果来源 |
| AR-03 | P2 | confirmed-bug | 音乐草稿工具允许并成功保存小数秒，生成入口却只允许整数秒 |
| AR-04 | P2 | structural-debt | 三个本组文件与五个 DB 文件组成同一个值依赖强连通分量 |
| AR-05 | P3 | structural-debt | 工具注册接口擦除参数类型，适配器通过重复解析或断言重新建立类型关系；模型与运行时 schema 仍有独立维护点 |

## AR-01：图片/视频总结缺少当前媒体有效性检查

**位置**：src/lib/agent/wrapupEvidence.ts:147、153、156、160、180；消费位置 src/lib/agent/wrapupSchema.ts:29。

**机制**：收集生成证据时读取 job.result.mediaId 后，使用 !!media 判断可用性。只要存在同 ID 的行，历史 downloaded/applied/conflict 就可变为当前 downloaded；槽位同 ID 时还可变为 applied。这里没有核验 media.projectId === job.projectId、非空 Blob、MIME 与 job.kind 一致，也没有核验 result.kind 与当前结果的类型。随后 generation 来源和关联工具来源得到 supportsResult=true。validateWrapupContent 信任该结构字段，允许 AI results 引用此来源。

**调用证据**：src/db/agentTaskWrapups.ts:42 的 getTaskWrapupState、:99 的完成门禁及创建/发布总结流程使用 collectWrapupSnapshot；src/lib/agent/taskWrapup.ts:44 将 snapshot.evidence 送给总结模型。反例契约在 src/db/agentTaskRecords.ts:135：批次 generation 来源核验归属、非空、MIME 和生命周期；src/lib/agent/generationRuntime.ts:605 的应用入口也有媒体检查。音频来源通过 taskAudioGenerationEvidence 的独立检查链处理。

**已执行复现**：同一真实 task/run/job 下分别放置空 Blob、foreign-project 媒体、audio/wav 媒体。三个用例均得到 outcome=downloaded、available=true、supportsResult=true，引用 generation:job 的 AI results 被 validateWrapupContent 接受。

**影响与限度**：如果持久化数据已经不满足媒体契约，总结界面会把不可交付内容标为可交付，且与任务记录的来源判断不一致。这是防御风险，不按正常生成流程的已发生故障计数：媒体 ID 的正常写入契约是不可变、新 ID；复现直接构造异常 IndexedDB 行，未证明普通 UI、合法 ZIP 导入或生成下载能产生这些状态，也未证明跨项目媒体泄露或验收自动完成。因此不标 P1，不声称存在常规入口的权限绕过。

**建议**：提取图片/视频当前输出检查，至少统一归属、Blob 大小、MIME、job/result kind 和可用生命周期；把“已下载/已应用的历史事实”“当前文件可用”“当前仍应用于目标”作为不同字段。任务记录和总结消费同一份当前检查结果，保持历史 job 和工具账本不改写。

**验证**：上述三个状态及删除媒体、槽位换图、有效但尚未应用的图片分别应给出明确不可用/未应用/可用结果；AI results 不得引用不可用来源。原有合法 downloaded 和 applied 行为应保留。不要求在事务内做解码或网络验证。

## AR-02：拒绝/失败调用被已有生成输出升级为成果来源

**位置**：src/lib/agent/wrapupEvidence.ts:79、92、157–163；接受位置 src/lib/agent/wrapupSchema.ts:30–31。

**触发**：任务已有下载好的 job，模型再次请求 check_generation(jobId)，ask 模式下用户拒绝；或该关联查询失败。普通账本保留 rejected/failed，已有生成输出仍可用。

**机制**：第一遍处理 calls 时 rejected/failed 是 unresolved 且不支持结果；第二遍处理 jobs 时，对 job.callId 或参数 jobId 匹配的所有 calls 无条件覆盖 supportsResult、outcome、available。没有限定 call.status === completed、对应工具名，也没有区分“此调用的成功效果”与“它提及的旧 job 当前有成品”。最终同一条证据正文仍写 status=rejected，却带 outcome=downloaded、supportsResult=true。

**调用证据**：collectWrapupSnapshot → validateWrapupContent → publishTaskWrapup。src/db/agentTaskRecords.ts:57 在工作记录来源校验中明确要求 completed；AR-02 因此也使总结与工作记录采用不同的来源资格。

**复现结果**：有效 downloaded job + rejected check_generation 得到 tool:rejected-query 的 supportsResult=true；仅引用这个 rejected 来源的 AI results 被 validateWrapupContent 接受。此测试使用人工保存的正常账本状态模拟拒绝后的快照，未发送任何请求。

**影响**：总结可把未执行或失败的调用当作成果依据，掩盖该次操作被拒绝/失败的实际状态。已有文件本身可能合法，错误在调用出处和效果归因；未证明付费重放或权限绕过。

**建议**：拒绝/失败/未知调用保持其调用结果；当前输出只用独立 generation 来源表达。只有已完成且被允许的生成工具调用才可得到当前输出补充，而且要保留原调用是否成功的资格。不要为了展示可用成品而修改失败来源的 supportsResult。

**验证**：rejected、failed、unknown、completed 各自配有 downloaded/applied/missing 输出；前三级不得成为该调用的成功成果来源，独立 generation 来源可继续说明已有合法文件。同时校验任意含 jobId 的非生成工具不会被自动升级。

## AR-03：音乐时长规则在保存和生成间漂移

**位置**：src/lib/agent/musicTools.ts:28、40、124、134；下游 src/lib/agent/audioGenerationTools.ts:56、218–223。外部核验：src/db/music.ts:19–26、43–49；src/lib/audioGeneration/input.ts:40、52、74。

**触发与机制**：music_save_draft 广告与运行时 schema 对 FlowMusic lengthSec、Suno durationSec 使用 s.number(...)，未要求 integer；仓库 finiteAudioNumber 也只检查有限值和范围。30.5 秒因此通过 parse、prepare、execute，草稿和完成账本同事务成功保存。music_generate 读取该草稿后，validateGenerationInput / musicSettingsSchema 对同字段调用 .int()，拒绝生成。describeMusicReview 也通过 musicWireInput 读取同一套严格规则。

**已执行复现**：两个引擎都通过真正的 MUSIC_TOOLS.music_save_draft.prepare/execute 保存 30.5 秒；数据库草稿保留该数值、保存调用 completed；musicWireInput 和 music_generate.prepare 均拒绝。错误发生在网络之前，无付费。

**影响**：Agent 能宣告保存成功，却无法用自己刚保存的配置继续生成，需要额外修改草稿。它是已证明的规则漂移，不是依据相似文本推断的重复。现有工具提示没有声明这是专供未来编辑、暂不支持生成的时长格式。

**建议**：先按既有生成契约在音乐参数保存处要求整数秒，并与 repository、生成边界保持一致。让一个音乐参数契约负责可保存/可生成的数值规则，Agent JSON 描述是它的明确投影；不要把所有音乐内容是否足够完整的校验都前移到草稿保存，空歌词/描述等草稿语义仍需保留。历史小数值应明确提示修正，不静默四舍五入。

**验证**：FlowMusic/Suno 的整数边界、30.5、NaN、超范围分别验证保存与生成一致；已有草稿读取仍能返回原始值和可修正诊断；合法整数生成保持原 wire 参数。字符上限/草稿完整性等其他差异须先分清是否属于不同契约，不能一概合并。

## AR-04：执行、加载、证据和仓库互相引用成值循环

**本组位置**：src/lib/agent/generationRuntime.ts:2、11；src/lib/agent/toolLoading.ts:3；src/lib/agent/wrapupEvidence.ts:2。

**核验**：tools/ast-results.json 的 staticValueCycles 是八文件一组，排除 type-only import 后成立。读取了相关 import 和调用位置，两个最小双向环为 generationRuntime:2 ↔ src/db/agentGenerationBatches.ts:14，以及 toolLoading:3 ↔ src/db/agentTools.ts:2。后者仓库仅为 startModelStep/saveToolRound 等调用 getOfferedToolNames/toolNamesForCall，却导入了同时注册 DISCOVERY_TOOLS 并执行数据库操作的模块。

完整强连通分量：src/db/agentGenerationBatches.ts、agentTaskRecords.ts、agentTaskWrapups.ts、agentTasks.ts、agentTools.ts，以及本组 generationRuntime.ts、toolLoading.ts、wrapupEvidence.ts。agentTaskRecords:1 引用 readGenerationTarget；agentTaskWrapups:3 引用 collectWrapupSnapshot；agentTasks:1–2 引用总结门禁和记录写入，把三个流程连成一组。

**影响和限度**：仓库的局部查询/证据功能牵入付费运输、工具账本和加载注册的整个依赖链，难以隔离测试、按业务替换和独立演进。本轮导入 89 工具、运行 177 既有测试均成功；当前值引用大多在函数体/回调中延迟执行，未证明 TDZ、初始化崩溃或循环导致的实际错误。分类为结构债务，与 architecture.md 的 ARCH-01 是同一根因，主报告应合并计数。

**分解建议**：
1. 将 getOfferedToolNames、toolNamesForCall 及基础能力纯规则从 load_tool_groups 的原子写入与系统信封刷新中分离，db/agentTools 仅引用纯规则。
2. 将 readGenerationTarget 等当前目标查询、batch 所有权检查移至生成业务的数据访问边界；generationRuntime 使用它们，仓库不再以付费执行器为查询入口。prepareGenerationSnapshot 的 Blob 哈希、草稿 flush、connector/input 编码属于事务外准备，不能直接移入持久化事务。
3. 将证据的状态判断/投影与 collectWrapupSnapshot 的一致性读取分离；在明确任务操作中协调仓库，保留快照指纹和原子发布门禁。先拆最小环，再重新运行 SCC，避免只改文件位置。

**验证**：值依赖 SCC 消失且没有新增环；两种协议下加载分组、每步 offeredTools、冻结权限、批准/拒绝、停止、同 call 恢复、批次两工人、任务来源与总结新鲜度均保持现有行为。必须同时检查新入口真实可达，不能以含 type 边的结果代替值依赖验收。

## AR-05：工具边界的类型关系与 schema 同步依赖手工约定

**位置**：src/lib/agent/tools.ts:36–52 将 parse/highRisk/prepare/execute 参数统一为 unknown；src/lib/agent/generationTools.ts:197–198、217、229–230 通过断言恢复类型；src/lib/agent/tools.ts:143–145 对计划参数重复断言。BusinessRow 在 src/lib/agent/businessStore.ts:17、83 是动态 Record，businessTools.ts:470、522、538 将动态字段转换成领域 patch。

**机制/影响**：注册接口不能表达某个 parseArguments 的返回类型就是它的 execute/prepare 参数类型，也不能在编译时保证 name、参数 schema 与对应执行分支的穷尽关系。多数实现通过执行时重新 schema.parse 或特定断言正确防守，因此不判为当前“不安全参数已进入业务”。未来修改可以编译通过却直到 dispatch 才发现配对错误；新增工具的 effect、atomic、recovery、requiresConfirmation 元数据同样是手工匹配，执行器在 runChat.ts:127、168 重复核对这一组字段。

业务 schema helper 和 libraryReadTool/writeTool 的泛型已是可复用的现有模式；generationTools 的 JSON 参数树与 generationProfiles 的 Zod 树仍分别维护。AR-03 说明音乐规则已经出现跨契约漂移，但不要因此把每个合法断言或所有重复 schema 都升级为行为缺陷。

**建议**：增加轻量的 typed tool 定义入口，在注册表汇总前保留 Args 类型，擦除只发生一次；让现有 s.Spec 或明确的 schema 投影统一普通参数。动态 BusinessRow 只在类型化查询/投影入口存在，领域 patch 在有 kind 判别的边界形成。无需给每种 CRUD 创建 service/factory/strategy 类；project_create 的一次性绑定和回执逻辑应继续显式保留。注册元数据快照相等校验可用同一个纯函数，但批准前和领取前两次检查都必须保留。

**验证**：用编译期负例证明 schema/execute 参数不匹配会失败；运行时覆盖所有工具名、重复名和元数据变更拒绝。当前完整性检查实际结果为 registered=89、catalog=89、missing=[]、unreachable=[]、duplicate=[]，每个单能力组在加载上限内；故不声称现在存在失踪工具或执行分支漏项。

## 当前职责混合与渐进分解

| 现有模块群 | 实际职责 | 合适边界与必须保留的契约 |
| --- | --- | --- |
| runChat / runOwnership / toolErrors / tools | 流式模型请求、调用领取、权限门禁、结果持久化、恢复、工具总装配 | Agent runtime 保留协调；tools 的业务注册可由应用装配层负责，核心契约轻量独立。线程 Web Lock 覆盖本地恢复到最终写入，未知副作用禁止重放 |
| skills / 各 ToolNames / toolLoading | 轻量能力目录、静态指令、每请求提供范围、load_tool_groups 和系统信封修改 | 纯目录及 offered 规则与有副作用的 loader 分离；冻结 permission ceiling、每步 offeredTools、36 工具上限、pending 调用 pin、legacy envelope 必须保留 |
| businessTools / businessStore / businessSchemas / businessWriteReceipt | 视频业务 CRUD 适配、领域查询投影、关系检查、删除影响快照、回执 | 工具保留 Agent 参数与预览；项目/故事/资产数据规则归本业务。删除级联和媒体保留必须同事务；业务写入与完成账本不分家 |
| generationRuntime / BatchRuntime / Profiles / Selection / Review | 目标查询、配置推荐、准备冻结快照、付费 POST、查询下载、应用 CAS、批次运行、用户确认 | 业务当前状态查询与 Agent 付费执行协调分离；一次 submit claim、不可重放的 unknown、输入/目标 revision、配置确认、两工人和用户选择才应用均不可弱化 |
| audioTools / musicTools / audioGenerationTools / 音乐确认 | 声音/时间线/草稿工具、继承音色规则、提交与查询、复核展示 | Agent 适配器调用 audio/music 业务；音乐参数契约先收敛 AR-03。保存草稿、生成、选版本、放时间线和已试听保持不同事实 |
| taskTools / taskState / taskWrapup / wrapupEvidence / wrapupSchema | 任务身份、计划和记录、总结模型请求、当前来源检查、完整性指纹、结果资格 | 将当前证据检查集中于任务业务；总结展示与持久化发布仍围绕同一 snapshot。不要合并“模型回复完成”“计划勾选”“任务验收完成” |
| Context / ProjectContext / MemoryContext / ReferenceContext | 请求信封、预算/历史压缩、事实增量、记忆检索、用户资料和像素输入 | Agent context 负责协议和信封，各业务贡献有界数据；保留 base/tail 相等校验、先检查来源再发送、原始 request 不改写 |
| IP / Material / Reference / ImageDiscovery / Memory / Web tools | 各业务的权限适配、版本源和真实输入、来源投影、网络查询 | 各业务附近保存规则，Agent 工具负责入口；素材版本固定、撤回阻断、同 run 查图授权、文档范围、公开网络内容不构成授权 |
| activityAttention / runPresentation / executionSummary / chatTurns / review presentation | 纯展示状态、导航和摘要 | 可与 Agent UI colocate，保持仅结构化账本决定状态；无需因为在 lib 就强行添加数据访问抽象 |

迁移顺序：先修 AR-02/AR-03，并补回归；AR-01 根据持久化边界需求加防御。再按 AR-04 拆纯规则/查询与副作用，随后改善 AR-05 类型边界；最后调整目录归属。与 architecture.md 的渐进方向一致。不要先搬 66 文件，更不要为“无环”把同一领域事务拆成多个提交。

## 已核验的正确边界、重复规则及穷尽性

- 权限：tools.ts:55–60 的 requiresConfirmation 在 full 模式之前判定；runChat.ts:127、168 检查代码注册元数据与持久化 call 一致；:170 领取前再查批准。原批准不能被全局配置变化自动扩大。
- 停止/恢复：createRunWriter 串行 flush；runChat.ts:188 已提交的原子完成结果不会被后续异常重跑；:195 无法证明回滚的副作用变 unknown。GenerationRuntime 的 postStarted、safeTaskId、多任务 unknown 和现有 job 复用分支没有发现可自动再 POST 的缺口；音频通过持久化 intent 和现有 job 恢复。
- 两工人：generationBatchRuntime.ts:78 的 allSettled 等待所有工人；dispatchPaused 是本进程阻止新付费请求的额外防线，不应以持久化 pause 成功与否替代它。页面退出仅停本地等待，不能当作远端取消。
- 业务 preview 与 execute 重复 owner/revision 校验属于 TOCTOU 防护；读取规则与写入规则不同，不能为了去重删去第二次检查。set*Slot 仓库会复查媒体 MIME/归属/非空，businessTools 的预览未检查全部 MIME 不代表错误文件可以写入。
- businessTools.writeTool 与 libraryWriteTool 的解析、flush、revision 和 executeAtomicTool 骨架相近；project_create 重放/绑定、删除前快照、业务回执和库/IP 强制确认属于不同契约。可抽共用纯 revision 计算或元数据比较，但不建议统一成包罗所有业务回调的万能 CRUD 框架。
- 当前名称目录/技能/任务/loader 与 89 工具注册匹配；未发现 disabled 工具通过加载获得新授权。现有两协议的加载/切组/pinning、重新批准和恢复测试通过。
- Knip 全量含测试的有效信号没有本组未使用文件。它指出的 metadata、generationTargetHref、SUMMARY_PREFIX 等多数是本文件内部使用但不需公开导出；可局部收窄 API，不等同死实现。首次失效的 production 结果未用于本报告。
- 所有权、缓存来源信封、文档范围/图片 digest/同 run 证明都有明确检查；未仅凭文件名或返回 queued 断言模型已分析真实图片。

## 待核验事项（不计已确认发现）

1. **步骤 ID 空白规范化**：taskTools.ts:39 的 s.text 接受带尾部空白 ID；taskState.ts:32 保留 ID；tools.ts:66 的 .trim() 改变同一个 update_run_plan ID。纯代码差异确定，但“已有 todoId 记录因此断链”的完整夹具第一次 PrematureCommitError、用 Dexie.waitFor 后超时，尚未分离夹具 Promise/事务问题与真实入口行为。未列 AR-06 或 P1。后续应从真实 task_create → task_record_write → update_run_plan 运输路径验证，而不是用纯函数差异宣称断链已发生。
2. **全表事务**：libraryReadTool、memoryContext、libraryWriteTool 和 executeAtomicTool 使用 db.tables；前两者的表范围可另行度量，执行原子写入的全表事务则是现有嵌套仓库契约。未做多线程真实浏览器阻塞测量，不宣称性能故障，也不建议直接缩表破坏原子提交。
3. **捕获异常与来源不可用**：wrapupEvidence.ts:63、154 等 catch 将目标读取错误表示为不可用。需区分真的删除/归属变化与存储失败；本轮未注入真实浏览器 IDB 错误确认吞错，不将 catch 本身计为缺陷。
4. **Blob 最后检查窗口**：generationRuntime.ts:302–305 在最终 dispatch 事务复查元信息，不再次在事务内散列 Blob。正常 media ID 不可变契约使同 ID 同大小内容替换不应发生；未证明正常入口能违背该契约，不宣称参考图被悄悄替换。生成结果头部识别也不等于完整媒体解码，真实浏览器/供应商可用性未验收。

## 实际工具、复现和原始结果

本子代理直接使用 fs 完整读取及分段行号输出，并用 rg 定位外部调用者/测试；长输出被截断的源码段另行补读，未以 rg 命中代替阅读。清单 SHA-256 逐个复核：66/66 一致。

运行环境实测：Node v24.11.0；指定本机路径 /Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm --version 返回 10.15.0（不是沿用指令里历史 9.12.0 数字，也没有使用 Codex Runtime 的 pnpm）；Python 3.9.6；ripgrep 15.2.0；Vitest v5.0.1。未执行安装或修改产品依赖。

临时目录：/tmp/agent-runtime-audit-rFKLa0。仅该目录创建配置、夹具、缓存及日志；复现用 fake-indexeddb 的独立内存数据库、fixture 密钥、无网络请求，不操作用户浏览器 IndexedDB。

| 操作 | 实际命令/入口 | 结果与原始文件 |
| --- | --- | --- |
| 最小复现与目录核验 | 指定 pnpm exec vitest run --config /tmp/agent-runtime-audit-rFKLa0/vitest.config.mjs --reporter verbose | 最终 7/7 passed，exit 0；repro-run.json、repro.stdout.txt、repro.stderr.txt、audit.test.ts |
| 相关现有回归 | 指定 pnpm exec vitest run --config /tmp/agent-runtime-audit-rFKLa0/existing.config.mjs --reporter verbose | 13 文件 / 177 用例全部通过，exit 0；existing-run.json、existing.stdout.txt、existing.stderr.txt、existing.config.mjs |
| 计划断链待核验夹具 | 同最小复现命令，临时加入第八个测试 | 两次 exit 1：PrematureCommitError / 5000ms 超时；plan-first-repro-*、plan-second-repro-*、plan-unverified.test.ts。最终正式复现集合移除未核验夹具，未把它标记成通过 |
| 本组 SHA-256 | Node crypto.createHash 对清单 66 路径检查 | 0 mismatch；覆盖 JSON 和报告为唯一任务写入 |
| 主会话提供的静态信号 | research/tools/agent-runtime-signals.json、ast-results.json、有效 knip.json 与 tool-versions.json | 作为定位与交叉核验；未声称是子代理再次运行的 ESLint/Knip/depcruise |

既有验证涵盖 agentTools、agentToolsReview、agentRuns、agentGeneration、agentGenerationRecovery、agentGenerationBatchSafety、agentGenerationReview、agentGenerationReviewTransactions、toolLoading、toolLoadingMeasurement、agentTaskWrapup、audioGenerationAgent、musicGenerationReview。

最小复现的断言特意确认当前缺陷存在，7 passed 不表示这两处行为已经修复。原始摘要摘录：

~~~text
AR-01 empty/foreign/wrong-mime: outcome=downloaded, available=true, supportsResult=true
AR-02 rejected-query: status=rejected, outcome=downloaded, supportsResult=true；AI results 可引用
AR-03 flowmusic/suno: savedDuration=30.5, saveCall=completed, generateRejected=true
CATALOG: registered=89, catalog=89, missing=[], unreachable=[], duplicate=[]
既有测试：Test Files 13 passed；Tests 177 passed；exitCode=0
~~~

主会话工具版本清单记录 TypeScript 5.9.2、Knip 5.88.1、dependency-cruiser 17.4.3、ESLint 9.39.5/typescript-eslint 8.71.0/SonarJS 3.0.7。只据实际读取的有效报告复核信号；复杂度阈值不构成业务失败证明。

## 相关规范与重要限度

读取角色协议、任务 PRD/design/implement、workflow 的研究/审查约束，以及 frontend 索引、目录、类型和质量规范；相关执行/工具规范及 library/creative/task-wrapup 中的具体契约用于核验。规范自身也接受审查；其中历史能力文字不替代当前源码和注册完整性结果。外部网络资料未引用，本轮问题均来自本地基准实现和独立复现。

未执行源码修复、commit、全量 lint/build 或全测试重复运行；主会话负责整个工程基线。没有真实浏览器 Web Locks/IndexedDB 多页面验收、实时供应商 API、图片解码/视频播放/音频听取测试。AR-01 的入口限度和步骤 ID 的未完成核验如上；临时目录日志不保证长期保存，关键机制、位置和摘要已落入本报告，主会话若需长期保存可在有所有权的工具目录归档。其他组只作引用，未追加其覆盖记录。
