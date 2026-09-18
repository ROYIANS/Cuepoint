# Project output settings

## Goal

Give each project basic **成片设定**：画幅比例（带动默认分辨率）与封面，在新建时可设、在项目内可改；库卡片优先显示专用封面，并以 **竖版海报比例** 展示（类 Netflix / 豆瓣 / IMDb）。

## Confirmed facts

- `Project` has no aspect/resolution/cover fields today.
- Gallery cover is inferred from earliest shot `firstFrame` (`coverOfProject`).
- Create dialog: name + mode only.
- ZIP format `aifenjing-project-v1` must accept missing new fields via normalize-on-read.
- Shared `CoverCard` currently uses `aspect-[16/10]` (`CoverCard.tsx`); also used by asset libraries and episode list.

## Decisions

| Topic | Choice |
| --- | --- |
| Where to edit | **A** — create dialog + in-project settings |
| Aspect / resolution | **A** — presets: 16:9→1920×1080, 9:16→1080×1920, 1:1→1080×1080 |
| Cover | **A** — optional `coverMediaId`; gallery falls back to shot inference when unset |
| Library card frame | **Poster 2:3** for **项目库** (and its create tile). Production aspect stays independent. Asset library cards keep current wide frame unless we opt in later. |

## Requirements

- **R1** Persist on `Project`: aspect preset id and derived pixel size; optional `coverMediaId`.
- **R2** Default for existing projects / missing fields: 16:9 @ 1920×1080; no cover id.
- **R3** Create dialog: choose aspect preset (show implied resolution); mode + name unchanged.
- **R4** In-project settings UI: change aspect; upload/replace/clear cover (media stored like other uploads).
- **R5** Gallery `CoverCard` uses `coverMediaId` when set, else current inference.
- **R6** Export/import ZIP round-trips the new fields; old packages still import.
- **R7** Project library grid uses portrait **2:3** poster cards (`CoverCard` frame variant). Image is `object-cover` inside the poster. Does not force asset-library cards to change.

## Out of scope

- Per-episode overrides
- Actually resizing/exporting video at stored resolution
- FPS / bitrate / codec / free-form pixels
- Changing shot frame UI crop to aspect (follow-up)
- Switching asset library / episode cards to poster (optional follow-up)

## Acceptance criteria

- [ ] New project can pick 16:9 / 9:16 / 1:1; stored resolution matches preset table.
- [ ] Old projects open with 16:9 defaults without migration script.
- [ ] Project settings can change aspect and set/clear cover.
- [ ] Gallery shows explicit cover when present, in **2:3** poster cards.
- [ ] ZIP export/import preserves settings; `pnpm lint` / `pnpm test` pass.
