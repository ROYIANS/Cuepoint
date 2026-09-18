# Design — Studio Agent chat MVP

## Boundaries

```text
StudioShell ── /agent
  AgentChatPage
    LobeChatTheme (ConfigProvider + ThemeProvider, dark, scoped)
    ThreadSidebar | MessageList | Composer
         │              │              │
         └──── Dexie chatThreads / chatMessages
                              │
                    streamChatCompletions(connector, model, messages)
                              │
                    existing connectors table (read-only for keys)
```

## Data (Dexie)

Bump DB version; add:

- `chatThreads`: `id, title, connectorId?, model?, createdAt, updatedAt`
- `chatMessages`: `id, threadId, role ('user'|'assistant'|'system'), content, createdAt, status?`

Repo helpers: list/create/rename/delete threads; append/update message; cascade delete messages on thread delete.

**ZIP**: ensure `collect*` / export paths never touch these tables (mirror connectors).

## Streaming client

Extend `src/lib/ai/openaiCompatible.ts` (or sibling `chatStream.ts`):

- POST `chat/completions` with `stream: true`
- Parse SSE `data:` JSON deltas (`choices[0].delta.content`)
- `AbortController` for Stop
- Non-stream fallback if `stream` unsupported / error

## UI

- Route: `src/routes/_studio.agent.tsx` → `AgentChatPage`
- Nav: 「对话」first (`/agent`); studio `/` redirects there. 「项目」is `/projects`.
- Prefer `@lobehub/ui` / `@lobehub/ui/chat` (`ChatHeader`, `ChatItem`, `ChatInputArea`, `Block`, `Flexbox`, `Markdown`, `Avatar`, `CopyButton`, etc.); do **not** wrap entire app in ThemeProvider
- Composer footer copies lobehub `ChatInput/Desktop` ActionBar: left **Agent / 任务** mode + `+`, right model chip (connector/vendor switch lives **inside** the model dropdown) + circular send. No chip row inside the box. Task mode is a placeholder (board later).
- Spacing: 4px scale from LobeHub DESIGN.md, tokens in `agentTheme.ts`. Studio floor is `#000`; chat canvas is transparent so StudioField + grain show through. Container `#0d0d0d` (DESIGN.dark) is for composer/sidebar surfaces only.
- **UI source of truth**: Copy visual composition from local lobehub clone (`Conversation`, `ChatInput`, `AgentSidebar/Topic`, `AgentHome`) using `@lobehub/ui` only. Keep Cuepoint Dexie + connectors + `streamChatCompletions`. Do **not** vendor lobehub zustand stores.
- **Module split** (chat-only tree under `src/components/agent/`):
  - `HomeWelcome` ← lobehub `AgentHome` / `AgentInfo` / `OpeningQuestions`
  - `TopicSidebar` ← lobehub `AgentSidebar/Topic` + `NavItem` row chrome
  - `ChatWorkspace` + `MessageList` ← lobehub Conversation header + ChatItem bubbles
  - `FloatingComposer` ← lobehub ChatInput Desktop: textarea + ActionBar (left Agent/任务 + `+`, right ModelIcon + send; connectors inside the model panel)
- **Visual target**: LobeHub Conversation fidelity (not a minimal shell)
  - **Home** (no messages): greeting + square avatar, large centered floating composer, recent topics — no sidebar
  - **Chat**: left topic sidebar (`开启新话题` + 今天/昨天/更早), header title, user bubble / assistant docs, floating bottom composer with stop
  - StudioField + grain from StudioShell show through chat (transparent canvas); DESIGN.dark tokens via chat ThemeProvider

## Dependencies

```bash
pnpm add @lobehub/ui antd motion @lobehub/icons
```

(Verify peers; add fluent-emoji only if required by chosen components.)

## Trade-offs

- Scoped antd CSS may need careful root class to avoid leaking into studio
- Chat history studio-global (not per-project) until later context binding
