# Research: shell-shared 全量源码与架构审查

- Query：整体导航/项目隔离、根级 helper 职责、导入导出数据边界、媒体保留与删除、异步竞态、草稿/undo、UI 抽象和 routes 薄层。
- Scope：internal；唯一所有权为 `research/source-manifest.json` 的 `groups.shell-shared`，131 文件、基准 11451 行。其他组文件和 tests 仅用来核实调用契约，不登记所有权。
- Date：2026-09-30。
- 基准：`2fc0e9523e62a5258a488cc3d0274d24c8967c6f`。
- 产出：本文与 `shell-shared-coverage.json`。130 个非生成文件全部逐文件阅读，含 3 个 CSS 文件；1 个生成路由核验生成来源、全部路由映射与入口；无 blocked。
- 审查约束：没有修改产品源码、依赖、spec 或提交/回退他人变更。最小验证使用系统临时目录、fake-indexeddb，未接触浏览器用户库或远端服务。

## 结论与发现索引

优先处理查询结果身份和项目设定 CAS；这两项可能把编辑带到错误记录，或静默覆盖另一页已保存内容。包传输主干有明确的事务边界，音频坏引用/裁剪能回滚，旧视频兼容也有效。需修正现代包的错误分集引用降级和音频导出一致性标识。UI 基础组件大部分职责清楚，不能根据文件长或复杂度数字判错。

| ID | 级别 | 分类 | 内容 | 证据程度 |
| --- | --- | --- | --- | --- |
| SS-01 | P1 | confirmed-bug | 项目 route 复用消费上一项目 liveQuery 结果 | 源码、安装库实现、隔离 SSR 两用例 |
| SS-02 | P1 | confirmed-bug | 项目设定丢弃草稿 baseline，静默覆盖并发修改 | 真实 repository + 草稿 controller 复现 |
| SS-03 | P2 | confirmed-bug | 音频 ZIP 重映射 ID 后成品 fingerprint 必然失配 | 真实 ZIP 导出/导入复现 |
| SS-04 | P2 | confirmed-bug | 有 episodes 的现代视频包仍把错误 episodeId 改绑第一集 | 真实 ZIP 导入复现；旧包正常对照 |
| SS-05 | P2 | confirmed-bug | undo 恢复失败前清空动作且 UI 不接收异常 | controller 最小复现 |
| SS-06 | P2 | confirmed-bug | 多个 library 写操作以 void 丢弃拒绝，关闭失败编辑 | 明确可拒绝的 repo 调用与事件路径 |
| SS-07 | P2 | risk | 连接弹窗请求缺少会话身份，旧请求可写回新弹窗 | 静态控制流；未做真实浏览器延迟验证 |
| SS-08 | P2 | structural-debt | 旧 generation/context 是测试孤岛，领域编排混放 lib 根级 | 导入图 + 修正后生产 Knip + spec |
| SS-09 | P2 | structural-debt | gallery 全量镜头订阅与四库共同订阅扩大无关更新 | 真实查询/派生复杂度；未做性能量化 |
| SS-10 | P3 | structural-debt | 未接入的 Separator/Skeleton 和冗余外部 export | Knip 与全 src 引用核实 |
| SS-11 | P3 | structural-debt | ClickSpark 空闲及 reduced-motion 状态仍持续 RAF | 逐行控制流；未量化 CPU/功耗 |

## SS-01 — 项目 route 复用期间消费上一所有者的数据

**位置**：`src/routes/p.$projectId.tsx:10`，`src/components/workspace/WorkspaceChrome.tsx:50`、`:54`、`:62`、`:81`、`:128`、`:314`；`src/routes/p.$projectId.index.tsx:18`、`:22`、`:54`。

