# Research: UI error handling landscape

- **Query**: Cuepoint UI 层统一错误处理（友好展示 + 收集信息）的现状、框架能力、诊断收集约束、UX 候选、已知风险
- **Scope**: mixed（内部代码只读 + 框架类型/源码核对）
- **Date**: 2026-10-13
- 标记约定：【事实】= 代码/类型/源码直接可见；【推断】= 基于事实的判断。
- 说明：context7 工具在本会话不可用，TanStack Router / React 能力改用已安装包的 `.d.ts` 与 dist 源码核对（见 §2），未联网。

## 1. 现状清单

### 1.1 渲染入口与路由层【事实】

| 位置 | 现状 |
|---|---|
| `src/main.tsx:12` | `createRouter({routeTree, history: createProductRouterHistory()})`，未传 `defaultErrorComponent` / `defaultNotFoundComponent` / `defaultOnCatch` / `defaultPendingComponent` |
| `src/main.tsx:26` | `createRoot(root)` 无 `onCaughtError` / `onUncaughtError` / `onRecoverableError` 选项 |
| `src/main.tsx:28-48` | `startApplication()`：`await initializeProductStorage()` 成功才渲染 `<StrictMode><RouterProvider/></StrictMode>`；失败时 `console.error` + 渲染硬编码"工作区无法打开"页（仅这一处存在整页错误 UI，显示 `cause.message` 原文） |
| `src/routes/__root.tsx:6-8` | `createRootRoute({component: RootLayout})`，无 `errorComponent`/`notFoundComponent`；`RootLayout` = `TooltipProvider > UndoProvider > Outlet + Toaster`（`:11-19`） |
| `src/routes/*.tsx`（约 50 个路由文件） | grep `errorComponent|ErrorBoundary|notFoundComponent|componentDidCatch|unhandledrejection|onCaughtError` 在 `src` 下 **零命中** |
| 全局监听 | `src/main.tsx` 仅 `initUmami()`、`installNativeExternalLinks()`；无 window `error`/`unhandledrejection` 监听 |
| `console.error/warn` | `src` 非测试中仅 1 处（main.tsx 的存储初始化失败） |
| 既有 pagehide/beforeunload | `src/lib/debouncedDraft.ts:303-308`（beforeunload/pagehide 草稿冲刷）、`src/lib/runtimeFetch.ts:20-21`（pagehide 中止请求）、`AgentChatPage.tsx:110`、`AudioWorkspacePage.tsx:48` |
| Toaster | `src/components/ui/sonner.tsx`（sonner 2.0.8），仅在 `__root.tsx:16` 挂载一次 |
| 分析 | `src/lib/umami.ts`：仅 PROD 且配置了 `VITE_UMAMI_*` 才注入脚本；spec `quality-guidelines.md:277` 明确"不得向分析事件附加项目内容、提示词或凭据" |

### 1.2 toast.error 调用点分类【事实：计数；分类为【推断】】

共 **约 76 处** `toast.error`（src 非测试，30+ 文件）。按文件计数：AgentChatPage 20、ConnectorsPage 6、ShotEditorPage 5、WorkspaceChrome 3、ProjectGalleryPage 3、ReferenceLibrary 3，其余各 1-2（AgentControls、FloatingComposer、GenerationReview、ProjectPicker、TaskBoard、EpisodeListPage、ShotRow …；`src/lib/runtimeExternalLinks.ts:17` 是 lib 层唯一的 toast）。

典型模式几乎统一为：`toast.error(error instanceof Error ? error.message : "<固定兜底>")`。

