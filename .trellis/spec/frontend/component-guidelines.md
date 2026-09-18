# Component Guidelines

> How components are built in this project.

---

## Overview

Routes are thin. Feature pages under `src/components/{studio,assets,shots,story,produce,workspace,slots,media}/` own UI and data wiring. Primitives live in `src/components/ui/` (shadcn new-york + Radix + CVA). Chinese UI copy is normal.

---

## Layering

| Layer | Responsibility | Example |
| --- | --- | --- |
| Route | Params + discriminant props only | `src/routes/_studio.characters.$characterId.tsx` → `CharacterDetailPage` with `back={{ kind: "studio" }}` |
| Feature page | Live queries, layout, mutations | `src/components/assets/CharacterDetailPage.tsx` |
| Shared feature widget | Reused editors/tiles | `EditableGenerationSlot` in `src/components/slots/GenerationSlotCard.tsx` |
| UI primitive | Presentational, no Dexie | `src/components/ui/button.tsx`, `field.tsx` |

Do not put library grids and detail editors in the same route file. Do not put durable writes in route files — call `src/db/repo.ts` from the feature page / widget.

---

## Component Structure

Typical feature page shape (see `CharacterDetailPage`):

1. Props with route discriminants (`characterId`, `back`).
2. `useLiveQuery` with `get(id) ?? null`.
3. Loading / missing early returns (Chinese: 加载中… / 找不到这个角色).
4. Ownership check for both contexts: project IDs must match `back.projectId`; studio routes require `STUDIO_LIBRARY_ID`.
5. Layout + `Field` / `EditableGenerationSlot` / inline `void patch*(...)`.

```tsx
export function CharacterDetailPage({
  characterId,
  back,
}: {
  characterId: string;
  back: { kind: "studio" } | { kind: "project"; projectId: string };
}) {
  const character = useLiveQuery(
    async () => (await db.characters.get(characterId)) ?? null,
    [characterId],
  );
  // loading / missing / render…
}
```

Primitives export named functions (not default exports): `Button`, `Field`, `buttonVariants`.

---

## Props Conventions

- Prefer inline prop types on the function signature for page/widget props (as in `CharacterDetailPage`, `EditableGenerationSlot`).
- Discriminated unions for context: `back: { kind: "studio" } | { kind: "project"; projectId: string }`.
- Callbacks that persist: `onSave: (slot: GenerationSlot) => Promise<void>` — return the repo promise. Await success before close; keep failed drafts open for retry.
- UI primitives extend host element props: `React.ComponentProps<"button"> & VariantProps<typeof buttonVariants> & { asChild?: boolean }` (`button.tsx`).
- Use `asChild` + Radix `Slot` when a primitive should render as another element.

---

## Forms and Generation Slots

- Label + control: wrap with `Field` from `src/components/ui/field.tsx` (`label` + `children`).
- Asset text uses `AssetTextField` with a scoped keyed `useDebouncedDraft`, saving/error/retry feedback, and field-only repo patches. Do not bind an actively edited input directly to a live database row. `Field` associates label and child control IDs.
- Slot dialogs track only uploads they created; cancellation/replacement cleans orphan uploads, including late completion after unmount. Disable overlapping save/upload/close while a commit is pending. Never delete shared committed media.
- Preview tiles remain buttons; inspection inside dialogs uses full-image `object-contain` or video controls outside clickable tile buttons. Removal controls must remain keyboard-focusable and visible on touch devices.
- Image/video generation tiles use `EditableGenerationSlot` (`projectId`, `slot`, `variant`, `title`, `onSave`). Do not fork a second slot editor for assets/shots.

---

## Styling Patterns

