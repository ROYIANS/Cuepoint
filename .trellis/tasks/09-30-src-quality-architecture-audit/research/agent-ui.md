# Research: Agent / Memory UI 代码质量与架构审查

- Query：在产品只读条件下，审查 UI 职责、组件/Hook/规则边界、运行归属、取消/重试、异步竞态、重复状态、Effect、权限和复杂控制流。
- Scope：internal；唯一覆盖组 `source-manifest.json → groups.agent-ui`。其他源码、测试与本地依赖仅作关联证据，不登记其覆盖。
- Date：2026-09-30。
- 基准：manifest 的 `baseRevision=2fc0e9523e62a5258a488cc3d0274d24c8967c6f`。结束前复核全部 61 个源码 SHA-256 均与清单一致。
- 覆盖：61/61 文件逐文件完整阅读，共 15,998 行，包含全部 13 个 CSS。递归核对两个目录，无清单外遗漏文件；当前清单没有更深层目录中的文件。没有 generated 文件或 blocked 项。行数仅用于覆盖核对，不是缺陷证据。
- 产物：本报告及 `agent-ui-coverage.json`；逐文件职责/结论见文末清单及 JSON。

## 总体判断

确认 5 项缺陷（4 项 P2、1 项 P3），记录 3 项结构债务和 2 项独立风险。没有证据足以列出 P1。主要问题集中在编辑会话身份、未保存草稿的离开边界、局部设置的并发写回和键盘事件归属。运行执行并非只靠按钮禁用：已有冻结快照、线程 Web Lock、工具领取前再校验与持久审批账本。不能把目录大、回调多、直接调用 repository 或类型循环本身认定为故障。

| ID | 严重性 | 分类 | 核心问题 |
| --- | --- | --- | --- |
| AU-01 | P2 | confirmed-bug | 并发记忆候选替换来源，编辑正文仍来自先到候选 |
| AU-02 | P2 | confirmed-bug | 工作记录和总结的未保存草稿保护没有覆盖实际离开路径 |
| AU-03 | P2 | confirmed-bug | 上下文参数局部修改以旧完整对象写回，覆盖并发修改 |
| AU-04 | P2 | confirmed-bug | 主题动作 Enter/Space 被外层主题行截获 |
| AU-05 | P3 | confirmed-bug | 同文件后置 CSS 覆盖窄屏留白与底部 safe-area |
| AU-06 | P2 | structural-debt | 上下文触发器和明细面板各组装一套查询/预算状态 |
| AU-07 | P2 | structural-debt | 生成表单重复编码供应商能力和参数联动规则 |
| AU-08 | P3 | structural-debt | 页面复制三套执行生命周期并维护选择镜像 |
| AU-09 | P2 | risk | 已拆 lazy 的富消息与完整图标目录仍为大体积 chunk |
| AU-10 | P2 | risk | 文本与附件草稿作用域不同，跨主题复用文本可能误发 |

## 当前职责（独立于改进建议）

`src/components/agent` 目前是一个 feature UI 目录，包含入口编排、聊天 chrome、记录/任务/生成审阅、来源预览、上下文估算和装饰效果。它并非仅有无状态展示组件。`AgentChatPage.tsx:57` 集中读取线程、任务、连接、项目，持有选择与输入临时状态，并衔接兼容性检测、repository 和运行 transport；`ChatWorkspace.tsx:128` 负责布局、消息懒加载与 composer 安全空间；`MessageList.tsx:5` 和 `AgentRunDetails.tsx:199` 消费持久消息/工具状态进行展示。

`AgentGenerationBatches` 和 `GenerationReview` 是审阅与行动边界：本地编辑、revision 校验、批准/确认后显式启动。任务目录组件承接手动记录和总结审阅；`TaskWrapup` 同时连接记忆提升。`src/components/memory` 拥有项目记忆管理 UI、编辑冲突呈现和来源选择，数据库的所属项目、来源版本与 CAS 仍由 `src/db/projectMemories.ts` 控制。

`useReferenceDraft.ts:17` 已是明确的 UI Hook：作用域内附件/导入草稿及取消资源。`filterThreadsByTitle.ts`、`timeGroups.ts`、`memoryLabels.ts` 是 presentation helper。`Grainient`、`ThinkingMatrix` 是本地效果组件。`agentTheme.ts` 是布局常量/设计 token；样式文件属于各 UI 子域。保留这些定位合理，不建议为了层数新增通用 service 或全局 store。

## 已确认缺陷

### AU-01 — P2 / confirmed-bug：记忆候选请求并发导致正文与来源错配

**定位**：`src/components/memory/MemoryPromotion.tsx:17`、`:23`、`:37`；`src/components/agent/TaskWrapup.tsx:113`、`:153`、`:424`；`src/components/memory/MemoryEditor.tsx:60`、`:69`、`:73`、`:153`。