| 类别 | 例（file:line） | 说明 |
|---|---|---|
| A. 用户可行动/前置条件（非异常） | `AgentChatPage.tsx:369` "任务模式请先选择项目"、`:373`、`:379` "请先配置连接"；`TaskBoard.tsx:66`；`DurationInput.tsx:35` "请输入大于或等于 0 的有效秒数"；`useReferenceDraft.ts:76` | 纯校验提示，不是错误，不应进入"诊断收集" |
| B. 保存/写入失败（含 message 透传） | `ShotEditorPage.tsx:321/1202`、`ShotRow.tsx:186/452`、`StoryPage.tsx:121`、`TaskInspector.tsx:197`、`ProjectSettingsPanel.tsx:74`、`AgentControls.tsx:57`、`ContextParameters.tsx:58`、`AgentChatPage.tsx:315/600-629`、`GenerationReview.tsx:123` | 多数直接把 `error.message` 展示给用户；可能是 `StorageError`（中文 message）也可能是原生 Dexie/DOMException 英文 message |
| C. 导入/导出/备份/文件 | `importStudioProject.ts:9`（`PackageError` 则展示 message，否则"导入失败"）、`AboutPage.tsx:40`、`MaterialPreview.tsx:35`、`ProjectGalleryPage.tsx:291`、`WorkspaceChrome.tsx:277` | 已有"保存的文件存在但收尾告警"区分：`isPublishedSaveError`（`src/lib/runtimeSave.ts`） |
| D. 创建/删除/重命名/排序等命令失败 | `ProjectGalleryPage.tsx:124/190`、`EpisodeListPage.tsx:96/110`、`AssetLibraryPages.tsx:193`、`AgentChatPage.tsx:293/345` | 常带 `activeRef.current` 之类"仍挂载"守卫 |
| E. Agent 执行/发送/恢复 | `AgentChatPage.tsx:191/201`（recover*）、`:413/435/457`（`checked.message`，`!checked.aborted` 才提示）、`:415/437/459` | `runChat.ts:365` 已在源头对 message 做 `redactCredentials(...,apiKey).slice(0,300)` |
| F. 连接器/Provider | `ConnectorsPage.tsx:150/163/179/193/212/232` | 全部包 `redactCredentials(msg, request.apiKey).slice(0,300)`，且有 `currentOperation(operation)` 过期守卫 |
| G. 平台能力失败 | `FloatingComposer.tsx:292/301`（语音）、`StoryboardPrintPage.tsx:103`（打印）、`runtimeExternalLinks.ts:17` | 浏览器/原生能力不可用 |
| H. 带 description 的 toast | `GenerationSlotCard.tsx:35` "未保存素材清理失败" + 选项 | 已有第二行说明的唯一用法之一（需看全） |

【推断】绝大多数 toast 是"局部命令失败 → 一行提示"，由发起处的 try/catch 消化；它们不会触发任何 React 错误边界或全局监听，也不会进入任何统一出口。

### 1.3 已有错误类型与确定性（certainty）【事实】

| 类型 | 位置 | 要点 |
|---|---|---|
| `StorageError` | `src/lib/storage/errors.ts:4-9` | `name="StorageError"`，字段 `code: "conflict"\|"constraint"\|"invalid"\|"unavailable"\|"canceled"\|"closed"\|"scope"\|"unknownCommit"`，`certainty: "rollback"\|"unknown"`（默认 rollback），支持 `cause` |
| `UnknownCommitError` | `errors.ts:11-16` | 继承 StorageError，`certainty="unknown"`，带 `operationId`/`workspaceId`；message 明确"不要重复执行已付费或写入操作" |
| `storageError(error)` | `errors.ts:18-24` | 归一化：ConstraintError/DataError → constraint/invalid，其余 → `unavailable`"工作区存储操作失败"（原错误放 `cause`） |
| `ToolRecoveryError` | `src/lib/agent/toolErrors.ts:86-94` | `name="ToolRecoveryError"`，`failure:{code, executed:false, effectCertainty:"not_started", error, recovery}`；message 截断 2048 |
| `ToolValidationError` / `ToolUnavailableError` / `ToolPendingError` | `toolErrors.ts:114 / 20 / 4` | 各有 `failure` 载荷 |
| `toolFailureResult(cause, effectCertainty)` | `toolErrors.ts:96-110` | 沿 `cause` 链最多 6 层，由调用方提供 certainty（`ToolEffectCertainty` 含 `"unknown"`/`"not_started"`）；`effectCertainty==="unknown"` 时 `executed:"unknown"` 且 recovery 文案变为"不得自动重跑" |
| `UnresolvedToolOutcomeError` | `src/lib/agent/runChat.ts:89`（未导出） | "完成查询失败 ⇒ 不能证明原子操作已回滚" |
| 其他 Error 子类 | `DraftConflictError`(`lib/draftConflict.ts:2`)、`MemoryConflictError`(`db/projectMemories.ts:24`)、`PackageError`(`lib/packages/packageError.ts:1`)、`AudioArrangementConflictError`(`domain/audioArrangement.ts:4`)、`AtomicToolRollbackError`(`db/agentTools.ts:351`)、`ResponseLimitError`(`lib/ai/boundedResponse.ts:1`)、`ProviderProtocolError`(`lib/syncProvider.ts:118`)、`CheckpointValidationError`(`lib/checkpoint.ts:16`)、`NativeSavePublishedError`(`lib/nativeSystemServices.ts:20`) | 其中 NativeSavePublishedError 带 `published:true`（文件已写出） |
| 测试 | `tests/e07ErrorContracts.test.ts`、`tests/d07RequestBoundary.test.ts` | 现有错误契约测试 |

