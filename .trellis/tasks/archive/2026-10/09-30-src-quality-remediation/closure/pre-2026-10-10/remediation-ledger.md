# 逐项整改台账

51/51审查发现映射到32个顺序单元；实现、行为验证、独立复核完成才关闭。风险先核实，不需变更时记录证据。

来源：`remediation-ledger.json`。本表由 `tools/render-ledger.py` 生成。

| 单元 | 内容 | 关联发现 | 状态 | 独立复核 |
|---|---|---|---|---|
| A01 | 诊断脱敏与持久化状态 | PM-01 | 验证完成 | [A01复核](../../../09-30-src-remediation-a/reviews/A01-check.md) |
| A02 | 原子批量撤销与失败重试 | PU-01, SS-05 | 验证完成 | [A02复核](../../../09-30-src-remediation-a/reviews/A02-check.md) |
| A03 | 删除事务返回最新镜头快照 | PD-02 | 验证完成 | [A03复核](../../../09-30-src-remediation-a/reviews/A03-check.md) |
| A04 | 槽位和单字段保存基线 | PU-02, PU-03, SS-02 | 验证完成 | [A04复核](../../../09-30-src-remediation-a/reviews/A04-check.md) |
| B01 | 项目与资产查询身份隔离 | SS-01, PU-05 | 验证完成 | [B01复核](../../../09-30-src-remediation-b/reviews/B01-check.md) |
| B02 | 记忆候选编辑会话 | AU-01 | 验证完成 | [B02复核](../../../09-30-src-remediation-b/reviews/B02-check.md) |
| B03 | 设置局部补丁与角色集合意图 | AU-03, PU-04 | 验证完成 | [B03复核](../../../09-30-src-remediation-b/reviews/B03-check.md) |
| B04 | 模型发现与探测协议 | PM-02 | 验证完成 | [B04复核](../../../09-30-src-remediation-b/reviews/B04-check.md) |
| B05 | 音乐任务ID与取消恢复 | PM-03, PM-04, PM-06 | 验证完成 | [B05复核](../../../09-30-src-remediation-b/reviews/B05-check.md) |
| B06 | 异步连接与文件导入会话 | SS-07, PU-07 | 验证完成 | [B06复核](../../../09-30-src-remediation-b/reviews/B06-check.md) |
| B07 | 主题文本与附件草稿作用域 | AU-10 | 验证完成 | [B07复核](../../../09-30-src-remediation-b/reviews/B07-check.md) |
| C01 | 当前成果与调用账本区分 | AR-01, AR-02 | 验证完成 | [C01复核](../09-30-src-remediation-c/reviews/C01-check.md) |
| C02 | 音乐草稿生成参数一致性 | AR-03 | 验证完成 | [C02复核](../09-30-src-remediation-c/reviews/C02-check.md) |
| C03 | 父项目和现代包外键不变量 | PD-01, SS-04 | 验证完成 | [C03复核](../09-30-src-remediation-c/reviews/C03-check.md) |
| C04 | 音频包成品标识重映射 | SS-03 | 验证完成 | [C04复核](../09-30-src-remediation-c/reviews/C04-check.md) |
| C05 | 收窄宽patch媒体入口 | PD-03 | 验证完成 | [C05复核](../09-30-src-remediation-c/reviews/C05-check.md) |
| C06 | 入站读取资源边界 | PM-05 | 验证完成 | [C06复核](../09-30-src-remediation-c/reviews/C06-check.md) |
| D01 | 解除八文件值依赖环 | AR-04, PD-04 | 验证完成 | [D01复核](../10-08-src-remediation-d/reviews/D01-check.md) |
| D02 | 按业务分解综合repository | PD-05 | 验证完成 | [D02复核](../10-08-src-remediation-d/reviews/D02-check.md) |
| D03 | 页面编排与共享能力职责 | PU-08, SS-08, AU-08 | 验证完成 | [D03复核](../10-08-src-remediation-d/reviews/D03-check.md) |
| D04 | 上下文查询统一快照 | AU-06 | 验证完成 | [D04复核](../10-08-src-remediation-d/reviews/D04-check.md) |
| D05 | 工具schema和参数类型关联 | AR-05 | 验证完成 | [D05复核](../10-08-src-remediation-d/reviews/D05-check.md) |
| D06 | 生成表单共用能力模型 | AU-07 | 验证完成 | [D06复核](../10-08-src-remediation-d/reviews/D06-check.md) |
| D07 | provider共用基础请求边界 | PM-07 | 验证完成 | [D07复核](../10-08-src-remediation-d/reviews/D07-check.md) |
| D08 | 镜头和场次文字草稿协议 | PU-06 | 验证完成 | [D08复核](../10-08-src-remediation-d/reviews/D08-check.md) |
| E01 | 编辑草稿离开保护与写入错误出口 | AU-02, PU-10, SS-06 | 验证完成 | [E01复核](../10-09-src-remediation-e/reviews/E01-check.md) |
| E02 | 键盘动作及移动端布局 | AU-04, AU-05 | 验证完成 | [E02复核](../10-09-src-remediation-e/reviews/E02-check.md) |
| E03 | 清理旧音频CSS | PU-09 | 验证完成 | [E03复核](../10-09-src-remediation-e/reviews/E03-check.md) |
| E04 | 事务范围与批量引用扫描 | PD-06, PD-07, SS-09 | 验证完成 | [E04复核](../10-09-src-remediation-e/reviews/E04-check.md) |
| E05 | 装饰动画按需调度 | SS-11 | 验证完成 | [E05复核](../10-09-src-remediation-e/reviews/E05-check.md) |
| E06 | 富消息和图标加载优化 | AU-09 | 验证完成 | [E06复核](../10-09-src-remediation-e/reviews/E06-check.md) |
| E07 | 收窄未用出口和控件 | PD-08, SS-10 | 验证完成 | [E07复核](../10-09-src-remediation-e/reviews/E07-check.md) |

全部32个单元已验证完成。

## 用户示例与附加整理

这些事项不加入51项已审查发现计数，仍按关联单元执行并保留证据。

- EX-01 / D05：src/lib/memory/retrieval.ts — 提前返回空entries；source保留白名单并用明确穷尽分支。保持信封/字段/顺序/预算兼容，不新增策略类。（验证完成）
- QG-01 / E07：package.json / .github/workflows/ghcr.yml / quality tooling — Pinned portable TypeScript/ESLint-SonarJS/Hook/value-graph/full+productionKnip gates +88 actualCLI selftests; thirteen concrete reviewed error nodes/seven precise unused contracts, CI quality steps preserve publication. Actual localNode22 freshlockedinstall verified; no LinuxCI execution claim.（验证完成）
