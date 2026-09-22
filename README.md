# 小光点 Cuepoint

本地优先的影视分镜工作台：从剧本场次到镜头表、资产与制作交付，面向 AI 辅助成片的前期与中期流程。

## 能做什么

- **工作室资产库**：角色、场景、道具、风格资产库；可快照进项目
- **单片或连载**：电影式单集，或系列多集共用世界
- **故事 → 分镜 → 制作**：场次与镜头编辑、状态与筛选、拖拽/键盘排序
- **交付**：集级 CSV 导出与可打印故事板
- **备份**：项目 ZIP 导入导出（格式 `aifenjing-project-v1`，本地 IndexedDB）

项目数据与会话保存在本机浏览器的 IndexedDB 中，无需自建后端。使用 AI 功能时，请求会发送到你配置的服务供应商。

## 技术栈

Vite · React · TypeScript · TanStack Router · Dexie · Tailwind · Vitest

## 开发

需要 Node.js 与 [pnpm](https://pnpm.io)。

```bash
pnpm install
pnpm dev
```

| 命令 | 说明 |
| --- | --- |
| `pnpm dev` | 本地开发 |
| `pnpm build` | 生产构建 |
| `pnpm preview` | 预览构建结果 |
| `pnpm test` | 单元测试 |
| `pnpm lint` | TypeScript 检查 |

## 部署

镜像发布在 [GHCR](https://github.com/ROYIANS/Cuepoint/pkgs/container/cuepoint)：`ghcr.io/royians/cuepoint`。

推送到 `main` 会打 `latest`；打 `v*` 标签会再推 semver。仓库需开启 Actions 写 Packages 权限（Settings → Actions → General → Workflow permissions → Read and write）。

```bash
# 私有包需要登录；公开包可跳过
echo "$GITHUB_TOKEN" | docker login ghcr.io -u YOUR_GITHUB_USERNAME --password-stdin

docker compose pull
docker compose up -d
```

浏览器打开 http://localhost:8080 。数据仍在访问者浏览器的 IndexedDB，容器里不存项目和密钥。

本机构建（不拉 GHCR）：

```bash
docker build -t ghcr.io/royians/cuepoint:latest .
docker compose up -d
```

### Umami analytics (optional)

Connect an existing Umami instance by opening **GitHub repository → Settings → Secrets and variables → Actions → Variables** and adding these repository variables:

| Repository variable | Value from the Umami website's tracking code |
| --- | --- |
| `VITE_UMAMI_SCRIPT_URL` | The full script `src`, for example `https://analytics.example.com/script.js` |
| `VITE_UMAMI_WEBSITE_ID` | The `data-website-id` for this website |

Use the exact script URL from Umami, including any custom script filename. Use HTTPS when Cuepoint is served over HTTPS. Both values are public and embedded in the browser bundle; never put an Umami admin password or API token here.

After setting or changing the variables, run **Actions → Quality checks and GHCR image → Run workflow** on `main` (or push to `main`). Wait for the image publication to finish, then update your deployment:

```bash
docker compose pull
docker compose up -d
```

The workflow passes the variables to both the production build and Docker build. Docker Compose needs no analytics configuration. These are **build-time** values: changing repository variables or adding container environment variables does not update an already-built image. To disable analytics, clear either repository variable, rebuild/publish, then pull and recreate the container.

Tracking runs only in production builds and only when both values are present. The script loads asynchronously once; Umami automatically tracks SPA page navigation. This integration adds no custom business events and sends no project contents, prompts, or provider credentials. Umami's standard pageview metadata includes the page URL, title, and referrer. See the official [tracker configuration](https://docs.umami.is/docs/tracker-configuration) and [SPA guide](https://docs.umami.is/docs/guides/track-single-page-apps).

For local production builds, copy [`.env.example`](.env.example) to `.env.local`, fill both values, and run `pnpm build` followed by `pnpm preview`. `pnpm dev` does not load the tracker. Local environment files are excluded from Git and Docker build contexts; local Docker builds receive values explicitly:

```bash
docker build \
  --build-arg VITE_UMAMI_SCRIPT_URL=https://analytics.example.com/script.js \
  --build-arg VITE_UMAMI_WEBSITE_ID=YOUR_WEBSITE_ID \
  -t ghcr.io/royians/cuepoint:latest .
docker compose up -d
```

To verify a deployment, open browser DevTools → Network, confirm the configured script loads, then navigate between pages and check for successful requests to Umami's collection endpoint (normally `/api/send`). Confirm visits appear under the matching website in Umami. Content blockers can prevent the tracker from loading.

## 感谢

感谢以下项目及其贡献者，为小光点提供基础能力与实现参考：

| 项目 | 使用与参考 |
| --- | --- |
| [PDF.js](https://github.com/mozilla/pdf.js)、[Mammoth.js](https://github.com/mwilliamson/mammoth.js) | 浏览器本地 PDF 正文与 DOCX 文本提取；分别采用 Apache-2.0、BSD-2-Clause 许可 |
| [LobeHub](https://github.com/lobehub/lobehub) | 完整 Model Bank 数据来源；Agent、聊天输入区和上下文交互的实现参考。原始快照及许可保存在 [`vendor/lobehub`](vendor/lobehub/README.md) |
| [Lobe UI](https://github.com/lobehub/lobe-ui)、[Lobe Icons](https://github.com/lobehub/lobe-icons)、[Fluent Emoji](https://github.com/lobehub/fluent-emoji) | 聊天组件、模型品牌图标与表情资源 |
| [React](https://react.dev/)、[TypeScript](https://github.com/microsoft/TypeScript) | 应用界面与类型系统 |
| [Vite](https://github.com/vitejs/vite)、[Vite React Plugin](https://github.com/vitejs/vite-plugin-react) | 开发服务与构建 |
| [TanStack Router](https://github.com/TanStack/router) | 类型安全路由与路由生成 |
| [Dexie](https://github.com/dexie/Dexie.js) | IndexedDB 数据访问与 React 响应式查询 |
| [Tailwind CSS](https://github.com/tailwindlabs/tailwindcss)、[tailwind-merge](https://github.com/dcastil/tailwind-merge)、[tw-animate-css](https://github.com/Wombosvideo/tw-animate-css) | 样式、类名合并与动效样式 |
| [Radix Primitives](https://github.com/radix-ui/primitives)、[Ant Design](https://github.com/ant-design/ant-design) | 对话框、菜单、弹层、表单等界面基础组件 |
| [dnd kit](https://github.com/clauderic/dnd-kit) | 拖拽与排序 |
| [Lucide](https://github.com/lucide-icons/lucide)、[Boring Avatars](https://github.com/boringdesigners/boring-avatars) | 界面图标与头像 |
| [Motion](https://github.com/motiondivision/motion)、[Sonner](https://github.com/emilkowalski/sonner) | 界面动画与消息提示 |
| [Class Variance Authority](https://github.com/joe-bell/cva)、[clsx](https://github.com/lukeed/clsx) | 组件样式变体与条件类名 |
| [Zod](https://github.com/colinhacks/zod)、[JSZip](https://github.com/Stuk/jszip) | 数据校验与项目 ZIP 备份 |
| [Trellis](https://github.com/mindfold-ai/Trellis) | 项目规范、任务拆分与开发过程记录 |
| [Vitest](https://github.com/vitest-dev/vitest)、[fake-indexeddb](https://github.com/dumbmatter/fakeIndexedDB)、[DefinitelyTyped](https://github.com/DefinitelyTyped/DefinitelyTyped) | 自动化测试、浏览器数据库模拟与类型声明 |

同时感谢 [APIMart](https://docs.apimart.ai/llms.txt) 和 [AIHubMix](https://docs.aihubmix.com/llms.txt) 提供的接口文档，帮助我们完成 connector 适配。

依赖的具体版本见 [`package.json`](package.json) 与锁文件。各项目保留各自的版权与许可；致谢不代表第三方内容被重新授权。

## 许可

小光点的原创代码采用 [MIT License](LICENSE)。

第三方内容遵循各自的原始许可，详见 [第三方声明](THIRD_PARTY_NOTICES.md)。其中，迁入的 LobeHub Model Bank 源码和派生数据继续适用 [LobeHub Community License](vendor/lobehub/LICENSE)，不属于本项目 MIT 授权范围。
