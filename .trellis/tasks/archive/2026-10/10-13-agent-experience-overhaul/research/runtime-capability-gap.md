# Research: Agent runtime capability gap (browser-era vs Tauri desktop)

- **Query**: 只读审计 Agent 运行时架构、浏览器时代遗留限制、与 Claude Code/ChatGPT 能力差距、候选方向
- **Scope**: internal（section 1/2）+ 凭知识推断（section 3 外部对标，已标注"推断"）
- **Date**: 2026-10-13

> 产品定位提示：Cuepoint 的 Agent 是"创作生产"Agent（IP/音频/音乐/素材/生成任务工具，约 60 个业务工具），不是编码 Agent。没有 shell、文件读写、代码执行类工具。

---

## 1. 现有 Agent 运行时架构

### 1.1 Files Found

| File | Description |
|---|---|
| `src/lib/agent/runChat.ts` (353 行) | 核心：`executeChatRun`(L239)、`resumeChatRun`(L232)、`executePendingTools`(L~100-230)、`createRunWriter`(L48) |
| `src/lib/agent/tools.ts` | `BUILTIN_TOOLS` 注册表(L42-138)、`requiresToolApproval`(L26)、`validateToolCall`(L149)、`update_run_plan`(L81-118) |
| `src/lib/agent/toolDefinition.ts` | `TypedToolDefinition`：effect/highRisk/atomic/recovery/prepare/execute；`AgentToolContext` 含 `signal`、`store` |
| `src/lib/agent/toolLoading.ts` | 按需加载工具分组 `load_tool_groups`(L55-117)，`MAX_LOADED_TOOLS=36`(`src/domain/agentToolSelection.ts:4`)，每次最多加载 2 组 |
| `src/lib/agent/skills.ts` | `AGENT_SKILLS`：audio-production / music-creation / web-research / project-references / project-memory / workspace / planning ...；skill = 指令文本 + 代码内工具白名单 |
| `src/lib/agent/runOwnership.ts` | `withThreadRunLock`(L20)、`recoverAbandonedRuns`(L29)——依赖 `navigator.locks` |
| `src/lib/agent/contextPlanner.ts` / `contextCompaction.ts` / `contextPolicy.ts` | 历史选取、预算(`budgetContext` L76)、摘要压缩(`prepareRunContext` L77) |
| `src/db/agentRuns.ts` | `beginAgentRun`(L54)、`checkpointAgentRun`(L207)、`finishAgentRun`(L220)、`interruptThreadRuns`(L242)、`canRetryRun`(L46) |
| `src/db/agentTools.ts` | 工具调用状态机：`saveToolRound`(L113)、`transitionToolCall`(L159)、`pauseForApproval`(L174)、`resolveAgentToolApproval`(L184)、`resumeAgentRun`(L202)、`pauseAtModelStepLimit`(L56)、`startModelStep`(L78)、`cancelAgentRun`(L304)、`executeAtomicTool`(L364) |
| `src/lib/ai/chatStream.ts` / `responsesStream.ts` | 两种协议传输（Chat Completions SSE / Responses API），经 `boundedSse.ts` |
| `src/components/agent/chatExecutionFlows.ts` | UI 侧调用 `withThreadRunLock` + `executeChatRun`/`resumeChatRun`(L76/111/135/143/162-184) |
| `src/components/agent/AgentControls.tsx` L28-30 | 三种权限模式 UI：ask/assist/full |
| `src/lib/agent/generationBatchRuntime.ts` | 页内批量生成 worker（`workers` Map，L26；`pauseThreadGeneration` L163） |

### 1.2 运行时关键事实（附证据）

**循环形态**：单线程、顺序"模型步 -> 工具轮 -> 模型步"循环，全部在 WebView 的 JS 里执行，Rust 侧无 Agent 逻辑。
- `runChat.ts:266` `while (true)`：每圈依次 `refreshRunToolLoading` -> `refreshRunProjectContext` -> `refreshRunMemoryContext` -> `prepareRunContext`(压缩) -> `startModelStep` -> 传输 -> 无工具调用则收尾，有则 `saveToolRound` + `executePendingTools`。
- 步数上限：`MODEL_STEPS_PER_SEGMENT = 32`（`src/domain/agent.ts:242`），到限 `pauseAtModelStepLimit`(`runChat.ts:268`) 暂停等待用户继续。

