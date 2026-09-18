# Commit proposal

## feat: complete asset relationships and model-aware project settings

One coherent second-batch commit including domain/repo/package changes, UI, tests, specs and task evidence:

- `.trellis/spec/frontend/asset-output-foundation.md`
- `.trellis/spec/frontend/component-guidelines.md`
- `.trellis/spec/frontend/delivery-export.md`
- `.trellis/spec/frontend/index.md`
- `.trellis/tasks/09-18-asset-output-foundation/check.jsonl`
- `.trellis/tasks/09-18-asset-output-foundation/design.md`
- `.trellis/tasks/09-18-asset-output-foundation/implement.jsonl`
- `.trellis/tasks/09-18-asset-output-foundation/implement.md`
- `.trellis/tasks/09-18-asset-output-foundation/prd.md`
- `.trellis/tasks/09-18-asset-output-foundation/research/independent-review.md`
- `.trellis/tasks/09-18-asset-output-foundation/task.json`
- `.trellis/tasks/09-18-asset-output-foundation/verification.md`
- `src/components/assets/AssetLibraryPage.tsx`
- `src/components/assets/CharacterDetailPage.tsx`
- `src/components/assets/PropDetailPage.tsx`
- `src/components/assets/SceneDetailPage.tsx`
- `src/components/assets/StyleDetailPage.tsx`
- `src/components/media/MediaPicker.tsx`
- `src/components/produce/ProducePage.tsx`
- `src/components/produce/StoryboardPrintPage.tsx`
- `src/components/shots/ShotEditorPage.tsx`
- `src/components/slots/GenerationSlotCard.tsx`
- `src/components/story/StoryPage.tsx`
- `src/components/studio/AssetLibraryPages.tsx`
- `src/components/studio/ProjectGalleryPage.tsx`
- `src/components/workspace/ProjectSettingsPanel.tsx`
- `src/components/workspace/WorkspaceChrome.tsx`
- `src/db/repo.ts`
- `src/domain/output.ts`
- `src/domain/types.ts`
- `src/lib/assetLibrary.ts`
- `src/lib/episodeDelivery.ts`
- `src/lib/mediaPicker.ts`
- `src/lib/projectPackage.ts`
- `src/lib/shotRelations.ts`
- `src/routes/p.$projectId.world.tsx`
- `tests/aspectPreset.test.ts`
- `tests/assetFoundation.test.ts`
- `tests/assetLibrary.test.ts`
- `tests/episodeDelivery.test.ts`
- `tests/mediaPicker.test.ts`
- `tests/output.test.ts`

## Excluded

- `.tanstack/` — pre-existing unrelated generated content.

After approval: commit work, archive this task, record session; leave third task in planning. Do not push.
