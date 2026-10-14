# 技术设计：官网落地页（电影式）

## 1. 架构：独立 HTML 入口（推荐方案）

```
landing.html ── src/landing/main.tsx ── 只依赖 react、react-dom、motion(LazyMotion)、src/landing/**
index.html   ── src/main.tsx          ── 应用（不变）
```
- Vite 多页：`vite.config.ts` 的 `build.rollupOptions.input = {main: "index.html", landing: "landing.html"}`。`tanstackRouter` 插件只处理应用路由，不受影响。
- **为什么不是"单入口 + 动态导入启动逻辑"**：`src/main.tsx` 静态引入 Dexie/zod/存储/Tauri API，并在首次渲染前 `await initializeProductStorage()`；把这些拆出会改动应用启动、错误边界、历史导航等已稳定的代码，风险大、收益小，且无法保证落地页不被应用依赖拖累。独立入口把"落地页不下载、不初始化应用"变成**构建期事实**，而不是靠约定。
- nginx：`location = / { add_header Cache-Control "no-cache"; try_files /landing.html =404; }` 放在 `location /` 之前；其余不变。`landing.html` 同时可经 `/landing.html` 访问（`canonical` 指向 `/`）。
- 桌面：`desktop/tauri/scripts/build-frontend-worker.mjs` 使用独立的 vite 配置（不读 `vite.config.ts` 的 input），因此不会打入落地页；实现时用脚本验证桌面产物不含 `landing`。
- `pnpm dev`：落地页位于 `/landing.html`（文档化）；不为 `/` 增加 dev 重写，以免影响应用开发。
- 应用的 `src/routes/_studio.index.tsx` 保持不动。

### 依赖边界（构建期强制）
`scripts/landing-budget.mjs`：构建后读取 `dist/.vite/manifest.json`（需开启 `build.manifest`，或解析 `dist/landing.html` 的资源引用并沿 import 图遍历），计算落地页入口的 JS/CSS 闭包，断言不含（按模块路径/包名）：`dexie`、`zod`、`antd`、`@lobehub`、`@tanstack/react-router`、`@tauri-apps`、`src/db`、`src/lib/storage`、`src/main.tsx`、`src/styles.css`；输出各资源 gzip 体积并与预算比较（默认首屏 JS ≤ 120 KB、CSS ≤ 15 KB，参数化）。失败即非零退出。
> 若 Vite 默认不产出 manifest，开启 `manifest: true` 会额外生成 `dist/.vite/manifest.json`（只增加一个文件）；实现时确认其不影响 Docker 镜像和桌面构建。

## 2. 目录结构（全部在 `src/landing/`，不被应用 import）

```
src/landing/
  main.tsx                入口：挂载 <Landing/>，initUmami()，自身错误兜底
  Landing.tsx             组装：舞台 + 幕 + 片尾字幕
  styles/landing.css      落地页自己的 CSS（令牌 + 排版 + 胶片/HUD 样式）
  film/
    timeline.ts           纯函数：progress → 当前幕、幕内进度、时间码
    scenes.ts             幕定义（时长权重、文案键、绘制器名）
    useFilmProgress.ts    滚动进度（rAF 平滑，visibility/IntersectionObserver 暂停）
    stage.tsx             固定舞台（100svh sticky）与 <canvas> 容器
    renderers/            Canvas 2D 绘制器（每幕一个纯函数 draw(ctx, state)）
      particles.ts        光点系统（对象池、固定上限、自适应数量）
      scene*.ts           各幕绘制（leader/spark/script/storyboard/agent/vault/delivery）
    webgl/                可选着色器层（独立懒加载 chunk）
      aurora.ts           原生 WebGL1/2，无依赖
      adaptive.ts         帧耗时采样与降级决策
  content/
    copy.ts               全部文案（真实能力 + 证据注释）
    faq.ts
  download/
    releases.ts           拉取/过滤/缓存发布信息
    platform.ts           系统与架构识别、资产选择（纯函数）
    DownloadCard.tsx
  credits/                片尾字幕组件（体验/下载/star/开源/FAQ）
  a11y/                   跳过动画、减少动效检测
```

## 3. 电影引擎

