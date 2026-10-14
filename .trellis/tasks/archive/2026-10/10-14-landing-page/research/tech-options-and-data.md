# Research: 落地页技术方案与数据（tech-options-and-data）

- **Query**: Cuepoint 落地页——GitHub 数据源、动效/图形方案、产品叙事素材、竞品参考、性能预算
- **Scope**: mixed
- **Date**: 2026-10-14（实测均在 2026-10-14 00:19–00:22 UTC，本机 curl）

标注约定：【实测】= 本次命令实测；【代码】= 读仓库文件；【推断】= 推断。

---

## 1. GitHub 数据源与桌面下载

### 1.1 仓库状态【实测】`curl -s https://api.github.com/repos/ROYIANS/Cuepoint`

| 字段 | 值 |
|---|---|
| private | false（公开） |
| stargazers_count | 3 |
| forks / watchers / open_issues | 0 / 3 / 0 |
| default_branch | main |
| license | MIT（spdx_id: MIT） |
| homepage | https://cue.vidorra.life/ |
| description | Local-first AI storyboard studio for film & series — shots, assets, BYOK chat agent. Data stays in your browser. |
| topics | ai-agents, dexie, filmmaking, screenplay, storyboard, vite |
| pushed_at | 2026-10-14T00:14:32Z；archived=false；has_pages=false |

注意：`stargazers_count` 目前只有 3，落地页若显示"3 stars"社会证明很弱；建议星数低于阈值（例如 <50）时只显示 "Star on GitHub" 按钮不显示数字（【推断】产品决策，交调用方定）。

### 1.2 Releases【实测】

`GET /repos/ROYIANS/Cuepoint/releases?per_page=30` → 200，当前共 2 条，均 `draft:false, prerelease:true`：

| tag | published_at | name |
|---|---|---|
| desktop-v0.1.1 | 2026-10-13T09:08:10Z | Cuepoint 0.1.1 (test) |
| desktop-v0.1.0 | 2026-10-12T16:52:53Z | Cuepoint 0.1.0 (test) |

`GET /releases/latest` → **404 Not Found**【实测】（latest 忽略 prerelease；本项目 `publish-draft.mjs:88` 用 `draft:true, prerelease:true, make_latest:'false'` 创建，之后由 owner 手动公开，仍是 prerelease）。所以不能用 `/releases/latest`。

浏览器页面 `https://github.com/ROYIANS/Cuepoint/releases/latest` → 302 到 `/releases`【实测】，同样没有 "latest"。落地页的"所有版本"兜底链接应使用 `https://github.com/ROYIANS/Cuepoint/releases`。

v0.1.1 资产（名称 / 字节）【实测】：
- Cuepoint_0.1.1_linux_x64.AppImage 150,497,784
- Cuepoint_0.1.1_linux_x64.deb 16,603,722
- Cuepoint_0.1.1_macos_arm64.dmg 16,198,950
- Cuepoint_0.1.1_macos_x64.dmg 16,709,995
- Cuepoint_0.1.1_windows_x64_setup.exe 12,420,355
- release-manifest.json 1,795,119
- SHA256SUMS 490
每个资产 API 返回 `digest: "sha256:<hex>"`（可直接取校验值，无需下载 SHA256SUMS）。SHA256SUMS 格式：`<64hex>␣␣<文件名>` 每行一个，仅含 5 个安装包（【实测】`curl -sL .../desktop-v0.1.1/SHA256SUMS`）。

### 1.3 "取最新桌面版 Release"的可靠办法【推断，基于实测响应结构】

```
GET https://api.github.com/repos/ROYIANS/Cuepoint/releases?per_page=30
过滤：!r.draft && /^desktop-v\d+\.\d+\.\d+$/.test(r.tag_name)
排序：按 tag 中的 semver 降序（不要依赖 published_at；响应本身按创建时间倒序，但 semver 更稳）
选择资产：名称严格匹配 ^Cuepoint_<ver>_(macos_arm64|macos_x64|windows_x64|linux_x64)(\.dmg|_setup\.exe|\.AppImage|\.deb)$
```
- 未认证 API 只会返回已公开（非 draft）的 release，draft 对访客不可见；仍应过滤 `draft`。
- 要同时容忍"prerelease"：不要过滤 `prerelease`（目前全是 prerelease）。可在 UI 上标 "Beta / 测试版"。（Release 名称带 "(test)"，文档明确是测试阶段。）
- 若资产缺失（上传中/不完整）→ 对应按钮降级为 "查看 Releases 页面"。
- 下载链接直接用 `asset.browser_download_url`（形如 `https://github.com/ROYIANS/Cuepoint/releases/download/desktop-v0.1.1/<文件名>`），用普通 `<a href>` 导航即可。下载链接 302 到 `release-assets.githubusercontent.com`，是页面导航，不涉及 fetch 的 CORS。

### 1.4 CORS / ETag / 限流头【实测】

- `access-control-allow-origin: *`（含 `/repos/...`、`/releases`、404 响应）→ 浏览器可跨域直接 `fetch`。带 `Origin: http://localhost:5173` 的请求同样返回 `*`。
- `access-control-expose-headers` 含 ETag、Link、X-RateLimit-Limit/Remaining/Reset/Used/Resource、Retry-After → 前端 JS 可读取这些头。
- `etag: W/"a711…16f"`；带 `If-None-Match` 重发 → **304**【实测】。（注意：浏览器对 CORS 请求的条件请求由浏览器 HTTP 缓存自动处理；304 同样计入限额的说法以 GitHub 文档为准：带条件头且返回 304 的请求不消耗 primary rate limit——此点本次未实测 remaining 变化，标【推断/文档】。）
- `cache-control: public, max-age=60, s-maxage=60` → 浏览器 60 秒内直接命中缓存，不发请求。
- 速率限制头：`x-ratelimit-limit: 60`、`x-ratelimit-resource: core`、reset 为 Unix 时间戳；每次请求 remaining 递减 1（实测 58→57→56）。60 次/小时/IP，校园网/公司 NAT 下多人共享一个 IP，**限流概率不可忽略**。
- 响应的 CSP 为 `default-src 'none'`，仅约束 API 响应本身，不影响调用方。

### 1.5 缓存与降级策略【推断】

三种方案比较：