**触发机制**：同一确认总结含多条可提升的决定/经验，每条 `MemoryPromotion` 有自己的 pending。用户在读取返回前依次点 A、B，两个 `listMemoryCandidates` 可以并行。父层对任一完成都直接 `setCandidate`。当 A 先返回且 React 已提交该编辑器挂载，随后 B 才返回时，同一无 key 的编辑器 props 会换成 B。如果两个返回在首次挂载前被合并，则不一定出现错配；本项针对已有一次编辑器提交后到达的旧响应。`draft`/`tagsText` 仅在初次挂载从 A 初始化，`source`、`sourceExcerpt` 和 baseline 却随 props 变成 B。保存使用当前 B 的 ref 和仍在 state 内的 A 正文。

**影响与关联证据**：内容可被保存为错误来源的项目记忆，损伤后续引用和审计溯源。`src/db/projectMemories.ts:117` 核实的是传入 B ref 是否确属 B 的总结条目；`:345` 接收可人工编辑的 raw input，`:353` 从该 ref 获取来源再创建，不能察觉 UI 把 A 草稿误配给 B。这里不是 repository 越权，而是 UI 编辑会话身份丢失。

**建议**：在父层统一候选请求 token/锁，编辑器开启后拒绝其他旧请求发布。冻结 `{input, ref, excerpt, editorSessionId}` 为一次编辑会话；可用会话 key 重挂，但有 dirty 草稿时先提示，不能仅加 key 然后静默丢弃内容。MemoryEditor 保存的来源应与草稿同一次会话绑定。

**验证**：用 deferred promises 同时点两条，按 A→B 及 B→A 顺序返回，输入标题/正文后保存，断言内容、ref、excerpt 始终匹配且旧响应不能替换活动会话。本次已对实际 TSX 源码做隔离断言：两个 Promotion 确能分别发布 A/B；同一 Editor 实例 A→B 后保存捕获到 `ref=B, body=正文A`。Hook/JSX/DB 适配器为最小模拟，没有实际浏览器或持久数据库写入。

### AU-02 — P2 / confirmed-bug：工作记录/总结草稿的离开保护不完整

**定位**：`src/components/agent/TaskRecords.tsx:57`、`:181`；`src/components/agent/TaskWrapup.tsx:146`、`:168`、`:177`；`src/components/agent/TaskInspector.tsx:142`、`:176`、`:180`；`src/components/agent/AgentChatPage.tsx:728`、`:730`。

**触发机制**：工作记录把 editing 保存在组件本地，关闭 Dialog 时仅判断保存锁就直接清空。按 Escape 或关闭会无丢弃确认地丢掉已输入内容；它也没有上报编辑/保存状态给父层，没有 SPA blocker 或 unload 保护。总结会上报 editing，并防止普通 Sheet 关闭，还注册了 beforeunload；但没有 SPA navigation blocker。浏览器返回、前进或其他路由导航不会触发 beforeunload，任务 ID 改变会重挂 keyed TaskInspector，离开任务也会移除整个编辑子树。

**影响与关联证据**：未保存记录/总结丢失。`src/components/ui/sheet.tsx:69` 的 Content 未 forceMount；关闭 Sheet 不能依靠隐藏 DOM 留存本地 state。`src/routes/_studio.agent.tsx:15` 在同一父 route 中更新 threadId，父层常驻也不能保住被换 key 或被条件移除的任务编辑器。相邻 `AgentGenerationBatches.tsx:184` 和 `MemoryEditor.tsx:111` 已使用 SPA blocker，说明现有 UI 有可复用的保护方式。不要将全部弹窗状态都当成持久草稿；此项针对有实际人工正文的记录/验收总结。

**建议**：按 taskId+记录/总结版本标识编辑会话，明确 dirty/pending/保存失败状态；提供统一的 continue/discard/save-before-leave 交互。记录编辑状态需向 Inspector 上报；任务编辑器的 SPA 离开和 beforeunload 都纳入保护，保存冲突保留草稿与当前位置。

**验证**：输入独特正文后分别 Escape、关闭 Sheet、浏览器返回、切换任务、到任务工作台及刷新；取消离开必须保留草稿，确认丢弃才清空。注入保存失败/CAS 冲突再重复。此项本次为源码控制流和卸载边界证据，未执行 Radix/TanStack 浏览器交互测试。

### AU-03 — P2 / confirmed-bug：参数局部 patch 以旧完整快照写回

**定位**：`src/components/agent/ContextParameters.tsx:14`、`:17`、`:32`、`:41`、`:45`。

**触发机制**：界面有自己的保存锁，但 `patch` 把当前 render 的 `policy` 与单字段 value 展开后传给 `updateContextPolicy`。两个标签页都读到 `{autoCompress:true, limitHistory:false}`，A 关闭自动压缩；尚未收到 live query 新值的 B 开启限制历史，就提交 `{autoCompress:true, limitHistory:true}`。

**影响与关联证据**：用户已保存的独立字段被静默复原，下一次发送使用错误配置。`src/db/contextSettings.ts:7` 在事务中归一化传入对象，`:12` / `:15` 完整替换 contextPolicy；它没有读取当前 policy 再按 changed fields 合并，也没有 CAS。事务避免半写，却不能挽救事务外已合成的旧快照。`tests/contextManagement.test.ts:52` 的默认策略/重置案例可作回归基础，不构成已测 UI 并发。