【事实】`certainty`/`effectCertainty` 是"副作用是否已发生"的语义，现有 UI toast 层**不读取**这些字段（toast 只用 `error.message`）。【推断】若全局处理器要展示"数据是否已安全"，需读 `StorageError.certainty` 并沿 `cause` 链（可借鉴 `toolFailureResult` 的 6 层遍历）。

### 1.4 已有密钥脱敏【事实】

- `src/lib/ai/safeError.ts`：
  ```ts
  export function redactCredentials(value: string, apiKey: string): string {
      const key = apiKey.trim();
      return (key ? value.split(key).join("[已隐藏]") : value)
          .replace(/Bearer\s+[^\s"',;]+/gi, "Bearer [已隐藏]");
  }
  ```
  需要**调用方提供具体 apiKey**；无 key 时仅做 `Bearer xxx` 正则。不处理：URL query 里的 key、`sk-…` 形态的未知 key、本地路径、用户创作文本。
- 使用点：`runChat.ts:13,365`、`generationRuntime.ts:7`、`ConnectorsPage.tsx:25,150-232`。
- 其他：`ai-connectors.md:48/122` spec 要求 baseUrl 拒绝 credentials/query/fragment；`nativeOpenExternalUrl`（`nativeSystemServices.ts:77`）拒绝带 username/password 的 URL。

## 2. 框架能力

### 2.1 TanStack Router（已装 @tanstack/react-router 1.170.38）【事实，来自 `node_modules/@tanstack/react-router/dist/esm/router.d.ts` 与 `CatchBoundary.js`】

- Router options（`router.d.ts:20/27/35/66`）：`defaultErrorComponent?: ErrorRouteComponent`、`defaultPendingComponent`、`defaultNotFoundComponent?: NotFoundRouteComponent`、`defaultOnCatch?: (error, errorInfo: React.ErrorInfo) => void`。
- 路由级：`errorComponent`、`onCatch`、`notFoundComponent`（路由选项同名；此处未逐一核对 d.ts，来源为通用 API 知识，【推断】）。
- `CatchBoundary`（`CatchBoundary.js`）：class 组件；`getDerivedStateFromError` 存 error；`componentDidCatch` 调 `props.onCatch`；`errorComponent` 收到 `{error, reset}`；`reset()` 仅 `setState({error:0})`；`getDerivedStateFromProps` 在 `getResetKey()`（router 层默认与路由 match/定位相关）变化时自动清除错误 —— 即导航到别处会自动退出错误态。默认 `ErrorComponent` 英文 "Something went wrong!"，样式为内联。
- 覆盖：渲染期、生命周期、effect 内同步抛出（经 React 传到最近 boundary）；路由 `loader`/`beforeLoad` 抛错也由 errorComponent 展示。
- 盲区【事实：React 机制】：事件处理器、setTimeout、promise/async 回调中的异常**不会**被 error boundary 捕获。

### 2.2 React 19（已装 react / react-dom 19.3.0）【事实，`@types/react-dom/client.d.ts:22-46`】

`createRoot` 选项 `onUncaughtError`、`onCaughtError`、`onRecoverableError`：
- `onCaughtError(error, {componentStack, errorBoundary})`：被 error boundary 捕获的渲染错误（包括 TanStack CatchBoundary）。
- `onUncaughtError(error, {componentStack})`：未被任何 boundary 捕获的渲染错误（此时整个树卸载）。
- `onRecoverableError`：hydration 不匹配/React 自行恢复的错误。
- 这三个也只覆盖 React 渲染链路（render/commit/effect），不覆盖事件处理器内异常、异步回调。【推断，据 React 官方语义】
- 现有 `main.tsx:26` 未设置任何一个；`StrictMode` 已启用（`:34`），开发态会二次渲染，报告回调会被重复触发。

