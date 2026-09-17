# Design — 单片与连载项目模式

## Data

Add `Project.mode: "film" | "series"`. `emptyProject` defaults to film. Normalizers/import treat missing mode as series for compatibility.

No Dexie index or schema version is required because mode is embedded in project JSON.

## Routing

- Series `/p/$projectId` renders the episode list.
- Film `/p/$projectId` resolves the first episode and redirects to `/p/$projectId/e/$episodeId`.
- Film episode chrome offers Story / World / Shots / Produce without a “back to episodes” loop.
- Series episode chrome remains unchanged.

## Compatibility

Existing records lack mode and therefore resolve to series. New package fields are optional under package v1.

## Error Cases

A film without an episode repairs by creating one or presents a recoverable error; it must not loop redirects.
