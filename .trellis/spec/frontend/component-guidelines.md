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

Do not put library grids and detail editors in the same route file. Do not put durable writes in route files — call the concrete business command owner in `src/db/` from the feature page / widget (see the D02 owner map in state-management).

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

- Explicit user preference (2026-09-22): build new audio/music and other workspaces with the existing `src/components/ui/` component library and shared theme tokens. Avoid a parallel visual system for one feature.
- Do not use decorative left-border accent strips on panels, script rows, cards or selected list items. Communicate grouping/selection with typography, spacing, neutral separators and restrained surface changes. Functional track colors and visible keyboard focus remain meaningful UI.
- Avoid excessive nested rounded rectangles and oversized corner radii by reducing redundant card wrappers. Keep the existing shadcn Button/Input/Textarea/Select default radius, borders, shadows and focus styling; do not flatten controls into sharp rectangles or override all controls with feature-level radius rules. User clarified this explicitly on 2026-09-22. Existing application-shell geometry remains its own contract.

- Tailwind v4 + CSS variables in `src/styles.css`. Merge classes with `cn` from `src/lib/utils.ts`.
- Variants via `cva` on primitives (`buttonVariants` in `button.tsx`). Pass `className` through `cn(buttonVariants({ variant, size, className }))`.
- Icons: `lucide-react` (e.g. `ChevronLeft` on detail back links).
- shadcn config: `components.json` (style `new-york`, `cssVariables: true`, alias `@/components/ui`).
- Decorative motion respects reduced motion (`ClickSpark` in `StudioShell`, `@media (prefers-reduced-motion: …)` in `styles.css`).
- Agent chat (`src/components/agent/`) is the only place that uses `@lobehub/ui` + antd ThemeProvider. Do not wrap StudioShell. Spacing there uses the 4px scale in `agentTheme.ts` (`SPACE`: 4 / 8 / 12 / 16 / 24 / 32). Body text is 12 / 14 / 16 — do not introduce 13px. Model chips in the composer use `@lobehub/icons` `ModelIcon`. Agent canvases are transparent and inherit the shared StudioShell content surface. Do not add another rounded frame to the chat column. Studio highlight tokens (`--brand` / `--primary` / `--ring`) are white, not teal.
- Composer inset lives on native `.agent-composer` in `agentChat.css` (`padding: … !important`). Do **not** put that inset on `--lobe-flex-padding` / `.lobe-flex`: Tailwind v4 `* { padding: 0 }` and `:where(.lobe-flex) { padding: var(--lobe-flex-padding) }` both have zero specificity, so they cancel and the send control sits flush on the card. `ChatInputArea.Inner` also used `padding-block: 0` + `height: 100%` and made it worse. Host antd/lobe dropdowns with `getPopupContainer` → `.agent-chat-root` (theme CSS + ChatWorkspace `pointer-events: none` overlay).
- Conversation detail (`ChatWorkspace`): `@lobehub/ui/chat` `ChatHeader` is `position: absolute; height: 52px`, borderless and transparent, with a non-interactive `::before` radial mask that fades its dark background into the transcript. Mask only the background, never the title/actions. `.agent-chat-column` fills its parent without additional margins, borders or corner rounding; expanded editing stays inside this same column. Agent containers use parent-relative heights, not viewport minimum heights, so they fit inside the inset application surface. Popovers remain portalled to `.agent-chat-root` so the surface cannot clip them. Message list and `.agent-composer-dock` share `.agent-content` (`max-width: 800px`, centered) as the safe-width column — do not let the composer go full-bleed. Topic sidebar is collapsible on `md+` (`sessionStorage` `cuepoint.agent.topicSidebarCollapsed`); below `md`, hide the permanent topic column and open `TopicListBody` in a left Sheet from the header panel control. 「开启新话题」creates an empty thread via `createChatThread` and navigates to `/agent/$threadId` (not HomeWelcome). 「搜索」filters thread **titles** with `filterThreadsByTitle` (local Dexie list only). Header actions are title `…` (rename/delete) + panel/topics toggle — no 分享 / 分栏 / 助理档案 stubs. Active thread is the route `/agent/$threadId` (home is `/agent`); do not keep the open thread only in React state. Missing `$threadId` uses liveQuery `get() ?? null` then `navigate({ to: "/agent", replace: true })` only when that result is for **this** route id — ignore a stale null left over from a previous `/agent` home query so create+navigate is not bounced back. Empty streaming assistant rows use `ThinkingMatrix` (3×3 column snakes) via `renderMessage` (`message=""`) plus ChatItem avatar `loading` — only while waiting for the first reasoning or content token; never static `"…"` or a React node as `message`. Run-backed messages render public reasoning inside the unified execution process; legacy messages without a run retain `ThinkingPanel` above the answer. Process folding, reminders and the turn rail follow [Agent Activity UI](./agent-activity-ui.md). Transcript scroll, row memo, and avatars: [Chat Performance](./chat-performance.md).
- `StudioShell` owns the application-wide frame: a #050505 page with a transparent, borderless navigation rail and a #111 content surface with a subtle 1px border, 16px radius and 8px outer spacing (12px / 4px on mobile). All studio routes share this surface; scrolling belongs inside it. Do not mount the dot field/grain behind page contents. The permanent 76px rail is `hidden md:flex`; below `md` use a top hamburger + left Sheet (`src/components/ui/sheet.tsx`) with the same `NAV` destinations. On `/agent*` hide the mobile brand row so ChatHeader is not doubled.
- Model dropdown groups by vendor via `groupModelsByVendor` in `src/lib/ai/modelVendors.ts`. Catalog ids are often `cc-gpt-4o` / `cc-gemini-…` — do **not** `^`-anchor `gpt-` / `gemini`. Keep o-series on a word boundary (`/\bo[1-9]/`) so `photo1` stays 其他. Connector chips (not a footer Select) switch the BYOK connector inside that same panel.