### 2.3 window 级【事实：浏览器标准】

- `window.addEventListener("error")`：未捕获同步脚本错误、资源加载错误（捕获阶段）；Worker 内错误不会冒泡到主窗口 window 的 error，需在 `worker.onerror`。
- `unhandledrejection`：未处理的 Promise 拒绝（包括被 `void promise` 丢弃的）。覆盖 Dexie 事务里未 catch 的 reject、`void foo()` 模式。
- 项目内 `void xxx.catch(...)` 模式很多（见 AgentChatPage:600-629），这些已自行 catch 并走 toast，不会触发 unhandledrejection。
- Web Worker：`src/components/studio/materials/MaterialDocumentPreview.tsx:48`、`src/lib/references/import.ts:21`（`docx.worker.ts`）用 `new Worker(...)`；各自处理 worker 错误（未逐行核对）。全局 error 监听不覆盖。
- Dexie/IndexedDB：事务错误以 reject 形式上报给调用 promise；若调用方未 catch → unhandledrejection；事务中途 abort 不会走 React boundary。`StorageError` 就是对这类失败的封装（`storageError()`）。

### 2.4 Tauri 侧【事实，`desktop/tauri/src-tauri`】

- `Cargo.toml`：依赖 tauri 2.12.2、`tauri-plugin-dialog/http/opener`；**无 `tauri-plugin-log`、无 `tauri-plugin-clipboard-manager`、无 `tauri-plugin-fs`**。
- `desktop.rs:1663-1779` `run()`：Builder 仅注册 dialog/http/opener 插件；`invoke_handler` 仅 15 个命令：`workspace_request, product_store_request, product_binary_request/read/write, product_media_preview/release, workspace_cancel, authorize_http_origin, product_save_begin/chunk/finish/cancel, product_print_storyboard, product_open_external`（+ acceptance 特性下 `acceptance_request`）。
- 无 `std::panic::set_hook`；`rg panic` 在非测试源码仅见 `worker.rs:398` 的 `Error::new("worker","Storage thread panicked")`（线程 panic 转为 Error 返回）。
- 事件通道：Rust → 前端仅 `product-store-changed`（`desktop.rs:114`）；capability `main.json` 授权 `core:event:allow-listen/unlisten`，无前端 → Rust 的日志/上报命令。
- 无 JS 侧 Tauri 日志文件；错误详情只存在于 devtools console（生产包 devtools 未确认）。
- 命令返回的 `Error { code?, message }`（`error.rs`）经 IPC 抛到 JS，成为 reject → 进入各调用点 catch/toast。
- CSP（`tauri.conf.json`）：`connect-src ipc: http://ipc.localhost 'self'`，网页端对第三方上报默认被 CSP 拒绝；HTTP 外联由 `authorize_http_origin` 逐源授权。【推断】任何"自动上报"方案在 Tauri 下需先动 CSP/权限，与"无服务器"前提也冲突。
- 前端运行时判定：`src/lib/runtimeIdentity.ts` `isTauriRuntime()`（`window.__TAURI_INTERNALS__?.invoke`）。

### 2.5 覆盖/盲区汇总

| 机制 | 覆盖 | 盲区 |
|---|---|---|
| 路由 errorComponent/CatchBoundary | 渲染/生命周期/loader | 事件处理器、async、Worker |
| React onCaughtError/onUncaughtError | 渲染链路错误的统一上报钩子（含 boundary 已捕获的） | 同上 |
| window error | 同步脚本错误、资源加载错误 | Worker、被 catch 的错误 |
| unhandledrejection | 未 catch 的 promise（Dexie、fetch、IPC invoke） | 已 catch 后只 toast 的错误（需要出口统一函数才能收集） |
| Tauri Rust 侧 | 无 hook | 原生 panic、webview 崩溃无上报 |
| 现有 toast.error（~76 处） | 局部提示 | 不进入任何收集 |