**流式**：
- 传输选择 `runChat.ts:288` `run.protocol === "responses" ? streamResponses : streamChatCompletions`；`onDelta`/`onReasoning` 增量写入 `accum`。
- 增量经 `createRunWriter`(L48-85)合并突发、串行落库（`checkpointAgentRun`），写失败则 `controller.abort()` 并终止流（`onWriteFailure` L~250）。即每个流式 checkpoint 都落 SQLite/IndexedDB，是"断点可恢复"的基础。
- 推理(reasoning)单独累计并记录 `reasoningDurationMs`（`chatStream.ts:62-76`），UI 为 `ThinkingPanel.tsx` / `ThinkingMatrix.tsx`。
- 每步记录 metrics（首 token、用量）`recordAgentModelMetrics`(`runChat.ts:~303`)。

**工具循环 / 并行**：
- 模型一次可返回多个 `toolCalls`，均被持久化(`saveToolRound` L~325)，但**按 `step, order` 顺序串行执行**：`executePendingTools` 内 `for (const call of calls)`(L108 校验/预览阶段)、`for (const saved of calls)`(L167 执行阶段)，`await tool.execute(...)`(L185)。无 `Promise.all`，无 `parallel_tool_calls` 参数（grep `src/lib/ai` 无命中）。
- 执行前三段式：校验 `validateToolCall`(tools.ts:149，参数 ≤32768 字符) -> 可选 `prepare` 预览(L~140-155，存 `saveToolPreview`) -> 审批判定(L158) -> 条件 `transitionToolCall(... "running")` 声明领取(L~183) -> `execute`。工具结果上限 65536 字符(L~195)。
- 状态机：`pending → awaiting_approval → approved → running → completed/failed/rejected/unknown`。结果不确定(`unknown`)的写/网络工具**不自动重跑**(L~207-225 `ambiguous`)。

**中断/取消**：
- 每次执行持有 `AbortController`；`controller.signal.throwIfAborted()` 散布在循环各边界；`signal` 传入 `tool.execute`。
- 取消结果：无工具调用 -> `cancelled`；有工具调用 -> `interrupted`（L~310；catch 块 L342-352）。已完成步骤与已收内容保留。
- 页面关闭：`AgentChatPage.tsx:106-111` 在 `pagehide` 调 `pauseThreadGeneration`/`pauseAudioGenerationBatches`；`runtimeFetch.ts:17-22` 在 `pagehide`/`beforeunload` 主动 abort 所有原生 fetch（"应用页面已关闭，本地网络等待已停止"）。
- 恢复：`AgentChatPage.tsx:180-187` 挂载及每次 `focus` 调 `recoverAbandonedRuns` -> `interruptThreadRuns`(`agentRuns.ts:242`)，把遗留 `running` 的 run 标记为 `interrupted`（或恢复为 `waiting_approval`），不自动续跑；用户手动"继续"走 `resumeChatRun`(`runChat.ts:232`)。

**重试**：
- 模型请求：`chatStream.ts:344` 注释 "One POST per attempt"，**无自动重试/退避**（grep `retry|backoff|Retry-After` 在 chatStream/responsesStream 无命中）。失败 -> `finishAgentRun("failed")`(`runChat.ts:~311`)。
- 手动重试：`canRetryRun`(`agentRuns.ts:46`) 仅允许"最近一条、无工具调用、非 completed"的 run；带工具调用的 run 不可重试，只能 resume。`assertRetryConnector`(L39) 要求连接未变。
- Tavily：`tavily.ts` 明确"没有自动重试"，超时 30s(`tavily.ts:49`)。

