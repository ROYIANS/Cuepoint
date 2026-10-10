# 创作 UI 质量与职责审查（production-ui）

审查日期：2026-09-30。基准提交：`2fc0e9523e62a5258a488cc3d0274d24c8967c6f`。唯一覆盖所有权为 `research/source-manifest.json` 的 `groups.production-ui`：36 个文件、10,853 行，其中 32 个 TypeScript/TSX 文件、4 个 CSS 文件。所有文件均逐行完整阅读；ShotEditorPage 的 2,034 行包含页面、键盘处理、批量操作、BeatBlock、ShotRow 和 ShotRelationsEditor，未以截取热点替代全文。覆盖数组见 `production-ui-coverage.json`，无 blocked 或 generated-verified 项。

产品代码只读；只写本报告和覆盖 JSON，无产品修改、无提交、无派生代理。参阅其他组的仓库、辅助模块、路由、已安装路由实现及测试，只用于证明调用关系，不登记其他组所有权。开始和收尾均核对这 36 个源文件的 SHA-256，均与固定清单一致。

## 研究上下文与证据口径

已读取任务 prd.md、design.md、implement.md、task.json、implement/check JSONL、固定文件清单及 production-ui-signals.json、production-ui-clones.json；任务中没有单独的 research.jsonl。结合 frontend 索引、目录、类型、质量、组件、Hook、状态管理的草稿/撤销/可靠性章节，以及 audio-music、asset-output-foundation、production-contracts、delivery-export 契约核查。规范也接受审查：允许页面调用 repository 是合理约定，但不能替代同字段冲突处理、异步目标隔离及跨记录操作的事务保证。

`confirmed-bug` 表示具体输入/时序下行为已经由代码及隔离运行证明；`structural-debt` 表示职责或维护问题，不能据此宣称已有用户故障；`risk` 表示触发机制成立但尚缺完整浏览器交互验证。P1 为可丢失已保存创作改动的高影响问题，P2 为常规缺陷/明确维护债务，P3 为局部改进。行数及复杂度只是定位线索。

| ID | 优先级 / 分类 | 结论 |
| --- | --- | --- |
| PU-01 | P1 / confirmed-bug | 批量撤销覆盖随后改动，且失败时可部分提交 |
| PU-02 | P1 / confirmed-bug | 媒体槽保存过期整槽快照，缺少提交时基线比较 |
| PU-03 | P2 / confirmed-bug | 时长草稿忽略基线，覆盖外部较新值 |
| PU-04 | P2 / confirmed-bug | 多选角色的整数组补丁会丢失尚未回读的选择 |
| PU-05 | P1 / risk | 路由参数切换时旧查询值/槽编辑状态缺少完整目标隔离 |
| PU-06 | P2 / structural-debt | 镜头和场次文本仍直绑持久化行，错误与恢复协议分裂 |
| PU-07 | P2 / risk | 剧本文件读取晚完成会覆盖其间的新编辑或后一次导入 |
| PU-08 | P2 / structural-debt | 页面同时编排持久化逆操作、交互状态和列编辑协议 |
| PU-09 | P3 / structural-debt | 音频共享 CSS 保留已无渲染入口的旧工作台规则 |
| PU-10 | P3 / risk | 音色配置草稿只有 busy 保护，没有 dirty 退出/恢复机制 |

## 发现及可验证整改

### PU-01 — 批量撤销无冲突保护，也不是一个原子操作

**P1 / confirmed-bug。** 主证据：`src/components/shots/ShotEditorPage.tsx:607`、`:615`、`:618`、`:629`。页面先保存选中行的旧快照，调用 patchEpisodeShots 做正向批量写入；撤销回调从快照重建 affected-field 补丁，然后 Promise.all 调用每行的 patchShot。`src/db/repo.ts:1452` 的 patchShot 在事务内合并当前行，但没有 expected value/revision 参数；`src/db/repo.ts:1470` 的正向批量写入才是整组事务。

**触发与影响：** 批量将时长从 0 改为 5，在 8 秒撤销窗口内再手动改为 9，点击撤销会无提示把 9 改回 0。备注、角色、场景、场次、状态同样受影响。若第二条镜头在撤销前已删除，第一条可恢复成功、第二条报错，整组留下混合状态。引用资产已删除也可能导致其中一行失败。并非 Dexie 没有事务，而是每个 patchShot 各自拥有事务，没有共同的逆操作边界。

**调用关系：** applyBulkPatch → patchEpisodeShots → registerUndo.restore → Promise.all(patchShot)。`src/lib/undo.tsx:37` 在等待 restore 前清除撤销项，`:76` 调用端也未处理失败，因此失败的撤销不能从当前按钮重试。这里只引用 undo 模块作为影响证据，不转移审查所有权。音频 `AudioClipHistory` 和生产提案的 guarded undo 已有更强契约，不应混用为本操作已受保护的证据。

