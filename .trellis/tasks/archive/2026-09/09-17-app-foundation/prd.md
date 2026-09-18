# 应用脚手架与项目管理

## Goal

从空仓库搭出可部署的静态 SPA：项目能建、能改名、能删、能导入导出，并能进入带分步顶栏的项目工作区（分镜页先放空壳）。

## Background

依赖：无。后续资产库和分镜表都挂在这套路由和 IndexedDB 上。

## Requirements

- **F1** Vite + React + TypeScript + Tailwind 可 `npm run dev` / `npm run build`。
- **F2** `/` 项目列表：新建、重命名、删除（删除需确认）、显示更新时间。
- **F3** 导出当前项目为 `aifenjing-project-v1.zip`；导入 zip 生成新项目且不覆盖已有项目。
- **F4** `/p/$projectId` 工作区：返回、项目名、分步顶栏（分镜制作/故事板/拍摄计划/拍摄报告）、导出。默认路由为分镜制作空壳。
- **F5** 故事板/拍摄计划/拍摄报告为占位页。
- **F6** 工作区提供「资产」入口链到 `/p/$projectId/assets`（本任务可放「即将接入」空页，避免死链）。
- **F7** 无后端请求，无 AI 调用。导入失败整包拒绝并提示，不写一半数据。

## Out of scope

- 角色/场景详情编辑（子任务 2）
- 分镜表（子任务 3）
- 协作、登录、云同步

## Acceptance Criteria

- [ ] `npm run build` 成功产出 `dist/`
- [ ] 可新建项目并进入工作区，顶栏分步可切换占位页
- [ ] 重命名、删除（确认后）立即反映在列表
- [ ] 导出 zip 再导入出现第二个项目，名称与空分镜/资产集合可还原
- [ ] 损坏 zip 显示错误且不新增项目
- [ ] 不存在的 `projectId` 显示找不到并回到列表

## Notes

导入导出实现时就要按父 `design.md` 写入完整 schema（含空 characters/scenes/shots），这样子任务 2/3 只往同一 zip 填内容。
