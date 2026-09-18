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
- 目录：`src/lib/ai/catalog.ts`（`openai-compatible`、`deepseek`）

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
