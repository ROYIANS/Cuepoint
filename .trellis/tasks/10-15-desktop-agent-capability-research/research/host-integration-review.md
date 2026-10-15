# Research: Desktop Agent host integration — critical review

- Query: 复核 Cuepoint 是否已有脱离 UI 的 Agent 执行宿主；比较复用 neutral core/providers 后新增宿主、仅增加 Rust 工具，以及接入 DeepSeek Harness worker 的条件和限制。
- Scope: internal — 只读比较两个本地仓库；不选择开发架构或默认权限。
- Date: 2026-10-15
- Baselines supplied by the parent task: Cuepoint `9d1a41739b17be27cf832326de15a9489017825a`; DeepSeek Harness `571902028a75c64c1d767f4ae5fd099485f0ddf0` / `0.2.1-alpha.3`。
- Source notation: `C:` = `/Users/xiaomengdao/WebstormProjects/aifenjing/`; `D:` = `/Users/xiaomengdao/WebstormProjects/deepseek-harness/`。以下 `path:line` 均相对对应根目录。
- Method: 阅读双方 AGENTS、任务 PRD、相关 specs、组合配置和实现。未运行应用、安装依赖、调用模型/API、激活任务、执行 Git 操作或修改产品。本文是源码复核，不是后台运行、真实沙箱或打包平台验收。

## Findings

### Verdict

**“复用 Cuepoint 的 core/providers，按需求扩展宿主”在源码结构上可行；“当前 Tauri 产品已能独立于 UI 跑 Agent”不成立。** 独立执行算法已经抽出；当前产品的执行所有权、存储接入、上下文和素材取用仍由 Studio 绑定。增加 Rust 文件/进程工具可以扩展能力，但不会自行改变 React/WebView 所拥有的模型循环生命周期。新增 Node sidecar 也不会自动获得持续运行、重启恢复或业务原子性；这些保证来自明确的宿主和交易设计。

这是可行性判断，不是选型结论。若目标只是当前窗口中的创作操作，Rust 工具桥可能足够；若目标是切换页面后持续模型推理，需要独立持有 JS 核心循环的运行环境；若目标包括退出应用后执行，则还需要应用之外的运行/唤醒机制，现有两个桌面实现都不能仅凭持久化记录作此承诺。

### Files found — limited to the decisions under review

| Files | Role |
| --- | --- |
| `C:packages/agent-core/src/runtime.ts` | 真正的模型/工具循环、宿主接口、已确认和未知结果语义。 |
| `C:packages/agent-providers/package.json`; `src/chatCompletions.ts`; `src/responses.ts` | 独立 ESM 协议包；传输与素材由宿主注入。 |
| `C:packages/studio/src/features/agent/runtime/runChat.ts`; `runOwnership.ts` | ProductStore 宿主绑定及实际 Web Lock 生命周期。 |
| `C:packages/studio/src/features/agent/ui/useChatExecutionSession.ts`; `chatExecutionFlows.ts` | React 持有取消控制器、开始/恢复执行的入口。 |
| `C:packages/studio/src/features/agent/providers/referenceWire.ts`; `runtime/runCredentials.ts` | 产品素材、当前密钥、项目归属检查。 |
| `C:packages/studio/src/platform/product/store.ts`; `storage/native.ts`; `runtime/runtimeFetch.ts` | 固定存储 owner、原生事务适配、页面所拥有的 HTTP 等待。 |
| `C:packages/studio/src/features/agent/commands/agentTools.ts`; `features/video/agent/businessTools.ts` | 业务变化、写入证据和原始完成结果的同一事务。 |
| `C:apps/desktop/src-tauri/src/desktop.rs`; `worker.rs`; `capabilities/main.json` | 现有 Rust 原生服务与存储线程；closed IPC 权限。 |
| `C:examples/agent-todo/src/host.ts`; `store.ts` | 同一个 core 的独立 Node/SQLite 消费者；模型结果为确定性场景，不是生产 Agent sidecar。 |
| `D:packages/bundle/base/cordis.patch.yml`; `web-app/cordis.patch.yml`; `web-app/presets/standard.patch.yml` | 默认服务与按 preset 启用的工具，避免把目录清单当作全部默认可用。 |
| `D:packages/fs/fs-sandbox/src/index.ts`; `docs/subsystems/sandbox.md` | 仅写入政策约束、读取范围与进程沙箱的实际定义。 |
| `D:packages/jobs/jobs-local/src/index.ts`; `packages/schedule/schedule/src/runtime.ts` | 内存任务、持久化提醒、Host timer 和投递确认顺序。 |
| `D:packages/mcp/mcp-client/src/{index,transport,tools}.ts`; `package.json` | Cordis MCP 桥、SDK stdio 启动路径与依赖关系。 |
| `D:apps/desktop/src/host-process.ts`; `apps/desktop-host/src/index.ts` | Electron 启动独立 Node-mode Host 及停止它的通道。 |
| `D:packages/sdk/client/README.md`; `src/api.ts`; `src/client.ts`; `packages/bundle/sdk-minimal/README.md` | 外部 worker 的 wire 取消/审批/结果归属限制，及 minimal profile 的实际省略项。 |
| `D:packages/experimental/README.md`; browser/CUA provider READMEs | 可选和实验状态、会话资源和平台权限限制。 |

