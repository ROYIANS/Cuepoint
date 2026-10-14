# Research: Models.dev 同步 - 存储 / 网络放行 / 界面落点 / 统计口子 / 匹配规则

- **Query**: 见任务说明 5 个问题（存储、网络放行、界面落点、价格与统计口子、匹配规则）
- **Scope**: internal（含一次 `curl https://models.dev/api.json` 用于估算体积）
- **Date**: 2026-10-13
- 约定：【事实】= 读到的代码/规范/实测；【推断】= 由事实推出，未验证。

---

## 1. 存储：同步结果放哪里

### 1.1 现有存储事实

- 浏览器端 Dexie，原生端 SQLite，二者经同一 `ProductStore` 接口（`src/lib/storage/types.ts:57`，`ProductStore = StoreApi & {[N in TableName]: StoreTable<...>}`）。`src/db/database.ts:12-23` 按 `getProductStorage().storage` 选 owner，启动时固定。【事实】
- 表是**封闭注册表**，共 49 张：`src/lib/storage/schema.json`（version 1，scope 统计 content 32 / mixed 14 / device 3）。device 表仅 `connectors`、`searchConnections`、`connectorAliases`。`agents` 是 `mixed`、无索引、单例（`GENERAL_AGENT_ID`）。【事实】
- scope 标签含义（`.trellis/spec/frontend/shared-product-storage.md:88-95`）：`content/device/mixed` "describe future projection requirements; they do not make the database safe for raw cloud synchronization"，且 "This task supplies no cloud provider or sync codec"。【事实】
- `checkpoint-protocol.md:5`：checkpoint 只实现 `cuepoint.protocol-fixture.v1`，"There is no user-facing sync"，project/media 记录是"disposable protocol projections"；`:11/:13` 未知字段/凭据"不能经通用原始 JSON 导出进入"。即目前没有任何真实云同步 / 备份管线会读到新表。【事实】
- 项目包（`src/lib/projectPackage.ts`、`src/lib/packages/*`）按项目 ID 导出，grep 不到 `db.agents` / `db.connectors` / `db.searchConnections`，即全局应用级表天然不进项目包。原生 `desktop/tauri/src-tauri/src/backup.rs` 是旧 schema-4 "reference lane"（`native-workspace.md:42`），不是 full product store。【事实；"天然不进"为按 grep 结果的判断】

### 1.2 是否已有适合"全局、非项目、非密钥"的表

| 候选 | 现状 | 判断 |
|---|---|---|
| `agents`（单例 `general`，`mixed`） | `AgentConfig`（`src/domain/agent.ts:8-18`）已有可选字段 `generationPreferences`、`contextPolicy`、`enabledSkillIds`、`skillDefaultsVersion`；`updateGeneralAgentConfig`（`src/db/agentSettings.ts:55-65`）与 `saveGenerationPreference`（`src/db/generationPreferences.ts`）都是"读 agent 行 -> `db.agents.update`"。新增可选字段不需要 Dexie 版本或 SQLite 变更（行是自由形 JSON）。 | 可行但**不适合放整库子集**：该行在每次建 run 的事务里被读（`agentSettings.ts:9` 注释 "May also run in the transaction that creates a run"），塞 100KB+ 会拖大热路径；`mixed` 标签未来会被当作可投影内容。适合放"用户选择的模型 id 列表 + 开关 + 上次同步时间"这类**小偏好**。 |
| `searchConnections`（`device`，主键 `id`，无索引，`SearchConnection` 类型固定 `id:'tavily'`，`src/domain/search.ts:2-9`） | 类型是 tavily 专用且含 `apiKey` | 语义不符，不应复用。 |
| `connectors` / `connectorAliases` | 含 apiKey，连接器专用 | 不应复用。 |
| `localStorage` | 仅用于两个 UI 偏好：`topicGrouping.ts:18/28`、`FloatingComposer.tsx:237/466`（键 `cuepoint.agent.sendShortcut`）。spec 未规定其用法（grep `.trellis/spec/frontend/*.md` 无相关约束） | 体积配额约 5MB 且为同步 API，不适合 100KB+；两运行时 origin 不同数据互不共享；不进 `ProductStore` 事务。可用于"自动包含常用模型开关"这类 UI 偏好，但不适合同步数据。【推断】 |
| 通用 kv/settings 表 | **不存在** | - |

结论【事实】：没有现成的"全局应用设置/缓存"表；`agents` 单例行是现有"全局设置"的承载方式。

### 1.3 新增一张表的改动面与成本

需要同时改的位置【事实，按 grep/读代码】：
1. `src/lib/storage/schema.json` 与 `src/lib/storage/schema.ts`（两份必须逐字等价：`tests/helpers/sharedStorageCases.ts:16` 断言 `schema.tables` toEqual `PRODUCT_SCHEMA`）。
2. `src/lib/storage/tableTypes.ts`：`ProductRows` 加条目（现 `:34-97` 区间）。
3. `src/lib/storage/browserDatabase.ts`：Dexie 类属性（如 `:104` 的 `connectorAliases!: Table<...>`）+ 新 `this.version(25).stores({...})`（当前最高 `version(24)`，`:311`）。
4. 表计数断言 3 处：`tests/helpers/sharedStorageCases.ts:15`（`toHaveLength(49)`）、`desktop/tauri/src-tauri/src/full_product_store/registry.rs:38`（`assert_eq!(value.tables.len(), 49)`）、`desktop/tauri/src-tauri/src/full_product_store/tests.rs:122`；另 `shared-product-storage.md:52` 文字 "closed 49-table"。
5. `tests/fixtures/shared-storage/nativeOwnerAssertions.json`（按表列出 owner 断言，如 `connectors/connectorAliases` 条目 `:43-58`）和 `nativeAcceptanceSuites.json`：新业务命令需要补一条 owner 断言。
6. Rust 侧**无需手写 DDL/命令**：SQLite 是通用的 `product_records(table_name,row_key,payload TEXT,...)`（`full_product_store/mod.rs:32`），表白名单由 `include_str!(schema.json)`（`registry.rs:30`）驱动；`product_store_request` 命令通用。
7. 数据命令模块（如 `src/db/modelCatalog.ts`）+ 单测。

