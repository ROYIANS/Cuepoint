# 审查问题台账

截至 2026-09-21，全部问题状态为 **已确认、待修复**。本次没有修复产品代码。完整触发条件、精确位置、建议与限制见 [中文总报告](./report.md)，原始复现见 [证据目录](./evidence)。

| 编号 | 优先级 | 问题 | 专项/证据 |
| --- | --- | --- | --- |
| F01 | P1 | 跨标签页草稿覆盖已保存剧本 | UI-01 / browser-audit.json |
| F02 | P1 | task_read 重放已撤回参考原文 | AG-01 / independent-review.md |
| F03 | P1 | 上传期间连接删除后仍首次提交生成 | AG-02 / independent-review.md |
| F04 | P2 | JFIF 备份还原丢 MIME 与普通媒体原名 | DATA-01 / data-repro.log |
| F05 | P2 | 并发首次配置产生重复连接 | DATA-02 / data-repro.log |
| F06 | P2 | 撤销场次覆盖后来的镜头归属 | DATA-03 / data-repro.log |
| F07 | P2 | 原子计划工具元数据缺失，恢复为 unknown | AG-03 / agent-reproducer-failures.log |
| F08 | P2 | 通用连接错误显示回显密钥 | AG-04 / agent-reproducer-failures.log |
| F09 | P2 | Agent 项目投影漏 quality/version | AG-05 / agent-reproducer-failures.log |
| F10 | P2 | 小数 1.5 输入成 15 | UI-02 / browser-audit.json |
| F11 | P2 | 全局 Space 抢占按钮 | UI-03 / browser-audit.json |
| F12 | P2 | 批次内部链接丢本地草稿 | UI-04 / batch-browser.json |
| F13 | P3 | 生成能力文案过期 | AG-06 / catalog.ts |
| PERF-01 | P2 改进 | 1000 镜头全部挂载导致秒级编辑延迟 | production-browser.json |
| PERF-02 | P2 改进 | 默认 Agent 路由体积与冷启动负担 | build.log / production-browser.json |
| Q01 | P2 改进 | 可见发布链缺 typecheck/test gate | GHCR workflow + Dockerfile |

D01–D04 是维护性债务，单列于报告第 6 节，不混入 13 项功能问题。未确认候选与无法执行的验证见报告第 10 节。问题优先级与证据置信度分开记录；F03 不代表真实扣费，F08 不代表已有用户泄露事件。
