# Research: providers-media 代码质量与架构审查

- Query：provider 契约、错误与凭证、固定请求边界、重试/取消/超时、媒体生成/导出复用、序列化、音频资源、schema 与目录职责。
- Scope：internal；唯一登记范围为 `source-manifest.json groups.providers-media` 的全部 48 文件。
- Date：2026-09-30。
- 基准：任务声明的 `2fc0e9523e62a5258a488cc3d0274d24c8967c6f`，逐文件使用清单 SHA-256 校验当前内容。
- 产出：本报告与 `providers-media-coverage.json`；源码只读，无产品修改、无提交、无额外代理。

## 覆盖与结论

48/48 已覆盖：46 份非生成文件逐文件完整阅读，共 5,721 行；2 份生成 JSON 共 71,006 行，采用来源/生成链/全量结构与精确再生成验证，**未宣称人工逐行阅读生成 JSON**。总行数 76,727。所有 48 文件哈希匹配清单，无 blocked。

| ID | 严重度 | 分类 | 结论 |
| --- | --- | --- | --- |
| PM-01 | P1 | confirmed-bug | Responses 错误状态通过未脱敏 finishReason 进入持久化 |
| PM-02 | P2 | confirmed-bug | 通用模型发现/连接探测将 HTML 和 HTTP 200 错误体判为成功 |
| PM-03 | P2 | confirmed-bug | 重复音乐任务 ID 能提交成功，却令每次后续刷新在 observation 校验处失败 |
| PM-04 | P2 | confirmed-bug | 音乐任务读接口允许点段 ID，URL 归一化改变固定任务路径 |
| PM-05 | P2 | risk | 音频/聊天入站体缺少读取大小上限，解码/落盘限制发生过晚 |
| PM-06 | P3 | confirmed-bug | 音乐 JSON body 读取被取消时错误分类为 protocol |
| PM-07 | P2 | structural-debt | 请求基础边界在多个 adapter 中复制，guard/取消/解析策略已经漂移 |

下面的 confirmed-bug 指代码机制与隔离输入可证明的错误，不表示已经在真实付费服务上观测到这些异常响应。每项保留具体触发条件。

## 发现

### PM-01 — P1 / confirmed-bug：Responses 的状态字段绕过诊断脱敏

位置：`src/lib/ai/responsesStream.ts:165`、`:170`。跨组调用证据：`src/lib/agent/runChat.ts:286` 将 `result.finishReason` 传给 `finishAgentRun`；`src/db/agentRuns.ts:231` 原样保存该字段。

触发：JSON Responses 返回未完成状态，或已完成响应带 error，且字符串 status 中包含供应商回显的配置密钥。测试输入使用假的 `sk-audit-fixture`，无真实密钥。

机制：error.message 经过 `redact`，`finishReason` 却直接取任意 `response.status` 字符串。unknown status 虽被判失败，仍被复制进结果。Chat adapter 在 `src/lib/ai/chatStream.ts:424` 对结束状态使用 `redactError`，两种 transport 不一致。

影响：错误信息显示已脱敏，但密钥仍可出现在持久化执行记录和后续读取该记录的诊断中。未证明项目 ZIP 导出这些运行记录，不把“ZIP 泄漏”写作事实。

证据：执行原始 Responses `finish` 路径的隔离复现得到：

```json
{"ok":false,"message":"invalid key [已隐藏]","finishReason":"failed invalid key sk-audit-fixture"}
```

建议：优先将 finishReason 限定到代码认识的状态；需要保留未知状态时，脱敏并限制长度。检查所有返回/持久化诊断字段，而不只检查 message。

验证：JSON 失败结果注入包含假密钥的未知 status/error，断言结果整体及保存记录无密钥；SSE 给 response.failed 注入不匹配的未知 status，应在终止事件一致性检查处拒绝，现有路径已拒绝且无 finishReason，不把 JSON 的泄漏结论扩展为同输入下的 SSE 泄漏。合法 SSE terminal 的 error.message 仍应脱敏。保留 failed/incomplete/in_progress 的现有分支行为，不自动重发 POST。

### PM-02 — P2 / confirmed-bug：错误响应被转换为空模型成功或探测成功

