# Agent chat reasoning / thinking display

## Goal

Show model **reasoning / thinking** from OpenAI-compatible chat streams in Cuepoint `/agent`, using a LobeHub-like collapsible Thinking block above the assistant answer. Do not vendor LobeHub ConversationStore.

## Background

- Cuepoint today only parses `choices[0].delta.content` in `src/lib/ai/chatStream.ts`; reasoning fields are ignored.
- `ChatMessage` has `content` + `status` only; `updateChatMessage` only patches those fields (`src/db/repo.ts`).
- Empty streaming UI is `ThinkingMatrix` + avatar loading — a **waiting** affordance, not model reasoning text.
- LobeHub reference (UI + stream lifecycle only):
  - `features/Conversation/components/Thinking/` — Accordion; `setShowDetail(!!thinking)` auto-opens while reasoning and **auto-collapses when `thinking` becomes false**.
  - Reasoning op completes on **first answer `text` or `tools_calling` chunk** (`gatewayEventHandler` / tests: *completes the reasoning op when text starts streaming*).
  - Title: thinking → 「思考中」; done → duration label; user can reopen.
  - Wire: commonly `delta.reasoning_content` (DeepSeek / Qwen / ZhiPu-style); also accept `delta.reasoning` string if present.

## Requirements

- **R1** Parse streaming (and JSON fallback) reasoning deltas separately from answer `content`.
- **R2** Persist `reasoning` (+ optional `reasoningDurationMs`) on the assistant `ChatMessage` in Dexie so refresh keeps it.
- **R3** Render a collapsible Thinking panel above the answer (title + duration + markdown body), scoped under existing agent `@lobehub/ui` theme.
- **R4** Match LobeHub collapse timing: expanded while reasoning is active; **auto-collapse on first answer content delta**; user can expand again. When reasoning text is streaming, show the Thinking panel (not only ThinkingMatrix). Matrix remains for empty wait before any reasoning/content.
- **R5** No virtua / ConversationStore. No native dialogs. No request-side thinking toggles in MVP.

## Out of scope

- `reasoning_effort` / `enable_thinking` request params
- Re-injecting prior reasoning into follow-up requests
- Multimodal / encrypted Responses-API `responseItems`
- Citations inside thinking
- Tool-call interleave beyond “first tools chunk ends reasoning” if we lack tools UI (still end reasoning on first content)

## Acceptance Criteria

- [ ] Model streaming `reasoning_content` shows thinking separately from the final answer.
- [ ] Thinking panel auto-expands during reasoning and auto-collapses when answer text starts; manual reopen works after.
- [ ] Refresh keeps reasoning (+ duration when available).
- [ ] Models with no reasoning: no empty Thinking chrome; matrix/avatar wait unchanged.
- [ ] Unit tests: SSE parse separates reasoning vs content; first content ends “in reasoning”.
- [ ] `pnpm lint` passes.

## Decisions (locked)

| Decision | Choice |
| --- | --- |
| Collapse timing | Follow LobeHub: collapse when answer text starts |
| Duration in title | Yes, when reasoning ends |
| Persist in Dexie | Yes |
| Request-side thinking knobs | Out of MVP |