**机制**：`WorkspaceRoute` 的 `WorkspaceChrome` 无 `key={projectId}`；项目查询及第一集查询只检查 undefined/null，不检查返回行的 projectId/id。安装的 dexie-react-hooks 4.4.0 的 `useObservable` 在依赖变更时保留 `monitor.current.result`，没有把旧结果清回 undefined。由项目 A 切到 B 时，B 的查询尚未返回，旧 A 项目和 A 第一集仍可被当前 B 路由消费。主页面 `SeriesHomeRoute` 同样无身份判断：它可生成 `{projectId:B, episodeId:A的集}` 的 Navigate。

**触发/影响**：同一 project route 直接改参数，或浏览器前进/后退到另一项目并遇到异步查询窗口。Chrome 仍可显示 A 标题、设置内容、集导航，却用 B route 参数生成部分按钮路径。设置已经打开时，传给 `ProjectSettingsPanel` 的仍是 A 行；元数据写入使用 `project.id`，所以此窗口内修改可写回 A。错误 home 重定向则落到 B/A 集组合并触发找不到集。不是 repository 越权缺陷：问题是 UI 把混合身份数据传入合法 repository。

**证据**：安装库 `node_modules/@tanstack/react-router/src/Match.tsx:194` 的 remount key 仅来自可选 `remountDeps/defaultRemountDeps`，`:315` 的 Outlet 按 routeId 渲染 Match；`src/main.tsx:9` 和 project route 没有配置按 projectId 重挂载，因此仅参数变更可以复用组件。隔离 SSR 注入 liveQuery 实际允许保留的旧值。用当前源码组件断言 B 路径输出 `Previous project title`，而非加载态；home 捕获 Navigate 参数确实是 B 项目 + A 集。未模拟完整浏览器的时序与点击，所以不声称实际跨项目写入已做端到端复现。

**建议/验证**：在 project workspace 的父入口按 projectId 挂载，并让 query result 携带查询身份；home 只有 project.id 和 episode.projectId 都匹配 route 时才决定重定向/repair。episodeId 也要与 route 身份匹配。按需保留同项目下的长期状态。延迟 B 查询，覆盖 film→film、film→music、打开设定时切项目、前进后退，断言旧标题、旧设置和错误 Navigate 都不出现。

同根因的加固位置：`src/components/studio/materials/MaterialDetailPanel.tsx:47`、`:48` 查询没有 `{id, material}` identity。`onSelect(copy.id)` 后旧 material 可短暂传给新 `key={id}` 的 editor，冻结 `projectId` 等初始化状态。这里是代码审查发现的同类风险，未纳入上述两项 SSR 的已执行断言。

## SS-02 — 项目设定自动保存没有并发保护

**位置**：`src/components/workspace/ProjectSettingsPanel.tsx:81`、`:85`、`:100`；核实调用者 `src/components/assets/AssetTextField.tsx:14` 与 `src/lib/debouncedDraft.ts:224`、`:274`；核实持久化 `src/db/repo.ts:242`。

**机制/影响**：`AssetTextField` 明确给 persist 提供 `(value, baseline)`，项目名称/简述/题材/观众/基调的回调只接 value。`patchProjectDetails` 没有 expected baseline/revision 参数，也没有 `assertDraftBaseline`。A 草稿尚未落盘、B 已保存同字段时，A 的 debounce/失焦/备份 barrier 会把 B 覆盖；DraftStatus 显示已保存，无法提示合并。相对地，`EpisodeListPage.tsx:180` 的系列 logline 把 baseline 传给 `updateSeriesLogline`，IP/material 表单也使用 revision CAS。

**证据**：真实 createProject 后，以项目设定相同回调构造 `DebouncedDraftController('original', value => patchProjectDetails(...))`。change 为 `my-draft`；另一写者保存 `other-tab`；flushOrThrow 成功，数据库最终值为 `my-draft`，未抛冲突。

**建议/验证**：repository 在同一写事务内比较实际编辑字段的 baseline 或项目输出单独 revision；组件必须传 baseline。不要以整行 updatedAt 拒绝无关字段更新。输出配置显式保存 `src/components/workspace/ProjectSettingsPanel.tsx:170` 同样没有 CAS，应分别覆盖同时修改 ratio/defaults，以及无关字段并发不冲突。增加两页面同字段冲突、不同字段合并、rename trim 规范化、失败草稿/backup barrier 保留用例。