位置：`src/lib/ai/openaiCompatible.ts:73`、`:76`、`:86`、`:113`、`:116`、`:145`；入口分发 `src/lib/ai/connectors.ts:55`、`:148`。

触发：OpenAI-compatible/DeepSeek 的 `/models` 返回 HTTP 200 HTML 登录页、坏 JSON、错误 envelope 或缺少 data 数组。聊天 fallback 只检查 HTTP 成功，同样没有解析成功 envelope。

机制：listModels 把 JSON 解析失败转换为 null，再把缺少 data 转为空数组，返回 ok:true；testConnection 在 HTTP 200 分支忽略 JSON 失败/error 字段。媒体专用探测相反，会校验 envelope。此处不把成功的**合法空模型数组**误判为错误，也不否认通用连接既有 404/405 fallback 契约。

影响：连接页显示测试通过，模型列表呈现空但成功，用户无法区分代理错误、鉴权失败和合法空目录，直到真正发送才遇到错误。

隔离证据：

```text
PM-GENERIC-HTML {"list":{"ok":true,"models":[]},"probe":{"ok":true,"via":"models"}}
PM-GENERIC-ERROR200 {"ok":true,"via":"models"}
```

建议：保留 unknown 输入直至检查 data 数组/元素与 error envelope；解析失败返回明确 protocol 错误。fallback POST 仍仅按现有允许条件执行，不能以任意 protocol 错误触发额外付费请求。

验证：覆盖 HTML、坏 JSON、HTTP 200 error、合法空目录、合法模型列表，以及 fallback 返回 HTTP 200 error。断言结果与请求次数。

### PM-03 — P2 / confirmed-bug：音乐任务 ID 集合未保持唯一，恢复路径确定失败

位置：`src/lib/ai/apimartAudio.ts:181`、`:182`；`src/lib/audioGeneration/runtime.ts:240`、`:265`、`:270`、`:273`、`:319`；`src/lib/audioGeneration/observations.ts:14`、`:15`。

触发：一次成功音乐提交返回 `[{task_id:"same"},{task_id:"same"}]`。这是不符合本地任务身份要求的远端输入，adapter 当前把它视为成功。

机制：提交解析只检查非空字符串，直接保存重复 taskIds。刷新时按照 taskIds.flatMap 构建 taskObservations；第一次查询后，同一 observation 被放入数组两次。存储 validator 拒绝重复 taskId，persistObservations 抛错，第一条查询的 checkpoint 也未保存。每次手动刷新都会再次进入同一路径。

影响：付费任务已经提交，但本地始终保持 submitted 且无法继续保存查询/下载结果；用户只能看到刷新失败。未发生自动重复 POST，不能描述为已经重复扣费。

证据：adapter 返回 `{"ok":true,"taskIds":["same","same"]}`。隔离执行真实 `refreshAudioGeneration` 与真实 observation validator、用内存 stub 替代数据库得到：

```text
DUPLICATE-REFRESH {"error":"音乐任务查询记录无效","reads":1,"persistedStatus":"submitted","persistedObservations":null}
```

建议：提交边界明确去重同一个远端任务，或作为 protocol 异常保留有效唯一 ID 供恢复。最好让接受的 ID 集合在查询、持久化、ZIP schema 中使用同一基础约束（唯一、数量、长度），避免付费提交后才发现本地不可表达。不能修复为重新发 POST。

验证：重复 task ID、超过 observation 数量上限的 task 列表、正常多任务列表；重复列表经处理后查询次数与 checkpoint 唯一，成功兄弟任务继续下载。恢复测试应从已提交记录开始，确认没有 POST。

### PM-04 — P2 / confirmed-bug：音乐任务 ID 的点段绕过固定路径约束

位置：`src/lib/ai/apimartAudio.ts:188`、`:189`；对照 `src/lib/ai/apimart.ts:376` 与 `src/lib/ai/aihubmix.ts:129`。

触发：直接读音乐任务 `"."`/`".."`，或供应商提交结果包含该值后被本地保存。当前校验只要求 trim 非空。

机制：encodeURIComponent 不编码点；URL/Request 规范化会将 `/music/tasks/..` 改为 `/music/`。图像/视频 APIMart 客户端已显式拒绝点段，音乐客户端漏了该 guard。

隔离证据：