**权限与审批**：
- 三模式（`domain/agent.ts:24`）：`ask`（写/网络都问）、`assist`（仅 highRisk 问）、`full`（只有 `requiresConfirmation` 才问）。逻辑 `tools.ts:26-32`。
- `requiresConfirmation` 工具（付费生成等）任何模式都必须人工确认（`tools.ts:28`；`runChat.ts:~66` `effectiveToolInput` 校验覆盖参数必须来自用户批准）。
- 审批流：`transitionToolCall -> awaiting_approval`，`pauseForApproval` 暂停 run(`runChat.ts:~160-165`)；UI `resolveAgentToolApproval`(`agentTools.ts:184`) 写入决定，`resumeChatRun` 继续。权限模式在 run 创建时冻结（`run.permissionMode`，`runChat.ts:158/181` 注释"A global setting cannot change this run's mode"）。
- 无细粒度（按工具/路径/命令）规则，无"本会话总是允许"白名单；只有 3 档全局模式 + 工具自带 effect/highRisk。

**上下文压缩**：
- 每个模型步前 `prepareRunContext`(`contextCompaction.ts:77`)：`budgetContext` 判断 `needsCompression/overBudget`，最多 8 轮；把最旧的完整对话轮次交给模型生成摘要(`ContextCompaction` 记录，`activate` L~34-67 事务激活)，保护最新一轮与进行中的工具轮。
- 策略 `autoCompress` 默认开、`historyMessageCount` 20（`contextPolicy.ts:4-8`）；容量来自模型元数据(`resolveContextCapacity` L20)。压缩失败/无法缩短则报错而非丢弃（"摘要未能有效缩短请求，原始上下文已保留"）。
- 不压缩单轮内过大的工具结果（"当前输入、完整对话轮次或本轮工具结果过大，无法安全压缩"）。UI：`ContextUsagePanel.tsx`/`ContextCompactionDetails.tsx`。

**子任务 / 子代理**：
- 无。grep `subagent|sub-agent|spawn` 在 `src/lib/agent` 无命中。"任务"(`task_*` 工具、`agentTasks.ts`、`TaskBoard.tsx`)是业务级创作任务工作区（目标/验收/记录/收尾），不是并发子代理。`update_run_plan`(`tools.ts:105`)是共享计划/待办（≤30 项，pending/in_progress/completed，至多 1 项 in_progress）。
- 批量生成：`generationBatchRuntime.ts` 页内 worker，每线程 1 个，Web Lock 保护，付费请求"最多 2 条并发"（`.trellis/spec/frontend/audio-batch-arrangement.md:30` 与 skills.ts audio-production 指令）。

**所有权/并发**：
- 每线程一个 Web Lock：`runOwnership.ts:21` `cuepoint:agent:${threadId}` + `ifAvailable`，无锁则"此对话正在另一个页面执行"(L22)；无 `navigator.locks` 直接报错(L15)。规范明确 fail-closed（`.trellis/spec/frontend/agent-execution.md:19`、`native-product-runtime.md:134` "Keep ThreadLockManager/Web Locks"）。

**工具覆盖面**（`src/lib/agent/*Tools.ts`）：workspace_overview、update_run_plan、load_tool_groups、task_*(create/read/update/record_write/record_read)、ip_*、material_*、audio_*(~15)、music_*、generation(`submit_generation`/`check_generation`/`prepare_generation_batch`…)、memory/project_history 搜索读取、project_reference_*、`discover_project_images`/`read_project_image`、`web_search`/`web_read`(仅 Tavily)、`project_create`。无文件系统、shell、浏览、MCP、代码解释器工具。

**技能机制**：`AGENT_SKILLS` 为内置、代码内常量（`skills.ts:12`），指令是长中文文本；用户不可自建技能（无加载外部 SKILL.md/MCP 的路径）。

---

## 2. 浏览器时代遗留限制与桌面端可否移除

### 2.1 桌面端已提供的原生能力（证据）

