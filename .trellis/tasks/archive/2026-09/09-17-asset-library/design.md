# Design — asset-library

## Routes

- `p.$projectId.assets.tsx` — 列表，query `tab=characters|scenes`
- `p.$projectId.assets.characters.$characterId.tsx`
- `p.$projectId.assets.scenes.$sceneId.tsx`

## Image slots

Store on the asset as `{ [slot]: mediaId }`. Upload creates a `media` row; replacing a slot deletes the previous blob if unreferenced. Clearing a slot same.

Accept `image/png`, `image/jpeg`, `image/webp`, `image/gif`. Client-side object URL from Dexie blob.

## UI

Assets list: two tabs, card grid with cover (first filled slot or placeholder), name, short meta. Detail: left slot grid, right form fields. Save is immediate (onChange / onBlur write Dexie), no separate publish.

## Export

`characters.json` / `scenes.json` already specified in parent design; media files included by id. Foundation exporter must iterate characters/scenes/shots media ids — if foundation exported empty arrays, extend exporter here to collect asset image ids.
