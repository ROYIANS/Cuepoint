# 全站 UI 统一 · 最终验收记录

2026-10-10，工作分支 `codex/ui-consistency-desktop-prep`，基线 `main ecf8dd0c`。产品实施、独立检查和最终质量门已完成；用户已于 2026-10-10 确认“按方案提交并归档”。工作提交、归档和 journal 按已确认计划执行，实际收尾记录见 task.json 与开发者 journal。

## 产品交付

共享 AppFrame 采用占满窗口的导航/内容结构，176/64/窄窗 Sheet 三种导航；统一中性暗色、sans 功能标题、页头动作、工具栏、宽度模式与状态反馈。Studio、视频、音频、音乐、记忆和 Agent 已迁移。时间线/表格/连续文稿/聊天/白纸打印保留其实际功能例外。

新增展示基础不获取数据库、创建业务 owner 或执行付费生成。Dexie schema、路由适配、业务命令、CAS/草稿、批量审批/预算/Stop、时间线坐标/undo、真实时长和 Agent 持久宿主保持原有职责。删除不用的 Grainient 展示和 ogl 依赖；ClickSpark/CreateTile 仍有真实历史原生夹具消费者，保留源码并纠正 Knip 对这些夹具的入口识别。

## 原生覆盖与证据

- [完整矩阵](audit-coverage.md)及[机器 ledger](audit-coverage.json)：47 路由文件、31 实际页面/上下文；每项都有改前桌面、改后桌面和改后窄窗截图。
- [桌面测量](native-after/final-desktop.json)和[窄窗测量](native-after/final-narrow.json)：普通 h1 24px/600、密集工作台20px/600、窄窗20px/600；纸面打印24px为明确例外。31 项根滚动宽度等于当前窗口宽度。
- [代表窗口矩阵](native-after/responsive.json)：12 页族 × 5 窗口，共60项；1440×900、1280×720、1024×640、1280×600、390×844。导航[四断点](native-after/breakpoints.json)和[8 重定向](native-after/redirects.json)已核验；有/无剧集条件别名现场只检查了有剧集分支，原有 fallback 不另计原生通过。
- 本地实际交互：项目创建矮窗滚动/可达footer；IP与素材 dirty Continue保留/Discard；共享手动草稿安全初始焦点；记忆 Select键盘；世界五类别/空/无搜索结果；31详情的代表不存在/foreign owner guard；长故事自动保存/窗口变化；音频本地样本播放、精确 trim→undo；音乐58.624秒本地样本跨尺寸播放/暂停、详情 inline→Sheet、模式草稿保留；Agent Space/Enter/Escape、右侧话题、任务详情、上下文与 same-host草稿转换。
- [历史焦点记录](native-after/focus-checks.json)保留修复前 DIV/焦点结果，不能把每条历史记录都当最终通过；报告中的最终 BUTTON 结果和后续截图才是修复后的证据。
- 系统原生打印窗口不能被自动工具读取。用户明确回复 **“打印预览正常”**，确认白底、A4横向、没有应用导航、多页完整。源码同时保留10mm、加载屏障、卡片分页与解除frame/workspace固定高度的打印规则。

截图与布局操作是正式应用证据；受控的读取失败、保存拒绝、revision/CAS、审批/停止/预算和流式供应商异常来自现有业务测试及源码检查，没有宣称对每个页面的每个故障都进行过原生注入。本轮未发付费 API 请求、没有改用户连接凭据或删除用户数据。Windows/Linux 真机、OS 标题栏、原生菜单和安装包在后续桌面任务验收。

## 验收中发现并修复的问题

1. 部分 PageContent 替换移除了 main landmark：补回对应主区域语义。
2. 无 Radix Trigger 的受控 Dialog/Sheet/AlertDialog 关闭后焦点落到 body：共享 opener fallback 尊重 caller preventDefault、现有有效焦点、连接状态与新打开代次；7项实际 helper 测试覆盖，原生 Escape返回再次确认。
3. 确认框安全按钮没有注册 AlertDialogCancel：补齐全部20个消费者，保留原回调/disabled/pending，asChild包装避免双重关闭。共享草稿 guard 的 Continue初始焦点已原生确认。
4. deprecated LobeHub ActionIcon 是带 role 的DIV，没有 Enter/Space激活：三个消费文件转为官方 base-ui 原生 BUTTON，实际键盘开关/关闭返回确认。
5. 用户最后截图发现素材库 Tabs 的遗留下划线/透明/直角皮肤与共享 active border混用。移除旧皮肤并统一共享控件36px轨道/32px按钮、panel/elevated选中面；选中无静态边框/ring/shadow，focus-visible保留。

最后一项不是仅删截图中的边框：全部6个消费文件独立复查，素材库五窗口重验；素材/世界/音乐方向键与窄窗通过。证据：[素材桌面](native-after/material-tabs-fixed-1280.png)、[素材键盘](native-after/material-tabs-keyboard.png)、[素材窄窗](native-after/material-tabs-fixed-390.png)、[世界窄窗](native-after/world-tabs-fixed-390.png)、[音乐窄窗](native-after/music-tabs-fixed-390.png)、[Tabs测量](native-after/tabs-final.json)、[五窗口](native-after/tabs-responsive-final.json)。早期截图中的旧Tabs不覆盖这些最终补充。

## 最终质量门

均使用 `/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm`，Node24.11.0；未使用Codex Runtime pnpm。最终共享Tabs修复后产品文件冻结，质量输入1046项hash核对未变化。[结构化结果](quality-final.json)保留输入hash与本机原始日志路径。

| 检查 | 结果 |
| --- | --- |
| 类型检查 `pnpm lint` | 通过，exit0 |
| 全量 Vitest | 181文件，3228 passed，1 skipped；skip为已有 opt-in 原生项，不计为执行通过 |
| quality全模式 | 通过，0 failures；13条既有 reviewed error allowance、548条可见 warnings；未新增 debt/豁免 |
| 架构 | 440文件，1794 static value edges、6 literal dynamic edges，0 static cycles |
| unused | 7 full-scope candidates由7既有 reviewed contracts解释；88 production-only signals保留供复查 |
| quality自测 | 88 cases通过 |
| model-bank verify | 197 files、85 providers、1855 models，revision ebe58628，通过 |
| Vite build | 通过；既有部分chunk超过500kB的提示保留，未调高阈值压警告 |
| diff/context | diff --check通过；implement/check jsonl各7有效项 |

全量测试首次27失败是两个既有浅层展示宿主的因果漂移：B01只走children，遗漏PageHeader actions/PageState字段；B06连接fixture仍是裸数组，而真实查询返回{connectors}/{error}，并遗漏标题操作槽中的DraftStatus。修复的是夹具的真实展示边界；身份、owner、脱敏、mutual exclusion、debounce、CAS等原断言保留，产品业务没有因测试而削弱。B01原9项/B06原56项以及最终全量均通过。

`routeTree.gen.ts`被标准构建格式化后，比较其TypeScript语法树与HEAD完全相等，仅恢复生成器格式噪声；未引入路由语义改动。现有stylesheet依赖contract只刷新已核查imports的原证据hash，没有扩大unused例外。更详细结论见[独立检查](independent-check.md)。

## 完成状态

AC1–AC6的页面系统、布局、代表交互、业务回归、规范和证据工作已交付；原生/受控证据的方法与平台边界如上。AC7的代码提交、任务归档和journal已经获得一次确认，按工作提交→任务归档→journal的顺序执行；完成状态与实际commit记录在task.json和开发者journal。已落地规范在 `.trellis/spec/frontend/desktop-ui.md`，索引/目录/组件指南同步到实际接口与导航方向。
