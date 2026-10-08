# D03 页面与共享编排责任方案（准备稿）

2026-10-08；仅准备 PU-08 / SS-08 / AU-08。研究者唯一写入所有权：本文件。没有修改产品、测试、规范、台账、状态或上下文清单，没有安装、运行产品验证、提交或关闭 finding。以下新文件均为**未来顺序实施的建议所有权**，不是已创建的实现。

## 1. 依据、现状和范围

原始审计准确路径：

- `.trellis/tasks/09-30-src-quality-architecture-audit/research/production-ui.md`，`### PU-08`：镜头页的逆操作/交互/列映射，AudioTimeline 的导出与交互，AudioWorkspace 的关联选择，MusicWorkspace 的变体/提交互斥。
- `.trellis/tasks/09-30-src-quality-architecture-audit/research/shell-shared.md`，`## SS-08`：ZIP codec 与持久化编排、shell 对 gallery 的反向依赖、landing 业务装配、测试独占的旧 production context/intent。
- `.trellis/tasks/09-30-src-quality-architecture-audit/research/agent-ui.md`，`### AU-08`：send/retry/run-action 的三套 UI 执行收尾及多套选择镜像。

另读取本任务 PRD/design/order/context、父任务 `research/D03-responsibility-boundaries.md`，以及 component-guidelines / hook-guidelines / state-management / agent-execution / agent-batch-generation / production-contracts 的相关契约。这是上述责任的定向核查，不是再审所有 src；审计历史行号不作为当前修改坐标。

研究时 HEAD 为 `abb7a91d255666fc8f772cddecd66676b9f2848c`；C 产品 tip 为 `f062d694e61da6bcb574f7fb548803b9e54197eb`。D01 另有写者正在修改 Agent 依赖叶节点。D02 方案见同目录 `D02-repository-plan.md`：11 个 repository owners / 40 个 source consumers，产品仍顺序实施。**D03 必须从独立验收后的 D02 状态重新核对导入与文件哈希**，不能把本次 repo.ts 行号当成 D03 最终位置。

D02 的“迁移全部真实消费者、不要完整兼容 barrel”是主会话设计，不是用户明示要求。本稿按其建议 owner 名称指示后续消费路径；兼容出口及最终模块命名由主会话确定。D03 不重做 D02 的 repository 拆分。

范围不含 D04 ContextUsagePanel/context 查询统一、D06 生成表单能力模型、D08 shot/beat 文本草稿协议、E 性能/布局/unused 清理。资产 detail 四类不同字段不做 schema factory。GenerationSlotCard、AgentGenerationBatches 和 durable generation runtime 是需保留的关联契约，当前没有理由在 D03 重写。

## 2. 当前真实职责与已修正边界

