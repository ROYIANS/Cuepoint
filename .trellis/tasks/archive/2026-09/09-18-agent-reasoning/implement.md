# Implement — Agent reasoning display

1. Extend `ChatMessage` + `updateChatMessage` / `appendChatMessage` for `reasoning` / `reasoningDurationMs`.
2. Refactor `chatStream` parse + tests: content vs `reasoning_content` / `reasoning`; wire `onReasoning`.
3. `AgentChatPage` send path: accumulate reasoning, duration on first content, persist patches.
4. Add `ThinkingPanel`; integrate in `MessageList` (matrix gate, memo fields, collapse = !reasoningActive).
5. Spec note in `component-guidelines.md` / `chat-performance.md` (one line each).
6. `pnpm lint` && targeted vitest (`chatStream`, any small pure helpers).

## Validation

- Manual: DeepSeek-R1 / Qwen thinking model → see expand → answer starts → auto-collapse → refresh keeps text.
- Manual: normal model → no Thinking chrome.
- Automated: SSE fixtures with only reasoning, only content, reasoning then content.

## Risky points

- Accordion API differences across `@lobehub/ui` versions — fallback to details/summary styled in `agentChat.css`.
- Dual liveQuery ticks while streaming reasoning + content — keep patches coalesced / field-compare memo.
- Inferring “reasoning active” wrong on abort mid-reasoning — still persist partial reasoning; collapse on abort/complete.