| 方案 | 优点 | 缺点 |
|---|---|---|
| 构建期注入（vite define/脚本拉取 stars 与 release JSON） | 零运行时请求、无限流、无 CLS | 数据陈旧到下次构建；本仓库 Release 发布与前端部署是两套流程（desktop-release.yml 只处理桌面），版本号会落后；离线构建需降级 |
| 运行时拉取 | 数据新鲜 | 每访客 2 次请求（repo + releases），共享 IP 易 403 |
| 运行时 + localStorage 缓存（TTL 数小时，如 6h）+ 构建期兜底值 | 兼顾新鲜与稳定 | 实现稍多 |

推荐组合（供决策参考）：构建期内置一份"保底快照"（版本号与资产名可由 `desktop-v<ver>` 规则推算，但若不确认存在则只给 Releases 页链接）；运行时 `fetch` 带 `AbortController` 超时 ~4s，成功后写入 localStorage `{ts, stars, release}`，TTL 6h 内不再请求；`403/429`（限流，读 `x-ratelimit-remaining: 0` / `x-ratelimit-reset`）、网络错误、离线（`navigator.onLine === false`）→ 使用旧缓存，无缓存则：star 数不显示数字（仅 GitHub 图标 + "Star"），下载按钮退化为指向 `https://github.com/ROYIANS/Cuepoint/releases` 的通用 "前往 GitHub Releases"，其中平台推荐仍可基于 UA 显示"你的系统：macOS (Apple 芯片)"但文件名不确定时不显示具体文件。
仓库私有/无 release 的情形：当前**不是**（公开且有 2 个 release），但同一降级路径覆盖：404/空数组 → "桌面版即将发布 + Star 关注"，在线体验入口保持可用。
两个请求可以合并为只请求 `/releases?per_page=10`（仓库 stars 需要另一个请求；若想省请求，star 数可只在构建期注入）。

### 1.6 第三方徽章（shields.io 等）【实测+推断】

- `https://img.shields.io/github/stars/ROYIANS/Cuepoint` → 200 `image/svg+xml`，`access-control-allow-origin: *`，`cross-origin-resource-policy: cross-origin`，`cache-control: max-age=1800`，经 Cloudflare【实测】。技术上可 `<img>` 使用。
- 代价：引入第三方域名请求（访客 IP 暴露给 shields.io/Cloudflare），与"本机优先、不上云"叙事有张力；样式不可控（非深色品牌化）；有 CLS 风险（尺寸未知）。直接调 GitHub API 本身也是对 api.github.com 的第三方请求，但与 GitHub 链接/下载同域，叙事一致。
- CSP：项目当前**没有** CSP 配置【实测】`grep -rn "Content-Security\|connect-src\|add_header" deploy index.html Dockerfile` 仅得到 nginx.conf 的两处 Cache-Control（`deploy/nginx.conf:13,18`）。若未来加 CSP，需放行 `connect-src https://api.github.com`（运行时拉取）；使用徽章则还需 `img-src https://img.shields.io`。
- 结论：自绘按钮 + 运行时 GitHub API（或构建期注入）即可，不必使用 shields.io。

### 1.7 资产命名规则与"按访客系统推荐下载"映射【代码】

来源：`desktop/tauri/scripts/release-policy.mjs:7-24`（TARGETS 与 `assetName`）、`docs/desktop-installation.md:21-33`。命名函数：

```js
const suffix={dmg:'.dmg',exe:'_setup.exe',appimage:'.AppImage',deb:'.deb'}[format];
return `Cuepoint_${version}_${target.replaceAll('-','_')}${suffix}`;
```
Release tag：`desktop-v<MAJOR.MINOR.PATCH>`（`desktop-release.yml:6`，`release-policy.mjs` 校验 `^\d+\.\d+\.\d+$`）。目标仅 4 个：macos-arm64、macos-x64、windows-x64、linux-x64。

| 访客 | 推荐文件 | 备注（文档原文要点） |
|---|---|---|
| macOS Apple 芯片 | `Cuepoint_<v>_macos_arm64.dmg` | macOS 14+；ad-hoc 签名、未公证，首次需"仍要打开" |
| macOS Intel | `Cuepoint_<v>_macos_x64.dmg` | 同上；无 universal 包 |
| Windows x64 | `Cuepoint_<v>_windows_x64_setup.exe` | 需要 WebView2；未签名，SmartScreen 显示"未知发布者" |
| Windows ARM64 | **无原生包** | 文档："不要给 ARM Windows 或 ARM Linux 下载 x64 包" → 显示"暂无 ARM 版本"+ 在线体验入口 |
| Linux x64 Debian/Ubuntu | `Cuepoint_<v>_linux_x64.deb` | Ubuntu 22.04 基线 |
| Linux x64 其他 | `Cuepoint_<v>_linux_x64.AppImage` | 可能需 FUSE；文件约 150MB（deb 约 16MB） |
| Linux ARM64 | **无** | 同 Windows ARM |

【推断】浏览器识别难点：
- macOS 上 `navigator.userAgent` 对 Apple Silicon 与 Intel 都报 `Intel Mac OS X`，不能据此区分架构。可用 `navigator.userAgentData?.getHighEntropyValues(['architecture','bitness','platform'])`（仅 Chromium 系，Safari/Firefox 不支持）；识别不到 → **同时展示两个 dmg**并附文档的"关于本机"自查说明（`docs/desktop-installation.md:29`）。
- Windows 同理，UA 不区分 ARM（Win ARM 的 Chrome 报 Win64; x64），高熵 `architecture === 'arm'` 可识别。无法确定时展示 x64 并提示 ARM 暂不支持。
- 移动端（iOS/Android）→ 不展示桌面下载主按钮，主 CTA 为"在线体验"/Star，并给"在电脑上打开"提示。
- 资产按文件名正则匹配到，找不到就不显示该按钮（不要拼 URL 猜）。
- 同一 Release 还有 `SHA256SUMS`、`release-manifest.json`（非安装包，勿作为下载按钮）；校验值可显示 `asset.digest`。

---

## 2. 动效与图形技术方案（价值/成本/风险）

### 2.0 项目现状【实测/代码】

