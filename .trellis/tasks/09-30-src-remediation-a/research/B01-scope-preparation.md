# B01 窄范围准备：SS-01 / PU-05

日期：2026-09-30。研究角色，只读产品；本轮仅新增本文，不修改产品、依赖、规范、台账，不提交、不派子代理。主会话要求停止扩展后，本文直接固化已获得证据。A01–A04 继续由主会话按批准顺序推进，B01 不提前实现。

## 结论与证据等级

1. **SS-01 的 retained-query 消费窗口成立。** 项目父入口没有项目 key，WorkspaceChrome 消费旧项目/第一集并用新 route projectId 拼链接。原审查已有 SSR 证据；本轮另外用真实 WorkspaceChrome、安装的 router/liveQuery 在隔离浏览器观察到 URL 为 B、标题为 A、链接为 `/p/B/e/A-episode`。这是 UI 身份混合，不是 repository 越权。
2. **PU-05 中资产槽会话重新绑定有隔离浏览器行为证据。** 真实 CharacterDetailPage + EditableGenerationSlot + GenerationSlotEditor，在同 owner 换资产后保留 A 草稿，保存回调向 B 提交。保存出口是内存 spy，未写真实 DB；不能把它描述成已经在用户库复现错写。Scene/Prop/Style 为相同源码模式，仅静态确认，未逐个浏览器验证。
3. **镜头与打印页的换集窗口有源码证据，未做浏览器延迟验证。** Story 的当前正式 route 已有 `key={episodeId}`，Produce 有内部 project+episode key，不能按“所有 episode 页面都缺 key”统一改造。
4. **key 和 query identity 分别解决不同问题。** key 应放在创建 useLiveQuery/useState 的边界之前；query 返回完整查询身份，尤其是 null/空数组也要标身份。只比较 owner 或只给查询下方编辑器 key，不能证明输入属于当前 route。
5. **重挂载前必须处理手动 dirty/pending 会话。** 自动保存文字已有 scoped retained controller；slot、输出设置、关联草稿等并不因此自动保留。不要用 key 将“错绑目标”变成“静默丢稿”。

## 已读取决策与规范

- 父任务 `.trellis/tasks/09-30-src-quality-remediation/prd.md`、`design.md`、`remediation-ledger.json`：B01 覆盖 SS-01/PU-05，状态 pending；本研究不变更状态。产品串行，风险分析可并行。
- 子任务 `.trellis/tasks/09-30-src-remediation-a/prd.md`、`design.md`、`implement.md`、`implement.jsonl`：A04 已包含字段/槽 baseline、失败保留 session、异步目标切换保护。以主会话最终设计为准，本文不另订协议。
- 原研究 `.trellis/tasks/09-30-src-quality-architecture-audit/research/shell-shared.md` 的 SS-01/02，`production-ui.md` 的 PU-02/03/05。
- `.trellis/spec/frontend/hook-guidelines.md`：missing 必须在 querier 内转 null；变更依赖时允许 retained result，结果应带 identity，匹配前视为 loading。

## 实际消费链与精确位置

