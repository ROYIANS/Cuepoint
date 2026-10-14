# Research: codebase-constraints (landing page inside the Cuepoint SPA)

- **Query**: Constraints for adding a landing page to the existing React 19 + TanStack Router + Vite + Tailwind 4 app (browser/nginx + Tauri desktop)
- **Scope**: internal (read-only)
- **Date**: 2026-10-14
- Legend: [FACT] = read from code/dist; [INFER] = my deduction.
- Note: `dist/` already existed (built 2026-10-14 07:55, hash `index-DEyRa3fg.js`); I did NOT rebuild. `git status` shows no src changes, so dist is assumed to match HEAD [INFER].

---

## 1. Routing and entry

### Files
| File | Role |
|---|---|
| `src/main.tsx` | Entry. `initUmami()` (L16), `installNativeExternalLinks()` (L17), `createRouter` (L19-25), `installGlobalErrorHandlers()` (L28), `startApplication()` (L52-80) |
| `src/routes/__root.tsx` | Root route: `TooltipProvider > UndoProvider > Outlet + Toaster`, and the only place `@/styles.css` is imported (L5) |
| `src/routes/_studio.tsx` | Pathless layout `/_studio` -> `StudioShell` -> `AppFrame` (rail, top bar, Sheet nav, header/panel portals) |
| `src/routes/_studio.index.tsx` | `/` -> `throw redirect({to: "/agent"})` (L4-6). This is the ONLY owner of `/` |
| `src/routes/p.$projectId.tsx` (+ children) | Top-level `/p/...` project workspace, NOT under `_studio`; uses its own `WorkspaceChrome` (also AppFrame) |
| `src/routeTree.gen.ts` | Generated, but BOTH `git ls-files` lists it (tracked) AND `.gitignore` lists it. Header: `eslint-disable`, `@ts-nocheck` |
| `src/lib/runtimeIdentity.ts` | `isTauriRuntime()` = `typeof window.__TAURI_INTERNALS__?.invoke === "function"` (whole file, 6 lines) |

### How a standalone top-level route fits [FACT + INFER]
- File routes are flat dot-names. `_studio.*` = pathless layout prefix (wraps in StudioShell/AppFrame). `p.$projectId.*` is a top-level sibling that is not wrapped by `_studio`. A new `src/routes/welcome.tsx` (path `/welcome`) would be a root child, NOT wrapped by `_studio`/AppFrame [INFER from the same pattern as `p.$projectId`].
- `/` can only have one owner. `_studio.index.tsx` currently resolves to path `/` (routeTree.gen.ts has `id:'/' path:'/'` entries). A new `src/routes/index.tsx` (path `/`) would collide with `_studio.index.tsx` -> the latter must be removed/renamed/changed, else duplicate-route error from the generator [INFER; TanStack behaviour].
- Existing redirect style to copy: `src/routes/_studio.settings.tsx` -> `beforeLoad: () => { throw redirect({to: "/about", replace: true}); }`. Other redirects: `p.$projectId.{produce,report,shots,plan}.tsx`, `p.$projectId.assets.index.tsx`.
- Root route is a single global wrapper. Everything under `/` (including a landing page) gets `TooltipProvider`, `UndoProvider`, `<Toaster/>` (`__root.tsx:12-18`) and the global stylesheet (`__root.tsx:5`). To avoid them for a landing route one would have to restructure `__root` (e.g. move providers into a pathless layout such as `_app.tsx` wrapping `_studio`/`p.*`) or leave them (they are small: sonner + radix tooltip + undo context) [INFER]. `__root` does not branch on pathname today.
- `Toaster`/`UndoProvider` are not "heavy" but `sonner` is statically in the main chunk (126 occurrences in `index-DEyRa3fg.js`).
- `defaultNotFoundComponent: NotFound`, `defaultErrorComponent: ErrorFallback` (`main.tsx:22-23`) apply to any route.
- Router has no `basepath`; `createRouter({routeTree, history: createProductRouterHistory(), ...})` (`main.tsx:19-25`).

