# Type Safety

> TypeScript conventions in this project.

---

## Overview

Strict TypeScript (`tsconfig.app.json`: `strict`, `verbatimModuleSyntax`, `noUnusedLocals`, `noUnusedParameters`). Domain types and normalizers live with their authoritative feature under `packages/studio/src/features/<feature>/models/`; genuinely neutral primitives have named platform owners. The ownership/public-type policy follows [Studio Feature Ownership](./feature-organization.md). Product source uses relative imports within its package and declared exports across packages. The repository integration/type alias `@/*` points to Studio source for existing fixture/test contracts; application packages cannot use it to bypass exports. Zod is used for project-package imports and model tool argument boundaries, not forms.

---

## Type Organization

| Location | What belongs there |
| --- | --- |
| `platform/identity.ts` | Shared plain-string `Id`, `createId` and `nowIso`; no product entities. |
| `features/projects/models/project.ts` | `Project`, `ProjectKind`, `getProjectKind`; explicit type-only video configuration relationships. |
| `features/video/models/{shots,story,episodes,world,format,columns}.ts` | Video entity types, shot/status/filter normalizers, aspect/mode and column catalogs. |
| `features/library/models/{ownership,slots,assets,media}.ts` | Studio ownership sentinel, generation slot types/catalogs, shared creative assets and media records. |
| `features/library/models/slot.ts` | Actual slot parsers/remapping/collection; no second slot entity definition. |
| `features/settings/models/connector.ts`, `features/agent/models/chat.ts` | Connection configuration and chat entities with their actual owners. |
| Other feature `models/` | Audio/music/generation/memory/reference/Agent contracts owned by their named feature. |
| `platform/storage/tableTypes.ts` | The singular typed table registration; references authoritative models with type-only imports. |
| Local consumer module | UI-only types and narrow local parsing records next to their actual consumer. |

Paths in this table are relative to `packages/studio/src`. The old all-entity
`domain/types.ts` has no forwarding replacement. Constructors and ownership/
relationship guards also belong to their actual feature; neutral patch/order
mechanisms do not define business entities.

Shared branded-ish id type is plain `export type Id = string`. Studio vs project ownership uses `STUDIO_LIBRARY_ID` / `isStudioLibrary` from `features/library/models/ownership.ts`, not a separate branded type.

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
import type { Id } from "../../../platform/identity";
import type { GenerationSlot } from "../models/slots";
import { patchCharacter, setCharacterSlot } from "../commands/assets";
```

- Use package-local relative imports for production source; cross-package callers use declared exports. Existing test/fixture aliases remain integration infrastructure, not production dependency permission.
- Do not emit values from type-only modules incorrectly — keep runtime helpers (`normalizeShotStatus`, `parseGenerationSlot`) as value exports alongside types.

---

## Validation

### Domain / IndexedDB shape

Runtime shape repair uses hand-written normalizers and parsers, not Zod:

- `normalizeShotStatus` / `normalizeShotFilters` / `normalizeShotWorkspaceView` in `packages/studio/src/features/video/models/shots.ts`
- `parseGenerationSlot` / `parseShotPictureSlots` in `packages/studio/src/features/library/models/slot.ts` (legacy `frame` / `reference` / media-id fields coalesced into slots)
- `normalizeVisibleColumns` in `packages/studio/src/features/video/models/columns.ts`

Unknown or missing shot status becomes `"draft"`. Empty filter arrays mean “all”.

### External input boundaries

Zod schemas live in `packages/studio/src/app/workflows/packages/projectPackage.ts` (`manifestSchema`) and its `projectPackageCodec.ts` (passthrough record schemas) to validate zip/manifest boundaries (`PACKAGE_FORMAT`). `packages/studio/src/features/agent/runtime/tools.ts` also uses strict Zod schemas for model-supplied tool arguments before any execution or approval; unknown properties are rejected. Do not add Zod for `Field` / `Input` form validation.

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

- Entity + normalizers: `features/library/models/assets.ts` (`Character`) and `features/video/models/shots.ts` (`Shot`, `ShotFilters`, `normalizeShotFilters`)
- Slot legacy parse: `packages/studio/src/features/library/models/slot.ts` (`parseGenerationSlot`, `parseShotPictureSlots`)
- Column catalog: `packages/studio/src/features/video/models/columns.ts`
- Zod package boundary: `packages/studio/src/app/workflows/packages/projectPackage.ts`
- `import type` usage: `packages/studio/src/features/library/ui/GenerationSlotCard.tsx`, `packages/studio/src/platform/storage/tableTypes.ts`

---

## Forbidden Patterns

- Introducing Zod (or another schema lib) for every form field — patch repo with string/number values directly.
- Defining duplicate `Shot` / `GenerationSlot` interfaces inside components instead of importing from their authoritative feature models.
- Treating raw Dexie JSON as trusted without going through slot/status normalizers when reading legacy fields.
- Value imports of types under `verbatimModuleSyntax` (breaks `pnpm lint` / `tsc -b`).
- Using `any` for entity blobs; prefer `unknown` + narrow, or `Record<string, unknown>` inside parsers.

---

## References

- `tsconfig.app.json`
- `features/video/models/{shots,columns}.ts`, `features/library/models/slot.ts`
- `packages/studio/src/app/workflows/packages/projectPackage.ts`
- `packages/studio/src/features/library/ui/CharacterDetailPage.tsx` (discriminated `back` prop)

## Typed tool and memory wire compatibility

Agent tool definitions retain schema output arguments through function-property callbacks using `defineTool` and `NoInfer`, then erase arguments once at the central heterogeneous registry. Dispatch parses unknown inputs with the selected definition before invoking its callbacks. `Spec<T>` relates parsed output to unknown input/defaults; construction assertions and the registry erasure have separate proof obligations. Actual project compiler positives/16 negatives and original/current parser/schema comparison supplement runtime validation. See [D05](./agent-tools.md#d05-schema-linked-tool-protocol-2026-10-08).

## E07 external and legacy input contracts

Independent E07 integration accepted on 2026-10-09.

### 1. Scope / Trigger

External package/JSON/provider results and legacy IndexedDB normalization are unknown until their existing field-specific contracts narrow them.

### 2. Signatures / Owners

`platform/data/legacyScalar.ts` owns only explicit historical primitive coercion. Package codec/slot/domain/database migration owners define required/optional/text/ID/foreign-key policies. Local object records, OGL uniform maps and union predicates stay next to their consumers; no global factory or duplicated schema framework.

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
