# Design — Mobile shell, agent layout, title search

## Breakpoint

Use Tailwind `md` (768px):

- `< md`: mobile chrome
- `≥ md`: current desktop shell

Prefer CSS/`md:` visibility over JS media listeners where possible; drawers still need open state in React.

## Studio shell

`StudioShell` today always renders the 76px `<aside>`.

Mobile:

- Hide aside (`hidden md:flex`).
- Add a thin top bar (or overlay control on the main column) with Menu (hamburger) + logo/brand.
- Drawer content: same `NAV` items + import/settings footer actions. Use shadcn **Sheet** (add via existing ui pattern if missing) — left side, ~280px, closes on navigate / outside.
- Main content `flex-1 min-w-0` so chat cannot force horizontal scroll.

Desktop: unchanged rail; no hamburger.

## Agent chat

`ChatWorkspace` / `TopicSidebar`:

- Desktop (`md+`): keep collapsible topic sidebar as today (without 助理档案).
- Mobile: topic list in a Sheet; open from ChatHeader (panel icon). Prefer opening the drawer over remounting home.
- Remove ChatHeader **分享** and **分栏** ActionIcons entirely; keep rename/delete via `…` and sidebar collapse / mobile topic toggle as needed.
- 「开启新话题」: `createChatThread` → `navigate({ to: "/agent/$threadId", params })` — never `openHome()` / HomeWelcome.

## Search (titles only)

- Extract pure helper e.g. `filterThreadsByTitle(threads, query)` in `src/components/agent/` or `src/lib/`.
- TopicSidebar (and mobile drawer reuse): local `useState` query string; 「搜索」toggles an inline search field (or focuses it) instead of toast.
- Filter before `groupThreadsByTime`; empty/whitespace query = all threads.
- Case-fold with `toLocaleLowerCase("zh-CN")` or simple `toLowerCase()` — document choice in helper test.

## Components to add/reuse

| Piece | Approach |
| --- | --- |
| Sheet/Drawer | Add `src/components/ui/sheet.tsx` (shadcn new-york) if absent |
| Studio mobile header | Small block inside `StudioShell` |
| Shared `NAV` | Keep single `NAV` constant; map in rail + drawer |
| Topic list body | Extract list rendering so desktop sidebar and mobile drawer share one child |

## Risks

- Double headers (studio bar + agent ChatHeader) on mobile — keep studio bar minimal (menu + brand) or hide brand when path is `/agent*`.
- Sheet z-index vs lobe dropdowns — portal to body; agent popups already prefer `.agent-chat-root`.
- ClickSpark wrapping shell — ensure menu button still receives clicks.