## SS-03 — 音频成品状态在 ZIP 导入后产生假“后续编辑”

**位置**：`src/lib/audioProjectPackage.ts:124`、`:216`、`:228`、`:237`；核实显示 `src/components/audio/AudioExports.tsx:24`，构造 `src/components/audio/AudioTimeline.tsx:270`、`src/lib/audio/schedule.ts:22`、`:79`。

**机制/影响**：成品 fingerprint 实际是 schedule 的 JSON，内含 clipId、mediaId、sources 中 take id/mediaId、chapterOffsets 的章节 ID。import 正确地重映射所有实体/媒体 ID，却原样保留 fingerprint。未有任何创作变更的有效成品导入后也会显示“此成品未包含后续编辑”，用户无法区分实际陈旧和仅导入导致的失配。字节没有丢失、试听/下载仍可用。

**证据**：2 秒 source→clip→project export，先存 `JSON.stringify(buildAudioSchedule(snapshot))` 为成品 fingerprint。真实导出/导入后 fingerprint 等于旧值，却不等于新 schedule；新 schedule duration 仍为 2，导入成品 media 存在。chapter/project 两种导出都受 ID 变化影响。

**建议/验证**：导入时显式重映射可识别版本的 fingerprint（保留旧编辑状态），或改为按音频内容与混音参数构造版本化语义标识。不能无条件把全部成品 fingerprint 改成当前 schedule，会把本来陈旧的成品误标成最新。测试当前成品/本来陈旧成品/原章节已删的成品、两次 round-trip；无需实际声学渲染即可验证一致性状态。

## SS-04 — 现代视频包的错误分集引用被静默修复成另一集

**位置**：`src/lib/projectPackage.ts:856`、`:976`、`:1015`、`:1022`、`:1036`。

**机制/影响**：即使 episodes.json 有有效现代分集，shot.episodeId 不在 episodeMap 中也使用第一集 fallback，beatMap 也可能回退首个 beatMap。错误包/不完整包被成功导入并把镜头内容放到错误分集，不给用户诊断。兼容旧包（无 episodes）的补集本身合理；问题是同一降级逻辑覆盖了现代包无效关系。

**证据**：合法导出视频项目包后，只把 shots.json 替换为 `{id:'shot-x', episodeId:'missing-episode', content:'from missing episode'}`。import 成功，新镜头 episodeId 变成第一集。移除 episodes.json 后旧格式镜头仍能补集、`futureFlag` 仍保存在 extra，此对照表明可以收窄校验而保留历史兼容。

**建议/验证**：先区分明确的 legacy 分支；现代包检查 episodeId 存在、同聚合 beat 引用合法，再重映射。视频可以继续对未知状态/可选字段做约定的 normalize，但不要把错误关联改成另一现存关联。测试 missing/foreign episode、跨集同名 beat、缺分集旧包、重复 ID 导入回滚。当前音频 insert 内的 references/裁剪验证可作为边界一致性的参考，勿为此添加通用 service 层。

## SS-05 — 恢复失败丢弃 undo，无法重试

**位置**：`src/lib/undo.tsx:37`、`:40`、`:77`；调用核实 `src/components/workspace/EpisodeListPage.tsx:68`、`:70`；restore 的拒绝契约见 `src/db/repo.ts:565`。

**机制/影响**：undo 在 await restore 前 `clear()`；临时存储故障/已有新记录造成 restore 拒绝后，原动作、内存 snapshot 和 toast 均已消失。UI 用 `void controller.undo()`，没有捕获错误，也没有失败说明。删除动作恢复失败后没有 retry，重排动作失败也无反馈。阻止同时重复恢复是合理需求，但清空动作不等于 pending 锁。

**证据**：注册 restore 抛 `transient storage failure` 的动作，undo 拒绝，getCurrent 立即为 undefined。已执行隔离用例。没有声称可绕过 repository 的冲突保护。