---

## Accessibility

- Studio utility navigation opens `/about` directly with the label 关于 on both desktop and mobile. The legacy `/settings` route redirects to `/about`. About owns sponsorship links and the original appreciation-code image, shown through the shared Dialog with a download link.

- Interactive primitives keep `focus-visible` ring tokens (`focus-visible:ring-ring/50 focus-visible:ring-[3px]` on `Button`, `Input`, `Select`, etc.).
- Decorative canvases / icons that must not be announced: `aria-hidden` (`ClickSpark` canvas; shell SVG in `StudioShell`).
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
- `src/lib/formFieldFocus.ts`
- `components.json`


Optional creative fields, output settings, props/style dialogs and media reuse follow [Asset / Output Foundation](./asset-output-foundation.md). Do not add duplicate per-provider selectors or make optional metadata required at creation.

## Shot editor interaction and rendering (2026-09-21)

- Duration text retains decimal punctuation while focused; valid numeric drafts use serialized persistence and the project backup barrier. Invalid text remains editable, and failed writes expose retry.
- Global shot shortcuts yield to native buttons/links/summaries, ARIA button/link controls, inputs, overlays, and DnD handles. Do not cancel an event until the shortcut has a valid target.
- Shot rows keep 160px anchors and DnD registration for all filtered records. A shared IntersectionObserver mounts editing controls within 640px of the scrollport; active/focused/dragging rows stay mounted. Placeholder focus must reveal controls and preserve Tab access. Deep links scroll directly to the existing anchor; filters, ordering, exports, and selection use the full scoped data.
- When adjusting this behavior, check last-row deep links, Tab across unloaded rows, keyboard drag, and pointer drag across a scrolling boundary. The ready benchmark measures the complete anchor shell and first editable row, not eagerly mounted offscreen controls.


## D03 feature responsibility contract (2026-10-08)

### 1. Scope / Trigger

Maintain these boundaries when changing shot editing, audio/music workspace commands, chat execution/selection, project landing, or ZIP package import/export. Feature pages own routing, visible feedback and UI interaction lifetimes. Named commands own an actual business sequence; pure codecs own data validation/remapping without persistence. Do not introduce an action registry or factory solely to reduce a file's line count.

### 2. Signatures / Owners