| 当前 owner / 入口（本次源码行号） | 实际调用、边界与需保留的修正 |
| --- | --- |
| `src/components/shots/ShotEditorPage.tsx:236` / `:249–310` | project+episode keyed inner；查询返回 identity envelope；保留手动编辑中的缺失行及最后 project/episode；`useWorkspaceUnavailable` 与 `useManualDraftGuard` 控制 unavailable、失败重试、离开。B01 后不能简单重挂载丢草稿。 |
| 同文件 `:414–545` / `:622–683` | 当前选择随 visible IDs 收缩；键盘以 ref 读最新状态；`commitShotReorder` 使用完整 episode 顺序和 filtered group。`patchEpisodeShots` 返回 A02 原子 inverse；`deleteEpisodeShots` 返回 A03 实际删除的最新行/Blob；不再以渲染快照逆写。 |
| 同文件 `:1527` / `:1930` / `:1960` | ShotRow 管列、sortable、媒体槽和 viewport；文本 fallback 仍把 id cast 为 keyof Shot / Partial<Shot>。角色 checkbox 已调用 B03 `setShotCharacterSelected(id, characterId, checked === true)`；显式清空仍是整数组替换。RelationsEditor 有 pending ref、错误和保留的 retryPatch；失败/保存状态传父级控制离开。 |
| `src/components/audio/AudioWorkspacePage.tsx:102–148` | `selectSegment` / `selectClip` / `selectTake` / `saved` 是四个不同状态转换；前三个重复查 segment/take/clip，但 chapter、seek 和缺失目标行为不同。声音选择另有 flush + 重读 speaker 基线，不应并入纯 selection helper。 |
| `src/components/audio/AudioTimeline.tsx:59–74` / `:146–278` / `:342–399` | 同一个 buffer cache 被播放和导出复用；player instance + playEpoch 阻止晚 decode 播放；composition/chapter/audition 会停止播放；导出是 flush→重新读 snapshot→schedule/preflight/decode/render→`addAudioExport`→下载。drag/snap 是 UI 输入，CAS undo/redo 已由 `lib/audio/commands.ts` 的 AudioClipHistory 负责。 |
| `src/components/music/MusicWorkspacePage.tsx:64–93` / `:114–131` | `actionPending` 与 `submissionPending` 同步互斥，不能换成仅 React busy；switchVariant flush 后重读当前 draft，验证 project，按 variantLinks 复用或创建，再 best-effort 保存 localStorage。C02 的 settings discriminant/持久化一致性在现有 repo 和表单中。 |
| `src/components/agent/AgentChatPage.tsx:89–113` / `:334–521` | 三个入口重复 AbortController/sendLock/executionThread/sending/finally；实际锁在 `lib/agent/runOwnership.ts:19`；begin/approval/cancel 在 Agent repo；transport/flush 在 runChat。retry 使用 run 原 connector/model，而不是当前选择。 |
| 同文件 `:192–229` / `:301–330` / `:663–692` | session connector/model 与 thread 同步；effort 按 thread+connector+baseUrl+model 生效，interaction 按 thread 生效；显式选择同步递增 selectionRevision。catalog 另有 connector identity 与 abort，不等于选择事务。 |
| 同文件 `:374–417`；`src/components/agent/useReferenceDraft.ts:54` / `:145` | B07 捕获真实 draft scope/textRevision/attachments；新线程先绑定 execution destination，在 Web Lock 内 moveTo 再导航；失败可条件 restore；begin 成功才 `references.acknowledge(owner)`；新编辑继续保留；提交之后 transport 失败不能恢复已发送草稿。 |
| `src/lib/projectPackage.ts:745` / `:868` / `:1117` | export 在一个 readonly 事务读所有 JSON 和引用 Blob，ZIP 压缩在事务外；import 在外部完成 ZIP 读取、解析、ID remap，再一个 rw 事务插入所有表。C03 在修复/映射前检查现代 episode/shot/beat 原身份与 normalized beat 碰撞。 |
| `src/lib/audioProjectPackage.ts:188` / `:198` / `:212` / `:229` / `:283` | parser/remap 和 DB snapshot/insert 混合；insert 的 parent/media/relationship 验证属于外层 ZIP transaction。C04 在 schema 去字段前保留 fingerprint stale 证据，remap 只转换可识别身份；job import 去 connector credentials/claim，保持 manual/dormant。 |
| `src/routes/_studio.tsx:3,19`；`src/components/studio/ProjectGalleryPage.tsx:409` | shell 为一个带 toast 的导入函数依赖整个 gallery feature；gallery 当前只定义这个导入 export，实际调用者是 shell；不虚构 gallery 的第二个导入按钮。 |
| `src/routes/p.$projectId.index.tsx:21` | route 内有 kind 分发和缺 film episode 的 repair/error/retry；已具 project envelope 和 project key。迁移时保留兼容 URL redirect 与旧入口。 |
| `src/lib/productionContext.ts:27` / `src/lib/generationIntent.ts:152,205` | 本次定向 rg 仍只见两个对应测试的值导入，intent 仅 type-import context；旧 API 包含 DB preflight，不是纯 serializer。活跃提交/恢复由 `agent/generationRuntime.ts`、`generationBatchRuntime.ts` 与 durable jobs 负责。 |

A04 的 slot/duration/project baseline CAS、B03 显式角色 membership intent、C05 的 generic patch 媒体拒绝与 dedicated slot/cover owner/kind/recycle 检查，均是下列操作消费的现有 repository 行为。D03 只改变其 UI 调用责任，不改这些原子命令。

## 3. 顺序子单元与具体所有权

建议顺序 D03.1→D03.2→D03.3→D03.4→D03.5→D03.6，每步由一个 product writer 实施、独立 check 后再继续。下述是责任切口，不要求逐文件提交；主会话决定正式分派与验收粒度。

### D03.1 镜头命令与输入适配（PU-08，风险中）

未来产品写入：`src/components/shots/ShotEditorPage.tsx`；新增 `src/components/shots/shotEditorCommands.ts`、`src/components/shots/useShotEditorKeyboard.ts`。

`shotEditorCommands.ts` 接收明示 scope 和 ID 快照，拥有“用户命令→现有原子 repo→成功的 UndoAction”这一适配责任。建议三个窄函数：

