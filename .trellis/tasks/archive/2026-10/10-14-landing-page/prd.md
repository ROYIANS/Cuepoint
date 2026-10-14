# 官网落地页与在线体验入口

状态：已完成（用户真机验证通过）。偏差记录：WebGL 层按用户决定取消；未使用 motion 与 CSS 原生滚动联动（电影引擎自实现）；无 `<noscript>`，以 `#root` 内静态内容兜底。

## Goal

在**同一应用内、不新开项目**，为官网新增一个风格与现有前端一致的落地页：产品展示、在线体验入口、桌面客户端下载、GitHub star 引导；要求"炫酷、丝滑流畅"，并用较复杂的技术实现。

## 用户原话与决策（2026-10-14）

- 官网缺少落地页；不开新项目；要落地页 + 在线体验 + 下载客户端；风格与现在的前端一致；用复杂技术做炫酷、丝滑的首页；GitHub star 引导之类。
- 决策 1（技术层级）：**选 A**——不新增依赖、分层增强：首屏 Canvas 2D 品牌动画；叙事用 `motion` + CSS 原生滚动联动；桌面端高性能设备上按需懒加载手写 WebGL 着色器层；手机、低性能设备与"减少动效"自动降级。
- 决策 2（创意方向，用户主动提出）：**脱离常见网页形式，朝"电影"方向发展**——逐帧、以滚动为时间轴，符合产品（分镜、镜头、成片）的隐喻；炫技但必须流畅。

## 已确认事实（research/codebase-constraints.md、research/tech-options-and-data.md；2026-10-14 实测或读代码）

- 仓库公开（MIT），`homepage` 为 https://cue.vidorra.life/（官网已有部署，落地页将替换其首页）；3 个 star；2 个预发布 Release（desktop-v0.1.1、desktop-v0.1.0），非草稿。
- `GET /releases/latest` 返回 404（忽略预发布）。可靠办法：`/releases?per_page=30`，过滤非草稿且 tag 匹配 `^desktop-v\d+\.\d+\.\d+$`，按 semver 降序取首个，资产按文件名正则匹配，匹配不到降级为指向 Releases 页的链接。接口 `access-control-allow-origin: *`，未认证限额 60 次/小时/IP，支持 ETag。
- 资产命名：`Cuepoint_<v>_{macos_arm64|macos_x64}.dmg`、`Cuepoint_<v>_windows_x64_setup.exe`、`Cuepoint_<v>_linux_x64.{deb|AppImage}`，另有 `SHA256SUMS`、`release-manifest.json`。**没有 Windows/Linux ARM 与 universal 包**，不得给 ARM 设备推荐 x64 包；Mac 浏览器标识分不出芯片，识别不了时同时展示两个 dmg。
- `/` 现由 `src/routes/_studio.index.tsx` 重定向到 `/agent`；Tauri 用 hash 路由，首次位置为 `#/`，落地页路由必须在桌面端重定向回 `/agent`（判断：`isTauriRuntime()`）。
- 网页版入口包 `index` 1,050,148 B（gzip 306,266 B），静态引入 Dexie、zod、存储层、Tauri API，所有路由都加载；访问 `/agent` 合计约 6 MB 原始（gzip 约 1.7 MB）。桌面构建无路由分包（入口约 3.8 MB）。
- `main.tsx:55` 在首次渲染前 `await initializeProductStorage()`，IndexedDB 不可用时访客只会看到"工作区无法打开"，进不了落地页；`initModelCatalog()` 与全局错误监听也对落地页访客执行。
- 设计令牌：单一深色主题、纯灰阶（`--brand` 即白色）；surface `#101010/#151515/#202020/#242424`；圆角 `.75rem`；`--font-sans` 为 PingFang SC 系；`--font-display` 为 Noto Serif SC（Google Fonts，阻塞渲染）；已有 `.studio-grain` 与 `.studio-enter`（cubic-bezier(.22,1,.36,1)）。应用外壳专用样式（`.app-frame`、`.app-topbar`、`--shell-*`、`.module-*`、antd/lobehub 主题）不得复用。
- 没有 OG 图、`robots.txt`、`sitemap`；`index.html` 无 description/OG/theme-color；爬虫不执行 JS，OG 只能放静态 HTML。
- **仓库里没有任何真实产品界面截图或演示视频**（只有 logo、品牌图与"示意"的安装图）。
- 本机无 Chrome/Lighthouse/playwright；有 Edge 155 与 Playwright 的 chromium 缓存，实现后可用 `CHROME_PATH` 指向 Edge 用 `npx lighthouse` 测量（需临时下载，须用户同意）。真机帧率、iOS Safari、中低端手机发热等无法在此验证。
- 不推荐：`three.js`（约 185 KB gzip）、`ogl`（自 2025-01 无更新）、Lottie/Rive（无设计资产）。`motion` 项目已锁 12.43.0，够用。

