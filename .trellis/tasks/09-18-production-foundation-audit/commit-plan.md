# Proposed commit batch

Awaiting one-shot user confirmation. Do not push.

## 1. fix: harden manual production persistence and delivery

- `.trellis/spec/frontend/component-guidelines.md`
- `.trellis/spec/frontend/delivery-export.md`
- `.trellis/spec/frontend/hook-guidelines.md`
- `.trellis/spec/frontend/index.md`
- `.trellis/spec/frontend/state-management.md`
- `src/components/assets/AssetLibraryPage.tsx`
- `src/components/assets/AssetTextField.tsx`
- `src/components/assets/CharacterDetailPage.tsx`
- `src/components/assets/PropDetailPage.tsx`
- `src/components/assets/SceneDetailPage.tsx`
- `src/components/assets/StyleDetailPage.tsx`
- `src/components/assets/WorldSettingPanel.tsx`
- `src/components/media/MediaThumb.tsx`
- `src/components/produce/ProducePage.tsx`
- `src/components/produce/StoryboardPrintPage.tsx`
- `src/components/shots/ShotEditorPage.tsx`
- `src/components/slots/GenerationSlotCard.tsx`
- `src/components/story/StoryPage.tsx`
- `src/components/studio/ProjectGalleryPage.tsx`
- `src/components/ui/draft-status.tsx`
- `src/components/ui/field.tsx`
- `src/components/workspace/EpisodeListPage.tsx`
- `src/components/workspace/WorkspaceChrome.tsx`
- `src/db/database.ts`
- `src/db/repo.ts`
- `src/domain/types.ts`
- `src/lib/copySelection.ts`
- `src/lib/debouncedDraft.ts`
- `src/lib/draftMedia.ts`
- `src/lib/episodeDelivery.ts`
- `src/lib/media.ts`
- `src/lib/projectPackage.ts`
- `src/lib/shotFilters.ts`
- `src/lib/shotMedia.ts`
- `src/lib/useShotMedia.ts`
- `tests/copySelection.test.ts`
- `tests/debouncedDraft.test.ts`
- `tests/draftMedia.test.ts`
- `tests/episodeDelivery.test.ts`
- `tests/projectPackage.test.ts`
- `tests/repoReliability.test.ts`
- `tests/shotFilters.test.ts`
- `tests/useShotMedia.test.ts`

## 2. docs: record foundation audit and staged implementation tasks

- `.trellis/tasks/09-18-production-foundation-audit/` (audit, implementation, research, verification and this commit plan)
- `.trellis/tasks/09-18-asset-output-foundation/` (second-batch requirements and verified APIMart parameter research)
- `.trellis/tasks/09-18-handoff-ai-data-contracts/` (third-batch requirements)

## Excluded

- `.tanstack/`: pre-existing unrelated untracked generated content.

After user confirmation: commit the two work groups, then apply normal task archive/session journal workflow. Follow-up tasks remain planning; parent audit/repair task can be archived independently when work commits exist.
