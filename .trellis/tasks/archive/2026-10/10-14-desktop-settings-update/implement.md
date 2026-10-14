# 执行计划：桌面端设置页与版本更新

分支 `codex/desktop-settings-update`。原分阶段计划的工作已在交接前实现。本轮用户授权核对、补测试、修正独立检查发现的问题，并按随后提供的参考图改设置样式后提交；先提交产品与测试，再提交规范/任务证据。已提交的 shell 修复不重复提交。真机验收与 0.1.3 发布另行进行。

固定命令前缀：`PATH=/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin:$PATH`，`pnpm` 用该路径下的版本。

## 阶段 0：已完成并提交（5f70f81d）
- [x] 汉堡按钮在宽窗口隐藏（`src/styles.css` 复合选择器 + `tests/appNavTriggerVisibility.test.ts`，真实渲染验证宽 none / 窄 flex）。
- [x] 弹层避开顶栏：`src/components/ui/popupCollision.ts` 与 8 处接入 + `tests/popupCollisionClearance.test.ts`。
- [x] 已在 `5f70f81d` 提交汉堡按钮与弹层修复；本轮在完整检查中覆盖回归。

## 阶段 1：共享发布库与策略（无 UI）
- [x] 把 `src/landing/download/releases.ts`、`platform.ts` 迁到 `src/lib/desktopRelease/`；landing 改为导入共享库；`tests/landingReleases|landingPlatform|landingBoundary` 同步改路径并保持断言不变。
- [x] 新增 `version.ts`（`parseVersion`、`classifyUpdate`）与 `tests/desktopReleaseVersion.test.ts`：五类结果、`dev`、缺失、`0.1.10` > `0.1.9`、带前导零/多余段/空串。
- [x] `runtimeHttpPolicy.ts` 增加 `release-check`、`release-asset`，`runtimeFetch.ts` 增加分支；测试照 `runtimeFetchModelCatalog.test.ts`：只允许固定地址与 GET、拒绝凭据头与请求体、`../` 与 `%2e%2e` 逃逸、重定向目标白名单（仅 githubusercontent 两个主机且 https）、非白名单跳转被拒。
- [x] `download.ts`：`downloadAsset({asset, fetchImpl, signal, onProgress, maxBytes})`；测试：digest 一致、不一致丢弃、缺 digest 拒绝、超过上限取消、声明 size 与实际不符、中途取消。
- [x] 门禁：`pnpm lint`、`pnpm test`、`pnpm quality`、`pnpm landing:budget`（landing 依赖闭包仍合规，必要时更新 `scripts/landing-budget.mjs` 的豁免路径 `src/lib/desktopRelease/`）。
- [x] 共享发布库、设置页与更新流程合并为本轮产品 checkpoint；提交记录见 task.json / 会话日志。

## 阶段 2：设置页骨架与搜索
- [x] `ui/switch.tsx`（最小实现）、`settingsModel.ts`（分区/行配置、`filterSettings`）、`settingsStore.ts`（deviceSettings 读写与默认值、非法值回退）。
- [x] `SettingsPage.tsx` + 五个分区（连接与模型复用 ConnectorsSection）；`_studio.settings.tsx` 去掉 redirect，`validateSearch`；构建确认 `routeTree.gen.ts` 无需新增变更。
- [x] 测试：`filterSettings`（空查询、标题/说明/关键字、大小写、无结果、命中保留分区）、`settingsStore`（默认关、写入后读回、非法值回退、写入失败有可见反馈）、路由不再重定向、AppFrame 高亮保持、`/about` 仍可用。
- [x] 同步 desktop-ui/component/directory/hook/runtime 规范，新增 settings-update.md；记录 /connectors 重定向与统一标题。
- [x] 按用户 Codex 设置参考图统一五个分区的标题位置、搜索与选中态、圆角分组；连接页移除多余描述与嵌套页头。
- [x] 门禁同上；归入本轮产品 checkpoint。