### Desktop (Tauri) loads the same bundle -> would see the landing page at `/` [FACT/INFER]
- History: `createProductRouterHistory()` -> `isNativeWorkspaceRuntime() ? createHashHistory() : createBrowserHistory()` (`src/lib/productRouterHistory.ts:5`); `isNativeWorkspaceRuntime()` = `isTauriRuntime()` (`src/lib/nativeWorkspace.ts:197-199`). So desktop URL is `index.html#/...`; initial desktop location is `/` -> without gating, desktop would show the landing page. Gate is needed in the new `/` route's `beforeLoad` (e.g. `if (isTauriRuntime()) throw redirect({to:"/agent"})`), [INFER, mechanism exists].
- Existing runtime-branch practices:
  - `isTauriRuntime()` used in: `components/studio/AboutPage.tsx:22`, `materials/MaterialPreview.tsx`, `errors/ErrorDetailsDialog.tsx`, `produce/ProducePage.tsx`, `lib/productStorage.ts:40`, `lib/runtimePrint.ts`, `lib/nativeWorkspace.ts`, `lib/windowChrome.ts:13`, `lib/runtimeFetch.ts`, `lib/runtimeSave.ts`, `lib/runtimeExternalLinks.ts:6`, `lib/diagnostics/errorReport.ts`.
  - `getWindowChromeKind()` -> `"macos-overlay" | "native" | "browser"` (`lib/windowChrome.ts`); spec in `.trellis/spec/frontend/desktop-ui.md` L21.
  - Pattern is a synchronous module-level/function check; there is no Vite env flag for "desktop build" (desktop build injects only `__APP_VERSION__`, `__ACCEPTANCE__`, `__STREAM_*`: `desktop/tauri/scripts/build-frontend-worker.mjs`).
- Tauri window config: `desktop/tauri/src-tauri/tauri.conf.json` L7 `frontendDist: ../dist/normal`; L11 window title "小光点 Cuepoint". `installNativeExternalLinks` (`lib/runtimeExternalLinks.ts`) makes cross-origin `<a href>` open in the system browser under Tauri, so external links (GitHub, download) in a landing page work in desktop too if ever shown.

---

## 2. Build and chunking

### Config [FACT]
- `vite.config.ts`: plugins `tanstackRouter({target:"react", autoCodeSplitting:true})`, `react()`, `tailwindcss()`; alias `@`; `define __APP_VERSION__`. No `build.rollupOptions`/`manualChunks`. Single `index.html` input, `base` default `/`.
- `autoCodeSplitting: true` IS on for the web build: dist has one chunk per route (`_studio-*.js`, `_studio.agent-*.js`, `p._projectId.*-*.js`, ...), and `index-DEyRa3fg.js` references them through `__vite__mapDeps` dynamic imports.
- DESKTOP build is different [FACT]: `desktop/tauri/scripts/build-frontend-worker.mjs` calls `vite.build({configFile:false, plugins:[react(), tailwind()], ...})` -> no `tanstackRouter` plugin, so route files are NOT auto-split; `routeTree.gen.ts` (committed) has plain static `import { Route as X } from './routes/...'` (no `lazy`/`import()`; grep found none). Evidence: `desktop/tauri/dist/normal/assets/index-KAykOZRU.js` is 3,812,408 B (vs 1,050,148 B web) [FACT, built 2026-10-13, may be stale]. Any landing page code lands in the desktop eager bundle unless loaded via an explicit `import()` [INFER]. The desktop build also needs a `routeTree.gen.ts` containing the new route (it is tracked in git).
- `dist/index.html` (web): one `<script type="module" src="/assets/index-DEyRa3fg.js">` + one `<link rel=stylesheet href="/assets/index-DnqeorQn.css">`; no modulepreload tags.

### Sizes (web dist, no rebuild) [FACT]
| Asset | Raw | gzip |
|---|---|---|
| `index-DEyRa3fg.js` (main, loaded on every route) | 1,050,148 B | 306,266 B |
| `index-DnqeorQn.css` (main) | 76,667 B | 14,335 B |
| `_studio-BVXmxOJx.js` (layout) | 1,692 B | - |
| `_studio-DxxtBTXu.css` / `_studio-DFoPSMMr.css` | 82,886 / 8,200 B | - |
| `_studio.agent-dsK4r7PK.js` (route `/agent`) | 1,593,033 B | 501,726 B |
| `MessageList-D4HAtDcU.js` (+ `.css` 18,843 B) | 3,572,448 B | 921,647 B |
| other: `emacs-lisp` 790K, `cpp` 785K, `wasm` 622K, `docx.worker` 600K, `pdf` 407K (lazy shiki/doc chunks) | | |