- 已装 `motion` 12.43.0（`node_modules/motion/package.json`；`pnpm-lock.yaml` 含 framer-motion/motion-dom 12.43.0），React 实装 19.3.0。
- 路由是 TanStack Router 文件路由；**`/` 目前被 `src/routes/_studio.index.tsx` 重定向到 `/agent`**（`throw redirect({to: "/agent"})`）。落地页放 `/` 需替换该重定向；`src/routes/__root.tsx` 的 RootLayout 包了 TooltipProvider/UndoProvider/Toaster 并引入 `@/styles.css`（全站样式，Tailwind + tw-animate-css）。
- 现有 `dist/`（mtime 2026-10-14 07:55，可能与当前源码不完全一致）入口 `assets/index-DEyRa3fg.js` 1,050,148 B，gzip -9 约 **305 KB**；CSS 76,667 B，gzip 约 14 KB【实测 `gzip -9c`】。即应用首屏入口已很重；落地页若放同一入口，LCP 受此拖累，需让落地页路由与其依赖尽量独立 chunk（【推断】）。
- 字体：`index.html:10-14` 通过 `fonts.googleapis.com` 加载 Noto Serif SC（500/700，display=swap）；`styles.css:13-15` 正文是系统中文字体栈。落地页用中文衬线 display 字体需注意 Google Fonts 子集切片请求与 CLS；国内网络可达性【推断】存疑。

### 2.1 版本与体积（npm registry，2026-10-14 实测）

体积列：bundlephobia（`https://bundlephobia.com/api/size?package=…`，**可访问**）给出的是整包 minified+gzip，未做 tree-shaking，只作上界；`unpackedSize` 来自 `npm view <pkg> dist.unpackedSize`。≥2 周稳定版 = 发布日期 ≤ 2026-09-30。

| 包 | latest（发布日） | ≥2 周的稳定版 | unpackedSize | bundlephobia gzip（整包上界） |
|---|---|---|---|---|
| motion | 14.2.0（2026-10-13，**不满足 2 周**） | 13.4.6（2026-09-29）；项目已锁 12.43.0 | 805,933 B（14.2.0） | 47.9 KB（14.1.0 全量，含 framer-motion） |
| ogl | 1.0.11（2025-01-27） | 1.0.11 | 423,239 B | 34.2 KB（整包；按需 import 的类可明显更小，【推断】约 8–15 KB） |
| three | 0.186.1（2026-09-24） | 0.186.1 | 20,443,256 B | 184.9 KB（整包；tree-shake 后常见 ~120–180 KB【推断】） |
| @react-three/fiber | 9.8.1（2026-10-13 修改，次新） | 9.8.0 / 9.8.1 对应 2026-09-22/24 | 2,378,458 B | 57.0 KB（不含 three）；peer：react `>=19 <19.4`，three `>=0.156` |
| lenis | 1.3.26（2026-08-05） | 1.3.26 | 457,528 B | **5.5 KB** |
| lottie-web | 5.13.0（2025-05-21） | 5.13.0 | 25,415,905 B | 76.8 KB |
| @lottiefiles/dotlottie-react | 0.20.0（2026-10-06，不满足） | 0.19.16（2026-08-28） | 530,357 B | 34.0 KB（另有 WASM 渲染器，运行时异步拉取，【推断】额外数百 KB） |
| @rive-app/canvas | 2.44.2（2026-10-10，不满足） | 2.43.1（2026-09-23） | 5,648,430 B | 67.9 KB（另含 WASM，运行时下载） |
| @rive-app/react-canvas | 4.36.0（2026-09-30 刚好边界）| 4.35.0（2026-09-24） | 47,794 B | 依赖上面的 canvas |
| gsap（补充） | 3.15.0（2026-04-13） | 3.15.0 | 6,258,071 B | 未测 |
| tsparticles（补充） | 4.4.0（2026-08-31） | 4.4.0 | 1,089,475 B | 未测（通常 >30 KB gzip，且不如手写 canvas 契合） |

Motion 14 的 bundlephobia 数据来自 14.1.0。（项目当前 12.43.0；升级与否是决策项，12.x 已满足 useScroll/useTransform/motion 组件需求。）【推断】Motion 官方文档称 `LazyMotion + m` 组件约 4.6 KB、`animate()` mini 版约 2.3 KB、`useScroll` 利用原生 ScrollTimeline 时有硬件加速路径（来自 Motion 官方文档记忆，未在本次联网核对，建议实现前对照 motion.dev）。

### 2.2 方案逐项评估

排序依据：（视觉价值）÷（体积 + 实现成本 + 风险）。

#### (b) CSS 原生（最高性价比，作为基础层）
- 体积：0 KB JS。
- 能力：`animation-timeline: scroll()/view()` 做滚动进度条、元素入场（`animation-range: entry 0% cover 30%`）、视差；`@property` 注册 `<angle>/<color>/<percentage>` 变量后可动画化渐变角度/光晕位置（conic/linear 渐变旋转、边框流光）；CSS 3D transform（`perspective` + `rotateX/Y`、`transform-style: preserve-3d`）做分镜卡片堆叠、翻转；View Transitions 做路由间过渡（`/` → `/agent`）。
- 性能：scroll-driven 动画在 compositor 上运行（仅 transform/opacity/filter 时），不占主线程；`@property` 动画渐变会触发每帧 paint，应限制面积并 `will-change` 慎用。
- 浏览器支持【实测部分】caniuse 数据（`raw.githubusercontent.com/Fyrd/caniuse/main/features-json/view-transitions.json`）：View Transitions 同文档过渡 Chrome 111+、Firefox 144+、Safari 18+/iOS 18+，全球约 92.9%。scroll-driven animations 与 `@property`：本次 caniuse 拉取失败（文件名 404），以下为【推断/记忆】：Chrome/Edge 115+、Safari 26+、Firefox 仍在逐步推进/需要核对；`@property` 三大引擎已支持（Firefox 128+）。**必须用 `@supports (animation-timeline: scroll())` 包裹并提供静态/Motion 降级**。
- reduced-motion：`@media (prefers-reduced-motion: reduce)` 中 `animation: none; transform: none; opacity: 1`；View Transition 用 `::view-transition-*` 设 `animation: none`。
- 移动端：移动 Chrome/Safari 新版支持；中低端机上 3D+blur 叠加易掉帧，避免大面积 `filter: blur()`/`backdrop-filter`。
- React 19：无关（纯 CSS）；Tailwind 4 可用 `@property`、`@supports`、自定义 `@utility`；`tw-animate-css` 已在项目内。
- 风险：支持度不均 → 渐进增强；调试难度；Safari 对 scroll-timeline 的 sticky/overflow 行为差异。

