# 模型库迁移到 Models.dev

状态：规划中。范围与关键决策已由用户确认；设计中给出的建议项待用户在最终计划中确认；最终计划获批前禁止 `task.py start`。

## Goal

用 Models.dev 替换手动同步的 LobeHub model-bank：模型规格（上下文、输出上限、视觉等能力）与价格更及时、覆盖更广；内置基线保证离线可用，用户可在界面里手动同步更新；模型选择处展示价格；为后续"模型使用统计看板"留口子（本轮不做看板）。LobeHub model-bank 退役。

## Background and decisions

- 用户原话（2026-10-13）：agent model 现在用 LobeHub 的 modelbank，需手动同步、信息不及时，改用 Models.dev（`api.json`/`models.json`/`catalog.json`、`/logos/…`、SDK `@opencode-ai/models`）。
- 已决策：
  1. 允许联网，**包括桌面端**；`models.dev` 作为"仅限目录同步用途"的放行来源加入网络策略；其余放行规则不变。
  2. **LobeHub model-bank 退役**。
  3. 用 `@opencode-ai/models` npm 包作为内置基线，界面里提供 Models.dev 同步功能。
  4. 同步**只手动触发**（无启动时自动检查、无后台静默联网）。
  5. **模型选择处展示价格**；为统计看板留口子。
  6. **存储用新增的数据库表，不用 `localStorage`**（用户 2026-10-13：目前没人用，可以接受 schema 变更；后续还会陆续加表，不能一直靠 `localStorage`）。
  7. **基线随发版刷新**（用户 2026-10-13）：允许安装 `@opencode-ai/models`（devDependency）；每次发版前把它升到最新并重新生成基线，不在发版之间自动升级。
  8. 同步是**按所选模型子集**进行（参考 CC Switch：同步卡片、"选择要同步定价的模型"对话框含自动包含常用模型开关、供应商筛选、搜索、全选/清空、已选数量，列表行含名称/供应商/日期/ID 与输入/输出/缓存命中/缓存创建价格，归一化 ID 相同的只导入一次；"模型定价"总表，单位 USD / 每百万 Tokens）。仅作交互参考，不照搬。
- 事实基线（research/models-dev-migration.md、research/storage-egress-ui-placement.md，2026-10-13 实测或读代码；推断与未验证项见各文 Caveats）：
  - Models.dev：`api.json` 5.6 MB / 228 provider / 约 8,800 条；`models.json` 469 KB / 550 规范模型；三者均带 `access-control-allow-origin: *` 与 ETag；价格只在 `api.json` 的 provider 记录里，`models.json` 无 `cost`。紧凑投影后每条中位约 359 B，全量约 3.2 MB，精选 300 个约 120 KB。
  - 现有 LobeHub 消费者只读 `contextWindowTokens`、`maxOutput`、`abilities.vision`；匹配按连接器 `definitionId` + 精确 id，冲突即未知；`reasoningPolicy` 的推理强度表是自带手写表，不来自 bank。
  - 对照表：`deepseek`→`deepseek`、`aihubmix`→`aihubmix`、`mimo`→`xiaomi`；`apimart` 无对应 provider；`openai-compatible` 默认 `openai`，用户改 baseUrl 后无法仅靠 `definitionId` 判断。多 provider 出现的 id 中 65% 的上下文/输出上限不一致。
  - `@opencode-ai/models` 0.0.103：MIT、仅 ESM、无运行时依赖、约每日发布、0.0.x 不承诺稳定；tarball 635 KB，`dist/snapshot.js` 6.85 MB。
  - 桌面运行时直接请求 models.dev 现在会被 `authorizeRuntimeHttp` 拒绝；最小放行只需 JS 层改动（新增 purpose），Rust 与 CSP 无需改（CSP 一点未在真实 Tauri 窗口验证）；`MAX_JSON_BYTES` 4 MiB 小于 `api.json`，需专门上限。
  - 仓库没有通用全局设置/kv 表；新增表需同时改 Dexie（v25）、`schema.json`/`schema.ts`、`tableTypes.ts`、三处写死 49 的断言、`nativeOwnerAssertions.json`，且**会让开发期已建的原生工作区无法打开**（registry hash 校验，无迁移路径）。
  - 模型选择行现在只有图标、名称、勾选；详情栏 `ModelDetail`（260px）显示上下文/输出/能力；"Model Bank"来源文案硬编码在 `ModelSelectTrigger.tsx:55,59,74` 与 `contextPolicy.ts:26`；模型图标全部来自本地 `@lobehub/icons`。
  - 运行记录已存 `usage`、`modelMetrics[].usage`、`model`、`connector`，无价格与目录条目标识。`AgentVisionCapability.source` 的 `"model-bank"` 字面量持久化在 `AgentRun.visionCapability`，没有读取点按它分支，改名或新增来源值无需迁移。

