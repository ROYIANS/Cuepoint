# Design — app-foundation

## Stack

- Vite 7 + React 19 + TypeScript
- Tailwind v4 via `@tailwindcss/vite`
- TanStack Router file routes + `@tanstack/router-plugin`
- Dexie for IndexedDB
- Zod + JSZip for package IO
- Dexie for IndexedDB
- Zod + JSZip for package IO
- lucide-react for toolbar icons matching the mock
- shadcn/ui New York (与 gennex 相同)：Radix + CVA + Tailwind CSS variables
- Package manager: pnpm (do not use npm)

Replace placeholder `index.js` / empty `package.json`. Keep `.trellis/` untouched except task files.

## Directory

```
index.html
vite.config.ts
src/main.tsx
src/styles.css
src/routeTree.gen.ts      # generated
src/db/database.ts
src/domain/types.ts
src/domain/columns.ts
src/lib/ids.ts
src/lib/projectPackage.ts
src/routes/__root.tsx
src/routes/index.tsx
src/routes/p.$projectId.tsx
src/routes/p.$projectId.index.tsx
src/routes/p.$projectId.assets.tsx
src/routes/p.$projectId.storyboard.tsx
src/routes/p.$projectId.plan.tsx
src/routes/p.$projectId.report.tsx
src/components/workspace/WorkspaceChrome.tsx
src/components/projects/ProjectList.tsx
```

## Dexie

Database name `aifenjing`. Stores: `projects`, `characters`, `scenes`, `shots`, `media`. Foundation only creates/deletes project rows and empty related collections on project delete. Media blobs keyed by id.

## Import transaction

1. Unzip and parse `manifest.json` (`format === "aifenjing-project-v1"`)
2. Parse JSON files with Zod (passthrough extras)
3. Allocate new projectId + remapped child ids
4. `db.transaction` put all rows; abort on any failure

## Workspace chrome

Match screenshot: white header, centered step tabs, right cluster (导出 required; 协作可禁用灰色；铃铛/更多可无行为). Title row 「制作分镜」+ 金黄新建按钮可先 disabled，直到 shot-editor。资产入口放在右侧工具区，文案「资产」。

## Visual tokens

CSS variables on `:root`:

- `--bg`, `--surface`, `--line`, `--text`, `--muted`, `--accent` (金黄约 `#F0B429`), `--danger`
- Font: `"PingFang SC", "Noto Sans SC", "Source Han Sans SC", system-ui, sans-serif`
