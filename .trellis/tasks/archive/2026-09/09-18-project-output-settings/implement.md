# Implement — Project output settings

1. `domain/types.ts` — presets, normalize, extend `Project` + empty/parse paths.
2. `db/repo.ts` — `createProject(..., aspect?)`; `updateProject` / `patchProjectOutput`; cover set/clear (+ media upload helper reuse from slots).
3. `lib/projectPackage.ts` — parse/serialize aspect + coverMediaId; ensure cover media in export collect.
4. `ProjectGalleryPage` — create UI + cover resolution for cards; `frame="poster"` on CoverCard/CreateTile.
5. `CoverCard.tsx` — add `frame` prop (`wide` | `poster` / 2:3).
6. `WorkspaceChrome` —「项目设定」dialog (aspect + cover).
7. Tests: normalize defaults; package round-trip with cover/aspect; create defaults.
8. `pnpm lint` && `pnpm test`.
