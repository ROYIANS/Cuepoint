# Design — Project output settings

## Data

Extend `Project` (normalize on read):

```ts
type AspectPresetId = "16:9" | "9:16" | "1:1";

// on Project:
aspectPreset: AspectPresetId; // default "16:9"
coverMediaId?: Id;
```

Resolution is **derived** from preset (not separately editable in MVP):

| Preset | width × height |
| --- | --- |
| 16:9 | 1920 × 1080 |
| 9:16 | 1080 × 1920 |
| 1:1 | 1080 × 1080 |

Helpers: `ASPECT_PRESETS`, `normalizeAspectPreset`, `resolutionForAspect(preset)`.

`coverMediaId` optional; clearing sets `undefined`. Cover media remains in `media` table with `projectId`; include in package collect like other project media.

## UI

1. **Create dialog** (`ProjectGalleryPage`): aspect segmented control under mode; show “1920×1080” hint for selected preset.
2. **In-project**: Dialog or sheet from `WorkspaceChrome` overflow menu —「项目设定」: aspect + cover Still/upload/clear.
3. **Gallery**: `coverMediaId ?? coverOfProject(...)`.
4. **Poster frame**: `CoverCard` / `CreateTile` accept `frame?: "wide" | "poster"` (`wide` = current `16/10`, `poster` = `2/3`). `ProjectGalleryPage` passes `frame="poster"`. Media uses `object-cover` (Still/MediaPreview already fill).

## Compatibility

- `parseProject` / `createProject` apply defaults.
- Package format string unchanged; fields optional in `projects.json`.
- No Dexie schema version bump if `projects` is document store (confirm `database.ts`); still normalize in app layer.