**关键风险【事实】**：原生打开已有工作区时校验 `registry_hash != digest(REGISTRY_JSON)` -> 返回 `"Unsupported full-product workspace format"`（`mod.rs:217-232`），且 `SCHEMA` 固定为 1，没有迁移路径。因此**对 `schema.json` 的任何改动（新增表、甚至新增索引）都会让既有原生工作区无法打开**。规范允许这样做："Fresh development is the default; no old-data migration/backfill/import reader or compatibility strategy is authorized without an explicit request"（`native-product-runtime.md:13-14`）。`git log -- src/lib/storage/schema.json` 仅 1 个提交（`6375117b`）。Dexie 侧不受影响（`version(25)` 加表即可，旧库平滑升级）。

成本评价【推断】：浏览器侧小；原生侧"代码零 Rust 改动"，但会使开发期已建原生工作区作废，需用户确认该代价。

### 1.4 体积估算（2026-10-13 实测 `api.json`）

对 `https://models.dev/api.json`（5,598,412 B）的全部 8,781 条 provider-model 记录，投影为紧凑条目（`id,name,release_date,last_updated,reasoning,tool_call,attachment,limit,modalities,cost,canonical_model_id`，紧凑 JSON）：

- 总计 3,237,973 B（约 3.2 MB）；中位 359 B；p99 585 B；最大 669 B。
- 含阶梯价（`cost.tiers`/`context_over_200k`）的 639 条；没有 `cost` 的 454 条；`cost` 键出现次数：input/output 8327、cache_read 5682、cache_write 1870、tiers 639、context_over_200k 526、reasoning 153、input_audio 131、output_audio 16。
- 精选 N 个模型约 `N x 0.4 KB`：100 个约 40 KB，300 个约 120 KB，1000 个约 400 KB（含 id 键与存储包装，上限可取 2 MB 做硬上限）。【推断，基于上述实测】
- 内置基线（`@opencode-ai/models/snapshot` 6.85 MB）不在存储里，在代码包里。

### 1.5 本地文件方案（类 CC Switch）的可行性

- 原生：现有 Tauri 插件只有 dialog/http/opener（`Cargo.toml:24`；`capabilities/main.json:6` 无 fs 权限）；需要新增 Rust 命令（并进 `build.rs:20/39` 命令清单、`capabilities/main.json` 权限、`permissions/autogenerated/*.toml`）才能读写应用数据目录。已有 `product_binary_*` 命令服务于媒体二进制，语义是"行引用的二进制"（`"binary"` EncodedValue，`protocol.ts:11`），不是自由文件。【事实 + 推断】
- 浏览器：没有稳定的"本地文件路径"概念；只能 OPFS / File System Access / 下载，无法做"显示数据文件路径/打开目录/重新加载"。【推断】
- 两运行时行为不一致，且绕开 `ProductStore` 事务/owner 约束（`shared-product-storage.md` 的"one fixed authoritative owner"）。成本最高。

### 1.6 方案排序（推断）

- **S1：`agents` 单例行加可选字段，仅存"小偏好"**（选中的模型 id 列表、"自动包含常用模型"开关、上次同步时间/结果）。沿用 `generationPreferences` 模式，无 Dexie 版本、无 `schema.json` 变更、不使原生工作区失效。**不适合承载条目快照**（见 1.2：该行在建 run 事务内被读取）。
- **S2：新增 `device` 表（如 `modelCatalogSyncs`，固定主键 `models-dev`），一行 = `{id, fetchedAt, etag?, selection[], entries[], status}`**（约 40-400 KB，上限可设 2 MB）。scope 语义最干净（非项目、非密钥、不入项目包、未来投影可整体排除）；成本见 1.3 的 7 项，并使既有原生开发工作区因 registry hash 变化而无法打开（规范允许，`native-product-runtime.md:13-14`）。
- **S3：条目快照放 `agents` 行可选字段**（零 schema 变更）。缺点：该行在 run 创建事务内被读；`mixed` 标签；原生 `payload TEXT` 每次整行读写。快照控制在 100-200 KB 内可接受但会拖大热路径。
- **S4：本地文件**（OPFS / 新增 Tauri 命令）：见 1.5，两运行时不一致、最高成本，不推荐。

综合排序：若接受 schema 变更 -> S2（+ 小偏好也放在同一行，不需要 S1）> S1(偏好) + S3(快照) > S4。若不接受 schema 变更 -> S1 + S3。

### 1.7 "不在备份/项目包/云同步 checkpoint 中"的归属
- 项目包：按项目导出，不含全局表（见 1.1）。【事实】
- checkpoint：目前仅 fixture，完整 49 表 codec 未实现（`checkpoint-protocol.md:5`、`:Tests 段 "all 49 durable table codecs"`）；未来投影需要逐表评审，用 `device` 标签可明确"设备本地、不上云"。【事实 + 推断】
- 同步快照是公开目录数据、可重新拉取，无需备份；`selection` 与偏好才是用户数据。【推断】