```ts
applyShotBulkCommand({episodeId, selectedIds, patch, label})
  : Promise<UndoAction | undefined>;
deleteShotSelectionCommand({episodeId, selectedIds})
  : Promise<UndoAction | undefined>;
reorderShotGroupCommand({episodeId, fullOrder, groupIds, activeId, overId})
  : Promise<UndoAction | undefined>;
```

实现依据必须是现有 `patchEpisodeShots` / `undoEpisodeShotBulkPatch`、`deleteEpisodeShots` / `restoreShots`、`reorderGroupInFullOrder` / `reorderShots`。bulk 返回的 inverse 和 delete 返回的 Blob snapshot 成为 restore 闭包的唯一来源；不从 React rows 重建 before。reorder 保留当前 whole-order undo 语义，不自行加 revision/CAS 或宣称原有 reorder 冲突已解决。无变化/空选择不产生 UndoAction；失败抛给调用 UI。UndoController 继续拥有 expiry、pending、替换、失败重试，不复制它。

page 负责过滤、选择、bulk 控件清空时机、registerUndo 和 error 呈现。keyboard adapter 只负责监听/清理、form/overlay 焦点排除、preventDefault 与 typed intent 回调：activate/select/selectAll/add/delete/reorder；通过 latest ref 获取 unavailable 和可见顺序。实际消费者是 bulk toolbar、捕获式全局键盘以及 BeatBlock 的 drag completion。所有重排最终使用同一完整顺序命令，不能拿 visible IDs 当全量 IDs。

D02 后 DB 消费：`db/shots.ts`（shot commands）、`db/episodes.ts`（beat/filter commands）、`db/projects.ts`（列/视图设置）；此步骤不拥有这些 DB 文件。keyboard 与 DnD 不建立各自的撤销事务。

### D03.2 列类型与行/关系组件（PU-08，风险中）

未来产品写入：ShotEditorPage；新增 `src/components/shots/ShotRow.tsx`、`src/components/shots/ShotRelationsEditor.tsx`、`src/components/shots/shotColumnFields.ts`。BeatBlock 暂留 page，保留现有 JSX 结构和 nested sortable；单纯缩短文件不作为额外提取理由。

- ShotRow 拥有 sortable row、viewport anchor、列控件和 slot widgets；沿用现有 props 的 typed scope、`onActivate/onMove/onDuplicate/onEditRelations/onSlotOpenChange`、unavailable 与 selection。selection 建议窄化为 `selected: boolean; onSelectedChange(checked: boolean): void`，集中 set 更新仍由 page 拥有。不把持久化业务命令放入 UI primitive。
- `shotColumnFields.ts` 明列九个当前文本字段：content、notes、category、sound、emotion、cameraAngle、cameraGear、focalLength、sceneCloseup；排除 durationSec/characters/scene。用 `Record<TextShotColumnId, TextShotField>` + satisfies 和显式 narrowing，使增加列时需明确适配；提供 typed 单字段补丁，移除 `keyof Shot` / `Partial<Shot>` fallback assertion。此处是类型边界，**沿用 PlainCell 当前 commit 行为**，不增加 debounce/baseline/error 协议；那些属于 D08。
- RelationsEditor 拥有 style/props 控件、pending/retryPatch 和错误；retryPatch 窄化为 `Partial<Pick<Shot, "styleId" | "propIds">>`。父页保留 dialog target、关闭/导航保护和 retained row 管理。组件 keyed by shot.id，失败仍不销毁表单；saving 禁止 close，error 显式 discard/retry。style undefined/null/string 三态与失效 prop 修复不变。
- B03 checkbox 仍传 `checked === true` 给 `setShotCharacterSelected`，不能改回基于旧 row 的整数组拼接。显式清空和 bulk assignment 继续精确替换。

真实消费链：page→BeatBlock→ShotRow→EditableGenerationSlot/DurationInput；page 的关系 dialog→ShotRelationsEditor→`patchShot`。GenerationSlotCard、DurationInput、useManualDraftGuard、useShotMedia 不在本步写入范围。保证 row 160px anchor、active/dragged/viewport 保活、slot open 计数和失效记录的 dirty/pending 会话仍可见；focusShotId 不成为 remount key。

### D03.3 音频选择与导出，音乐变体（PU-08，风险中高）

未来产品写入：`src/components/audio/AudioWorkspacePage.tsx`、`src/components/audio/AudioTimeline.tsx`、`src/components/music/MusicWorkspacePage.tsx`；新增 `src/components/audio/audioSelection.ts`、`src/lib/audio/buffers.ts`、`src/lib/audio/exportMix.ts`、`src/components/music/switchMusicVariant.ts`。