- 657 assets, 601 `.js` in dist/assets.
- `/agent` payload: main (1.05 MB) + `_studio` layout + `_studio.agent` (1.59 MB) + shared chunks it statically imports (AppHeaderPortal, MemoryEditor, ModuleLayout, dropdown-menu, projectPackage, mimoSpeech, ...) + `MessageList` (3.57 MB, includes @lobehub/ui + antd; reached from agent chat) ≈ >= 6.2 MB raw / >= 1.7 MB gzip, before css and lazily-fetched shiki grammars [INFER sum; per-file sizes are FACT. I did not trace which chunk imports MessageList].

### Main chunk contents [mix]
- Contains (counted by string occurrence in minified bundle): Dexie (18), zod (7), sonner (126), Radix (22), IndexedDB (19), router. Does NOT contain antd/lobehub/@tanstack literal-names ("antd" 0 hits; minified names mangled, so weak evidence), no "创作助手"/AppFrame strings -> AppFrame lives in `_studio-*` chunk [INFER].
- Why main includes Dexie/zod/storage: `main.tsx` statically imports `@/db/database` (L21; `database.ts:1-9,34` imports `@tauri-apps/api/core`, `productStorage`, `browserDatabase`, `storage/native*`; creates `export const db = selectProductStore()` at module eval), `@/lib/ai/modelCatalog/store` (L22; baseline JSON is lazy: `store.ts:23 await import("./baseline.generated.json")`), error components, diagnostics, `@/lib/umami`, routeTree. Plus `__root.tsx` -> sonner, radix tooltip, undo, `styles.css`.
- Cannot split these from the landing page with route-level lazy loading: they are in `main.tsx`'s static graph, which every route/visitor downloads [FACT/INFER]. Landing visitors currently would pay ≈ 306 KB gz JS + 14 KB gz CSS + fonts, i.e. the main chunk, plus the landing route chunk.

### Is route lazy loading on? Answers
- Web: yes, `autoCodeSplitting` (route components and loaders split to `*.js` per route). Desktop: no (see above).
- Making "visitors download only landing, app on click":
  - Route-level lazy (already the default pattern for new route files in web build): landing route chunk is separate, but main chunk (1.05 MB/306 KB gz) is unavoidable since it is `main.tsx`'s static graph, [FACT]. Reaching "only landing assets" requires removing storage/error/umami/modelCatalog/undo/sonner imports from `main.tsx`'s static graph (e.g. dynamic `import()` of app bootstrap) or a second HTML entry.
  - Second HTML entry (`landing.html` + own tiny `main`): would need `build.rollupOptions.input` in `vite.config.ts` AND the desktop build script (`build-frontend-worker.mjs` uses `root: projectRoot`, default single index.html). nginx currently serves `/` -> `index.html` via `try_files` (`deploy/nginx.conf`), so mapping `/` to another file needs nginx change [INFER].
  - `manualChunks`: not configured; unnecessary for lazy routes, would not reduce main chunk by itself [INFER].
- Where each style layer is loaded [FACT]:
  - `src/styles.css` (372 lines; Tailwind 4 `@import "tailwindcss"`, `tw-animate-css`, tokens, AppFrame/`.page-header`/`.module-*` shell rules at L~100-372) imported once, globally, from `__root.tsx:5` -> the `index-*.css` (76,667 B). Landing route cannot avoid it unless `__root` stops importing it [FACT]; Tailwind only emits utilities used in source so utilities in landing code would also land here.
  - Per-feature CSS imported next to components (`agentChat.css`, `ipProfiles.css`, `materialLibrary.css`, `taskWorkspace.css`, ...) -> emitted as route-chunk CSS (`_studio-*.css` 82 KB, `MessageList-*.css`, `p._projectId-*.css` 27 KB) -> not in first paint for `/`.
  - antd / @lobehub/ui are imported only by Agent components (`components/agent/*.tsx`: AgentHeader, HomeWelcome, AgentChatPage, ModelSettingsMenu, ThinkingPanel, ...; `LobeChatTheme.tsx:1` `ConfigProvider, ThemeProvider` + `motion/react-m`). They are CSS-in-JS (no .ant-/lobe- classes found in `index-*.css`: 0 hits) and are scoped: `LobeChatTheme.tsx` doc comment "Scopes @lobehub/ui + antd theme to the Agent chat tree only ... Do not import antd/dist/reset.css". Spec forbids global antd reset: `desktop-ui.md` L41, `component-guidelines.md` L126.
