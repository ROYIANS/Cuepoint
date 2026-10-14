# 桌面端设置页与版本更新

状态：源码已合并 main，0.1.3 已完成四平台构建并公开发布；2026-10-14 用户确认本轮可以收尾并要求归档，下一阶段准备跨设备同步。A6、A9c、A10 没有逐项真机验收记录，保留为发布后复核项，不补写为测试通过。最终收尾与同步衔接见 `research/closeout-and-sync-handoff.md`。

## Goal

桌面端新增设置页，替代当前 `/settings` 到 `/about` 的跳转。页面为左侧导航加右侧分组卡片，含五个分区：通用、外观、连接与模型、存储、关于与更新。其中「关于与更新」提供检查新版本、应用内下载安装包、打开发布页。发布方式为无签名，因此不接入 Tauri 自动更新。2026-10-14 用户补充 Codex 设置截图作为样式参考，并要求连接与模型的标题位置和其他分区一致、去掉多余描述。

## Requirements

- R1 设置页：`/settings` 不再是重定向，渲染独立页面。左导航含圆角搜索框与五个带 Phosphor 图标的分区，右侧为中性圆角分组卡片（行 = 标题 + 说明 + 右侧控件，行间分隔线）。按用户参考图调整间距与选中态，复用 `ModuleLayout` 与现有 token，遵循 `desktop-ui.md`（h1 24/600，正文 14/22，元数据 12/18，不用嵌套卡片与装饰色条）。五个分区由同一外层负责标题，位置统一，不重复显示「设置」总标题和描述。
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
- R13 连接与模型并入设置：保留现有连接、搜索与模型目录操作，作为 `ConnectorsSection` 嵌入设置外层；取消独立的页头、额外说明与二次内容包裹。`/connectors` 以 replace 跳转到 `/settings?section=connections`；AppFrame 移除独立连接入口，设置项在旧路径与 `/about` 仍保持正确高亮。
- R14 网络搜索连接子分组有与其他子分组一致的图标。打开 Tavily 或模型连接配置弹窗时，浏览器自动填充不得把后台设置搜索框当作用户名字段，意外搜索变化也不得卸载连接编辑器或丢失草稿；关闭弹窗后手动搜索正常。

## Constraints

- 新增设置存储用已有的 `deviceSettings` 表（键值，device 作用域），键名统一前缀 `settings.`；读取失败或值非法时回退到默认值，不阻塞页面。
- 不新增运行时依赖；不新增 Rust 依赖、Rust 命令或 capability 项（首版零 Rust 改动）。因此「打开数据目录」不在首版范围，作为后续项记录。
- 不得放宽 CSP；不得把 GitHub 域名加入 `connect-src`。
- 页面用 `PageHeader`/`PageContent` 与单一主滚动容器；禁止 `window.alert/confirm/prompt`；`AlertDialog` 必须含 `AlertDialogCancel`。
- 复用而非复制：`src/landing/download/releases.ts` 与 `platform.ts` 里的纯逻辑迁到共享位置（`src/lib/desktopRelease/`），landing 改为从新位置导入，行为与现有 landing 测试保持等价。
- 文案遵守现有禁止表述清单（`tests/fixtures/landing/forbiddenClaims.ts`）的精神：不声称签名、公证、自动安装、自动更新。

## Acceptance Criteria

- [x] A1 访问 `/settings` 渲染设置页；五个分区标题位置一致且只有一个 h1；连接分区无多余页头和描述；`/connectors` 跳转与 AppFrame 导航高亮正确；`routeTree.gen.ts`、`/about` 与相关测试都不回退。
- [x] A2 搜索框能按关键字过滤分区与行，输入无结果时显示空状态；有单元测试。
- [x] A3 「启动时自动检查更新」默认关闭；开启状态持久化，成功检查后 24 小时内不再自动检查（失败可在下次启动重试）；关闭时启动不发任何 GitHub 请求。存储与生命周期由自动化覆盖，安装版重启验收归 A10。
- [x] A4 版本比较覆盖：更新、相同、当前更高、`dev`/缺失、线上没有正式版本（只有 draft/无匹配 tag）五种情况，均有单元测试。
- [x] A5 桌面端检查更新只经新 purpose 发一次匿名 GET；purpose 策略拒绝非该固定地址、非 GET、带凭据请求；有单元测试（照 `runtimeFetchModelCatalog.test.ts`）。
- [ ] A6 有新版本时可保存对应平台安装包；保存通道失败或用户取消都有明确反馈，不出现静默失败。
- [x] A7 「打开发布页」通过既有外链拦截器走 `nativeOpenExternalUrl`；安装版系统浏览器的最终行为归 A10。
- [x] A8 「存储」分区的数据规模与 `/about` 之外的信息一致；页面不触发任何写入数据目录的操作。
- [x] A9 门禁：`pnpm lint`、`pnpm test`、`pnpm quality`、`pnpm build`、`landing:budget`、desktop 的 `types/lint/quality` 全部通过。
- [x] A9b 汉堡按钮：宽于 767px 的窗口不显示，窄于等于 767px 显示并可打开导航；`tests/appNavTriggerVisibility.test.ts` 通过。（已完成并验证，安装版复核归 A10）
- [ ] A9c 上下文明细与模型选择器在窗口较矮时，弹层顶部不被顶栏遮住（弹层内部滚动、可看到标题与第一项）。
- [ ] A10 真机验证（用户）：Windows 与 macOS 顶栏不再有汉堡按钮、两个弹层的顶部不被遮挡；设置页在 1280×800 与窄窗口下的布局、检查更新成功与限流两条路径、下载与系统保存对话框、无签名安装提示、发布页跳转；本机无 Rust，更新流程的最终判定以真实安装包为准。
- [x] A11 网络搜索子分组带图标；打开 Tavily 弹窗后模拟后台搜索框自动填充，弹窗与草稿仍保留；关闭后搜索恢复，有执行实际回调与浏览器渲染的回归验证。

## Out of scope

- 应用内自动安装、静默更新、增量更新、Tauri updater 与签名凭据。
- 浅色主题、语言切换、界面缩放、手动「减少动效」开关（需要跨全应用的动效改造）。
- 「打开数据目录 / 在文件管理器中显示」需要新 Rust 命令，记入后续版本。
- 把 `/about` 合并进设置页。

## Notes

- Keep `prd.md` focused on requirements, constraints, and acceptance criteria.
- 0.1.3 与存储迁移修复一起交付；最终 `desktop-v0.1.3` 指向 `cedb6cca482bc35fd2592197b752943e62e98ccc`，GitHub Release 已公开，未移动已发布 tag。
- 发布前模型基线已刷新至 `@opencode-ai/models` 0.0.104（381 条）；十项最终门禁与独立发布审计通过。