**建议/验证**：controller 区分 pending 与 settled，成功后清除，失败保留动作和合理剩余时间；UI await/catch 显示失败与 retry。如果 pending 期间注册了新 action，旧 action 的 finally 不能清除新 action。测试双击、恢复失败后重试、restore 中 register 新动作、过期、项目删除及业务 CAS 拒绝。

## SS-06 — 部分业务写入没有错误出口

**位置**：`src/components/studio/ProjectGalleryPage.tsx:373`、`:396`；`src/components/studio/AssetLibraryPages.tsx:187`、`:224`；`src/components/workspace/EpisodeListPage.tsx:126`、`:129`。

**机制/影响**：renameProject、deleteProject、四库创建/删除、reorderEpisodes 返回 Promise，repo 可因记录已被另一页删除、约束冲突或存储错误而拒绝。事件只用 void，rename/delete 又立即关闭对话框，导致未处理 rejection，没有失败 toast/retry；rename 输入被关闭。Episode 删除自身有 catch，而上移/下移没有，形成不一致。同类连接请求是否抛错必须看 adapter 契约，本文不把所有缺 catch 都算故障。

**证据**：renameProject 在 repo.ts:237 明确会抛“项目不存在，无法保存”；ProjectGallery 没有 catch。StudioLibrary 的 create 和四库 delete 没有公共包装。并发删除后改名和 reorder 与另一页面新增/移除分集都是明确触发条件。源码确认事件出口，未做浏览器 unhandledrejection 注入测试。

**建议/验证**：以 feature 局部 async action 捕获、保持失败表单，适当使用 pending 防重复提交；成功后再关闭。已有 MaterialEditor.action、ProjectGallery.handleCreate 可复用思路，无需全局任务框架。通过 fake repository reject 或真实记录删除，验证可见错误、草稿保留和动作不重复。

**用户点名信号结论**：ProjectGallery `onClick={async ...}` 的 IP 绑定（:341）已有 :348 catch 和 finally；`no-misused-promises` 是 void 事件签名规则与 async 形式不匹配，不能把它误报为遗漏异常处理。

## SS-07 — 连接请求跨编辑会话的回写风险

**位置**：`src/components/studio/ConnectorsPage.tsx:50`、`:57`、`:70`、`:84`、`:97`、`:118`、`:128`、`:140`、`:152`、`:235`、`:289`。

**机制/影响**：closeEditor 在 probing/testing/saving 中仍可执行、把 flags 清 false；用户可以开另一 provider 编辑。旧请求完成后仍 setProbeModels、setTesting/setProbing false；旧 save/disconnect 还会 closeEditor，把新编辑关闭。Base URL/Key 输入也没有 busy disabled，请求成功提示无法证明当前表单的修改后凭据有效。请求通常由 adapter 返回结构化错误，网络 catch 问题不作为本条根因。

**建议/验证**：每个 editor session/request 捕获 identity，结果只更新同一会话；适当 AbortController，在保存/断开期间阻止关闭和切换，或保证旧请求不关闭新编辑。延迟 A 模型查询/保存，关闭并开 B；断言 A 不能污染 B 模型、busy 和弹窗。此条未做浏览器真实延迟试验，保留 risk 分类。SearchConnection 的 busy close guard 和 IP 编辑的 frozen revision+pendingRef 是合理的现有对照。

## SS-08 — 领域编排与旧契约的职责边界需要显式化

**位置**：`src/lib/generationIntent.ts:54`、`:152`、`:205`；`src/lib/productionContext.ts:27`；`src/lib/projectPackage.ts:41`、`:667`、`:790`；`src/lib/audioProjectPackage.ts:182`、`:260`；`src/routes/_studio.tsx:3`。

