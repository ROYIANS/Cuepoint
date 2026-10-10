# R1 最终验收 — 2026-10-10

状态：R1 当前约定范围已实现、独立检查并完成本任务范围内的验收。主会话仍负责统一 task 状态、提交和归档；本记录不会执行这些动作。旧 `validation.md` / implement 的历史阶段保留原文，以本记录和 [独立检查](2026-10-10-independent-check.md) 为当前范围证据。

## 本轮交付与授权

用户授权逐项完成存量开发和验收，并批准智能模式最多一次执行收尾检查与最多一次独立只读成果声明检查，接受调用成本/延迟。R1 交付与已启用工具匹配的就绪检查、当前执行账本对应的停止/进展显示、无绑定项目时的创建续作、持久化上下文归属、带副作用确定性的失败恢复，以及无计划时最多一次的执行收尾。R2 负责最终只读检查的证据、判断条件与显示。

权限、付费审批、原始参数/请求、Stop、每执行段 32 次请求预算、停用技能/会话检查，以及副作用 unknown 时不重放等约束保持。提前展示的候选原文留在执行活动记录中；收尾后的第二次文本可以正常结束，不保证阻止一切错误回复。

## AC 映射

| Parent AC | 已验收事实 | 证据与边界 |
| --- | --- | --- |
| AC1 一轮执行、无重复“开始”、建议/暂停 | 真实绑定音频项目读取并修改第二段备注；真实 projectless create→审批→自动 bind→read→segment-write 审批→readback→final 只用一个用户目标；实际 advice-only 不调用工具 | 下方真实 gpt-6-luna 样例与 UI 文本/项目 ZIP；两个协议的仓储/运行时测试覆盖其他项目种类。单一真实模型样例不代表所有模型都遵循 |
| AC2 真正停止原因、unknown 安全 | 真实新增段落未批准时 Stop，34 秒显示 cancelled；reload 仍 cancelled，项目仍仅一段。typed preflight/read 失败、真实 atomic rollback 与 POST 后保持 unknown、没有成功 result、恢复时没有新增 POST 有回归 | `agentContextualOwnerRecovery`、`audioGenerationAgent`、`agentFinishingCheck`、`agentFinalReview`；失败/审批/预算/Stop 不从回复关键词推断 |
| AC6 权限、scope、revision、Stop | 创建和新增段落两次真实 write approval；批量 prepare 只是草稿，真实 MiMo 另经 UI 确认；显式冲突 owner、stale、删除/旧审批、disabled/conversation 回归保持 | runtime/protocol/creation/recovery tests 及 R3 确认截图；模型参数不能替代用户批准，付费请求也不自动重试 |
| AC7 紧凑 desktop/narrow、细节可查 | 执行界面显示真实调用数量、当前已保存变化和检查状态；创建执行弹窗显示 11 次模型请求、10 次工具调用、0 失败、0 拒绝、最后工具列表为空；实际 Agent URL 在 390px 测 clientWidth/scrollWidth=390/390 并存截图 | `live-create-execution-ui.txt`、create/advice/Stop 截图和 `live-agent-narrow.jpg`。只覆盖该实际测量的标签页；其他标签页此前未生效的视口调整不算 390px 证据 |
| AC9 自动化+native+小规模真实模型 | 当前完整门禁与独立检查通过；已配置的 AIHubMix gpt-6-luna 样例记录调用、状态、审批与停止；真实 create、advice、Stop/reload 与工作区 readback | 脚本化 Chat/Responses 测试证明协议和保护条件；真实 Chat Completions 请求证明该实际模型选择的一组样例。模型检查器没有被当作完美认证器 |

## 真实模型与原生 UI 样例

主会话在隔离验收项目通过可见 UI 配置 AIHubMix，使用 gpt-6-luna。无 API key 或原始私密模型请求写入本记录；以下来自主会话操作交接、保存的可访问 UI 文字/截图与导出状态。本 reviewer 没有重跑真实请求。

### 绑定项目编辑与恢复

模型实际读取当前 chapter 稿件并保存第二段 notes。按持久 `segment.order` 核对：第二段 `order=2` / `asg_abbe9673-ea6c-44d7-97f9-ba12b4c5b92a` notes=`10-10 真实模型验收：已执行本地备注修改`，第三段 `order=3` notes 为空，三个 clips 保留。[实际修改截图](../../09-22-agent-result-evidence/validation/2026-10-10-live-model-write.jpg)与本地产物 `live-audio-final.zip`支持保存事实；ZIP 不含 AgentRun/ToolCall，不能独自证明模型调用。

第 12 段单条 batch 草稿样例曾有一次 `audio_read` 失败，模型更正读取后成功 `prepare_audio_generation_batch`。保留这**1 次真实失败**，不宣称整段零错误。prepare 是不付费的草稿，不是声音已生成。真实 MiMo 经另外 UI 确认保存 1.92s 后，模型只读报告 saved/selected=false/placed=false，没有额外付费生成；R2 最终验收记录其来源边界。