---

## 2. 网络放行：把 models.dev 目录同步加入放行

### 2.1 现有放行链路（事实）

JS 侧（`src/lib/runtimeFetch.ts`）：
- `createRuntimeFetch(services, scope)`（`:222-245`）：非原生或非 http(s) 输入走 `webFetch`（`:225`）；原生时**每一跳**都调用 `services.authorize(url, method, headers, body, scope)`（`:234`）-> `services.grant(origin, allowHttp)`（`:236`，IPC `authorize_http_origin`，`:252-259`）-> `sendNative`（`maxRedirections: 0`、`connectTimeout: 30_000`，`:138-141`）-> 手动跟随重定向最多 5 跳（`MAX_REDIRECTS`，`:7`、`:166`），跨 origin 剥离鉴权头（`:147-150`）。
- `runtimeFetchFor(purpose)`（`:265-268`）只认三个 purpose：`configured`（默认）、`result-download`、`search-probe`。
- 原生请求走官方 `@tauri-apps/plugin-http`（Rust 侧发起），**绕过 WebView CORS 与 CSP `connect-src`**（`native-product-runtime.md:142`："Official requests bypass WebView CORS, not the application policy"）。

策略（`src/lib/runtimeHttpPolicy.ts`）：
- `RuntimeHttpPurpose = "configured" | "result-download" | "search-probe"`（`:1`）。
- `configuredOrigins()`（`:13-24`）= 所有 `db.connectors` 的 `baseUrl.origin` + 已启用且有 key 时的 `https://api.tavily.com`。
- `authorizeRuntimeHttp`（`:27-45`）按分支：`result-download` 要求 `GET`、无 body、无 `authorization/proxy-authorization/cookie/cookie2/x-api-key/api-key` 头，且 `http:` 必须是已配置 origin（`:32-36`，**HTTPS 任意 origin 已被放行**）；有 `probeOrigin` 时要求 origin 等于探测 origin 或已配置（`:37-38`）；`search-probe` 要求 origin === `https://api.tavily.com`（`:39-40`）；其它一律要求 `configured`，否则抛 "网络请求地址不属于当前连接配置，请在连接页检查设置"（`:41-43`）。

Rust 侧（`desktop/tauri/src-tauri/src/runtime_services.rs`）：
- `authorize_http_origin`（`:107-135`）：仅接受规范化的精确 origin（`validated_origin`，`:46-76`：不含 userinfo/path/query/fragment；`http` 需 `allow_http`），为 main 窗口动态添加 `http:default` 作用域 `"{scheme}://{host}[:port]/*"`（`origin_scope`，`:93-105`），去重，上限 128 个（`:121-125`），重启前不可撤销。**Rust 不识别"用途"，也不能限制路径，路径约束只能在 JS `authorizeRuntimeHttp` 中做。**
- `https://models.dev` 通过 `validated_origin`（HTTPS，无路径，规范形式）。无需改 Rust。
- `capabilities/main.json:6` 只有命令权限（含 `allow-authorize-http-origin`），没有静态 `http:default` 作用域；`tauri.conf.json:9` `plugins.http.scopeRedirects: true`。

CSP（`desktop/tauri/src-tauri/tauri.conf.json:15`）：
`default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; media-src 'self' blob: http://127.0.0.1:*; worker-src 'self' blob:; font-src 'self' data:; connect-src ipc: http://ipc.localhost 'self'; object-src 'none'; frame-src 'none'; base-uri 'none'`。仓库内没有任何文件含 `models.dev`（grep src/tests/desktop）。

### 2.2 最小改动集合（事实 + 推断）

必须改（均在 JS 层）：
1. `src/lib/runtimeHttpPolicy.ts`：`RuntimeHttpPurpose` 增加一个值（如 `"catalog-sync"`），`authorizeRuntimeHttp` 增加一个分支：要求 `method === "GET"`、`body == null`、无鉴权/cookie 头（沿用 `:34` 的头列表）、`url.protocol === "https:"`、`url.origin === "https://models.dev"`，**且 `url.pathname` 在固定白名单**（如仅 `/api.json`；若要用 `models.json`/`catalog.json` 则列出），无 query（或仅允许固定 query，如 `?type=all`——该参数是否可用尚未验证，见前序调研）。由于 `authorize` 在每一跳都会调用（`runtimeFetch.ts:234`），重定向目标自动被同一规则复检，**不需要额外的重定向逻辑**。
2. `src/lib/runtimeFetch.ts:262-268`：新增一个 `createRuntimeFetch(services, {purpose: "catalog-sync"})` 实例并在 `runtimeFetchFor` 中分派（现为 `result-download` 与 `search-probe` 两个特例）。
3. 调用方：新的同步函数用 `requestOnce(url, {method:"GET"}, {credentials:"omit", redirect:"error"|"follow", signal, runtimePurpose:"catalog-sync"})`（`src/lib/ai/requestBoundary.ts:14-22`，`RuntimeHttpPurpose` 类型自动随联合变化），再用 `readResponseJson(response, limit, signal)` 读取（`boundedResponse.ts:78`）。
4. 规范文本：`native-product-runtime.md:45`（`runtimeFetchFor(purpose?: "configured" | "result-download" | "search-probe")`）与 `:144-160` 的放行描述需更新。