**验证：** 隔离复现输出 `PU-01 newer=9 -> undone=0`；第二个用例返回 `fulfilled,rejected`，并验证第一条已恢复。既有 undo.test.ts 只覆盖注册/过期/一次执行，repo 批量测试覆盖正向 scope，不覆盖此 UI 逆补丁。

**建议：** 为批量逆操作建立一个窄 repository 操作，携带实际受影响字段的 before/after 值，在同一个事务中先校验全部目标、所有权、关系和 after 基线，再写 before。对后续同字段改动拒绝撤销；独立字段改动可保留。是否允许部分撤销应是明确产品契约，当前 UI 没有表达这种选择。回归必须覆盖后续人工/Agent 修改、一个目标失效、全部回滚、重复撤销、错误可见。无需引入通用事件溯源或持久历史系统。

### PU-02 — 媒体槽编辑的上传所有权正确，但整槽快照缺少 CAS

**P1 / confirmed-bug。** 主证据：`src/components/slots/GenerationSlotCard.tsx:179`、`:301`、`:307`；镜头调用者 `src/components/shots/ShotEditorPage.tsx:1717`、`:1727`、`:1737`；资产调用者 `src/components/assets/CharacterDetailPage.tsx:71`、`SceneDetailPage.tsx:79`、`PropDetailPage.tsx:79`、`StyleDetailPage.tsx:79`。

编辑器打开时 useState(value) 捕获整槽；保存只传 draft，没有原槽基线。`src/db/repo.ts:1591` 的 setShotSlot 和 `:887` 的 setCharacterSlot 校验媒体存在、owner、kind、Blob 后替换槽并回收旧媒体，但不比较原槽。其他资产 set*Slot 采用同类逻辑。仓库合并的是当前实体的其他字段/其他槽，无法保护“同一个槽”的较新编辑。

**触发与影响：** 打开首帧编辑器后，其他浏览器页或 Agent 已更新该槽的 prompt/result/reference；本编辑器继续保存旧 draft，较新槽内容会被整槽替换。旧引用仍有效时操作正常成功，用户没有冲突提示；旧引用已被回收时可能报素材失效，不能把这个偶然失败当作冲突保护。回收逻辑还可能清理被刚覆盖结果的 orphan 文件（有提案/其他引用时则保留），增大恢复成本。

**验证：** 使用实际仓库，先存 initial，随后写 newer-agent-edit，再保存从 initial 派生的 stale-dialog-edit，最终 prompt 为 stale-dialog-edit；隔离用例通过。这证明提交机制，未模拟真实 Agent 网络调用。

**建议：** editor 冻结 baseline，与 draft 一起提交；repository 在共享事务内比较目标槽字段 fingerprint/值，冲突时保留 draft，允许明确“读取最新”或重新编辑。应比较目标槽而不是整实体，避免独立文本/其他槽更新制造无谓冲突。DraftMediaSession 对上传的所有权与清理应保持原样；新失败分支继续保护 owned uploads。测试同槽冲突、独立槽并行成功、素材被删除、共享媒体保留、事务回滚、冲突后取消清理。

### PU-03 — 时长草稿接入了序列化保存，但没有使用冲突基线

**P2 / confirmed-bug。** `src/components/shots/DurationInput.tsx:11`、`:13`：persist 只有 durationSec 参数，调用 patchShot，忽略 useDebouncedDraft 提供的 baseline。对照 `src/components/assets/AssetTextField.tsx:17` 与 detail persist 的字段基线参数；`src/lib/debouncedDraft.ts:68` 保留脏字段基线，`:225` 附近把 baseline 传给 persist。hook 本身不会替 repository 判断 current 与 baseline。

**触发与影响：** 本地初值 0，待存草稿 2；外部更新为 9，标量 rebase 不替换 dirty value；随后本地 flush 无条件将 9 改为 2。Serialized writes 只保证本控制器内的保存顺序，无法保护另一个作者。backup barrier 也会执行这一 flush。

**验证：** 隔离使用真实 DebouncedDraftController 和 patchShot，输出 `PU-03 external=9 -> pending-draft=2`。未把合法小数输入、聚焦保留标点或失败重试机制判成缺陷。

**建议：** 为单字段镜头编辑增加窄的 baseline-aware 仓库入口，在 write transaction 内比较 current.durationSec；相等最终值可以合流，冲突抛 DraftConflictError，保留文本并显示采用最新/重试。沿用 parseDurationInput 与稳定 draftKey。测试外部同字段冲突、独立备注修改、重开失败草稿、backup flush 冲突，避免只测解析器。

### PU-04 — 多选的整数组补丁丢掉前一项尚未回读的选择

**P2 / confirmed-bug。** 主证据：`src/components/shots/ShotEditorPage.tsx:1829`、`:1833`、`:1837`、`:1840`。菜单通过 onSelect preventDefault 保持打开，每次选择都从同一 render 的 shot.characterIds 算新数组，直接 void patchShot。`src/components/story/StoryPage.tsx:300`、`:303`、`:306` 的场次角色也从 beat.characterIds 做同类整数组替换。镜头页筛选 `:536`、`:543`、`:550` 和列显隐 `:567` 也有从持久化快照计算完整列表的风险，但本项运行证明的是镜头角色，不把其他路径全标成已复现。

