# 实施计划：Agent 体验精简与稳定性

## 前置条件

- 任务保持 `planning`，等待用户明确批准本计划后才能 `task.py start` 并实现。
- 基线：`main`，当前工作区干净。若用户要求，先创建独立实现分支；不在本任务内合并、推送或发布。
- 命令必须使用本地 Node：`PATH=/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin:$PATH`，并显式调用 `/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm`。
- 上下文注入可能截断大文件，实施/检查代理必须显式拉取 `agent-execution.md`、`agent-write-evidence.md`、`agent-activity-ui.md`、`state-management.md` 的相关小节，不能只凭注入前缀。
- 派发实施/检查子代理时，提示词首行必须是 `Active task: .trellis/tasks/10-13-agent-experience-overhaul`。

## 有序清单

1. **删除成果声明链（R1/A1）。** 按 design 阶段 1 删除文件、移除 `runChat.ts:318` 调用、收窄类型、移除 `agentRuns.ts` 的翻写逻辑；先 grep 确认 `finalReviewEvidence.ts` 中共享函数的全部消费者再动手。同步修测试。运行定向测试与 `pnpm lint`。
2. **收窄结束前检查（R2/A2）。** 改 `saveAgentFinishingCheck` 触发条件与 `buildFinishingCheckPrompt` 措辞；更新 `agent-execution.md`；改写 `agentFinishingCheck.test.ts`、`agentFinishingCheckPrompt.test.ts`，新增"纯问答只发一次请求"与"有工具调用仍检查一次"的用例。运行定向测试。
3. **终态与状态收敛 + 缺陷修复（R6/A7）。** 引入 `settleRun()`，修 D2–D5，尽修 D6–D11；`cancelAgentRun` 改走统一终态；消除重复的 `hasToolCalls` 读取。为 D1–D5 加回归测试（D1 在阶段 4）。运行 `pnpm lint`、定向测试、`pnpm quality`。
4. **D1 工具错误回给模型（R6/A7）。** 改 `runChat.ts` 与 `saveToolRound`；补回归测试断言"未提供工具 → 模型收到失败结果且运行继续"。运行定向测试。
5. **消息界面与工具时间线（R3/R4/R5/A3–A6）。** 先做渲染与行为，再清理样式；批准按钮落到调用行；输入框卡片只做指路。每完成一个组件跑一次定向测试。此阶段风险最高，先在一个组件上验证再铺开。
5c. **工具调用样式与话题侧栏（R9、R10/A10、A11，用户中途追加）。** 先做 R9（只涉及 `executionActivity.css`、`agentChat.css`、`AgentRunDetails.tsx` 的调用行文案取值与展开箭头显示，不改行为）；再做 R10：新增按项目/按时间的分组纯函数（可测）与本机偏好读写，重做 `TopicSidebar.tsx` 的结构与样式，侧栏需要项目列表，由 `AgentChatPage` 已有的 `projects` 经 `useAgentTopicNavigation` 传入，不新增查询。补分组、偏好回退、「未关联项目」与已删除项目、相对时间的测试。运行 lint、定向测试、quality。
6. **聊天界面测试（R8/A8）。** 新增消息呈现与工具时间线测试，覆盖成功静默、失败、停止、待批准、已保存行、合并与批准行。
7. **全量门禁。** `pnpm lint`、`pnpm test`、`pnpm quality`、`pnpm quality:self-test`、`pnpm model-bank:verify`、`pnpm build`、`pnpm --dir desktop/tauri types|lint|quality`。修复发现的问题并复测。
8. **规范同步。** 更新 `agent-execution.md`（结束前检查、终态、异常路径）、`agent-activity-ui.md`（界面规则与删除项）、`agent-write-evidence.md`（若"已保存"行措辞变化）、`component-guidelines.md`（对话区视觉约定）、必要的 `ai-connectors.md`（若付费请求计数断言变化）。
9. **真实窗口检查（A9）。** 至少 1280x720 与 760x520：流式、工具运行、批准/拒绝、失败、停止、重新生成、展开输入、滚动与回到底部。此项须由用户或 UI 工具完成，我无法替代；未完成前不得声称 A9 通过。
10. **收尾。** 记录实际结果与限制；按阶段提交（R1/R2 一组、R6/D1 一组、界面一组），然后经 Trellis 归档与 journal。不推送、不发布。

## 验证命令

```sh
PATH=/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin:$PATH /Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm exec vitest run <定向测试文件>
PATH=/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin:$PATH /Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm lint
PATH=/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin:$PATH /Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm test
PATH=/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin:$PATH /Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm quality
PATH=/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin:$PATH /Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm quality:self-test
PATH=/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin:$PATH /Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm model-bank:verify
PATH=/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin:$PATH /Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm build
PATH=/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin:$PATH /Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm --dir desktop/tauri types
PATH=/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin:$PATH /Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm --dir desktop/tauri lint
PATH=/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin:$PATH /Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm --dir desktop/tauri quality
```

这些是计划命令，尚未执行。`quality` 当前基线为 12 errors / 584 warnings / 12 allowances 且 0 failures；实施后不得使 failures 增加，并应因删除而下降。

## 风险文件与检查点

- `src/lib/agent/runChat.ts`：工具循环、异常终态、D1；改动后必须跑 `agentExecution` 相关定向测试与全量测试。
- `src/db/agentRuns.ts`、新增 `settleRun()`：并发与终态一致性，是中断/取消/重试语义的核心；改动前后都要跑 `agentRuns.test.ts` 与 `chatPerformance` 相关测试。
- `src/db/agentFinishingCheck.ts`：付费请求计数变化，测试与规范同步。
- `src/lib/agent/finalReviewEvidence.ts`：共享函数误删会波及音频生成与任务收尾，必须先 grep 全部消费者。
- `src/components/agent/MessageList.tsx`、`AgentRunDetails.tsx`、`agentChat.css`：当前无测试，视觉与行为回归风险最高；先做小范围验证。
- `src/components/agent/AgentRunDetails.tsx` 的生成/音乐审核对话框：草稿所有权不可破坏。
- `src/components/agent/AgentChatPage.tsx`（698 行，圈复杂度 99）：D2/D4/D5 所在，改动时按需拆分，但不得借机做大范围重写。

## 检查点与回滚

- 每个阶段结束提交一次，任一阶段引发回归可单独 `git revert` 该提交。
- 阶段 5 若发现自绘导致 markdown/流式/空状态难以保持，退回"保留 `ChatItem` + 样式收敛"，并记录该偏离。
- 不得重置或回退与本任务无关的既有改动。
- 任何偏离已批准产品行为的情况（如 R2 触发条件进一步放宽、R3 保留某项提示）需回到规划评审后再继续。