`desktop/tauri/src-tauri/capabilities/main.json` 授权的全部命令（`src/desktop.rs:1735-1752` 的 `generate_handler!`）：
`product_store_request`(SQLite 产品库)、`product_binary_request/read/write`(托管二进制)、`product_media_preview/release`、`workspace_request/cancel`(分镜 workspace worker，独立线程 `worker.rs`)、`authorize_http_origin`、`product_save_begin/chunk/finish/cancel`(保存到磁盘)、`product_print_storyboard`、`product_open_external`；插件仅 `dialog`、`http`(2.8.2 vendored 补丁)、`opener`(`desktop.rs:1666-1674`)。
- Cargo 依赖（`Cargo.toml`）：rusqlite(bundled)、serde、sha2、uuid、tauri、plugin-dialog/http/opener。**没有** tokio 直接依赖、没有 `tauri-plugin-shell`/`fs`/`notification`/`process`/`updater`/`autostart`/tray。
- 没有后台常驻：`on_window_event` 仅在 `Destroyed` 时关闭 saves/产品库(`desktop.rs:1716-1721`)；无 `CloseRequested` 拦截、无托盘。窗口关闭 = 进程/WebView 终止。
- HTTP：JS 经 `@tauri-apps/plugin-http` 在 WebView 里发起，原生执行，**绕过 WebView CORS 但不绕过应用策略**（`.trellis/spec/frontend/native-product-runtime.md:142`）；每个 origin 需先 `authorize_http_origin`（上限 128，`runtime_services.rs:107-134`），应用策略 `authorizeRuntimeHttp`(`runtimeHttpPolicy.ts`) 仅放行"已配置连接 origin + api.tavily.com + 结果下载(GET 无鉴权)"，其他一律拒绝（"网络请求地址不属于当前连接配置"）。
- CSP：`connect-src ipc: http://ipc.localhost 'self'`，WebView 自身不可直连外网（`tauri.conf.json`）。
- 运行时开关：`isTauriRuntime()`(`runtimeIdentity.ts`)；`runtimeFetchFor`(`runtimeFetch.ts`) 在原生下用 plugin-http，网页下用 `fetch`。规范称两种 owner 下 "no owner-dependent reduced feature gate"（`native-product-runtime.md:120-121`）。

### 2.2 逐条判断

