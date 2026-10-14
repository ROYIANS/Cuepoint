# 设计：桌面端设置页与版本更新

## 1. 边界与总体取舍

- **零 Rust 增量**：本任务不新增 Rust 依赖、命令、capability 或 CSP 项。本机无 Rust 工具链，0.1.3 的存储迁移已是一块只能静态审阅的 Rust 改动，不再叠加第二块。因此「打开数据目录」「应用内静默安装」都不做。
- **下载走现有保存通道**：安装包只有约 12–16 MB（AppImage 143 MB），且 GitHub 每个资源都有 `sha256` digest。用 `runtimeFetchFor` 取字节、`crypto.subtle` 校验、`saveNativeBlob` 交给系统「另存为」。超过阈值（64 MB，实际只有 AppImage）改为打开浏览器下载。
- **复用而非复制**：把 landing 里的发布与平台纯逻辑迁成共享库，landing 与设置页共用。

## 2. 模块划分

```
src/lib/desktopRelease/            新：共享，无 React、无 Dexie
  releases.ts                      自 src/landing/download/releases.ts 迁入（fetchLatestDesktopRelease、isUnder、缓存、类型）
  platform.ts                      自 landing 迁入（detectPlatform、pickAssets）
  version.ts                       compareVersions、classifyUpdate（新）
  download.ts                      downloadAsset：取字节、限量、校验 sha256（新）
src/landing/download/              改为 re-export 或直接 import 共享库；行为与既有测试等价
src/lib/runtimeHttpPolicy.ts       新增 purpose "release-check" 与 "release-asset"
src/lib/runtimeFetch.ts            runtimeFetchFor 增加两个分支
src/components/settings/           新
  SettingsPage.tsx                 页面：ModuleLayout + 左导航 + 分区
  settingsModel.ts                 分区/行的配置、搜索过滤纯函数
  sections/{General,Appearance,Storage,Update}Section.tsx
  useUpdateCheck.ts                检查与下载的状态机（hook）
  settingsStore.ts                 deviceSettings 读写（键 settings.*）与默认值
src/routes/_studio.settings.tsx    去掉 redirect，渲染 SettingsPage；validateSearch {section?}
```

依赖方向：`components/settings` → `lib/desktopRelease` → `lib/runtimeFetch`；`landing` → `lib/desktopRelease`。`lib/desktopRelease` 不得 import `@/db`、`@/components`、`@tanstack/react-router`、`@tauri-apps/*`（沿用 landing 边界测试的思路）。umami 已被 landing 豁免，不引入新依赖。

## 3. 网络与策略

- `release-check`：固定 `GET https://api.github.com/repos/ROYIANS/Cuepoint/releases?per_page=30`，匿名、无请求体、无凭据头。每个重定向跳转重新校验。
- `release-asset`：`GET`、匿名；初始地址必须 `isUnder(url, "https://github.com/ROYIANS/Cuepoint/releases/download/")`；GitHub 会 302 到 `objects.githubusercontent.com` 或 `release-assets.githubusercontent.com`，这两个主机只作为重定向目标放行，且必须 https、无 userinfo。
- 两个 purpose 都与 `configuredOrigins()`（用户配置的连接）无关，不读 Dexie。
- 响应体限制：release-check ≤ 1 MiB；release-asset 使用 asset 声明的 `size` 与 64 MB 上限的较小者，边读边计数，超过即取消。
- 校验：优先用 GitHub 返回的 `digest`；缺失时拒绝应用内下载，只提供浏览器下载与发布页。校验在 `crypto.subtle.digest("SHA-256")`，不可用则回退 `src/lib/sha256.ts`。不一致时丢弃字节并提示，不触发保存。
- 浏览器端（非 Tauri）：`runtimeFetchFor` 已按运行时回退到 `webFetch`；设置页的「关于与更新」在非桌面端只显示版本说明，不显示下载。

## 4. 版本比较

`parseVersion("0.1.3") -> [0,1,3] | undefined`，仅接受 `X.Y.Z`。`classifyUpdate(current, latest)`：

| current | 结果 |
| --- | --- |
| 无法解析（`dev`、缺失） | `unknown` |
| < latest | `update-available` |
| = latest | `up-to-date` |
| > latest | `ahead`（开发或预发布领先线上） |

无匹配 tag 或请求失败由 `ReleaseResult` 的 fallback 原因承载，不进入此表。

## 5. 设置页

