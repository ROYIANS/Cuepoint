# 分镜效率 P1

## Goal

在 P0 手工工作流已闭环的基础上，让分镜表成为可快速重排、筛选和批量操作的日常生产工具。

## User value

作者改一场戏、调镜头顺序、找「还没成片」的镜、或给一批镜统一挂角色/场景时，不必逐行点按钮或靠记忆翻表。

## Confirmed facts

- P0 已交付：可靠保存、单片/连载、选文建场、上下移动排序、复制、设计/素材双视图、资产快照、CSV/打印交付。
- 分镜页已有：上下箭头重排、多选删除、批量改场次/时长；`GripVertical` 仍是装饰把手。
- 无拖拽库依赖；`Shot` 尚无 `status` 字段。
- 旧 `09-17-core-studio` 任务树已归档。

## Child task map

1. `09-18-shot-dnd-reorder` — 场次/镜头拖拽排序（可访问上下移动保留）
2. `09-18-shot-status-filter` — 手动状态 + 工具栏筛选（依赖数据字段，可先于键盘）
3. `09-18-shot-keyboard-bulk` — 键盘快捷键 + 更强批量编辑（依赖状态字段与选择模型；建议在 1、2 之后）

Parent owns cross-child acceptance and final integration. Children are independently verifiable; ordering above is written into child implement plans.

## Key decisions

| Decision | Choice |
| --- | --- |
| MVP 包 | 拖拽 + 状态筛选 + 键盘 + 更强批量 |
| 镜头状态 | 手动五档：`draft` / `ready` / `framed` / `clipped` / `approved`（UI：草稿 / 可生成 / 已出图 / 已成片 / 通过） |
| 缺口筛选 | 派生「缺首帧 / 缺成片」，不改写手动状态 |
| 新建默认状态 | `draft` |
| 批量角色 | 整组替换；场景单选替换；备注覆盖写入 |

## Requirements

- **E1** 场次与镜头可拖拽重排；刷新稳定；可短时撤销；上下箭头保留。
- **E2** 每镜有手动 `status`；可按状态、场次、派生缺口筛选。
- **E3** 常用键盘快捷键；输入框聚焦时不拦截输入。
- **E4** 多选可批量设置角色（替换）、场景、备注、场次、时长、状态；可删除；可短时撤销。
- **E5** 设计/素材双视图共用选择、筛选与排序。
- **E6** 旧镜头缺省 `draft`；ZIP 往返保留；筛选偏好写入项目 `shotSettings`。

## Out of scope

- 卡片视图、版本/选版、跨镜连续性检查
- 自动根据素材改写状态
- AI、协作、云同步、季模型、移动端完整编辑

## Acceptance Criteria

- [ ] AC1 拖拽场次/镜头后刷新顺序不变，并可撤销（E1, E5）
- [ ] AC2 可设置五档状态；按状态/场次/缺首帧/缺成片筛选结果正确（E2, E6）
- [ ] AC3 键盘可完成选择、上下移动、新建；在文本框内打字不被劫持（E3）
- [ ] AC4 批量替换角色、场景、备注、状态后刷新仍在，并可撤销（E4）
- [ ] AC5 旧项目打开后镜头均为草稿；导出再导入状态不丢（E6）
- [ ] AC6 `pnpm test` / `pnpm lint` / `pnpm build` 通过
