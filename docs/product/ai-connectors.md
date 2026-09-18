# AI Connectors

与 Trellis 任务 `09-18-ai-connectors` 对齐。

## 目标

- 工作室全局 BYOK「连接」页（`/connectors`，StudioShell 导航）
- MVP：OpenAI 兼容协议（**Base URL + API Key**）+ 测试连接 / 模型列表探活 + 持久化
- 同协议可挂 DeepSeek 等目录卡片（预设 Base URL）
- 供后续 **Agent 聊天**等跨项目能力使用，**不按项目配 Key**
- **聊天用哪个模型在 Agent 对话里选**，不在连接器里配置默认模型

## 存储

- IndexedDB 表 `connectors`（`src/db/database.ts`）
- 读写经 `listConnectors` / `upsertConnector` / `deleteConnector`（`src/db/repo.ts`）
- **不进** `exportProjectZip`
- **范围：工作室全局**

## 协议客户端

- `src/lib/ai/openaiCompatible.ts`：规范化 Base URL、Bearer、`testConnection`、`listModels`
- 目录：`src/lib/ai/catalog.ts`（`openai-compatible`、`deepseek`、`apimart`）

## MVP 范围（已定）

- 连接列表页 + 安装/编辑弹窗 + 测试连接 / 拉取模型探活
- **不含** Agent 聊天 UI（后续任务）

## UI

```text
连接
密钥仅保存在本机……具体聊天用哪个模型，在 Agent 对话里选择。

┌─────────────────────────────────────────────┐
│ [OA] OpenAI 兼容     [已连接] / [安装][编辑] │
└─────────────────────────────────────────────┘
```

编辑弹窗：Base URL、API Key、测试连接、拉取模型探活（展示可见模型，不保存选型）、保存。

## APIMart adapter foundation

APIMart uses the existing studio-global connector storage with default Base URL `https://api.apimart.ai/v1`. The catalog distinguishes provider capabilities (`chat`, `image`, `video`) from the OpenAI-compatible chat protocol. No database migration is required.

`src/lib/ai/connectors.ts` owns provider dispatch for connection testing and model discovery. APIMart probes only `GET /models?expand=category`; it never falls back to a paid POST. The connection page lists every visible model; the chat picker lists only models categorized as `chat`. Unknown or missing categories require manual model entry. Other providers retain their existing behavior.

Chat also excludes known image/video/audio models from manual search and saved-selection reinsertion. Old conversations keep their messages, but an incompatible saved model prompts the user to choose a chat model. A send validates the actual provider/model before any message writes or chat POST; a failed APIMart metadata query leaves the draft intact. Unknown custom model IDs remain allowed after a successful metadata query. Classification is scoped to the connector and relies on provider metadata, not a model-name blocklist.

`src/lib/ai/apimart.ts` provides:

| Export | Purpose |
| --- | --- |
| `listApimartModels` | Discover categories/capability tags and optional parameter schemas with `expand: "parameters"` |
| `testApimartConnection` | Read-only model-list probe |
| `uploadApimartImage` | Upload a Blob/File as multipart data and return its temporary URL |
| `submitApimartImageGeneration` | Submit a native request to `/images/generations` |
| `submitApimartVideoGeneration` | Submit a native request to `/videos/generations` |
| `getApimartTask` | Query one provider task and normalize states, media URLs, expiry and errors |

The client accepts credentials and request options (`signal`, `fetchImpl`). Generation requests preserve model-native fields instead of translating all models into a single parameter vocabulary. Schema metadata is informative and never used to execute arbitrary provider URLs; server validation remains authoritative. Special routes such as Midjourney actions are outside this adapter's generic-endpoint coverage.

No generation UI, job persistence, automatic polling, result download or slot mutation is included. Future runtime callers must retain provider task IDs, handle ambiguous submission failures without blind retries, and archive results before their URLs expire. Aborting a local request does not cancel a remote task.

Official contracts: [model metadata](https://docs.apimart.ai/en/api-reference/texts/models/list.md), [image upload](https://docs.apimart.ai/en/api-reference/uploads/images.md), [task status](https://docs.apimart.ai/en/api-reference/tasks/status.md). The upload guide supersedes conflicting base64 examples in individual model pages for this implementation's supported reference-image flow.