- 外壳：`StudioShell` 不改。设置路由自带 `ModuleLayout`，`navigation` 含搜索框与分区列表（`module-nav-heading / module-nav-item` 现成样式），`navigationLabel="设置导航"`。窄屏沿用 ModuleLayout 的 overlay 行为。不提供 "Back to app"：应用左侧 rail 已是返回入口，避免第二个壳。
- 右侧：`PageHeader`（h1 "设置"）+ `PageContent`，每个分区是一张 `bg-card border rounded-md` 卡片，行为 `标题/说明 + 右侧控件`，行间 `border-b`，不嵌套卡片。
- 分区与行（`settingsModel.ts` 为单一事实来源，搜索与渲染共用）：

| 分区 | 行 |
| --- | --- |
| 通用 | 启动时自动检查更新（开关，默认关）；上次检查时间（只读） |
| 外观 | 主题：深色（只读）；界面语言：简体中文（只读） |
| 存储 | 数据存放位置说明；数据规模（项目数、素材条目数）；备份与导出指引（链接到现有导出入口与 `docs/desktop-installation.md`） |
| 关于与更新 | 当前版本；检查更新；新版本卡片（版本、发布日期、安装包大小、下载、打开发布页）；隐私摘要；更多关于 Cuepoint（`/about`） |

- 无 Switch 组件：在 `ui/` 新增一个最小的 `switch.tsx`（`role="switch"`、`aria-checked`、键盘空格切换），不引入新依赖。
- 搜索：`filterSettings(sections, query)` 对 `title+description+keywords` 做不区分大小写的包含匹配，空查询返回全部；命中行所在的分区保留，其余分区隐藏；无命中显示空状态。查询不写入 URL。
- 路由：`/settings?section=update` 可直达分区；`validateSearch` 只接受已知分区，其余忽略。AppFrame 的 NAV 高亮保持 `/settings` 与 `/about`。

## 6. 更新状态机（`useUpdateCheck`）

状态：`idle → checking → {result | failed}`；`result` 内含分类与发布信息；下载子状态 `idle → downloading(bytes) → verifying → saving → {saved | canceled | failed}`。规则：
- 同一时刻只允许一个检查与一个下载；离开页面（卸载）时 `AbortController.abort()`。
- 失败原因映射到用户文案：`network`（网络不可用）、`rate-limit`（请求过于频繁，稍后再试）、`no-release`（未找到可用发布）、`invalid`（返回内容异常）；所有失败都附带「打开发布页」。
- 自动检查：`settings.autoCheckUpdates` 为真且距上次成功检查超过 24 小时，在设置页之外的应用启动时触发一次（`AppFrame` 挂载后空闲回调），仅静默更新缓存与时间戳，发现新版本时在「设置」导航项上不加红点，只在设置页内提示（首版不弹通知）。
- 保存成功后提示：文件名、安装步骤（macOS 打开 dmg 后拖入应用；Windows 运行 setup.exe；Linux AppImage 先赋予执行权限），以及无签名提示链接到 `INSTALL_GUIDE_URL`。覆盖安装前提醒先导出项目。

## 7. 存储（`settingsStore.ts`）

沿用 `getDeviceSetting/putDeviceSetting`：键 `settings.autoCheckUpdates`（boolean）、`settings.lastUpdateCheckAt`（毫秒时间戳）。读取非法值一律回退默认值。写入失败只提示，不阻塞。注意 `deviceSettings` 表在 0.1.2 引入，0.1.3 起旧工作区可迁移后正常使用。

## 8. 兼容性与回滚

- 路由：`/settings` 由 redirect 变为真实页面；外部链接与 `/about` 不受影响。`routeTree.gen.ts` 由构建重新生成并提交。
- 回滚：设置页、共享库、purpose 都是增量；landing 改为从共享库导入，若出问题可只回退该提交。无数据迁移。
- 版本：与已完成的存储迁移（0.1.3）一起发布，`desktop-v0.1.3` tag 需要先删除再重打（旧 tag 指向修复提交，不含设置页）。

## 9. 风险

- 应用内下载的真实表现（系统保存对话框、大小、进度）无法在无 Rust 的本机验证，以真机为准。
- 打包窗口里 `api.github.com` 的可达性与 CSP 之外的行为未验证（与模型目录先例相同）。
- 未鉴权 GitHub API 限流 60 次/小时；已有 6 小时缓存与 `rate-limit` 回退。
- 无签名：Gatekeeper/SmartScreen 提示无法消除，只能说明。
- `webview` 弹层遮挡修复来自截图几何推断，需真机确认。
