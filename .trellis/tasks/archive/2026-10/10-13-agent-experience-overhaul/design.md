# 技术设计：Agent 体验精简与稳定性

## 1. 边界与所有权

- 不改变任何业务工具（`src/lib/agent/*Tools.ts`）的语义、审批与幂等契约；本次只改"过程呈现、状态文案、终态收敛、检查调度"。
- 保留既有所有者：`runOwnership` 的 Web Lock、消息/运行的序列化写入器、生成与音乐审核对话框的草稿所有权（`AgentRunDetails.tsx` 的 "Keep mounted" 注释）、`useAgentActivityNavigation` 的滚动/聚焦、`selectActivityAttention` 的指路。
- 本轮不触碰存储/schema/同步；唯一数据面改动是移除 `AgentRun.finalReview` 字段的写入与读取，须保证旧记录可读。

## 2. 分阶段设计

### 阶段 1：删除成果声明链（R1）

- 删除文件：`src/lib/agent/runFinalReview.ts`、`src/lib/agent/finalReview.ts`、`src/db/agentFinalReview.ts`、`src/domain/agentFinalReview.ts`、`src/components/agent/AgentFinalReviewStatus.tsx`。
- `src/lib/agent/finalReviewEvidence.ts`：只删仅服务成果声明的部分；`inspectAudioGenerationOutputs`、`inspectTaskGenerationOutput`、`ownedAgentAudioBatchJob` 及其依赖的辅助函数必须原样保留。
- `src/lib/agent/runChat.ts:318`：移除 `reviewFinalReply` 调用与相关导入。
- `src/domain/agent.ts:187` 的 `finalReview?: AgentFinalReview`：删除字段与 `AgentFinalReview` 类型；旧记录中残留的 `finalReview` 属性在 Dexie 下天然被忽略，无需迁移。`domain/agent.ts:141` 的 `purpose?: "final_review"` 联合类型收窄为删除该成员（历史指标记录中已存在的值不在类型层面校验，读取时按字符串处理，不发生运行时错误——实现时须确认读取路径不按该联合类型做穷尽分支）。
- `src/db/agentRuns.ts`：移除 `pending → unverified` 翻写逻辑。
- 测试：`tests/agentFinalReview.test.ts` 整文件删除；`tests/responsesStream.test.ts:254`、`tests/agentUsage.test.ts:51`、`tests/reasoningPolicy.test.ts`、`tests/audioAgentExecution.test.ts` 等对 `final_review` 指标的断言改为断言不再产生该指标；其余仅因导入被牵连的测试按实际行为调整，不得放宽无关断言。

### 阶段 2：收窄结束前检查（R2）

- `src/db/agentFinishingCheck.ts` 的 `saveAgentFinishingCheck`：在现有守卫（running、smart、有工具、步数合法、归属未变、无更晚用户消息等）之外，新增"必须有实际工具调用，或存在带未完成项的已校验计划"这一条件；无工具且无未完成计划时返回 `false`。
  - 注意：现有代码在 `run.plan` 为 `undefined` 时会走到 `terminal_reply` 分支；新逻辑要求"无工具调用 ⇒ 直接 `false`"，即 `calls.length === 0 && (!plan || plan 全部完成)` 时返回 `false`。
- `src/lib/agent/finishingCheck.ts` 的 `buildFinishingCheckPrompt` 不再需要"没有执行计划也需要检查是否只承诺行动而尚未执行"那段兜底措辞，改为只在有未完成计划或已发生工具调用时描述当前事实。
- 规范：`agent-execution.md` 的 "Bounded terminal finishing check" 段落更新为新的触发条件，并改写 "不得为保持旧计数而关闭该功能" 这类约束，改为"必须断言真实付费请求数"。
- 与 R1 的叠加效果：一次普通回复从最多 3 次模型请求降为 1 次；有工具调用或未完成计划时最多 2 次。

### 阶段 3：终态与状态收敛（R6 + R7 前置）

- 新增单一终态写入入口 `settleRun()`（建议置于 `src/db/agentRuns.ts` 或新的 `src/db/agentRunTerminalState.ts`），统一处理 `finishAgentRun`、`cancelAgentRun`、异常路径的终态、`updatedAt`、`pauseReason` 与消息 `status` 的一致性；`cancelAgentRun` 不再绕过 `finishAgentRun`（D11 相关），并消除审计指出的"中断/取消依据两次读取 `hasToolCalls`"。
- D3/D4/D5 为局部修复：`commitRename` 加错误处理并给出提示；模型目录发现改为返回值或 `.catch`，避免永久 loading；删除确认的状态在任务离开守卫被拒时不清空。
- D6–D11 逐条修复，能加回归测试的加测试。
- 只做这些改动直接牵出的谓词去重（"run 阻塞话题"等），不扩大重构面。