## 已决策（续，2026-10-14）

- 决策 3（画面来源）：**选 A**——整部"电影"由 Canvas 与 CSS 在代码里绘制；产品界面相关画面先用**明确标注"示意"**的代码绘制画面，并预留可替换位置，等用户有真实截图或录屏时再替换。不使用视频，不引入新依赖。

## 用户批准（2026-10-14）

用户批准计划，并同意**临时下载 Lighthouse** 用本机 Edge 做性能测量（实现后进行，只用于测量，不加入仓库依赖）。设计第 11 节的另外 5 点建议（独立 HTML 入口、`/` 改为落地页、首版仅中文、OG 图先用 logo-lockup、字体沿用 Google Fonts 子集）按建议执行。

## 用户决策（续二，2026-10-14）：电影感增强

- 参考文件 `~/Downloads/through-claudes-eyes.html`（定格动画：12 FPS 逐帧、每帧抖动、一帧弹出、片门晃动、曝光闪烁、胶片颗粒、灰尘毛发、暗角、换景跳帧、每幕独立色调、每幕一句叙事字幕、有情绪弧线）。**借鉴手法，不借鉴内容**（其内容是 Claude 如何看世界）。
- 用户反馈：粒子动画很好，但"缺少一种电影感"。
- 决策（选 A）：**在现有粒子动画上叠加"胶片质感层"**：全片胶片颗粒、片门晃动、曝光闪烁、暗角、灰尘毛发、换景"跳帧"；粒子画面可选 12–24 帧步进渲染与"一帧弹出"曲线（做成可调参数）；每幕独立色调（明暗交替）；每幕一句叙事字幕（草稿见 research/narrative-script.md，所有陈述带证据，不触碰"不可声称"）。保留光点粒子、播放系统与已验证画面。
- **方向已选（2026-10-14，用户看过 /tmp 原型 `cine_proto`，三选一）：A「现代电影胶片（克制）」**，用户补充"接近于 C"，解读为：以 A 为底，并吸收 C 的**暖色高光**质感与**片头角标**（REEL / SC / TAKE 一类小字）；**不采用 C 的 2.39:1 宽银幕黑边**（吃画面、窄屏更差）；**不采用 B 的 12fps 定格抖动与纸纹**。A 的要素：24 帧胶片节奏、颗粒（3 张轮换）、片门晃动（±~1.3px）、轻微曝光闪烁、暗角、偶发灰尘/毛发；光点保持平滑（不抖）。
  注：原型里标题光点糊成一团是原型的光晕半径画大了，并非真实页面效果，不影响方向选择。

## Requirements