**证据**：全 src 静态值导入图中 generationIntent / productionContext 的入边均为 0；前者仅 type-import 后者，不是产品调用。`tests/generationIntent.test.ts`、`tests/productionContext.test.ts` 使用它们；修正后的 `tools/knip-production-stdout.txt` 报告一致。`production-contracts.md` 已承认 legacy local contract，实际付费生成/恢复属于 agentGenerationJobs 与 creative-skills executor。故当前不是“活跃生成没有校验”，也不是可以依据 Knip 直接删除全部 production 模块：productionRevision 仍被 repository 使用，productionHandoff 仍被 UI 使用，proposal 路径也在产品中。

**职责建议**：

1. 明确旧 intent/context 是待移除的历史实现，还是有明确消费者/计划的未来 API；若保留，放到 `lib/production/legacy`，spec 标明测试仅验证遗留契约；若移除，连同无产品消费者的测试与文档契约一起归档。不要为了消除 unused 而强行接入活跃生成。
2. 根级 `lib/` 已混放 React hooks（media/useShotMedia/debouncedDraft/undo）、小纯函数（format/reorder/filters）、ZIP 持久化编排、生产 AI 契约。逐步分 `lib/drafts/`、`lib/media/`、`lib/packages/`、`lib/production/`；对原 imports 暂保留迁移入口，减少无意义大批改路径。
3. package 是跨多个表的持久化边界，`audioProjectPackage` 不只 codec：读取、重映射、插入、repository 验证都在一个模块。按 parser/remap 与持久化快照/事务边界拆分即可，不引入 service/factory/strategy。`projectPackage` 1092 行主要是实体字段白名单、历史格式和 remap；长度不是问题，迁移必须保住兼容与事务语义。
4. Studio route 为导入函数依赖整个 ProjectGalleryPage feature（`_studio.tsx:3`）；可把 toast 无关的导入编排留 package，错误显示留 shell/widget，降低 shell 对 gallery 的反向依赖。project home 的 dispatch/repair（index route:29）移到 feature landing component，使 route 回到 params/URL 适配；保留必要的 URL compatibility redirects。

**依赖核实**：TypeScript 5.9.3 AST 扫描 src 静态值 imports/re-exports，排除 type-only，Tarjan SCC 没有与本组相交的值循环。`projectPackage→repo.collectMediaIds`、`audioProjectPackage→db.audio/db.music validators` 是明确持久化契约依赖，不自动判违规。本检查不证明动态 import/Worker/运行时 registry 没有循环。

## SS-09 — library 订阅及派生范围可收窄

**位置**：`src/components/studio/ProjectGalleryPage.tsx:49`、`:59`、`:86`、`:170`、`:171`；`src/components/studio/AssetLibraryPages.tsx:110`、`:164`。

Gallery 为每个卡片筛选、排序全部项目镜头；并订阅所有 shots（包含完整文字及 slots）。任何项目镜头编辑都使整个 gallery 查询/派生失效。StudioLibrary 无论正在查看哪种库，都同时订阅四库，并在每个卡片寻找相应 item。复杂度与无关数据范围由代码确认；没有性能 profile，不声称已造成具体毫秒卡顿。

建议 gallery 一次按 projectId 分组计算候选首帧，必要时引入严格定义的 cover 派生查询/投影；不是立即持久化缓存。StudioLibrary 把四种查询分为 typed 子组件或静态 adapter，仅订阅当前 kind；四种业务字段不同，不要求通过 union cast 硬合并。保持同样的筛选/顺序/缺媒体策略；测试大量镜头、重复 order、多集和无封面，并核对已显式 cover 的项目不依赖全镜头数据。

## SS-10 — 低影响清理项与误报

**位置**：`src/components/ui/separator.tsx:6`，`src/components/ui/skeleton.tsx:3`，`src/lib/brand.ts:8`，`src/lib/shotFilters.ts:4`。

Separator/Skeleton 在全 src 没有消费者，生产 Knip 与源码引用结果一致；可以随下一次 UI 清理删除，或说明为何保留基本 primitive catalog，不能说它们已经影响运行。`@radix-ui/react-separator` 仅由未接入 Separator 使用，可同步清理。`LOGO_FAVICON_SRC` 无消费者；`shotBeatFilterId` 仅模块内部使用，移除 export 可收窄 API。UI 的许多 Radix wrapper export 是成套基本 API，保留并不自动构成有害冗余。