#### (a) 仅 `motion`（已是依赖，边际体积 ≈0）
- 体积：已在依赖里；若首屏只用 `m` + `LazyMotion`+`domAnimation` ≈ 5 KB gzip，全量 `motion` 组件约 15–20+ KB（【推断】，官方数字请核对）；`useScroll`/`useTransform`/`useSpring` 在 `framer-motion` 子包中，tree-shake 友好。当前应用里已存在该依赖，落地页可能复用既有 chunk（需构建后核对）。
- 能力：滚动联动（useScroll({target, offset})+useTransform → 视差、横向滚动叙事、sticky 区块里的步进）、`useInView`/`whileInView` 入场、`layout`/`layoutId` 共享元素（分镜卡片 → 详情）、文字逐字/逐词（split + stagger variants）、`AnimatePresence`。
- 性能：`useTransform` 写 MotionValue 不触发 React 重渲染，直接改 style；仅动 transform/opacity 可保持 60fps。避免对大量元素 `layout` 动画。
- 移动端：良好；注意 iOS 地址栏收缩导致 vh 变化，用 `svh/dvh`。
- reduced-motion：`useReducedMotion()` 或 `<MotionConfig reducedMotion="user">`（自动关闭 transform/layout 动画，保留 opacity）。
- React 19：`motion` 12.x/13.x/14.x peerDeps 为 `react ^18 || ^19`【实测 `npm view motion peerDependencies`（14.2.0）】，兼容。
- 风险：低；包名/导入路径为 `motion/react`。

#### (d) Canvas 2D 粒子/光点（与品牌最契合）
- 体积：手写 100–200 行，≈1–2 KB gzip；零依赖。
- 创意（【推断】设计）：散落光点（小光点 = Cuepoint）随滚动/指针被吸引，汇聚成分镜格线或镜头框；点位目标由预计算的矩形边框采样点给出；滚动进度 0→1 控制 lerp。
- 性能：300–800 点的 2D 点绘制在桌面 60fps、中端手机通常 OK；用 `devicePixelRatio` 上限 2、`requestAnimationFrame`，离屏（IntersectionObserver）/标签页隐藏（visibilitychange）暂停；不要每帧创建对象；点数按视口面积与 `navigator.hardwareConcurrency` 自适应。
- 移动端：减少点数（~150–250），关闭指针交互；考虑 `prefers-reduced-data`（尚非标准）→ 忽略。
- reduced-motion：直接绘制一帧静态"已汇聚"状态，不跑 rAF。
- React 19：用 `useEffect` 管理 canvas 生命周期；StrictMode 下 effect 会跑两次，要做清理（cancelAnimationFrame、removeEventListener）。
- 风险：低；主要是自己写的动画细节打磨成本。

#### (c-1) 原生 WebGL 全屏 fragment shader（极光/流体背景）
- 体积：~60–120 行 JS + 20–40 行 GLSL，≈1–2 KB gzip。
- 性能：全屏片元着色器的成本与像素数成正比，噪声(FBM)层数多时在 4K/高 DPR 手机会掉帧 → 以 0.5–0.75 倍分辨率渲染再 CSS 放大、dpr 上限 1.5、`powerPreference:'low-power'`；非可见时暂停；监听 `webglcontextlost`。
- 移动端：iOS Safari/中端 Android 可行但发热耗电明显 → 移动端退化为 CSS 渐变（`@property` 动画）或静态图。
- reduced-motion：渲染一帧静态画面（time 固定）即停。
- React 19：与 React 无关，封装为一个 `useEffect` 的 Canvas 组件即可，注意 StrictMode 双调用与 context 释放（`WEBGL_lose_context`）。
- 风险：WebGL 不可用（无 GPU/黑名单）→ 必须 `getContext` 失败回退；首帧编译 shader 的卡顿（可延后到 `requestIdleCallback`，LCP 元素用文字不要用 canvas）。

#### (c-2) `ogl`
- 体积：包 1.0.11（2025-01 发布，**已 9 个月无更新**，维护节奏慢，是风险点）；整包 gzip 34 KB，按需引入 `Renderer/Program/Mesh/Triangle` 实测可能 ~8–15 KB（【推断】需构建后实测）。
- 价值：比手写 WebGL 样板代码省事（全屏三角形、uniform 管理、resize），API 近似 three 的精简版。若只做一个全屏 shader 背景，原生 WebGL 更小更可控，ogl 无显著收益。
- 其余同 (c-1)；React 19 无 peer 依赖，兼容。

#### (c-3) `three` + `@react-three/fiber`
- 体积：three 整包 gzip ≈185 KB（tree-shake 后仍常 >100 KB），r3f ≈57 KB，合计 >150–240 KB gzip，**超过大多数落地页的整体 JS 预算**；相比已 305 KB gzip 的应用入口是显著增量，需动态 `import()` 懒加载。
- 价值：只有需要真 3D 模型/场景（如 3D 胶片/分镜立方体）才值得；用 2D 粒子或 shader 可达到 80% 视觉效果。
- 兼容：`@react-three/fiber@9.x` peer `react >=19 <19.4`【实测】，项目 react 19.3.0 在范围内，但**上限 `<19.4`** 会在后续升 React 19.4 时形成约束。
- 风险：体积、移动端发热、需要 3D 资产（glTF/纹理）、调试成本。**不推荐**，除非设计明确需要 3D 模型。

#### (e) Lenis 平滑滚动
- 体积：1.3.26，gzip ≈5.5 KB；peer react >=17（可选），可直接使用原生 API。
- 与 `position: sticky`：基本兼容（Lenis 改的是 scrollTop 驱动，sticky 仍由浏览器布局）；与 **CSS scroll-driven animations 的冲突**：Lenis 用 JS 插值滚动位置，会使 compositor 驱动的 scroll timeline 与视觉位置之间出现一帧差/抖动，且关闭原生惯性后，iOS/Mac 触控板的原生物理手感被替换；Motion 的 `useScroll` 读取实际 scrollY，可与 Lenis 并存。
- 可访问性：劫持滚轮可能破坏浏览器查找/锚点跳转/键盘 PageUp/Space/`scroll-margin`，需对 `prefers-reduced-motion` 禁用，并保证 `html.lenis` 的 CSS 配置；嵌套滚动容器（如应用内聊天区）需 `data-lenis-prevent`。
- 取舍：【推断】落地页是纯展示且中文用户多用触控板/鼠标混合，原生滚动已足够丝滑；Lenis 主要价值在鼠标滚轮用户的"平滑感"，代价是与 CSS 原生滚动动画的潜在冲突与可访问性成本。可作为"可选增强"，默认不启用；若启用只在桌面、非 reduced-motion、`pointer: fine` 时。