### R1 — 独立入口，访客不下载应用
- 新增独立 HTML 入口 `landing.html` 与 `src/landing/main.tsx`，**不 import 应用任何模块**（`@/db`、`@/lib/storage`、Dexie、zod、Tauri API、antd、`@lobehub/*`、TanStack Router、`src/main.tsx`、`src/styles.css`）。访客访问官网首页**不初始化 IndexedDB、不加载模型目录、不注册应用的全局错误监听与路由**。落地页只在自己的入口内处理自身错误（保证任何失败都退化为静态内容而不白屏）。
- nginx：精确匹配 `/` 返回 `landing.html`（`no-cache`）；其余路径保持现有 SPA 回退到 `index.html`；`/assets/*` 沿用 7 天 immutable。应用的路由与深链接（如 `/agent`）行为不变；`src/routes/_studio.index.tsx` 的 `/ → /agent` 重定向保留（桌面端 `#/` 仍依赖它）。
- 桌面版（Tauri）不包含落地页：桌面前端构建脚本不新增入口，**不得出现在桌面包里**。浏览器 `pnpm dev` 下落地页位于 `/landing.html`。

### R2 — 电影化叙事（滚动即时间轴）
整页是一部可滚动的"电影"：固定舞台（pinned stage）+ 滚动进度 0→1 驱动场景；界面元素是电影语汇（片头倒数与"提示点"、时间码 HUD `00:00:00:00`、胶片边孔、场记板、片尾字幕）。建议叙事（设计中细化，用户可在最终计划中调整）：
1. 片头：黑场，一粒光点（品牌"小光点"）亮起，倒数 3-2-1，"提示点（cue）"标记，光点汇聚成标题 "小光点 · Cuepoint"。
2. 第一幕 灵感 → 剧本：散落的光点排成文字行（逐字显现的剧本）。
3. 第二幕 剧本 → 分镜：文字行裂变为分镜格，镜头编号与时间码逐帧生成。
4. 第三幕 创作助手：代码绘制的"安静的对话与工具时间线"（与产品真实的 Agent 交互一致，标注"示意"）。
5. 第四幕 本机优先：胶片盒/保险库隐喻——数据留在本机、API Key 自备（BYOK）。
6. 第五幕 成片与交付：胶片条导出为项目 ZIP、分镜 CSV 等（只写真实功能）。
7. 片尾字幕：在线体验、下载客户端、GitHub star、开源（MIT）、隐私与常见问题，均以"片尾字幕"形式呈现。
所有宣传文案只写有代码证据的真实能力（证据清单见 research/tech-options-and-data.md 第 3 节），不得声称同步、协作、一键成片、完整英文界面等不存在的能力。

### R3 — 技术分层与降级（"丝滑流畅"）
- 第 1 层（所有设备）：HTML/CSS 完整可读的静态叙事；`motion`（`LazyMotion` + `m`）与 CSS 原生滚动联动（`animation-timeline: view()/scroll()`，带 `@supports` 回退）。
- 第 2 层（支持 Canvas 2D 的设备）：Canvas 2D 光点粒子系统（片头汇聚、文字/分镜成形），DPR 上限 2，仅在可见时运行 rAF，页面隐藏时暂停；滚动进度经 rAF 平滑（lerp）。
- 第 3 层（桌面端高性能设备）：按需懒加载手写 WebGL 着色器背景（极光/胶片颗粒/光晕）；仅在 `min-width: 1024px`、`pointer: fine`、`hardwareConcurrency ≥ 4`、非减少动效、WebGL 可用时启用；运行时用帧耗时采样自适应，持续掉帧即降回第 2 层并停止该层。
- 降级：`prefers-reduced-motion: reduce` → 无固定舞台、无粒子/着色器，退化为按幕堆叠的静态版（保留全部信息与链接）；无 JS / 脚本失败 → `landing.html` 内的静态 HTML 内容仍完整（兼 SEO）；手机仅第 1、2 层，粒子数自适应。
- 键盘与可访问性：所有信息在 DOM 中可读、可聚焦；装饰性画布 `aria-hidden`；跳过动画按钮；不依赖鼠标；颜色对比度 ≥ 4.5:1；焦点环保留。

