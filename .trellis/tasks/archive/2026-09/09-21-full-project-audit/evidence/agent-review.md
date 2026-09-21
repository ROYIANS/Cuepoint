# Agent、生成执行与模型传输专项审查

审查日期：2026-09-21。审查方式：静态调用链分析、既有单测、隔离 fake-indexeddb 与模拟 HTTP 故障注入。未修改产品源码，未访问用户数据库，未调用真实付费供应商。最终总报告由主审合并、去重和调整优先级。

## 结论

本专项确认 5 类行为缺陷，另有 1 项过期文案和 2 项清理候选。重点是：**已撤回参考资料可通过任务来源工具重新发送；单次生成在参考图上传期间撤销连接后仍会发送付费请求。** 其余问题涉及原子计划工具的恢复声明、供应商错误脱敏和生成默认参数投影遗漏。

已有基础设计较完整：持有线程 Web Lock 后执行/恢复；工具请求完整解析后写入账本；权限、工具名单和请求参数冻结；审批 CAS；业务写入与结果原子提交；未知生成结果阻止重发；批次使用两 worker 和本地暂停闩锁；下载、候选选择和目标应用分离；记忆、参考资料具有独立来源身份。以下发现来自这些机制不同入口之间的不一致，不代表上述保护整体缺失。

## AG-01 / P1：任务来源读取可重放已撤回参考资料

- **状态与置信度：已复现，高。** 实际执行链已到模型 HTTP body；供应商使用模拟响应。
- **位置：** `src/lib/agent/taskTools.ts:49`、`:59`、`:67`；`src/db/agentTools.ts:145`；`src/lib/ai/referenceWire.ts:9`。
- **预期：** 撤回参考资料后，保留来源身份、阅读范围和用户/助手已写的历史文字，但新的资料读取不能通过缓存重新发送原文。
- **实际：** `task_read` 的 calls 查询仅排除 bookkeeping，因此旧 `project_reference_read`/`project_reference_search` 结果仍在列表中。详情将 `item.result` 作为普通字符串切片，索引也返回前 400 字符。`referenceInput` 被包在 JSON 字符串内部；`appendToolResults` 仅为参考资料工具附加顶层来源身份，`task_read` 不在该名单。发送前 materializer 因而看不到应校验的来源。
- **复现：** 创建项目与任务 → 用真实 reference 工具读取含 sentinel 的 TXT → 完成该运行 → `removeProjectReference` 撤回 → 确认正常 `getReferenceSource` 已拒绝 → 同任务新运行调用 `task_read({source:{type:'tool',id:旧工具ID}})` → 模拟第二次模型请求中出现 sentinel，第一次请求没有。
- **证据：** `repro/auditAgentBoundaries.test.ts:54`；`agent-reproducer-failures.log` 第二个失败断言为 `true !== false`。测试的正文不出现在用户、助手历史文字中，排除了“只是重放用户已写文字”的解释。
- **影响：** 用户认为撤回的来源仍可能被再次发送到所选模型；删除源字节也不能阻止缓存旁路。这不是跨项目读取或任意密钥泄露，边界是同项目、同任务的旧资料缓存。
- **修复边界：** 统一任务来源与历史来源的参考工具投影；可使用现有 `referenceToolSummary`，只返回来源身份和阅读范围，真正读取必须重新校验有效来源。详情与索引同时修复，并核对间接工具结果的嵌套读取。
- **回归：** 已撤回/改版/外项目源在两个协议下均不出现在新请求正文；仍有效来源可通过正常参考工具读回；正常 authored notes 保留。

## AG-02 / P1：单次生成没有在上传后重新校验连接