**建议**：UI 只传变更字段；repository 在同一写事务中读取当前 owner、merge、normalize。若同字段冲突应显式提示，则补 revision 或字段 baseline 校验；不要把一个组件内的 lock 当跨标签页锁。

**验证**：两页先读取相同策略，然后各改不同字段，延迟 live query，断言两个改动均保留；同字段竞争按明确策略处理。本次已执行实际 `contextSettings.ts` + 隔离 DB 适配器：两次旧完整快照顺序提交后 autoCompress 被恢复为 true。未声称已运行真实双标签页 IndexedDB 测试。

### AU-04 — P2 / confirmed-bug：主题行截获子动作的键盘事件

**定位**：`src/components/agent/TopicSidebar.tsx:308`、`:313`、`:324`、`:325`、`:326`。

**触发机制**：父行是 role=button，处理所有冒泡 Enter/Space，调用 preventDefault 和 onSelect。子重命名/删除只在包裹层 stopPropagation(click)，没有隔离 keydown。键盘聚焦子动作按 Enter/Space，父行会选中主题，子动作未激活。

**影响与关联证据**：键盘无法在该路径完成重命名/删除，操作还可能跳转主题。复核安装的 `@lobehub/ui` 5.47.1：`node_modules/@lobehub/ui/es/ActionIcon/ActionIcon.mjs:28` 把动作做成 `Center(role=button, tabIndex=0, onClick)`，没有键盘激活；`Flex/FlexBasic.mjs:6` 默认容器实际是 div。这也说明规范中关于该组件“总是 button”的文字不能替代实际库行为。仅给 wrapper 增加 keydown stopPropagation 仍不足以解决缺少激活语义。

**建议**：将主题选择和重命名/删除做成并列原生 button，避免一个可交互节点嵌套另一个；若暂保留父行，父 handler 必须校验 event.target===event.currentTarget，并为子动作提供真实 button/可靠的键盘激活。

**验证**：Tab 定位行及两个动作，分别 Enter/Space；子动作只触发对应 Dialog，行只触发选中。隔离执行实际 TopicRow handler 已确认子目标事件导致 onSelect 和 preventDefault；库源码证实不存在内置 keydown 激活。尚未执行真实焦点/读屏测试。

### AU-05 — P3 / confirmed-bug：窄屏 CSS 被后置基础规则覆盖

**定位**：`src/components/agent/agentChat.css:503`、`:515`、`:524`、`:568`、`:577`、`:589`；`src/components/agent/ChatWorkspace.tsx:140`；`src/components/agent/agentTheme.ts:45`。

**触发机制**：max-width:767px 中设置消息/普通composer横向8px、content无800px上限，以及底部 `max(12px, env(safe-area-inset-bottom))`。后面的相同选择器无 media 限定；`:571` 和 `:596` 的 padding shorthand 覆盖前述 longhand，`:579` / `:580` 重新施加宽度上限和 auto margin。普通布局变量 CHAT_SAFE_X=16，窄屏实际仍会走16px gutter，底部变成固定16px。

**影响与关联证据**：声明的手机贴边布局不生效；底部安全区大于16px时无法通过这里的 env 规则提供足额留白。`turnNavigation.css` 的更具体左边导航留白不修复 composer 底部。结论基于确定的 cascade 顺序，不声称已经看到遮挡截图或实机故障。

**建议**：先基础规则、后响应式覆盖，或统一以 mobile变量表达safe-x/safe-bottom，再由基础padding消费；不要留下会被后置shorthand重置的safe-area longhand。

**验证**：普通非expanded composer在390px和桌面读取 computed padding/max-width；用有底部安全区的设备或测试替身确认bottom=max(12px,inset)。同时检查turn rail和expanded特殊选择器。此次只有完整CSS阅读及cascade核对，没有实机viewport验证。

## 结构债务

### AU-06 — P2 / structural-debt：上下文入口与明细重复订阅和组装

**定位**：`src/components/agent/ContextUsagePanel.tsx:51`、`:64`、`:88`、`:225`、`:240`、`:252`、`:349`、`:510`、`:565`。

**机制及影响**：trigger常驻执行useContextUsage，打开Popover后Panel再调用一次同Hook。每份Hook都查询配置/线程/压缩/任务/记忆/参考，选择工具、组装请求、估算预算。既有纯planner/helper被正确复用，但没有复用同一份UI查询快照；两个观察者可能在异步刷新期间显示不同的百分比/明细，并重复计算。没有测得耗时、卡顿或已发生的错误预算，分类为结构债务。

**关联调用证据**：trigger用第一份结果给圆环和MemoryContextDetails（`:576`），panel用第二份结果给正文；父层`:565`只转交原始props。共享工具/预算函数并不等于共享订阅结果。