**不要清理的误报**：`tw-animate-css` 在 `src/styles.css:2` 真正被 CSS @import；`mammoth/mammoth.browser` 被 `src/lib/references/docx.ts:2` 导入，`mammoth.d.ts` 是 `tsconfig.app.json` include src 的 ambient declaration，不需要 runtime import；本组只参考这份声明，不登记它。`useMaterialInProject`（`src/db/materials.ts:348`）是普通 async transaction 函数，没有 React hook；MaterialDetailPanel:203 的 rules-of-hooks 是 useX 命名误报。redirect thrown object 是 TanStack 控制流，不是 Error 规范缺陷。复杂度/嵌套 ternary/non-null 不独立构成发现；ClickSpark easing default 明确处理 ease-out。

## SS-11 — 装饰 canvas 可按需调度

**位置**：`src/components/ui/click-spark.tsx:83`、`:91`、`:115`、`:123`。

draw 不检查 sparks 数量，空闲也 clearRect 并安排下一 RAF；prefersReducedMotion 只阻止新 click sparks，不停止空闲 draw。建议 click 时启动、sparks 清空后停止，并响应 reduced-motion 变化/页面可见性；保留 aria-hidden、pointer-events-none、清理 ResizeObserver/RAF。此为可量化后再排期的局部维护债务；未声称违反视觉减弱偏好（没有 sparks 时实际没有视觉动画），未测 CPU/功耗。

## 合理保留的设计

- routes 大多是 params/search/back discriminant 适配，studio assets layout/index/detail 分离；旧 project shots/produce/plan/report 的兼容重定向应保留。Agent chat parent 持续挂载，让 URL 叶子不重建对话 runtime；StudioShell 的 chat/tasks active 条件互斥，desktop/mobile 共用 NAV。
- studio 所有者与项目副本分离；MaterialScopeSelect 仅 selection，MaterialEditor 调用 shared repository 做归属和独立复制。历史 version 与 adoption 分离、永久删除要求归档且无引用、release 再由 repo 查封面/slot/任务引用；不靠 UI disable 充当最终所有权验证。
- CSS 真实阅读：`ipProfiles.css` 的列表截断与详情 `white-space:pre-wrap` 分离，1100/640px 断点和 focus/reduced-motion 清楚；`materialLibrary.css` 的 block card 修正 Button 默认 inline-flex、高度与 Radix tabs/select override 有真实用途；`styles.css` 限定 print 样式并隐藏 chrome、保留 A4 横向。文件长/压缩成 9 行都不单独判错。没有做视觉截图回归，不保证所有浏览器/极窄屏无溢出。
- UI primitives 不访问 Dexie，Radix 负责 portal/focus/overlay，Field 生成关联 id，CVA/token/cn 的边界合理；设置/素材领域选择器留在 feature 组件。
- `DebouncedDraftController` 的写串行化、baseline、失败 retained drafts、backup `flushOrThrow`，`DraftMediaSession` 的 session-owned uploads/pending/cancel/commit 分离，`useMedia` 与 `useShotMedia` 的结果身份/object URL cleanup 值得保留。SS-02 是调用者没用 baseline，不是应删掉 draft 抽象。
- backup 与 handoff 契约不同：project ZIP 重建持久化副本；handoff 只取当集被选中的成品、输出 original bytes、说明图片占位、报告缺失、sanitize path/ordinal 保唯一、用 STORE；`validShotMediaId` 检查所有者/类型/空 Blob，不以 ID 存在当有效。
- exportProjectZip 在一个 read transaction 内捕获 JSON/Blob 后再压缩；音频 import 先重映射，在同一 rw transaction 内插入+验证，坏裁剪/引用能回滚。音频 generation 导入 dormant、改 connector/new intent、去 claim/source Agent 身份；taskObservations 专门校验，保留 provider task/clip/index 作历史。不把 referenceFingerprint 未传输当数据丢失缺陷：新 job 是不可恢复提交的历史记录。
- video unknown 字段进入 extra 与旧 slots/episodes 修复需保留；memory 版本链/重新审核、reference 包校验的独立边界也应保留。本组没有声称视频与音频必须使用完全相同的容错策略。

