# 桌面端设置页与版本更新

状态：规划中（等审阅后 task.py start）。

## Goal

桌面端新增设置页，替代当前 `/settings` 到 `/about` 的跳转。页面为左侧导航加右侧分组卡片，首版含四个分区：通用、外观、存储、关于与更新。其中「关于与更新」提供检查新版本、应用内下载安装包、打开发布页。发布方式为无签名，因此不接入 Tauri 自动更新。

## Requirements

- R1 设置页：`/settings` 不再是重定向，渲染独立页面。左导航含搜索框与四个分区，右侧为分组卡片（行 = 标题 + 说明 + 右侧控件），视觉参照 `ModuleLayout` 与现有 token，遵循 `desktop-ui.md`（h1 24/600，正文 14/22，元数据 12/18，不用嵌套卡片与装饰色条）。
- R2 搜索：输入关键字按分区标题、行标题、行说明做包含匹配，过滤后仍显示命中的分区；无结果时显示空状态文案。纯函数实现，可测。
- R3 通用：启动时自动检查更新（开关，**默认关**：产品主打本地优先，启动即访问 GitHub 会暴露网络地址，由用户主动开启），并显示上次检查时间。开关与时间持久化。
- R4 外观：展示当前主题（深色）与界面语言（简体中文）。本版本仅此一种取值，行内明确说明，不提供假的切换控件。
- R5 存储：展示产品数据的存放说明（应用私有数据目录内的本地 SQLite 工作区）、数据规模（项目数与素材类条目数，走 ProductStore 查询）与「导出与备份」指引（指向已存在的项目导出能力）。不写入、不移动数据目录。
- R6 关于与更新：当前版本（`__APP_VERSION__`）；检查更新按钮；有新版本时显示版本号、发布日期、平台对应安装包大小，提供「下载安装包」与「打开发布页」；失败或限流时给出明确原因并提供发布页入口；另有数据与隐私摘要与「更多关于 Cuepoint」链接（保留 `/about` 页面，不删）。
- R7 版本比较：把最新 `desktop-vX.Y.Z` 与当前版本按数值逐段比较，得出「已是最新 / 有新版本 / 当前版本高于线上（开发构建）」。`__APP_VERSION__` 缺失或为 `dev` 时按「无法比较」处理。
- R8 检查更新的网络请求：桌面端走 `runtimeFetchFor` 新增的固定 purpose（匿名 GET `https://api.github.com/repos/ROYIANS/Cuepoint/releases`），不放宽 CSP；浏览器端走普通 `fetch`。沿用 landing 已有的 8 秒超时、draft 过滤、tag 正则、URL 前缀规范化校验与 6 小时缓存策略。
- R9 下载安装包：复用现有保存通道（`saveNativeBlob` → `product_save_begin/chunk/finish`），由系统「另存为」对话框决定保存位置，完成后提示文件位置并说明后续安装步骤与无签名提示（macOS Gatekeeper、Windows SmartScreen）。下载前显示「先导出项目」提醒。不新增 Rust 依赖或命令。
- R11 窗口顶栏汉堡按钮（导航菜单）只在窄窗口（≤767px）显示；普通宽度隐藏。Windows 与 macOS 顶栏左侧不再出现该按钮，macOS 红绿灯区域不被覆盖。根因：`.app-mobile-nav-trigger{display:none}` 与后声明的 `.app-header-shortcut{display:flex}` 同优先级，被覆盖；已改为复合选择器并加契约测试，真实渲染验证（宽窗口 none、窄窗口 flex）。
- R12 浮层不被顶栏遮挡：上下文明细、模型选择器等 Radix 弹层不得长到顶栏（44px，z-index 30）下面。统一通过 `popupCollisionPadding()`（顶部预留 `APP_TOPBAR_CLEARANCE` = 52px）接入 `ui/popover|dropdown-menu|select|tooltip` 与 `ContextUsagePanel`、`ModelSelectTrigger`、`ProjectPicker`、`AudioTimeline`；`tests/popupCollisionClearance.test.ts` 保证不回退到裸数字。根因判断来自截图几何（两处都切在顶栏下沿），未在真实窗口复现，需真机确认。
- R10 卸载/安装包内不得触发应用自动重启或自动安装；不接入 Tauri updater，不引入签名凭据。