**建议**：在trigger或feature级scope Hook中只读取/组装一次，Panel改为接收view model。保留UI的pending/error/打开状态，纯请求预览组装集中在现有lib模块；冻结历史run和下次发送两种展示需保留区分。

**验证**：mock相同scope的数据订阅和planner调用计数，打开明细后数量不翻倍；切线程/切项目/修改草稿时圆环、明细、记忆sheet始终来自同一identity。对比预览与实际transport的请求材料，允许明确标注的估算差异。

### AU-07 — P2 / structural-debt：生成表单再次编码能力矩阵

**定位**：`src/components/agent/GenerationReview.tsx:194`、`:197`、`:262`、`:283`、`:285`、`:286`、`:289`、`:294`；`src/components/agent/AgentGenerationBatches.tsx:591`。

**机制及影响**：共享GenerationConfigurationFields已经消除了单次与批次的整套表单重复，方向合理；但表单内仍硬编码供应商名称、size/resolution数组、参考视频仅720p、分辨率联动8秒、参考输入固定8秒等约束。它部分读取GENERATION_PROFILES，同时又依据provider自己推导选项。业务支持范围变化需同步改库规则、profile数据和JSX分支，否则用户先选到不兼容值，再在批准前被拒绝。

**关联调用证据**：`src/lib/agent/generationProfiles.ts:38` 的profileRequest仍承担真实校验，`:103` / `:105` 定义MiniMax分辨率/时长，`:117` / `:118` 定义Veo时长/参考输入联动；`:125` 还有可声明的profile列表。`src/lib/agent/generationReviewDraft.ts:5` 已承担选择转换。未确认当前已允许非法付费提交；真实校验不应因UI抽取而削弱。

**建议**：把能力选项与参数变化的合法联动投影为类型明确的纯规则函数，UI只渲染字段和提交用户意图。可在既有generationProfiles/reviewDraft附近增加小型projection，而非引入通用动态表单引擎。单次与批次继续共享字段。

**验证**：以provider/model/input roles为矩阵，对投影允许的每种组合运行profileRequest；不兼容组合保持显式说明，不静默改用户提案。模型切换保留target/input identity；回归单次与批次确认均不在保存默认值时付费。

### AU-08 — P3 / structural-debt：页面承担重复执行收尾与选择镜像

**定位**：`src/components/agent/AgentChatPage.tsx:73`、`:90`、`:192`、`:300`、`:337`、`:429`、`:468`、`:681`。

**机制及影响**：发送、重试和运行动作分别复制controller、sendLock、executionThread、sending和finally收尾；页面还同步持久thread选择与sessionConnectorId/sessionModel，以及effort/interaction各自的作用域对象和revision。路由装配、兼容性检查、运行互斥、错误提示及组件props构造集中在同一函数。不同修改路径已呈现不同错误处理：connector/model持久化Promise被void调用，interaction保存则有catch。这提高修改某个入口时遗漏对等边界的概率；尚未由此确认重复网络提交或越权。

**关联调用证据**：实际互斥仍在 `src/lib/agent/runOwnership.ts:19`；工具恢复/取消在repository，真正transport在executeChatRun。页面调用这些repo符合现有规范；问题是重复的UI会话收尾和多套选择状态，而不是repo调用本身。

**建议**：抽出feature内的useChatExecution（只管理UI controller、pending、scope和动作生命周期），调用既有Web Lock/repository，不复制其业务规则。选择维护一个含scope/revision的明确snapshot，失败反馈统一；页面保留查询/route组合。不要新建冗余global store或“所有操作都走service”的层。

**验证**：对send/retry/approve/reject/cancel各入口注入准备失败、锁不可用、线程切换、transport abort和持久化失败，断言pending归零、旧controller不清理新会话、冻结connector不被当前选择覆盖。当前源码中的安全检查应保持。

## 疑似风险（不作为已测故障）

### AU-09 — P2 / risk：lazy边界仍承载大目录和富消息依赖

**定位**：`src/components/agent/ChatWorkspace.tsx:23`、`:259`；`src/components/agent/ModelIcons.tsx:6`；`src/components/agent/ModelIconCatalog.ts:3`；`src/components/agent/ModelSelectTrigger.tsx:243`；`src/components/agent/MessageList.tsx:13`；`src/components/agent/AgentRunDetails.tsx:10`；`src/components/agent/ContextUsagePanel.tsx:34`。

**已有证据**：本任务主基准build通过。原始 `research/tools/baseline-build-stdout.txt:508`、`:509`、`:510` 给出以下minified体积（单位保持工具的kB，不换成KiB）：

| chunk | minified kB | gzip kB |
| --- | ---: | ---: |
| _studio.agent | 1,624.18 | 520.24 |
| MessageList | 3,673.55 | 957.35 |
| ModelIconCatalog | 3,033.93 | 579.65 |