不需要改（事实）：
- Rust `authorize_http_origin` / `validated_origin` / `build.rs` 命令清单 / `capabilities/main.json`：`https://models.dev` 作为动态 origin 授权即可通过（128 个上限内）。
- Tauri CSP `connect-src`：原生请求由 Rust 插件发出，不经 WebView 网络栈；浏览器端 CORS 已允许（前序调研：`access-control-allow-origin: *`）。只有"WebView 内直接 `fetch`/`<img>` 到 models.dev"才会被 CSP 挡，而这条路径不被使用（`runtimeFetch.ts:225` 在原生时不走 `webFetch`）。【推断：未在真实 Tauri 窗口里验证】
- 浏览器 Web 部署若有自己的 CSP（`index.html`/`vite.config.ts` grep 无 `Content-Security`），目前没有 `connect-src` 限制。

**现状的一个重要事实**：`result-download` 目的已允许对任意 HTTPS origin 的无鉴权 GET（`runtimeHttpPolicy.ts:32-36`；规范 `native-product-runtime.md:152-155` "validated HTTPS supplier/CDN origins can be independently granted"）。因此技术上不改策略也能用 `runtimeResultFetch` 取 `https://models.dev/api.json`；但这会让"目录同步"与"签名下载"混用同一放行语义且无路径限制。是否新增独立 purpose 属设计选择。

### 2.3 风险与约束

- **SSRF/重定向**（事实）：每跳都被 `authorize` 复检（`runtimeFetch.ts:232-241`）；原生 `maxRedirections: 0` 由 JS 自己跟随，最多 5 跳；若新分支要求 `url.origin === "https://models.dev"`，则任何跳到其它 origin 的重定向都会在发送前被拒（对比 `configured` 分支的错误 "连接测试重定向到了未配置的地址"）。也可在调用方用 `redirect:"error"`（`runtimeFetch.ts:165` 会抛 "网络请求发生重定向，已按请求策略拒绝"），Tavily 即如此（`tavily.ts:56`）。
- **响应体积上限**（事实）：`MAX_JSON_BYTES = 4 MiB`（`src/lib/resource/limits.ts:4`）**小于** `api.json` 实测 5,598,412 B；`readResponseBytes` 先看 `content-length`，超限直接取消（`boundedResponse.ts:37-41`），逐块再校验（`:63`）。故需要一个专门的上限（例如按 `api.json` 增长留余量；`models.json` 469 KB、`catalog.json` 6.1 MB 可作参照）。数值需设计时决定。
- **超时**（事实）：原生仅 `connectTimeout 30_000`（`runtimeFetch.ts:8,141`），无总时长/空闲超时；总超时与 Stop 由调用方的 `AbortController` 负责，参考 `tavily.ts:40-69`（`setTimeout` -> `controller.abort()`，30s 默认，并转发外部 `signal`）。读取阶段的 `signal` 要传给 `readResponseJson`。
- **AbortSignal**（事实）：`runtimeFetch.ts` 对头部与 body 读取均保留 abort identity（`abortableResponse`，`:175-219`；`sendNative`，`:128-145`）；`pagehide/beforeunload` 会中止所有在途原生请求（`:17-23`）。
- **解析/校验**：不可信 JSON，需 schema 校验与字段白名单、数值范围（推断，现有 `readHttpJson`、`validate.ts` 是已有模式）。
- **128 origin 上限**：models.dev 仅占 1 个；其增加会使"重启前不可撤销"的授权多一条（`runtime_services.rs:121-125`）。

### 2.4 现有测试里"仅放行已配置 origin 与 tavily"的断言（放行变化后需检查/更新的位置）

- `tests/runtimeFetch.test.ts:48-64` 与 `:66-76`：已配置 origin 精确匹配、端口/IPv6、`rejects.toThrow("当前连接配置")` 针对 `http://[::1]:3211`（用例使用 `model.example`、`localhost`，**不使用 models.dev**，加新 purpose 不会破坏）。
- `tests/runtimeFetch.test.ts:78-89`（"permits only scoped unsaved connector and fixed search probes"）：`:84`、`:88` 断言未配置/已禁用时 `https://api.tavily.com/search` 被拒；`:91-102` 断言 result-download 的头/方法/HTTP 限制。新增 purpose 需**新增**用例（允许 `https://models.dev/api.json`、拒绝其它路径/其它 host/带鉴权头/非 GET/重定向到其它 origin），原有断言无需改。
- `tests/runtimeFetch.test.ts:116-165`：重定向用例（每跳未配置即拒、5 跳上限）不受影响。
- `tests/runtimeFetchIntegration.test.ts:49-55`、`:60-91`：断言默认原生路径、草稿连接探测不暴露正常授权、result-download/draft search 走 `nativeFetch`；不涉及 models.dev，保持不变。
- `tests/tavilyNativeProbe.test.ts`（`desktop/tauri/ui/tavilyProbe*.ts`）：独立的验收探针，拒绝其它地址；不受影响。
- 若采取"改 `configuredOrigins()` 把 models.dev 加入全局放行"的方式，则所有 `configured` 默认分支的拒绝断言（`runtimeFetch.test.ts:84,88`、`runtimeFetchIntegration.test.ts:55`）仍不涉及 models.dev，但语义会扩大到任何 `requestOnce` 默认调用——【推断】不宜。
- 规范文档同步：`native-product-runtime.md:45,144-160`、`desktop-distribution.md`（如有 CSP 描述，grep 未命中 connect-src）。

### 2.5 模型 logo 的 `img-src`

