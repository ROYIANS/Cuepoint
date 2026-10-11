# Shared video contract (2026-10-11)

The renderer owns one typed `VideoWorkspaceRepository` boundary. Browser implementation delegates to existing Dexie commands; native implementation delegates to closed Tauri actions. Neither side receives SQL, absolute paths, arbitrary JSON patches, or credentials.

Canonical wire action names:

- `videoState { projectId }`
- `createVideoProject { project, video }`, `patchVideoProject { projectId, patch, baseline? }`, `deleteProject { projectId }`
- `episode { episode }`, `patchEpisode { episodeId, patch, baseline? }`, `reorderEpisodes { projectId, orderedIds }`, `deleteEpisode { episodeId }`
- `beat { beat }`, `patchBeat { episodeId, beatId, patch, baseline? }`, `reorderBeats { episodeId, orderedIds }`, `deleteBeat { episodeId, beatId }`, `duplicateBeat { episodeId, beatId, includeShots }`
- `shot { shot }`, `patchShot { shotId, patch, baseline? }`, `addShots { projectId, episodeId, count, atOrder?, beatId? }`, `reorderShots { episodeId, orderedIds }`, `deleteShots { episodeId, shotIds }`, `duplicateShot { episodeId, shotId }`
- `bulkShots { episodeId, shotIds, patch }`, `videoUndo { receipt }`

Canonical video fields are typed and closed: project kind/mode/aspect/output dimensions/logline/archive; episode metadata/logline/script/shot filters; beat title/content/character and scene relations/time-of-day/UTF-16 script range; shot order/status/duration/content/notes/camera fields and typed character/scene/prop/style relations. Generation/media slots remain optional capability fields until native storage supports them.

Mutation results are closed outcomes (`project`, `videoProject`, `episode`, `beat`, `shot`, `shots`, `duplicateBeat`, `duplicateShot`, `state`, `videoState`, `undo`, `conflict`). Duplicate results return the actual copied rows and their receipt. Unsupported product capabilities are exposed by the repository; there is no invented successful capability mutation. Baselines carry only edited field values. Baseline conflicts return a typed `conflict` outcome with `resource`, `id` and `fields[{field,current,expected,requested}]`; the desktop boundary reads the current state only to form diagnostics and never replays the rejected write. Worker/undo rejection keeps the typed `conflict` error code. The adapter retains the shared editor draft in either case. Browser adapters preserve existing Dexie transaction and undo semantics.

## Baseline and inverse contracts

- Episode draft baseline keys: `title`, `logline`, `script` only for fields actually patched.
- Beat draft baseline keys: `title`, `content`, `timeOfDay` only for fields actually patched.
- Shot draft baseline keys: `shotNumber`, `content`, `notes`, `category`, `sceneCloseup`, `sound`, `emotion`, `cameraAngle`, `cameraGear`, `focalLength`, `durationSec`; relationship edits remain typed commands and require owner membership.
- Wire baseline is `{fields: [{field, value}]}` with canonical scalar strings; unsupported keys are rejected. Current==requested converges; other current!=expected conflicts preserve draft.
- Reorder/delete native commands return `{token, resource, ids}` issued by the write transaction. UI closures capture each receipt directly; snapshot restore adapters bind receipts by object identity in a WeakMap. Fixed entity/selection keys are forbidden because consecutive operations could overwrite each other's inverse.
- Atomic project creation and atomic multi-shot insertion each use a single native write transaction, so a failed final target cannot leave a partial visible operation.
- Native schema is fresh revision 4. `scriptRange` is the sole beat range DTO; internal SQLite start/end columns do not create a second accepted wire representation.
- Project metadata includes persisted creation/update timestamps, brief, genre, audience and tone. Settings/columns/filter patches preserve unrelated state.
- Native project deletion removes logical rows and registered asset references together; copied managed bytes remain unreferenced in the workspace. Physical erasure/GC is outside this action and is disclosed in the shared native confirmation.