**触发与影响：** 前一次 mutation 尚未完成并由 liveQuery 回读时又选择另一项，两个 handler 都从 [] 推出 [A] 与 [B]；事务正确串行，最终却只有 [B]。这是 UI 提交意图已经丢失，repository 合并不同字段不能补回同字段数组中的 A。

**验证：** 隔离复现按同一个已渲染 Shot 构造两个选择 callback，真实 patchShot 并行执行，最终仅第二个角色；输出 `PU-04 two choices -> only second retained`。证明同一快照窗口的确定性丢失，不宣称已测量实际浏览器输入频率或每次快速点击都会失败。

**建议：** 两种窄方案任选其一：UI 保留本地 selection 并串行提交/显示失败；或仓库提供添加/移除单项的意图操作，在事务内读最新集合后改一个 ID。若是“替换全体角色”的批量操作，则保留 replace 契约并加基线，不应把两个行为混为一个泛化 toggle 工厂。回归同 render 两次选择、快速取消/重选、外部删除角色、独立场景更新，以及失败保持本地意图。

### PU-05 — 参数变化时旧查询和槽草稿的 target 未完整隔离

**P1 / risk。** `src/components/shots/ShotEditorPage.tsx:241`、`:245`、`:249` 的查询不返回 project/episode identity；`:557` 的加载/缺失门只检查 undefined、owner，不要求 loaded episode.id 等于 episodeId。`:335` 清理本地选择不能让 retained live-query 值消失；`:354` 的 identity 保护仅用于定位 effect，没有保护全页普通操作。`src/components/story/StoryPage.tsx:35`、`:50` 类似。`src/components/produce/StoryboardPrintPage.tsx:19`、`:62` 对 project/episode 没有整页 key/identity；其 props/styles identity 检查能挡一部分跨项目窗口，不能解决同项目换集。

资产 detail 的查询依赖 ID，但 missing 只验 owner：`CharacterDetailPage.tsx:19`、`:27`；Scene `:19`、Prop `:19`、Style `:19`。同 owner 切到另一个 asset 时，EditableGenerationSlot 的 key 是 slot.id（Character `:65`，Scene `:73`，Prop/Style `:73`），不是 entity.id+slot。`GenerationSlotCard.tsx:179` 仅初始化 draft，`:487`/`:490` 接收最新 value/onSave，既不重建 session，也不冻结 target。

**调用证据：** `src/routes/p.$projectId.e.$episodeId.shots.tsx:14` 和项目/工作室各资产 detail 路由直接渲染 page，无参数 key；`src/main.tsx:9` createRouter({routeTree}) 无 remountDeps。本地已安装 `@tanstack/react-router/src/Match.tsx:192` 仅按 route/default remountDeps 计算组件 key，默认 undefined。Hook spec 明示 useLiveQuery 会保留上次结果。音频项目入口 `src/routes/p.$projectId.index.tsx:48` 已按 projectId 加 key，音乐页 `MusicWorkspacePage.tsx:39`、制作页 `ProducePage.tsx:33` 已自带 keyed inner，故不泛化到所有页面。

**触发与影响：** 同项目 A→B 集切换，在新 query 完成前仍可出现旧镜头/旧故事，直接 patchShot 会修改旧行，scope-checked bulk 则可能报错；素材槽打开期间通过浏览器历史等改变同一 detail 路由 ID，若组件保留，旧 draft/session 随新的 onSave 写到新的同 owner 资产。跨 owner 时 owner 校验可挡住部分路径，同 owner 校验不能挡。这是读取目标和持久化回调重新绑定的窗口，不能只以“关闭后取消异步”解决。

**限度：** 路由和组件代码、安装包实现已核查；未启动完整浏览器验证 pending/Suspense、历史切换和 modal 是否最终保留，因此分类为 risk，不报告已经观察到错写。

**建议与验证：** page 用 project+episode、detail 用 owner+entity ID 做 keyed inner；或查询返回完整 identity 并让可编辑子树等到匹配。slot editor 应冻结不可变 target/baseline/session；key 应含 entity+slot。对依赖保留旧值有明确理由的列表可继续保留只读显示，但 mutation 必须使用匹配的目标。浏览器用延迟查询检验同 owner 换资产、同项目换集、历史回退、打开槽后切换、错误草稿重开；断言两个目标的 DB 内容及 owned media 清理归属。

### PU-06 — 镜头/场次文本编辑的错误和草稿恢复协议分裂

**P2 / structural-debt。** `ShotEditorPage.tsx:196`/`:222` 的 PlainCell 直接绑定数据库值；`:1681` 镜号、`:1745` 内容、`:1908`/`:1911` 其他文本列逐次 void patchShot；`:1433` 场名 void patchStoryBeat。`StoryPage.tsx:92`/`:93`、`:239`、`:288`、`:338` 的场次标题/内容/时段也直接持久化。相邻的 DurationInput、StoryEditor、WorldSettingEditor、AssetTextField、SavedText 已有本地 draft/status/error/retry。

