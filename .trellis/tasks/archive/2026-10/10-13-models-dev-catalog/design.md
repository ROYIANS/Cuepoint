# 技术设计：模型库迁移到 Models.dev

## 1. 边界

- 新模块 `src/lib/ai/modelCatalog/`（纯逻辑 + 同步 + 存储），替代 `src/lib/ai/modelBank/`；UI 在 `src/components/connectors/`（新增「模型目录」区）与 `ModelSelectTrigger` 的详情栏。
- **新增一张通用设备本地键值表 `deviceSettings`**（见 §5b）：改 `schema.json`/`schema.ts`、`tableTypes.ts`、`browserDatabase.ts`（`version(25)`）、`nativeOwnerAssertions.json`，并把三处写死的表数量断言改为由 schema 推导；Rust 不需要写 DDL 或命令（SQLite 是通用 `product_records`，白名单由 `include_str!(schema.json)` 驱动）。不新增 Tauri 插件；不放行 `img-src`。
- 保持不变：`reasoningPolicy.ts` 的手写 `WIRE_POLICIES`（只把读取上下文窗口的来源换成新目录）、事务前解析视觉能力的顺序（`agentRuns.ts:71`）、`agentRuns.ts:122` 事务内同步读取。

## 2. 数据模型

```ts
// src/lib/ai/modelCatalog/types.ts
interface CatalogEntry {
  provider: string;          // Models.dev provider id
  id: string;                // provider 内模型 id
  name: string;
  canonicalId?: string;
  context?: number; output?: number;           // limit.context / limit.output
  imageInput?: boolean; reasoning?: boolean; toolCall?: boolean;
  cost?: { input?: number; output?: number; cacheRead?: number; cacheWrite?: number }; // USD / 1M tokens
  releaseDate?: string;
}
interface CatalogSnapshot {
  source: "baseline" | "synced";
  packageVersion?: string;   // 基线所用 @opencode-ai/models 版本
  syncedAt?: string;         // ISO
  entries: CatalogEntry[];
}
interface CatalogSelection { autoIncludeCommon: boolean; modelKeys: string[]; } // "provider/id"
```

阶梯价与其他字段首版丢弃；缺失字段保持 `undefined`，不填 0。

## 3. 基线（构建期）

- `@opencode-ai/models` 作为 **devDependency，锁定精确版本**。`scripts/models-dev-baseline.mjs` 读取其 `./snapshot`，按"常用范围"投影出紧凑条目写入 `src/lib/ai/modelCatalog/baseline.generated.json`（提交入库）；同文件头部记录包版本与生成时间。
- 常用范围（建议值，实现时以实测体积校准）：连接器对应 provider（`deepseek`、`aihubmix`、`xiaomi`、`openai`）全量 + 原厂 provider（`anthropic`、`google`、`xai`、`mistral`、`alibaba`/`qwen`、`zhipu`、`moonshot`、`minimax` 等）中**近 18 个月发布**的模型；排除 `status` 为已弃用者与非文本类型。目标：压缩后 ≤ 约 400 KB，按需懒加载为独立 chunk，不进主 bundle。
- `scripts/models-dev-baseline.mjs verify`（脚本名 `models-dev:verify`）：重新投影并与已提交文件比对，包版本不一致或内容漂移则失败；CI 里用它替换 `model-bank:verify`。**升级包版本是显式动作**，固定在每次发版前执行（升到最新精确版本 → 运行 `models-dev:baseline` → `models-dev:verify` → 提交，提交说明记录包版本），发版之间不自动升级。该步骤应写进发布文档 `docs/desktop-distribution.md` 的发布清单。

## 4. 运行时目录与查询

- `modelCatalog/store.ts`：内存中持有当前 `CatalogSnapshot`。`initModelCatalog()` 在应用启动、首个 agent 运行之前异步完成：读取 `deviceSettings` 键 `modelCatalog` 的已同步快照（版本 + schema 校验 + 体积检查），读取失败或校验不过则懒加载基线 chunk。启动中的短暂空窗期查询返回"未知"，不抛错。
- 查询 API 保持**同步**：`lookupModel(connector, modelId)` 返回 `{entry, tier: "provider" | "origin" | "canonical", price?: {…, reference: boolean}}`，供现有的 `getModelBankEntry`/`resolveModelMetadata`/`resolveContextCapacity`/`visionCapability` 调用方改道；事务内调用点读取内存。

