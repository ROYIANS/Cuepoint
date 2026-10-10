# 深色创作工作台 · 设计与实现契约

状态：用户于 2026-10-10 明确批准最新最终方案；本契约作为本轮产品实施依据。

## 设计方向与提案

以长期工作的桌面创作工具为基准：内容、操作和上下文清楚，密度有层级，滚动发生在明确区域。取消营销留白/宣传式标题、全局点击火花和圆角大外框；保留中性暗色、白色主要动作、原有控件默认几何和各媒体预览比例。

[交互提案](preview/index.html)与 preview/screenshots 展示项目、素材和工作区的共同语言。原型 native select/dialog 只是独立展示；产品继续使用既有 Radix/shadcn。示例绘画不会成为默认封面，“设计预览”页脚也不是产品新增状态栏。

## 应用框架与导航

- 共享 AppFrame 展示基础由 StudioShell/WorkspaceChrome 分别采用；项目数据、不可用保护仍归原 WorkspaceChrome，不套进 Studio 业务生命周期。
- 根填满窗口，h-dvh/min-w-0/min-h-0/overflow-hidden；移除 8px 外边距、圆角内容外框，以细分隔线区分导航和内容。
- ≥1200px：176px 图标+文字导航；768–1199px：64px 图标导航，有中文 aria 名称/Tooltip；<768px：顶部入口 + 既有左侧 Radix Sheet。受限编辑工作区可紧凑，内容容量断点不机械统一。
- 保留创作助手/IP/项目/素材/任务/连接与模型/关于/导入以及旧四类设定入口；Agent/任务高亮互斥。
- 项目页同一视觉，顶部约 44px 上下文/项目导航；保留返回工作室/集列表、项目/集名、设置、适用的故事/世界/分镜/制作/记忆。长名截断有完整可访问名，窄窗口换行/已有菜单保证可达。
- 不新增持久多项目页签、最近项目或命令面板。提案的“示例工作区”是切页便利入口。
- Agent 同一 scoped ThemeProvider/持久 AgentChatPage，home/thread/tasks 不重建 runtime。移动主导航与 ChatHeader 协调，不能双标题或挡住话题入口。

## 语义样式与字体

扩展既有 CSS 语义 token，映射 shadcn 和 Agent 局部主题，不新增主题库/全局 antd reset。

| 角色 | 目标 |
| --- | --- |
| 导航/应用/面板/抬升面 | 中性色，提案约 #0c0c0c/#101010/#151515/#202020；用途 token |
| 分隔/文本 | 低透明度细线、近白正文、中灰辅助；不用左侧装饰色条 |
| 动作/状态 | 白色主要动作；危险/审批/轨道功能色保留，状态同时有文本 |
| 页面标题 | sans 24px/600/32px，窄屏 20px/600/28px |
| 密集编辑标题 | sans 20px/600/28px |
| 区域/面板标题 | 16px/600/24px 或 14px/600/20px |
| 正文/表单 | 14px/22px；创作文稿可指定 16px 阅读模式 |
| 辅助/紧凑工具 | 12px/18px；Agent 正文 12/14/16，清理 13px 漂移 |
| 标尺/数值 | 必要 10/11px 微标签、tabular-nums，仅限定标尺/缩略标记 |
| 间距 | 4/8/12/16/24/32；页面桌面 gutter24、窄屏16，密集工作区16–20 |

复用 styles.css 本地中文 sans 链。功能 UI 不再 font-display，实际创作/打印可有 serif 文档例外。无新字体下载要求；离线回退不能阻止使用。既有 Button/Input/Textarea/Select 的 radius/border/shadow/focus 保留；默认36px、紧凑32px，不全站改直角。

## 共享展示与页面模式