### R4 — 下载与 GitHub 引导
- 下载：运行时请求 `https://api.github.com/repos/ROYIANS/Cuepoint/releases?per_page=30`，过滤非草稿且 tag 匹配 `^desktop-v\d+\.\d+\.\d+$`，按 semver 降序取首个，资产按 `release-policy.mjs` 的命名规则匹配（`Cuepoint_<v>_{macos_arm64|macos_x64}.dmg`、`..._windows_x64_setup.exe`、`..._linux_x64.{deb|AppImage}`）；识别访客系统推荐对应安装包；Mac 无法区分芯片时同时展示 arm64 与 x64 两个 dmg；**没有 Windows/Linux ARM 与 universal 包，不得为 ARM 设备推荐 x64 包**，改为显示"暂无该架构的安装包"并链接到 Releases 页；请求失败、限流、离线、匹配不到资产一律降级为指向 Releases 页的链接；显示版本号与"预发布/未签名"提示（与 docs/desktop-installation.md 的说明一致）。响应用 `localStorage` 缓存约 6 小时（读写均 try/catch，不可用则不缓存）。
- GitHub star：片尾字幕中的 star 引导（带实时 star 数，取自同一仓库接口的 `stargazers_count`，同样缓存；失败时不显示数字）；不使用 shields.io 等第三方徽章（避免第三方请求与"不上云"叙事冲突）。链接统一使用 `GITHUB_URL`。
- 在线体验：入口指向 `/agent`；旁边诚实说明（要点见调研第 3.5 节）：数据只保存在当前浏览器与站点来源、需自备模型 API Key、浏览器直连供应商可能受 CORS 限制、桌面版与浏览器版互不同步、请定期导出项目 ZIP。
- 统计：复用 `initUmami()`（独立小模块）；点击事件用 `data-umami-event` 属性（下载、体验、star），不带敏感载荷；未配置环境变量时无任何统计请求。

### R5 — 风格一致与品牌
深色灰阶体系、圆角、中文无衬线加宋体展示字体、`.studio-grain` 颗粒与 `cubic-bezier(.22,1,.36,1)` 入场曲线。落地页使用**自己的**小体积 CSS（不引入 `styles.css` 巨量规则），令牌值与 `styles.css` 对应；用**一致性测试**读取两份样式文件并比对关键令牌（surface、foreground、radius、字体栈），防止漂移。展示字体按"标题实际用到的文字"子集加载（`display=swap`，避免渲染阻塞）；加载前使用系统宋体回退。不复用应用外壳样式（`.app-frame`、`.app-topbar`、`--shell-*`、`.module-*`、antd/lobehub 主题）。

### R6 — SEO 与分享
`landing.html` 静态包含：title、description、canonical、theme-color、Open Graph 与 Twitter 卡片、`SoftwareApplication` JSON-LD、`<noscript>` 内容、`robots.txt`、`sitemap.xml`。OG 图首版使用现有 `logo-lockup.webp`（若社交平台不支持 WebP 则需用户提供 PNG/JPG，记为已知限制）。不修改 `index.html`（应用入口）。

### R7 — 性能预算与验证
- 预算（首版目标，实现后以实测校准）：落地页首屏 JS ≤ 约 120 KB gzip（含 React 与 `motion` 的 `LazyMotion`），CSS ≤ 约 15 KB gzip，WebGL 层为独立懒加载 chunk；`/` 首屏不下载 Dexie、zod、antd、lobehub、TanStack Router。
- `scripts/landing-budget.mjs`：构建后读取产物清单，校验落地页入口的依赖闭包**不含**禁止模块并检查体积预算；纳入本任务的验证命令。
- 自动测试覆盖纯逻辑；视觉、帧率、移动端发热、iOS Safari、`prefers-reduced-motion` 的真实表现必须由用户在真实浏览器与真机上验证，我无法替代。
- 性能度量：本机有 Edge 155，实现后可用 `CHROME_PATH` 指向 Edge、`npx lighthouse` 跑 `pnpm build && pnpm preview`；这需要临时下载 lighthouse，**须用户在最终计划中同意**，否则仅做预算脚本与代码审查。