**源码机制及限度**：MessageList确实只在有消息时lazy挂载；ModelIcons也有Suspense占位，两类拆分已经成立。图标Catalog命名重导出仍连接库的模型/供应商动态匹配表，已选模型chip即可触发，不要求打开菜单。MessageList的ChatItem及AgentRunDetails的Markdown引入富渲染：安装库 `node_modules/@lobehub/ui/es/Markdown/components/CodeBlock.mjs:1` / `:3` 静态引用高亮/Pre变体，`Highlighter/const.mjs:1` 从shiki根入口取bundled语言/主题资料。ContextUsagePanel静态调用toolSchemas也让UI预览连接运行工具注册图。这些是应核查的依赖入口，不是各chunk字节的精确归因。

**影响假设**：首个历史消息、首次选模型或弱网络设备上，下载/解析/富渲染可能昂贵。没有测白屏、首屏时间、主线程长任务、内存或实际网络请求；不能用包体推出具体卡顿秒数，也不能把三项相加当成同一次页面的独立下载总量。

**建议及验证**：先做浏览器network+performance样本，区分空首页、已选模型首页、普通文本历史和含代码历史。检查bundle模块构成再决定是否用有限供应商图标映射、逐模型缓存、按代码块需求加载高亮、或让UI预览只取schema数据。保留降级图标/文本与滚动行为。此次遵照要求没有重复build。

### AU-10 — P2 / risk：文本草稿与附件作用域不一致

**定位**：`src/components/agent/AgentChatPage.tsx:71`、`:116`、`:337`、`:707`；`src/components/agent/useReferenceDraft.ts:17`、`:28`；`src/components/agent/FloatingComposer.tsx:190`。

**观察与触发**：Agent父route不重挂（`src/routes/_studio.agent.$threadId.tsx:7` 明确说明UI位于常驻父layout），文本draft是父层单个字符串。openThread只取消旧执行并navigate；切A→B只重挂ChatWorkspace，文本仍保留。附件Hook却按scope切换数据。因此A的未发送正文可在B看到并提交，而A附件不随行。

**影响假设与限度**：可能把面向A的业务内容误发给B或搭配B附件；这里只确认状态作用域不一致，尚未确认产品要求“跨主题保留统一文本”还是“每个主题独立草稿”，没有记录实际误发/数据泄露。不得直接提升为跨项目权限漏洞，run仍按当前B归属校验。

**建议及验证**：先明确产品语义。若线程独立，文本与附件共用scope，并为新线程转移提供单次原子会话操作；若共享scratchpad，应在切换时明确提醒和提供带入/留存选择。浏览器输入A唯一文本+附件后切B，核对显示、返回A、发送快照与取消行为；无意带入不得只靠用户记住来源。

## 取消、重试、运行归属和权限复核

- `AgentChatPage.tsx:95` 卸载abort，`:106` 按executionThread变化取消旧会话，`:356` 在await之前捕获选择revision；`:429` retry重读历史run/connector并校验归属。未将模型发现的取消flag或controller缺失整对象依赖直接判成竞态。
- `src/lib/agent/runOwnership.ts:19` 使用线程Web Lock、ifAvailable与弃置恢复；不支持锁时`:12` fail closed。页面sendLock仅本地互斥，实际跨标签页保护存在，不能报“只用useState所以并发一定重复提交”。
- `AgentChatPage.tsx:476` 和 `src/db/agentTools.ts:28` 检查run、thread、assistant message关系；`:43` 限制继续当前最后一次run，`:173` 持久审批，`:190` 恢复前处理未决调用。这些外部模块仅为动作链证据，没有登记别组覆盖。
- `AgentControls` 文案限定新运行。实际执行 `src/lib/agent/tools.ts:55` 根据冻结permissionMode/effect/highRisk/requiresConfirmation判断；`src/lib/agent/runChat.ts:149` 挂起审批，`:168` 重核工具定义，`:170` 在领取前再次检查批准。没有证实只切换UI权限就能放行旧run，不能将显示权限当唯一鉴权。
- 批次的本地草稿和paid启动分开，read scope/revision、pendingRef及navigation blocker已核对；引用草稿捕获scope，卸载abort并释放blob资源的路径也已读。本文确认的记忆候选竞态与这些已存在保护分别列出。

## 工具告警复核与未成立的推断

使用 `research/tools/agent-ui-signals.json` 作为定位线索，未把AST函数数、复杂三元、type assertion、文件行数直接计为缺陷。Knip只使用有效的全量（包含测试）结果；首次失效production结果未用。全量Knip没有所有权内整文件未使用项。内部使用但外部未引用的导出（ContextUsagePanel、ReferenceIcon、EMPTY_MEMORY）可收紧可见性；agentTheme部分预留token和MUTED别名可清理，但不单独报运行故障或断言全部CSS无用。

逐项复核Hook线索：`AgentChatPage.tsx:200` 按实际读取字段触发同步；`:253` 的发现依赖覆盖连接id/definitionId/baseUrl/apiKey；`:427` 缺catalog元信息是维护风险，但当前 `useReferenceDraft` 每render返回新对象，references使该callback也重建，不能声称已经产生旧catalog闭包。`AgentRunDetails.tsx:93` 的验证memo读取status/result；附件blob资源Effect围绕blob/kind；`TaskWrapup.tsx:171` 向父层上报的是draft/candidate布尔存在性；`useReferenceDraft.ts:25` 告警涉及稳定Map ref清理，并非DOM ref切换。这里记录语义结果，未再次运行eslint或将自动告警全盘接受。

