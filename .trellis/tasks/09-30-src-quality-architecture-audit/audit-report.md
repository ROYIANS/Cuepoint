# src 全量代码质量与架构审查

审查日期：2026-09-30；基准提交：`2fc0e9523e62a5258a488cc3d0274d24c8967c6f`。

## 结论与范围

主要结构问题是业务职责横跨技术目录、执行编排与持久化相互调用、部分UI自行持有数据修改/逆操作协议。修复应先恢复业务边界和数据一致性，再迁移目录；单纯改名、减少文件行数或加策略层不足以解决。

范围内 392 个 src 跟踪文件均有覆盖记录：389个普通文件阅读、3个生成文件验证。389 个 TS/TSX/CSS 代码文件（含1个生成路由），2份生成模型JSON，1份生成链README。vendor不纳入人工审查；tests仅作为行为证据和回归基线。非生成代码完整阅读，生成JSON用结构与精确再生成验证，不宣称人工逐行阅读。

共登记 51 项模块级发现：24项确认缺陷、18项结构债务、9项待验证风险；P1 7项、P2 35项、P3 9项。P1中6项是确认缺陷、1项是待验证风险（PU-05）。不同模块发现可能共享根因，不把这些数量当作互不相关的缺陷数。ARCH-01是AR-04与PD-04的跨模块汇总，指向同一个8文件依赖环，不增加独立问题计数。原始工具告警不计入已确认发现。

## 优先处理的已确认路径

1. **批量撤销和编辑覆盖**：PU-01/02/03/04。逆操作携带before/after基线，在同一事务内先验证全部目标；槽、单字段和集合编辑使用各自真实意图，保留冲突草稿。
2. **诊断字段与远端协议**：PM-01/02/03/04/06。所有会持久化的错误字段都需脱敏/限定；拒绝成功HTTP中的坏协议；音乐任务ID在提交、查询和保存边界保持一致，不以重发付费POST修复恢复失败。
3. **8文件值循环与职责交叉**：ARCH-01。先拆工具策略纯逻辑、目标读取和任务证据，再分解综合repo和页面。
4. **删除、项目身份与设定**：PD-02、SS-01/02。删除快照必须对应实际删除时刻；query结果与当前project/episode身份匹配；项目文字编辑传递字段baseline。其余按下表触发条件落实，风险项保留验证限度。

## 覆盖与模块报告

| 模块 | 文件数 | 状态 | 详细报告 |
|---|---:|---|---|
| Agent 执行与工具机制 | 66 | 阅读 66 / 生成验证 0 | [agent-runtime](research/agent-runtime.md) |
| 数据与领域规则 | 50 | 阅读 50 / 生成验证 0 | [persistence-domain](research/persistence-domain.md) |
| Agent 与记忆 UI | 61 | 阅读 61 / 生成验证 0 | [agent-ui](research/agent-ui.md) |
| 创作 UI | 36 | 阅读 36 / 生成验证 0 | [production-ui](research/production-ui.md) |
| 模型、媒体、音频与参考接入 | 48 | 阅读 46 / 生成验证 2 | [providers-media](research/providers-media.md) |
| 路由、壳与共享能力 | 131 | 阅读 130 / 生成验证 1 | [shell-shared](research/shell-shared.md) |

[完整逐文件清单](research/coverage.md) · [机器可读覆盖](research/coverage.json) · [问题索引](research/findings.json)

## 所有模块级发现索引

每项详细报告包含位置、触发机制、影响、建议及验证方式。confirmed-bug基于源码/隔离输入的证明，不表示全部异常已在真实用户环境或付费供应商上发生；risk保留未验证限度。