## 3. 诊断信息收集的约束

### 3.1 可收集【事实：可得来源；是否适合为【推断】】

| 项 | 来源 |
|---|---|
| 应用版本 | `package.json:5` 与 `tauri.conf.json` 均为 `0.1.1`；前端是否注入 `__APP_VERSION__` 未找到（grep vite.config.ts 无命中）；`brand.ts` 有 `GITHUB_URL = "https://github.com/ROYIANS/Cuepoint"` |
| 运行时/平台 | `isTauriRuntime()`；`navigator.userAgent` / `navigator.platform`（Tauri 内为 WebView UA，含 OS/架构线索） |
| 路由 | `router.state.location.pathname`（含 `$projectId`/`$threadId` 等 ID —— 本地随机 ID，非敏感但可去重） |
| 错误 | `name`、`message`、`stack`、`cause` 链、`StorageError.code/certainty`、`ToolRecoveryError.failure.code/effectCertainty`、`componentStack` |
| 时间 | `new Date().toISOString()` |
| 面包屑 | 现无任何面包屑基础设施；需新建环形缓冲（【推断】） |

### 3.2 必须排除【来自任务要求 + 项目 spec】

- API Key、Bearer token（`redactCredentials` 能处理已知 key + Bearer）。
- 提示词、聊天内容、创作内容（分镜文本、角色/世界观、记忆）：`quality-guidelines.md:277` 对 analytics 已有同类禁令。
- 本地路径含用户名：`product-workspace-v1` 位于 `app_data_dir`（`desktop.rs:68-76`）；原生 Error message 可能含路径（`Error::from(io::Error)`）。现无路径脱敏函数。【推断】需新增 `/Users/<name>`、`C:\Users\<name>`、`/home/<name>` 替换。
- 完整工具参数/结果（`AgentToolCall.arguments`、`generationOverride`）、`ToolValidationIssue.received`（`toolErrors.ts:121` message 内含"收到 …"，可能含用户输入）。
- 连接器 baseUrl：spec 禁止含 credentials/query/fragment，但代理前缀路径可能含自建域名（隐私）。
- 带 `error.message` 的 provider 原文（可能回显请求内容）。

### 3.3 脱敏函数可复用性【推断】

`redactCredentials` 可作为"最后一道"之一，但：签名需要 `apiKey`（全局处理器拿不到当前 key，需遍历已配置连接器的 key 或另行实现通用正则）；不覆盖路径与用户内容。stack 通常不含用户内容，message 可能含。

### 3.4 无服务器时的提交通道【事实：现有能力】

| 通道 | 浏览器 | Tauri | 现有基础 |
|---|---|---|---|
| 复制到剪贴板 | `navigator.clipboard.writeText`（需安全上下文） | WebView 内同 API 可用【推断】；无 clipboard 插件、capability 未授权 | src 内无 `clipboard.writeText` 使用（仅 paste 事件读取：`FloatingComposer.tsx:334`、`ScriptDocument.tsx:232`） |
| 保存为文件 | `downloadBlob`（`runtimeSave.ts`，a[download]） | `saveNativeBlob`（`nativeSystemServices.ts:29`，经 `product_save_begin/chunk/finish/cancel` 原生对话框） | 现成：`downloadBlob(blob, filename, signal)` 返回 `"saved"\|"canceled"`；`isPublishedSaveError` |
| 打开预填 GitHub issue | `<a target=_blank>` / window.open | `nativeOpenExternalUrl(url)`（`nativeSystemServices.ts:77`，限 http/https、无凭据）；`installNativeExternalLinks`（`runtimeExternalLinks.ts`）会拦截外链点击 | `GITHUB_URL` 已在 `src/lib/brand.ts:6`、`AboutPage.tsx:57` 使用 |
| 打印 | `runtimePrint.ts` | `product_print_storyboard` | 与错误无关 |

【推断】issue URL 预填受 URL 长度限制（需截断/只放摘要，完整报告用剪贴板或文件）。

## 4. 友好展示 UX 候选

### 4.1 项目设计规范中相关约束【事实】