```json
[{"raw":"https://unit.invalid/v1/music/tasks/..?language=zh","normalized":"https://unit.invalid/v1/music/?language=zh"}]
```

影响：带 Bearer 的读请求去了非任务详情 endpoint，破坏固定接口契约；不能正常读取此任务。仍处于配置供应商 origin 内，本复现**没有证明跨来源凭证外泄**。

建议：查询前拒绝点段；提交任务 ID 的验证也应同步。不要简单禁止所有 slash，因为现有 `tests/apimartAudio.test.ts:48` 明确支持编码后的 `task/1`，应保留该契约。统一 ID guard 时明确各供应商不同的 segment 要求。

验证：`.`、`..` 必须在 fetch 前被拒绝；常规 ID 与编码 slash ID 仍走正确详情路径；验证经过真实 Request 构造后的 URL。

### PM-05 — P2 / risk：入站音频与 Chat 流无大小上限，资源检查太晚

位置：`src/lib/ai/apimartAudio.ts:156`、`:239`；`src/lib/ai/mimoSpeech.ts:53`、`:154`；`src/lib/ai/aihubmix.ts:392`；`src/lib/ai/chatStream.ts:461`、`:303`。音频后续边界为 `src/lib/audioGeneration/runtime.ts:219` 与 `src/lib/audio/engine.ts:14`、`:22`。

触发：供应商/CDN 返回超过解码器支持大小的音频，或聊天网关持续返回过大的事件/回答。普通长音频也可能触发，并不要求恶意服务器。

机制：blob()/text()/json() 先完整读入内存；配音原始 Blob 还会在 runtime 保存到 IndexedDB 后才尝试解码，而 decodeAudioBlob 到这时才拒绝超过 32 MiB。Chat 仅限制工具字段，SSE buffer/eventData/回答累加没有对应总上限。Responses 和 Tavily 已分别实现 4 MiB / 2 MiB 信封边界，说明这些 guard 在项目中已有实际契约。

证据：33,554,433 字节的模拟 APIMart WAV 响应被 adapter 接受为 ok:true；4,194,305 字符的单个 Chat 回答也被接受为完整成功。复现只进行有限分配，没有尝试使浏览器崩溃。

影响：超限音频可占用不受 decoder 限制保护的读取内存、原始媒体空间，并进入无法解码的恢复记录。未终止的 Chat 事件也可能持续扩大内存。**没有测得真实浏览器 OOM/峰值，也没有证明某个真实供应商输出超限，故分类为 risk。**

建议：在读取流时按实际字节计数，不单靠 Content-Length；入站音频上限与可恢复 decoder 上限协调。超限时终止本地读取并保留“远端可能已经处理”的任务状态，不重发付费请求。Chat 分别约束单事件与累积输出，允许正常 usage、reasoning、工具结束事件。

验证：覆盖 Content-Length 缺失/伪造、分块跨越上限、base64 膨胀、合法大响应。断言 reader.cancel、no retry，配音超限不会把无法处理的大 Blob 写入持久化，音乐已有 task ID 仍可重试 GET/下载。

### PM-06 — P3 / confirmed-bug：音乐 body 取消被当作协议格式错误

位置：`src/lib/ai/apimartAudio.ts:135`、`:137`、`:138`。

触发：HTTP 头已经返回，但 response.json() 读 body 时用户 Stop，promise 抛 AbortError。

机制：jsonEnvelope 的 catch 无条件返回 protocol，没有检查 signal/AbortError。APIMart 图像 request、AIHubMix request 与音频 binary catch 均另有取消判别。

证据：隔离 mock 在 json() 中 abort 并抛 DOMException，得到：

```text
PM-ABORT-CLASSIFICATION {"aborted":true,"result":{"ok":false,"kind":"protocol","message":"APIMart 音频响应不符合接口约定；请保留任务记录，不要自动重复提交"}}
```

影响：把用户中止错误展示为供应商响应不符合约定，弱化“停止本地等待”的说明。submit runtime 对 aborted/protocol 都落 uncertain，故该分支本身不导致自动重试或多收费。

建议：body catch 中先识别取消再判 protocol；明确网络 body 中断是否应归 network。保持原有远端任务不被取消、POST 不自动重放的约束。