## 阶段 3：更新检查与下载
- [x] `useUpdateCheck.ts` 状态机 + 「关于与更新」分区 UI：当前版本、检查、结果卡片、错误文案映射、打开发布页（`nativeOpenExternalUrl`）、下载与保存（`saveNativeBlob`）、保存后安装提示、先导出项目提醒。
- [x] 自动检查：`AppFrame` 挂载后在 `settings.autoCheckUpdates` 为真，且尚无成功记录或距上次成功已超过 24 小时时静默检查；仅成功时写入时间戳；关闭时零请求（测试断言 fetch 未被调用）。
- [x] 测试（注入假的 fetch/保存/时间）：状态迁移、竞态（重复点击只发一次）、卸载中止、各失败原因文案、取消保存、保存失败反馈、自动检查节流、`dev` 版本不报更新。
- [x] 门禁；归入本轮产品 checkpoint。

## 阶段 4：文档、规范与收尾
- [x] `.trellis/spec/frontend/` 新增或更新：设置页（结构、搜索契约、存储键）、更新流程（purpose、校验、64 MB 上限、无 Rust）、弹层顶栏避让规则；`desktop-distribution.md` 里关于更新的说明（仍无 updater，应用内下载只是保存安装包）。
- [x] `docs/desktop-installation.md` 补充「在应用内下载安装包」说明；`docs/desktop-distribution.md` 版本号与说明核对。
- [x] 独立 `trellis-check`：重点看策略绕过、下载校验、状态竞态、可访问性（switch、搜索、空状态、焦点）、窄屏、`landing:budget`。
- [x] 全量门禁：`pnpm lint`、`pnpm test`、`pnpm quality`、`pnpm quality:self-test`、`pnpm models-dev:verify`、`pnpm build`、`pnpm landing:budget`、desktop 的 `types/lint/quality`。
- [x] 真实渲染：本机 headless Edge 查看设置页在 1280×800 与 390 宽的布局（不能替代用户真机）。

源码/浏览器检查见 `research/settings-checkpoint-validation.md`。后续 0.1.3 已公开发布，用户于2026-10-14确认收尾归档；A6（系统保存）、A9c（短窗口弹层）与 A10（安装版）的逐项真机记录保留为发布后复核项。

## 发布准备（2026-10-14 用户确认 0.1.3；用户负责 push）
- [x] 已合并 main 并核对远端 main 包含本轮设置改动；准备开始时本地/远端均无 `desktop-v0.1.3`，GitHub 无同名 Release，无需删除旧 tag。
- [x] 按发布契约刷新模型目录：精确升级 `@opencode-ai/models` 至 `0.0.104`，重新生成并验证基线；379 → 381 条、18 providers，只有该依赖的锁文件变化。
- [x] 实际 `sourceVersion()` 的四个版本 owner 与 Cargo.lock 主包均为 0.1.3。
- [x] 准备 `docs/desktop-release-0.1.3.md` 具体发布正文，修正通用模板的设置入口与更新说明；发布器不会自动读取该正文。
- [x] 独立发布检查通过四宿主/五安装包、tag 情境 prepare dry-run、draft-only 权限与 65 项协议/HTTP 回归；原发布流水线保持仅打包模式。
- [x] 最终模型/文档冻结后的十项完整门禁通过：4655 tests、88 quality self-tests、models verify/build/budget 与 desktop types/lint/quality；1260 个源码/配置/文档路径检查前后哈希一致。
- [x] 本轮授权准备本地发布提交与 annotated `desktop-v0.1.3`，tag 绑定最终干净 main；确切源码通过本地 tag 与会话日志核对。
- [x] 用户已 push `main` 与 `desktop-v0.1.3`；CI run `38550667540` 的四宿主 build、collect、draft 全部 success；公开 Release 含五安装包、SHA256SUMS 与 release-manifest.json 七个文件。
- [ ] 用户真机验证：存储迁移（旧工作区能直接打开）、设置页、检查更新、下载保存、汉堡按钮与弹层；Release 已公开，此项保留为后续设备复核，不计为本次自动化已通过。

## 回滚点
- 阶段 0 的 shell 修复已在当前分支历史；本轮 feature/docs 提交可独立回退。
- 本轮共享库、设置页、策略和测试合并为一个 feature checkpoint；文档/规范另一个提交。
- 阶段 2/3 是纯增量页面与 hook，回退不影响数据。

## 收尾与下一阶段

2026-10-14 用户确认归档本任务并准备跨设备同步。公开发行状态、保留的验收边界和既有同步决策集中记录在 `research/closeout-and-sync-handoff.md`；本轮只做任务归档，没有启动同步实现。
