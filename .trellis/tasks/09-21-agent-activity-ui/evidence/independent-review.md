# 独立代码复核

审阅范围：本任务 PRD/design/implement/check.jsonl 对应的公开过程持久化、Chat/Responses 工具轮、历史兼容、正文归属、折叠、composer 提醒与直达、批次草稿保护，以及追加的左侧轮次定位。未修改已有审查日志与归档。

## Findings (fixed)

- File: `src/components/agent/AgentGenerationResults.tsx`
  - Issue: 没有单项生成 job 时直接返回 `AgentGenerationBatches`，有 job 后切换为 Fragment；React 根节点类型变化会重挂批次组件。在批次弹窗有未保存编辑时出现/删除同 run 的单项 job，会丢失本地编辑与导航保护，并可能重放尚在 Context 中的 reveal 请求。
  - Fix: 固定 Fragment 与批次子树位置，仅条件渲染单项 job 结果区域。过程折叠、单项 job 变化都保留批次状态。
- File: `src/components/agent/AgentRunDetails.tsx`（反馈由 activity_transcript 实施）
  - Issue: composer 直达具体工具时，首次 lazy 加载的 ledger liveQuery 尚未完成，定位 effect 会过早回退到 run 顶部，calls 到达后不重新定位。
  - Fix: callId 对应记录未出现时等待，依赖 calls 后再定位；按 request.key 记录已定位请求，后续数据库刷新不会持续抢焦点。
- File: `src/components/agent/MessageList.tsx`（反馈由 activity_transcript 实施）
  - Issue: 追加导航工作中的 `Array.findLast` 超出现有 TypeScript lib target，类型检查失败。
  - Fix: 使用兼容的过滤数组与 `.at(-1)`，保持现有编译目标。
- File: `tests/agentActivityPersistence.test.ts`, `tests/runPresentation.test.ts`
  - Issue: 缺少新公开快照的事务故障及旧会话压缩后边界回归证据。
  - Fix: 增加 run 写入失败后工具 ledger 与快照一起回滚断言；增加 compacted base 长度与原 request 不同时，仍只恢复当前执行后缀的断言。

## Findings (not fixed)

未留下已确认、属于本任务范围的未修复代码缺陷。以下验证由主会话继续完成，不等同于已经通过：

- 隔离浏览器验证完整布局、导航跳转和草稿保护。特别增加：未保存批次编辑期间插入/移除同 run 单项 job，确认弹窗和草稿不丢、离开保护仍生效。
- 完整测试集与生产构建由主会话统一运行，避免并发重复构建。

曾怀疑展开 composer 会卸载 transcript 并重放请求；检查实际代码后排除：当前通过 `inert` / `visibility` 隐藏，保持挂载。线程切换时 provider 同步屏蔽前一线程请求，因此未添加多余消费状态机制。

## Verification

- Lint: **pass** — 项目 `pnpm lint` 实际执行 `tsc -b --pretty false`，使用用户指定本机 pnpm 路径。
- TypeCheck: **pass** — 同上。
- Tests: **pass** — 7 文件、68 测试：`runPresentation`、`agentActivityAttention`、`agentActivityPersistence`、`chatTurns`、`agentTools`、`agentGenerationBatch`、`agentGenerationBatchSafety`。
- Diff whitespace check: **pass**。
- 代码链路确认：公开 reasoning 只来自现有公开 stream 输出；Responses opaque 内容不作为 UI 源；快照与工具调用在同一事务；最终 completed 文本即使重复早期字句仍保留；上下文压缩只改变 base，不破坏当前工具后缀；旧会话不展示原请求历史。
- 行为确认：外层折叠只随状态转换自动收起；失败/审批不禁用手动折叠；计时 state 独立在小组件；完成后批次提醒不依赖最新 run 仍在运行；未知结果不出现自动重发入口；关闭/缺失任务及过时 run 不产生批准/继续提醒。
- 导航确认：轮次以稳定 user message.id 为锚，重试更新同轮摘要；预览为纯文本；导航自身管理滚动高亮，未把每次 scroll state 放到 MessageList；跳转/过程直达暂停自动跟随。
- 增量错误诊断复核：非法参数在工具执行前结构化为 `INVALID_TOOL_ARGUMENTS`，Chat/Responses 都把“未执行、字段、约束、修正方式”传回模型；原始 arguments 保持不变，未引入自动重试。非法 read 不因解析失败被误标为高风险；写入、网络和付费类继续遵守原批准矩阵。旧泛化错误仅以当前本地 schema 重新检查，UI 标明这是补充诊断，不改写历史。
- 增量错误诊断测试：类型名称采用中文且只展示安全类型标签，不回显模型输入字符串；整数、枚举、未知字段仍严格拒绝。相关 5 文件共 55 项测试通过。
- 规范同步：已检查主会话新增 `agent-activity-ui.md` 和关联索引/聊天性能规范，与本次实现一致。

## 主会话最终验证（2026-09-21）

- 浏览器隔离 fixture：执行折叠/展开、实时/冻结计时、失败/审批重复收起、完成后批次提醒、展开编辑器提醒、批次草稿在单项 job 增删时保持、5 轮定位栏显示、最多10条刻度窗口、波浪长度、预览/点击/键盘/手机外部关闭及无横向溢出均通过。
- 工具错误 fixture：截图中的 `limit=24000` 与 `field=script` 同时返回 12000 上限和 `story.script` 路径修正建议；工具未执行、read 不误标高风险；旧泛化错误显示当前规则补充来源。
- 最终 `pnpm test`：85 个测试文件、1011 项通过；最终 `pnpm lint` 与 `pnpm build` 通过；`git diff --check` 通过。第一次全量并发运行的单个5秒超时随后独立及全量重跑均通过，未复现。

- 最终视觉微调：footer 背景遮罩向上延伸136px、模糊22px，控件可点击且全屏编辑时禁用；桌面与手机均验证。轮次刻度统一左对齐、默认及active均6px，仅hover伸长；桌面12px间距，最多120px高。最终浏览器13项检查通过且页面错误为空；增量类型检查与diff检查通过。
