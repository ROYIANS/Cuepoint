# 执行计划：桌面端设置页与版本更新

分支 `codex/desktop-settings-update`。每阶段一次提交，阶段间必须通过该阶段门禁；全部阶段完成后做独立检查，再一起发 0.1.3。不 push、不合并，除非用户要求。

固定命令前缀：`PATH=/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin:$PATH`，`pnpm` 用该路径下的版本。

## 阶段 0：已完成（在本分支未提交的工作区里）
- [x] 汉堡按钮在宽窗口隐藏（`src/styles.css` 复合选择器 + `tests/appNavTriggerVisibility.test.ts`，真实渲染验证宽 none / 窄 flex）。
- [x] 弹层避开顶栏：`src/components/ui/popupCollision.ts` 与 8 处接入 + `tests/popupCollisionClearance.test.ts`。
- [ ] 提交这两项（阶段 0 提交），先跑一遍完整门禁。

## 阶段 1：共享发布库与策略（无 UI）
- [ ] 把 `src/landing/download/releases.ts`、`platform.ts` 迁到 `src/lib/desktopRelease/`；landing 改为导入共享库；`tests/landingReleases|landingPlatform|landingBoundary` 同步改路径并保持断言不变。
- [ ] 新增 `version.ts`（`parseVersion`、`compareVersions`、`classifyUpdate`）与 `tests/desktopReleaseVersion.test.ts`：五类结果、`dev`、缺失、`0.1.10` > `0.1.9`、带前导零/多余段/空串。
- [ ] `runtimeHttpPolicy.ts` 增加 `release-check`、`release-asset`，`runtimeFetch.ts` 增加分支；测试照 `runtimeFetchModelCatalog.test.ts`：只允许固定地址与 GET、拒绝凭据头与请求体、`../` 与 `%2e%2e` 逃逸、重定向目标白名单（仅 githubusercontent 两个主机且 https）、非白名单跳转被拒。
- [ ] `download.ts`：`downloadAsset({asset, fetchImpl, signal, onProgress, maxBytes})`；测试：digest 一致、不一致丢弃、缺 digest 拒绝、超过上限取消、声明 size 与实际不符、中途取消。
- [ ] 门禁：`pnpm lint`、`pnpm test`、`pnpm quality`、`pnpm landing:budget`（landing 依赖闭包仍合规，必要时更新 `scripts/landing-budget.mjs` 的豁免路径 `src/lib/desktopRelease/`）。
- [ ] 提交。

## 阶段 2：设置页骨架与搜索
- [ ] `ui/switch.tsx`（最小实现）、`settingsModel.ts`（分区/行配置、`filterSettings`）、`settingsStore.ts`（deviceSettings 读写与默认值、非法值回退）。
- [ ] `SettingsPage.tsx` + 四个分区组件；`_studio.settings.tsx` 去掉 redirect，`validateSearch`；重新生成并提交 `routeTree.gen.ts`。
- [ ] 测试：`filterSettings`（空查询、标题/说明/关键字、大小写、无结果、命中保留分区）、`settingsStore`（默认关、写入后读回、非法值回退、写入失败不抛）、路由不再重定向、AppFrame 高亮保持、`/about` 仍可用。
- [ ] 同步 `.trellis/spec/frontend/desktop-ui.md` 里 “Settings … currently redirects to About” 的描述。
- [ ] 门禁同上；提交。

## 阶段 3：更新检查与下载
- [ ] `useUpdateCheck.ts` 状态机 + 「关于与更新」分区 UI：当前版本、检查、结果卡片、错误文案映射、打开发布页（`nativeOpenExternalUrl`）、下载与保存（`saveNativeBlob`）、保存后安装提示、先导出项目提醒。
- [ ] 自动检查：`AppFrame` 挂载后在 `settings.autoCheckUpdates` 为真且超过 24 小时时静默检查并写入时间戳；关闭时零请求（测试断言 fetch 未被调用）。
- [ ] 测试（注入假的 fetch/保存/时间）：状态迁移、竞态（重复点击只发一次）、卸载中止、各失败原因文案、取消保存、保存失败反馈、自动检查节流、`dev` 版本不报更新。
- [ ] 门禁；提交。

## 阶段 4：文档、规范与收尾
- [ ] `.trellis/spec/frontend/` 新增或更新：设置页（结构、搜索契约、存储键）、更新流程（purpose、校验、64 MB 上限、无 Rust）、弹层顶栏避让规则；`desktop-distribution.md` 里关于更新的说明（仍无 updater，应用内下载只是保存安装包）。
- [ ] `docs/desktop-installation.md` 补充「在应用内下载安装包」说明；`docs/desktop-distribution.md` 版本号与说明核对。
- [ ] 独立 `trellis-check`：重点看策略绕过、下载校验、状态竞态、可访问性（switch、搜索、空状态、焦点）、窄屏、`landing:budget`。
- [ ] 全量门禁：`pnpm lint`、`pnpm test`、`pnpm quality`、`pnpm quality:self-test`、`pnpm models-dev:verify`、`pnpm build`、`pnpm landing:budget`、desktop 的 `types/lint/quality`。
- [ ] 真实渲染：本机 headless Edge 查看设置页在 1280×800 与 390 宽的布局（不能替代用户真机）。

## 发布（用户确认后）
- [ ] 删除本地 `desktop-v0.1.3` tag，在最终提交上重打（用户执行或授权）。
- [ ] 刷新模型目录基线（`pnpm add -D -E @opencode-ai/models@latest` → `models-dev:baseline` → `models-dev:verify`，有变化才提交）。
- [ ] 版本号已是 0.1.3，核对四处一致。
- [ ] 用户 push `main` 与 tag；CI 四平台构建后真机验证：存储迁移（旧工作区能直接打开）、设置页、检查更新、下载保存、汉堡按钮与弹层。

## 回滚点
- 阶段 0 提交之前的状态即 `main`。
- 阶段 1 提交可独立回退（landing 回到原导入）。
- 阶段 2/3 是纯增量页面与 hook，回退不影响数据。
