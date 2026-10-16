# Cuepoint 与 DeepSeek Harness：Agent 能力对比

调查日期：2026-10-15。结论来自本地源码、配置、测试定义与项目文档；没有启动参考项目、安装依赖、运行付费模型或声称完成运行时验收。

## 调查基线与结论

- Cuepoint：`9d1a41739b17be27cf832326de15a9489017825a`，仓库 `/Users/xiaomengdao/WebstormProjects/aifenjing`。
- DeepSeek Harness：`571902028a75c64c1d767f4ae5fd099485f0ddf0`，版本 `0.2.1-alpha.3`，仓库 `/Users/xiaomengdao/WebstormProjects/deepseek-harness`。
- 参考项目的 `README.md:13` 明确标注 developer preview。它的能力覆盖、组合机制和工程治理值得研究，但不能把所有包都当作已经稳定、默认开放的产品能力。当前 `packages/*/*/package.json` 共 336 个，也不适合作为我们的拆包数量目标。

核心差距是可扩展的执行环境与交互生命周期。Cuepoint 已有真实可复用的执行循环、协议适配、审批、上下文压缩、创作工具和业务原子提交；DeepSeek Harness 在这些机制外，建立了文件、进程、工具接入、委派、后台工作和会话驱动的组合体系。后者值得借鉴，现有创作与数据一致性机制仍应保留。

下文“默认”以标准 Web/桌面组合及其 `standard` preset 为主要参照。`packages/bundle/web-app/cordis.patch.yml:457,579` 将 Agent plane 移入逐会话 preset，`:586` 选择 `standard`；其 `presets/standard.patch.yml` 明确列出工具。`sdk`、`sdk-minimal`、headless 与自定义组合不同，不能把所有包合并视为任何入口的默认能力。桌面宿主的独立复核见 [宿主整合调查](host-integration-review.md)。

## 源码证据地图

以下路径相对于各自仓库；行号绑定上述本地基线。

| 主题 | Cuepoint | DeepSeek Harness |
| --- | --- | --- |
| 真正执行循环与宿主接口 | `packages/agent-core/src/runtime.ts:31,179`；`packages/studio/src/features/agent/runtime/runChat.ts:33,116` | `docs/architecture.md:55,79`；`packages/core/agent-loop/src/agent.ts`；`packages/core/agent-loop/src/tool-calls.ts` |
| 工具与审批 | `packages/agent-core/src/tools.ts:18,88`；`packages/studio/src/features/agent/runtime/tools.ts:37,133` | `packages/core/tools/src/index.ts:1377,1514,1527,1791`；`packages/interaction/user-approval/src/index.ts:215,225,232` |
| 前端与原生生命周期 | `packages/studio/src/features/agent/ui/useChatExecutionSession.ts:16,20`；`packages/studio/src/features/agent/runtime/runOwnership.ts:14`；`apps/desktop/src-tauri/src/desktop.rs:1663,1761`；`apps/desktop/src-tauri/capabilities/main.json:8` | `docs/architecture.md:49`；`apps/desktop/README.md:143`；`apps/desktop-host/package.json` |
| 按需工具与技能 | `packages/agent-core/src/capabilities.ts:3,18`；`packages/studio/src/features/agent/runtime/skills.ts:12` | `packages/skill/skill-filesystem/src/index.ts:135,736`；`packages/skill/skill-filesystem/README.md:26` |
| 持久性与未知结果 | `packages/agent-core/src/runtime.ts:139`；`packages/studio/src/features/agent/commands/agentTools.ts`；`packages/studio/src/features/agent/commands/agentToolRecovery.ts` | `docs/architecture.md:118,124`；`packages/session/session-checkpoint-policy/src/index.ts`；对应 README 的 Interrupted calls |
| 上下文与大输出 | `packages/agent-core/src/compaction.ts:45`；`packages/studio/src/features/agent/runtime/contextCompaction.ts`；`packages/agent-core/src/runtime.ts:147` | `packages/compaction/compaction-basic/src/index.ts`；`packages/compaction/compaction-tool-result-pruner`；`packages/spill/spill-policy/README.md:12,69` |
| MCP | 没有当前产品 MCP 注册/连接实现；静态内置工具为正式入口 | `packages/mcp/mcp-client/src/transport.ts:31`；`packages/mcp/mcp-client/src/tools.ts:107,150` |
| 委派与长任务 | 有任务/计划/生成作业；没有当前产品通用子 Agent 或本地进程任务服务 | `packages/subagent/tool-subagent/README.md:57`；`packages/jobs/jobs-local/README.md:12,32`；`packages/schedule/schedule/README.md:12,65,153` |