### 1. Cuepoint: execution independence has two distinct meanings

| Question | Observed fact | Source anchors |
| --- | --- | --- |
| 算法能否脱离 React？ | 能。`executeRun` 只接收 typed `RuntimeHost`；所有权、持久化、一次模型请求、工具能力和结算由端口提供。核心本身不要求 `navigator` 或 ProductStore。 | `C:packages/agent-core/src/runtime.ts:30`; `C:.trellis/spec/agent-core/library/runtime.md:52` |
| 是否已有独立消费者？ | 有。todo 示例用 Node/SQLite 调用同一个 `executeRun`。但 `request` 是按 scenario 构造的确定性模型响应，不能拿它当作真实后台推理或完整 Studio 产品宿主。 | `C:examples/agent-todo/src/host.ts:15`, `:32`, `:94`; `store.ts:24` |
| 当前产品由谁启动和持有运行？ | 发送流程在页面取得 thread lock、建立 run，然后等待 `executeChatRun`；React hook 持有 AbortController，卸载或 thread 变化会 abort。 | `C:packages/studio/src/features/agent/ui/chatExecutionFlows.ts:93`, `:123`; `useChatExecutionSession.ts:10`, `:19` |
| 锁是否可以直接搬到 Node？ | 当前默认读取 `navigator.locks`，缺失即失败。私有 WeakMap capability 只在持锁 callback 内有效；callback 结束会等待执行，然后使 capability 失效。它不是可跨进程传递的授权 token。 | `C:packages/studio/src/features/agent/runtime/runOwnership.ts:13`, `:20`, `:46` |
| 重开时是否自动继续推理？ | 恢复取得可用锁后调用 abandoned-batch 修复和 `interruptThreadRuns`；它没有启动模型循环。显式 `resumeChatRun` 才恢复执行。 | `C:packages/studio/src/features/agent/runtime/runOwnership.ts:75`; `runChat.ts:120` |
| Rust HTTP 是否让循环脱离页面？ | 否。原生网络 transport 仍由 JS 发起；`runtimeFetch` 在 `pagehide` / `beforeunload` abort 所跟踪的 native controllers。Rust 中等待一个 HTTP body 不等于 Rust 拥有后续模型/工具循环。 | `C:packages/studio/src/platform/runtime/runtimeFetch.ts:18`, `:150` |
| `StorageWorker` 是否就是 Agent worker？ | 否。ProductBridge 缓存 `StorageWorker`，Tauri command 把存储请求送到它；窗口 Destroyed 时 `close_product` 会关闭它。setup 中的后台 reaper 只清理保存会话。没有已注册 Agent 执行命令。 | `C:apps/desktop/src-tauri/src/desktop.rs:24`, `:91`, `:1683`, `:1716`, `:1761` |
| Tauri capability 是否已经允许任意本机工具？ | 当前 main allowlist 是 closed product store/binary/media/workspace、HTTP origin 授权、Save/Print/Open 等命令。没有通用 shell/任意 fs/MCP/sidecar invoke。Rust 可以新增实现与入口，但这是产品权限和实现工作。 | `C:apps/desktop/src-tauri/capabilities/main.json:8`; `src/desktop.rs:1761`; `Cargo.toml:36` |

