# 实施计划：UI 错误处理与信息收集

## 前置条件

- 任务保持 `planning`，等待用户批准最终计划后才能 `task.py start` 并实现。
- 分支：当前工作分支 `codex/agent-experience-overhaul` 尚未合并到 `main`。实现前须由用户决定：先合并该分支再从 `main` 新建分支，或从当前分支继续；本任务与 `10-13-models-dev-catalog` 互相独立。
- 命令使用本地 Node：`PATH=/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin:$PATH`，显式调用 `/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm`。
- 派发实施/检查子代理时，提示词首行为 `Active task: .trellis/tasks/10-13-ui-error-handling`。
- `state-management.md` 很大，实施/检查代理须显式读取 B01 所有权/离开守卫与 D08 草稿相关段落。

## 有序清单

1. **脱敏与诊断纯逻辑（R3、R6）。** `src/lib/diagnostics/sanitize.ts`、`breadcrumbs.ts`、`errorReport.ts`、`friendlyMessage.ts`、`reportError.ts`；先核对版本号来源（构建期常量是否存在，不存在则用 Vite `define` 注入 `package.json` 版本）。测试：脱敏用例（密钥形态、URL 凭据与查询串、`/Users/<name>` 路径、长随机串、超长截断、脱敏失败返回占位）、面包屑容量、指纹去重（1 秒内）、`AbortError` 忽略、`friendlyMessage` 分类、报告文本不含内容字段。
2. **根级与路由级兜底（R1、R2）。** `ErrorFallback`、`NotFound`、`RootErrorFallback`（手写最小边界，不新增依赖）；`main.tsx` 接线 `defaultErrorComponent`/`defaultNotFoundComponent`/`defaultOnCatch`、`createRoot` 的三个回调、window 监听、router `onResolved` 面包屑；存储初始化失败页改用同一组件与脱敏文案。先对照已装 `@tanstack/react-router` 类型核对 API 精确签名。
3. **详情面板与动作（R3）。** `ErrorDetailsDialog`：复制（含降级）、保存文件、GitHub issue；`buildIssueUrl` 长度处理。测试：三个动作、复制失败降级、对话框文案、预填内容脱敏。
4. **关键出口接入（R4）。** `showError` 与 `AgentChatPage` 的少数调用点（逐一 grep，列清单：发送失败、重命名、删除、模型发现、保存失败）；其余 `toast.error` 不动。更新受影响测试，不得放宽无关断言。
5. **聊天页卸载路径测试（R5/A8）。** 测试边界触发后 `AgentChatPage` 卸载、`recoverAbandonedRuns` 把遗留 running 标为 interrupted、失败页含输入可能丢失的提示、不改 E01/B01 守卫。若发现应持久的数据被丢失，回规划。
6. **全量门禁。** `pnpm lint`、`pnpm test`、`pnpm quality`、`pnpm quality:self-test`、`pnpm model-bank:verify`、`pnpm build`、`pnpm --dir desktop/tauri types|lint|quality`。
7. **规范同步。** 新增或更新 `component-guidelines.md`（错误展示约定）、`quality-guidelines.md`（诊断信息脱敏与面包屑规则）、`directory-structure.md`（新目录）。
8. **真实窗口检查（A10，需用户）。** 浏览器与桌面各一次：构造一个页面渲染错误、一个未处理拒绝、存储初始化失败；验证崩溃页、详情面板、复制/保存/GitHub 动作，尤其**打包版复制是否可用**；1280x720 与 760x520。
9. **收尾。** 记录实际结果与限制；按阶段提交；经 Trellis 归档与 journal。不推送、不发布。

## 验证命令

```sh
PATH=/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin:$PATH /Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm exec vitest run <定向测试>
PATH=/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin:$PATH /Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm lint
PATH=/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin:$PATH /Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm test
PATH=/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin:$PATH /Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm quality
PATH=/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin:$PATH /Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm quality:self-test
PATH=/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin:$PATH /Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm model-bank:verify
PATH=/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin:$PATH /Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm build
PATH=/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin:$PATH /Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm --dir desktop/tauri types
PATH=/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin:$PATH /Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm --dir desktop/tauri lint
PATH=/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin:$PATH /Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm --dir desktop/tauri quality
```

计划命令，尚未执行。

## 风险文件与检查点

- `src/main.tsx`：全局接线与存储初始化失败页；改动后先跑全量测试，再继续。
- `AgentChatPage.tsx`：只改少数 `toast.error` 调用点，不动运行所有权与离开确认；逐个调用点提交前核对行为不变。
- 全局监听与 `AbortError`：漏排除会把正常 abort 当错误刷屏，必须有测试。
- 脱敏：漏脱敏是隐私风险，测试要包含反例；脱敏函数不得依赖外部状态。

## 回滚

阶段 1 到 4 可独立回退；接线只在 `main.tsx` 与少数调用点，回滚即还原这些改动，新增文件保留无害。
