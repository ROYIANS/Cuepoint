# B04 / PM-02：当前解析与探测边界

2026-09-30，只读准备；B01 正在实施。本次唯一写入文件为本报告，未实施、未关闭 finding。

依据：`.trellis/tasks/09-30-src-quality-remediation/research/B-next-unit-contracts.md:10`；审计原文 `.trellis/tasks/09-30-src-quality-architecture-audit/research/providers-media.md:47`（PM-02）。下面行号按本次读到的当前源码。

## 决定性边界

**目录的合法空数组可以成功；解析失败、无效 envelope、坏目录行、HTTP 200 error envelope 必须失败。它们不能触发付费聊天 fallback。** 通用探测现有允许条件是 `/models` HTTP 404、405，以及 GET fetch 的传输 TypeError；这些条件只允许一次 POST。已提交的 POST 返回协议错误后，不再请求。

最容易引入回归的位置：`openaiCompatible.ts:111–130` 的外层 try/catch 同时包含 GET fetch 和响应处理，TypeError 会 fall through 到 POST；当前 `.json().catch(()=>null)` 吞掉了响应体错误。新增校验不能让 body/decoder TypeError 流进这个 gate。需要将 fetch 的允许 fallback 与响应体失败分开处理。

## 当前真实调用链

| 调用入口 | 当前链路与结果消费 |
| --- | --- |
| 连接页获取模型 | `src/components/studio/ConnectorsPage.tsx:70` handleProbeModels → `src/lib/ai/connectors.ts:102` listConnectorModels（默认 all）→ `:119` 通用 listModels → `src/lib/ai/openaiCompatible.ts:55` GET `/models`。失败在页面 `:79` error toast/清空列表/return；合法空目录进入 `:90` 成功提示。 |
| 连接页测试连接 | `ConnectorsPage.tsx:97` handleTest → `connectors.ts:132` testConnectorConnection → `:148` 通用 testConnection，注入 catalog defaultModel → `openaiCompatible.ts:100`。失败进入页面 `:120`。 |
| Agent 目录发现 | `src/components/agent/AgentChatPage.tsx:238` → `connectors.ts:17` discoverConnectorChatModels → `:52` 通用 listModels。失败使页面 `:243` catalog.status=error，成功为 ready。 |
| chat 用途列表 | `connectors.ts:108` listConnectorModels(chat) → discoverConnectorChatModels → 通用 listModels；失败原样返回。 |

通用路径实际是 openai-compatible / deepseek。`src/lib/ai/catalog.ts:22/:32` 默认模型分别为 gpt-4o-mini / deepseek-chat。直接 testConnection 使用 trimmed defaultModel，空值用 gpt-4o-mini。

MiMo、AIHubMix、APIMart 在 `connectors.ts:136–146` 提前分发到各自只读 probe，没有通用 POST fallback：MiMo GET `/models`；APIMart GET `/models?expand=category`；AIHubMix GET `${providerRoot}/ai/v1/images?limit=1`。AIHubMix 公开模型目录不是 API Key 验证。

**底层与页面次数区别：**下面矩阵统计一次底层操作。连接页测试成功 via=models 后，在 `ConnectorsPage.tsx:113` 再取一次模型列表，所以页面层正常/合法空目录是 2 GET、0 POST；协议失败则页面不追加 GET。via=chat 成功不追加目录读取，总计 1 GET attempt + 1 POST。不需为 PM-02 合并这两个 GET。

## 现有解析与错误资产

