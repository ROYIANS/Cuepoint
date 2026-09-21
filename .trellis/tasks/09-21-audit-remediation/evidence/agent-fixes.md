# Agent 边界修复证据

## 已修复

- F02/AG-01：任务来源索引、详情、历史查询和 Chat/Responses 工具结果传输统一投影参考资料来源身份、版本及覆盖范围；旧版 task_read/project_history_read ledger 在 wire 组装时按工具名降级为不可重放摘要。用户/助手 authored 文本不改写。
- F03/AG-02：单次生成上传/编码结束后和统一提交函数内重读连接、输入摘要、目标/运行归属；批次改用 connector resolver。删除、换地址、供应商、清空/轮换 key、输入/目标变化均在 paid POST 前失败。
- F07/AG-03：update_run_plan 注册 atomic；旧账本仅对严格匹配的 bookkeeping 计划调用升级，未知网络/写入效果仍 unknown；原子业务与账本异常统一回滚。
- F08/AG-04：safeError 在截断前隐藏 API key、Bearer 和网络错误中的密钥；通用连接探测、Chat、Responses、APIMart、AIHubMix 使用各自协议下的共享脱敏 primitive。
- F09/AG-05：project generationDefaults.image 投影加入 quality/version，business detail/read_text/context/incremental facts 共用白名单。
- F13/AG-06：连接目录文案改为 Agent 可确认并提交生成任务。
- D02：移除 chatStream 仅测试调用的旧 SSE helper，真实 stream transport 覆盖分片 reasoning/content。

## 验证

```text
pnpm lint                                  # tsc -b 通过
pnpm exec vitest run tests/agentAuditRemediation.test.ts # 40 passed
pnpm exec vitest run tests/agentAuditRemediation.test.ts tests/agentReferences.test.ts tests/responsesStream.test.ts tests/chatStream.test.ts tests/agentToolsReview.test.ts # 134 passed
```

全部 fixture 使用 fake-indexeddb 和模拟供应商，未发送真实付费请求。
