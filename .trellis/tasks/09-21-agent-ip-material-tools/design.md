# Design

## Boundary
行为缺口在Agent注册、run组装、请求分发和已有IP/素材repositories之间，不在单独页面。只增加可审计工具适配与按需schema/skill呈现，复用已有数据库写入、冲突校验、项目范围和共享确认UI。

## Data flow
1. 新run冻结用户允许的工具/技能全集（权限上限），另存展示/加载状态。常驻工作区概览、发现入口、适用的任务记账；纯对话仍零工具。
2. 给模型短的能力目录，模型调用应用级发现工具选择组/查询；确定性匹配已授权catalog，只返回简短名称/用途，应用下一请求发送选中的完整定义及对应必要指导，避免结果再复制schema。
3. 每轮记录实际提供的工具集，执行只接受已授权且该轮已提供工具。加载记录原子提交并可恢复；重载、压缩、审批执行和Inspector使用同一组装器。
4. 已加载组稳定排序、有界保留，跨领域切换不能移除待审批/待执行调用依赖。旧run无加载状态继续沿用原快照，避免改变已有授权。
5. 新IP/material工具分读/写与明确操作，不合成接受任意JSON的万能执行工具。调用现有repositories，写入与tool success在executeAtomicTool内提交；prepare冻结预览及来源/目标revision，执行时复核。
6. IP查询以显式ID/名称或当前绑定项目为入口；写作用域包含受影响IP/项目。素材读取返回版本证据；像素/文字走受限资料上下文管线，不能把二进制拼成普通JSON。

## Files likely affected
- domain/agent.ts、db/agentRuns.ts、db/agentTools.ts：run加载状态和恢复/账本约束。
- lib/agent/{tools,skills,runChat,contextCompaction,contextUsage,contextPlanner}.ts：发现/呈现、预算和请求一致性；新 discovery/IP/material工具模块隔离业务定义。
- lib/agent/{projectContext,referenceContext,imageDiscovery}.ts 及受限资料入口：IP摘要与库版本真实内容。
- db/ipProfiles.ts、db/materials.ts：仅在必要处补可复用验证，禁止UI另写一套行为。
- 现有Agent确认/上下文显示组件：对象链接、IP字段摘要、工具数量估算；复用现有UI组件。
- tests/、frontend specs：授权/恢复/跨协议/负载及业务回归。

## Compatibility and cost
应用层普通function发现兼容现有两协议。OpenAI原生tool_search/defer_loading可日后单独适配，当前不自动发送专用字段给兼容网关。减少schema上下文与prompt caching不是同一件事；普通function动态列表可能影响缓存，记录实际usage和额外发现回合，不预言账单收益。优先稳定常驻前缀、确定性排序、有界加载，避免每轮随机改写定义。

## Non-goals and risks
首轮减少并不保证复杂长任务总token等比例下降。工具发现必须有明确领域目录/精确组加载兜底，不能只靠中文关键词猜测。所有权限仍由代码和run快照掌控。IP/资料内文本不充当授权。占位功能不可通过工具伪造成功。