验证：取消发生在 fetch 前、响应头后、JSON body 过程中；结果应为 aborted，提交保留 uncertain，查询保留 query-failed，不伪造远端状态。

### PM-07 — P2 / structural-debt：请求基础边界被复制并发生策略漂移

位置：`src/lib/ai/apimart.ts:141`、`src/lib/ai/apimartAudio.ts:92`、`src/lib/ai/aihubmix.ts:151`/`:177`、`src/lib/ai/mimoSpeech.ts:36`、`src/lib/ai/openaiCompatible.ts:54`、`src/lib/ai/tavily.ts:63`。

这些实现各自组合 URL/key 校验、fetch 选项、body 读取、取消、错误脱敏。provider-specific envelope 不同，不能用同一个“HTTP 200 就成功”抽象覆盖；但复制的基础 guard 已产生 PM-01/02/04/06 这类差异。泛用 listModels 没有 signal 参数，`src/lib/ai/connectors.ts:55` 因而丢掉 discover 的 signal；通用请求未显式设置 credentials/redirect 策略。Tavily 有超时控制，其余媒体 adapter 仅靠调用者 signal。挂起的媒体请求可长期占着 `src/lib/audioGeneration/runtime.ts:42` 的 Web Lock，后续 refresh/submit 在等待队列中；未测真实网络挂起，不把缺少默认超时单列成已确认故障。

建议：先修具体 bug，再提取已经重复的少量纯 guard（脱敏、URL/ID 校验、取消判别、bounded reader），显式传 timeout/signal/credentials/redirect。保持每种 envelope、付费请求 uncertain、content 下载鉴权与 readonly probe 规则在各 adapter 内。不要引入通用 Provider 工厂、统一 generation service 或按复杂度阈值机械拆函数。

验证：在现有 provider 测试上增加跨 adapter guard 矩阵：取消阶段、超限读取、错误脱敏字段、fixed route、redirect/auth 策略；APIMart Ext idempotency/header 与视频/普通图像差异不能丢失。

## 当前职责与迁移建议

| 目录/模块 | 当前职责与依赖 | 判断与逐步调整 |
| --- | --- | --- |
| `ai/{apimart,apimartAudio,aihubmix,mimoSpeech,openaiCompatible}` | 网关 wire、provider schema、envelope、诊断 | 保留 provider 专用契约；优先收敛基础 guard，见 PM-07 |
| `ai/{catalog,connectors,chatModelPolicy,modelMetadata,reasoningPolicy,visionCapability}` | 能力目录、兼容策略、限制与路由 | 类型与能力职责大体清晰；元信息不能代替 provider availability 或 wire 授权 |
| `ai/modelBank` | 全量原始数据、同步限制索引、lazy 加载 | 生成链可验证，体积不是缺陷；保持上游原样与 exact-ID provider fallback |
| `ai/referenceWire.ts:1`/`:3`/`:6` | DB run/project/reference 归属检查、Agent 历史材料安全投影、真实图片编码、wire 装配 | 属于 Agent 请求装配，跨域依赖有真实契约；可先将 orchestration 归到 `lib/agent`，只保留 transport 对成品 wire 的消费，不能删掉异步编码后重验 |
| `ai/tavily.ts:1`/`:106` | 固定搜索 API + 已保存凭证/批准 revision 校验 | 若拆分，凭证/revision 装配由调用 use case 承担，传输仅接收已验证输入；保持批准后连接变更会阻止调用，不造额外服务层 |
| `audio` | 调度、WebAudio graph、缓存、PCM、录音与编辑命令 | graph 在 preview/export 共享，无需再抽象 engine；commands/scriptImport 是已有 CAS/事务 use case，不能仅因 lib 访问 repo 判错 |
| `audioGeneration` | durable intent、claim、单次提交、GET 查询、下载恢复、输出证据 | 与 image/video generationRuntime 相似的是流程形状，但付费响应/原始配音 bytes/兄弟任务 observation 契约不同；保留两条运行时，不按相似文本合并 |
| `audioGeneration/input.ts:3`、`chatModelPolicy.ts:1` | schema/兼容性从 mimoSpeech 取常量，而 transport 又依赖 audio/engine | 若进行职责整理，先把 MiMo 常量和纯 schema 放到中立的能力/领域模块，避免轻量策略依赖音频 transport；没有测量 bundle 体积，不宣称已经性能退化 |
| `memory` | strict schema、词法检索、整条选择预算、来源声明 | 当前是纯 planner，作用域/复核/排除条件与预算明确，不需要向量检索/策略工厂 |
| `references` | 本地 parse/worker、短事务发布、ZIP schema/归属/digest | 职责合理，DOCX/PDF 隔离与 operationId CAS 不应被“统一导入”破坏 |

