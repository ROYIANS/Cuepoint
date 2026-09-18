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
- 目录：`src/lib/ai/catalog.ts`（`openai-compatible`、`deepseek`、`apimart`、`aihubmix`）

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

## AIHubMix adapter foundation

AIHubMix is available in the existing connector catalog with default Base URL `https://aihubmix.com/v1`. It uses the same studio-global key persistence and OpenAI-compatible chat transport. No database migration is needed. The installed provider supports chat/image/video at the adapter level; generation entrypoints remain deferred.

**Public discovery is not authentication.** The connector's “获取公开模型” action reads `/api/v1/models` without sending the key. Its catalog describes provider-wide availability, not per-key permissions. “测试连接” instead makes an authenticated, read-only `GET /ai/v1/images?limit=1` and reports that access specifically; it never falls back to a chat or media POST. Permission/account-feature errors are surfaced rather than claiming that public discovery validated the key.

Chat discovery uses `types`, `endpoints` and `output_modalities`. Text LLMs with Chat Completions support (or unannotated protocols) are suggested. Image/video **input** does not disqualify a text model. Known media/non-chat types, media outputs and explicitly incompatible protocol sets are excluded from suggestions, saved selections and manual search. Unknown aliases remain manual-only after successful metadata discovery. The existing send boundary validates again before any thread/message mutation or chat request; failures preserve history and draft.

The independent `src/lib/ai/aihubmix.ts` client provides:

| Operation | Purpose |
| --- | --- |
| `listAIHubMixModels` | Public catalog with normalized types, modalities, protocols and metadata validity |
| `testAIHubMixConnection` | Authenticated task-list read; no generated content |
| `getAIHubMixModelSchema` | Optional public per-model schema lookup, selecting the native endpoint by path |
| `submitAIHubMixImageGeneration` | Native `/ai/v1/images/generations`, synchronous by default or explicit `async: true` |
| `submitAIHubMixVideoGeneration` | Native `/ai/v1/videos`, always asynchronous |
| `getAIHubMixImageTask` / `getAIHubMixVideoTask` | Active media detail reads, preserving outputs, errors and expiry |
| `downloadAIHubMixResult` | Explicit protected result retrieval as Blob; no automatic storage |

The media client preserves native image/mask inputs, video reference/frame roles, numeric `duration` and model-specific `extra`. Schema metadata is informative: returned paths are never executed dynamically and lookup failure does not block ordinary chat. Task responses are top-level objects, unlike APIMart envelopes. Queries use image/video detail endpoints, not unified task snapshots. Completed results preserve all indexed outputs, Base64 and content URLs.

AIHubMix content URLs require Bearer authentication and cannot be treated as public preview URLs. Explicit retrieval verifies the configured provider origin, route and task identity before attaching the key; redirects are rejected. Future callers must persist results before expiry. A local abort does not cancel the remote task, and ambiguous submission failures must not trigger automatic resubmission.

Async media requires activation in the provider console. Read-only checks observed local-origin CORS headers on main API routes, but the public schema response lacked them. Schema lookup therefore may fail in a browser; no proxy is added in this task. Real authenticated generation, production CORS and paid results have not been validated. No generation UI, polling, job persistence, slot writes or automatic result download is included.

Official contracts: [model metadata](https://docs.aihubmix.com/cn/api/Models-API.md), [images](https://docs.aihubmix.com/cn/api/aihubmix-image-generation.md), [videos](https://docs.aihubmix.com/cn/api/aihubmix-video-generation.md), [task/schema semantics](https://docs.aihubmix.com/cn/api/async-tasks.md).
