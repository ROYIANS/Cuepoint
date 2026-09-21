# Agent 高优先级问题独立复核

复核时间：2026-09-21。复核人：数据审查分工，未参与原 Agent 发现的实现或最初复现。本轮仅复核 AG-01、AG-02，未修改产品代码，没有重审数据责任文件。最终只新增本文档；运行时创建的 `tests/auditIndependent.test.ts` 已删除。

## 结论

| 原问题 | 独立结论 | 优先级建议 | 证据范围 |
| --- | --- | --- | --- |
| AG-01：task_read 重新发送已撤回资料缓存 | 成立，确认产品契约违背 | 保留 P1 | 执行真实 task_read 调度与 Chat request materializer；第二次模拟模型 HTTP 请求包含撤回原文，第一次没有 |
| AG-02：上传过程中断开连接后仍提交生成 | 成立，确认前置校验窗口缺口与单次/批次不一致 | 保留 P1，准确限定影响 | 精确匹配 `/images/generations` POST 为 1；本地还保存了返回的远端任务 ID；没有真实付费请求或真实扣费证据 |

两项均可通过现有产品入口触发。AG-01 是用户资料撤回后的重新发送边界问题；AG-02 是已经批准、尚未发出生成 POST 的操作在连接删除后继续提交。两者不能描述成跨项目任意访问、无批准执行或重复收费。

## AG-01 复核

### 契约判断

`.trellis/spec/frontend/agent-references.md:75` 起明确禁止通过缓存文本或原 mediaId 复活撤回资料；`:80` 起要求历史工具与总结投影只保留来源身份和覆盖范围；`:87` 明确 reference removal 撤回的是新使用。原文同时允许已写出的用户消息、人工笔记和助手解释继续保留。因此需要区分原始工具结果缓存与已经形成的 authored prose。

复现 sentinel 仅出现在 TXT 原文与 `project_reference_read` 返回的 chunks，用户消息是普通“read source / inspect task sources”，助手历史仅为“Reference inspected.”。新的第一次模型请求不含 sentinel，执行 task_read 后的第二次请求才出现。故不能用“历史文字有意保留”排除该问题。

### 可达调用链

1. 现有 `ReferenceLibrary.tsx:47` 调用 `removeProjectReference`。资料状态变 unavailable，chunks 删除，正常 `getReferenceSource` 拒绝读取；复现也先断言正常读取报“已移除”。
2. 开放任务的智能模式含 `task_read`：`taskContext.ts:6` 的工具名单及 `:7` 的工作指令甚至建议 Agent 通过 source 分页读取工具来源全文。这不是需要猜测内部接口的隐藏路径。索引会给出 source call ID，模型可以据此请求详情。
3. `taskTools.ts:49` 将本任务运行中 completed 且非 bookkeeping 的工具纳入 calls，包含 effect=read 的 reference read/search。`:59` 对工具结果直接取 `item.result`；`:61` 切片返回普通 content 字符串。`:67` 列表同样切片原始结果。
4. 正常 runChat 使用 registry、作用域验证、running 认领、executeAtomicTool，随后 `appendToolResults`；这些 owner 检查限制在同一任务，不能检测资料是否已撤回。
5. `agentTools.ts:145` 仅对 REFERENCE_TOOL_NAMES 添加顶层 referenceInput。外层 `task_read` 不在其中；它返回的 content 包着 JSON 字符串里的内层 referenceInput。
6. `referenceWire.ts:9`、`:38` 只对顶层 referenceInput 校验来源；嵌套字符串不会被当作可验证来源，因此原文作为普通 tool content 出现在下次网络请求中。

复现实际执行了第 3–6 步，非只检查字符串 helper。符合契约的 `referenceToolSummary` 已在总结证据中使用，说明可采用已有安全投影而不是发明新授权语义。

### 影响边界与修复验收

确认的是同项目、同任务里旧文本资料缓存的重新发送；未证明跨项目、任意文件、图片像素旁路，也没有把 authored notes 保留误判为泄漏。Chat 协议已动态复现，Responses 根据相同 task_read 字符串和顶层校验逻辑静态判断存在同类路径，但本轮未运行 Responses 复现。

建议保持 P1：撤回后再次发送可能包含不再希望交给模型的原文，已经越过实际 request body 边界。修复须同时覆盖 source 详情和列表；前者最多 6000 字且可继续分页，后者前 400 字也可能已经含正文。回归应覆盖 withdrawn、revision changed、正常有效源，以及 authored history 正常保留。

## AG-02 复核

### 契约判断