| 链路 | 当前源码与判断 |
| --- | --- |
| Router → 项目 Chrome | `src/main.tsx:9` 未设 defaultRemountDeps；`src/routes/p.$projectId.tsx:10` 没有 key。安装库 `node_modules/@tanstack/react-router/src/Match.tsx:192`–`:213` 仅从 route/default remountDeps 计算 component key，`:315` Outlet 按 routeId 渲染。参数改变可以复用实例。 |
| Chrome → 项目/集/导航/设置 | `src/components/workspace/WorkspaceChrome.tsx:50` 项目查询，`:54` currentEpisode，`:62` firstProjectEpisode；`:81` loading 门没有结果身份；`:128`–`:131` 直接派生标题/filmEpisode；`:175` 起导航同时使用新 projectId 和 loaded episode.id；`:314` 把 loaded project 交给设置。currentEpisode 的 querier owner 验证 `:58` 仅作用于新完成结果，不能验证 retained 旧结果。 |
| 项目 home → kind/repair/Navigate | `src/routes/p.$projectId.index.tsx:18`、`:22` 两个查询无 identity；`:29` repair effect、`:41` ensureFirstEpisode 使用 route projectId；`:48`/`:49` 用 retained project.kind 选择音频/音乐；`:54`–`:59` Navigate 能组合新项目与旧 episode。旧 null 也可能误触 repair，单纯 `row.id` 比较无法辨识 null 的查询归属。 |
| 镜头页 → 列表/编辑 | `src/routes/p.$projectId.e.$episodeId.shots.tsx:14` 无 key。`src/components/shots/ShotEditorPage.tsx:241`/`:245`/`:249` 项目、episode、shots 查询；shots 未加载直接 `?? []`；角色/场景 `:254`/`:259` 同样无 identity。`:265` relationAssets 已有 project identity；`:335` reset effect 只重置状态，不能清 retained query；`:354` 匹配仅保护 focus effect；`:557`–`:564` 全页门未要求 episode.id 匹配。`:1478` ShotRow 已按 shot.id key，因此行内槽目标一般由旧 shot.id 决定，但 retained 旧行仍可被当前页面普通操作消费。 |
| 镜头槽 | `src/components/shots/ShotEditorPage.tsx:1711`/`:1721`/`:1731` 三个槽分别经 `:1717`/`:1727`/`:1737` 调 setShotSlot(shot.id, field, slot)。不应误报为三个槽互相共享同一 state；它们有不同树位置且行已有 key。需要保护的是整个查询/页面身份与离开会话。 |
| Story | `src/routes/p.$projectId.e.$episodeId.index.tsx:10` 已按 episodeId key，当前同项目换集会重建 page。`src/components/story/StoryPage.tsx:35`/`:36` 本体若被直接复用仍无 identity，`:50` 只验 owner；`:56` StoryEditor key 处于查询之后。`:77`–`:85` 文字草稿用 episode+field draftKey、project scope 与 baseline。正式 route 风险比原笼统描述窄；跨项目由项目父 key 覆盖，无需首先改 Story 的字段编辑逻辑。 |
| 打印 | `src/routes/p.$projectId.e.$episodeId.storyboard.tsx:10` 无 key。`src/components/produce/StoryboardPrintPage.tsx:19`/`:23`/`:27` 查询无 scope identity；`:40` relationAssets 有 project identity；`:50` loading 门仍可接受上一集；`:62` 仅验 episode.projectId。`:66` deriveEpisodeDelivery 因而可能消费同项目旧集。只读打印也必须防止输出错误集。 |
| 已隔离对照 | `src/components/produce/ProducePage.tsx:33` keyed ScopedProducePage(project+episode)；`src/components/music/MusicWorkspacePage.tsx:39` keyed inner，`:45`/`:97` 另有 project query identity；`src/routes/p.$projectId.index.tsx:48` 音频入口已有 project key。不扩展重写这些组件。 |
| 四类资产 | `src/components/assets/CharacterDetailPage.tsx:19` 查询，`:27`–`:28` missing 只验 owner，`:65` slot.id key，`:71` 保存使用当前 loaded character.id。Scene/Prop/Style 均是 `:19` 查询、`:24`–`:25` owner 门、`:73` slot.id key、`:79` entity.id 保存。文字已按 entity+field key（Character `:77` 起），故槽问题不能泛化成所有文字草稿同样跨资产重绑。 |
| 资产入口 | 项目四条 `src/routes/p.$projectId.assets.{characters.$characterId,scenes.$sceneId,props.$propId,styles.$styleId}.tsx:10`，工作室四条 `src/routes/_studio.{characters.$characterId,scenes.$sceneId,props.$propId,styles.$styleId}.tsx:10` 均无 page key。Prop/Style 默认 back=studio，见各 detail `:13`；key owner 应取显式 projectId 或 STUDIO_LIBRARY_ID，不取新对象 back 的引用。 |
| slot draft/session | `src/components/slots/GenerationSlotCard.tsx:179` draft 只初始化一次，`:184` 建 DraftMediaSession；`:191`–`:199` 真卸载 microtask cancel；`:243` existing media 检查当前 projectId；`:301`–`:307` save 调当前 render onSave；`:453` EditableGenerationSlot、`:470` 最新 value、`:483`–`:490` 对打开的 editor 持续传最新 value/onSave。target 没有显式不可变身份。 |
| session 清理 | `src/lib/draftMedia.ts:11` 上传进入 owned，`:35`–`:50` save 成功后移出 committed IDs，失败仍保留剩余 owned/session；`:53` cancel 等 pending 完成后只清 owned orphan。key 卸载会触发这条 cancel；不要删除已有/shared media，也不要因 CAS 失败主动销毁 session。 |
| material | `src/components/studio/MaterialLibraryPage.tsx:117` detail 无 id key；`src/components/studio/materials/MaterialDetailPanel.tsx:47` 查询 retained material，`:48` 却用请求 id 给 MaterialEditor key；`:66` 从 material.scope 初始化项目选择。`:186`–`:189` promote 后 onSelect(copy.id) 是实际 id 切换路径，可在新 key 下初始化旧 material。需 query identity，只有 editor key 不够。未运行该浏览器流程。 |