**机制与影响：** 前述直写字段没有独立本地草稿、没有保存失败反馈，也未登记 pendingDrafts；存储失败只产生未处理 rejected Promise，无法像资产文字一样恢复失败输入。输入值依赖 liveQuery 回读，在慢存储/长文本/快速输入下还可能回显滞后。后者尚无浏览器实测，不能据此声明必然丢键。handoff/backup 的 flushPendingDrafts 只覆盖已登记控制器，不会等待这些 ad hoc 直写；正常快速存储不等于错误恢复契约一致。

**调用关系：** UI void patch → repo 当前行 transaction；没有经过 useDebouncedDraft 的 retain/retry/flush 注册。spec 的“Do not bind an actively edited input directly to a live database row”目前在本组仅部分兑现。失败后产品没有 retry 控件是可见结构事实，实际用户输入丢失次数未测量。

**建议与验证：** 对活跃的自由文本使用稳定 entity-field key 的本地草稿组件和字段基线，批量选择/手动状态仍保持明确操作；不需要全局表单库。故意延迟/拒绝镜头和场次写入，验证输入不回退、错误可见、最后一次修改在导航/备份前 flush、失败重开可恢复；对长文本使用真实浏览器验证 caret/IME。不要只把 void 改成 catch toast，后者没有保留草稿。

### PU-07 — 异步剧本文件读取没有新旧请求和本地编辑保护

**P2 / risk。** `src/components/story/StoryPage.tsx:96`、`:98`、`:99`，拖放入口 `:194`/`:198`。file.text() 完成后无条件 setDraft(current => ({...current, script:text}))。functional setState 保护了 title/logline，却故意替换整段 script；没有 epoch、启动时脚本基线、pending 状态或取消标识。

**触发与影响：** 拖入 A 后继续写剧本，A 较晚完成会覆盖新增文字；先后拖入 A、B 但 A 最晚完成，最终脚本是 A。新值随后由草稿自动保存，看起来是正常已保存内容。本地 File.text 通常很快，真实文件大小、解码时间与浏览器调度影响窗口；本次未做浏览器延迟注入，保留 risk 分类。

**建议与验证：** 对文件导入记录请求 epoch 和启动时 script/draft revision，完成时仅最新且未被编辑的请求自动应用；有编辑冲突则保留当前稿并让用户明确替换。catch 读取失败并保留现稿。用可控 deferred text() 构造 A/B 逆序、读取期间输入、读取失败、离开编辑器四类用例；保持手动导入不自动拆场的原契约。

### PU-08 — 页面的交互和持久化编排缺少可独立验证的边界

**P2 / structural-debt。** `ShotEditorPage.tsx:232` 同时负责 scope queries、gap/selection 派生、定位 effect、全局键盘、DnD、bulk/undo、列设置、关系对话框，以及同文件 `:1359` BeatBlock、`:1512` ShotRow、`:1935` ShotRelationsEditor。关键债务是 `:607` 的逆补丁编排和 `:1908` 的列到 Shot 字段映射与 JSX 同处，并非 2,034 行本身违规。PU-01/03/04/05 给出了这种混合已产生的具体边界缺口。

音频 `AudioTimeline.tsx:98` 把 player 生命周期、drag/snap、shortcut、export 冻结快照、history、Inspector 映射和 UI 集中；`AudioWorkspacePage.tsx:102`/`:113`/`:123` 三个 selection 路径分别同步 segment/take/clip/chapter/seek，多套关联条件需要同步维护。音乐 `MusicWorkspacePage.tsx:82`/`:114` 同时协调 action/submission mutex、variant draft/localStorage 和列表播放。这些不是页面调用仓库违规，也不意味着现有行为全错：AudioClipHistory、schedule、mime、defaults、generation runtime 已抽出了重要领域边界。

**类型/重复核查：** Shot 的通用文本 fallback `:1908` 把 column.id 扩到 keyof Shot、`:1911` 转 Partial<Shot>，静态工具把可能的对象字段带入 String。实际 `src/domain/columns.ts:11` 当前只有已单独处理的 duration/characters/scene，剩余均为文本，故未确认 [object Object] 运行 bug。应以 TextShotField whitelist/satisfies 映射保留这一不变量，新增列时让编译器暴露遗漏。MusicCreation `:47` Partial<MusicSettings> + assertion 可允许跨 discriminant 补丁；当前调用分支未发现非法跨引擎组合，建议局部窄化，不另立 bug。四个资产 detail 的布局重复是不同字段契约，没有足够理由建立复杂动态 schema/editor factory。


