# Implement — Mobile shell, agent layout, title search

1. Chrome cleanup: remove 分享 / 分栏 / 助理档案; change `handleNewTopic` to create + open empty thread (not home).
2. Add shadcn `Sheet` if missing.
3. `StudioShell`: `md` rail vs hamburger + studio nav Sheet; shared `NAV`.
4. Extract topic list body; mobile agent topic Sheet; hide permanent sidebar below `md`.
5. Title search helper + UI; replace 「搜索」toast.
6. Spec notes; `pnpm lint` && vitest title filter.

## Validation

- Manual: iPhone width drawers; desktop rail; search titles; new topic → `/agent/$id` empty chat; no share/columns/助理档案.
- Automated: `filterThreadsByTitle` tests.

## Risky files

- `AgentChatPage.tsx` (new topic), `ChatWorkspace.tsx`, `TopicSidebar.tsx`, `StudioShell.tsx`, new `sheet.tsx`
