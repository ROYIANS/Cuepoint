# 界面、交互与前端逻辑审查

审查日期：2026-09-21。范围是 `src/components/**`、`src/routes/**`、`src/styles.css` 和界面关联的顶层 `src/lib` 帮助函数。此次只审查，不修改产品代码。逐文件覆盖与深度见 [ui-coverage.json](./ui-coverage.json)。`deep` 表示阅读实现并追踪状态/调用边界，`static` 表示静态阅读；两者均不代表完整浏览器测试。

## 已确认问题

### UI-01 · P1 · 外部更新未同步到草稿，修改标题会把另一标签页的新剧本覆盖回旧值

- 位置：`src/components/story/StoryPage.tsx:82`、`:90`；`src/lib/debouncedDraft.ts:183`、`:191`、`:196`；同类调用 `src/components/assets/WorldSettingPanel.tsx:60`、`:85`。
- 证据：`useDebouncedDraft` 只在初次创建 controller 时使用 `initialValue`，之后 live query 更新实体时不会刷新已挂载的草稿。故事草稿把 title/logline/script 放进同一对象，改标题后将整个对象交给 `updateEpisodeDraft`。世界设定同样把多个字段整包保存。UI 即使显示“已保存”，也可能一直持有过时版本。
- 复现：A、B 标签页打开同一集故事；B 把剧本改为“B标签页新的剧本”并等待保存；A 仍显示“初始剧本”；A 仅改标题并等待保存。数据库剧本回到“初始剧本”。主审浏览器已确认，见 [browser-audit.json](./browser-audit.json) 的 `cross-tab stale draft overwrite`、[stale-draft.png](./stale-draft.png)。
- 影响：丢失其他入口已保存的创作内容。Agent 或其他更新入口采用相同存储路径时也存在此边界；本次直接复现的是两个浏览器标签页，未宣称每个 Agent 写入工具都逐一验证。
- 建议：以最新实体版本为基线，仅提交真正变更的字段；未编辑草稿接收外部更新；已编辑草稿遇到版本变化应明确合并/冲突处理，避免全对象静默覆盖。增加双标签页和外部更新后编辑另一字段的回归。
- 去重：与数据审查的 draft/repo 问题属于同一故障链，总报告只计一个问题。`AssetTextField` 是单字段草稿，会出现旧值显示，但没有这里的“编辑另一字段覆盖剧本”放大效应。

### UI-02 · P2 · 时长输入将 1.5 秒改成 15 秒

- 位置：`src/components/shots/ShotEditorPage.tsx:1735`–`:1741`。
- 证据：每次 onChange 立即 `Number(event.target.value)` 并异步写库；显示值又来自 `String(shot.durationSec || "")`。输入中的 `1.` 被规范化为 `1`，小数点无法留在编辑状态。
- 复现：清空镜头时长，逐键输入 `1`、`.`、`5`，在键之间等待数据库更新。界面依次显示 `1`、`1`、`15`，数据库保存 15。主审浏览器已确认，见 [browser-audit.json](./browser-audit.json) 的 `decimal input`、[decimal-input.png](./decimal-input.png)。粘贴 `1.5` 成功不构成反证。
- 影响：镜头时间、总时长与交付时长出现数量级错误，且没有校验错误提示。
- 建议：编辑时保存原始字符串，在失焦/提交时统一解析与校验；明确零、空值、非法输入的展示语义。回归覆盖逐键输入小数、删除、粘贴和中文输入法。

### UI-03 · P2 · 镜头全局快捷键抢占普通按钮与键盘拖拽