- `component-guidelines.md:133`：禁用 `window.prompt/alert/confirm`；输入用 `Dialog`，破坏性确认用 `AlertDialog`（与 `ProjectGalleryPage` 一致）。
- `desktop-ui.md:60-75`：错误矩阵要求——"Mutation 失败：所有者的 error/retry/conflict 状态保持可见且草稿保留"；"空/错误状态给出上下文与恢复动作，不得伪造成功"；"Current owner missing 不得永久显示 loading"；短窗口下 Dialog 主体可滚动、关闭/取消/提交可达；窄视口（760 最小宽）不溢出；标题栏控件不被拖拽拦截（macOS 叠加标题栏 `titleBarStyle Overlay`）。
- `desktop-ui.md` 提到 `PageState kind="loading"` 状态组件（有 loading 变体；error 变体是否存在【未核对】）。
- `quality-guidelines.md:277`：不向分析附加内容。
- 文案为中文，现有硬编码页（main.tsx）语气："请关闭应用后重新打开；现有文件会保留。"
- 现有可复用 UI 原语：`@/components/ui/alert-dialog`、`dialog`、`button`、`sonner`。

### 4.2 候选方案与排序【推断】

| 方案 | 价值 | 成本 | 风险 |
|---|---|---|---|
| A. 根级 `defaultErrorComponent` + `defaultNotFoundComponent`（整页/路由内错误卡，含"重试/返回首页/复制诊断/保存诊断文件/反馈 issue"） | 高：消除白屏与英文默认页，覆盖全部渲染期崩溃；一处接入 | 低-中 | 见 §5：reset 与 AgentChatPage 交互；需让 error 页自身不依赖可能出错的 Provider（Undo/Tooltip 在 root 内 → root 的 errorComponent 渲染时位置需确认） |
| B. 局部错误卡（路由分段，如 `_studio.agent.$threadId`、`p.$projectId`）+ 全局兜底 | 中-高：保留壳（侧栏/标题栏），崩溃只废当前页面 | 中（逐路由/按布局添加） | 局部边界下 reset key 与路由 match 绑定，需验证嵌套行为 |
| C. 全局 `unhandledrejection`/`error` 监听 → 统一 `reportError()` 出口 → 升级 toast（带"复制详情"action） | 中：覆盖异步盲区 | 中；toast 迁移 ~76 处若全改成本高，可仅新增 helper，不强制迁移 | 误报（ResizeObserver 之类无害错误、被 abort 的 `AbortError`）；重复弹出；与已 catch 的错误重复 |
| D. `createRoot` 的 `onCaughtError/onUncaughtError` 做采集（不展示） | 中：补采集，零 UI 风险 | 低 | StrictMode 开发态重复 |
| E. Tauri 侧 panic hook/日志插件 | 低（超出"UI 层"范围） | 高（Cargo 依赖、capability、CSP） | 动安全面 |

粗排（价值/成本比）：A + D（最小闭环） > C（helper 起步，toast 渐进迁移） > B > E。

## 5. 已知风险【事实标注来源；影响为推断】

### 5.1 错误边界 reset 与 AgentChatPage 的交互

