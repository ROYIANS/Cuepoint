# Mobile shell, agent chat layout, and topic search

## Goal

Make Cuepoint usable on narrow viewports: relocate the always-on studio sidebar into a hamburger drawer, adapt Agent conversation chrome (LobeHub-inspired), ship **话题标题搜索**, and remove unused Agent chrome placeholders.

## Background

- Desktop: `StudioShell` 76px icon rail + (on `/agent`) `TopicSidebar` ~260px + chat — three columns.
- LobeHub mobile: header + session/topic drawer (~280px), safe-area chat header; no permanent dual sidebar.
- Agent 「搜索」is currently a toast placeholder (`TopicSidebar.tsx`).
- 「开启新话题」today calls `openHome()` → `/agent` welcome (`AgentChatPage.handleNewTopic`).
- ChatHeader still has toast placeholders: 分享、分栏；sidebar has 助理档案 toast.
- Keep: `/agent/$threadId`, reasoning panel, ThinkingMatrix, scroll helpers.

## Requirements

- **R1** Below `md` (768px): hide the permanent studio rail; header hamburger → **drawer** with studio destinations. At `md+`, keep today’s rail.
- **R2** Below `md` on `/agent`: hide permanent topic sidebar; topics via drawer; full-width chat; composer safe-area; no horizontal overflow.
- **R3** 「搜索」filters topic list by **thread title** (case-insensitive substring). Local Dexie only. Empty query = full list. No message-body search.
- **R4** Desktop (`md+`) keeps rail + topic sidebar layout (minus removed chrome below).
- **R5** Remove Agent UI placeholders: ChatHeader **分享** and **分栏**; sidebar **助理档案**. Do not leave toast stubs.
- **R6** 「开启新话题」must **not** navigate to `/agent` home welcome. Create a new empty thread (`createChatThread`) and open `/agent/$threadId` (ChatWorkspace + empty list + composer). Abort any in-flight stream and clear draft as today.

## Out of scope

- Message-body / full-text search
- Native app / PWA push
- Redesigning non-agent page interiors beyond shell chrome
- Server search index
- Implementing 分享 / 分栏 / 助理档案 / 任务 for real (任务 row may remain as later placeholder or be left as-is unless we strip it — **keep 任务 toast for now**; only remove what the user named)

## Acceptance Criteria

- [ ] Phone-width: no permanent 76px rail; hamburger opens studio nav drawer; links navigate and close drawer.
- [ ] Phone-width `/agent`: no permanent topic column; topics from drawer; select thread works.
- [ ] Desktop (`md+`): rail + topic sidebar layout preserved (without removed controls).
- [ ] 「搜索」filters titles live; no toast placeholder.
- [ ] No 分享 / 分栏 / 助理档案 controls in Agent UI.
- [ ] 「开启新话题」lands on a new empty `/agent/$threadId`, not HomeWelcome.
- [ ] `pnpm lint` passes; unit test for title filter helper.

## Decisions (locked)

| Decision | Choice |
| --- | --- |
| Mobile studio nav | Header hamburger → drawer |
| Agent topics on mobile | Off-canvas drawer |
| Search scope | Thread titles only |
| Breakpoint | Tailwind `md` (768px) |
| Share / columns / 助理档案 | Remove |
| 开启新话题 | New empty thread route, not home |

## Notes

- Phases: (1) chrome cleanup + new-topic behavior (2) StudioShell mobile drawer (3) Agent mobile drawers (4) title search.