**纯选择**：`deriveAudioSelection(snapshot, previous, intent): {patch: Partial<AudioSelectionState>; seek?: {clipId: string; position: number}}`，state 只有 chapterId/segmentId/takeId/clipId，intent 是 segment/clip/take/saved 四个具名分支。page 应用 patch 并产生原有 seekRequest 的唯一 token；helper 不读 DB、不产生 Date.now、不管理 Inspector/VoiceLibrary。

保留明确的不对称：segment 重复选择只设同一个 segment，不重置 take/seek；优先 selectedTake、其次最后 take，clip 先匹配 adopted 再匹配该段落任一 take。clip 选择只同步有 take 时的 take/segment，当前不主动切 chapter/seek。take 选择可切所属 chapter，缺 owner 时清 segment；seek 只在找到对应 clip 时产生。saved 设置新 take、清 clip、按现有 owner 切 chapter，自己不开 seek。缺 clip/take 时当前保留哪些字段，使用 patch 精确表达，不能“一律清空”。ScriptDocument→selectSegment、AudioTimeline→selectClip、AudioInspector→selectTake、AudioSources→saved 是真实消费入口。

**buffer/load 与导出**：将当前 loadBuffers 和现有 cache 放入 buffers.ts，两个实际消费者为 Timeline startPlayback 与 exportMix。沿用 preflight、缺媒体失败和同一缓存，不创建新的全局 service。`exportAudioMix({projectId, projectName, chapterId, scope}): Promise<{blob, filename, attenuation, attenuationDb}>` 拥有 flush→repo snapshot→schedule→render→`addAudioExport` 的完整命令顺序。UI 只在持久化成功后调用 downloadBlob 并设 notice。

导出不得直接传 live render snapshot。先 flush，再由 `getAudioProjectSnapshot` 冻结，所有解码/render 在 DB 事务外；`addAudioExport` 仍在现有事务中验证、原子保存 media+export，保留 fingerprint/duration/scope/chapterTitle。不把 Blob URL 下载放入持久化事务。player instance、playEpoch、audition/seek/composition cleanup、drag/pointer capture/Alt snap、history 与 actionBusy 留 Timeline；它们是实际交互生命周期，不为 complexity 数字再建万能 Hook。

**音乐变体**：`switchMusicVariant({projectId, draftId, target, links}): Promise<{draftId: string; links: VariantLinks}>` 明确拥有 flush→重读并验 owner→复用合法目标或 addMusicDraft→linkMusicVariants。page 持有 variantLinks ref 和 storageKey，返回后仍先更新 links、best-effort 写 localStorage、再 setDraftId；不把 localStorage 失败变成“持久化失败”。page 的 actionPending/submissionPending 同步锁继续覆盖变体切换、新建、reuse、收藏/复制等原有操作。MusicCreation 提交仍回调同步设置 submissionPending；不将它替换成异步 setState effect，也不改 C02 settings/revision/schema。play queue/filter/details 保留在 page，D03 不调整列表排序、性能、布局。

### D03.4 聊天执行会话与具名执行流程（AU-08，风险高）

未来产品写入：`src/components/agent/AgentChatPage.tsx`；新增 `src/components/agent/useChatExecutionSession.ts`、`src/components/agent/chatExecutionActions.ts`。

`useChatExecutionSession(activeThreadId)` 是 feature 内的 UI 生命周期 owner，返回 pending/sending、`run(initialThreadId, operation)`、`bindThread(session, id)`、stop 和 scope 变化处理。session 包含 controller/signal、唯一 token 和 initiating thread；同步 ref 在首次 await 前取得互斥；finally 只能释放自己的 token。没有全局 store，不读写 durable run，不创建第二套 Web Lock 或重试策略。

`chatExecutionActions.ts` 提供三个具名入口 sendChat / retryChat / actOnChatRun，接收 session、冻结选择、reference draft 操作和 navigation 回调。将既有明确步骤移入这些函数；repository/transport/审批区别在具名函数体中可见，不能藏进 `useAsyncAction`、任意 operation registry 或一个统一“transaction callback”。page 保留数据查询、route/props、task board/dialog 和中文反馈。