- **状态与置信度：已复现，高。** 确认付费端点调用次数；未证明真实计费已经发生。
- **位置：** `src/lib/agent/generationRuntime.ts:177`–`:185`，与 `src/lib/agent/generationBatchRuntime.ts:75`–`:81` 比较。
- **预期：** 本地确认冻结配置，上传等异步准备结束后、付费 POST 之前重新检查配置仍有效。
- **实际：** 单次提交保存 config 快照，再上传参考图。`beforePost` 只检查目标版本、run/call/job 和项目归属；没有检查 connector 是否删除、API key 或地址是否更改。随后使用旧对象发送。批量入口在相同位置明确检查了当前 connector 与原 config。
- **复现：** 准备并确认 APIMart 图片生成 → mock `/uploads/images` 等待期间删除连接记录 → 上传返回成功 URL → 程序仍发出一次 `/images/generations` POST，并保存远端任务 ID；恢复查询随后因无连接失败。
- **证据：** `repro/auditAgentBoundaries.test.ts:27`，断言 `paidPosts === 0` 得到 1。用户删除配置发生在模拟上传期间，POST 后没有自动重试。
- **影响：** 使用已撤销的本地连接继续提交可能收费的任务，且本地无法继续查询。改变配置或输入是在上传后、付费前的未覆盖窗口。测试只证明连接删除场景；输入字节/关联变动暂作为同一边界的补充复核项，不单列已复现问题。
- **修复边界：** 将单次/批次共享的最后提交校验统一，重读 connector 身份与当前凭据，保留适当的输入可用性校验；在 POST 之前失效应是已知未发送失败。已经收到任务 ID 的作业仍只能查询，不能重发。
- **回归：** 上传期间删除连接、改地址/供应商、清空/轮换 key 均遵循明确策略；目标变更/停止/删除的既有保护仍通过；正常上传发送一次。

## AG-03 / P2：原子计划工具缺少恢复声明，刷新后成为无法继续的 unknown

- **状态与置信度：已复现，高。** 本地崩溃窗口模拟，不涉及付费供应商。
- **位置：** `src/lib/agent/tools.ts:48`–`:51`；`src/db/agentTools.ts:158`–`:175`；`src/db/agentToolRecovery.ts:7`；`src/db/agentTools.ts:112`。
- **预期：** 计划、任务进度记录与成功工具结果已经在一个事务中提交，应使用原子恢复契约；提交前中断可安全继续，提交后读取已保存结果。
- **实际：** `update_run_plan` 的实现调用 `updateRunPlanAndComplete` 原子写入，但 registry 没有 `atomic:true` 或 recovery。认领 call 为 running 后刷新，`interruptedToolState` 将它设为 unknown，`resumeAgentRun` 拒绝继续。其他 TASK_TOOLS 通过统一 factory 明确标注 `atomic:true`。
- **复现：** 使用实际 registry 的工具元数据保存计划调用 → 认领 running → 在尚未调用原子事务时关闭/重开 fake-indexeddb → `interruptThreadRuns`。计划没有写入，工具却由 running 变 unknown，而不是 pending。
- **证据：** `repro/auditAgentBoundaries.test.ts:98`，实际 `unknown`，预期 `pending`。
- **影响：** 没有业务副作用的计划步骤被当作不确定副作用；必须结束该运行，不能从断点继续。若属于任务，历史 unknown 还会进入任务完成阻断检查（`agentTaskWrapups.ts`）。本专项未实际操作浏览器“完成任务”界面。
- **修复边界：** 补齐 registry 原子声明并设计旧 ledger 的兼容迁移/安全恢复，不能仅补新标志后让已有运行因定义变化继续被拒绝。异常回滚应表达已知未提交。
- **回归：** 认领后、事务中、成功事务后刷新；既有已完成计划不能再执行；任务状态与账本一致。

## AG-04 / P2：通用连接测试和模型发现回显完整密钥

- **状态与置信度：已复现，高；触发需要供应商/代理错误回显凭据。** 没有证据表明用户已发生泄露。
- **位置：** `src/lib/ai/openaiCompatible.ts:38`–`:43`、`:69`、`:119`、`:142`；显示入口 `src/components/studio/ConnectorsPage.tsx:87`、`:128`。
- **预期：** 错误先隐藏凭据，再截断并展示，与聊天/APIMart/AIHubMix 适配器一致。
- **实际：** `listModels` / `testConnection` 将 response text 原样交给只做截断的 `formatHttpError`；网络异常 message 也直接返回。连接页 `toast.error(result.message)` 显示返回值。
- **复现：** 返回 HTTP 401、body=`Invalid API key: audit-secret-only`。两 API 的结果均含完整 fixture key，两个正向脱敏断言失败。
- **证据：** `repro/auditAgentBoundaries.test.ts:91`；`agent-reproducer-failures.log` 第 4、5 项。
- **影响：** 本地 UI/错误复制/录屏的额外密钥暴露，不是把 key 发送给未知第三方，也不将纯假设的生产事件当作事实。
- **修复边界：** 统一安全错误格式化（先按原 key 和 Bearer 脱敏，再截断），覆盖 HTTP、JSON/provider 和网络异常。不要把几个供应商不同响应格式强行合并。
- **回归：** 前后空白、密钥出现在截断边界、多次回显、网络 Error；正常故障诊断信息保留。

