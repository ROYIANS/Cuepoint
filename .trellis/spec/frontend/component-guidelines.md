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
4. Ownership check when `back.kind === "project"` (`character.projectId !== back.projectId` → missing).
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
- Callbacks that persist: `onSave: (slot: GenerationSlot) => void` — callers wrap with `void setCharacterSlot(...)`.
- UI primitives extend host element props: `React.ComponentProps<"button"> & VariantProps<typeof buttonVariants> & { asChild?: boolean }` (`button.tsx`).
- Use `asChild` + Radix `Slot` when a primitive should render as another element.

---

## Forms and Generation Slots

- Label + control: wrap with `Field` from `src/components/ui/field.tsx` (`label` + `children`).
- Controlled inputs bind Dexie row fields and patch on every change:

```tsx
<Field label="名称">
  <Input
    value={character.name}
    onChange={(event) => void patchCharacter(character.id, { name: event.target.value })}
  />
</Field>
```

- Image/video generation tiles use `EditableGenerationSlot` (`projectId`, `slot`, `variant`, `title`, `onSave`). Do not fork a second slot editor for assets/shots.

---

## Styling Patterns

- Tailwind v4 + CSS variables in `src/styles.css`. Merge classes with `cn` from `src/lib/utils.ts`.
- Variants via `cva` on primitives (`buttonVariants` in `button.tsx`). Pass `className` through `cn(buttonVariants({ variant, size, className }))`.
- Icons: `lucide-react` (e.g. `ChevronLeft` on detail back links).
- shadcn config: `components.json` (style `new-york`, `cssVariables: true`, alias `@/components/ui`).
- Decorative motion respects reduced motion (`StudioField` + `@media (prefers-reduced-motion: …)` in `styles.css`).

---

## Accessibility

- Interactive primitives keep `focus-visible` ring tokens (`focus-visible:ring-ring/50 focus-visible:ring-[3px]` on `Button`, `Input`, `Select`, etc.).
- Decorative canvases / icons that must not be announced: `aria-hidden` (`StudioField` canvas; shell SVG in `StudioShell`).
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
- English-only loading/empty strings when neighboring copy is Chinese.
- Ignoring `isFormFieldTarget` when adding shot keyboard shortcuts.

---

## References

- `src/components/assets/CharacterDetailPage.tsx`
- `src/components/slots/GenerationSlotCard.tsx`
- `src/components/ui/button.tsx`, `field.tsx`
- `src/components/studio/StudioField.tsx`
- `src/lib/formFieldFocus.ts`
- `components.json`