## Acceptance Criteria

| ID | 可观察结果 | 对应 |
| --- | --- | --- |
| A1 | 访问 `/`（nginx 部署）得到落地页；`/agent` 等应用路由与深链接不变；桌面包不含落地页；`pnpm quality` 的架构检查无新增静态环。 | R1 |
| A2 | 落地页产物依赖闭包不含 Dexie、zod、antd、`@lobehub/*`、TanStack Router、Tauri API、应用 `styles.css`；预算脚本通过（首屏 JS 与 CSS 在预算内）；打开落地页不创建 IndexedDB 数据库、不发起模型目录或应用相关请求。 | R1, R7 |
| A3 | 滚动一遍能看到完整的 7 段叙事，时间码/胶片 HUD 与滚动同步；叙事、文案与链接在无 JS 与减少动效下仍完整可读。 | R2, R3 |
| A4 | Canvas 粒子在桌面与手机均运行；WebGL 层仅在满足条件的桌面设备启用，掉帧自适应降级；页面隐藏或不可见时不占用 rAF。（帧率与观感需真机验证。） | R3 |
| A5 | 下载区按访客系统推荐安装包；Mac 无法区分芯片时展示两个 dmg；ARM Windows/Linux 不被推荐 x64 包；接口失败、限流、离线、无匹配资产时降级为 Releases 页链接；有版本号与预发布/未签名提示；缓存读写失败不影响显示。 | R4 |
| A6 | star 引导显示实时 star 数（失败时不显示数字），无第三方徽章请求；在线体验入口指向 `/agent` 并附诚实说明；点击事件带 `data-umami-event`，未配置统计时无任何统计请求。 | R4 |
| A7 | 令牌一致性测试通过；落地页与应用在颜色、圆角、字体上视觉一致；展示字体不阻塞首屏渲染。 | R5 |
| A8 | `landing.html` 含完整 meta/OG/JSON-LD/noscript，另有 `robots.txt` 与 `sitemap.xml`；`index.html` 未被修改。 | R6 |
| A9 | `pnpm lint`、`test`、`quality`、`quality:self-test`、`models-dev:verify`、`build`、desktop types/lint/quality 与预算脚本通过；新增测试覆盖场景时间线、系统识别与资产选择、发布过滤与降级、缓存、令牌一致性、减少动效路径。 | R1–R7 |
| A10 | 真实设备人工检查（用户）：桌面与手机的滚动帧率、各幕观感、iOS Safari、减少动效、WebGL 降级、下载与 star 链接、OG 分享预览、1280x720 与 390px 宽度布局。 | R2–R7 |

## Out of Scope

视频与图片序列；`three.js`、`ogl`、Lottie、Rive 及任何新增运行时依赖；英文版落地页与完整多语言（首版仅中文，英文列为后续）；真实产品截图与录屏的制作（预留替换位，等用户提供）；官网的其他页面（文档、定价、博客）；改动应用本身的路由、样式与启动流程；桌面版内的落地页；在线账号、注册、统计看板；自动更新检查。

## Technical Notes and Risks

- 视觉"炫"与"丝滑"互相牵制：每一层特效都必须可降级、可停止；性能只能在真机上验证，未验证前不得声称达标。
- 代码绘制的"产品画面"必须标注"示意"，避免被理解为真实截图。
- OG 图可能需要用户提供 PNG/JPG；`logo-lockup.webp` 在部分平台预览不显示。
- `routeTree.gen.ts` 既被跟踪又在 `.gitignore`；本任务不新增 TanStack 路由，因此不需要重新生成，但要确认。
- Google Fonts 属第三方请求，与应用 `index.html` 一致；若要完全自托管字体需另行评估体积（中文字体很大，子集化是关键）。
- 老用户书签的 `cue.vidorra.life/` 将先看到落地页，需要显眼的"进入应用"入口。