## AG-05 / P2：Agent 项目上下文漏掉图像默认 quality/version

- **状态与置信度：已复现，高。** 已确认投影不一致；不声称已经导致实际错误付费。
- **位置：** `src/lib/agent/businessStore.ts:96`，下游 `src/lib/agent/projectContext.ts:19`。
- **预期：** 支持写入/设置的生成默认画质和 Ext 子版本应能通过项目读取与自动上下文看见。
- **实际：** `businessSchemas.imageDefaults` 接受 quality/version，`generationSelection` 也正常使用它们，但 `projection('project')` 图像字段白名单只有 provider/model/profileVersion/size/resolution。自动事实与 business_detail 都省略 quality/version；`business_read_text` 同样基于 projection，不能补读这些字段。只改此字段时 fingerprint 更新，但可见 context 相同，不向当前运行发送新事实。
- **复现：** 项目默认为 `gpt-image-2.5-ext`、`version:'sunburst'`，`getProjectContext` 输出 version 为 undefined。quality 是同一白名单遗漏，静态确认。
- **证据：** `repro/auditAgentBoundaries.test.ts:84`。
- **影响：** 不同工具对当前项目默认参数的表述矛盾，Agent 解释/复述配置不完整。`generation_capabilities` 的推荐仍正确携带字段，确认表单仍有人审，因此没有将“必然改用 flare/产生额外费用”作为已确认影响。
- **修复边界：** 更新共享可见投影和字段级回归；保留 extra 隔离。
- **回归：** quality/version 在 business_detail、business_read_text、项目上下文、上下文增量和 capability 推荐一致，其他 provider 不注入不支持参数。

## AG-06 / P3：连接目录仍显示生成入口尚未开放

`src/lib/ai/catalog.ts:38`、`:48` 两项 blurb 写“生成入口将在后续开放”，`ConnectorsPage.tsx:197` 原样显示；当前 Agent 已有真实生成链路。静态确认。修复文案即可，无需专门组件测试。

## 清理候选（不计作运行缺陷）

1. `chatStream.ts:140` / `:158` 的 `parseSseDataPayload`、`consumeSseBuffer` 仅被 `tests/chatStream.test.ts` 调用。生产 `streamChatCompletions` 采用另一个严格 SSE 解码路径。保留两套不同容错语义会让未来维护者误用旧简化解析器；可移除旧公开 helpers 与仅覆盖它们的测试，把分片场景留在真实 stream API 测试。改动风险是测试覆盖迁移，不能删掉现有真实传输测试。
2. `reasoningPolicy.ts:59` `getModelContextReference` 当前仅有 `tests/modelMetadata.test.ts` 调用；生产已使用 `resolveModelMetadata`。这是兼容 wrapper，无现有生产错误，建议核对外部引用范围后清理。

安全错误格式化的重复实现已造成 AG-04 的实质分歧；可抽公共脱敏 primitive。不要泛化合并 APIMart 与 AIHubMix 的不同协议/下载策略，也不建议只因为文件较大拆分已原子化的事务逻辑。

## 已排除或暂不成立的怀疑

