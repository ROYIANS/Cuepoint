# 共享业务界面与桌面图标统一

## Goal

让浏览器端和原生桌面端使用同一套视频制作产品界面和交互语义，把 Dexie/IndexedDB 与 SQLite/应用工作区的差异收敛在存储适配层；同时修正原生 APP 图标的透明底色，使 logo 位于与桌面设计系统一致的深色背景上。

## Background and confirmed facts

- 当前应用是一个 React/Vite 应用，浏览器和 Tauri 通过运行时分支选择数据 owner，并非两套完全独立的前端。
- 共享层已经包括路由、React、AppFrame、PageLayout、基础控件、Tailwind 设计变量和大部分页面外壳。
- `WorkspaceChrome` 当前在原生运行时直接替换为 `NativeProjectWorkspacePage`，绕过浏览器端的共享 workspace shell 和 nested route `<Outlet />`。
- 浏览器端的视频页面拥有完整的项目、集数、故事、节拍、分镜、草稿冲突、撤销、排序、筛选、关系和媒体槽能力；原生端当前只有简化的项目、故事/节拍和镜头编辑器。
- 浏览器端的持久化 owner 是 Dexie/IndexedDB；原生端的持久化 owner 是新鲜的 SQLite schema 3 和应用内部工作区。
- 项目遵循 fresh development policy，不需要迁移、旧数据读取、兼容别名或旧工作区导入。
- 原生 `icon.png` 和 `icon.icns` 的角落保留透明 alpha，因此系统可能以浅色默认底展示。Web 端 logo 的透明 alpha 是品牌资源契约，不能直接修改。
- 现有共享深色 token 中，`#0c0c0c` 是导航/品牌表面，`#101010` 是应用表面。本任务选用 `#0c0c0c` 作为原生图标不透明底色，所有生成尺寸保持一致。

## Requirements

### R1. Canonical video business boundary

建立一个带类型的 `VideoWorkspaceRepository` 或等价 controller 边界，覆盖共享视频页面所需的读取、创建、更新、排序、删除/恢复、复制、批量操作、草稿基线、撤销结果、关系、筛选、列设置和媒体槽能力。浏览器端保留现有 `src/db/` 命令作为 Dexie adapter；原生端通过封闭的 Tauri DTO/action 调用 SQLite adapter。

页面不得直接按运行时分叉出一套永久业务实现，也不得用静默丢字段的兼容 mapper 假装两个模型相同。

### R2. Browser behavior preservation

现有浏览器项目库、项目主页、集数列表、故事编辑器和分镜工作台的查询、草稿冲突、撤销、排序、筛选、关系、媒体槽和路由行为保持通过原有测试。重构只改变数据访问入口和共享展示组件，不改变已验收的浏览器业务语义。

### R3. Native video model parity for shared pages

将原有 schema 3 的新鲜 SQLite 模型扩展为 disposable schema 4，并同步 Rust DTO、bridge action/result 和原生测试，使原生 adapter 能表达共享视频页面所需的项目元数据、集数故事/筛选、节拍关系和范围、镜头关系/设置/列/媒体槽能力，以及草稿基线和冲突结果。旧工作区明确拒绝，不加迁移。原生端不镜像 Dexie，不接收 SQL、绝对路径或任意 JSON patch。

### R4. One product page tree

浏览器和原生使用同一套 `AppFrame`、workspace header、项目主页、集数页、故事页和分镜页。`WorkspaceChrome` 只选择 repository/controller，不再用 `NativeProjectWorkspacePage` 绕过共享 shell 和 route outlet。原生尚未实现的世界、素材、记忆、制作、同步等能力显示明确的 capability state，不保留一个看起来像完整产品的长期简化编辑器。

### R5. Native icon background

只生成原生专用图标资源：使用现有 logo 像素，扁平化到不透明 `#0c0c0c` 背景，保持 logo 的比例、中心和光谱效果；重新生成 Tauri 所需的 PNG/ICNS 尺寸并继续由 `tauri.conf.json` 引用。Web favicon、`public/brand/logo*.png|webp` 和 Web alpha 不变。

### R6. Packaged parity evidence

在浏览器和打包原生 APP 中验证同一路由状态下的项目创建、集数、故事/节拍、分镜编辑及错误/空状态；验证原生图标角落均为不透明黑底，打包 macOS 应用实际读取新资源。验证原生运行时不会访问 Dexie，浏览器运行时不会调用 Tauri。

## Acceptance criteria

- [x] 共享 repository/controller 类型与 adapter 边界存在，并有真实浏览器和原生实现；页面不再直接依赖两套独立的视频业务组件。
- [x] 浏览器现有项目、故事和分镜测试全部通过，草稿/冲突/撤销/排序/筛选等行为没有回归。
- [x] 原生 schema、DTO、action/result 和 Rust 测试覆盖共享页面所需字段、owner/order 校验、基线冲突、撤销结果和 reopen closure。
- [x] 原生与浏览器使用同一个 AppFrame/workspace route tree；不支持的原生领域有明确状态和可恢复入口。
- [x] `icon.png`、`icon.icns` 及 Tauri 生成尺寸的角点 alpha 为 255，背景为 `#0c0c0c`，Web logo 文件保持原始 alpha。
- [x] 普通前端、原生 TypeScript/lint/quality、Rust fmt/test/clippy、普通和 acceptance 构建、打包 APP smoke/parity 检查通过。
- [x] 任务证据记录实现批次、实际命令、失败修复和浏览器/原生界面验收结果。

## Out of scope

- 云同步、同步插件、宿主适配器、冲突合并和浏览器同步码。
- 旧 IndexedDB/SQLite 数据迁移、旧 schema 读取和兼容别名。
- 新增角色、场景、道具、风格、音频、音乐、Agent 历史等尚未进入共享视频模型的完整原生领域；本任务只为共享页面需要的字段提供边界和 capability state。
- 修改 Web logo 原图、About 页面品牌 artwork 或 favicon alpha。
- 发布、推送、合并到 `main`。

## Initial integration risks — resolved in this task

- 完整 ShotEditor 的媒体槽、关系和批量操作会扩大原生 schema 与 Rust command 面；按批次实施，每批保持共享页面可运行并通过 parity 检查。
- 普通 renderer adapter 原本只做 shallow envelope check；现已统一封闭结果解析，并在更新 generation 前校验每个 action 的预期结果类型。
- 原生项目创建已补齐 kind/mode/aspect 等共享字段，以一个事务创建；实际包验收确认 series 与 9:16 被保存。

## Final acceptance

最终证据入口：`research/implementation-evidence.md`。完整当前源码门禁为前端 196 文件、3400 通过、1 跳过；Rust combined features 为 51 通过。浏览器实际 UI 验收 12 项通过；普通产品代码打包的隔离 macOS 应用完成共享编辑、设置、筛选、复制撤销、托管素材复制及重开验收。所有产品/测试/原生资产源文件在最终构建后与独立审查 hash 一致。已满足验收，待按 workflow 3.4 确认本地提交计划，再归档本子任务。父任务与同步后续继续进行。