- `openaiCompatible.ts:73–87`：list JSON 失败转 null，缺 data 转 []；有效 id trim/去重/排序，坏行静默过滤。`:113–116`：probe JSON 失败仍成功；`:143`：POST 仅看 HTTP。这三处是 PM-02 的产品边界。
- `openaiCompatible.ts:40` 私有 formatHttpError、`src/lib/ai/safeError.ts:2` redactCredentials：保留 HTTP 401/403 语义；错误诊断先脱敏再截断。公开失败 API 保持 `{ok:false,message}`，无需增加 kind 或修改消费者。
- `src/lib/ai/modelMetadata.ts:43/:58` parseModelMetadata/collectModelMetadata：复用 optional metadata 解析与重复路由保守合并；无效 optional limits 不使有效 id 行失败。
- `src/lib/ai/mimoSpeech.ts:71` listMimoModels 已有最近似的目录规则：record + data array + 每行 record/非空 string id，允许空目录。`src/lib/ai/apimart.ts:141/:215/:242`、`src/lib/ai/aihubmix.ts:179/:207/:235` 已有各自 error/protocol 校验与只读 probe；其私有 helpers 含专用协议，不需要导出或改写。
- `src/lib/ai/chatStream.ts:180` 私有 decodeCompletion 已拒绝顶层 error、缺 choices、无效 message。探测可参照 frame 判定，但不能调用 streamChatCompletions 来验证已收到的 body，那会再发 POST；实际聊天的非空内容要求也不直接套到 max_tokens=1 的连接探测。

## 响应样本与期望

本表当前结果来自源码判定；审计已执行的 HTML/error 隔离证据见 providers-media.md。本次未新增复现测试文件。

| `/models` 响应 | 当前结果 | B04 应有结果 | 每个 list / probe 的请求次数 |
| --- | --- | --- | --- |
| 200 `<html>login</html>`、截断 JSON `{"data":` | list 空成功；probe 成功且 count undefined | 均 protocol 失败 | 1 GET、0 POST |
| 200 `{}`、`null`、`[]`、`{"data":{}}` | 同上 | 均 protocol 失败 | 1 GET、0 POST |
| 200 `{"error":{"message":"invalid fixture-key"}}` | 同上 | 均失败；message 不含 key | 1 GET、0 POST |
| 200 `{"error":"denied","data":[]}` 或 error + 有效 data 行 | list/probe 成功 | error 优先，均失败 | 1 GET、0 POST |
| 200 `{"data":[null]}` / `[{}]` / `[{"id":4}]` / `[{"id":" "}]` | list 丢行；probe 按数组 length 成功 | 整个目录 protocol 失败 | 1 GET、0 POST |
| 200 `{"data":[{"id":"valid"},{}]}` | list 部分成功；probe count=2 | 整个目录失败 | 1 GET、0 POST |
| 200 `{"success":false,"data":[]}` | 空成功 | 明确失败标志优先 | 1 GET、0 POST |
| 200 `{"data":[]}` 或 `{"error":null,"data":[]}` | 空成功 | 保持 list models=[] / probe via=models,count=0 | 1 GET、0 POST |
| 200 `{"data":[{"id":" z "},{"id":"a"},{"id":"a"}]}` | list=[a,z]；probe count=3 | 保持去重/排序与 raw 行数 count | 1 GET、0 POST |
| 204 空 body | 空成功 | protocol 失败 | 1 GET、0 POST |

目录最小成功 envelope：非数组 object；无非 null error / success:false；data 数组；**每行**是 object 且 id 为 trim 后非空 string。不强制 object/created/owned_by/success:true；不把 APIMart code 语义搬进通用协议。合法 JSON 不以 Content-Type 为必备条件。

允许 fallback 后，200 HTML/坏 JSON/error/缺有效聊天 envelope 也必须失败。最小成功 fixture 可用 `{choices:[{message:{role:"assistant",content:"pong"},finish_reason:"stop"}]}`；只有 `{id:"reply"}` 不能证明聊天协议成功。choices 必须非空，首项/message 有效；error 优先于同时存在的 choices。max_tokens=1 不要求可展示的非空回复。id/object/model/usage 无需必填。

## 精确 fallback 矩阵