静态 runtime 导入图排除 type-only import/export、解析已登记 src 的本地静态导入，Tarjan 未找到与本组相交的强连通分量。动态 import、Worker 入口与数据库调用的**行为耦合**不等于静态循环，已分别参考其实际接入，不声称图覆盖运行时注册或所有动态边。

网络复用判断：APIMart/AIHubMix 的聊天发送前 discovery 与 freshness/isCurrent guard 是明确契约，不把“每次发送查一次”直接当作缺陷。若将来复用 catalog，需要以 connector id/provider/baseUrl/key 变更为失效条件，并重新验证保存/手动模型；不得序列化 key-bearing cache key。未增加任何缓存或请求。

音频资源判断：64 MiB decoded LRU、单源 32 MiB/decoded 64 MiB、混音 256 MiB 预估、Offline render 取消后丢弃结果均已存在。预览/export 共用 scheduleAudioNodes，PCM 单声道复制与整体峰值衰减也已明确；主要遗漏是入站读取早期上限（PM-05），不能说音频完全没有资源控制。

建议迁移顺序：先修 PM-01/02/03/04/06 的边界行为并增加回归；再做 bounded reader/guard 的小幅复用；最后按调用链迁移 referenceWire/中立常量。保持 public entry points 兼容，异步 Blob/解码在写事务外、短事务内 ownership/revision/operationId 重验不变。无证据支持大规模目录重建。

## 工具信号复核、非缺陷与疑似项

1. `research/tools/providers-media-signals.json` 是原始信号，不能直接作为缺陷清单。复杂度、嵌套三元、不必要断言未单独升级为 PM 发现。严格字段组合、异常分类、逐个 checkpoint 解释了部分复杂度，不应去掉 guard 来降低分数。
2. Knip 标记 `references/mammoth.d.ts` unused 是确认的误报。`src/lib/references/docx.ts:2` 实际导入该 ambient module，tsconfig include src。TypeChecker module symbol 的 declaration 指向该文件；在**内存 compiler root 列表**排除它后出现 TS7016。没有删除/修改实体文件。
3. `no-control-regex` 指向 observation taskId 中拒绝控制字符的校验，这是有意的外部数据边界；不建议因为 rule 警告去掉。
4. 其余 unsafe-member/assignment 信号已回看：JSON 先作为 unknown 读取并检查 record；数组每个 entry guard 的事实与 any 推断问题须区分。PM-03 所需的是任务集合契约补齐，而非仅添加类型断言。
5. Knip 的部分 exported schema/helper/type 只在文件内或测试中使用，可择机缩小 public surface；测试 seam、本地组合 schema 和声明导出不是行为故障。不给所有 export 贴“死代码”标签。
6. 静音/独奏改变整个项目的可听章节拼接长度，`tests/audioEngine.test.ts` 明确要求 “concatenates audible chapters”，全静音 duration=0。现有契约下不列 bug。
7. 生成 JSON 大文件、用手写 parser 而非 Zod、React/use case 直接调用 repository，均不独立构成缺陷。
8. **疑似，未列已确认问题**：音频导入的解码限制在 native decode 之后检查，压缩容器可能造成较高临时 decoded 内存；PDF 单页 getTextContent 在页/字符 cap 前分配；DOCX repack 的同时副本会使峰值高于解压字节总量。本次未使用真实浏览器/恶意压缩样本测量峰值，不给出已确认 OOM。
9. **疑似，未列已确认问题**：preview loadBuffers 使用保存 metadata 做预检，实际 buffer 资源量与 imported metadata 可能不一致。需要在 ZIP/metadata 外组审查结论基础上验证，不能在本组将恶意不一致文件视为正常数据的既定故障。
10. 本轮未现场验证真实供应商 API 状态或外部文档最新内容；reasoning allowlist/价格/expiry 来源只核对本地 provenance 与实现契约，没有把复制日期当成事实验证日期。