## Requirements

### R1 — 目录数据层（基线 + 同步 + 查询）

- 内置基线：构建期脚本从 `@opencode-ai/models` 的快照投影出**紧凑基线**（字段只含：provider、id、name、canonicalId、limit.context/output、modalities.input、reasoning、toolCall、cost.input/output/cacheRead/cacheWrite、releaseDate），按"常用范围"裁剪（原厂 provider 与各连接器对应 provider 的近期模型，见设计），生成可提交的 JSON，**按需懒加载**为单独 chunk；包作为 devDependency，不进入运行时依赖。提供 `models-dev:baseline`（生成）与 `models-dev:verify`（校验与已安装包版本一致）脚本，替代 `model-bank:*`。
- 运行时同步：用户在界面手动触发，经新的网络放行 purpose 请求 `https://models.dev/api.json`，**响应经 schema 校验**与体积、超时、`AbortSignal` 约束，仅保留用户所选模型子集的紧凑条目，覆盖或合并保存。失败时保持现有数据并给出友好错误（沿用/对接 `ui-error-handling` 的统一出口，如已存在）。
- 查询顺序：已同步条目 → 内置基线 → 未知。保持现有同步 API 形态：调用方（含事务内的 `agentRuns.ts:122`）读取内存中已加载的目录；启动时在首个 agent 运行之前异步加载，事务前解析视觉能力的现有顺序不变。

### R2 — 匹配规则

分层匹配，高层优先：① 同 provider 精确 id（连接器→provider：`deepseek`→`deepseek`，`aihubmix`→`aihubmix`，`mimo`→`xiaomi`；`openai-compatible` 默认 `openai` 并在用户改 baseUrl 时按 provider 的 `api` 字段匹配；`apimart` 无对应 provider）；② 原厂 provider 精确 id（价格标注"官方参考价"）；③ `canonical_model_id` 且各候选取值一致；否则未知。**价格只来自 ①②，不来自③**；上下文/输出上限在同层多候选冲突时取最小值（沿用 `modelMetadata.ts` 的 `collectModelMetadata` 先例），视觉能力冲突视为未知。数值与 LobeHub 不同（如 deepseek-v4 上下文、claude-sonnet-4-6 输出上限）视为接受。

### R3 — 网络放行

在 `runtimeHttpPolicy.ts` 新增专用 purpose：固定 `https://models.dev`、固定路径（`/api.json`）、GET、无鉴权头、独立体积上限（≥ `api.json` 体积并留余量）与总超时；重定向每一跳复检。不放宽其他规则。更新 `native-product-runtime.md` 相关规范，新增测试（放行、拒绝其他路径/方法/鉴权头、体积超限、重定向）。图标继续使用本地 `@lobehub/icons`，不放行 `img-src`。

### R4 — 存储：新增通用的"设备本地"键值表

新增一张**通用的设备本地键值表**（暂名 `deviceSettings`：`key` 主键、`value` 自由形 JSON、`updatedAt`），浏览器（Dexie）与桌面（SQLite）两个运行时一致；同步结果存于键 `modelCatalog`（元数据 + 所选子集的紧凑条目，约 100 KB 至 1 MB 的单行），所选模型清单存于键 `modelCatalogSelection`。理由：这是**设备本地、非密钥、可重新同步的数据**，不进项目包、不进未来的云同步 checkpoint（以 `device` 作用域表达）；表是通用的，**以后同类设备本地状态（如统计缓存、界面偏好）直接加键，不必每次加表**；该行只在启动时读入内存、不在每次建 run 的事务里读取（这是不使用 `agents` 单例行的原因）。