| 条件（一次通用操作） | listModels | testConnection |
| --- | --- | --- |
| base/key trim 后为空 | 失败，0 requests | 失败，0 requests |
| 有效目录，包括空数组 | 成功，1 GET | 成功 via=models，1 GET、0 POST |
| 2xx HTML/坏 JSON/坏 envelope/坏行/error/body 读取异常 | 失败，1 GET | 失败，1 GET、**0 POST** |
| HTTP 404 或 405 | HTTP 失败，1 GET | 允许唯一一次 POST，总计 2 requests |
| HTTP 400/401/403/408/429/500/503 等非 404/405 | HTTP 失败，1 GET | HTTP 失败，1 GET、0 POST |
| GET fetch reject TypeError | 失败，1 attempted GET | 允许唯一一次 POST，总计 2 attempts |
| GET fetch reject 普通 Error/SyntaxError/AbortError | 失败，1 attempted GET | 失败，1 attempted GET、0 POST |
| 允许 fallback 的 POST 返回有效聊天帧 | 不适用 | 成功 via=chat；2 attempts，POST 1 次 |
| POST 200 HTML/坏 JSON/error/坏 choices/message 或 body 异常 | 不适用 | 失败；2 attempts，POST 1 次，不重试 |
| POST HTTP失败或 fetch异常 | 不适用 | 失败；2 attempts，POST 1 次，不重试 |

唯一 POST 仍是 `${base}/chat/completions`，当前 Bearer/JSON headers，body=`{model,messages:[{role:"user",content:"ping"}],max_tokens:1}`；不追加其他端点或模型重试。三个专用 provider 在 404/405/TypeError/协议错误下都无付费 fallback，合法配置的一次失败 probe 至多一次 GET。

## 最小后续写入范围与回归计数

产品仅 `src/lib/ai/openaiCompatible.ts`：list/probe 共用私有目录 decoder、校验唯一 POST 响应、分开 fetch fallback 与 response 失败。测试仅以下三文件：

| 文件 | 需要更新/新增的行为断言 |
| --- | --- |
| `tests/openaiCompatible.test.ts` | list 与 probe 各自参数化上述 HTTP200 样本；失败 + exactly 1 GET + 0 POST。GET body.json reject TypeError/SyntaxError/AbortError 也只能 1 GET。合法空目录精确 models=[] / modelCount=0。404、405、fetch TypeError 后有效 POST 精确 2 calls（GET→POST），检查固定 body/defaultModel。每种允许触发后 POST HTML/坏JSON/error/error+choices/缺choices/坏message/body异常/HTTP失败均 exactly 2 calls、POST exactly 1。其他 HTTP/非TypeError异常 exactly 1；缺输入 0。`:62` id-only fallback fixture 改为合法 choices/message。 |
| `tests/connectors.test.ts` | openai-compatible/deepseek 的 all/chat/discover 失败传播各自 1 GET；probe 错误各自 1 GET、0 POST。两种默认模型的允许 fallback 2 calls；`:58` id-only fixture 改为有效帧。MiMo/APIMart/AIHubMix 的 HTTP200协议失败各自 1 GET、0 POST，保留现有专用 HTTP 错误对照。 |
| `tests/modelMetadata.test.ts:30–35` | `{data:{}}` 的现有空成功错误预期改成失败；已有有效 metadata / 缺失 limits / duplicate routes 保持。 |

关键无付费回归：mock GET 返回待测协议错误，**若实现意外发 POST，mock 返回合法聊天成功帧**；同时断言 `ok:false`、fetch exactly 1、所有 method=GET。这样既能抓住 fallback 成功掩盖协议错误，也能抓住发了 POST 后仍返回失败。fallback 错误测试同时断言 exactly 2、POST exactly 1；只看失败结果不能证明没有重复付费请求。每个 case 独立创建 Response，避免 body 被复用消费。

现有明确计数证据：`tests/openaiCompatible.test.ts:38/:59` 正常 GET=1 / 404 fallback=2；`tests/connectors.test.ts:35` APIMart 404 GET=1、`:214/:223` AIHubMix 鉴权/HTTP错误 GET=1、`:240` MiMo 401/403/404/405/500 GET=1；`tests/agentAuditRemediation.test.ts:203` 404→聊天401 requests=2 且错误脱敏。后者本次未执行。

本次通过指定本机 pnpm 路径执行了 `vitest run tests/openaiCompatible.test.ts tests/connectors.test.ts tests/modelMetadata.test.ts`：**3 文件、62 测试通过**。这是现有基线，包含尚未纠正的 `{data:{}}` 预期，不代表 PM-02 已修复。

调用链、允许 fallback 与协议失败次数已确定，到此停止。未修改产品/spec/ledger，未进行外部研究、广泛重扫、提交/推送或派生代理。
