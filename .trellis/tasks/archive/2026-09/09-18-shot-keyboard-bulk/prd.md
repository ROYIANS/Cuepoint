# 分镜键盘与批量编辑

## Goal

补齐键盘导航/选择/移动，并扩展批量编辑到角色、场景、备注、状态。

## Depends on

- Prefer after `09-18-shot-status-filter` so bulk status exists.
- Works with selection model from current editor; drag reorder already available or arrows remain.

## Requirements

- **K1** 非输入焦点下：j/k 或方向键移动高亮；Space/x 切换选中；Cmd/Ctrl+A 选中当前可见镜；n 新建；Backspace 删除确认；Alt+↑/↓ 移动。
- **K2** 焦点在 input/textarea/contenteditable/select 时不触发上述快捷键。
- **K3** 批量面板：状态、角色（多选整组替换）、场景、备注；保留场次/时长/删除。
- **K4** 每次批量写入打一个短时撤销快照。
- **K5** 筛选后的「全选」只作用于当前可见镜头。

## Out of scope

- 可定制快捷键、Vim 模式
- 批量改提示词/生成槽媒体

## Acceptance Criteria

- [ ] AC1 快捷键在表体可用，在文本框内打字不被劫持（K1, K2）
- [ ] AC2 批量替换角色/场景/备注/状态后刷新正确并可撤销（K3, K4）
- [ ] AC3 筛选后全选不会误选隐藏镜（K5）
- [ ] AC4 test/lint/build 通过