- send 仍使用 `runWithCompatibleChatModel`，冻结 connector copy/model/effort/interaction/project/taskMode/selectionRevision 和 references.capture。home 新建 thread 后先 bind destination；先拿 Web Lock，moveTo 到真实 thread+project scope，再 navigate。navigation 失败仅在 transfer.restore 仍合法时恢复；begin 使用 owner snapshot，成功才 `references.acknowledge(owner)`；route 切换后 begin 迟到，清理仅属原 owner并取消 transport。
- retry 仍重读 run、验 thread、resolve **原** connector、assertRetryConnector，复用原 model/request；显式 begin 新 attempt，遵守现有 canRetryRun 限制。不能消费当前下拉选择改变历史请求。
- cancel 在 thread lock 内保存 cancel，无 connector 请求。approve/reject 在 lock 内先保存决定，仍有 awaiting approval 时立即返回；决定已保存但 connector 缺失/变化时显示原有可恢复错误，不能回滚审批。无待审批且未 abort，才校验 frozen run connector/model 并 resumeChatRun。
- effect cleanup/back-forward/openThread/delete/new-topic abort 指向相应 session；new-thread 自己导航不 abort 自己。UI sending 保持到 execute/resume 的最终持久化 flush 完成。锁不可用/compatibility failure/prepare rejection 均释放当前 UI owner，保留未发送草稿。

实际消费者：ChatWorkspace、HomeWelcome 的 composer send；ChatWorkspace 的 retry 与 AgentRunDetails actions 经 page 回调；stop/openThread/newTopic/delete 的会话取消。沿用 runOwnership / runChat / agentRuns / agentTools。D02 后元数据/connector/cascade 消费分别用 db/chat.ts、db/connectors.ts、db/cascadeCommands.ts；D01 generationPreparation/target/guards 叶节点不得复制或退回 runtime owner。

`recoverAbandonedRuns` 与 `recoverTaskWrapups` 的 mount/focus effect 暂留 page，继续原频率与 scope；pagehide/离开调用 pauseThreadGeneration 只停止本地等待。AgentGenerationBatches→startGenerationBatch/stopGenerationBatch、generationRuntime 的 paid POST/GET/download 不迁入 UI session。accepted job 不二次 POST，unknown 不自动重试，draft/queue/selection/history 继续 durable；保留现有音频 useProjectAudioJobs 的已受理任务查询行为，不新建 polling。

### D03.5 聊天选择快照（AU-08，风险中高）

未来产品写入：AgentChatPage；新增 `src/components/agent/useChatSelection.ts`。model discovery transport 与 catalog 可以留 page，消费已规范化选择身份，不涉及 D07 provider 请求。

单个 snapshot 显示 scope/revision/connector/model/effort/interaction/project/taskMode；connector 的执行 copy仅短期内存，不写入新的持久化 snapshot，不把 API key 写 run。snapshot 中保留不同字段的真实生效作用域，不能拿一个 thread key代替 effort 的 connector+baseUrl+model key。

Hook 拥有现有 thread→local reconciliation、connector fallback、model trim/allowlist、effort policy、interaction 默认值及显式 setter 的 revision 更新。setter 在 await 前同步递增 revision，返回原 metadata mutation Promise；page 用统一错误反馈消费 rejection。请求相容性比较与 frozen run retry 分开：send 的 isCurrent 检查 selectionRevision/thread/connector/model；retry/resume 仍只按原 thread 判当前，不受当前 model dropdown 改变影响。

当前行为是 optimistic local selection 与 live persisted thread 合并，不引入全字段 transaction、自动 rollback、全局 last-writer-wins 或新的 selection persistence schema。失败是否应回滚选择是另一个产品决定，D03 不擅自改变。project setter仍调用 bindChatThreadProject，保持已有归属锁定和 B07 home 项目草稿隔离；useReferenceDraft 保持为 compose owner，禁止将草稿合并进此 Hook。

### D03.6 shell 与 package 能力（SS-08，风险低/高分开验收）

**D03.6a shell/landing（低风险）**：未来写入 `src/routes/_studio.tsx`、`src/routes/p.$projectId.index.tsx`、`src/components/studio/ProjectGalleryPage.tsx`；新增 `src/components/studio/importStudioProject.ts`、`src/components/workspace/ProjectHomePage.tsx`。

importStudioProject 作为 studio feature 的错误显示 adapter 返回 `Promise<Project | undefined>`，消费现有 importProjectZip；当前真实消费者仍是 shell，保留其 navigate/取消拾取行为。gallery 移除原 helper 和不再需要的 import，不新增导入按钮或第二调用者；单独 adapter 的理由是解除 shell 对大页的反向依赖。toast 不进 package codec。将 SeriesHome 的 kind dispatch、film repair/error/retry 和 keyed queries完整迁入 ProjectHomePage；route 只读 params 并传 projectId。保持 audio/music/series/film 分支、project envelope、ensureFirstEpisode 与 replace URL compatibility redirect，不改路由树生成文件。D02 后 ensureFirstEpisode 属 db/episodes.ts。