### 阶段 4：D1 工具错误回给模型（R6）

- `src/lib/agent/runChat.ts:323-337` 与 `src/db/agentTools.ts` 的 `saveToolRound`：模型请求了未注册工具或本轮未提供的工具时，把它当作一次"失败的工具调用结果"落库并回给模型（与 `runChat.ts:126-133` 参数无效的处理路径一致），使模型能在同一轮内自我纠正，而不是让整轮抛错失败。
- 需决定并记录：未注册工具在数据库中如何命名与标记（例如以模型给出的原始名称落库、`effect: "read"`、`status: "failed"`、错误文案给出可用工具提示），以及它对分组显示的影响（应显示在时间线中，不触发审批）。

### 阶段 5：消息界面重构（R3/R4/R5）

- 渲染层：
  - `MessageList.tsx`：助手消息改为自绘结构（无 `ChatItem` 的标题/头像/时间；正文 + 悬停才显示的操作栏）；移除 footer 中的模型名、tok/s、token 与状态行重复项，状态只在 R4 规定的位置出现。
  - `AgentRunDetails.tsx`：时间线重做。摘要行由 `execution.label/detail` 改为"用了 N 个工具"；删除 `ValidationFailureNotice`、`执行记录` 弹窗、`RunElapsed` 的计时显示（运行中可保留一行"进行中"）；失败行内联错误；批准行自动展开并承载「批准」「拒绝」。
  - `AgentWriteOutcomes.tsx`：保留条目与跳转，删除免责段落与"本次写入缺少可核验记录"。
  - `AgentComposerAttention.tsx`：只保留指路与滚动聚焦，不再承载第二套批准按钮。
  - `AgentFinalReviewStatus.tsx` 已在阶段 1 删除。
- 样式层：`agentChat.css` 中对话区规则重写；删除本次改动范围内不再需要的 `!important`；不得改变输入框（`FloatingComposer`）、`agent-composer-dock`、滚动归属与"回到底部"`snapChatToBottom` 相关行为。
- 组件策略：优先自绘以避开库默认样式的 `!important` 覆盖；若自绘会导致消息渲染（markdown、流式、`renderMessage`、空状态矩阵）重复实现，则保留 `ChatItem` 但隐藏其标题/头像/时间槽并通过样式收敛，且不新增 `!important`。

### 阶段 6：测试与验证（R8）

- 新增：`tests/agentMessagePresentation.test.tsx`（或等价）覆盖成功静默、失败、停止、待批准、已保存行；`tests/agentToolTimeline.test.tsx` 覆盖合并、失败行、批准行；`tests/agentRunDefects.test.ts` 覆盖 D1–D5。
- 更新被 R1/R2 影响的现有测试。
- 运行：`pnpm lint`、`pnpm test`、`pnpm quality`、`pnpm quality:self-test`、`pnpm model-bank:verify`、`pnpm build`、`pnpm --dir desktop/tauri types|lint|quality`。

## 3. 兼容与迁移

- 无破坏性数据迁移。`AgentRun.finalReview` 与 `ModelCallMetric.purpose === "final_review"` 的既有记录保留在库中但不再读写；类型层面移除后，读取历史指标的位置（若有）按可选字符串处理。
- `finishingCheck` 字段含义扩大：原 `reason: "unfinished_plan" | "terminal_reply"` 保留，但产生 `terminal_reply` 的前提变为"已发生工具调用"。历史记录保持原值不变。
- 不新增任何依赖。

## 4. 权衡

- 删除成果声明链：损失"对最终回复的只读核验"这一能力，换取每个工具轮一次模型请求的成本与延迟；用户 2026-10-13 已明确选择。
- 收窄结束前检查：纯问答不再被兜底检查"只承诺不执行"；若未来发现模型频繁空承诺，可按 R2 的条件重新扩展（有工具调用或未完成计划时仍会检查）。
- 助手消息自绘 vs 样式覆盖：自绘更彻底但需处理 markdown/流式/空状态；样式覆盖风险低但可能残留库行为。实现时先自绘，遇到不可控行为再退回覆盖并记录。

## 5. 回滚

- 各阶段独立可回滚：R1/R2 为删除与条件收窄，R5/R6 为渲染与修复；分阶段提交，任一阶段引发回归可单独回退而不影响其他阶段。
- 阶段 5 视觉改动集中在 `agentChat.css` 与两个渲染组件，回退面小。