- **Forced first-screen dependency chain for a landing at `/` (web)** [FACT chain, INFER sizes]:
  1. `index.html` -> Google Fonts CSS (`Noto Serif SC` 500/700) via `fonts.googleapis.com` (render-blocking stylesheet; 2 preconnects)
  2. `/assets/index-DEyRa3fg.js` (306 KB gz): react, react-dom, @tanstack/react-router, routeTree + route components, Dexie/zod/storage (`db` created at import), sonner, radix tooltip, undo, error components, diagnostics
  3. `/assets/index-DnqeorQn.css` (14 KB gz): Tailwind base + tokens + shell rules
  4. `await initializeProductStorage()` (`main.tsx:55`, = `db.open()` `database.ts:34`) must resolve before the first render
  5. landing route chunk (new)
  6. `logo.webp` 133 KB / `logo-lockup.webp` 450 KB if used
  - `motion` is only imported at `components/agent/LobeChatTheme.tsx:2` (`motion/react-m`) -> not in main chunk today; a landing using `motion` adds its bundle to the landing chunk, and `m` namespace style (LazyMotion needed with `m.*`) [INFER].
- Desktop: everything above plus all route code in the single 3.8 MB index (stale build), so landing adds nothing extra visible.

---

## 3. Design tokens and brand

### `src/styles.css` [FACT]
- `@theme inline` maps (L6-47): `--color-background/foreground`, `--color-surface-{navigation,app,panel,elevated}`, `--font-sans: "PingFang SC","Hiragino Sans GB","Noto Sans SC","Source Han Sans SC","Segoe UI",sans-serif`, `--font-display: "Noto Serif SC","Songti SC","STSong",serif`, sidebar/ring/border/input/destructive/accent/muted/secondary/primary/popover/card/`--color-brand(-foreground)`/`--color-dashed`, radius `sm=r-4px, md=r-2px, lg=r, xl=r+4px`.
- `:root` only (single theme, dark; no `.dark` var block). `html` has `class="dark"` in index.html and `color-scheme: dark` (L~100): `--radius .75rem; --surface-navigation #0c0c0c; --surface-chrome #242424; --surface-app #101010; --surface-panel #151515; --surface-elevated #202020; --foreground oklch(.97 0 0); --primary oklch(.97 0 0)/fg oklch(.18 0 0); --secondary oklch(.255 0 0); --muted oklch(.24 0 0); --muted-foreground oklch(.7 0 0); --destructive oklch(.68 .19 22); --border oklch(1 0 0 / 10%); --input /12%; --ring /55%; --brand oklch(.97 0 0) (white, i.e. NO chromatic brand color); --dashed /45%; --shell-inset 8px; --shell-radius 16px; --shell-rail-width 56px`.
- Base: body `font-sans`, 14px/22px, bg `--background`; `button{cursor:pointer}`.
- Palette is strictly neutral grayscale; only chromatic hint is `--destructive` and Agent chat's `colorInfo "#60b1ff"` (`LobeChatTheme.tsx`).
- Grain/entrance effects already exist: `.studio-grain` (SVG feTurbulence data-URI, opacity .04, overlay blend, steps animation only under `prefers-reduced-motion: no-preference`, L~214-225) and `.studio-enter > *` staggered `studio-in` keyframes (cubic-bezier(.22,1,.36,1), .48s, delays 0/45/90 ms...). Reusable keyframe/easing vocabulary [FACT].
- Headings: `.page-header h1` sans 24px/600/-.025em; `--font-display` (Noto Serif SC) is loaded from Google Fonts in `index.html` and available as `font-display`; I did not grep which pages use it (not verified).