- `components/shots/shotEditorCommands.ts`: `applyShotBulkCommand({episodeId, selectedIds, patch, label})`, `deleteShotSelectionCommand({episodeId, selectedIds})`, and `reorderShotGroupCommand({episodeId, fullOrder, groupIds, activeId, overId})` return `Promise<UndoAction | undefined>`.
- `useShotEditorKeyboard(input)` owns its capture listener and typed callbacks. `ShotRow.tsx` owns row/sortable/viewport/slot presentation; `ShotRelationsEditor.tsx` owns relationship pending/error/retry state. `shotColumnFields.ts` maps nine text columns to their actual string fields and builds typed patches; duration/characters/scene use their dedicated editors.
- `components/audio/audioSelection.ts`: `deriveAudioSelection(snapshot, previous, intent)` returns a partial selection patch and optional seek data. Its named segment/clip/take/saved cases retain their distinct rules. The page produces seek-request tokens and owns displayed state.
- `lib/audio/buffers.ts`: `loadBuffers(schedule)` and `loadAudioBuffer(mediaId)` share playback, waveform and export decoding/cache. `exportAudioMix({projectId, projectName, chapterId, scope})` accepts `NonNullable<AudioExport["scope"]>` (chapter/project) and returns the persisted WAV Blob/name/attenuation result; the UI owns download/notice.
- `components/music/switchMusicVariant.ts`: `switchMusicVariant({projectId, draftId, target, links})` returns the resulting draft ID and variant links. The page owns synchronous action/submission locks and best-effort storage of links.
- `useChatExecutionSession(threadId)` owns `sending`, controller/thread/lock refs and `acquire()`/`release(token)`. `chatExecutionFlows.ts` exposes three named flows: `executeNewChatMessage`, `retryFrozenChatRun`, and `resolveChatRunAction`. `useChatSelection(...)` owns one current selection snapshot and revisioned setters; reference drafts remain in `useReferenceDraft`.
- `importStudioProject(file)` is the shared import feedback adapter for gallery/shell. `ProjectHomePage({projectId})` owns keyed landing queries, project-kind routing and film first-episode repair. Route files remain adapters.
- `lib/packages/projectPackageCodec.ts` parses/remaps project rows; `audioPackageCodec.ts` parses/remaps audio/music rows. Shared `PackageError` has one constructor in `packageError.ts`; existing root package exports preserve that identity. Root `projectPackage.ts` and `audioProjectPackage.ts` retain ZIP/media IO and persistence orchestration.

### 3. Contracts / Invariants

- Bulk undo uses the repository's atomic inverse; deletion undo uses its actually deleted rows and retained Blobs. UI render snapshots cannot replace those results. Reordering retains its full-order inverse and filtered-group behavior; it does not invent a new revision protocol.
- Row extraction retains active/drag/viewport keep-alive and slot identity. Relationship checkboxes remain explicit membership intent; clear/bulk replacement stay distinct. Pending/error state still protects departure. D03 keeps the existing text-cell commit policy; D08 separately owns draft/baseline/retry behavior.
- Audio selection is a partial patch, not universal resetting. Repeated segment, missing clip/take, owner/chapter and saved-take transitions remain asymmetric. Player epoch/disposal, audition/seek/composition cleanup, pointer capture, Alt snapping and undo history remain Timeline-owned.
- Export executes flush → fresh immutable repository snapshot → schedule/decode/render outside writes → atomic `addAudioExport` → UI download. A render result is not persisted from live component data. Current fingerprint/scope/duration/evidence validation remains in the persistence command.
- Variant switching flushes, rereads the current draft, validates its project, reuses a legal target or creates one, then links it. Synchronous page action/submission locks cover the whole command. Storage failure does not retroactively turn a successful database command into failure.
- Chat acquires its synchronous lock before awaiting. A session token owns release; an old token cannot unlock a new session. Abort/effect cleanup does not release while transport's final flush is still running. Home binds the destination before navigation and moves only the captured reference owner; restoration is legal-owner guarded, and acknowledgement occurs only after begin succeeds.
- Retry uses the original frozen run connector/model. Run decisions are persisted before credential checks; cancellation does not require a connector. Selection reconciliation retains connector/base-URL/model/thread identity and increments mutation revision before awaiting. Optimistic field persistence remains field-local; no all-field rollback policy is added.
- ZIP parsing, raw modern-ID/FK validation, full audio metadata freshness, legacy normalization, remapping, hashing and compression remain outside writes where required. Modern raw relationships are checked before tolerant parsers can repair/drop them; full fingerprint validation precedes schema allowlisting. The root import saves the entire project/media/production/audio graph in one complete transaction. A late audio relationship failure rolls back earlier inserted rows and Blobs.
- Imported paid-job history remains sanitized/manual/dormant; mounting, focusing and polling an imported project cannot resume paid work. Snapshotting and export history retention stay compatible with the existing C contracts.

