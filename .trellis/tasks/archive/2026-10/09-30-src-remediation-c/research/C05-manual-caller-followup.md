# C05 caller follow-up (preparation only)

2026-09-30 read-only coordinator evidence; findings remain pending until C05 implementation/check.

| Consumer | Payload source | Media boundary consequence |
| --- | --- | --- |
| Asset detail pages | Literal name/bio/appearance/notes and type-specific text fields; baseline per field | No production slot payload |
| businessTools assetApi namespace function references | Four repo patch references, strict businessSchemas.assetFields, `api.patch(args.id,args.patch)` and create fields | Text-only schema; dedicated slot_update already owns slots |
| businessTools shotPatch | Strict shotFields; nullable scene/beat/style and inheritance normalization | No firstFrame/lastFrame/clip keys |
| ShotEditorPage PlainCell dynamic column.id | SHOT_COLUMNS/domain ShotColumnId; duration/characters/scene handled by prior branches | Remaining text keys content/notes/category/sound/emotion/cameraAngle/cameraGear/focalLength/sceneCloseup, no media |
| ShotEditorPage relation save/retry | Style/prop relationship payload | Optional relation data remains supported |
| productionProposals apply/undo | normalizeChange shot-text allowlist, explicitly deletes historical result | Media proposals go to writeResult dedicated slot path |
| Agent project cover update | repo.patchProjectOutput with coverMediaId after own orchestration validation | Direct repository API must still enforce owned valid image and atomic recycling |

Static AST inventory `C05-static-call-sites.json`:43 named-import/namespace calls and4 namespace function references. It does not prove arbitrary computed references; manual follow-up above covers current dynamic production paths. Existing wide media patch uses in tests must be assessed as fixtures and migrated or validated explicitly, not silently filtered. Current clip API permits image planning placeholders, preserved.
