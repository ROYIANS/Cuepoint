# 小光点 Cuepoint

本地优先的影视分镜工作台：从剧本场次到镜头表、资产与制作交付，面向 AI 辅助成片的前期与中期流程。

## 能做什么

- **工作室 / 工作室**：角色、场景、道具、风格资产库；可快照进项目
- **单片或连载**：电影式单集，或系列多集共用世界
- **故事 → 分镜 → 制作**：场次与镜头编辑、状态与筛选、拖拽/键盘排序
- **交付**：集级 CSV 导出与可打印故事板
- **备份**：项目 ZIP 导入导出（格式 `aifenjing-project-v1`，本地 IndexedDB）

数据只存在本机浏览器，无需后端。

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

## 许可

Private — 暂未开源授权。
