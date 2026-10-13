# UI 错误处理与信息收集

状态：规划中。范围与关键决策已由用户确认；最终计划待用户批准后才能 `task.py start`。

## Goal

为应用补充统一的 UI 层错误处理：崩溃时不白屏、错误时友好展示，并在用户主动时提供可导出的诊断信息，方便反馈和排查；诊断信息不泄露密钥与创作内容；不破坏现有的运行所有权、离开确认与草稿保护。

## Background and decisions

- 用户（2026-10-13）：系统似乎没有 UI 层 errorhandler，需要补充，方便遇到错误友好展示以及收集信息。
- 决策 1：诊断信息**只在用户主动时导出**（复制 / 保存为文件 / 打开预填的 GitHub issue）；**不落盘、不自动发送**；不新增服务器、不做自动上报、不做本地持久化错误日志。
- 决策 2：**不批量迁移**现有约 76 处 `toast.error`；只接最关键的几处，其余保持原样，以后逐步迁移。
- 事实基线（research/error-handling-landscape.md，代码事实，未运行验证；路由级 `errorComponent`/`onCatch`/`notFoundComponent` 为推断）：
  - `src/main.tsx` 的 router 与 `createRoot` 均未配置任何错误选项，`__root.tsx` 也没有；全仓库没有 `errorComponent`、`ErrorBoundary`、window `error`/`unhandledrejection` 监听。
  - 已装 TanStack Router 1.170.38 提供 `defaultErrorComponent`、`defaultOnCatch`、`defaultNotFoundComponent`；`CatchBoundary` 导航时按 resetKey 自动清错，`reset()` 重新挂载同一子树。React 19.3 `createRoot` 提供 `onCaughtError`、`onUncaughtError`、`onRecoverableError`。
  - Tauri 侧无 log/clipboard 插件、无 panic hook，仅 15 个命令。可复用：`downloadBlob`/`saveNativeBlob`、`nativeOpenExternalUrl`、`GITHUB_URL`（`src/lib/brand.ts:6`）；写剪贴板无先例且 Tauri 未授权。
  - `redactCredentials`（`src/lib/ai/safeError.ts`）需传入具体 apiKey，全局处理器拿不到；无路径脱敏；`main.tsx` 存储初始化失败页直接显示 `cause.message`，未脱敏。
  - 错误边界重挂载 `AgentChatPage` 会触发 `useChatExecutionSession` 清理（中止当前执行）与 `pagehide` 清理（暂停生成批次），此路径没有 E01/B01 离开确认；`useReferenceDraft` 草稿看似仅在组件状态里；`recoverAbandonedRuns` 会在重挂载后把遗留 running 标为 interrupted。
  - 全局 `unhandledrejection` 必须排除 `AbortError`；开发态 `StrictMode` 会使回调重复触发。

## Requirements

### R1 — 三层兜底，崩溃不白屏

- 路由级：配置 `defaultErrorComponent`，页面渲染出错时只替换当前工作区内容，**全局导航与顶栏保持可用**，用户可切换到其他页面；`defaultNotFoundComponent` 给出友好的"页面不存在"。
- 根级：最外层兜底（连应用外壳都崩溃时），提供「重新加载」与诊断导出，不依赖应用样式之外的任何运行状态。
- 全局：监听 window `error` 与 `unhandledrejection`，并配置 React `onCaughtError`/`onUncaughtError`/`onRecoverableError`；排除 `AbortError`（abort 是正常流程）；对同一错误指纹在短时间内去重（含开发态 StrictMode 重复）。未被边界接住的异步错误以非阻塞方式提示，不替换页面。

### R2 — 友好展示

- 崩溃页面：用一句话说明发生了什么（不含堆栈），给出「重试」（重置当前路由边界）、「回到首页」、「查看详情」。重试前须提示"当前页面内未发送的输入可能丢失"（见 R5）。
- 非崩溃错误：统一出口 `showError({title, cause, ...})`，以 toast 显示友好文案；含诊断价值的错误带「查看详情」动作，打开详情面板。
- 友好文案映射已知错误类别（存储失败的确定性 rollback/unknown、网络/超时、校验失败、用户取消），未知错误给出通用说明；不得向用户显示原始英文堆栈或内部标识作为主文案。
- 使用项目现有 UI 规范与组件（读 component-guidelines.md、desktop-ui.md），不使用 `window.alert`。

### R3 — 诊断信息：只在用户主动时导出

详情面板提供三个动作：复制诊断信息、保存为文件、在 GitHub 反馈（打开预填的 issue，使用 `nativeOpenExternalUrl`）。
- 包含：应用版本、运行环境（浏览器/桌面）、平台与架构、当前路由（脱敏后的路径）、错误名与脱敏后的消息和栈、时间、内存中最近至多 30 条非敏感操作记录（面包屑：路由切换、已命名的用户操作名，不含内容）。
- 排除：API Key 与 Authorization 内容、提示词与创作内容（消息、剧本、素材文本）、完整工具参数与结果、含凭据或令牌的 URL（去掉用户信息与查询串）、本地路径中的用户名（以 `~` 替换）、连接器 `baseUrl` 的凭据部分。
- 面包屑只存内存，不落盘，页面刷新即清空；不自动发送任何数据。
- 复制：优先 `navigator.clipboard.writeText`；失败时降级为在文本框中选中全文并提示手动复制，同时保留"保存为文件"。**不新增 Tauri 插件或授权**，是否可用于打包版 WKWebView 需实测，不能确认时以降级路径兜底。
- GitHub 链接预填内容只含脱敏后的摘要与版本信息，不含完整堆栈（长度受 URL 限制），并说明可粘贴完整诊断信息。