- “刷新会自动重发付费生成”：现有 call/job 归属和 unknown 保护成立；本地已有 provider ID 时走查询。聚焦恢复测试通过。
- “full 模式自动跳过收费确认”：`requiresConfirmation` 优先于 mode，generationOverride 仅在已批准提交生效，原 wire 参数保留。
- “多次点击审批会重复执行”：durable CAS + 线程锁 + 完成账本复用，已有专门测试通过。
- “批量并发某个 worker 失败会提前释放锁”：实际通过 `Promise.allSettled` 排空；本地 pause latch 防止暂停持久化失败后继续 dispatch。
- “APIMart 查询拿到其他任务结果仍应用”：查询 adapter 检查返回 id 等于请求 taskId；AIHubMix 同时检查 id/kind，runtime 还检查模型。
- “来源文件名就是已看图”：reference 工具使用真实像素 materializer，初始 queued 与视觉结论分开；同 run discovery provenance 和二次校验存在。
- “记忆正文在压缩后自动绕过排除”：独立 memoryEnvelope 在边界替换，压缩不将其混入旧 history；spec 明确边界之后变更影响下一次请求。未将编码期间的窄竞态误报成该契约缺陷。
- “校验只看媒体长度允许任意同 ID 替换”：`putMedia` 是 add-only，正常媒体 ID 不变；本次不把数据库手动篡改同尺寸 bytes 当作可达产品漏洞。
- “有效 PNG 签名等于完整可播放文件”：spec 明确只验证文件 signature，非完整 codec 验证，未作为违约缺陷。
- “通用连接测试 fallback POST 必然错误”：当前明确设计为 `/models` 404/405 或特定网络错误后 minimal chat probe，专门媒体供应商没有该 fallback；本次不误报为自动生成重试。

## 检查结果与复现方法

- 聚焦既有套件：`agentToolsReview`、`agentGenerationRecovery`、`agentGenerationBatchSafety`、`agentReferences`、`chatStream`、`responsesStream`，**6 文件 / 115 测试通过**；见 `agent-focused.log`。命令还误带一个不存在的 `agentMemoryRetrieval.test.ts` filter，因此本专项不声称跑过该名称；全库基线由主审执行。
- 正向安全断言：**6 个测试按预期暴露 5 类缺陷**，见 `agent-reproducer-failures.log`，exit 1。最初曾用 `it.fails` 快速验证，最终复现文件已改回普通 `it` 并移出默认测试目录，不在默认 suite 固化错误行为。`agent-reproducer.log` 是最初 5 项 expected-fail 运行的历史记录，以较新的正向失败日志为准。
- 复现文件：`evidence/repro/auditAgentBoundaries.test.ts`。从仓库根临时复制到 `tests/auditAgentBoundaries.test.ts`，执行下列命令，随后只移除该临时副本。若该路径已存在，先检查归属，不覆盖别人的文件。

```sh
PATH=/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin:$PATH /Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm exec vitest run tests/auditAgentBoundaries.test.ts
```

该 test runner 按 `tests/setup.ts` 重置独立 fake-indexeddb。所有 key、项目、文字和 URL 均为 fixture。不要针对用户的浏览器数据库运行这些 fixture。

## 覆盖与限制

逐文件清单见下方。深读指已经跟踪关键分支、调用方和数据边界；查阅指完整读取结构/纯 helper，并核对集成路径，不代表独立场景测试全覆盖。子审未运行真实浏览器 UI、WebKit、网络恢复、真实媒体生成/解码、模型供应商契约探测，也未测 20 项浏览器批次与性能。Web Locks 测试使用既有模拟 manager，不能替代真实双标签页验证。

本专项对 `src/db/projectMemories.ts` 仅跟踪读取来源状态函数；管理/导入实现由数据审查负责。参考文档 parser/worker 不在本专项所有权；只审 reference DB 及请求消费边界。`repo.ts` 仅追读调用契约（例如 putMedia add-only、项目/槽位 mutations），不重复主审或数据审查的全文件结论。模型生成 JSON/vendor 数据由主审执行完整性校验，本专项只审 adapter，不逐条评定外部模型事实。