- 需要同步修改：`schema.json` 与 `schema.ts`（两份逐字等价）、`tableTypes.ts`、`browserDatabase.ts` 新增 `version(25)`、`nativeOwnerAssertions.json`、数据命令与测试；并**将三处写死的表数量断言（`tests/helpers/sharedStorageCases.ts:15`、`registry.rs:38`、`full_product_store/tests.rs:122`）改为由 `schema.json` 推导**，使以后再加表只需改 schema 与类型（若某处无法安全推导，保留断言并在任务里记录原因）。
- 读取同步性：`initModelCatalog()` 在启动、首个 agent 运行之前异步读入内存；运行时查询读内存，保持 `agentRuns.ts:122` 事务内同步读取。
- 兼容与影响：桌面端打开已有工作区会校验 registry hash，对不上返回"Unsupported full-product workspace format"，**没有迁移路径**；规范允许（`native-product-runtime.md:13-14` 默认全新开发、不迁移旧数据）。**升级后，开发者本机已有的桌面工作区需要重新创建，建议升级前先用项目备份导出、升级后导入。**
- `localStorage` 现有的两处界面偏好（发送快捷键、`cuepoint.agent.topicGrouping`）本轮不迁移，列为后续。

### R5 — 界面

- 页面：`/connectors` 新增第三个左侧导航项「模型目录」（与现有"模型连接""网络搜索连接"并列）。
- 同步卡片：显示数据来源（"内置基线 · 版本 X"/"已同步"）、上次同步时间与结果、模型数量；「选择模型」「立即同步」；「…」菜单含"恢复为内置数据"（清除已同步数据）。没有"打开目录/重新加载文件"（不是文件）。同步中可取消，失败显示友好原因。
- 选择模型对话框：自动包含常用模型开关（显示数量）、供应商筛选、搜索、全选筛选结果/清空、已选数量；行显示名称、供应商、发布日期、ID 与输入/输出/缓存命中/缓存创建价格；归一化 ID 相同者合并为一行；选择结果保存在本地。需处理大列表（约 8,800 行）的性能（虚拟化或分页，设计中定）。
- 模型定价总表（只读）：列出当前已加载条目，USD / 每百万 Tokens，可搜索筛选。
- 模型选择处：详情栏新增「价格 · USD / 每百万 tokens」，未知显示"价格未知"而不是 0，并标注数据来源条目；"Model Bank"来源文案全部改为"模型目录"。行内价格为可选增强（设计中评估）。

### R6 — 统计口子（最小）

创建运行时在 `AgentRun` 上记录**可选**的价格快照字段（来源、provider、条目 id、币种与单位、输入/输出/缓存读写价、记录时间）；提供纯函数 `estimateRunCost(usage, pricing)`（含缓存读写与未知处理）。不做看板、不做汇总、不改存储 schema；老记录没有该字段时按"价格未知"处理。`AgentVisionCapability.source` 新增 `"models-dev"`，保留对旧 `"model-bank"` 的读取兼容。

### R7 — 退役与清理

移除 `vendor/lobehub`（约 2.1 MB）、`scripts/model-bank-snapshot.mjs`、两个生成 JSON、`model-bank:*` 脚本、`.github/workflows/ghcr.yml:44-45` 的校验步骤与 `knip.json:5` 入口；重写 `tests/modelBank.test.ts` 与更新 `tests/agentReferences.test.ts:60-62`；更新相关规范（`ai-connectors.md` 等）与 README。`@lobehub/icons`、`@lobehub/ui` 保留。

## Acceptance Criteria

