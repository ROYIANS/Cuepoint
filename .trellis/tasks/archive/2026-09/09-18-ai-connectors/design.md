# Design — AI connectors

## Storage

New Dexie table or singleton row, e.g. `appSettings` / `connectors`:

```ts
type ConnectorProtocol = "openai-compatible";

interface ConnectorConfig {
  id: string;              // instance id
  definitionId: string;    // "openai-compatible" | "deepseek" | …
  protocol: ConnectorProtocol;
  label?: string;
  baseUrl: string;         // e.g. https://api.openai.com/v1
  apiKey: string;
  // Model preference is NOT saved here — Agent chat picks models later.
  // Catalog may supply a probe-only fallback for chat test when /models is unavailable.
  updatedAt: string;
}
```

- Never attach to `exportProjectZip`.
- Optional: mask key in UI (`sk-…xxxx`).

## Definitions (catalog)

Static catalog in code:

| definitionId | title | default baseUrl | protocol |
| --- | --- | --- | --- |
| `openai-compatible` | OpenAI 兼容 | `https://api.openai.com/v1` | openai-compatible |
| `deepseek` | DeepSeek | `https://api.deepseek.com/v1` | openai-compatible (stub / install opens same form with preset) |

## UI

- Route under studio: e.g. `/connectors` + nav item in `StudioShell`（设置/连接）.
- List: cards with status `未连接` | `已连接`; CTA 安装 / 编辑.
- Dialog form: **baseUrl + apiKey only**, 测试连接, 拉取模型探活 (display ids, do not save), 保存.
- Client helper: `openaiCompatible.testConnection(config)` → fetch models or chat.

## Client module

`src/lib/ai/openaiCompatible.ts` — build headers, normalize base URL (trim trailing slash), test + later `chatCompletions` used by Agent task.