用TypeScript AST仅在61文件内解析静态import/export：93条边，其中9条类型边；包含类型边的SCC为AgentRunDetails/GenerationReview/MusicGenerationReview/AgentGenerationResults/AgentGenerationBatches，去除类型边后没有静态值循环。动态import、第三方模块和所有权外图不在这一断言范围内。`RunAction` 的类型反向引用不会在运行时require/import组件，因此没有报值循环缺陷。

## 建议边界（独立于现状）

| 位置 | 保留职责 | 可收敛的边界 |
| --- | --- | --- |
| AgentChatPage | feature级查询、路由与页面组装；允许repo调用 | UI执行会话controller与统一收尾放入feature Hook；选择改为明确scope snapshot |
| ChatWorkspace / MessageList / RunDetails | 布局、滚动、稳定消息行、账本展示 | 按真实需求加载富渲染；不要接管ledger状态机或重试安全规则 |
| ContextUsage | 开关/展开与估算展示 | 一次scope查询产出共享view model；纯预算组装用既有lib |
| GenerationReview / Batches | 用户审阅、draft、确认动作与fee提示 | provider能力投影与参数联动归纯规则模块；持久revision和paid eligibility继续归repo/runtime |
| TaskInspector / Records / Wrapup | 表单、人工确认与历史展示 | 统一task-scoped编辑会话/离开契约；记录和总结都需参与dirty/pending状态 |
| MemoryPromotion / MemoryEditor | 候选选择、人工修订与冲突呈现 | 一次候选请求/编辑会话冻结input+ref；repo继续校验来源/CAS |
| UI helpers / CSS | 纯展示转换、局部视觉/资源生命周期 | 清理无用导出与重叠cascade即可；不增加通用抽象层 |

## 验证记录与重要限度

完成四组隔离源码断言：MemoryEditor同实例来源更换、MemoryPromotion双条目并发发布、TopicRow子目标keydown、contextSettings旧对象覆盖。方式为本机Node v24.11.0 + TypeScript 5.9.3内存转译实际源码，以小型Hook/JSX/DB适配器捕获输入输出；全部最终断言通过，没有创建测试文件或写产品数据。它证明所列代码机制，不替代真实React调度、焦点行为或原生IndexedDB事务测试。另用PostCSS解析实际样式并断言同selector在526行的mobile safe-area longhand之后存在596行的padding shorthand；这是源码cascade核对，不是computed-style测量。草稿通过路由/父子状态/卸载控制流核对，二者未跑浏览器。

本地相关依赖读取版本为React 19.3.0、@lobehub/ui 5.47.1、@lobehub/icons 5.18.0、dexie-react-hooks 4.4.0（按已安装package.json，不以package.json范围猜版本）。外部参考仅使用安装依赖的实际源码，未查网或评估最新版本。参考现有context/review等测试的意图与接口，未运行全套测试、lint或性能基准。任务主build结果仅引用原始日志；没有额外重复build、真实供应商调用或付费操作。

相关上下文已读取task PRD/design/implement、角色协议、workflow及目录/组件/Hook/类型/质量规范；该任务没有research.jsonl，任务路径按用户提供的Active task和角色fallback使用。领域契约主要为agent-execution、agent-tools、agent-tasks、agent-task-wrapup、project-memory、agent-memory-retrieval、agent-references、agent-batch-generation、agent-activity-ui、chat-performance，并核对state-management的事务merge/草稿保护条款。现有规则允许feature page调用repository，本报告未将所有调用一概判错。方案建议是审查意见，没有修改规范或产品。源码一致性仅覆盖manifest-owned文件，其他组可以继续变更。

## 逐文件阅读清单

以下状态与机器可读JSON一致；“未确认独立缺陷”仅表示本次阅读证据不足以列出发现，不是无限条件的正确性保证。

