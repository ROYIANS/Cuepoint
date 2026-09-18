# Implement — shot-editor

## Checklist

1. Shot Dexie CRUD helpers: add at end, insert at index, delete, patch fields, reorder numbers.
2. `ShotTable` + `ShotRow` + image cell + text cell.
3. Column settings popover + project persistence.
4. Select mode + delete selected.
5. Shot settings popover (default duration, auto increment).
6. Footer totals.
7. Optional characters/scene columns.
8. Wire 新建 button in chrome via outlet context or page-local header (prefer page-local header like screenshot, chrome 不再放新建).

## Validation

`npm run build`。对照截图走一遍新建/插行/上传/列设置/导出导入。

## Risky files

- 列显隐与横向滚动
- object URL 泄漏
- 插入后 `order` 与镜号不同步