### Projectless create-and-continue

真实请求明确创建独立音频项目，并在同一次执行向第一章写入“创建后继续写入成功。”，不生成音频。Thread 前缀 `cth_2cd95cf6…`；创建项目 `prj_f6005be3-74ee-40b3-ae60-5d7320572ffd`。原目标只提交一次，无新增用户“开始/继续”。

实际执行：加载工具/plan → project_create 审批 → 创建 chapter/voice track 并关联当前 conversation → audio_read → audio_create(segment)审批 → audio_read → plan/final。保存的执行 UI 为 **10 calls completed、0 failed、0 rejected、11 model requests、最后 offered tools=0、chat-completions、plan 4/4**。这 11 次包含实际工具进展和终端 checks，不表示新增检查本身可无限调用。

证据：[执行 UI 文本](2026-10-10-live-create-execution-ui.txt)、[执行截图](2026-10-10-live-create-continue.jpg)、[真实项目截图](2026-10-10-live-create-project.jpg)。`/Users/xiaomengdao/.codex/local-artifacts/aifenjing/2026-10-10/live-created-project.zip`只读确认 audio 项目、一个章节、一条轨道、一个文本准确的段落，没有 takes、clips 或 jobs，未生成声音。

最终只读 check 返回的文字 span 或 ref 无效，UI 明确“成果声明未核实／检查返回的文字范围或来源无效”，原文与真实 saved receipt 保留，未制造认证、改写或再发一次 check。这是已批准的“检查无效则标记未核实”边界的真实验收，**不是成功的全句语义认证**。

### Advice-only 与 Stop

- 明确只要朗读建议、不要读取/修改/计划/生成：7 秒“仅回复，未调用工具”，返回两条建议；check 完成且 claims 为空。空 claims 不证明回复没有任何遗漏/错误。[advice UI](2026-10-10-live-advice-ui.txt)。
- 请求新段落，在实际写入前等待审批，然后用户 Stop：34 秒“执行已取消”，status“已停止”，reload 后 cancelled 保持，project 仍只有原已保存 segment，未批准新增未落盘。[Stop UI](2026-10-10-live-stop-ui.txt)、[截图](2026-10-10-live-stop.jpg)。
- [实际 Agent narrow 截图](2026-10-10-live-agent-narrow.jpg)对应主会话真正加载 Agent URL 的 390/390 测量；不把其他标签页未生效的视口调整算作覆盖。

## 自动化与完整门禁

读取主会话已执行日志，无新增 gate。本机指定 pnpm 路径始终为 `/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm`。

- [完整 Vitest](2026-10-10-full-vitest-final.log)：**180 文件通过，3221 tests passed + 1 skipped（3222 total）**。
- [完整 quality clean](2026-10-10-full-quality-clean.log)：**PASS(all)**；13 reviewed allowances、541 review warnings 保留，lint/architecture/unused 均 0 failures，静态 value cycles=0。
- [quality self-test](2026-10-10-quality-self-test.log)：**PASS，88 cases**。
- [最终 TypeScript](2026-10-10-typecheck-final.log)：`tsc -b --pretty false`通过。
- [production build](2026-10-10-build.log)：通过，24.25s；既有>500kB chunk advisory 保留。
- model-bank 已有先前 verify 通过（197 files / 85 providers / 1855 models，历史 validation 记录）；本轮不是新的模型库交付，不宣称本文件又重跑一次 model-bank。
- 独立 owned fixes/meaningful focused 与 whitespace 证据见[独立记录](2026-10-10-independent-check.md)，migration/retention 修复见[回归记录](2026-10-10-v24-migration-retention-check.md)。各组重叠，不累加测试数量。

最初 v24/E04 fixture 失败、retained API whole-file hash 失效、unused export 质量失败均保留其历史 log，并有后续修复/通过。旧失败不再作为当前 blocker；也不将 warning 或 skipped 隐藏成零警告/全测试通过。

## 接受范围与保留限制

当前 R1 负责的开发、检查和真实样例验收已完成。建议/Stop 和创建续作有实际模型样例，两个协议及其他保护条件有仓储/运行时测试证据。原始用户截图历史原因仍未审计；这些样例不保证所有模型、供应商与浏览器均遵从，也不保证完美语义检测。付费副作用不确定时不重试，只读检查失败时保留“未核实”状态，是已观察到的真实边界。

R2 的逐输出反馈/影视影响、R3 批量配音、R4 排列，以及发布任务的录音、音乐和导出有各自负责人及验收记录。本子任务未纳入父任务的 R6 异构影视批量、R7 语义同步或 R8 结构化人声意图。主会话负责父级综合文档、任务状态、提交和归档；本子任务没有未完成的负责范围内修复。

Current model-bank was also verified in this closeout: [log](./2026-10-10-model-bank-verify.log), 197 files / 85 providers / 1855 models, pinned revision ebe586289d55936b738e4dc822dbdd745196b4f3, exit 0.
