# 镜头状态与筛选

## Goal

给每镜手动生产状态，并在分镜工具栏按状态、场次、缺口筛选。

## Depends on

None for schema. Prefer after dnd so filter+drag can integrate, but can implement independently on current list.

## Requirements

- **F1** `Shot.status` 五档：draft / ready / framed / clipped / approved；UI 中文标签；新建与旧数据默认 draft。
- **F2** 行内可改状态；设计/素材视图都可见。
- **F3** 工具栏筛选：状态、场次（含未分场）、派生缺口缺首帧/缺成片；可组合。
- **F4** 筛选偏好写入 `project.shotSettings.filters`；刷新保留。
- **F5** ZIP / CSV / 打印交付带上状态；旧包无字段按 draft。

## Out of scope

- 自动根据素材改写状态
- 拖拽、键盘、批量面板扩展

## Acceptance Criteria

- [ ] AC1 新建镜为草稿；可改到五档并刷新保留（F1, F2）
- [ ] AC2 筛选组合结果正确；空结果有明确空态（F3）
- [ ] AC3 刷新后筛选偏好仍在（F4）
- [ ] AC4 导出再导入状态正确；CSV 含状态列（F5）
- [ ] AC5 test/lint/build 通过