## Constraints

- 新增设置存储用已有的 `deviceSettings` 表（键值，device 作用域），键名统一前缀 `settings.`；读取失败或值非法时回退到默认值，不阻塞页面。
- 不新增运行时依赖；不新增 Rust 依赖、Rust 命令或 capability 项（首版零 Rust 改动）。因此「打开数据目录」不在首版范围，作为后续项记录。
- 不得放宽 CSP；不得把 GitHub 域名加入 `connect-src`。
- 页面用 `PageHeader`/`PageContent` 与单一主滚动容器；禁止 `window.alert/confirm/prompt`；`AlertDialog` 必须含 `AlertDialogCancel`。
- 复用而非复制：`src/landing/download/releases.ts` 与 `platform.ts` 里的纯逻辑迁到共享位置（`src/lib/desktopRelease/`），landing 改为从新位置导入，行为与现有 landing 测试保持等价。
- 文案遵守现有禁止表述清单（`tests/fixtures/landing/forbiddenClaims.ts`）的精神：不声称签名、公证、自动安装、自动更新。

## Acceptance Criteria

- [ ] A1 访问 `/settings` 渲染设置页；`routeTree.gen.ts`、AppFrame 导航高亮、`/about` 与相关测试都不回退。
- [ ] A2 搜索框能按关键字过滤分区与行，输入无结果时显示空状态；有单元测试。
- [ ] A3 「启动时自动检查更新」默认关闭；开启状态在重启后保持，且每 24 小时最多自动检查一次；关闭时启动不发任何 GitHub 请求。
- [ ] A4 版本比较覆盖：更新、相同、当前更高、`dev`/缺失、线上没有正式版本（只有 draft/无匹配 tag）五种情况，均有单元测试。
- [ ] A5 桌面端检查更新只经新 purpose 发一次匿名 GET；purpose 策略拒绝非该固定地址、非 GET、带凭据请求；有单元测试（照 `runtimeFetchModelCatalog.test.ts`）。
- [ ] A6 有新版本时可保存对应平台安装包；保存通道失败或用户取消都有明确反馈，不出现静默失败。
- [ ] A7 「打开发布页」走 `nativeOpenExternalUrl`，桌面端打开系统浏览器。
- [ ] A8 「存储」分区的数据规模与 `/about` 之外的信息一致；页面不触发任何写入数据目录的操作。
- [ ] A9 门禁：`pnpm lint`、`pnpm test`、`pnpm quality`、`pnpm build`、`landing:budget`、desktop 的 `types/lint/quality` 全部通过。
- [ ] A9b 汉堡按钮：宽于 767px 的窗口不显示，窄于等于 767px 显示并可打开导航；`tests/appNavTriggerVisibility.test.ts` 通过。（已完成并验证）
- [ ] A9c 上下文明细与模型选择器在窗口较矮时，弹层顶部不被顶栏遮住（弹层内部滚动、可看到标题与第一项）。
- [ ] A10 真机验证（用户）：Windows 与 macOS 顶栏不再有汉堡按钮、两个弹层的顶部不被遮挡；设置页在 1280×800 与窄窗口下的布局、检查更新成功与限流两条路径、下载与系统保存对话框、无签名安装提示、发布页跳转；本机无 Rust，更新流程的最终判定以真实安装包为准。

## Out of scope

- 应用内自动安装、静默更新、增量更新、Tauri updater 与签名凭据。
- 浅色主题、语言切换、界面缩放、手动「减少动效」开关（需要跨全应用的动效改造）。
- 「打开数据目录 / 在文件管理器中显示」需要新 Rust 命令，记入后续版本。
- 把 `/about` 合并进设置页。

## Notes

- Keep `prd.md` focused on requirements, constraints, and acceptance criteria.
- 本次发布与已完成的存储迁移修复（`0.1.3` 版本号已提，本地 tag `desktop-v0.1.3` 需删除后随本任务重新打）一起上线。
- 上线前需完成的既有事项：模型目录基线刷新（已在 0.1.2 前确认最新为 0.0.103，无变化）。