- Tailwind v4 + CSS variables in `src/styles.css`. Merge classes with `cn` from `src/lib/utils.ts`.
- Variants via `cva` on primitives (`buttonVariants` in `button.tsx`). Pass `className` through `cn(buttonVariants({ variant, size, className }))`.
- Icons: `lucide-react` (e.g. `ChevronLeft` on detail back links).
- shadcn config: `components.json` (style `new-york`, `cssVariables: true`, alias `@/components/ui`).
- Decorative motion respects reduced motion (`ClickSpark` in `StudioShell`, `@media (prefers-reduced-motion: …)` in `styles.css`).
- Agent chat (`src/components/agent/`) is the only place that uses `@lobehub/ui` + antd ThemeProvider. Do not wrap StudioShell. Spacing there uses the 4px scale in `agentTheme.ts` (`SPACE`: 4 / 8 / 12 / 16 / 24 / 32). Body text is 12 / 14 / 16 — do not introduce 13px. Model chips in the composer use `@lobehub/icons` `ModelIcon`. Agent canvases are transparent and inherit the shared StudioShell content surface. Do not add another rounded frame to the chat column. Studio highlight tokens (`--brand` / `--primary` / `--ring`) are white, not teal.
- Composer inset lives on native `.agent-composer` in `agentChat.css` (`padding: … !important`). Do **not** put that inset on `--lobe-flex-padding` / `.lobe-flex`: Tailwind v4 `* { padding: 0 }` and `:where(.lobe-flex) { padding: var(--lobe-flex-padding) }` both have zero specificity, so they cancel and the send control sits flush on the card. `ChatInputArea.Inner` also used `padding-block: 0` + `height: 100%` and made it worse. Host antd/lobe dropdowns with `getPopupContainer` → `.agent-chat-root` (theme CSS + ChatWorkspace `pointer-events: none` overlay).
- Conversation detail (`ChatWorkspace`): `@lobehub/ui/chat` `ChatHeader` is `position: absolute; height: 52px`, borderless and transparent, with a non-interactive `::before` radial mask that fades its dark background into the transcript. Mask only the background, never the title/actions. `.agent-chat-column` fills its parent without additional margins, borders or corner rounding; expanded editing stays inside this same column. Agent containers use parent-relative heights, not viewport minimum heights, so they fit inside the inset application surface. Popovers remain portalled to `.agent-chat-root` so the surface cannot clip them. Message list and `.agent-composer-dock` share `.agent-content` (`max-width: 800px`, centered) as the safe-width column — do not let the composer go full-bleed. Topic sidebar is collapsible on `md+` (`sessionStorage` `cuepoint.agent.topicSidebarCollapsed`); below `md`, hide the permanent topic column and open `TopicListBody` in a left Sheet from the header panel control. 「开启新话题」creates an empty thread via `createChatThread` and navigates to `/agent/$threadId` (not HomeWelcome). 「搜索」filters thread **titles** with `filterThreadsByTitle` (local Dexie list only). Header actions are title `…` (rename/delete) + panel/topics toggle — no 分享 / 分栏 / 助理档案 stubs. Active thread is the route `/agent/$threadId` (home is `/agent`); do not keep the open thread only in React state. Missing `$threadId` uses liveQuery `get() ?? null` then `navigate({ to: "/agent", replace: true })` only when that result is for **this** route id — ignore a stale null left over from a previous `/agent` home query so create+navigate is not bounced back. Empty streaming assistant rows use `ThinkingMatrix` (3×3 column snakes) via `renderMessage` (`message=""`) plus ChatItem avatar `loading` — only while waiting for the first reasoning or content token; never static `"…"` or a React node as `message`. Assistant `reasoning` renders in `ThinkingPanel` (`aboveMessage`) — expands while reasoning streams, auto-collapses on first answer content. Transcript scroll, row memo, and avatars: [Chat Performance](./chat-performance.md).
- `StudioShell` owns the application-wide frame: a #050505 page with a transparent, borderless navigation rail and a #111 content surface with a subtle 1px border, 16px radius and 8px outer spacing (12px / 4px on mobile). All studio routes share this surface; scrolling belongs inside it. Do not mount the dot field/grain behind page contents. The permanent 76px rail is `hidden md:flex`; below `md` use a top hamburger + left Sheet (`src/components/ui/sheet.tsx`) with the same `NAV` destinations. On `/agent*` hide the mobile brand row so ChatHeader is not doubled.
- Model dropdown groups by vendor via `groupModelsByVendor` in `src/lib/ai/modelVendors.ts`. Catalog ids are often `cc-gpt-4o` / `cc-gemini-…` — do **not** `^`-anchor `gpt-` / `gemini`. Keep o-series on a word boundary (`/\bo[1-9]/`) so `photo1` stays 其他. Connector chips (not a footer Select) switch the BYOK connector inside that same panel.

