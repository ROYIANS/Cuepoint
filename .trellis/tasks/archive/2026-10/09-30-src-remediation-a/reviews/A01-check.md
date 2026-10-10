# A01 / PM-01 独立检查

日期：2026-09-30。角色：trellis-check。结论：**通过，补齐必要回归后无阻断问题**。

## 范围与检查依据

读取 `check.jsonl` 的规范/研究上下文，随后核对 `prd.md`、`design.md`、`implement.md` 与 `reviews/A01-implementation.md`。本次只检查 A01 / PM-01，独立阅读当前 diff、Responses transport、`safeError.ts`、`runChat` 失败分支、`beginAgentRun` / `finishAgentRun`、共享 fake-indexeddb setup 和 Vitest 配置。

检查期间只修改 `tests/responsesStream.test.ts` 并新增本报告；`src/lib/ai/responsesStream.ts` 的实现保持原样。未派其他代理，未修改 A02、任务台账、spec 或原审查报告，未回退共享工作区原有改动，未提交或推送。

## 实现与调用链结论

- `responsesStream.ts:166` 的失败分支仅保留代码明确认识的六个状态：`completed`、`failed`、`incomplete`、`in_progress`、`queued`、`cancelled`。未知字符串不截取、不作为伪状态保存；非字符串也被类型判断排除。未知 JSON 状态仍返回失败，真实 usage 保留，输出工具不派发。
- `completed` 带 error 仍返回失败且保留 `completed` 诊断；其他已知状态的错误结果保持兼容。成功 JSON/SSE 继续返回 `stop` 或 `tool_calls`。
- `responsesStream.ts:142` 先调用 `redactCredentials`，再截取 300 字符。配置假密钥与另一 Bearer 假凭证都可被清洗；`finish` 不会复制原始 error 对象或失败 output 到结果。
- `runChat.ts:286` 在失败路径将 `result.message`、`result.finishReason` 传给 `finishAgentRun` 后立即返回。`agentRuns.ts:217` 在真实 Dexie 写事务中更新消息 error 和 run 的 error/finishReason。新增及原有错误回归均未 mock 这些 repository 函数，实际读取保存后的 agentRuns/chatMessages；不能以 UI 隐藏代替此边界修复。
- SSE 终止事件仍只接受 `response.completed` / `response.failed` / `response.incomplete`，并先检查事件类型与 response.status 一致。未知 status 被拒绝为固定诊断，不生成 finishReason；合法 failed/incomplete 仍保留状态并脱敏 message。该一致性逻辑未改动。
- transport 仍只有一次固定 `/responses` POST；所有新增错误用例断言 fetch 一次。结合 `runChat` 失败即 return，未出现自动 retry 或 fallback。

## 必要修正

原有新增回归覆盖短/长 **status**，但 error.message 始终很短，尚不能证明截断边界不会留下凭证片段。因此仅在 `tests/responsesStream.test.ts:101` 增加两个长 message 用例：配置密钥与另一 Bearer 凭证分别超过 300 字符，从 285 字符前缀后开始，横跨诊断截断边界。验证完整脱敏后截断的精确结果，实际保存后仍无凭证前缀，合法 `failed` finishReason 也实际保存。

同时增强 `tests/responsesStream.test.ts:177` 的 SSE 成功工具结果断言，显式检查 `finishReason: "tool_calls"`。无需修改实现源码。

## 测试证据

使用用户指定的本机绝对 pnpm 路径；本次该可执行文件报告版本 **10.15.0**，Vitest 为 **5.0.1**。未运行 install 或使用 Codex Runtime pnpm。

正常实现的独立针对性运行：

```sh
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm exec vitest run tests/responsesStream.test.ts
```

退出状态 **0**；开始时间 **11:13:37**（Asia/Shanghai），耗时 **832ms**：

```text
Test Files  1 passed (1)
     Tests  27 passed (27)
```