| ID | 优先级 | 分类 | 结论 | 证据报告 |
|---|---|---|---|---|
| AR-01 | P2 | risk | 图片/视频总结缺少当前媒体有效性检查 | [agent-runtime](research/agent-runtime.md) |
| AR-02 | P2 | confirmed-bug | 拒绝/失败调用被已有生成输出升级为成果来源 | [agent-runtime](research/agent-runtime.md) |
| AR-03 | P2 | confirmed-bug | 音乐时长规则在保存和生成间漂移 | [agent-runtime](research/agent-runtime.md) |
| AR-04 | P2 | structural-debt | 执行、加载、证据和仓库互相引用成值循环 | [agent-runtime](research/agent-runtime.md) |
| AR-05 | P3 | structural-debt | 工具边界的类型关系与 schema 同步依赖手工约定 | [agent-runtime](research/agent-runtime.md) |
| PD-01 | P2 | confirmed-bug | 项目已删除后仍能创建资产和媒体 | [persistence-domain](research/persistence-domain.md) |
| PD-02 | P1 | confirmed-bug | 镜头删除/撤销快照可落后于真实删除时刻 | [persistence-domain](research/persistence-domain.md) |
| PD-03 | P2 | risk | 宽 patch 与严格槽位 API 的契约不同，存在绕过风险 | [persistence-domain](research/persistence-domain.md) |
| PD-04 | P2 | structural-debt | db/lib 值循环与混合职责 | [persistence-domain](research/persistence-domain.md) |
| PD-05 | P2 | structural-debt | repository 职责实际耦合，不能只按表拆文件 | [persistence-domain](research/persistence-domain.md) |
| PD-06 | P2 | structural-debt | 全表写事务扩大耦合与锁竞争 | [persistence-domain](research/persistence-domain.md) |
| PD-07 | P2 | structural-debt | 媒体逐条回收重复全库扫描 | [persistence-domain](research/persistence-domain.md) |
| PD-08 | P3 | structural-debt | 无调用的导出收窄（可选） | [persistence-domain](research/persistence-domain.md) |
| AU-01 | P2 | confirmed-bug | 记忆候选请求并发导致正文与来源错配 | [agent-ui](research/agent-ui.md) |
| AU-02 | P2 | confirmed-bug | 工作记录/总结草稿的离开保护不完整 | [agent-ui](research/agent-ui.md) |
| AU-03 | P2 | confirmed-bug | 参数局部 patch 以旧完整快照写回 | [agent-ui](research/agent-ui.md) |
| AU-04 | P2 | confirmed-bug | 主题行截获子动作的键盘事件 | [agent-ui](research/agent-ui.md) |
| AU-05 | P3 | confirmed-bug | 窄屏 CSS 被后置基础规则覆盖 | [agent-ui](research/agent-ui.md) |
| AU-06 | P2 | structural-debt | 上下文入口与明细重复订阅和组装 | [agent-ui](research/agent-ui.md) |
| AU-07 | P2 | structural-debt | 生成表单再次编码能力矩阵 | [agent-ui](research/agent-ui.md) |
| AU-08 | P3 | structural-debt | 页面承担重复执行收尾与选择镜像 | [agent-ui](research/agent-ui.md) |
| AU-09 | P2 | risk | lazy边界仍承载大目录和富消息依赖 | [agent-ui](research/agent-ui.md) |
| AU-10 | P2 | risk | 文本草稿与附件作用域不一致 | [agent-ui](research/agent-ui.md) |
| PU-01 | P1 | confirmed-bug | 批量撤销无冲突保护，也不是一个原子操作 | [production-ui](research/production-ui.md) |
| PU-02 | P1 | confirmed-bug | 媒体槽编辑的上传所有权正确，但整槽快照缺少 CAS | [production-ui](research/production-ui.md) |
| PU-03 | P2 | confirmed-bug | 时长草稿接入了序列化保存，但没有使用冲突基线 | [production-ui](research/production-ui.md) |
| PU-04 | P2 | confirmed-bug | 多选的整数组补丁丢掉前一项尚未回读的选择 | [production-ui](research/production-ui.md) |
| PU-05 | P1 | risk | 参数变化时旧查询和槽草稿的 target 未完整隔离 | [production-ui](research/production-ui.md) |
| PU-06 | P2 | structural-debt | 镜头/场次文本编辑的错误和草稿恢复协议分裂 | [production-ui](research/production-ui.md) |
| PU-07 | P2 | risk | 异步剧本文件读取没有新旧请求和本地编辑保护 | [production-ui](research/production-ui.md) |
| PU-08 | P2 | structural-debt | 页面的交互和持久化编排缺少可独立验证的边界 | [production-ui](research/production-ui.md) |
| PU-09 | P3 | structural-debt | CSS 保留已退出当前渲染树的旧工作台规则 | [production-ui](research/production-ui.md) |
| PU-10 | P3 | risk | 音色未保存配置缺少 dirty 退出语义 | [production-ui](research/production-ui.md) |
| PM-01 | P1 | confirmed-bug | Responses 的状态字段绕过诊断脱敏 | [providers-media](research/providers-media.md) |
| PM-02 | P2 | confirmed-bug | 错误响应被转换为空模型成功或探测成功 | [providers-media](research/providers-media.md) |
| PM-03 | P2 | confirmed-bug | 音乐任务 ID 集合未保持唯一，恢复路径确定失败 | [providers-media](research/providers-media.md) |
| PM-04 | P2 | confirmed-bug | 音乐任务 ID 的点段绕过固定路径约束 | [providers-media](research/providers-media.md) |
| PM-05 | P2 | risk | 入站音频与 Chat 流无大小上限，资源检查太晚 | [providers-media](research/providers-media.md) |
| PM-06 | P3 | confirmed-bug | 音乐 body 取消被当作协议格式错误 | [providers-media](research/providers-media.md) |
| PM-07 | P2 | structural-debt | 请求基础边界被复制并发生策略漂移 | [providers-media](research/providers-media.md) |
| SS-01 | P1 | confirmed-bug | 项目 route 复用期间消费上一所有者的数据 | [shell-shared](research/shell-shared.md) |
| SS-02 | P1 | confirmed-bug | 项目设定自动保存没有并发保护 | [shell-shared](research/shell-shared.md) |
| SS-03 | P2 | confirmed-bug | 音频成品状态在 ZIP 导入后产生假“后续编辑” | [shell-shared](research/shell-shared.md) |
| SS-04 | P2 | confirmed-bug | 现代视频包的错误分集引用被静默修复成另一集 | [shell-shared](research/shell-shared.md) |
| SS-05 | P2 | confirmed-bug | 恢复失败丢弃 undo，无法重试 | [shell-shared](research/shell-shared.md) |
| SS-06 | P2 | confirmed-bug | 部分业务写入没有错误出口 | [shell-shared](research/shell-shared.md) |
| SS-07 | P2 | risk | 连接请求跨编辑会话的回写风险 | [shell-shared](research/shell-shared.md) |
| SS-08 | P2 | structural-debt | 领域编排与旧契约的职责边界需要显式化 | [shell-shared](research/shell-shared.md) |
| SS-09 | P2 | structural-debt | library 订阅及派生范围可收窄 | [shell-shared](research/shell-shared.md) |
| SS-10 | P3 | structural-debt | 低影响清理项与误报 | [shell-shared](research/shell-shared.md) |
| SS-11 | P3 | structural-debt | 装饰 canvas 可按需调度 | [shell-shared](research/shell-shared.md) |