**D03.6b ZIP codec 与原子存储（高风险）**：未来写入 `src/lib/projectPackage.ts`、`src/lib/audioProjectPackage.ts`；新增 `src/lib/packages/projectPackageCodec.ts`、`src/lib/packages/audioPackageCodec.ts`、必要的窄共享 `src/lib/packages/packageError.ts`。

- audio codec 拥有 schema/allowlist、parseAudioPackageData、parseAudioPackage 和 remapAudioPackage；与 fingerprint/input/observations 等纯校验叶共享。root audioProjectPackage 继续拥有 snapshotAudioPackage 和 insertAudioPackage：DB reads、parent/relationship/media validators 与 bulkAdd 明确留持久化 owner。schema 的纯 refinement与 DB 验证分开，不能为了纯文件把后者丢掉。
- project codec 拥有当前 entity parse、现代原身份检查、legacy episode synthesis、memory remap 和 scope/asset/default/slot ID remap。建议接口 `parseProjectPackageRows(raw): ParsedProjectPackage` 与 `remapProjectPackageRows(parsed, {projectId, at, mediaMap}): PreparedProjectRows`；raw 是已读取的 JSON 值，prepared 显式包含 project/characters/scenes/props/styles/episodes/shots/memories/memoryVersions/references/referenceChunks/audioPackage。不新增动态 table registry，不把项目导入逐表委托给 create/patch APIs。
- root projectPackage 保留 ZIP IO/manifest/media metadata/Blob 读取、readonly snapshot、ZIP 输出和最终全表 rw transaction；它实际消费两个 codec 和 audio snapshot/insert。parsed 输出必须在 parser补 ID 前检查现代原关系，并继续验证 normalized beat碰撞；media remap 后 prepared rows才交存储事务。shared PackageError 防 codec 回引包含 db 的 root，原 public错误身份保留，具体兼容出口由主会话决定。
- parser/remap 不依赖 UI/database/command owner；storage 可依赖 codec 与既有 DB validators。export 的 compress/hash/Blob decode不进入 IndexedDB transaction，insertAudioPackage 必须加入外层 transaction而非各自提交。完整表集、rollback、旧 ZIP缺 episodes、unknown extra、媒体 metadata/MIME、项目种类与 references/memory 兼容不变。
- C04 fingerprint 顺序不改：对完整原始 rows保存 stale，再 allowlist/repair/remap；current不误变stale，stale/unknown不升级为current；缺历史章/实体保持历史证据。导入 job保持 manual/dormant/无活跃claim及credentials，不触发 paid resume。

**旧契约边界**：未来仅在 `src/lib/productionContext.ts`、`src/lib/generationIntent.ts` 及对应两个测试入口清楚标示“历史 local read/preflight contract、无当前生产消费者”；不为 unused 强行接入 Agent generation，不在此删除/归档 API或测试，不大搬 lib目录。它们仍负责现有遗留校验，活跃 durable execution/paid recovery 的 owner如 D03.4。主会话后续同步 production-contracts的表述；本研究不写 spec。具体移除属于 E07 决定，不提前关闭 SS unused findings。

## 4. 检验计划与证据限度

以下均为未来实施验证，**本稿没有宣称执行或 PASS**。命令必须使用用户本机 `/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm`，不安装、不用 Runtime pnpm；实际从 package scripts执行 test/lint/build，不能虚构不存在的 typecheck脚本。