**Inference:** core 的可移植性已经解决了“无需再写一套循环”的问题；它没有解决产品跨页面、跨进程的 owner 问题。不能只删除页面 abort 或用 timeout 认定旧 owner 已死：现有产品无通用 durable owner/revision 字段，旧页面与新宿主可能同时持有可写引用。新宿主需获得统一、实际可排他的所有权，并让 UI 成为命令发送者和状态订阅者。此为架构要求推论，尚无产品实现。

最小化、隐藏窗口的行为也应分开验收：源码证明卸载/导航的取消路径，不能据此声称每种 OS 的隐藏 WebView 都会停止，也不能承诺会持续获得调度。

### 2. A new host must adapt the product bindings, not merely import two packages

`createStudioRuntimeHost` 当前是文件内函数，并不是可直接在外部 Node 进程启动的公开产品宿主。它绑定 `ProductStore`、thread capability、创作工具、素材和当前设置。`@cuepoint/studio` 也没有导出一个生产后台 Agent host；其公开入口主要是 bootstrap 和明确 reference 路径。来源：`C:packages/studio/src/features/agent/runtime/runChat.ts:33`; `C:packages/studio/package.json:6`。

| Binding needing an explicit host decision | Current owner / behavior | Consequence for a non-UI host |
| --- | --- | --- |
| 执行所有权与 admission | `runOwnership.ts:46`; `runChat.ts:37`, `:92` | 替换或桥接实际锁机制；UI 和后台必须使用同一 owner。仅把 browser lock “对应”为进程内 mutex 会留下跨进程竞争。 |
| run/message/call ledger 和终态 | `runChat.ts:48`–`:103` 调用现有命令；`agentTools.ts:322` 使用唯一终态 writer | 必须继续由产品原始命令验证并提交；另建 sidecar database 不会自动与产品事务一致。 |
| 固定 ProductStore 及原生 transport | `platform/product/store.ts:12` 导入 `@tauri-apps/api/core`，以 `invoke` 构造 driver；`:31` 固定启动 owner | Node 不能把 renderer 的 `invoke` 当本机 transport。需有同一 Rust owner 的受控 IPC 或其它明确方案；不应绕开 worker 直接再开产品 SQLite 文件。 |
| 原生交易确定性 | `platform/storage/native.ts` 的 bridge/transaction 机制；`shared-product-storage.md:151` | 保留 operation identity、durable outcome 查询和 unknown certainty。RPC 超时/连接断开不能自动分类为 rollback。 |
| 当前 credentials 与冻结 connector identity | `runtime/runCredentials.ts:7`；`runChat.ts:65` | 每次主/辅助请求解析当前 key；传递一次初始 key 或将 key 保存在任务快照中会改变当前保证。 |
| 项目/记忆/工具目录与压缩 | `runChat.ts:54`; `contextCompaction.ts:79`; `toolDefinition.ts:6` | 明确产品 context source、scope、summary activation 和工具绑定；不能把 Studio entity/schema 加入 neutral core。 |
| 图片/素材 materialization | `providers/referenceWire.ts:20`：活跃 run/thread/project 检查、最多十张、vision 校验、素材解析、binary read lease；`:53` 在编码后重验 | Node/独立 JS host 需要对应 binary transport 和来源/撤回检查。仅把数据库记录转成 URL 会丢失产品保证。该文件直接导入产品 `db`，并不是纯协议函数。 |
| HTTP 和重定向授权 | `providers/chatStream.ts:26`; `platform/runtime/runtimeFetch.ts:150`; `native-product-runtime.md:145` | providers 接受 `fetchImpl`，但新 transport 仍需明确产品 origin/purpose、密钥、重定向和取消政策。Node global fetch 不是现有产品授权的等价替代。 |
| 预览、付费确认、业务草稿/证据 | `runChat.ts:25`; `commands/agentTools.ts:360`; `features/video/agent/businessTools.ts:300` | UI 可展示并提交决定，执行 owner 必须在领取时重新验证精确参数、preview revision 和 approval；产品命令仍负责业务变化和证据。 |
| 进度和重连 | `agent-core/src/runtime.ts:21` | `output` 是 provisional，checkpoint/tool completion/settled 只有提交确认后才成立。`sequence` 是一次调用内计数，不是跨重启 durable cursor。新宿主还需订阅/重放设计；不能只转发内存事件。 |

