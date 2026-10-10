# R2 最终验收 — 2026-10-10

状态：R2 当前约定范围已实现、独立检查并完成验收。主会话统一处理 task 状态、提交和归档，本文件不执行这些动作。[历史 validation](../validation.md)保留三个早期阶段；当前证据以[独立检查](2026-10-10-independent-check.md)、[film 增量](2026-10-10-film-script-impact.md)和本记录为准。

## 当前交付

已交付与真实写入原子保存的有界回执、规范化字段及有效关联、初始化实体、本轮写入投影、音乐任务状态观察、当前声音文件与来源检查、独立 resultKey 任务来源及分页和新鲜度、film 剧本范围影响，以及一次独立只读成果声明检查。

模型判断与代码核对的结构条件分开。保留原文；返回无效、证据过期、超时、Stop、预算不足和旧记录未覆盖时，明确显示未核实。不把计划、读取或网络调用结束、远端状态、文件元信息当作整个作品完成或试听证明。

用户于 2026-10-10 批准最多一次只读检查及一次 R1 执行收尾检查，接受费用和等待。两者使用同一段请求预算；只读检查保留冻结的 connector/model/protocol、零工具、一次性标记、原 Chat/Responses 信封和不重放边界。

## AC 证据映射

| Parent AC | 实际验收事实 | 证据与边界 |
| --- | --- | --- |
| AC2 真实停止、失败与未知效果 | notes/create 的检查返回无效 span/ref，显示未核实；批次草稿样例的一次 audio_read 失败保留；Stop/reload 不执行未批准写入；付费 POST 后故障保留 unknown、无 result、不多发 POST | 真实 UI 与 R1 最终验收；audioGenerationAgent、agentContextualOwnerRecovery、agentFinalReview 回归。检查失败不等于业务未发生 |
| AC3 持久来源、本轮与历史区别 | 第二段 notes 已保存，第三段未动，三 clips 保留；新建项目列出实际 project/chapter/track/segment；只读查询已有 MiMo 成果不变成本轮付费生成 | 实际工作区与写入回执；runWriteOutcomes、任务/output/source/wrap-up/batch 来源负例，部分和不可核实结果仍可见 |
| AC6 权限、归属与 Stop | 本地写入经实际审批；MiMo 单独 UI 确认；最终只读检查 tools=0；归属/CAS/旧参数/unknown 无法绕过限制 | 创建与段落写入两次审批、MiMo 确认截图；Chat/Responses/recovery/provenance 回归。原参数和审批不改写 |
| AC7 紧凑 desktop/narrow | 保存修改、调用详情、检查状态与原因在既有 process 中；实际 Agent URL 在 390px 测 clientWidth/scrollWidth=390/390 | R1 原生执行与 narrow 材料。仅该实际测量 tab，不宣称全部 tab 或设备覆盖；完整技术引用留在详情 |
| AC8 保存、选用、入轨和试听区别 | MiMo 1.92s 实际保存，模型只读报告 selected=false/placed=false；文件和解码元信息可核对，检查器没有认证声音质量 | [只读输出截图](2026-10-10-live-model-output-read.jpg)、audio ZIP、R3/R4 独立 selection/placement 材料。元信息检查与主会话实际播放器操作是不同证据 |
| AC9 自动化、原生与小规模真实模型 | AIHubMix gpt-6-luna 实际编辑、创建、建议、Stop 和读取；真实检查失败保持未核实，advice 的空 claims 不保证检测完美 | R1 真实 UI/截图/项目产物，当前完整门禁与独立检查。多数双协议故障/声明负例是预设响应；真实样例使用 Chat Completions |
| AC10 音乐观察、版本与成果来源 | 供应商状态和上次核实时间区别于本地任务阶段；每个输出保留原来源；真实 Flow manual job saved，work 实测约 58.581s/48kHz stereo | music ZIP/release 验收；audioTaskEvidence、audioOutputEvidence、查询/runtime/Agent 回归。请求 1s 未被供应商遵守，不能声称精确时长控制；Flow live 不代表 Suno live |

## 真实模型、供应商与原文边界

主会话在隔离项目通过 AIHubMix gpt-6-luna 实际操作，没有使用预设模型响应。本 reviewer 读取交接、原生 UI 材料和产物，没有重新发真实请求。

- 绑定音频项目读取后保存第二段 notes：`order=2` / `asg_abbe9673-ea6c-44d7-97f9-ba12b4c5b92a` 为“10-10 真实模型验收：已执行本地备注修改”；`order=3` notes 为空，三 clips 保留。以持久 order 判断，不用 ZIP 数组下标。[实际修改截图](2026-10-10-live-model-write.jpg)。
- 第 12 段 Agent 单条批次草稿第一次 `audio_read` 失败，随后正确读取并 prepare 成功。保留这一次真实失败；草稿不证明生成，也不授予付费审批。
- 真实 MiMo 经 UI 确认保存 1.92s/48kHz mono。主会话播放器 currentTime>0、readyState=4、无 error，证明该次播放器加载/播放路径；不能推断本 checker 或模型听过音频。模型后续只读报告 saved、selected=false、placed=false，未追加付费请求。[MiMo 确认](../../09-22-audio-batch-experience/acceptance/2026-10-10-live-mimo-confirmation.jpg)、[已保存](../../09-22-audio-batch-experience/acceptance/2026-10-10-live-mimo-saved.jpg)、[只读观察](2026-10-10-live-model-output-read.jpg)。
- 真实无绑定项目创建在一个用户目标下完成创建审批、自动绑定、读取、段落写入审批、回读与最终回复：10 completed calls、0 failed、0 rejected、11 requests、最后 tools=0、chat-completions、plan 4/4。项目、章节、音轨和准确段落由真实仓库保存。[真实执行 UI](../../09-22-agent-execution-reliability/validation/2026-10-10-live-create-execution-ui.txt)。
- Notes 与 create 样例的最终检查实际返回无效 span/ref。UI 明确未核实，保留原文和真实写入事实，没有重复请求检查器、静默改写或把非法 ref 当作代码认证。该失败是实际模型输出限制的证据；本任务接受的是有界验证与安全的未核实处理，不是保证每次检查器都返回正确语义结论。
- Advice-only：7 秒、0 tools、检查完成且 claims 为空；空 claims 不证明所有文字都正确。未批准新增时用户 Stop，34 秒显示 cancelled，reload 保持且项目仍只有原一段。见[R1 最终验收](../../09-22-agent-execution-reliability/validation/2026-10-10-final-acceptance.md)。

