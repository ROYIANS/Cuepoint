# Implement — app-foundation

## Checklist

1. 写 `package.json` scripts：`dev`, `build`, `preview`, `lint`；安装依赖。
2. 配置 Vite、TS、Tailwind、TanStack Router。
3. 落地 `domain/types.ts` 与 Dexie schema（完整表，即使 UI 尚未填资产/镜头）。
4. 实现 `projectPackage.ts` 导入导出 + 损坏包测试夹具（至少单测或手跑说明）。
5. 项目列表页 CRUD。
6. 工作区壳 + 占位路由 + 资产空页。
7. 删除 `index.js`。加 `.gitignore`（`node_modules`, `dist`, 生成物例外：`routeTree.gen.ts` 可提交以免冷启动失败）。

## Validation

```
npm install
npm run build
```

浏览器：新建 → 进入 → 改名 → 导出 → 导入 → 删除确认 → 坏 zip 拒绝。

## Risky files

- `src/lib/projectPackage.ts` — id 重映射漏了会串图
- Dexie delete cascade — 删项目必须删 characters/scenes/shots/media

## Rollback

删除 `src/` 与 Vite 配置，恢复占位 `package.json`。