- 位置：`src/components/shots/ShotEditorPage.tsx:463`–`:532`；`src/lib/formFieldFocus.ts:1`–`:27`；拖拽键盘传感器与行拖拽 handle 在同一 ShotEditorPage。
- 证据：window 的捕获阶段监听在 Space、上下箭头等分支执行 `preventDefault`/`stopPropagation`。前置保护排除了输入框、菜单、对话框等，却未排除普通 button/link。Space 分支在确认 activeShot 有效之前就阻止默认行为。
- 复现：打开分镜，聚焦“选择”等普通按钮，按 Space。预期触发聚焦按钮；实际进入镜头选择并选择当前镜头。主审浏览器已确认，见 [browser-audit.json](./browser-audit.json) 的 `button Space activation`。对于拖拽 handle，Space/方向键无法正常送达 dnd-kit 是代码路径推导，本次未独立完成整套键盘拖拽浏览器流程。
- 影响：键盘用户操作与鼠标不一致；按钮焦点不能可靠指示下一次动作；已配置的 KeyboardSensor 受到全局监听干扰。
- 建议：快捷键只在镜头表的明确导航区域生效；让交互元素与 drag handle 优先处理自己的按键；只在确定可执行操作后取消默认行为。回归覆盖无当前镜头、按钮焦点、菜单、输入法以及拖拽开始/移动/取消。

### UI-04 · P2 · 批量生成草稿的“查看目标”会绕过未保存编辑保护

- 位置：`src/components/agent/AgentGenerationBatches.tsx:109`–`:126`、`:151`–`:154`、`:193`。
- 证据：编辑只进入组件 `local` 状态；显式 `persist()` 才写数据库。关闭弹层会检查 local，浏览器关闭有 beforeunload；但弹层内“查看目标”使用 TanStack Link，没有路由阻断或预保存。SPA 跳转到项目路由时不会触发 beforeunload，Agent 页面与 BatchSurface 卸载，本地改动随之丢失。`MemoryEditor.tsx:121` 已有 `useBlocker`，说明项目中存在可复用的完整路由保护模式。
- 复现步骤：打开一个未确认批量草稿，展开候选，修改画面描述；不点“保存草稿”，直接点“查看目标”；再返回该批次。预期保留编辑或离开前明确确认；按当前代码会回到数据库中的旧描述。
- 验证级别：主审已完成浏览器复现。输入“未保存的新提示词”后点“查看目标”，返回实际为“原始提示词”，无 browser errors。证据见 [batch-browser.json](./batch-browser.json) 及同名浏览器脚本。
- 建议：接入路由阻断，支持保存后离开/放弃/继续编辑，或安全地持久化草稿再导航。不能只拦弹层 close。

## 跨审查项与界面层补证

### 单次生成的恢复能力没有对应明确的手动界面入口

`src/components/agent/AgentGenerationResults.tsx:25`–`:43` 只渲染 job 状态、媒体、错误及目标链接；未提供查供应商状态、重试下载或再次写回按钮。`GenerationSlotCard` 提供上传/复用/保存已有素材，不负责远端任务恢复；ProducePage 负责交付与提案。批量生成有明确继续与失败项新建草稿入口，单次结果没有等价入口。主审/AI 审查应将这一界面证据与执行层恢复能力合并：不能仅凭没有按钮就断言任务完全无法恢复，也不能把“再问一次模型”视为可预测、无额外提交风险的手动恢复操作。

### 大镜头列表的交互开销随规模明显增长

`ShotEditorPage.tsx:1474` 对整组 shots 渲染全部行；行中包含多种下拉控件、字段、媒体槽，当前未看到虚拟列表。主审生产构建测得 10/200/1000 镜头分别约 735/11,755/58,155 DOM 节点。修改字段到下一动画帧的三次采样分别为 28/19/15 ms、171/214/212 ms、495/2223/2418 ms；1000 镜头初次就绪约 3427 ms。详见 [production-browser.json](./production-browser.json)。这些是本机动作采样，不是标准 FID/INP，也不是跨设备性能保证。主审负责正式性能条目，建议优先减少挂载行/重渲染范围，再做生产性能回归。

## 冗余与维护性发现

### UI-D01 · P3 · 尚未接入产品的生成意图基础层已与模型参数契约漂移

`src/lib/generationIntent.ts:11`、`:44` 的白名单不接受 `quality`/`version`，`:51` 构建图片配置也不包含这些字段；`src/lib/productionContext.ts:92` 输出默认图片参数时同样丢弃它们。当前 `domain/output` 已支持这些模型参数，因此旧基础层与新能力矛盾。

