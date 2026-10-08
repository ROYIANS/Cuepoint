# D04 / AU-06：上下文查询统一快照方案

研究日期：2026-10-08。仅研究，未实现、未执行测试，未更新规范/台账/任务状态。实现必须等待 D03 独立接受，再按届时源码重新确认路径与调用方。当前任务 `implement.md` 仍写 Current: D01；此文不改变推进顺序。

## 依据与范围

原始发现已按精确文件定位：`.trellis/tasks/09-30-src-quality-architecture-audit/research/agent-ui.md:99–111`，AU-06 / P2 / structural-debt。原文指出常驻 trigger 与打开后的 panel 各调用 `useContextUsage`，重复订阅和组装；圆环、正文、记忆 sheet 可能观察不同刷新时点。原审计没有测得耗时、卡顿或已发生的错误预算。本次同样不作这些运行故障断言。

父任务 `09-30-src-quality-remediation/{prd.md,design.md,remediation-ledger.json}` 中 D04/AU-06 均 pending，B01/B03 verified；原计划位于 `09-30-src-quality-architecture-audit/research/remediation-plan.md:60–66`。D 任务 `task.json`、`implement.jsonl`、`check.jsonl`、`prd.md`、`design.md`、`implement.md` 要求小型实际共享边界、串行写入和独立接受。

相关规范从磁盘读取：`frontend/{index,directory-structure,component-guidelines,hook-guidelines,quality-guidelines,type-safety,state-management,agent-context,agent-project-context,agent-tasks,agent-memory-retrieval,agent-references}.md`。其中 hook 的 retained-result/null/empty 身份契约、state-management 的 B01/A04/B03、context 的历史运行冻结、memory/reference 的作用域与选择预算直接约束本单元。

仅整合同一上下文展示的读取和 view model。D03 页面/生命周期提取、D08 草稿协议、E 的动画/扫描/性能优化不在范围内；不建全局 Context、缓存、注册表或新状态库。

## 实际调用及消耗事实

| 当前位置 | 读取/消耗的事实与风险 |
| --- | --- |
| `src/components/agent/AgentChatPage.tsx:650` | 唯一外部 `ContextUsageTrigger` 调用，传 thread/project、task、mode、草稿/附件、消息/运行、model/connector/metadata。消息/运行源于本页 `:158–171` 各自 live query，并以 `?? []` 传入；空数组本身不能证明新作用域已经读完。 |
| `src/components/agent/ContextUsagePanel.tsx:51–321` | `useContextUsage` 查询 agent、thread、compactions、task/project、memory、references；解析 policy/capacity、选 history/summary/tools、组装 request 并算 budget/usage。task prop 实际只参与 contextKey，真正 task 来自 DB。thread get 未转 null，config/thread/records 没有完整 envelope；context/memory/reference 已有各自 key，但分阶段 key 不等于一个完整事实版本。 |
| 同文件 `:323–351`、`:510–585` | panel 与 trigger 各调用同 Hook。trigger 使用 percent/title；panel 使用 usage/categories、policy、capacity/source、budget、selectedCount、项目 coverage、参考 coverage、能力列表、lastRecord。panel 应消费 trigger 已持有的同一结果。 |
| `src/components/agent/MemoryContextDetails.tsx:26–111` | trigger 传 memorySelection、threadId、activeRun；sheet 自己读可用性、现有记忆和排除列表并写排除意图。这里是管理事实，不是另一份预算选择。其 content key 只有 run/preview 与 selection.projectId，同项目换线程没有完整线程身份。历史调用 `MemoryRunHistory` 也要保留。 |
| `src/components/agent/AgentControls.tsx:240` → `ContextParameters.tsx:13–72` | 参数页是独立最小 policy 编辑器：查询 thread 或 GENERAL_AGENT_ID，normalize，按字段更新/reset/default-copy。source 有 null，但无 scope envelope；切 thread 时 retained source 可暂时启用错误作用域的 controls。不能把执行的冻结 policy 当作可编辑的下次发送 policy。 |
| `src/lib/agent/taskContext.ts:14–51` | 已存在且为 inspector/new-run 共用的业务读取/组装边界，返回 instructions/task/records/taskToolNames/projectContext/projectKind。当前缺失 thread 会走 project prop fallback，task 的 project 所属未在此处验证；新快照 owner 必须先验证这些事实，再调用它。保留八条、每条 1200 字符的记录摘录与现有 instruction 组装。 |
| `src/db/agentRuns.ts:107–149` | 新发送使用 getTaskContext、同一 policy/history planner、memory selector、reference selector/字符预算及 vision 检查；retry 优先保存的 context/request/selectedReferences。是预览对照消费者，不是 D04 新服务入口。 |

