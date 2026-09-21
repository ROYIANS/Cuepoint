# 最终独立审查

审查日期：2026-09-21。范围：本任务 PRD/design/implement、check.jsonl 所列规范，以及按需工具加载、IP/素材适配器、资料发送链路、上下文统计、设置迁移的实际代码与回归测试。

## Findings (fixed)

- File: `src/lib/agent/materialTools.ts`
  - Issue: `material_release` 原本复用读取当前素材的 `useState`。项目曾采用 IP 素材、随后解除或改绑 IP 时，本项目闲置副本也因无权访问原 IP 被拒绝清理。项目副本的管理权与源素材读取权混在一起。
  - Fix: 提取 `projectUseState`，按持久 `MaterialUse.projectId`、当前执行项目和本地目标归属验证；释放只使用本地副本名称与已有来源 ID/revision，不读取失效源档案。新版副本更新仍保留源素材权限验证。预览 CAS、草稿刷新、事务与引用保护继续复用原路径。
- File: `tests/agentMaterialTools.test.ts`
  - Issue: 缺少解除 IP 关联后清理本项目副本的回归，以及所属 IP/项目归档后读取创作设定的明确断言。
  - Fix: 增加解除关联后成功释放、跨项目释放拒绝、禁止重新读取来源和更新版本、预览不泄露源素材新名称的回归；增加 IP/项目归档后只保留素材元信息、不返回设定正文的两种回归。归档正文隐藏代码原本已正确，无需再次修改。

并行素材审查发现的图片队列问题由素材 agent 修复，本轮复查已覆盖其最终实现：不支持视觉、已满 10 张及坏图片均在生成成功工具结果前拒绝；共用参考资料解析器验证签名与内容。

## Findings (not fixed)

没有剩余已确认的代码缺陷需要阻止本任务交付。

规范同步交由主会话持有：旧 `agent-creative-skills.md` 的“六组/version1”默认配置描述和 `agent-tools.md` 固定工具数量需要与新 `agent-library-tools.md` 的 version2 / 按需加载描述一致。已向主会话说明具体位置，审查 agent 未并发编辑主会话拥有的规范文件。

## 核对结论

- 新 run 的授权上限、实际请求工具集合和每步工具账本分离；同轮先发现再调用未提供工具被拒绝，旧 run 和纯对话路径兼容。
- 工具分组及说明在下一模型请求刷新，审批/续跑保留原始调用信封，既有工具结果不重复执行。
- IP 共享修改保留确认与版本/影响范围校验；项目上下文有界且关联、归档变化在安全请求边界刷新。
- 素材图像/文档真实内容具有同 run 的已完成读取记录、明确版本及摘要证明；发送前后检查归属、归档和字节摘要。图像实际像素仅在 HTTP 信封展开。
- 设置一次性追加新组且保留旧组关闭状态与全关闭设置；UI 将技能目录、工具定义、结果估算与供应商实际 usage/cache 区分。
- 音视频仍限于元信息；没有接入真实付费服务测试。费用收益以本地估算和模拟协议为依据，不能视为真实账单保证。

## Verification

- Lint: **pass** — 本机 pnpm `lint`。
- TypeCheck: **pass** — 项目 lint 即 `tsc -b --pretty false`。
- Tests: **pass** — 定向 8 个文件、51 条测试：`agentMaterialTools`、`toolLoading`、`agentIpTools`、`materialReferenceWire`、`materialImageQueue`、`agentSettings`、`contextUsage`、`providerCacheUsage`。
- `git diff --check`: **pass**。
- 最终全量测试与生产构建由主会话在所有修改完成后执行，最终结果以任务报告为准。本轮较早检查曾碰到并行编辑中间态的未使用变量与队列测试失败；最终定向检查及类型检查已全部通过。
