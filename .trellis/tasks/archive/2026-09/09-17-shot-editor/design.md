# Design — shot-editor

## Layout

Workspace already has chrome. Shot page fills remaining height:

- Title row: 「制作分镜」+ 金黄「新建」下拉（当前仅「添加镜头」）
- Toolbar right: 选择 / 分镜设置 / 列设置（批量模式并入选择）
- Scrollable table
- Footer stats overlay matching screenshot

## Table

Custom CSS grid/table, not a spreadsheet widget.

- Row height ~ 148px for image cells (~220×124 thumbnail, object-fit cover, radius 6)
- Frame empty: white tile, hairline border, centered +
- Reference empty: dashed gold border, muted hint 「上传参考图」
- Order column: grab affordance optional; v1 用上下小按钮或仅插行，不做完整 DnD（截图重点是插行 + 顺序号）。顺序号等于 `order`。
- Insert buttons sit on row boundaries.

## Column settings popover

Anchored top-right like screenshot: checklist with type icons (T text, # number). 「全部显示」可选。Persist `projects.columnSettings.visible`.

## Asset attach

Two compact controls in a trailing optional area or inside 备注旁不够用时：在列设置之外增加固定窄列「角色」「场景」——不在截图里，但 R8 需要。为避免破坏截图，把它们放进「列设置」可开关列 `characters` / `scene`，默认关闭；用户打开后用多选/下拉。

Reconsider: plan said 轻量选择. Default **on** would change the mock. Default **off**, discoverable in 列设置.

## Media

Same media table as assets. Shot frame/reference ids. Deleting a shot recycles media if unused.
