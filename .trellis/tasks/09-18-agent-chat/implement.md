# Implement — Studio Agent chat MVP

1. Install `@lobehub/ui` + peers; smoke ThemeProvider in a throwaway mount if needed.
2. Dexie: `chatThreads` / `chatMessages` + repo API + ZIP exclusion check.
3. `streamChatCompletions` (+ unit test for SSE parse / abort).
4. `AgentChatPage`: threads, messages, composer, connector/model picker, empty states.
5. Route `/_studio/agent` + StudioShell nav「对话」.
6. Scoped Lobe theme wrapper (dark aligned with studio).
7. `pnpm lint` && `pnpm test`.

## Validation

- Manual: connect DeepSeek/OpenAI-compatible → `/agent` → stream reply → refresh → Stop.
- Automated: stream parser tests; repo CRUD if easy with fake-indexeddb.

## Risky points

- antd style leak into studio
- Dexie schema migration breaking existing DBs
- CORS on browser-direct chat to some providers (same as connectors today)
