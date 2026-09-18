# Type Safety

> TypeScript conventions in this project.

---

## Overview

Strict TypeScript (`tsconfig.app.json`: `strict`, `verbatimModuleSyntax`, `noUnusedLocals`, `noUnusedParameters`). Domain types and normalizers live under `src/domain/`. Path alias `@/*` → `src/*`. Zod is reserved for project-package import boundaries, not forms.

---

## Type Organization

| Location | What belongs there |
| --- | --- |
| `src/domain/types.ts` | `Id`, entity interfaces, const unions (`SHOT_STATUSES`), labels, normalizers (`normalizeShotStatus`, `normalizeShotFilters`) |
| `src/domain/slot.ts` | Slot parsers/helpers (`parseGenerationSlot`, `parseShotPictureSlots`, `emptySlot`, remap/collect) |
| `src/domain/columns.ts` | Shot column defs (`SHOT_COLUMNS`, `normalizeVisibleColumns`) |
| Feature / lib files | Local UI-only types next to the consumer (e.g. draft status in `debouncedDraft`) |
| `src/db/database.ts` | Imports entity types; table schemas use those types |

Shared branded-ish id type is plain `export type Id = string`. Studio vs project ownership uses `STUDIO_LIBRARY_ID` / `isStudioLibrary`, not a separate branded type.

Const array → union pattern:

```ts
export const SHOT_STATUSES = [
  "draft",
  "ready",
  "framed",
  "clipped",
  "approved",
] as const;

export type ShotStatus = (typeof SHOT_STATUSES)[number];
```

---

## Imports and Modules

- `verbatimModuleSyntax` requires `import type` for type-only imports:

```ts
import type { GenerationSlot, Id } from "@/domain/types";
import { patchCharacter, setCharacterSlot } from "@/db/repo";
```

- Prefer `@/` alias over deep relative paths from `src/`.
- Do not emit values from type-only modules incorrectly — keep runtime helpers (`normalizeShotStatus`, `parseGenerationSlot`) as value exports alongside types.

---

## Validation

### Domain / IndexedDB shape

Runtime shape repair uses hand-written normalizers and parsers, not Zod:

- `normalizeShotStatus` / `normalizeShotFilters` / `normalizeShotWorkspaceView` in `src/domain/types.ts`
- `parseGenerationSlot` / `parseShotPictureSlots` in `src/domain/slot.ts` (legacy `frame` / `reference` / media-id fields coalesced into slots)
- `normalizeVisibleColumns` in `src/domain/columns.ts`

Unknown or missing shot status becomes `"draft"`. Empty filter arrays mean “all”.

### Package import only

Zod schemas live in `src/lib/projectPackage.ts` (`manifestSchema`, passthrough record schemas) to validate zip/manifest boundaries (`PACKAGE_FORMAT`). Do not add Zod for `Field` / `Input` form validation.

---

## Common Patterns

- Discriminated unions for routing context: `back: { kind: "studio" } | { kind: "project"; projectId: string }`.
- Optional nested maps on entities (`character.slots?.[slot.id]`) with parsers supplying defaults.
- Type predicates in filters:

```ts
.filter((value): value is ShotStatus =>
  SHOT_STATUSES.includes(value as ShotStatus),
)
```

- `VariantProps<typeof buttonVariants>` for CVA-backed primitive props.
- Chinese labels paired with English status keys: `SHOT_STATUS_LABELS: Record<ShotStatus, string>`.

---

## Examples

- Entity + normalizers: `src/domain/types.ts` (`Character`, `Shot`, `ShotFilters`, `normalizeShotFilters`)
- Slot legacy parse: `src/domain/slot.ts` (`parseGenerationSlot`, `parseShotPictureSlots`)
- Column catalog: `src/domain/columns.ts`
- Zod package boundary: `src/lib/projectPackage.ts`
- `import type` usage: `src/components/slots/GenerationSlotCard.tsx`, `src/db/database.ts`

---

## Forbidden Patterns

- Introducing Zod (or another schema lib) for every form field — patch repo with string/number values directly.
- Defining duplicate `Shot` / `GenerationSlot` interfaces inside components instead of importing from `src/domain/`.
- Treating raw Dexie JSON as trusted without going through slot/status normalizers when reading legacy fields.
- Value imports of types under `verbatimModuleSyntax` (breaks `pnpm lint` / `tsc -b`).
- Using `any` for entity blobs; prefer `unknown` + narrow, or `Record<string, unknown>` inside parsers.

---

## References

- `tsconfig.app.json`
- `src/domain/types.ts`, `slot.ts`, `columns.ts`
- `src/lib/projectPackage.ts`
- `src/components/assets/CharacterDetailPage.tsx` (discriminated `back` prop)