## 目录与依赖整改

[根因整改计划](research/remediation-plan.md)将51项发现归组并安排A–E批次；[架构报告](research/architecture.md)包含现状职责、8文件依赖环、目标结构和迁移顺序。重点归属为Agent核心及业务工具适配器、项目/故事分镜/资产/素材、音频/音乐、记忆/参考、项目传输、共享UI和基础设施。保留TanStack文件路由与集中Dexie schema；不要把全部UI读repository判为违规，也不要为一次调用添加工厂/注册系统。

建议顺序：确认行为缺陷与回归 → 拆值循环中的规则/读取边界 → 按业务分解repo → 拆页面控制/视图/业务操作 → 按职责迁移目录和移除已确认遗留出口。冻结快照、所有权、审批账本、CAS、短事务和跨域原子删除/导入必须逐步验证。

## 工具与现有质量基线

[工具分析](research/tool-analysis.md)记录版本、配置、原始结果、误报及重跑修正。实际使用TypeScript AST、类型感知ESLint、React Hooks规则、SonarJS、dependency-cruiser、Knip及jscpd。ESLint在368个非生成TS文件给出248 error/544 warning，0解析失败；这是本次规则集的诊断等级，不是业务缺陷数量。

类型检查、125文件/1559测试及生产构建通过。构建有大chunk告警，未测实际设备/网络加载时延。Docker服务未运行，因此**没有SonarQube服务端扫描**；本地SonarJS不能冒充完整Sonar质量门。分析依赖只安装在独立临时目录，产品依赖未通过安装命令变更。

现有lint只执行tsc；ESLint、Knip、依赖规则本轮只用于审查，**尚未接入CI**。建议先建立已核验债务基线，禁止新增同类问题，随后逐步清除基线，不一次把全部原始警告设为阻断。

## 用户示例与误报处理

记忆信封的source白名单是必要的数据边界，不建议直接删除。嵌套条件可用提前返回及穷尽分支表达；外层展开的将来字段增长属于契约风险，不宣称当前已经泄露数据。

ambient mammoth声明、CSS依赖、普通业务useX命名、不同业务的相同CRUD形状和生成数据大文件均已核实，未仅凭工具名字判错。工具发现仅被测试使用的实现，需要判断删除还是接入，不把测试专用导出全删。

## 验证及交付状态

见 [覆盖/内容/位置校验](research/audit-verification.json) 与[独立复核](research/check-final.md)。指定高优先级机制复核通过；PM-01已明确JSON泄漏与SSE拒绝未知状态的不同路径，SS-01未宣称实际跨项目点击写入已做浏览器复现。检查所有文件只出现一次、没有blocked、源码哈希与基准一致、具体报告位置有效。Vite构建重新生成routeTree的格式变化经3995个非trivia token一致校验后恢复基准，见research/tools/route-regeneration.json。

本轮修改仅限审查任务产物和质量规范中的审查证据合同；未实施产品修复、未改动src最终内容、未提交或推送。所有建议属于后续整改，不代表现有缺陷已消除。浏览器时序、麦克风/WebAudio/PDF和真实付费API的验证限度分别保留在模块报告中。

