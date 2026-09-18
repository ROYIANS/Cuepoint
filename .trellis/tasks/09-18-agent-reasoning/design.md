# Design — Agent reasoning display

## Architecture

```
SSE / JSON  →  chatStream (content | reasoning deltas)
            →  AgentChatPage (assemble + Dexie patch)
            →  MessageList → ThinkingPanel (above ChatItem body) + answer
```

Copy LobeHub **lifecycle**, not the operation store: a local `reasoningActive` flag (or infer: reasoning non-empty && content still empty while `status === "streaming"`) drives accordion open state the same way `thinking={isInReasoning}` does.

## Data

Extend `ChatMessage`:

```ts
reasoning?: string;
reasoningDurationMs?: number;
```

- Dexie: same `chatMessages` table; no index change required (optional fields on put).
- `updateChatMessage` patch union includes `reasoning` | `reasoningDurationMs`.
- ZIP exclusion unchanged (chat tables already out of project package).

## Stream contract (`chatStream.ts`)

Change parse from `string | null` to a small chunk type:

```ts
type StreamDelta = { content?: string; reasoning?: string };
```

Sources (first match wins per field):

- reasoning: `delta.reasoning_content` | `delta.reasoning` (string)
- content: `delta.content` | `message.content` (existing)

Handlers:

- `onDelta?(chunk: StreamDelta)` or keep `onDelta` for content and add `onReasoning?(text: string)`.
- Prefer dual callbacks to minimize MessageList churn: `onReasoning` / `onDelta`.

Lifecycle in `AgentChatPage` send path:

1. On first reasoning piece: record `reasoningStartedAt`, set reasoning active, append to `reasoning`.
2. On first content piece while reasoning active: set `reasoningDurationMs`, clear active → UI collapses.
3. Final `updateChatMessage` writes both `content` and `reasoning` / duration.

JSON non-stream fallback: read `message.reasoning_content` / `message.reasoning` if present.

## UI

- New `ThinkingPanel` under `src/components/agent/` (Accordion from `@lobehub/ui` if available in our version, else lightweight disclosure matching agent chrome).
- Place **above** assistant message body when `hasRenderableReasoning` (`reasoning?.trim()` or actively reasoning).
- Title: streaming → 「思考中」(+ optional matrix is N/A inside panel); done → 「已深度思考 x.s」.
- Body: markdown via existing chat markdown path or plain pre-wrap secondary text for MVP if ChatItem nesting is awkward — prefer lobe Markdown with `variant: "chat"` muted styles.
- `ThinkingMatrix`: only when `status === "streaming" && !content && !reasoning` (still waiting for first token of either kind).
- Avatar `loading`: keep while streaming && !content (answer not started), even if reasoning is showing — matches “answer not yet” wait; optional later tighten.

## Performance

- Memo compare on `AgentChatMessageItem` must include `reasoning` / `reasoningDurationMs`.
- Do not allocate new `markdownProps` per tick (existing hoist rule).
- Reasoning panel body updates should not remount historical rows.

## Trade-offs

| Choice | Why |
| --- | --- |
| Infer active vs operation store | Cuepoint has no op graph; empty content + streaming reasoning is enough for MVP |
| Collapse on first content | Locked to LobeHub; avoids long CoT burying the answer |
| Optional fields on ChatMessage | Avoids schema migration number churn; Dexie accepts richer objects |