### 匹配（R2）
1. 层 1：同 provider 精确 id。连接器→provider 对照表静态定义在 `modelCatalog/connectorProviders.ts`：`deepseek→deepseek`、`aihubmix→aihubmix`、`mimo→xiaomi`、`openai-compatible→openai`；`openai-compatible` 在用户改 baseUrl 时，用 provider 的 `api` 字段（203/228 个 provider 带有）按 origin 匹配；`apimart` 无对应，直接到层 2。
2. 层 2：原厂 provider 精确 id；价格带 `reference: true`（界面标"官方参考价"）。
3. 层 3：`canonicalId` 分组且各候选的相应字段一致才采用；否则未知。**价格不取层 3**。
4. 同层多候选冲突：上下文/输出取最小（对应 `modelMetadata.ts:42-53` 先例），视觉冲突视为未知。
5. 大小写不折叠、无别名（维持现有行为），除层 3 的 `canonicalId`。

## 5. 同步

- 触发只来自界面按钮。`modelCatalog/sync.ts`：`syncModelCatalog(selection, {signal, fetchImpl})`：
  1. 经 `runtimeFetch` 以新 purpose `model-catalog` 请求 `https://models.dev/api.json`（GET、无鉴权头、总超时 60 s、体积上限 8 MiB，高于 4 MiB 的 `MAX_JSON_BYTES`，独立常量）。
  2. 响应解析为 JSON 后用 zod 校验（只校验用到的字段，容忍未知字段，条目级失败丢弃该条而不是整体失败；整体结构不符则失败）。
  3. 按 `selection`（自动包含常用 + 手选，归一化 id 去重：`canonicalId ?? lowercase(id 去前缀)`）投影为 `CatalogEntry`，写入 `deviceSettings` 键 `modelCatalog`（值 `{v:1, syncedAt, source, entries}`，单行上限 2 MiB，超限则丢弃最旧发布日期的条目并提示，仍超限则失败并回退）；写入是单次事务，失败保持原快照。
  4. 成功后更新内存快照并通知订阅者（`useSyncExternalStore`）；失败保持原快照并返回友好错误。
- 一次性解析 5.6 MB 的尖峰：使用 `Response.json()` 后立刻逐 provider 投影并释放原对象；`AbortSignal` 贯穿；界面上"同步中"可取消。
- 选择清单 `CatalogSelection` 存 `deviceSettings` 键 `modelCatalogSelection`。

## 5b. `deviceSettings` 表

- 形状：`{key: string (主键), value: unknown (自由形 JSON), updatedAt: string}`；作用域为设备本地（checkpoint 里以 `device` 标签表达，不上云）；不进项目包。
- Dexie：`browserDatabase.ts` 新增 `version(25)`，声明该表（主键 `key`）；SQLite 经通用 `product_records`，由 `schema.json` 白名单放行。
- API：`src/db/deviceSettings.ts`：`getDeviceSetting<T>(key, parse)`、`putDeviceSetting(key, value)`、`deleteDeviceSetting(key)`；读取一律经调用方提供的校验函数，损坏返回 `undefined`，不抛错。
- 表数量断言：三处写死 49 的位置改为从 `schema.json` 读取表数量；若某处（如 Rust 测试）无法安全推导，保留并记录原因。
- 以后新增同类设备本地状态：新增键 + 校验函数即可，不必再改 schema。

## 6. 网络放行（R3）

- `src/lib/runtimeHttpPolicy.ts`：新增 purpose `model-catalog`，规则：协议 https、主机固定 `models.dev`、路径固定 `/api.json`、方法 GET、无 `Authorization`/`Cookie` 等头、独立体积上限；`runtimeFetch.ts:262-268` 分派到新实例；重定向每一跳由 `runtimeFetch.ts:234` 重新授权，自动复检。
- Rust 无需改：`https://models.dev` 通过 `validated_origin`；路径与用途限制只在 JS 层。**CSP 与打包版实际可达性须在真实 Tauri 窗口验证（A10）**，若被挡，回到规划。
- 更新 `native-product-runtime.md` 相关条目（`:45,144-160`）并新增测试。

## 7. 界面