## 能力矩阵

| 维度 | Cuepoint 当前能力 | Harness 当前能力与激活情况 | 对我们的意义 |
| --- | --- | --- | --- |
| 核心复用 | 无运行时依赖的 `agent-core`，中立宿主接口；`agent-providers` 保留 Chat Completions/Responses | Cordis 服务、作用域、可撤销注册和插件树；循环本身也是插件 | 保持中立核心，学习能力提供者和生命周期管理；不必迁入整套插件框架 |
| 业务工具 | 项目、分镜、角色/素材、音频、音乐、生成、记忆、引用、联网调研等 | 通用文件/命令/搜索/委派等工具，与领域产品分离 | 桌面工具与创作工具组合，不能用直接读写数据库替代业务命令 |
| 工具扩展 | 静态注册，内置技能映射为分组；按需加载并固定未完成调用，最多 36 个同时加载工具 | 作用域注册，执行前策略、不可放宽的拒绝守卫、执行包装、结果后处理；卸载释放注册 | 增加 typed capability/provider 注册、工具目录与版本/生命周期，保留现有发现预算 |
| 本地文件 | 受控导入、托管二进制文件、原生保存/导出；不是任意项目目录读写工具 | 默认 fs 提供读取、搜索、写入/编辑、版本守卫及受限写策略 | 目录扫描、文档/字幕处理、素材批量整理有明显收益；需要独立目录授权与文件版本保护 |
| 本地程序 | 原生服务和存储工作线程；Agent 没有通用 Shell/子进程工具 | Bash/PowerShell、受限子进程、进程树清理；持久终端另有提供者 | 媒体探测、转码、提取音轨、波形/缩略图、CLI 集成；先做受控任务再决定通用 Shell |
| 权限 | `ask/assist/full`；效果、高风险与强制确认；执行前再次校验 | 沙箱模式与审批政策独立；预设组合、一次授权与审计；跨平台文件效果约束 | 在现有审批上增加目录、进程、网络/凭据和调用来源的资源权限；权限 UI 需要解释具体影响 |
| Skills | 13 组内置创作能力与说明，编译期定义；不是通用磁盘技能加载器 | 支持 `SKILL.md`/平面 Markdown、frontmatter、多个根、按需正文、变更观察 | 用于可安装的创作流程和工具使用知识；加载说明不授予脚本或文件权限 |
| MCP/外部工具 | 没有通用桥接；联网/模型/生成连接已有产品级策略 | stdio 和 Streamable HTTP，工具命名空间、连接代际、工具同步、资源读取；默认无外部服务器 | 扩大外部应用/服务接入面；所有调用仍进入同一审批、取消、结果和审计流程 |
| 子 Agent | 没有当前产品子 Agent 管理与工具接口 | Spawn/Fork、消息、结果通知、深度与路由约束；有多种外部后端 | 调研、编剧、镜头、素材与检查可分工；先明确并发上限、预算和写入归属 |
| 后台工作 | 有持久化的远程生成状态、查询和恢复；普通会话执行仍依赖页面 | 通用作业注册/输出/等待/取消/结算通知；默认 jobs-local 进程内 | 原生媒体工具可异步进行，页面切换后继续观察；单有持久记录不等于进程继续运行 |
| 定时工作 | 当前无通用会话定时唤醒服务 | Web/桌面宿主组合中有持久定时跟进和冷会话恢复；需要宿主在线 | 定时查询生成结果、日报或持续调研可后续评估，不能承诺软件退出后执行 |
| 程序化调用 | 模型调用工具；同轮实际执行按保存顺序串行 | native/混合/PTC 呈现；受管 Node 执行，多次内部工具调用仍过统一管线；读调用有受限并发调度 | 多素材批量处理可减少模型往返；依赖并发分类、取消、预算和副作用记录，不只是加一个 eval 工具 |
| 长上下文 | 已有预算、整轮摘要、来源前缀校验、持久化启用与 continuation 保留 | 摘要之外有大结果落盘、头尾预览、按需回读和工具结果裁剪 | 最值得补的是大输出可恢复读取、附件/产物索引；不用重做已有压缩 |
| 浏览器/电脑操作 | 原生外部链接/打印等封闭服务；没有任意浏览器或桌面控制工具 | 注册服务与具体提供者分离；Playwright/DevTools/Stagehand、CUA 提供者在 experimental | 浏览器调研或无 API 应用操作有潜力；独立试验，验证授权和会话资源隔离 |
| 交互设计 | 流式消息、执行过程、工具确认、任务面板和滚动规则；用户消息回显和清空输入仍等待持久化受理 | 普通发送先登记临时消息，再序列化和发起 RPC；按请求 identity 与真实记录合并；部分准备/停止路径仍有改善空间 | [交互专项调查](interaction-audit.md)覆盖乐观更新与可感知响应，不以工具数量替代体验 |