### R4 — 关键出口接入（不批量迁移）

只接入以下类别（具体调用点实现时 grep 确认）：`AgentChatPage` 的发送失败、保存/重命名/删除失败、模型发现失败；存储初始化失败页（`main.tsx`，同时修复其直接显示 `cause.message` 未脱敏的问题）。其余 `toast.error` 保持原样，不改文案与行为。

### R5 — 边界重置对运行与草稿的保护

- 错误边界**不自动重置**；重置由用户点击「重试」触发，且仅在导航到其他页面时自动清除（沿用 `CatchBoundary` 的 resetKey 行为）。
- 当错误发生在对话页（AgentChatPage）时：卸载会按现有清理中止执行，恢复仍走现有 `recoverAbandonedRuns` 的 interrupted 语义，用户可在重挂载后继续或结束；本任务不新增离开确认，但在失败页明确提示"进行中的执行已保存进度，重试后可继续；输入框中未发送的内容可能丢失"。
- 不改动 E01/B01 的守卫、运行所有权与草稿持久化的现有实现。

### R6 — 脱敏与安全

- 新增通用脱敏函数（路径、URL 凭据与查询串、常见密钥形态如 `sk-…`、`Bearer …`、长随机串）；与 `redactCredentials` 配合使用，在全局处理器拿不到 apiKey 时靠模式匹配兜底。
- 所有展示、复制、保存、GitHub 预填都经同一脱敏出口；脱敏失败时宁可省略字段。
- 存储初始化失败页改为显示脱敏后的友好文案并提供同样的详情入口。

## Acceptance Criteria

| ID | 可观察结果 | 对应 |
| --- | --- | --- |
| A1 | 在某个页面组件渲染时抛错，只有工作区被错误页替换，左侧导航和顶栏仍可用；点其他导航可恢复；根级兜底在外壳崩溃时出现并可重新加载。 | R1 |
| A2 | 未被边界接住的异步错误与未处理拒绝会以非阻塞提示出现，`AbortError` 不触发；同一错误短时间内不重复提示。 | R1 |
| A3 | 崩溃页与 `showError` 的主文案为友好中文说明，不显示堆栈；不使用 `window.alert`。 | R2 |
| A4 | 详情面板可复制、保存为文件、打开预填 GitHub issue；复制失败时有降级路径。 | R3 |
| A5 | 导出内容含版本、平台、路由、脱敏后的错误与最近至多 30 条面包屑，且**不含**：API Key 样式字符串、Authorization 内容、用户名路径、含凭据/令牌的 URL、消息与创作内容。 | R3, R6 |
| A6 | 面包屑不落盘、刷新后清空；没有任何自动发送。 | R3 |
| A7 | `AgentChatPage` 的发送失败、保存/重命名/删除失败、模型发现失败走统一出口并可查看详情；存储初始化失败页显示脱敏后的友好文案与详情入口；其余 `toast.error` 未被改动。 | R4, R6 |
| A8 | 对话页崩溃后重试：进行中的执行被标记为 interrupted 并可继续或结束；失败页有输入框内容可能丢失的明确提示；E01/B01 守卫行为未变。 | R5 |
| A9 | `pnpm lint`、`test`、`quality`、`quality:self-test`、`build` 与 desktop 的 types/lint/quality 通过；新增测试覆盖脱敏、去重、`AbortError` 排除、边界渲染、详情面板动作与关键出口。 | R1–R6 |
| A10 | 真实窗口人工检查（浏览器与桌面各至少一次，1280x720 与 760x520）：崩溃页、详情面板、复制/保存/GitHub 动作、打包版复制是否可用。此项我无法替代。 | R1–R3 |

## Out of Scope

自动上报与任何服务器；本地持久化错误日志；Tauri 日志插件、Rust panic hook（原生进程崩溃）；Web Worker 的 `onerror` 接入（未核对，列为后续）；批量迁移全部 `toast.error`；改变现有错误类的语义或存储/同步；E01/B01 离开确认与运行所有权的重构；Models.dev 迁移（独立任务）。

## Technical Notes and Risks

- 错误边界与 AgentChatPage 的清理副作用是最大风险，必须靠测试覆盖卸载路径并如实向用户提示。
- 打包版 WKWebView 的 `navigator.clipboard` 行为未验证，须实测；降级路径是必需品而不是可选项。
- 面包屑只记录"操作名/路由"，不得记录输入内容；新增面包屑调用点要保持稀疏，避免引入噪声与隐私风险。
- 路由级配置 API（`errorComponent`/`onCatch`/`notFoundComponent`）的精确签名需实现时对照已装包类型核对，调研只确认了 `default*` 三项存在。
