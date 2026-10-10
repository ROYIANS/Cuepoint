# A04 implementation — PU-02 / PU-03 / SS-02

日期：2026-09-30。Native implement；仅本单元代码/聚焦测试/本报告。未提交、推送、归档、派生子任务或修改任务/规范/父台账；A01–A03 已有修改保留。交给主会话独立 check，再进行批次验证。

## 行为与边界

- `repo.ts` 五个 `set*Slot` 接收可选 baseline，同一个 production 写事务内只比较目标槽的 prompt、有序图片/视频引用、result mediaId/kind；缺省槽与 emptySlot 等价，当前已等于最终值可合流。同槽第三值先抛 `DraftConflictError`，在 put、touch、cleanup 之前；其他槽、实体文字编辑不阻断。既有 media owner/Blob/MIME 校验与事务回收保留。baseline 可选，Agent 现有独立 guard 入口兼容。
- `sameSlotValue` 是纯 domain 函数；无 parser→UI 依赖。`sameDraftStructure` 限于 JSON 状值：数组保序，plain object 属性顺序不影响结果，undefined optional 属性与缺省等价。实际用于输出配置和 edited-shot-field CAS。
- `patchShot` 可选 baseline，只检查白名单中本次编辑字段；durationSec 的 current/baseline/final 均按 `?? 0` 比较，其他字段采用空 optional 编辑语义及结构值比较。`DurationInput` 保留原 typing/raw/retry/useLatest，传入 hook 提供的 baseline。
- `patchProjectDetails` 验证并确定实际写入值后，用窄纯 `assertProjectDetailsBaseline` 比较本次编辑字段；name trim、aspect normalize 后允许最终值合流；defaults 缺省与 {} 等价且按结构比较。五个文字 persist 回调和即时 defaultStyleId 均传 baseline；无关字段并发安全。
- 四种资产页与镜头首帧/尾帧/成片给 wrapper/editor 显式 owner+entity+slot targetKey。`SlotEditSession` 在 editor 打开时冻结 baseline、owner、title、resultKinds、persist callback。上传和 picker 使用原 session owner；当前身份失配时提示、禁用保存/上传/选择，prompt 只读但可选中复制。保存前及媒体提交回调前检查当前 target，防 stale event callback 绕过按钮禁用；A 保存等待期间换 B，成功后仅在 mounted 且当前 target 仍是 A 时关闭。
- 槽保存失败不 cancel DraftMediaSession，草稿及 owned media 保留供重试；explicit close / 实际 unmount 使用原 cleanup。没有新增槽位“采用最新”入口，避免在本单元复杂替换媒体；明确取消、重新打开目标、复制 prompt 是当前解决入口。无 route key / retained-query / B01 重设计。
- 输出配置使用实际 consumer 的 `projectOutputDraft.ts` 窄纯协议：ratio/defaults 独立 value/baseline，仅提交 changed fields；live 仅重基干净字段，dirty baseline 保持；saving 时 defer rebase，busy ref 阻止重叠 save。ack 时记录已观测 live 字段指纹，并只推进已确认写入字段 baseline，旧 props 或等值新对象再次 render 不会回滚已确认值。保存期间到达的独立干净字段在 ack 后跟随最新值。错误保留草稿/原 baseline，提供明确“采用最新内容”；explicit save 与 beforeunload protection 保留。

## 可执行回归与验证

先增加 3 个核心数据库回归并 red：槽、时长、项目字段原实现均接受 stale 写入；修改后 green。初次时长 fixture 漏传 projectId，已修正后重新确认三个 red 均是“应拒绝但 resolved”。

最终命令（本机 pnpm，无 install）：

```text
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm exec vitest run tests/manualDraftBaseline.test.ts tests/manualDraftWiring.test.ts tests/draftMedia.test.ts tests/draftConcurrency.test.ts tests/repoReliability.test.ts tests/repo.test.ts tests/debouncedDraft.test.ts tests/durationInput.test.ts
8 files / 82 tests passed
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm lint
exit 0
git diff --check
exit 0
```

- `manualDraftBaseline.test.ts`：五 setter 同槽 conflict、独立 slot、final convergence、媒体保留/无 project touch、ordered refs、unknown/deleted refs、cleanup rollback；entity text 并发保留；duration 缺省 0、独立字段；项目 trim、defaults 缺省/顺序/structural CAS；多字段整笔拒绝；slot/project 并发竞争。
- `manualDraftWiring.test.ts`：轻量 hook host 直接执行真实组件及 event callbacks，UI primitive 保留 JSX；不是 grep 或复制 product callback。四资产页→真实 EditableGenerationSlot→真实 GenerationSlotEditor→真实 fake-indexeddb repository 证明 baseline 接线并保留失败草稿；真实 ShotEditorPage→BeatBlock→BeatBlockView→ShotRow 的三个槽回调也执行数据库 conflict；五文字/style/duration 实际回调接线。
- 同一 actual editor rerender 切换 owner/target/title 与 identical empty baseline，stale save callback 仍拒绝；延迟 A save 后换 B 不调用 B callback / 不关闭；actual upload→CAS fail→media/draft 保留→explicit close 回收。
- actual ProjectOutputSettings deferred save/live sequence：clean defaults rebase、saving 期间 defer、只提交 ratio、ack 后旧 ratio props 不回滚、同值对象身份更新不回滚、后续 live ratio 更新可跟随；samefield conflict 保留 ratio，明确采用最新后新 save 使用新 baseline。

## 限度与交接

轻量 hook host 模拟 state/ref/effect 及 live-query 输入，不是完整 React DOM/StrictMode 或真实浏览器 retained-query 时序验证；已有 DraftMediaSession lifecycle/debouncedDraft/repo 回归覆盖异步清理及原行为。无真实用户数据、远端生成、视觉验收；完整 B01 身份边界仍由后续单元处理。

首轮使用 `pnpm test -- <file>` 时 Vitest 意外忽略过滤并执行全套（128 files，新增三例失败、其余 1632 passed），随后立即改 `pnpm exec vitest run <files>`，未重复 fullsuite，未运行 build。此首轮结果不作为 A批集成验收；主会话仍运行其已准备的 batch 工具。
