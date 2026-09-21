# 实现前代码证据

- `AgentRunDetails` 原 `open = expanded || needsAttention`，同时给 summary 加 aria-disabled 并跳过点击，导致失败/审批/可恢复执行无法折叠。修复必须解除展示状态与业务阻塞状态的绑定。
- `runChat` 每一模型轮清空 accumulation，再 checkpoint 到同一 assistant message；`saveToolRound` 已保留工具轮 content 到 continuationMessages。新快照只补公开 reasoning/content，不能读 Responses encrypted_content 展示。
- `continuationMessages` 以历史请求开头，旧记录恢复展示必须按当前 run 的 providerCallId 归属过滤；不能把全部 assistant 内容当过程。
- `AgentGenerationBatches.BatchSurface` 管理本地草稿、pending 与 SPA blocker。外层折叠不能卸载此组件，否则丢草稿/保护。
- `AgentChatPage` 原 composer status 条件只观察任务/run，模型 completed 后 draft 批次仍未审批。提醒必须按当前 thread 独立观察批次及 jobs。
- `getTaskDisplayState` 的 review 状态需要用户检查成果；原任务 strip 只有弱化文字，应加入明确检查入口。
- `ChatWorkspace` 延迟导入 MessageList；过程 Markdown 不得引入到主路由依赖，否则回退上一轮性能修复。

验证使用隔离 Edge context、临时 IndexedDB 项目和本地 mock 供应商，禁止真实付费请求。