## 交互专项结论：先让用户意图可见，再确认实际结果

用户指出的发送体验问题可以从源码确认。当前顺序是点击后同步锁定并更新发送按钮，随后等待模型兼容性检查（部分提供者会发出目录 GET）、新话题创建/导航、线程写入、`beginAgentRun` 完整事务，最后才确认清空提交时的草稿。消息由持久化查询提供，没有本地临时回显。按钮及时变成停止，并不保证用户已看到提交内容进入会话。

Harness 的普通发送路径先建立逐会话临时消息和稳定 request ID，再做后续编码/RPC，并在真实记录可渲染后交接。值得借鉴的是身份与状态交接；同步登记不证明已经绘制，参考项目也有指令准备、流式合批和停止反馈方面的限制。不能据源码声称它在所有情形更快。

| 优先建议 | 已确认的不足 | 用户应看到的变化 |
| --- | --- | --- |
| P1：发送回显 | 发送内容及附件没有受理前的临时消息；新话题也需先等待建库和导航 | 本地有效的发送意图立即进入会话，输入可开始下一份草稿；临时、已受理、失败状态可理解，真实消息到达后不重复 |
| P1：失败恢复 | 受理前失败只有发送错误提示和内存草稿，没有逐次失败对象；离开页面/刷新不能依靠它保留未发文本 | 原文与附件可恢复，重试/编辑靠近失败项；后续新草稿不被覆盖；受理结果未知时先核对而非盲目重发 |
| P1：等待与流式反馈 | `sending` 跨越准备、模型等待与结算；当前可见 token 必须通过 checkpoint/原生提交/变更查询 | 少量真实阶段说明；分别测量点击、临时回显、受理、首个接收 token、首个显示 token，不把存储等待算成模型慢 |
| P2：停止反馈 | Stop 立即 abort，但没有独立“正在停止/保存”状态；锁保留到最终结算 | 点击立即确认收到停止意图，保留已到文本和真实完成结果，结算前不误称已停止或释放重复执行保护 |
| P2：话题切换 | 旧数组被过滤成空数组时可能显示空态；离开判断还可临时使用未过滤的旧 run | 查询携带话题 identity，匹配前显示加载；阻塞/离开判定只看当前话题。现有过滤和 keyed workspace 已防止旧消息串显 |
| P2：阅读导航 | 上翻会正确暂停跟随，但没有直接回到最新输出的控件；turn rail 要五轮才出现 | 明确的“回到最新”，用户主动恢复跟随；新 token 不抢阅读位置 |

上述等待依赖已确认，实际卡顿时长尚未测量。完整代码锚点和慢存储、离线、重复点击、未知受理、取消、迟到查询等验收场景见 [交互专项调查](interaction-audit.md)。不要通过删除 checkpoint、提前写成功状态或放松审批来换取流畅；临时呈现与真实业务结果可以分别表达。

## 需要优先解决的结构问题

交互响应问题也出现在相邻创作页面。对项目、世界资产与素材导入的有限抽样，确认了创建/删除反馈不一致、重复创建窗口、归档筛选文案与集合不一致，以及导入进度可改进的入口，见 [创作界面交互抽样](interaction-spotchecks.md)。这部分与 Agent 专项调查共同作为后续体验范围的依据。

### 1. 桌面权限已经扩展，Agent 生命周期尚未独立

Tauri 的正式调用表有产品存储/二进制、托管预览、工作区、受限 HTTP 授权、系统保存、打印和外部链接。没有正式 Shell/MCP/子 Agent 命令。Webview 的能力表也没有赋予任意系统访问。

Studio 通过 `executeChatRun` 绑定同一个核心；线程所有权默认来自 `navigator.locks`。`useChatExecutionSession` 在组件卸载和线程切换时 abort。这些是清楚的当前产品选择，但不能推导为后台 Agent 执行。最小本地工具可以先通过 Tauri 实现；若要切会话、关聊天视图后模型仍继续运行，需要宿主执行服务及 UI 订阅，或另一种明确的生命周期设计。

Harness 的 Electron 桌面运行独立 Node-mode Host，复用其 Web 应用与认证 API。它也没有把任意文件系统/Node/Shell 直接开放给 renderer。可以借鉴执行与展示解耦，载体仍需按我们的 Tauri/跨平台/包体目标选择。