| # | 浏览器时代限制/变通 | 证据 | 桌面端可否移除/改善 |
|---|---|---|---|
| 1 | 页面关闭则执行中断；`pagehide` 即 abort 所有请求 | `AgentChatPage.tsx:106-111`、`runtimeFetch.ts:17-22` | **目前未改变**：Agent 循环仍在 WebView JS，关窗即死。可改善的前提：把循环移到 Rust（需新增 HTTP SSE 客户端 + 工具执行层，当前 Rust 无 tokio/reqwest 依赖，仅 plugin-http 的传递依赖）。仅"最小化到托盘/拦截 CloseRequested 保持 WebView 存活"属低成本折中（需新增 window 事件处理，当前没有）。 |
| 2 | 无后台续跑；恢复只会标记 `interrupted`，需用户手动继续 | `agentRuns.ts:242-272`、`AgentChatPage.tsx:180-187` | **未改变**。数据层已具备持久化断点（每 checkpoint 落库、工具状态机、`unknown` 结果保守），因此"重启后自动续跑"在数据上可行，但当前策略故意不自动续跑（避免付费重复提交）。 |
| 3 | Web Locks 跨页面互斥，缺失则 fail-closed | `runOwnership.ts:13-26` | 桌面为单 `main` 窗口（`tauri.conf.json` windows 仅 1 个、`create:false` 由 setup 创建一个），多页面竞争场景基本不存在，但锁仍在用（规范要求保留，且"实际打包锁排他性需证明" `native-product-runtime.md:134`）。若运行时移到 Rust，需要对应的原生互斥。 |
| 4 | 搜索/抓取受 CORS：Tavily 无鉴权 POST 401 无 CORS 头，错误文案提示"网络或跨域限制" | `tavily.ts:70`、`.trellis/spec/frontend/agent-web-research.md:36,51` | **已部分解除**：原生 HTTP 绕过 CORS，Tavily 可直连（`runtimeFetch.ts`）。但仍：(a) 仅 Tavily 一家、需用户自备 Key；(b) `web_read` 依赖 Tavily extract，没有本地抓取/渲染；(c) 应用策略不允许任意域名请求（`runtimeHttpPolicy.ts` `configuredOrigins`），故无通用"抓任意 URL"能力。 |
| 5 | 只有 Tavily；无内置免 Key 搜索 | `webTools.ts:56`、`skills.ts` web-research | 桌面端**可新增**（原生 HTTP 无 CORS），但需要扩展 `authorizeRuntimeHttp` 白名单与新增搜索连接定义。当前未做。 |
| 6 | 无本机文件/进程能力：不能读写用户文件、跑命令、调用本地工具 | capabilities 无 fs/shell；工具清单无此类 | **桌面端可做但目前完全缺失**（需新增 Rust 命令或插件 + 权限 + 审批 UI）。现有 `product_save_*` 只做"导出到用户选的路径"，`dialog` 插件只用于选择，音频/录音注释写"不能启动麦克风或文件选择器"（`skills.ts` audio-production 指令）。 |
| 7 | 存储：IndexedDB 配额/可驱逐 -> 桌面 SQLite | `native-product-runtime.md:116-125`、`database.rs`、`full_product_store/` | **已解除**：SQLite 产品库 + 托管二进制 + 事务（"One explicit ProductStore transaction commits Agent business writes and tool result atomically"）。Agent 代码走 `ProductStore` 抽象，两种 owner 共用。 |
| 8 | 无法直接保存/导出文件（浏览器下载） | `product_save_*` | **已改善**（分块写盘）。 |
| 9 | 通知/提醒：长任务完成无系统通知 | grep `Notification` 无命中；无 notification 插件 | **缺失**，桌面端可加（需 `tauri-plugin-notification`）。 |
| 10 | 打开外链/打印 | `product_open_external`、`product_print_storyboard` | 已有（原生）。 |
| 11 | 自动更新 / 开机自启 / 托盘 | Cargo 无 updater/autostart/tray | 缺失（`bundle.targets: ["app"]`）。与后台执行相关，非 Agent 本体。 |
| 12 | 并发网络：上传槽 2、重定向 5、连接超时 30s | `runtimeFetch.ts:6-8` | 为策略值，非浏览器限制，保留。 |
| 13 | 模型请求无 CORS 问题 | 通过 `runtimeFetchFor("configured")` | 桌面已可直连任意"已配置"提供商；网页版仍受提供商 CORS 影响（`ai-connectors.md:127` 提及 schema CORS）。 |

---

## 3. 与 Claude Code / ChatGPT 的能力差距矩阵

状态：已有 / 部分 / 缺失。**"对标行为"列为凭知识推断**，不是对产品当前版本的核验；"Cuepoint 现状"列来自上文代码证据。