## 浏览器验证：已执行与限度

真实浏览器工具可用：Edge inventory 报 auth token unavailable；另行创建的内置浏览器 about:blank 成功。本轮仅在内置浏览器访问内存 HTTP server 的临时 loopback origin，未启动产品 Vite、未访问现有产品 origin。

夹具在 node_repl 内存中用项目已安装 esbuild 构建，`write:false`，未写夹具源码/产物文件。保留真实 React、TanStack Router、Dexie useLiveQuery、产品组件代码；db 模块替换为 synthetic async rows；repo 保存替换为 spy/禁用操作；上传、媒体选择、备份出口禁用或 stub。无 IndexedDB 数据读写、无远端/付费 API、无凭证读取。此证据证明 UI 目标绑定，不能证明真实 repository 持久化或完整产品所有路由时序。

### 资产槽夹具：已观察

- 真实 CharacterDetailPage、EditableGenerationSlot、GenerationSlotEditor、DraftMediaSession、基础 Dialog/输入组件；媒体 preview/picker stub；synthetic owner=P，资产 A/B。
- 初始 `/detail/B`，Link 到 `/detail/A`；A 名称加载完成，打开“角色 · 正面”，输入 `draft from Asset A`。
- 浏览器 history back 到 `/detail/B`；B 第二次读取人为延迟 12 秒。首个 DOM 观测 `{url:'/detail/B', name:'Asset A', prompt:'draft from Asset A'}`。
- 等待 DOM 中 `Asset B` 出现；随后观测 `{url:'/detail/B', name:'Asset B', prompt:'draft from Asset A'}`，同一 slot Dialog 仍打开。
- 点击保存，DOM spy 输出 **`[{"id":"B","slot":"front","prompt":"draft from Asset A"}]`**。没有向真实 DB 写入。
- synthetic fixture 的 initial slot 字段名用 portrait，真实产品正面槽是 front，因此打开时为空槽；这不影响验证“在 A 创建的新草稿最终提交 B”，不把它描述成 A 原有槽内容迁移。
- 未测试真实上传/Blob 清理、失败重开、forward、四资产逐类、完整产品 chrome 包装与 blocker、同目标外部变更。

### WorkspaceChrome 夹具：已观察

- 保留真实 WorkspaceChrome，项目父 route `/p/$projectId` 无 key；world 子 route；settings 子面板 stub，备份与封面写出口禁用。
- synthetic A/B 均为 film，各自第一集为 A-episode/B-episode；B 项目和第一集读取延迟 12 秒。
- 从 `/p/A/world` Link 到 `/p/B/world`，DOM 仍显示 **Project A**，故事/分镜/制作链接分别为 `/p/B/e/A-episode`、其 shots/produce 子路径。
- B 查询完成后标题为 Project B，链接恢复 B-episode。正常对照支持窗口来自查询延迟，而非永久数据拼装错误。
- 未打开真实项目设置，未运行 SeriesHomeRoute Navigate/repair 浏览器用例，未验证 film→music/audio、actual episode routes、用户数据或实际跨项目保存。home 判断为源码支持，原 SSR 为历史证据，本轮没有重跑 SSR。

## 最小后续产品文件范围与 key/identity 放置决策

推荐按消费边界处理，不批量修改全部 route，不设全局 defaultRemountDeps。