#### (f) Lottie / Rive
- 体积：lottie-web 整包 gzip 76.8 KB；dotlottie-react 34 KB + WASM；Rive canvas 67.9 KB + WASM（运行时下载）。
- 需要设计资产：Lottie 需 AE 导出 JSON/.lottie，Rive 需 .riv 文件与 Rive 编辑器；仓库内**没有**此类资产（见第 3 节素材清单，仅有 png/webp/jpg）。
- 价值：对"光点汇聚成分镜"这类程序化效果，Canvas 2D 更便宜更灵活；Lottie/Rive 适合有设计师时的图标/插画动效。
- reduced-motion：需手动暂停/显示首帧。React 19：Rive/dotlottie 官方 React 封装均支持 React 19（`@rive-app/react-canvas` 4.x，dotlottie-react 0.x，【推断】未逐包核对 peer，需要时 `npm view` 查）。
- 结论：**当前不推荐**（无资产、体积不划算）。

### 2.3 综合排序（价值/成本/风险）

| 排名 | 方案 | 边际 gzip | 价值 | 成本 | 风险 |
|---|---|---|---|---|---|
| 1 | (b) CSS 原生（view()/scroll() 入场、@property 流光、3D 卡片、View Transitions 进入应用） | 0 | 高 | 低 | 低（需渐进增强） |
| 2 | (a) motion（滚动联动、逐字显现、layout 过渡）| ≈0–15 KB（已在依赖中）| 高 | 低 | 低 |
| 3 | (d) Canvas 2D 光点汇聚成分镜（品牌创意） | ≈1–2 KB | 很高 | 中 | 低 |
| 4 | (c-1) 原生 WebGL fragment shader 背景（仅桌面） | ≈1–2 KB | 中高 | 中 | 中（回退/功耗） |
| 5 | (e) Lenis（可选） | 5.5 KB | 中 | 低 | 中（滚动冲突/无障碍） |
| 6 | (c-2) ogl | 8–34 KB | 中 | 低 | 中（维护停滞）；相对 (c-1) 无明显收益 |
| 7 | (c-3) three + r3f | >150 KB | 高（若需 3D） | 高 | 高 |
| 8 | (f) Lottie/Rive | 34–77 KB + WASM | 取决资产 | 高（需资产）| 中 |

### 2.4 通用降级矩阵【推断】

`prefers-reduced-motion: reduce` → 全部静态（canvas 画一帧、shader time 固定、不启用 Lenis、View Transition 关闭、仅保留 opacity 渐显）；`pointer: coarse`/`max-width` 小屏 → 粒子数减半、关 shader；`navigator.connection.saveData`（Chromium 有）→ 关 canvas/shader；WebGL 初始化失败 → CSS 渐变；JS 失败/未水合 → SSR 不存在（本项目为 SPA），首屏文字必须是普通 DOM 而不是 canvas。

---

## 3. 产品叙事素材（以仓库为准，避免夸大）

读取文件：`README.md`、`README.en.md`（与中文版 412 行结构对应）、`docs/README.md`、`docs/product/film-agent-workflow.md`、`public/brand/README.md`、`docs/desktop-distribution.md`、`docs/desktop-installation.md`。

### 3.1 官方一句话定位（可直接引用）

- README 首句：「本地优先的 AI 创作工作室，让故事、画面、声音和音乐在同一个项目中逐步成形。」
- `src/lib/brand.ts:4`：`PRODUCT_TAGLINE = "本地优先的影视创作工作室：项目、分镜、资产与交付，密钥只留在本机。"`；`GITHUB_URL`（`brand.ts:6`）= `https://github.com/ROYIANS/Cuepoint`；Logo 常量 `LOGO_SRC`、`LOGO_LOCKUP_SRC`。
- GitHub description：「Local-first AI storyboard studio for film & series — shots, assets, BYOK chat agent. Data stays in your browser.」
- 注意：README 的范围比"影视分镜"更宽——视频 + 音频 + 音乐三类项目；落地页若只聚焦影视，需保持不否认其他模块。

### 3.2 卖点 ↔ 真实功能 ↔ 证据 ↔ 措辞边界