## jscpd 行为比较：可核验的 clone 与共用边界

补充信号来自 `tools/providers-media-clones.json`：jscpd v4，exact-token，min80tokens/10lines；本组唯一片段报告 168 tokens/15 lines，AIHubMix 65–79 与 APIMart 85–99。逐行回看后，可信的相同实现实际为 `src/lib/ai/aihubmix.ts:67`、`:71`、`:75` 与 `src/lib/ai/apimart.ts:87`、`:91`、`:95` 的 record/nonempty/finite。报告端点包含上一条语句的结束符与**下一函数 jsonValue 的签名**，不意味着 jsonValue 函数体相同。未采用 JSX 坐标或源码无法对应的片段。

行为比较使用 TypeScript AST 抽出原文件的这四个纯函数，在各自独立 VM 内创建同 realm 的样本，避免 Object.prototype 的跨 realm 误差：

| 样本/判定 | AIHubMix | APIMart |
| --- | --- | --- |
| record([]) | false | false |
| nonempty("  ") | false | false |
| finite(Infinity) | false | false |
| jsonValue({x:1}) | true | true |
| jsonValue([null,1,"x"]) | true | true |
| jsonValue(NaN) | false | false |
| jsonValue(new Date(0)) | false | true |
| jsonValue(class instance) | false | true |
| jsonValue(Object.create(null) + x:1) | false | true |

差异由 `aihubmix.ts:83` 的 Object.getPrototypeOf(value) === Object.prototype guard 与 `apimart.ts:103` 的缺失产生。JSON.stringify(Date/class/toJSON) 可以执行转换行为，不等同检查 own values；APIMart 当前更宽松。本次没有证明正常 UI/Agent 严格 JSON 参数路径能够产生这些非 JSON 实例，因此该差异列为**待明确的序列化契约**，不凭 clone 追加 confirmed-bug。

结论：三个同语义原子 predicate 可以共用到轻量纯 helper，但十几行重复本身不足以新增 P2 缺陷，暂时保留也合理。只有整理 PM-07 或第三处真实复用时才值得抽取；不为它新增 validator 类/策略工厂。jsonValue 不可直接强行合并；先决定 plain-object/null-prototype/toJSON 接受策略并添加跨 adapter 测试，随后保持各 provider 的 native fields、schema/response envelope 独立。safeUrl 也有不同 provider root/content-path 契约，不能由这个 clone 信号推出整个 adapter 应共用。

原始纯函数比较输出（退出 0）：

```text
src/lib/ai/aihubmix.ts {"plain":true,"array":true,"nonFinite":false,"date":false,"classInstance":false,"nullPrototype":false,"recordArray":false,"nonemptyWhitespace":false,"finiteInfinity":false}
src/lib/ai/apimart.ts {"plain":true,"array":true,"nonFinite":false,"date":true,"classInstance":true,"nullPrototype":true,"recordArray":false,"nonemptyWhitespace":false,"finiteInfinity":false}
```

## 生成文件验证方法

来源是 `vendor/lobehub/model-bank` 与 manifest，revision `ebe586289d55936b738e4dc822dbdd745196b4f3`。核验 README、adapter 与 `scripts/model-bank-snapshot.mjs` 完整生成链：manual sync 拷贝可信 checkout，verifySnapshot 检查源清单与 license SHA-256；deriveDataset 从 upstream provider index 取 default arrays，在受限 VM transpile snapshot-local TS，保留 JSON 字段/顺序、拒绝非 JSON 值，再构建 token lookup。verify 比较两个生成文件的**精确文本**而非抽样。

本次独立实测 `node scripts/model-bank-snapshot.mjs verify` 退出 0：197 源文件、85 providers、1855 models。全量 json.load 检查两个结构均可解析，85 个 lookup provider 与 source entry 齐备，provider 内模型 ID 无重复。现有 modelBank 测试验证 full records/价格/generation schema/provider variants、字段级 provenance 与 exact-ID fallback。没有联网比较远端 checkout，没有修改 vendor。

共享原始验证输出：`tools/model-bank-verify-stdout.txt`；本次输出相同。两份 coverage 状态均为 generated-verified，说明该方法，而不是 reviewed。

