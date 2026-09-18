# Studio Agent chat MVP

## Goal

Add a dedicated studio **对话** page (`/agent`) where users chat with BYOK OpenAI-compatible connectors: multi-thread history in Dexie, model picker, streaming replies, LobeHub-inspired layout using `@lobehub/ui` **only inside the chat tree**.

## Background

- Connectors already persist Base URL + API Key globally; model is chosen in chat ([docs/product/ai-connectors.md](../../../docs/product/ai-connectors.md)).
- `openaiCompatible.ts` can test/list models; needs streaming `chat/completions`.
- Studio UI is Tailwind + shadcn; `@lobehub/ui` peers antd/motion — scoped ThemeProvider under chat only.
- Film tasks / Skills / project context are documented later work; this MVP is a plain chat shell.

## Requirements

- **R1** StudioShell nav item「对话」first → `/agent` (studio `/` redirects here). 「项目」is `/projects`.
- **R2** Multi-thread UI: create / switch / rename / delete threads; messages persist in IndexedDB.
- **R3** Per-thread (or session) connector + model selection: list from connected connectors; models via probe + free-text; no connector default model.
- **R4** Streaming chat against OpenAI-compatible `/chat/completions` (SSE); Stop cancels in-flight request.
- **R5** Chat UI uses `@lobehub/ui` (Markdown, layout primitives, etc.) with scoped providers; rest of app stays shadcn.
- **R6** Chat tables **not** exported in project ZIP (same as connectors).
- **R7** Empty / no-connector state links to `/connectors`.

## Out of scope

- Film tasks, Skills, Canon/Lessons injection, project/episode binding
- MCP / desktop tools / tool-calling UI beyond plain text
- App-wide migration to `@lobehub/ui`
- Project-page chat drawer (later shortcut)
- Image/file multimodal (unless trivial; defer)

## Acceptance criteria

- [ ] From studio nav, open `/agent` and create a thread; refresh keeps history.
- [ ] With a saved connector, pick model, send a message, see streaming assistant text; Stop works.
- [ ] Without connectors, UI explains and links to「连接」.
- [ ] Chat chrome uses `@lobehub/ui` and stays scoped; studio pages keep shadcn. Shared highlight tokens (`--brand` / `--primary` / `--ring`) are white.
- [ ] Project ZIP still excludes chat + connector secrets.
- [ ] `pnpm lint` / `pnpm test` pass.

## Key decisions

| Topic | Choice |
| --- | --- |
| UI library | `@lobehub/ui` **chat-only** |
| UI fidelity | Target LobeHub Conversation look: welcome home (centered greeting + composer; left Agent/任务 + `+`; connector lives inside the model dropdown), chat mode (topic sidebar with time groups +「开启新话题」, bubble stream, floating rounded composer with send / stop) |
| MVP depth | Plain chat shell; features later |
| Persistence | Dexie threads + messages; not in ZIP |
| Placement | Dedicated `/agent` page; shortcuts later |
| **UI source of truth** | **Copy UI composition from lobehub** (`src/features/Conversation`, `ChatInput`) using `@lobehub/ui`; keep Cuepoint Dexie + connectors. Do **not** vendor lobehub zustand stores. |

## Risks / deferred

- Dual design systems (antd vs Tailwind) — contain with chat-scoped ThemeProvider.
- Some proxies lack SSE — fall back to non-stream JSON if needed.
- `@lobehub/ui` peer/version friction with React 19 — pin compatible set during install.
- **LobeHub source coupling**: `lobehub/src/features/Conversation` + `ChatInput` depend on `@/store/chat|agent|user` — cannot wholesale vendor without half the monorepo. Open question: port UI composition 1:1 vs attempt full feature transplant.