### Brand [FACT]
- `src/lib/brand.ts`: `PRODUCT_NAME_ZH="小光点"`, `PRODUCT_NAME_EN="Cuepoint"`, `PRODUCT_TAGLINE="本地优先的影视创作工作室：项目、分镜、资产与交付，密钥只留在本机。"`, `GITHUB_URL="https://github.com/ROYIANS/Cuepoint"`, `LOGO_SRC="/brand/logo.webp?v=20260922"`, `LOGO_LOCKUP_SRC="/brand/logo-lockup.webp?v=20260922"`.
- `public/` contains only `brand/`: `logo-16/32/256.png`, `logo.webp` (133,254 B), `logo-lockup.webp` (450,466 B), `sponsor-wechat.jpg`, `README.md`. No favicon.ico, robots.txt, sitemap.xml, OG image, screenshots.
- `index.html`: `<html lang="zh-CN" class="dark">`, `<title>小光点</title>`, three PNG icon links with `?v=20260922`, Google Fonts preconnect + `Noto Serif SC`. NO `description`, NO `theme-color`, NO og/twitter tags.
- Existing About page `components/studio/AboutPage.tsx` already uses lockup (`bg-black`, `rounded-md`), tagline, GitHub link (`text-brand`, focus ring `focus-visible:ring-[3px]`, `ExternalLink` icon), sponsor links (afdian, WeChat QR).
- Icons: `@/components/ui/icons` = static Phosphor imports (spec `desktop-ui.md` L56).

### Reusable for "consistent style" vs app-shell-only
- Reusable: `--surface-*`, `--foreground`, `--muted-foreground`, `--border`, `--ring`, `--radius`, `font-sans/font-display`, `bg-background`, `text-brand`, `Button` (shadcn new-york, `components.json`), Phosphor icon wrapper, keyframes/easing from `.studio-enter`, `.studio-grain`, brand.ts constants.
- Shell-only (do not reuse): `.app-frame`, `.app-topbar*`, `.app-nav*`, `--shell-*`, `.module-*`, `.page-header/.page-content/.page-content-workbench` (100dvh/overflow hidden frame; `html,body,#root{min-height:100%}`), `.studio-floor`, `.studio-content-surface`, `--surface-chrome`, antd/LobeHub theme (`LobeChatTheme`), Radix Sheet navigation. Desktop-ui spec notes: "avoid decorative accent strips and nested cards" (`desktop-ui.md` L49) governs functional pages; landing is not under that spec, but spec is the only stated visual contract [INFER on applicability].

---

## 4. Deployment and SEO