---

## Accessibility

- Interactive primitives keep `focus-visible` ring tokens (`focus-visible:ring-ring/50 focus-visible:ring-[3px]` on `Button`, `Input`, `Select`, etc.).
- Decorative canvases / icons that must not be announced: `aria-hidden` (`StudioField` canvas; `ClickSpark` canvas; shell SVG in `StudioShell`).
- Slot tiles expose an accessible name via `ariaLabel` / `title` into `GenerationSlotTile`.
- Keyboard shortcuts in shot UI must yield when focus is in a form/overlay: gate with `isFormFieldTarget` from `src/lib/formFieldFocus.ts` (see `ShotEditorPage`).

---

## Examples

- Thin studio route: `src/routes/_studio.characters.$characterId.tsx`
- Shared asset editor: `src/components/assets/CharacterDetailPage.tsx` (also Scene/Prop/Style detail pages)
- Generation UI: `EditableGenerationSlot` in `src/components/slots/GenerationSlotCard.tsx`
- Primitive + CVA: `src/components/ui/button.tsx`
- Form label wrapper: `src/components/ui/field.tsx`

---

## Anti-patterns

- Fat routes that inline Dexie queries and full page markup instead of a `*DetailPage` / feature component.
- Studio create that opens a project picker or navigates to `/p/$projectId/...` (see state-management).
- New global form library or Zod schemas for every input — forms patch repo directly.
- Duplicating generation-slot dialogs instead of `EditableGenerationSlot`.
- Importing `antd/dist/reset.css` from Agent chat (leaks into studio `html`).
- Passing a React node as `@lobehub/ui/chat` `ChatItem.message` (it `String()`s to `[object Object]` — pass a string + `markdownProps`; for empty streaming use `renderMessage` → `ThinkingMatrix`).
- Putting model shortcut chips inside the composer box; the toolbar is left Agent/任务 + `+`, right ModelIcon trigger + send. Connector/vendor switching belongs inside the model dropdown.
- Putting composer inset on `.lobe-flex` padding vars (or `ChatInputArea` inner `padding-block: 0`) — send sits flush. Use `.agent-composer` native chrome.
- Toast stubs for Agent 「搜索」/ 分享 / 分栏 / 助理档案 — search filters titles; the others are removed, not placeholders.
- English-only loading/empty strings when neighboring copy is Chinese.
- Ignoring `isFormFieldTarget` when adding shot keyboard shortcuts.
- `window.prompt` / `window.alert` / `window.confirm` (native browser chrome titled like “localhost:5173 显示”). Use `Dialog` for rename/input and `AlertDialog` for destructive confirm — same pattern as `ProjectGalleryPage`.
- Wrapping `@lobehub/ui` `ActionIcon` in `Link` / `<a>` (it always renders a `button`). Navigate from `onClick` instead.

---

## References

- `src/components/assets/CharacterDetailPage.tsx`
- `src/components/slots/GenerationSlotCard.tsx`
- `src/components/ui/button.tsx`, `field.tsx`
- `src/components/studio/StudioField.tsx`
- `src/lib/formFieldFocus.ts`
- `components.json`


Optional creative fields, output settings, props/style dialogs and media reuse follow [Asset / Output Foundation](./asset-output-foundation.md). Do not add duplicate per-provider selectors or make optional metadata required at creation.