- **时间轴**：页面高度 = `sceneWeights` 之和 × `100svh`（固定舞台使用 `position: sticky; top: 0; height: 100svh`）。`progress = scrollY / (scrollHeight - innerHeight)`；`timeline.ts` 把 progress 映射为 `{sceneIndex, local(0..1), timecode}`，**纯函数、有单测**。
- **平滑**：`useFilmProgress` 在 rAF 中对目标进度做临界阻尼 lerp（系数随帧间隔归一化，避免高刷屏过快/低帧率过慢）；只有进度变化或粒子仍在运动时才继续排帧，静止时停帧。`document.hidden`、舞台离开视口时暂停。
- **绘制**：单个 `<canvas>`，DPR 上限 2，`ResizeObserver` 控制尺寸；每幕 `draw(ctx, {local, w, h, t, particles, quality})`；粒子使用预分配 `Float32Array` 结构，避免每帧分配；文字轮廓采样（把标题/剧本行渲染到离屏画布取像素点，生成目标位置）只在尺寸变化时重算。
- **HUD 与胶片边孔**：DOM + CSS（时间码用等宽数字、`font-variant-numeric: tabular-nums`），经 CSS 变量 `--film-progress` 更新（一次 `style.setProperty`，不触发 React 重渲染）。叙事文字由 `motion` 的 `useTransform`/`m.div` 与 CSS `animation-timeline: view()` 驱动；不支持 scroll-driven animations 的浏览器走 `IntersectionObserver` 触发的一次性入场（回退，不连续联动）。
- **质量自适应**：`quality ∈ {high, medium, low}`，由设备（`hardwareConcurrency`、`deviceMemory`、`pointer`、视口宽度）初判，运行时由帧耗时 p95 调整粒子数与 DPR；低档只保留文字/分镜绘制与少量光点。
- **键盘与跳过**：`Space/PageDown/PageUp/Home/End` 沿用浏览器原生滚动；提供"跳过动画"按钮（切换到静态版并记忆于 `localStorage`，失败不影响）。

## 4. 降级矩阵

| 条件 | 呈现 |
| --- | --- |
| `prefers-reduced-motion: reduce` | 静态堆叠：每幕一个区块（静态绘制的单帧画面 + 文案），无固定舞台与动画 |
| 无 JS / 脚本异常 | `landing.html` 内的静态 HTML（标题、卖点、下载与 GitHub 链接、FAQ） |
| 不支持 Canvas 2D | 静态版 |
| 手机/窄屏 | 第 1、2 层，粒子上限低、无 WebGL；单列布局 |
| 桌面高性能 | 第 3 层 WebGL（懒加载），掉帧自适应关闭 |
| 页面隐藏 | 暂停 rAF |

## 5. 下载与 GitHub

- `releases.ts`：`fetchLatestDesktopRelease(fetchImpl, now)`：先读缓存（`localStorage`，键 `cuepoint.landing.release`，6 小时，带版本号与时间，校验形状），命中且未过期直接返回；否则请求 `releases?per_page=30`（`Accept: application/vnd.github+json`），过滤 `!draft && /^desktop-v\d+\.\d+\.\d+$/`，按 semver 排序取首个，提取 `{tag, version, prerelease, htmlUrl, assets:[{name, size, url, digest?}], publishedAt}`；写缓存；失败（网络、非 200、限流 403/429、JSON 形状不符）返回降级对象 `{kind:"fallback"}`。**不带认证头；不设置 `cache: "force-cache"` 之类影响新鲜度的选项**；可选地使用缓存的 ETag 做条件请求。
- `stars`：同一仓库接口 `GET /repos/ROYIANS/Cuepoint`（只取 `stargazers_count`），同样缓存 6 小时；失败不显示数字。两个请求并行，互不影响。
- `platform.ts`：`detectPlatform(nav)`：`userAgentData?.platform` → `navigator.platform` → `userAgent`；Mac 架构通过 `userAgentData.getHighEntropyValues(["architecture"])`（仅 Chromium，异步，失败忽略）；Windows/Linux 默认 x64，ARM 提示（`getHighEntropyValues` 的 `architecture === "arm"`）则标记为不支持。`pickAssets(release, platform)`：按调研的命名规则用**严格正则**匹配（版本号取自 tag，匹配 `Cuepoint_<v>_...`）；返回 `{primary?, alternatives[], unsupportedReason?}`。
- 展示：推荐卡（主按钮 + 文件名/大小/SHA256 摘要折叠）、其它平台列表、"预发布 · 未签名，首次打开可能有系统安全提示（见安装指南）"链接到 `docs/desktop-installation.md`（GitHub 上的渲染页）。
- 链接：下载直链指向 GitHub 资产 URL（`browser_download_url`，只接受 `https://github.com/ROYIANS/Cuepoint/releases/download/` 前缀，防止接口返回被篡改的地址）。