| 维度 | Cuepoint 现状（有证据） | 对标（推断） | 状态 |
|---|---|---|---|
| 流式体验 | SSE 增量 + 每 checkpoint 落库；两种协议；首 token/用量指标（`runChat.ts:288-303`） | 逐 token 流式、可随时 Esc/停止 | 已有 |
| 思考展示 | reasoning 单独累计+耗时，`ThinkingPanel`/`ThinkingMatrix`；`reasoningEffort` 可选 | 可折叠思考块 | 已有 |
| 工具调用展示 | `AgentRunDetails.tsx`、`AgentWriteOutcomes.tsx`、预览 `prepare`、写入回执 `writeReceipt`、`runPresentation.ts` | 逐工具卡片、参数/结果展开、diff 预览 | 已有（偏业务化，非通用） |
| 计划/待办 | `update_run_plan`（≤30 项、状态三态），`TaskBoard` 业务任务，任务记录/收尾 | TodoWrite 式待办、Plan 模式（先计划后批准） | 部分（有待办，无独立"计划模式先批准再执行"；`interactionMode` 存在但需另核） |
| 并行/子代理 | 工具串行；无子代理；批量生成 2 并发（付费 TTS） | 并行工具调用；Task/子代理隔离上下文并行研究 | 缺失 |
| 长任务后台运行 | 关窗即停；仅标记 interrupted，手动继续；无通知 | Claude Code 后台任务/ChatGPT 云端 Agent 后台完成并通知 | 缺失 |
| 会话恢复 | 持久化 run/步骤/工具；`resumeChatRun`；中断后保守不重跑；跨重启保留 | `--resume`、会话列表 | 已有（手动，保守） |
| 上下文管理 | 预算 + 自动摘要压缩 + 历史条数策略 + 用量面板 + 记忆注入 + 按需工具加载 | auto-compact、/compact、CLAUDE.md 记忆 | 已有（不压缩单轮巨型工具结果；无用户手动 /compact 命令需另核） |
| 权限模型 | 3 档全局模式 + 工具 effect/highRisk + `requiresConfirmation` 强制确认；run 冻结模式；`unknown` 结果不重跑 | 按工具/路径/命令的 allow/deny 规则、"总是允许"、沙箱 | 部分（粗粒度但审计严格） |
| MCP / 技能扩展 | 内置技能（代码常量）+ 内置工具；无用户技能、无 MCP | MCP 服务器、SKILL.md、hooks、插件 | 缺失 |
| 附件/多模态 | 文档/图片参考资料（`referenceWire.ts`，≤10 张图，需视觉模型）、`read_project_image`、文档解析 docx/pdf（`src/lib/references/`）；音频仅元信息不"听" | 图片/PDF/文件附件、语音输入、联网 | 部分（图+文档有；音频/视频理解无） |
| 联网 | Tavily 单家 search/extract，需 Key，逐次审批 | 内置搜索/抓取 | 部分 |
| 本机文件/命令 | 无 | Claude Code 核心能力（读写文件、Bash） | 缺失（对创作产品未必需要，但桌面具备条件） |
| 模型自动重试/错误恢复 | 无自动重试（单次 POST） | 429/5xx 退避重试、流中断续传 | 缺失 |

---

## 4. 候选方向（按 价值/成本 排序）

> 以下按任务要求给出，属于调研结论而非实现建议；估算为推断。

1. **模型请求自动重试与流中断恢复（价值中高 / 成本低）**
   - 内容：对 429/5xx/网络断开在 `chatStream.ts`/`responsesStream.ts` 层做有界退避重试；仅在"尚未收到任何 token 且无工具副作用"时重发。
   - 依赖：`transport` 调用点(`runChat.ts:288`)、`recordAgentModelMetrics`；不涉及 Rust。
   - 风险：付费/计费重复（模型调用通常按 token 计费，需限制次数并在 UI 标注）；与 "One POST per attempt" 现有规范(`agent-execution.md`)冲突，需先改规范；流中已有部分内容时不可盲目重放。

2. **窗口关闭保活 + 系统通知，使长任务可在窗口隐藏后继续（价值高 / 成本中）**
   - 内容：拦截 `CloseRequested` 改为隐藏窗口(macOS 红灯关闭仅隐藏)+ 托盘；`pagehide` 不再在隐藏时 abort；完成/待审批时发系统通知。
   - 依赖：新增 `tauri-plugin-notification` 与托盘特性（Cargo/capabilities 需改）；`runtimeFetch.ts:17-22` 的 pagehide abort 需区分"隐藏"与"销毁"；`AgentChatPage.tsx:106-111` 的 `pause`。
   - 风险：WebView 隐藏后 JS 定时器/网络可能被系统节流（macOS WKWebView 后台节流需实测）；真正退出仍丢任务；规范要求"actual packaged lock exclusivity needs proof"。