| 文件 | 深度 |
| --- | --- |
| `src/lib/agent/businessSchemas.ts` | 查阅 |
| `src/lib/agent/businessStore.ts` | 深读 |
| `src/lib/agent/businessToolNames.ts` | 查阅 |
| `src/lib/agent/businessTools.ts` | 深读 |
| `src/lib/agent/contextCompaction.ts` | 深读 |
| `src/lib/agent/contextPlanner.ts` | 查阅 |
| `src/lib/agent/contextPolicy.ts` | 查阅 |
| `src/lib/agent/contextUsage.ts` | 查阅 |
| `src/lib/agent/generationBatchRuntime.ts` | 深读 |
| `src/lib/agent/generationMedia.ts` | 查阅 |
| `src/lib/agent/generationProfiles.ts` | 查阅 |
| `src/lib/agent/generationReview.ts` | 查阅 |
| `src/lib/agent/generationReviewDraft.ts` | 查阅 |
| `src/lib/agent/generationRuntime.ts` | 深读 |
| `src/lib/agent/generationSelection.ts` | 查阅 |
| `src/lib/agent/generationTools.ts` | 查阅 |
| `src/lib/agent/imageDiscovery.ts` | 深读 |
| `src/lib/agent/memoryContext.ts` | 深读 |
| `src/lib/agent/memoryToolNames.ts` | 查阅 |
| `src/lib/agent/memoryTools.ts` | 深读 |
| `src/lib/agent/projectContext.ts` | 深读 |
| `src/lib/agent/projectScope.ts` | 深读 |
| `src/lib/agent/referenceContext.ts` | 深读 |
| `src/lib/agent/referenceEvidence.ts` | 深读 |
| `src/lib/agent/referenceToolNames.ts` | 查阅 |
| `src/lib/agent/referenceTools.ts` | 深读 |
| `src/lib/agent/runChat.ts` | 深读 |
| `src/lib/agent/runOwnership.ts` | 深读 |
| `src/lib/agent/skills.ts` | 查阅 |
| `src/lib/agent/taskContext.ts` | 查阅 |
| `src/lib/agent/taskState.ts` | 查阅 |
| `src/lib/agent/taskTools.ts` | 深读 |
| `src/lib/agent/taskWrapup.ts` | 查阅 |
| `src/lib/agent/toolErrors.ts` | 查阅 |
| `src/lib/agent/tools.ts` | 查阅 |
| `src/lib/agent/webToolNames.ts` | 查阅 |
| `src/lib/agent/webTools.ts` | 查阅 |
| `src/lib/agent/wrapupEvidence.ts` | 深读 |
| `src/lib/agent/wrapupSchema.ts` | 查阅 |
| `src/lib/ai/aihubmix.ts` | 深读 |
| `src/lib/ai/apimart.ts` | 深读 |
| `src/lib/ai/catalog.ts` | 查阅 |
| `src/lib/ai/chatModelPolicy.ts` | 查阅 |
| `src/lib/ai/chatStream.ts` | 深读 |
| `src/lib/ai/connectors.ts` | 深读 |
| `src/lib/ai/modelMetadata.ts` | 查阅 |
| `src/lib/ai/modelVendors.ts` | 查阅 |
| `src/lib/ai/openaiCompatible.ts` | 深读 |
| `src/lib/ai/reasoningPolicy.ts` | 查阅 |
| `src/lib/ai/referenceWire.ts` | 深读 |
| `src/lib/ai/responsesStream.ts` | 深读 |
| `src/lib/ai/tavily.ts` | 深读 |
| `src/lib/ai/visionCapability.ts` | 查阅 |
| `src/db/agentGeneration.ts` | 深读 |
| `src/db/agentGenerationBatches.ts` | 深读 |
| `src/db/agentRuns.ts` | 深读 |
| `src/db/agentSettings.ts` | 查阅 |
| `src/db/agentTaskRecords.ts` | 深读 |
| `src/db/agentTaskWrapups.ts` | 深读 |
| `src/db/agentTasks.ts` | 深读 |
| `src/db/agentToolRecovery.ts` | 深读 |
| `src/db/agentTools.ts` | 深读 |
| `src/db/memoryRetrieval.ts` | 深读 |
| `src/db/references.ts` | 深读 |
| `src/db/contextSettings.ts` | 查阅 |
| `src/domain/agent.ts` | 查阅 |
| `src/domain/agentGeneration.ts` | 查阅 |
| `src/domain/agentGenerationBatch.ts` | 查阅 |
| `src/domain/agentTaskRecords.ts` | 查阅 |
| `src/domain/agentTaskWrapup.ts` | 查阅 |
| `src/domain/context.ts` | 查阅 |
| `src/domain/memoryRetrieval.ts` | 查阅 |
| `src/domain/projectContext.ts` | 查阅 |
| `src/domain/referenceInput.ts` | 查阅 |
| `src/domain/references.ts` | 查阅 |
| `src/lib/ai/modelBank/index.ts` | 查阅 |
| `src/lib/ai/modelBank/README.md` | 查阅 |
| `tests/agentGenerationRecovery.test.ts` | 查阅 |
| `tests/agentGeneration.test.ts` | 查阅 |
| `tests/agentReferences.test.ts` | 查阅 |