实际底层边界：`projectContext.ts:11–75` 的 getProjectContext 及 projectContextTables（含 audio/IP 投影）；`db/memoryRetrieval.ts:6–55` 验证项目、线程所属并选择 reviewed/active/non-excluded 记忆；`referenceContext.ts:41–93` 选择有界完整 chunks/真实图片身份；`db/references.ts:14–29` 在只读事务内检查项目、source owner/status/revision、media owner、chunk owner/revision；`db/agentTaskRecords.ts:15–17` 按 taskId 读记录。复用这些规则，不另写过滤/预算版本。

## 建议的最小 owner 和契约

新增 **`src/db/agentContextPreview.ts`**（建议名）：一个 feature 专用只读 `readAgentContextPreview(input)`，围绕现有 getTaskContext/选择器组合事实；不承担 send、运行、参数写入、历史管理。快照类型放在该叶模块或 feature 旁，使用现有 domain 类型。

输入仅包含请求 scope（threadId 或 home、home projectId）、interactionMode、规范化草稿、附件 ID/revision 的有序列表、model、provider definitionId、相关 model metadata。连接密钥不参与 key/输出。task/history/run/policy/config 从该 owner 的 DB 快照取得，不能把父级暂时 `[]` 当作完整事实。

建议返回形状：

```ts
type PreviewRead =
  | {identity: PreviewIdentity; status: 'ready'; facts: PreviewFacts}
  | {identity: PreviewIdentity; status: 'missing'; entity: 'agent' | 'thread' | 'project'}
  | {identity: PreviewIdentity; status: 'unavailable'; reason: 'scope-mismatch'}
  | {identity: PreviewIdentity; status: 'error'; message: string};
// Hook 另外返回 {identity, status: 'loading'}，覆盖 undefined 或身份不匹配。
// PreviewFacts: matched thread/config、project binding/kind、task/records、
// normalized previewPolicy、history/compactions、activeRun、taskContext、
// memorySelection、selectedReferences（含 coverage）；optional 用 null/undefined
// 表达有意缺席，不能替代 required-row missing 或读取失败。
```

1. **一次事实事务。** 显式 `r` 表集合为 agents、chatThreads、chatMessages、agentRuns、contextCompactions、agentTasks、agentTaskRecords、projectMemories、projectReferences、referenceChunks、media，加 `projectContextTables()` 的现有投影表，去重；不使用 db.tables。只有实际查询相关 scope，不扩大成全库读取。agent/thread/当前策略、task 与有界 project facts、memory/reference selection 在同一事务完成，原嵌套 selector 的 r 事务必须加入该事务，不能漏表。消息/运行在这里按 thread 读取并沿用当前 createdAt 排序；page 的聊天展示订阅仍有独立用途，不在本单元重构。
2. **外部 await 在事务外。** resolveVisionCapability 经 `ai/modelBank/index.ts:56–63` 动态 import 完整模型数据。先在事务外准备匹配 model/provider/metadata 的 capability，然后进入最终事实事务；只在实际选出图片时 requireVision。文本选择不能因 unknown vision 失败。不做 Blob 编码、hash、worker、网络或额外模型请求；不使用长 waitFor 维持事务。任何外部准备完成后，必须读最终当前 facts，再返回整体 envelope。
3. **线程为权威。** 有 threadId 时先区分 missing thread，再按其 projectId 取事实，禁止退回 home projectId。传入项目若与当前线程绑定冲突，返回显式 scope-mismatch，不组装 foreign project。home 才使用选择的 projectId；无绑定且普通聊天是正常 ready，不是 missing。studio/删除的绑定项目不可用。task 可自然不存在（Task intake）；存在时必须同 thread 且 projectId 与绑定一致，再允许 records/task tools 进入预览。不要信任旧 task prop。
4. **一次展示组装。** 保留当前 Hook 的预算/工具/请求 useMemo，由 trigger 唯一调用；用上述 facts 代替六段查询。结果含 identity、status、sourceKind（next-send / saved-run）及当前各个展示字段。panel 接收这个结果与 onClose/onMemoryOpen；不再接收整套原始输入或运行自己的查询/预算 Hook。圆环、tooltip、panel、memory selection 都从一个结果读取。
5. **明确状态。** required agent/thread/project missing、task 不存在、未选择参考、正常空 history 与 error 均独立表达。ready 之前不计算可见 percent/usage，不让 normalize 的默认 policy 或暂空 records 看起来是已加载预算；可见错误也不与成功预算并排冒充 ready。capacity unknown 保持 unknown，loaded empty references/memory 是合法完成状态。同一 query 更新可保留一整份同 scope 旧事实，但不得拼入另一份新 policy/project/reference；跨身份立即遮蔽旧结果。

