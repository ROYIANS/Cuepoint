# Quality Guidelines

> Code quality standards for frontend development.

---

## Overview

Quality gate is TypeScript build + Vitest. There is no ESLint config; `pnpm lint` runs `tsc -b`. Tests cover pure lib helpers and `src/db/repo.ts` with `fake-indexeddb`, not React component RTL.

---

## Commands

| Command | What it does |
| --- | --- |
| `pnpm lint` | `tsc -b --pretty false` (typecheck) |
| `pnpm test` | `vitest run` |
| `pnpm build` | `vite build` |
| `pnpm dev` | Vite dev server |

Vitest setup: `vitest.config.ts` aliases `@` → `src`; `tests/setup.ts` resets Dexie via `fake-indexeddb` each test.

---

## Required Patterns

- Durable mutations only through repository modules `src/db/repo.ts`, `src/db/productionProposals.ts` and `src/db/agentRuns.ts` (`add*` / `patch*` / `delete*` / `set*Slot` / reorder helpers).
- Live reads with `useLiveQuery`; detail `get` queries use `?? null` (see hook-guidelines).
- Shot picture / generation data through `parseShotPictureSlots` / `parseGenerationSlot` so legacy fields stay readable.
- Filter, reorder, undo, draft, delivery, and shortcut-gating logic live in `src/lib/` and are shared — UI calls helpers, does not reimplement:
  - `shotFilters`, `reorderIds`, `undo`, `debouncedDraft`, `episodeDelivery`, `formFieldFocus`, `shotKeyboard`
- Studio asset create stays on studio routes with `STUDIO_LIBRARY_ID`; `touchProject` no-ops for the studio owner.
- Episode-scoped shot queries and delivery exports filter by both `projectId` and `episodeId`.
- Keyboard shortcuts call `isFormFieldTarget` before handling (`ShotEditorPage`).

---

## Forbidden Patterns

| Forbidden | Why / do this instead |
| --- | --- |
| Studio create → project picker or `/p/$projectId/...` | Navigate to `/characters\|scenes\|props\|styles/$id` |
| `useEffect` + one-shot `db.*.get` for live detail pages | `useLiveQuery` + `?? null` |
| Global Redux/Zustand/etc. for Dexie tables | `useLiveQuery` + repo mutations |
| Duplicating reorder/filter logic in the page | `reorderBeats` / `reorderShots` / shared filter helpers |
| Enabling export before live queries finish | Disable CSV/print until loaded (delivery-export) |
| Component RTL / Playwright as the default new test | Prefer `tests/*.test.ts` on lib + repo |
| Adding ESLint-only “fixes” without satisfying `tsc` | `pnpm lint` is the lint gate |
| `window.prompt` / `alert` / `confirm` | In-app `Dialog` (input) / `AlertDialog` (destructive) from `src/components/ui/` |
| `scrollIntoView({ behavior: "smooth" })` on Agent messages | `snapChatToBottom` on `.agent-message-list` (see chat-performance) |

---

## Testing Requirements

- Place tests under `tests/` as `*.test.ts`.
- Repo / IndexedDB behavior: use the shared setup that deletes and reopens `db` (`tests/setup.ts`, see `tests/repo.test.ts`).
- Pure helpers: unit-test without mounting React (`tests/undo.test.ts`, `debouncedDraft.test.ts`, `shotFilters.test.ts`, `formFieldFocus.test.ts`, `reorderIds.test.ts`, `episodeDelivery.test.ts`, `projectPackage.test.ts`).
- Cover invariants called out in other specs when touching those areas: studio `touchProject`, snapshot copy reject-on-duplicate, episode-scoped reorder ownership, delivery CSV quoting, form-field shortcut gating, agent chat `snapChatToBottom` / `CHAT_AT_BOTTOM_PX`.
- Do not require new component snapshot/RTL tests unless the change is untestable at the lib/repo layer.

---

## Accessibility and UX quality

- Keep focus-visible rings on interactive primitives (`src/components/ui/*`).
- Mark decorative motion/graphics `aria-hidden` (`StudioField`, `ClickSpark`).
- Prefer Chinese user-facing strings consistent with existing pages (加载中…, 找不到…).
- Honor `prefers-reduced-motion` for decorative animation (`StudioField`, `ClickSpark`, `src/styles.css`).

---

## Code Review Checklist

- [ ] `pnpm lint` and `pnpm test` pass for the change set
- [ ] Mutations go through `repo.ts`; no ad-hoc `db.table.put` in components unless matching existing rare patterns
- [ ] Detail liveQuery uses `get(id) ?? null`; missing id shows 找不到, not infinite 加载中
- [ ] Studio vs project ownership and `back` discriminants are correct
- [ ] Shot/episode scoping preserved (filters, reorder, delete, delivery)
- [ ] Shared helpers reused for filter/reorder/draft/undo/shortcuts
- [ ] Types imported with `import type` where needed; domain types not duplicated
- [ ] New durable behavior has or updates a `tests/` case when logic is in lib/repo

---

## Examples

- Repo invariants: `tests/repo.test.ts`
- Shortcut gating helper: `src/lib/formFieldFocus.ts` + `tests/formFieldFocus.test.ts`
- Delivery pure logic: `src/lib/episodeDelivery.ts` + `tests/episodeDelivery.test.ts`
- Typecheck gate: `package.json` script `lint`

---

## Anti-patterns

- Treating “no ESLint” as no quality bar — unused locals/params and strict nulls still fail `tsc`.
- Adding a second state library “just for this page.”
- Copy-pasting reorder or filter code into `ShotEditorPage` instead of extending `src/lib/`.
- Shipping package-import changes without updating `tests/projectPackage.test.ts`.

---

## References

- `package.json` scripts
- `vitest.config.ts`, `tests/setup.ts`
- `src/db/repo.ts`
- `src/lib/formFieldFocus.ts`, `reorderIds.ts`, `shotFilters.ts`, `episodeDelivery.ts`
- `.trellis/spec/frontend/hook-guidelines.md`, `state-management.md`, `delivery-export.md`