| 子单元 | 已有回归保留；新增有意义验证 | 必须的 native case |
| --- | --- | --- |
| D03.1–2 | `shotBulkUndo.test.ts`、`shotDeleteUndo.test.ts`、`undo.test.ts`、`manualDraftBaseline.test.ts`、`manualDraftWiring.test.ts`、`b01QueryIdentity.test.ts`、`b03IntentBoundaries.test.ts`、`mediaPatchBoundary.test.ts`、`durationInput.test.ts`、`shotFilters.test.ts`。新增 `tests/shotEditorResponsibility.test.ts` 执行实际 extracted commands/row/key callbacks + 真 repo：全部 bulk allowed fields、空/no-op、实际 deletion Blob、异字段保留/同字段冲突与整组rollback、过滤后 keys/DnD 全序、不吞错误、重复checkbox意图。编译验证 text whitelist覆盖已声明列。 | 同项目 episode 切换期间旧 live-query延迟、定位清 filters；slot dirty+关系保存失败时 route/back/unload/discard；CAS冲突后表单仍可重试；过滤下全选与拖拽不碰隐藏行；160px anchor、焦点/drag、列显隐/快捷键 form排除。 |
| D03.3 | `audioEngineCommands.test.ts`、`audioEngineTimeline.test.ts`、`audioTimelineShortcuts.test.ts`、`audioEngine.test.ts`、`audioFingerprint.test.ts`、`audioFoundation.test.ts`、`musicDraftVariants.test.ts`、`musicDurationContract.test.ts`。新增 `tests/audioSelection.test.ts` 验四条原状态转换，包括重复segment/不同chapter/缺owner/take/clip。新增 `tests/audioExportMix.test.ts` 用真实repo验证 flush失败不render/save；freeze后并发编辑不改变当前导出内容/指纹；存储失败不下载/无孤儿；scope/chapterTitle、attenuation原样。新增 `tests/musicVariantSwitch.test.ts` 验实际page callbacks同步mutex、flush拒绝、owner缺失、合法复用/非法link创建、storage失败仍选持久草稿。 | chapter切换/试听/seek在decode未完成时不晚播放；拖拽trim/Alt bypass、cancel、CAS history冲突；实际声音选择与播放头；render后提交前编辑产生正确历史freshness；music提交中连续switch/new/reuse，reload同一variant family。 |
| D03.4–5 | 保留 `b07ComposeSessions.test.ts` 全部真实page/reference回归以及 `agentRuns.test.ts`、`agentRunReview.test.ts`、`agentToolsReview.test.ts`、`agentGenerationRecovery.test.ts`、`agentGenerationBatchSafety.test.ts`、`agentBatchPreparationRecovery.test.ts`。新增 `tests/chatExecutionSession.test.ts` 执行实际Hook+三个actions：prepare失败、lock不可用、begin失败、transport/flush失败、同render重入、old finally/token、abort路由切换、新线程navigation rollback、selection persistence拒绝、原run配置retry、批准/拒绝保存后connector不存在/仍有待审批、cancel无网络。B07 mock paths如D02迁移，只改边界不弱化断言。 | 两页原生Web Locks与IndexedDB：有主执行时第二页拒绝且draft保留；home→新thread不自abort；A→B/back及旧controller晚结束不清B；begin成功前后不同次编辑保留；approve/reject/cancel，reload accepted/unknown batch无新增POST，显式续传known task只GET/download。利用真实composer与RunDetails入口，覆盖Chat/Responses既有模式。 |
| D03.6a | `b01QueryIdentity.test.ts`、`audioEngineWorkspaceRoute.test.ts`；新增/扩展 `tests/projectHomeResponsibility.test.ts` 执行实际route/feature：audio/music/video/未知kind、series、film无episode repair、失败retry、stale envelope不repair/redirect、import失败toast与取消不navigate。 | 在gallery及其他studio页面使用真实shell ZIP导入，成功进入正确project；film/series/audio/music旧URL、back/forward，repair失败retry保持同项目。 |
| D03.6b | `projectPackage.test.ts`、`projectPackageRelations.test.ts`、`projectMemoryPackage.test.ts`、`agentReferences.test.ts`、`audioFoundation.test.ts`、`audioFingerprint.test.ts`、`audioGenerationRecoveryAudit.test.ts`、`musicLegacyDurationRepair.test.ts`。新增/扩展 `tests/packageCodecBoundaries.test.ts`：真实codec→完整import→export，现代原ID/normalized碰撞拒绝无写、legacy/extra/媒体字节、C04 current/stale/unknown两次roundtrip、dormant job不resume、insert validator及最后写fault整包rollback。绝不能仅比较source字符串或复制parser算法。 | native IndexedDB执行实际ZIP import/export（video+audio+music），证明audio validator加入外层事务、失败无部分rows；下载ZIP重读媒体字节；导入历史job mount/focus不付费POST。 |

每个 step 的新增文件/迁移 consumer 都要 independently read，抓新before/after哈希；从accepted D02做TypeScript/static differential，保留已有warning，不用file size/complexity数字代替行为验证。纯helper测试、mock Hook/JSX host与fake-indexeddb只证明其覆盖语义，不证明ReactDOM/Radix导航/Web Locks/原生事务寿命；native evidence单列。native fixture仅在对应step新增且使用隔离数据库，main决定具体runner。

原生用例可以复用/扩展 `tests/fixtures/b01/`、`tests/fixtures/b07/`、`tests/fixtures/c01/`、`tests/fixtures/c02/`，不可误称它们已有所有D03覆盖；新增D03 harness按实际缺口创建。full tests/build/models属于主会话whole-batch门禁，不在研究中执行。

## 5. 完成责任、复杂度与重叠控制

