# 技术设计：UI 错误处理与信息收集

## 1. 边界

- 新增代码集中在 `src/lib/diagnostics/`（纯逻辑，可测）与 `src/components/errors/`（UI）。不改业务层与存储层；不新增 Tauri 插件或授权；不新增 npm 依赖。
- 保持 E01/B01 守卫、运行所有权（`runOwnership`）、`useThreadDeparture`、草稿持久化的现有实现不变。

## 2. 模块

### 2.1 `src/lib/diagnostics/sanitize.ts`（纯函数）
- `sanitizeText(input: string, limit?: number): string`：依次处理——URL（去掉 userinfo 与查询串、保留 origin+path）、常见密钥形态（`sk-…`、`Bearer …`、`api[_-]?key=…`、`Authorization: …`）、本地路径（`/Users/<name>/…`、`/home/<name>/…`、`C:\Users\<name>\…` → `~`）、长随机串（连续 ≥ 32 个字母数字下划线）→ `[已隐藏]`；超长截断到 `limit`（默认 2000）。
- `sanitizePath(pathname: string)`：路由路径中形如 id 的段保留（本地标识符不敏感，但长随机串仍走 `sanitizeText`）。
- 任一步骤抛错时返回 `"[已隐藏]"`，宁可省略。
- 与 `redactCredentials(message, apiKey)` 的关系：运行层已知 apiKey 时仍先用它；全局处理器靠模式匹配兜底。

### 2.2 `src/lib/diagnostics/breadcrumbs.ts`
- 内存环形缓冲，容量 30：`addBreadcrumb(kind: "route" | "action", label: string)`、`getBreadcrumbs(): readonly Breadcrumb[]`。`label` 为路由路径（脱敏后）或调用方给出的**固定操作名**（如 "send-message"），禁止传入用户输入内容。
- 路由面包屑由 `main.tsx` 订阅 router 的 `onResolved` 记录。

### 2.3 `src/lib/diagnostics/errorReport.ts`
- `toErrorInfo(cause: unknown): ErrorInfo`：归一化为 `{name, message, stack?, certainty?, code?}`，识别 `StorageError.certainty`、`ToolRecoveryError.effectCertainty` 等已有字段，全部经 `sanitizeText`。
- `buildDiagnosticReport(info, context): string`：生成纯文本（便于粘贴到 issue）：应用版本、环境（browser/tauri）、平台与架构、路由、时间、错误名/消息/栈（脱敏）、面包屑。**不含**任何消息/创作内容。
- `buildIssueUrl(info, context): string`：`GITHUB_URL + "/issues/new?title=…&body=…"`，只放脱敏摘要与版本，长度截断到 URL 上限内，正文说明"可粘贴完整诊断信息"。
- 版本号来源：优先使用构建期注入常量；若仓库当前没有，则读 `package.json` 版本经 Vite `define` 注入（实现时核对，未核对前不假设存在）。

### 2.4 `src/lib/diagnostics/friendlyMessage.ts`
- `friendlyMessage(cause): {title: string; hint?: string}`：按类别映射——存储失败（`certainty === "unknown"` 提示"结果待确认，请先核对再重试"；`rollback` 提示"未保存，已回滚"）、网络/超时、用户取消、校验失败；未知错误给通用说明。主文案不含堆栈和内部标识。

### 2.5 `src/lib/diagnostics/reportError.ts`
- 模块级 store（`useSyncExternalStore` 可订阅）保存"最近一次错误"，供详情面板读取。
- `reportError(cause, options?: {source: "boundary" | "global" | "action"; actionName?: string})`：指纹 = `name + 首行消息 + 栈首帧`（脱敏后）；1 秒内同指纹去重（覆盖 StrictMode 重复）；`AbortError`（`DOMException name === "AbortError"` 或 `cause.name === "AbortError"`）直接忽略。
- `showError({title?, cause, actionName?})`：调用 `reportError` 后用 sonner 显示 `friendlyMessage` 文案，并带「查看详情」动作打开详情面板（见 3.3）。

## 3. UI

### 3.1 `ErrorFallback`（路由级，`defaultErrorComponent`）
- 渲染在工作区内（`Outlet` 位置），不影响 `AppFrame`（顶栏/导航）。内容：友好标题、一句说明、按钮「重试」（调用 TanStack 提供的 `reset`）、「回到首页」、「查看详情」。对话页（路径以 `/agent` 开头）额外提示"进行中的执行已保存进度，重试后可继续；输入框中未发送的内容可能丢失"。
- 使用现有 shadcn `Button`/卡片风格；无 `window.alert`。

### 3.2 `RootErrorFallback`（根级）
- 用于 `createRoot` 的最外层 React 错误边界（`class` 组件或 `react-error-boundary` 的等价手写，**不新增依赖**，使用 `componentDidCatch`/`getDerivedStateFromError` 手写最小边界）。内容：友好说明、「重新加载」（`location.reload()`）、「查看详情」；不依赖 AppFrame、路由与数据库。
- `main.tsx` 存储初始化失败页改用同一个组件与脱敏文案。

### 3.3 `ErrorDetailsDialog`
- 使用现有 Dialog 组件，从 `reportError` store 读取最近错误并生成报告文本（只读 `<textarea>` 展示，便于手动复制降级）。
- 动作：复制（`navigator.clipboard.writeText`，失败则选中文本框全文并提示手动复制）、保存为文件（`downloadBlob`/`saveNativeBlob`，文件名 `cuepoint-diagnostic-<时间>.txt`）、在 GitHub 反馈（`nativeOpenExternalUrl(buildIssueUrl(...))`）。
- 对话框内明确一句话："此信息不会自动发送，只在你点击时才复制/保存/打开。"

## 4. 接线

- `src/main.tsx`：
  - `createRouter({... defaultErrorComponent: ErrorFallback, defaultNotFoundComponent: NotFound, defaultOnCatch: (error) => reportError(error, {source: "boundary"})})`。
  - `createRoot(el, {onCaughtError, onUncaughtError, onRecoverableError})` 均走 `reportError`；`onCaughtError` 只在边界接住时触发，避免与路由级重复（以指纹去重兜底）。
  - `window.addEventListener("error"/"unhandledrejection")` → `reportError(..., {source: "global"})`，非阻塞 toast 提示"出了点问题"+查看详情；`AbortError` 在 `reportError` 中被忽略。
  - 订阅 router `onResolved` 写路由面包屑。
- 关键出口（不批量迁移）：`AgentChatPage` 的发送失败、重命名、删除、模型发现、保存失败等少数 `toast.error` 改为 `showError`；其余保持原样。具体调用点实现时逐一 grep 并在最终回复列出。

## 5. 边界重置与聊天页

- 不自动重置；重置只来自用户「重试」或导航（`CatchBoundary` 的 resetKey 行为）。
- 卸载 `AgentChatPage` 会按现有清理中止执行，恢复走 `recoverAbandonedRuns`；不新增确认，但通过失败页文案如实提示。**如果后续测试发现重挂载丢失了应当持久的数据，再回到规划。**

## 6. 兼容与回滚

- 全部为新增文件加少量接线（`main.tsx`、`AgentChatPage` 若干调用点）。回滚即还原这些接线，新增文件可保留无害。
- 不改变任何持久化格式；无迁移。

## 7. 权衡

- 手写最小根级边界而不引入 `react-error-boundary`：避免新依赖，行为足够简单。
- 面包屑只存内存：牺牲"崩溃重启后留存现场"，换取不引入本地隐私数据；用户已选择此取舍（决策 1）。
- 只接关键出口：短期内新旧错误风格并存，换取低回归风险（决策 2）。