| 卖点 | 真实功能 | 证据（文件/章节） | 避免的夸大 |
|---|---|---|---|
| 本机优先 | 桌面：内部 SQLite + 受管理文件；浏览器：IndexedDB（Dexie）；无需服务端应用数据库 | `docs/desktop-distribution.md`（"all ProductStore tables live in the application workspace's SQLite database"）；README「数据、隐私与备份」表格；`src/db/database.ts`（Dexie）；`desktop/tauri/src-tauri/src/database.rs`（SQLite） | 「本地优先」≠「全部离线」；AI/联网研究仍需联网；README 明说「浏览器存储不是系统钥匙串」 |
| BYOK / 自带 Key | 工作室范围连接：OpenAI 兼容、DeepSeek、APIMart、AIHubMix、MiMo；独立 Tavily 搜索连接 | README「AI 连接与模型」；`src/db/connectors.ts`、`src/db/searchConnections.ts`、`src/lib/ai/` | 项目无自家模型服务；浏览器直连供应商需供应商允许 CORS，无内置代理；不要说"开箱即用 AI" |
| 密钥只在本机 | 连接信息存在本地应用配置；请求时发给对应供应商；项目 ZIP 不含 Key | README 数据表与 ZIP「不包含」列；`brand.ts` tagline | 不要说"加密存储/安全保险箱"；README 明确不是钥匙串 |
| 影视工作流：项目/分镜 | 视频项目：单片/剧集、世界设定、故事与场次、镜头表、资产关联、画面生成与制作交付 | README「视频：故事 → 分镜 → 制作 → 交付」；路由 `src/routes/p.$projectId.e.$episodeId.{storyboard,shots,produce}.tsx`；`src/components/{story,shots,produce}/` | 「不提供完整视频时间线剪辑、转场合成或自动渲染整部影片」（README 原话）——不能宣称"一键成片" |
| IP / 素材库 | 多 IP 档案；素材全局/IP/项目三级；项目采用素材=创建副本并记录版本 | README「IP 与素材复用」；`src/db/ipProfiles.ts`、`src/db/assets.ts`、`src/db/assetReuse.ts`、`src/db/materials.ts`；路由 `_studio.ips.*`、`_studio.assets.tsx` | — |
| 音频制作 | 章节稿件、说话人/音色（MiMo 预设/设计/克隆）、录音、多轨、WAV 导出 | README「音频」；`src/lib/audio/wav.ts`、`src/lib/audio/engine.ts`、`src/db/audioArrangement.ts` | 录音需 HTTPS/localhost 与麦克风授权；多轨为基础排列/裁切/分割/增益/淡入淡出 |
| 音乐生成 | Suno / Flow Music（经 APIMart），作品库、收藏、转入音频项目 | README「音乐」；`src/db/music.ts`、`src/components/music/` | 额度、收费、权限由供应商决定 |
| Agent 创作助手 | 流式对话、项目绑定、任务计划、工具执行、三档权限（ask/assist/full）、执行记录与成果核对、项目记忆 | README「助手」；`src/domain/agent.ts:23`（`AgentPermissionMode = "ask" | "assist" | "full"`）；`src/db/agentTasks.ts`、`src/db/agentRuns.ts`、`src/db/projectMemories.ts`；`docs/product/film-agent-workflow.md`（任务/Canon/Lessons 设计，**部分为规划**，以 README 为准） | 关页后浏览器内多步执行不会在后台继续；"模型说完成≠成果"，README 强调以工作台实际保存为准；不要称"全自动导演" |
| 参考资料本地解析 | 图片、TXT/MD、文本 PDF、DOCX 在浏览器本地提取文本 | README「助手」；`src/lib/references/`（含 `docx.ts`）；致谢 PDF.js、Mammoth | 选中内容会随 AI 请求发给所选供应商；扫描 PDF 无 OCR 保证 |
| 联网研究 | 需配置 Tavily 后搜索与正文提取，展示来源 | `src/lib/agent/webTools.ts`、`src/components/studio/SearchConnection.tsx` | 查询与 URL 发给 Tavily |
| 项目 ZIP 交付/迁移 | 项目 ZIP 导入导出（格式标识 `aifenjing-project-v1`）、分集 CSV、可打印分镜板、素材交付包 | `src/domain/types.ts:7`（`PACKAGE_FORMAT`）；`src/lib/projectPackage.ts`；`src/lib/episodeDelivery.ts`、`src/lib/runtimePrint.ts`；README「项目 ZIP 的范围」 | ZIP **不含** API Key、完整 Agent 会话、IP 档案/全部素材库；不是整个工作室镜像 |
| 同一套应用：浏览器 + 桌面 | Tauri 2 桌面端复用同一界面/命令/Agent | README；`desktop/tauri/`；`docs/desktop-distribution.md` | 桌面与浏览器数据**互不同步**；无自动更新；无账号/多人协作 |
| 开源 | MIT 许可，仓库公开 | GitHub 实测 license=MIT；README「许可」 | 第三方内容遵循各自许可（`THIRD_PARTY_NOTICES.md`） |
| 桌面版现状 | macOS arm64/x64 DMG、Windows x64 setup.exe、Linux x64 deb/AppImage，**测试版** | 第 1 节实测 Release；`docs/desktop-installation.md` | Windows 未签名、macOS ad-hoc 未公证，首次打开会有系统提示；无 ARM Windows/Linux/universal；Release 名称含"(test)"，为 prerelease |

### 3.3 不可声称（README/文档明确未实现）

跨设备自动同步、多人实时协作、账号登录、服务器后台 Agent、原生 MCP、完整时间线剪辑/自动渲染整片、独立图片/文案项目工作台（"即将推出"）、完整英文界面（应用 UI 以中文为主）。

### 3.4 可用作"产品截图/演示"的素材

**结论：仓库内没有任何真实产品界面截图或演示视频。**（实测 `find` 排除 node_modules/dist/.git 后，仅发现以下）：

| 路径 | 尺寸 / 体积 | 说明 |
|---|---|---|
| `public/brand/logo.webp` | 1024×1024，133,254 B | 符号 Logo（带 alpha） |
| `public/brand/logo-lockup.webp` | 1254×1254，450,466 B | 带中英文名称的 lockup，部分透明深色背景（关于页放在纯黑上） |
| `public/brand/logo-256.png` / `-32.png` / `-16.png` | 256/32/16 方形，48,683 / 1,600 / 590 B | favicon |
| `public/brand/sponsor-wechat.jpg` | 1152×1152，80,663 B | 赞赏码，不得改动，落地页不宜作为主视觉 |
| `docs/assets/installation/macos-first-open.png` | 1600×1040，219,012 B | **操作示意图（非系统截图）**，介绍 macOS 首次打开 |
| `docs/assets/installation/windows-first-open.png` | 1600×1040，198,595 B | 同上，Windows；另有可编辑 `.svg`（69,945 B / 4,706 B） |
| `desktop/tauri/fixtures/media/{image.png,movie.mp4}` | 测试夹具 | 测试用，不是产品演示，不应使用 |

- 安装示意图的说明文档（`docs/assets/installation/README.md`）明确"不是操作系统截图""不要描述成已通过安装或安全验证的证据"。落地页若引用须保持该性质，或放到下载区的"首次打开提示"折叠区。
- 落地页的"产品画面"需要：(1) 从运行中的应用截取真实截图（建议在 `pnpm dev` 中用示例数据录制，由用户在真实浏览器完成）；(2) 或用 CSS/SVG/Canvas 绘制"抽象化 UI 示意"（并标注"示意"，不冒充截图）。这也是第 2 节推荐 Canvas 光点汇聚创意的原因之一。
- 品牌：`README.md` 说明 Logo 为批准稿，不得重绘；落地页应直接使用 `/brand/logo.webp?v=20260922` 与 `/brand/logo-lockup.webp?v=20260922`（`src/lib/brand.ts`）。

### 3.5 "在线体验"如何诚实表述【推断，基于 README】

事实：浏览器版是同一应用；`/` 目前重定向到 `/agent`（`src/routes/_studio.index.tsx`）；数据在**当前浏览器、当前站点来源**的 IndexedDB；AI 功能需要自己的 API Key，且供应商需允许浏览器跨域；无服务端数据库；项目 ZIP 可备份；页面也会请求 Google Fonts（README 数据表）、生产构建可能含 Umami 统计（`src/lib/umami.ts`，README「Umami 访问统计」）。

