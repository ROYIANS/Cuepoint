# 全站覆盖矩阵

47 个路由文件全部映射为 31 个页面/上下文检查项，含 Studio/项目共享详情的不同所有者，以及 film/series/audio/music。路由、布局和别名不重复计成独立页面。

正式产品已完成 31 项改前（main ecf8dd0c、1280×720）、31 项改后桌面和 31 项改后窄窗检查。12 个代表页族覆盖全部五种目标窗口，共 60 项；767/768/1199/1200 四断点和8条别名实际目标已核验。素材库 Tabs 最后修正后又重验五窗口，并复验世界/音乐的方向键与窄窗。规划 HTML 不计入这些结果。

## 证据方法与边界

这里的通过指真实页面布局与记录中的实际操作。原生状态按下表列出；并发、CAS、供应商失败、持久化拒绝、流式审批/Stop/预算等受控状态由现有业务测试与独立检查验证，没有把单元测试包装成原生浏览器故障注入，也没有宣称每页每种失败均现场触发。系统打印窗口无法自动读取，由用户明确回复“打印预览正常”完成手动复核；已有 opt-in 原生测试的1个 skip 不计为执行通过。

真实 API 生成/跨平台安装属于其他任务，本轮没有付费请求。原生本地验收 fixture 的新增内容与既有样本都保留在隔离验收 origin；未删除用户数据或修改连接凭据。