- 现有图标全部来自本地 `@lobehub/icons`：`src/components/agent/ModelIcons.tsx`（`ModelIcon`/`ProviderIcon` 懒加载 `ModelIconCatalog`）、`DemandModelIcons.tsx`、生成的匹配表 `ModelIconMapping.generated.ts`（1768 行，"Generated by scripts/e06-icon-data.mjs from @lobehub/icons 5.18.0"，按 `keywords` 匹配）。无远程图片。
- Models.dev 的 `/logos/<provider>.svg` 在桌面端会被 CSP `img-src 'self' blob: data:` 拦截；若要用，需要在 `tauri.conf.json:15` 的 `img-src` 加 `https://models.dev`，同时还有 `native-tavily-regression.mjs:82` 与 `desktop/tauri/scripts/build-app.mjs:38`（验收构建）里的重复 CSP 字符串需要保持一致。【事实：这些文件含 CSP/`img-src`；是否必须一致为推断】
- 结论【推断】：沿用本地 `@lobehub/icons`，不放行 `img-src`，也避免运行时引入远程图片；模型 id 到图标的匹配现已存在，Models.dev 只提供 `provider id`/`canonical_model_id`，可直接喂给现有关键词匹配。

---

## 3. 界面落点

### 3.1 模型选择当前展示什么（事实）

组件链：`FloatingComposer.tsx:413-440`（`ModelSelectTrigger`，`trigger` 为 `ModelSettingsMenu`）<- `AgentChatPage.tsx:595-615`（传入 `modelOptions`、`modelMetadata`、`modelPolicy`）。`ModelSelectTrigger` / `ModelSettingsMenu` 只在 `FloatingComposer.tsx` 里被使用。`AgentControls.tsx`（305 行）不含模型选择，只管权限模式与技能（`:24`、`:98`、`:173` 使用 `updateGeneralAgentConfig`）。

`src/components/agent/ModelSelectTrigger.tsx`（Popover，面板 `agent-model-panel` 宽 `min(640px, 100vw-48px)`、最高 `min(420px,70vh)`，`agentChat.css:96-105`）：
- 左列 `agent-model-list`（`:157-232`）：搜索框（`:158-165`）-> 连接器切换按钮条（`:166-188`，每个连接器一个按钮：`ProviderIcon` + `connectorDisplayName`，apimart 用 `Plug`）-> 行（`:189-229`）。
- **每行只有**：`ModelIcon`（18px，来自本地 `@lobehub/icons`）+ `modelDisplayName(id)`（取最后一个 `/` 后的部分，`modelVendors.ts:82-85`，单行省略）+ 当前选中的 `Check`（`:203-224`）；行按 `groupModelsByVendor(ids)` 分供应商组，组标题 `ProviderIcon` + 名称（`:196-200`）。供应商靠 id 前缀启发（`lookupVendor`，`modelVendors.ts:35`）。
- 右列 `ModelDetail`（`:21-81`，`flex: 0 0 260px`，`agentChat.css:161-168`）：图标 + 名称 + 供应商；`dl` 依次为"上下文上限（来源 供应商/Model Bank）"、"最大输出"、"能力"（视觉识别/工具调用/深度思考；其中工具与思考来自 `inferModelHints(id)` 的**正则启发**，`modelVendors.ts:94-100`；视觉来自 `resolveVisionCapability`）、"图片输入"。来源标签文案硬编码 `"Model Bank"` 三处：`ModelSelectTrigger.tsx:55,59,74`；另 `contextPolicy.ts:26`。
- 模型 id 列表来源：当前连接器探测到的模型 id（`modelCatalog`，`chatModelPolicy.ts` `buildChatModelOptions` 仅做去重/过滤/排序，`:57-70`）；`ModelSettingsMenu`（`ModelSettingsMenu.tsx`）是触发器下拉：推理强度 + "更换模型"。
- 行内没有价格、没有上下文长度、没有能力徽标。

### 3.2 价格放哪里最自然（推断，基于上面结构）
- **详情栏 `ModelDetail`**：新增一项 `<div><dt>价格 · USD / 百万 tokens</dt><dd>输入 x / 输出 y / 缓存读 z</dd></div>`，与"上下文上限""最大输出"同一 `dt/dd` 样式，宽度 260px 足够多行展示；阶梯价/缓存写价可作为次行。无需改行布局。来源标注沿用既有 `· 供应商 / Model Bank` 位置的模式（改成 Models.dev/内置基线 + 同步时间）。
- **行内**：行是单行名称且面板宽度受限（左列 `flex 1 1 320px`），若要展示价格只宜在名称右侧放一段小号次要文字（如 `$2 / $12`），且小屏（`@media (max-width:600px)`，`agentChat.css:1345`）会变为纵向。属可选增强。
- 单位：Models.dev 的 `cost` 本身为 USD/百万 token（前序调研）；与 CC Switch 参考图一致。未知价格：`cost` 缺失（实测 454/8781 条）-> 显示"价格未知"/省略，不要显示 0（`AgentTokenUsage` 注释已有"absence is unknown, never zero"原则，`agent.ts:131`）。`cost.input/output` 为 0 的免费模型需与"未知"区分。阶梯价（`tiers`/`context_over_200k`，实测 639/526 条）在紧凑展示里用"起"或附加标注。
- 价格是**按提供方**的：同一模型不同网关价格不同（实测 1171 个跨 provider 的 id 中 963 个 `cost` 不一致），所以展示价格必须带"来自哪个 provider 条目"；连接器无对应 provider 时只能给"官方参考价"（见 5）。

### 3.3 "同步卡片 + 选择模型对话框"放哪个页面

候选页面当前结构（事实）：

