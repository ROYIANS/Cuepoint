# A04 independent check — PASS after final A gate

日期：2026-09-30。角色：native trellis-check。仅 A04 PU-02/03/SS-02；未派生子 agent、提交、归档、修改 A01–A03、spec、父台账或 B/D 实现。

**状态：PASS（主会话已对下列最终SHA快照重跑全部A gate，无修正后的集成阻断）。** 两个实际输出草稿缺陷已 red→green 窄修正，没有剩余窄测试或已知未修的 A04 缺陷，不提前登记 PASS。主会话此前提供的 129 files / 1657 tests、lint/model/build gate 及 ESLint/SonarJS 扫描针对修正前快照；不能冒用为修正后集成证据。主会话须对最终快照重跑 A gate，本 checker 未重跑 fullsuite/build/model/browser/mutation。

## 上下文与检查范围

按 check.jsonl → prd.md → design.md → implement.md → reviews/A04-implementation.md 阅读并对照七段 state-management 契约；已核对 type-safety/quality、A04 相关 PU/SS 与 B01 边界。实现报告仅作为索引，结论来自最终实际代码和执行事件回调。

检查文件：repo.ts 的五个槽 setter、patchShot baseline、patchProjectDetails；domain/slot.ts；lib/draftConflict.ts、slotEditSession.ts、projectOutputDraft.ts；四个资产 DetailPage 的槽保存回调；DurationInput；ShotEditorPage 的三个槽回调；GenerationSlotCard；ProjectSettingsPanel；manualDraftBaseline/manualDraftWiring 及指定旧回归。未改动 repo.ts 的 A02/A03 区段。

## 持久化与手工接线证据

| 检查项 | 最终代码 / 执行证据 |
| --- | --- |
| 五种槽 CAS | setCharacterSlot/setSceneSlot/setPropSlot/setStyleSlot/setShotSlot 在原 PRODUCTION_TABLES 写事务内读最新行。compare、assertSlotMedia 全部先于 put/touch/recycleSlotMedia；拒绝不会触碰行、project timestamp 或原媒体。实际顺序为存在性→CAS→media validation→写入；当前等于 final 的合流仍必须通过媒体校验。并非声称所有 setter 的 CAS 都位于 media validation 之后。 |
| 槽比较 | sameSlotValue 明确比较 prompt、有序 referenceImageIds/referenceVideoIds、result.mediaId/kind。undefined 槽等价于 emptySlot；有序数组逐项比内容。仅写目标槽，并展开事务取得的当前其他槽/文字，保留独立修改。五 setter 参数化 DB 回归覆盖冲突、合流、独立槽、引用顺序、失效媒体、回收失败事务回滚。 |
| scalar / project | patchShot 先白名单化，逐提交字段比较；duration 的 current/baseline/final 均用 ?? 0；关系校验在 put 前。项目验证/确定 trim name、normalized aspect、style ownership、defaults 后才比较 touched fields；缺省文本/空、缺省 defaults/{}、属性顺序与 undefined optional key 按契约处理。多字段冲突整笔拒绝；当前等于最终值可合流。 |
| 所有手工 baseline | 四资产 DetailPage → EditableGenerationSlot → GenerationSlotEditor 的真实回调传 baseline；ShotEditorPage → BeatBlock → BeatBlockView → ShotRow 的 firstFrame/lastFrame/clip 三条真实回调传 baseline。DurationInput 的实际 hook persist、项目 name/brief/genre/audience/tone 五回调及即时 defaultStyleId 均实际执行验证。rg 调用枚举与执行测试互证，未发现其他遗漏的手工槽消费者。 |
| 冻结目标 session | SlotEditSession 克隆 baseline，冻结 owner、target、title、resultKinds 和原 persist callback；所有 consumer targetKey 含 owner/entity/slot。actual rerender 到另一个 owner/target、空值完全相同，旧保存事件仍用 currentTarget ref 拒绝，A/B callback 均未执行；A 标题和草稿保留。媒体上传/picker 属于原 owner。 |
| 媒体与 completion | CAS/storage failure 不 cancel 当前 DraftMediaSession；实际上传→冲突→owned Blob/draft 保留→明确 close 回收已执行。save 在启动和 persist 回调前均查当前 target；延迟 A 成功后 B 不被关闭，也不调用 B persist。unmount 清理仍沿用原 mounted/microtask 路径。 |
| 输出草稿 | ratio/defaults 独立脏字段，仅提交 outputDraftPatch；dirty baseline 保留，干净字段跟随 live，saving 时 defer，busy ref 防重叠。成功后只读当前项目行，确认本次保存字段；独立未保存字段继续按 live 协议，保存期间新本地编辑不会被 ack 强行替换。错误保留草稿/原 baseline，明确采用最新。重复旧 props 指纹不回滚已确认值。 |

## Check 中确认并修正的两个缺陷