3. **并行只读工具调用（价值中 / 成本中低）**
   - 内容：同一轮中 `effect === "read"` 的工具并发执行（`executePendingTools` L167 循环），写/网络/记账串行。
   - 依赖：`runChat.ts` 执行阶段、`transitionToolCall` 的并发安全（Dexie/SQLite 事务）、`AgentToolContext.store`；`toolMetadataMatches` 等校验不变。
   - 风险：现有设计强调顺序与"unknown 不重跑"的确定性；并发下 abort/错误归因与 `markRunningToolsUnknown` 语义需重新证明；某些工具（如 `load_tool_groups`、`task_*` 带 revision）存在顺序依赖，需按 effect + 白名单限定。

4. **扩展联网能力：内置免 Key 搜索/本地网页抓取（价值中 / 成本中）**
   - 内容：利用原生 HTTP 无 CORS 增加备选搜索源与本地正文抽取，减少对 Tavily Key 的依赖。
   - 依赖：`runtimeHttpPolicy.ts` 白名单(`configuredOrigins`)、`searchConnections` 配置、`webTools.ts`、`tavily.ts` 类似适配层；`authorize_http_origin` 上限 128。
   - 风险：应用策略当前刻意禁止任意域名（SSRF/数据外泄边界），放开需新的审批与不可信内容规则；抓取合规与反爬；网页版（无原生 HTTP）需降级，规范要求两 owner 无功能门控（`native-product-runtime.md:120`）。

5. **用户可扩展的技能/MCP（价值高 / 成本高）**
   - 内容：从本地目录加载 SKILL.md 式技能；通过 Rust 启动本地 MCP(stdio) 或连接远程 MCP(HTTP)。
   - 依赖：新增 `shell`/子进程插件或自写 Rust 命令（当前不存在）、capabilities 权限、`AGENT_SKILLS`(`skills.ts`) 静态结构改为动态、`toolLoading.ts` 的冻结模型（"Freeze descriptions, instructions and permission-filtered names at run creation" L19）、审批/风险分类（外部工具无 effect 元数据）。
   - 风险：安全面最大（任意进程/任意工具）；工具定义需 zod/JSON schema 且 `toolMetadataMatches` 要求代码拥有的定义——外部工具与此"code-owned definition"不变式冲突；CSP/ACL 需重审；仅桌面可用，需 UI 说明。

（未列入但相关：子代理/并行代理——依赖运行时迁移或多 run 并发，现有 "每线程一个 Web Lock + 一个活动 run"(`runOwnership.ts`、`requireLatestRun`) 的架构强假设使其成本高；本机文件/Shell 工具——桌面具备条件但与创作产品定位关系需另行确认。）

---

## Related Specs

- `.trellis/spec/frontend/agent-execution.md` — 执行协议、Web Lock、重试规则
- `.trellis/spec/frontend/native-product-runtime.md` — 桌面产品运行时、HTTP 范围、锁、"no owner-dependent reduced feature gate"
- `.trellis/spec/frontend/agent-tools.md`、`agent-context.md`、`agent-web-research.md`、`agent-creative-skills.md`、`agent-batch-generation.md`
- `.trellis/spec/frontend/desktop-distribution.md`、`desktop-ui.md`

## Caveats / Not Found

- 未核实：`interactionMode`（plan/execute）的确切语义、是否存在手动 `/compact`、UI 层审批卡片的完整行为；未逐个阅读 `*Tools.ts` 业务工具实现。
- 未运行应用；"WKWebView 隐藏后 JS 是否被节流"、"打包后 Web Lock 行为"均为未验证。
- Rust 侧未发现任何 Agent/LLM/子进程相关代码（grep `tauri::command` 仅上述 15 个命令 + acceptance）。
- 第 3 节"对标"列是凭知识的推断，未联网核验 Claude Code/ChatGPT 最新版本。
- 部分 `runChat.ts` 行号为近似范围（标注 `~`）；精确锚点：L48(createRunWriter)、L108/L167(工具循环)、L185(execute)、L232/L239(resume/execute)、L266(while)、L288(transport)、L342(catch)。