| Finding | 责任改变的最低证明 | 复杂度/主要回归风险 |
| --- | --- | --- |
| PU-08 | 同一完整顺序/undo command被toolbar/keys/DnD消费；row列字段有封闭类型边界；关系错误会话仍由page管理离开；纯audio selection与export workflow、music variant persistence从布局分离。 | 中高；最易错在filtered full order、最新inverse/Blob、retained dirty行、选择不对称、导出事务/渲染顺序和同步submission mutex。 |
| AU-08 | 三执行入口共享一个UI session owner并保持三个具名业务过程；选择的scope/revision/生效规则在一个feature snapshot；真实thread lock、draft转移和原run配置仍可审读。 | 高；home绑定、B07 transfer/clear时点、old finally、决定保存与resume分离、final flush及paid未知结果。 |
| SS-08 | shell不再依赖gallery页导出；landing业务回feature；纯codec无DB/UI依赖，package命令拥有完整snapshot/insert；遗留local contract与活跃durable generation明确区分。 | shell低、codec高；现代/legacy分支、全表transaction、C04历史指纹、credentials/claim剥离及ZIP兼容。 |

D03实施可以分步验收但最终finding判定只由主会话在独立PASS后更新；本稿不赋予later finding closure。若主会话缩小某step，只能报告完成的责任及残留，不能仅因拆了几个TSX就宣称PU-08/SS-08/AU-08全部完成。

所有新owner都必须有以上明确消费者；不新增registry、全局runtime或总揽事务/数据/状态的万能Hook，不批量改目录。UI orchestration处理scope/controller/selection/dialog/反馈；business persistence继续是明确repo/package原子命令；resumable generation继续是ledger/jobs/runtime、Web Lock和显式恢复。D03 source writer顺序拥有上述step的文件，研究者不承担任何source写入。

D02拥有DB责任迁移，D03仅消费其accepted owners；D04拥有上下文query，D08拥有文本draft协议；D03中ShotRow/AgentChatPage/ProjectPackage可能后续再次变化，main应在后续单元更新归属与whole-batch最终hash审核。E性能/布局/unused和兼容barrel具体政策均不由本稿增添用户要求。

## 附：研究时主入口哈希（需在D02后刷新）

本清单只标记定向研究的主要入口，不声称全src或所有相关文件逐行覆盖。

| 当前文件 | SHA-256 |
| --- | --- |
| `src/components/shots/ShotEditorPage.tsx` | `c2e83c197b71236a2f09985012fcc8447b51392db5ca2b43499bc057fcaac428` |
| `src/components/audio/AudioWorkspacePage.tsx` | `dc6d7f4c154c9d6e7a032a06a7c767c193e9ceeefb270f4e9b864b7af68beb3e` |
| `src/components/audio/AudioTimeline.tsx` | `607778048835edc4aae79c144a9c86f8a43733707aeabc5f3d602a4d6d3a84b2` |
| `src/components/music/MusicWorkspacePage.tsx` | `7ad5b9465b7ed4a63a27e604eb457655c4a218068954dcea4ddada49e5f9c47c` |
| `src/components/agent/AgentChatPage.tsx` | `e59b75a283eeaf80084d7b8769ca842003a21460ad3e9347c288fdfa8a5d6487` |
| `src/components/agent/useReferenceDraft.ts` | `c2649c23d53889a4d6bdacbaa533858001746cba4400ab4b8e1baf60ad3cf48f` |
| `src/components/agent/AgentGenerationBatches.tsx` | `fa631d922c11747e8b4457d0f10c618a3997bb7f1c27ba2e6e57c16c29e07355` |
| `src/lib/projectPackage.ts` | `ee0ef3c984a4454f5d90e9ac7b8c0570f919024fb2078d9862fad93efc2cb555` |
| `src/lib/audioProjectPackage.ts` | `8412440a2fc31960d444d71e6a3d5b5cd8c3e4dd2c713d03db3be6bb95737331` |
| `src/lib/productionContext.ts` | `00b0cf737985565c0c30aa6be63280b497d1453f939327041909885436a751fb` |
| `src/lib/generationIntent.ts` | `0b6e2e30b66317927754feb9f888fedbbcb61f8f3db3bbdb0fc005b01ddc85ae` |
| `src/routes/_studio.tsx` | `d6b7686f6cecb140b5b9e06ca41cf813a4cc3590f795c36f2dfe228dfde7c342` |
| `src/routes/p.$projectId.index.tsx` | `0a20cef48da89ebf46de8555d34a0d27c39ddc8b2d8464941610994ff61be63f` |
