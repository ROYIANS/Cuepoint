# 全站 UI 统一 · 执行与验收计划

状态：用户于 2026-10-10 明确批准最新最终方案；进入实施，按工作包与验收门推进。

## 任务结构与依赖

一个任务交付跨全站的一套UI系统；单页迁移不能独立满足总体验收。工作包拥有独立文件/检查门，最终统一验收，不隐含延期子任务。
W0规划 → W1基础/代表页 → W2 Studio → W3视频/共享详情 → W4音频/音乐/记忆 → W5 Agent → W6整体。
W2–W5均依赖W1；可并行时先冻结API，主会话独占共享文件/规范，各worker只写自己的feature。

## W0 · 规划与启动

- [x] 用户许可/视觉方向；47路由、两份源码报告、7页原生基线；独立3页提案及窗口/交互检查。
- [x] 覆盖矩阵完整映射、状态真实；PRD已按最终结构重写并完成收敛pass；上下文验证通过。
- [x] 提交最终规划摘要，用户明确批准“可以，开始实施吧”。
- [x] 已刷新 git status，创建 codex/ui-consistency-desktop-prep；基线 main ecf8dd0c，task.py start 完成。

## W1 · 共享基础 + 项目/素材

默认trellis-implement → 独立trellis-check；dispatch首行Active task: <当前路径>，读jsonl → PRD → design → implement及精确包spec，按当前Trellis channel协作规则。

所有权：styles.css、公共展示布局、StudioShell/WorkspaceChrome chrome、LibraryHeader/CoverCard、ProjectGalleryPage/MaterialLibraryPage/material CSS。Agent adapter接口由主会话协调，不动DB/schema/transport。
先实查已有状态/overlay → token/frame/header/toolbar/content/state/overlay → 项目/素材迁移 → root/scroll/nav/导入/旧库入口/Agent持久宿主/project guard核验 → 冻结展示API。
移除圆角大外框、全局ClickSpark；无事件/业务变化。标准控件不照抄原型native select/dialog。
门：代表页一致、所有原入口可达、类型检查/对应library/draft/owner tests、原生宽/窄/矮和焦点检查；问题解决后推进。

## W2 · Studio

所有权：IP列表/详情/CSS、四类库、连接/SearchConnection、关于；共享资产详情归W3，不能并行改。
功能标题、section/state/card、搜索可访问名称、共享Checkbox/Select；保留revision/dirty/pending、连接masked credential/save/test/disconnect区别、旧路由/品牌支持。
门：各页面/详情/状态/overlay有原生证据，卡片操作/关闭可达，相关现有tests/spec check。

## W3 · 视频与共享详情

所有权：EpisodeListPage/StoryPage/AssetLibraryPage、四类共享DetailPage及相关asset展示、ShotEditorPage展示/CSS、ProducePage、StoryboardPrintPage屏幕chrome。WorkspaceChrome共享修改主会话持有。
film/series、五个世界tab、Studio/project四类详情双所有者；保留原编辑位置/草稿、stable row/lazy/DnD/deep link、内部scroll、批量/undo/快捷键、导出加载屏障、白纸打印。不新增分镜检查器owner/流程。
门：原生各上下文/表格媒体/交付打印、长内容/窗口/键盘；对应shot/draft/ownership/export回归。

## W4 · 音频/音乐/记忆

可拆worker：audio/audioMusic/music展示/CSS；memory展示/CSS；共享控件主会话持有。
共同toolbar/panel/inspector/review/feedback；连续文稿保留阅读模式，坐标/波形/trim/transport不改；手工片段/CAS/undo/冻结审批不丢；音乐模式草稿/版本/player/真实时长；记忆来源/版本/dirty/pending/CAS。
门：本地已有实际样本播放/选择/剪辑/撤销/检查器resize正常；prepare展示不submit付费；audio/music/memory/draft/approval tests与原生证据。

## W5 · Agent