此边界足够完成 AU-06；执行仍通过既有 getTaskContext/选择器重新读取并冻结。不要让 beginAgentRun 消费 UI 快照、改变写事务或削弱发送前 revalidation。纯 planner、usage heuristic、tool allowlist 和 project/memory/reference 投影继续复用；没有必要新增完整“全局上下文服务”。

## 身份、历史与写入保护

- `PreviewIdentity` 标识 home/thread、请求项目、mode、model/provider/metadata、附件 identity 和实际估算用的草稿。query 返回自己的发起 identity，Hook 只消费与当前输入一致的 envelope，包括 missing/error/空数组。内部 DB live 变化不需要把 updatedAt 放入编辑器 key；整体结果属于一次一致事务。
- `useDeferredValue` 若继续保留，必须显式辨别当前草稿与估算草稿；二者不一致时显示刷新状态而不是“包含当前草稿”的旧百分比。taskId 从读取事实获得，不用旧父 props taskId 授权。不要将 scope identity 扩展成 B07 compose/draft 协议或全局请求序号系统。
- saved-run 分支沿用当前 active predicate（running / waiting_approval / 有工具的 failed/interrupted），且 run 必须同当前 thread 与 durable binding。使用保存的 context.policy/capacity/history、agentSnapshot、enabled/offered tools、continuationMessages/requestMessages、continuation extras、projectContext、memorySelection、selectedReferences；不得在字段缺省时悄悄补入新 live memory/project。compaction detail 仍按线程。原 UI 明示“已保存的上下文”“当前输出及未回填结果尚未计入”。模型标签也来自所展示 run，不能拿下次发送所选 model 标注旧运行。
- 项目删除后，匹配的历史 run 请求仍可只读展示，并同时返回当前 scope availability=false；新的 live 预算不可冒充可发送。history 与当前可写性分离，不改冻结记录、不将旧 run 写权限恢复。foreign task/run 不进入当前预览。
- `ContextParameters` 保留独立的轻量 policy 查询与其编辑锁，不订阅全部预算 facts。为其原查询加 `{scopeKey, source: row ?? null, error}`，在作用域匹配前禁用；missing/error 显式显示。回调捕获匹配 thread/default 身份，阻止旧作用域回调发起新目标写入；异步 toast/finally 只发布给发起的仍有效 session。可采用 thread/default key 或局部 session guard，无新的草稿服务。
- B03：onChange 始终是 `{autoCompress}` / `{limitHistory}` / `{historyMessageCount}` / `{customContextTokens: value ?? undefined}`。`db/contextSettings.ts` 最新事务内合并，独立字段保留；同字段按提交顺序。reset/default-copy 保持事务内读取来源并整份替换。普通参数 API 没有 revision CAS，不应虚构一个；B01/A04 所有现有手动编辑冻结 target/baseline、字段 CAS 以及任务/记录 revision CAS 均不得因读取集中而绕开。
- `MemoryContextDetails` 仍读管理事实/排除列表，selection 来源只改为共享结果；content key 至少包含 threadId、run/preview 与 selection.projectId，避免同项目切线程保留旧排除状态。current availability 传播 readOnly；历史 MemoryRunHistory 调用仍受自身 frozen/readOnly 契约约束。局部管理 query 返回带 project/thread identity 的 envelope；迟到 exclude/error/finally 只能影响发起 session，DB 写仍使用原 setThreadMemoryExcluded 的 transaction guard。