| ID | 可观察结果 | 对应 |
| --- | --- | --- |
| A1 | 内置基线懒加载可用，离线时模型选择仍显示规格与价格；`models-dev:verify` 校验基线与已安装包版本一致；不再存在 `vendor/lobehub` 与 `model-bank:*`。 | R1, R7 |
| A2 | 手动点「立即同步」后，所选模型的规格与价格更新、显示同步时间与数量；失败时保持原数据并给出友好原因；同步可取消；不点就不会联网。 | R1, R5 |
| A3 | 桌面端与浏览器端同步均可用；网络策略只新增 models.dev 目录路径一项，其他请求规则不变，非放行路径/方法/鉴权头被拒，超大响应被拒，重定向被复检；**用户配置的 openai-compatible 等连接（含 `http`、局域网/本机地址、流式响应、重定向复检）在改动后行为不变，有回归测试覆盖。** | R3 |
| A4 | 同步结果与所选清单存于新增的通用设备本地键值表（浏览器与桌面一致），不使用 `localStorage`；表数量断言改为由 schema 推导；该表不进项目包；数据损坏或读取失败时回退内置基线并提示；升级后新建的原生工作区可正常打开。 | R4 |
| A5 | 匹配按层级进行：同 provider 精确 id 优先、原厂价标"官方参考价"、跨 provider 冲突不出价；deepseek、aihubmix、mimo、openai 默认连接各有命中；apimart 无对应时按规则回退而不报错。 | R2 |
| A6 | `/connectors` 有「模型目录」，同步卡片、选择对话框（含搜索、供应商筛选、全选/清空、已选数量、合并重复 ID）与只读定价表可用；大列表不卡顿。 | R5 |
| A7 | 模型选择详情栏显示价格或"价格未知"，来源文案为"模型目录"；价格单位与来源清晰。 | R5 |
| A8 | 新建运行记录带价格快照（可选字段），旧记录读取不出错；`estimateRunCost` 对缓存读写与未知价格行为正确；视觉能力来源 `"models-dev"` 写入、旧 `"model-bank"` 读取兼容。 | R6 |
| A9 | `pnpm lint`、`test`、`quality`、`quality:self-test`、`build`、desktop types/lint/quality 通过；新增测试覆盖匹配分层、冲突合并、校验、同步失败回退、放行策略、选择去重、价格显示与成本估算。 | R1–R7 |
| A10 | 真实窗口人工检查（浏览器与桌面各一次）：联网同步成功与失败、取消、选择对话框性能、价格显示、离线回退、打包版是否能真的请求到 models.dev（CSP 未在真实 Tauri 窗口验证）。此项我无法替代。 | R3, R5 |

## Out of Scope

统计看板与任何汇总/图表；启动时自动同步或后台定时联网；运行时刷新价格以外的任意远程数据；放行除 models.dev 目录路径外的任何新来源；远程 logo（继续用本地 `@lobehub/icons`）；`reasoningPolicy` 手写推理强度表的重做；旧工作区的 schema 迁移；`localStorage` 现有两处偏好迁入新表；云同步 checkpoint 中携带目录数据；Models.dev 的 TOML 源数据读取；基于价格的自动选模型或预算控制。

## Technical Notes and Risks

- 新增表使旧的原生开发工作区无法打开（无迁移路径，规范允许，已由用户确认"目前没人用"）；升级前建议先导出项目备份。
- 打包版 Tauri 能否真的请求 models.dev（CSP 与授权）未验证；调研认为原生请求不经 WebView，但需在真实窗口确认。
- `api.json` 5.6 MB 的解析与投影是一次性的 CPU/内存尖峰，需在设计中约束（流式或分步、`AbortSignal`、不在主线程长占）。
- 基线裁剪范围与"常用模型"定义直接影响包体积与命中率，设计中给出建议值，实现时以实测体积为准（目标：基线 chunk 压缩后合理，不进主 bundle）。
- 价格数据不可信/可能阶梯定价；首版只用基础输入输出与缓存读写，阶梯价忽略并标注。
- `@opencode-ai/models` 0.0.x 每日发布无稳定承诺：package.json 锁定**精确版本**；**发版前**的固定动作是"升到最新 → `models-dev:baseline` 重新生成 → `models-dev:verify` → 提交"，发版之间不自动升级。基线变化应在提交说明里记录包版本。