- `/connectors`（`src/routes/_studio.connectors.tsx` -> `ConnectorsPage`，394 行）：`ModuleLayout` 左侧导航 `h2.module-nav-heading "连接与模型"` + 两个 `module-nav-item` 按钮（`section` 状态 `"models" | "search"`，`ConnectorsPage.tsx:36`、`:240-243`：模型连接 / 网络搜索连接）；右侧 `PageContent` + `PageHeader title="连接与模型"`（描述："密钥仅保存在本机…不会写入项目备份 ZIP。具体聊天用哪个模型，在 Agent 对话里选择。"，`:245-248`）；`hidden={section !== ...}` 方式切换内容；模型连接区是 `CONNECTOR_CATALOG` 逐行 `section`（头像 + 标题 + 状态 Badge + 编辑/安装按钮，`:249-296`）；网络搜索区是 `SearchConnection`（`src/components/studio/SearchConnection.tsx`，103 行，`section.mt-6 aria-label="联网搜索"`，标题 + 描述 + 配置按钮 + Dialog）。底部有连接编辑 `Dialog`（`:300-`）。侧栏入口 `AppFrame.tsx:21` "连接与模型"。
- `/settings`：**无页面**，`_studio.settings.tsx` 直接 `redirect({to:"/about"})`；侧栏"设置"入口（`AppFrame.tsx:22`）激活条件含 `/settings` 与 `/about`。
- `/about`（`AboutPage.tsx`，121 行）：`PageHeader "关于小光点"`，logo/版本、"支持小光点"区（`section aria-labelledby="support-heading"`，`:66-`）、"数据与隐私"区（`:109-`）。无设置性控件模式。

建议【推断】：放在 **`/connectors` 页新增第三个导航项**（如"模型库"/"模型目录"），与"模型连接""网络搜索连接"并列。理由：(1) 该页已是"连接与模型"，导航项增加零成本（复用 `section` 状态与 `module-nav-item`）；(2) 它已有"同步类设置卡片 + Dialog"的现成模式（`SearchConnection`）；(3) 该页已承载"联网"相关配置，网络放行文案（"仅在点击同步时联网"）放这里与"密钥仅保存在本机"同语境；(4) 设置页目前只是 About 的重定向，没有设置布局。另需注意该页 `PageHeader` 文案"具体聊天用哪个模型，在 Agent 对话里选择"仍成立。对话框 `DialogContent` 的现有模式可参考 `:300-` 的连接编辑 Dialog（`showCloseButton={!saving}`，保存期间锁定 Esc/外部点击）。

---

## 4. 价格与统计口子

### 4.1 现有 run 记录里的用量字段（事实，`src/domain/agent.ts`）
- `AgentTokenUsage`（`:132-137`）：`cachedInputTokens?`、`inputTokens?`、`outputTokens?`、`totalTokens?`；注释 "Provider-reported counts only; absence is unknown, never zero"。解析自 `chatStream.ts:201-202`、`responsesStream.ts:47-48`（`cached_tokens`）。**没有** cache-write、reasoning、音频 token 字段。
- `AgentModelMetrics`（`:139-145`）：`step`、`startedAt`、`firstTokenAt?`、`endedAt`、`usage?`（每个模型步骤一条，存于 `AgentRun.modelMetrics`，`:201`）。
- `AgentRun`（`:173-`）：`model: string`（发送给供应商的 id，`:195`）、`connector: Pick<ConnectorConfig,"id"|"definitionId"|"baseUrl">`（`:205`）、`usage?`（run 累计，`:203`；累计逻辑 `src/db/agentRuns.ts:274` 对四个字段求和）、`outputTokensPerSecond?`、`createdAt/updatedAt/endedAt`（`:226-228`）、`reasoningEffort?`、`protocol?`、`visionCapability?`（`:174`）、`context?.capacity/capacitySource`（`ContextSnapshot`，`src/domain/context.ts:19-23`）。
- 已足够计算"某时间段内某连接器/模型的 token 数"；**不足**：无价格、无 catalog 条目标识、无 cache-write/reasoning 用量。

### 4.2 将来统计看板要算历史成本，最小需要记录什么（推断）

| 方案 | 记录内容 | 持久化影响 |
|---|---|---|
| P0 仅事后估算 | 不新增字段；看板用 `run.model` + `run.connector.definitionId` + `run.usage`/`modelMetrics[].usage` 按**当前**目录价格估算 | 零持久化变更；历史成本会随目录同步而漂移，且按子集同步时被取消选择的模型历史价格丢失 |
| P1 最小快照（推荐讨论） | 在 `AgentRun`（或每个 `modelMetrics` 项）上新增可选 `pricing?: {source: "models-dev" | "builtin"; providerId; modelId; catalogRevision/fetchedAt; unit:"usd-per-1m"; input?; output?; cacheRead?; cacheWrite?}`，创建 run 时（与现有 `visionCapability` 在事务前解析同理，见 `agentRuns.ts:71`）写入一次 | `AgentRun` 是自由形 JSON：新增可选字段**不需要** Dexie 版本号或 SQLite/`schema.json` 变更（同 `visionCapability?` 的加字段方式）；每 run 约数百字节；老 run 缺该字段按 P0 估算 |
| P2 仅记录标识 | `catalogEntryRef: {providerId, modelId, revision}` | 同上无 schema 变更；但要求目录保留历史修订，否则无法回算 -> 实际仍需 P1 |

补充：价格在阶梯上取决于单次请求的输入 token（`context_over_200k`），每步 `modelMetrics[].usage.inputTokens` 已存，因此 P1 只需快照价格表，不需额外用量字段；cache-write / reasoning 若要精确计价需在 `AgentTokenUsage` 与两个流解析器里新增字段（也是可选字段，无 schema 变更，但属于解析器改动）。

### 4.3 `AgentVisionCapability` 的 `"model-bank"` 字面量