- `deploy/nginx.conf` [FACT]: port 80, `root /usr/share/nginx/html`, `gzip on` for `text/css application/javascript application/json image/svg+xml` (not `text/html`-extra; html is gzip-default; NOT `image/*` raster, `.wasm`, `.bcmap`, `.pfb`, `.ttf`); `location /assets/` -> `expires 7d` + `Cache-Control: public, immutable` + `try_files $uri =404`; `location /` -> `Cache-Control: no-cache`, `try_files $uri $uri/ /index.html`. No brotli, no security headers, no `/brand/` caching rule (logos use `?v=` query and fall under `/` -> no-cache). Any static file placed in `public/` (robots.txt, sitemap.xml, og image) is served by the `try_files $uri` branch with `no-cache`.
- `Dockerfile` [FACT]: `node:22-bookworm-slim` build (`corepack enable`, `pnpm install --frozen-lockfile`, `ARG VITE_UMAMI_SCRIPT_URL/VITE_UMAMI_WEBSITE_ID`, `pnpm build`) -> `nginx:1.27-alpine` + `deploy/nginx.conf` + `/app/dist`.
- `docker-compose.yml`: image `ghcr.io/royians/cuepoint:latest`, `8080:80`, no env.
- `.github/workflows/ghcr.yml`: `quality` job (pnpm lint, `pnpm quality`, quality self-test, native probe, `pnpm test`, models-dev verify, `pnpm build` with Umami vars) then `docker` job (not read past L60).
- Desktop installers: releases at `https://github.com/ROYIANS/Cuepoint/releases/download/__TAG__/Cuepoint___VERSION___macos_arm64.dmg` / `..._macos_x64.dmg` / `..._windows_x64_setup.exe` (`docs/desktop-release-template.md` L26-28); tag format `desktop-vMAJOR.MINOR.PATCH` (`docs/desktop-distribution.md` L65); release workflow `.github/workflows/desktop-release.yml`. Releases are draft prereleases (L65-67) -> `releases/latest` may not exist for them [INFER]; unsigned ("未知发布者" / macOS manual open, template L45-57). Tauri bundle `targets: ["app"]` (`tauri.conf.json` L18), Linux deb/appimage config present.
- SEO [FACT/INFER]:
  - Client-rendered SPA: `dist/index.html` has an empty `<div id="root">`; crawlers/social scrapers that do not run JS see only `<title>小光点</title>`. OG/Twitter/description meta must be static in `index.html` (or prerendered HTML) to be seen by link-preview bots (they do not run JS); TanStack Router has no head management wired in this repo (no `head()` usage grep'd; not verified).
  - Static meta in `index.html` is global: applies to every route (`/agent`, `/p/...`) since all share one document; `<title>` is currently static and no route updates `document.title` (not verified by grep). Adding OG tags would not break app routes functionally [INFER]; desktop loads the same `index.html` (CSP `img-src 'self' blob: data:` -> OG tags are inert).
  - No robots.txt, sitemap.xml, canonical, or JSON-LD exist in repo (grep for robots/sitemap/og: found none outside node_modules/dist).
  - Non-`/` SEO is moot for hash-history desktop; browser history `/` is crawlable but needs nginx to serve index.html (already via `try_files`).
- Desktop CSP (`tauri.conf.json` L14): `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; font-src 'self' data:; connect-src ipc: http://ipc.localhost 'self'` -> Google Fonts stylesheet and any remote image/fetch (e.g. GitHub stars API) are blocked in desktop; irrelevant if landing is never shown there. In browser there is no CSP header from nginx [FACT].
- Umami [FACT]: `src/lib/umami.ts` `initUmami()` - returns unless `import.meta.env.PROD` and both `VITE_UMAMI_SCRIPT_URL`/`VITE_UMAMI_WEBSITE_ID` are valid http(s); appends `<script id="cuepoint-umami" async data-website-id=...>` once; called at `main.tsx:16`, outside React, runs in desktop too (Tauri CSP would block remote script; not an issue for landing). Spec (`quality-guidelines.md` L275-279): rely on Umami's own SPA pageviews; do not add router listeners or manual pageview calls; no project contents/prompts/credentials in events. There is NO `umami.track`/custom event helper in the repo (only that one file); custom events would be via `window.umami?.track(...)` or `data-umami-event` attributes on elements [INFER: standard Umami tracker features; not used in repo today, so `.d.ts` for `window.umami` doesn't exist].

---

## 5. Motion, accessibility, quality gates, tests

### Motion usage [FACT]
- `motion` (^12.43.0, package.json) imported in exactly one place: `src/components/agent/LobeChatTheme.tsx:2` `import * as m from "motion/react-m"` passed to `<ConfigProvider motion={m}>`. No `motion.div` usage in app code.
- Other animations are pure CSS: `.studio-enter`, `.studio-grain` (`styles.css` L210-240) , per-feature css (`agentChat.css`, `taskWorkspace.css`, `generationBatch.css` ...), canvas `ClickSpark` (`components/ui/click-spark.tsx`, JS matchMedia check L13-15, 97) which is "only an immutable browser-regression fixture dependency; not mounted in the application shell" (`component-guidelines.md` L89), `ThinkingMatrix.tsx:70` (matchMedia reduced motion).
- Reduced-motion convention: CSS `@media (prefers-reduced-motion: reduce)` blocks next to the animation (styles.css L210, ipProfiles.css L524, agentChat.css L556/855/900/976/1032, ...) or JS `window.matchMedia("(prefers-reduced-motion: reduce)")` (click-spark.tsx, ThinkingMatrix.tsx). No `useReducedMotion` hook usage; no motion `MotionConfig reducedMotion` usage [FACT, grep].
- Specs: `quality-guidelines.md` L70-75 "Mark decorative motion/graphics aria-hidden (ClickSpark)", "Honor prefers-reduced-motion for decorative animation (ClickSpark, src/styles.css)"; `component-guidelines.md` L99-105 Accessibility (aria-hidden decorative; accessible names), L89 decorative motion respects reduced motion; `desktop-ui.md` L45-57 (focus trap, 44px mobile targets, `ActionIcon` base-ui for keyboard activation, Phosphor icons). Focus ring convention: `focus-visible:ring-[3px] ring-ring/50` (AboutPage) and AppFrame `FOCUS` const.