### 2. 开放资源后，当前工具级审批需要增加资源描述

`requiresToolApproval` 当前按模式、效果、高风险、强制确认判定，适合已知业务工具。目录读写、命令、外部服务器和桌面输入还涉及目标、范围、凭据、权限继承、授权到期与撤销。应让执行宿主检查这些资源事实，并让审批显示同一事实，避免只靠模型提示词保证边界。

这不是当前封闭工具模型的漏洞结论，而是扩展新能力时新增的设计需求。`full` 仍不能改变当前代码明确要求每次确认的生成操作。

### 3. 大结果与长任务需要可观察、可恢复的对象

当前非原子工具结果超过 65,536 字符会报错；能力目录上限和上下文摘要已在核心中。加入目录搜索、命令日志、网页/文档和工具服务器后，结果存储引用、分页/范围读取、输出进度、截断与产物索引会比单纯提高限制更有价值。

新任务对象应区分排队、已接受、运行、请求停止、已停止、完成、失败与结果未知；也要区分远程生成任务、本地进程和模型轮次。取消本地等待不能声称取消外部生成、支付、上传或 UI 动作。

## 参考项目不能直接照搬的部分

1. **后台作业不等于跨重启继续。** `jobs-local` 的实时注册、输出环和执行随进程退出；持久日志可留下记录。它的 README 明确说明跨重启执行需要其他后端。
2. **定时投递不等于恰好一次执行。** Schedule 需要在线 Host；会话持久化和任务投递记录是两笔写入，崩溃窗口可能重复投递。回执证明入队，不证明模型或业务动作完成。
3. **沙箱不是所有资源的统一隔离。** 这里的模式约束文件效果，不承诺隔离全部网络和进程可见性。`fs-sandbox` 的读取透传，写路径检查接受其文档中的 TOCTOU 威胁模型；Windows ACL 与旧 Landlock 可报告 partial。我们的托管文件与数据库已有更严格语义，不应整体降级到这个文件提供者。
   MCP stdio 的启动由协议 SDK 持有，`packages/mcp/mcp-client/src/transport.ts:15` 明确不走受管 subprocess seam；环境清理不意味着进程受同一 OS 沙箱约束。新能力需要逐入口验证资源权限。
4. **实验模块不等于默认产品。** 自动审查、Agent Teams、浏览器提供者和 CUA 等有明确实验属性。macOS CUA 明确需要显式装配、系统权限，默认 profile 不挂载，Windows 支持在开发。
5. **PTC 不是受限语言沙箱。** Node API 仍可用，实际限制来自受管子进程与 OS 策略；持久 REPL 的内存不会跨宿主重启恢复。
6. **包可发布不等于可直接移植。** 多数 Harness 服务/工具依赖 Cordis 上下文、会话和作用域。引入一个高层插件可能带入一组会话、权限和生命周期依赖，需逐包验证，不能按目录名认为是独立库。
7. **SDK 接入不等于拥有完整桌面交互。** `packages/sdk/client/README.md` 明确写出当前 wire 没有 turn 级取消，放弃需关闭运行时；`run()` 返回的是接收回执到整个 Agent idle 区间内最后一条根会话回答，不是严格按 prompt 归属的结果；服务端向客户端发起审批请求尚未实现。独立 `sdk-minimal` profile 还明确省略 Skills、jobs、subagents 等服务。若评估外部 worker，必须先选择 profile、完成能力与控制协议验证。

## 我们应保持的优势

- 本地业务效果、证据与工具结果在同一产品事务提交，核心确认真实完成而不是另写一个成功状态。
- 外部生成请求与结果状态明确区分；未知结果阻止盲目重复提交，已完成结果恢复时复用。
- 强制确认卡片绑定具体生成参数和版本；用户修改后的真实结果决定后续状态。
- 项目绑定、业务 revision、资料引用与经审核的项目记忆约束使创作动作有实际归属。
- 提供者协议、opaque continuation、有界网络读和当前凭据解析已经分层。
- 独立 Todo SQLite 消费者验证实际核心复用。新扩展仍应让别的项目能够绑定自己的业务和存储。

## 调查边界

源码路径确认能力存在和执行顺序；项目文档确认支持承诺与已知限制；测试定义只说明覆盖意图。本轮没有通过运行来证明参考项目的跨平台行为、性能、真实模型质量或 UI 体感。交互报告区分了可静态确认的等待顺序和仍需浏览器测量的卡顿假设。