以上是**适配责任清单**，不是要求一次把所有 Studio 代码搬出。可用受控 product bridge 保留部分产品责任；是否需要独立、可测试的产品执行包，取决于最终宿主生命周期。主线程 Node runtime、Worker、嵌入式 JS engine 或独立 sidecar 都不能跳过这些责任。

### 3. Rust-only tools versus a JS/Node host: conditional options

| Option — proposal only | What it can meet | Cost / unresolved guarantee |
| --- | --- | --- |
| A. 保留当前循环，添加 closed Rust fs/process/MCP 工具桥 | 当前窗口内导入、扫描、外部命令、素材处理；无须 Node 才能实现原生文件或进程能力。MCP 也不在协议上要求 Node，具体客户端实现待单独研究。 | 最小宿主变动；循环仍随页面生命周期。必须自行定义 grants、process cancellation、输出上限、MCP policy。Tauri ACL 仅约束前端能调用哪些命令，不能代替被启动程序的 OS confinement。 |
| B. 移到独立 JS 宿主，原生能力留在 Rust | 持续调用同一个 `@cuepoint/agent-core` / providers，并在 UI 导航后继续；可选在 app 内独立 JS runtime/worker/隐藏 WebView。 | 无须预先决定 Node sidecar。但要明确该执行环境在窗口销毁、刷新、app quit 时的存活条件、支持的 Web APIs 和 transport。隐藏 WebView/Worker 本身不是重启持久执行机制。 |
| C. 新 Node sidecar 使用 Cuepoint core/providers，Rust 保持产品存储 owner | 与现有 ESM core、provider transport 和 Node 生态 SDK 接近；stdio MCP/工具进程较容易接入。 | 增加 runtime 分发、IPC/认证、崩溃恢复、日志和版本配对；需要真正可离开 renderer 的 product bridge。子进程仍与 app manager 生命周期相关；重启恢复必须依据 durable run/intent 实现。 |
| D. 外部 DSH worker 执行一个有界子任务，Cuepoint 管产品提交 | 采用明确 profile 和额外配置后可利用 coding、Skill、MCP 等机制；通过显式任务/结果桥交互，worker 是另一个执行主体。 | DSH 有自己的 Session、loop、工具和存储。其“完成”不能直接改为 Cuepoint 业务成功。SDK 并不直接提供完整 Web Host 能力：没有单轮 cancel/审批回调，也无按单条 prompt 因果归属的 finalResponse；详见下文。scope、证据、取消、未知效果和重启关联均需桥接。 |
| E. Rust 实现整个模型循环 | 原生单进程也可以承载循环。 | 当前 core/providers 是 JS/ESM，实现 Rust 循环不是直接复用它们；需嵌入 JS 或承担第二套执行/协议语义维护。与任务既有的单核心复用约束存在冲突，不宜称为简单适配。 |

**Recommendation, conditional:** 先以“页面导航后继续 / 关闭窗口后继续 / app quit 后继续 / 机器重启后继续”四种可观测生命周期选择第一项验收，再比较 B/C/D。若需求仅是当前窗口本机工具，A 可以单独成立。若要直接复用 DSH Node 插件，Node 环境和 Cordis composition 的成本必须纳入；若只是希望 MCP 能力，不必因此先选择整套 DSH 或 Node。

### 4. DeepSeek Harness: default, optional and experimental are separate axes

