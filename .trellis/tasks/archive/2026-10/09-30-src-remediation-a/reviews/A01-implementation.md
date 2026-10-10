# A01 / PM-01 实施记录

日期：2026-09-30。范围：只实现 Responses 诊断状态边界；尚待主会话独立 check。

## 变更文件

- `src/lib/ai/responsesStream.ts`：错误结果的 `finishReason` 仅接受 `completed`、`failed`、`incomplete`、`in_progress`、`queued`、`cancelled`。未知字符串及非字符串均不进入该字段。
- `tests/responsesStream.test.ts`：新增 12 个参数化回归用例，增强现有成功 `stop` 断言。
- `.trellis/tasks/09-30-src-remediation-a/reviews/A01-implementation.md`：本记录。

没有修改 db/runChat、其他源文件、任务台账、规范或原审查报告；没有新增 agentRuns 测试文件。共享工作区原有任务文件修改保持原状。未推进 A02，未提交或推送。

## 设计选择

原实现将任意 JSON `response.status` 复制到 `finishReason`，尽管 `error.message` 已脱敏，结果经 `finishAgentRun` 仍可保存密钥。现在在 transport 边界限定状态；未知状态不保留、不截取成伪状态，也不输出原始字符串。短未知状态和超过 10,000 字符的未知状态遵循相同规则，因此无需为未知状态另设保留长度上限。

已知状态的失败行为保持兼容，包括 `completed` 携带 error 时仍失败并保留 `completed` 诊断。成功响应继续返回 `tool_calls` 或 `stop`。错误 message 仍使用原有完整脱敏后截取至 300 字符的逻辑，真实 usage 保留。SSE 终止事件一致性检查没有改动；未知 status 继续被拒绝。请求仍为一次 POST，不增加重试或 fallback。

## 回归证据

新 JSON 回归使用假配置密钥 `sk-audit-fixture` 和另一假 Bearer 凭证 `sk-other-fixture`，同时放入 status/error.message。分别比较短未知状态与 10,000 字符前缀的超长未知状态。测试实际调用 `beginAgentRun` 与 `finishAgentRun`，从共享 fake-indexeddb/Dexie 读取 agentRuns/chatMessages；断言结果整体、执行记录和消息均无两种凭证，未知 finishReason 未保存，错误 message 已脱敏，未派发工具，fetch 仅调用一次。测试传入 finishAgentRun 的参数与 runChat.ts:286 失败路径一致，未 mock 持久化函数。

其他覆盖：六个已知 JSON status 的 error 脱敏与保留；短/超长未知 SSE status 的一致性拒绝及结果整体无密钥；合法 failed/incomplete SSE error.message 脱敏；JSON/SSE 成功 stop 和既有 tool_calls 行为。

先只增加测试，保留原源代码运行指定命令：退出状态 1，`Test Files 1 failed (1); Tests 2 failed | 23 passed (25)`。失败恰为两个未知 JSON 状态用例，结果 finishReason 中包含假密钥；测试在检查前已完成实际 finishAgentRun 保存及行状态断言。这证明新增回归能捕获原缺陷。

修改源代码后运行：

```sh
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm exec vitest run tests/responsesStream.test.ts
```

退出状态 0；`Test Files 1 passed (1); Tests 25 passed (25)`，开始时间 11:07:30，耗时 847ms。

```sh
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm lint
```

退出状态 0；执行 `tsc -b --pretty false`，无类型错误。

`git diff --check` 退出状态 0。所有 pnpm 命令均使用用户指定本机绝对路径，没有 install 或 Codex Runtime pnpm。

## 限度

新增供应商自定义状态会被视作未知并丢弃 finishReason，仍返回失败、脱敏 message 和 usage；若未来需要支持新合法状态，应明确更新限定集合及回归。该修复保护此 Responses 结果路径，不新增数据库全局诊断清洗，也不清理已存历史记录。测试使用构造响应与真实本地 repository，未请求真实供应商。本单元未运行全量 test/build，未派发 implement/check 或其他代理，A02–A04 与独立 check 留给主会话。
