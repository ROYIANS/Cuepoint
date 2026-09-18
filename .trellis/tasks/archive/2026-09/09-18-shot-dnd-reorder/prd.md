# 分镜拖拽排序

## Goal

让场次和镜头支持真实拖拽重排，并保留可访问的上下移动。

## Depends on

None. Can start first.

## Requirements

- **D1** 镜头行可拖拽改变顺序；调用现有 `reorderShots`；可短时撤销。
- **D2** 场次块可拖拽改变顺序；调用现有 `reorderBeats`；其镜头组一起移动；可短时撤销。
- **D3** 保留 ArrowUp/ArrowDown；拖拽把手有明确 `aria`。
- **D4** 设计/素材双视图都可拖拽。
- **D5** 引入 `@dnd-kit`；不破坏现有选择与批量工具栏。

## Out of scope

- 跨场次拖镜头自动改 `beatId`（用批量改场次）
- 状态筛选、键盘快捷键

## Acceptance Criteria

- [ ] AC1 拖拽镜头后刷新顺序不变并可撤销（D1）
- [ ] AC2 拖拽场次后场次与镜头组顺序正确并可撤销（D2）
- [ ] AC3 仅用箭头仍可完成同组移动（D3）
- [ ] AC4 两视图拖拽均可用（D4）
- [ ] AC5 test/lint/build 通过（D5）