### Quality gates [FACT]
- `pnpm quality` = `scripts/quality-check.mjs` -> three sections: lint (`eslint.config.mjs`: `complexity` warn 20, `sonarjs/cognitive-complexity` warn 20, `sonarjs/no-identical-functions` warn, `no-duplicated-branches`/`no-identical-conditions` error, react-hooks), architecture (`scripts/quality/architecture.mjs`: static value-import cycles = failure; `src/domain` must not import `src/db` or UI; `src/db` must not import UI), unused (knip, `knip.json`: entry `src/main.tsx!`, `tests/**/*.test.{ts,tsx}`, project `src/**/*.{ts,tsx}!`, `includeEntryExports: true` -> unused exports/files are failures; contracts in `quality/unused-contracts.json`). The runner also hashes `src,scripts,tests,quality,index.html,vite.config.ts,...` before/after and fails if inputs change during run.
  - Implication [INFER]: every exported component/const must be imported from a reachable entry or test; route files are reachable via generated `routeTree.gen.ts` (which knip sees as an owned file). Large presentation components with many branches may raise complexity warnings (warn, not error). Static import cycles between new landing modules fail the gate.
- Type check: `pnpm lint` = `tsc -b`.
- Tests: vitest (`vitest.config.ts`), `tests/*.test.ts(x)` (255 entries); DOM tests use jsdom + `createRoot` (e.g. `tests/agentMessagePresentation.test.ts`, `agentToolTimeline.test.ts`, `contextPanelDom.test.ts`), no React Testing Library [FACT per brief; devDeps contain `jsdom` and no RTL]. Router harnesses in `tests/fixtures/*/harness.tsx` use `createMemoryHistory`. `tests/repo.test.ts` is the repo-invariants test (grep for index.html/routes/main.tsx returned nothing in it).
- Quality spec says pure visual changes need native evidence rather than snapshot tests (`desktop-ui.md` L87).

---

## 6. Risk list (file:line)