文案要点（需包含）：
1. 「在线体验」＝直接在浏览器里打开真实的工作室（`/agent`），不是演示视频或沙盒。
2. 项目只保存在你这个浏览器里；换浏览器/设备、无痕窗口、清理站点数据、更换域名都会看不到原项目——请定期导出项目 ZIP。
3. 不用 AI 也能本地编辑项目、管理素材、导出；要用 AI 需要自备模型服务的 API Key（BYOK），Key 存在本机，请求会直接发到你配置的供应商。
4. 部分供应商可能因 CORS 无法在浏览器直连；桌面版使用原生 HTTP 传输可避开浏览器 CORS（README 原文："桌面端使用官方原生 HTTP 传输"）。
5. 录音需要 HTTPS 与麦克风授权。
6. 浏览器与桌面版数据互不同步。
7. 隐私：可选访问统计（若启用）只含标准页面访问数据；页面加载 Google Fonts。落地页若新增第三方请求（如 shields.io）须同步说明。
8. 不虚构"免费额度/试用 Key"——项目不提供模型服务。

CTA 层级建议：主 CTA「在浏览器中体验」（进入 `/agent`）与次 CTA「下载桌面版」并列；Star 为第三位。

---

## 4. 竞品与参考（手法借鉴，不抄袭）

说明：本节为【推断】——基于对这些站点公开表现的一般了解推断其实现，**本次未联网逐站抓取核对**，具体技术实现请在实现前用真实浏览器 DevTools 复核。

| 产品 | 可借鉴手法 | 技术实现推断 |
|---|---|---|
| Linear | 深色、极克制的排版 + 细线网格与微光渐变；首屏一个大标题 + 一张"产品界面"大图，滚动时界面图轻微 3D 倾斜/聚焦；章节用小动画演示单一功能 | CSS 渐变/noise + `transform: perspective rotateX` + IntersectionObserver 入场；产品图为静态图或 SVG/CSS 绘制 |
| Raycast | 大幅 hero 光效（锐利的光束/辐射渐变），键盘 key 图形化展示，真实快捷键演示 | 大图片/视频 + CSS 渐变叠加；键帽用 CSS 绘制 |
| Cursor | 首屏就是产品演示（短循环视频/动画"编辑器"面板），强调工作流步骤 | 自动播放静音循环视频（webm/mp4）+ 文本 reveal；懒加载下方区块 |
| Arc（The Browser Company） | 个性化色彩、插画与手绘感，滚动中章节背景色变换，情绪化文案 | 滚动触发的背景色插值（CSS 变量 + scroll 位置）、大尺寸排版 |
| Vercel | 黑底几何/网格、Edge 光斑，粒子/三角形几何的极简 3D 或 canvas 英雄图，用代码块和实时数据（如部署时间线）讲述 | WebGL/canvas（少量几何）+ CSS 网格 + 真实代码文本 |
| Framer | 滚动联动的大排版、横向轮播与 sticky 叠放卡片、文字逐词显现，强交互示例（可拖动） | Framer Motion（Motion 同源）`useScroll`+`useTransform`、sticky 堆叠 |
| Runway | 影视感：大幅视频 hero、作品画廊、全屏沉浸滚动，色调电影化 | 视频为主（HLS/mp4），首屏 poster 图保证 LCP；深色+留白 |
| Higgsfield | AI 影视风格：高对比度 hero 视频墙、镜头语言术语、可点击的 preset 卡片 | 多视频网格（IntersectionObserver 仅播放可见项）+ 卡片 hover 3D |

可映射到 Cuepoint 的手法（设计层）：① Linear 式"产品界面大图 + 轻 3D"，但本仓库**没有真实截图**（见 3.4），可用 CSS/SVG 绘制的抽象分镜板代替；② Framer/Arc 式滚动叙事：故事 → 分镜 → 制作 → 交付四章，用 sticky + `useScroll`；③ Vercel 式几何/光点背景 → Canvas 2D 光点汇聚成镜头框；④ Raycast 式键盘/权限三档（ask/assist/full）可视化。

### 4.1 "炫酷但不拖垮性能"的共性原则【推断/通用经验】

- **LCP**：首屏 LCP 元素用文字（标题）或单张已预加载的 AVIF/WebP，不要用 canvas/WebGL/视频作为 LCP 元素；canvas 特效在 `requestIdleCallback` 或首次交互/LCP 之后启动。
- **CLS**：为 hero 图、下载区按钮、star 数字预留固定尺寸（`aspect-ratio`、`min-width`）；GitHub 数据到达前不改变布局（数字位占位）。
- **交互延迟（INP）**：滚动联动只写 transform/opacity；避免在 scroll handler 里读布局属性；Motion 的 MotionValue 不触发 React 渲染；长任务（解析/着色器编译）拆分或延后。
- **字体**：本项目现有 `index.html` 用 Google Fonts 加载 Noto Serif SC（`display=swap`）。中文字体文件大，落地页标题若用该衬线，需考虑切片加载时的闪变（FOUT）与 CLS；可保留系统字体栈（`src/styles.css:13`）作为首屏字体，display 字体只用于少量大标题并 `font-display: swap`/`optional`。国内网络访问 Google Fonts 稳定性【推断】存疑。
- **图片格式**：AVIF/WebP + `srcset`/`sizes` + `width/height`；首屏图 `fetchpriority="high"`，其他 `loading="lazy"` + `decoding="async"`；现有素材已是 webp。
- **视频策略**：非必要不上视频；若使用，`<video muted playsinline loop preload="none" poster>`，仅在可见时 `play()`，移动端与 `saveData` 下降级为 poster；提供 webm(VP9/AV1)+mp4(H.264) 双源；每段 <1–2 MB。本仓库当前无可用视频素材。
- **JS 预算**：落地页路由单独 chunk（本项目 `vite.config.ts` 已开启 `tanstackRouter({ autoCodeSplitting: true })`），避免把应用入口 305 KB gzip（实测当前 dist）上的重依赖拉进落地页；重特效动态 `import()`。
- **渐进增强**：特效不可用时内容完整可读；`prefers-reduced-motion`、`prefers-reduced-data`、`saveData`、低端设备（`hardwareConcurrency`、`deviceMemory`）降级。

### 4.2 推荐信息架构（Hero → 页脚）