**重复信号复核（jscpd v4）：** `research/tools/production-ui-clones.json` 的有效区间 `StoryboardPrintPage.tsx:17–30` 与 `ShotEditorPage.tsx:239–253` 实际重复的是 project/episode/shots 查询接线；`:38–48` 与镜头页 `:263–272` 是 projectId-tagged props/styles 查询。没有从这些片段找到新的重复业务算法。现有 `useShotMedia` 已共用引用媒体加载及 idsKey identity；`filterShots` → `shotMatchesFilters` → `validShotMediaId` 和 `deriveEpisodeDelivery` → `validShotMediaId` 共用 owner/kind/nonempty 判断；`ShotRelationsEditor` 与 `deriveEpisodeDelivery` 都调用 `shotRelations` 共用 undefined/null/style/prop 名称规则。Produce/print 都用 deriveEpisodeDelivery，已无需另建 readiness/relationship helper。编辑视图允许持久化 filters，打印/交付按完整episode scope输出，不能为“消除重复”让打印套用UI过滤结果。

可抽取的是带明确 project+episode identity 的窄数据接线或 prop/style loader，在解决 PU-05 后确有多个消费方；应保留编辑页允许逐步加载与交付页等待完整素材的不同状态契约。将所有 query 和所有页面行为塞入“万能 episode workspace hook”会过度抽象。ProducePage/ShotEditorPage 的该条 clone 坐标 end=60 < start=241，完全排除作为重复证据；独立源码阅读仍可评估 Produce/print 的接线相似性，不引用该无效区间。

**渐进方案与验证：** 先提取 scoped inner 保证目标生命周期，再把批量命令/逆操作移到窄事务入口；把 row text/relations、toolbar 和键盘/DnD adapter 变成可独立阅读的组件；最后按第二个真实调用者抽取 selection 同步或异步 action helper。layout 和 live-query wiring 可以留在 page。每一步保持 filters、完整排序、160px row anchor、active/focused/dragged 行保活、undo 范围、field key、媒体所有权与列显隐契约。不要为了降低 complexity 生成几十个 pass-through hook/service/strategy。

### PU-09 — CSS 保留已退出当前渲染树的旧工作台规则

**P3 / structural-debt。** `src/components/audioMusic/workspace.css:314`（aw-timeline）、`:339`（aw-track-row）、`:369`（aw-clip）、`:416`（aw-ruler）、`:469`（aw-music-row）、`:723`、`:873`、`:883`；`src/components/audio/story-workspace.css:71`（as-document-heading）、`:175`（as-paragraph-meta）、`:206`（as-script-reading）、`:236`（as-paragraph-bottom）。全文阅读及 `rg` 全 src 非 CSS 消费者核查未找到这些 selector 的 JSX/字符串入口；当前时间线用 at-*，音乐用 mw-*，脚本用 as-script-input。共享文件仍由 audioMusic/shared.tsx:22 导入，所以旧规则仍参与打包。

**机制与影响：** 同一文件混有真实共享控件和旧整页布局，维护者可能修改不再生效的规则或继续叠加末尾覆盖；story-workspace 的后段连续稿件规则 `:661` 又覆盖前段旧布局，增加判断实际 cascade 的成本。这是保守的清理机会，不宣称已有视觉故障或显著 bundle 性能损失。Knip 本身没有证明 CSS 死规则，依据是全文及消费搜索。

**建议与验证：** 先列出无消费者 selector，逐组删除并把连续稿件的最终规则折回其原定义；保留 shared controls/theme tokens 和有功能含义的 track accents。用窄屏/桌面、script/timeline 切换、Sheet/Popover、播放器和导出历史视觉回归确认，动态 class/第三方渲染及其他入口还需浏览器确认。不要单凭 CSS 行数删整份文件。

### PU-10 — 音色未保存配置缺少 dirty 退出语义

**P3 / risk。** `src/components/audio/VoiceLibrary.tsx:38`/`:41` 仅在 busy 时阻止关闭，随后 setEditing(undefined)；`:55` 的“返回音色列表”同样直接卸载；`:87` 至 `:92` 的名称/模式/描述/参考/试音文本只有 useState，保存在 `:196` 至 `:199` 发生。参考导入与 audition 的 busy 保护、命名配置的 captured revision CAS 均正确。

**触发与影响：** 写较长的音色描述，或已付费获得设计试音后再调整配置，误按 Escape/返回/关闭会丢弃未保存配置。生成试音已经持久化到项目声音，不能据此认为配置草稿也已保存。这里不能把用户明确取消等同故障；风险在关闭动作没有表达 discard，也没有重开恢复。audio-music spec 只明确 busy 保护，没有明确要求 dirty 提示，因此这是可选交互改进，不是以规范违规认定的 bug。

**建议与验证：** 若产品希望保护这种长配置，关闭/返回按 dirty 检查并明确继续/舍弃，或以独立 transient draft key 恢复；仍保持保存配置与生成试音两个不同操作，不自动生成、不自动创建 speaker。浏览器验证未改关闭、dirty 关闭、active reference/save 禁止关闭、trial 已保存但配置未保存、舍弃后原 speaker 不变。

## 当前职责边界与分阶段迁移