1. Every visitor runs `await initializeProductStorage()` before first render: `src/main.tsx:55` -> `db.open()` (`src/db/database.ts:34`). `db` itself is instantiated at module import (`database.ts:26` `export const db = selectProductStore()`), meaning on first visit the browser Dexie/IndexedDB database `browserDatabase` is created/opened (only constructed at `lib/storage/browserDatabase`; I did not read that file, so whether an IndexedDB DB is created at import vs open is not verified). If open fails (private mode, blocked IDB) the whole app renders `RootErrorFallback` "工作区无法打开" (`main.tsx:72-79`) INSTEAD of the router -> a landing visitor with broken storage would not see the landing page [FACT].
2. `void initModelCatalog()` (`main.tsx:57`): not awaited; does a dynamic import of `baseline.generated.json` and reads `getDeviceSetting` (`lib/ai/modelCatalog/store.ts:1,23,35`) -> extra network fetch + IDB read for landing visitors [FACT]. Desktop dist includes `models.generated-*.js` 1.1 MB.
3. Global side effects at module scope in `main.tsx` unconditional on route: `initUmami()` L16, `installNativeExternalLinks()` L17 (no-op in browser), `getHistoryNavigation(router.history)` L26, `router.subscribe("onResolved", ... addBreadcrumb)` L27, `installGlobalErrorHandlers()` L28 (`components/errors/showError`) [FACT]. These stay for all routes; global error handler path shows toasts/dialogs (`ErrorDetailsDialog` mounted at `main.tsx:63`).
4. Router history blockers: `createProductRouterHistory()` serializes push/replace through a queue and wraps `history.block` (`src/lib/productRouterHistory.ts:5-52`); `src/lib/historyNavigation.ts` tracks entries via `__TSR_key/__TSR_index` (L5-13) and is read by `AppFrame.tsx:~35` (`getHistoryNavigation(router.history)`, `useSyncExternalStore`). A landing route outside AppFrame does not use them but still goes through the queued history; navigating to `/agent` from the landing must go through router `Link`/`navigate` (async queue) rather than `location.href` to keep entries consistent [INFER]. A `redirect` thrown in `beforeLoad` for `/` is the existing pattern (`_studio.index.tsx:4-6`).
5. Root providers apply to the landing: `__root.tsx:12-18` `TooltipProvider`, `UndoProvider` (`lib/undo.tsx:84`), `<Toaster/>`; `styles.css` global base (`html,body,#root{min-height:100%}`, `html{color-scheme:dark}`, `body{font-size:14px;line-height:22px}`; `button{cursor:pointer}`; `* {border-border outline-ring/50}`) apply to the landing and must be accounted for [FACT].
6. `/` ownership + desktop: `_studio.index.tsx` is `/` (redirect to `/agent`). Desktop at startup opens `#/` (hash history) and relies on this redirect to reach the app; replacing it without a `isTauriRuntime()` branch makes desktop show the landing [FACT/INFER]. Spec mentions `/settings` etc. as redirects but no spec states `/` behaviour (not verified exhaustively).
7. `routeTree.gen.ts` is tracked AND gitignored: adding a route file requires regenerating it (web `vite dev/build` regenerates via plugin; desktop build script has no router plugin so it consumes the committed tree). Stale tree -> desktop build lacks the new route [FACT: ls-files + .gitignore line; INFER consequence].
8. Desktop build lacks route code-splitting (see §2) -> landing code and assets ship inside the desktop bundle even if never shown; CSP blocks Google Fonts & remote requests there (`tauri.conf.json` L14) [FACT].
9. `index.html` loads Google Fonts `Noto Serif SC` with `display=swap` (render-blocking `<link rel=stylesheet>`); Noto Serif SC is a large CJK webfont (subsetted by Google via unicode-range) -> affects landing first paint in the browser; blocked in desktop (falls back to Songti/STSong) [FACT].
10. nginx: `/brand/*` images and any new `public/` assets are served with `no-cache` (not under `/assets/`), only hashed `assets/*` get 7d immutable; images imported via JS/CSS get hashed and go to `/assets/` [FACT]. Raster/`webp`/`wasm`/fonts are not in `gzip_types` (already compressed or not matched).
11. Quality gate: new exports unused by an entry fail `pnpm quality` unused check (`knip.json` `includeEntryExports: true`); static cycles fail architecture check (`scripts/quality/architecture.mjs:87-94`); hashing of `index.html` and `vite.config.ts` as inputs means edits during a run fail (irrelevant for normal flow).
12. No existing `og`/`robots`/`sitemap`/`theme-color`/description anywhere -> not a regression risk, but everything for SEO is greenfield (grep confirmed none).
13. Umami: tracking relies on automatic SPA pageview; no custom event helper; spec forbids manual pageview calls and sensitive payloads (`quality-guidelines.md` L275-279). Umami script only injected in `import.meta.env.PROD` builds with env vars (`umami.ts:4-8`) -> not testable in dev.

## Caveats / Not verified
- Did not run `pnpm build` (dist already present); dist may lag HEAD slightly (git shows no src diff, commit time 08:01 vs dist 07:55 -> likely equal).
- Did not trace which chunk statically imports `MessageList` (3.57 MB), nor measured exact per-module weights inside `index-*.js`; the "/agent >= 6.2 MB raw" figure is a sum of known files, not a network trace.
- `lib/storage/browserDatabase.ts` and `components/errors/showError.ts` not read; IndexedDB creation timing at module import is not confirmed.
- No grep done for `document.title` updates or `head()` usage in routes.
- `.github/workflows/ghcr.yml` docker job and `desktop-release.yml` not read in full; whether a stable "latest" desktop release URL exists is unconfirmed (docs describe draft prereleases and tag-specific URLs).