覆盖短/10,000 字符前缀的未知 JSON status、短/长 message 和假凭证、真实 finishAgentRun 保存、六个已知 JSON 结束状态、未知 SSE status 拒绝、合法 SSE failed/incomplete、成功 JSON/SSE stop/tool_calls、请求次数和既有 durable 工具循环。

### 原先两个红测试的独立核验

通过系统临时 Vite config 的 `enforce: "pre"` transform，仅在内存中将 finishReason 表达式换回 `git diff` 对照的旧逻辑：

```ts
typeof response.status === "string" ? response.status : undefined
```

共享源码没有被写回或回退。临时 config 包含原有 Vitest alias/setup 配置；测试和真实 repository 保持不变。

实际命令：

```sh
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm exec vitest run tests/responsesStream.test.ts --config /var/folders/m6/x3vx_lld0kg8rcgth931pll40000gn/T/a01-check-7j2ym2pf/original-status.mjs
```

退出状态 **1**；开始 **11:14:58**，耗时 **789ms**：

```text
A01 in-memory mutation applied: original-status
Test Files  1 failed (1)
     Tests  2 failed | 25 passed (27)
FAIL ... does not expose or persist a short unknown JSON status containing credentials
FAIL ... does not expose or persist a long unknown JSON status containing credentials
AssertionError: ... not to contain 'sk-audit-fixture'
tests/responsesStream.test.ts:94:30
```

这两个失败首先发生在完整结果的凭证负断言；在此之前，真实 `finishAgentRun` 已完成，run/message 已被读取，保存状态与 error 断言均通过。正常实现下，后续保存记录整体无凭证和未知 finishReason 的断言也均通过。用例不导入、不读取、不 mock `RESPONSE_STATUSES`，输入包含两种假凭证、真实 transport 与持久化调用，证明原漏洞可被捕获，**并非只镜像 Set**。

### 补充回归的敏感性核验

另外仅在内存中将正确的 `redactCredentials(value, apiKey).slice(0, 300)` 替换为错误的 `redactCredentials(value.slice(0, 300), apiKey)`，只运行两个长 message 用例：

```sh
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm exec vitest run tests/responsesStream.test.ts --config /var/folders/m6/x3vx_lld0kg8rcgth931pll40000gn/T/a01-check-7j2ym2pf/truncate-before-redact.mjs -t 'redacts a long JSON message before truncation and persistence'
```

退出状态 **1**；开始 **11:14:59**，耗时 **548ms**；`2 failed | 25 skipped (27)`，两个失败均在 message 精确断言（`tests/responsesStream.test.ts:109`）。这证明新增回归可识别截断造成的配置密钥片段泄漏和 Bearer 清洗次序错误。

两个变异均为预期失败，临时配置在运行后删除。运行前后 source/test 的 SHA-256 完全一致：

```text
src/lib/ai/responsesStream.ts
3c6af3e7aa342ade6f314ffd3ea28411a89850399dab8002b96ef89dcce4af72
tests/responsesStream.test.ts
09ee75486ced0782694f61b9b1566fcb3ffc795cc80f831c5823df6a3e2956e6
```

`git diff --check` 退出 **0**。本次未重复 lint/fullsuite/build：实现源码没有新增修改；实施记录中 lint 已通过，`tsconfig.app.json` 的 include 为 src，本次只补测试。全量集成验证仍由 A 批主会话负责，不将本次针对性通过表述为全量通过。

## 剩余限度

- 测试使用构造的 JSON/SSE 响应与真实本地 repository/fake-indexeddb，没有调用真实供应商或运行浏览器端到端。错误回归直接组合 transport 与 repository；`runChat` 对应失败分支经过独立代码检查。
- 修复保护本次 Responses 诊断路径；不清理已经保存的历史记录，也未增加数据库所有写入口的统一诊断清洗。
- 未来供应商新增状态仍被当作未知且不保存 finishReason；需要明确扩展认识的状态及回归。非字符串 status 的丢弃由类型 guard 代码检查确认，本次未新增单独参数化用例。
- 不把 PM-05 的入站体资源上限、A02–A04 或其他 provider 诊断契约视为本单元已经解决。