| ID | 页面/上下文 | 改前/改后 | 实际状态与操作 |
| --- | --- | --- | --- |
| C01 | AboutPage · default | [before](native-before/C01.png) / [after](native-after/C01.png) / [narrow](native-after/C01-390x844.png) | Brand page and narrow layout; shared navigation/overlay controls inspected. |
| C02 | AgentChat · conversation | [before](native-before/C02.png) / [after](native-after/C02.png) / [narrow](native-after/C02-390x844.png) | Existing long/stopped conversation and execution results; right topic Sheet Space/Escape and native button focus; task detail Enter; context popover; draft survives actual same-host home/thread/tasks links. |
| C03 | AgentHome · welcome | [before](native-before/C03.png) / [after](native-after/C03.png) / [narrow](native-after/C03-390x844.png) | Welcome and model/context controls; shared Agent host. No provider request sent. |
| C04 | AgentTasks · tasks | [before](native-before/C04.png) / [after](native-after/C04.png) / [narrow](native-after/C04-390x844.png) | Populated task board and detail/goal editing; unsaved completion criterion continues editing, then discards without saving; safe initial Cancel focus. |
| C05 | MaterialLibraryPage · default | [before](native-before/C05.png) / [after](native-after/C05.png) / [narrow](native-after/C05-390x844.png) | Media empty; settings populated with local fixture version1; keyboard media/settings; import dialog; detail/history; dirty remark retained on Continue and discarded; all five viewports repeated after user-reported tab skin fix. |
| C06 | CharacterDetailPage · studio-owned | [before](native-before/C06.png) / [after](native-after/C06.png) / [narrow](native-after/C06-390x844.png) | Studio-owned role; explicit missing-ID page; existing form fields/media geometry. |
| C07 | CharacterLibraryPage · default | [before](native-before/C07.png) / [after](native-after/C07.png) / [narrow](native-after/C07-390x844.png) | Studio role collection and fixture create; cards/menu keyboard presentation. |
| C08 | ConnectorsPage · default | [before](native-before/C08.png) / [after](native-after/C08.png) / [narrow](native-after/C08-390x844.png) | Connected/unconnected list; blank OpenAI config; Tavily checkbox Space; close without credential edits; no secrets recorded. |
| C09 | IpProfilePage · default | [before](native-before/C09.png) / [after](native-after/C09.png) / [narrow](native-after/C09-390x844.png) | Existing IP fixture editor; missing IP fallback; dirty-close Continue and discard. |
| C10 | IpProfilesPage · default | [before](native-before/C10.png) / [after](native-after/C10.png) / [narrow](native-after/C10-390x844.png) | IP list and archive confirmation; initial safe Cancel then return to archive button; no archive performed. |
| C11 | ProjectGalleryPage · default | [before](native-before/C11.png) / [after](native-after/C11.png) / [narrow](native-after/C11-390x844.png) | Populated project gallery; project kinds/IP filters; create dialog short-window body scrolling/footer reachable, Escape returns to New project. |
| C12 | PropDetailPage · studio-owned | [before](native-before/C12.png) / [after](native-after/C12.png) / [narrow](native-after/C12-390x844.png) | Studio-owned prop and explicit missing-ID page. |
| C13 | PropLibraryPage · default | [before](native-before/C13.png) / [after](native-after/C13.png) / [narrow](native-after/C13-390x844.png) | Prop collection and local fixture creation. |
| C14 | SceneDetailPage · studio-owned | [before](native-before/C14.png) / [after](native-after/C14.png) / [narrow](native-after/C14-390x844.png) | Studio-owned scene and explicit missing-ID page. |
| C15 | SceneLibraryPage · default | [before](native-before/C15.png) / [after](native-after/C15.png) / [narrow](native-after/C15-390x844.png) | Scene collection and local fixture creation. |
| C16 | StyleDetailPage · studio-owned | [before](native-before/C16.png) / [after](native-after/C16.png) / [narrow](native-after/C16-390x844.png) | Studio-owned style and explicit missing-ID page. |
| C17 | StyleLibraryPage · default | [before](native-before/C17.png) / [after](native-after/C17.png) / [narrow](native-after/C17-390x844.png) | Style collection and local fixture creation. |
| C18 | CharacterDetailPage · project-owned | [before](native-before/C18.png) / [after](native-after/C18.png) / [narrow](native-after/C18-390x844.png) | Project-owned role; foreign role owner guard; missing project guard. |
| C19 | PropDetailPage · project-owned | [before](native-before/C19.png) / [after](native-after/C19.png) / [narrow](native-after/C19-390x844.png) | Project-owned prop, owner-scoped loaded form. |
| C20 | SceneDetailPage · project-owned | [before](native-before/C20.png) / [after](native-after/C20.png) / [narrow](native-after/C20-390x844.png) | Project-owned scene, owner-scoped loaded form. |
| C21 | StyleDetailPage · project-owned | [before](native-before/C21.png) / [after](native-after/C21.png) / [narrow](native-after/C21-390x844.png) | Project-owned style, owner-scoped loaded form. |
| C22 | StoryPage · film | [before](native-before/C22.png) / [after](native-after/C22.png) / [narrow](native-after/C22-390x844.png) | Film story and scene layout, existing owner/draft boundaries. |
| C23 | StoryPage · series | [before](native-before/C23.png) / [after](native-after/C23.png) / [narrow](native-after/C23-390x844.png) | Series local long story (71 lines/1339 chars before added edit), narrow autogrowing document; saved feedback and actual guarded navigation across pending debounce. |
| C24 | ProducePage · default | [before](native-before/C24.png) / [after](native-after/C24.png) / [narrow](native-after/C24-390x844.png) | Loaded production/readiness and export controls inspected; no external publish/export mutation. |
| C25 | ShotEditorPage · default | [before](native-before/C25.png) / [after](native-after/C25.png) / [narrow](native-after/C25-390x844.png) | Loaded shot table with media/deep links; intentionally wide internal canvas; filters/lazy/bulk/undo retain existing executable coverage. |
| C26 | StoryboardPrintPage · default | [before](native-before/C26.png) / [after](native-after/C26.png) / [narrow](native-after/C26-390x844.png) | Loaded white storyboard; 5 local shots; print CSS and frame release inspected. User confirmed actual system print preview normal: white/A4 landscape/no navigation/complete pagination. |
| C27 | EpisodeListPage · video-series | [before](native-before/C27.png) / [after](native-after/C27.png) / [narrow](native-after/C27-390x844.png) | Series episode collection with local fixture episodes and shared header; episode commands keep existing tests. |
| C28 | AudioWorkspacePage · audio | [before](native-before/C28.png) / [after](native-after/C28.png) / [narrow](native-after/C28-390x844.png) | Existing 3 audio clips (7.8s), selection/playback, precise trim second clip0 to0.1 then undo0; batch review short-window scrolling; arrangement preview/conflict count0, no paid confirmation. |
| C29 | MusicWorkspacePage · music | [before](native-before/C29.png) / [after](native-after/C29.png) / [narrow](native-after/C29-390x844.png) | Existing local 58.624s music sample plays across390-to1024 resize; detail inline/Sheet; local Simple/Custom draft variants retained; shared mode/workspace Tabs arrow navigation and narrow layout after last fix. |
| C30 | ProjectMemoryPage · default | [before](native-before/C30.png) / [after](native-after/C30.png) / [narrow](native-after/C30-390x844.png) | Memory empty/populated/source/version1; native select ArrowDown+Enter; dirty text retained on Continue then discarded. |
| C31 | AssetLibraryPage · default | [before](native-before/C31.png) / [after](native-after/C31.png) / [narrow](native-after/C31-390x844.png) | All5 World categories; characters/scenes populated and props/styles empty; search empty; studio picker dialog; query-backed ArrowRight after latest shared Tabs fix. |

完整路由/URL/证据 ledger：[audit-coverage.json](audit-coverage.json)。最终状态、质量门与遗漏修复：[final-acceptance.md](final-acceptance.md)。独立检查：[independent-check.md](independent-check.md)。

## 功能例外

分镜表与音频时间线保留内部横向画布；普通页面 document root 未超出窗口。密集分镜/音频/音乐/会话标题20px，普通页24px，窄窗20px；白纸打印保持24px纸面标题。每个编辑、播放和运行 owner 仍归原 feature，页面基础不获取或持久化领域数据。

重定向8条实际目标见 native-after/redirects.json；有/无剧集的条件别名本轮现场验证了有剧集分支，无剧集 fallback 由原源码/测试保留，不另计原生通过。