## 生成路由与覆盖核验

`vite.config.ts:9` 的 TanStack router plugin 负责生成，当前安装 `@tanstack/router-plugin` 1.168.40；`routeTree.gen.ts` 文件头说明生成归属；`main.tsx:4` 引入 routeTree、:9 建 router、:12 注册 Router 类型，`__root.tsx:5` 导入全局样式。47 个 src/routes 源文件全部对应生成 imports，46 个非 root route 的 update id/path/parent 与源码一致；核验 studio pathless 与 project root、各 assets/episode child trees、最终 `_addFileChildren/_addFileTypes`。没有重新运行 generator 或 build。

收尾哈希核对：全部 131 文件与 manifest sha256 一致，生成文件已恢复为基准 1097 行、sha256 `f1572df02731d204a1ef38e4b744a39aa5b2c9dc7a3d85d1d6d3d3b6b6b09d65`。审查期间曾观察共享会话 build 生成的 1091 行格式版本（sha256 `0df423ad2603ed30010d0c28c127b7b7d5a59c3bb0a1c24ddc39f55933cd4efd`），本组 TypeScript scanner 核对业务 token 完全相同；主会话 `tools/route-regeneration.json` 另记录 3995 个非 trivia token 相同并恢复基准。随后本组重新核对全部清单哈希确认一致，本组未执行恢复或产品写操作。coverage 对生成文件记录 generated-verified，其他 reviewed。

## 实际执行与最小验证

读取任务 prd/design/implement、角色说明及 frontend index、directory/type/quality/component/state/hook/delivery/production/audio/music/material 相关规范。任务没有 research.jsonl 或完整 hook 保存路径；research-only curated context 来自角色注入，用户显式要求同时读实现规划。

本组工具版本：本机 `/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm --version` 实际输出 **10.15.0**（与用户提示中的旧“9.12.0”不同，但未使用 Codex runtime pnpm、未 install）；TypeScript 5.9.3、Vitest 5.0.1、Dexie 4.4.6、dexie-react-hooks 4.4.0。源读取使用 rg、nl/sed 和按行/字符连续输出补读，CSS 不由信号数量替代阅读。

静态工具是用户/主会话已生成的 `tools/shell-shared-signals.json`、修正后的 `tools/knip-production-stdout.txt`；首次失效 production 输出未作证据。baseline lint/test/build 主会话确认通过，build 大 chunk 告警不等于功能故障；本组未重复全量基线、未重新安装 ESLint/Knip，也不把它们的原始退出状态冒称本组执行。

最小验证目录：`/var/folders/m6/x3vx_lld0kg8rcgth931pll40000gn/T/cuepoint-ss-audit-tjqhmiqt/`。config root 指向该目录，src alias 指向真实 src，setup 复用 `tests/setup.ts`，临时 node_modules symlink 指向已安装依赖；只写临时测试和最终两份 research，不改产品 tests/config。Node 独立进程 fake-indexeddb 不会访问浏览器 IndexedDB。

命令与退出状态：

```text
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm exec vitest run --config /var/folders/m6/x3vx_lld0kg8rcgth931pll40000gn/T/cuepoint-ss-audit-tjqhmiqt/vitest.config.mjs
exit 0; Test Files 1 passed; Tests 4 passed

/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm exec vitest run --config /var/folders/m6/x3vx_lld0kg8rcgth931pll40000gn/T/cuepoint-ss-audit-tjqhmiqt/vitest.config.mjs --reporter verbose
exit 0; Test Files 2 passed; Tests 6 passed; Duration 814ms
```

最后一次原始验证输出：