1. **导航条**：Logo（`/brand/logo.webp`）、锚点（工作流/功能/下载/开源/FAQ）、GitHub star 按钮、"在浏览器中体验"主按钮。
2. **Hero**：一句话定位（取自 README/tagline）、双 CTA（在线体验 / 下载桌面版）、光点背景（Canvas/CSS）、"本机优先 · BYOK · MIT 开源"徽标行。
3. **产品叙事**：为什么（密钥与数据在本机；Agent 围绕项目工作并核对成果）——3 个短主张，各带"边界"小字。
4. **工作流演示**（滚动叙事，sticky）：故事 → 分镜 → 制作 → 交付；另外加音频/音乐两条支线。使用 CSS/SVG 示意而非虚假截图。
5. **功能区**：Agent 助手（三档权限）、分镜/镜头表、IP & 素材库、音频多轨、音乐、项目记忆、参考资料、项目 ZIP 交付；每项一行 + 图标。
6. **桌面下载**：根据 OS/架构的推荐按钮 + 其他平台列表 + SHA256 校验提示 + 首次打开提示（未签名/未公证）+ "测试版"标注。
7. **在线体验**：入口按钮 + 数据只在浏览器、需自备 Key 的诚实说明（3.5）。
8. **开源与 Star**：MIT、GitHub 链接、star 按钮（数字视阈值显示）、贡献/Issues 链接。
9. **FAQ/隐私说明**：数据在哪、换域名为何丢项目、Key 安全边界、哪些功能需联网、为何没有 ARM 版、第三方请求（GitHub API、字体、可选 Umami）。
10. **页脚**：版权/MIT、第三方声明（`THIRD_PARTY_NOTICES.md`）、赞赏（可选，`sponsor-wechat.jpg` 不可改动）、GitHub/Issues 链接、版本号（取自 Release）。

---

## 5. 度量与预算

### 5.1 建议预算【推断，通用经验值】

| 指标 | 目标 | 备注 |
|---|---|---|
| 落地页首屏 JS（gzip，路由专属 + 其依赖，不含已缓存的共享入口） | ≤ 60–80 KB | 若落地页共享应用入口（实测当前入口 ~305 KB gzip），总首屏 JS 很难 <150 KB，需评估把落地页做成与应用入口分离（如独立入口或轻量路由）——这是架构决策，本次不建议具体方案 |
| 首屏 CSS（gzip） | ≤ 20 KB | 当前全站 CSS 约 14 KB gzip（实测） |
| 特效代码（canvas/shader） | ≤ 5 KB gzip，且延迟加载 | |
| LCP（移动 4G 模拟） | ≤ 2.5 s（目标 ≤ 2.0 s） | LCP 元素用文本/预加载图 |
| CLS | ≤ 0.05 | |
| TBT / INP | TBT ≤ 200 ms；INP ≤ 200 ms | |
| 滚动帧率 | 桌面 60 fps；中端移动 ≥ 50 fps；长任务 <50 ms | |
| 特效 CPU/GPU | 单帧 JS <4 ms（60fps 预算 16.7 ms） | |
| 图片 | 首屏图 ≤ 150 KB；总图片首屏 ≤ 300 KB | |

### 5.2 验证条件【实测环境探测，2026-10-14，本机 macOS】

- `which google-chrome chromium lighthouse` → 均未找到；`/Applications/Google Chrome.app` 不存在。
- 存在 `/Applications/Microsoft Edge.app`，`--version` 输出 `Microsoft Edge 155.0.4283.45`（Chromium 内核，可通过 `CHROME_PATH` 供 Lighthouse 使用）。
- 存在 Playwright 浏览器缓存 `~/Library/Caches/ms-playwright/chromium-1234`（全局缓存；项目 `node_modules/.bin` 内**没有** playwright/puppeteer/lighthouse）。
- `npm view lighthouse version` → 13.5.0（2026-10-13 修改；该日期在 2 周内，若使用请指定 ≥2 周前的稳定版，具体版本本次未核对）。Lighthouse **未安装**；本次按要求不安装依赖，因此**未在本机运行任何 Lighthouse/性能测量**。
- 已有 `dist/`（2026-10-14 07:55）与 `pnpm preview`（Vite 预览，默认 http://localhost:4173）可作测试目标；落地页实现后需重新 `pnpm build`。

可行的验证路径（由调用方/用户在实现后执行，本次未执行）：
1. `pnpm build && pnpm preview`，另起终端 `CHROME_PATH="/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge" npx lighthouse http://localhost:4173/ --preset=desktop --only-categories=performance --output=json`（以及默认移动配置）；`npx` 会临时拉取 lighthouse，需要用户同意网络/安装。Lighthouse 对 `localhost` 预览有效，但不代表真实网络、真实设备。
2. 静态检查（无需浏览器）：`pnpm build` 后对落地页 chunk 做 `gzip -9c | wc -c` 统计（本次已用此法得到入口体积）；`vite build` 输出的 gzip 大小；检查 `dist/index.html` 的 `modulepreload`。
3. **无法在本环境验证**：真实设备 60fps 滚动体验、iOS Safari 表现、GPU 着色器在中低端手机的发热/掉帧、`prefers-reduced-motion` 在真实系统开关下的行为、Safari/Firefox 对 scroll-driven animations 的实际支持。这些**需用户在真实浏览器/真机验证**（建议清单：Chrome 桌面 + DevTools Performance 面板录制滚动；Safari macOS/iOS；一台中低端 Android；系统开启"减少动态效果"后检查降级）。

### 5.3 关键事实与风险速览（给主 agent）

1. `/` 现在会重定向 `/agent`（`src/routes/_studio.index.tsx`）；落地页要占用 `/` 需改此路由，`/agent` 作为"在线体验"入口（保持）。
2. `releases/latest` 当前 404；必须用 `/releases?per_page=…` + 过滤 `desktop-v*` 且非 draft；所有 release 目前为 prerelease（"test"）。
3. GitHub API 允许任意来源跨域（`access-control-allow-origin: *`），限流 60/小时/IP；务必做 localStorage 缓存（TTL）+ 失败降级为 Releases 页链接。
4. 当前 stars = 3，仓库公开，MIT。
5. 仓库没有真实产品截图/视频；落地页的产品画面需要新制作。
6. 现有 `index.html` 已加载 Google Fonts；项目无 CSP 配置，将来加 CSP 需放行 `api.github.com`。
7. 浏览器架构识别：Mac/Windows 的 UA 无法区分 ARM/Intel（Mac UA 一律 Intel），需 `userAgentData.getHighEntropyValues`（仅 Chromium），否则同时展示两个 dmg；Windows ARM/Linux ARM 无安装包。
8. 动效推荐路径：CSS 原生 + motion（已有）+ Canvas 2D 光点，WebGL shader 仅桌面可选；three/r3f、Lottie/Rive 不推荐；Lenis 可选默认关。