- 【事实】执行所有权：`useChatExecutionSession.ts:10-20` effect 清理时 `abortRef.current?.abort()`；卸载即中止执行。`AgentChatPage.tsx:110-113` 的 pagehide effect 清理时调用 `pauseThreadGeneration` / `pauseAudioGenerationBatches`。`AgentChatPage.tsx:187-205` mount 时 `recoverAbandonedRuns()`（`runOwnership.ts`，基于 Web Lock `cuepoint:agent:<threadId>` 的 `ifAvailable`）把遗留 running 的 run 恢复成 interrupted。
- 【推断】若 error boundary 捕获 AgentChatPage 子树渲染错误：整个页面卸载 → effect 清理触发 → 当前执行被 abort、batch 被 pause（等同"离开"，但**没有** E01 离开确认）；已完成步骤已落库保留（`useThreadDeparture.tsx` 文案："已完成的步骤与已收到的内容会保留"）。重试（reset）后重新挂载 → `recoverAbandonedRuns` 再运行，run 被标为 interrupted，用户可继续。
- 【事实】草稿：`AgentChatPage.tsx:222-223` `useReferenceDraft(...)` 的输入草稿是组件内 state（`text`），非持久（至少此处不是 `useDebouncedDraft`）；`debouncedDraft.ts` 的持久/冲刷在 beforeunload/pagehide 时触发（`:303-308`），卸载路径是否冲刷待核对。【推断】boundary 卸载会丢失未发送的 composer 文本与参考附件草稿；其他使用 `useDebouncedDraft` 的编辑器（形状/故事/资产文本）依赖卸载 cleanup 是否冲刷 —— 渲染崩溃时 cleanup 是否仍正常执行取决于 React（卸载清理通常仍运行），但崩溃的组件本身状态可能已不一致。
- 【事实】`useBlocker` 守卫（B01/E01）在 6 处使用：`IpProfileEditor.tsx:88`、`MaterialControls.tsx:91`、`MemoryEditor.tsx:135`、`useThreadDeparture.tsx:45`、`AgentGenerationBatches.tsx:184`（+ AgentChatPage 通过 `useThreadDeparture`）。它们只拦截**路由导航**与"主动关闭"；错误边界的"重试/返回首页"若通过 `router.navigate` 会触发这些 blocker，但边界已卸载了持有 blocker 的组件，【推断】blocker 随组件卸载而失效，不会弹确认。若 errorComponent 内用 `router.invalidate()`/`navigate` 离开，需要知道 blocker 是否已随崩溃组件注销。
- 【事实】`CatchBoundary` 在 resetKey 改变（导航）时自动清错，因此"保留当前页再试一次"必须调用 `reset()`，会重新挂载同一子树，可能立即再次崩溃（循环）。
- 【事实】`StrictMode`（`main.tsx:34`）→ 开发态 onCaught 回调双触发。

### 5.2 与 E01/B01 守卫关系

- 【事实】spec：`component-guidelines.md:216-241`（E01 manual editor departure ownership）与 `state-management.md:731-768`（B01 Query identity and manual route departure）定义：dirty/pending 草稿在路由离开、关闭、替换时需确认；`hook-guidelines.md:59` "key 可以销毁手工草稿，先装 dirty/pending 路由与 unload 守卫"。
- 【推断】错误边界是第三条"非用户发起"的草稿销毁路径，现有守卫模型（用户主动离开）不覆盖；spec 对"崩溃时的草稿"无条款。
- 【事实】`useManualDraftDeparture`（`src/lib/useManualDraftGuard.tsx`）用 `useBlocker`+`pagehide`/ref 状态；blocker 注册在组件内。
- 测试体系：`scripts/b01-browser-regression.mjs`、`scripts/e01-drafts-browser-regression.mjs`（真实 ReactDOM + Radix + TanStack + IndexedDB），测试规范要求"不得弱化断言/加大超时"（`quality-guidelines.md:328-334`）。新增错误处理需保持这些回归不变。

### 5.3 其他

- 【事实】`main.tsx` 的存储初始化失败页直接展示 `cause.message`，未脱敏。
- 【事实】`toast.error` 展示的 `error.message` 可能为英文原生 message（如 Dexie/DOMException），已有中文 `StorageError` 包装但覆盖不均。
- 【事实】Tauri 无剪贴板插件与 capability；若选"复制到剪贴板"，依赖 WebView 的 `navigator.clipboard`（需用户手势，【推断】）。
- 【事实】`AbortError`/`aborted` 是正常流程（`!checked.aborted` 判断，`AgentChatPage.tsx:413`；`runtimeFetch.ts` pagehide abort），全局 unhandledrejection 处理需排除。

## Caveats / Not Found

- context7 不可用：TanStack Router 路由级 `errorComponent/onCatch/notFoundComponent` 与 `notFoundMode` 未对照最新官方文档，仅核对了 router 级 `defaultErrorComponent/defaultOnCatch/defaultNotFoundComponent`（d.ts）与 `CatchBoundary` 源码。
- `toast.error` 数量为 grep 估算（约 76，不含测试）；类别 H 等未逐一读上下文。
- 未核对：`PageState` 是否有 error 变体、`useDebouncedDraft` 卸载冲刷细节、Worker 内 `onerror` 处理细节、前端是否有版本注入常量、生产 Tauri 包是否开 devtools。
- 未发现任何已有面包屑、错误上报或诊断导出实现。