- `/connectors`：左侧导航新增「模型目录」（沿用现有 `section` 状态）。内容：
  - **同步卡片**：来源与版本、上次同步时间与结果、模型数量；按钮「选择模型」「立即同步」（同步中变为「取消」）、「…」菜单「恢复为内置数据」（删除 `deviceSettings` 中的 `modelCatalog` 键，回到基线）。
  - **选择对话框**：自动包含常用模型开关（显示数量）、供应商下拉、搜索、「全选筛选结果」「清空」、已选数量；每行名称/供应商/发布日期/ID 与四种价格；按归一化 id 合并重复；使用虚拟化列表（沿用项目里已有的列表方案；若无，使用分页，上限 200 行/页，避免一次渲染 8,800 行）。数据源：对话框打开时若无完整目录，提示"需要先同步一次"，或使用基线条目作为可选范围（基线只含常用范围，全量可选清单需要先同步一次再列出）——**此取舍见 §10 待确认**。
  - **只读定价表**：当前已加载条目，搜索筛选，单位 USD / 每百万 Tokens，未知显示"—"。
- `ModelSelectTrigger.tsx` 详情栏新增「价格 · USD / 每百万 tokens」：输入/输出/缓存命中/缓存创建，未知"价格未知"，`reference` 标"官方参考价"，并标注来源条目；`Model Bank` 文案（`:55,59,74`、`contextPolicy.ts:26`）改为"模型目录"。行内价格暂不做。
- 友好错误：同步失败使用统一出口（`ui-error-handling` 若已落地则对接；否则 `toast.error` + 明确原因文案），原因分类：网络不可达、超时、响应过大、格式不符、已取消。

## 8. 统计口子（R6）

- `AgentRun.modelPricing?: {source: "baseline"|"synced"; provider: string; modelId: string; reference: boolean; currency: "USD"; unit: "per_million_tokens"; input?: number; output?: number; cacheRead?: number; cacheWrite?: number; capturedAt: string}`，在 `beginAgentRun` 创建运行时一并写入（行是自由形 JSON，无需 schema 变更；做法同 `visionCapability`）。
- `modelCatalog/cost.ts`：`estimateRunCost(usage, pricing): {amount?: number; complete: boolean}`，缓存读写按各自单价，缺失单价 → `complete: false`，不当作 0。
- `AgentVisionCapability.source` 联合新增 `"models-dev"`，保留 `"model-bank"`（旧记录读取兼容，无分支依赖）。

## 9. 退役（R7）

删除 `vendor/lobehub`、`scripts/model-bank-snapshot.mjs`、`src/lib/ai/modelBank/`（含两个生成 JSON 与 README）、`package.json` 的 `model-bank:*`、`ghcr.yml:44-45` 步骤、`knip.json:5`；迁移 `modelMetadata.ts`、`reasoningPolicy.ts`、`visionCapability.ts`、`agentContextPreview.ts`、`referenceInput.ts` 到新目录 API；重写 `tests/modelBank.test.ts`（改为目录与匹配测试）、更新 `tests/agentReferences.test.ts:60-62`。

## 10. 待用户在最终计划中确认的设计建议

1. **存储：新增通用设备本地键值表 `deviceSettings`**（用户已确认；理由见 PRD R4）。代价：旧的原生开发工作区无法打开，升级前先用项目备份导出，升级后导入。
2. **选择对话框的可选范围**：基线只含"常用范围"，全量约 8,800 条的可选清单需要用户先同步一次才能浏览？还是同步时同时缓存一份"轻量全量索引"（provider/id/name/发布日期，不含价格，约 600 KB）用于对话框浏览？建议：**同步一次后才出现全量清单**，首次进入对话框提示"先点立即同步获取完整清单"，避免多存 600 KB 索引。
3. **运行记录记录价格快照**（可选字段，无 schema 变更），让将来看板能算历史成本。
4. **价格层级**：价格只用同 provider 或原厂 provider，原厂价标"官方参考价"；跨 provider 一致也不出价。
5. **基线常用范围**：近 18 个月 + 连接器对应 provider 全量，体积目标约 400 KB（压缩后）。

## 11. 回滚

- 分三阶段提交（数据层 → 网络与界面 → 退役清理），任一阶段可独立回退；退役清理最后做，保证前面阶段中新旧并存时可对比。
- 持久化变化：新增表 `deviceSettings`（及 `AgentRun` 的可选字段）。回滚新增表同样会使在新 schema 下创建的原生工作区无法被旧 schema 打开；因此**表的新增放在阶段 1 单独提交**，并在合入前完成真实窗口验证，之后才进入后续阶段。