| 文件 | 状态 / 一行结论 | 发现 |
| --- | --- | --- |
| `src/components/agent/AgentActivityNavigation.tsx` | reviewed；按thread重置的活动定位Context；不承担执行授权或运行状态机。 | — |
| `src/components/agent/AgentChatPage.tsx` | reviewed；入口查询、选择镜像与发送/重试/审批编排；复核取消、Web Lock、线程身份、草稿作用域及回调依赖。 | AU-02, AU-08, AU-10 |
| `src/components/agent/AgentComposerAttention.tsx` | reviewed；按线程聚合待处理工具/批次/任务提示；仅导航提醒，实际动作仍在执行层校验。 | — |
| `src/components/agent/AgentControls.tsx` | reviewed；助手配置与权限说明、技能开关及菜单焦点；说明针对新运行，实际权限使用冻结快照。 | — |
| `src/components/agent/AgentGenerationBatches.tsx` | reviewed；逐段核对批次读取身份、revision、同步pending锁、SPA blocker、预览与队列动作；共享生成字段承载规则矩阵。 | AU-07 |
| `src/components/agent/AgentGenerationResults.tsx` | reviewed；单次结果与持久批次组合；批次子树稳定，不因单次job列表出现而重挂。 | — |
| `src/components/agent/AgentRunDetails.tsx` | reviewed；工具/运行过程展示、审批和恢复入口、按归属过滤工具；RunAction为类型边，富Markdown进入懒加载消息图。 | AU-09 |
| `src/components/agent/AgentWriteOutcomes.tsx` | reviewed；消费已规范化写入回执；区分历史写入结果与当前对象可用性。 | — |
| `src/components/agent/ChatWorkspace.tsx` | reviewed；布局、composer安全留白、侧栏及MessageList lazy；工作区key不能重置父层文本草稿。 | AU-05, AU-09, AU-10 |
| `src/components/agent/ContextCompactionDetails.tsx` | reviewed；压缩记录展示与详情展开；不发起压缩或改写历史消息。 | — |
| `src/components/agent/ContextParameters.tsx` | reviewed；参数控件局部互斥有效，但局部patch展开为旧快照整对象再持久化。 | AU-03 |
| `src/components/agent/ContextUsagePanel.tsx` | reviewed；核对范围身份、冻结运行与下次请求预览、预算和工具组装；触发器及弹层各自调用整套查询Hook。 | AU-06, AU-09 |
| `src/components/agent/CreatedEntityLinks.tsx` | reviewed；工具结果链接规范化与项目续聊；只接受站内路径并检查关联项目/线程。 | — |
| `src/components/agent/FloatingComposer.tsx` | reviewed；输入、发送快捷键、语音和扩展面板；Effect清理与IME判断已读，文本由父层供给。 | AU-10 |
| `src/components/agent/GenerationReview.tsx` | reviewed；单次提案编辑、批准前校验和保存默认值；共享字段中仍内嵌供应商能力/时长等规则。 | AU-07 |
| `src/components/agent/Grainient.tsx` | reviewed；完整读取shader及WebGL生命周期；资源释放、不可用回退、可见性/降动效逻辑均已核对。 | — |
| `src/components/agent/HomeWelcome.tsx` | reviewed；欢迎页、近期线程与任务入口；复用composer，不负责运行持久化。 | — |
| `src/components/agent/LobeChatTheme.tsx` | reviewed；聊天范围的Lobe/antd主题与CSS入口；未导入全局antd reset。 | — |
| `src/components/agent/MemoryContextDetails.tsx` | reviewed；当前预览和历史冻结记忆/参考来源、排除操作及可用性；观察显示与真实历史请求分开。 | — |
| `src/components/agent/MessageList.tsx` | reviewed；逐行读消息memo、滚动意图、ResizeObserver、工具归属过滤及稳定批次子树；富渲染包体风险。 | AU-09 |
| `src/components/agent/ModelIconCatalog.ts` | reviewed；普通手写的三行命名重导出；不是生成文件，动态边界仍连接完整模型/供应商匹配图。 | AU-09 |
| `src/components/agent/ModelIcons.tsx` | reviewed；两个named lazy共享Catalog模块，Suspense占位固定尺寸；lazy不等于缩小目录模块。 | AU-09 |
| `src/components/agent/ModelSelectTrigger.tsx` | reviewed；连接/模型菜单、能力说明、搜索及图标；已选模型的常驻chip就会触发Catalog加载。 | AU-09 |
| `src/components/agent/ModelSettingsMenu.tsx` | reviewed；模型/推理设置菜单；只提交选择，不负责权限或执行调度。 | — |
| `src/components/agent/MusicGenerationReview.tsx` | reviewed；音乐提案快照、准备状态、批准前复核和费用提示；RunAction为import type。 | — |
| `src/components/agent/ProjectImageSources.tsx` | reviewed；消费规范化项目图片来源并展示原始依据；不将URL标签当图片真实性证据。 | — |
| `src/components/agent/ProjectPicker.tsx` | reviewed；项目选择/创建、同步互斥和错误反馈；页面级repository调用符合现有规范。 | — |
| `src/components/agent/ReferenceAttachments.tsx` | reviewed；附件、来源预览与消息引用；blob URL清理依赖资源身份，未把整对象缺失告警直接判为失效。 | — |
| `src/components/agent/ReferenceLibrary.tsx` | reviewed；作用域内来源读取、导入重试和选择；异步选择闭包仍携带旧scope，未证实跨线程误附。 | — |
| `src/components/agent/TaskBoard.tsx` | reviewed；任务分组、筛选和创建；纯UI分组与repository事务分离。 | — |
| `src/components/agent/TaskInspector.tsx` | reviewed；任务概览编辑、状态动作与总结锁联动；记录编辑状态未上报，route key变化仍会卸载编辑器。 | AU-02 |
| `src/components/agent/TaskRecords.tsx` | reviewed；记录/工具/生成依据聚合和手动记录表单；关闭直接丢弃，未提供SPA或unload草稿保护。 | AU-02 |
| `src/components/agent/TaskWrapup.tsx` | reviewed；总结读取保留最后有效值、CAS、取消/恢复和记忆提升；路由离开草稿保护及候选身份存在缺口。 | AU-01, AU-02 |
| `src/components/agent/ThinkingMatrix.tsx` | reviewed；空流动画、计时器和卸载清理；动画行数/复杂度没有直接作为缺陷。 | — |
| `src/components/agent/ThinkingPanel.tsx` | reviewed；思考文本、展开状态与完成状态联动；展示组件不改变运行判断。 | — |
| `src/components/agent/TopicSidebar.tsx` | reviewed；标题筛选、时间组与主题动作；子动作键盘事件被行级Enter/Space处理截获。 | AU-04 |
| `src/components/agent/TurnNavigation.tsx` | reviewed；回合定位、滚动/resize监听和清理；导航能力不进入执行状态机。 | — |
| `src/components/agent/WebResearchSources.tsx` | reviewed；消费规范化网络检索来源和摘要；未直接信任未解析工具结果。 | — |
| `src/components/agent/agentChat.css` | reviewed；全文读取全部1623行，含全部media规则；窄屏规则随后被同优先级基础规则及shorthand覆盖。 | AU-05 |
| `src/components/agent/agentTheme.ts` | reviewed；布局常量与预留tokens；CHAT_SAFE_X=16支持CSS覆盖证据，未用导出/行数告警推断运行故障。 | AU-05 |
| `src/components/agent/composerAttention.css` | reviewed；全文读取提示条、动作与窄屏样式；未确认独立缺陷。 | — |
| `src/components/agent/composerControls.css` | reviewed；全文读取模型/权限/plus面板和扩展编辑器样式、响应式与交互态；未确认独立缺陷。 | — |
| `src/components/agent/composerTypes.ts` | reviewed；composer输入/回调契约；类型导入不产生运行时依赖边。 | — |
| `src/components/agent/contextParameters.css` | reviewed；全文读取参数表单、开关、高级预算及反馈样式；数据覆盖问题不归因于CSS。 | — |
| `src/components/agent/executionActivity.css` | reviewed；全文读取时间线、审批控件、结果面板与响应式状态；未确认独立缺陷。 | — |
| `src/components/agent/filterThreadsByTitle.ts` | reviewed；纯标题筛选；归一化输入与原数组顺序逻辑已读。 | — |
| `src/components/agent/generationBatch.css` | reviewed；全文读取批次配置/候选/状态/预览与移动布局；未以选择器或行数告警判为业务故障。 | — |
| `src/components/agent/homeGrainient.css` | reviewed；全文读取装饰画布定位、遮罩与交互隔离；未确认独立缺陷。 | — |
| `src/components/agent/memoryContext.css` | reviewed；全文读取记忆详情sheet、来源和预算状态布局；未确认独立缺陷。 | — |
| `src/components/agent/references.css` | reviewed；全文读取参考来源库、附件、媒体与文本预览规则；未确认独立缺陷。 | — |
| `src/components/agent/taskWorkspace.css` | reviewed；全文读取任务board/inspector/dialog及窄屏布局；草稿损失根因在状态/卸载边界。 | — |
| `src/components/agent/taskWrapup.css` | reviewed；全文读取总结编辑、依据、历史和冲突反馈样式；未确认独立CSS缺陷。 | — |
| `src/components/agent/timeGroups.ts` | reviewed；纯时间分组及标签，逐函数核对；不拥有任务生命周期。 | — |
| `src/components/agent/turnNavigation.css` | reviewed；全文读取回合导航、hover/focus和移动留白；该样式的左侧额外留白不修复composer底部safe-area覆盖。 | — |
| `src/components/agent/useReferenceDraft.ts` | reviewed；按scope保存附件/导入草稿，异步返回作用域捕获和卸载abort；与父层单字符串文本作用域不同。 | AU-10 |
| `src/components/memory/MemoryEditor.tsx` | reviewed；记忆CAS、冲突读取、dirty blocker均已读；初始化draft固定但来源props可被候选并发更新替换。 | AU-01 |
| `src/components/memory/MemoryPromotion.tsx` | reviewed；逐条异步读取确认总结候选；每条独立pending，不协调父层候选请求身份。 | AU-01 |
| `src/components/memory/ProjectMemoryPage.tsx` | reviewed；记忆列表/详情/历史及编辑流程完整阅读；路由key正确覆盖project与memory深链身份。 | — |
| `src/components/memory/memory.css` | reviewed；全文读取记忆页/编辑/冲突/来源及全部media规则；未确认独立样式缺陷。 | — |
| `src/components/memory/memoryLabels.ts` | reviewed；纯分类/来源标签映射；未把presentation helper提升为业务层。 | — |
| `src/components/memory/readMemory.ts` | reviewed；将读取失败显式包装data/error；未当作缺失数据悄然继续写。 | — |