| Capability | Observed composition | Actual limit relevant to integration |
| --- | --- | --- |
| Node Host | Electron 用 `spawn` 启动独立 Node-mode child，child 以 `runProfile` 加载 desktop/Web composition。`D:apps/desktop/src/host-process.ts:186`; `apps/desktop-host/src/index.ts:18` | 相比 renderer loop，执行位置确实不同。但 child 收到 shutdown 或 IPC disconnect 会执行 stop；这是应用所管理的 Host，不能推导为 app quit 后的 daemon。`apps/desktop-host/src/index.ts:52`, `:91` |
| 本机 fs / shell / approval | base 默认配置 subprocess-local、sandbox-local、sandbox-policy、bash/pwsh sandbox、fs-sandbox 和 user-approval；环境未覆盖时是 workspace-write + ask。`D:packages/bundle/base/cordis.patch.yml:234` | 权限政策、后端有效性和平台完整度是不同保证；不能翻译为“所有操作都在项目目录沙箱内”。 |
| jobs-local | base 挂载 registry；standard preset 挂载 tool-jobs。`D:packages/bundle/base/cordis.patch.yml:96`; `web-app/presets/standard.patch.yml:33` | `Map` 存活记录和 bounded ring 都在进程内，owner/service dispose 取消任务。历史 session events 可以留存，但没有 live job/output ring 的重启恢复。`packages/jobs/jobs-local/src/index.ts:162`, `:193`; `README.md:57`, `:144` |
| schedule | Web composition 挂载 Host service，standard preset 挂载管理工具。`D:packages/bundle/web-app/cordis.patch.yml:139`; `web-app/presets/standard.patch.yml:35` | Host 必须运行；不单独适用于 headless / SDK-only composition，因为依赖 sessionController 和 persistence。它投递提醒，不保证模型执行成功。`packages/schedule/schedule/README.md:26`; `src/index.ts:99` |
| MCP | 有维护中的 MCP client 桥，按 server 实例配置 stdio 或 Streamable HTTP。base 的 `mcp-resources` 不是自动连接所有 MCP servers。`D:packages/mcp/mcp-client/src/index.ts:1`; `packages/bundle/base/cordis.patch.yml:485` | 实际 server、凭据、发现的工具和资源权限取决于显式实例；不能因包存在而宣称默认启用外部 MCP 服务。 |
| Browser/computer use | service definitions 位于 browser-use / computer-use；具体 Playwright、Chrome DevTools、Stagehand、macOS/Cua Driver providers 在 experimental 组。`D:packages/experimental/README.md:69`; `scripts/product-package-policy.ts:19` | Optional 是选择方式，Experimental 是成熟度承诺，Official 只是维护/列表归属。浏览器 sidebar 也不等于模型拥有 browser-use provider。`packages/experimental/README.md:24` |

关键约束的源码确认：

- **SandboxMode 只定义文件效果，network/process visibility 在词汇之外。** `D:docs/subsystems/sandbox.md:11`、`:30` 明确 full/partial；Windows 和旧 Landlock ABI 存在 partial 情况。`read-only` 因而不能解读为无网络、无外部命令、不可读主机敏感文件。
- **默认 fs-sandbox 对读取不加 containment fence。** `D:packages/fs/fs-sandbox/src/index.ts:1`–`:24` 只限制两种 mutation；继承的 local fs 将 cwd 作为路径解析默认值，不是根目录边界：`D:packages/fs/fs-local/src/index.ts:62`。这不表示越过 OS 本身权限，而是没有项目根读取隔离。
- **fs policy check 不是内核沙箱。** fs-sandbox 明确接受所述 ancestor-symlink TOCTOU threat model；执行不可信代码的内核约束是 shell backend 的独立责任。不能把某一个服务的 policy fence 套用到全部插件。来源同上 `fs-sandbox/src/index.ts:10`。
- **MCP stdio 不自动经过 shell/subprocess confinement。** `D:packages/mcp/mcp-client/src/transport.ts:15` 明确 SDK owns actual spawn；实现只共用 `scrubbedParentEnv`，然后建立 `StdioClientTransport`。HTTP transport 连接配置 URL。环境清理并不提供文件或网络隔离。
- **调度记录持久化不等于 exactly-once。** `D:packages/schedule/schedule/src/runtime.ts:122` 先 `followup` 和 session flush，再分别 commit reminder row。崩溃或 teardown 窗口可以重复投递。失败任务被排除当前自动 timer，无通用 retry timer；管理操作、另一个 wake 或 restart 可再次触发。`runtime.ts:143`; `README.md:153`。
- **浏览器/桌面状态不随 Session transcript 完整恢复。** Playwright provider 需要显式 mount、Agent/session 资源管理；resume 重新启动 browser runtime，不恢复 cookies/pages。`D:packages/experimental/browser-use-playwright-mcp/README.md:28`, `:60`。Cua native provider 同进程 native crash 可结束 Host，OS 权限由启动应用持有；取消不撤回已送达的输入。`computer-use-cua-driver-native/README.md:41`, `:61`。

