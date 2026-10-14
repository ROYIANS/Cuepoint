# 实施计划：官网落地页（电影式）

## 前置条件

- 任务保持 `planning`，等待用户批准最终计划后才能 `task.py start`。
- 分支：从 `main` 新建 `codex/landing-page`（`main` 当前领先 `origin/main` 若干提交，均未推送）。
- 命令使用本地 Node：`PATH=/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin:$PATH`，显式调用 `/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm`。**不安装任何新依赖**；Lighthouse 需临时下载，须用户明确同意。
- 派发子代理时，提示词首行为 `Active task: .trellis/tasks/10-14-landing-page`。视觉与帧率无法在本机验证，每批汇报必须写明"未验证"。

## 阶段与有序清单（每阶段单独提交）

### 阶段 1：入口、部署与预算骨架（R1、R6、R7）
1. `landing.html`（静态 meta/OG/JSON-LD/noscript，外加最小可读的静态内容）、`src/landing/main.tsx`（最小挂载 + `initUmami()` + 自身错误兜底）、`src/landing/styles/landing.css`（令牌与基础排版）。
2. `vite.config.ts` 多页 input 与 manifest；`deploy/nginx.conf` 的 `location = /`；`public/robots.txt`、`public/sitemap.xml`。
3. `scripts/landing-budget.mjs` 与 `package.json` 脚本 `landing:budget`；验证桌面构建产物不含落地页；`pnpm build` 后预算通过。
4. 测试：令牌一致性。运行 lint、全量测试、quality、build、desktop 三项。

### 阶段 2：下载与 GitHub 引导（R4）
5. `download/platform.ts`、`download/releases.ts`（纯逻辑 + 缓存 + 降级）、`DownloadCard`、star 数组件；统计属性。
6. 测试：系统识别、资产选择、发布过滤与排序、缓存、降级、URL 前缀校验、组件状态。

### 阶段 3：电影引擎与首批场景（R2、R3）
7. `film/timeline.ts`、`scenes.ts`、`useFilmProgress.ts`、`stage.tsx`、HUD 与胶片边孔（CSS）；减少动效静态版；跳过动画。
8. Canvas 2D 粒子系统与片头、第一幕（光点→文字）绘制器；质量自适应。
9. 测试：时间轴映射、减少动效渲染、粒子池上限与自适应的纯逻辑。

### 阶段 4：其余场景与片尾字幕（R2、R4）
10. 第二至第五幕绘制器与文案（`copy.ts` 带证据注释）；片尾字幕（体验入口 + 诚实说明、下载、star、开源、FAQ/隐私）。
11. 测试：文案真实性清单（对照 research 第 3 节"不能声称"列表的禁用词断言）、片尾字幕组件。

### 阶段 5：WebGL 增强与打磨（R3）
12. `webgl/aurora.ts` 与自适应降级（独立懒加载 chunk，条件启用）；无 WebGL/上下文丢失的回退。
13. 性能打磨：rAF 调度、离屏画布复用、`contain`/`will-change` 使用审查；预算复测。

### 阶段 6：收尾
14. 全量门禁与预算脚本；独立检查（trellis-check）：依赖边界、下载链接前缀校验、降级、可访问性、文案真实性。
15. 规范同步：`component-guidelines.md`（落地页结构与降级矩阵）、`quality-guidelines.md`（预算脚本）、`directory-structure.md`、必要时 `docs/desktop-distribution.md`（落地页部署说明）。
16. **真实设备检查（A10，用户）**；若用户同意，用 Edge + Lighthouse 做测量并记录。
17. 归档与 journal，合并到本地 `main`；不推送、不发布。

## 验证命令

```sh
PATH=/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin:$PATH /Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm exec vitest run <定向测试>
PATH=... pnpm lint
PATH=... pnpm test
PATH=... pnpm quality
PATH=... pnpm quality:self-test
PATH=... pnpm models-dev:verify
PATH=... pnpm build
PATH=... pnpm landing:budget
PATH=... pnpm --dir desktop/tauri types
PATH=... pnpm --dir desktop/tauri lint
PATH=... pnpm --dir desktop/tauri quality
```
计划命令，尚未执行。

## 风险文件与检查点

- `vite.config.ts` / `deploy/nginx.conf`：影响应用构建与部署，改动小但必须验证 `/agent` 深链接与桌面构建不变。
- `src/landing/**` 不得 import 应用模块：由预算脚本与 `quality` 的架构检查共同守护；任何越界即失败。
- 下载区：直链前缀校验与降级，是"不把用户引到错误地址"的安全边界。
- 视觉与性能：无法本机验证；每阶段汇报必须诚实标注。
- 文案：只写有证据的能力，由禁用词测试与独立检查守护。

## 回滚

阶段独立提交；回滚即还原 `vite.config.ts`、`deploy/nginx.conf`、`public/` 的小改动并删除 `src/landing`、`landing.html`、`scripts/landing-budget.mjs`。
