# Type Safety

> TypeScript conventions in this project.

---

## Overview

Strict TypeScript (`tsconfig.app.json`: `strict`, `verbatimModuleSyntax`, `noUnusedLocals`, `noUnusedParameters`). Domain types and normalizers live under `src/domain/`. Path alias `@/*` → `src/*`. Zod is used for project-package imports and model tool argument boundaries, not forms.

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
import { patchCharacter, setCharacterSlot } from "@/db/assets";
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

### External input boundaries

Zod schemas live in `src/lib/projectPackage.ts` (`manifestSchema`, passthrough record schemas) to validate zip/manifest boundaries (`PACKAGE_FORMAT`). `src/lib/agent/tools.ts` also uses strict Zod schemas for model-supplied tool arguments before any execution or approval; unknown properties are rejected. Do not add Zod for `Field` / `Input` form validation.

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

## Typed tool and memory wire compatibility

Agent tool definitions retain schema output arguments through function-property callbacks using `defineTool` and `NoInfer`, then erase arguments once at the central heterogeneous registry. Dispatch parses unknown inputs with the selected definition before invoking its callbacks. `Spec<T>` relates parsed output to unknown input/defaults; construction assertions and the registry erasure have separate proof obligations. Actual project compiler positives/16 negatives and original/current parser/schema comparison supplement runtime validation. See [D05](./agent-tools.md#d05-schema-linked-tool-protocol-2026-10-08).

## E07 external and legacy input contracts

Independent E07 integration accepted on 2026-10-09.

### 1. Scope / Trigger

External package/JSON/provider results and legacy IndexedDB normalization are unknown until their existing field-specific contracts narrow them.

### 2. Signatures / Owners

`domain/legacyScalar.ts` owns only explicit historical primitive coercion. Package codec/slot/domain/database migration owners define required/optional/text/ID/foreign-key policies. Local object records, OGL uniform maps and union predicates stay next to their consumers; no global factory or duplicated schema framework.

### 3. Contracts / Invariants

Accept documented string/number/boolean/null/undefined primitives only at the designated legacy fields. Preserve historical defaults, trimming and identifier collision/reference checks. Reject structured arrays/objects and unsupported modern identity values before coercion; extension bags remain structured where documented. Keep discriminated union callbacks typed, capture narrowed values before asynchronous callbacks, and preserve original thrown/cancellation values where contracts require identity.

### 4. Validation / Error Matrix

Legacy primitive conversions retain exact historical outputs. Invalid modern IDs/FKs, duplicate/coercion collisions and structured forbidden inputs reject with their existing actionable boundary errors. Typed-only edits preserve emitted bodies; actual runtime changes need behavior evidence. Do not widen types to any, cast raw values to entity records, or stringify an unchecked provider terminal status.

### 5. Good / Base / Bad Cases

Good: exact unknown-array guards and typed per-key dictionaries preserve existing bounds and ordering. Base: null-prototype model lookup retains own-key behavior; responses terminal status first narrows to string. Bad: treating an assertion as validation or broadening legacy conversion to arbitrary objects and future package profiles.

### 6. Required Tests

Meaningful legacy primitive/modern ID/FK/collision/migration package tests, unknown boundary/tool behavior and original/current emitted-body proof apply to their actual owners. Keep immutable prior fixtures and their exact current API adapters; narrow adapter scope rather than rewriting historical modules.

### 7. Wrong vs Correct

Wrong: metric count reduction as behavior proof, mass ESLint fixes without before-byte/body checks or removed meaningful compatibility tests. Correct: exact per-file independent review and current consumer/type/native regression evidence, separating mechanical assertions/exports from behavior-changing boundary validation.