| 必要位置 | 推荐窄变更 |
| --- | --- |
| `src/routes/p.$projectId.tsx:10` | WorkspaceChrome 按 projectId key；同项目换 tab/episode 保留项目 Chrome 与设置长期状态。不要把 episodeId 放进 Chrome key。 |
| `src/components/workspace/WorkspaceChrome.tsx:50` | 三个 querier 返回查询 identity：projectId；currentEpisode 为 projectId+episodeId；firstEpisode 为 projectId。匹配后才消费 row/null 与生成导航。父 project key 不解决同项目 currentEpisode 变依赖。避免只读新 row 的 id 而遗漏旧 null。 |
| `src/routes/p.$projectId.index.tsx:18` | home 的项目与第一集带 project identity；所有 kind 分支、repair effect、Navigate 先要求身份匹配。repair/pending/error 应属于当前项目，父 project key 已覆盖生命周期。 |
| `src/components/shots/ShotEditorPage.tsx:232` | 推荐 public wrapper 按 projectId+episodeId key 包住实际包含 queries/state 的 inner，沿用 ProducePage 模式；focusShotId/search 不进 key，避免定位导航抹掉同集草稿。这样不必另改 shots route。仍核验 row owner/scope；需要 independently pending 集合时用 identity，不以 `?? []` 宣称 loaded。 |
| `src/components/produce/StoryboardPrintPage.tsx:12` | 同样 public wrapper key=project+episode，重挂载发生在查询之前；无需额外改 storyboard route。此页无手动 draft，范围较小。 |
| 四个 `src/components/assets/{Character,Scene,Prop,Style}DetailPage.tsx:11` | 每页 public wrapper 的 key 含 owner+entity，inner 才调用 useLiveQuery；统一覆盖工作室与项目两套入口，避免改八条 routes。结果至少要求请求 entity/owner 匹配。槽 key 在现有 `:65`/`:73` 改成 owner+entity+slot，含义明确；不能给 stale row 下方 editor 单独使用请求 id key。 |
| `src/components/studio/materials/MaterialDetailPanel.tsx:47` | `{id, material}` query result，身份匹配前显示 loading，匹配后区分 null/not-found，并用 material.id key 渲染 editor。是本轮最需要 query identity 而非孤立子 key 的路径。保留现有 MaterialEditor guard。 |

以上核心读取/挂载范围为 **10 个产品文件**。下列会话保护属于使该方案不丢稿的必要配套，按 A04 交付后实际差额决定：

- `src/components/slots/GenerationSlotCard.tsx`：复用 A04 的固定 target/baseline/session，确认其对 dirty/pending 导航是否已有 guard；若无，B01 要补。不能用 entity key 代替用户明确放弃手动草稿的机制。
- `src/components/workspace/ProjectSettingsPanel.tsx`：输出设置当前只有 beforeunload，跨项目 client navigation 可能丢草稿；若 A04 未补，此处应接 router dirty/pending blocker 与原 close 流程。保持项目 Chrome 的 close confirm（`WorkspaceChrome.tsx:71`、`:347`）语义，避免两个不同保存/放弃协议。
- `ShotEditorPage` 关联编辑为局部手动草稿，需要离开前保护；同文件已在核心范围，不另立统一 editor 工厂。
- Story 的现有 episode key、Produce、Music 不列入默认产品改动；WorldSettingPanel（`:33` 查询、`:47` editor key）跨项目由父 key 覆盖，文字 scope 已正确。不借 B01 拆 repository/领域目录。
- 可选将 Story route key 从 episodeId 写成 project+episode 以表达 scope，但不是解决本轮已复现问题的必改文件；如使用 public wrapper 统一支持直接调用，也应由后续回归证明其必要性。

## dirty draft 与现有 blocker：必须保留的行为

| 状态 | key 重挂载的实际影响与要求 |
| --- | --- |
| 自动保存文字、故事、世界设定、有效时长 | `src/lib/debouncedDraft.ts:227`–`:242` 按 scope+draftKey 复用 retained controller；`:280` 注册；`:303`–`:308` 卸载 dispose+flush；`:193` dispose 不清 baseline；`:16` unregister 失败保留 pending entry。字段/entity key 不变时失败可重开恢复，不能清整个 scope registry。AssetTextField `:18`–`:23` 传正确 scope/draftKey。这不等价于跨浏览器重启持久草稿。 |
| 非法/中间时长输入 | `src/components/shots/DurationInput.tsx:10` raw 仅 local state；`:30` 解析失败不进入 controller。换集重挂载会丢如未完成小数的 raw；有效 numeric draft 可 retained。别声称所有输入逐字恢复。 |
| 手动槽 draft/失败上传/owned media | GenerationSlotEditor `:179`、`:186` 均 local；卸载 `:197` 触发 session.cancel，草稿与 File 重试状态丢失，新上传 orphan 会清理。失败保存应继续保留打开会话；导航 dirty 时须先继续编辑/明确放弃，pending 时等待；明确放弃才 cancel。baseline 无法单独保护草稿生命周期。 |
| 项目输出 ratio/defaults | ProjectSettingsPanel `:135`–`:138` local，`:144`–`:152` 仅 beforeunload，无 router useBlocker。Chrome `:71` 只保护关闭设置，不保护参数导航。跨项目 key 会丢输出草稿；同项目 tab 切换不应因不必要的父 key 丢设置。 |
| 镜头关联/批量表单 | ShotEditorPage `:272` relation status 与 `:274` beforeunload，`:291`–`:302` 多个 local 批量/选择状态。原 `:335` 已在换集时重置部分表单；wrapper 会扩大到全部 local state。批量尚未提交输入不自动保存，关联 dirty/error 不应静默丢。定位 shot search 更改不得触发 remount。 |
| 素材元数据 | MaterialDetailPanel `:60` draft + `:72` useMaterialDraftGuard；`src/components/studio/materials/MaterialControls.tsx:91` blocker，`:96` requestClose，`:100`–`:116` reset/proceed，pending 时不显示“放弃并离开”。保留这套行为，query identity 不能在旧 dirty editor 尚未获准离开时直接卸载它。内部 onSelect 是 state 变化，router blocker 不自动覆盖；已读 promote 按钮 `MaterialDetailPanel:185` 用 operationsDisabled=dirty/pending，不能移除这一防线。 |
| 其他现有 blocker | MemoryEditor `src/components/memory/MemoryEditor.tsx:111`、IpProfileEditor `src/components/studio/IpProfileEditor.tsx:87` 已有 router blocker。项目父 key 不应通过新 location/提前清状态绕过它们；离开先 reset/proceed 判定、获准后才 remount。不修改这些文件，回归验证。 |