定义：`src/domain/referenceInput.ts:44-48`（`source: "provider" | "model-bank" | "unknown"`）。持久化位置：`AgentRun.visionCapability`（`agent.ts:174`），在 `src/db/agentRuns.ts:71,133,150` 创建/重试时写入并沿用（`previous?.visionCapability ?? visionCapability`）。

所有读取点（grep 全 `src`）【事实】：
- `src/lib/ai/visionCapability.ts:10-12` `requireVision`：只读 `capability?.supported` 与 `source === "unknown"`。
- `src/lib/agent/imageQueue.ts:27`、`src/lib/ai/referenceWire.ts:33`、`src/db/agentRuns.ts:133`：只透传给 `requireVision`。
- `src/lib/agent/runChat.ts:297`、`contextCompaction.ts:136`、`ai/chatStream.ts:34`：透传 `run.visionCapability`。
- UI：`ModelSelectTrigger.tsx:74` 通过 `vision.source === "provider" ? "供应商" : "Model Bank"` 显示；该处读的是现算结果而非存储值。
- **没有任何读取点按 `"model-bank"` 做分支**；存储层也无 `"model-bank"` 校验（`src/lib/storage` grep 无命中）。
- 写入点：`src/lib/ai/modelBank/index.ts:78`（`source: "model-bank" as const`，`getModelBankVision`）。
- 测试：`tests/agentReferences.test.ts:60-62` 期望 `{supported: true, source: "model-bank"}`；`tests/modelBank.test.ts`（LobeHub 专属）。
- 另一个同名字面量 `ModelLimit.source: "provider" | "model-bank"`（`modelMetadata.ts:12`）不持久化；`ContextSnapshot.capacitySource` 是**显示字符串**（`"供应商"|"Model Bank"|"本地预算"`，`contextPolicy.ts:23,26`），**会被持久化**到 `AgentRun.context` 并在 `ContextUsagePanel.tsx:98` 原样显示——老记录里的 `"Model Bank"` 文本会继续显示，不影响功能。

兼容做法【推断】：(a) 联合类型保留 `"model-bank"` 作为历史值并新增新来源（如 `"models-dev"`/`"builtin-catalog"`），新代码不再写 `"model-bank"`，读取点无需改动；(b) 或继续沿用 `"model-bank"` 作为"内置目录"语义，零迁移；两者都不需要存储迁移，因为没有读取点分支且存储是自由 JSON。需要同步更新的仅 UI 文案三处与测试断言（`agentReferences.test.ts:61`）。

### 4.4 同步异步性约束（事实）
`getModelBankEntry` 与 `resolveModelMetadata` 是**同步**函数（`modelBank/index.ts:19-42`、`modelMetadata.ts:18-37`），被渲染路径（`ModelDetail`，`ModelSelectTrigger.tsx:26`）、`resolveContextCapacity`（`contextPolicy.ts:21`；调用于 `db/agentRuns.ts:122` 事务内、`agentContextPreview.ts:75`、`taskWrapup.ts:50`、`ContextUsagePanel.tsx:92`）和 `reasoningPolicy.ts:53` 使用；视觉能力 `getModelBankVision` 是异步且在事务**之前**解析（`agentRuns.ts:71`，`agentContextPreview.ts:117` 注释 "External model-bank preparation finishes before the final coherent IndexedDB read"）。若运行时同步结果存于 DB，同步函数需要一个已加载到内存的快照（或把调用点改为异步并保持"事务前解析"顺序）。

---

## 5. 匹配规则

### 5.1 连接器 -> Models.dev provider 对照表（建议；基于 2026-10-13 `api.json` 实测）

连接器定义：`src/lib/ai/catalog.ts:15-62`（`openai-compatible`、`deepseek`、`apimart`、`aihubmix`、`mimo`）；`ConnectorConfig` 有 `baseUrl`（用户可改）与 `definitionId`（`domain/types.ts:524-534`）。

| 连接器 definitionId | 默认 baseUrl | Models.dev provider | 说明（实测） |
|---|---|---|---|
| `deepseek` | `https://api.deepseek.com/v1` | `deepseek`（4 个模型，`api: https://api.deepseek.com`） | 直接对应；模型 id 如 `deepseek-v4-pro`；注意 `deepseek-chat` **不在**该 provider（`deepseek-chat` 在其他 provider 里出现，仅 `nano-gpt` 为 128000/8192） |
| `aihubmix` | `https://aihubmix.com/v1` | `aihubmix`（152 个模型，无 `api` 字段，npm `@aihubmix/ai-sdk-provider`） | 直接对应；价格应取该 provider 条目（网关定价） |
| `mimo` | `https://api.xiaomimimo.com/v1` | `xiaomi`（9 个，`api: https://api.xiaomimimo.com/v1`，与默认 baseUrl 完全一致） | 另有 `xiaomi-token-plan-{cn,ams,sgp}`，不是同一入口 |
| `apimart` | `https://api.apimart.ai/v1` | **无**（228 个 provider 的 id/name 中无 apimart） | 走"无对应 provider"策略 |
| `openai-compatible` | `https://api.openai.com/v1`（用户可改为任意网关/代理/本地） | 默认 `openai`（53 个，无 `api`）；其它需按 baseUrl 匹配 | 该连接器语义是"任意兼容服务"；仅 `definitionId` 不足以确定 provider |