| 当前范围 | 合理职责 | 应逐步收敛的职责 |
| --- | --- | --- |
| assets/*DetailPage、WorldSettingPanel | owner 校验、字段布局、scoped query、调用仓库 | 给可编辑子树完整目标 key，保持字段 CAS；不强行合并不同资产字段 |
| ShotEditorPage / StoryPage | 页面 query、场次/镜头布局、filters、定位、选择 | bulk inverse 原子性回归仓库；单字段草稿与列映射收敛到 feature widget/helper |
| slots / media | tiles、上传/复用选择、预览、用户显式保存 | target/baseline 固定；继续由 DraftMediaSession 管 owned uploads，repository 管 committed references |
| AudioTimeline / AudioWorkspace | 展示 transport、tracks、gutter/inspector、选择联动 | 小范围提取 selection mapping 和 export/play adapter；engine/history/schedule 保持领域模块 |
| MusicCreation / MusicWorkspace | 创作输入、草稿切换、作品列表/试听、显式生成 | variant 关联是 UI metadata；如有第二调用者再抽取操作协议，不建立第二内容 store |
| produce/* | 交付检查/按钮、提案前后对比和人工确认 | 保持 snapshot/export 在 lib、事务/revision 在 repository；加 print 的 scope identity |
| audioMusic / CSS | 真实共享 Select/Slider/Player/Disclosure 样式 | 去旧整页 selector；不要把各特有页面的业务规则塞回 shared.tsx |

本组值依赖为 routes → feature pages → ui/media/slots 或 lib/domain/db；页面之间的 feature 依赖主要是 audio/music → audioMusic，共享音色组件在 audio 内互相消费。注意 AudioSources/VoiceReferencePicker 的命名误报不能当循环依赖或 Hook 违规。没有发现本组必须立即修复的运行时循环；这里只核查实际 import 路径与消费，不替代主审查的全 src SCC/动态导入图结论。

建议顺序：

1. 先补 PU-01/02/03 的并发/逆操作证据用例和窄事务入口，保留现 UI 的有效媒体/owner 检查。规则修复优先于移动文件。
2. 给各 scope page 和 slot target 明确生命周期，再验证跨 ID 导航；将 PU-04 的集合意图与 PU-06 的字段草稿协议收敛。草稿 retained/backup 规则不能在组件拆分时退化。
3. 在上述契约稳定后拆 ShotRow/relations/toolbar 及命令 adapter；audio 只提取真正独立的选择联动/导出编排。现有 lib/audio 模块保留，不增加无业务内容的 service 层。
4. 最后清理无消费者 CSS、窄化 column/settings 类型和非必要 export。逐步提交应能保持页面可运行，每次只迁移一类协议。

业务规则的适当归属：同 owner/媒体 kind/Blob/revision/跨记录原子性归 repository/domain；clip 时序、fade、schedule、codec 与 render 预算归 audio engine/domain；UI 只做用户可见的输入提示和 busy/dirty 交互。当前 bulkDuration 的 Math.max/Number、DurationInput parser 和音频属性 Number 转换有不同输入契约，不能为了“去重”统一成会静默把非法文本变 0 的万能 parser。

## 应保留的设计和工具误报处理

- repository 调用位于 feature page/widget 是当前架构的合理边界。发现针对具体 mutation/CAS/逆操作协议，不以“UI 调 DB”统一判错。PRODUCTION_TABLES / AUDIO_TRANSACTION_TABLES 的 owner 检查和事务合并保护独立字段更新应保留。
- 资产文字每字段独立 draftKey、world/story 的 changedDraftFields、音频 notes/chapter 与 MusicDetails 的 entity key、MusicCreation 的真实 Dexie variant 草稿均有明确作用。localStorage variant links 只有 ID，丢失可新增草稿且旧内容仍保留，这是 spec 明确接受的降级；不是本轮缺陷。
- Slot 的 DraftMediaSession 只管理本编辑器上传，既有文件复用不获取 Blob 删除所有权；cancel 等待 late upload 并按 committed orphan 规则清理。媒体列表按 owner/kind/nonempty 过滤，repository 再校验，是有意双层防御，不去重删除提交校验。
- 音频播放器组件的 playEpoch、Waveform 的 cancelled、MicrophoneRecorder 的 epoch/dispose、AudioPreviewPlayer 的 generation 检查是实质保护。engine.ts:141 的 resume 等待后再次检查 generation，不能把 UI 中 await play 之后没有 epoch 检查直接认定成旧章节开始播放。手动关闭某个来源面板后已授权的添加继续完成，也不自动等同取消错误；是否取消需明确交互契约。
- 生产提案冻结 target revision、保存后预览、apply/undo 事务、dirty 切换确认和同 scope keyed page 都正确。CSV/print 使用 deriveEpisodeDelivery，视频成片与图片占位分开；状态由用户手动确认，不从 readiness 自动修改。
- 160px 镜头行 anchor 和共享 IntersectionObserver 是为了完整 DnD/深链/Tab；active/focus/drag 保持控件挂载是合理设计。不能用“改成只渲染可见 ID”的简化破坏排序、导出或选中集合。
- `AudioSources.tsx:242` 的 useMaterialInProject → `src/db/materials.ts:348` 是返回 Promise<MaterialUse> 的 plain async repository，内部无 React Hook；react-hooks/rules-of-hooks 是 useX 命名启发式误报。可将 API 命名为 adopt* 作为可选清晰化，但本轮不登记 Hook bug。
- `ShotEditorPage.tsx:138` 的 switch 对特殊列返回特定 placeholder，default 返回 SHOT_COLUMNS 标签；合法文本列正是走 default。穷尽告警不是已证实缺陷。`:1908` 的 String 告警已核查当前 catalog，属于窄化类型的维护机会。
- AST 信号中本组 anyKeywords 为 0。non-null/assertion 必须按 guard/数据 shape 判断；AudioWorkspace 的 snapshot! 是已经退出 missing 分支后的冗余断言，没有证据表明其 runtime 为 null。no-nested-ternary、complexity、cognitive-complexity 只用于定位阅读。
- 使用有效的全量 Knip 汇总：本组 knipFiles=[]；GenerationSlotTile/Editor 的“unused exports”和 AudioTimelineProps 的“unused type export”均有本文件实际消费，最多去掉不必要 export，不是 dead implementation。首次失效 production Knip 不作为证据。

## 实际验证、原始结果和局限

只读命令以 python3、rg、sed/nl 分块打印进行。大型结果曾因工具展示上限中间截断，源文件对应区间改为去掉缩进/空行、带原行号的小块重读；CSS 只去展示空白，全部规则、声明、media/cascade 均保留阅读。固定清单核对为 `files=36, lines=10853, mismatch=[]`。

工具实测：Python 3.9.6，ripgrep 15.2.0，显式本机 Node v24.11.0；使用的 pnpm 命令路径始终是 `/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm`，该入口本次 `--version` 实际输出 **10.15.0**（与 package.json 的 packageManager 相同；不把 AGENTS 的历史“9.12.0”当成本次实测）。没有执行 install/add/remove 或使用 Codex Runtime 的 pnpm。Vitest v5.0.1，测试通过 fake-indexeddb 使用隔离数据库；没有访问用户浏览器 IndexedDB、麦克风或服务商账户。

外部提供的 `research/tools/production-ui-clones.json` 标注 jscpd v4 exact token、min80 tokens/10 lines；本角色读取并核实有效片段，排除倒置坐标，不声称重跑 jscpd。`research/tools/production-ui-signals.json` 聚合 87 条 ESLint 信号、Knip、AST；本角色只验证线索，不声称亲自执行原 ESLint/Knip。它们的完整版本/命令/原始诊断应以主任务 tools 工件为准。版本推断、首次失败的 production Knip 均不进入本报告证明链。

隔离最小复现位于操作系统临时目录 `/var/folders/m6/x3vx_lld0kg8rcgth931pll40000gn/T/production-ui-audit-vqonxi9v/`，测试源码/配置不写入产品或项目 tests。执行：

```sh
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm exec vitest run --config /var/folders/m6/x3vx_lld0kg8rcgth931pll40000gn/T/production-ui-audit-vqonxi9v/vitest.config.mjs --reporter=verbose --disableConsoleIntercept
```

退出状态 0，原始核心输出：

```text
RUN v5.0.1 /Users/xiaomengdao/WebstormProjects/aifenjing
PU-01 newer=9 -> undone=0
PU-01 inverse statuses=fulfilled,rejected
PU-02 newer-agent-edit -> stale-dialog-edit
PU-03 external=9 -> pending-draft=2
PU-04 two choices -> only second retained
Test Files 1 passed (1)
Tests 5 passed (5)
Start at 10:23:28
Duration 250ms
```

这些测试断言“现有实现出现不理想结果”，通过即证明问题；不是修复后行为测试。它们执行实际 repository/controller，并镜像 UI 的 callback/逆补丁，不挂载 React 整页。临时目录可能由系统回收，下附完整复现源以便保存证据。

相关既有基线命令：

```sh
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm exec vitest run tests/repoReliability.test.ts tests/draftConcurrency.test.ts tests/debouncedDraft.test.ts tests/draftMedia.test.ts tests/undo.test.ts tests/audioEngineCommands.test.ts tests/episodeDelivery.test.ts tests/mediaPicker.test.ts
```

退出状态 0，原始核心结果：`Test Files 8 passed (8); Tests 53 passed (53); Start at 10:24:00; Duration 520ms`。不等于全量质量 gate 通过。本角色未运行 lint/build/全量 tests；它们由主审查统一协调。一次辅助 rg 读取猜测的 src/router.tsx、tests/shotWorkspace.test.ts 返回 exit 2（文件不存在），随后实际入口 src/main.tsx 和 tests/repo.test.ts 已读到；未把缺失路径记为产品错误。覆盖JSON第一次生成脚本缺少 timeline.css 的内部说明映射，exit 1/KeyError，未产生文件；补齐后36项生成及集合/ID/hash验证通过。无网络研究；本报告只针对本地固定源码及已安装实现。

收尾 `git diff --name-only -- src` 返回 `src/routeTree.gen.ts`：该文件不属于本组36文件，工作区并发/既有差异不作回退或处理；本角色没有对它执行写入，不能以本组哈希核对声称整个src工作区干净。本报告仅确认本组36文件与固定清单相同。

浏览器画面、IME/caret、跨参数 modal/Suspense 行为、真实导入/麦克风、provider/CDN、视觉与资源预算没有现场验证，因此 PU-05/07/10 明确为 risk；CSS 未做浏览器视觉回归。未做 tests 全量阅读、全 src SCC 或跨组所有权登记。外部实现的行为引用只覆盖相关证明区间，不声称整份外部模块已完整审查。

## 隔离复现源码（实际执行版本）

配置：

```js
export default { resolve: { alias: { '@': "/Users/xiaomengdao/WebstormProjects/aifenjing/src", react: "/Users/xiaomengdao/WebstormProjects/aifenjing/node_modules/react", 'fake-indexeddb/auto': "/Users/xiaomengdao/WebstormProjects/aifenjing/node_modules/fake-indexeddb/auto/index.mjs" } }, test: { include: ["/var/folders/m6/x3vx_lld0kg8rcgth931pll40000gn/T/production-ui-audit-vqonxi9v/repro.test.ts"], setupFiles: ["/Users/xiaomengdao/WebstormProjects/aifenjing/tests/setup.ts"], clearMocks: true } };
```

测试：

```ts
import {it,expect} from "vitest";
import {db} from "@/db/database";
import {createProject,addShot,addCharacter,patchEpisodeShots,patchShot,deleteEpisodeShots,setShotSlot} from "@/db/repo";
import {emptySlot} from "@/domain/slot";
import {DebouncedDraftController} from "@/lib/debouncedDraft";
async function seed(n=1) {const p=await createProject("isolated-production-ui-repro");const e=(await db.episodes.where("projectId").equals(p.id).first())!;const rows=[];for(let i=0;i<n;i++) rows.push(await addShot(p.id,e.id));return {p,e,rows};}
it("PU-01: bulk inverse overwrites later same-field manual edit",async()=>{const {e,rows}=await seed();const s=rows[0];await patchEpisodeShots(e.id,[s.id],{durationSec:5});await patchShot(s.id,{durationSec:9});await Promise.all(rows.map(row=>patchShot(row.id,{durationSec:row.durationSec})));expect((await db.shots.get(s.id))!.durationSec).toBe(s.durationSec);console.log("PU-01 newer=9 -> undone="+(await db.shots.get(s.id))!.durationSec);});
it("PU-01: independent inverse transactions partially commit on missing sibling",async()=>{const {e,rows}=await seed(2);await patchEpisodeShots(e.id,rows.map(s=>s.id),{durationSec:5});await deleteEpisodeShots(e.id,[rows[1].id]);const results=await Promise.allSettled(rows.map(row=>patchShot(row.id,{durationSec:row.durationSec})));expect(results.map(x=>x.status).sort()).toEqual(["fulfilled","rejected"]);expect((await db.shots.get(rows[0].id))!.durationSec).toBe(rows[0].durationSec);console.log("PU-01 inverse statuses="+results.map(x=>x.status).join(","));});
it("PU-02: slot snapshot save overwrites newer prompt",async()=>{const {rows}=await seed();const s=rows[0];const initial={...emptySlot(),prompt:"initial"};await setShotSlot(s.id,"firstFrame",initial);const dialogDraft={...initial,prompt:"stale-dialog-edit"};await setShotSlot(s.id,"firstFrame",{...initial,prompt:"newer-agent-edit"});await setShotSlot(s.id,"firstFrame",dialogDraft);expect((await db.shots.get(s.id))!.firstFrame!.prompt).toBe("stale-dialog-edit");console.log("PU-02 newer-agent-edit -> stale-dialog-edit");});
it("PU-03: DurationInput persist ignores the scalar draft baseline",async()=>{const {rows}=await seed();const s=rows[0];const draft=new DebouncedDraftController(s.durationSec,v=>patchShot(s.id,{durationSec:v}),()=>{},60000);draft.change(2);await patchShot(s.id,{durationSec:9});draft.rebase(9);await draft.flush();expect((await db.shots.get(s.id))!.durationSec).toBe(2);console.log("PU-03 external=9 -> pending-draft=2");});

it("PU-04: two same-render character toggles lose the first selection",async()=>{const {p,rows}=await seed();const a=await addCharacter(p.id),b=await addCharacter(p.id);const rendered=rows[0];const toggle=(id:string)=>patchShot(rendered.id,{characterIds:[...rendered.characterIds,id]});await Promise.all([toggle(a.id),toggle(b.id)]);expect((await db.shots.get(rendered.id))!.characterIds).toEqual([b.id]);console.log("PU-04 two choices -> only second retained");});

```