额外注意：Chrome 的 currentEpisode identity gate 若直接使整个 Chrome 返回 loading，会同时卸载其 Outlet。应评估保留设置和旧会话 guard 的生命周期；不能让导航后的 loading 渲染成为绕过 dirty 会话的卸载路径。先由 router blocker 决定导航，再隔离新 query 消费。

## 与 A04 的衔接（不重设 baseline 协议）

A04 主会话已有 baseline 协议设计，B01 接受其最终实现。需要向主会话传递的约束仅有：

- `GenerationSlotEditor:179` 的草稿初始化、baseline、不可变 target、所属 project 和 owned media session 必须来自同一次 editor 打开；不能因为 liveQuery 更新 value/onSave 便重绑目标或 baseline。
- A04 的同字段/同槽冲突与 B01 的 target identity 为两个独立不变量：A/B 两槽刚好有相同 baseline 时，CAS 仍可能放行错绑目标，必须先固定身份。
- `GenerationSlotEditor:307` → 五个 set*Slot 调用点复用 A04 参数，不在 B01 重写 repository CAS。A04 更改后的文件/行号以主会话最终 diff 为准；本文行号是研究时源码。
- 同 target 的无关字段/槽更新不能改变 editor key 或关闭弹窗；冲突失败保留 draft/session，能重试/采用最新；保存中导航不能使旧 async completion 关闭新 target 的 editor。
- 文字 retained controller 继续保持原 baseline 与 stable draftKey；ProjectOutputSettings 的手动草稿继续保留 A04 保存失败出口。B01 不把“query 新数据”自动当成“用户采用最新”。

## 后续窄回归建议（未在本轮执行）

1. 项目 A→B 延迟读取：film→film、film→music/audio、history back/forward；断言无旧标题/设置、无 B/A episode 链接、无旧 null 触发 B repair；missing 与 loading 分开。
2. 同项目集 A→B：镜头/打印旧 episode 和空数组延迟，分别确保普通 patch、批量操作、过滤、打印都只消费匹配 query；focus/search 更新保留同集 dirty editor。
3. 四资产按 owner+entity 切换：dirty slot history back 应阻止并允许继续编辑；明确放弃后 cleanup 只作用于旧 session，新 entity 不继承 draft；干净切换正常，缺失/跨 owner 正确 not-found。
4. A04 结合用例：同槽并发冲突保留 draft/media session，无关槽并发成功；A/B baseline 相等仍不能错绑；pending upload/save 时导航、真实 orphan/shared-media 清理、失败重试及关闭后重开。
5. 自动保存字段换页/重开：CAS 失败仍保留原 project+entity+field draft，备份 barrier 拒绝未解决失败；合法 duration 数值恢复，非法 raw 的行为单独定义。
6. Material promote/selection：延迟新 material 读取不能把旧 scope 初始化到新 editor；dirty/pending 的 close、router back 与内部 selection 均遵守既有 guard；null identity 等待而非错误 not-found。
7. blocker 正常对照：项目输出、素材、MemoryEditor、IpProfileEditor 继续编辑/reset、放弃/proceed、pending 无放弃；同项目 navigation 保留 Chrome 设置状态。

本轮没有运行全产品 test/build/typecheck，没有持久化到用户 DB，没有测量实际操作概率，没有验证上述未执行矩阵。浏览器夹具行为、源码确定判断与待回归项已分别标注，不能据此直接关闭 B01 或将整个 PU-05 提升为完整产品端到端 confirmed。