```text
SS audio-fingerprint: unchanged timing/bytes, fingerprint mismatch after ID remap
audio-invalid-clip: transactional rollback verified
SS project-draft: other-tab overwritten without conflict
SS modern-video: missing episode reassigned rather than rejected
legacy-video: synthesis and extra preservation verified
SS undo: transient failure loses action
✓ audit.test.ts > audio ZIP remaps rows but retains ID-dependent export fingerprint
✓ audit.test.ts > ProjectSettings-style persist ignores baseline and overwrites concurrent edit
✓ audit.test.ts > modern ZIP invalid episode relation silently maps to first episode
✓ audit.test.ts > undo failure drops retry action
✓ navigation.test.ts > WorkspaceChrome accepts previous live query project while URL belongs to next project
✓ navigation.test.ts > home combines next route project ID with retained previous episode ID
Test Files 2 passed (2); Tests 6 passed (6)
```

这些通过的是**复现既有行为的审查断言**，不代表缺陷已修好。临时脚本内容 SHA256：audit.test.ts `ef496da3ef107741a6ea42a8b061e85e0a623979f1787304dc0a819b397a35e5`；navigation.test.ts `ea84fb5e3c34c9a68351e4d1798a51bf51b4766f7bee03670f24aae837208119`；config `de39ea3c80a4c9a75e2695d5041793934800d42b3f90f2d17d63bcbaf767ba72`。临时目录不是长期产物，后续正式回归应将修复后反向断言纳入产品测试。

可重建的关键步骤：

- 音频：createAudioMusicProject→getAudioProjectSnapshot→addAudioTake（2 秒、有 media Blob）→addAudioClip（0..2）→把 `JSON.stringify(buildAudioSchedule(snapshot))` 存入 addAudioExport→exportProjectZip/importProjectZip→比较新 schedule 与持久化 fingerprint。再把 audioProject.json 的 trimEndSec 改成 99，断言导入拒绝且项目 count 不增加。
- 草稿：createProject('original')→controller persist 使用 ProjectSettings 同款单参数 callback→change('my-draft')→patchProjectDetails 写入 'other-tab'→flushOrThrow→数据库为 'my-draft'。
- 视频：合法 project zip 中替换 shots.json 为一个 `episodeId:'missing-episode'` 镜头→导入得到第一集。对照 remove episodes.json，旧镜头仍补集且未知 futureFlag 保存为 extra。
- undo：register 一个 restore Promise.reject(Error)→undo rejects→getCurrent undefined。
- 导航：mock useLiveQuery 返回前项目/前集（匹配安装库保留语义），useParams 给下一 projectId；用 renderToString 执行真实 WorkspaceChrome/Home，分别检查旧标题和捕获 Navigate 的混合参数。

另执行本机 Node + TypeScript AST/静态 resolver/Tarjan/生成 scanner 检查（exit 0）：`value SCC intersecting shell-shared []`、`inbound productionContext [] inbound generationIntent []`、`generated baseline token equal true`、`generated imports 47/source routes 47/missing []/extra []`。动态 import、CSS/Worker 不计入该值 SCC。

## 分阶段建议与限度

先补 SS-01/02 的身份与 CAS 并回归，再修 SS-03/04/05 的持久化与失败恢复契约；接着统一 library 事件失败出口和连接 session guard；最后才做 lib 归类、测试孤岛决策与 P3 清理。导入先解析/重映射、数据库写入保持同一个事务；路径移动不能让 parser 反向依赖 UI。保留 source snapshot 的 hash、原始格式与旧包对照案例，避免结构重排带来兼容回归。

本组没有完整浏览器视觉/交互、真实远端服务、音频解码/试听、性能 profile；mock SSR 是已确认逻辑输入的验证，不是 Dexie 实际浏览器切换时序测试。无生成源码逐行人工全读的声明：routeTree 按用户要求核验来源和接入。未阅读所有 tests 或其他组全部源码，coverage 不越权登记。本文只有 SS-07 标注未做实际请求时序验证的风险，SS-08/09/10/11 为结构/局部维护债务，不计作已发生的生产故障。