1. **脏字段收到 live 后手动回到旧 baseline，未跟随最新值。** 原 helper 把 dirty 字段的新 live 提前记为 observed；effect 又仅依赖 live/saving。实际事件回调：画幅 16:9→1:1，同时 defaults 编辑；另一 writer 写 9:16 并 live 到达；用户选回 16:9，画幅呈现旧值，且其他 defaults 仍 dirty。新增 actual component 用例先 red。修正让 dirty 字段保留最后已应用指纹，effect 分别依赖 ratioDirty/defaultsDirty，使字段转干净时消费 deferred live，即使整体仍 dirty。保留 ack 后改动再回到确认 baseline 的 stale-props 防回滚断言。

2. **主会话指出的 pending save 同字段后续提交被 ack 吞掉。** 两个 actual deferred 序列先 red：实际写 1:1 已提交，save Promise 仍 pending；通过真实 repository 的原 callback 另写 9:16（第二例写回 16:9），并喂入 live；再 resolve 原 Promise。原 UI 保持 1:1/clean，DB 已是后续值，重复 props 无法修复。baseline/saved/latest 三值无法区分后续写回旧值与原 baseline 的 stale props。最终规则：Promise 成功后 `db.projects.get(project.id)` 只读 authoritative current；ack 仅对本次 saved fields 更新基线，当前 draft 仍等于 submitted value 时跟随 authoritative value，否则保留新的本地编辑；observed 独立记录当时实际 props 指纹，防相同旧 props 重复出现造成回滚。两个后续提交用例现 green，原独立 defaults pending/ack 和旧 props 用例仍 green。此读确认是当时数据库快照，不宣称建立全浏览器跨路由查询排序协议。

修正仅三个获准文件：src/lib/projectOutputDraft.ts、src/components/workspace/ProjectSettingsPanel.tsx、tests/manualDraftWiring.test.ts。无新增 nested ternary、unsafe 类型、策略/registry 层。

## 执行结果

所有命令明确使用本机 `/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm`，无 install。

- 首个稳定快照运行指定八文件一次：`pnpm exec vitest run tests/manualDraftBaseline.test.ts tests/manualDraftWiring.test.ts tests/draftMedia.test.ts tests/draftConcurrency.test.ts tests/repoReliability.test.ts tests/repo.test.ts tests/debouncedDraft.test.ts tests/durationInput.test.ts` → **8 files / 82 tests passed**。
- 两缺陷新增回归分别先 red（转干净序列 1 failure；pending 同字段两例 2 failures）。修正后仅相关 `pnpm exec vitest run tests/manualDraftWiring.test.ts` → **1 file / 12 tests passed**（最终运行 12:33:01）。额外 authoritative read 的测试等待使用真实 DB barrier，不把微任务 settle 当作 IndexedDB 已完成。
- 修正后 `pnpm lint` → **exit 0**；项目该命令为 `tsc -b --pretty false`，不冒称 ESLint。主会话已有源 ESLint/SonarJS 扫描结果未由本 checker 重跑；旧 UI complexity 的 D03 处理保持原边界。
- `git diff --check` → **exit 0**。

## 明确限制与交接

- **槽位仍无显式“采用最新”按钮。** 同目标内容冲突可保留草稿/owned 媒体并重试；若需合并，复制提示词→取消→重新打开最新槽位→合并。取消会回收仍 owned 且 orphan 的素材，不能把这个 workaround 描述成完整媒体合并功能。
- 轻量 hook host 确实执行真实组件、repository 与 event callbacks，但手动模拟 state/ref/effect/live 输入，UI primitives 只留 JSX；不含 React DOM/StrictMode cleanup 时序、真实浏览器 retained-query、实际 picker/音频解码/视觉交互。本报告没有以这些测试证明完整浏览器身份安全。
- **B01 完整 query/browser 身份边界仍 pending。** A04 只冻结打开后的 slot target/callback/session；没有路由重挂载、页级 retained-query 或导航保护重构。
- 原 owner/Blob/MIME/reference 与 orphan 保护沿用原事务；本次聚焦回归通过，但不是全类型/legacy 输入的穷举证明。
- 已通过 commentary 通知主会话存在实际修正，source/tests hashes 已变化，需重跑 A gate 后关闭批次；本报告待最终集成证据后由主会话更新结论。

最终修正文件 SHA-256：
- `src/lib/projectOutputDraft.ts`：`82d056980b5bfd8ce0f66f72e77431f3003959de9f08243b0925dc380db7f7ec`
- `src/components/workspace/ProjectSettingsPanel.tsx`：`82a20092498e90d254583fe55cadb5fe2f9e05bd89c1013e55e2b4f67ff6a855`
- `tests/manualDraftWiring.test.ts`：`e160beba686217dcddab6f2ff9563f6b11b0c0c14a525d26621d931b1ad9a5c6`

## 主会话最终集成补充

2026-09-30：原checker的窄修正与测试完成后，主会话重跑lint/full Vitest/model verify/build，全exit0；129files/1660tests通过。pre/post gate source/tests hashes完全一致；与上列修正文件SHA一致。最终ESLint/SonarJS扫描没有新增Hook依赖告警，已有UI复杂度仍留D03。完整日志见reviews/integration（修正前结果在before-A04-check-fixes），主会话据此解除待集成BLOCK并关闭A04。此补充不是checker声称自己跑了全量。