但是 `rg` 追踪 `buildProductionContext`、`prepareGenerationIntent`、`generationIntentToProposalInput` 的调用只落在自身模块及测试，未发现活跃组件/Agent 工具依赖。这是潜伏契约债务，不能报告成“当前生成必失败”。建议明确它们是待接入接口还是可删除遗留实现；若保留，应统一参数定义并增加新模型契约用例，避免后续接入时依赖看似存在的旧实现。

### UI-D02 · P3 · 可清理的小范围重复与未接入组件

- `AgentGenerationResults.tsx:15` 与 `AgentGenerationBatches.tsx:30` 独立实现目标路由映射；两处镜头链接仅到镜头页，没有像制作问题定位那样携带具体 shot 搜索参数。建议复用目标定位 helper，让“查看目标”能定位相同实体；目前不把重复十余行本身上升为功能故障。
- `StudioField.tsx` 未找到产品引用，保留了 canvas/ResizeObserver/动画实现；`studio/PropLibraryPage.tsx`、`studio/StyleLibraryPage.tsx` 只是重导出，当前路由直接使用 AssetLibraryPages。可做引用核对后删除或注明预留用途。
- `taskWorkspace.css` 重复定义 `.agent-task-inspector[data-slot="sheet-content"]`，后定义把宽度从 480 改为 600；效果可解释，但旧规则增加维护噪声。Agent 的多份样式中有重复相近的输入/按钮规则，未证明会造成可见冲突，不建议仅凭代码量大就整体重写。

## 未升级为确认问题的假设

- 镜头 `PlainCell` 与故事场次字段直接绑定 live query 值并在 onChange 异步写库，缺少类似 AssetTextField 的原始本地草稿。它可能造成长列表/慢存储条件下输入回跳或未捕获保存错误，但本次没有单独证明“某次文本必丢失”，不计入已确认列表。时长小数是已复现的具体问题，单独列出。
- 世界设定的 Label 与 Textarea 没有 htmlFor/id 对应（`WorldSettingPanel.tsx:78`–`:80`）；应补关联。未做读屏器逐字段验证，因此不泛称所有表单不可访问。多数通用 `Field` 已自动注入 id，不能把资产表单一并误报。
- 保存时存在异步调用不等于必然竞态；媒体草稿会保留失败上传、限制 pending 操作并清理自己新建的素材，关系编辑器也有失败重试与放弃入口。
- `useDebouncedDraft` 卸载时尝试 flush，且主审浏览器 `SPA navigation flush` 已通过；因此“不保存按钮就导航导致所有自动保存字段丢失”被排除。批量 local 草稿是另一条状态链。
- 项目/工作室资产详情与集路由均检查归属；没有凭路由 ID 不匹配推断跨项目资产可直接打开编辑。
- chat 展开编辑时 transcript 有 inert/隐藏处理，附件按对话维度管理，任务总结有版本校验与本地保留；未把这些已有保护误报为缺失。
- 固定宽分镜表在窄屏需要横向滚动是信息密度选择，不能只看到横向内容就断言移动端页面溢出。主审已采集窄屏截图，视觉判断以其结果为准。

## 覆盖、检查与限制

逐文件清单由 [ui-coverage.json](./ui-coverage.json) 给出，包括全部组件、样式和路由，以及审查过的顶层 helper。组件覆盖了工作室、电影/分集故事、镜头编辑、项目/工作室资产、素材槽、制作交付、Agent 聊天/任务/审批/批量生成、参考资料、项目记忆与通用 UI。

执行方式为源码阅读、精确行号定位、全仓调用搜索以及与主审浏览器证据交叉验证。未新增产品代码或测试文件；类型检查、完整现有测试与生产构建由主审统一执行，避免重复运行。上述四个核心交互缺陷均由主审浏览器实测。

尚未覆盖真实供应商付费提交、真实语音识别、系统文件选择器所有浏览器行为、完整读屏器会话，以及 Safari/WebKit（主审环境无可用 WebKit）。复杂审批/生成的底层状态机、数据导入恢复与安全边界由另两份专业审查报告负责。代码全量阅读不能证明没有其他缺陷；本报告只把有代码证据或复现证据的问题列为发现。