`agent-creative-skills.md:25` 冻结 connector identity、target 与 input hashes；`:89` 要求执行在提交前重核 fingerprint。该规范对“连接删除等不等同于取消已批准操作”没有逐字单独定义，但当前代码明确在付费 POST 前做最终校验，且批次 `generationBatchRuntime.ts:75`–`:81` 正是在上传后重读 connector，检查存在、provider、URL、key。单次与批次对同一产品操作的政策已经发生分歧。

本条不得套用“Stop 不保证远端取消/退款”：复现的连接删除发生在上传返回前，生成 POST 尚未发出。本条也不是权限模式变化影响旧 run：删掉的是实际执行所依赖的供应商配置，随后查询逻辑自己也要求它仍存在。

### 可达调用链

1. 正常已批准 `submit_generation` 通过 `generationTools.ts` 进入 `submitAgentGeneration`。runChat 在认领前会检查 requiresConfirmation；这里不存在已证实的绕过批准。
2. runtime 初始 snapshot 读取当前 connector，创建 submitting job，把 config 对象保留在当前 JS 调用栈（`generationRuntime.ts:165`–`:177`）。
3. `nativeRequest` 在 `:140` await `/uploads/images`；另一个标签页可以同时操作连接页面。连接页面的断开调用删除 connector，没有跨线程锁或正在生成时禁止删除的约束。
4. 上传返回后，单次 beforePost（`:177`–`:185`）检查 target revision、signal、run、call、job 和 project scope，但不重读 connector。
5. `submitClaimedGeneration:194`–`:199` 紧接着使用先前 config 发出生成 POST。批次传入不同 beforePost，包含 connector 重读，这正是缺失保护的位置。
6. `:205` 保存远端任务 ID；随后的 `checkAgentGeneration:284` 重读 connector，因配置不存在而无法查询。这是“已提交但恢复依赖已被删除”的实际后果，不是推断重复提交。

### 对原复现的独立增强

原 fixture 对上传外所有 POST 计数；为排除把其他请求误认为付费生成，我在仅本轮临时副本中把计数收窄为 `method === 'POST' && url.endsWith('/images/generations')`，并在最后断言前新增：

```ts
expect((await db.agentGenerationJobs.where('callId').equals(context.callId).first())?.providerTaskId)
  .toBe('paid-after-delete');
```

上述远端 ID 断言通过，最后 `expect(paidPosts).toBe(0)` 实际得到 1。说明失败来自明确的生成 POST，而不是上传、查询或 fixture 的任意异常。异常 catch 只允许恢复查询失败返回到断言，不制造 POST。

fixture 直接构造已认领运行和有效 preview 来定位 runtime 缺口，没有重新走审批表单 UI。因此它证明 runtime 在已批准执行阶段的行为，不能用于宣称批准 UI 有缺陷。mock 在 upload handler 中删除 DB 记录，模拟另一个标签页的真实 connector 删除操作；无需生产 key 或真实供应商响应。

建议保留 P1，因为失效连接继续触发新的可能收费提交，同时阻断正常查询。最终报告宜写“可能产生非预期费用”，不能写“已重复扣费”“已确认真实收费”或“删除本地 key 等于供应商远端撤销 key”。修复前应明确统一单次/批次的配置变更策略，并将共享最终检查置于上传后、POST 前；已持有 providerTaskId 的历史任务仍只能查询，不能重新 POST。

## 本轮执行记录

从 Agent 原复现文件复制到不存在的 `tests/auditIndependent.test.ts`，只对生成测试添加以上 endpoint/identity 增强，然后执行：

```sh
PATH=/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin:$PATH /Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm exec vitest run tests/auditIndependent.test.ts -t 'single generation must stop|task_read must not retransmit'
```

2026-09-21 09:32:36 测试日志摘要：

```text
RUN v5.0.1
Tests 2 failed | 4 skipped (6)
single generation ...: AssertionError expected 1 to be +0
task_read ...: AssertionError expected true to be false
Duration 552ms
exit code 1
```

失败是正向安全断言成功暴露当前缺陷；未修改断言去接受错误行为。临时测试已删除。使用 fake-indexeddb 与模拟 fetch，没有真实 API 花费、没有修改用户数据库。原始可重跑复现仍为 `evidence/repro/auditAgentBoundaries.test.ts`，本轮只新增本文档。

本轮主要读取：Agent 原报告与复现、taskTools、referenceTools、referenceEvidence、referenceWire，以及 agentTools append、runChat 调度、generationRuntime submit/check、generationBatchRuntime dispatch、generationTools registry、taskContext/skills 与三份 Agent 规范。没有将局部阅读包装成其余 Agent 文件全覆盖。