所有权：Agent展示CSS、TaskBoard/页面、ChatHeader/TopicSidebar/overlays、局部LobeChatTheme adapter。不动runtime/business/executor/budget。
公共色/字体/面板，任务标题“任务”，欢迎有独立但克制构图；同一AgentChatPage挂载、话题scope/阅读/composer/Portal/审批/原文证据/Stop/预算保留。
门：home/thread/tasks不remount；长/流式/停止后会话、上下文/任务/审核drawer可操作；话题键盘/overlay焦点；相关Agent tests。已有会话/隔离夹具即可，无需收费聊天。

## W6 · 整体验收与完成

1. 矩阵逐条填before/after、状态/尺寸、overlay/键盘/resize和证据，区分应用/受控故障夹具；pending/blocked不可标通过。布局与redirect按承载/目标验证，不虚增页面截图数。
2. 每页面族宽/紧凑/矮/窄，断点两侧；长内容/名称/错误、focus scroll、菜单边缘、弹窗操作、单主scroll；表格/时间线仅内部横向。
3. 独立trellis-check核验复用/样式泄漏/数据流/性能/保护契约；小修自修，跨owner协调。
4. 主会话trellis-update-spec更新真实frame/navigation/tokens/page/overlay/focus/print及直接相关目录/Agent漂移；不修改Trellis runtime/meta。
5. 全量质量门；按真实变更回归，纯样式不加镜像DOM/snapshot测试，行为helper/owner改变才补有意义测试。
6. diff检查无密钥/私人截图/归档文件写入；提交不推送；trellis-finish-work记录与归档，所有AC完成才结束。

## 验证命令

本机Node PATH优先 /Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin，所有pnpm写完整路径，禁止Codex Runtime pnpm。

    /Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm lint
    /Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm test
    /Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm quality --report <本轮验收输出路径>
    /Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm quality:self-test
    /Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm model-bank:verify
    /Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm build
    python3 .trellis/scripts/task.py validate .trellis/tasks/10-10-ui-consistency-desktop-prep

Focused tests按实际owner选择：materialLibrary/materialIntegration/draftConcurrency、shotFilters/shotBulkUndo/episodeDelivery、audioEngineTimeline/audioGenerationBatch/audioArrangement、musicDurationContract/musicDraftVariants、agentContextualOwnerRecovery/agentFinishingCheck/agentFinalReview/agentGenerationBatchSafety等；最终全量。新增测试取决于真实行为变化，原生视觉独立验证。

## 回退与高风险文件

共享root/theme/CSS避免跨页泄漏，不blanket reset。WorkspaceChrome missing guard、shared asset drafts、Agent same-host、音频/音乐player不得被样式迁移卸载。按批检查点，回退展示不删草稿/审批。付费submit、删除用户内容、schema/框架迁移不属于本计划。

## 实际进度

- [x] W1：共享 AppFrame / PageHeader / PageToolbar / PageContent / PageState，项目/素材统一；受控 overlay 焦点 helper 与 7 项有意义测试。
- [x] W2：IP/四类库/连接/关于迁移，保留查询、修订、脱敏和连接操作归属。
- [x] W3：视频/共享详情/故事/世界/分镜/制作/打印迁移，保留内部坐标、owner、草稿、loaded barrier。
- [x] W4：音频/音乐/记忆迁移；本地既有音频播放、trim/撤销、真实时长、草稿与 resize 复核。
- [x] W5：Agent 局部主题、欢迎/会话/任务/话题/上下文统一；原生按钮键盘激活；same-host 转换和草稿保留复核。
- [x] W6 原生/独立检查：31 桌面 + 31 窄窗，12 页族 × 5 窗口，断点/别名/长文稿/dirty close；系统打印由用户确认。受控故障与业务边界见最终验收报告。
- [x] 用户追加的素材库 Tabs：移除遗留下划线皮肤，共享 36/32px 中性页签；素材/世界/音乐原生鼠标、方向键、窄窗与独立检查通过。
- [x] 最终质量门通过，产品输入hash核对未变化；完整原生/受控边界、独立报告与规范已记录。
- [x] 用户于 2026-10-10 确认完整提交计划：“按方案提交并归档”。
- [x] 工作提交 `100f0e936d637c7cccfa564ac6c9b36b88b33cc7` 已完成。用户已批准归档与 journal，由 trellis-finish-work 顺序执行；最终收尾状态与记录见 task.json 和开发者 journal。