通过真实 UI 导出的本地产物位于 `/Users/xiaomengdao/.codex/local-artifacts/aifenjing/2026-10-10/`，没有凭据。`live-audio-final.zip`保存 notes、MiMo、recording 与 7.75s WAV；`live-created-project.zip`有一个章节、音轨和段落，无生成媒体；`live-music-final.zip`有 manual-origin Flow job saved 与 58.581333s、48kHz stereo work。ZIP 证明导出状态与 bytes，不能替代 AgentRun/ToolCall/审批 trace。供应商返回时长未遵守 lengthSec=1，应用按实测时长保存。

## Film 与当前来源的独立证据

- Film impact 在实际原子事务内从规范化 before/after 计算。仅 script patch 报告新失效关联；预先 malformed/mismatching/absent 不当作新失效。Shot IDs 按真实 project/episode 过滤，各数组最多 40，并披露准确总数和省略数；`semanticSynchronization: not_performed` 明确保留。
- 真实 legacy duplicate-ID 回归先失败（实际 0、期望 1）；私有投影按保留的 beat 顺序逐项比较关联后通过，不改 normalizer、beat、shot 或审批。14 个 film tests 及相关 4 文件 92 tests 通过。
- Stale preview 拒绝更新后的 episode；并发 shot 编辑和新增保留。结果超限或 ledger 保存失败真实回滚；reload 与后续手动编辑后重放返回原保存的历史 impact，不能覆盖新状态。
- Per-output task source 保留 exact resultKey。重复、缺失、删除、外项目、空文件或损坏媒体不能提供有效证明。选用与有效入轨独立；来源和 wrap-up fingerprint 覆盖 UI 省略项，不用草稿回执证明生成。
- 共享批次来源检查验证原始 completed preparation、confirmed membership、job/item/input/owner 及真实 retry chain。不能用任意 retry flag 绕过来源；prepare/read 不变成音频生成证据。

## 完整门禁与历史失败

本记录读取 main 已执行结果，没有重跑 gate。证据在 R1 validation 目录：

- [Full Vitest](../../09-22-agent-execution-reliability/validation/2026-10-10-full-vitest-final.log)：180 文件通过，3221 tests passed + 1 skipped（3222 total）。
- [Full quality clean](../../09-22-agent-execution-reliability/validation/2026-10-10-full-quality-clean.log)：PASS(all)，13 reviewed allowances、541 visible warnings，各 section 0 failures，0 static value cycles。
- [Self-test](../../09-22-agent-execution-reliability/validation/2026-10-10-quality-self-test.log)：PASS，88 cases。
- [TypeScript](../../09-22-agent-execution-reliability/validation/2026-10-10-typecheck-final.log)：`tsc -b`通过。
- [Build](../../09-22-agent-execution-reliability/validation/2026-10-10-build.log)：通过，24.25s，既有 chunk warning 保留。
- Model-bank 沿用此前 verify 通过证据（197 files/85 providers/1855 models），不是本文件新增执行，也不是新的模型库交付。
- Owned fixes、有效定向回归与 diff 证据见[独立 review](2026-10-10-independent-check.md)。D05 历史 fixtures 未覆盖，仅接受明确批准差量；E06 canonical format 与 fixed publisher hashes 的严格检查保留。

最初 unused、whole-file hash evidence、v24/E04 fixture 及旧 runtime 额外请求预期失败都保留，有修复及最终通过，不隐藏为一次全绿。测试组重叠不累加，不写零 warning 或 3222 全通过。

## 最终范围

R2 当前负责的条件已满足：代码/仓库条件、原生可见状态和小规模真实模型/供应商样例有证据；无效检查安全落为未核实。没有未完成 owned 修复。

保留限制：不承诺完美语义检测；历史回执不是当前版本；保存元信息不是试听/质量验收；证据范围有上限；原回复先流式展示再检查；真实样例没有覆盖所有模型、协议、浏览器和供应商。Parent R6 异构 film batch、R7 语义 beat/shot 同步、R8 structured vocalists/stems/multitrack 未由本任务交付；R8 readable confirmation 有其已归档 child 证据。主会话负责父任务综合收尾、状态、提交和归档。

Root also completed the current model-bank check: [197 files / 85 providers / 1855 models](../../09-22-agent-execution-reliability/validation/2026-10-10-model-bank-verify.log), pinned revision ebe586289d55936b738e4dc822dbdd745196b4f3, exit 0.