## 实际执行与原始结果

本研究执行命令均退出 0，除早期查找使用不存在的 zsh 测试 glob (`no matches found`，随后改用明确文件) 与包含不存在参考路径 generationResults.ts 的 rg（退出 2，未依赖该路径作为证据）。没有把失败查找当作未读源码；48 份所有权路径均可读。

| 工具 | 本次版本/方式 | 用途与结果 |
| --- | --- | --- |
| Python | 3.9.6 | 清单、JSON 结构、SHA-256、覆盖一致性 |
| Node | 指定本机路径 v24.11.0 | model-bank verify、只读 AST/内存 VM 复现 |
| pnpm | `/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm`，本项目实测 10.15.0 | 仅 exec Vitest 与读取版本；未 install/add/remove，未使用 Codex Runtime pnpm |
| TypeScript | 本机项目运行包 5.9.3 | transpileModule/AST/TypeChecker；不同于独立 signals 工具记录的 5.9.2 |
| Vitest | 5.0.1 | 16 files / 391 tests passed，退出 0 |
| 外组共享 signals | ESLint 9.39.5、typescript-eslint 8.71.0、Knip 5.88.1、dependency-cruiser 17.4.3 | 读取 tools/tool-versions.json；本研究未重新安装/运行这些分析依赖 |

完整相关测试命令：

```sh
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm exec vitest run tests/openaiCompatible.test.ts tests/chatStream.test.ts tests/responsesStream.test.ts tests/connectors.test.ts tests/apimartAudio.test.ts tests/aihubmix.test.ts tests/apimart.test.ts tests/mimoSpeech.test.ts tests/audioGenerationRuntime.test.ts tests/audioGenerationRecoveryAudit.test.ts tests/audioEngine.test.ts tests/audioEngineRecorder.test.ts tests/references.test.ts tests/memoryRetrieval.test.ts tests/modelBank.test.ts tests/audioOutputEvidence.test.ts
```

原始摘要：

```text
Test Files  16 passed (16)
Tests       391 passed (391)
Duration    2.71s
HASH CHECK 48 files; changed: []
GENERATED STRUCTURE 85 1855 lookup providers 85 source entries 85
DUPLICATE MODEL IDS []
MAMMOTH-SYMBOL ["src/lib/references/mammoth.d.ts"]
WITHOUT-DECLARATION [{"code":7016,"message":"Could not find a declaration file for module 'mammoth/mammoth.browser'. ... implicitly has an 'any' type."}]
```

model-bank verify 命令及原始输出：

```sh
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/node scripts/model-bank-snapshot.mjs verify
```

```json
{"files":197,"providers":85,"models":1855,"revision":"ebe586289d55936b738e4dc822dbdd745196b4f3","result":"verified"}
```

其他只读命令形式为 `node --input-type=module <<'JS'` 与 `python3 - <<'PY'`。复现用 ts.transpileModule(CommonJS, ES2022) 在 vm 中执行**原文件内容**，注入 Response/Request/ReadableStream/Blob 和虚构 fetch；referenceWire/modelBank 在无图像样本的 transport 复现中用空/恒等 stub，避免实际 DB/网络。PM-03 runtime 复现仅 stub DB/connector/repo，保留真实 runtime 与 observation validator。关键原始输出已逐条写在对应发现下。没有写新测试文件，没有连真实服务，也没有把 stub 当成浏览器 WebAudio/IndexedDB 集成验证。

静态导入图原始结果：

```json
{"scope":"static runtime imports/exports, excluding type-only and dynamic","components":[]}
```

## 相关规范与限度

已读取角色 `.codex/agents/trellis-research.toml`、workflow、任务 prd/design/implement，以及 frontend index、directory-structure、type-safety、quality-guidelines、ai-connectors、audio-music、agent-memory-retrieval、agent-references、delivery-export 的相关契约。相关跨组 caller/tests 仅作证据，没有计入本组 coverage。

本交付覆盖本组代码阅读、生成链、必要隔离复现与相关已有回归；没有宣称全项目 lint/build/full suite 已由本研究完成，也没有运行真实浏览器音频、麦克风、PDF Worker 或付费 API。复杂度和 Knip 只作定位，风险与疑似保留上述限度。建议修复属于后续任务，本次不改变产品。