外部 DSH worker 还需选择准确的 **profile 与通信 API**，不能按 Web UI 功能清单描述 SDK 已能完成的事情：

- `sdk` profile 叠加 `dsh-base`，有其完整默认工具和设置机制；但 Host schedule 依赖 Web Session controller，不能因为 `sdk` 使用 base 就当作自动拥有 schedule。`D:packages/bundle/sdk-app/README.md:12`, `:32`; `packages/schedule/schedule/README.md:26`。
- `sdk-minimal` 不叠加 base，明确省略 settings、managed credentials、text file tools、workspace instructions、skills、jobs 和 subagents；默认仅 shell、read_image 和 working_directory，策略为 danger-full-access。不能将“minimal worker”与“已有 Skills/jobs/受限文件访问”同时作为现成假设。`D:packages/bundle/sdk-minimal/README.md:12`, `:81`, `:95`。
- SDK wire **没有 mid-turn cancel**；请求超时后服务端工作仍运行，放弃需关闭 runtime。关闭也不是对已发生外部效果的撤销。`D:packages/sdk/client/README.md:128`; `src/client.ts:176`。
- 低层 `prompt()` 是 enqueue receipt。高层 `run()` 从该 message 的 durable inbox receipt 收集到整 Agent 下一次 idle，取此区间最后一条 committed root-session assistant text 作为 `finalResponse`；steering/其它排队输入可能参与该区间，不能将其视为仅由原 prompt 导致的结果。实现：`D:packages/sdk/client/src/api.ts:200`, `:229`, `:249`; 完整语义：`README.md:52`。
- 两端未实现 client→server notifications 或 server→client requests；现有 SDK wire 不能直接承载未来审批请求。Cuepoint 现有精确 generation review/approval 不能靠直接接入 SDK 自动获得。`D:packages/sdk/client/README.md:130`。
- 因而“外部 worker”必须在评估阶段具体写出采用 `sdk` 还是自定义 Web/API/profile、如何限制并发 steering、如何交付 approvals、关闭哪一个 runtime 来停止哪个任务。若这些需求需要扩展协议，应作为新增工作和不确定性，而不是现成能力。

### 5. Importing mechanisms or dependencies: what remains Cordis-bound

| Candidate | Source-backed dependency observation | Integration implication — recommendation, not implementation |
| --- | --- | --- |
| `dsh-mcp-client` | `src/index.ts:16` 导入 Cordis Context；`:33` inject tools；`tools.ts:113` / `:150` 向 `ctx.tools` 注册；manifest `package.json:28` 声明 Cordis、scope、subprocess、tools、llm、attachment 等 peers。 | 作为完整插件采用意味着提供兼容 Cordis service/lifecycle graph；不能把它当一个只返回 Cuepoint `ToolDefinition` 的通用 SDK。 |
| `dsh-jobs-local` | `src/index.ts:183` 接收 Context 并注册 effect teardown；manifest 声明 agents/scope/jobs/timeout/Cordis peers。 | 复用 registry 不是复制一个 Map；owner/disposal/notice 生命周期与 Agent graph 相关。Cuepoint 新宿主可借鉴 semantics，直接依赖需承担对应 runtime。 |
| `dsh-schedule` | `src/index.ts:99` 的 inject 包含 agents/sessions/storageDomain/sessionController/sessionPersistence；`:125` 打开 domain。 | 提取 timer 算法不足以获得原来的 Session 恢复、投递和 durable management；把这些依赖伪装为一个“scheduler adapter”会隐藏真实工作量。 |
| fs/sandbox plugins | `fs-sandbox/src/index.ts:29` 引入 Context 并继承 local service；shell sandbox 还需匹配 subprocess/provider。 | 需要当前 host 的 files/process world、policy owner 和 backend；不能将单个包加载等同所有工具受同一约束。 |
| Underlying protocol dependency | DSH MCP manifest 钉住 `@modelcontextprotocol/client` `2.2.0`，transport 直接使用其 stdio/Streamable HTTP exports。`D:packages/mcp/mcp-client/package.json:40`; `src/transport.ts:9` | 单独评估该协议 SDK 是与导入 Cordis 插件不同的选项，可减少框架引入；仍需 Cuepoint 自己的 catalog/approval/result/materialization/ownership adapter。版本为本地基线事实，未核查线上最新版本。 |
| Small “utility” DSH packages | 即使 `dsh-brand`、`dsh-util-values` 的用途很小，两个 manifest 仍声明 Cordis peer。`D:packages/util/brand/package.json:29`; `packages/util/values/package.json:29` | 不根据文件夹名或纯函数外观推断独立依赖；按包入口及实际依赖闭包评估。没有必要为零散 helpers 引入整个框架。 |

