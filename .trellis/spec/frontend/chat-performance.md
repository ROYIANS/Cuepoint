# Agent Chat Performance

> Cuepoint-sized contracts distilled from LobeHub Conversation (`src/features/Conversation/ChatList`), not a virtua port.

---

## Overview

LobeHub’s list is a `virtua` `VList` plus ConversationStore. Cuepoint threads are short, local Dexie rows. We copy the **scroll and render isolation** rules, not the virtualizer, spacer, or zustand.

Source of truth in LobeHub (do not vendor):

| LobeHub | Cuepoint |
| --- | --- |
| `VirtualizedList` + `virtua` | Plain `.agent-message-list` overflow |
| `overflowAnchor: 'none'` | Same CSS on `.agent-message-list` |
| `scrollToBottom(false)` while generating | `snapChatToBottom` (`scrollTop = scrollHeight`) |
| `AT_BOTTOM_THRESHOLD = 300` | `CHAT_AT_BOTTOM_PX` in `src/lib/chatScroll.ts` |
| AutoScroll only if `atBottom && isGenerating && !isScrolling` | `stickToBottom` ref; skip snap when user scrolled up |
| `paddingBottom` from composer overlay height | `--agent-chat-composer-safe` padding on the list |
| `MessageItem` keyed by id, `memo` + store selector | `AgentChatMessageItem` `memo` with field compare |
| `keepMounted` streaming rows (virtua recycle) | N/A until we virtualize |
| Conversation spacer (pin user turn to top) | Deferred |

---

## Signatures

```ts
// src/lib/chatScroll.ts
export const CHAT_AT_BOTTOM_PX = 300;

export function chatDistanceFromBottom(el: {
  clientHeight: number;
  scrollHeight: number;
  scrollTop: number;
}): number;

export function isChatNearBottom(
  el: { clientHeight: number; scrollHeight: number; scrollTop: number },
  thresholdPx?: number,
): boolean;

export function snapChatToBottom(el: { scrollHeight: number; scrollTop: number }): void;
```

`MessageList` owns the scroll element. Do not pass a sentinel `bottomRef` up to `AgentChatPage`.

---

## Contracts

- **Pin target**: the scroll container’s `scrollHeight` (content + list `padding-bottom`). That padding is the composer overlay safe area — same job as LobeHub’s `overlayHeight + 12`.
- **Instant while streaming**: `snapChatToBottom` is assignment, never `{ behavior: "smooth" }` and never `scrollIntoView`. Smooth animations abort each other on every SSE token and undershoot the padding.
- **User intent**: `onScroll` updates `stickToBottom` via `isChatNearBottom`. Wheel / drag that leaves more than 300px of room cancels follow until the user returns to the bottom.
- **Layout settle**: `ResizeObserver` on `.agent-content` re-snaps while pinned (markdown / images growing). One `requestAnimationFrame` snap on thread change covers the first paint.
- **History isolation**: Dexie `useLiveQuery` will still tick the parent. `AgentChatMessageItem` compares `id/content/status/role/createdAt/reasoning/reasoningDurationMs` so completed rows skip ChatItem + markdown. Hoist `markdownProps` and avatar meta; do not allocate them in the map.
- **Empty streaming**: while `status === "streaming"` and both `content` and `reasoning` are empty, `renderMessage` swaps in `ThinkingMatrix` (3×3 square cells; per-column length-2 snakes in order 1→2→3, bounce at top, may exit bottom; ~220ms tick); pass `message=""` so EditableMessage does not coerce a React node. Avatar `loading` stays on until the first answer token — ChatItem’s corner badge must be a hollow ring (transparent fill), not a solid `colorPrimary` disc. When `reasoning` is present, show `ThinkingPanel` above the answer instead of the matrix.
- **Avatars**: user = `boring-avatars` default export, stable `name={PRODUCT_NAME_EN}`; assistant = `LOGO_SRC`. Memo the React node once per list.

---

## Validation & Error Matrix

| Condition | Behavior |
| --- | --- |
| Thread id changes | `stickToBottom = true`, snap + rAF snap |
| SSE token while pinned | ResizeObserver and/or memo row update → `scrollTop = scrollHeight` |
| User scrolled up > 300px | No snap; streaming continues off-screen |
| User returns within 300px | Pin resumes |
| `scrollIntoView({ behavior: "smooth" })` on a sentinel | Forbidden — wrong ancestor and undershoot |

---

## Good / Base / Bad

- **Good**: last token paints only the streaming `ChatItem`; list `scrollTop` tracks `scrollHeight`; user can scroll up mid-stream.
- **Base**: empty or short thread still snaps (padding-bottom keeps the last line above the composer).
- **Bad**: `useEffect` depending on `messages.at(-1).content` that calls `scrollIntoView({ behavior: "smooth" })` — jank + not at bottom.

---

## Tests Required

`tests/chatScroll.test.ts`:

- Distance 300px → `isChatNearBottom` true; 301px false at default threshold.
- `snapChatToBottom` sets `scrollTop` to `scrollHeight`.
- Scrolled to `0` on a tall list → not near bottom.

No RTL for MessageList (quality-guidelines).

---

## Wrong vs Correct

#### Wrong

```tsx
useEffect(() => {
  bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
}, [messages?.at(-1)?.content]);
```

#### Correct

```tsx
if (stickToBottom.current) snapChatToBottom(listEl);
// AgentChatMessageItem memo: historical content/status unchanged → skip
```

---

## Design Decision: no virtua yet

**Context**: LobeHub virtualizes because a topic can be thousands of tool/markdown rows; recycling would replay markdown animations unless `keepMounted` keeps the streaming index alive.

**Decision**: Cuepoint Agent MVP is local plain chat. Isolating the last row + `scrollTop` is enough. Do not add `virtua` / `react-virtuoso` until a thread is large enough that mounting every `ChatItem` is the measured cost.

**Extensibility**: If we virtualize later, copy LobeHub `keepMounted` for `status === "streaming"` and keep `overflowAnchor: "none"`. Still do not vendor ConversationStore.

---

## Anti-patterns

- New `markdownProps={{ variant: "chat" }}` object on every map iteration (breaks ChatItem memo).
- New `avatar={{ ... }}` object per row per tick (same).
- `overflow-anchor: auto` on the transcript (browser anchoring fights programmatic `scrollTop` during stream).
- Porting LobeHub’s spacer / send-scroll animation window — that exists to pin the user turn to the top of the viewport; Cuepoint has not adopted that UX.

## Rich transcript loading

`ChatWorkspace` dynamically loads `MessageList` only when the current thread has messages. The empty welcome/composer and task board must not eagerly load Markdown's diagram/math/syntax dependencies. Suspense occupies the same transcript container with a Chinese loading status. This boundary never remounts `AgentChatPage` or owns a run: generation continues while the transcript module loads. Once mounted, the existing scroll, ResizeObserver and memo contracts above remain unchanged.

The full vendor icon catalog is a separate lazy module behind `ModelIcons`; keep named re-exports in `ModelIconCatalog` so dynamic import does not retain every unrelated package export. The icon fallback reserves the requested dimensions and is decorative. Provider and model names remain visible while icons load.