- PageHeader：功能 h1、可选简短说明/计数/返回上下文、actions；主动作右侧，窄窗口自然折行。减少装饰，不删除真实说明/风险。
- PageToolbar：搜索/排序/筛选/页签统一几何；Link、Tabs、aria-pressed filter 保留不同语义。
- Tabs 实际落地：共享 panel 底轨36px、elevated选中按钮32px；选中无静态边框/ring/shadow，只在 focus-visible 出现共享焦点环。素材库遗留下划线/透明/直角皮肤已按用户截图反馈移除，World/Music等6消费者统一使用共享皮肤；消费端只调整换行/宽度/紧凑水平padding。
- PageContent：collection 可用宽网格；detail 可读约1040px；document约850–880px；workbench全宽；Agent transcript 保持约800px。不能统一成一个全局 max-width。
- PageState：loading/initial-empty/filtered-empty/missing/error，page/panel/inline 模式；undefined 与空数组不同，status/alert 真语义。
- OverlayLayout：既有 Dialog/Sheet 的 header/可滚 body/可达 footer，standard/large/review/editor 模式，最大高度约100dvh−32px。dirty/pending/审批快照、Portal、焦点/关闭策略保留。
- Card：保留项目2:3、横图16:10、媒体4:3；统一标题/metadata、边框/焦点/间距；开卡/菜单分开，键盘/触屏可发现，不仅 hover 挂载。
- Form/Detail：共同返回/标题/section/form/feedback；真实字段草稿/失败保留/重试仍归既有 owner。公共展示层不读DB、不生成、不持久化。

## 全站应用与例外

| 页面族 | 对齐 | 必须保留 |
| --- | --- | --- |
| 项目/素材/IP/四类库 | header-toolbar-content、动作位置、卡片与状态，去眉题/宣传标题 | kind/IP/归档、scope/version、各媒体比例 |
| IP/资产详情/连接 | 可读表单/section/反馈、功能标题 | Studio/project ownership、dirty/revision、密码/测试/断开行为 |
| 关于 | frame/可访问功能标题、克制品牌内容 | Logo/产品说明/支持入口 |
| 集列表/故事/世界/制作 | header/toolbar/gutter、减少卡片包裹 | 文稿/场景、Tabs、交付指标/导出 |
| 分镜 | 密集工具/行样式/状态/内部滚动 | stable anchors、lazy controls、DnD/deep link、草稿/批量/快捷键 |
| 音频 | 文稿/时间线/检查器/审核按共同面板语言 | 坐标/波形/trim、transport、真实时长、模式/排列/撤销 |
| 音乐 | creator/list/detail/player 面板/控件 | 模式草稿/版本/审批/解码时长/player 生命周期 |
| 项目记忆 | 功能名“项目记忆”、list/detail/feedback | 来源/版本/采纳/CAS/dirty/pending |
| Agent 欢迎/会话/任务 | 公共色/字号/面板，任务功能名“任务” | 独立欢迎构图、同一 runtime、阅读/composer/Portal/审批/Stop/预算 |
| 分镜打印 | 屏幕工具栏对齐；纸面仍白底黑字 | episode scope、loaded barrier、A4横向10mm/隐藏chrome |

提案右侧检查器表示已有详情面板的样式方向。本轮分镜保留现有行编辑位置/草稿/挂载行为，不为复制原型新增全局选中 owner 或分镜检查器流程；音频/音乐/任务已有检查器采用共同语言。

## 数据流与兼容性

Route → 既有 feature owner/live query → 既有业务命令/草稿/审批 → 共享展示。重点保留 keyed owner/entity drafts、失败/删除后的草稿、captured revision、shot稳定行/延迟控制；音频原单位/CAS/undo/手工片段；20段/并发2的prepare-confirm、失败单项重新审批、刷新不重发；Agent same-host/scoped Portal/Stop/预算；打印加载屏障。

不改DB schema、仓库命令、供应商参数、URL。面板折叠不卸载真实编辑/播放/运行 owner。通用组件可归 src/components/layout 等已有公共展示层，不能引入领域副作用。

## 窗口/键盘与平台边界

验收1440×900、1280×720、1024×640、1280×600、390×844，补受影响断点两侧；这是Web测试目标，不是已选OS最小窗口限制。集合/表单有一个主要正文scroll owner，编辑器有明确内部scrollport；仅表格/时间线内部横向滚动。Tab正确滚到焦点，矮窗口弹窗操作可达；检查长名称/错误/永久滚动条占宽。

主导航左Sheet，Agent话题保留实际右Sheet并更新旧规范方向描述。关闭/dirty/审批/focus return 与已有快捷键策略不变。尊重reduced-motion，移除点击火花不改变事件传播。Windows/Linux真机、OS标题栏/原生菜单/打包及字体资产在后续桌面任务，本轮不宣称跨平台原生通过。

## 分批落地与回退

基础/token/frame → 项目/素材 → Studio → 视频/共享详情 → 音频/音乐/记忆 → Agent → 整体验收。冻结共享接口，按文件所有权隔离，禁止 blanket feature CSS 覆盖。业务回归先回退该展示批并保留复现，不削弱owner安全检查。规范在落地后记录真实几何/例外，提案不能当成已实现事实。