可复用的信息【事实】：228 个 provider 中 203 个带 `api`（base URL），含 `deepseek`、`xiaomi`、`openrouter`、`siliconflow`、`moonshotai`、`zhipuai`、`alibaba` 等；但 `openai`、`anthropic`、`google`、`xai`、`mistral`、`aihubmix` 等 `api` 为空（SDK 内置）。因此"按连接器 baseUrl 匹配 provider.api"能覆盖 `openai-compatible` 指向 deepseek/openrouter/siliconflow 等的场景，但 `openai` 仍需一条静态规则（`api.openai.com`）。【推断：规则是否采用需设计阶段确认】

### 5.2 没有对应 provider 时的匹配策略（建议选项）

实测冲突率（`api.json`，全部 provider）：

- 4,024 个不同模型 id，其中 1,171 个出现在多个 provider；这 1,171 个里 **762 个**（65%）`(context, output)` 不一致；出现在 >=3 个 provider 的 717 个 id 里 **560 个**（78%）不一致；视觉输入（`modalities.input` 含 `image`）不一致的 129 个；`cost` 不一致的 963 个。
- 例子：`deepseek-v4-pro` 在 28 个 provider：`(1000000, 384000)` x15、`(1000000, 393216)` x2、`(1000000, 131072)` x2、`(1048576, 65536)` x1…；`claude-sonnet-4-6`（22 个 provider）输出 64000 x17 / 128000 x2 / 16384 x1，上下文 1,000,000 与 200,000 并存；`gpt-5` 13 个 provider 全部 `(400000,128000)` 一致；`gemini-2.5-pro` 15 个：`65536` x12 / `65535` x2。
- 带 `canonical_model_id` 的记录 5,913 条（510 个规范 id），无规范 id 的 2,868 条；按规范 id 分组后 **309/510** 组限制值不一致（如 `deepseek/deepseek-chat` 6 条：128000/8192、163840/16384、1000000/384000、131072/384000 并存）。规范 id 能把网关里不同写法的 id（如 `openai/gpt-4o`、`azure/gpt-4o`、`gpt-4o`）归并，但**不能消除**限制值差异。

策略选项【推断】（按"同 provider 优先 -> 官方 provider -> 其它"的层级）：
1. **同 provider 精确 id**（连接器映射到的 provider）：采用；价格也只用这一层。
2. **未命中则退回"原厂 provider 精确 id"**（沿用现有 `originalVendors` 白名单思想，`modelBank/index.ts:12`、`:29-33`）：Models.dev 里对应 openai、anthropic、google、deepseek、moonshotai、zhipuai、alibaba、xiaomi、xai、mistral 等 provider；限制值可用，价格显示须标注"官方参考价"（网关价格可能不同）。
3. **再退回跨 provider 的 `canonical_model_id` 匹配**：仅在候选限制值全部一致时采用；价格不采用。
4. 其它情况视为未知。

多候选限制值冲突时的合并规则（可选）：
- 保持现有"冲突即未知"（`limitsMatch`，`modelBank/index.ts:19-21`；视觉冲突 -> `{supported:false, source:"unknown"}`，`:50-76`）：在 Models.dev 下**会频繁触发**（跨 provider 的 id 有 65% 冲突），仅第 1、2 层有同 provider/原厂约束时才大幅缓解。
- 取最小值（保守，已有先例：`modelMetadata.ts:42-53` `collectModelMetadata` 对重复供应商行"use the smallest"；对视觉则 `false` 优先，`:52`）：不会超限，但可能低估真实上限；`deepseek-v4-pro` 取最小会得 `(1000000, 65536)`。
- 取多数/众数：对 `claude-sonnet-4-6` 得 64000，但多数可能是转卖网关数据；不确定性高。
- 视为未知：最保守，但 UI 与 `resolveContextCapacity` 会回退到"本地预算/未知"（`contextPolicy.ts:23-26`）。

对现有行为的影响【事实/推断】：
- 现有逻辑只在 LobeHub 的 ~40 个 provider（前序调研）里取候选，`aihubmix`/`deepseek` 命中同 provider，其余连接器（`openai-compatible`、`apimart`、`mimo`）始终走回退路径（`modelBank/index.ts:27-37`）；换成 Models.dev 的 228 个 provider，如果仍沿用"全 provider 候选 + 冲突即未知"，大量模型（尤其出现在多个网关的热门模型）会变成未知，覆盖反而下降；因此需要层级策略（上面 1-2 层）而不是平铺候选。
- `mimo` 连接器在 LobeHub 里始终走回退，换成 Models.dev 后可直接命中 `xiaomi` provider（9 个模型）。
- 视觉能力：`getModelBankVision` 用同样的"冲突即未知"规则；Models.dev 里 129 个多 provider id 的视觉输入不一致。

### 5.3 数据缺口（未验证）
- 未核对 AIHubMix 实际 `/models` 返回的 id 与 `aihubmix` provider 的 id 命名是否一致（前序调研仅给 21/60 命中）。
- `apimart` 在 Models.dev 无 provider，需决定是否仅用原厂层或允许用户手动绑定 provider。
- 尚未验证 Models.dev 是否有 `limit.input` 的使用语义差异对 `contextWindow` 的影响（前序调研只列字段）。

## Caveats / Not Found

- 未在真实 Tauri 窗口里验证：CSP 不影响 plugin-http 请求（推断自 `native-product-runtime.md:142` 及请求路径）。
- 没有找到通用 kv/settings 表；`localStorage` 仅有两处 UI 偏好使用。
- 原生 registry hash 不兼容变更的影响基于 `mod.rs:217-232` 的读取；未实际运行。
- 体积与冲突统计来自 2026-10-13 抓取的单个 `api.json` 快照（临时文件在 `/tmp/mdev-res/`），数值会随 Models.dev 更新变化。
- 本调研只描述现状与选项，未实现或修改任何源码。