## 后续实现路径与必要验证

预计产品路径：新增 `src/db/agentContextPreview.ts`；修改 `src/components/agent/ContextUsagePanel.tsx`（唯一 owner / presentational panel）、`ContextParameters.tsx`（policy query/session 身份）、`MemoryContextDetails.tsx`（sheet 身份/可写性）；`AgentChatPage.tsx` 仅在移除已不再使用的 task/messages/runs preview props 时改调用点，须等待 D03 接受后核对。不计划改 `contextSettings.ts`、agentRuns/transport 或做页面提取。若实现发现 getTaskContext 需调整，限定为读取契约，不复制其 instruction assembly，并重新检查新运行调用。

新增 focused test 建议 `tests/contextPreviewSnapshot.test.ts`，采用现有实际 callback/querier host 与生产 Dexie：

- 打开 panel 不新增 snapshot 订阅或 planner/budget 组装；实际 trigger/panel 结果引用相同，memory sheet 从同一 selection 获取。计数对比打开前后增量，不能把合法 DB 更新或图片 capability 准备算作缺陷。
- 延迟查询并切 A/B/back、home 项目、同项目不同 thread、model/metadata、草稿与附件 revision：旧 ready/null/empty/error 都隐藏；new loading 不显示旧环/coverage，late completion 不发布。参数和排除实际回调不写到新的 scope。
- missing agent/thread/project、普通无项目、intake 无 task、foreign task/project/source/media、withdrawn/revised/尚未解析的 reference、DB rejection 分别断言；空 selection/history 必须正常 ready，所有事实来自同一生产事务，失败不产生半份预算。
- 对照 `beginAgentRun` 保存的 next-send 材料，检查 policy、history/summary、task/record bound、project/coverage、memory、reference budget、工具定义与 categories；允许原有 heuristic/延迟草稿/未计入流输出的明示差异。验证 unknown capacity、conversation mode、图片 vision 拒绝。
- active run 在 live policy/model/task/project/memory/reference 改动后仍使用冻结/续接来源；删除项目历史可读且排除写禁用，legacy optional 字段不偷换成新 live facts。

现有兼容集按实际受影响选择：`tests/{contextUsage,contextManagement,agentProjectContext,agentTaskOrchestration,memoryRetrieval,agentReferences,b03IntentBoundaries,b01QueryIdentity}.test.ts`。B03 的真实参数 callback host 需适配新的 envelope，保留原独立字段/同字段提交顺序/undefined clear/full reset/rollback 用例，不能改成拷贝 merge 的测试。已有 host + fake-indexeddb 不证明 ReactDOM、Popover 生命周期、useDeferredValue 或原生事务寿命。

**native UI 只验证本改动的实际风险**：一个隔离 fixture/已有可复用 harness，用真实 ReactDOM/Radix/Dexie 和受控延迟：打开/关闭 popover 不翻倍查询；sheet 在关闭 popover 后保持挂载，A→B（同项目不同线程）不遗留旧排除状态；延迟切项目/model/草稿/附件时圆环与正文同步 loading/ready；图片 capability 冷加载后最终只读事务不 TransactionInactive/PrematureCommit；参数 pending/missing/error 的禁用和回调归属。没有必要跑 PDF/DOCX worker、付费 generation、广泛移动端/读屏/性能基准或 D08/E 场景。

后续 checker 检查全部实际消费者、TypeScript 与变更 static differential；若运行 pnpm，只用 `/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm`，不安装依赖。本 sidecar 未执行上述验证，不宣称 AU-06 已关闭。