DSH 的公开 APIs 在本地 AGENTS 中明确为 pre-stable。Cuepoint core/providers 也为 private workspace packages，没有公开稳定性承诺。跨仓库直接依赖、vendor 或长期外部 worker 都需版本配对、许可证保留及升级验收；本文不授权其中任一方式。DSH 的有效应用入口是 `dsh` profiles，不应把任意 in-process `ctx.plugin` 拼装误称为已有受支持产品启动方式：`D:docs/architecture.md:41`。

### 6. Preserve Cuepoint product effects, evidence and uncertain outcomes across any bridge

**Observed invariant:** `executeAtomicTool` 的 callback 只能执行本地数据库工作。它在一个 ProductStore transaction 中重新验证 run/call 状态、执行业务动作、序列化有界结果，然后把原始工具 ledger 标记 completed；unknown storage certainty 原样传播。`C:packages/studio/src/features/agent/commands/agentTools.ts:375`–`:404`。

这包括证据，不仅是记录 status。视频业务工具在该 callback 中重新读取 scope/preview revision，写入业务，然后以 `withBusinessWriteReceipt` 合成返回值，最终与 completed ledger 一起提交：`C:packages/studio/src/features/video/agent/businessTools.ts:310`–`:320`。核心看到 `atomic` 后只确认此已提交结果；不会用一个后续事务“补成功”，晚到异常也先读取已完成结果：`C:packages/agent-core/src/runtime.ts:139`–`:170`。

**Bridge requirements — inferred recommendations:**

1. 一个业务改变只能有一个产品交易 owner。worker 返回“成功”、外部 Session append 成功或某条 IPC 消息抵达，都不能替代产品 effects + evidence + original result 的 commit。
2. 最稳妥的业务调用边界是受控 typed command：携带实际 run/call identity、冻结参数和 reviewed preview，由产品 owner 重读权限/归属/版本后完整提交。不要把任意 worker callback 或 SQL 透传给 ProductStore，也不要在外部 DSH database 中另记一个可冒充产品完成的 ledger。
3. 外部 worker 本地文件写入、shell、MCP server 行为、browser clicks 和付费提交属于产品事务外的效果。它们不能置于 `executeAtomicTool` callback 后声称可随数据库 rollback；应持久化 intent/外部任务 identity，区分 not-started、confirmed 和 unknown。
4. 断线/超时/cancel 只说明等待停止，不证明外部动作未发生。已有 paid generation 先持久化 job claim，丢失 submission 确认时进入 unknown：`C:packages/studio/src/features/agent/commands/agentGeneration.ts:8`, `:59`。新外部能力应保持这类语义，不能自动把 unknown 变成可重跑 failure。
5. 调度提醒重复投递还需要业务层的重复 admission/intent 约束；给提醒加持久化记录不能让后续任意外部调用 exactly-once。对产品工具，复用已确认 call result；对外部效果，必须先核实远端状态或要求明确新操作。
6. 两个引擎不能同时拥有同一个 Cuepoint run。如果 DSH 是有界子任务 worker，应明确其完成是外部结果输入，由 Cuepoint 验证后再执行产品动作；若要让它替换主循环，那是额外的核心迁移决策，不能写成“复用现有 core”的同一方案。

### 7. Key tradeoffs for the owner's scope choice