### 4. Validation / Error Matrix

| Condition | Required behavior |
| --- | --- |
| No effective bulk/delete/reorder result | No fabricated undo action |
| Save/relation/variant/export failure | Existing visible feedback/retry/draft guard remains; no partial success notice |
| Decode/render failure | No export/media rows and no download |
| Route/stop/effect replay during chat | Abort the owner, retain lock until its final flush, preserve other owners' unsent drafts |
| Begin fails after home navigation | Keep transferred owner and a visible retry without creating a second topic |
| Missing connector after approval decision | Persist the decision, expose recoverable error; do not replay a paid request |
| Invalid raw package FK, stale fingerprint, or late audio relation | Actionable public package error; no partial imported graph |
| Imported running history | Sanitize to dormant/manual; no provider call on mount/focus/poll |

### 5. Good / Base / Bad Cases

- Base: a bulk shot patch returns its atomic inverse and produces one undo action; repeated audio segment selection retains the existing take/seek behavior.
- Good: a home chat navigation transfers the frozen reference payload while later home edits survive; an abort still holds the execution lock until final flush completes.
- Good: native video/audio/music ZIP round-trips preserve accepted rows; a forced late audio validation failure observes earlier inserts and then rolls them all back.
- Bad: rebuilding an inverse from rendered rows, acknowledging references before begin, releasing on abort before flush, saving a live audio snapshot, validating only allowlisted fingerprints, or importing table groups in separate transactions.

### 6. Tests Required

Use the real command/controllers and actual module mock identities. Cover repository-result undo, typed selection intent, lock/epoch/effect replay and frozen retry/approval sequencing. Retain B01 unavailable/dirty navigation and B07 actual history/reference-owner cases. Package regressions must use real ZIP bytes, current raw relationships, fingerprint boundaries, observed pre-fault writes and all-table rollback. Native audio verifies decode/render/cache/persistence, not acoustic quality. Preserve failed fixture attempts and prove a fault was reached; do not weaken assertions or increase timeouts to hide setup errors.

### 7. Migration / Limits

Every moved owner has an actual caller. `productionContext.ts` and `generationIntent.ts` receive comment-only historical boundary markers. Their bodies/public APIs are unchanged, and their only current value consumers are the two corresponding test files; the latter also type-imports `ProductionContext`. They are not claimed as active production owners. Active paid/resumable execution remains in the existing agent runtimes; E07 separately owns dead-export/reference cleanup. The audio persistence root also retains pre-existing parse/remap compatibility exports without inventing consumers; the project codec calls the pure audio codec directly. No D04 context snapshot, D05 schema/serializer, D06 capability, D07 transport or D08 text-draft contract is advanced by D03. Existing page/import/keyboard complexity remains explicitly measured; improved inherited metrics are not a claim of a clean formal static gate. Browser fixtures use controlled local transport, with zero external/provider requests, and do not establish full live-provider E2E coverage.

Shot and beat scalar text uses `TextDraftField` through `ShotTextField`/`BeatTextField`; see `state-management.md` D08. Key the captured persistence callback by project/entity/field, retain immediate local text and visible retry/latest state, and preserve existing duration/relationship/slot/reorder owners. Pending missing/virtualized rows retain readability and existing route/backup barriers.