## 6. 样式与一致性

- `styles/landing.css`：自己的 reset（最小）、令牌（`--surface-app #101010` 等，值取自 `styles.css`）、排版（`--font-sans`、`--font-display`）、`.studio-grain` 等价的颗粒（CSS 噪声背景，使用 SVG data URI 或渐变，避免额外请求）、入场曲线。**不 `@import "tailwindcss"`**（避免把整个 Tailwind 预检/工具类引入）；若实现时发现需要少量工具类，评估后再决定。
- 一致性测试 `tests/landingTokens.test.ts`：读取 `src/styles.css` 与 `src/landing/styles/landing.css`，提取关键令牌（背景/前景/surface/radius/字体栈）并断言相等；`styles.css` 令牌改变而落地页未同步时测试失败。
- 字体：`landing.html` 用 `<link rel="preconnect">` + `Noto Serif SC` 的 `text=` 子集（标题实际用到的字）+ `display=swap`；回退 `"Songti SC", "STSong", serif`。**这与应用 `index.html` 一致，属第三方请求**；如要自托管，需子集化后放进 `public/`（本任务首版不做，列为后续）。

## 7. SEO 与分享

`landing.html` 静态：`<title>`、`description`、`canonical`（`https://cue.vidorra.life/`，来源：GitHub 仓库 `homepage`；实现时核对）、`theme-color`、`og:*`、`twitter:*`、`SoftwareApplication` JSON-LD（名称、类别、操作系统、免费、许可证 MIT、`downloadUrl` 指向 Releases 页，不写具体版本号以免过期）、`<noscript>` 内容。`public/robots.txt`、`public/sitemap.xml`（只含 `/`）。OG 图首版 `logo-lockup.webp`，已知限制记录。

## 8. 统计

`landing/main.tsx` 调用 `initUmami()`（`src/lib/umami.ts` 是无依赖的小模块，可直接 import；它是应用与落地页共享的**唯一**应用侧模块，由预算脚本的"禁止模块"清单豁免）。事件通过 `data-umami-event="download-<platform>"`、`"try-online"`、`"star"`、`"skip-animation"`。

## 9. 测试

纯逻辑（`tests/landing*.test.ts`，jsdom + createRoot 基建，不新增依赖）：
- `timeline`：进度映射、边界（0、1、负值、NaN）、时间码格式；
- `platform`：各 UA/平台串（macOS arm/x64、Windows x64/ARM、Linux、iOS/Android、未知）→ 推荐与不支持；`pickAssets` 严格匹配、版本不符不匹配；
- `releases`：过滤（草稿、非 desktop tag、预发布）、semver 排序、缓存命中/过期/损坏、`localStorage` 抛错、非 200/限流/形状不符 → 降级、资产 URL 前缀校验；
- 令牌一致性；
- 组件：减少动效渲染静态版、下载卡在各状态（推荐/Mac 双 dmg/ARM 不支持/降级）、star 无数字时不渲染；
- 入口依赖边界的一部分由预算脚本验证（构建后）。
视觉与帧率无法自动测试，列为真机验证。

## 10. 回滚与兼容

- 新增文件为主；唯一的既有文件改动：`vite.config.ts`（input）、`deploy/nginx.conf`（一条 location）、`.gitignore`/`public/`（robots、sitemap）、可能的 `package.json` 脚本（`landing:budget`）。回滚即还原这些并删除 `src/landing`、`landing.html`。
- 应用代码、路由、样式、桌面构建不变。

## 11. 待用户在最终计划中确认的设计建议

1. **独立 HTML 入口**（而不是在应用里加路由）：落地页对应用零依赖；代价是官网 `/` 与应用成为两个页面，从落地页点"在线体验"是整页跳转（应用冷启动约 1.7 MB gzip），可用悬停预取缓解。
2. **`/` 改为落地页**；应用入口为 `/agent`；老书签用户先看到落地页，所以顶栏常驻"进入应用"。
3. **首版仅中文**，英文列为后续。
4. **OG 图用现有 logo-lockup.webp**，若社交预览不理想需你提供 PNG/JPG。
5. **字体沿用 Google Fonts 子集**（与应用一致的第三方请求），不自托管。
6. **性能度量**：实现后是否允许临时下载 Lighthouse（用本机 Edge）做测量；不同意则只做预算脚本与审查。