1. **本机工具能力 vs 持续运行生命周期。** Rust tools 可单独实现前者；后者需要移交 loop owner。先定义期望在哪些关闭/导航情形继续，再决定 runtime。
2. **复用 JS core vs 原生单进程。** Node/独立 JS 环境可运行同一 ESM loop；纯 Rust 全循环会增加实现。Node sidecar 则增加分发和跨进程 product bridge 成本。
3. **借鉴机制/协议 SDK vs 采用 Cordis runtime。** 前者适配当前产品，后者获得完整组合但同时引入 Session、services、preset 和 lifecycle 体系。不能仅按包数量衡量收益。
4. **可恢复记录 vs 可恢复执行。** 当前 Cuepoint 恢复到可核实/显式继续；DSH jobs-local 无重启活体恢复，schedule 只能由活 Host 投递且可能重复。更强要求需要另做设计和验收。
5. **工具覆盖面 vs 业务原子证据和外部不确定性。** 通用 shell/MCP/browser 能接触更多对象，但不能复用本地交易的 rollback 承诺。产品变更必须继续走同一命令和证据 owner。

### Related specs

- `C:.trellis/spec/agent-core/library/runtime.md`: 单一实际循环、typed host ports、真实所有权、atomic/unknown/confirmed event 语义。
- `C:.trellis/spec/agent-providers/library/protocols.md`: 显式 transport/materialization、当前 credentials、continuation 原样保留、单次付费 POST。
- `C:.trellis/spec/frontend/agent-execution.md`: Web Locks、导航取消、显式恢复、唯一终态 writer。
- `C:.trellis/spec/frontend/shared-product-storage.md`: 固定一个数据 owner、显式交易上下文、lost commit acknowledgement 和 durable outcome 查询。
- `C:.trellis/spec/frontend/native-product-runtime.md`: 同一 React 产品/业务/Agent、closed 原生服务、HTTP purpose、managed binaries；没有另写 native Agent loop 的授权。
- `C:.trellis/spec/desktop/runtime/index.md`: shared studio/native worker 和各平台真实验收边界。
- `D:AGENTS.md`, `packages/AGENTS.md`, `packages/schedule/AGENTS.md`, `packages/experimental/AGENTS.md`: pre-stable API、profile 启动、服务/生命周期、调度非原子投递与实验能力隔离。

### External references / versions

- 没有访问外部网站；本报告的协议/平台事实来自仓库当前实现及随仓文档，未判断线上最新状态。
- DSH `docs/architecture.md:49` 记录其 Electron + Node-mode Host；Cuepoint `apps/desktop/src-tauri/Cargo.toml` 钉住 Tauri `2.12.2`、HTTP plugin `2.8.2`。版本不等于当前已具备任意工具或后台生命周期。
- DSH MCP manifest 使用 `@modelcontextprotocol/client` `2.2.0`；`dsh-schedule` manifest 使用 `@js-temporal/polyfill` `0.5.1`、`zod` `4.4.3`。这里只记录候选组件的本地版本，没有作安装或兼容性验证。

## Caveats / Not Found

- 基线由任务 PRD/父会话提供；本次遵守不执行 Git 的范围，未独立重读 commit metadata。源码锚点指本次读取的 working-tree 文件。
- 未发现已注册的生产 Agent sidecar/daemon/任意 MCP bridge，或产品跨进程 ownership 实现。缺失判断限于审阅的现有入口、capabilities、host binding 和 package exports；不声称操作系统/第三方工具本身做不到。
- todo 示例证明同核心独立宿主的结构与持久化设计；其确定性 `request` 不提供真实模型侧后台验收。
- 未执行测试、真实窗口生命周期、OS sandbox、MCP server、浏览器/CUA、安装器或跨平台验证；没有沿用“源码存在”“文档声明”推导实测通过。
- 任务目录尚在 planning；本文没有选定 Node sidecar、Rust-only tools、DSH worker、支持平台顺序、默认 grants、迁移或后台自动恢复策略。
- 首条用户消息的乐观展示和 first-token 体验由另一个交互审计负责；新增 Host 不自动解决发送后立即可见的问题。本文只记录新 Host 必须区分 provisional UI 与 durable/confirmed completion。
